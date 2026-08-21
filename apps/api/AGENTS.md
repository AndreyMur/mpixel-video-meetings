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
- `npm run start:worker` — watch mode for the file-processing worker (`tsconfig.worker.json`, entry `worker/main`)
- `npm run build:worker` / `npm run start:worker:prod` — build (`dist-worker/`) and run the worker outside Nest CLI
- `npm run lint` — ESLint with `--fix` over `{src,apps,libs,test}/**/*.ts`
- `npm test` — unit tests
- `npm run test:e2e` — e2e tests (config in `test/jest-e2e.json`)
- `npm run test:cov` — coverage report
- `npx prisma migrate dev` — apply schema changes to local DB (from `apps/api`)

## Structure

- Entry point: `src/main.ts` — listens on `process.env.PORT ?? 4000`, global `ValidationPipe`, global `PayloadTooLargeFilter`
- Root module: `src/app.module.ts` (imports `ConfigModule`, `PrismaModule`, `StorageModule`, `UsersModule`, `AuthModule`, `MeetingsModule`, `ProcessingModule`, `FilesModule`, `ProfileModule`, `EmailModule`; provides `AppController`, `AppService`)
- `src/prisma/` — global `PrismaModule`/`PrismaService`
- `src/storage/` — global `StorageModule`/`StorageService` (S3 via `@aws-sdk/client-s3`, MinIO, `forcePathStyle: true`; ensures bucket on init; `putObject`/`getObject`/`downloadToFile`/`deleteObject`)
- `src/users/` — `UsersModule` owning all user persistence via CQRS: `CreateUserCommand`/handler (email uniqueness check, bcrypt hashing, create), `FindUserByEmailQuery`/handler and `FindUserByIdQuery`/handler; exports `CqrsModule` so other modules can dispatch via `CommandBus`/`QueryBus`
- `src/auth/` — `AuthModule` with `POST /auth/register` (201 + `{ accessToken }`) and `POST /auth/login` (200 + `{ accessToken }`); responsible for token generation and credential checks; registers `RegisterUserCommand`/handler and `LoginUserQuery`/handler which orchestrate the `UsersModule` through CQRS (`CreateUserCommand`, `FindUserByEmailQuery`) and sign tokens via shared `TokenService`; exports `JwtAuthGuard` + `JwtModule`; exposes `@CurrentUser` param decorator (`CurrentUserPayload { sub, email }`)
- `src/meetings/` — `MeetingsModule` with `POST /meetings`, `GET /meetings`, `GET /meetings/:id`, `POST /meetings/:id/conference/token` (returns `{ token }` — a short-lived LiveKit conference token; access via the same creator OR `MeetingAccess` check as `GET /meetings/:id`, otherwise 404 and no token), `PATCH /meetings/:id` (partial update of own meeting), `DELETE /meetings/:id` (own meeting only; 409 `Conflict` with a clear message when the meeting has files, nothing is deleted); all protected by `JwtAuthGuard`; uses CQRS (`CreateMeetingCommand`, `GetMeetingsQuery`, `GetMeetingQuery`, `CreateConferenceTokenCommand`, `UpdateMeetingCommand`, `DeleteMeetingCommand`), `CreateMeetingDto` (`title`, `description?`, `date`, `participants?` — participants default to `[]`, each validated as an email), `UpdateMeetingDto` (all of `title`/`description`/`date`/`participants` optional, emails validated), Prisma `Meeting` model scoped to the current user; sends email invitations via `MeetingInvitationService` (fans out to every participant through `EmailService` on create and on any actual update of title/description/date/participants, failures are logged and don't fail the request); `GET /meetings` returns meetings where the user is the creator OR has a `MeetingAccess` record; `GET /meetings/:id` returns the own meeting or a meeting the user has access to, and otherwise grants a `MeetingAccess` record to a non-creator whose email is in `participants` (creating it and returning the meeting) or answers 404; `MeetingAccess` links `meetingId` ↔ `userId` (`@@unique([meetingId, userId])`) and is created when an invited user first opens the meeting; access is write-once — removing the user's email from `participants` does not revoke an existing `MeetingAccess` row (known limitation, revocation is a later-phase concern)
- `src/files/` — `FilesModule` with `POST /meetings/:meetingId/files` (multipart upload), `GET /meetings/:meetingId/files` (list without `objectKey`), `GET /meetings/:meetingId/files/:fileId/download` (streaming), `DELETE /meetings/:meetingId/files/:fileId`; all protected by `JwtAuthGuard`; upload/list/download are available to the meeting creator and to invited users (those with a `MeetingAccess` record), file deletion is available to the meeting creator and to the file owner (uploader); uses CQRS (`UploadFileCommand`, `GetMeetingFilesQuery`, `GetMeetingFileQuery`, `DeleteFileCommand`); multer via `FileUploadInterceptor` (diskStorage in OS tmp, 50 МБ limit, extension whitelist `pdf,txt,doc,docx,xls,xlsx,ppt,pptx,mp3,wav,m4a,mp4,webm`), magic-byte family verification in `file-detector.ts`, object keys `meetings/{meetingId}/{fileId}/...`; upload responses use `MeetingFileResponse` (no `objectKey`); oversize → 413 with Russian message via `PayloadTooLargeFilter` (route-aware: avatar uploads use the 5 МБ avatar limit and message); enqueues the file into the `file-processing` queue after saving
- `src/profile/` — `ProfileModule` with `GET /users/me` (returns `email`, `name`, `avatarUrl`; `avatarUrl` = null when no avatar), `PATCH /users/me` (updates `name`, empty value clears it), `PATCH /users/me/password` (`{oldPassword, newPassword}`, old verified via bcrypt, 400 on mismatch), `POST /users/me/avatar` (multipart, png/jpg/jpeg/webp up to 5 МБ via `AvatarUploadInterceptor` + `avatar-upload.options.ts`, magic-byte check in `image-detector.ts`, stored as `avatars/{userId}/{uuid}.{ext}`, updates `avatarObjectKey`), `GET /users/me/avatar` (streams the object; 404 when no avatar), `DELETE /users/me/avatar` (deletes the object, clears `avatarObjectKey`); all protected by `JwtAuthGuard`; uses CQRS (`GetMyProfileQuery`, `UpdateProfileCommand`, `ChangePasswordCommand`, `UploadAvatarCommand`, `DeleteAvatarCommand`, `GetAvatarQuery`); `name`/`avatarObjectKey` live on the Prisma `User` model
- `src/processing/` — BullMQ queue setup (`ProcessingModule` with `BullModule` on `REDIS_URL`, queue `file-processing`), `ProcessingService.enqueue` (attempts/backoff from `WORKER_ATTEMPTS`/`WORKER_BACKOFF_MS`), and process tools in `process-tools/`: `MetadataService` (ffprobe for media duration/codecs, pdf-lib for PDF pages, nothing for other types), `PreviewService` (ffmpeg video frame via `ffmpeg-static`, PDF first page via `pdf-to-img`/pdfjs-dist, nothing for audio/office/txt), `ProcessToolsService` (resolves `FFMPEG_BIN`/`FFPROBE_BIN` or static binaries), `runCommand` (child process helper)
- `src/worker/` — separate worker entrypoint `main.ts` (Nest application context) + `WorkerModule` bootstrapping Prisma/Storage/Processing/ProcessTools and `FileProcessingProcessor` (`@Processor('file-processing')`, concurrency from `WORKER_CONCURRENCY`); on job: downloads the object to a temp dir, extracts metadata, generates preview, sets `READY` (or `FAILED` + `errorMessage`, rethrow for BullMQ retries); re-reads the record and skips if the file was deleted; cleaned temp dirs in `finally`
- `src/email/` — `EmailModule` with `EmailService.sendMeetingInvitation` (subject/body built in `invitation.template.ts`; body contains the meeting link built from `FRONTEND_URL`); SMTP transport from `mailTransportProvider` (`nodemailer`, no-op when `SMTP_HOST` unset) and sender from `mailFromProvider`, both via `ConfigService`
- `src/livekit/` — `LiveKitModule` providing the `LIVEKIT_CONFIG` injection token (`liveKitConfigProvider` in `livekit.options.ts`): `{ url, apiKey, apiSecret }` read from `LIVEKIT_URL`/`LIVEKIT_API_KEY`/`LIVEKIT_API_SECRET` via `ConfigService` with development defaults (`http://localhost:7880`, `devkey`/`devsecret` matching the docker-compose LiveKit dev keys); when `NODE_ENV=production`, missing variables or the development default credentials (`devkey`/`devsecret`) fail fast at startup; also provides `LiveKitService.createConferenceToken(meetingId, { userId, name, email })` — signs a LiveKit `AccessToken` (`livekit-server-sdk`) with identity = `userId`, metadata JSON `{ name, email }`, room = `meetingId`, join grant and TTL `CONFERENCE_TOKEN_TTL_SECONDS` (600 s, `livekit.constants.ts`); registered in `AppModule`, both exported (used by `MeetingsModule` for the conference-token endpoint)
- Follow NestJS conventions: modules, controllers, services/providers, controllers with dependencies injected via constructors and `@nestjs/common` decorators.

## Conventions

- TypeScript is strict — `strictNullChecks`, `noImplicitAny`, `isolatedModules` are on.
- Copy `apps/api/.env.example` to `apps/api/.env` for local config (`PORT=4000`, `FRONTEND_URL=http://localhost:3000`).
- `.env` holds `DATABASE_URL` (Postgres from docker-compose, port 5433), `JWT_SECRET`/`JWT_EXPIRES_IN`, S3 access vars (`S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`, `MAX_FILE_SIZE_BYTES`, `MAX_AVATAR_SIZE_BYTES`), worker vars (`REDIS_URL`, `WORKER_ATTEMPTS`, `WORKER_BACKOFF_MS`, `FFMPEG_BIN`, `FFPROBE_BIN`), SMTP vars (`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`; when `SMTP_HOST` is empty, invitations are silently skipped), and LiveKit vars (`LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`; defaults match the docker-compose dev keys).
- Run `docker compose up -d db minio redis mailhog livekit` to start the local database, object storage, Redis, the local mail catcher (Mailhog UI at `http://localhost:8025`, SMTP on `localhost:1025`), and the LiveKit server (signaling on `http://localhost:7880`); the worker runs as the `api-worker` service (`--profile worker`).
- Do not add code comments unless asked.
- Verify with `npm run lint` (and `npm test` for changed code) before finishing.
- Keep this file up to date: when architecture changes (new modules/controllers/services, new scripts, config changes), update the relevant sections in the same change.
