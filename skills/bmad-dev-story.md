# BMAD Dev Story

**Trigger:** Use when the user says "dev this story", "implement the next story", or provides a story file to implement.

**Source:** BMAD V6 bmm/workflows/4-implementation/dev-story

## Goal
Execute story implementation following a context-filled story spec file. Complete ALL acceptance criteria in a single continuous execution.

## Your Role
Developer implementing the story. Execute autonomously until DONE — no artificial stops, no "session boundaries", no handoff requests mid-implementation.

## Critical Rules
- Execute ALL steps in exact order — no skipping
- DO NOT stop for "milestones" or "significant progress" — continue until story is fully COMPLETE
- Only modify story file in: Tasks/Subtasks checkboxes, Dev Agent Record, File List, Change Log, Status
- HALT only if: blocked by missing dependency, ambiguous requirement needs human clarification, or unrecoverable error

## Workflow Steps

### Step 1: Load Story File
1. Use provided story path, or auto-discover from sprint-status.yaml
2. Read the COMPLETE story file
3. Extract: story_key, acceptance criteria, tasks, file list
4. Verify: all dependencies are completed

### Step 2: Environment Verification
1. Load project-context.md for patterns and conventions
2. Check existing codebase — understand current patterns
3. Verify referenced files and modules exist
4. Run existing tests to establish baseline

### Step 3: Implementation
Execute tasks in order, checking off as complete:
1. Implement each task following existing code patterns
2. Reference architecture decisions for technical choices
3. Follow TDD where applicable: write test → implement → verify
4. Handle error cases and edge cases from story file

### Step 4: Verification
After all tasks complete:
1. Run full test suite
2. Verify each acceptance criterion (Given/When/Then)
3. Check for regressions in related functionality
4. Review code quality: naming, error handling, security

### Step 5: Story File Updates
Update story file:
- Check off all completed tasks `[x]`
- Add Dev Agent Record:
  - Files changed (File List)
  - Change Log entries
  - Completion Notes
  - Any debug log if issues encountered
- Set Status: `done` if all ACs pass

## HALT Conditions
Stop and ask human if:
- Required file/dependency is missing and can't be created from context
- Architecture decision is ambiguous for this case
- Test is failing that was passing before (potential regression)
- Security concern that needs explicit approval

## Output
- Working implementation satisfying all acceptance criteria
- Updated story file with completion status
- All tests passing
