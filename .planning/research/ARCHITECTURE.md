# Architecture Research — Telegram Bot Redesign

**Project:** Claude Code Studio Telegram Bot
**Researched:** 2026-03-28
**Confidence:** HIGH (based on direct code audit of the 4693-line source)

---

## Recommended Module Structure

### File Layout After Refactor

```
telegram-bot.js          — Core class: polling, API calls, routing, context, security
telegram-bot-i18n.js     — Translation strings only (825 lines extracted)
telegram-bot-forum.js    — Forum mode class (860 lines extracted, mixed into core today)
telegram-bot-screens.js  — (Optional Phase 3) Screen renderer registry
```

**Why three files, not more:**
- The constraint is "no new npm deps" and "no build tools." More files = more `require()` coupling. Three files is the natural split: i18n is pure data, forum is a distinct mode with no overlap in hot paths, and the core is everything else.
- Splitting screens into a fourth file is optional and only worth it if the screen count grows beyond ~12. For now the routing logic in `_handleCallback` is manageable as a module within the core.

### Module Responsibilities

| File | What It Owns | What It Does NOT Own |
|------|-------------|----------------------|
| `telegram-bot-i18n.js` | All `BOT_I18N` translation data, the `_t(key, params)` function | No Telegram API, no DB, no state |
| `telegram-bot-forum.js` | `TelegramBotForum` class: connect, topics, messages, history, task routing | No Direct Mode screens, no global command router |
| `telegram-bot.js` | Polling, API calls, auth, pairing, Direct Mode screens, state machine, EventEmitter API | No translation data, minimal forum awareness |

### Interface Between Modules

`telegram-bot-forum.js` receives a reference to the parent bot's API methods via constructor injection, not by importing the class. This avoids circular deps:

```javascript
// telegram-bot-forum.js
class TelegramBotForum {
  constructor({ db, log, api, i18n }) {
    // api = { callApi, sendMessage, editMessage }
    // i18n = { t }
    // No reference to TelegramBot instance itself
  }
}
```

`server.js` accesses only the public EventEmitter interface of `TelegramBot`. The internal methods `_callApi`, `_sendMessage`, `_getContext`, `_t`, `_escHtml`, `_mdToHtml`, `_chunkForTelegram` that `server.js` currently calls directly (lines 1383-1635 of server.js) should be extracted into a `TelegramResponseHandler` class that lives inside `server.js` itself. This breaks the encapsulation violation without requiring a refactor of the bot's internals in one shot.

---

## State Machine Design

### The Problem with the Current `pendingInput` Approach

The current code uses `ctx.pendingInput` (a string flag) alongside `ctx.pendingAskRequestId` and `ctx.composing`. These are three independent flags that can conflict:

- A user in `pendingInput: 'task_title'` who receives an `ask_user` question from Claude now has both `pendingAskRequestId` and `pendingInput` set simultaneously. The `ask_user` check fires first (line 1344) and consumes the message, but the task creation flow is now orphaned with `pendingInput` still set. The user's next text is silently eaten by a stale task title prompt they no longer see.
- `composing: true` is checked after `pendingInput`, meaning a user who tapped "Write" but then triggered a task flow still has `composing: true` set, causing confusing state after the task is done.

### Recommended FSM

Replace the three flags with a single `state` string and a single `stateData` object. States are mutually exclusive; only one state is active at a time.

**State Definitions:**

```
IDLE
  — Default state. Free text goes to Claude via active session (or auto-selects session).
  — Commands and buttons are processed normally.

AWAITING_TASK_TITLE
  — Entered when user taps "New Task" button.
  — Any text → creates task, transitions to AWAITING_TASK_DESCRIPTION.
  — Button tap (non-task) or command → cancel, transition to IDLE.
  — stateData: { workdir }

AWAITING_TASK_DESCRIPTION
  — Entered after task title is created.
  — Any text → saves description, transitions to IDLE, shows task screen.
  — "Skip" button → transitions to IDLE without saving description.
  — stateData: { taskId, title, workdir }

AWAITING_ASK_RESPONSE
  — Entered when Claude sends an ask_user question.
  — Any text → sends as answer, transitions to IDLE.
  — "Skip" button → sends [Skipped], transitions to IDLE.
  — stateData: { requestId, questions }

COMPOSING
  — Entered when user taps "Write" with an active session.
  — Any text → sends to Claude, transitions to IDLE.
  — "Cancel" button → transitions to IDLE.
  — stateData: { sessionId }
```

