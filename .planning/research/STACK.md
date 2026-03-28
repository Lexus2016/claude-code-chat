# Stack Research — Telegram Bot UX Patterns

**Project:** Claude Code Studio — Telegram Bot UX Redesign
**Researched:** 2026-03-28
**Scope:** Navigation UX patterns, Telegram API features, state machine design

---

## Recommended Navigation Architecture

### Primary Rule: Inline Keyboards for Navigation, Reply Keyboard for Permanent Context

Use **two keyboard layers** in tandem — never conflate them:

| Layer | Type | Purpose | Behavior |
|-------|------|---------|---------|
| Bottom bar | Reply keyboard (persistent) | Always-visible context + quick actions | Replaces device keyboard; stays visible |
| Screen content | Inline keyboard | Navigation, selections, settings | Attached to a specific message; editable in place |

**Rationale:** Reply keyboards occupy the keyboard area and persist across messages — they are ideal for showing current state (active project/chat name) and providing 2-3 global escape hatches (Menu, Write, Back). Inline keyboards live inside a specific message bubble and support edit-in-place — they are ideal for multi-level menus and navigation flows. Mixing them is correct; conflating them (putting navigation inside the reply keyboard only, or global state into inline only) is the documented anti-pattern.

### The "One Screen Message" Pattern

Maintain a single "active screen" message per user (`screenMsgId` in the current code). All navigation actions edit this one message in place using `editMessageText` + `editMessageReplyMarkup`.

**Current problem:** The existing `screenMsgId` breaks when the user taps old buttons or when multiple messages appear. The fix is not to abandon the pattern — it is to defend it correctly (see State Machine section).

**When to send a NEW message instead of editing:**
- Claude responses (these are content, not navigation)
- System alerts/notifications (real-time events from the server)
- Error messages that should persist in chat history
- Initial screen bootstrap (when no `screenMsgId` exists yet)

**When to edit in place:**
- Every navigation action (project list, chat list, settings, back)
- Status updates triggered by button press
- Pagination (prev/next page)

### Getting to First Message in 2 Taps

The current 6-step flow exists because the bot has no default state. The fix:

1. `/start` or any free-form text when no active session → **auto-show project picker** (1 tap or 0 taps for returning users with an active project)
2. User taps a project → **auto-show chat picker or auto-select latest chat** (1 tap)
3. Any subsequent free-form text → **sent directly to Claude** (0 taps)

For returning users who already have an active project and session: first free-form text should go directly to Claude (0 taps). The reply keyboard bottom bar makes the current state visible without requiring navigation.

---

## Telegram API Features to Use

### 1. Reply Keyboard with `persistent: true` and `resize_keyboard: true`

**What it does:** Shows a fixed row of 2-4 buttons at the bottom of the chat, replacing the system keyboard. With `persistent: true`, it stays visible when the system keyboard hides.

**Use for:** The always-visible bottom bar showing current project/chat name and global actions (Menu, Write, Status).

**Critical:** To clear a reply keyboard, send an explicit `ReplyKeyboardRemove`. Never rely on the client to remove it — it persists until explicitly removed or replaced.

**Confidence: HIGH** — documented in official Telegram Bot API.

### 2. Inline Keyboards with `editMessageText` / `editMessageReplyMarkup`

**What it does:** Updates an existing message's text and/or buttons without sending a new message.

**Use for:** All menu navigation (project list → project detail → chat list → chat detail). Edit the screen message on every callback, never send a new one.

**Rate limit:** Approximately 5 edits per message per minute (empirical, undocumented). For navigation menus this is never a concern. For streaming Claude responses, this matters (see `sendMessageDraft` below).

**Confidence: HIGH** — documented behavior.

### 3. `sendMessageDraft` (Bot API 9.3 / 9.5)

**What it does:** Streams partial message content to the user natively. Uses a `draft_id` (non-zero integer); repeated calls with the same `draft_id` animate the growing text on the client side.

**Use for:** Streaming Claude responses. Replaces the current `editMessageText` polling loop. Available to all bots as of Bot API 9.5 (March 1, 2026 — current).

**Workflow:**
1. Call `sendMessageDraft` with `chat_id`, `draft_id`, and growing `text` as tokens arrive.
2. When generation completes, call `sendMessage` with the final text (finalizes the draft visually).

