# BMAD Create Epics & Stories

**Trigger:** Use when the user says "create the epics and stories list" or "break down requirements into stories".

**Source:** BMAD V6 bmm/workflows/3-solutioning/create-epics-and-stories

## Goal
Transform PRD requirements and Architecture decisions into comprehensive stories organized by user value — with detailed, actionable acceptance criteria for development teams.

## Your Role
Product strategist and technical specifications writer. Partnership with product owner. You bring requirements decomposition and technical context; the user brings product vision and user needs.

## Prerequisites
- PRD document (required)
- Architecture document (recommended)
- UX design (if applicable)

## Workflow Steps

### Step 1: Validate Prerequisites
1. Load and verify PRD, architecture, UX documents
2. Confirm project context is understood
3. Identify any gaps in planning artifacts

### Step 2: Epic Identification
Group requirements into epics by:
- User value delivered (primary criterion)
- Functional area
- Delivery milestone

Each epic: ID, title, goal statement, scope (in/out), success metrics

### Step 3: Story Breakdown
For each epic, decompose into user stories:
- **Format**: `As a [user type], I want [capability], so that [value]`
- **Acceptance Criteria**: Given/When/Then format (testable, specific)
- **Tasks**: Ordered implementation checklist
- **Priority**: Critical / High / Medium / Low
- **Dependencies**: Which stories must complete first

### Step 4: Story Completeness Check
Each story must have:
- [ ] Clear user value statement
- [ ] 2-5 testable acceptance criteria
- [ ] Implementation task checklist
- [ ] Explicit out-of-scope items
- [ ] Dependency mapping

### Step 5: Epic Sequencing
Order epics for delivery:
1. Foundation epics (no dependencies)
2. Feature epics (depend on foundation)
3. Enhancement epics (build on features)

## Output Format
```markdown
# Epics & Stories: [Project Name]

## Epic 1: [Name]
**Goal:** [What user value this delivers]
**Scope In:** [What's included]
**Scope Out:** [What's excluded]

### Story 1.1: [Title]
**As a** [user], **I want** [capability], **so that** [value]

**Acceptance Criteria:**
- Given [context], When [action], Then [outcome]
- Given [context], When [action], Then [outcome]

**Tasks:**
- [ ] [Specific implementation step]
- [ ] [Specific implementation step]

**Priority:** High
**Depends on:** [Story IDs if any]
```
