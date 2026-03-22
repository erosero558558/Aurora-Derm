# Checklist de Pruebas en Produccion

Fuente canonica detallada para smoke manual y validacion operativa en
produccion. `CHECKLIST-PRUEBAS-PRODUCCION.md` en la raiz queda solo como shim
compatible.

Runbooks relacionados:

- `docs/PUBLIC_MAIN_UPDATE_RUNBOOK.md`
- `docs/PUBLIC_V3_CRON_INSTALL.md`

Fecha de ejecucion sugerida: completar al desplegar.

## 1. Pre-check de servidor

1. Verifica que existan estos archivos en produccion:

- `index.php`
- `.htaccess`
- `styles.css`
- `styles-deferred.css`
- `es/`
- `en/`
- `_astro/`
- `script.js`
- `js/chunks/`
- `js/engines/`
- `js/public-v6-shell.js`
- `fonts/`
- `images/optimized/`
- `images/icon-192.png`
- `images/icon-512.png`
- `manifest.json`
- `sw.js`
- `admin.html`
- `admin-v3.css`
- `queue-ops.css`
- `admin.js`
- `js/admin-chunks/`
- `js/admin-preboot-shortcuts.js`
- `js/monitoring-loader.js`
- `operador-turnos.html`
- `kiosco-turnos.html`
- `sala-turnos.html`
- `queue-kiosk.css`
- `queue-display.css`
- `node bin/check-public-routing-smoke.js --base-url https://pielarmonia.com --label production`
  debe validar tambien esas tres superficies del turnero como parte del smoke publico.
- `js/queue-operator.js`
- `js/queue-kiosk.js`
- `js/queue-display.js`
- `api.php`
- `api-lib.php`
- `payment-lib.php`
- `admin-auth.php`
- carpeta `uploads/transfer-proofs/` con permisos de escritura
- carpeta `data/` con permisos de escritura
- `figo-chat.php` disponible en el servidor
- `figo-backend.php` disponible en el servidor (si usas backend local)

Compatibilidad opcional:

- Las rutas HTML legacy como `telemedicina.html`, `terminos.html` o
  `servicios/*.html` pueden seguir publicadas por compatibilidad, pero no son
  el set minimo V6.
- `styles.css`, `styles-deferred.css`, `script.js`, `js/chunks/**` y
  `js/engines/**` si forman parte del runtime versionado del gateway publico
  raiz y deben existir cuando `/` depende de ese flujo.

2. Verifica variables de entorno:

- `AURORADERM_OPERATOR_AUTH_MODE=google_oauth`
- `AURORADERM_OPERATOR_AUTH_TRANSPORT=web_broker`
- `AURORADERM_ADMIN_EMAIL=<correo_operativo>`
- `AURORADERM_OPERATOR_AUTH_ALLOWLIST=<correo_operativo>`
- `AURORADERM_OPERATOR_AUTH_ALLOW_ANY_AUTHENTICATED_EMAIL=false`
- `AURORADERM_OPERATOR_AUTH_SERVER_BASE_URL=https://TU_DOMINIO`
- `OPENCLAW_AUTH_BROKER_AUTHORIZE_URL`
- `OPENCLAW_AUTH_BROKER_TOKEN_URL`
- `OPENCLAW_AUTH_BROKER_USERINFO_URL`
- `OPENCLAW_AUTH_BROKER_CLIENT_ID`
- opcional: `OPENCLAW_AUTH_BROKER_CLIENT_SECRET`
- opcional para smoke live sandbox:
  `OPENCLAW_AUTH_BROKER_SMOKE_ENABLED=true`,
  `OPENCLAW_AUTH_BROKER_SMOKE_USERNAME`,
  `OPENCLAW_AUTH_BROKER_SMOKE_PASSWORD`,
  `OPENCLAW_AUTH_BROKER_SMOKE_TOTP_SECRET`,
  `OPENCLAW_AUTH_BROKER_SMOKE_EXPECTED_EMAIL`
