# Runbook Turnero Sala (Kiosco + Admin + TV)

## Objetivo

Operacion estable del turnero de sala para 2 consultorios con cola unica, llamado manual desde admin y visualizacion en TV.

## Superficies operativas

- `kiosco-turnos.html`: check-in/captura de turno y asistente de sala.
- `admin.html#queue`: llamado C1/C2, acciones de ticket y reimpresion.
- `sala-turnos.html`: panel de llamados en vivo para pacientes.

## Politica de privacidad

- En TV solo mostrar `ticket + iniciales + consultorio`.
- No exponer telefono completo ni nombre completo fuera de admin.

## Modo normal

1. Operador abre `admin.html` y valida:
    - `#queueSyncStatus` en `live` o `reconnecting`.
    - KPIs de espera/llamados coherentes.
    - Panel `Control de estación` visible con `Estación C1` o `Estación C2`.
2. En kiosco, validar:
    - `#queueConnectionState` en `live`.
    - `#queuePrinterHint` sin errores persistentes.
3. En TV, validar:
    - `#displayConnectionState` en `live`.
    - campanilla activa si se requiere audio.

## Provisionamiento por estación (2 PCs)

Configurar cada computadora una sola vez en navegador estable (no incógnito):

1. PC consultorio 1:
    - abrir `admin.html?station=c1&lock=1`
2. PC consultorio 2:
    - abrir `admin.html?station=c2&lock=1`
3. El sistema guarda localmente:
    - `queueStationMode=locked`
    - `queueStationConsultorio=1|2`
4. Después del primer arranque, la URL se limpia automáticamente (`history.replaceState`) y la estación queda persistida en `localStorage`.

Recuperación rápida (si borran caché o cambian navegador):

1. Repetir URL de provisión de la estación correspondiente.
2. Confirmar en panel `Control de estación`:
    - badge `Estación C1/C2`
    - estado `Bloqueado`.

## Contingencias

### Impresora degradada o desconectada

- El ticket se crea aunque no imprima.
- Admin puede reimprimir por fila (`Reimprimir`) o en bloque (`Reimprimir visibles`).
- Si falla reimpresion:
    - revisar red/host/puerto de termica,
    - mantener operacion manual con codigo de ticket en pantalla.

### Backend o red inestable

- Kiosco:
    - guarda solicitudes en outbox offline,
    - sincroniza al reconectar (`Sincronizar pendientes`).
- TV/Admin:
    - usan estado degradado/reconnecting y respaldo local cuando aplique.
    - en Admin, si entra fallback por `queue-state`, la tabla puede mostrar una muestra parcial (top de espera + llamados activos) y lo indica como `fallback parcial`.
- Si la degradacion supera 5 minutos:
    - operar llamado por recepcion,
    - reintentar sincronizacion manual.

## Atajos operativos

### Admin (seccion queue)

- `Alt+Shift+J`: llamar C1
- `Alt+Shift+K`: llamar C2
- `Alt+Shift+U`: refrescar cola
- `Alt+Shift+F`: foco en busqueda
- `Alt+Shift+L`: filtro SLA
- `Alt+Shift+G/H/B`: bulk completar/no_show/cancelar
- `Alt+Shift+P`: reimprimir tickets visibles
- `Numpad Enter`: llamar siguiente del consultorio de la estación activa
- `Numpad 1/2`: solo en modo libre, seleccionar consultorio objetivo

Reglas operativas de estación:

- En `modo bloqueado`, atajos de teclado (`Numpad Enter`, `Alt+Shift+J/K`) llaman solo el consultorio asignado.
- Si intentan cambiar consultorio en lock, se muestra toast `Cambio bloqueado por modo estación`.
- El botón manual del consultorio opuesto permanece disponible como override explícito y muestra aviso operativo.
- `Enter` normal (teclado principal) no dispara llamado de turnos.

### Kiosco

- `Alt+Shift+R`: refrescar cola
- `Alt+Shift+L`: limpiar sesion
- `Alt+Shift+Y`: sincronizar outbox
- `Alt+Shift+K`: limpiar outbox

### TV

- `Alt+Shift+R`: refrescar panel
- `Alt+Shift+M`: mutear/activar campanilla
- `Alt+Shift+X`: limpiar snapshot local

## Smoke QA recomendado

1. `npx playwright test tests/admin-queue.spec.js`
2. `npx playwright test tests/queue-kiosk.spec.js`
3. `npx playwright test tests/queue-display.spec.js`
4. `npx playwright test tests/queue-integrated-flow.spec.js`

## Señales de observabilidad funcional (frontend)

Se emiten eventos `CustomEvent('piel:queue-ops')` para telemetria UI (best effort):

- `surface=admin|kiosk|display`
- estado de conexion/recovery
- resultados de reimpresion
- sincronizacion offline/snapshot
- acciones operativas (llamado, bulk, render update)

## Criterio de salida operativa

- Admin/kiosco/TV sin error critico bloqueante.
- Reimpresion individual o en bloque disponible.
- Outbox offline funcional con dedupe.
- QA de turnero en verde en CI.