**Transition Table:**

| Current State | Event | Guard | Next State | Action |
|---------------|-------|-------|------------|--------|
| any | receive ask_user from Claude | — | AWAITING_ASK_RESPONSE | show question, set stateData |
| AWAITING_ASK_RESPONSE | text message | — | IDLE | emit ask_user_response, ack |
| AWAITING_ASK_RESPONSE | "Skip" button | — | IDLE | emit skipped response |
| AWAITING_ASK_RESPONSE | any other button | — | IDLE | cancel ask, process button normally |
| IDLE | "New Task" button | — | AWAITING_TASK_TITLE | show prompt |
| AWAITING_TASK_TITLE | text message | — | AWAITING_TASK_DESCRIPTION | create task, show desc prompt |
| AWAITING_TASK_TITLE | any button | not task-specific | IDLE | cancel task creation |
| AWAITING_TASK_TITLE | any command | — | IDLE | cancel task creation, process command |
| AWAITING_TASK_DESCRIPTION | text message | — | IDLE | save description, show task screen |
| AWAITING_TASK_DESCRIPTION | "Skip" button | — | IDLE | show task screen without description |
| IDLE | "Write" button | sessionId set | COMPOSING | show compose prompt |
| IDLE | "Write" button | no sessionId | IDLE | show chats screen |
| COMPOSING | text message | — | IDLE | send to Claude |
| COMPOSING | "Cancel" button | — | IDLE | show dialog overview |
| IDLE | text message | — | IDLE | send to Claude (direct send mode) |

**Implementation Pattern:**

```javascript
// In _getContext, replace three flags with:
{
  state: 'IDLE',          // one of the 5 states above
  stateData: {},          // state-specific data
  // ... rest of context unchanged
}

// Transition helper
_transition(userId, newState, data = {}) {
  const ctx = this._getContext(userId);
  ctx.state = newState;
  ctx.stateData = data;
}

// In _handleTextMessage, priority order:
// 1. AWAITING_ASK_RESPONSE → handle ask response
// 2. AWAITING_TASK_TITLE → handle task title
// 3. AWAITING_TASK_DESCRIPTION → handle task description
// 4. Otherwise (IDLE or COMPOSING) → send to Claude
```

**Why `AWAITING_ASK_RESPONSE` has highest priority:**
The ask_user interrupt originates from Claude's active processing. It represents Claude waiting for the user. It is always the most time-sensitive pending state and should never be silently blocked by a lower-priority pending input.

**Why button taps cancel pending text states:**
A user who taps any navigation button has clearly abandoned the text flow. Silently keeping `pendingInput` active across a navigation event is the root cause of the "silent capture" bug. The button handler should always call `_transition(userId, 'IDLE')` before routing, unless the button explicitly belongs to the current state (task-specific `t:skip`).

---

## Screen Registry Pattern

### The Current Problem

Adding a new screen today requires:
1. Write `_screenFoo(chatId, userId, data)` method
2. Add a routing case in `_handleCallback` (the if-chain, ~25 cases)
3. Ensure it calls `_editScreen` or `_showScreen` consistently
4. Add back-navigation buttons manually in the new screen's keyboard
5. Handle state changes in the new screen manually

There is no single place to look at "what screens exist." The screen logic is scattered across ~25 `_screenX` and `_routeX` methods with no shared abstraction for keyboard construction or navigation.

### Recommended: Screen Registry Object

Define screens as data, not code. Each screen is a record with a key, a handler function, and declared navigation parents.

```javascript
// Within telegram-bot.js — no new file needed
const SCREENS = {
  'menu':     { handler: '_screenMainMenu',    parent: null },
  'projects': { handler: '_screenProjects',    parent: 'menu' },
  'project':  { handler: '_screenProjectView', parent: 'projects' },
  'chats':    { handler: '_screenChats',       parent: 'project' },
  'dialog':   { handler: '_screenDialog',      parent: 'chats' },
  'tasks':    { handler: '_screenTasks',       parent: 'menu' },
  'status':   { handler: '_screenStatus',      parent: 'menu' },
  'settings': { handler: '_screenSettings',    parent: 'menu' },
  'files':    { handler: '_screenFiles',       parent: 'project' },
  'tunnel':   { handler: '_screenTunnel',      parent: 'menu' },
};
```

