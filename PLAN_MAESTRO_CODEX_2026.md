# Plan Maestro Codex 2026 (Complementario Tecnico)

Inicio: 2026-02-24
Cadencia: por commit (cada commit deja evidencia verificable)
Relacion con Operativo 2026: complementario estricto (no reemplaza ni compite por control)

<!-- CODEX_STRATEGY_ACTIVE
id: STRAT-2026-03-admin-operativo
title: "Admin operativo"
status: active
owner: Ernesto
owner_policy: "detected_default_owner"
objective: "Convertir el frente admin clinico, queue/turnero y OpenClaw UX en una entrega operable y visible, con soporte backend y runtime estrictamente alineado."
started_at: "2026-03-17"
review_due_at: "2026-03-21"
success_signal: "Un mismo corte operativo puede demostrarse de punta a punta sin abrir trabajo fuera del frente admin operativo."
subfront_ids: ["SF-frontend-admin-operativo", "SF-frontend-queue-turnero-operativo", "SF-backend-admin-operativo", "SF-transversal-admin-operativo"]
updated_at: "2026-03-21"
-->

## Proposito

- Mantener `admin clinico`, `queue/turnero` y `OpenClaw UX` dentro de un solo frente operativo demostrable.
- Sostener un corte repetible donde login, quick-nav, queue/turnero piloto y readiness backend se validen como una misma entrega.
- Mantener `main` verde mientras runtime, gates y foco activo permanecen alineados entre board, plan y verificadores.

## Gobernanza

- Este archivo es la fuente de control de la linea Codex.
- Maximo un bloque `CODEX_STRATEGY_ACTIVE`.
- Maximo un bloque `CODEX_STRATEGY_NEXT`.
- Una sola `strategy.active` puede abrir `1..n` subfrentes por
  `codex_instance`; el paralelismo vive dentro de la estrategia activa.
- Maximo dos bloques `CODEX_ACTIVE` consumiendo slot por `codex_instance`
  (`in_progress`, `review`, `blocked`).
- Maximo seis bloques `CODEX_ACTIVE` consumiendo slot en total, dos por lane.
- `ready` queda como cola alineada: no consume slot ni requiere bloque
  `CODEX_ACTIVE`.
- Cada bloque `CODEX_ACTIVE` espeja una tarea por `task_id`; puede incluir
  `subfront_id` y coexistir con otros bloques del mismo lane hasta el cap.
- `CODEX_STRATEGY_NEXT` es draft: puede coexistir con la activa, pero no
  gobierna tareas hasta promocion desde el board.
- No se toman tareas del Operativo que ya esten `IN_PROGRESS`, salvo soporte de calidad (tests/guardrails).
- Definicion de done por commit:
- objetivo tecnico explicito.
- evidencia en CI o prueba local reproducible.
- actualizacion del estado en este plan.

## Estrategia madre activa

- Estrategia activa: `STRAT-2026-03-admin-operativo`.
- Draft siguiente: ninguno por ahora.
- Objetivo: convertir `admin clinico`, `queue/turnero` y `OpenClaw UX` en una entrega operable y visible con soporte backend/runtime estrictamente alineado.
- Revision vigente: semanal; `carry-over` permitido si la salida sigue siendo la misma entrega operativa.
- Regla de foco: cada hilo Codex toma un solo `subfront_id` valido y rechaza
  trabajo fuera del frente salvo `strategy_role=exception`; un mismo lane puede
  correr varios hilos en paralelo mientras no exceda `2` slots y no haya
  solape de archivos.
- Intake canonico: trabajo nuevo del frente debe entrar por `strategy intake`
  o por tarea ya alineada al mismo `subfront_id`.
- Si un `scope` same-lane es ambiguo entre varios subfrentes candidatos,
  `strategy intake` exige `--subfront-id` explicito.
- Exceptions: toda `exception` usa TTL del subfrente y, si expira, bloquea
  `activate-next` o `close` hasta regularizacion.

## Tri-lane operativo vigente

- `codex_frontend`:
  shell admin, quick-nav y surfaces `queue/turnero` que sostienen la demo operativa del corte.
- `codex_backend_ops`:
  auth, readiness, deploy/gates y backend de soporte directo para el mismo corte operativo.
- `codex_transversal`:
  runtime/orquestacion, `clinic-profile`, `queue state`, `queueSurfaceStatus`, readiness y gate web pilot solo como desbloqueo del frente, sin abrir trabajo fuera del objetivo activo.
- Excepcion unica:
  `strategy_role=exception` con `strategy_reason` explicito para hotfix critico o desbloqueo directo del frente activo.
- Regla critica:
  `critical_zone=true` sigue yendo a `codex_backend_ops`, salvo runtime OpenClaw canonico de `codex_transversal`.
- Prioridad tecnica inmediata:
  abrir solo dos lanes `CDX-*` del piloto web por clinica y mantener `main`
  verde mientras reintroducimos `queue/turnero` con un contrato mas estricto.

## Distribucion de esfuerzo

- 40% Superficies web visibles del piloto (`admin basic`, `operator`, `kiosk`, `display`).
- 40% Canon por clinica, queue state, readiness y gate remoto del piloto.
- 20% Smoke final, checklist operativo y evidencia de salida por clinica.

## A1.1 - Base impecable del Admin Shell RC1

Estado: `COMPLETED`
Ventana: `2026-03-14` -> `2026-03-21`
Objetivo:

- Convertir la estrategia activa en una base impecable de integracion y operacion interna antes de abrir mas superficie.
- Dejar `dashboard`, `appointments`, `callbacks`, `availability` y `clinical-history` como el unico shell visible del `RC1`.
- Sacar `queue/turnero` y `reviews` del shell visible sin borrar su codigo en disco.

Fase 0 - Integracion antes de `main`:

- Consolidar `strategy.js` como entrypoint canonico unico; no queda `strategy-v2.js` paralelo.
- Mantener `CODEX_STRATEGY_ACTIVE` tambien cuando la estrategia quede `closed`.
- Bajar `CDX-041` y `CDX-042` a `ready` hasta abrir lease real.
- Mantener el texto humano de `status` estable; WIP/expired/aged quedan en JSON.

Lanes sembradas para reactivacion con lease:

- `CDX-041 / codex_backend_ops / SF-backend-admin-operativo`:
  endurecer `admin-auth.php`, `AdminDataController` e `InternalConsoleReadiness` para acceso diario interno con `OpenClaw` primario y contingencia web solo si el backend la anuncia; `OperatorAuthController` solo entra por excepcion transversal.
- `CDX-042 / codex_frontend / SF-frontend-admin-operativo`:
  cerrar el shell `sony_v3` visible con 5 secciones, sin `queue/turnero`, sin `reviews`, con sidebar/hash, quick command y responsive tablet estables.

Contrato visible del RC1:

- `dashboard`
- `appointments`
- `callbacks`
- `availability`
- `clinical-history`

Scope explicitamente oculto en A1.1:

- `queue/turnero`
- `reviews`
- kiosco/TV
- atajos, listeners y side effects de boot especificos de `queue`

Gates de salida:

- `npm run agent:test`
- `npm run agent:gate`
- `npm run test:admin:openclaw-auth`
- `npm run test:admin:runtime-smoke`
- `php tests/test_admin_auth_status.php`
- `php vendor/bin/phpunit --no-coverage tests/Integration/ClinicalHistoryAdminReadModelTest.php`
- `npx playwright test tests/admin-v3-shell.spec.js tests/admin-openclaw-login.spec.js tests/admin-navigation-responsive.spec.js tests/admin-callbacks-triage.spec.js tests/admin-availability-responsive.spec.js tests/admin-availability-readonly.spec.js tests/admin-quick-nav.spec.js`
- `npm run checklist:admin:openclaw-auth:local`
- `npm run gate:admin:rollout:internal`

Criterio de orgullo de esta ola:

- merge limpio a `main`
- gates verdes
- shell sin ruido
- evidencia final clara para `CDX-041` y `CDX-042`

Salida lograda el `2026-03-14`:

- `Admin Shell RC1` interno cerrado con 5 secciones visibles: `dashboard`, `appointments`, `callbacks`, `availability`, `clinical-history`.
- `queue/turnero` y `reviews` quedaron ocultos del shell visible, del routing y de los atajos.
- `strategy.js` quedo como entrypoint canonico unico; no queda `strategy-v2.js`.
- `CDX-041` y `CDX-042` se cerraron con evidencia y sin dejar lanes activos difusos.

Validacion final ejecutada:

- `npm run agent:test`
- `npm run agent:gate`
- `npm run test:admin:openclaw-auth`
- `npm run test:admin:runtime-smoke`
- `php tests/test_admin_auth_status.php`
- `php vendor/bin/phpunit --no-coverage tests/Integration/ClinicalHistoryAdminReadModelTest.php`
- `npx playwright test tests/admin-v3-shell.spec.js tests/admin-openclaw-login.spec.js tests/admin-navigation-responsive.spec.js tests/admin-callbacks-triage.spec.js tests/admin-availability-responsive.spec.js tests/admin-availability-readonly.spec.js tests/admin-quick-nav.spec.js --workers=1`
- `npm run checklist:admin:openclaw-auth:local`
- `npm run gate:admin:rollout:internal`

Resumen para ola 2:

- Soportado en RC1: shell core interno + auth OpenClaw primario + contingencia web anunciada por backend.
- Oculto en RC1: `queue/turnero`, `reviews`, kiosco/TV y side effects de boot asociados.
- Condicion para abrir la ola 2: mantener `main` verde, activar `STRAT-2026-03-turnero-web-pilot` y reintroducir `queue/turnero` solo dentro de ese corte dedicado.

## A2.0 - Turnero web por clinica

Estado: `BLOCKED`
Ventana activa: `2026-03-14` -> `2026-03-28`
Objetivo:

- Reabrir `queue/turnero` a proposito, no como arrastre del `Admin Shell RC1`.
- Cerrar un piloto web por clinica con cuatro superficies visibles: `admin.html#queue`, `operador-turnos.html`, `kiosco-turnos.html` y `sala-turnos.html`.
- Usar `clinic-profile` como fuente unica de verdad para branding, rutas canonicas, bloqueos y smoke de salida.

Demostracion objetivo:

- Un paciente toma turno o hace check-in en `kiosco`.
- `admin basic` y `operador` ven la misma cola, con el mismo contexto de clinica.
- El operador llama desde `C1` o `C2` y `sala` refleja el llamado vivo.
- El cierre (`completed` o `no_show`) queda sincronizado en las superficies web.
- Si el perfil, la firma o la ruta activa quedan fuera de canon, las superficies se bloquean y lo muestran en pantalla.

Criterio de orgullo de la ola:

- una demo de punta a punta, corta y legible
- una sola clinica, bien marcada, en las cuatro superficies
- `admin.html#queue` util en modo `basic`, sin ruido de hub experto
- el sistema se protege solo cuando la clinica o la ruta son invalidas

Definicion del release A2.0:

- `admin.html#queue` vuelve a abrirse, pero solo en modo `basic`
- `operator`, `kiosk` y `display` quedan alineados al mismo `clinic-profile`
- el piloto no depende de instaladores Electron ni APK de Android TV
- el go-live se decide por `canon + heartbeat + smoke`, no por intuicion

Fuera de alcance en A2.0:

- `expert mode` del hub admin
- instaladores Electron y `desktop-updates/`
- APK Android TV como blocker de salida
- centro de descargas como flujo principal
- multi-tenant entre clinicas
- agenda publica, pagos y superficies comerciales

Lanes propuestos al activar la ola:

- `codex_frontend / SF-frontend-turnero-web-pilot`:
  reabrir `admin.html#queue` en `basic`, reforzar `operator`, `kiosk` y `display`, y hacer visibles branding, estado de perfil y bloqueos por canon.
- `codex_backend_ops / SF-backend-turnero-web-pilot`:
  sostener `turneroClinicProfile`, `queueSurfaceStatus`, `queueOpsPilotReadiness`, `health`, `verify-remote` y los gates del piloto web por clinica.
- `codex_transversal / SF-transversal-turnero-web-pilot`:
  queda inactivo; solo entra por excepcion si el runtime OpenClaw bloquea el acceso real del operador o del admin.

Primeras `CDX-*` activadas:

- `CDX-043 / codex_backend_ops / SF-backend-turnero-web-pilot`:
  sostener `clinic-profile`, `queue state`, `queueSurfaceStatus`, readiness y `verify-remote` del piloto web por clinica.
- `CDX-044 / codex_frontend / SF-frontend-turnero-web-pilot`:
  reabrir `admin.html#queue` en `basic` y alinear `operator`, `kiosk` y `display` a un mismo canon por clinica.

Fase 0 - Activacion limpia:

- estrategia draft ya promovida a activa
- abrir exactamente 2 lanes activos (`frontend` y `backend_ops`)
- dejar `transversal` en espera salvo bloqueo real de runtime/auth
- mantener `main` verde durante toda la reintroduccion de `queue`

Fase 1 - Canon por clinica:

- el perfil activo vive en `content/turnero/clinic-profile.json` y debe coincidir con `content/turnero/clinic-profiles/*.json`
- `admin.html#queue` expone el `canon web por clinica`, el `paquete de apertura` y los `bloqueos de salida`
- el estado persistido del hub y de las superficies queda aislado por `clinic_id`
- una ruta, clinica o firma fuera de canon debe pasar a estado `Bloquea`

Fase 2 - Operacion web util:

- `admin.html#queue` vuelve con cola, consultorios, resolucion, heartbeats e incidentes directos
- `operador-turnos.html` permite llamar, rellamar, completar y marcar `no_show`
- `kiosco-turnos.html` crea tickets y hace check-in con el mismo branding/contexto
- `sala-turnos.html` refleja llamados y se bloquea si la clinica o la ruta quedan fuera de canon

Fase 3 - Salida de release:

- el panel de readiness muestra solo los bloqueos reales del piloto
- el smoke final deja una secuencia repetible para `admin`, `operator`, `kiosk` y `display`
- el commit desplegado y `public_main_sync` quedan verificables
- la evidencia final deja claro que se difiere a una ola nativa posterior

Gates de salida recomendados:

- `npx playwright test tests/admin-queue.spec.js tests/queue-operator.spec.js tests/queue-kiosk.spec.js tests/queue-display.spec.js tests/queue-integrated-flow.spec.js`
- `php tests/test_figo_queue_core.php`
- `php tests/test_queue_service.php`
- `node bin/turnero-clinic-profile.js validate --id <clinic_id> --json`
- `node bin/turnero-clinic-profile.js stage --id <clinic_id> --json`
- `node bin/turnero-clinic-profile.js verify-remote --base-url https://TU_DOMINIO --json`
- `npm run gate:turnero`
- `pwsh -File scripts/ops/prod/VERIFICAR-DESPLIEGUE.ps1 -Domain https://TU_DOMINIO`

Estado del corte `2026-03-14`:

- canon de salida confirmado: `turnero-clinic-profile/v1` con perfil activo `piel-armonia-quito`
- validacion local en verde: `tests/admin-queue.spec.js` (`84 passed`) y `npm run gate:turnero:web-pilot` (`OK`)
- gobernanza pre-write revalidada con `node agent-orchestrator.js status --json`, `node agent-orchestrator.js task ls --active --json`, `npm run chunks:admin:check` y `npm run agent:gate`: estrategia sigue activa, solo `CDX-043/CDX-044` quedan bloqueadas, `policy.revision=699`, y la gobernanza local vuelve a verde
- deuda de tooling local resuelta: `SMOKE-PRODUCCION.ps1` vuelve a parsear, `verify-remote` ya no acepta `publicHealthRedacted=true` como piloto sano, y los contratos Node del carril `turnero/health/prod-ops/monitor` quedan `27/27`
- `verify:prod:turnero:web-pilot` (`rerun3`) todavia alcanzó a demostrar el mismatch remoto de identidad: `health-diagnostics` seguia en `403`, el `health` publico seguia sin exponer `checks.turneroPilot` / `checks.publicSync`, y el verify ahora lo marca explicitamente como `turnero pilot remote health redacted`
- el entorno remoto empeoro despues de ese punto: `smoke:prod:turnero:web-pilot` (`rerun3`) y `gate:prod:turnero:web-pilot` (`rerun4`) observan `502` sostenido en `health`, `reviews`, `availability`, `figo-chat.php` y `figo-backend.php`; el smoke cae a `12/22` checks HTTP base `OK` y el benchmark confirma `25/25` fallas de status en los endpoints operativos
- `node agent-orchestrator.js jobs verify public_main_sync --json` deja `public_main_sync` en `verified=false`, `healthy=false`, `failure_reason=unverified`, sin `deployed_commit` ni timestamps; `MONITOR-PRODUCCION.ps1` suma `502` en `health-diagnostics`, `reviews`, `availability`, `booked-slots`, `service-priorities` y `figo-get`
- el spot-check directo posterior confirma `502` sostenido en `health`, `reviews`, `availability` y `figo-chat.php`, mientras la alerta de conectividad `#442` sigue abierta con `connectivity_status=unreachable` y `open_targets=none`
- hay fixes recientes en el repo remoto para `publicSync`/health (`696c8b9`, `b248421`), pero no se publicaron: sus corridas `CI` fallaron y los `Deploy Hosting (Canary Pipeline)` asociados quedaron `skipped`
- el frente local de CI que dejaba esos deploys en `skipped` ya no muestra un rojo reproducible por codigo: `phpunit tests/Integration/HealthVisibilityTest.php` pasa (`6 tests, 58 assertions`), `tests-node/queue-pilot-smoke-signal-contract.test.js` pasa (`3/3`), `npm run lint:js` queda en `0 errors` y `npm run test:critical:funnel` vuelve a verde (`6 passed`, `1 skipped`) tras alinear tests stale a la nomenclatura canonica actual de `public-v6`
- rerun operativo posterior (`verify/smoke/gate` remotos del `2026-03-14 17:01` -> `17:04`, `America/Guayaquil`) muestra recuperacion parcial del host: `health`, `reviews`, `availability`, `figo-chat.php` y las tres superficies web del piloto vuelven a `200`, `smoke` queda en `22/22` checks HTTP base `OK` y el benchmark vuelve a verde
- pese a esa recuperacion HTTP, A2.0 sigue `BLOCKED` por drift de release/entorno: `health-diagnostics` sigue en `403`, el `health` publico sigue sin `checks.turneroPilot` / `checks.publicSync`, `verify` marca `turnero pilot remote health redacted`, `public_main_sync` sigue `registry_only/unverified`, `figo` sigue `mode=degraded` con `upstreamReachable=false`, y `MONITOR-PRODUCCION.ps1` sigue viendo `availability/booked-slots` en `meta.source=fallback`
- mejora repo-side posterior: los workflows `prod-monitor`, `post-deploy-fast`, `post-deploy-gate`, `deploy-hosting`, `deploy-frontend-selfhosted` y `repair-git-sync` ahora propagan `PIELARMONIA_DIAGNOSTICS_ACCESS_TOKEN/PIELARMONIA_CRON_SECRET` al entorno, de modo que `Common.Http.ps1` y `verify-remote` puedan usar `health-diagnostics` autenticado cuando el secreto exista en Actions
- la mejora de wiring queda validada localmente: contratos focales de workflow `53/53`, `npm run agent:test` `508 pass`, `0 fail`, y `npm run agent:gate` vuelve a verde; sigue pendiente demostrar en un rerun real si GitHub Actions tiene el secreto configurado y si eso destraba la identidad remota del piloto
- rerun remoto posterior del `2026-03-14 17:44` -> `17:48` (`America/Guayaquil`) desde esta shell local confirma que el bloqueo ya no es outage general: `smoke` mantiene `22/22` checks HTTP base `OK` y `gate` mantiene benchmark sano, pero `verify` vuelve a caer con `14` fallas por mezcla de `health-diagnostics=403`, `turnero pilot remote health redacted`, issue `#442`, `figo-status mode=degraded` y drift del shell publico desplegado (`styles.css` / `public-v6-shell.js` con hash distinto, `index` con inline executable script, y faltantes de markers GA4 del corte actual)
- la shell local usada para ese rerun sigue sin `PIELARMONIA_DIAGNOSTICS_ACCESS_TOKEN` / `PIELARMONIA_CRON_SECRET`, asi que el wiring de workflows sigue pendiente de verificacion real en GitHub Actions con secreto cargado
- snapshot de gobernanza posterior al rerun deja `policy.revision=701`, `CDX-043=blocked`, `CDX-044=review`, estrategia `STRAT-2026-03-turnero-web-pilot` aun `active`, y `public_main_sync` todavia `healthy=false`
- tras sincronizar evidencia, `agent:gate` solo detecto un residuo local de frontend (`js/admin-chunks/index-MyvPG610.js`); `npm run chunks:admin:prune` lo elimino y `npm run agent:gate` (`rerun4` y `rerun5`) volvio y se mantuvo en verde, asi que la gobernanza local sigue sin ser el bloqueo real del corte
- `CDX-043` no se cierra y `CDX-044` no sale de `review`; A2.0 sigue en bloqueo operativo hasta repetir `verify + smoke + gate` en verde y sin drift entre deploy remoto y corte local
- `CODEX_STRATEGY_ACTIVE` se mantiene en `active`; la estrategia no se cierra mientras persista esta brecha remota

Notas de disciplina:

- si tocamos `src/apps/queue-shared` o contratos compartidos, sumar `tests-node/turnero-runtime-contract.test.js`
- si tocamos soporte desktop por accidente, tratarlo como regresion, no como scope de salida
- no reabrir `queue` dentro del shell admin fuera de esta ola y de este contrato

## Bloques

## C1 - Firewall de regresiones de agenda

Estado: `COMPLETED`
Objetivo:

- Eliminar regresiones silenciosas en `availability`, `appointments`, `booked-slots`, reprogramacion y conflictos de slot.

Entregables:

- [x] Suite critica de agenda por dominio en CI.
- [x] Cobertura de codigos normalizados (`slot_conflict`, `calendar_unreachable`, etc.) en escenarios de error.
- [x] Pruebas de concurrencia no destructivas y destructivas controladas (workflow manual).
- [x] Sonda automatica de flakiness para `test:phase2` en modo readonly con umbral configurable.

Criterio de salida:

- [x] Suite critica estable sin flakiness repetido.
- [x] Cualquier cambio de comportamiento en agenda protegido con test.

## C2 - Retencion tecnica enfocada en no-show

Estado: `COMPLETED`
Objetivo:

- Estandarizar metricas de no-show/completed/confirmed y recurrencia para seguimiento continuo.

Entregables:

- [x] `funnel-metrics` expone bloque `retention` (aditivo, sin breaking changes).
- [x] `REPORTE-SEMANAL-PRODUCCION.ps1` incluye seccion retention + delta vs reporte previo.
- [x] Indicadores de recurrencia/no-show disponibles sin trabajo manual extra.

Criterio de salida:

- [x] Baseline y tendencia semanal de no-show disponibles en JSON y markdown.
- [x] Recurrencia de pacientes trazable por metrica.

## C3 - Observabilidad accionable

Estado: `COMPLETED`
Objetivo:

- Detectar y clasificar incidentes de reserva/chat con menor tiempo de diagnostico.

Entregables:

- [x] Validacion automatica de configuracion de observabilidad en health/reportes.
- [x] Clasificacion de alertas por severidad e impacto.
- [x] Playbook operativo con ruta de diagnostico rapida.

Criterio de salida:

- [x] Evidencia de verificacion automatica en pipeline semanal.
- [x] Ruta de diagnostico documentada y utilizable en menos de 15 min.

## C4 - Guardrails de release y CI

Estado: `COMPLETED`
Objetivo:

- Evitar que cambios de bajo nivel rompan deploy o comportamiento critico.

Entregables:

- [x] Gates explicitos por dominio (agenda/funnel/chat/pagos) con nombres claros en CI.
- [x] Workflows destructivos solo en `workflow_dispatch` con guardrails fuertes.
- [x] Reglas claras de warning -> blocking segun impacto.

Criterio de salida:

- [x] Pipeline con semaforos por dominio.
- [x] Fallback operativo documentado para picos transitorios sin relajar seguridad.

## C5 - Embudo de conversion por servicio (backend)

Estado: `COMPLETED`
Objetivo:

- Hacer trazable la conversion por `service_slug` y `service_category` en backend, sin cambios breaking de API.

Entregables:

- [x] `POST /funnel-event` acepta eventos de servicio (`view_service_category`, `view_service_detail`, `start_booking_from_service`).
- [x] `GET /funnel-metrics` agrega breakdowns por servicio/categoria y matriz `serviceFunnel` con tasas.
- [x] Cobertura de integracion backend para persistencia de labels y calculo de tasas.

Criterio de salida:

- [x] Los eventos de servicio quedan almacenados en metricas Prometheus con labels normalizados.
- [x] `serviceFunnel` retorna tasas consistentes (`intent->checkout`, `checkout->confirmed`, `detail->confirmed`).
- [x] Pruebas de integracion en verde sin regresion en `retention`.

## C6 - Alertas operativas de service funnel (weekly KPI)

Estado: `COMPLETED`
Objetivo:

- Convertir el embudo por servicio en senal operativa semanal con umbrales configurables, incidentes dedicados y trazabilidad en artefactos.

Entregables:

- [x] `REPORTE-SEMANAL-PRODUCCION.ps1` incorpora analisis `serviceFunnel` (muestras, top servicios, alertas por servicio, codigos y payload JSON/markdown).
- [x] `weekly-kpi-report.yml` agrega umbrales de service funnel (inputs + vars + outputs efectivos) y los pasa al reporte.
- [x] Workflow semanal abre/cierra incidente dedicado `[ALERTA PROD] Weekly KPI service funnel degradado`.

Criterio de salida:

- [x] Warnings `service_funnel_*` quedan clasificados como `non_critical` de impacto `conversion` (con runbook).
- [x] Reporte semanal expone `serviceFunnel.source/rows/alerts/top` en JSON y resumen.
- [x] Incidentes semanales distinguen `general`, `retencion`, `ops-sla` y `service funnel` sin contaminar SLA externo.

## C7 - Catalogo de servicios API (backend contract)

Estado: `COMPLETED`
Objetivo:

- Exponer un contrato backend estable para catalogo de servicios (`services-catalog`) con filtros/paginacion y tolerancia a catalogo faltante, sin cambios breaking.

Entregables:

- [x] Nuevo endpoint publico `GET /api.php?resource=services-catalog`.
- [x] Filtros backend por `slug/category/subcategory/audience/doctor/q`, con `limit/offset`.
- [x] Metadatos operativos (`source/version/timezone/total/filtered/returned/generatedAt`) para soporte de front/rediseno.
- [x] Cobertura de integracion para filtros, busqueda y comportamiento cuando falta el catalogo.

Criterio de salida:

- [x] Endpoint responde `200` con `ok=true` y `data/meta` incluso cuando el catalogo no existe (`source=missing`).
- [x] Contrato de filtros y paginacion protegido por pruebas de integracion verdes.
- [x] Sin regresiones en analytics/retention existentes.

## C8 - Salud operativa de catalogo (health + weekly incident)

Estado: `COMPLETED`
Objetivo:

- Convertir el estado del catalogo de servicios en senal operativa explicita en `health` y en el KPI semanal, con incidente dedicado.

Entregables:

- [x] `GET /api.php?resource=health` expone `servicesCatalogSource`, `servicesCatalogVersion`, `servicesCatalogCount`, `servicesCatalogConfigured`.
- [x] `checks.servicesCatalog` disponible con metadatos de fuente/version/cantidad.
- [x] `REPORTE-SEMANAL-PRODUCCION.ps1` incorpora warnings `services_catalog_*`, seccion markdown y bloque `servicesCatalog` en JSON.
- [x] `weekly-kpi-report.yml` emite outputs normalizados `services_catalog_*` y abre/cierra incidente dedicado.

Criterio de salida:

- [x] Reporte semanal no falla y serializa `servicesCatalog` correctamente.
- [x] Incidente semanal dedicado `[ALERTA PROD] Weekly KPI services catalog degradado` habilitado con severidad.
- [x] Contrato de workflow validado por tests Node.

## C9 - Priorizacion inteligente de servicios (backend contract)

Estado: `COMPLETED`
Objetivo:

- Exponer una API backend que recomiende orden de categorias/servicios para navegacion y landings usando senales reales de funnel + catalogo.

Entregables:

- [x] Nuevo endpoint publico `GET /api.php?resource=service-priorities`.
- [x] Ranking por `sort=hybrid|volume|conversion` con filtros `audience/category` y limites controlados.
- [x] Respuesta aditiva con `data.categories`, `data.services`, `data.featured` y metadatos operativos (`source`, `catalogVersion`, `serviceCount`).
- [x] Cobertura de integracion para ranking con señales de funnel, filtro pediatrico y fallback de catalogo faltante.

Criterio de salida:

- [x] `service-priorities` responde `200` con `source=catalog+funnel` cuando existen señales de conversion.
- [x] Filtro `audience=ninos` prioriza rutas pediatricas sin romper contrato.
- [x] Fallback `source=missing` devuelve arrays vacios y contrato estable.

## C10 - Operacion semanal de service priorities (KPI + incidentes)

Estado: `COMPLETED`
Objetivo:

- Convertir `service-priorities` en senal operativa semanal con salida normalizada, summary y ciclo de incidente dedicado.

Entregables:

- [x] `REPORTE-SEMANAL-PRODUCCION.ps1` incorpora bloque `servicePriorities` en JSON/markdown y warnings `service_priorities_*`.
- [x] `weekly-kpi-report.yml` agrega outputs normalizados `service_priorities_*` y crea/cierra incidente semanal dedicado.
- [x] `tests-node/weekly-kpi-workflow-contract.test.js` valida contrato de outputs y presencia del flujo de incidente.

Criterio de salida:

- [x] Reporte semanal serializa `servicePriorities` con `source/catalogSource/catalogVersion/servicesCount/categoriesCount/featuredCount`.
- [x] Incidente semanal dedicado `[ALERTA PROD] Weekly KPI service priorities degradado` activo con severidad y signal key.
- [x] Contrato de workflow protegido por tests Node en verde.

## C11 - Monitor diario de service priorities (produccion)

Estado: `COMPLETED`
Objetivo:

- Endurecer el monitor diario de produccion para detectar degradacion temprana de `service-priorities` (fuente, volumen y estructura), sin esperar al KPI semanal.

Entregables:

- [x] `MONITOR-PRODUCCION.ps1` agrega check explicito a `GET /api.php?resource=service-priorities`.
- [x] Validaciones de contrato diario: `meta.source`, `meta.catalogVersion`, `meta.serviceCount`, y conteos minimos en `data.services/categories/featured`.
- [x] Flags operativos de tolerancia/umbral: `AllowDegradedServicePriorities`, `MinServicePrioritiesServices`, `MinServicePrioritiesCategories`, `MinServicePrioritiesFeatured`.
- [x] `.github/workflows/prod-monitor.yml` expone inputs/env/summary para esos parametros y los cablea al monitor.
- [x] Cobertura de contrato Node en `tests-node/prod-monitor-workflow-contract.test.js`.

Criterio de salida:

- [x] Monitor diario falla si `service-priorities` pierde fuente `catalog+funnel` (salvo override operativo temporal).
- [x] Monitor diario falla si la API devuelve catalogo vacio por debajo de umbrales configurados.
- [x] Contrato de workflow protegido por test automatizado.

## C12 - Package P1: evidencia operativa Sentry y scorecard base

Estado: `COMPLETED`
Objetivo:

- Normalizar la evidencia Sentry de Fase 6 y hacer que `prod-readiness-summary` deje de tratarla como pendiente generico cuando ya existe artefacto verificable.

Entregables:

- [x] `bin/verify-sentry-events.js` siempre escribe `verification/runtime/sentry-events-last.json`, incluyendo `status`, `failureReason` y `actionRequired`.
- [x] `.github/workflows/sentry-events-verify.yml` publica el artefacto `sentry-events-report` sin bloquear antes de generar el JSON.
- [x] `bin/prod-readiness-summary.js` consume el artefacto remoto/local de Sentry y refleja `PM-SENTRY-001` segun la evidencia real.
- [x] Scorecard oficial de paquetes fijada en `verification/agent-runs/CDX-002.md`.

Criterio de salida:

- [x] `npm run verify:sentry:events` deja evidencia utilizable o razon accionable cuando falta configuracion.
- [x] `prod-readiness-summary` expone seccion `Sentry Evidence` y usa esa evidencia para `PM-SENTRY-001`.
- [x] Cobertura Node agregada para script, workflow y summary.

## C13 - Package P2: kernel comun PowerShell para produccion

Estado: `COMPLETED`
Objetivo:

- Extraer el kernel compartido de `REPORTE-SEMANAL-PRODUCCION.ps1`, `VERIFICAR-DESPLIEGUE.ps1` y `MONITOR-PRODUCCION.ps1` a `bin/powershell/*`, dejando scripts raiz mas delgados y sin breaking changes en flags ni salida.

Entregables:

- [x] `bin/powershell/Common.Http.ps1` concentra parseo JSON, wrappers HTTP/curl, descargas remotas, hashes y helpers reutilizables de deploy/monitor.
- [x] `bin/powershell/Common.Metrics.ps1` concentra percentiles, benchmark y parseo Prometheus usado por el weekly report.
- [x] `bin/powershell/Common.Warnings.ps1` concentra clasificacion de warnings, runbooks, ciclos semanales y serializacion pesada del reporte semanal.
- [x] Los tres scripts raiz quedan dot-sourcing de helpers compartidos y conservan contratos de ejecucion desde `npm`.

Criterio de salida:

- [x] `REPORTE-SEMANAL-PRODUCCION.ps1` queda en `<= 1200` lineas.
- [x] `VERIFICAR-DESPLIEGUE.ps1` queda en `<= 1300` lineas.
- [x] `MONITOR-PRODUCCION.ps1` mantiene parametros y salida operativa.
- [x] Validaciones de contratos Node y comandos ops pasan en verde.

## C14 - Package P3: descomposicion del core analitico

Estado: `COMPLETED`
Objetivo:

- Convertir `controllers/AnalyticsController.php` en una fachada HTTP liviana y mover funnel, retention, parseo Prometheus, normalizacion y CSV a servicios puros reutilizables.

Entregables:

