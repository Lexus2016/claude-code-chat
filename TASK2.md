# BMAD Deep Integration — Model Mapping + Party Mode + Elicitation + Missing Agents

## Context
Working on /home/ubuntu/claude-code-studio (feature/bmad-openclaw-integration branch).
BMAD V6 reference: /tmp/BMAD-METHOD/
Existing BMAD skills: /home/ubuntu/claude-code-studio/skills/

## TASK 1: Model-per-column mapping

Map Claude models to BMAD phases based on their strengths:

| Column / Phase | Model | Reasoning |
|---|---|---|
| bmad_brainstorm | opus | Creative ideation needs strongest reasoning, divergent thinking |
| bmad_prd | opus | Requirements need deep analysis, stakeholder thinking, edge cases |
| bmad_architecture | opus | Architecture decisions need strongest reasoning, trade-off analysis |
| bmad_implementation | sonnet | Best cost/quality balance for code generation, fast iteration |
| bmad_qa | sonnet | Test writing and verification is structured, sonnet handles well |
| backlog | (no execution) | — |
| todo | (inherits from phase) | — |
| done | (no execution) | — |

Also for the auto-dispatch chain subtasks:
- Analyst (brainstorm phase) → opus  
- Architect → opus
- Developer → sonnet
- Code Reviewer → sonnet
- QA → sonnet

### Implementation:
1. In server.js, find the BMAD auto-dispatch chain creation (search "BMAD Sprint Auto-Dispatch")
2. Update each subtask to use the model mapped to its phase
3. Also in the processQueue or startTask, if a task has a bmad-phase tag, override the model

Edit the subtasks array to include `model` field:
- Analyst: model 'opus'
- Architect: model 'opus'  
- Developer: model 'sonnet'
- Code Reviewer: model 'sonnet'
- QA: model 'sonnet'

Update the createTask call to use `st.model || task.model || 'sonnet'`

Also add a model mapping object at the top:
```javascript
const BMAD_PHASE_MODEL_MAP = {
  'bmad_brainstorm': 'opus',
  'bmad_prd': 'opus', 
  'bmad_architecture': 'opus',
  'bmad_implementation': 'sonnet',
  'bmad_qa': 'sonnet',
};
```

And in startTask, if the task has a bmad-phase tag, override the model:
```javascript
const bmadPhaseMatch = (task.notes || '').match(/\[bmad-phase:(\w+)\]/);
if (bmadPhaseMatch && BMAD_PHASE_MODEL_MAP[bmadPhaseMatch[1]]) {
  // Override model for BMAD phase tasks
  task.model = BMAD_PHASE_MODEL_MAP[bmadPhaseMatch[1]];
}
```

## TASK 2: Party Mode for Brainstorm & Architecture

When the BMAD chain creates Analyst (brainstorm) and Architect subtasks, enable Party Mode.

In the description for Analyst and Architect subtasks, add party mode instructions:

For Analyst subtask, prepend to description:
```
PARTY MODE ACTIVE: Before executing your analysis, facilitate a multi-agent discussion.
Simulate perspectives from these BMAD agents:
- Mary (Analyst 📊): Market research, competitive analysis  
- John (PM 📋): Requirements, stakeholder alignment
- Sally (UX 🎨): User experience, interaction patterns
- Bob (SM 🏃): Sprint feasibility, story breakdown

Discussion format:
1. Each agent states their perspective on the story requirements (2-3 sentences each)
2. Identify areas of agreement and disagreement
3. Synthesize into unified requirements

Then proceed with your analysis tasks.
```

For Architect subtask:
```
PARTY MODE ACTIVE: Before designing, facilitate a multi-agent architecture discussion.
Simulate perspectives from:
- Winston (Architect 🏗️): System design, scalability, patterns
- Amelia (Developer 💻): Implementation feasibility, code patterns
- Quinn (QA 🧪): Testability, edge cases, failure modes
- Bob (SM 🏃): Story impact, sprint planning implications

Discussion format:
1. Each agent evaluates the proposed approach (2-3 sentences each)
2. Debate trade-offs and alternatives
3. Converge on the recommended technical approach

Then proceed with your architecture tasks.
```

## TASK 3: Advanced Elicitation Integration

The elicitation methods CSV is at: /tmp/BMAD-METHOD/src/core/workflows/advanced-elicitation/methods.csv

Copy this file to: /home/ubuntu/claude-code-studio/skills/bmad-elicitation-methods.csv

Create a new skill file: /home/ubuntu/claude-code-studio/skills/advanced-elicitation.md
Content should include:
- The full advanced elicitation workflow from /tmp/BMAD-METHOD/src/core/workflows/advanced-elicitation/workflow.md
- Reference to the methods CSV
- Instructions for when to auto-trigger elicitation

Integrate elicitation into the BMAD chain:
- After the Analyst completes, before Architect starts → trigger Pre-mortem Analysis on the requirements
- After Architect completes, before Developer starts → trigger Architecture Decision Records on the design
- After Developer completes, before Code Review → trigger Red Team vs Blue Team on the implementation

