# Guía de Seguridad

La seguridad es una prioridad crítica para Piel en Armonía, especialmente considerando el manejo de datos de pacientes (PII) y pagos.
Si necesitas ubicar el flujo correcto antes de actuar, empieza por `docs/OPERATIONS_INDEX.md`.

## Políticas de Seguridad

### 1. Gestión de Secretos

- Nunca almacenar claves API, contraseñas o tokens en el código fuente.
- Utilizar variables de entorno (`.env` local, Config Vars en producción).
- El archivo `env.php` (si se usa) está estrictamente excluido en `.gitignore`.

### 2. Protección de Datos en Reposo

Los datos sensibles almacenados en disco (`store.json`) se cifran automáticamente.

- **Algoritmo:** Cifrado simétrico robusto (implementado en `lib/storage.php`).
- **Clave:** `PIELARMONIA_DATA_ENCRYPTION_KEY` (Variable de entorno obligatoria en producción).
- **Enforcement explícito:** `PIELARMONIA_REQUIRE_DATA_ENCRYPTION=true` obliga a que `health` y readiness reporten incumplimiento si el fallback JSON queda en texto plano.
- **Permisos:** El directorio `data/` tiene permisos `775` y un `.htaccess` que deniega todo acceso web directo (`Deny from all`).

#### Checklist exacto de host para validar cifrado

Ejecuta la verificación desde el host o por un canal con token de diagnostics:

```bash
curl -s http://127.0.0.1/api.php?resource=health-diagnostics
```

Se considera correcto cuando el payload reporta:

- `storeEncryptionConfigured=true`
- `storeEncryptionRequired=true` en producción si quieres enforcement explícito
- `storeEncryptionStatus=encrypted` (o `not_applicable` si el runtime no usa JSON fallback)
- `storeEncryptionCompliant=true`

Si el payload sigue mostrando `storeEncryptionStatus=plaintext` o `storeEncryptionCompliant=false`:

1. Configura `PIELARMONIA_DATA_ENCRYPTION_KEY` en la fuente real de variables del host.
2. Activa `PIELARMONIA_REQUIRE_DATA_ENCRYPTION=true` cuando el entorno de producción no lo derive automáticamente.
3. Recarga PHP/web server según el host.
4. Repite `health-diagnostics` hasta ver `storeEncryptionCompliant=true`.

### 3. Cabeceras de Seguridad (HTTP Headers)

La aplicación envía cabeceras de seguridad estrictas en cada respuesta (configurado en `lib/http.php`):

- `Strict-Transport-Security` (HSTS): Fuerza HTTPS.
- `X-Content-Type-Options: nosniff`: Evita mime-sniffing.
- `X-Frame-Options: SAMEORIGIN`: Previene clickjacking.
- `Content-Security-Policy` (CSP): Restringe fuentes de scripts, estilos e imágenes para mitigar XSS.

### 4. Validación de Entrada

Toda entrada de usuario se valida y sanitiza antes de ser procesada (`lib/validation.php`).

- **Emails:** `filter_var(..., FILTER_VALIDATE_EMAIL)`
- **Teléfonos:** Regex estricto y limpieza de caracteres no numéricos.
- **HTML:** Escapado en salida (`htmlspecialchars`) para prevenir XSS reflejado.

### 5. Rate Limiting

La API pública está protegida contra abusos mediante límites de velocidad por IP (Ver `docs/API.md` y `lib/ratelimit.php`).

## Respuesta a Incidentes de Seguridad

Si descubres una vulnerabilidad, por favor sigue estos pasos:

1.  **NO** abras un Issue público en GitHub.
2.  Envía un reporte detallado a `seguridad@pielarmonia.com` (o al contacto técnico designado).
3.  Incluye pasos para reproducir el fallo de manera segura.
4.  Espera confirmación antes de divulgar información.

### Checklist Pre-Despliegue de Seguridad

- [ ] `PIELARMONIA_DATA_ENCRYPTION_KEY` configurada y rotada si es necesario.
- [ ] `PIELARMONIA_REQUIRE_DATA_ENCRYPTION=true` en producción si el entorno no publica `APP_ENV=production`.
- [ ] `health-diagnostics` confirma `storeEncryptionStatus` y `storeEncryptionCompliant=true`.
- [ ] `PIELARMONIA_ADMIN_PASSWORD` es fuerte y única.
- [ ] Dependencias (`npm audit`) verificadas sin vulnerabilidades críticas.
- [ ] Permisos de archivos en servidor (`chmod`) son restrictivos (especialmente `data/`).
