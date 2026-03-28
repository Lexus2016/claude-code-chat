# Pitfalls Research — Telegram Bot UX Redesign

**Project:** Claude Code Studio Telegram Bot
**Researched:** 2026-03-28
**Domain:** Telegram Bot Refactoring / UX Redesign
**Confidence:** HIGH (direct code audit + official Telegram docs + community findings)

---

## Critical Pitfalls (ship-blockers)

Mistakes that break the bot in production immediately upon deploy.

---

### CRITICAL-1: Old callback_data in chat history causes unhandled errors after deploy

**What goes wrong:**
When you change callback_data format (e.g., from old `m:menu` to new `screen:menu`), all inline keyboard buttons already rendered in the user's Telegram chat history continue to carry the old format. Users tap those old buttons days or weeks later. If the new handler does not recognize the old format, the callback fires with no matching handler, the `answerCallbackQuery` is never called, and Telegram shows a spinning indicator on the button indefinitely (until the 15-second query expiry). The user sees the bot as frozen.

**Why it happens:**
Telegram persists rendered messages with their keyboards in chat history forever. A refactor that adds new callback_data formats and removes old handlers orphans all previously-sent keyboards. The 64-byte limit on callback_data also means any versioned format competes for space.

**Consequences:**
- User taps a notification button from 2 days ago → spinner, no response
- Bot log shows no error (callback arrives, falls through silently)
- `QUERY_ID_INVALID` error appears after 15 seconds in logs
- User thinks the bot is broken

**Prevention strategy:**
1. Keep all old callback_data prefixes functional during migration. The ARCHITECTURE.md already calls this out: `m:`, `p:`, `c:`, `ch:`, `cm:`, `d:`, `fm:`, `fs:`, `fa:`, `f:`, `t:`, `s:`, `tn:` must remain in the router as pass-through cases.
2. Add a catch-all at the bottom of the callback router that calls `answerCallbackQuery` with a "This action is no longer available. Please use the menu." message.
3. Never remove old prefix handlers without first auditing the maximum age of sent messages (notifications sent by Claude responses can be days old).
4. Migrate prefixes one phase at a time, not all at once.

**Warning signs:**
- Any deploy that changes `callback_data` format without a fallback case
- The string "QUERY_ID_INVALID" appearing in logs after deploy

**Phase most affected:** Phase 2 (UX Redesign — when the new `screen:` and `action:` prefixes are introduced)

---

### CRITICAL-2: answerCallbackQuery not called → permanent spinner on button

**What goes wrong:**
Every inline keyboard button tap must receive a call to `answerCallbackQuery` within approximately 15 seconds, even if the bot has nothing to show. If any code path in the callback router throws an exception before reaching `answerCallbackQuery`, the spinner on that button never dismisses. This is visible to the user as the button being "stuck."

**Why it happens:**
During a refactor, new code paths are added. Exception handling that was working in the old monolith may not cover new routes. A single unhandled promise rejection in the callback chain drops the `answerCallbackQuery` call.

**Consequences:**
- Button appears frozen after tap
- User taps again, firing the same callback twice (double-action)
- If the action had side effects (create task, switch project), it fires twice silently

**Prevention strategy:**
1. Wrap the entire `_handleCallback` method in a try/catch that always calls `answerCallbackQuery` in the finally block, never in the success path.
2. Pattern:
   ```javascript
   async _handleCallback(cbq) {
     try {
       await this._routeCallback(cbq);
     } catch (err) {
       this.log.error('callback handler error', err);
     } finally {
       // Always answer, even on error
       await this._callApi('answerCallbackQuery', { callback_query_id: cbq.id });
     }
   }
   ```
3. Never `await answerCallbackQuery` before completing heavy work — answer immediately (empty ACK), then do the work asynchronously.

**Warning signs:**
- Any callback handler that `await`s a database or API operation before calling `answerCallbackQuery`
- Missing try/catch in refactored callback routing chain

