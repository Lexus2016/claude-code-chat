# Research Summary — Telegram Bot UX Redesign

**Synthesized:** 2026-03-28
**Sources:** STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md, PROJECT.md

---

## TL;DR

This is a UX and architecture refactor of a 4693-line Telegram bot (telegram-bot.js) that serves as a remote control panel for Claude Code Studio. The core constraint is zero new dependencies and no build tools — all changes must work within the existing Node.js 20 + native fetch + SQLite stack. The key insight from research is that every major UX failure in the current bot traces to a single architectural root cause: ad-hoc flag state (pendingInput, pendingAskRequestId, composing) instead of an explicit finite state machine. Fixing the FSM first is the prerequisite that makes every UX improvement stable; building new screens on the broken state model would reproduce the same bugs in new code.

---

## Stack Recommendations

**In priority order — these are the five most important technical decisions:**

1. **Two-layer keyboard architecture (non-negotiable).** Reply keyboard (persistent bottom bar, 2-4 buttons, context breadcrumbs) for always-visible state + escape hatches. Inline keyboard (attached to one screen message, editable in place) for all navigation and selection. Never conflate them. This is the Telegram Bot 2.0 intended pattern; violating it produces the exact dual-navigation confusion the current bot has.

2. **sendMessageDraft for Claude response streaming.** Bot API 9.5 (March 2026, universally available) provides native streaming via a `draft_id`. Call `sendMessageDraft` with growing text as tokens arrive; finalize with `sendMessage`. Eliminates the editMessageText polling loop and visible message flickering. No new deps. This directly upgrades the most-used bot feature.

3. **Server-side state, terse callback_data.** The 64-byte callback_data limit is a hard API constraint. Store navigation state server-side in the user context map. callback_data carries only action identifier + one short integer ID (e.g., `screen:projects:0`, `action:new-task`). Never embed UUIDs, hashes, or paths. The new `screen:` / `action:` prefix format should be validated at construction time with an `assertCallbackData()` guard.

4. **answerCallbackQuery in a finally block, always.** Every inline button tap must call answerCallbackQuery within 15 seconds or the user sees a permanent spinner. Wrap the entire _handleCallback in try/catch with answerCallbackQuery in the finally block — not in the success path. This is a structural requirement, not just a best practice.

5. **setMyCommands with 3-5 slash commands only.** Remove /project, /chat, /session, /compose from the command list. Keep /start, /help, /cancel, /status. The "/" menu is a discovery mechanism, not a navigation system. Slash commands that duplicate inline button navigation are the root cause of dual-system confusion.

---

## Table Stakes Features

**These must work for users to accept the redesign. Their absence means the redesign failed.**

| Feature | Why It Is Non-Negotiable |
|---------|--------------------------|
| 2-tap path to first Claude message | This is the stated Core Value in PROJECT.md. If a new user can't reach Claude in 2 taps from any state, the primary goal was not achieved. |
| Persistent reply keyboard reflecting current context | Users context-switch constantly on mobile. The bottom keyboard must answer "what project/chat am I in?" without any action. Project name + chat name as button labels = zero-tap state readout. |
| Explicit FSM replacing pendingInput flags | Silent message capture (forgotten task-creation prompt hijacking free text) is the #1 reported user confusion. Every waiting-for-input state must be named, visible, and cancellable. |
| Back button on every screen | Without a back button, any dead-end requires /start to recover. This destroys navigation confidence. Back must always be available and always predictable. |
| Edit-in-place for all navigation | Sending a new message for every menu tap floods chat history with navigation noise. The single screen message pattern (edit the same message on every navigation action) is required to keep the chat usable. |
| Visible error states with recovery action | Silent failures or broken keyboards with no escape path are worse than noisy failures. Every error must show what went wrong and offer Retry / Go Back / Cancel. |
| Context header in every screen | "Currently: Project foo / Chat bar" must appear in every screen message header. Users should never have to navigate to find out what is active. |

**Must defer until navigation is stable:**
- sendMessageDraft streaming (assess API version, implement in Phase 2 after core navigation works)
- Forum Mode extraction to separate module (architectural, not user-facing — Phase 3)
- i18n extraction (pure data, no user impact — Phase 1 warmup, takes 30 minutes)

---

## Architecture Plan

**Four-file split is the right endpoint. The migration order is non-negotiable due to dependencies.**

### Target File Structure

```
telegram-bot.js          — Core: polling, routing, Direct Mode screens, FSM, API calls
telegram-bot-i18n.js     — Translation data only (825 lines extracted, pure data export)
telegram-bot-forum.js    — TelegramBotForum class (860 lines, composition not inheritance)
telegram-bot-screens.js  — Optional Phase 3+ only if screen count exceeds ~12
```

