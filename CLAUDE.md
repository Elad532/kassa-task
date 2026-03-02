# CLAUDE.md

## Rules
- Every code change must be reflected in CHANGELOG.md.
- If a new dependency is added, update README.md immediately.
- If a logic flow changes, update TECH_SPEC.md before writing the code.
- Use LaTeX for any mathematical logic or complex algorithms.

## Stack
- Monorepo: pnpm + Turborepo
- Backend: NestJS in `apps/api` (port 3001)
- Frontend: Next.js in `apps/web` (port 3000)
- Shared types: `packages/common`
- Test runner: Jest (`pnpm test`)
- Build: `pnpm build`
- Dev: `pnpm dev`

## Development Methodology: Domain-First TDD

When implementing a new feature, follow this sequence. STOP at marked phases for review.

### Phase 1: Domain Modeling — STOP for review
1. Read `@docs/PRD.md` and `@docs/TECH_SPEC.md` for the relevant feature
2. Define domain types/interfaces (the data shapes)
3. Define the public API surface (function signatures, endpoint contracts)
4. No business logic yet
5. Commit: `(package)/(domain)->feat: define [feature] types and contracts`

### Phase 2: Skeleton
1. Stub implementations that satisfy the type system
2. Endpoints/routes returning placeholder responses
3. Wire up dependency injection and module structure
4. Everything compiles but returns dummy data
5. Commit: `(package)/(scope)->feat: scaffold [feature] endpoints and services`

### Phase 3: Contract Tests — STOP for review
1. Write integration tests against the public API contracts
2. Tests define WHAT the system does, not HOW
3. Tests must fail (stubs return wrong data)
4. Cover edge cases and error conditions
5. Commit: `(package)/(scope)->test: add [feature] contract tests`

### Phase 4: Implement
1. Implement business logic one test at a time
2. Run tests after each step
3. Add nothing beyond what tests require
4. Commit each logical unit when its tests pass

### Phase 5: Refactor
1. Clean up for clarity — no behavior changes
2. Add unit tests for internal logic if needed
3. Run full suite to confirm green
4. Commit: `(package)/(scope)->refactor: clean up [feature] implementation`

### Rules
- Types and interfaces always before implementation
- Public API signatures are the source of truth
- Tests verify contracts, not implementation details
- Never write implementation before a failing test
- Run tests after every change

## Git Commit Rules
- Every commit must be atomic: one logical change per commit
- Each commit must leave the codebase in a compilable, passing-tests state
- Commit message format: `(package)/(scope)->type: description`
  - Package: the name of the package (in apps or in packages)
  - Scope: the module or feature area affected
  - Types: feat, fix, refactor, test, docs, chore, style
  - Description: imperative mood, lowercase, no period
- Never bundle unrelated changes in a single commit
- If a feature requires multiple steps, commit each step separately
- Run tests before each commit to ensure nothing is broken

## Coding Conventions

### Backend (NestJS)
- Every data object sent to or received from an HTTP request **must** be a NestJS DTO
  - Use `class-validator` decorators for validation
  - Use `class-transformer` for serialization
  - Place DTOs in `dto/` alongside their module (e.g., `users/dto/create-user.dto.ts`)
  - Never use plain interfaces or raw objects as request/response types

### LangChain / LangGraph
- All LangChain and LangGraph data structures **must** be defined with Zod schemas
  - Use `z.object()` for structured outputs and tool inputs
  - Use `zodToJsonSchema` when passing schemas to LLM tool definitions
  - Co-locate Zod schemas with the chain/agent that uses them

## Project Specs
- PRD: `@docs/PRD.md` — check requirements against this before implementing any feature
- Tech Spec: `@docs/TECH_SPEC.md` — follow architecture decisions documented here
- When implementing any feature, read the relevant sections of both docs first

## Library Documentation
- Always use Context7 (`use context7`) before planning or implementing code that involves external libraries
- This ensures current APIs, not outdated training data — especially critical for LangChain, LangGraph, BullMQ, Mongoose

## Plan Mode
- Use `/plan` or enter plan mode before changes touching 3+ files or introducing new patterns
- Skip plan mode for: single-file fixes, renaming, following established patterns, running commands
- When unsure about scope, ask before coding
- For complex reasoning, add "think hard" to the prompt

## CLAUDE.md Management
- Root `CLAUDE.md`: project-wide rules, stack, git conventions, methodology
- Sub-`CLAUDE.md` files: module-specific patterns (e.g., `apps/api/CLAUDE.md`, `apps/web/CLAUDE.md`)
- Proactively suggest creating a sub-`CLAUDE.md` when:
  - Root CLAUDE.md exceeds ~150 lines
  - A module has 3+ conventions unique to it
  - A package has its own testing patterns or architecture
- Show me the proposed content for review before creating any sub-`CLAUDE.md`

## Documentation Standards
- CHANGELOG.md: Keep a Changelog format — structure is `[Unreleased]` → commit → feature → change type
  - Each commit gets its own `### (package)/(scope)->type: description` sub-section under `[Unreleased]`
  - Immediately under the commit header, add a `> **Prompt:** ...` / `> **Intent:** ...` blockquote describing the user request or goal that produced this commit
  - Under each commit, group by `#### Feature Name`, then `##### Added`, `##### Changed`, etc.
  - Omit `Fixed`, `Removed`, `Deprecated`, `Security` headings when empty
  - Every entry must be human-readable: describe the *why*, not just the file name
  - Update `[Unreleased]` with every commit; rename to `[version] - date` on release
- README.md: Update when setup steps change, new dependencies are added, or public interfaces change
- Architecture diagrams: Mermaid diagrams in `docs/architecture/{feature}.md` for new features
  - Sequence diagram for API flows, flowchart for business logic, class/ER for data models

## Slash Commands
- `/red` — write a failing test (no implementation)
- `/green` — write minimal implementation to pass tests
- `/refactor` — clean up passing code without changing behavior
- `/cycle` — full TDD cycle with pauses for review
- `/implement-feature <name>` — spec-first feature implementation
- `/update-docs` — sync CHANGELOG.md and README.md with recent changes
- `/diagram <feature>` — generate Mermaid architecture diagrams
- `/busycommit` — split unstaged changes into atomic commits
