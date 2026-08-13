# Research: Загрузка файла встречи, хранение и обработка

**Дата:** 13 августа 2026
**Основа:** [План фаз](plan-docs/prd-meeting-file-upload-storage-and-processing.md.md) и [PRD](prd-meeting-file-upload-storage-and-processing.md)
**Стек проекта:** NestJS 11 (API, CQRS, Prisma/Postgres) + Next.js 16 (App Router, web) + docker-compose; Node >= 20.

Исследование технических решений по трём фазам: (1) загрузка/хранение в S3, (2) фоновая обработка, (3) страница деталей встречи.

---

## 1. Объектное хранилище и клиент S3

### 1.1 Выбор клиента

| Критерий                                        | `@aws-sdk/client-s3` (v3.1109)                    | `minio` (v8.0.7)        |
| ----------------------------------------------- | ------------------------------------------------- | ----------------------- |
| Поддержка и обновления                          | AWS официально, очень активная                    | Обслуживается реже      |
| Presigned URL                                   | `getSignedUrl` из `@aws-sdk/s3-request-presigner` | `presignedGetObject`    |
| Streaming upload/download                       | `PutObjectCommand`/`GetObjectCommand` с потоками  | `putObject`/`getObject` |
| Путь-style адресация (нужна MinIO)              | `forcePathStyle: true`                            | Встроено                |
| Переносимость (AWS S3 / Yandex / Cloudflare R2) | Да, любое S3-совместимое хранилище                | Только MinIO/S3         |

**Решение: `@aws-sdk/client-s3`.** Это стандарт индустрии, даёт ту же интеграцию при будущем переходе с MinIO на облачный S3 и используется большинством примеров NestJS. Конфигурация для MinIO:

```ts
new S3Client({
  endpoint: process.env.S3_ENDPOINT, // http://localhost:9000
  region: process.env.S3_REGION ?? 'us-east-1',
  credentials: { accessKeyId, secretAccessKey },
  forcePathStyle: true, // обязательно для MinIO
});
```

### 1.2 Docker-compose: контейнер MinIO

- Образ `minio/minio`, порт API `9000`, консоль `9001`.
- Healthcheck: `curl -f http://localhost:9000/minio/health/live`.
- Bucket создавать при старте API (на `OnModuleInit` провайдера хранилища: `HeadBucket` -> `CreateBucket`), либо `mc` в отдельном сервисе `minio-init`.
- CORS **не нужен**: браузер не ходит в MinIO напрямую (см. раздел 4 — скачивание через API), загрузка идёт через API.
- Для разработки `MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD` (они же `S3_ACCESS_KEY`/`S3_SECRET_KEY`).

### 1.3 Ключи объектов (objectKey)

Схема: `meetings/{meetingId}/{fileId}/{uuid}-{sanitized-name}.{ext}`.

- `fileId` (UUID записи) известен до загрузки в S3 — генерируем запись БД и ключ до вызова S3, что упрощает компенсацию при сбое.
- Имя файла в ключе не показываем пользователю напрямую — для этого есть поле `name` в БД; ключ остаётся детерминированным и не содержит кириллицу/пробелы.
- Префикс `meetings/{meetingId}/` позволяет перечислить/очистить объекты встречи одним `ListObjectsV2`.

---

## 2. Загрузка файла (Phase 1)

### 2.1 Multer: конфигурация и валидация

`@nestjs/platform-express` (уже в зависимостях, тянет **multer 2.2.0**) даёт `FileInterceptor('file', options)`. Ключевые настройки:

- `limits: { fileSize: 50 * 1024 * 1024 }` — лимит 50 МБ на уровне multer; превышение отдаёт 413 (`PayloadTooLargeException`).
- `fileFilter` — whitelist расширений/типов: `pdf, txt, doc, docx, xls, xlsx, ppt, pptx, mp3, wav, m4a, mp4, webm`. Расширение из `originalname` + проверка магических байт через `file-type` (v22, ESM — ок при `module: nodenext`). MIME из браузера **не доверять**.
- Ошибки формата/размера превращать в понятное сообщение (перехват `MulterError` в global exception filter → 400/413 с текстом на русском).

**Стратегия хранения multer:**

| Стратегия                | Плюсы                                          | Минусы                                              |
| ------------------------ | ---------------------------------------------- | --------------------------------------------------- |
| `memoryStorage`          | Простота, нет temp-файлов                      | Буфер до 50 МБ в RAM на каждый одновременный запрос |
| `diskStorage` (temp dir) | Почти нет нагрузки на RAM, можно стримить в S3 | Нужна очистка temp-файла, чуть больше кода          |