### Key Structural Decisions

**Decision 1: Explicit FSM replaces three flags.**
Replace `ctx.pendingInput` + `ctx.pendingAskRequestId` + `ctx.composing` with a single `ctx.state` (string enum) and `ctx.stateData` (object). States: IDLE, AWAITING_TASK_TITLE, AWAITING_TASK_DESCRIPTION, AWAITING_ASK_RESPONSE, COMPOSING. States are mutually exclusive. `AWAITING_ASK_RESPONSE` always overrides any other state when Claude sends ask_user. Every slash command resets to IDLE before processing.

**Decision 2: Screen registry drives navigation.**
Define screens as a data object (`SCREENS`) with `handler` and `parent` keys. Back button generation is automatic: `SCREENS[currentScreen].parent`. Callback routing is generalized: `screen:{key}:{optionalData}` routes via registry lookup. Old callback prefixes (`m:`, `p:`, `c:`, `ch:`, `cm:`, `d:`, etc.) remain functional as pass-through cases during migration.

**Decision 3: screenMsgId slot removed, replaced with callback message anchor.**
When a user taps a button, Telegram provides `cbq.message.message_id` — the exact message to edit. Pass this as `editMsgId` to screen handlers. Remove `ctx.screenMsgId` and `ctx.screenChatId` entirely. Screen handlers accept `editMsgId` (nullable): if non-null, edit; if null (slash command or notification), send new. This eliminates the stale-slot problem structurally.

**Decision 4: Forum mode via composition, not mixed into core.**
`TelegramBotForum` receives `{ db, log, api, i18n, getContext }` via constructor injection. No circular imports. Forum state is scoped to `(chatId, threadId, userId)` — never shares `ctx.state` with Direct Mode. `threadId` is always passed explicitly as a parameter; no class-level `this._currentThreadId`.

**Decision 5: server.js encapsulation via public factory method.**
`TelegramBot.createResponseHandler({ userId, chatId, threadId })` becomes the only public interface server.js uses. Private `_` methods are no longer called from outside the class. This must be coordinated with the FSM migration in a single PR (server.js currently writes `pendingAskRequestId` — after FSM migration it must write to `ctx.state` instead).

### Build Order (strict, dependencies flow left to right)

```
Phase 1: i18n extraction + FSM migration (atomic, must ship together with server.js coord)
Phase 2: screenMsgId removal + new screen handlers + persistent keyboard + UX redesign
Phase 3: Forum module extraction (after Direct Mode is stable)
Phase 4: server.js encapsulation cleanup (last — correctness, not function)
```

---

## Critical Pitfalls to Avoid

**Top 5 that would kill the redesign if hit in production:**

**Pitfall 1: Old callback_data orphaned in chat history.**
When the new `screen:` / `action:` format launches, every previously-sent message in the user's Telegram history still carries old button formats (`m:`, `p:`, `c:`, etc.). Users tap those old buttons days later. If the router has no fallback, Telegram shows a permanent spinner (QUERY_ID_INVALID in logs). Prevention: all old prefixes stay functional as pass-through cases in the router throughout the entire migration. Add a catch-all at the bottom that always calls answerCallbackQuery with "This action is no longer available. Use the menu."

**Pitfall 2: State machine migration corrupts in-flight sessions.**
The migration from `pendingInput`/`pendingAskRequestId`/`composing` to `ctx.state`/`ctx.stateData` must be atomic. If both old and new field checks exist simultaneously in the same code path, a user mid-flow can double-fire (creates two tasks, throws DB error, or gets stuck in AWAITING_TASK_TITLE forever). The entire FSM migration must ship as one PR. `_getContext` should auto-migrate old-format contexts on read to prevent stale data bleeding in.

**Pitfall 3: answerCallbackQuery not called on exception.**
Any new code path added during refactoring that throws before reaching answerCallbackQuery leaves the user with a permanently stuck spinner. The fix is structural: answerCallbackQuery belongs in the finally block of `_handleCallback`, called regardless of success or error. Any deviation from this pattern in a new callback handler is a production bug.

**Pitfall 4: Forum threadId dropped silently when extracting TelegramBotForum.**
`this._currentThreadId` is a class-level property today. After extraction to a separate class, it does not exist on the new class. All forum API calls made without an explicit `message_thread_id` succeed silently — but messages land in the General topic instead of the correct project topic. Every forum method must assert `threadId !== undefined` before calling the API. Forum detection must use `msg.chat?.is_forum === true && msg.chat?.type === 'supergroup'`, not just `is_topic_message`.

