Implement feature: $ARGUMENTS

Follow the Domain-First TDD methodology from CLAUDE.md strictly.

---

### Phase 1: Domain Modeling — STOP after this phase
1. Read @docs/PRD.md — find the section for this feature
2. Read @docs/TECH_SPEC.md — find the technical approach
3. Define domain types/interfaces (no implementation)
4. Define the public API surface (function signatures, endpoint contracts)
5. Present the domain model and contracts for review
6. Wait for explicit approval before proceeding

---

### Phase 2: Skeleton — proceed after Phase 1 approval
1. Stub implementations satisfying the type system
2. Endpoints/routes returning placeholder responses
3. Wire up DI and module structure
4. Verify everything compiles
5. Commit: `(package)/(scope)->feat: scaffold [feature] endpoints and services`

---

### Phase 3: Contract Tests — STOP after this phase
1. Use the test-writer agent to write failing integration tests
2. Tests must verify contracts, not internals
3. Run tests — confirm they fail for the right reasons
4. Show failing output and wait for approval before proceeding

---

### Phase 4: Implement — proceed after Phase 3 approval
1. Implement business logic one test at a time
2. Run tests after each logical unit
3. Add nothing beyond what tests require
4. Commit each passing unit separately

---

### Phase 5: Refactor
1. Clean up for clarity — no behavior changes
2. Run full suite to confirm green
3. Commit: `(package)/(scope)->refactor: clean up [feature] implementation`
4. Run /update-docs to sync CHANGELOG.md and README.md
