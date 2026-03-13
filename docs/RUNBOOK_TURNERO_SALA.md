# Runbook Turnero Sala (Operador + Kiosco + Admin + TV)

## Objetivo

Operacion estable del turnero de sala para 2 consultorios con cola unica, llamado desde operador/admin y visualizacion en TV.

## Corte web de produccion

Este release sale como `piloto web por clinica`, no como suite nativa completa.

Canon operativo del corte:

- `admin.html#queue` en `basic` por defecto para operar la cola sin ruido del hub largo.
- `operador-turnos.html` como superficie canónica de llamado/cierre por consultorio.
- `kiosco-turnos.html` para check-in y turnos `con cita` / `sin cita`.
- `sala-turnos.html` para visualización en vivo en sala o TV.

Notas del corte:

- `expert` conserva paneles avanzados de coaching, simulación y recepción, pero no bloquea el piloto.
- Antes de abrir una clínica real, usa `queueOpsPilotReadiness` en dominio `deployment` como gate de salida. Debe quedar en `Piloto web listo para abrir` y confirmar `publicación del release`; si no, resuelve los bloqueos marcados allí antes del primer turno.
- El ítem `Perfil por clínica` solo cuenta como listo si viene del servidor. Si el panel habla de perfil `cacheado localmente`, no abras la clínica aunque el resto del dashboard siga visible.
- El ítem `Perfil catalogado` debe quedar en `Listo` antes del go-live. Si aparece `desalineado` o `sin entrada catalogada`, vuelve a preparar `content/turnero/clinic-profile.json` desde `content/turnero/clinic-profiles/*.json` y no abras la clínica todavía.
- En el mismo shell, revisa `queueOpsPilotIssues`: debe dejar una lista corta de `Bloqueos de salida`. Si algo aparece en `Bloquea`, resuélvelo primero y vuelve recién después al smoke final.
- En el mismo bloque valida `queueOpsPilotCanon`: debe listar las cuatro rutas web activas de esa clínica (`admin`, `operador`, `kiosco`, `sala`) antes de compartir accesos al equipo local.
- Dentro de ese canon, cada superficie debe quedar como `Verificada`, `Declarada` o `Bloquea`; si aparece `Bloquea`, el piloto no abre hasta corregir la ruta reportada por heartbeat.
- Lo mismo aplica para identidad de clínica: si `operator`, `kiosco` o `sala` reportan un `clinic_id` distinto al del perfil activo, trátalo como mezcla de entornos y no abras la clínica.
- Si el `clinic_id` coincide pero la superficie reporta otra `firma` de perfil, trátalo como un equipo desactualizado: vuelve a desplegar o refrescar esa superficie antes del go-live.
- Debajo del canon, valida `queueOpsPilotSmoke`: debe dejar visible una secuencia repetible con enlaces directos por clínica para `admin`, `operador`, `kiosco`, `sala` y el cierre del llamado final antes del go-live.
- Usa `queueOpsPilotHandoffCopyBtn` para copiar el paquete de apertura por clínica cuando necesites pasar el estado del piloto a recepción, operación o soporte sin resumirlo a mano. Ese paquete ya debe decir si el perfil viene `remoto verificado` o `fallback local`.
- Ese mismo paquete también debe decir si el perfil quedó `catalogado` (`*.json verificado`) o si sigue `desalineado`; úsalo para detectar enseguida un deploy separado mal preparado.
- Ese mismo paquete ya debe incluir `Bloqueo activo`; úsalo como primera línea del handoff para que el segundo equipo vea de inmediato qué sigue frenando el go-live.
- `queueOpeningChecklistV1`, `queueShiftHandoffV1` y `queueOpsLogV1` ahora se consideran válidos solo para la clínica activa. Si cambias de `clinic_id`, esos bloques deben reiniciarse aunque sigan siendo del mismo día.
- Lo mismo aplica a `queueOpsLogFilterV1`, `queueOpsAlertsV1`, `queueOpsFocusModeV1`, `queueOpsPlaybookV1`, `queueHubDomainViewV1` y `queueTicketLookupV1`: si cambias de clínica, el hub debe volver a estado limpio antes de operar.
- El runtime operativo del admin también queda acotado por clínica: `queueStationMode`, `queueStationConsultorio`, `queueOneTapAdvance`, `queueNumpadHelpOpen`, `queueCallKeyBindingV1` y `queueAdminLastSnapshot` deben leerse solo para la clínica activa.
- La sugerencia automática de `smoke final` también ignora actividad local de otra clínica. Un `Llamado C1 ejecutado` heredado de otra sede o sin `clinicId` ya no sirve para abrir el piloto.
- La TV y el kiosco también deben quedar aislados por clínica: `queueDisplayBellMuted`, `queueDisplayLastSnapshot`, `queueKioskSeniorMode`, `queueKioskPrinterState` y `queueKioskOfflineOutbox` solo pueden leerse para la clínica activa. Si cambias `clinic_id`, no reutilices mute, snapshot, termal ni outbox de otra sede.
- Verifica también las superficies reales: `operador-turnos.html`, `kiosco-turnos.html` y `sala-turnos.html` deben mostrar branding y contexto de la clínica activa, no nombres genéricos de otra sede.
- En esas mismas superficies debe verse un estado corto de perfil: `Perfil remoto verificado` para operar y `Bloqueado` si cargaron `perfil de respaldo` o una `ruta fuera de canon`.
- Si alguna superficie carga una ruta distinta a la declarada en `clinic-profile.json`, debe pasar a estado visible de bloqueo (`Ruta del piloto incorrecta`) antes de operar.
- En `operador-turnos.html` y `kiosco-turnos.html`, ese bloqueo debe detener la operación real: no deben llamar tickets, registrar check-ins, crear turnos ni guardar outbox offline mientras el perfil siga inválido.
- En `sala-turnos.html`, ese bloqueo también debe ser duro: la TV no debe consultar `queue-state`, restaurar snapshot ni mostrar llamados mientras el perfil siga inválido.
- En `admin.html#queue`, el bloqueo también debe ser duro: si el admin carga `perfil de respaldo` o `ruta fuera de canon`, no debe llamar cola, ni ejecutar acciones por ticket, ni operar el numpad hasta corregir el perfil.
- `app-downloads/`, Electron y Android TV quedan como `siguiente release`; no son requisito para el go-live web.
- Cada clínica debe desplegar su propia copia con `content/turnero/clinic-profile.json` dedicado; no hay runtime multi-tenant compartido en este corte.
- La fuente canónica de esos perfiles ahora vive en `content/turnero/clinic-profiles/*.json`. Antes del deploy, prepara el perfil activo con `node bin/turnero-clinic-profile.js stage --id <clinic_id>`.
- Usa `node bin/turnero-clinic-profile.js validate --id <clinic_id>` para validar branding, rutas canónicas y `separate_deploy=true` antes de publicar.