**Benefits:**
- Adding a new screen = one entry in `SCREENS` + one handler method.
- Back navigation can be derived: `SCREENS[currentScreen].parent` gives the screen to navigate to on "Back."
- The callback router can be generalized: `s:{screenKey}:{optionalData}` routes to the right handler via `SCREENS[screenKey].handler`.

**Callback data format (proposed standardization):**

```
Current (inconsistent):
  m:menu, p:list, p:list:0, p:sel:3, c:list:0, ch:2, cm:compose, d:overview, d:all:0

Proposed (consistent prefix = screen key):
  screen:menu
  screen:projects:0           (page 0)
  screen:projects:1           (page 1)
  screen:project:3            (project index 3)
  screen:chats:0              (page 0)
  screen:dialog:overview
  screen:dialog:all:2         (full view, page 2)
  action:compose
  action:new-chat
  action:new-task
  action:skip-task-desc
```

The old prefixes (`m:`, `p:`, `c:`, `ch:`, `cm:`, `d:`, `fm:`, `fs:`, `fa:`, `f:`, `t:`, `s:`, `tn:`) should remain functional during migration (pass-through in the router) and be removed phase by phase.

**Back button auto-generation:**

```javascript
_backButton(currentScreen) {
  const screen = SCREENS[currentScreen];
  if (!screen?.parent) return null;
  return { text: this._t('btn_back'), callback_data: `screen:${screen.parent}` };
}
```

---

## The `screenMsgId` Problem and Fix

### What Goes Wrong Today

`screenMsgId` is a single slot per user: the message ID of "the one message being managed." When:
- The user taps a button on an old message (e.g., a notification from 10 minutes ago)
- A Claude response arrives and sends a new message during a screen session
- The user opens two Telegram clients simultaneously

...the slot is overwritten and subsequent edit calls target the wrong message or fail silently, after which `_editScreen` falls back to sending a new message. The result is two "screen" messages accumulating in the chat, each with buttons, both potentially responding to taps.

### Fix: Anchor the Screen to the Callback Message, Not a Stored Slot

The correct mental model: **the screen IS the message that carries the buttons.** When a user taps a button, Telegram tells you exactly which message the button came from (`cbq.message.message_id`). That is the message to edit. Do not store it — use it directly.

```javascript
// In _handleCallback:
async _handleCallback(cbq) {
  const msgId = cbq.message?.message_id;  // always the right message
  const chatId = cbq.message?.chat?.id;

  // Pass msgId explicitly to screen handlers
  return this._screenMainMenu(chatId, userId, { editMsgId: msgId });
}

// In each screen handler:
async _screenMainMenu(chatId, userId, { editMsgId = null } = {}) {
  // Build text and keyboard...

  if (editMsgId) {
    // We know exactly which message to edit — no slot lookup needed
    await this._editMessageText(chatId, editMsgId, text, keyboard);
  } else {
    // Invoked from a slash command or the Write button — send a new message
    await this._sendMessage(chatId, text, { reply_markup: keyboard });
  }
}
```

**What this eliminates:**
- The `ctx.screenMsgId` / `ctx.screenChatId` slot entirely
- The `_showScreen` / `_editScreen` duality
- The "edit fallback to new message" that sends duplicate messages

**What it does not handle:**
- Screens opened by slash commands (no callback message exists) — these always send new messages, which is correct behavior
- The persistent keyboard buttons (Menu, Write, Status) — these send new messages since they have no inline keyboard

**Migration:** Replace `if (ctx.screenMsgId && ctx.screenChatId === chatId)` checks with `if (editMsgId)`. Screen handlers gain an options parameter. Slash command handlers call screens with no `editMsgId`.

---

## Preventing Pending States from Intercepting Unrelated Messages

### The Bug Pattern

```
User: [taps "New Task"]          → ctx.state = AWAITING_TASK_TITLE
User: [30 seconds pass, forgets]
Claude: [ask_user fires]         → bot shows question  ← BUG: state not updated
User: [answers Claude's question as text]  → state is still AWAITING_TASK_TITLE
                                              → text is silently used as task title
```

### Fix: ask_user Transition Must Override All Other States

When the bot receives an `ask_user` event from Claude (via EventEmitter from server.js), it must immediately call `_transition(userId, 'AWAITING_ASK_RESPONSE', data)` regardless of current state. `AWAITING_ASK_RESPONSE` always wins.

```javascript
// In the ask_user event handler (called from server.js via EventEmitter):
this.on('ask_user', ({ userId, requestId, questions }) => {
  // Force-override whatever state the user is in
  this._transition(userId, 'AWAITING_ASK_RESPONSE', { requestId, questions });
  // Then show the question message
});
```

