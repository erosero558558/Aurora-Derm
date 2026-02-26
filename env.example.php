<?php

/**
 * Ejemplo de configuración de Piel en Armonía.
 * Copia este archivo como env.php y completa los valores.
 * env.php está en .gitignore y NO se sube al repositorio.
 */

// ── SMTP (Gmail) ──────────────────────────────────────
// putenv('PIELARMONIA_SMTP_HOST=smtp.gmail.com');
// putenv('PIELARMONIA_SMTP_PORT=587');
// putenv('PIELARMONIA_SMTP_USER=tu_email@gmail.com');
// putenv('PIELARMONIA_SMTP_PASS=contraseña_de_aplicación');
// putenv('PIELARMONIA_EMAIL_FROM=tu_email@gmail.com');
// putenv('PIELARMONIA_ADMIN_EMAIL=tu_email@gmail.com');

// Push Web Notifications (Admin)
// Genera llaves VAPID y configura estas variables en produccion.
// putenv('PIELARMONIA_VAPID_PUBLIC_KEY=BKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
// putenv('PIELARMONIA_VAPID_PRIVATE_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
// putenv('PIELARMONIA_VAPID_SUBJECT=mailto:javier.rosero94@gmail.com');

// ── Admin ─────────────────────────────────────────────
// putenv('PIELARMONIA_ADMIN_PASSWORD=tu_clave_admin');

// ── Stripe ────────────────────────────────────────────
// putenv('PIELARMONIA_STRIPE_SECRET_KEY=sk_live_...');
// putenv('PIELARMONIA_STRIPE_PUBLISHABLE_KEY=pk_live_...');
// putenv('PIELARMONIA_STRIPE_WEBHOOK_SECRET=whsec_...');

// ── Orígenes permitidos (CORS) ────────────────────────
// putenv('PIELARMONIA_ALLOWED_ORIGIN=https://pielarmonia.com');
// Si Nginx/Cloudflare ya define CSP, puedes desactivar el CSP emitido por PHP
// para evitar cabeceras duplicadas.
// putenv('PIELARMONIA_DISABLE_APP_CSP=true');

// ── CAPTCHA (Turnstile) ──────────────────────────────
// putenv('PIELARMONIA_TURNSTILE_SITE_KEY=0x4AAAAAAABcDeFgHiJkLmNo');
// putenv('PIELARMONIA_TURNSTILE_SECRET_KEY=0x4AAAAAAABcDeFgHiJkLmNoPqRsTuVwXyZ');

// ── Chatbot (Figo) ───────────────────────────────────
// IMPORTANTE: no apuntar al propio /figo-chat.php (genera recursión).
// Usa el endpoint HTTP real del backend de Clawbot/Figo.
// putenv('FIGO_CHAT_ENDPOINT=https://TU_BACKEND_FIGO/chat');
// putenv('FIGO_CHAT_TOKEN=TOKEN_ROTADO_DESDE_BOTFATHER');
// Opcional: forzar fallback local cuando el backend falle. Por defecto es auto (live si upstream esta sano).
// putenv('FIGO_CHAT_DEGRADED_MODE=true');
// Ventana fail-fast (segundos) para cortar rapido cuando upstream viene fallando.
// Reduce latencia en cascada durante caidas temporales.
// putenv('FIGO_UPSTREAM_FAILFAST_SECONDS=15');
// Timeout de conexion cURL al backend de chat (default auto entre 2 y 6s).
// putenv('FIGO_CHAT_CONNECT_TIMEOUT_SECONDS=4');
// Si usas backend local (figo-backend.php) con puente Telegram:
// putenv('FIGO_CHAT_ENDPOINT=https://pielarmonia.com/figo-backend.php');
// putenv('FIGO_TELEGRAM_BOT_TOKEN=TOKEN_BOTFATHER_ROTADO');
// putenv('FIGO_TELEGRAM_CHAT_ID=TU_CHAT_ID_TELEGRAM');
// putenv('FIGO_TELEGRAM_WEBHOOK_SECRET=TOKEN_SECRETO_WEBHOOK');
// Token interno opcional entre figo-chat.php y figo-backend.php (recomendado en produccion).
// putenv('FIGO_INTERNAL_TOKEN=token_interno_largo_rotado');
// Header opcional del token interno (default X-Figo-Internal-Token).
// putenv('FIGO_INTERNAL_TOKEN_HEADER=X-Figo-Internal-Token');

