# Plan: Shared video conference for invited meeting participants (core)

**PRD:** docs/prd-invited-participants-video-conference-core.md
**Дата:** 2026-08-20

## Фазы реализации

### Фаза 1: Инфраструктура — LiveKit-сервис в docker-compose (Tracer Bullet)

**Цель:** LiveKit-сервер поднимается локально и доступен из API; конфигурация (`LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`) читается из окружения. Это минимальный рабочий путь всей фичи — без сервера токены выдавать некуда.
**Затрагивает:** backend (инфраструктура)
**Задачи:**

- [ ] Добавить сервис `livekit` (образ `livekit/livekit-server`, одиночный узел) в `docker-compose.yml` с проброшенными портами 7880/7881 для разработки
- [ ] Добавить переменные `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` в `apps/api/.env.example` и `apps/web/.env.example`
- [ ] Создать в API провайдер конфигурации LiveKit, читающий `LIVEKIT_*` из окружения (с дефолтами для разработки)
- [ ] Написать unit-тесты конфигурации: значения из env, дефолты при отсутствии переменных

**Когда готова:** `docker compose up -d livekit` поднимает LiveKit (порт 7880 отвечает), и приложение API читает конфигурацию LiveKit из окружения без ошибок.

### Фаза 2: Backend — эндпоинт выдачи токена конференции

**Цель:** Пользователь с доступом к встрече получает валидный LiveKit-токен для комнаты с именем, равным `meetingId`; посторонний получает отказ и не получает токен.
**Затрагивает:** backend
**Задачи:**

- [ ] Добавить зависимость `@livekit/server-sdk` в `apps/api` и зарегистрировать LiveKit-провайдер в модуле
- [ ] Создать `LiveKitService`: генерация AccessToken c коротким TTL, identity = `userId`, metadata (name, email) и room = `meetingId`
- [ ] Добавить эндпоинт `POST /meetings/:id/conference/token` под `JwtAuthGuard`, переиспользующий существующую проверку доступа (creator OR `MeetingAccess`, как в `GetMeetingHandler`); при отсутствии доступа — 403/404 и токен не выдаётся
- [ ] Написать интеграционные/unit-тесты: валидный токен для creator-а и пользователя с `MeetingAccess`, отказ постороннему (403/404), имя комнаты в токене = `meetingId`, короткий TTL

**Когда готова:** `POST /meetings/:id/conference/token` возвращает валидный LiveKit-токен создателю и приглашённым (с `MeetingAccess`) и отклоняет запросы посторонних; токен подключается к комнате с именем `meetingId`. Линт и формат чистые.
