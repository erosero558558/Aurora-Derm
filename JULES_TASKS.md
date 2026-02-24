# JULES_TASKS.md — Backlog para Jules

> Este archivo es la fuente de verdad del backlog de Jules.
> **No editar manualmente** los campos `session:` y `dispatched:` — son actualizados por `jules-dispatch.js`.
>
> Para despachar: `JULES_API_KEY=xxx node jules-dispatch.js dispatch`
> Para monitorear: `JULES_API_KEY=xxx node jules-dispatch.js watch`

---

## Formato de tarea

```
<!-- TASK
status: pending | dispatched | done | failed
session: (session name filled by dispatcher)
dispatched: (ISO date filled by dispatcher)
-->
### Título de la tarea

Prompt completo aquí (puede ser multi-línea).
Todo el texto hasta la siguiente tarea es el prompt.

<!-- /TASK -->
```

---

## Tareas

<!-- TASK
status: done
session: Add Jest tests for analytics engine
dispatched: 2026-02-24
-->
### Add Jest tests for analytics engine

Write automated tests for js/engines/analytics-engine.js using Jest.
The engine exposes window.PielAnalyticsEngine. Tests must run with
"npx jest" from the repo root. Requirements:
- Mock window.gtag and window.dataLayer
- Test: trackEvent sends correct gtag calls
- Test: gracefully handles missing gtag (no errors thrown)
- Test: no duplicate events fired on repeated calls
- Test: funnel step tracking sequence is correct
Create tests/js/analytics-engine.test.js and a jest.config.js if missing.
Add "test:js" script to package.json: "jest tests/js"

<!-- /TASK -->

<!-- TASK
status: done
session: Audit log: configurable retention and IP anonymization
dispatched: 2026-02-24
-->
### Audit log: configurable retention and IP anonymization

lib/audit.php stores audit logs but has no retention policy.
Add the following to lib/audit.php:
(a) A cleanup() function that deletes records older than N days (default 90,
    configurable via AUDIT_RETENTION_DAYS constant or config). Call it
    probabilistically at 1% chance per request, same pattern as lib/ratelimit.php.
(b) After 30 days, anonymize IP addresses: keep only the first 3 octets
    (e.g. 192.168.1.X -> 192.168.1.0). Run as part of cleanup().
(c) Add a DB index on created_at if not present (check before adding).
Write a test in tests/AuditLogTest.php covering retention and anonymization.

<!-- /TASK -->

<!-- TASK
status: dispatched
session: sessions/9075640921639682759
dispatched: 2026-02-24
-->
### Backup integrity verification and at-rest encryption

backup-receiver.php accepts backup file uploads.
Add the following features:
(a) SHA-256 checksum verification: the sender must include an
    X-Backup-Checksum header with the hex SHA-256 of the file.
    The receiver verifies it before saving. Reject with 400 on mismatch.
(b) Encrypt backups at rest using OpenSSL AES-256-CBC. Read the encryption
    key from env var BACKUP_ENCRYPTION_KEY. Store encrypted files with
    .enc extension.
(c) Create a verify-backup.php CLI script that accepts a file path,
    decrypts it, and verifies the SHA-256 checksum.
(d) Auto-delete backup files older than 30 days during each upload request
    (probabilistic cleanup, 5% chance).
Write a test in tests/BackupReceiverTest.php.

<!-- /TASK -->

<!-- TASK
status: dispatched
session: sessions/7818317313173207746
dispatched: 2026-02-24
-->
### PHP rate-limiter: sliding window and per-user limits

lib/ratelimit.php uses a fixed-window strategy. Upgrade to sliding window:
(a) Replace the current fixed-window bucket query with a sliding-window
    query that counts requests in the last N seconds (not the current minute).
(b) Add per-user rate limits (by auth token or session ID) in addition to
    per-IP limits. User limits can be higher (e.g. 5x IP limit).
(c) Add a rate_limit_events table migration (SQL) with columns:
    id, ip, user_token, endpoint, created_at. Include an index on
    (ip, created_at) and (user_token, created_at).
(d) Log rate-limit hits to audit log using lib/audit.php logEvent().
Write tests in tests/RateLimiterTest.php.

<!-- /TASK -->

<!-- TASK
status: dispatched
session: sessions/18089669206263561268
dispatched: 2026-02-24
-->
### OpenAPI 3.1 spec for api.php endpoints

api.php handles multiple resources (?resource=...). Generate a complete
OpenAPI 3.1 specification file at docs/openapi.yaml covering:
- GET /api.php?resource=content&lang={es|en}
- GET /api.php?resource=reviews
- POST /api.php?resource=appointment
- POST /api.php?resource=contact
- POST /api.php?resource=payment-intent
- POST /api.php?resource=confirm-payment

For each endpoint document: summary, description, parameters, request body
schema, response schemas (200, 400, 429, 500), security requirements.
Read the existing api.php to extract actual field names and validations.
Include a README section in docs/ explaining how to view the spec locally
with Swagger UI (npx @redocly/cli preview-docs docs/openapi.yaml).

<!-- /TASK -->

<!-- TASK
status: dispatched
session: sessions/12920626005819937870
dispatched: 2026-02-24
-->
### Email notification system: appointment confirmations

When an appointment is booked (lib/appointments.php or payment webhook),
send a confirmation email to the patient. Requirements:
(a) Create lib/mailer.php wrapping PHPMailer (already in vendor/) with:
    - sendAppointmentConfirmation($to, $name, $date, $service, $lang)
    - sendAppointmentReminder($to, $name, $date, $service, $lang) (24h before)
(b) HTML email templates in templates/email/: appointment-confirmation-es.html,
    appointment-confirmation-en.html. Use Tailwind-free inline CSS.
(c) Read SMTP config from env vars: SMTP_HOST, SMTP_PORT, SMTP_USER,
    SMTP_PASS, SMTP_FROM, SMTP_FROM_NAME.
(d) Queue failed sends in a db table email_queue (id, to_email, subject,
    body_html, attempts, last_error, created_at, sent_at) with a retry
    cron concept (not the actual cron, just the retry query logic).
Write tests in tests/MailerTest.php using a mock transport.

<!-- /TASK -->
