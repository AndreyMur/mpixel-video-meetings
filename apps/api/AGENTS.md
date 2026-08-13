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

- Entry point: `src/main.ts` — listens on `process.env.PORT ?? 4000`, global `ValidationPipe`, global `PayloadTooLargeFilter`
- Root module: `src/app.module.ts` (imports `ConfigModule`, `PrismaModule`, `StorageModule`, `UsersModule`, `AuthModule`, `MeetingsModule`, `FilesModule`; provides `AppController`, `AppService`)
- `src/prisma/` — global `PrismaModule`/`PrismaService`
- `src/storage/` — global `StorageModule`/`StorageService` (S3 via `@aws-sdk/client-s3`, MinIO, `forcePathStyle: true`; ensures bucket on init; `putObject`/`getObject`/`deleteObject`)
- `src/users/` — `UsersModule` owning all user persistence via CQRS: `CreateUserCommand`/handler (email uniqueness check, bcrypt hashing, create) and `FindUserByEmailQuery`/handler; exports `CqrsModule` so other modules can dispatch via `CommandBus`/`QueryBus`
- `src/auth/` — `AuthModule` with `POST /auth/register` (201 + `{ accessToken }`) and `POST /auth/login` (200 + `{ accessToken }`); responsible for token generation and credential checks; registers `RegisterUserCommand`/handler and `LoginUserQuery`/handler which orchestrate the `UsersModule` through CQRS (`CreateUserCommand`, `FindUserByEmailQuery`) and sign tokens via shared `TokenService`; exports `JwtAuthGuard` + `JwtModule`; exposes `@CurrentUser` param decorator (`CurrentUserPayload { sub, email }`)
- `src/meetings/` — `MeetingsModule` with `POST /meetings`, `GET /meetings`, `GET /meetings/:id`; all protected by `JwtAuthGuard`; uses CQRS (`CreateMeetingCommand`, `GetMeetingsQuery`, `GetMeetingQuery`), `CreateMeetingDto` (`title`, `date`, `participants`), Prisma `Meeting` model scoped to the current user
- `src/files/` — `FilesModule` with `POST /meetings/:meetingId/files` (multipart upload), `GET /meetings/:meetingId/files` (list without `objectKey`), `GET /meetings/:meetingId/files/:fileId/download` (streaming), `DELETE /meetings/:meetingId/files/:fileId`; all protected by `JwtAuthGuard`; uses CQRS (`UploadFileCommand`, `GetMeetingFilesQuery`, `GetMeetingFileQuery`, `DeleteFileCommand`); multer via `FileUploadInterceptor` (diskStorage in OS tmp, 50 МБ limit, extension whitelist `pdf,txt,doc,docx,xls,xlsx,ppt,pptx,mp3,wav,m4a,mp4,webm`), magic-byte family verification in `file-detector.ts`, object keys `meetings/{meetingId}/{fileId}/...`; upload responses use `MeetingFileResponse` (no `objectKey`); oversize → 413 with Russian message via `PayloadTooLargeFilter`
- Follow NestJS conventions: modules, controllers, services/providers, controllers with dependencies injected via constructors and `@nestjs/common` decorators.

## Conventions

- TypeScript is strict — `strictNullChecks`, `noImplicitAny`, `isolatedModules` are on.
- Copy `apps/api/.env.example` to `apps/api/.env` for local config (`PORT=4000`).
- `.env` holds `DATABASE_URL` (Postgres from docker-compose, port 5433), `JWT_SECRET`/`JWT_EXPIRES_IN`, and S3 access vars (`S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`, `MAX_FILE_SIZE_BYTES`).
- Run `docker compose up -d db minio` to start the local database and object storage before migrations/e2e tests.
- Do not add code comments unless asked.
- Verify with `npm run lint` (and `npm test` for changed code) before finishing.
- Keep this file up to date: when architecture changes (new modules/controllers/services, new scripts, config changes), update the relevant sections in the same change.