- [x] `lib/analytics/FunnelMetricsService.php` centraliza calculo de `funnel-metrics`, `serviceFunnel`, `surfaceFunnel` e idempotency.
- [x] `lib/analytics/RetentionReportService.php` centraliza snapshot de retention, parametros, filtros, alertas y reporte diario.
- [x] `lib/analytics/PrometheusCounterParser.php`, `lib/analytics/AnalyticsLabelNormalizer.php` y `lib/analytics/RetentionCsvExporter.php` absorben parsing/normalizacion/export.
- [x] `controllers/AnalyticsController.php` conserva entrypoints `recordEvent`, `getFunnelMetrics`, `getRetentionReport` y `buildFunnelMetricsData` sin romper contratos.

Criterio de salida:

- [x] `AnalyticsController.php` queda en `<= 650` lineas.
- [x] Contratos JSON y CSV permanecen intactos para analytics, service priorities y reporte semanal.
- [x] Tests PHP de analytics/service priorities y contrato Node consumidor permanecen verdes.

## C15 - Package P4: nucleo de durabilidad de datos

Estado: `COMPLETED`
Objetivo:

- Separar paths, config, cifrado y persistencia de `lib/storage.php`, y health/replicacion/configuracion de `lib/backup.php`, manteniendo wrappers publicos y formatos existentes.

Entregables:

- [x] `lib/storage/StorePaths.php` y `lib/storage/StorageConfig.php` concentran resolucion de directorios, archivos y toggles de backend.
- [x] `lib/storage/StoreCrypto.php` y `lib/storage/StorePersistence.php` concentran cifrado JSON fallback, lectura/escritura y backups asociados.
- [x] `lib/backup/BackupConfig.php`, `lib/backup/BackupCrypto.php`, `lib/backup/BackupHealthService.php` y `lib/backup/BackupReplicationService.php` absorben configuracion, receiver crypto, health y replicacion/offsite.
- [x] `lib/storage.php` y `lib/backup.php` quedan como wrappers de compatibilidad sin cambios breaking en funciones globales.

Criterio de salida:

- [x] `lib/storage.php` queda en `<= 650` lineas.
- [x] `lib/backup.php` queda en `<= 750` lineas.
- [x] `store.json`, `store.sqlite`, backups, restore y cifrado mantienen formato y semantica.
- [x] Tests PHP de storage/backup/disaster recovery y `npm run gate:prod:backend` quedan verdes.

## C16 - Package P5: cola y servicio de turnos

Estado: `COMPLETED`
Objetivo:

- Reducir acoplamiento procedural en `lib/figo_queue.php` y complejidad de priorizacion/resumen en `lib/QueueService.php`, manteniendo contratos de bridge, payloads y estados.

Entregables:

- [x] `lib/figo_queue/QueueConfig.php`, `lib/figo_queue/JobRepository.php`, `lib/figo_queue/GatewayClient.php` y `lib/figo_queue/JobProcessor.php` absorben config, acceso a archivos, gateway y reintentos/procesamiento.
- [x] `lib/queue/TicketFactory.php`, `lib/queue/TicketPriorityPolicy.php` y `lib/queue/QueueSummaryBuilder.php` absorben creacion, prioridad y resumen de tickets.
- [x] `lib/figo_queue.php` queda como facade procedural estable.
- [x] `lib/QueueService.php` conserva API publica y delega construccion/prioridad/resumen a modulos puros.

Criterio de salida:

- [x] `lib/figo_queue.php` queda en `<= 650` lineas.
- [x] `lib/QueueService.php` queda en `<= 500` lineas.
- [x] Se preservan estados de ticket, payloads de cola, bridge Figo y codigos de error.
- [x] Tests PHP/Node/smoke de queue y chat quedan verdes.

## C17 - Telemedicina: resolucion administrativa y decisiones de triage

Estado: `COMPLETED`
Objetivo:

- Cerrar la brecha backend entre detectar `review_required` y poder resolverlo operativamente desde staff, sin tocar frontend ni forzar ediciones manuales del store.

Entregables:

- [x] `controllers/TelemedicineAdminController.php` expone listado admin y mutacion `PATCH` para intake telemedicina.
- [x] `lib/telemedicine/TelemedicineIntakeService.php` y `TelemedicineRepository.php` soportan decisiones persistidas `approve_remote`, `request_more_info`, `escalate_presential`.
- [x] `TelemedicineOpsSnapshot` y `AdminDataController` reflejan cola pendiente y resoluciones por decision sin filtrar PHI en observabilidad publica.
- [x] `SystemController::metrics` exporta counters/gauges de resolucion de triage.
- [x] Contrato API/admin documentado y cubierto por pruebas de integracion.

Criterio de salida:

- [x] Staff puede listar intakes telemedicina por backend y resolverlos sin editar store a mano.
- [x] Intake y appointment enlazado quedan sincronizados tras cada decision.
- [x] `reviewQueue` excluye casos ya resueltos y expone conteos por decision.
- [x] Tests PHP de telemedicina/admin/metrics quedan verdes sin romper contratos legacy.

## C18 - Telemedicina: enforcement progresivo backend-only (phase-2 readiness)

Estado: `COMPLETED`
Objetivo:

- Endurecer elegibilidad clinica sin romper frontend legacy: mantener shadow por defecto y habilitar enforcement gradual por flags backend para `unsuitable` y `review_required`.

Entregables:

- [x] Nueva politica `lib/telemedicine/TelemedicineEnforcementPolicy.php` con flags `PIELARMONIA_TELEMED_V2_ENFORCE_UNSUITABLE`, `PIELARMONIA_TELEMED_V2_ENFORCE_REVIEW_REQUIRED`, `PIELARMONIA_TELEMED_V2_ALLOW_DECISION_OVERRIDE`.
- [x] `lib/BookingService.php` aplica gate post-bridge telemedicina y devuelve errores canonicos (`telemedicine_unsuitable`, `telemedicine_review_required`) cuando enforcement esta activo.
- [x] `lib/telemedicine/TelemedicineOpsSnapshot.php` expone policy en `health` y gauges Prometheus de modo/enforcement.
- [x] Contrato API/OpenAPI actualizado para codigos y politica aditiva.
- [x] Cobertura nueva en unit/integration para policy, booking enforcement, health y metrics.

Criterio de salida:

- [x] Con flags por defecto (`enforcement off`) el flujo legacy sigue sin bloqueos nuevos.
- [x] Con `ENFORCE_UNSUITABLE=1`, casos `unsuitable` fallan con `422` + `telemedicine_unsuitable`.
- [x] Con `ENFORCE_REVIEW_REQUIRED=1`, casos `review_required` fallan con `409` + `telemedicine_review_required`.
- [x] `health` y `metrics` publican estado de policy sin exponer PHI.
- [x] Suite telemedicina y gate de gobernanza quedan verdes.

## C19 - Telemedicina: simulacion operativa y proyeccion de rollout (backend-only)

Estado: `COMPLETED`
Objetivo:

- Dar a operaciones una forma reproducible de simular policy y proyectar impacto
  de enforcement sin tocar frontend ni mutar datos productivos.

Entregables:

- [x] `POST /api.php?resource=telemedicine-policy-simulate` (admin) para
      evaluacion what-if no destructiva con `policyOverride`.
- [x] `GET /api.php?resource=telemedicine-rollout-readiness` (admin) con
      proyeccion de escenarios:
    - `shadow_only`
    - `enforce_unsuitable`
    - `enforce_unsuitable_and_review`
- [x] `lib/telemedicine/TelemedicineRolloutReadiness.php` como libreria
      reusable para API y CLI.
- [x] `bin/telemedicine-rollout-readiness.php` refactorizado a wrapper fino
      (sin logica duplicada).
- [x] Contrato actualizado en `docs/API.md` y `docs/openapi.yaml`.
- [x] Cobertura integration para simulation/readiness.

Criterio de salida:

- [x] Simulation reporta `allowed/blocked` sin mutar store.
- [x] Readiness devuelve conteos y bloqueos por escenario sobre intakes reales.
- [x] CLI y API comparten el mismo motor de proyeccion.
- [x] Suite telemedicina y gates generales permanecen verdes.

## C20 - Telemedicina: hardening de backfill historico (idempotente + dry-run)

Estado: `COMPLETED`
Objetivo:

- Hacer el backfill de citas legacy telemedicina seguro para operacion real:
  simulable, idempotente y con reporte de impacto antes de escribir en store.

Entregables:

- [x] `TelemedicineBackfillService` extendido con opciones:
    - `dryRun`
    - `force`
    - `limit`
- [x] Deteccion de casos `already_migrated` para evitar reprocesamiento por
      defecto y reducir ruido de auditoria.
- [x] Reporte estructurado de migracion:
    - `scanned`
    - `telemedicineCandidates`
    - `processed`
    - `created`
    - `updated`
    - `skippedAlreadyMigrated`
    - `skippedByLimit`
- [x] `bin/backfill-telemedicine-intakes.php` soporta `--dry-run`,
      `--force`, `--limit` y devuelve `changesPreview`.
- [x] Pruebas de integracion nuevas para:
    - migracion base
    - dry-run no destructivo
    - idempotencia en segunda corrida

Criterio de salida:

- [x] Backfill puede correrse en modo simulacion sin mutar store.
- [x] Segunda corrida sin `--force` no reprocesa casos ya migrados.
- [x] CLI entrega resumen accionable para ventana operativa.
- [x] Suite telemedicina y gates globales permanecen verdes.

## C21 - Telemedicina: diagnostico operativo post-backfill (drift + severidad)

Estado: `COMPLETED`
Objetivo:

- Convertir integridad telemedicina en una señal operativa accionable para
  staff/backend: detectar drift de linkage/media/backlog con severidad y
  remediación sugerida, sin tocar frontend.

Entregables:

- [x] Nuevo motor `lib/telemedicine/TelemedicineOpsDiagnostics.php` que clasifica
      checks por severidad (`critical|warning|info`) y estado
      (`healthy|degraded|critical`).
- [x] `TelemedicineOpsSnapshot` enriquecido con `diagnostics` para health/admin y
      con nuevos gauges Prometheus de diagnóstico.
- [x] Nuevo endpoint admin
      `GET /api.php?resource=telemedicine-ops-diagnostics`.
- [x] Nueva herramienta CLI `bin/telemedicine-ops-diagnostics.php` con guardrails:
    - `--strict` (exit `2` por issues críticos)
    - `--fail-on-warning` (exit `3` por críticos/advertencias)
- [x] Contratos actualizados en `docs/API.md` y `docs/openapi.yaml`.
- [x] Cobertura nueva unit/integration para diagnóstico, endpoint y script.

Criterio de salida:

- [x] Health/admin exponen resumen de diagnóstico sin PHI.
- [x] Métricas Prometheus incluyen estado de diagnóstico y conteos por severidad.
- [x] Endpoint admin devuelve checks/issue list reproducibles.
- [x] CLI permite fail-fast operativo por severidad.
- [x] Suite telemedicina y gates globales permanecen verdes.

## C22 - Telemedicina: integracion en reporte semanal y semaforo operativo

Estado: `COMPLETED`
Objetivo:

- Convertir diagnosticos telemedicina en señal semanal de producción
  (warning/impact/runbook) para evitar que drift clínico quede invisible en
  la rutina de operaciones.

Entregables:

- [x] `REPORTE-SEMANAL-PRODUCCION.ps1` incorpora snapshot telemedicina desde
      `health.checks.telemedicine`:
    - policy
    - diagnostics
    - integrity
    - review queue
- [x] Nuevos umbrales operativos en reporte:
    - `TelemedicineReviewQueueWarnCount`
    - `TelemedicineStagedUploadsWarnCount`
    - `TelemedicineUnlinkedIntakesWarnCount`
- [x] Nuevos warning codes semanales de telemedicina:
    - `telemedicine_diagnostics_critical_*`
    - `telemedicine_diagnostics_warning_*`
    - `telemedicine_review_queue_alta_*`
    - `telemedicine_staged_legacy_uploads_*`
    - `telemedicine_unlinked_intakes_alta_*`
    - `telemedicine_dangling_links_*`
    - `telemedicine_case_photos_missing_private_path_*`
- [x] `bin/powershell/Common.Warnings.ps1` actualizado con severidad/impacto/runbook
      para warnings telemedicina y bucket `warningsByImpact.telemedicine`.
- [x] Markdown + JSON del weekly report incluyen bloque `Telemedicine Ops` /
      `telemedicine` con estado y conteos.
- [x] Contrato Node actualizado en
      `tests-node/weekly-report-script-contract.test.js`.

Criterio de salida:

- [x] Reporte semanal expone estado telemedicina en markdown y JSON.
- [x] Los warnings telemedicina se clasifican con severidad/impacto coherentes.
- [x] Contratos Node del reporte permanecen verdes.
- [x] `npm run agent:test`, `npm run test:php`, `npm run agent:gate` en verde.

## C23 - Telemedicina: guardrails diarios + post-deploy (monitor/gate)

Estado: `COMPLETED`
Objetivo:

- Elevar telemedicina a guardrail operativo de ejecucion diaria y post-deploy,
  para que degradaciones clinicas (`diagnostics`/`integrity`) no queden solo en
  reporte semanal.

Entregables:

- [x] `MONITOR-PRODUCCION.ps1` validando `health.checks.telemedicine` con
      thresholds configurables:
    - `RequireTelemedicineConfigured`
    - `MaxTelemedicineReviewQueue`
    - `MaxTelemedicineStagedUploads`
    - `MaxTelemedicineUnlinkedIntakes`
    - override temporal `AllowDegradedTelemedicineDiagnostics`
- [x] `VERIFICAR-DESPLIEGUE.ps1` y `SMOKE-PRODUCCION.ps1` con modo
      `RequireTelemedicineReady`.
- [x] `GATE-POSTDEPLOY.ps1` propagando `RequireTelemedicineReady` a verify+smoke.
- [x] `.github/workflows/prod-monitor.yml` extendido con inputs/env/summary para
      guardrails telemedicina y cableado al monitor.
- [x] `.github/workflows/post-deploy-gate.yml` extendido con
      `require_telemedicine_ready` (input/env/effective/summary) y wiring al gate.
- [x] Contratos Node reforzados:
    - `tests-node/prod-monitor-workflow-contract.test.js`
    - `tests-node/post-deploy-gate-workflow-contract.test.js`
- [x] `npm run agent:test` incluye `prod-monitor-workflow-contract.test.js`.

Criterio de salida:

- [x] Monitor diario falla por drift critico telemedicina sin depender del KPI semanal.
- [x] Gate post-deploy puede exigir telemedicina lista por input/vars.
- [x] Contratos de workflow detectan regresiones de wiring telemedicina.
- [x] `npm run test:php` y `npm run agent:gate` permanecen en verde.

## C24 - Telemedicina: incidente dedicado en monitor diario (apertura/cierre automatico)

Estado: `COMPLETED`
Objetivo:

- Separar la degradacion de telemedicina del incidente generico de monitor para
  tener triage y ownership especifico de dominio clinico remoto.

Entregables:

- [x] `.github/workflows/prod-monitor.yml` agrega evaluacion explicita de
      telemedicina (`id: telemedicine_monitor`) con salida:
    - `TELEMEDICINE_MONITOR_STATUS`
    - `TELEMEDICINE_MONITOR_REASON`
- [x] Incidente dedicado schedule-only:
    - titulo: `[ALERTA PROD] Monitor telemedicina degradado`
    - labels: `production-alert`, `telemedicine`
    - apertura por `failure()` + `TELEMEDICINE_MONITOR_STATUS == failed`
- [x] Autocierre dedicado:
    - `Cerrar incidente telemedicina al recuperar (solo schedule)`
    - ejecuta con `always()` y cierra cuando status deja de ser `failed`.
- [x] Incidente generico de monitor se ajusta para no duplicar alertas cuando
      la causa primaria es telemedicina (`TELEMEDICINE_MONITOR_STATUS != failed`).
- [x] Summary del workflow publica:
    - `telemedicine_monitor_status`
    - `telemedicine_monitor_reason`
    - `telemedicine_monitor_step_outcome`
- [x] `tests-node/prod-monitor-workflow-contract.test.js` reforzado para:
    - steps de incidente telemedicina
    - wiring env/condiciones
    - lineas nuevas en summary

Criterio de salida:

- [x] Degradacion telemedicina abre incidente dedicado y no se mezcla con
      incidente generico de monitor.
- [x] Recuperacion cierra incidente dedicado automaticamente.
- [x] Contratos Node del workflow permanecen verdes.
- [x] `npm run test:php` y `npm run agent:gate` en verde.

## C25 - Telemedicina: incidente dedicado en post-deploy gate (apertura/cierre automatico)

Estado: `COMPLETED`
Objetivo:

- Separar degradaciones de telemedicina en post-deploy gate del incidente
  generico para tener triage especifico del dominio clinico remoto.

Entregables:

- [x] `.github/workflows/post-deploy-gate.yml` agrega step
      `Evaluar estado telemedicina del gate` (`id: telemedicine_gate`) con
      clasificacion:
    - `healthy`
    - `degraded_only`
    - `degraded_mixed`
    - `unknown`
- [x] El step telemedicina publica trazabilidad en env/output:
    - `TELEMEDICINE_GATE_STATUS`
    - `TELEMEDICINE_GATE_REASON`
    - `TELEMEDICINE_GATE_FAILURES`
    - `TELEMEDICINE_GATE_NON_TELE_FAILURES`
- [x] Incidente generico de gate se ajusta para no abrir en degradacion
      telemedicina-only (`env.TELEMEDICINE_GATE_STATUS != 'degraded_only'`).