// ── IA para Figo (respuestas naturales) ──────────────
// Endpoint OpenAI-compatible (OpenRouter, Kimi, DeepSeek, OpenAI, Ollama, etc.)
// putenv('FIGO_AI_ENDPOINT=https://openrouter.ai/api/v1/chat/completions');
// putenv('FIGO_AI_API_KEY=sk-or-v1-REEMPLAZAR');
// putenv('FIGO_AI_MODEL=arcee-ai/trinity-large-preview:free');
// Alias equivalente para endpoint IA (compatibilidad):
// putenv('FIGO_AI_API_URL=https://api.moonshot.ai/v1/chat/completions');
// Ejemplo Kimi:
// putenv('FIGO_AI_API_KEY=sk-REEMPLAZAR');
// putenv('FIGO_AI_MODEL=kimi-k2.5');

// -- OpenClaw Queue (modo recomendado sin Trinity) ----------------------------
// Activa el modo cola OpenClaw en figo-chat.php
// putenv('FIGO_PROVIDER_MODE=openclaw_queue');
// Endpoint OpenAI-compatible de tu gateway OpenClaw
// putenv('OPENCLAW_GATEWAY_ENDPOINT=https://tu-gateway-openclaw.example/v1/chat/completions');
// API key del gateway
// putenv('OPENCLAW_GATEWAY_API_KEY=REEMPLAZAR_TOKEN_OPENCLAW');
// Modelo por defecto
// putenv('OPENCLAW_GATEWAY_MODEL=figo-openclaw');
// Header/prefijo para auth (por defecto Authorization + Bearer)
// putenv('OPENCLAW_GATEWAY_KEY_HEADER=Authorization');
// putenv('OPENCLAW_GATEWAY_KEY_PREFIX=Bearer');
// TTL y retencion de jobs en cola
// putenv('OPENCLAW_QUEUE_TTL_SEC=1800');
// putenv('OPENCLAW_QUEUE_RETENTION_SEC=86400');
// Espera sincrona inicial del bridge antes de devolver queued
// putenv('OPENCLAW_BRIDGE_SYNC_WAIT_MS=1400');
// Parametros del worker
// putenv('OPENCLAW_WORKER_MAX_JOBS=20');
// putenv('OPENCLAW_WORKER_RETRY_MAX=2');
// putenv('OPENCLAW_GATEWAY_TIMEOUT_SECONDS=12');
// Polling sugerido para frontend
// putenv('OPENCLAW_POLL_AFTER_MS=800');
// Tiempo maximo (segundos) que cada poll puede usar para procesar el job
// putenv('OPENCLAW_POLL_PROCESS_TIMEOUT_SEC=8');
// Trigger local al encolar (opcional)
// putenv('OPENCLAW_TRIGGER_MAX_JOBS=1');
// putenv('OPENCLAW_TRIGGER_TIME_BUDGET_MS=900');
// En produccion, recomendado desactivar fallback local silencioso
// putenv('FIGO_ALLOW_LOCAL_FALLBACK=false');

// ── Cron (recordatorios automáticos) ────────────────
// putenv('PIELARMONIA_CRON_SECRET=un_token_secreto_largo');
// ── Rate limit (IP + usuario) ────────────────────────
// Proxies de confianza (para usar X-Forwarded-For).
// Por seguridad, X-Forwarded-For se ignora si la peticion no viene de una IP confiable.
// Default: 127.0.0.1,::1 (localhost).
// Si usas Cloudflare o Load Balancer, agrega sus IPs (CIDR soportado).
// putenv('PIELARMONIA_TRUSTED_PROXIES=10.0.0.0/8,172.16.0.0/12,192.168.0.0/16');