**Why it matters for this project:** The current bot already streams via `editMessageText`. Migrating to `sendMessageDraft` eliminates visible message flickering and produces a ChatGPT-like experience. No new dependencies required — native fetch POST to `sendMessageDraft` endpoint.

**Constraint:** `draft_id` must be non-zero. The same `draft_id` can be reused per-conversation for sequential messages.

**Confidence: HIGH** — Bot API 9.5 changelog confirmed, universally available.

### 4. `setMyCommands` with Scope

**What it does:** Sets the command list shown in the "/" menu. The `scope` parameter allows different command lists for different contexts (private chats, groups, specific users).

**Use for:** Minimal slash commands only — `/start`, `/help`, `/cancel`. Remove `/project`, `/chat`, `/session` from the command list (they are redundant with inline navigation). Show different commands in Forum Mode topics vs direct chat.

**Why:** The "/" menu is a discovery mechanism for power users, not the primary navigation. Over-populating it with navigation commands is what created the dual-navigation confusion. Keep it to 3-5 universal commands.

**Confidence: HIGH** — documented.

### 5. `answerCallbackQuery` (mandatory after every callback)

**What it does:** Dismisses the "loading" spinner shown when a user taps an inline button.

**Use for:** Every single inline button callback, even if no UI update is needed. Failure to call this shows a loading spinner to the user for up to 60 seconds.

**Pattern:** Call immediately (before any async work) with an empty response, or with a brief status string (max 200 chars) as a toast notification.

**Confidence: HIGH** — documented requirement.

### 6. `KeyboardButton` with `style` field (Bot API 9.4+)

**What it does:** Colors a reply keyboard button as `primary` (blue), `success` (green), or `danger` (red).

**Use for:** The "Write / Send to Claude" button in the persistent bottom bar should use `primary` style to draw attention. Back/cancel actions can use `danger`. This makes the 2-tap flow visually obvious.

**Note:** Requires Bot API 9.4+ (February 2026). The existing native fetch implementation needs to include `style` in the `KeyboardButton` object.

**Confidence: MEDIUM** — documented in Feb 2026 changelog but not yet validated in production for this project.

### 7. Deep Linking (`?start=param`)

**What it does:** Passes a parameter to `/start` when a user opens the bot via a link.

**Use for:** Pairing flow — the existing 6-digit code pairing can be streamlined. Not relevant for navigation UX redesign, but useful for project-specific deep links in the future.

**Confidence: HIGH** — documented.

---

## Telegram API Features to Avoid

### 1. Slash Commands for Navigation (`/project 2`, `/chat 5`, `/session old`)

**Why:** Slash commands require the user to type or know the command. They are inherently not discoverable. Using them for navigation (select project 2, switch to chat 5) creates the dual-navigation problem currently present. The command list shown by "/" should not overlap with inline keyboard navigation — they serve different users (power users vs. first-time users).

**Instead:** Inline keyboard buttons. Reserve slash commands for universal, memorable actions: `/start`, `/help`, `/cancel`, `/status`.

**Confidence: HIGH** — this is the core UX recommendation from the Telegram Bot 2.0 introduction, which explicitly positioned inline keyboards as replacing command-based navigation for complex flows.

### 2. Multiple Simultaneous `screenMsgId` values

**Why:** The existing single-slot `screenMsgId` breaks when new messages appear between navigation steps. The temptation is to track multiple screen messages — resist this. Multiple tracked messages create multiple sources of truth and buttons that "do something unexpected."

**Instead:** One screen message per user. When the screen is lost (user scrolled far away, message too old, edit fails), detect the error response from `editMessageText` (error code 400 "message to edit not found") and send a fresh screen, updating `screenMsgId`.

**Confidence: HIGH** — directly addresses the documented `screenMsgId` single-slot failure mode.

### 3. Reply Keyboard for Multi-Level Navigation

**Why:** Reply keyboard buttons send text messages. Those text messages appear in chat history, clutter the conversation, and — critically — cannot be differentiated from regular user text by the bot without fragile text matching. Multi-level navigation (project list → select project → chat list) must not rely on the reply keyboard for selection.

**Instead:** Reply keyboard for 3-4 global persistent actions only. All selection and navigation through inline keyboards.