- [x] Se agrega incidente dedicado:
    - `Crear/actualizar incidente telemedicina de gate`
    - titulo: `[ALERTA PROD] Gate post-deploy telemedicina degradado`
    - labels: `production-alert`, `telemedicine`
    - apertura para `degraded_only` y `degraded_mixed`
- [x] Se agrega autocierre dedicado:
    - `Cerrar incidente telemedicina de gate al recuperar`
- [x] Summary telemedicina post-evaluacion:
    - `Telemedicine gate status`
    - `Telemedicine gate reason`
    - `Telemedicine gate failures`
    - `Telemedicine gate non-tele failures`
    - `Telemedicine gate step outcome`
- [x] Contrato Node reforzado en
      `tests-node/post-deploy-gate-workflow-contract.test.js`.

Criterio de salida:

- [x] Degradacion telemedicina-only abre incidente dedicado sin duplicar
      incidente generico.
- [x] Degradacion mixta mantiene telemetria dedicada y conserva trazabilidad
      operativa en el gate.
- [x] Recuperacion cierra incidente dedicado automaticamente.
- [x] Contratos Node del workflow permanecen verdes.
- [x] `npm run agent:test`, `npm run test:php` y `npm run agent:gate`
      permanecen en verde.

## C26 - Telemedicina: incidente dedicado en post-deploy fast lane (apertura/cierre automatico)

Estado: `COMPLETED`
Objetivo:

- Extender la separacion de incidentes telemedicina al carril rapido
  `post-deploy-fast`, evitando ruido en el incidente generico cuando la
  degradacion es clinica remota.

Entregables:

- [x] `.github/workflows/post-deploy-fast.yml` agrega step
      `Evaluar estado telemedicina fast lane` (`id: telemedicine_fast`) con
      clasificacion:
    - `healthy`
    - `degraded_only`
    - `degraded_mixed`
    - `unknown`
- [x] Wiring de variables/output para trazabilidad:
    - `TELEMEDICINE_FAST_STATUS`
    - `TELEMEDICINE_FAST_REASON`
    - `TELEMEDICINE_FAST_FAILURES`
    - `TELEMEDICINE_FAST_NON_TELE_FAILURES`
- [x] Resumen fast ampliado con:
    - `Telemedicine fast status`
    - `Telemedicine fast reason`
    - `Telemedicine fast failures`
    - `Telemedicine fast non-tele failures`
    - `Telemedicine fast step outcome`
- [x] Incidente generico fast ajustado para no abrir en
      `degraded_only` (`env.TELEMEDICINE_FAST_STATUS != 'degraded_only'`).
- [x] Incidente dedicado fast:
    - `Crear/actualizar incidente telemedicina fast lane`
    - titulo: `[ALERTA PROD] Post-Deploy Fast Lane telemedicina degradado`
    - labels: `production-alert`, `fast-lane`, `telemedicine`
    - apertura para `degraded_only` y `degraded_mixed`
- [x] Autocierre dedicado fast:
    - `Cerrar incidente telemedicina fast lane al recuperar`
- [x] Contrato Node reforzado en
      `tests-node/post-deploy-fast-workflow-contract.test.js`.

Criterio de salida:

- [x] Degradacion telemedicina-only abre incidente dedicado fast sin duplicar
      incidente generico.
- [x] Degradacion mixta mantiene trazabilidad telemedicina en fast lane.
- [x] Recuperacion cierra incidente dedicado fast automaticamente.
- [x] Contratos Node del workflow permanecen verdes.
- [x] `npm run agent:gate` permanece en verde.

## C27 - Telemedicina: incidente dedicado en nightly stability (apertura/cierre automatico)

Estado: `COMPLETED`
Objetivo:

- Extender el patron de incidente dedicado de telemedicina al workflow
  `nightly-stability`, separando degradaciones clinicas del incidente generico
  de regresion pesada.

Entregables:

- [x] `.github/workflows/nightly-stability.yml` agrega step
      `Evaluar estado telemedicina nightly` (`id: telemedicine_nightly`) con
      clasificacion:
    - `healthy`
    - `degraded_only`
    - `degraded_mixed`
    - `unknown`
- [x] Wiring de variables/output:
    - `TELEMEDICINE_NIGHTLY_STATUS`
    - `TELEMEDICINE_NIGHTLY_REASON`
    - `TELEMEDICINE_NIGHTLY_FAILURES`
    - `TELEMEDICINE_NIGHTLY_NON_TELE_FAILURES`
- [x] Summary nightly ampliado con estado/razon/conteos/outcome de
      telemedicina.
- [x] Incidente generico nightly ajustado para no abrir en `degraded_only`
      (`env.TELEMEDICINE_NIGHTLY_STATUS != 'degraded_only'`).
- [x] Incidente dedicado nightly:
    - `Crear/actualizar incidente telemedicina nightly`
    - titulo: `[ALERTA PROD] Nightly stability telemedicina degradado`
    - labels: `production-alert`, `nightly-stability`, `telemedicine`
    - apertura para `degraded_only` y `degraded_mixed`
- [x] Autocierre dedicado nightly:
    - `Cerrar incidente telemedicina nightly al recuperar`
- [x] Contrato Node reforzado en
      `tests-node/nightly-stability-workflow-contract.test.js`.

Criterio de salida:

- [x] Degradacion telemedicina-only abre incidente dedicado nightly sin
      duplicar incidente generico.
- [x] Degradacion mixta mantiene trazabilidad telemedicina en nightly.
- [x] Recuperacion cierra incidente dedicado nightly automaticamente.
- [x] Contratos Node del workflow permanecen verdes.
- [x] `npm run agent:gate` permanece en verde.

## C28 - Telemedicina: incidente dedicado en calendar write smoke (apertura/cierre automatico)

Estado: `COMPLETED`
Objetivo:

- Unificar el patron de incidentes dedicados de telemedicina en
  `calendar-write-smoke`, separando degradacion clinica remota del incidente
  generico de agenda write.

Entregables:

- [x] `.github/workflows/calendar-write-smoke.yml` agrega clasificacion
      telemedicina:
    - step `Clasificar estado telemedicina calendar smoke`
    - salidas/env:
        - `TELEMEDICINE_CALENDAR_STATUS`
        - `TELEMEDICINE_CALENDAR_REASON`
        - `TELEMEDICINE_CALENDAR_FAILURES`
        - `TELEMEDICINE_CALENDAR_NON_TELE_FAILURES`
- [x] `Preflight calendar health` expone trazabilidad aditiva de telemedicina:
    - `telemedicine_health`
    - `telemedicine_reason`
    - `telemedicine_configured`
    - `telemedicine_diagnostics_status`
    - `telemedicine_hard_failures`
- [x] Summary de calendar smoke ampliado con estado/razon/conteos/outcome
      telemedicina.
- [x] Incidente generico de calendar smoke ajustado para no abrir en
      `degraded_only` (`env.TELEMEDICINE_CALENDAR_STATUS != 'degraded_only'`).
- [x] Incidente dedicado telemedicina:
    - `Crear/actualizar incidente telemedicina calendar write smoke`
    - titulo: `[ALERTA PROD] Calendar Write Smoke telemedicina degradado`
    - labels: `production-alert`, `calendar-smoke`, `telemedicine`,
      `severity:critical`
    - apertura para `degraded_only` y `degraded_mixed`
- [x] Autocierre dedicado:
    - `Cerrar incidente telemedicina calendar write smoke al recuperar`
- [x] Contrato Node reforzado en
      `tests-node/calendar-write-smoke-workflow-contract.test.js`.

Criterio de salida:

- [x] Degradacion telemedicina-only abre incidente dedicado sin duplicar
      incidente generico de calendar smoke.
- [x] Degradacion mixta mantiene trazabilidad telemedicina y agenda write.
- [x] Recuperacion cierra incidente dedicado automaticamente.
- [x] Contratos Node del workflow permanecen verdes.
- [x] `npm run agent:gate` permanece en verde.

## C29 - Telemedicina: incidente dedicado en weekly KPI report (apertura/cierre automatico)

Estado: `COMPLETED`
Objetivo:

- Extender el patron de incidente dedicado de telemedicina al workflow
  `weekly-kpi-report`, separando degradacion telemedicina-only del incidente
  semanal general.

Entregables:

- [x] `.github/workflows/weekly-kpi-report.yml` agrega outputs normalizados
      de telemedicina semanal:
    - `telemedicine_warning_codes`
    - `telemedicine_warning_count_int`
    - `telemedicine_warning_critical_count_int`
    - `telemedicine_warning_non_critical_count_int`
    - `telemedicine_warning_data_valid`
    - `telemedicine_incident_required`
    - `telemedicine_incident_recovered`
    - `telemedicine_incident_reason_codes`
    - `telemedicine_incident_severity`
    - `telemedicine_signal_key`
    - `telemedicine_weekly_status`
    - `telemedicine_weekly_reason`
    - `telemedicine_weekly_failures`
    - `telemedicine_weekly_non_tele_failures`
- [x] Summary semanal ampliado con trazabilidad telemedicina dedicada.
- [x] Incidente general semanal ajustado para no abrir en
      `telemedicine_weekly_status=degraded_only`.
- [x] Incidente dedicado telemedicina:
    - `Crear/actualizar incidente semanal de telemedicina`
    - titulo: `[ALERTA PROD] Weekly KPI telemedicina degradada`
    - labels: `production-alert`, `weekly-kpi`, `telemedicine`,
      `severity:critical|warning`
    - apertura para `degraded_only` y `degraded_mixed`
- [x] Autocierre dedicado:
    - `Cerrar incidente semanal de telemedicina al recuperar`
- [x] `ops_sla` excluye el nuevo titulo semanal dedicado de telemedicina para
      evitar falso rojo en `incidents_open_external`.
- [x] Contrato Node reforzado en
      `tests-node/weekly-kpi-workflow-contract.test.js`.

Criterio de salida:

- [x] Degradacion telemedicina-only abre incidente dedicado semanal sin
      duplicar incidente general.
- [x] Degradacion mixta mantiene trazabilidad telemedicina + plataforma.
- [x] Recuperacion cierra incidente dedicado automaticamente.
- [x] Contratos Node del workflow permanecen verdes.
- [x] `npm run agent:gate` permanece en verde.

## C30 - Telemedicina: incidente dedicado en deploy-hosting post-cutover (apertura/cierre automatico)

Estado: `COMPLETED`
Objetivo:

- Cubrir el deploy de produccion (`deploy-hosting`) con evaluacion explicita de
  salud telemedicina post-cutover y ciclo dedicado de incidente para evitar
  degradaciones silenciosas entre deploy y monitor diario.

Entregables:

- [x] `.github/workflows/deploy-hosting.yml` agrega evaluacion telemedicina
      post-smoke en prod:
    - step `Evaluar estado telemedicina deploy-hosting`
    - env/output:
        - `TELEMEDICINE_DEPLOY_STATUS`
        - `TELEMEDICINE_DEPLOY_REASON`
        - `TELEMEDICINE_DEPLOY_FAILURES`
        - `TELEMEDICINE_DEPLOY_NON_TELE_FAILURES`
- [x] Clasificacion inicial de estado:
    - `healthy`
    - `degraded`
    - `unknown`
- [x] Incidente dedicado deploy-hosting:
    - `Crear/actualizar incidente telemedicina deploy-hosting`
    - titulo: `[ALERTA PROD] Deploy Hosting telemedicina degradada`
    - labels: `production-alert`, `deploy-hosting`, `telemedicine`,
      `severity:critical|warning`
    - apertura solo en ejecucion automatica no-manual (`workflow_run`)
- [x] Autocierre dedicado:
    - `Cerrar incidente telemedicina deploy-hosting al recuperar`
- [x] `Production summary` ampliado con trazabilidad telemedicina:
    - status/reason/failures/non-tele/outcome
- [x] Permisos de workflow extendidos con `issues: write`.
- [x] Contrato Node reforzado en
      `tests-node/deploy-hosting-workflow-contract.test.js`.

Criterio de salida:

- [x] Deploy automatico con degradacion telemedicina abre incidente dedicado.
- [x] Deploy automatico con recuperacion cierra incidente dedicado.
- [x] Ejecucion manual no genera spam de incidentes automaticos.
- [x] Contratos Node del workflow permanecen verdes.
- [x] `npm run agent:gate` permanece en verde.

## C31 - Telemedicina: incidente dedicado en deploy-staging post-smoke (apertura/cierre automatico)

Estado: `COMPLETED`
Objetivo:

- Cubrir el deploy de staging (`deploy-staging`) con evaluacion explicita de
  salud telemedicina post-smoke y ciclo dedicado de incidente para detectar
  degradaciones antes de promover a produccion.

Entregables:

- [x] `.github/workflows/deploy-staging.yml` agrega evaluacion telemedicina
      post-smoke en staging:
    - step `Evaluar estado telemedicina deploy-staging`
    - env/output:
        - `TELEMEDICINE_STAGING_STATUS`
        - `TELEMEDICINE_STAGING_REASON`
        - `TELEMEDICINE_STAGING_FAILURES`
        - `TELEMEDICINE_STAGING_NON_TELE_FAILURES`
- [x] Clasificacion inicial de estado:
    - `healthy`
    - `degraded`
    - `unknown`
- [x] Incidente dedicado deploy-staging:
    - `Crear/actualizar incidente telemedicina deploy-staging`
    - titulo: `[ALERTA PROD] Deploy Staging telemedicina degradada`
    - labels: `production-alert`, `deploy-staging`, `telemedicine`,
      `severity:critical|warning`
    - apertura solo en ejecucion automatica no-manual (`push`)
- [x] Autocierre dedicado:
    - `Cerrar incidente telemedicina deploy-staging al recuperar`
- [x] `Staging summary` ampliado con trazabilidad telemedicina:
    - status/reason/failures/non-tele/outcome
- [x] Permisos de workflow extendidos con `issues: write`.
- [x] Contrato Node reforzado en
      `tests-node/public-routing-deploy-workflows-contract.test.js`.

Criterio de salida:

- [x] Deploy automatico staging con degradacion telemedicina abre incidente
      dedicado.
- [x] Deploy automatico staging con recuperacion cierra incidente dedicado.
- [x] Ejecucion manual no genera spam de incidentes automaticos.
- [x] Contratos Node del workflow permanecen verdes.
- [x] `npm run agent:gate` permanece en verde.

## C32 - Telemedicina: incidente dedicado en deploy-frontend-selfhosted (apertura/cierre automatico)

Estado: `COMPLETED`
Objetivo:

- Cubrir el deploy manual self-hosted de frontend con evaluacion explicita de
  salud telemedicina post-deploy y ciclo dedicado de incidente para detectar
  degradaciones introducidas en publicaciones directas fuera del pipeline
  canary.

Entregables:

- [x] `.github/workflows/deploy-frontend-selfhosted.yml` agrega evaluacion
      telemedicina post-deploy:
    - step `Evaluate telemedicine health after frontend deploy`
    - env/output:
        - `TELEMEDICINE_SELFHOSTED_STATUS`
        - `TELEMEDICINE_SELFHOSTED_REASON`
        - `TELEMEDICINE_SELFHOSTED_FAILURES`
        - `TELEMEDICINE_SELFHOSTED_NON_TELE_FAILURES`
- [x] Clasificacion inicial de estado:
    - `healthy`
    - `degraded`
    - `unknown`
- [x] Incidente dedicado deploy self-hosted:
    - `Create or update telemedicine incident (self-hosted deploy)`
    - titulo: `[ALERTA PROD] Deploy Frontend Self-Hosted telemedicina degradada`
    - labels: `production-alert`, `deploy-frontend-selfhosted`, `telemedicine`,
      `severity:critical|warning`
- [x] Autocierre dedicado:
    - `Close telemedicine incident when recovered (self-hosted deploy)`
- [x] `Deployment summary` ampliado con trazabilidad telemedicina:
    - status/reason/failures/non-tele/outcome
- [x] Permisos de workflow extendidos con `issues: write`.
- [x] Contrato Node reforzado en
      `tests-node/deploy-frontend-selfhosted-workflow-contract.test.js`.

Criterio de salida:

- [x] Deploy self-hosted con degradacion telemedicina abre/actualiza incidente
      dedicado.
- [x] Deploy self-hosted con recuperacion cierra incidente dedicado.
- [x] Contratos Node del workflow permanecen verdes.
- [x] `npm run agent:gate` permanece en verde.

## C33 - Telemedicina: incidente dedicado en repair-git-sync post-recovery (apertura/cierre automatico)

Estado: `COMPLETED`
Objetivo:

- Cubrir el flujo de autorreparacion `repair-git-sync` con evaluacion explicita
  de salud telemedicina tras el repair remoto y ciclo dedicado de incidente para
  evitar falsos verdes cuando infraestructura recupera pero telemedicina queda
  degradada.

Entregables:

- [x] `.github/workflows/repair-git-sync.yml` agrega evaluacion telemedicina
      post-repair:
    - step `Evaluar estado telemedicina post-repair`
    - env/output:
        - `TELEMEDICINE_REPAIR_STATUS`
        - `TELEMEDICINE_REPAIR_REASON`
        - `TELEMEDICINE_REPAIR_FAILURES`
        - `TELEMEDICINE_REPAIR_NON_TELE_FAILURES`
- [x] Clasificacion inicial de estado:
    - `healthy`
    - `degraded`
    - `unknown`
