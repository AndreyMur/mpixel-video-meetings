# AGENTS.md — @mpixel/api

NestJS backend for the MPixel video meetings monorepo.

## Stack

- NestJS 11 (@nestjs/common, @nestjs/core, @nestjs/platform-express)
- CQRS via `@nestjs/cqrs` (commands/queries + handlers, `CommandBus`/`QueryBus`)
- TypeScript 5 (`module`/`moduleResolution: nodenext`, ESM-style)
- Prisma as ORM (schema in `prisma/schema.prisma`, Postgres via docker-compose)
- Jest via ts-jest for unit (`*.spec.ts`) and e2e (`test/`) tests
- ESLint 9 flat config (`eslint.config.mjs`) + Prettier

## Commands

Run from this directory or via workspace from the repo root (`npm run <script> -w @mpixel/api`):

- `npm run dev` / `npm run start:dev` — watch mode via Nest CLI
- `npm run build` — `nest build` to `dist/`
- `npm run start:prod` — `node dist/main`
- `npm run lint` — ESLint with `--fix` over `{src,apps,libs,test}/**/*.ts`
- `npm test` — unit tests
- `npm run test:e2e` — e2e tests (config in `test/jest-e2e.json`)
- `npm run test:cov` — coverage report
- `npx prisma migrate dev` — apply schema changes to local DB (from `apps/api`)

## Structure

- Entry point: `src/main.ts` — listens on `process.env.PORT ?? 4000`, global `ValidationPipe`
- Root module: `src/app.module.ts` (imports `ConfigModule`, `PrismaModule`, `AuthModule`; provides `AppController`, `AppService`)
- `src/prisma/` — global `PrismaModule`/`PrismaService`
- `src/auth/` — `AuthModule` with `POST /auth/register` (201 + `{ accessToken }`) and `POST /auth/login` (200 + `{ accessToken }`); uses CQRS (`RegisterUserCommand`/handler, `LoginUserQuery`/handler), shared `TokenService`; exports `JwtAuthGuard` + `JwtModule`; exposes `@CurrentUser` param decorator (`CurrentUserPayload { sub, email }`)
- `src/meetings/` — `MeetingsModule` with `POST /meetings`, `GET /meetings`, `GET /meetings/:id`; all protected by `JwtAuthGuard`; uses CQRS (`CreateMeetingCommand`, `GetMeetingsQuery`, `GetMeetingQuery`), `CreateMeetingDto` (`title`, `date`, `participants`), Prisma `Meeting` model scoped to the current user
- Follow NestJS conventions: modules, controllers, services/providers, controllers with dependencies injected via constructors and `@nestjs/common` decorators.

## Conventions

- TypeScript is strict — `strictNullChecks`, `noImplicitAny`, `isolatedModules` are on.
- Copy `apps/api/.env.example` to `apps/api/.env` for local config (`PORT=4000`).
- `.env` holds `DATABASE_URL` (Postgres from docker-compose, port 5433) and `JWT_SECRET`/`JWT_EXPIRES_IN`.
- Run `docker compose up -d db` to start the local database before migrations/e2e tests.
- Do not add code comments unless asked.
- Verify with `npm run lint` (and `npm test` for changed code) before finishing.
- Keep this file up to date: when architecture changes (new modules/controllers/services, new scripts, config changes), update the relevant sections in the same change.
