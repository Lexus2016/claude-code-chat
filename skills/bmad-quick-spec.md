# BMAD Quick Spec

**Trigger:** Use when the user says "create a quick spec", "generate a quick tech spec", or has a small change/feature needing rapid specification.

**Source:** BMAD V6 bmm/workflows/bmad-quick-flow/quick-spec

## Goal
Create implementation-ready technical specifications through conversational discovery, code investigation, and structured documentation. For small changes — not full epics.

## "Ready for Development" Standard
A spec is ONLY ready when it meets ALL of:
- **Actionable**: Every task has a clear file path and specific action
- **Logical**: Tasks ordered by dependency (lowest level first)
- **Testable**: All ACs follow Given/When/Then, cover happy path and edge cases
- **Complete**: All investigation results inlined — no placeholders or TBD
- **Self-Contained**: A fresh agent can implement without reading conversation history

## Your Role
Elite developer and spec engineer. Ask sharp questions, investigate existing code thoroughly, produce specs with ALL context a fresh dev agent needs. No handoffs, no missing context.

## Workflow Steps

### Step 1: Understand the Change
Ask:
1. What needs to change? (1-3 sentence description)
2. Which files/components are affected? (or "unknown")
3. Any constraints? (performance, compatibility, style guide)

### Step 2: Code Investigation
Before speccing, investigate:
1. Find existing similar implementations in the codebase
2. Identify exact files and patterns to follow
3. Check for tests that need updating
4. Find utilities/helpers that should be reused

### Step 3: Clarification Round
Based on investigation, ask any remaining questions:
- Ambiguous edge cases
- Conflicting patterns found
- Missing context that would affect implementation

### Step 4: Write the Quick Spec

```markdown
# Quick Tech Spec: [Feature/Change Title]

## Context
[1-2 sentences: what, why, scope boundary]

## Investigation Results
- **Pattern to follow:** [file:line reference]
- **Utilities to reuse:** [import path]
- **Tests to update:** [file path]

## Acceptance Criteria
- Given [context], When [action], Then [outcome]
- Given [context], When [action], Then [edge case outcome]

## Tasks (ordered by dependency)
- [ ] 1. [File path]: [Specific change — e.g., "Add X function to Y module"]
- [ ] 2. [File path]: [Specific change]
- [ ] 3. [Test file]: [Add test for X covering Y and Z]

## Out of Scope
- [Explicit exclusion]

## Notes
- [Any gotchas discovered during investigation]
```

### Step 5: Review & Proceed
Present spec to user:
- Confirm scope is correct
- Confirm out-of-scope items
- Offer: "Proceed to implementation?" (links to bmad-quick-dev skill)

## Key Rules
- Maximum 2-3 clarifying questions — investigate first, ask less
- No time estimates
- Apply Advanced Elicitation if user wants deeper analysis
- Spec must be fully self-contained before marking Ready for Development
