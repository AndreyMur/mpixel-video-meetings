# AGENTS.md

## Project

MPixel video meetings — a monorepo with two npm workspaces:

- `apps/api` — `@mpixel/api`, NestJS (Node.js) backend
- `apps/web` — `@mpixel/web`, Next.js frontend

## Workspace structure

```
apps/
  api/    NestJS backend (TypeScript, Express)
  web/    Next.js frontend (React, TypeScript)
packages/
.agents/  project-local agent skills
```

Root package.json defines `workspaces: ["apps/*"]`.

## Commands (run from repo root)

- `npm install` — install all workspace dependencies
- `npm run dev` — run api + web concurrently
- `npm run build` — build all workspaces
- `npm run lint` — lint all workspaces
- `npm run format` / `npm run format:check` — Prettier over the whole repo
- `npm test -w @mpixel/web` — unit tests (vitest + Testing Library) for the web app

App-specific scripts are run with `npm run <script> -w @mpixel/api` or `-w @mpixel/web` (e.g. `npm run dev -w @mpixel/api`).

## Conventions

- TypeScript strict; ESM-style `module: nodenext` in the API, isolatedModules enabled.
- Prettier config at `.prettierrc`; root `npm run format` formats everything.
- Do not add code comments unless asked.
- Keep lint and format clean before finishing a task.
- Node.js >= 20 required (see `engines` in package.json).
- After each completed piece of work, write a report of the results to the user (what was done, what was verified, what remains). Reports are written in Russian.

When editing files inside `apps/web`, follow the rules in `apps/web/AGENTS.md` (generated and maintained by `next dev`).

## Documentation maintenance

- Keep this file and the per-app `AGENTS.md` files up to date: when the project architecture changes (new apps/packages/workspaces, new commands/scripts, changed conventions, renamed/removed modules), update the relevant documentation in the same change.
- When adding a new workspace, describe it in the "Workspace structure" section and add it to the `workspaces` list if applicable.

## File upload

Use this research for it: @docs/research-meeting-upload.md
