# BMAD Create Story

**Trigger:** Use when the user says "create the next story", "create story [X]", or needs a story file generated for development.

**Source:** BMAD V6 bmm/workflows/4-implementation/create-story

## Goal
Create a comprehensive story file that gives the dev agent EVERYTHING needed for flawless implementation. Prevent common LLM mistakes: reinventing wheels, wrong libraries, wrong file locations, breaking regressions.

## Your Role
Story context engine. NOT copying from epics — creating a comprehensive, optimized story file. Exhaustive analysis required — do not be lazy or skim. This is the most important function in the development process.

## Common LLM Mistakes to Prevent
- Reinventing existing utilities/patterns
- Using wrong libraries (different from rest of codebase)
- Creating files in wrong locations
- Breaking existing regressions
- Ignoring UX patterns from design specs
- Vague implementations that need further clarification
- Lying about completion without verification

## Workflow Steps

### Step 1: Determine Target Story
1. Check if story path is provided (e.g., `1-2-user-auth`)
2. If not, check sprint-status.yaml for next `ready-for-dev` story
3. Extract: epic_num, story_num, story_title, story_key

### Step 2: Exhaustive Artifact Analysis (run in parallel if possible)
Load and deeply analyze ALL available artifacts:

| Artifact | Purpose |
|----------|---------|
| Epics file | Full story context, acceptance criteria, dependencies |
| PRD | Feature requirements, success metrics, user journeys |
| Architecture | Tech decisions, patterns, file structure, data models |
| UX Design | Component specs, interaction patterns, accessibility |
| Project Context | Conventions, libraries, existing patterns |
| Previous stories | Patterns established, lessons learned |

### Step 3: Codebase Investigation
1. Identify which files will need changes
2. Check existing patterns for similar functionality
3. Find relevant utilities, helpers, shared components
4. Identify potential conflicts with other in-progress stories

### Step 4: Generate Story File
```markdown
# Story [epic_num]-[story_num]: [Title]

## Status: ready-for-dev

## Story
As a [user], I want [capability], so that [value]

## Acceptance Criteria
- Given [context], When [action], Then [outcome]
[...]

## Technical Context
**Files to modify:** [exact paths]
**Files to create:** [exact paths]
**Patterns to follow:** [specific file:line references]
**Libraries to use:** [exact import paths]

## Tasks / Subtasks
- [ ] Task 1: [Specific action with file path]
  - [ ] Subtask 1.1: [Detail]
  - [ ] Subtask 1.2: [Detail]
- [ ] Task 2: [Specific action]
[...]

## Out of Scope
- [Explicit exclusions to prevent scope creep]

## Dev Notes
[Any warnings, gotchas, important context discovered during analysis]
```

### Step 5: Validation
Run checklist before finalizing:
- [ ] All ACs are testable (Given/When/Then)
- [ ] All file paths are specific and correct
- [ ] All patterns reference actual codebase examples
- [ ] No placeholders or TBD items
- [ ] Dependencies are explicit
- [ ] Out-of-scope items are listed

### Step 6: Questions (if any)
Only after complete story is written — surface any unresolved questions.
