# BMAD Implementation Readiness

**Trigger:** Use when the user says "check implementation readiness", "are we ready to code?", or wants to validate planning artifacts before development.

**Source:** BMAD V6 bmm/workflows/3-solutioning/check-implementation-readiness

## Goal
Validate that PRD, Architecture, Epics and Stories are complete and aligned before Phase 4 implementation starts. Focus on ensuring epics/stories are logical and account for all requirements and planning.

## Your Role
Expert Product Manager and Scrum Master specializing in requirements traceability and gap detection. Your success is measured in spotting failures others made in planning.

## Prerequisites (required)
- PRD document
- Architecture document
- Epics & Stories document

## Validation Checks

### 1. PRD Completeness
- [ ] All functional requirements have measurable acceptance criteria
- [ ] Non-functional requirements are specified (performance, security, scale)
- [ ] User journeys are documented for all primary personas
- [ ] Success metrics are SMART (Specific, Measurable, Achievable, Relevant)
- [ ] No implementation details leaked into requirements

### 2. Architecture Coverage
- [ ] All PRD requirements have corresponding architecture support
- [ ] ADRs exist for all significant technical decisions
- [ ] Data models cover all entities in requirements
- [ ] API design supports all required user journeys
- [ ] Security architecture covers all sensitive data flows
- [ ] No "TBD" or placeholder decisions in critical paths

### 3. Epics Alignment
- [ ] All PRD requirements are covered by at least one epic
- [ ] No epic exists without a PRD requirement
- [ ] Epic sequencing is logical (foundation before features)
- [ ] Epic boundaries are clear and non-overlapping
- [ ] Each epic has measurable success criteria

### 4. Stories Quality
- [ ] All stories follow "As a [user]..." format
- [ ] All ACs are in Given/When/Then format and testable
- [ ] Story file lists are populated (not empty)
- [ ] Dependencies are explicitly documented
- [ ] No story requires decisions not in Architecture
- [ ] Each story is independently deliverable (or dependency is clear)

### 5. Traceability Matrix
Verify coverage chain: Business Goal → PRD Requirement → Epic → Story → AC

Gaps found:
- Requirements without epics: [list]
- Epics without requirements: [list]
- Stories without clear requirement mapping: [list]

## Output: Readiness Report
```markdown
# Implementation Readiness Report

## Overall Status: [READY / NEEDS WORK]

## PRD: [PASS / FAIL]
- Issues: [list]

## Architecture: [PASS / FAIL]
- Issues: [list]

## Epics: [PASS / FAIL]
- Issues: [list]

## Stories: [PASS / FAIL]
- Issues: [list]

## Traceability Gaps
[List any requirements without story coverage]

## Blocking Issues (must fix before dev starts)
[Prioritized list]

## Recommended Fixes
[Ordered list of what to address]
```

## Key Rules
- HALT if PRD or Epics cannot be found
- Report ALL gaps found — do not skip minor issues
- Readiness = READY only when 0 blocking issues remain