// Habilita limite adicional por usuario/token (default true).
// putenv('PIELARMONIA_RATE_LIMIT_PER_USER_ENABLED=true');
// Max requests por usuario/token en la ventana (default = maxRequests del endpoint).
// putenv('PIELARMONIA_RATE_LIMIT_USER_MAX_REQUESTS=10');
// Ventana por usuario/token en segundos (default = windowSeconds del endpoint).
// putenv('PIELARMONIA_RATE_LIMIT_USER_WINDOW_SECONDS=60');

// ── Backups (salud + replicacion offsite) ───────────
// Edad maxima (horas) del ultimo backup para health check (1-168, default 24)
// putenv('PIELARMONIA_BACKUP_MAX_AGE_HOURS=24');
// Auto-refresh de backup en health cuando el ultimo esta stale (default true)
// putenv('PIELARMONIA_BACKUP_AUTO_REFRESH=true');
// Cooldown de auto-refresh en segundos (300-604800, default 600 = 10min)
// putenv('PIELARMONIA_BACKUP_AUTO_REFRESH_INTERVAL_SECONDS=600');
// Webhook/endpoint para subir snapshots offsite (multipart form-data)
// putenv('PIELARMONIA_BACKUP_OFFSITE_URL=https://tu-backup-endpoint.example/upload');
// Token opcional para autenticar el webhook de backup
// putenv('PIELARMONIA_BACKUP_OFFSITE_TOKEN=token_largo_rotado');
// Header opcional del token (default Authorization)
// putenv('PIELARMONIA_BACKUP_OFFSITE_TOKEN_HEADER=Authorization');
// Timeout de subida offsite en segundos (5-120, default 20)
// putenv('PIELARMONIA_BACKUP_OFFSITE_TIMEOUT_SECONDS=20');
// Replica local de snapshots (default true). Guardado en data/backups/offsite-local/
// putenv('PIELARMONIA_BACKUP_LOCAL_REPLICA=true');
// Receiver remoto (cuando este servidor actua como destino offsite)
// putenv('PIELARMONIA_BACKUP_RECEIVER_TOKEN=token_largo_rotado');
// Limite de subida en MB para backup-receiver.php (default 50)
// putenv('PIELARMONIA_BACKUP_RECEIVER_MAX_MB=50');
// Requerir checksum SHA-256 por header X-Backup-SHA256 (default true)
// putenv('PIELARMONIA_BACKUP_RECEIVER_REQUIRE_CHECKSUM=true');
// Retencion de backups recibidos en dias (default 30)
// putenv('PIELARMONIA_BACKUP_RECEIVER_RETENTION_DAYS=30');
// Maximo de archivos escaneados por corrida de limpieza (default 500)
// putenv('PIELARMONIA_BACKUP_RECEIVER_CLEANUP_MAX_FILES=500');
// Clave de cifrado para backup-receiver.php (si no se define, usa PIELARMONIA_DATA_ENCRYPTION_KEY)
// putenv('PIELARMONIA_BACKUP_RECEIVER_ENCRYPTION_KEY=clave_larga_rotada_o_base64:...');

// ── Base de Datos (opcional) ────────────────────────
// putenv('PIELARMONIA_DB_HOST=127.0.0.1');
// putenv('PIELARMONIA_DB_NAME=pielarmonia');
// putenv('PIELARMONIA_DB_USER=root');
// putenv('PIELARMONIA_DB_PASS=secret');
// Fallback automatico a almacenamiento JSON cuando SQLite no esta disponible (default true)
// putenv('PIELARMONIA_STORAGE_JSON_FALLBACK=true');
// Fallback de contenido publico cuando store esta vacio (default true)
// putenv('PIELARMONIA_DEFAULT_REVIEWS_ENABLED=true');
// Agenda fallback cuando no hay horarios configurados (default false para usar agenda real)
// putenv('PIELARMONIA_DEFAULT_AVAILABILITY_ENABLED=false');

