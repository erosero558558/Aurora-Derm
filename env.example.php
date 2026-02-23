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
// Si usas backend local (figo-backend.php) con puente Telegram:
// putenv('FIGO_CHAT_ENDPOINT=https://pielarmonia.com/figo-backend.php');
// putenv('FIGO_TELEGRAM_BOT_TOKEN=TOKEN_BOTFATHER_ROTADO');
// putenv('FIGO_TELEGRAM_CHAT_ID=TU_CHAT_ID_TELEGRAM');
// putenv('FIGO_TELEGRAM_WEBHOOK_SECRET=TOKEN_SECRETO_WEBHOOK');

// ── IA para Figo (respuestas naturales) ──────────────
// Endpoint OpenAI-compatible (OpenRouter, Kimi, DeepSeek, OpenAI, Ollama, etc.)
// putenv('FIGO_AI_ENDPOINT=https://openrouter.ai/api/v1/chat/completions');
// putenv('FIGO_AI_API_KEY=sk-or-v1-REEMPLAZAR');
// putenv('FIGO_AI_MODEL=arcee-ai/trinity-large-preview:free');

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
// putenv('OPENCLAW_BRIDGE_SYNC_WAIT_MS=3200');
// Parametros del worker
// putenv('OPENCLAW_WORKER_MAX_JOBS=20');
// putenv('OPENCLAW_WORKER_RETRY_MAX=2');
// putenv('OPENCLAW_GATEWAY_TIMEOUT_SECONDS=12');
// Polling sugerido para frontend
// putenv('OPENCLAW_POLL_AFTER_MS=800');
// Trigger local al encolar (opcional)
// putenv('OPENCLAW_TRIGGER_MAX_JOBS=3');
// putenv('OPENCLAW_TRIGGER_TIME_BUDGET_MS=1200');
// En produccion, recomendado desactivar fallback local silencioso
// putenv('FIGO_ALLOW_LOCAL_FALLBACK=false');

// ── Cron (recordatorios automáticos) ────────────────
// putenv('PIELARMONIA_CRON_SECRET=un_token_secreto_largo');

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
// En produccion mantener en false para no filtrar errores internos al frontend
// putenv('PIELARMONIA_DEBUG_EXCEPTIONS=false');

// ── Auditoria API (performance) ───────────────────────
// Por defecto los GET publicos no se auditan para reducir I/O.
// Activa solo si necesitas trazas completas.
// putenv('PIELARMONIA_AUDIT_PUBLIC_GET=false');
// Auditar health en cada request (normalmente false para evitar ruido)
// putenv('PIELARMONIA_AUDIT_HEALTH=false');