**Phase most affected:** Phase 1 (State Machine), Phase 2 (UX Redesign — when callback routing is restructured)

---

### CRITICAL-3: State machine migration corrupts in-flight user sessions

**What goes wrong:**
When the bot restarts mid-session (deploy during active use), users who were in the middle of `pendingInput: 'task_title'` will have their old in-memory context wiped. If the new state machine uses different field names (`ctx.state` instead of `ctx.pendingInput`), any code that still reads `ctx.pendingInput` from a freshly-constructed context gets `undefined` instead of a falsy check, which can cause different behavior from before (null vs undefined in conditionals).

More critically: if old and new state field names coexist during a partial migration (step 2 of the migration plan says "keep old fields temporarily"), any code path that checks both the old and new field simultaneously can double-fire or deadlock. For example, a message handler that checks `if (ctx.pendingInput)` AND `if (ctx.state === 'AWAITING_TASK_TITLE')` will match twice for a user in the transition state.

**Why it happens:**
Incremental migration means two representations of the same concept exist in the codebase simultaneously. This is correct architecture, but requires discipline to prevent dual reads.

**Consequences:**
- Task title prompt fires, then fires again from the old check path
- User's message consumed twice (creates two tasks, or throws a DB error)
- State becomes inconsistent: `ctx.pendingInput` is cleared, `ctx.state` is not, user is stuck in AWAITING_TASK_TITLE forever

**Prevention strategy:**
1. Do the state machine migration as a single atomic commit. Do not leave both old and new field checks in the handler simultaneously.
2. Add a migration guard in `_getContext`: if the returned context has `pendingInput` set (old format), immediately migrate it to the new `state`/`stateData` format and delete the old field. This handles users who have an old-format context object in memory.
3. The `_userContext` map in memory is reset on bot restart anyway — this only matters for a zero-downtime approach. Since the bot is single-user and restarts are instant, a full restart is acceptable. Document this as the migration strategy.
4. After migration, remove the temporary dual-field guard in the same PR, not a later one.

**Warning signs:**
- Any handler that checks both `ctx.pendingInput` and `ctx.state` in the same code path
- A `_getContext` function that initializes both old and new state fields

**Phase most affected:** Phase 1 (State Machine refactor)

---

### CRITICAL-4: Forum Mode message_thread_id dropped silently breaks topic routing

**What goes wrong:**
When extracting `TelegramBotForum` as a separate class (Step 4), the `message_thread_id` parameter must be passed explicitly through every API call that targets a specific forum topic. The current code has `this._currentThreadId` as a class-level property on `TelegramBot`. If this property is not passed explicitly to the extracted class, all forum messages from the new class land in the General topic instead of the correct project topic. This is silent — the API call succeeds, the message appears, but in the wrong place.

**Why it happens:**
Class-level shared state (`this._currentThreadId`) becomes invisible when code is moved to another class. The new class has no `this._currentThreadId` — it either gets undefined (silent wrong-topic routing) or throws.

There is also a known regression pattern in forum bots: if the code checks `msg.chat?.type === 'supergroup'` but not `msg.is_topic_message`, messages in a supergroup without forum mode enabled are incorrectly treated as forum messages.

**Consequences:**
- All forum bot messages appear in General topic instead of per-project topics
- Users who rely on per-project topic isolation see all bot messages mixed together
- The bug is invisible in logs — messages send successfully

**Prevention strategy:**
1. Pass `threadId` as an explicit parameter to every `TelegramBotForum` method that sends a message. Never rely on class state for this.
2. The forum detection check must be `msg.chat?.type === 'supergroup' && msg.is_topic_message` — both conditions required.
3. After extraction, test by sending a bot response and verifying it appears in the correct topic, not General.
4. Add an assertion: before any `sendMessage` call in `TelegramBotForum`, verify `threadId` is defined. Throw an explicit error if not, rather than silently defaulting.

**Warning signs:**
- Any forum method that uses `this.threadId` or `this._currentThreadId` after extraction (these no longer exist on the new class)
- Forum API calls made without explicit `message_thread_id` parameter