- [x] Incidente dedicado de repair telemedicina:
    - `Crear/actualizar incidente telemedicina de repair`
    - titulo: `[ALERTA PROD] Repair git sync telemedicina degradado`
    - labels: `production-alert`, `repair-git-sync`, `telemedicine`,
      `severity:critical|warning`
    - apertura solo en ejecucion automatizada no-manual (`workflow_run`)
- [x] Autocierre dedicado:
    - `Cerrar incidente telemedicina de repair al recuperar`
- [x] `Repair summary` ampliado con trazabilidad telemedicina:
    - status/reason/failures/non-tele/outcome
- [x] Contrato Node reforzado en
      `tests-node/deploy-hosting-workflow-contract.test.js`.

Criterio de salida:

- [x] Repair automatico con degradacion telemedicina abre/actualiza incidente
      dedicado.
- [x] Repair automatico con recuperacion cierra incidente dedicado.
- [x] Contratos Node del workflow permanecen verdes.
- [x] `npm run agent:gate` permanece en verde.

## C34 - Telemedicina: deduplicacion por senal y severidad en prod-monitor

Estado: `COMPLETED`
Objetivo:

- Endurecer el ciclo de incidente dedicado de telemedicina en `prod-monitor`
  para evitar ruido por comentarios repetidos y clasificar severidad operativa
  (`warning|critical`) en base al motivo real de degradacion.

Entregables:

- [x] `.github/workflows/prod-monitor.yml` mejora el step
      `Crear/actualizar incidente telemedicina (solo schedule)` con:
    - `signal` canonica:
        - `status:<...>|reason:<...>`
    - marker de dedupe:
        - `prod-monitor-telemedicine-signal`
    - etiquetas de severidad:
        - `severity:critical`
        - `severity:warning`
    - merge de labels con limpieza de severidad previa.
    - update idempotente sin comentario repetido cuando la senal no cambia.
    - comentario de auditoria solo cuando cambia la senal.
- [x] Etiquetas dedicadas del incidente:
    - `production-alert`, `telemedicine`, `prod-monitor`, `severity:*`
- [x] Contrato Node reforzado en
      `tests-node/prod-monitor-workflow-contract.test.js` para marker + severidad.

Criterio de salida:

- [x] Corridas schedule con misma degradacion no generan spam de comentarios.
- [x] Cambio de senal telemedicina actualiza issue y deja rastro explicito.
- [x] Severidad queda visible en labels (`critical|warning`).
- [x] Contratos Node del workflow permanecen verdes.
- [x] `npm run agent:gate` permanece en verde.

## C35 - Telemedicina: deduplicacion por senal y severidad en nightly-stability

Estado: `COMPLETED`
Objetivo:

- Endurecer el incidente dedicado de telemedicina en `nightly-stability` para
  evitar ruido por comentarios repetidos y clasificar severidad (`warning` /
  `critical`) en base a la razon de degradacion.

Entregables:

- [x] `.github/workflows/nightly-stability.yml` mejora el step
      `Crear/actualizar incidente telemedicina nightly` con:
    - `signal` canonica:
        - `status:<...>|reason:<...>|failures:<...>`
    - marker de dedupe:
        - `nightly-telemedicine-signal`
    - etiquetas de severidad:
        - `severity:critical`
        - `severity:warning`
    - merge de labels con limpieza de severidad previa.
    - update idempotente sin comentario repetido cuando la senal no cambia.
    - comentario de auditoria solo cuando cambia la senal.
- [x] Etiquetas dedicadas del incidente:
    - `production-alert`, `nightly-stability`, `telemedicine`, `severity:*`
- [x] Contrato Node reforzado en
      `tests-node/nightly-stability-workflow-contract.test.js` para marker +
      severidad.

Criterio de salida:

- [x] Corridas con misma degradacion no generan spam de comentarios.
- [x] Cambio de senal telemedicina actualiza issue y deja rastro explicito.
- [x] Severidad queda visible en labels (`critical|warning`).
- [x] Contratos Node del workflow permanecen verdes.
- [x] `npm run agent:gate` permanece en verde.

## C36 - Telemedicina: deduplicacion por senal y severidad en post-deploy-fast

Estado: `COMPLETED`
Objetivo:

- Endurecer el incidente dedicado de telemedicina en `post-deploy-fast` para
  evitar ruido por comentarios repetidos y clasificar severidad operativa
  (`warning|critical`) en base a la senal real del gate rapido.

Entregables:

- [x] `.github/workflows/post-deploy-fast.yml` mejora el step
      `Crear/actualizar incidente telemedicina fast lane` con:
    - `signal` canonica:
        - `status:<...>|reason:<...>|failures:<...>`
    - marker de dedupe:
        - `post-deploy-fast-telemedicine-signal`
    - etiquetas de severidad:
        - `severity:critical`
        - `severity:warning`
    - merge de labels con limpieza de severidad previa.
    - update idempotente sin comentario repetido cuando la senal no cambia.
    - comentario de auditoria solo cuando cambia la senal.
- [x] Etiquetas dedicadas del incidente:
    - `production-alert`, `fast-lane`, `telemedicine`, `severity:*`
- [x] Contrato Node reforzado en
      `tests-node/post-deploy-fast-workflow-contract.test.js` para marker +
      severidad.

Criterio de salida:

- [x] Corridas con misma degradacion no generan spam de comentarios.
- [x] Cambio de senal telemedicina actualiza issue y deja rastro explicito.
- [x] Severidad queda visible en labels (`critical|warning`).
- [x] Contratos Node del workflow permanecen verdes.
- [x] `npm run agent:gate` permanece en verde.

## C37 - Telemedicina: deduplicacion por senal y severidad en post-deploy-gate

Estado: `COMPLETED`
Objetivo:

- Endurecer el incidente dedicado de telemedicina en `post-deploy-gate` para
  evitar ruido por comentarios repetidos y clasificar severidad operativa
  (`warning|critical`) en base a la senal real del gate full-regression.

Entregables:

- [x] `.github/workflows/post-deploy-gate.yml` mejora el step
      `Crear/actualizar incidente telemedicina de gate` con:
    - `signal` canonica:
        - `status:<...>|reason:<...>|failures:<...>`
    - marker de dedupe:
        - `post-deploy-gate-telemedicine-signal`
    - etiquetas de severidad:
        - `severity:critical`
        - `severity:warning`
    - merge de labels con limpieza de severidad previa.
    - update idempotente sin comentario repetido cuando la senal no cambia.
    - comentario de auditoria solo cuando cambia la senal.
- [x] Etiquetas dedicadas del incidente:
    - `production-alert`, `telemedicine`, `post-deploy-gate`, `severity:*`
- [x] Contrato Node reforzado en
      `tests-node/post-deploy-gate-workflow-contract.test.js` para marker +
      severidad.

Criterio de salida:

- [x] Corridas con misma degradacion no generan spam de comentarios.
- [x] Cambio de senal telemedicina actualiza issue y deja rastro explicito.
- [x] Severidad queda visible en labels (`critical|warning`).
- [x] Contratos Node del workflow permanecen verdes.
- [x] `npm run agent:gate` permanece en verde.

## C38 - Telemedicina: deduplicacion por senal y severidad en calendar-write-smoke

Estado: `COMPLETED`
Objetivo:

- Endurecer el incidente dedicado de telemedicina en `calendar-write-smoke`
  para evitar ruido por comentarios repetidos y clasificar severidad operativa
  (`warning|critical`) en base a la senal real del smoke diario.

Entregables:

- [x] `.github/workflows/calendar-write-smoke.yml` mejora el step
      `Crear/actualizar incidente telemedicina calendar write smoke` con:
    - `signal` canonica:
        - `status:<...>|reason:<...>|failures:<...>`
    - marker de dedupe:
        - `calendar-write-smoke-telemedicine-signal`
    - etiquetas de severidad:
        - `severity:critical`
        - `severity:warning`
    - merge de labels con limpieza de severidad previa.
    - update idempotente sin comentario repetido cuando la senal no cambia.
    - comentario de auditoria solo cuando cambia la senal.
- [x] Etiquetas dedicadas del incidente:
    - `production-alert`, `calendar-smoke`, `telemedicine`, `severity:*`
- [x] Contrato Node reforzado en
      `tests-node/calendar-write-smoke-workflow-contract.test.js` para marker +
      severidad.

Criterio de salida:

- [x] Corridas con misma degradacion no generan spam de comentarios.
- [x] Cambio de senal telemedicina actualiza issue y deja rastro explicito.
- [x] Severidad queda visible en labels (`critical|warning`).
- [x] Contratos Node del workflow permanecen verdes.
- [x] `npm run agent:gate` permanece en verde.

## C39 - Telemedicina: severidad robusta en deploy-hosting/staging/selfhosted

Estado: `COMPLETED`
Objetivo:

- Endurecer la clasificacion de severidad en incidentes dedicados de
  telemedicina para `deploy-hosting`, `deploy-staging` y
  `deploy-frontend-selfhosted`, evitando falsos `warning` cuando existen
  razones estructurales (`hard_failures`, parseo/lectura health, falta de
  configuracion).

Entregables:

- [x] `.github/workflows/deploy-hosting.yml` actualiza severidad en
      `Crear/actualizar incidente telemedicina deploy-hosting`:
    - `critical` para:
        - `diagnostics_critical`
        - `hard_failures:*`
        - `hard_failures_invalid`
        - `health_unavailable`
        - `health_parse_error`
        - `telemedicine_missing`
        - `not_configured`
    - `warning` para el resto de degradaciones.
- [x] `.github/workflows/deploy-staging.yml` aplica la misma regla de
      severidad robusta para incidente dedicado de telemedicina.
- [x] `.github/workflows/deploy-frontend-selfhosted.yml` aplica la misma regla
      de severidad robusta para incidente dedicado de telemedicina.
- [x] Contratos Node reforzados:
    - `tests-node/deploy-hosting-workflow-contract.test.js`
    - `tests-node/public-routing-deploy-workflows-contract.test.js`
    - `tests-node/deploy-frontend-selfhosted-workflow-contract.test.js`

Criterio de salida:

- [x] Razones estructurales de degradacion se etiquetan como
      `severity:critical`.
- [x] Degradaciones no estructurales se etiquetan como `severity:warning`.
- [x] Contratos Node de deploy-hosting/staging/selfhosted permanecen verdes.
- [x] `npm run agent:gate` permanece en verde.

## C40 - Telemedicina: severidad robusta en repair-git-sync

Estado: `COMPLETED`
Objetivo:

- Endurecer la clasificacion de severidad del incidente dedicado de
  telemedicina en `repair-git-sync`, evitando falsos `warning` cuando la causa
  es estructural.

Entregables:

- [x] `.github/workflows/repair-git-sync.yml` actualiza severidad en
      `Crear/actualizar incidente telemedicina de repair`:
    - `critical` para:
        - `diagnostics_critical`
        - `hard_failures:*`
        - `hard_failures_invalid`
        - `health_unavailable`
        - `health_parse_error`
        - `telemedicine_missing`
        - `not_configured`
    - `warning` para el resto de degradaciones.
- [x] Contrato Node reforzado en
      `tests-node/deploy-hosting-workflow-contract.test.js` (seccion
      `repair-git-sync`).

Criterio de salida:

- [x] Razones estructurales de degradacion se etiquetan como
      `severity:critical`.
- [x] Degradaciones no estructurales se etiquetan como `severity:warning`.
- [x] Contrato Node de `repair-git-sync` permanece verde.
- [x] `npm run agent:gate` permanece en verde.

## C41 - Telemedicina: incidente dedicado tambien para estado unknown en deploy/repair

Estado: `COMPLETED`
Objetivo:

- Evitar punto ciego operativo cuando la evaluacion de telemedicina no logra
  clasificar salud (`status=unknown`) en workflows de deploy/repair.

Entregables:

- [x] `.github/workflows/deploy-hosting.yml` abre/actualiza incidente dedicado
      de telemedicina cuando `TELEMEDICINE_DEPLOY_STATUS` es `degraded` **o**
      `unknown`.
- [x] `.github/workflows/deploy-staging.yml` aplica la misma regla para
      `TELEMEDICINE_STAGING_STATUS`.
- [x] `.github/workflows/deploy-frontend-selfhosted.yml` aplica la misma regla
      para `TELEMEDICINE_SELFHOSTED_STATUS`.
- [x] `.github/workflows/repair-git-sync.yml` aplica la misma regla para
      `TELEMEDICINE_REPAIR_STATUS`.
- [x] Contratos Node actualizados:
    - `tests-node/deploy-hosting-workflow-contract.test.js`
    - `tests-node/public-routing-deploy-workflows-contract.test.js`
    - `tests-node/deploy-frontend-selfhosted-workflow-contract.test.js`

Criterio de salida:

- [x] Estado `unknown` no queda silenciado en deploy/repair automatizados.
- [x] Estado `healthy` mantiene autocierre como hasta ahora.
- [x] Contratos Node de deploy/repair permanecen verdes.
- [x] `npm run agent:gate` permanece en verde.

## C42 - Telemedicina: unificar `unknown` en incidentes dedicados de post-deploy/nightly/calendar

Estado: `COMPLETED`
Objetivo:

- Cerrar inconsistencia operativa: en `post-deploy-fast`, `post-deploy-gate`,
  `nightly-stability` y `calendar-write-smoke`, el estado telemedicina
  `unknown` debe abrir/actualizar incidente dedicado (igual que deploy/repair),
  sin disparar incidente generico cuando sea un caso tele-only.

Entregables:

- [x] `.github/workflows/post-deploy-fast.yml`
    - Incidente generico ahora excluye `degraded_only` y `unknown` tele-only:
        - abre solo si hay falla no-tele
          (`TELEMEDICINE_FAST_NON_TELE_FAILURES != '0'`) o si el status no es
          tele-only.
    - Incidente dedicado telemedicina ahora incluye `status=unknown`.
- [x] `.github/workflows/post-deploy-gate.yml`
    - Misma regla para `TELEMEDICINE_GATE_STATUS` y
      `TELEMEDICINE_GATE_NON_TELE_FAILURES`.
    - Incidente dedicado telemedicina incluye `status=unknown`.
- [x] `.github/workflows/nightly-stability.yml`
    - Misma regla para `TELEMEDICINE_NIGHTLY_STATUS` y
      `TELEMEDICINE_NIGHTLY_NON_TELE_FAILURES`.
    - Incidente dedicado telemedicina incluye `status=unknown`.
- [x] `.github/workflows/calendar-write-smoke.yml`
    - Misma regla para `TELEMEDICINE_CALENDAR_STATUS` y
      `TELEMEDICINE_CALENDAR_NON_TELE_FAILURES`.
    - Incidente dedicado telemedicina incluye `status=unknown`.
- [x] Contratos Node actualizados:
    - `tests-node/post-deploy-fast-workflow-contract.test.js`
    - `tests-node/post-deploy-gate-workflow-contract.test.js`
    - `tests-node/nightly-stability-workflow-contract.test.js`
    - `tests-node/calendar-write-smoke-workflow-contract.test.js`

Criterio de salida:

- [x] `unknown` abre incidente dedicado telemedicina en los 4 workflows.
- [x] Incidente generico no abre por tele-only `unknown|degraded_only`.
- [x] Si hay fallas no-tele concurrentes, el incidente generico sigue abriendo.
- [x] Contratos Node de los 4 workflows permanecen verdes.
- [x] `npm run agent:gate` permanece en verde.

## C43 - Telemedicina: cerrar hueco `unknown` en monitor semanal/diario

Estado: `COMPLETED`
Objetivo:

- Unificar el tratamiento de `status=unknown` de telemedicina en
  `prod-monitor` y `weekly-kpi`, evitando falsos incidentes generales
  tele-only y preservando apertura general cuando hay fallas no-tele.

Entregables:

- [x] `.github/workflows/prod-monitor.yml`
    - agrega `TELEMEDICINE_MONITOR_NON_TELE_FAILURES`.
    - `Ejecutar monitor de produccion` ahora tiene `id: monitor_prod`.
    - `Evaluar estado telemedicina...` calcula/expone non-tele failures.
    - incidente general excluye tele-only `failed|unknown` y abre en esos
      estados solo con `TELEMEDICINE_MONITOR_NON_TELE_FAILURES != '0'`.
    - incidente dedicado telemedicina incluye `status=unknown`.
    - cierre dedicado telemedicina solo cuando `status=healthy`.
- [x] `.github/workflows/weekly-kpi-report.yml`
    - incidente general excluye tele-only `degraded_only|unknown` y abre en esos
      estados solo con `telemedicine_weekly_non_tele_failures != '0'`.
    - incidente dedicado telemedicina incluye `status=unknown`.
- [x] Contratos Node actualizados:
    - `tests-node/prod-monitor-workflow-contract.test.js`
    - `tests-node/weekly-kpi-workflow-contract.test.js`

Criterio de salida:

- [x] `unknown` queda enroutado a incidente dedicado donde aplica.
- [x] incidente general conserva apertura cuando hay señal no-tele.
- [x] contratos Node de monitor semanal/diario permanecen verdes.
- [x] `npm run agent:gate` permanece en verde.

## C44 - Repair: incidente general sin ruido tele-only

Estado: `COMPLETED`
Objetivo:

- Evitar duplicado de ruido en `repair-git-sync`: si la degradacion es solo
  telemedicina (`degraded|unknown`) y no hay fallas no-tele, abrir solo el
  incidente dedicado telemedicina y no el incidente general.

Entregables:

- [x] `.github/workflows/repair-git-sync.yml`
    - `Evaluar estado telemedicina post-repair` ahora calcula
      `TELEMEDICINE_REPAIR_NON_TELE_FAILURES` desde outcomes reales de
      `ssh_repair`, `verify_after_repair` y `smoke_post_repair`.
    - `Crear/actualizar incidente de repair` se condiciona a:
        - status tele no `degraded|unknown`, o
        - `TELEMEDICINE_REPAIR_NON_TELE_FAILURES != '0'`.
    - Incidente general agrega trazabilidad:
        - `telemedicine_repair_status`
        - `telemedicine_repair_reason`
        - `telemedicine_repair_non_tele_failures`
- [x] Contrato Node reforzado:
    - `tests-node/deploy-hosting-workflow-contract.test.js`
      (bloque `repair-git-sync`)

Criterio de salida:

- [x] repair tele-only no abre incidente general redundante.
- [x] repair con falla no-tele mantiene incidente general.
- [x] contrato Node de deploy-hosting/repair permanece verde.
- [x] `npm run agent:gate` permanece en verde.

## C45 - Deploy workflows: `non_tele_failures` basado en outcomes reales

Estado: `COMPLETED`
Objetivo:

- Eliminar valores fijos (`0/-1`) en `nonTeleFailures` para deploy workflows y
  calcularlos desde outcomes reales de pasos no-tele, alineando el contrato con
  el hardening aplicado en `repair-git-sync`.

Entregables:

- [x] `.github/workflows/deploy-hosting.yml`
    - `Evaluar estado telemedicina deploy-hosting` ahora recibe outcomes reales
      de pasos no-tele:
        - `validate_secrets_prod`
        - `preflight_prod`
        - `prepare_bundle_prod`
        - `deploy_prod_ftp`
        - `deploy_prod_sftp`
        - `wait_git_sync`
        - `smoke_prod`
    - Se agrega helper `countNonTeleFailures(...)` y se usa tanto en fallback
      como en estado evaluado para `TELEMEDICINE_DEPLOY_NON_TELE_FAILURES`.
- [x] `.github/workflows/deploy-staging.yml`
    - Se agregan ids de pasos no-tele (`validate_secrets_staging`,
      `preflight_staging`, `deploy_staging_ftp`, `smoke_staging`).
    - `Evaluar estado telemedicina deploy-staging` usa outcomes reales y
      `countNonTeleFailures(...)` para `TELEMEDICINE_STAGING_NON_TELE_FAILURES`.
- [x] `.github/workflows/deploy-frontend-selfhosted.yml`
    - Se agregan ids de pasos no-tele (`build_astro_routes`,
      `deploy_frontend_bundle`, `validate_public_frontend`).
    - `Evaluate telemedicine health after frontend deploy` usa helper PowerShell
      `Count-NonTeleFailures` para derivar
      `TELEMEDICINE_SELFHOSTED_NON_TELE_FAILURES` desde outcomes reales.
- [x] Contratos Node reforzados:
    - `tests-node/deploy-hosting-workflow-contract.test.js`
    - `tests-node/public-routing-deploy-workflows-contract.test.js`
    - `tests-node/deploy-frontend-selfhosted-workflow-contract.test.js`

Criterio de salida:

- [x] Deploy workflows dejan de reportar `nonTeleFailures` fijo en parse
      success/error.
- [x] `nonTeleFailures` queda derivado de outcomes reales no-tele en los tres
      workflows.
- [x] Contratos Node de deploy permanecen verdes.
- [x] `npm run agent:gate` permanece en verde.

## C46 - Deploy incidents: dedupe signal incluye `non_tele_failures`

Estado: `COMPLETED`
Objetivo:

- Evitar deduplicacion incompleta en incidentes telemedicina de deploy cuando
  cambian solo las fallas no-tele y se mantiene `status|reason|failures`.

Entregables:

- [x] `.github/workflows/deploy-hosting.yml`
    - `signal` del incidente dedicado incluye
      `non_tele:${TELEMEDICINE_DEPLOY_NON_TELE_FAILURES}`.
    - Comentario de actualizacion agrega
      `telemedicine_deploy_non_tele_failures`.
- [x] `.github/workflows/deploy-staging.yml`
    - `signal` del incidente dedicado incluye
      `non_tele:${TELEMEDICINE_STAGING_NON_TELE_FAILURES}`.
    - Comentario de actualizacion agrega
      `telemedicine_staging_non_tele_failures`.
- [x] `.github/workflows/deploy-frontend-selfhosted.yml`
    - `signal` del incidente dedicado incluye
      `non_tele:${TELEMEDICINE_SELFHOSTED_NON_TELE_FAILURES}`.
    - Comentario de actualizacion agrega
      `telemedicine_selfhosted_non_tele_failures`.
- [x] Contratos Node reforzados:
    - `tests-node/deploy-hosting-workflow-contract.test.js`
    - `tests-node/public-routing-deploy-workflows-contract.test.js`
    - `tests-node/deploy-frontend-selfhosted-workflow-contract.test.js`

Criterio de salida:

- [x] La senal dedupe de incidentes deploy cambia cuando cambia non-tele.
- [x] Comentarios de update de incidente publican trazabilidad non-tele.
- [x] Contratos Node de deploy permanecen verdes.
- [x] `npm run agent:gate` permanece en verde.

## C47 - Incidentes telemedicina no-deploy: dedupe signal con `non_tele`

Estado: `COMPLETED`
Objetivo:

- Homogeneizar deduplicacion por senal en el resto de workflows telemedicina
  (monitor/gates/nightly/calendar/repair) para que cambios no-tele tambien
  actualicen incidente dedicado.

Entregables:

- [x] `.github/workflows/post-deploy-fast.yml`
    - `signal` dedicado telemedicina ahora incluye
      `non_tele:${TELEMEDICINE_FAST_NON_TELE_FAILURES}`.
    - Comentario de update incluye `telemedicine_fast_non_tele_failures`.
- [x] `.github/workflows/post-deploy-gate.yml`
    - `signal` dedicado telemedicina ahora incluye
      `non_tele:${TELEMEDICINE_GATE_NON_TELE_FAILURES}`.
    - Comentario de update incluye `telemedicine_gate_non_tele_failures`.
- [x] `.github/workflows/nightly-stability.yml`
    - `signal` dedicado telemedicina ahora incluye
      `non_tele:${TELEMEDICINE_NIGHTLY_NON_TELE_FAILURES}`.
    - Comentario de update incluye `telemedicine_nightly_non_tele_failures`.
- [x] `.github/workflows/calendar-write-smoke.yml`
    - `signal` dedicado telemedicina ahora incluye
      `non_tele:${TELEMEDICINE_CALENDAR_NON_TELE_FAILURES}`.
    - Comentario de update incluye `telemedicine_calendar_non_tele_failures`.
- [x] `.github/workflows/prod-monitor.yml`
    - `signal` dedicado telemedicina ahora incluye
      `non_tele:${TELEMEDICINE_MONITOR_NON_TELE_FAILURES}`.
- [x] `.github/workflows/repair-git-sync.yml`
    - `signal` dedicado telemedicina ahora incluye
      `non_tele:${TELEMEDICINE_REPAIR_NON_TELE_FAILURES}`.
    - Comentario de update incluye `telemedicine_repair_non_tele_failures`.
- [x] Contratos Node reforzados:
    - `tests-node/post-deploy-fast-workflow-contract.test.js`
    - `tests-node/post-deploy-gate-workflow-contract.test.js`
    - `tests-node/nightly-stability-workflow-contract.test.js`
    - `tests-node/calendar-write-smoke-workflow-contract.test.js`
    - `tests-node/prod-monitor-workflow-contract.test.js`
    - `tests-node/deploy-hosting-workflow-contract.test.js` (bloque repair)

Criterio de salida:

- [x] Signals dedicados telemedicina quedan alineados e incluyen `non_tele`.
- [x] Comentarios de update conservan trazabilidad de non-tele.
- [x] Contratos Node de monitor/gates/nightly/calendar/repair permanecen verdes.
- [x] `npm run agent:gate` permanece en verde.

## C48 - Weekly KPI telemedicina: dedupe robusto con `non_tele` y fallback estable

Estado: `COMPLETED`
Objetivo:

- Cerrar el hueco restante en `weekly-kpi-report` para que la senal de dedupe
  del incidente dedicado de telemedicina mantenga semantica consistente con el
  resto de workflows (`non_tele`) incluso en rutas fallback (`missing_report`,
  `report_invalid`).

Entregables:

- [x] `.github/workflows/weekly-kpi-report.yml`
    - `telemedicine_signal_key` fallback `missing_report` ahora incluye
      `status|reason|failures|non_tele|reasons|stale`.
    - `telemedicineSignalKey` fallback `report_invalid` ahora incluye
      `status|reason|failures|non_tele|reasons|stale`.
    - Senal semanal normalizada usa `non_tele` (no `nontele`) y forma:
      `status|reason|failures|non_tele|reasons|stale`.
    - Body/comentario del incidente dedicado agrega
      `telemedicine_weekly_non_tele_failures`.
- [x] `tests-node/weekly-kpi-workflow-contract.test.js`
    - contrato reforzado para `telemedicine_signal_key` con `non_tele`.
    - contrato reforzado para trazabilidad `telemedicine_weekly_non_tele_failures`
      en incidente semanal.

Criterio de salida:

- [x] Weekly KPI telemedicina deduplica con semantica consistente de `non_tele`.
- [x] Fallbacks no colapsan a llaves opacas (`missing_report|report_invalid`).
- [x] Incidente dedicado semanal conserva trazabilidad de fallas no-tele.
- [x] `node --test tests-node/weekly-kpi-workflow-contract.test.js` en verde.
- [x] `npm run agent:gate` en verde.

## Contratos publicos

- No se introducen cambios breaking en contratos HTTP existentes.
- Cambios aditivos permitidos:
- `GET /api.php?resource=funnel-metrics`: objeto `retention`.
- `GET /api.php?resource=service-priorities`: ranking de navegacion por servicio/categoria.
- Reporte semanal JSON: bloque `retention` y `retentionTrend`.

## Evidencia por commit