## Superficies operativas

- `kiosco-turnos.html`: check-in/captura de turno y asistente de sala.
- `operador-turnos.html`: flujo diario con numpad, lock por estación y acciones rápidas.
- `admin.html#queue`: operación de respaldo y administración; `basic` por defecto, `expert` solo para soporte avanzado.
- `sala-turnos.html`: panel de llamados en vivo para pacientes.

## Politica de privacidad

- En TV solo mostrar `ticket + iniciales + consultorio`.
- No exponer telefono completo ni nombre completo fuera de admin.

## Modo normal

1. Operador abre `operador-turnos.html` o `admin.html#queue` y valida:
    - `#queueSyncStatus` en `live` o `reconnecting`.
    - KPIs de espera/llamados coherentes.
    - Panel `Control de estación` visible con `Estación C1` o `Estación C2`.
2. En kiosco, validar:
    - `#queueConnectionState` en `live`.
    - `#queuePrinterHint` sin errores persistentes.
3. En TV, validar:
    - `#displayConnectionState` en `live`.
    - campanilla activa si se requiere audio.

## Flujo rapido recomendado (recepcion)

Cuando una atencion termina en consultorio:

1. Marcar cierre del ticket activo de la estacion:
    - `Numpad .` o `Numpad ,` (completar, con doble confirmacion).