**Confidence: HIGH** — documented limitation: "All that custom keyboards do is send regular text messages. Your bot cannot differentiate between ordinary text messages and text messages that were sent by clicking a button."

### 4. Encoding Navigation State into `callback_data` Strings

**Why:** `callback_data` is limited to 64 bytes. Encoding multi-level navigation paths (project ID + chat ID + screen name) will hit this limit for any non-trivial flow. Additionally, `callback_data` is user-controlled and should not be trusted for authorization.

**Instead:** Store navigation state server-side in the per-user context (SQLite or in-memory map). `callback_data` carries only the action identifier (e.g., `p:sel`, `c:new`, `t:done`) and a single short ID (e.g., `p:42`). The current bot already does this partially — formalize it.

**Confidence: HIGH** — 64-byte limit is documented; server-side state is the established workaround.

### 5. `sendMessage` for Status Updates / Progress Polling

**Why:** Sending new messages for recurring status updates (Claude is thinking..., 30% done...) floods the chat with temporary messages that have no lasting value and cannot be cleaned up retroactively.

**Instead:** Edit a single status message in place for progress updates. Use `sendMessageDraft` for streaming AI responses.

**Confidence: HIGH** — documented edit-in-place pattern.

### 6. Telegram Mini Apps / Web Apps for Navigation

**Why:** Mini Apps are a full web application launched in a Telegram overlay. They are appropriate when the interface complexity exceeds what inline keyboards can express (e.g., a rich file browser, a Kanban board). For navigation between 4-5 screens (project picker, chat picker, compose, status), Mini Apps add unnecessary complexity and require JavaScript UI code outside the existing single-file philosophy.

**Instead:** Inline keyboards handle the navigation screens. Mini Apps remain a future option if the Kanban board feature needs richer interaction.

**Confidence: MEDIUM** — judgment call based on project constraints (no new deps, no build tools).

---

## State Machine Approach

### Recommended: Explicit Named States per User

Replace the current ad-hoc flag soup (`pendingInput`, `pendingAskRequestId`, `composing`) with a single `state` field that is mutually exclusive. Only one state is active at a time per user.

**State enumeration:**

```
IDLE                 — Default. Free text goes to Claude.
AWAITING_PROJECT     — User must pick a project (shown project list screen).
AWAITING_CHAT        — User must pick or create a chat (shown chat list screen).
AWAITING_TASK_TITLE  — Text input captured for task title.
AWAITING_TASK_DESC   — Text input captured for task description.
AWAITING_ASK_USER    — Claude's ask_user is pending; text goes to answering it.
```

Each state has:
- A `handler` function called when free-form text arrives
- A `screen` function that (re-)renders the current UI
- A `back` state to return to when the user taps Back

**State transition table:**

```
IDLE                → AWAITING_PROJECT  (tap "Menu" or /start)
AWAITING_PROJECT    → AWAITING_CHAT     (tap a project)
AWAITING_CHAT       → IDLE             (tap a chat → activates it)
AWAITING_TASK_TITLE → AWAITING_TASK_DESC (text received)
AWAITING_TASK_DESC  → IDLE             (text received, task saved)
AWAITING_ASK_USER   → IDLE             (text received, answer sent)

Any state → IDLE    (/cancel or tap the dedicated Cancel/Back button)
```

### Back Button Implementation

The back button works reliably when "back" is just a state transition:

1. Each state stores a `returnState` in the user context (defaults to `IDLE`).
2. Navigation forward: `ctx.returnState = ctx.state; ctx.state = NEW_STATE`.
3. Back button callback: `ctx.state = ctx.returnState; render(ctx.state)`.
4. This is a stack of depth 1 for the current navigation depth (3 levels: main → project → chat). For deeper navigation, extend to a `navStack: []` array.

**Navigation stack for deeper flows:**

```javascript
// Navigate forward
ctx.navStack.push(ctx.state);
ctx.state = 'AWAITING_CHAT';
renderCurrentState(userId);

// Back button
if (ctx.navStack.length > 0) {
  ctx.state = ctx.navStack.pop();
} else {
  ctx.state = 'IDLE';
}
renderCurrentState(userId);
```

This guarantees back always works regardless of how the user reached the current screen.

### State Persistence