### Fix: Command Input Always Resets State

Any slash command that is not a state-specific action (like `/start`, `/help`, `/projects`) should reset state to IDLE before executing. This prevents a user who forgot they were in a task creation flow from finding that their `/help` text was consumed as a task title.

```javascript
async _handleCommand(msg) {
  // Commands always exit pending input states
  this._transition(userId, 'IDLE');
  // ... then route the command normally
}
```

**Exception:** Task-specific commands within forum mode (e.g., `/new` in tasks topic) intentionally enter `AWAITING_TASK_TITLE`. This is fine because forum context is always scoped to a topic, not shared with Direct Mode state.

---

## Forum Mode vs Direct Mode Separation

### Current Architecture Problem

`TelegramBot` today is a monolith where forum methods (`_handleForumMessage`, `_forumShowInfo`, `_forumShowHistory`, `_forumNewSession`, `_forumSwitchSession`, `_forumSyncTopics`, `_notifyForumActivity`, `_createProjectTopic`, `_handleForumSessionCallback`, `_handleForumActionCallback`, `_handleForumActivityCallback`, `_handleForumConnect`) live alongside Direct Mode screens. They share `this.db`, `this._stmts`, `this._userContext`, and `this._currentThreadId`.

### Recommended: Composition, Not Inheritance

Create `TelegramBotForum` as a separate class that the main bot instantiates and delegates to. The main bot retains a reference; forum is not a subclass.

```javascript
// telegram-bot.js
class TelegramBot extends EventEmitter {
  constructor(db, opts) {
    // ...existing setup...
    this._forum = new TelegramBotForum({
      db,
      log: this.log,
      api: this._makeApiProxy(),   // { callApi, sendMessage, editMessage }
      i18n: this._makeI18nProxy(), // { t }
      getContext: (userId) => this._getContext(userId),
      onSendMessage: (payload) => this.emit('send_message', payload),
    });
  }

  _makeApiProxy() {
    return {
      callApi: (method, params) => this._callApi(method, params),
      sendMessage: (chatId, text, opts) => this._sendMessage(chatId, text, opts),
    };
  }
}
```

**What `TelegramBotForum` owns exclusively:**
- All `forum_topics` table operations (insert, lookup, delete topics)
- `_handleForumMessage` — the entry point for all forum messages
- Forum topic creation and sync logic
- Forum-specific callback routing (`fm:`, `fs:`, `fa:` prefixes)
- Notification routing to forum Activity topic

**What stays in `TelegramBot`:**
- The `forum_chat_id` column on `telegram_devices` (device pairing lives in core)
- The `/connect` command handler (it pairs the group, which is a core concern)
- The `/forum` setup command (informs user about setup, not forum logic itself)
- Routing decisions: "is this message from a forum? → delegate to `this._forum`"

**Forum state does NOT share `screenMsgId`:**
Forum messages are topic-scoped. The edit-anchor pattern (described above) works the same way: the callback message ID from the inline button is the anchor, no stored slot needed.

### Mode Detection and Routing

```javascript
async _handleUpdate(update) {
  // ...existing auth checks...

  const isForum = msg.chat?.type === 'supergroup' && msg.is_topic_message;

  if (isForum) {
    const device = this._stmts.getDevice.get(userId);
    if (device?.forum_chat_id === chatId) {
      return this._forum.handleMessage(msg, device);
    }
    return; // not this user's forum
  }

  // Direct Mode routing (unchanged from current)
}
```

**The critical separation rule:** Forum mode and Direct Mode never share `ctx.state`. Forum message handling is always scoped to a `(chatId, threadId, userId)` tuple. Direct Mode state is keyed by `userId` alone. There is no migration of pending states between modes.

---

## Migration Strategy

### Principle: Strangler Fig, Not Big Bang

Migrate incrementally. The existing bot continues working throughout. Each step is independently testable.

### Step 1: Extract i18n (Lowest Risk, Highest Payoff)

**What:** Move `BOT_I18N` (lines 42–825) to `telegram-bot-i18n.js`. Export the object. Require it at the top of `telegram-bot.js`.

**Risk:** Zero. Pure data extraction, no logic changes.

**Result:** `telegram-bot.js` drops from 4693 to ~3868 lines. The `_t()` method stays in `TelegramBot` (it needs `this.lang`). The i18n file just exports the data.