2. Llamar siguiente:
    - `Numpad Enter`.
3. Si necesitas repetir aviso del mismo paciente:
    - `Numpad +` (re-llamar).

Importante:

- `Enter` del teclado principal no llama turnos.
- En estacion bloqueada (`C1` o `C2`), `Numpad Enter` llama siempre ese consultorio.
- Secuencia recomendada cuando termina una atencion: `Numpad .` -> confirmar 2 veces -> `Numpad Enter`.
- Si deseas operar en una sola pulsacion, activa `Modo 1 tecla` en `Control de estación`:
    - `Numpad Enter` completa ticket activo y llama siguiente automaticamente.
    - mantener desactivado por defecto para minimizar errores en horarios de alto flujo.
- Si tu numpad inalambrico no dispara `Numpad Enter`, usa `Calibrar tecla externa` y presiona la tecla real del dispositivo (ej. Enter externo). Se guarda por estación.

## Provisionamiento por estación (2 PCs + TV)

Configurar cada computadora una sola vez en navegador estable (no incógnito):

1. PC consultorio 1:
    - abrir `operador-turnos.html?station=c1&lock=1`
2. PC consultorio 2:
    - abrir `operador-turnos.html?station=c2&lock=1`
3. Opcional (flujo en una sola pulsación por estación):
    - usar `operador-turnos.html?station=c1&lock=1&one_tap=1` o `operador-turnos.html?station=c2&lock=1&one_tap=1`
    - recomendado solo para personal entrenado; por defecto mantener `one_tap` apagado.
4. El sistema guarda localmente:
    - `queueStationMode=locked`
    - `queueStationConsultorio=1|2`
    - `queueOneTapAdvance=1|0`
    - `queueCallKeyBindingV1={code,key,location}` (solo si calibras tecla externa)
5. Después del primer arranque, la URL se limpia automáticamente (`history.replaceState`) y la estación queda persistida en `localStorage`.
6. TV de sala (`TCL C655`):
    - instalar `Turnero Sala TV.apk`
    - configurar conexión por `Ethernet` si está disponible
    - validar audio/campanilla desde la app Android TV

Recuperación rápida (si borran caché o cambian navegador):

1. Repetir URL de provisión de la estación correspondiente.
2. Confirmar en panel `Control de estación`:
    - badge `Estación C1/C2`
    - estado `Bloqueado`.
    - estado `Modo 1 tecla` según operación requerida (`ON`/`OFF`).
    - si aplica, volver a calibrar `Tecla externa` con el botón `Calibrar tecla externa`.

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

### Operador / Admin (seccion queue)

- `Alt+Shift+J`: llamar C1
- `Alt+Shift+K`: llamar C2
- `Alt+Shift+U`: refrescar cola
- `Alt+Shift+F`: foco en busqueda
- `Alt+Shift+L`: filtro SLA
- `Alt+Shift+G/H/B`: bulk completar/no_show/cancelar
- `Alt+Shift+P`: reimprimir tickets visibles
- `Numpad Enter`: llamar siguiente del consultorio de la estación activa
- `Numpad +`: re-llamar ticket activo del consultorio de la estación
- `Numpad .` o `Numpad ,`: completar ticket activo del consultorio de la estación
- `Numpad -`: marcar no_show del ticket activo del consultorio de la estación
- `Numpad 0`: abrir/cerrar panel de ayuda de atajos
- `Numpad 1/2`: solo en modo libre, seleccionar consultorio objetivo
- `Esc`: cerrar panel de ayuda o guia inicial

Compatibilidad Windows/Mac (2 numpads):