**Решение: `diskStorage`** в `os.tmpdir()` (папка `tmp/`), затем загрузка в S3 потоком (`PutObjectCommand` с `createReadStream`) и `fs.unlink` temp-файла в `finally`. Для низкой нагрузки допустим и `memoryStorage`, но diskStorage масштабируется без переделки.

### 2.2 Пайплайн загрузки (порядок операций)

1. `FileInterceptor` принимает файл (валидация лимитов/типов выше).
2. Проверка принадлежности встречи: `meeting.findFirst({ where: { id, userId } })` → нет → **404** (не отдаём информации о существовании; единый код с `GetMeetingHandler`). Для явного «чужая встреча» можно 403 после отдельной проверки — но для простоты и отсутствия утечек рекомендуется 404 в обоих случаях.
3. Создание записи `MeetingFile` со статусом `PROCESSING`, `objectKey` сгенерирован заранее.
4. Загрузка объекта в MinIO.
5. `POST` задачи в очередь (см. раздел 5).
6. Ответ: `201` + объект файла. Клиент сразу видит файл в списке со статусом «обработка».

Компенсация при сбое: если шаг 4 не удался — удалить запись БД (и temp-файл); если сбой после 5 — запись остаётся `FAILED` и задача повторится по ретраям BullMQ.

### 2.3 Prisma-схема `MeetingFile`

```prisma
enum FileStatus {
  UPLOADED
  PROCESSING
  READY
  FAILED
}

model MeetingFile {
  id                String     @id @default(uuid())
  name              String
  mimeType          String
  size              Int
  status            FileStatus @default(PROCESSING)
  objectKey         String     @unique
  metadata          Json?
  previewObjectKey  String?
  transcriptObjectKey String?
  errorMessage      String?
  meetingId         String
  meeting           Meeting    @relation(fields: [meetingId], references: [id], onDelete: Cascade)
  userId            String
  user              User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt         DateTime   @default(now())
  updatedAt         DateTime   @updatedAt

  @@index([meetingId])
  @@index([userId])
}
```

- `Meeting` получает обратную связь `files MeetingFile[]`, `User` — `files`.
- Размер в `Int` достаточен для лимита 50 МБ.
- `metadata Json?` — свободная структура (длительность, кодек, страницы и т.д.), согласуется с «извлечь доступные метаданные».
- Статус сразу `PROCESSING` (по плану файл появляется в списке «processing»); значение `UPLOADED` зарезервировано на случай отдельной фазы до постановки в очередь.

### 2.4 Эндпоинты (следуют конвенции CQRS проекта)

- `POST /meetings/:id/files` — multipart, `@UseGuards(JwtAuthGuard)`, ownership-проверка, `201`.
- `GET /meetings/:id/files` — список файлов встречи (владелец): `id, name, mimeType, size, status, metadata, createdAt`. Без `objectKey` наружу.
- `GET /meetings/:id/files/:fileId/download` — стриминг объекта (см. раздел 4).
- `DELETE /meetings/:id/files/:fileId` — владелец: `DeleteObjectCommand` из MinIO + удаление записи БД; «не найдено/чужой» → 404.

Новые команды/запросы: `UploadFileCommand`, `GetMeetingFilesQuery`, `DeleteFileCommand`; провайдеры в `FilesModule` (по аналогии с `MeetingsModule`). `CqrsModule` в `FilesModule`.

---

## 3. Очередь и воркер (Phase 2)

### 3.1 Выбор очереди

| Вариант                                       | Плюсы                                                                                                   | Минусы                                                    |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| **BullMQ 6 + `@nestjs/bullmq` 11**            | Persistence в Redis, ретраи/backoff, приоритеты, событийный API, возобновление после рестарта, прогресс | Нужен Redis (уже планируется)                             |
| `@nestjs/bull` (v4)                           | Устаревшая обвязка под BullMQ v1                                                                        | Не актуальна для BullMQ 6                                 |
| `pg-boss`                                     | Очередь в Postgres, нет Redis                                                                           | Меньше фич, нет ивентов/прогресса                         |
| Внутрипроцессный `p-queue`/`@nestjs/schedule` | Ноль зависимостей                                                                                       | Нет персистентности и ретраев — теряем задачи при падении |

**Решение: BullMQ 6 + официальный `@nestjs/bullmq` 11.** Redis-контейнер в docker-compose, `REDIS_URL` в env. BullMQ сам чинит «зависшие» задачи (stalled jobs) и даёт повторы с `attempts`/backoff — критично для длинной транскрипции.

### 3.2 Архитектура воркера: отдельный процесс

