# Servidor Local

Fuente canonica detallada para correr backend, admin y QA local.
`SERVIDOR-LOCAL.md` en la raiz queda solo como shim de compatibilidad.

Para probar la web con backend (API + admin) no uses `file://`.

## Requisitos

- PHP 7.4 o superior
- endpoint local de chatbot en `figo-chat.php` (si quieres IA real en local)

## Iniciar en local

Desde la carpeta del proyecto:

```powershell
php -S 127.0.0.1:8011 -t .
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
php -S 127.0.0.1:8011 -t .
npm run auth:operator:bridge
```

Validaciones previas:

- `openclaw models status --json` debe mostrar un perfil OAuth `openai-codex`
  en estado `ok`.
- `GET http://127.0.0.1:4173/health` debe devolver
  `service=operator-auth-bridge`.
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

Notas:

- `npm run auth:operator:bridge` lee `env.php` si esas variables no vienen ya
  exportadas en la shell.
- `admin.html` y `operador-turnos.html` reutilizan la misma sesion del
  operador.
- Si OpenClaw no muestra un OAuth valido, ejecuta
  `openclaw models auth login --provider openai-codex` y reintenta.

## Login legacy por clave

Solo aplica si desactivas operator auth y vuelves a un modo legacy.

- `PIELARMONIA_ADMIN_PASSWORD`
- `PIELARMONIA_ADMIN_PASSWORD_HASH`
- `PIELARMONIA_EMAIL_FROM`
- `PIELARMONIA_DATA_DIR`
- `FIGO_CHAT_ENDPOINT`
- `FIGO_CHAT_TOKEN`

Alternativa sin variables de entorno:

- Crea `data/figo-config.json` con `endpoint` y credenciales opcionales.

Notas generales:

- `TEST_BASE_URL` sirve para apuntar tests y pentests a otro host.
- `TEST_LOCAL_SERVER_PORT` sirve para mover el puerto local del runner Playwright.
- `npm run benchmark:local` reutiliza `TEST_BASE_URL` o levanta `127.0.0.1:8011` automaticamente.
- En el servidor PHP bare (`php -S`), `/index.html` no es la entrada canonica
  y puede responder `404`.
- Las rutas legacy como `/index.html` o `/telemedicina.html` forman parte del
  contrato de redirects en Apache/Nginx (`.htaccess`), no del entrypoint local.
