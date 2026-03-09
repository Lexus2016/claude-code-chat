# BMAD Brainstorming

**Trigger:** Use when the user says "help me brainstorm" or "help me ideate" or wants creative exploration of ideas.

**Source:** BMAD V6 core/workflows/brainstorming

## Goal
Facilitate interactive brainstorming sessions using diverse creative techniques and ideation methods. Push past obvious ideas into truly novel territory.

## Critical Mindset
- Keep the user in generative exploration mode as long as possible
- Resist the urge to organize or conclude prematurely
- Anti-Bias: Shift creative domain every 10 ideas (technical → UX → business → edge cases)
- Quantity goal: Aim for 100+ ideas before organizing. Magic happens in ideas 50-100.

## Brainstorming Techniques (from brain-methods.csv)
Select techniques based on context. Categories include:
- **Divergent** — Free association, SCAMPER, Random Word stimulus
- **Structured** — Morphological analysis, Mind mapping, 6 Thinking Hats
- **Collaborative** — Brainwriting, Round Robin, Yes-And improv
- **Analytical** — SWOT exploration, Assumption reversal, First principles
- **Creative** — Analogical thinking, Biomimicry, Genre mashup

## Workflow

### Step 1: Session Setup
1. Ask: What are we brainstorming? (topic/problem/opportunity)
2. Understand context: project type, constraints, success criteria
3. Select 2-3 opening techniques appropriate to the topic
4. Set the creative tone — no judgment, quantity over quality

### Step 2: Technique Selection
Present 3-5 technique options to the user:
- AI-recommended (based on context analysis)
- User-selected from list
- Random selection for creative disruption
- Progressive flow (build on previous session)

### Step 3: Technique Execution
For each technique:
1. Briefly explain the technique (1-2 sentences)
2. Apply it to generate 10-20 ideas
3. Surface the most surprising/unexpected ideas for deeper exploration
4. Ask: "Shall we dig deeper into any of these?"

### Step 4: Idea Organization
Only after exhausting generation:
1. Cluster ideas by theme
2. Mark: wild ideas, quick wins, moonshots, dependencies
3. Identify top 3-5 ideas for further development
4. Optionally trigger Advanced Elicitation on the top ideas

## Output Format
```
## Brainstorming Session: [Topic]
Date: [date]

### Ideas Generated ([N] total)
[Grouped by theme]

### Top Candidates
1. [Idea] — [Why it's promising]
2. [Idea] — [Why it's promising]
3. [Idea] — [Why it's promising]

### Next Steps
[Recommended workflow: Quick Spec, PRD, or Architecture]
```
