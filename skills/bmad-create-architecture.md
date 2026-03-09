# BMAD Create Architecture

**Trigger:** Use when the user says "create architecture", "create technical architecture", or "create a solution design".

**Source:** BMAD V6 bmm/workflows/3-solutioning/create-architecture

## Goal
Create comprehensive architecture decisions through collaborative discovery that ensures AI agents implement consistently. Prevent implementation conflicts through explicit decision documentation.

## Your Role
Architectural facilitator and peer collaborator. You bring structured thinking and architectural knowledge; the user brings domain expertise and product vision. Work as equals.

## Prerequisites
- PRD document (required)
- Existing codebase context (if brownfield)

## Workflow Steps

### Step 1: Context Loading
1. Load PRD, existing architecture (if any), project-context
2. Identify: greenfield or brownfield project
3. Understand tech stack constraints and preferences

### Step 2: System Overview
- High-level system diagram (text-based)
- Component boundaries and responsibilities
- Data flow between components

### Step 3: Technology Decisions
For each major technology choice:
- **Decision**: What technology/pattern
- **Alternatives considered**: What else was evaluated
- **Rationale**: Why this choice
- **Trade-offs**: What we're giving up
- **Constraints**: What this decision locks in

### Step 4: Data Architecture
- Core data models (entities, relationships)
- Data storage decisions (database type, schema approach)
- Data flow and transformation points

### Step 5: API Design
- API style (REST/GraphQL/gRPC/event-driven)
- Key endpoints or event schemas
- Authentication and authorization approach

### Step 6: Infrastructure & Deployment
- Hosting and cloud decisions
- Containerization approach
- CI/CD pipeline design
- Monitoring and observability

### Step 7: Security Architecture
- Authentication / authorization model
- Data encryption (at rest, in transit)
- Secret management approach
- Security boundaries

### Step 8: Architecture Decision Records (ADRs)
For each significant decision:
```
### ADR-[N]: [Decision Title]
**Status:** Accepted
**Context:** [Why this decision was needed]
**Decision:** [What was decided]
**Alternatives:** [What was rejected and why]
**Consequences:** [What this means going forward]
```

## Output Format
```markdown
# Architecture: [Project Name]

## System Overview
[Diagram + component descriptions]

## Technology Stack
| Layer | Technology | Rationale |
|-------|-----------|-----------|

## Data Architecture
[Models, storage, flow]

## API Design
[Style, key endpoints, auth]

## Infrastructure
[Hosting, deployment, monitoring]

## Security
[Auth model, encryption, secrets]

## Architecture Decision Records
[ADR-1 through ADR-N]
```

## Key Rules
- Document every significant decision as an ADR
- Explicit > implicit: no "obvious" choices left undocumented
- Halt at menus — wait for user approval before proceeding
- Apply First Principles Thinking + ADR elicitation if requested