- El sistema detecta numpad por `KeyboardEvent.code` y fallback `key + location=3`.
- Funciona en Windows (Chrome/Edge) y Mac (Chrome/Safari) con teclado numerico externo.
- Si una tecla no dispara accion, validar que NumLock este activo y que el foco no este en un campo de texto.
- Si el hardware reporta Enter como tecla principal (location distinta de 3), usar `Calibrar tecla externa` en esa PC para asociarla al llamado.
- En algunos layouts de Mac/ES la tecla decimal del numpad se reporta como `,` o `Delete`; ambas variantes quedan cubiertas.

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
2. `npx playwright test tests/queue-operator.spec.js`
3. `npx playwright test tests/queue-kiosk.spec.js`
4. `npx playwright test tests/queue-display.spec.js`
5. `npx playwright test tests/queue-integrated-flow.spec.js`

## Señales de observabilidad funcional (frontend)

Se emiten eventos `CustomEvent('piel:queue-ops')` para telemetria UI (best effort):

- `surface=admin|operator|kiosk|display`
- estado de conexion/recovery
- resultados de reimpresion
- sincronizacion offline/snapshot
- acciones operativas (llamado, bulk, render update)

## Criterio de salida operativa

- Operador/admin/kiosco/TV sin error critico bloqueante.
- Reimpresion individual o en bloque disponible.
- Outbox offline funcional con dedupe.
- QA de turnero en verde en CI.

## Apps operativas

Estas apps quedan preservadas como capa opcional. No bloquean el corte web estable del piloto.

Para separar operación por equipo:

