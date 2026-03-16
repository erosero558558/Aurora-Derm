# Disaster Recovery Plan - Piel en Armonía

Este documento describe los procedimientos de recuperación ante desastres (DR) para Piel en Armonía, específicamente para la restauración de datos críticos (`store.json`).

## Estrategia de Backup

- **RPO (Recovery Point Objective):** 24 horas. (Pérdida máxima aceptable de datos).
- **RTO (Recovery Time Objective):** 4 horas. (Tiempo máximo para restaurar el servicio).

## Identificación de Desastre

El plan cubre:

1.  **Código Fuente:** Repositorio Git.
2.  **Configuración:** Variables de entorno y `env.php`.
3.  **Datos:** Archivo `data/store.json` (Citas, Reseñas, Callbacks).

## Procedimiento de Restauración (Automático)

### 3.1 Datos (`store.json`)

La aplicación realiza automáticamente copias de seguridad rotativas en `data/backups/` cada vez que se escribe en el almacén de datos (citas nuevas, actualizaciones). Se guardan hasta 30 versiones anteriores.

### Requisitos

- Acceso SSH al servidor.
- PHP CLI instalado.
- Un archivo de backup válido (JSON).

Adicionalmente, el cron soporta:

- `action=backup-health` para validar frescura/integridad del último backup.
- `action=backup-offsite` para crear snapshot y replicarlo a un endpoint externo.

Variables recomendadas:

- `PIELARMONIA_BACKUP_MAX_AGE_HOURS`
- `PIELARMONIA_BACKUP_OFFSITE_URL`
- `PIELARMONIA_BACKUP_OFFSITE_TOKEN`
- `PIELARMONIA_BACKUP_OFFSITE_TIMEOUT_SECONDS`

### 3.2 Código

El código fuente reside en GitHub y se despliega mediante GitHub Actions. El repositorio es la fuente de verdad para la aplicación.

### 3.3 Configuración

Las credenciales y claves de API (Stripe, SMTP, Admin Pass) deben estar documentadas en el gestor de contraseñas del equipo y configuradas como Secrets en el repositorio.

## 4. Procedimientos de Restauración

### Escenario 1: Corrupción de Datos (Error lógico o borrado accidental)

**Síntoma:** La aplicación muestra datos incorrectos o vacíos, o error de JSON.

**Pasos:**

1.  Acceder al servidor vía SFTP/SSH.
2.  Navegar a `data/backups/`.
3.  Identificar el archivo de backup más reciente con tamaño y fecha correctos (antes del incidente).
4.  Detener temporalmente el tráfico (renombrar `api.php` o usar `.htaccess` deny all).
5.  Copiar el backup seleccionado a `data/store.json`.
    ```bash
    sudo -u www-data php bin/restore-backup.php <ruta_al_archivo_backup>
    ```
    Ejemplo:
    ```bash
    sudo -u www-data php bin/restore-backup.php data/backups/store-20231027-100000-a1b2c3.json
    ```
    _Nota: Ejecutar como `www-data` asegura que los permisos del archivo restaurado sean correctos para el servidor web._

### Escenario 2: Pérdida Total del Servidor (Hosting caído o borrado)

**Síntoma:** El servidor no responde y no es recuperable.

**Pasos:**

1.  **Provisionar Nuevo Servidor:** Contratar nuevo hosting compatible con PHP 7.4+.
2.  **Configurar Entorno:**
    - Subir archivos del proyecto (ver `docs/DEPLOY_HOSTING_PLAYBOOK.md`).
    - Configurar variables de entorno (desde gestor de contraseñas).
    - Asegurar permisos de escritura en `data/`.
3.  **Restaurar Datos:**
    - Si se tiene copia local reciente de `store.json`, subirla a `data/`.
    - Si no, contactar al proveedor de hosting anterior para intentar recuperar backups de sistema.
4.  **Redirigir DNS:** Apuntar el dominio `pielarmonia.com` a la nueva IP.
5.  **Verificación:** Ejecutar `scripts/ops/prod/GATE-POSTDEPLOY.ps1`.
    Implementacion canonica: `scripts/ops/prod/GATE-POSTDEPLOY.ps1`.

### Escenario 3: Compromiso de Seguridad (Hackeo)

**Síntoma:** Archivos modificados, admin password comprometida.

**Pasos:**

1.  **Aislar:** Cambiar contraseñas de hosting y base de datos (si aplica).
2.  **Limpiar:** Borrar todo el contenido del servidor `public_html`.
3.  **Redesplegar:** Realizar un despliegue limpio desde el repositorio Git confiable.
4.  **Rotar Secretos:** Cambiar `PIELARMONIA_ADMIN_PASSWORD`, claves de Stripe, SMTP, etc.
5.  **Auditar Datos:** Revisar `store.json` línea por línea para asegurar que no hay inyecciones o datos falsos.

6.  **Detener el servidor web** (opcional pero recomendado para evitar escrituras concurrentes).
7.  **Respaldar el archivo actual:**
    ```bash
    cp data/store.json data/store.json.bak
    ```
8.  **Copiar el backup:**
    ```bash
    cp <ruta_al_backup> data/store.json
    ```
    Nota: Si el backup está en formato raw (copia directa), esto funcionará. Si es un snapshot offsite, asegúrese de que sea compatible (el sistema maneja automáticamente el cifrado al leer, siempre que la clave de cifrado sea la misma).
9.  **Verificar permisos:**
    ```bash
    chmod 664 data/store.json
    chown www-data:www-data data/store.json
    ```
10. **Reiniciar el servidor web** si fue detenido.

Se recomienda realizar un simulacro de restauración semestralmente:

1.  Descargar el último backup de producción.
2.  Levantar un servidor local (`php -S 127.0.0.1:8011 -t . bin/local-stage-router.php`).
3.  Cargar el backup en el entorno local.
4.  Verificar que las citas y reseñas se cargan correctamente.
    Validar tambien `http://127.0.0.1:8011/`,
    `http://127.0.0.1:8011/es/` y `http://127.0.0.1:8011/admin.html`.
    Si se automatiza la validación, reutilizar `TEST_BASE_URL` para apuntar
    las suites al host restaurado.
5.  Si hay offsite configurado, probar restauración desde snapshot offsite al menos una vez por trimestre.