- opcional solo para soporte local/manual: `AURORADERM_OPERATOR_AUTH_BRIDGE_TOKEN`, `AURORADERM_OPERATOR_AUTH_BRIDGE_SECRET`
- opcional solo para contingencia legacy: `AURORADERM_INTERNAL_CONSOLE_AUTH_ALLOW_LEGACY_FALLBACK=true`, `AURORADERM_ADMIN_PASSWORD` o `AURORADERM_ADMIN_PASSWORD_HASH`, `AURORADERM_ADMIN_2FA_SECRET`
- opcional: `AURORADERM_ADMIN_EMAIL` (para alertas de nuevas citas)
- opcional: `AURORADERM_EMAIL_FROM`
- opcional: `AURORADERM_DATA_DIR`
- opcional: `AURORADERM_DATA_ENCRYPTION_KEY` (cifrado de `store.json`)
- `AURORADERM_STRIPE_PUBLISHABLE_KEY`
- `AURORADERM_STRIPE_SECRET_KEY`
- opcional: `AURORADERM_PAYMENT_CURRENCY` (default `USD`)
- opcional: `AURORADERM_TRANSFER_UPLOAD_DIR`
- opcional: `AURORADERM_TRANSFER_PUBLIC_BASE_URL`
- `FIGO_CHAT_ENDPOINT`
- opcional: `FIGO_CHAT_TOKEN`
- opcional: `FIGO_CHAT_APIKEY_HEADER`
- opcional: `FIGO_CHAT_APIKEY`
- opcional: `FIGO_CHAT_DEGRADED_MODE`
- opcional: `FIGO_TELEGRAM_BOT_TOKEN`
- opcional: `FIGO_TELEGRAM_CHAT_ID`
- recomendado: `FIGO_TELEGRAM_WEBHOOK_SECRET`
- alternativa: `data/figo-config.json` con `endpoint`

3. Verifica endpoint de salud:

- URL: `https://TU_DOMINIO/api.php?resource=health`
- Esperado: JSON con `"ok": true` y campos:
    - `timingMs`
    - `version`
    - `dataDirWritable`
    - `storeEncrypted`
    - `figoConfigured`
    - `figoRecursiveConfig`

4. Si el origen productivo actual es Windows, verifica tambien la capa de
   hosting local antes de abrir trafico:

- Existe `C:\ProgramData\Pielarmonia\hosting\release-target.json` con
  `target_commit`.
- Existe `C:\ProgramData\Pielarmonia\hosting\main-sync-status.json` y no queda
  atascado en `state=locked` sin `lock_owner_pid` valido.
- La tarea `Pielarmonia Hosting Supervisor` esta `Ready` y la tarea
  `Pielarmonia Hosting Main Sync` corre cada 1 minuto.
- El runtime servible sale desde `C:\dev\pielarmonia-clean-main`, no desde el
  workspace de desarrollo.
- Si algo falla, el entrypoint canonico de recovery es
  `scripts/ops/setup/REPARAR-HOSTING-WINDOWS.ps1`; no improvisar `git pull`
  ni reinicios manuales sobre el workspace activo.

## 2. Pruebas del panel admin

1. Abre `https://TU_DOMINIO/admin.html`.
2. Sin sesion, verifica el gate del modo activo:

- Esperado por defecto: CTA `Continuar con Google` con redirect same-tab al broker remoto.
- No deben aparecer helper local, codigo manual ni polling local en `web_broker`.
- Solo si activaste la contingencia legacy: formulario `Clave + 2FA de contingencia`.

3. Ejecuta el gate remoto del rollout auth:

- `npm run gate:admin:rollout:auth:node`
- `npm run diagnose:admin:auth:rollout:node`
- Esperado: gate verde y diagnostico `operator_auth_ready`.

4. Ejecuta el smoke live del broker sandbox:

- `npm run smoke:admin:auth:live:node`
- o `node bin/operator-auth-live-smoke.js --transport web_broker --server-base-url https://TU_DOMINIO`
- Esperado: `callback_ok=true`, `shared_session_ok=true`, `logout_ok=true`.

5. Si activaste soporte legacy, intenta login con contraseña incorrecta:

- Esperado: mensaje de error.

6. Si activaste soporte legacy, login con contraseña correcta (`AURORADERM_ADMIN_PASSWORD`):

- Esperado: carga dashboard.

