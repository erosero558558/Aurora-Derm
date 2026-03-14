# Admin Ops Scripts

Implementaciones canonicas para operacion del runtime admin.

Entrypoints:

- `ADMIN-UI-CONTINGENCIA.ps1`
- `CHECKLIST-OPENCLAW-AUTH-LOCAL.ps1`
- `DIAGNOSTICAR-OPENCLAW-AUTH-ROLLOUT.ps1`
- `GATE-ADMIN-ROLLOUT.ps1`
- `INICIAR-OPENCLAW-AUTH-HELPER.ps1`

Los archivos homonimos en la raiz existen solo como wrappers compatibles.

Superficies npm:

- `npm run gate:admin:rollout`
- `npm run gate:admin:rollout:openclaw`
- `npm run checklist:admin:openclaw-auth:local`
- `npm run diagnose:admin:openclaw-auth:rollout`
- `npm run openclaw:auth:start`
- `npm run auth:operator:bridge` (alias deprecated)
- `npm run smoke:admin:openclaw-auth:local`

`openclaw:auth:start` corre el preflight local del operador y, si el bridge
minimo esta sano, arranca el helper HTTP de OpenClaw para el login admin.
OpenClaw sigue siendo el acceso primario del operador local.

`auth:operator:bridge` queda solo como alias de compatibilidad y delega al
launcher canonico `openclaw:auth:start`.

`checklist:admin:openclaw-auth:local` imprime el smoke canonico del laptop del
operador para validar env local, preflight, helper, facade `admin-auth.php` y
criterio de cierre del login OpenClaw.

`diagnose:admin:openclaw-auth:rollout` consulta en un dominio remoto tanto
`api.php?resource=operator-auth-status` como `admin-auth.php?action=status`,
calcula `diagnosis` + `nextAction` y deja un reporte en
`verification/last-admin-openclaw-auth-diagnostic.json`.

`smoke:admin:openclaw-auth:local` ejecuta el smoke no interactivo
`start -> helper -> status -> logout` contra `admin-auth.php` usando el helper
real por codigo. Requiere que el preflight ya este en `ok=true`.
Implementacion canonica: `scripts/ops/admin/SMOKE-OPENCLAW-AUTH-LOCAL.ps1`.

Si hace falta contingencia web desde cualquier PC, habilitar
`PIELARMONIA_INTERNAL_CONSOLE_AUTH_ALLOW_LEGACY_FALLBACK=true` junto con
`PIELARMONIA_ADMIN_PASSWORD` o `PIELARMONIA_ADMIN_PASSWORD_HASH` y
`PIELARMONIA_ADMIN_2FA_SECRET`.
La UI solo debe mostrar `Clave + 2FA de contingencia` cuando el backend anuncie
`fallbacks.legacy_password.available=true`.

`gate:admin:rollout:openclaw` endurece el gate del shell para exigir que
`api.php?resource=operator-auth-status` publique `mode=openclaw_chatgpt` y
`configured=true`. Si esa surface no responde o sigue en 503, el gate inspecciona
ademas `admin-auth.php?action=status` para distinguir entre contrato OpenClaw
valido, fachada legacy o surface fuera de rollout.

Si el gate falla solo en auth, usar `diagnose:admin:openclaw-auth:rollout`
para ver si el entorno esta en `facade_only_rollout`, `admin_auth_legacy_facade`,
`openclaw_not_configured` u `openclaw_ready`.

`GATE-ADMIN-ROLLOUT.ps1` ya incluye la suite `tests/admin-openclaw-login.spec.js`
para no dejar el flujo de login OpenClaw fuera del gate operativo del shell.