Тяжёлые операции (ffmpeg, LibreOffice, транскрипция) — CPU/IO-bound. Держать их в event-loop API-процесса неоптимально даже при запуске субапроцессов: конкурируют за CPU с обработкой запросов.

**Решение: отдельный воркер-процесс.** Второй entrypoint NestJS (`apps/api/src/worker/main.ts`), который бустрапит `WorkerModule` (общие `StorageService`, Prisma, конфиг) и регистрирует `@Processor('file-processing')`. В docker-compose добавляется сервис `api-worker` из того же образа (`npm run start:worker`), зависит от `redis` и `minio`.

```ts
// worker/main.ts
async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule);
  await app.init();
  // BullMQ Worker поднимается через OnApplicationBootstrap процессора
}
```

- Воркер: `WorkerHost`/`@Process` с `concurrency: 1–2` (транскрипция тяжёлая — не перегружать CPU), BullMQ сам распределяет задачи.
- Для фазы 2 (tracer bullet) допустим вариант «воркер в том же процессе API» (`onModuleInit` + `@Processor`), но раздельный процесс — правильная целевая архитектура, реализуется сразу без переделки.

### 3.3 Задачи и статусы

- `file-processing` — одна задача на файл, payload: `{ meetingFileId }`. Внутри поэтапно: метаданные → превью → транскрипция (для медиа).
- Статусы: `PROCESSING → READY` (успех) / `PROCESSING → FAILED` (сбой с `errorMessage`). Файл со статусом `FAILED` остаётся в списке (PRD).
- Отдельная задача не нужна: удаление файла должно отменять/игнорировать обработку — воркер перед каждым шагом перечитывает запись и прерывается, если запись удалена.

---

## 4. Скачивание файла

### 4.1 Варианты

| Вариант                                             | Плюсы                                                                                                                                                | Минусы                                                                                                                                  |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Стриминг через API** (`GetObjectCommand` → `res`) | Одна точка входа, JWT-проверка ownership, MinIO не наружу, работает за существующим прокси `/api/*`, кириллические имена через `Content-Disposition` | API гонит трафик через себя                                                                                                             |
| Presigned URL (MinIO `getSignedUrl`)                | S3 отдаёт напрямую, API не нагружен                                                                                                                  | Нужно публиковать порт MinIO 9000 клиентам и/или проксировать его; теряется JWT-контроль (URL — capability); сложнее с кириллицей имени |

**Решение: стриминг через API** с `Content-Type: <mime>` и `Content-Disposition: attachment; filename*=UTF-8''<encoded>`. Для self-hosted с объёмом файлов до 50 МБ это оптимально и полностью согласуется с планом («эндпоинт скачивания» + «прокси веб-приложения»). Presigned URL — опция будущей оптимизации.

Frontend не может положить `Authorization` в `<a href>` — скачивание идёт через `fetch(..., { headers: { Authorization } })` → `blob` → `URL.createObjectURL` → `a.download` (см. раздел 6).

---

## 5. Фоновая обработка: инструменты

### 5.1 Метаданные

| Тип файла                  | Инструмент                                  | Что извлекаем                                                                  |
| -------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------ |
| mp3/wav/m4a/mp4/webm       | **ffprobe** (CLI из ffmpeg)                 | Длительность, кодек, битрейт, sample rate, каналы; для видео — разрешение, fps |
| pdf                        | **pdf-lib** (JS, без нативных зависимостей) | Количество страниц                                                             |
| doc/docx/xls/xlsx/ppt/pptx | LibreOffice → PDF → `pdfinfo` (poppler)     | Количество страниц (переиспользуем конверсию из превью)                        |
| txt                        | —                                           | Размер/строки достаточно                                                       |

Рекомендация: ffprobe запускать субапроцессом (`ffprobe -v quiet -print_format json -show_format -show_streams`). В Docker использовать системные бинарники (`ffmpeg`, `poppler-utils`, `libreoffice` из apt/apk) вместо npm-обёрток с загрузкой бинарей.

### 5.2 Превью/миниатюры

| Тип                        | Инструмент                                                                    | Результат           |
| -------------------------- | ----------------------------------------------------------------------------- | ------------------- |
| видео (mp4/webm)           | **ffmpeg**: кадр на ~10% длительности (`-ss <t> -frames:v 1 -vf scale=w:ih`)  | PNG/JPEG            |
| аудио (mp3/wav/m4a)        | ffmpeg: встроенная обложка (`-an -c:v copy`) или волновая форма (`showwaves`) | PNG                 |
| pdf                        | **poppler-utils** `pdftoppm -f 1 -l 1 -r 72 -png`                             | PNG первой страницы |
| doc/docx/xls/xlsx/ppt/pptx | **LibreOffice headless** `soffice --headless --convert-to pdf` → `pdftoppm`   | PNG первой страницы |
| txt                        | Превью-изображение не генерируем (в UI — иконка/текст)                        | —                   |