7. Si el entorno esta en modo `google_oauth` con `web_broker`, valida `start -> redirectUrl -> callback -> status authenticated -> logout`:

- `POST /admin-auth.php?action=start`
- redireccion al broker remoto (`redirectUrl`)
- `GET /admin-auth.php?action=callback`
- `GET /admin-auth.php?action=status`
- `GET /api.php?resource=operator-auth-status`
- `POST /admin-auth.php?action=logout`
- Esperado adicional: admin y turnero comparten la misma sesion autenticada y el `returnTo` del turnero preserva `station`, `lock` y `one_tap`.

8. Navega por secciones:

- `Citas`, `Callbacks`, `Reseñas`, `Disponibilidad`
- Esperado: sin errores visuales ni pantallas en blanco.

9. Exportar datos:

- Boton `Exportar Datos`
- Esperado: descarga de JSON correcta.

## 3. Flujo publico V6

1. Abre `https://TU_DOMINIO/`, `https://TU_DOMINIO/es/` y
   `https://TU_DOMINIO/en/`.

- Esperado: `/` redirige o resuelve a la shell publica V6 y las rutas ES/EN
  responden `200`.

2. Verifica cabecera, menu y cambio de idioma.

- Esperado: navegacion, drawer/mega menu y switch ES/EN funcionan sin errores.

3. Verifica CTA publica principal del release.

- Si la agenda web sigue en mantenimiento:
    - esperado: la UI comunica el mantenimiento y ofrece salida clara hacia
      telemedicina, WhatsApp o la ruta clinica correspondiente.
- Si la agenda web fue reactivada en este release:
    - esperado: el bridge de reserva abre y permite iniciar el flujo.

4. Revisa consola del navegador.

- Esperado: sin errores rojos bloqueantes.

## 3.1 Reserva/pago publico (solo si el release reactivó booking)

1. Abre la CTA de reserva y completa servicio, doctor, fecha, hora, nombre,
   email y telefono.
2. Confirma el flujo.

- Esperado: mensaje de cita registrada y detalle visible.

3. Vuelve al admin > `Citas`.

- Esperado: la nueva cita aparece en tabla.

## 3.2 Pago con tarjeta (solo si el release activó pagos publicos)

1. En el modal de pago, elige `Tarjeta`.
2. Ingresa titular y completa tarjeta en el formulario de Stripe.
3. Confirma pago.

- Esperado: mensaje `Pago aprobado y cita registrada`.

4. En admin > `Citas`:

- Esperado: `Pago` en estado `Pagado` con metodo `Tarjeta`.

## 3.3 Pago por transferencia + comprobante (solo si el release activó pagos publicos)

1. En el modal de pago, elige `Transferencia`.
2. Ingresa referencia y adjunta comprobante (JPG/PNG/WEBP/PDF).
3. Confirma reserva.

- Esperado: cita creada con estado de pago `Comprobante por validar`.

4. En admin > `Citas`:

- Esperado: visible `Ref` y link `Ver comprobante`.

## 4. Validacion de disponibilidad

1. Admin > `Disponibilidad`.
2. Selecciona fecha y agrega un horario nuevo.

- Esperado: horario visible en lista.

3. En web publica, selecciona misma fecha.

- Esperado: el horario aparece disponible.

4. Reserva ese horario en web publica.
5. Recarga y revisa misma fecha.

- Esperado: el horario ya no aparece libre.

## 5. Flujo de callback

1. En web publica, envia formulario `¿Prefieres que te llamemos?`.
2. En admin > `Callbacks`:

- Esperado: aparece registro con estado `Pendiente`.

3. Usa `Marcar contactado`.

- Esperado: estado cambia a `Contactado`.

4. Prueba filtro:

- `Pendientes` y `Contactados` deben mostrar resultados correctos.

## 6. Flujo de reseñas

1. En web publica, envia nueva reseña con estrellas.
2. Esperado en web publica:

- aparece nueva reseña en el grid.

3. Esperado en admin > `Reseñas`:

- aparece reseña, conteo y promedio actualizados.

## 7. Chatbot Figo

1. Verifica `figo-chat.php`:

- URL: `https://TU_DOMINIO/figo-chat.php`
- Esperado: responde JSON y muestra `configured`, `degradedMode`, `endpointHost`, `mode`, `recursiveConfigDetected`, `upstreamReachable`.
- Crítico: `recursiveConfigDetected` debe ser `false` y `mode` debe ser `live` (salvo mantenimiento controlado).
- Si aparece `recursiveConfigDetected=true`, revisa `FIGO_CHAT_ENDPOINT`: no puede apuntar al mismo `/figo-chat.php`.

2. Chatbot en sitio:

- Pregunta: `hola`
- Esperado: respuesta valida del bot, sin errores de endpoint.

    2.1 Si usas backend local Telegram (`figo-backend.php`):

- URL: `https://TU_DOMINIO/figo-backend.php`
- Esperado GET: `ok=true`.
- Esperado POST: respuesta en formato `chat.completion` con contenido util.

    2.2 Webhook Telegram:

- Configura webhook hacia `https://TU_DOMINIO/figo-backend.php`.
- En `getWebhookInfo`, `url` debe coincidir y `last_error_message` debe estar vacio.

3. Si `figo-chat.php` falla temporalmente:

- Esperado: chatbot sigue funcionando con fallback local (sin romper UI).

## 8. Seguridad basica

1. Busca en codigo desplegado:

- no debe existir `sk-...` hardcodeado.
- no debe existir `admin123` como fallback.

2. Verifica admin sin sesion:

- abre `admin.html` en incognito.
- esperado: solicita login.

3. Verifica backups automaticos:

- tras crear o editar una cita/callback/reseña, debe existir al menos un archivo en `data/backups/`.

4. Verifica auditoria:

- revisa que se cree/actualice `data/audit.log` con eventos de acceso/login.

5. Verifica cifrado en reposo (si activaste `AURORADERM_DATA_ENCRYPTION_KEY`):

- `data/store.json` debe iniciar con prefijo `ENCv1:`.

6. Verifica cabeceras HTTP de seguridad en Home:

- `Content-Security-Policy`
- `X-Content-Type-Options`
- `Referrer-Policy`

7. Verifica politica de cache:

- assets publicos activos (`js/public-v6-shell.js`, `_astro/*.css`,
  `admin.js`, `js/admin-chunks/*.js`) deben incluir `Cache-Control` con
  `max-age`.
- `api.php?resource=health` debe incluir `Cache-Control` con `no-store`/`no-cache`.

## 9. Prueba de regresion rapida (5 min)

Opcional automatizado (PowerShell):

- `.\scripts\ops\prod\SMOKE-PRODUCCION.ps1 -Domain "https://TU_DOMINIO" -TestFigoPost`
- `.\scripts\ops\prod\VERIFICAR-DESPLIEGUE.ps1 -Domain "https://TU_DOMINIO" -RunSmoke`
- `.\scripts\ops\prod\BENCH-API-PRODUCCION.ps1 -Domain "https://TU_DOMINIO" -Runs 25 -IncludeFigoPost`
- `.\scripts\ops\prod\GATE-POSTDEPLOY.ps1 -Domain "https://TU_DOMINIO" -RequireWebhookSecret`
- Si estas en mantenimiento y aceptas chat degradado temporalmente:
    - `.\scripts\ops\prod\SMOKE-PRODUCCION.ps1 -Domain "https://TU_DOMINIO" -TestFigoPost -AllowDegradedFigo -AllowRecursiveFigo`

1. Home carga sin errores.
2. Menu y scroll funcionan.
3. Modales abren/cierran.
4. CTA publica principal responde segun el estado del release
   (telemedicina/contacto o booking).
5. Si booking estuvo activo en este release, flujo de agendamiento completo.
6. Admin login + vista de citas.
7. Chatbot responde.

## 10. Si algo falla

1. Revisa consola del navegador (F12).
2. Revisa respuesta de:

- `api.php?resource=health`
- `admin-auth.php?action=status`
- `api.php?resource=operator-auth-status`
- `verification/operator-auth-live-smoke/operator-auth-live-smoke-last.json`
- `figo-chat.php`

3. Revisa permisos de `data/`.
4. Verifica variables de entorno.
