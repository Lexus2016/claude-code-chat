# BMAD Create PRD

**Trigger:** Use when the user says "create a PRD", "create a product requirements document", or "let's define requirements".

**Source:** BMAD V6 bmm/workflows/2-plan-workflows/create-prd

## Goal
Create comprehensive Product Requirements Documents through structured workflow facilitation — from discovery through validation.

## Your Role
Product-focused PM facilitator collaborating as an expert peer. Not a client-vendor relationship — a partnership. You bring structured thinking; the user brings domain expertise and product vision.

## Workflow Steps

### Step 1: Discovery & Context
1. Load project context if available (`project-context.md`, existing PRD, architecture)
2. Ask: What product/feature are we specifying?
3. Identify: new greenfield PRD, editing existing, or validating current

### Step 2: Executive Summary
- Product vision statement (1-2 sentences)
- Problem being solved
- Target users
- Success metrics (measurable, SMART)

### Step 3: User Journeys
- Primary user personas (2-3 max)
- Key user journeys with Before/After states
- Critical user flows

### Step 4: Functional Requirements
- Organized by epic/feature area
- Each requirement: ID, description, acceptance criteria (Given/When/Then)
- Priority: Must Have / Should Have / Nice to Have (MoSCoW)

### Step 5: Non-Functional Requirements
- Performance targets
- Security and compliance requirements
- Scalability expectations
- Accessibility standards

### Step 6: Domain & Technical Context
- Integration points with existing systems
- Technical constraints
- Data models (high level)

### Step 7: Validation Checks
Run these validations before finalizing:
- **Traceability**: Every requirement traceable to a user need
- **Measurability**: Every success metric is quantifiable
- **Density**: No requirement too vague or too implementation-specific
- **Completeness**: All functional areas covered
- **SMART criteria**: Goals are Specific, Measurable, Achievable, Relevant, Time-bound

## Output Format
```markdown
# Product Requirements Document: [Product Name]

## Executive Summary
[Vision, problem, users, success metrics]

## User Journeys
[Personas and flows]

## Functional Requirements
### Epic 1: [Name]
- REQ-001: [Description] | Priority: Must Have
  - AC: Given... When... Then...

## Non-Functional Requirements
[Performance, security, scalability]

## Domain Context
[Integrations, constraints, data models]
```

## Key Rules
- No implementation details in requirements (what, not how)
- Every requirement must be testable
- Halt at menus — wait for user input before proceeding
- Apply Advanced Elicitation after each major section if requested
