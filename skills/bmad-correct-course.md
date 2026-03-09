# BMAD Correct Course

**Trigger:** Use when the user says "correct course", "propose sprint change", or needs to manage a significant change during active sprint execution.

**Source:** BMAD V6 bmm/workflows/4-implementation/correct-course

## Goal
Manage significant changes during sprint execution — analyze impact across all project artifacts and produce a structured Sprint Change Proposal with clear handoff.

## Your Role
Scrum Master navigating change management. Analyze the triggering issue, assess impact across PRD, epics, architecture, and UX artifacts, and produce an actionable Sprint Change Proposal.

## When to Use
- New requirement discovered mid-sprint
- Technical blocker requiring architectural change
- User feedback requiring feature pivot
- Dependency failure requiring scope adjustment
- Critical bug requiring re-prioritization

## Workflow Steps

### Step 1: Understand the Change Trigger
Ask user:
1. What happened? (triggering event)
2. Which story/epic is affected?
3. Urgency: blocking current sprint? or next sprint planning?

### Step 2: Load Full Project Context
Load all planning artifacts for impact assessment:
- PRD (requirements impact)
- Epics (story impact)
- Architecture (technical impact)
- UX Design (interaction impact)
- Current sprint-status.yaml

### Step 3: Impact Analysis
For the proposed change, assess impact across:

| Area | Impact | Severity |
|------|--------|---------|
| Current sprint stories | [affected stories] | Critical/High/Medium/Low |
| Future epic stories | [affected] | ... |
| PRD requirements | [affected REQ-IDs] | ... |
| Architecture decisions | [affected ADRs] | ... |
| UX patterns | [affected flows] | ... |

### Step 4: Options Analysis
Present 2-3 change options:
- **Option A**: [Minimal change — stay within sprint]
- **Option B**: [Moderate change — some sprint scope adjustment]
- **Option C**: [Full pivot — significant restructuring]

For each option: what changes, what stays the same, risks, recommendations.

### Step 5: Sprint Change Proposal
```markdown
# Sprint Change Proposal: [Date]

## Trigger
[What happened and why change is needed]

## Proposed Change
[Clear description of the change]

## Impact Summary
- Stories affected: [list]
- Stories unaffected: [list]
- New stories needed: [list if any]
- Estimated scope delta: [stories added/removed]

## Artifacts to Update
- [ ] PRD: [specific sections]
- [ ] Epics: [specific stories]
- [ ] Architecture: [specific ADRs]
- [ ] Sprint status: [status changes]

## Recommended Action
[Clear recommendation with rationale]

## Next Steps
[Ordered list of what to do after approval]
```

### Step 6: Execute Approved Changes
After user approves a proposal:
1. Update all affected artifacts
2. Re-run sprint planning for affected epics
3. Generate new story files if new stories added
