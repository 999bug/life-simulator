# Repository Guidelines

## Project Structure

- `src/engine/` - pure game-state functions for events, stats, endings, achievements, and systems.
- `src/components/` - React UI screens and modals.
- `src/hooks/` - `useGame` and gameplay orchestration.
- `src/utils/` - sound, analytics, biography, almanac, and naming helpers.
- `src/types/` - shared TypeScript types.
- `src/test/` - Vitest UI and component tests.
- `script/` - data conversion, balancing, statistics, engine tests, and `script/fragments/` event content.
- `public/` - runtime assets, including generated `events.json`.
- `dist/` - build output.
- `CLAUDE.md` - detailed architecture and data-format notes.

## Build, Test, and Development Commands

- `npm install` - install dependencies.
- `npm run dev` - start the Vite development server on port 5173.
- `npm run build` - run `tsc` and create the production build.
- `npm run build:events` - regenerate `public/events.json` after changing `script/chiled.json` or fragments.
- `npm test` - run data-tool and engine tests.
- `npm run test:ui` - run Vitest UI/component tests.
- `npm run preview` - serve the production build locally.
- `node --experimental-strip-types script/sim-balance.ts 500` - run a 500-game balance audit.

Run `npm test`, `npm run test:ui`, and `npm run build` before completing a change. CI runs the same checks before deployment.

## Coding Style and Naming

TypeScript strict mode is enabled, including `noUnusedLocals` and `noUnusedParameters`. Keep style consistent with nearby files. Use PascalCase for React components, camelCase for functions and variables, and kebab-case filenames. Engine modules describe one domain (`events.ts`, `family.ts`, `achievements.ts`).

Do not hand-edit generated `public/events.json`. Event source uses two-digit IDs for original mainline events and four-digit IDs for simulated events; regenerate through `npm run build:events`.

## Testing Guidelines

- Keep engine and data-tool tests in `script/` using Node's `node:test`.
- Keep component tests in `src/test/` using Vitest and Testing Library.
- Name tests for observable behavior and keep data transformations deterministic and fail-fast where invalid IDs or attributes are present.

## Commit and Pull Request Guidelines

Use a Chinese subject prefixed with `[NF]`, `[BF]`, `[CU]`, or `[IM]`, followed by a `- ` bullet body when detail is needed. Do not add an AI-signature footer.

For pull requests, keep the change scoped, explain gameplay or data impact, update `README.md` or `CLAUDE.md` when behavior changes, and include screenshots for visible UI changes when practical.
