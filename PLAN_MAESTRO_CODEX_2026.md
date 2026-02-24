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

## Distribucion de esfuerzo

- 70% Confiabilidad + tests de agenda/chat/reprogramacion.
- 20% Retencion tecnica orientada a no-show/recurrencia.
- 10% Observabilidad y calidad de senales para decision operativa.

## Bloques

## C1 - Firewall de regresiones de agenda

Estado: `IN_PROGRESS`
Objetivo:

- Eliminar regresiones silenciosas en `availability`, `appointments`, `booked-slots`, reprogramacion y conflictos de slot.

Entregables:

- [x] Suite critica de agenda por dominio en CI.
- [x] Cobertura de codigos normalizados (`slot_conflict`, `calendar_unreachable`, etc.) en escenarios de error.
- [x] Pruebas de concurrencia no destructivas y destructivas controladas (workflow manual).
- [x] Sonda automatica de flakiness para `test:phase2` en modo readonly con umbral configurable.

Criterio de salida:

- [ ] Suite critica estable sin flakiness repetido.
- [ ] Cualquier cambio de comportamiento en agenda protegido con test.

## C2 - Retencion tecnica enfocada en no-show

Estado: `PENDING`
Objetivo:

- Estandarizar metricas de no-show/completed/confirmed y recurrencia para seguimiento continuo.

Entregables:

- [x] `funnel-metrics` expone bloque `retention` (aditivo, sin breaking changes).
- [x] `REPORTE-SEMANAL-PRODUCCION.ps1` incluye seccion retention + delta vs reporte previo.
- [ ] Indicadores de recurrencia/no-show disponibles sin trabajo manual extra.

Criterio de salida:

- [ ] Baseline y tendencia semanal de no-show disponibles en JSON y markdown.
- [ ] Recurrencia de pacientes trazable por metrica.

## C3 - Observabilidad accionable

Estado: `PENDING`
Objetivo:

- Detectar y clasificar incidentes de reserva/chat con menor tiempo de diagnostico.

Entregables:

- [x] Validacion automatica de configuracion de observabilidad en health/reportes.
- [ ] Clasificacion de alertas por severidad e impacto.
- [ ] Playbook operativo con ruta de diagnostico rapida.

Criterio de salida:

- [ ] Evidencia de verificacion automatica en pipeline semanal.
- [ ] Ruta de diagnostico documentada y utilizable en menos de 15 min.

## C4 - Guardrails de release y CI

Estado: `PENDING`
Objetivo:

- Evitar que cambios de bajo nivel rompan deploy o comportamiento critico.

Entregables:

- [x] Gates explicitos por dominio (agenda/funnel/chat/pagos) con nombres claros en CI.
- [ ] Workflows destructivos solo en `workflow_dispatch` con guardrails fuertes.
- [ ] Reglas claras de warning -> blocking segun impacto.

Criterio de salida:

- [ ] Pipeline con semaforos por dominio.
- [ ] Fallback operativo documentado para picos transitorios sin relajar seguridad.

## Contratos publicos

- No se introducen cambios breaking en contratos HTTP existentes.
- Cambios aditivos permitidos:
- `GET /api.php?resource=funnel-metrics`: objeto `retention`.
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
