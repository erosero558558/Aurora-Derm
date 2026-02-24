# Checklist de Pruebas en Produccion

Fecha de ejecucion sugerida: completar al desplegar.

## 1. Pre-check de servidor

1. Verifica que existan estos archivos en produccion:

- `index.html`
- `index.php`
- `styles.css`
- `styles-deferred.css`
- `script.js`
- `chat-engine.js`
- `booking-engine.js`
- `translations-en.js`
- `terminos.html`
- `privacidad.html`
- `cookies.html`
- `aviso-medico.html`
- `legal.css`
- `admin.html`
- `admin.js`
- `api.php`
- `api-lib.php`
- `payment-lib.php`
- `admin-auth.php`
- carpeta `uploads/transfer-proofs/` con permisos de escritura
- carpeta `data/` con permisos de escritura
- `figo-chat.php` disponible en el servidor
- `figo-backend.php` disponible en el servidor (si usas backend local)

2. Verifica variables de entorno:

- `PIELARMONIA_ADMIN_PASSWORD`
- opcional: `PIELARMONIA_ADMIN_PASSWORD_HASH`
- opcional: `PIELARMONIA_ADMIN_EMAIL` (para alertas de nuevas citas)
- opcional: `PIELARMONIA_EMAIL_FROM`
- opcional: `PIELARMONIA_DATA_DIR`
- opcional: `PIELARMONIA_DATA_ENCRYPTION_KEY` (cifrado de `store.json`)
- `PIELARMONIA_STRIPE_PUBLISHABLE_KEY`
- `PIELARMONIA_STRIPE_SECRET_KEY`
- opcional: `PIELARMONIA_PAYMENT_CURRENCY` (default `USD`)
- opcional: `PIELARMONIA_TRANSFER_UPLOAD_DIR`
- opcional: `PIELARMONIA_TRANSFER_PUBLIC_BASE_URL`
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

## 2. Pruebas del panel admin

1. Abre `https://TU_DOMINIO/admin.html`.
2. Intenta login con contraseña incorrecta:

- Esperado: mensaje de error.

3. Login con contraseña correcta (`PIELARMONIA_ADMIN_PASSWORD`):

- Esperado: carga dashboard.

4. Navega por secciones:

- `Citas`, `Callbacks`, `Reseñas`, `Disponibilidad`
- Esperado: sin errores visuales ni pantallas en blanco.

5. Exportar datos:

- Boton `Exportar Datos`
- Esperado: descarga de JSON correcta.

## 3. Flujo de cita publica

1. Abre `https://TU_DOMINIO/` y `https://TU_DOMINIO/index.html`.
2. En `Reserva tu Cita`, completa formulario:

- servicio, doctor, fecha, hora, nombre, email, telefono.

3. Clic en `Confirmar Reserva`.
4. En modal de confirmacion, termina flujo.

- Esperado: mensaje `Cita registrada correctamente` y modal con detalle.

5. Vuelve al admin > `Citas`:

- Esperado: la nueva cita aparece en tabla.

## 3.1 Pago con tarjeta real

1. En modal de pago, elige `Tarjeta`.
2. Ingresa titular y completa tarjeta en el formulario de Stripe.
3. Confirma pago.

- Esperado: mensaje `Pago aprobado y cita registrada`.

4. En admin > `Citas`:

- Esperado: `Pago` en estado `Pagado` con metodo `Tarjeta`.

## 3.2 Pago por transferencia + comprobante

1. En modal de pago, elige `Transferencia`.
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

5. Verifica cifrado en reposo (si activaste `PIELARMONIA_DATA_ENCRYPTION_KEY`):

- `data/store.json` debe iniciar con prefijo `ENCv1:`.

6. Verifica cabeceras HTTP de seguridad en Home:

- `Content-Security-Policy`
- `X-Content-Type-Options`
- `Referrer-Policy`

7. Verifica politica de cache:

- assets estaticos versionados (`script.js`, `styles.css`, `chat-engine.js`, `booking-engine.js`) deben incluir `Cache-Control` con `max-age`.
- `api.php?resource=health` debe incluir `Cache-Control` con `no-store`/`no-cache`.

## 9. Prueba de regresion rapida (5 min)

Opcional automatizado (PowerShell):

- `.\SMOKE-PRODUCCION.ps1 -Domain "https://TU_DOMINIO" -TestFigoPost`
- `.\VERIFICAR-DESPLIEGUE.ps1 -Domain "https://TU_DOMINIO" -RunSmoke`
- `.\BENCH-API-PRODUCCION.ps1 -Domain "https://TU_DOMINIO" -Runs 25 -IncludeFigoPost`
- `.\GATE-POSTDEPLOY.ps1 -Domain "https://TU_DOMINIO" -RequireWebhookSecret`
- Si estas en mantenimiento y aceptas chat degradado temporalmente:
    - `.\SMOKE-PRODUCCION.ps1 -Domain "https://TU_DOMINIO" -TestFigoPost -AllowDegradedFigo -AllowRecursiveFigo`

1. Home carga sin errores.
2. Menu y scroll funcionan.
3. Modales abren/cierran.
4. Agendamiento completo.
5. Admin login + vista de citas.
6. Chatbot responde.

## 10. Si algo falla

1. Revisa consola del navegador (F12).
2. Revisa respuesta de:

- `api.php?resource=health`
- `admin-auth.php?action=status`
- `figo-chat.php`

3. Revisa permisos de `data/`.
4. Verifica variables de entorno.