**In-memory map (current approach) is sufficient** for this use case because:
- The bot serves a single authenticated user (or a small set of paired devices)
- The SQLite database is local; process restarts are infrequent
- Node.js long-polling process stays up continuously

**What to persist to SQLite:** Active project ID, active session ID, device pairing — these survive restarts. Navigation state (which screen is showing) does not need to survive restarts; a restart renders the bot's reply to the next message as a fresh IDLE state.

**What NOT to persist:** `screenMsgId` across restarts. After a restart, `screenMsgId` is stale. The edit call will fail with a 400 error; catch this, send a new screen, and update `screenMsgId`.

### Fixing the `pendingInput` Interception Problem

The current bug: `pendingInput = 'task_title'` silently captures the next message even if the user forgot they were in a task-creation flow.

**Fix:** The explicit state machine eliminates this. In `AWAITING_TASK_TITLE` state, the bot must show a visible "Waiting for task title — tap Cancel to abort" indicator (edit the screen message). The reply keyboard shows a "Cancel" button. Any tap on "Cancel" or any inline navigation button transitions back to `IDLE`, clearing the awaiting state.

The key insight: pending input is not a background flag — it is a named state with a visible UI and an escape hatch.

### `pendingAskRequestId` Conflict

The current bug: Claude's `ask_user` request can intercept messages meant for task creation.

**Fix:** `AWAITING_ASK_USER` is a distinct state. When Claude sends an `ask_user` event and a `pendingInput` task flow is active, the task flow is suspended (state pushed to `navStack`) and `AWAITING_ASK_USER` takes over. When the ask is answered, pop `navStack` to resume the task flow. The states are now explicit and ordered.

---

## Confidence Levels

| Recommendation | Confidence | Basis |
|----------------|------------|-------|
| Inline keyboard for navigation + reply keyboard for persistent bar | HIGH | Official Telegram docs, Bot API 2.0 introduction |
| Edit-in-place for all navigation (single `screenMsgId`) | HIGH | Official docs, documented pattern |
| `sendMessageDraft` for Claude response streaming | HIGH | Bot API 9.5 changelog (March 2026), universally available |
| `answerCallbackQuery` on every callback | HIGH | Official docs, documented requirement |
| Explicit named state machine replacing flag soup | HIGH | Established FSM pattern, directly addresses documented bugs |
| `navStack` array for back navigation | HIGH | Community consensus, no Telegram API dependencies |
| `callback_data` max 64 bytes — store state server-side | HIGH | Documented API limit |
| `setMyCommands` with minimal command set (3-5 cmds) | HIGH | Official docs |
| `KeyboardButton style` field for visual hierarchy | MEDIUM | Bot API 9.4 changelog, not yet production-validated here |
| Avoid Mini Apps for navigation screens | MEDIUM | Project constraints + UX judgment |
| `sendMessageDraft` draft_id reuse pattern | MEDIUM | Changelog + community issues, not yet implemented in this project |

---

## Sources

- [Telegram Bot Features — Official](https://core.telegram.org/bots/features)
- [Telegram Bot API Reference](https://core.telegram.org/bots/api)
- [Bot API Changelog (sendMessageDraft, button styles)](https://core.telegram.org/bots/api-changelog)
- [Introducing Bot API 2.0 (inline keyboards)](https://core.telegram.org/bots/2-0-intro)
- [Telegram Buttons Documentation](https://core.telegram.org/api/bots/buttons)
- [sendMessageDraft streaming — openclaw community issues](https://github.com/openclaw/openclaw/issues/31061)
- [Back button in ConversationHandler — python-telegram-bot discussion](https://github.com/python-telegram-bot/python-telegram-bot/discussions/2949)
- [callback_data 64-byte limit and workarounds](https://seroperson.me/2025/02/05/enhanced-telegram-callback-data/)
- [FSM Telegram Bot in Node.js](https://levelup.gitconnected.com/creating-a-conversational-telegram-bot-in-node-js-with-a-finite-state-machine-and-async-await-ca44f03874f9)
- [Bitders — Keyboard Types Guide](https://bitders.com/blog/telegram-bot-keyboard-types-a-complete-guide-to-commands-inline-keyboards-and-reply-keyboards)
- [grammY Keyboards Plugin (reference for patterns)](https://grammy.dev/plugins/keyboard)
