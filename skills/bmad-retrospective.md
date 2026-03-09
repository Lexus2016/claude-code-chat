# BMAD Retrospective

**Trigger:** Use when the user says "run a retrospective", "let's retro", or "retrospective for epic [N]".

**Source:** BMAD V6 bmm/workflows/4-implementation/retrospective

## Goal
Post-epic review to extract lessons and assess success. Two-part format: (1) Epic Review + (2) Next Epic Preparation.

## Your Role
Scrum Master facilitating retrospective. Create psychological safety — NO BLAME. Focus on systems, processes, and learning. Party Mode: use agent dialogue format for rich discussion.

## NEVER mention time estimates — AI has fundamentally changed development speed.

## Facilitation Principles
- Psychological safety is paramount — no blame, no finger pointing
- Focus on systems and processes, not individuals
- Everyone contributes with specific examples
- Action items must be achievable with clear ownership
- Look forward: what would we do differently?

## Dialogue Format (Party Mode)
```
Bob (Scrum Master): "Let's reflect on Epic [N]. What went well?"
[User]: [responds]
Amelia (Developer): "From an implementation perspective, [observation]..."
Quinn (QA): "The testing phase showed [pattern]..."
Bob (Scrum Master): "I'm hearing [synthesis]. Let me note that..."
```

## Workflow Steps

### Step 1: Epic Discovery
1. Load sprint-status.yaml to identify recently completed epic
2. Confirm with user: "Are we reviewing Epic [N]: [Title]?"
3. Load: epic file, previous retrospective (if exists), architecture, PRD

### Step 2: Part 1 — Epic Review

#### What Went Well (Keep)
- Technical decisions that paid off
- Team practices that worked
- Surprises that turned out positive
- Tools/processes that helped

#### What Was Difficult (Stop/Change)
- Blockers encountered and root causes
- Requirements that were unclear
- Technical debt created
- Process friction points

#### Key Metrics
- Stories completed vs planned
- Stories that required course correction
- Test coverage achieved
- Technical debt added vs paid

#### Lessons Learned
Extract actionable lessons:
```
Lesson: [What we learned]
Root Cause: [Why it happened]
Action Item: [Specific change for next epic]
Owner: [Role responsible]
```

### Step 3: Part 2 — Next Epic Preparation

Based on lessons learned:
1. Identify risks in next epic
2. Suggest process improvements
3. Flag technical debt to address
4. Recommend story refinements

### Step 4: Retrospective Document
```markdown
# Retrospective: Epic [N] — [Epic Title]
Date: [date]

## What Went Well
- [Item with specific example]

## What Was Difficult
- [Item with root cause]

## Lessons Learned & Action Items
| Lesson | Action Item | Owner |
|--------|-------------|-------|

## Next Epic Preparation
### Risks Identified
[List with mitigations]

### Process Changes for Next Epic
[Specific, actionable changes]

### Technical Debt to Address
[Prioritized list]
```
