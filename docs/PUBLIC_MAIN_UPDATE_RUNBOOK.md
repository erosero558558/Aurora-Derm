# Public Main Update Runbook

Runbook validado en produccion el `2026-03-02` para actualizar la pagina principal y el shell publico sin depender del deploy por GitHub Actions.

## Objetivo

Tener un camino corto y repetible para publicar `origin/main` en el VPS/OpenClaw cuando el hosting no sincroniza solo o cuando hay que confirmar el deploy manualmente.

## Servidor validado

- repo: `/var/www/figo`
- deploy sync existente: `/root/sync-pielarmonia.sh`
- lock de sync: `/tmp/sync-pielarmonia.lock`
- log de sync: `/var/log/sync-pielarmonia.log`
- cron productivo validado:

```cron
* * * * * /usr/bin/flock -n /tmp/sync-pielarmonia.lock /root/sync-pielarmonia.sh >> /var/log/sync-pielarmonia.log 2>&1
```

## Camino recomendado

### 1. Corregir permisos del deploy script si falla el sync

```bash
chmod +x /var/www/figo/bin/deploy-public-v3-live.sh
```

Motivo: el sync validado del servidor llama a `bin/deploy-public-v2-live.sh`, y ese shim delega a `bin/deploy-public-v3-live.sh`. Si `deploy-public-v3-live.sh` no es ejecutable, el cron entra en bucle con `Permission denied`.

### 2. Forzar un sync manual inmediato

```bash
/usr/bin/flock -n /tmp/sync-pielarmonia.lock /root/sync-pielarmonia.sh
```

Resultado esperado:

- `HEAD is now at <sha>`
- `== Astro build ==`
- `== Public verify ==`
- `Commit actual: <sha>`
- `Deploy completado en <sha>`

### 3. Activar flags del admin si el codigo ya esta publicado pero `sony_v3` sigue apagado

```bash
php -r "require '/var/www/figo/lib/features.php'; FeatureFlags::enable('admin_sony_ui'); FeatureFlags::enable('admin_sony_ui_v3'); print_r(FeatureFlags::getAll());"
```

### 4. Verificar desde el servidor

```bash
tail -n 20 /var/log/sync-pielarmonia.log
curl -s https://pielarmonia.com/api.php?resource=features
curl -I https://pielarmonia.com/
curl -I https://pielarmonia.com/admin.html
```

Señales sanas:

- el log termina con `Sin cambios` despues del deploy
- `api.php?resource=features` incluye `admin_sony_ui_v3:true`
- `/` responde `301` a `/es/`
- `admin.html` responde `200`

## Cuando solo quieres acelerar el auto-sync

No crear un cron nuevo si el servidor ya tiene `/root/sync-pielarmonia.sh`.

Solo ajustar la frecuencia del job existente:

```bash
cat >/tmp/root.cron <<'EOF'
*/5 * * * * /root/uptime-monitor.sh
* * * * * /root/send-telegram-alert.sh >> /tmp/alert-output 2>&1
*/5 * * * * /root/pielarmonia-check.sh >> /tmp/pielarmonia-alerts.log 2>&1
0 18 * * * curl -s "https://pielarmonia.com/cron.php?action=reminders&token=pa_cron_2026_s3cur3_r4nd0m" >> /var/log/pielarmonia-cron.log 2>&1
* * * * * /usr/bin/flock -n /tmp/sync-pielarmonia.lock /root/sync-pielarmonia.sh >> /var/log/sync-pielarmonia.log 2>&1
EOF

crontab /tmp/root.cron
crontab -l
rm -f /tmp/root.cron
```

## Errores reales que ya costaron tiempo

### 1. Bracketed paste roto

Si el terminal muestra `^[[200~`, no pegues bloques enteros. Ese prefijo rompe comandos simples como `cd` o `ls`.

### 2. `sed` rompiendo el `crontab`

Dentro del reemplazo de `sed`, `&` inserta el texto matcheado. Por eso un `2>&1` sin escapar puede corromper la linea del cron.

Si hay que corregir `crontab`, reescribirlo completo es mas seguro que hacer reemplazos inline.

### 3. Logs historicos

`tail` puede mostrar errores viejos aunque el deploy actual ya haya pasado. El indicador importante es la ultima linea reciente del log.

## Cierre rapido

Si hay drift:

```bash
chmod +x /var/www/figo/bin/deploy-public-v3-live.sh
/usr/bin/flock -n /tmp/sync-pielarmonia.lock /root/sync-pielarmonia.sh
php -r "require '/var/www/figo/lib/features.php'; FeatureFlags::enable('admin_sony_ui'); FeatureFlags::enable('admin_sony_ui_v3');"
tail -n 20 /var/log/sync-pielarmonia.log
curl -s https://pielarmonia.com/api.php?resource=features
```
