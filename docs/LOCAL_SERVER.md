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
- API health: `http://127.0.0.1:8011/api.php?resource=health`
- Bot endpoint: `http://127.0.0.1:8011/figo-chat.php`

## Variables de entorno requeridas para login admin

- `PIELARMONIA_ADMIN_PASSWORD`: contraseña del panel admin.
- `PIELARMONIA_ADMIN_PASSWORD_HASH`: hash de contraseña (opcional, prioridad sobre la contraseña en texto).
- `PIELARMONIA_EMAIL_FROM`: remitente para correos de confirmacion.
- `PIELARMONIA_DATA_DIR`: ruta local de datos (opcional).
- `FIGO_CHAT_ENDPOINT`: URL del backend real de Figo (si quieres IA real).
- `FIGO_CHAT_TOKEN`: token Bearer opcional para autenticar contra Figo.

Alternativa sin variables de entorno:

- Crea `data/figo-config.json` con `endpoint` y credenciales opcionales.

Nota:

- Ya no existe fallback `admin123`. Debes definir una de las dos variables de contraseña.
- `TEST_BASE_URL` sirve para apuntar tests y pentests a otro host.
- `TEST_LOCAL_SERVER_PORT` sirve para mover el puerto local del runner Playwright.
- `npm run benchmark:local` reutiliza `TEST_BASE_URL` o levanta `127.0.0.1:8011` automaticamente.
- En el servidor PHP bare (`php -S`), `/index.html` no es la entrada canonica
  y puede responder `404`.
- Las rutas legacy como `/index.html` o `/telemedicina.html` forman parte del
  contrato de redirects en Apache/Nginx (`.htaccess`), no del entrypoint local.

## Ejemplo en PowerShell (sesión actual)

```powershell
$env:PIELARMONIA_ADMIN_PASSWORD = "tu-clave-segura"
$env:TEST_LOCAL_SERVER_PORT = "8011"
php -S 127.0.0.1:8011 -t .
```
