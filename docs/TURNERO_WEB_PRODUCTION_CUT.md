# Turnero Web Production Cut

## Objetivo

Cerrar un `piloto web por clínica` del turnero que pueda operar una clínica real sin depender del hub experto, instaladores nativos ni multi-tenant compartido.

## Superficies canónicas

- `admin.html#queue`
- `operador-turnos.html`
- `kiosco-turnos.html`
- `sala-turnos.html`

## Perfil por clínica

Cada despliegue usa un perfil propio en `content/turnero/clinic-profile.json`.

Contrato mínimo:

- `schema`
- `clinic_id`
- `branding.name`
- `branding.short_name`
- `branding.base_url`
- `consultorios.c1.label`
- `consultorios.c2.label`
- `surfaces.admin|operator|kiosk|display.enabled`
- `surfaces.admin|operator|kiosk|display.route`
- `release.mode=web_pilot`
- `release.admin_mode_default=basic`
- `release.separate_deploy=true`
- `release.native_apps_blocking=false`

## Admin modes

- `basic`
  - default de producción
  - deja visibles cola, consultorios, resolución, heartbeats, incidentes directos y checklist útil
- `expert`
  - reabre simulación, coaching, descarga e instalación avanzada
  - no bloquea el piloto

## Contrato mínimo de producción

- cola visible y consistente
- llamado por consultorio
- completar / no-show / liberar
- reimpresión
- kiosco creando tickets y check-in
- sala reflejando llamados
- `queueSurfaceStatus` sano para `operator`, `kiosk` y `display`
- `GET /api.php?resource=data` expone `turneroClinicProfile`

## Fuera del corte

- instaladores Electron
- APK Android TV como requisito de salida
- centro de descargas como flujo principal
- multi-tenant compartido entre clínicas
- agenda pública, WhatsApp, pagos y suite comercial ampliada

## Validación mínima

- smoke de `admin`, `operador`, `kiosco` y `sala`
- journey `con cita`
- journey `sin cita`
- operador llama, re-llama, completa y marca `no_show`
- `public_main_sync` sano y commit desplegado verificable
