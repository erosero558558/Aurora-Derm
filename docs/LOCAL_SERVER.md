# Servidor Local

Fuente canonica detallada para correr backend, admin y QA local.
`SERVIDOR-LOCAL.md` en la raiz queda solo como shim de compatibilidad.
Si no sabes que flujo seguir, empieza por `docs/OPERATIONS_INDEX.md`.

Para probar la web con backend (API + admin) no uses `file://`.

## Requisitos

- PHP 7.4 o superior
- endpoint local de chatbot en `figo-chat.php` (si quieres IA real en local)

## Iniciar en local

Desde la carpeta del proyecto:

```powershell
php -S 127.0.0.1:8011 -t . bin/local-stage-router.php
```

Luego abre:

- Gateway local: `http://127.0.0.1:8011/`
- Publico ES: `http://127.0.0.1:8011/es/`
- Publico EN: `http://127.0.0.1:8011/en/`
- Admin: `http://127.0.0.1:8011/admin.html`
- Operador: `http://127.0.0.1:8011/operador-turnos.html`
- API health: `http://127.0.0.1:8011/api.php?resource=health`
- Bot endpoint: `http://127.0.0.1:8011/figo-chat.php`

## Login OpenClaw local

El login canonico de `admin.html` y `operador-turnos.html` requiere dos
procesos vivos en local:

1. Backend PHP en `http://127.0.0.1:8011`
2. Helper local en `http://127.0.0.1:4173`

Arranque recomendado:

```powershell
php -S 127.0.0.1:8011 -t . bin/local-stage-router.php
npm run openclaw:auth:start
```

Script canonico del launcher local: `scripts/ops/admin/INICIAR-OPENCLAW-AUTH-HELPER.ps1`.

Validaciones previas:

- `npm run openclaw:auth-preflight -- --json` debe devolver `ok=true` y
  usar el mismo `OPENCLAW_RUNTIME_BASE_URL` que el helper y el smoke local.
- `GET http://127.0.0.1:4173/health` debe devolver
  `service=openclaw-auth-helper`.
- `POST http://127.0.0.1:8011/admin-auth.php?action=start` debe devolver
  `helperUrl` apuntando a `127.0.0.1:4173`.

Variables usadas por este flujo:

- `PIELARMONIA_OPERATOR_AUTH_MODE`
- `PIELARMONIA_OPERATOR_AUTH_ALLOWLIST`
- `PIELARMONIA_OPERATOR_AUTH_BRIDGE_TOKEN`
- `PIELARMONIA_OPERATOR_AUTH_BRIDGE_SECRET`
- `PIELARMONIA_OPERATOR_AUTH_BRIDGE_TOKEN_HEADER`
- `PIELARMONIA_OPERATOR_AUTH_BRIDGE_TOKEN_PREFIX`
- `PIELARMONIA_OPERATOR_AUTH_SERVER_BASE_URL`
- `PIELARMONIA_OPERATOR_AUTH_HELPER_BASE_URL`
- `PIELARMONIA_OPERATOR_AUTH_CHALLENGE_TTL_SECONDS`
- `PIELARMONIA_OPERATOR_AUTH_SESSION_TTL_SECONDS`
- `PIELARMONIA_OPERATOR_AUTH_BRIDGE_MAX_SKEW_SECONDS`
- `OPENCLAW_HELPER_DEVICE_ID`

Notas:

- `npm run openclaw:auth:start` es el launcher canonico y lee `env.php` si esas
  variables no vienen ya exportadas en la shell.
- `npm run auth:operator:bridge` queda como alias deprecated y delega al
  launcher canonico.
- `admin.html` y `operador-turnos.html` reutilizan la misma sesion del
  operador.
- Si el preflight reporta `readyForLogin=false`, completa el login en OpenClaw
  y vuelve a ejecutar `npm run openclaw:auth:start`.

## Login legacy por clave

Solo aplica como modo principal legacy o como contingencia web explicita en el
modo OpenClaw.

- `PIELARMONIA_ADMIN_PASSWORD`
- `PIELARMONIA_ADMIN_PASSWORD_HASH`
- `PIELARMONIA_ADMIN_2FA_SECRET`
- `PIELARMONIA_INTERNAL_CONSOLE_AUTH_ALLOW_LEGACY_FALLBACK=true`
- `PIELARMONIA_EMAIL_FROM`
- `PIELARMONIA_DATA_DIR`
- `FIGO_CHAT_ENDPOINT`
- `FIGO_CHAT_TOKEN`

Notas:

- En produccion con `PIELARMONIA_INTERNAL_CONSOLE_AUTH_PRIMARY=openclaw_chatgpt`,
  la clave solo funciona como contingencia si tambien hay `2FA`.
- `admin.html` mantiene OpenClaw como acceso principal del operador local y
  solo muestra `clave + 2FA` cuando el backend anuncia el fallback como
  disponible.

Alternativa sin variables de entorno:

- Crea `data/figo-config.json` con `endpoint` y credenciales opcionales.

Notas generales:

- `TEST_BASE_URL` sirve para apuntar tests y pentests a otro host.
- `TEST_LOCAL_SERVER_PORT` sirve para mover el puerto local del runner Playwright.
- `npm run benchmark:local` reutiliza `TEST_BASE_URL` o levanta `127.0.0.1:8011` automaticamente con `bin/local-stage-router.php`.
- El router local sirve el repo authored y resuelve los outputs generados desde `.generated/site-root`.
- En el servidor PHP local (`php -S ... bin/local-stage-router.php`), `/index.html` no es la entrada canonica
  y puede responder `404`.
- Las rutas legacy como `/index.html` o `/telemedicina.html` forman parte del
  contrato de redirects en Apache/Nginx (`.htaccess`), no del entrypoint local.
