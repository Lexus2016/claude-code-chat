# Claude Code Studio × BMAD × OpenClaw Integration

## Context

This is a fork of claude-code-studio at /home/ubuntu/claude-code-studio.
BMAD agent files are at /home/ubuntu/.openclaw/workspace/bmad-openclaw/
The existing Studio skills are in /home/ubuntu/claude-code-studio/skills/

The server is a monolith in server.js (~4600 lines). The frontend is in public/.
The Kanban board, chat, skills, multi-agent, scheduling are all in server.js.

## CRITICAL: Do NOT break existing functionality. All changes must be additive.

## Tasks to implement (in order):

### Phase 1: Foundation (already done - npm install works, server starts)

### Phase 2: Replace Skills with BMAD Agents

**Task 3: Back up existing skills**
- Move `skills/` → `skills-original/`
- Create new `skills/` directory

**Task 4: Create BMAD-based skill files**
- Read each BMAD agent from /home/ubuntu/.openclaw/workspace/bmad-openclaw/agents/
- Convert each to Studio-compatible .md skill format (simple markdown with role description, capabilities, patterns)
- Files to create in skills/:
  - analyst.md (from bmad analyst.md)
  - architect.md (from bmad architect.md)
  - developer.md (from bmad developer.md)
  - product-manager.md (from bmad product-manager.md)
  - qa-engineer.md (from bmad qa-engineer.md)
  - scrum-master.md (from bmad scrum-master.md)
  - tech-writer.md (from bmad tech-writer.md)
  - ux-designer.md (from bmad ux-designer.md)
  - bmad-master.md (from bmad bmad-master.md)
  - quick-flow.md (from bmad quick-flow-solo-dev.md)
  - auto-mode.md (keep this from original - it controls auto-skill selection)
- Also keep these original skills that don't overlap with BMAD: security.md, devops.md, docker.md, kubernetes.md, postgres-wizard.md, frontend.md, backend.md, fullstack.md, code-review.md, debugging-master.md

**Task 5: Update auto-skill classifier**
- Find the auto-skill classifier in server.js (search for "auto" skill selection, Haiku classifier)
- Update the skill name mappings to include BMAD agents
- Ensure the classifier knows about: analyst, architect, developer, product-manager, qa-engineer, scrum-master, tech-writer, ux-designer, bmad-master

### Phase 3: BMAD Workflow Kanban Columns

**Task 6: Add BMAD workflow columns**
- Find the Kanban board implementation in server.js and public/
- Add BMAD phase columns: Brainstorm, PRD, Architecture, Implementation, QA, Done
- These should be in addition to (or replace) the existing columns
- Look for how columns/statuses are defined and extend them

**Task 7: Workflow gate logic**
- When a card is in a BMAD phase column, add metadata tracking which phase it's in
- Cards using Dispatch mode should set depends_on based on phase order
- Add a simple phase validation: a card can move to next phase only if current phase card is "Done"

**Task 8: BMAD phase templates**
- Read the templates from /home/ubuntu/.openclaw/workspace/bmad-openclaw/templates/
- When creating a new card in a BMAD column, offer to pre-fill from the relevant template
- Brainstorm → brainstorming-session.md template
- PRD → prd.md template  
- Architecture → tech-spec.md template
- QA → readiness-report.md template

### Phase 4: Scheduling + BMAD Automation

**Task 9: Pre-built BMAD scheduled task templates**
- Find the scheduler implementation in server.js
- Add template scheduled tasks:
  - "Nightly Test Suite" - runs tests daily at 2am
  - "Weekly Dependency Audit" - weekly security audit
  - "Weekly Code Review" - weekly automated code review
  - "Daily Git Standup" - daily summary of git activity
- These should be selectable from the scheduler UI

**Task 10: BMAD agent context in scheduled tasks**
- When a scheduled task runs, inject the relevant BMAD agent skill
- Test tasks → qa-engineer skill
- Code review → code-review + analyst skill
- Dependency audit → security + devops skill

### Phase 5: Multi-Agent = BMAD Party Mode

**Task 11: Map Multi mode to BMAD personas**
- Find the Multi mode implementation (where it decomposes tasks into subtasks)
- When assigning agents to subtasks, map them to BMAD roles:
  - Architecture subtask → architect agent
  - Implementation subtask → developer agent
  - Testing subtask → qa-engineer agent
  - Documentation subtask → tech-writer agent
  - UX subtask → ux-designer agent

**Task 12: Party Mode UI toggle**
- Add a "Party" button alongside Single/Multi/Dispatch in the toolbar
- Party mode: before execution, runs a multi-persona discussion
- Show a visual panel where BMAD agents discuss the approach
- After discussion, automatically create an execution plan

### Phase 6: OpenClaw Integration + Polish

**Task 13: /bmad-help slash command**
- Add to the slash commands system (search for existing /check, /review etc)
- /bmad-help should output contextual guidance based on project state
- Check if there are BMAD output files, what phase the project is in
- Suggest next steps

**Task 14: Update README**
- Add a section about BMAD integration
- Document the new features: BMAD skills, workflow columns, party mode, OpenClaw bridge

**Task 16: REST API for external card creation**
- Add these API endpoints to server.js:
  - POST /api/tasks - create a Kanban card (requires auth)
  - GET /api/tasks - list cards with status filter
  - PATCH /api/tasks/:id - update card status
  - GET /api/tasks/:id/result - get task result
- Use the existing auth middleware
- Accept JSON body: { title, description, column, priority, skill }

**Task 17: OpenClaw bridge config**
- Create openclaw-bridge.js module
- Handles: receiving webhook events from OpenClaw, creating cards
- Config in .env: OPENCLAW_API_URL, OPENCLAW_API_KEY
- Expose WebSocket event stream for task status changes

**Task 18: Route task events through OpenClaw**
- When a task completes/fails, if OPENCLAW_API_URL is set, POST the event
- Event format: { type: "task_complete"|"task_failed", taskId, title, result, duration }
- This supplements (not replaces) Telegram notifications

**Task 19: OpenClaw cron templates**
- Add a section in the scheduled task templates for "OpenClaw-triggered" tasks
- These are cards that expect to be created externally via the API
- Document the API format for OpenClaw cron integration

## Implementation Notes

- server.js is the main file - most changes go here
- Frontend is in public/ directory
- The Kanban board UI is likely in public/index.html or similar
- Search for "kanban", "task", "board" in server.js for relevant code
- Search for "skill" for the skills system
- Search for "multi" or "dispatch" for multi-agent code
- Search for "schedule" for the scheduler
- Search for "slash" or "command" for slash commands
- Use git commits after each phase

## Git workflow
- Create branch: feature/bmad-openclaw-integration
- Commit after each phase
- Do NOT push to main