**Phase most affected:** Phase 3 (Forum Module Extraction)

---

### CRITICAL-5: editMessageText on messages older than 48 hours throws and has no graceful fallback

**What goes wrong:**
The new screenMsgId-less architecture (pass `editMsgId` from callback) correctly avoids editing stale stored message IDs. However, if any notification message (e.g., Claude finished a long-running task) is sent and the user taps its inline button more than 48 hours later, the `editMessageText` call will fail with a 400 error. The current `_editScreen` fallback behavior — sending a new message on edit failure — must be preserved in the new architecture.

Additionally, there is a known production bug where some bot tokens enter a permanent state where `editMessageText` silently returns OK but the message does not visually update. This is token-specific and unrecoverable without a new bot token.

**Why it happens:**
Telegram hard-limits edits to 48 hours for regular messages. The "silent stuck" edit bug is a platform-level issue that some tokens hit randomly.

**Consequences:**
- User taps a 2-day-old notification button → edit fails → if no fallback, spinner stuck (see CRITICAL-2)
- Silent stuck-edit bug: bot sends edit calls that appear to succeed, user sees no update, bot thinks it worked

**Prevention strategy:**
1. Every `editMessageText` call must be wrapped in try/catch. On any 400 error containing "message to edit not found" or "message can't be edited", fall back to `sendMessage` with the same content.
2. Log edit failures with enough context to detect the silent-stuck-edit bug (log the response, not just whether it threw).
3. Add a health check: periodically try to edit a known message (e.g., the bot's own last sent message). If the edit silently fails, alert.
4. Never treat a 200 OK from editMessageText as proof the message visually updated — add a flag or timestamp to detect this pattern.

**Warning signs:**
- `editMessageText` calls without try/catch
- Lack of fallback to `sendMessage` when edit fails

**Phase most affected:** Phase 2 (UX Redesign — screenMsgId removal), Phase 3 (Forum)

---

## High-Priority Pitfalls

Mistakes that significantly degrade UX but do not immediately break functionality.

---

### HIGH-1: Telegram rate limit on editMessageText causes spinner pile-up during streaming

**What goes wrong:**
Claude's response streaming sends partial text updates rapidly. If the bot calls `editMessageText` for each streaming chunk (to show progressive response in the bot message), it will quickly hit Telegram's rate limit of approximately 1 message edit per second per chat. Telegram returns `429 Too Many Requests: retry after N`. If not handled, the queue of pending edits grows unboundedly, delivering updates out of order and with increasing delay.

**Why it happens:**
Claude responses can generate many partial chunks per second. Each chunk that triggers an `editMessageText` without rate-limit awareness will either queue up or fail. The `retry_after` value from Telegram can be 35+ seconds, meaning the bot appears frozen for that duration.

**Consequences:**
- Response appears frozen mid-stream
- User retries by sending another message (doubles the work)
- Edit backlog means the "final" edit arrives 30+ seconds after Claude finished

**Prevention strategy:**
1. Do not edit on every streaming chunk. Buffer chunks for 500ms–1s and edit once per interval (debounce the edit).
2. Use a per-chat edit queue with a single outstanding edit at a time. If a new chunk arrives while an edit is in-flight, replace the pending edit with the accumulated content.
3. On `429` response, honor the `retry_after` field: `await sleep(retryAfter * 1000)` before the next edit.
4. Pattern already present: verify `telegram-bot.js`'s streaming handler does not call `editMessageText` more than once per second per chatId.

**Warning signs:**
- Streaming update handler calls `editMessageText` inside a `for await` loop without throttling
- No 429 error handling in the edit path

**Phase most affected:** Phase 2 (UX Redesign — streaming display)

---

### HIGH-2: callback_data 64-byte limit silently truncates or rejects buttons

**What goes wrong:**
The new standardized callback_data format `screen:dialog:all:2` or `action:new-task` is longer than the old terse format (`d:all:0`). If any callback_data string exceeds 64 bytes, Telegram returns `400 BUTTON_DATA_INVALID` and the entire keyboard fails to send (not just the offending button). The message sends with no buttons at all.

**Why it happens:**
The proposed new format trades terseness for readability. With long screen names, page numbers, and session IDs encoded in a single string, the 64-byte limit is easy to exceed. Session IDs alone (SQLite integer IDs) are typically short, but if any UUID or hash is embedded, a single button can blow the limit.

**Consequences:**
- Message sends with no keyboard (all buttons silently missing)
- User sees a message with no actions — bot feels broken
- The 400 error may be swallowed if the send call does not check the response body

**Prevention strategy:**
1. Enforce a budget: `screen:` prefix (7) + screen name max (12) + `:` + data max (43) = 63 bytes total. Define this as a named constant and assert at button construction time.
2. Keep numeric IDs short: use database integer IDs, not UUIDs, in callback_data.
3. Add a validation function `assertCallbackData(str)` that throws in development if any button exceeds 64 bytes. Call it in the keyboard builder.
4. Reference: `screen:dialog:all:2` = 18 bytes. Safe. `action:new-task` = 15 bytes. Safe. The longest projected format is well under 64 bytes if IDs remain integers.

**Warning signs:**
- Any callback_data that embeds a session UUID, a hash, or a file path
- Keyboard send calls that do not check the API response for 400

**Phase most affected:** Phase 2 (new `screen:` and `action:` callback formats)

---

### HIGH-3: ReplyKeyboardMarkup persistence behavior is broken on some clients

**What goes wrong:**
The "smart persistent bottom keyboard" requirement uses `ReplyKeyboardMarkup` with `is_persistent: true`. There is a known Telegram client bug (reported on bugs.telegram.org, marked fixed in Android 9.5.2.3208 but still present on older clients) where the keyboard is always persistent regardless of the `is_persistent` flag value, or conversely where the keyboard does not dismiss when `ReplyKeyboardRemove` is sent.

A related anti-pattern: mixing `ReplyKeyboardMarkup` and `InlineKeyboardMarkup` in the same message is not supported by the API. You cannot attach an inline keyboard AND update the reply keyboard in the same `sendMessage` call. Transitioning between the two types requires a separate message send.

**Why it happens:**
Telegram's keyboard rendering behavior is client-side and version-dependent. The bot API does not reliably control keyboard visibility across all client versions.

**Consequences:**
- Users on older Android clients see the keyboard stuck even when the bot tries to remove it
- Users who receive a screen message with inline buttons still see the reply keyboard from a previous send, causing visual confusion
- Switching from reply keyboard to "no keyboard" requires a dedicated empty message (UX noise)

**Prevention strategy:**
1. Accept that `ReplyKeyboardMarkup` persistence is partially client-controlled. Design the UX to work correctly whether or not the keyboard is visible — do not depend on it being hidden.
2. Never attempt to send both `InlineKeyboardMarkup` and `ReplyKeyboardMarkup` in the same operation. The persistent bottom keyboard is a separate concern from screen inline buttons.
3. Treat the persistent keyboard as additive context, not as navigation. Its buttons (`Menu`, `Write`, `Status`) should always work from any state. Do not rely on hiding it to signal mode changes.
4. Test on Telegram Desktop and iOS, not just Android, since keyboard behavior differs.

**Warning signs:**
- Code that sends `ReplyKeyboardRemove` and then immediately sends `InlineKeyboardMarkup` in the same response
- Any UX design that depends on the reply keyboard being hidden as a navigation signal

**Phase most affected:** Phase 2 (persistent keyboard implementation)

---

### HIGH-4: i18n shared-state locale corruption in concurrent message handling

**What goes wrong:**
The current `_t(key, params)` method reads `this.lang` from the user context to select the locale. If `this.lang` is set as a class property (rather than derived from the current user's context), and if two messages from different users (or the same user from two Telegram clients) are processed concurrently, the locale can be set to user A's language and then read during user B's message processing.

This is a lower risk in a single-user bot but becomes real during the refactor if `TelegramBotForum` is given its own reference to `lang` or if the i18n extraction changes how `_t` is called.

**Why it happens:**
Node.js async processing of concurrent updates means two `_handleUpdate` calls can interleave. If the locale is set as shared state, not derived per-call, language bleeds between contexts.

**Consequences:**
- Ukrainian user sees bot responses in English intermittently
- Difficult to reproduce (timing-dependent)

**Prevention strategy:**
1. Ensure `_t(key, params, lang)` accepts `lang` as an explicit parameter rather than reading from `this.lang`. Callers pass the current user's language each time.
2. In the i18n extraction, the exported `BOT_I18N` object is pure data — it has no state. The `_t` function that reads it should be a pure function, not a method that depends on `this`.
3. After extraction, verify: `_t` in `telegram-bot.js` must derive lang from the passed context, not from a class property.

**Warning signs:**
- `_t()` reads `this.lang` instead of receiving `lang` as a parameter
- `TelegramBotForum` sets a `this.lang` property

**Phase most affected:** Phase 1 (i18n extraction)

---

### HIGH-5: Screen invoked from slash command vs button tap behaves differently without explicit handling

**What goes wrong:**
The new architecture passes `editMsgId` from callback to screen handler. Screens invoked from slash commands have no `editMsgId` and must `sendMessage`. If a screen handler assumes `editMsgId` is always set (because the developer only tests via button taps), slash command invocations of the same screen will throw or silently fail to send anything.

Additionally, some screens are reached both via inline button (should edit) and via notification/push (no prior screen message to edit — should send). The distinction must be handled explicitly, not assumed.

**Why it happens:**
During development, button-tap paths are tested more frequently than slash command paths. The failure mode (no message sent) is silent — no error, but user sees nothing.

**Consequences:**
- User types `/projects` → nothing appears
- User taps notification with no prior screen → nothing appears

**Prevention strategy:**
1. Every screen handler must include this guard:
   ```javascript
   if (editMsgId) {
     await this._editMessageText(chatId, editMsgId, text, keyboard);
   } else {
     await this._sendMessage(chatId, text, { reply_markup: keyboard });
   }
   ```
2. Write a test case for each new screen: (a) invoked via slash command, (b) invoked via button tap, (c) invoked as notification from Claude activity.
3. Add a linting check or code review checklist item: "every `_screen*` method has an `editMsgId` branch."

**Warning signs:**
- Any screen handler that unconditionally calls `_editMessageText` without checking `editMsgId`
- Any screen handler that unconditionally calls `_sendMessage` even when called from a button tap

**Phase most affected:** Phase 2 (screenMsgId removal, new screen handlers)

---

### HIGH-6: State not persisted — bot restart during active task creation loses user mid-flow

**What goes wrong:**
`_userContext` is an in-memory Map. On bot restart (which happens on deploy), all user states are reset to IDLE. A user who was in `AWAITING_TASK_TITLE` will see the task title prompt again after restart if the bot resends it, or more commonly, the prompt disappears and the user does not know they need to start over.

**Why it happens:**
The state machine is in-memory only. There is no persistent state backing it.

**Consequences:**
- User types a task title → bot restarts mid-typing → message arrives after restart → bot is now in IDLE → text goes to Claude instead of creating a task
- User sees Claude respond with "I'm creating a task called [title]" — confusing

**Prevention strategy:**
1. Accept this limitation explicitly. Document it: "Bot restarts clear in-flight state. Users mid-flow need to restart their action." This is acceptable for a single-user deployment.
2. Make the bot's responses after returning to IDLE informative: if a text message arrives in IDLE state that looks like a short title-like phrase (not a sentence), do not silently forward to Claude — but this is premature optimization. The simpler fix is to just send to Claude (which is already the IDLE behavior).
3. For the task creation flow specifically: after restart, show the main menu on the next user interaction. Do not attempt to reconstruct the interrupted state.
4. Consider persisting `state` and `stateData` to SQLite for the specific user context row. This would survive restarts. Only worth doing if restart frequency is high during active development phases.

**Warning signs:**
- No comment or documentation acknowledging that state is lost on restart
- Code that tries to reconstruct pending state from database on startup (dangerous: may resurrect stale pending prompts)

**Phase most affected:** Phase 1 (State Machine), any phase where deploys happen mid-session

---

## Medium Pitfalls

Mistakes that cause confusion but not immediate breakage.

---

### MED-1: Back navigation dead ends when breadcrumb is lost

**What goes wrong:**
The new screen registry `SCREENS[screen].parent` pattern for auto-generating back buttons assumes the user always navigated through the canonical hierarchy. If the user reached a screen via a notification shortcut (Claude pushed a "session active" screen directly), the `currentScreen` stored in context may not match the screen they visually see, causing "Back" to go to the wrong parent.

**Prevention strategy:**
Track the screen name alongside the `editMsgId` in the callback. The proposed format `screen:projects:0` carries the screen name in the callback_data itself — the router knows what screen it is navigating to and can set `ctx.currentScreen` at navigation time, not just at render time.

**Phase most affected:** Phase 2

---

### MED-2: Pagination limits not communicated — user hits invisible wall

**What goes wrong:**
The current bot limits session lists to 50 chats and project lists to 30 projects. The new UX must display visible "Page X of Y" indicators or a "Load more" button. Without this, the user reaches the end of the list and assumes there are no more items, when in fact there are 31+ projects or 51+ sessions.

**Prevention strategy:**
Always show total count alongside page controls: "Projects (34, showing 1–10)". Add a "Load more" button if not all items fit. Never silently truncate without indication.

**Phase most affected:** Phase 2

---

### MED-3: Forum mode detection breaks for Direct Message chats with Forum Topics enabled

**What goes wrong:**
Telegram added `direct_messages_topic_id` for DMs with forum-like topics in 2025. A bot that checks `msg.chat?.type === 'supergroup' && msg.is_topic_message` to detect forum mode may misclassify such DMs. Conversely, some supergroup configurations have `is_forum: false` but `msg.is_topic_message: true` (replies within threads, not forum topics). The detection logic must check `msg.chat?.is_forum === true`, not just type and topic flags.

**Prevention strategy:**
Use `msg.chat?.is_forum === true` as the canonical forum detection flag. Cross-verify with `msg.chat?.type === 'supergroup'`. Do not rely on `is_topic_message` alone.

**Phase most affected:** Phase 3 (Forum extraction)

---

### MED-4: "Message is not modified" error on redundant edits causes log noise and callback re-trigger

**What goes wrong:**
If the user taps the same button twice quickly (double-tap) and the screen content would be identical, `editMessageText` returns `400: message is not modified`. If this error is not caught and suppressed, it propagates as an unhandled rejection or error log entry. If the `answerCallbackQuery` is called only in the success path, the spinner on the second tap never dismisses.

**Prevention strategy:**
Catch `"message is not modified"` specifically and treat it as a no-op (not an error). Always call `answerCallbackQuery` in finally (see CRITICAL-2).

**Phase most affected:** Phase 2

---

### MED-5: server.js encapsulation breach survives refactor if not coordinated

**What goes wrong:**
`server.js` currently calls `bot._getContext()`, `bot._callApi()`, `bot._sendMessage()`, `bot._t()`, `bot._escHtml()`, `bot._mdToHtml()`, `bot._chunkForTelegram()`. After the state machine migration, `_getContext` must return a context with `state`/`stateData` instead of `pendingInput`/`pendingAskRequestId`. If `server.js` still writes `pendingAskRequestId` to the old field, the ask_user interrupt will not transition the state machine correctly, reproducing the exact pendingInput/pendingAsk conflict the state machine was designed to fix.

**Prevention strategy:**
Phase 1 (State Machine) and the `server.js` coordination fix (Step 5) must be deployed together, not separately. Create a single PR that migrates both `telegram-bot.js` state fields AND the `server.js` write paths. The ARCHITECTURE.md already flags this: "Coordinate state machine and server.js changes in the same PR."

**Phase most affected:** Phase 1 (must be atomic with server.js changes)

---

### MED-6: Synchronous SQLite calls block the event loop under concurrent callbacks

**What goes wrong:**
`better-sqlite3` is synchronous. Each DB call during a callback handler blocks the Node.js event loop for the duration. For a single-user bot this is acceptable. However, during the refactor, if new code paths add additional synchronous DB calls inside callback handlers (e.g., loading project list AND chat list AND task count in the same screen render), the cumulative block time increases. Under concurrent incoming webhooks or long-poll updates, this can cause update processing to queue up visibly.

**Prevention strategy:**
Keep DB calls per screen render to a maximum of 3 synchronous calls. If a screen needs more data, cache the results in `_userContext` with a short TTL. Use `EXPLAIN QUERY PLAN` to verify indices are used on `telegram_devices` lookups by `telegram_chat_id` and `user_id`.

**Phase most affected:** Phase 2 (new screen handlers that aggregate data)

---

### MED-7: i18n key missing in one language silently renders undefined

**What goes wrong:**
When adding new UI strings during the UX redesign, developers add translations to `uk` and `en` but may forget `ru`. The current `_t()` method falls back from the user's language to `en`, so `ru` users will see English. However, if `en` is also missing the key (typo in key name, or key added to one language file object but not the other), `_t()` returns `undefined`, and the message renders as "undefined" in the bot.

**Prevention strategy:**
After i18n extraction to `telegram-bot-i18n.js`, add a startup validation function that asserts all keys present in `en` are also present in `uk` and `ru`. Log warnings (not errors) for `ru` gaps. Throw (or log error) for `en`/`uk` gaps. Run this check on bot initialization.

**Phase most affected:** Phase 1 (i18n extraction), any phase that adds new UI strings

---

## Prevention Checklist

### Phase 1: Foundation (i18n + State Machine)

- [ ] `telegram-bot-i18n.js` exports a plain object — no Telegram API, no side effects, no `require`s beyond the export itself
- [ ] `_t(key, params)` is updated to receive `lang` as parameter, not read from `this.lang`
- [ ] Startup validation confirms all `en` keys exist in `uk` and `ru` (warn for `ru`, error for `uk`)
- [ ] `ctx.state` and `ctx.stateData` replace ALL three of: `pendingInput`, `pendingAskRequestId`, `pendingAskQuestions`, `composing` — in a single atomic commit
- [ ] `server.js` changes (writing `pendingAskRequestId`) are coordinated in the same PR as the state machine migration
- [ ] `_transition(userId, 'IDLE')` is called as the first line of `_handleCommand` (ensures commands never inherit pending state)
- [ ] `ask_user` event handler calls `_transition(userId, 'AWAITING_ASK_RESPONSE')` regardless of current state
- [ ] No code path checks both `ctx.pendingInput` and `ctx.state` simultaneously after migration
- [ ] `_handleCallback` has a try/catch with `answerCallbackQuery` in the finally block

### Phase 2: UX Redesign (Screens, Navigation, Persistent Keyboard)

- [ ] All old callback_data prefixes (`m:`, `p:`, `c:`, `ch:`, `cm:`, `d:`, `fm:`, `fs:`, `fa:`, `f:`, `t:`, `s:`, `tn:`) remain functional as pass-through cases in the router
- [ ] Catch-all at bottom of callback router always calls `answerCallbackQuery` (covers unknown formats)
- [ ] Every `_screen*` handler accepts `editMsgId` parameter and handles both null (send) and non-null (edit) cases
- [ ] `assertCallbackData(str)` validation function exists and is called in the keyboard builder (enforces 64-byte limit)
- [ ] No callback_data string uses UUIDs, hashes, or file paths — integers only for IDs
- [ ] `editMessageText` calls are wrapped in try/catch; on `"message to edit not found"` or `"message can't be edited"`, fall back to `sendMessage`
- [ ] `"message is not modified"` errors are caught and treated as no-ops, not logged as errors
- [ ] Streaming handler debounces `editMessageText` calls to at most 1 per second per chat
- [ ] Persistent bottom keyboard (`ReplyKeyboardMarkup`) is designed to work correctly whether visible or not — no UX path depends on it being hidden
- [ ] Pagination shows total count alongside page controls — never silently truncates
- [ ] Each new screen is tested via: (a) button tap, (b) slash command, (c) notification with no prior screen message

### Phase 3: Forum Module Extraction

- [ ] `TelegramBotForum` constructor receives `threadId` as an explicit parameter on every method call — no class-level `this._currentThreadId`
- [ ] Forum detection uses `msg.chat?.is_forum === true && msg.chat?.type === 'supergroup'` — not just `is_topic_message`
- [ ] Every `sendMessage` in `TelegramBotForum` asserts `threadId !== undefined` before calling the API
- [ ] Forum callbacks (`fm:`, `fs:`, `fa:` prefixes) remain functional during extraction — do not remove from main router until extraction is complete and tested
- [ ] Forum state (`ctx.state`) remains scoped to `(chatId, threadId, userId)` — never shared with Direct Mode context
- [ ] After extraction, test by posting to a specific project topic and verifying the message appears in that topic, not General

### Phase 4: Cleanup (server.js encapsulation)

- [ ] `TelegramBot.createResponseHandler(...)` is the only public method `server.js` calls — no `_` (private) methods accessed
- [ ] After `server.js` migration, search for `bot._` in `server.js` — zero matches is the acceptance criterion

---

## Sources

- Direct code audit of `/Users/admin/_Projects/claude-code-studio/telegram-bot.js` (4693 lines) — HIGH confidence
- [Telegram Bot FAQ — core.telegram.org](https://core.telegram.org/bots/faq) — HIGH confidence (official)
- [Telegram Bot API — Inline Keyboards — core.telegram.org](https://core.telegram.org/api/bots/buttons) — HIGH confidence (official)
- [Telegram Forum Topics API — core.telegram.org](https://core.telegram.org/api/forum) — HIGH confidence (official)
- [answerCallbackQuery 15-second timeout — gist.github.com/d-Rickyy-b](https://gist.github.com/d-Rickyy-b/f789c75228bf00f572eec4450ed0d7c9) — MEDIUM confidence (community verified)
- [Handling unmodified message errors — community.latenode.com](https://community.latenode.com/t/handling-unmodified-message-errors-in-telegram-bots/12601) — MEDIUM confidence
- [Enhanced Telegram callback_data with protobuf + base85 — seroperson.me, 2025](https://seroperson.me/2025/02/05/enhanced-telegram-callback-data/) — MEDIUM confidence
- [Inline keyboard limits — github.com/tginfo/Telegram-Limits/issues/228](https://github.com/tginfo/Telegram-Limits/issues/228) — MEDIUM confidence
- [ReplyKeyboardMarkup is_persistent bug — bugs.telegram.org](https://bugs.telegram.org/c/25708) — MEDIUM confidence (official bug tracker)
- [GramIO rate limits guide — gramio.dev](https://gramio.dev/rate-limits) — MEDIUM confidence
- [Building Robust Telegram Bots — henrywithu.com, 2025](https://henrywithu.com/building-robust-telegram-bots/) — MEDIUM confidence
- [Bot gets stuck: cannot edit messages — bugs.telegram.org](https://bugs.telegram.org/c/5818/7) — MEDIUM confidence (official bug tracker)
- [forum/topics message_thread_id regression — github.com/openclaw, 2026](https://github.com/openclaw/openclaw/issues/17980) — MEDIUM confidence
- [grammY i18n plugin documentation — grammy.dev](https://grammy.dev/plugins/i18n) — MEDIUM confidence