```javascript
// telegram-bot-i18n.js
'use strict';
module.exports = {
  uk: { /* all uk strings */ },
  en: { /* all en strings */ },
  ru: { /* all ru strings */ },
};

// telegram-bot.js (top)
const BOT_I18N = require('./telegram-bot-i18n');
// _t() method unchanged
```

**Compatibility:** Zero — this is internal. No API changes.

### Step 2: Fix the State Machine (High Risk, High Value)

**What:** Replace `ctx.pendingInput`, `ctx.pendingAskRequestId`, `ctx.pendingAskQuestions`, and `ctx.composing` with `ctx.state` and `ctx.stateData`.

**Risk:** Medium. This changes the core message routing logic. Existing in-flight user sessions (users who were mid-task-creation when the bot restarts) lose their pending state, which is acceptable — the old context was equally lost on restart.

**Migration path:**
1. Add `state: 'IDLE'` and `stateData: {}` to `_getContext()` defaults. Keep old fields temporarily.
2. Add `_transition(userId, newState, data)` helper.
3. Rewrite `_handleTextMessage` to switch on `ctx.state` instead of checking `ctx.pendingInput`.
4. Update task creation flow (`_handleNewTask`, `_handleSkipTaskDesc`) to use `_transition`.
5. Update ask_user handler in server.js-facing code to call `_transition(userId, 'AWAITING_ASK_RESPONSE', ...)`.
6. Remove old fields from `_getContext` after all call sites are migrated.

**Compatibility:** Existing paired devices continue working. The only behavioral change is fixing the intercept bugs — previously silent bugs become correct behavior.

### Step 3: Fix screenMsgId (Medium Risk, High UX Value)

**What:** Remove `ctx.screenMsgId` and `ctx.screenChatId`. Modify screen handlers to accept `editMsgId` parameter. Thread the parameter through from `_handleCallback`.

**Migration path:**
1. Add `editMsgId` parameter to all `_screen*` methods (with default `null`).
2. In `_handleCallback`, pass `cbq.message.message_id` as `editMsgId` to the routed screen.
3. In each screen handler, replace the `if (ctx.screenMsgId && ctx.screenChatId === chatId)` check with `if (editMsgId)`.
4. Remove `ctx.screenMsgId = ...` assignments.
5. Remove the `screenMsgId` and `screenChatId` fields from `_getContext`.

**Risk:** Medium. This touches every screen handler. Test by tapping old buttons (should fail gracefully — message not found → Telegram returns error → `_editScreen` already has a catch that falls back to sending a new message).

### Step 4: Extract Forum Mode (Medium Risk, High Maintainability Value)

**What:** Move all forum methods to `TelegramBotForum`. Wire it up via composition.

**Migration path:**
1. Create `telegram-bot-forum.js` with a skeleton `TelegramBotForum` class.
2. Move methods one at a time, starting with the stateless ones (`_getTopicInfo`, `_topicLink`, `_notifyForumActivity`).
3. Move the message handler chain (`_handleForumMessage` and all sub-handlers).
4. Move the callback handlers (`_handleForumActionCallback`, `_handleForumSessionCallback`, `_handleForumActivityCallback`).
5. Wire the main bot to instantiate and delegate to the forum class.
6. Ensure the EventEmitter `send_message` events are forwarded correctly.

**Compatibility:** Forum Mode supergroups already set up do not need to re-connect. The `forum_topics` table is unchanged. The `forum_chat_id` column on `telegram_devices` is unchanged.

### Step 5: Fix server.js Encapsulation Breach (Lower Risk, Cleanliness)

**What:** The `TelegramResponseHandler` class in `server.js` calls `_callApi`, `_sendMessage`, `_getContext`, `_t`, `_escHtml`, `_mdToHtml`, `_chunkForTelegram` directly on the bot instance. These are private methods.

**Fix:** Expose a `TelegramBot.createResponseHandler(userId, chatId, threadId)` public factory method that returns a handler object with the needed capabilities. This is a refactor of `server.js`, not `telegram-bot.js`.

```javascript
// telegram-bot.js — new public method
createResponseHandler({ userId, chatId, threadId }) {
  return {
    sendMessage: (text, opts) => this._sendMessage(chatId, text, opts),
    callApi: (method, params) => this._callApi(method, params),
    t: (key, params) => this._t(key, params),
    escHtml: (text) => this._escHtml(text),
    mdToHtml: (text) => this._mdToHtml(text),
    chunk: (text, limit) => this._chunkForTelegram(text, limit),
    getContext: () => this._getContext(userId),
    setContext: (updates) => Object.assign(this._getContext(userId), updates),
  };
}
```

