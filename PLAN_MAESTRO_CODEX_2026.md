# Plan Maestro Codex 2026 (Complementario Tecnico)

Inicio: 2026-02-24
Cadencia: por commit (cada commit deja evidencia verificable)
Relacion con Operativo 2026: complementario estricto (no reemplaza ni compite por control)

## Proposito

- Blindar confiabilidad de reserva/chat/reprogramacion.
- Convertir no-show en una senal tecnica medible y accionable.
- Elevar observabilidad y guardrails de release sin romper contratos publicos.

## Gobernanza

- Este archivo es la fuente de control de la linea Codex.
- Solo un bloque Codex puede estar `IN_PROGRESS`.
- No se toman tareas del Operativo que ya esten `IN_PROGRESS`, salvo soporte de calidad (tests/guardrails).
- Definicion de done por commit:
- objetivo tecnico explicito.
- evidencia en CI o prueba local reproducible.
- actualizacion del estado en este plan.

## Carril operativo backend-only (permanente)

- Esta instancia Codex opera solo en `codex_backend_ops`.
- Alcance permitido: `controllers/**`, `lib/**`, `api.php`, `figo-*.php`,
  `.github/workflows/**`, `cron.php`, `env*.php`, `bin/**`, tests backend.
- Alcance fuera de carril: `src/apps/**`, `js/**`, `styles*.css`,
  `templates/**`, `content/**`, `*.html`.
- Excepcion unica: cruce de dominio con `cross_domain=true` + `lane_lock=handoff_allowed`
    - handoff `active` con expiracion en `AGENT_HANDOFFS.yaml`.
- Regla critica: `critical_zone=true` solo en `codex_backend_ops`.
- Prioridad tecnica inmediata: `C1 -> C3 -> C4 -> C2`.

## Distribucion de esfuerzo

- 70% Confiabilidad + tests de agenda/chat/reprogramacion.
- 20% Retencion tecnica orientada a no-show/recurrencia.
- 10% Observabilidad y calidad de senales para decision operativa.

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