// -- Agenda Real (Google Calendar) --------------------------------------------
// Fuente de agenda: "store" (local) o "google" (agenda real).
// putenv('PIELARMONIA_AVAILABILITY_SOURCE=google');
// Endurecimiento opcional: exigir Google Calendar activo. Si esta en true y la
// fuente no es google, se bloquean availability/booked-slots/reserva/reprogramacion.
// putenv('PIELARMONIA_REQUIRE_GOOGLE_CALENDAR=false');
// Si Google falla: bloquear reservas/slots (true recomendado para evitar sobreventa).
// putenv('PIELARMONIA_CALENDAR_BLOCK_ON_FAILURE=true');
// Modo de autenticacion Google Calendar:
// - auto (prioriza service account si existe, sino OAuth refresh token)
// - oauth_refresh_token (recomendado cuando no se permiten llaves SA)
// - service_account
// - none
// putenv('PIELARMONIA_CALENDAR_AUTH_MODE=oauth_refresh_token');
// Zona horaria de agenda.
// putenv('PIELARMONIA_CALENDAR_TIMEZONE=America/Guayaquil');
// Paso base de slot en minutos.
// putenv('PIELARMONIA_CALENDAR_SLOT_STEP_MIN=30');
// Duracion por servicio (min): clinica 30 / procedimientos 60.
// putenv('PIELARMONIA_SERVICE_DURATION_MAP=consulta:30,telefono:30,video:30,acne:30,cancer:30,laser:60,rejuvenecimiento:60');
// Service Account Google (server-to-server).
// putenv('PIELARMONIA_GOOGLE_SA_CLIENT_EMAIL=service-account@proyecto.iam.gserviceaccount.com');
// Clave privada en Base64 (contenido completo del private_key del JSON de Google).
// putenv('PIELARMONIA_GOOGLE_SA_PRIVATE_KEY_B64=BASE64_PRIVATE_KEY');
// Alternativa sin claves JSON (OAuth refresh token), util para organizaciones con
// politica iam.disableServiceAccountKeyCreation habilitada.
// putenv('PIELARMONIA_GOOGLE_OAUTH_CLIENT_ID=xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com');
// putenv('PIELARMONIA_GOOGLE_OAUTH_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxx');
// putenv('PIELARMONIA_GOOGLE_OAUTH_REFRESH_TOKEN=1//0gxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
// IDs de calendario por doctor.
// putenv('PIELARMONIA_GOOGLE_CALENDAR_ID_ROSERO=cal_id_rosero@group.calendar.google.com');
// putenv('PIELARMONIA_GOOGLE_CALENDAR_ID_NARVAEZ=cal_id_narvaez@group.calendar.google.com');
// TTL cache de disponibilidad (segundos).
// putenv('PIELARMONIA_CALENDAR_CACHE_TTL_SEC=60');

// ── Feature Flags ───────────────────────────────────
// putenv('FEATURE_NEW_BOOKING_UI=true');
// putenv('FEATURE_STRIPE_ELEMENTS=true');
// putenv('FEATURE_DARK_MODE=true');
// putenv('FEATURE_CHATGPT_INTEGRATION=true');

// ── Debug seguro (solo desarrollo) ───────────────────
// PRODUCCION: mantener en false. En true expone mensajes de excepcion al frontend.
putenv('PIELARMONIA_DEBUG_EXCEPTIONS=false');

// ── Monitoring / Sentry ───────────────────────────────
// Activar con DSN real de https://sentry.io (crear proyecto PHP + Browser).
// PIELARMONIA_SENTRY_DSN      = DSN para errores PHP backend (sentry.io > Settings > Client Keys)
// PIELARMONIA_SENTRY_DSN_PUBLIC = DSN para errores JS frontend (mismo proyecto o uno separado)
// PIELARMONIA_SENTRY_ENV      = nombre del entorno (ej: production, staging)
// putenv('PIELARMONIA_SENTRY_DSN=https://xxxxx@oXXXXX.ingest.sentry.io/YYYYYYY');
// putenv('PIELARMONIA_SENTRY_DSN_PUBLIC=https://xxxxx@oXXXXX.ingest.sentry.io/YYYYYYY');
// putenv('PIELARMONIA_SENTRY_ENV=production');

// ── Auditoria API (performance) ───────────────────────
// Por defecto los GET publicos no se auditan para reducir I/O.
// Activa solo si necesitas trazas completas.
// putenv('PIELARMONIA_AUDIT_PUBLIC_GET=false');
// Auditar health en cada request (normalmente false para evitar ruido)
// putenv('PIELARMONIA_AUDIT_HEALTH=false');