---

## Build Order

### Why This Order

Dependencies flow left to right. Each step does not break the previous.

```
Step 1: i18n extraction
  └── No dependencies on any other step.
      Safe to do immediately.

Step 2: State machine
  └── Depends on: nothing (internal change).
      Should be done before any UX changes to avoid bugs in the new screens.

Step 3: screenMsgId fix
  └── Depends on: Step 2 (screens now have cleaner entry points).
      Should be done before new screens are added.

Step 4: Forum extraction
  └── Depends on: Steps 1-3 (cleaner core makes extraction easier).
      Should be done before adding Forum Mode features.

Step 5: server.js encapsulation
  └── Depends on: any or all above (independent cleanup).
      Can be done last.
```

### Concrete Phase Sequence

**Phase 1 (Foundation):** Steps 1 + 2 together. i18n is trivial. State machine is the most important correctness fix and should be established before any UX work.

**Phase 2 (UX Redesign):** New screens, new navigation, keyboard redesign. These happen after the state machine is solid. The `screenMsgId` fix (Step 3) should be part of this phase since new screen work will naturally touch all screen handlers.

**Phase 3 (Forum):** Step 4. Forum extraction is a cleanup that makes Forum Mode features easier to iterate on. Do this after Direct Mode is stable.

**Phase 4 (Cleanup):** Step 5. server.js encapsulation is a code quality concern, not a functional one. Do it last.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| i18n extraction | Breaking the `_t()` fallback chain (uk → en fallback) | Keep `_t()` unchanged, only move the data object |
| State machine | Forgetting `_transition(IDLE)` before command routing — pending state survives commands | Add `_transition(userId, 'IDLE')` as first line of `_handleCommand` |
| screenMsgId removal | Old inline buttons (from notifications sent before deploy) target stale message IDs → Telegram returns 400 | `_editScreen` already has a fallback to send new message on edit failure — verify this path works |
| Forum extraction | `this._currentThreadId` is set as a class-level property on `TelegramBot`, forum methods depend on it | Pass `threadId` explicitly as parameter to all forum methods instead of relying on class state |
| server.js access | `_getContext` is called from `TelegramResponseHandler` to set `pendingAskRequestId` — after state machine migration, this becomes `setContext({ state: 'AWAITING_ASK_RESPONSE', stateData: {...} })` | Coordinate state machine and server.js changes in the same PR |
| Adding new screens | Every new screen that can be reached from a notification (where there is no existing screen message to edit) must handle `editMsgId === null` gracefully | Test each screen from both a button tap and a slash command |

---

## Scalability Considerations

This is a single-user bot (one deployment serves one studio instance). The scalability concerns are correctness under concurrent Telegram events, not load.

| Concern | Current | After Refactor |
|---------|---------|----------------|
| Two messages from same user processed concurrently | Not guarded — state can race | Add per-user processing lock (simple `Map<userId, Promise>` chain) |
| `_currentThreadId` class-level state | Races if two updates processed concurrently | After forum extraction, pass `threadId` as parameter — eliminates the race |
| SQLite synchronous calls | `better-sqlite3` is synchronous but non-blocking in WAL mode | Acceptable for single-user; no change needed |
| In-memory `_userContext` map growth | Periodic cleanup in `start()` already handles pairing/rate maps; `_userContext` is never cleaned | Add cleanup: if `_userContext` entry has no pending state and was last touched >24h ago, evict it |

---

## Sources

- Direct code audit of `/Users/admin/_Projects/claude-code-studio/telegram-bot.js` (4693 lines, lines 42–4693) — HIGH confidence
- Direct code audit of `/Users/admin/_Projects/claude-code-studio/server.js` (lines 1380–1720) — HIGH confidence
- [Building Robust Telegram Bots — henrywithu.com, 2025](https://henrywithu.com/building-robust-telegram-bots/) — MEDIUM confidence
- [Creating a Conversational Telegram Bot with FSM — Level Up Coding](https://levelup.gitconnected.com/creating-a-conversational-telegram-bot-in-node-js-with-a-finite-state-machine-and-async-await-ca44f03874f9) — MEDIUM confidence
- [Two Design Patterns for Telegram Bots — DEV Community](https://dev.to/madhead/two-design-patterns-for-telegram-bots-59f5) — MEDIUM confidence
