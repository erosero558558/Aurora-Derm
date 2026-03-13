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
La fuente canónica de perfiles vive en `content/turnero/clinic-profiles/*.json`, y el perfil activo se prepara con `node bin/turnero-clinic-profile.js stage --id <clinic_id>`.

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
- operador, kiosco y sala muestran branding/contexto de la clínica activa
- operador, kiosco y sala degradan la operación si la ruta activa no coincide con la ruta canónica declarada en el perfil
- `admin.html#queue` en `basic` también debe bloquear llamadas, acciones por ticket, bulk, cambios de estación y numpad si carga un `clinic-profile` inválido o fuera de canon
- operador y kiosco bloquean acciones reales si la superficie cae en `perfil de respaldo` o `ruta fuera de canon`
- sala bloquea polling, snapshot y visualización de llamados si la superficie cae en `perfil de respaldo` o `ruta fuera de canon`
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

## Gate visible en admin

En `admin.html#queue`, dentro del dominio `deployment`, el bloque `queueOpsPilotReadiness` es el gate visible del piloto.

El mismo panel debe mostrar además el `canon web por clínica`, con las cuatro rutas activas (`admin`, `operator`, `kiosk`, `display`) resueltas desde `branding.base_url` + `surfaces.*.route`.

Cada superficie del canon debe quedar en uno de estos estados visibles:

- `Verificada`: la ruta activa coincide con la ruta canónica declarada.
- `Declarada`: la ruta ya está en perfil, pero todavía no hay verificación viva desde heartbeat.
- `Bloquea`: el heartbeat reporta otra ruta o la superficie está fuera del canon.

Ese mismo panel debe exponer una `secuencia repetible de smoke`, con enlaces directos por clínica para `admin`, `operator`, `kiosk`, `display` y el cierre end-to-end del llamado final.

Además debe exponer un `paquete de apertura` copiable con `clinic_id`, origen del perfil (`remoto` vs `fallback local`), modo de release, commit desplegado, verificación del canon, `bloqueo activo` y progreso del smoke, además de las rutas canónicas de la clínica.

Además debe exponer `bloqueos de salida`: una lista corta y accionable con solo lo que todavía frena el go-live (`perfil`, `publicación`, `heartbeats`, `canon` o `smoke`), con enlaces directos a la superficie o chequeo que toca resolver.

La evidencia local del piloto (`opening checklist`, `relevo`, `bitácora`) debe quedar aislada por `clinic_id`. Si el navegador carga otra clínica, esos bloques deben reiniciarse y no arrastrar confirmaciones de una sede anterior.

La misma regla aplica al estado operativo persistido del hub (`filtro de bitácora`, `alertas revisadas`, `focus mode`, `playbook`, `dominio del hub` y `lookup de ticket`). Ninguna de esas ayudas puede sobrevivir al cambio de clínica.

El runtime operativo del queue en admin también debe ser clínico: `station lock`, `consultorio activo`, `1 tecla`, panel de atajos, tecla externa calibrada y `queueAdminLastSnapshot` no pueden contaminar otra clínica. Si cambias de `clinic_id`, deben cargarse solo los valores de esa clínica.

El heurístico de `smoke final` también debe ser clínico: la actividad local del admin solo cuenta si el llamado/rellamado reciente pertenece al `clinic_id` activo. Actividad heredada o sin `clinicId` no puede dejar el piloto en verde.

La misma regla aplica a las superficies web canónicas: `queueDisplayBellMuted`, `queueDisplayLastSnapshot`, `queueKioskSeniorMode`, `queueKioskPrinterState` y `queueKioskOfflineOutbox` deben persistirse por `clinic_id`. Una TV o kiosco no puede heredar preferencias, respaldo local ni pendientes offline de otra clínica.

Además, `operador-turnos.html`, `kiosco-turnos.html` y `sala-turnos.html` deben exponer un estado visible de perfil por clínica para el personal local: `Perfil remoto verificado` cuando la superficie carga el perfil correcto, y `Bloqueado` cuando cae a `perfil de respaldo` o a una `ruta fuera de canon`.
En `operador` y `kiosco`, ese estado no puede ser solo informativo: debe impedir llamados, check-ins, turnos nuevos y cola offline mientras el perfil siga inválido.
En `sala`, el mismo estado debe detener `queue-state`, ignorar snapshot local y mostrar `Pantalla bloqueada`, nunca llamados de otra clínica o de una ruta fuera de canon.

Comandos operativos del perfil por clínica:

- `node bin/turnero-clinic-profile.js list --json`
- `node bin/turnero-clinic-profile.js validate --id <clinic_id> --json`
- `node bin/turnero-clinic-profile.js stage --id <clinic_id> --json`
- `node bin/turnero-clinic-profile.js status --json`

Debe evaluar seis señales antes de abrir una clínica real:

- `perfil por clínica`
- `perfil catalogado`
- `superficies web canónicas`
- `publicación del release`
- `señal viva + heartbeats`
- `smoke final del turno`

Además, `perfil por clínica` solo cuenta como listo si viene del servidor; un perfil servido desde `fallback local` debe bloquear el go-live aunque la UI conserve contexto.
Además, `perfil catalogado` solo cuenta como listo si el `clinic-profile.json` activo coincide byte a byte con una entrada válida bajo `content/turnero/clinic-profiles/*.json`; si no, el deploy sigue dependiendo de edición manual y el piloto debe quedar bloqueado.
Si un heartbeat de `operator`, `kiosk` o `display` reporta un `clinic_id` distinto al del perfil activo, el canon del piloto debe pasar a `Bloquea` aunque la ruta sea correcta.
Si el heartbeat trae la misma clínica pero una `firma` de perfil distinta, también debe bloquearse: eso indica una superficie con configuración vieja frente al perfil activo.

Si una clínica queda en `casi listo` o `bloqueado`, no se toma como release operativo aunque la cola siga respondiendo.
