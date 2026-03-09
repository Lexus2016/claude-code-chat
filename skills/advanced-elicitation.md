# Advanced Elicitation

**Trigger:** Use when you need to push deeper on any output — requirements, architecture, code, plans. Apply after any major deliverable to stress-test and improve it.

## Auto-trigger points in BMAD chain:
- After Analyst completes → Pre-mortem Analysis + Stakeholder Round Table on requirements
- After Architect completes → Architecture Decision Records + First Principles on design
- After Developer completes → Red Team vs Blue Team on implementation

## Methods Reference
The full methods catalogue is in `skills/bmad-elicitation-methods.csv` (50 methods across 10 categories).

## Key Methods by Use Case

### Requirements (post-Analyst)
- **Pre-mortem Analysis** — Assume the feature failed in production. Work backward to find gaps.
- **Stakeholder Round Table** — Evaluate from end user, developer, product owner, ops perspectives.
- **5 Whys Deep Dive** — Drill to root cause of each requirement.

### Architecture (post-Architect)
- **Architecture Decision Records** — Document each decision with trade-offs, alternatives, rationale.
- **First Principles Thinking** — Strip assumptions, rebuild from ground truth.
- **Red Team vs Blue Team** — Attack/defend the design to find vulnerabilities.

### Implementation (post-Developer / Code Review)
- **Red Team vs Blue Team** — Adversarial attack-defend to find security and logic flaws.
- **Code Review Gauntlet** — Multiple reviewer philosophies surface style debates.
- **Security Audit Personas** — Hacker + defender + auditor examine from different threat models.

### Risk / General
- **Failure Mode Analysis** — How can each component fail?
- **Challenge from Critical Perspective** — Devil's advocate to stress-test ideas.
- **What If Scenarios** — Explore alternative realities and implications.

## Workflow

### Step 1: Context Analysis
- Identify content type: requirements / architecture / code / plan
- Select 3-5 most relevant methods from the CSV

### Step 2: Apply Methods in Sequence
For each selected method:
1. Execute the method against the content
2. Document findings — gaps, risks, improvements
3. Apply improvements to the artifact
4. Note what changed and why

### Step 3: Output
- Updated artifact with elicitation-improved content
- Summary of methods applied and key findings
- Any unresolved risks flagged for human review

## Inline Usage Format
When embedding in task descriptions:
```
Apply these elicitation methods in sequence:
1. **[Method Name]**: [Brief instruction]
2. **[Method Name]**: [Brief instruction]

Read the [artifact]. Apply each method, document findings, update the artifact.
Output: Enhanced [artifact] with elicitation-improved [content].
```

## Categories Available
- **collaboration** — Stakeholder Round Table, Expert Panel, Debate Club, etc.
- **advanced** — Tree of Thoughts, Graph of Thoughts, Self-Consistency Validation
- **competitive** — Red Team vs Blue Team, Shark Tank, Code Review Gauntlet
- **technical** — Architecture Decision Records, Security Audit, Performance Profiler
- **creative** — SCAMPER, Reverse Engineering, What If Scenarios
- **risk** — Pre-mortem Analysis, Failure Mode Analysis, Chaos Monkey
- **core** — First Principles, 5 Whys, Socratic Questioning, Critique and Refine
- **research** — Literature Review, Thesis Defense, Comparative Analysis Matrix
- **retrospective** — Hindsight Reflection, Lessons Learned Extraction
- **learning** — Feynman Technique, Active Recall Testing