**Pitfall 5: Streaming hits editMessageText rate limit (429).**
Claude responses generate many tokens per second. Calling `editMessageText` on every token will hit Telegram's ~1 edit/second limit. The response goes into a 30+ second freeze while the retry queue drains. Prevention: debounce edits to 500ms–1s intervals with a per-chat single-outstanding-edit queue. Replace the loop entirely with `sendMessageDraft` in Phase 2 (Bot API 9.5 — this is the correct long-term fix).

---

## Phase Implications

Research findings map directly to a 4-phase implementation sequence. Each phase is independently testable and deployable.

### Phase 1: Foundation — i18n Extraction + FSM Migration
**Rationale:** This is the prerequisite for everything else. New screens built on the broken flag system will reproduce existing bugs in new code. The FSM must be established and stable before any UX work begins. i18n extraction is a 30-minute warmup that reduces the file by 825 lines and makes subsequent diffs easier to read.

**Delivers:** Correct state handling (no more silent message capture). No visible UX change to the user — this phase is invisible externally.

**Features from FEATURES.md:** "Explicit state machine with no silent captures" (Table Stakes)

**Pitfalls to avoid:** CRITICAL-3 (dual-field corruption), MED-5 (server.js must ship in same PR), HIGH-4 (i18n locale corruption — `_t` must accept `lang` as parameter, not read from `this.lang`)

**Research flag:** Well-documented FSM pattern. No additional research needed.

---

### Phase 2: UX Redesign — Navigation, Screens, Persistent Keyboard
**Rationale:** The core user-facing redesign. screenMsgId removal, new screen registry, persistent bottom keyboard, 2-tap flow, back buttons everywhere, inline-only navigation. This is the largest phase and the one that directly delivers the Core Value.

**Delivers:** 2-tap path to Claude. Visible context in all screens. No dead-ends. Chat history no longer flooded with navigation messages. sendMessageDraft streaming.

**Features from FEATURES.md (all Table Stakes + Differentiators):**
- Persistent reply keyboard reflecting current context
- Back button on every inline keyboard screen
- Inline-only navigation (no slash commands for navigation)
- State always visible ("Currently: Project / Chat" header)
- 2-tap path to send message to Claude
- Edit-in-place over send-new-message
- Smart persistent keyboard adapts to context
- Notifications with inline action buttons
- Confirm-before-destructive-action pattern
- sendMessageDraft native streaming

**Pitfalls to avoid:** CRITICAL-1 (old callback_data), CRITICAL-2 (answerCallbackQuery), CRITICAL-5 (editMessageText on old messages), HIGH-1 (rate limit on streaming edits), HIGH-2 (64-byte limit), HIGH-3 (ReplyKeyboard persistence), HIGH-5 (screen invoked from slash vs button), MED-1 (back nav dead ends), MED-2 (pagination limits), MED-4 (message not modified error)

**Research flag:** Phase 2 likely benefits from a targeted `/gsd:research-phase` pass on the persistent keyboard + sendMessageDraft integration before implementation begins. The interaction between the two keyboard layers has client-version-specific behavior.

---

### Phase 3: Forum Module Extraction
**Rationale:** Forum Mode (860 lines) mixed into the core creates maintenance risk. After Direct Mode is stable, extract `TelegramBotForum` as a separate class. This is architectural cleanup that makes future Forum Mode features easier to iterate on without risking Direct Mode regressions.

**Delivers:** Maintainable codebase. Forum Mode and Direct Mode can be modified independently.

**Features from FEATURES.md:** "Forum Mode and Direct Mode clearly separated" (Table Stakes)

**Pitfalls to avoid:** CRITICAL-4 (threadId dropped silently), MED-3 (forum detection — must use `is_forum === true`)

**Research flag:** Standard composition pattern. No additional research needed.

---

### Phase 4: server.js Encapsulation Cleanup
**Rationale:** server.js currently calls private `_` methods on the bot instance (9 methods). This is a code quality concern, not a functional one. Expose a `createResponseHandler()` public factory method and remove all direct `bot._X()` calls from server.js.

**Delivers:** Clean module boundary. Private methods can be refactored without auditing server.js.

**Features from FEATURES.md:** Not user-facing.

**Pitfalls to avoid:** MED-5 (the server.js coordination was already handled in Phase 1 for the state fields; this phase finishes the remaining methods)

**Research flag:** No research needed — straightforward encapsulation refactor.

---

## Key Decisions Required

These must be decided before or during implementation (not after):