- `previewObjectKey` пишем в S3 (префикс `previews/` рядом с объектом) и сохраняем ссылку в БД.
- Пути в Dockerfile API: установить `ffmpeg`, `poppler-utils`, `libreoffice-writer`/`-calc`/`-impress` (для конверсии офисных форматов) — тогда воркер-контейнер умеет всё. Для разработки на Windows — `@ffmpeg-installer/ffmpeg` + `ffprobe-static` как dev-утилиты.

### 5.3 Транскрипция аудио/видео

Self-hosted варианты (облачные API OpenAI/Google/Azure — вне духа «своей инфраструктуры», требуют ключи и плату):

| Вариант                              | Плюсы                                                                                                                         | Минусы                             |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| **whisper.cpp** (GGML-модели)        | Быстро на CPU, один бинарник, легко в Docker, `ggml-large-v3-turbo` — хорошее качество RU, опции `--output-txt/--output-json` | Модель надо скачать (~500 МБ–3 ГБ) |
| faster-whisper (Python, CTranslate2) | Максимальная скорость/точность, удобный сервер                                                                                | Нужен Python-рантайм в воркере     |
| Vosk                                 | Очень лёгкий, офлайн                                                                                                          | Качество заметно ниже Whisper      |

**Решение: whisper.cpp** субапроцессом из воркера. Пайплайн: ffmpeg → 16 кГц моно WAV → `whisper-cli -m ggml-large-v3-turbo.bin --output-txt --output-json`. Результат (`.txt`/`.json`) загружаем в S3 как `{key}.transcript.txt`, `transcriptObjectKey` пишем в БД. Отображение транскрипта в UI — вне скоупа (PRD), но хранение и ссылка готовы. Язык — автодетект (RU поддержан). Модель хранить в volume воркера, чтобы не качать при каждом старте.

Альтернатива при желании меньшего труда на деплой: `nodejs-whisper` (npm, обёртка whisper.cpp) — но для прода лучше субапроцесс системного бинарника.

### 5.4 Порядок шагов в задаче

1. Прочитать запись `MeetingFile`, проверить актуальность (не удалена).
2. Метаданные (ffprobe/pdf-lib/… ) → `metadata`, запись в БД.
3. Превью (по типу) → S3 → `previewObjectKey`.
4. Транскрипция для mp3/wav/m4a/mp4/webm → S3 → `transcriptObjectKey`.
5. `status = READY`; при любой ошибке `status = FAILED` + `errorMessage` (проверять retry-политику: повторять шаги 2–4 с backoff, но не «съедать» failed-статус бесконечными ретраями — ограничить `attempts`).

---

## 6. Frontend (Phase 3)

### 6.1 Страница `/meetings/[id]`

- App Router, `'use client'`, клиентская проверка `getSessionUser()`/`getAccessToken()` (паттерн уже в `src/app/page.tsx`) → редирект на `/login`.
- Список файлов: `GET /api/meetings/:id/files` с `Authorization: Bearer <token>` через существующий rewrite `/api/:path*` (next.config.ts) → NestJS. Статус: бейдж processing/ready/failed (HeroUI Chip — уже используется).
- Прокси Next.js стримит тело запроса без дефолтных лимитов — multipart до 50 МБ через `/api/*` работает. Если в будущем упрётся в лимиты — заменить на Route Handler (`app/api/meetings/[id]/files/route.ts`), стримящий запрос на бэкенд, но на 50 МБ не требуется.

### 6.2 Форма загрузки

- `fetch('/api/meetings/:id/files', { method: 'POST', headers: { Authorization }, body: formData })` — `Content-Type` задавать **не нужно** (multipart/form-data с границей поставит браузер).
- Клиентская валидация, зеркалящая бэкенд: размер ≤ 50 МБ (`file.size`), расширение из whitelist — до отправки; дублирование правил бэкенда, но не вместо него.
- Прогресс загрузки: `fetch` не поддерживает upload progress — при необходимости `XMLHttpRequest` с `xhr.upload.onprogress`.

### 6.3 Скачивание и удаление

