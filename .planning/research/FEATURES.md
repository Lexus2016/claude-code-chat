# Features Research — Native Telegram UX

**Domain:** Developer-focused remote control panel Telegram bot
**Researched:** 2026-03-28
**Confidence:** HIGH (Telegram Bot API official docs + multiple verified sources)

---

## Table Stakes

These are features a developer-focused control panel bot MUST have. Their absence causes users to give up or find the bot unusable in daily use.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Persistent reply keyboard reflecting current context | Users need zero-memory navigation — they should never wonder "what do I tap to go back?" | Medium | The bottom keyboard must always show the context: if a project is active, show its name. If a chat is active, show it. This is the single highest-leverage UX change. |
| Back button on every inline keyboard screen | Users panic without an escape route. Without a back button, any navigation dead-end requires /start to recover. | Low | Always the bottom-left button, consistent position builds muscle memory. Never rely on /start as the only escape. |
| Inline-only navigation (no slash commands for navigation) | Slash commands require memory; buttons require only recognition. For developers using the bot daily on mobile, slash commands for navigation (/project 2, /chat 3) are actively hostile — they require typing, exact syntax, and offer no discovery. | Medium | Keep /start and /help as entry points. Remove /project N, /chat N entirely. |
| State always visible | Users context-switch constantly. The bot must answer "what project am I in? what chat?" without requiring any action. The status header of the current screen message must show this. | Low | Show "Project: foo / Chat: bar" in every message heading. |
| 2-tap path to send a message to Claude | The core value of the bot. If it takes more than 2 taps from the main menu, the navigation is broken. | Medium | Verified as the stated core requirement in PROJECT.md. "Just type" shortcut must be discoverable. |
| Explicit state machine with no silent captures | `pendingInput` that silently captures the next message is a critical failure. If the user forgot they initiated task creation 3 minutes ago, their next message should not become a task title. | High | Every waiting-for-input state must: (a) show a visible prompt with a Cancel button, (b) time out or be explicitly cancellable. This is the #1 source of user confusion in the current bot. |
| Edit-in-place over send-new-message | Bots that send a new message for every navigation step clutter the chat history. Every navigation action (tap a menu item, go back, change project) must edit the existing message, not append a new one. | Low | Telegram Bot API supports `editMessageText` + `editMessageReplyMarkup`. The single "screen message" pattern is the right model. |
| Typing/progress indicator for long operations | Claude responses take 5–60 seconds. Without a visible indicator, users assume the bot is broken. `sendChatAction("typing")` must be looped every 4 seconds for operations > 5 seconds. | Low | Bot API 9.3 introduced `sendMessageDraft` for native streaming — evaluate if available in current API version. |
| Visible error states with recovery action | If Claude fails, the network drops, or a task can't be created, the bot must show what went wrong and offer a clear action (Retry, Go Back, Cancel). Silent failures are worse than noisy failures. | Low | Never leave the user with a broken keyboard and no way forward. |
| Forum Mode and Direct Mode clearly separated | Sharing slash commands between the two modes causes semantic confusion. A user in a forum topic should see forum-appropriate options only. | Medium | Forum Mode gets its own command namespace and keyboard set. |

---

## Differentiators

These features are not expected — developers will not demand them on day one — but they are what make a bot feel professional, native, and worth keeping installed.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Smart persistent keyboard adapts to context | Rather than a static bottom keyboard, the keyboard updates based on active state: no project → show "Pick Project"; project active → show project name + "New Chat"; chat active → show "Just type to send" affordance. This is the hallmark of a well-engineered bot. | Medium | Requires a "keyboard renderer" function that takes current state and emits the appropriate ReplyKeyboardMarkup. |
| Notification messages include inline action buttons | When Claude completes a task, the notification should have an inline button: "View Response" / "Continue" / "New Task". Action-attached notifications eliminate the round-trip of navigating back to the relevant context. | Low | This is standard in high-quality Telegram bots (GitHub notifications, CI/CD bots). Transforms push messages from inert alerts to interactive touchpoints. |
| "Just type to send" affordance always visible | The fastest path — typing directly sends to Claude — is invisible to new users. A persistent hint ("Just type a message to send to Claude") in the keyboard or status header closes this discovery gap without adding taps. | Low | A single line in the keyboard label or last message footer. Zero extra interaction cost. |
| Paginated project/chat lists with most-recent first | For developers with many projects, showing the most recently active ones first (top 6–8) with a "More..." button satisfies the 90th-percentile use case with one tap. | Low | Matches the "Top-N + More" pattern: 1–12 items → static list; 13–48 → top-N + paginated More. |
| Ask-user questions rendered as distinct interactive messages | When Claude asks a question mid-task, the bot should send it as a clearly distinct message with the question text prominent and a reply keyboard of Yes/No/Cancel (or free-text prompt). This must not be confused with regular task input. | Medium | Visually distinct: different formatting, "Claude is asking:" header, dedicated state in FSM so it cannot be pre-empted by other input. |
| Confirm-before-destructive-action pattern | Actions like "Delete task", "Cancel task", "Disconnect device" should require a confirmation step. This is native Telegram UX — a two-button confirm/cancel inline keyboard on the same message. | Low | Prevents accidental data loss. Widely expected in control-panel bots. |
| Task status with visual Kanban labels | When showing tasks, use emoji labels for Kanban columns (e.g., backlog / todo / in-progress / done) rather than plain text. Scannable at a glance on mobile. | Low | No functional change, pure presentation improvement. |
| Session continuity indicator | When resuming a Claude session (--resume), show the last message or session title so the user knows what context Claude has. Prevents "wait, which conversation is this?" confusion. | Low | One line of context is enough. |