- `Turnero Operador` empaqueta `operador-turnos.html` como app Electron para Windows (`.exe`) y macOS (`.dmg`).
- `Turnero Kiosco` empaqueta `kiosco-turnos.html` como app Electron para Windows (`.exe`) y macOS (`.dmg`).
- `Turnero Sala TV` vive como app Android TV nativa en `src/apps/turnero-sala-tv-android/` y carga `sala-turnos.html` dentro de un WebView controlado.
- `admin.html#queue` queda como hub de descargas, configuración y fallback operativo.
- Las superficies `Operador`, `Kiosco` y `Sala TV` ahora envían heartbeat al backend por `queue-surface-heartbeat`, y `admin.html#queue` muestra ese estado en `Equipos en vivo`.
- Mientras la sección `Turnero Sala` esté abierta y visible, `Equipos en vivo` se auto-refresca solo; si la pestaña queda oculta, el panel muestra `Auto-refresh en pausa` para evitar falsa sensación de congelamiento.
- Si una operación reciente del numpad (`completar`, `llamar siguiente`, `1 tecla`) coincide con un auto-refresh, el admin preserva primero la cola local más nueva y lo deja indicado en `Equipos en vivo`.
- Si estás interactuando con el hub (`Modo foco`, instalador, despacho o checklist), el header muestra `Protegiendo interacción` o `Refresh en espera` y difiere el repaint del hub unos instantes para no soltar botones ni mover el foco mientras haces clic.
- El panel superior del hub ahora resume `qué falta`, `qué ya está validado` y `cuál es la siguiente acción`, para que recepción no tenga que recorrer manualmente todo el dashboard.
- El hub `Apps operativas` ahora incluye un asistente para preparar `Operador`, `Kiosco` o `Sala TV` con la descarga y la ruta exacta de cada equipo.
- El asistente también incluye presets rápidos (`Operador C1`, `Operador C2`, `Operador libre`, `Kiosco`, `Sala TV`) y recuerda el último perfil en `queueInstallPresetV1`.
- El hub ahora también muestra `Prioridad viva`: un panel de alertas activas por cola/equipo que se puede marcar como revisado sin ocultar la incidencia, usando `queueOpsAlertsV1`.
- El hub ahora también muestra `Numpad en vivo`: resume la estación real del admin, lo que reporta el Operador y qué harán `Enter`, `.`, `-`, `+` y `1/2` antes de pulsarlos.
- El hub ahora también muestra una `Mesa por consultorio`: dos tarjetas `C1/C2` con ticket actual, siguiente en espera, operador esperado y accesos directos para llamar, liberar o abrir el operador correcto.
- El hub ahora también muestra `Seguimiento de atención`: dos tarjetas `C1/C2` para vigilar tickets ya llamados, cuánto tiempo llevan en consultorio, qué cola quedó detrás y si conviene `re-llamar`, `completar` o `liberar`.
- El hub ahora también muestra `Resolución rápida`: traduce cada ticket llamado a tres salidas claras (`completar`, `no_show`, `liberar`), deja visible el impacto sobre el siguiente turno y mantiene la confirmación sensible dentro del mismo hub.
- El hub ahora también muestra `Atajo por ticket`: localiza un turno por código aunque no esté visible en la tabla actual y deja a mano `reasignar`, `llamar`, `completar`, `reimprimir` o `ver en tabla` desde el mismo panel.
- El hub ahora también muestra `Ruta del ticket`: toma el turno cargado en el lookup y resume su carril real, los pasos que tiene por delante, la presión que deja detrás y dos pivotes rápidos para saltar al bloqueo o al siguiente turno relacionado.
- El hub ahora también muestra `Simulación operativa`: proyecta el efecto de la siguiente acción útil del ticket buscado (`reasignar`, `llamar`, `completar` o confirmar sensible), deja visible el cambio esperado en la cola y propone el siguiente foco a cargar antes de tocar la operación real.
- El hub ahora también muestra `Próximos turnos`: arma la secuencia inmediata de `C1`, `C2` y `cola general`, con pasos como `completar`, `llamar` o `asignar`, y deja cada ticket cargable al lookup para encadenar la siguiente jugada sin bajar a la tabla.
- El hub ahora también muestra `Ronda maestra`: toma esa misma secuencia y la ordena en una sola lista global de los siguientes movimientos más útiles del turno, para decidir qué tocar primero sin tener que comparar todos los carriles a mano.
- El hub ahora también muestra `Cobertura siguiente`: indica si `C1` y `C2` ya tienen cubierto el paciente que entra después del cierre actual o si conviene preasignar desde cola general antes de que aparezca un hueco.
- El hub ahora también muestra `Reserva inmediata`: indica si cada consultorio tiene un segundo turno ya preparado después del siguiente o si depende de cola general para no quedarse sin cola útil.
- El hub ahora también muestra `Cola general guiada`: toma los próximos tickets sin consultorio y propone a qué `C1/C2` conviene mandarlos primero según hueco inmediato, reserva y carga visible.
- El hub ahora también muestra `Proyección de cola`: toma esa misma guía de generales y deja visible cómo quedarían `C1` y `C2` si sigues esas recomendaciones, antes de tocar la operación real.
- El hub ahora también muestra `Ingresos nuevos`: simula los próximos dos ingresos sobre esa proyección y deja a mano el operador recomendado por carril si entra más gente de inmediato.
- El hub ahora también muestra `Escenarios de ingreso`: separa la recomendación inmediata de recepción entre `con cita` y `sin cita`, para abrir el operador correcto sin comparar manualmente toda la cola.
- El hub ahora también muestra `Guion de recepción`: compacta cola general, con cita, sin cita y próximo ingreso en un guion corto para mostrador.
- El hub ahora también muestra `Recepción simultánea`: resuelve cuándo llegan dos personas juntas y divide `con cita` y `sin cita` para no chocar en el mismo carril.
- El hub ahora también muestra `Semáforo de recepción`: marca por carril si recepción debe dejarlo `abierto`, `solo citas` o `contener` sin leer varios panels a la vez.
- El hub ahora también muestra `Ventana estimada`: calcula una ventana visible por consultorio para decir en mostrador cuánto tardaría en abrirse el siguiente espacio útil.
- El hub ahora también muestra `Respuesta de mostrador`: convierte la lectura operativa en frases listas para decirle al paciente sin traducir manualmente los panels.
- El hub ahora también muestra `Plan B de recepción`: deja lista una segunda ruta por `con cita` y `sin cita` si el paciente no acepta la primera sugerencia visible.
- El hub ahora también muestra `Objeciones rápidas`: responde en un clic a “quiero lo más rápido”, “necesito una espera corta” o “prefiero la otra opción” usando la misma ventana viva del turno.
- El hub ahora también muestra `Cierre de mostrador`: deja la frase final para despedir al paciente, con ventana estimada y una regla clara de qué hacer si no lo llaman a tiempo.
- El hub ahora también muestra `Revalidación de espera`: guía qué decir si el paciente vuelve a preguntar, separando cita, sin cita y la comparación visible entre carriles antes de moverlo.
- El hub ahora también muestra `Cambio de carril sugerido`: dice cuándo sí conviene mover al paciente después de revalidar, cuánto gana en minutos visibles y qué operador abrir para ejecutar el cambio.
- El hub ahora también muestra `Promesa segura`: traduce la lectura viva del turno en lo que recepción sí puede prometer sin sobreofrecer tiempo, cambio de carril u hora exacta.
- El hub ahora también muestra `Escalación sugerida`: marca cuándo recepción ya no debería sostener sola la promesa y conviene abrir el operador correcto para escalar con una señal viva.
- El hub ahora también muestra `Escala verbal`: baja la decisión de escalación a una frase operativa para que recepción explique el siguiente paso sin prometer un cambio antes de abrir el operador.
- El hub ahora también muestra `Confirmación de escala`: deja lista la frase final para cerrar la conversación una vez que el carril nuevo ya quedó resuelto.
- El hub ahora también muestra `Seguimiento de escala`: deja la frase de seguimiento para cuando el paciente vuelve a preguntar después de un cambio ya confirmado.
- El hub ahora también muestra `Reapertura de escala`: indica qué decir si la referencia confirmada ya se venció y si hace falta solo actualizar la ventana o reabrir un cambio real.
- El hub ahora también muestra `Límite de reapertura`: marca cuándo ya no conviene seguir ajustando verbalmente en mostrador y el siguiente paso debe pasar al operador.
- El hub ahora también muestra `Puente a operación`: deja lista la frase breve para traspasar el caso al operador cuando mostrador ya agotó su margen de ajuste.
- El hub ahora también muestra `Brief para operador`: resume en una sola frase qué debe validar operación cuando mostrador ya decidió escalar el caso.
- El hub ahora también muestra `Retorno a mostrador`: deja lista la respuesta corta que operación debe devolver para cerrar la conversación sin reabrir la negociación en recepción.
- El hub ahora también muestra `Resolución devuelta`: deja la frase final que mostrador usa cuando operación ya cerró la decisión y solo toca confirmar la salida definida.
- El hub ahora también muestra `Bloqueos vivos`: detecta los cuellos que frenan la ronda inmediata, por ejemplo un ticket llamado que bloquea el siguiente paso o un consultorio con ticket pero sin operador listo, y deja el ticket cargable al lookup para destrabarlo rápido.
- El hub ahora también muestra `SLA vivo`: lista los tickets que ya cayeron o están por caer en ventana de riesgo, con etiqueta de `vence en` o `vencido hace`, para intervenir antes de que esa presión se convierta en bloqueo operativo.
- El hub ahora también muestra un `Radar de espera`: tres carriles (`General`, `C1`, `C2`) ordenados por antigüedad/presión, para que recepción vea primero cuál ticket está envejeciendo y ejecute la siguiente jugada sin bajar a la tabla.
- El hub ahora también muestra `Balance de carga`: dos tarjetas `C1/C2` que comparan carga visible, gap entre consultorios y capacidad de absorber o ceder turnos antes de que la cola se desbalancee más.
- El hub ahora también muestra una `Fila priorizada`: una secuencia corta de tickets críticos ordenados por espera y contexto operativo, con acción directa para asignar, llamar, abrir operador o dejar un ticket en pausa consciente.
- El hub ahora también muestra `Bandejas rápidas`: accesos de un clic para abrir la tabla ya filtrada en `Urgentes`, `Sin consultorio`, `C1`, `C2` o `Llamados activos`, sin volver a tocar el triage manual.
- Cuando activas una de esas vistas, el hub ahora también muestra `Bandeja activa`: resume la tabla filtrada actual, deja limpiar el contexto y permite ejecutar la siguiente jugada útil de los primeros tickets visibles.
- Cuando la bandeja actual ya permite una secuencia segura, el hub ahora también muestra `Ráfaga operativa`: encadena pasos cortos como `asignar + llamar` o `re-llamar` desde el mismo contexto, sin volver a la tabla completa.
- El hub ahora también muestra `Despacho sugerido`: dos tarjetas `C1/C2` con la próxima jugada útil por consultorio para llamar o reasignar tickets sin bajar a la tabla completa.
- `admin.html#queue` también incluye un checklist de apertura diaria asistido: lee heartbeat de `Operador`, `Kiosco` y `Sala TV`, sugiere pasos ya validados y permite confirmarlos en bloque.
- `admin.html#queue` también incluye un panel de `Cierre y relevo`: valida que la cola quedó limpia, deja visibles los pasos por equipo y permite copiar un resumen textual del relevo del día.
- `admin.html#queue` también incluye una `bitácora operativa del día`: registra apertura asistida, ajustes de perfil, incidencias y relevo para que el siguiente turno no dependa de memoria informal.
- La bitácora del admin puede filtrarse por `Todo`, `Incidencias`, `Cambios` y `Estados`, para revisar rápido solo fallas o solo ajustes del turno.
- `admin.html#queue` también incluye un `Modo foco` con vistas `Auto`, `Apertura`, `Operación`, `Incidencias` y `Cierre`, para bajar ruido visual y mantener a la vista solo los bloques relevantes del momento.
- Debajo del `Modo foco`, el admin ahora muestra una `Consola rápida` que adapta botones al momento del turno: apertura, operación, incidencias o cierre, para evitar bajar a varias tarjetas antes de actuar.
- Debajo de la consola, el admin ahora muestra un `Playbook activo` por foco, con pasos cortos y confirmables para apertura, operación, incidencias o cierre; sirve como rutina guiada rápida dentro del mismo hub.
- El `Playbook activo` ahora también marca pasos `sugeridos` por telemetría o estado reciente y permite confirmarlos en bloque cuando el sistema ya detectó que están listos.
- `admin.html#queue` también incluye un deck de `contingencia rápida` para resolver `numpad`, `térmica`, `campanilla TV` y `fallback/realtime` sin salir del admin.
- En `Turnero Operador`, el primer arranque abre una configuración guiada para dejar el equipo en `C1 fijo`, `C2 fijo` o `modo libre`; luego puede reabrirse con `F10` o `Ctrl/Cmd + ,`.
- `/app-downloads/` expone el mismo catálogo de apps para instalar fuera del admin con presets por equipo.

### Windows Operador v1

- usar el mismo `TurneroOperadorSetup.exe` en las dos PCs operador
- PC 1: provisionar `C1 fijo`; PC 2: provisionar `C2 fijo`
- no almacenar credenciales ni 2FA en el shell; la autenticacion sigue en `operador-turnos.html`
- validar en cada PC: shell `Desktop instalada`, estacion correcta, `1 tecla` segun operacion y matriz del numpad completa (`llamar`, `+`, `.`, `-`)
- si hace falta reconfigurar una PC, usar `F10` o `Ctrl/Cmd + ,` en vez de reinstalar

Comandos base:

```bash
cd src/apps/turnero-desktop
npm install
npm run dev:operator
npm run dev:kiosk
npm run build:operator:win
npm run build:operator:mac
npm run build:kiosk:win
npm run build:kiosk:mac
```

Antes de publicar instaladores, validar manualmente:

- llamado/completar con el `Genius Numpad 1000`,
- ticket/check-in real desde kiosco,
- campanilla y legibilidad en TV TCL C655,
- reconexion tras corte de internet,
- autostart en el equipo destino.