- Скачивание: `fetch` → `blob` → `a.download = file.name` (обязательно, т.к. JWT нельзя отправить через `href`).
- Удаление: `DELETE /api/meetings/:id/files/:fileId` с `Authorization`; после успеха убрать из списка (обновить локальный стейт или перезапросить список).
- Обработка ошибок: `ApiError` (уже в `src/lib/auth.ts`): 401 → logout+redirect, 403/404 → сообщение «встреча не найдена/нет доступа», 413/400 → сообщение о лимите/формате из тела ответа.
- Новые функции в `src/lib/auth.ts` (или отдельном `src/lib/files.ts`): `getMeetingFiles`, `uploadMeetingFile`, `downloadMeetingFile`, `deleteMeetingFile` + типы `MeetingFile`, `FileStatus`.

---

## 7. Инфраструктура и конфигурация

### 7.1 docker-compose (итог)

Сервисы: `db` (есть), `minio` (API 9000, консоль 9001, healthcheck, volume `minio-data`), `redis` (7.x/8.x, volume `redis-data`), `api` (backend, `depends_on` minio/redis/db, переменные ниже), `api-worker` (тот же образ, entrypoint воркера). Bucket — автосоздание при старте API.

### 7.2 Новые переменные окружения (`apps/api/.env.example`)

```
S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=mpixel
REDIS_URL=redis://localhost:6379
WORKER_CONCURRENCY=1
MAX_FILE_SIZE_BYTES=52428800
```

### 7.3 Новые зависимости

- API: `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` (на будущее), `@nestjs/bullmq`, `bullmq`, `file-type`, `pdf-lib`, `@types/multer` (dev). `multer` уже идёт с `@nestjs/platform-express`.
- Воркер: `ffprobe`/ffmpeg, poppler-utils, LibreOffice (системные пакеты образа).
- Транскрипция: бинарник whisper.cpp + модель в volume.

---

## 8. Безопасность

- Все эндпоинты — `JwtAuthGuard`; каждое действие проверяет принадлежность встречи/файла текущему пользователю (`findFirst({ where: { id, userId } })`).
- Валидация размера/формата на сервере (multer limits + whitelist + магические байты) — UI-валидация не заменяет её.
- `objectKey` не раскрывается в ответах API наружу; имена файлов наружу — только из БД.
- Доверять MIME из клиента нельзя; `file-type` по содержанию.
- Temp-файлы multer всегда удаляются (try/finally), чтобы не засорять диск.
- Не логировать содержимое файлов и ключи доступа к S3.

---

## 9. Итоговые решения по фазам

| Вопрос         | Решение                                                                                               |
| -------------- | ----------------------------------------------------------------------------------------------------- |
| S3-клиент      | `@aws-sdk/client-s3`, `forcePathStyle` для MinIO                                                      |
| Загрузка       | Multer `diskStorage` (temp) → стрим в S3; `limits.fileSize = 50МБ`; whitelist + `file-type`           |
| Ключи объектов | `meetings/{meetingId}/{fileId}/{uuid}-{name}`                                                         |
| Статусы        | `PROCESSING → READY                                                                                   | FAILED`, файл с `FAILED` остаётся в списке |
| Очередь        | BullMQ 6 + `@nestjs/bullmq` 11 на Redis                                                               |
| Воркер         | Отдельный процесс (`worker/main.ts`) + сервис `api-worker` в compose, concurrency 1–2                 |
| Метаданные     | ffprobe (медиа), pdf-lib (pdf), LibreOffice+pdfinfo (office)                                          |
| Превью         | ffmpeg (медиа), pdftoppm (pdf), LibreOffice→pdftoppm (office)                                         |
| Транскрипция   | whisper.cpp субапроцессом, 16 кГц WAV через ffmpeg, результат в S3                                    |
| Скачивание     | Стриминг `GetObjectCommand` через API (`Content-Disposition` с `filename*=UTF-8''`)                   |
| Frontend       | `/meetings/[id]`, upload/delete/download через `/api/*` с Bearer-токеном, скачивание через fetch→blob |
| Отклонения     | 404 для несуществующей/чужой встречи; 400/413 с понятным текстом для формата/размера                  |

## 10. Открытые вопросы / на заметку

- Деплой моделей Whisper и бинарей (ffmpeg/LibreOffice/poppler) в образ воркера — размер образа вырастет; рассмотреть отдельный образ воркера.
- Presigned URL для скачивания — будущая оптимизация, если API станет узким местом по трафику.
- Прогресс транскрипции/обработки в UI (сколько готово) — не в скоупе, но BullMQ progress оставляет возможность.
- Лимит суммарного объёма на пользователя — вне скоупа PRD, но схема (`userId` на `MeetingFile`) уже позволяет ввести его позже.
