# BMAD Sprint Planning

**Trigger:** Use when the user says "run sprint planning", "generate sprint plan", or "initialize sprint tracking".

**Source:** BMAD V6 bmm/workflows/4-implementation/sprint-planning

## Goal
Generate sprint status tracking from epics — detecting current story statuses and building a complete sprint-status.yaml file.

## Your Role
Scrum Master generating and maintaining sprint tracking. Parse epic files, detect story statuses, and produce structured sprint-status.yaml.

## Prerequisites
- Epics file(s) in planning_artifacts
- Optionally: existing story files to auto-detect status

## Workflow Steps

### Step 1: Epic Discovery
1. Search for epic files: `*epic*.md` in planning_artifacts
2. Handle both single file (`epics.md`) and sharded (`epic-1.md`, `epic-2.md`, etc.)
3. Load ALL epic content completely — sprint planning needs the full picture

### Step 2: Story Status Detection
For each story in each epic, detect current status:
- **not-started**: No story file exists
- **ready-for-dev**: Story file exists, tasks not started
- **in-progress**: Story file exists, some tasks checked off
- **done**: Story file exists, all ACs verified, status = done
- **blocked**: Story file exists, blocking issue documented

### Step 3: Dependency Mapping
- Identify which stories depend on others
- Mark stories as `blocked` if dependencies not yet `done`
- Surface critical path through the epic

### Step 4: Generate sprint-status.yaml
```yaml
project: [project_name]
generated: [date]
active_epic: epic-[N]

development_status:
  [story-key]:
    status: [not-started|ready-for-dev|in-progress|done|blocked]
    title: [Story title]
    epic: [epic_num]
    story: [story_num]
    blocked_by: [story-key or null]
    story_file: [path or null]
```

### Step 5: Sprint Summary
Output summary for user:
```
Sprint Status: [Project Name]

Epic [N]: [Epic Title]
- Stories ready for dev: [N]
- Stories in progress: [N]
- Stories done: [N/total]
- Blocked stories: [N]

Recommended next story: [story-key] — [title]
```

## Key Rules
- Never estimate time — only track status
- Fuzzy match epic file names (epics.md, bmm-epics.md, user-stories.md, etc.)
- If sprint-status.yaml already exists, update it — don't overwrite manual changes
- Mark stories as `ready-for-dev` only if all dependencies are `done`
