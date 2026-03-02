# packages/common

## Purpose

This package is the **Zod source of truth** for all shared entity shapes.
Anything exported from here can be used by both `apps/api` and `apps/web`.

## Rules

- **No NestJS-specific imports** — must compile without `@nestjs/*` dependencies
- **No Mongoose imports** — database concerns belong in `apps/api`
- **No business logic** — only types, Zod schemas, and constants

## Pattern per entity

Each entity exports three things:

```typescript
// 1. Entity shape (used to derive Mongoose schema and TypeScript type)
export const productZodSchema = z.object({ ... });

// 2. TypeScript type (auto-derived — never declare manually)
export type Product = z.infer<typeof productZodSchema>;

// 3. Query schemas (aligned with actual DB indexes)
export const productFilterSchema = z.object({ ... });  // compound index
export const productSearchSchema = z.object({ ... });  // text index
```

## After any change here

Always rebuild before testing or running `apps/api`:

```bash
pnpm --filter @kassa-task/common build
```