- 2026-02-24: plan inicial creado. C1 activado como unico bloque `IN_PROGRESS`.
- 2026-02-24: agregado bloque `retention` en `funnel-metrics`, metricas de recurrencia/no-show en `metrics`, y gates criticos por dominio en CI.
- 2026-02-24: agregado `tests/Integration/AppointmentErrorCodesTest.php` para proteger normalizacion de errores en reservas (`slot_conflict` y `calendar_unreachable`).
- 2026-02-24: agregado workflow manual no destructivo `phase2-concurrency-readonly.yml` y endurecido `phase2-concurrency-write.yml` para exigir Google estricto en concurrencia real.
- 2026-02-24: agregado `phase2-flakiness-probe.yml` (manual + semanal) para ejecutar `test:phase2` en multiples repeticiones y fallar por umbral de inestabilidad.
- 2026-02-24: baseline de flakiness en run manual `22339762684` (`runs=5`, `max_failures=0`) con resultado `failures=1`, `passes=4` y estado final `failure`.
- 2026-02-24: optimizado `CI` en `e2e-tests` con cache de Playwright (`~/.cache/ms-playwright`) y eliminada corrida duplicada de `test:phase2` para reducir tiempo de pipeline sin perder cobertura critica.
- 2026-02-24: optimizado `CI` para ejecutar Playwright no critico excluyendo suites ya cubiertas por `Run Critical Agenda Gate` y `Run Critical Funnel Gate`, evitando doble corrida en `e2e-tests`.
- 2026-02-24: agregado `concurrency` en `CI` (`cancel-in-progress: true`) para cancelar corridas obsoletas por rama y reducir tiempo de espera de feedback.
- 2026-02-24: agregado filtro de cambios en job `e2e-tests` (`dorny/paths-filter`) para omitir e2e cuando no hay cambios relevantes de codigo/tests, reduciendo tiempo en commits de docs/workflows.
- 2026-02-24: corregido parseo YAML en `ci.yml` (step `Skip e2e`) para restablecer ejecucion normal de `CI` tras introducir filtro por cambios.
- 2026-02-24: reducido `WAIT_SECONDS` por defecto en `post-deploy-gate.yml` de `120` a `90` para acortar feedback post-deploy manteniendo override por `vars`/`workflow_dispatch`.
- 2026-02-24: medicion post-optimizacion: `CI` bajo a `1.55 min` (run `22340821737`, delta `-0.53 min` vs `22340555801`) y `Post-Deploy Gate` bajo a `3.20 min` (run `22340821736`, delta `-0.77 min` vs `22340555797`).
- 2026-02-24: agregado modo de espera adaptativa en `post-deploy-gate.yml` (clasificacion de cambios via `GITHUB_EVENT_PATH`) para usar espera corta en cambios no-runtime y espera completa en cambios runtime.
- 2026-02-24: reforzada deteccion de cambios para espera adaptativa con fallback `git diff before..after` cuando el payload del push no trae lista de archivos.
- 2026-02-24: medicion con espera adaptativa reforzada: `Post-Deploy Gate` bajo de `3.00 min` (run `22341156450`) a `2.45 min` (run `22341273435`, delta `-0.55 min`).
- 2026-02-24: `CI` ahora omite jobs `security` y `unit-tests` cuando no hay cambios PHP/composer/tests relevantes (via `dorny/paths-filter`), reduciendo tiempo en commits de frontend/docs/workflows sin perder cobertura en cambios backend.
- 2026-02-24: `Post-Deploy Gate` aplica `BENCH_RUNS_LIGHT` en pushes `non-runtime` y publica `BENCH_RUNS_EFFECTIVE` en el resumen para reducir tiempo de benchmark sin omitir verificacion backend base.
- 2026-02-24: `CI` ahora omite job `build` cuando no hay cambios relevantes para bundle/despliegue (via `dorny/paths-filter`), evitando empaquetado innecesario en cambios de documentacion/workflows.
- 2026-02-24: validacion manual de `phase2-concurrency-readonly`: run `22361662182` (`failure`) seguido de run `22361768420` (`success`) confirma inestabilidad intermitente en Fase 2 readonly.
- 2026-02-24: `phase2-concurrency-readonly.yml` ahora publica siempre artefactos `playwright-report` y `test-results`, y reporta `steps.phase2.outcome` en summary para acelerar diagnostico de fallos intermitentes.
- 2026-02-24: ajustado `phase2-concurrency-readonly.yml` para forzar salidas persistentes (`--reporter=line,json,html`, `PLAYWRIGHT_JSON_OUTPUT_NAME`, `--output=test-results/phase2-readonly`) tras observar run `22361858905` exitoso sin artefactos adjuntos (`total_count=0`).
- 2026-02-24: validacion post-ajuste en run `22361957390` (`success`) con `ARTIFACT_TOTAL=2` (`phase2-readonly-playwright-report`, `phase2-readonly-test-results`), confirmando diagnostico reproducible en workflow manual.
- 2026-02-24: ejecucion manual de `Post-Deploy Gate` validada (`22362170241`, `success`, `1.5 min`); se separo `concurrency` en `post-deploy-gate.yml` por tipo de evento (`manual` vs `auto`) para evitar cancelacion de corridas `workflow_dispatch` por pushes automaticos.
- 2026-02-24: verificacion de `concurrency` separada en post-deploy: run manual `22362298070` (`workflow_dispatch`, `success`) completo sin cancelacion mientras coexistia un run automatico `push` en progreso (`22362271894`).
- 2026-02-24: `CI` del commit `e4f3fdc` completo en `0.72 min` (run `22362374763`, `success` en `lint/security/unit-tests/e2e-tests/build`), consistente con reduccion de tiempo en cambios no runtime.
- 2026-02-24: endurecida prueba `tests/phase2-calendar-consistency.spec.js` para esperar sincronizacion real de slots web con la oferta mockeada (evita falso verde por opciones estaticas antes de `updateAvailableTimes`); verificado localmente con `npm run test:phase2` (`1 passed`, `1 skipped`).
- 2026-02-24: reforzada sincronizacion de slots en chat para `phase2-calendar-consistency` (la espera ahora valida especificamente opciones `HH:MM` y no cualquier `chat-booking`), reduciendo falso avance antes de render de horarios; verificado localmente con `npm run test:phase2` (`1 passed`, `1 skipped`).
- 2026-02-24: prueba de estabilidad local posterior al ajuste de sincronizacion chat (`npm run test:phase2` x5) sin fallas (`passes=5`, `fails=0`; concurrencia real permanece `skipped` sin `TEST_ENABLE_CALENDAR_WRITE=true`).
- 2026-02-24: extendido `tests/Integration/AppointmentErrorCodesTest.php` con cobertura de `booked-slots` para paths `calendar_bad_request` (fecha faltante) y `calendar_unreachable` (Google requerido), protegiendo normalizacion de codigos en agenda; validado con `php -d xdebug.mode=coverage vendor/bin/phpunit tests/Integration/AppointmentErrorCodesTest.php` (`4 tests`, `14 assertions`).
- 2026-02-24: corregido `tests/funnel-tracking.spec.js` para normalizar eventos GA4 en formato `gtag('event', ...)` dentro de `window.dataLayer`, evitando falso rojo en `Run Critical Funnel Gate` cuando el tracker no emite objetos directos; validado con `npm run test:critical:funnel` (`6 passed`).
- 2026-02-24: estabilizadas pruebas no criticas `tests/chat-booking-calendar-errors.spec.js` (espera de hidratacion + mensajes ES/EN + idioma `es` fijado) y `tests/cookie-consent.spec.js` (aserciones alineadas a Google Consent Mode v2 con `dataLayer`/`consent` en lugar de `window._ga4Loaded=false`); validado localmente con Playwright (`10 passed`).
- 2026-02-24: implementada convivencia Orquestador+Codex sin solapes con task espejo `CDX-001` en `AGENT_BOARD.yaml`, `AGENT_HANDOFFS.yaml`, bloque `CODEX_ACTIVE`, `handoffs lint` + `codex-check` en `agent-orchestrator.js`, validacion espejo/handoffs en `bin/validate-agent-governance.php` y gate CI actualizado (`agent-governance.yml`); validado con `agent-orchestrator.js` (`conflicts/handoffs/codex-check`) y `php bin/validate-agent-governance.php`.
- 2026-02-24: endurecida sonda `phase2-flakiness-probe.yml` con runner dedicado `bin/run-phase2-flakiness.js` (reporte JSON + clasificacion `stable|intermittent|unstable` + artefacto `phase2-flakiness-report`) para convertir C1 en senal reproducible y trazable por ejecucion.
- 2026-02-25: activado modo de operacion de estabilidad en 2 carriles (`post-deploy-fast.yml` para push diario y `nightly-stability.yml` para regresion pesada), con nuevo `gate:prod:fast` (verify+smoke sin benchmark) y `nightly:stability`; validado en produccion con `gate:prod:fast` exitoso (`DurationSec=14.1`, health/smoke OK, benchmark omitido en fast lane).
- 2026-02-25: `REPORTE-SEMANAL-PRODUCCION.ps1` ahora expone `warningDetails` (code/severity/impact/runbookRef), `warningsByImpact` y `triagePlaybook` (SLA 15 min) en JSON/markdown para C3 sin cambios breaking.
- 2026-02-25: `REPORTE-SEMANAL-PRODUCCION.ps1` agrega `releaseGuardrails` (`decision: pass|warn|block`, `reason`, `action`) para hacer explicita la regla warning->blocking en C4.
- 2026-02-25: activado protocolo backend-only para esta instancia Codex (dominio fijo `codex_backend_ops`) y creadas tareas iniciales de ejecucion `AG-035` (C1 flakiness agenda/chat/reprogramacion) y `AG-036` (C3 observabilidad accionable), ambas en `status=ready`, `domain_lane=backend_ops`, `lane_lock=strict`, `cross_domain=false`.
- 2026-02-25: C2 completado con baseline automatico de retencion en `verification/weekly/c2/retention-baseline.json`, tendencia semanal en JSON/markdown (`retentionTrend.trendReady=true`) y deltas de no-show/recurrencia sin accion manual adicional.
- 2026-02-25: cerrada evidencia de estabilidad C1 en `verification/agent-runs/AG-035.md` con `run-phase2-flakiness` (`runs=5`, `passes=5`, `failures=0`, `classification=stable`) y `npm run test:critical:agenda` en verde (`2 passed`, `3 skipped`).
- 2026-02-25: cerrada evidencia C3 en `verification/agent-runs/AG-036.md` con reporte semanal de produccion (`verification/weekly/ag036/weekly-report-20260225.json`) validando `triagePlaybook.targetMinutes=15`, `calendarMode=live`, `releaseGuardrails.decision=pass` y p95 dentro de objetivo (`core=684.98`, `figo-post=1811.85`).
- 2026-02-25: cerrado C4 con semaforos por dominio en summaries de `post-deploy-fast.yml`, `post-deploy-gate.yml` y `nightly-stability.yml` (`platform/agenda/chat/funnel`) y fallback operativo documentado en `docs/RUNBOOKS.md` seccion `1.5 Politica warning -> blocking y fallback operativo`.
- 2026-02-25: `weekly-kpi-report.yml` ahora calcula SLA operativo de 14 dias (`fast_p95_min <= 10`, `nightly_success_rate >= 90`) desde GitHub Actions, lo publica en summary y lo integra al criterio de apertura/cierre de incidente semanal; validado en run manual `22420355235` (`success`).
- 2026-02-26: bloque C2 operativo extendido con alertas estructuradas de `retention-report` en `REPORTE-SEMANAL-PRODUCCION.ps1` (`retentionReport.source/alerts/alertCounts`) y gobernanza semanal en `.github/workflows/weekly-kpi-report.yml` (summary + apertura/cierre de incidente tambien por `retention_report_alert_count`); cobertura integrada en `tests/Integration/AnalyticsRetentionReportTest.php` (`testRetentionReportIncludesAlertsWhenThresholdsAreExceeded`).
- 2026-02-26: C3 operativo reforzado en `.github/workflows/weekly-kpi-report.yml` separando incidentes automáticos `general` vs `retencion` (titulos dedicados + labels), corrigiendo autocierre por exclusión de incidentes semanales del KPI `ops_incidents_open_external`, y publicando ambos conteos (`external/total`) en summary para triage sin bucles.
- 2026-02-26: cerrado C5 backend con trazabilidad de conversion por servicio en `controllers/AnalyticsController.php` (eventos `view_service_*` y `start_booking_from_service`, breakdowns `serviceCategory/serviceDetail/serviceBookingIntent/serviceCheckout/serviceConfirmed`, y matriz `serviceFunnel`), con cobertura en `tests/Integration/AnalyticsServiceFunnelMetricsTest.php`; validado con `php -d xdebug.mode=coverage vendor/bin/phpunit tests/Integration/AnalyticsServiceFunnelMetricsTest.php tests/Integration/AnalyticsRetentionMetricsTest.php tests/Integration/AnalyticsRetentionReportTest.php` (`6 tests`, `108 assertions`).
- 2026-02-26: cerrado C6 con alertas operativas de `serviceFunnel` en `REPORTE-SEMANAL-PRODUCCION.ps1` (codigos `service_funnel_*`, seccion markdown/JSON y top servicios) y workflow semanal extendido (`.github/workflows/weekly-kpi-report.yml`) con umbrales dedicados, outputs de incidente y apertura/cierre automatica de `[ALERTA PROD] Weekly KPI service funnel degradado`.
- 2026-02-26: cerrado C7 con nuevo controlador `controllers/ServiceCatalogController.php` y endpoint publico `services-catalog` (filtros + paginacion + metadatos + fallback `source=missing`), registrado en `api.php`, `lib/routes.php` y `lib/ApiConfig.php`; cobertura en `tests/Integration/ServiceCatalogControllerTest.php` y regresion analytics en verde.
- 2026-02-26: cerrado C8 con snapshot de catalogo en `controllers/HealthController.php` (`servicesCatalog*` top-level + `checks.servicesCatalog`), reporte semanal extendido (`REPORTE-SEMANAL-PRODUCCION.ps1`) con warnings `services_catalog_*` y payload `servicesCatalog`, workflow semanal (`weekly-kpi-report.yml`) con outputs/incidentes `services_catalog_*`, y cobertura en `tests/Integration/HealthServiceCatalogSnapshotTest.php` + `tests-node/weekly-kpi-workflow-contract.test.js`.
- 2026-02-26: cerrado C9 con `controllers/ServicePriorityController.php` y endpoint publico `service-priorities` (orden inteligente por `hybrid|volume|conversion`, filtros `audience/category`, categorias/featured), registrado en `api.php`, `lib/routes.php` y `lib/ApiConfig.php`; cobertura en `tests/Integration/ServicePriorityControllerTest.php` + regresion `ServiceCatalog/Analytics/HealthServiceCatalog` en verde.
- 2026-02-26: cerrado C10 con extension de `REPORTE-SEMANAL-PRODUCCION.ps1` (payload/markdown/warnings `service_priorities_*`), `weekly-kpi-report.yml` (outputs + incidente dedicado `service priorities`) y contrato actualizado en `tests-node/weekly-kpi-workflow-contract.test.js`.
- 2026-02-26: cerrado C11 con endurecimiento de `MONITOR-PRODUCCION.ps1` para `service-priorities` (source/catalogVersion/counts + umbrales/overrides), cableado en `.github/workflows/prod-monitor.yml` (inputs/env/summary) y contrato Node nuevo `tests-node/prod-monitor-workflow-contract.test.js`.
- 2026-03-01: extendida propagacion canónica de `public_v4_rollout_*` en pipeline de deploy/post-deploy: `deploy-hosting.yml` ahora resuelve politica efectiva con `resolve-public-v4-rollout-policy.js`, persiste variables de repo `PROD_MONITOR_ENABLE_PUBLIC_V4_ROLLOUT/PUBLIC_V4_ROLLOUT_*`, y despacha payload completo a `post-deploy-fast.yml`, `post-deploy-gate.yml` y `prod-monitor.yml`; `post-deploy-fast.yml` + `post-deploy-gate.yml` incorporan inputs/env/resolucion efectiva/summary/incidente para rollout publico V4; cobertura de contrato reforzada con `tests-node/public-v4-rollout-propagation-contract.test.js` y suites workflow en verde.
- 2026-03-01: hardening de evidencia operativa para rollout publico V4: `deploy-hosting.yml` agrega manifest `.public-cutover/postdeploy-rollout-dispatch.json` dentro de `public-cutover-evidence`; `post-deploy-fast.yml` publica `verification/last-public-v4-rollout-fast.json` (`post-deploy-fast-public-v4-rollout-report`); `post-deploy-gate.yml` publica `verification/last-public-v4-rollout-gate.json` (`post-deploy-public-v4-rollout-report`); contratos Node actualizados para exigir steps/rutas de reporte y manifest.
- 2026-03-02: cerrado C12/P1 con evidencia Sentry normalizada en `verification/runtime/sentry-events-last.json`, consumo remoto/local en `bin/prod-readiness-summary.js`, workflow manual `sentry-events-verify.yml` alineado al artefacto `sentry-events-report`, y scorecard base fijada en `verification/agent-runs/CDX-002.md`.
- 2026-03-02: cerrado C13/P2 con kernel PowerShell compartido en `bin/powershell/Common.Http.ps1`, `bin/powershell/Common.Metrics.ps1` y `bin/powershell/Common.Warnings.ps1`; `REPORTE-SEMANAL-PRODUCCION.ps1` bajo de `2042` a `919` lineas, `VERIFICAR-DESPLIEGUE.ps1` de `1968` a `1216`, `MONITOR-PRODUCCION.ps1` de `368` a `290`; validado con contratos Node y con `npm run verify:prod:fast`, `npm run report:weekly:prod`, `npm run monitor:prod`.
- 2026-03-02: cerrado C14/P3 con `AnalyticsController.php` reducido de `1111` a `93` lineas y nueva capa `lib/analytics/*` para funnel, retention, parseo Prometheus, normalizacion y CSV; validado con `php -d xdebug.mode=coverage vendor/bin/phpunit tests/Integration/AnalyticsRetentionMetricsTest.php tests/Integration/AnalyticsServiceFunnelMetricsTest.php tests/Integration/AnalyticsRetentionReportTest.php tests/Integration/ServicePriorityControllerTest.php`, `php tests/run-php-tests.php`, `node --test tests-node/weekly-report-script-contract.test.js` y `npm run agent:gate`.
- 2026-03-03: cerrado C15/P4 con `lib/storage.php` reducido de `1030` a `231` lineas y `lib/backup.php` de `1174` a `270`, extrayendo `lib/storage/*` y `lib/backup/*`; restore/disaster recovery endurecido para Windows con `proc_open` + env directo, validado con storage/backup tests, disaster recovery, `npm run test:php` y `npm run gate:prod:backend`.
- 2026-03-04: cerrado C17 con resolucion administrativa de triage telemedicina backend-only: nuevo `controllers/TelemedicineAdminController.php` (`GET/PATCH telemedicine-intakes`), decisiones `approve_remote|request_more_info|escalate_presential` persistidas en `TelemedicineIntakeService`/`TelemedicineRepository`, snapshot/metrics de review decision-state en `TelemedicineOpsSnapshot`, contrato actualizado (`docs/API.md`, `docs/openapi.yaml`) y cobertura de integracion/metricas (`TelemedicineAdminControllerTest`, `TelemedicineAdminReadModelTest`, `TelemedicineMetricsExportTest`); evidencia en `verification/agent-runs/CDX-009.md`.
- 2026-03-04: cerrado C18 con enforcement progresivo de telemedicina backend-only: nueva `TelemedicineEnforcementPolicy` con flags de hardening, gate aplicado en `BookingService` (errores `telemedicine_unsuitable`/`telemedicine_review_required`), policy aditiva en `checks.telemedicine.policy`, gauges Prometheus de enforcement y actualizacion de contrato (`docs/API.md`, `docs/openapi.yaml`); validado con `phpunit --filter Telemedicine`, `BookingServiceUnitTest`, `npm run test:php` y `npm run agent:gate`; evidencia en `verification/agent-runs/CDX-010.md`.
- 2026-03-04: cerrado C19 con simulacion operativa y proyeccion de rollout de telemedicina backend-only: `TelemedicinePolicyController` agrega `readiness` (`GET telemedicine-rollout-readiness`) y refuerza simulation no destructiva (`POST telemedicine-policy-simulate`), se introduce `TelemedicineRolloutReadiness` como motor unico para API/CLI y `bin/telemedicine-rollout-readiness.php` queda como wrapper; contrato actualizado en `docs/API.md` + `docs/openapi.yaml`, cobertura en `TelemedicinePolicySimulationControllerTest`, `TelemedicinePolicyReadinessControllerTest`, `TelemedicineRolloutReadinessScriptTest`; validado con `phpunit --filter Telemedicine`, `npm run test:php` y `npm run agent:gate`; evidencia en `verification/agent-runs/CDX-011.md`.
- 2026-03-04: cerrado C20 con hardening de backfill telemedicina: `TelemedicineBackfillService` soporta `dryRun/force/limit`, detecta casos ya migrados para idempotencia y reporta estadisticas detalladas; `bin/backfill-telemedicine-intakes.php` agrega flags operativos y `changesPreview`; cobertura en `TelemedicineBackfillTest` (migracion base, dry-run no destructivo e idempotencia), validado con `phpunit tests/Integration/TelemedicineBackfillTest.php`, `phpunit --filter Telemedicine`, `npm run test:php` y `npm run agent:gate`; evidencia en `verification/agent-runs/CDX-012.md`.
- 2026-03-04: cerrado C21 con diagnostico operativo post-backfill: nuevo `TelemedicineOpsDiagnostics` con severidad/estado/remediacion, `TelemedicineOpsSnapshot` enriquecido con `diagnostics` para `health/admin`, endpoint admin `telemedicine-ops-diagnostics`, CLI `bin/telemedicine-ops-diagnostics.php` (`--strict`, `--fail-on-warning`) y gauges Prometheus de diagnostico; cobertura en `TelemedicineOpsDiagnosticsTest`, `TelemedicinePolicyDiagnosticsControllerTest`, `TelemedicineOpsDiagnosticsScriptTest` + ajustes de health/metrics/admin tests, validado con `phpunit --filter Telemedicine`, `npm run test:php` y `npm run agent:gate`; evidencia en `verification/agent-runs/CDX-013.md`.
- 2026-03-04: cerrado C22 con integración semanal de telemedicina en producción: `REPORTE-SEMANAL-PRODUCCION.ps1` ahora consume `checks.telemedicine` (diagnostics/policy/integrity/reviewQueue), emite warnings operativos telemedicina con umbrales explícitos y agrega bloque `Telemedicine Ops` en markdown/JSON; `Common.Warnings.ps1` clasifica severidad/impacto/runbook para prefijos `telemedicine_*` y agrega bucket `warningsByImpact.telemedicine`; contrato reforzado en `tests-node/weekly-report-script-contract.test.js`; validado con `node --test tests-node/weekly-report-script-contract.test.js`, `npm run agent:test`, `npm run test:php` y `npm run agent:gate`; evidencia en `verification/agent-runs/CDX-014.md`.
- 2026-03-04: cerrado C23 con guardrails diarios/post-deploy de telemedicina: `MONITOR-PRODUCCION.ps1` añade validaciones bloqueantes para `checks.telemedicine` (config/diagnostics/integrity + thresholds), `VERIFICAR-DESPLIEGUE.ps1` y `SMOKE-PRODUCCION.ps1` soportan `-RequireTelemedicineReady`, `GATE-POSTDEPLOY.ps1` propaga el switch, `prod-monitor.yml` y `post-deploy-gate.yml` agregan inputs/env/summary telemedicina, y contratos Node quedan reforzados en `tests-node/prod-monitor-workflow-contract.test.js` + `tests-node/post-deploy-gate-workflow-contract.test.js`; validado con `node --test tests-node/prod-monitor-workflow-contract.test.js tests-node/post-deploy-gate-workflow-contract.test.js`, `npm run test:php` y `npm run agent:gate`; evidencia en `verification/agent-runs/CDX-015.md`.
- 2026-03-04: cerrado C24 con incidente dedicado de telemedicina en monitor diario: `prod-monitor.yml` agrega `telemedicine_monitor` (status/reason), apertura/cierre automatica de `[ALERTA PROD] Monitor telemedicina degradado`, ajuste del incidente generico para evitar duplicados y trazabilidad en summary; contrato reforzado en `tests-node/prod-monitor-workflow-contract.test.js`; validado con `node --test tests-node/prod-monitor-workflow-contract.test.js`, `npm run agent:test`, `npm run test:php` y `npm run agent:gate`; evidencia en `verification/agent-runs/CDX-016.md`.
- 2026-03-04: cerrado C25 con incidente dedicado de telemedicina en post-deploy gate: `post-deploy-gate.yml` agrega `telemedicine_gate` (clasificacion `healthy|degraded_only|degraded_mixed|unknown` + reason/failure counters), mueve resumen telemedicina a post-evaluacion, evita incidente generico en `degraded_only`, incorpora apertura/cierre de `[ALERTA PROD] Gate post-deploy telemedicina degradado` y mantiene trazabilidad de fallas telemedicina/no-tele; contrato reforzado en `tests-node/post-deploy-gate-workflow-contract.test.js`; validado con `node --test tests-node/post-deploy-gate-workflow-contract.test.js`, `npm run agent:test`, `npm run test:php` y `npm run agent:gate`; evidencia en `verification/agent-runs/CDX-017.md`.
- 2026-03-04: cerrado C26 con incidente dedicado de telemedicina en `post-deploy-fast`: `post-deploy-fast.yml` agrega `telemedicine_fast` (clasificacion `healthy|degraded_only|degraded_mixed|unknown` + counters), expone trazabilidad en summary, evita incidente generico para `degraded_only`, y agrega apertura/cierre de `[ALERTA PROD] Post-Deploy Fast Lane telemedicina degradado`; contrato reforzado en `tests-node/post-deploy-fast-workflow-contract.test.js`; validado con `node --test tests-node/post-deploy-fast-workflow-contract.test.js` y `npm run agent:gate`; evidencia en `verification/agent-runs/CDX-018.md`.
- 2026-03-04: cerrado C27 con incidente dedicado de telemedicina en `nightly-stability`: `nightly-stability.yml` agrega `telemedicine_nightly` (clasificacion `healthy|degraded_only|degraded_mixed|unknown` + counters), expone trazabilidad telemedicina en summary, evita incidente generico para `degraded_only`, y agrega apertura/cierre de `[ALERTA PROD] Nightly stability telemedicina degradado`; contrato reforzado en `tests-node/nightly-stability-workflow-contract.test.js`; validado con `node --test tests-node/nightly-stability-workflow-contract.test.js` y `npm run agent:gate`; evidencia en `verification/agent-runs/CDX-019.md`.
- 2026-03-04: cerrado C28 con incidente dedicado de telemedicina en `calendar-write-smoke`: `calendar-write-smoke.yml` agrega clasificacion telemedicina (`telemedicine_health` en preflight + `TELEMEDICINE_CALENDAR_STATUS` derivado), expone trazabilidad aditiva en summary, evita incidente generico para `degraded_only`, y agrega apertura/cierre de `[ALERTA PROD] Calendar Write Smoke telemedicina degradado`; contrato reforzado en `tests-node/calendar-write-smoke-workflow-contract.test.js`; validado con `node --test tests-node/calendar-write-smoke-workflow-contract.test.js` y `npm run agent:gate`; evidencia en `verification/agent-runs/CDX-020.md`.
- 2026-03-04: cerrado C29 con incidente dedicado de telemedicina en `weekly-kpi-report`: `weekly-kpi-report.yml` agrega outputs normalizados de telemedicina semanal (`telemedicine_warning_*`, `telemedicine_incident_*`, `telemedicine_weekly_*`), ajusta incidente general para excluir `degraded_only`, agrega apertura/cierre de `[ALERTA PROD] Weekly KPI telemedicina degradada`, y actualiza `ops_sla` para excluir este titulo de `incidents_open_external`; contrato reforzado en `tests-node/weekly-kpi-workflow-contract.test.js`; validado con `node --test tests-node/weekly-kpi-workflow-contract.test.js` y `npm run agent:gate`; evidencia en `verification/agent-runs/CDX-021.md`.
- 2026-03-04: cerrado C30 con incidente dedicado de telemedicina en `deploy-hosting`: `deploy-hosting.yml` agrega evaluacion telemedicina post-cutover (`TELEMEDICINE_DEPLOY_*`), apertura/cierre de `[ALERTA PROD] Deploy Hosting telemedicina degradada` en modo automatizado no-manual, trazabilidad en `Production summary` y `issues: write` para ciclo de incidente; contrato reforzado en `tests-node/deploy-hosting-workflow-contract.test.js`; validado con `node --test tests-node/deploy-hosting-workflow-contract.test.js` y `npm run agent:gate`; evidencia en `verification/agent-runs/CDX-022.md`.
- 2026-03-04: cerrado C31 con incidente dedicado de telemedicina en `deploy-staging`: `deploy-staging.yml` agrega evaluacion telemedicina post-smoke (`TELEMEDICINE_STAGING_*`), apertura/cierre de `[ALERTA PROD] Deploy Staging telemedicina degradada` en modo automatizado no-manual, trazabilidad aditiva en `Staging summary` y `issues: write` para ciclo de incidente; contrato reforzado en `tests-node/public-routing-deploy-workflows-contract.test.js`; validado con `node --test tests-node/public-routing-deploy-workflows-contract.test.js` y `npm run agent:gate`; evidencia en `verification/agent-runs/CDX-023.md`.
- 2026-03-04: cerrado C32 con incidente dedicado de telemedicina en `deploy-frontend-selfhosted`: `deploy-frontend-selfhosted.yml` agrega evaluacion telemedicina post-deploy (`TELEMEDICINE_SELFHOSTED_*`), apertura/cierre de `[ALERTA PROD] Deploy Frontend Self-Hosted telemedicina degradada`, trazabilidad aditiva en `Deployment summary` y `issues: write` para ciclo de incidente; contrato reforzado en `tests-node/deploy-frontend-selfhosted-workflow-contract.test.js`; validado con `node --test tests-node/deploy-frontend-selfhosted-workflow-contract.test.js` y `npm run agent:gate`; evidencia en `verification/agent-runs/CDX-024.md`.
- 2026-03-04: cerrado C33 con incidente dedicado de telemedicina en `repair-git-sync`: `repair-git-sync.yml` agrega evaluacion telemedicina post-repair (`TELEMEDICINE_REPAIR_*`), apertura/cierre de `[ALERTA PROD] Repair git sync telemedicina degradado` en modo automatizado no-manual, trazabilidad aditiva en `Repair summary`, y contrato reforzado en `tests-node/deploy-hosting-workflow-contract.test.js`; validado con `node --test tests-node/deploy-hosting-workflow-contract.test.js` y `npm run agent:gate`; evidencia en `verification/agent-runs/CDX-025.md`.
- 2026-03-04: cerrado C34 con hardening de incidente telemedicina en `prod-monitor`: dedupe por `prod-monitor-telemedicine-signal` (`status|reason`), labels con severidad (`severity:critical|warning`) y merge idempotente sin spam de comentarios cuando la senal no cambia; mantiene comentario de auditoria solo ante cambio de senal y agrega label de dominio `prod-monitor`; contrato reforzado en `tests-node/prod-monitor-workflow-contract.test.js`; validado con `node --test tests-node/prod-monitor-workflow-contract.test.js` y `npm run agent:gate`; evidencia en `verification/agent-runs/CDX-026.md`.
- 2026-03-04: cerrado C35 con hardening de incidente telemedicina en `nightly-stability`: dedupe por `nightly-telemedicine-signal` (`status|reason|failures`), labels con severidad (`severity:critical|warning`) y merge idempotente sin spam de comentarios cuando la senal no cambia; mantiene comentario de auditoria solo ante cambio de senal y conserva ciclo de cierre existente; contrato reforzado en `tests-node/nightly-stability-workflow-contract.test.js`; validado con `node --test tests-node/nightly-stability-workflow-contract.test.js` y `npm run agent:gate`; evidencia en `verification/agent-runs/CDX-027.md`.
- 2026-03-04: cerrado C36 con hardening de incidente telemedicina en `post-deploy-fast`: dedupe por `post-deploy-fast-telemedicine-signal` (`status|reason|failures`), labels con severidad (`severity:critical|warning`) y merge idempotente sin spam de comentarios cuando la senal no cambia; mantiene comentario de auditoria solo ante cambio de senal y conserva ciclo de cierre existente; contrato reforzado en `tests-node/post-deploy-fast-workflow-contract.test.js`; validado con `node --test tests-node/post-deploy-fast-workflow-contract.test.js` y `npm run agent:gate`; evidencia en `verification/agent-runs/CDX-028.md`.
- 2026-03-04: cerrado C37 con hardening de incidente telemedicina en `post-deploy-gate`: dedupe por `post-deploy-gate-telemedicine-signal` (`status|reason|failures`), labels con severidad (`severity:critical|warning`) y merge idempotente sin spam de comentarios cuando la senal no cambia; mantiene comentario de auditoria solo ante cambio de senal y conserva ciclo de cierre existente; contrato reforzado en `tests-node/post-deploy-gate-workflow-contract.test.js`; validado con `node --test tests-node/post-deploy-gate-workflow-contract.test.js` y `npm run agent:gate`; evidencia en `verification/agent-runs/CDX-029.md`.
- 2026-03-04: cerrado C38 con hardening de incidente telemedicina en `calendar-write-smoke`: dedupe por `calendar-write-smoke-telemedicine-signal` (`status|reason|failures`), labels con severidad (`severity:critical|warning`) y merge idempotente sin spam de comentarios cuando la senal no cambia; mantiene comentario de auditoria solo ante cambio de senal y conserva ciclo de cierre existente; contrato reforzado en `tests-node/calendar-write-smoke-workflow-contract.test.js`; validado con `node --test tests-node/calendar-write-smoke-workflow-contract.test.js` y `npm run agent:gate`; evidencia en `verification/agent-runs/CDX-030.md`.
- 2026-03-04: cerrado C39 con severidad robusta en incidentes dedicados de telemedicina para `deploy-hosting`, `deploy-staging` y `deploy-frontend-selfhosted`: razones estructurales (`diagnostics_critical`, `hard_failures:*`, `hard_failures_invalid`, `health_unavailable`, `health_parse_error`, `telemedicine_missing`, `not_configured`) ahora elevan `severity:critical`; degradaciones restantes quedan en `severity:warning`; contratos reforzados en `tests-node/deploy-hosting-workflow-contract.test.js`, `tests-node/public-routing-deploy-workflows-contract.test.js` y `tests-node/deploy-frontend-selfhosted-workflow-contract.test.js`; validado con tests de contrato dedicados y `npm run agent:gate`; evidencia en `verification/agent-runs/CDX-031.md`.
- 2026-03-04: cerrado C40 con severidad robusta en incidente dedicado de telemedicina en `repair-git-sync`: razones estructurales (`diagnostics_critical`, `hard_failures:*`, `hard_failures_invalid`, `health_unavailable`, `health_parse_error`, `telemedicine_missing`, `not_configured`) ahora elevan `severity:critical`; degradaciones restantes quedan en `severity:warning`; contrato reforzado en `tests-node/deploy-hosting-workflow-contract.test.js` (bloque de repair), validado con test dedicado y `npm run agent:gate`; evidencia en `verification/agent-runs/CDX-032.md`.
- 2026-03-04: cerrado C41 con hardening de visibilidad para `status=unknown` en incidentes dedicados de telemedicina: `deploy-hosting`, `deploy-staging`, `deploy-frontend-selfhosted` y `repair-git-sync` ahora abren/actualizan incidente tanto para `degraded` como `unknown` (sin cambiar criterio de cierre en `healthy`); contratos actualizados en `tests-node/deploy-hosting-workflow-contract.test.js`, `tests-node/public-routing-deploy-workflows-contract.test.js` y `tests-node/deploy-frontend-selfhosted-workflow-contract.test.js`; validado con tests de contrato dedicados y `npm run agent:gate`; evidencia en `verification/agent-runs/CDX-033.md`.
- 2026-03-04: cerrado C42 con unificacion de `status=unknown` en incidentes dedicados de telemedicina para `post-deploy-fast`, `post-deploy-gate`, `nightly-stability` y `calendar-write-smoke`: los incidentes dedicados ahora abren/actualizan para `degraded_only|degraded_mixed|unknown`, mientras el incidente generico excluye tele-only `unknown|degraded_only` y solo abre en esos casos si existen fallas no-tele (`*_NON_TELE_FAILURES != '0'`); contratos actualizados en `tests-node/post-deploy-fast-workflow-contract.test.js`, `tests-node/post-deploy-gate-workflow-contract.test.js`, `tests-node/nightly-stability-workflow-contract.test.js` y `tests-node/calendar-write-smoke-workflow-contract.test.js`; validado con tests de contrato dedicados y `npm run agent:gate`; evidencia en `verification/agent-runs/CDX-034.md`.
- 2026-03-04: cerrado C43 con unificacion de `status=unknown` para telemedicina en `prod-monitor` y `weekly-kpi`: `prod-monitor` agrega `TELEMEDICINE_MONITOR_NON_TELE_FAILURES`, enruta `unknown` al incidente dedicado y evita incidente general tele-only (`failed|unknown`) salvo fallas no-tele; `weekly-kpi` extiende incidente dedicado a `unknown` y ajusta incidente general para excluir tele-only `degraded_only|unknown` salvo `telemedicine_weekly_non_tele_failures != '0'`; contratos actualizados en `tests-node/prod-monitor-workflow-contract.test.js` y `tests-node/weekly-kpi-workflow-contract.test.js`; validado con tests dedicados y `npm run agent:gate`; evidencia en `verification/agent-runs/CDX-035.md`.
- 2026-03-04: cerrado C44 con hardening de `repair-git-sync` para evitar ruido de incidente general tele-only: `telemedicine_repair` ahora calcula `TELEMEDICINE_REPAIR_NON_TELE_FAILURES` desde outcomes reales (`ssh_repair`, `verify_after_repair`, `smoke_post_repair`), y el incidente general `[ALERTA PROD] Repair git sync fallando` solo abre si la telemetria no esta en `degraded|unknown` o si existen fallas no-tele (`TELEMEDICINE_REPAIR_NON_TELE_FAILURES != '0'`); se agrega trazabilidad telemedicina en el body del incidente general; contrato actualizado en `tests-node/deploy-hosting-workflow-contract.test.js`; validado con test dedicado y `npm run agent:gate`; evidencia en `verification/agent-runs/CDX-036.md`.
- 2026-03-04: cerrado C45 con normalizacion de `nonTeleFailures` basada en outcomes reales para `deploy-hosting`, `deploy-staging` y `deploy-frontend-selfhosted`: los tres workflows dejan de usar `0/-1` fijo y ahora derivan `*_NON_TELE_FAILURES` desde outcomes no-tele (`countNonTeleFailures` en Bash/Node y `Count-NonTeleFailures` en PowerShell), con ids explicitos en pasos clave de deploy/smoke; contratos reforzados en `tests-node/deploy-hosting-workflow-contract.test.js`, `tests-node/public-routing-deploy-workflows-contract.test.js` y `tests-node/deploy-frontend-selfhosted-workflow-contract.test.js`; validado con tests dedicados y `npm run agent:gate`; evidencia en `verification/agent-runs/CDX-037.md`.
- 2026-03-09: cerrado C46 con hardening de dedupe en incidentes telemedicina de deploy (`deploy-hosting`, `deploy-staging`, `deploy-frontend-selfhosted`): la huella `signal` ahora incorpora `non_tele` para detectar cambios no-tele aunque se mantengan `status|reason|failures`, y los comentarios de actualizacion incluyen `*_non_tele_failures` para trazabilidad operativa; contratos reforzados en `tests-node/deploy-hosting-workflow-contract.test.js`, `tests-node/public-routing-deploy-workflows-contract.test.js` y `tests-node/deploy-frontend-selfhosted-workflow-contract.test.js`; validado con tests dedicados y `npm run agent:gate`; evidencia en `verification/agent-runs/CDX-038.md`.
- 2026-03-09: cerrado C47 con homogeneizacion de dedupe `non_tele` en incidentes telemedicina no-deploy (`post-deploy-fast`, `post-deploy-gate`, `nightly-stability`, `calendar-write-smoke`, `prod-monitor`, `repair-git-sync`): cada `signal` dedicado ahora incluye `non_tele` y los comentarios de update mantienen trazabilidad `*_non_tele_failures`; contratos reforzados en `tests-node/post-deploy-fast-workflow-contract.test.js`, `tests-node/post-deploy-gate-workflow-contract.test.js`, `tests-node/nightly-stability-workflow-contract.test.js`, `tests-node/calendar-write-smoke-workflow-contract.test.js`, `tests-node/prod-monitor-workflow-contract.test.js` y `tests-node/deploy-hosting-workflow-contract.test.js` (repair); validado con tests dedicados y `npm run agent:gate`; evidencia en `verification/agent-runs/CDX-039.md`.
- 2026-03-09: cerrado C48 con hardening final de dedupe semanal en `weekly-kpi-report`: `telemedicine_signal_key` deja de usar llaves opacas en fallback (`missing_report`, `report_invalid`) y pasa a semantica estructurada `status|reason|failures|non_tele|reasons|stale`; ademas la senal semanal normaliza `non_tele` (reemplaza `nontele`) y el incidente dedicado semanal agrega trazabilidad `telemedicine_weekly_non_tele_failures`; contrato reforzado en `tests-node/weekly-kpi-workflow-contract.test.js`; validado con test dedicado y `npm run agent:gate`; evidencia en `verification/agent-runs/CDX-040.md`.