| Decision | Options | Recommendation | When to Decide |
|----------|---------|----------------|----------------|
| Atomic Phase 1 PR scope | (a) i18n only, then FSM in a second PR vs (b) both in one PR | One PR — FSM migration requires server.js coord anyway; splitting creates a window with half-migrated state | Before Phase 1 starts |
| sendMessageDraft timing | (a) Phase 1 (early, risky) vs (b) Phase 2 (natural fit with other streaming changes) | Phase 2 — it belongs with the screen redesign, not the FSM fix | Before Phase 2 starts |
| Old callback prefix removal | (a) Remove per-phase as each prefix is migrated vs (b) Remove all at end | Per-phase removal — reduces router complexity incrementally while keeping fallback in place | During Phase 2 |
| navStack depth | (a) Depth-1 returnState vs (b) Full array stack | Start with depth-1 (covers all current navigation), extend to array only if needed | Phase 2 design |
| Persistent keyboard update strategy | (a) Re-send on every context change vs (b) Re-send only on project/chat change | On project/chat change only — avoids unnecessary keyboard re-sends on every navigation step | Phase 2 design |
| Forum mode state scoping | (a) Separate context map keyed by (chatId+threadId) vs (b) userId only with thread as parameter | Separate context key for forum — prevents any bleed between forum topics and direct mode | Phase 3 design |

---

## Confidence Assessment

| Area | Confidence | Basis |
|------|------------|-------|
| FSM design | HIGH | Direct code audit of 4693-line source + established FSM patterns; the bugs are confirmed and the fix is well-documented |
| Telegram API usage (keyboards, edit-in-place, callbacks) | HIGH | Official Telegram Bot API docs, Bot 2.0 introduction; no guesswork |
| sendMessageDraft | HIGH | Bot API 9.5 changelog (March 2026) confirmed; universally available |
| Migration risk of callback_data format change | HIGH | Direct code audit shows 14 existing callback prefixes; all must be preserved during migration |
| KeyboardButton style field (visual hierarchy) | MEDIUM | Bot API 9.4 changelog documented but not yet validated in production for this project |
| ReplyKeyboardMarkup persistence behavior | MEDIUM | Known client-version bugs exist; design must not depend on keyboard being hidden |
| sendMessageDraft draft_id reuse pattern | MEDIUM | Changelog confirmed + community issues; implementation details unvalidated |

**Overall: HIGH** — Research is grounded in direct code audit and official API documentation. The unknowns are narrow (two Medium items) and do not block the core implementation.

**Gaps to watch during implementation:**
- Validate KeyboardButton `style` field in a test message before relying on it for the "Write" button visual hierarchy
- Test ReplyKeyboard behavior on iOS, Android, and Desktop during Phase 2 — do not assume `is_persistent` behaves identically on all clients
- Verify `sendMessageDraft` with a real Claude streaming session before using it as the primary streaming mechanism

---

## Sources (aggregated from all research files)

### HIGH Confidence
- [Telegram Bot API Reference](https://core.telegram.org/bots/api)
- [Telegram Bot Features — Official](https://core.telegram.org/bots/features)
- [Bot API Changelog (sendMessageDraft, button styles)](https://core.telegram.org/bots/api-changelog)
- [Introducing Bot API 2.0 (inline keyboards)](https://core.telegram.org/bots/2-0-intro)
- [Telegram Buttons Documentation](https://core.telegram.org/api/bots/buttons)
- [Telegram Forum Topics API](https://core.telegram.org/api/forum)
- [Telegram Bot FAQ](https://core.telegram.org/bots/faq)
- Direct code audit of `telegram-bot.js` (4693 lines) and `server.js`

### MEDIUM Confidence
- [grammY Keyboards Plugin](https://grammy.dev/plugins/keyboard)
- [grammY i18n plugin](https://grammy.dev/plugins/i18n)
- [FSM Telegram Bot in Node.js — Level Up Coding](https://levelup.gitconnected.com/creating-a-conversational-telegram-bot-in-node-js-with-a-finite-state-machine-and-async-await-ca44f03874f9)
- [Two Design Patterns for Telegram Bots — DEV Community](https://dev.to/madhead/two-design-patterns-for-telegram-bots-59f5)
- [Enhanced Telegram callback_data — seroperson.me, 2025](https://seroperson.me/2025/02/05/enhanced-telegram-callback-data/)
- [ReplyKeyboardMarkup is_persistent bug — bugs.telegram.org](https://bugs.telegram.org/c/25708)
- [Bot gets stuck: cannot edit messages — bugs.telegram.org](https://bugs.telegram.org/c/5818/7)
- [sendMessageDraft streaming — openclaw community issues](https://github.com/openclaw/openclaw/issues/31061)
- [GramIO rate limits guide](https://gramio.dev/rate-limits)
- [Bitders — Keyboard Types Guide](https://bitders.com/blog/telegram-bot-keyboard-types-a-complete-guide-to-commands-inline-keyboards-and-reply-keyboards)
- [answerCallbackQuery 15-second timeout — gist.github.com/d-Rickyy-b](https://gist.github.com/d-Rickyy-b/f789c75228bf00f572eec4450ed0d7c9)