Add a new subtask between each major phase that runs advanced elicitation.

Updated chain (7 subtasks instead of 5):
1. Analyst (opus) - brainstorm phase
2. Elicitation: Pre-mortem + Stakeholder Round Table on requirements (opus) - brainstorm phase
3. Architect (opus) - architecture phase  
4. Elicitation: ADR + First Principles on architecture (opus) - architecture phase
5. Developer (sonnet) - implementation phase
6. Code Reviewer + Red Team elicitation (sonnet) - implementation phase
7. QA (sonnet) - qa phase

For subtask 2 (post-analyst elicitation), description:
```
<!-- bmad-skills: ["advanced-elicitation","analyst"] -->
You are running Advanced Elicitation on the Analyst's output for story: {storyId}

Apply these elicitation methods in sequence:
1. **Pre-mortem Analysis**: Assume this feature already failed in production. Work backward to find what went wrong. Document gaps in the requirements.
2. **Stakeholder Round Table**: Evaluate requirements from perspectives of: end user, developer, product owner, operations team. Find blind spots.

Read the story file that was just created/updated by the Analyst.
Apply each method, document findings, and update the story file with enhanced requirements.
Output: Enhanced story file with elicitation-improved requirements.
```

For subtask 4 (post-architect elicitation):
```
<!-- bmad-skills: ["advanced-elicitation","architect"] -->
You are running Advanced Elicitation on the Architecture for story: {storyId}

Apply these methods:
1. **Architecture Decision Records**: Document each technical decision with explicit trade-offs, alternatives considered, and rationale.
2. **First Principles Thinking**: Strip away assumptions about the architecture. What must be true? Rebuild the approach from ground truth.

Read the architecture notes in the story file.
Apply methods, document ADRs, and update the story file.
Output: Architecture section with ADRs and first-principles validation.
```

## TASK 4: Missing Agents and Workflows

Compare current skills/ with BMAD V6 agents. Add any missing:

Current skills in /home/ubuntu/claude-code-studio/skills/:
- analyst.md, architect.md, developer.md, product-manager.md, qa-engineer.md
- scrum-master.md, tech-writer.md, ux-designer.md, bmad-master.md, quick-flow.md

Missing from V6:
- None of the agent personas are missing, but the WORKFLOW skills are.

Create these workflow skill files in skills/:
- bmad-brainstorming.md - from /tmp/BMAD-METHOD/src/core/workflows/brainstorming/
- bmad-party-mode.md - from /tmp/BMAD-METHOD/src/core/workflows/party-mode/workflow.md
- bmad-create-prd.md - from /tmp/BMAD-METHOD/src/bmm/workflows/2-plan-workflows/create-prd/
- bmad-create-architecture.md - from /tmp/BMAD-METHOD/src/bmm/workflows/3-solutioning/create-architecture/
- bmad-create-epics.md - from /tmp/BMAD-METHOD/src/bmm/workflows/3-solutioning/create-epics-and-stories/
- bmad-dev-story.md - from /tmp/BMAD-METHOD/src/bmm/workflows/4-implementation/dev-story/
- bmad-code-review.md - from /tmp/BMAD-METHOD/src/bmm/workflows/4-implementation/code-review/
- bmad-create-story.md - from /tmp/BMAD-METHOD/src/bmm/workflows/4-implementation/create-story/
- bmad-sprint-planning.md - from /tmp/BMAD-METHOD/src/bmm/workflows/4-implementation/sprint-planning/
- bmad-correct-course.md - from /tmp/BMAD-METHOD/src/bmm/workflows/4-implementation/correct-course/
- bmad-retrospective.md - from /tmp/BMAD-METHOD/src/bmm/workflows/4-implementation/retrospective/
- bmad-implementation-readiness.md - from /tmp/BMAD-METHOD/src/bmm/workflows/3-solutioning/check-implementation-readiness/
- bmad-quick-spec.md - from /tmp/BMAD-METHOD/src/bmm/workflows/bmad-quick-flow/quick-spec/
- bmad-quick-dev.md - from /tmp/BMAD-METHOD/src/bmm/workflows/bmad-quick-flow/quick-dev/

For each workflow skill, read the workflow.md from the BMAD source and create a Studio-compatible skill .md file that captures the essence of the workflow steps.

## TASK 5: Update Kanban UI to show model per card

In kanban.html, update the card rendering (buildCard function) to show the model badge.
If the task model is 'opus', show a purple badge. If 'sonnet', show a blue badge. If 'haiku', show a green badge.

Also update the BMAD column headers to show the default model:
- Brainstorm: "🧠 Brainstorm (opus)"
- PRD: "📋 PRD (opus)"  
- Architecture: "🏗️ Architecture (opus)"
- Implementation: "💻 Implementation (sonnet)"
- QA: "🧪 QA (sonnet)"

## Git
Commit after completion with descriptive message.
Do NOT push.