---

## Anti-Features

These are things the bot currently does (or risks doing) that should be explicitly avoided in the redesign.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Dual navigation systems (slash commands + inline buttons that don't sync) | Two systems for the same action guarantee inconsistency. Users who learned one way are confused when the other behaves differently. The current bot has /project 2 and inline project selection that track state separately. | One navigation system: inline buttons only for navigation. Keep /start (entry point) and /help (discovery). Remove all navigation-by-number commands. |
| Silent pendingInput capture | The current bot's `pendingInput` flag silently captures the next plain-text message for task creation even if the user has forgotten the context. This causes random text to be turned into task titles. | Every waiting-for-input state must be a visible FSM state with a cancel button. Explicit, cancellable, visible prompt. State expires or is cancelled explicitly. |
| Sending a new message for every navigation step | Floods the chat history with "menu noise." Users scroll past 40 menu messages to find their actual conversation. | Single "screen message" per navigation session. Edit in place for all navigation. Only send new messages for content that should persist (Claude responses, notifications). |
| Stale inline buttons that remain interactive after context has changed | If the user picks project A from an old message, and the current project is now B, tapping the old button mutates state silently. The current bug with `screenMsgId` is caused by having multiple active screens. | Track the single active screen message ID. On any navigation action, invalidate old keyboards by removing their inline markup (or deleting the message). Only the current screen responds to callbacks. |
| Overloaded message with too many buttons | The current main menu tries to show everything at once. On mobile, >5 rows causes render lag and visual overwhelm. | Max 4 rows in any keyboard. Group actions by frequency: primary actions in row 1, secondary behind "More". Deep actions behind dedicated sub-screens. |
| Navigation dead ends | Any state that has no "back" or "cancel" option requires /start to escape. This is disorienting and loses the user's navigation context. | Every screen has a Back button. /start always works as a nuclear reset with a confirmation prompt ("This will reset your navigation. Continue?"). |
| pendingAskRequestId + pendingInput interference | Two independent "waiting for text input" flags can both be active, and whichever handler fires first wins. This is a race condition in UX terms. | Unified FSM with mutually exclusive states. At any time, the bot is in exactly ONE state: IDLE, COMPOSING, AWAITING_TASK_INPUT, AWAITING_CLAUDE_QUESTION, etc. Transitions are explicit. |
| Implicit context mutation | Selecting a project silently resets the active session without warning. Users discover this when their next message goes to the wrong chat. | Any action that changes context (project, chat) must be explicit: show what's being changed and confirm if a chat is active. |
| Commands that duplicate buttons | /compose, /project, /chat commands exist alongside inline buttons that do the same thing. Maintenance burden doubles and parity bugs appear. | Remove navigation slash commands. Document the decision so they don't creep back. |
| Long menus without "what is active" context | The current bot shows a project list but doesn't highlight which one is currently selected. | Show current state in the header of every screen. "Currently: Project foo / Chat bar" before the action list. |

---

## Feature Interaction Patterns

How features must work together. These are the structural decisions that make or break UX.

### Pattern 1: Single Screen Message

At any point, there is exactly one "navigation screen" message in the chat. All navigation actions (tap a menu item, go back, select a project) edit that message. New messages are only sent for:
- Claude responses (persistent content)
- Notifications (task complete, Claude question)
- Error messages that are too long to fit in the screen message

This requires storing the `screenMsgId` and always calling `editMessageText` on it. If the message is deleted by the user, the bot detects the error and sends a fresh screen.

**Dependency:** Requires FSM state to know what screen to re-render on edit.

### Pattern 2: FSM States Map to Screens

The state machine drives the UI. Each FSM state has:
- A screen renderer (what the user sees)
- A set of valid transitions (what buttons/inputs are accepted)
- An explicit "exit" path (back button, cancel button, or completion)

States:
```
IDLE                  — main menu, no active project/chat
PROJECT_LIST          — viewing project picker
PROJECT_ACTIVE        — project selected, chat list visible
CHAT_ACTIVE           — chat selected, compose is the primary action
COMPOSING             — user sent text, Claude is processing
AWAITING_TASK_INPUT   — waiting for task title (explicit, cancellable)
AWAITING_TASK_DESC    — waiting for task description (optional, skippable)
AWAITING_CLAUDE_Q     — Claude's ask_user is waiting for a response
```

**No two waiting states can be active simultaneously.** Transitioning to any AWAITING_* state must first assert that no other AWAITING_* state is active. If one is, show it and require resolution before continuing.

### Pattern 3: Notification + Action Button

Every push notification (Claude done, Claude question, task status change) arrives with an inline keyboard offering the next logical action:
- Claude task complete → "View Response" | "New Task"
- Claude asking a question → "Answer" (opens AWAITING_CLAUDE_Q) | "Skip"
- Tunnel status change → "Reconnect" | "Dismiss"

This makes notifications actionable and reduces the round-trip back to the navigation flow.

**Dependency:** Notification handler must be able to transition FSM state when a button is tapped from a notification message (not from the screen message). This is a separate callback path from navigation.

### Pattern 4: Read Actions vs. Write Actions

Read actions (view chat history, view git log, view file, view task list) should:
- Edit the screen message in place
- Show content inline with pagination if needed
- Never require confirmation

Write actions (send message, create task, delete task, toggle tunnel) should:
- For irreversible actions: show a confirm/cancel inline keyboard first
- Show a `sendChatAction("typing")` / progress indicator while processing
- Report the outcome explicitly ("Task created" / "Message sent" / "Error: ...")
- Return to the appropriate screen after completion

The visual distinction is: read actions are "navigation," write actions are "transactions." Transactions always have a visible start (button press), a visible in-progress state (typing indicator or message), and a visible outcome (success/failure message).

### Pattern 5: Context-Aware Persistent Keyboard

The bottom reply keyboard (not the inline keyboard attached to the screen message) always shows:
- Current project name (if any): acts as a breadcrumb
- Current chat title (if any): second breadcrumb
- "Just type to send" label: the discovery affordance
- "Main Menu" button: nuclear navigation reset

This keyboard never changes based on what screen the user is on — it is the escape hatch. The inline keyboard on the screen message handles all other navigation.

**Dependency:** Must be re-sent whenever the active project or chat changes, so that the button labels update. Since ReplyKeyboardMarkup buttons display as sent text, changing the labels requires re-sending the keyboard.

### Pattern 6: Forum Mode Isolation

Forum Mode (supergroup topics) has fundamentally different semantics:
- Each topic is bound to a specific project automatically
- The "project picker" step does not exist (project = topic)
- Compose is always the primary action (no project selection needed)

All Forum Mode handlers live in a separate module (TelegramBotForum class). It registers its own handlers and does not share state with Direct Mode. Direct Mode never receives updates from supergroup topics, and vice versa.

**Dependency:** The FSM and keyboard renderers must be separate instances or have a mode flag that gates which handlers are active.

---

## MVP Recommendation

For the redesign milestone, prioritize in this order:

**Phase 1 (Core navigation fix — eliminates the worst pain):**
1. Implement FSM with explicit states — eliminates pendingInput bugs
2. Single screen message pattern — eliminates chat flood
3. Persistent reply keyboard with context breadcrumbs — eliminates "where am I?"
4. Back button on all screens — eliminates dead ends
5. Remove slash-command navigation — eliminates dual-system confusion

**Phase 2 (Polish — makes it feel native):**
6. Notifications with action buttons
7. Confirm-before-destructive
8. Context header in every screen ("Currently: Project / Chat")
9. Read vs. Write visual distinction (typing indicator for writes)

**Defer:**
- sendMessageDraft streaming (Bot API 9.3): assess API version support before including
- Forum Mode extraction to separate module: architectural, not user-facing — do after navigation works
- i18n extraction: also architectural — do in parallel with logic refactor, not as a feature

---

## Sources

| Source | Confidence | URL |
|--------|-----------|-----|
| Telegram Official Bot Features | HIGH | https://core.telegram.org/bots/features |
| Telegram Bot API Reference | HIGH | https://core.telegram.org/bots/api |
| Telegram Inline Keyboard UX Guide | MEDIUM | https://wyu-telegram.com/blogs/444/ |
| grammY Keyboard Documentation | HIGH | https://grammy.dev/plugins/keyboard |
| DEV.to: Two Design Patterns for Telegram Bots | MEDIUM | https://dev.to/madhead/two-design-patterns-for-telegram-bots-59f5 |
| Bitders: Telegram Bot Keyboard Types Complete Guide | MEDIUM | https://bitders.com/blog/telegram-bot-keyboard-types-a-complete-guide-to-commands-inline-keyboards-and-reply-keyboards |
| Aiogram FSM Documentation | HIGH | https://medium.com/sp-lutsk/exploring-finite-state-machine-in-aiogram-3-a-powerful-tool-for-telegram-bot-development-9cd2d19cfae9 |
| sendMessageDraft (Bot API 9.3) | HIGH | https://github.com/openclaw/openclaw/issues/31061 |
| Telegraf sendChatAction loop issue | MEDIUM | https://github.com/telegraf/telegraf/issues/1801 |
| n8n Multi-level Navigation Workflow | MEDIUM | https://n8n.io/workflows/8844-create-a-dynamic-telegram-bot-menu-system-with-multi-level-navigation/ |
