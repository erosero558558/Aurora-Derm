# Plan Maestro Operativo 2026 (Fuente Unica de Ejecucion)

Este documento reemplaza el seguimiento disperso en multiples planes.  
Regla: toda tarea nueva debe mapearse a una fase de este documento.

## Gobernanza documental

- Este archivo es la unica fuente de control operativo.
- `PLAN_MAESTRO_2026_STATUS.md` se mantiene solo como evidencia/snapshot historico de ejecuciones.

## Objetivo de negocio

- KPI principal: `reservas netas` (+25% al 29 de marzo de 2026).
- SLO operativos:
- `GET availability` p95 < 800 ms.
- `POST appointments` p95 < 2500 ms.
- `POST figo-chat` p95 < 2500 ms.
- Error rate de reserva < 2%.

## Regla anti-bucle (obligatoria)

- Solo una fase puede estar `IN_PROGRESS`.
- No se abre fase nueva sin cerrar criterios de salida de la fase activa.
- Todo hallazgo fuera de fase se registra en "Backlog diferido" y no bloquea la fase activa.

## Politica de deploy (hibrido estricto temporal)

- Bloqueante: health + smoke + backend contract.
- Hash de assets: warning temporal hasta `2026-03-08T23:59:59-05:00`.
- Desde esa fecha: hash gate bloqueante de nuevo.

## Estado de fases

## Fase 0 - Control unico y hardening de flujo

Estado: `COMPLETED`
Entregables:

- [x] Script de gate con ventana temporal de warning para hash.
- [x] Workflow con opcion de forzar hash estricto.
- [x] Documento operativo unico.

Criterio de salida:

- [x] 2 deploys consecutivos con `gate:prod:backend` en verde.
- [x] Sin trabajo paralelo fuera de este documento.

## Fase 1 - Agenda real Google (OAuth refresh token)

Estado: `COMPLETED`
Entregables:

- [x] `availability` y `booked-slots` con `doctor + service + meta`.
- [x] Bloqueo con `503 calendar_unreachable` cuando falla Google y `block_on_failure=true`.
- [x] Reserva crea evento y persiste `calendarEventId`.
- [x] Reprogramacion actualiza evento real.
- [x] Lock por slot con compensacion de calendario.
- [x] Soporte env `PIELARMONIA_CALENDAR_AUTH_MODE=oauth_refresh_token`.
- [x] `health` expone `calendarTokenHealthy`.
- [x] Cutover productivo activo (`health.calendarSource=google` y `health.calendarAuth=oauth_refresh`).

Criterio de salida:

- [x] `npm run test:calendar-contract` en verde.
- [x] `npm run test:calendar-write` en verde contra produccion controlada.
- [x] Verificacion manual: cita web + reprogramacion visibles en ambos calendarios.
- [x] `TEST_REQUIRE_GOOGLE_CALENDAR=true npm run test:calendar-contract` en verde contra produccion (evidenciado en `Post-Deploy Gate` run `22337042395`, paso `Validar contrato Google Calendar (no destructivo)`).

## Fase 2 - Consistencia web/chat/reprogramacion

Estado: `COMPLETED`
Entregables:

- [x] Duracion por servicio centralizada (30/60 min).
- [x] `indiferente` por menor carga + round-robin.
- [x] Chat y reprogramacion consultan disponibilidad por `doctor + service`.
- [x] Admin disponibilidad en solo lectura cuando source=google.
- [x] API normaliza conflicto a `slot_conflict` en 409.

Criterio de salida:

- [x] Test de concurrencia: 1x `201`, 1x `409 slot_conflict`.
- [x] Misma oferta de slots entre web y chat para misma fecha/servicio.
- [x] Evidencia de cierre: `TEST_BASE_URL=https://pielarmonia.com TEST_ENABLE_CALENDAR_WRITE=true npm run test:phase2` en verde (2026-02-24).
- [x] Evidencia manual en produccion: workflow `Phase 2 Concurrency Write (Manual)` run `22386308512` (`enable_write=true`) -> `success` (2026-02-25).

## Fase 3 - Embudo de conversion y errores accionables

Estado: `COMPLETED`
Entregables:

- [x] Eventos GA4 obligatorios en todo el embudo.
- [x] Registro de abandono por paso y razon.
- [x] Mensajes UX claros para calendar unavailable, slot conflict y pago.

Criterio de salida:

- [x] Dashboard con embudo completo operativo.
- [x] Error rate de reserva < 2% (ventana 7 dias).
- [x] Evidencia de cierre: `npx playwright test tests/funnel-tracking.spec.js tests/funnel-event-api.spec.js --project=chromium` en verde y `npm run report:weekly:prod` con `error_rate_pct=0` (2026-02-24).

## Fase 4 - Mobile UX y rendimiento critico

Estado: `COMPLETED`
Entregables:

- [x] Correccion de solapes chat/header/nav movil.
- [x] Correccion de alineaciones y saltos tipograficos.
- [x] Resolucion de assets 404 declarados en smoke/gate.
- [x] Reduccion de carga JS/CSS no critica.

Criterio de salida:

- [x] QA en 360x800, 390x844, 412x915 sin defectos criticos.
- [x] Smoke de assets sin 404 en componentes esperados.
- [x] Evidencia de cierre: `tests/mobile-overflow-regression.spec.js` y `tests/chat-mobile-layout.spec.js` (5 passed) + `npm run smoke:prod` (19/19 checks OK) el 2026-02-24.

## Fase 5 - Cierre hardening y vuelta a hash estricto

Estado: `COMPLETED`
Entregables:

- [x] Eliminar drift de hashes local/remoto.
- [x] Reactivar hash gate bloqueante.
- [x] Playbook de incidentes actualizado.

Criterio de salida:

- [x] `npm run gate:prod` en verde en 3 corridas consecutivas (validado con corridas strict manuales 2026-02-23 21:59, 22:00 y 22:02 hora local servidor).

## Fase 6 - Operacion continua: retencion y observabilidad

Estado: `IN_PROGRESS`
Entregables:

- [x] Consolidar metricas tecnicas de retencion (`no_show` y recurrencia) en reportes semanales.
- [ ] Confirmar evidencia operativa de observabilidad (Sentry backend/frontend) en `health` y monitoreo.
- [ ] Mantener gates criticos por dominio en CI sin degradar tiempos de deploy.

Criterio de salida:

- [ ] Dos ciclos semanales consecutivos con `REPORTE-SEMANAL-PRODUCCION.ps1` sin warnings criticos de agenda/observabilidad.

Evidencia parcial (retencion + conversion/funnel):

- `REPORTE-SEMANAL-PRODUCCION.ps1` publica `retention` + `retentionTrend` en JSON/Markdown semanal (incluye `noShowRatePct`, `recurrenceRatePct`, deltas vs reporte previo).
- `REPORTE-SEMANAL-PRODUCCION.ps1` incorpora guardrails de retencion configurables (warning por `no_show` alto, `recurrence` baja y caida semanal de recurrencia con sample minimo).
- `REPORTE-SEMANAL-PRODUCCION.ps1` publica `conversion` + `conversionTrend` en JSON/Markdown semanal (incluye `startCheckoutRatePct`, `bookingConfirmedRatePct`, deltas vs reporte previo y thresholds de muestra minima).
- `REPORTE-SEMANAL-PRODUCCION.ps1` incorpora guardrails de funnel temprano (`viewBooking -> startCheckout`) y conversion final (`startCheckout -> bookingConfirmed`) con warnings configurables por tasa baja/caida semanal.
- `npm run report:weekly:prod` (2026-02-25) -> `Warnings: none`, con salida `retention_no_show_rate_pct=0` y `retention_recurrence_rate_pct=50`.
- `.github/workflows/weekly-kpi-report.yml` resume metricas de retencion, conversion y deltas (`view_booking`, `start_checkout_rate_pct`, `booking_confirmed_rate_pct`) en `GITHUB_STEP_SUMMARY` para operacion semanal.
- Validacion remota del workflow semanal (rama de validacion): `Weekly KPI Report` run `22407607517` -> `success` (retention/latency/warnings expuestos en resumen; artifact `weekly-kpi-report` generado).
- Validacion remota en `main` (post-merge conversion): `Weekly KPI Report` run `22408343562` -> `success` (artifact con `conversion.bookingConfirmedRatePct=100`, `conversionTrend.bookingConfirmedRateDeltaPct=null`, `warnings=[]`).
- Validacion remota en `main` (post-merge funnel temprano): `Weekly KPI Report` run `22408612570` -> `success` (artifact con `conversion.viewBooking=305`, `conversion.startCheckoutRatePct=0.33`, `conversionTrend.startCheckoutRateDeltaPct=null`; warning no bloqueante `core_p95_alto_995.16ms`).

### Disciplina de ejecucion (Codex, 2026-02-25)

- Modo por bloques: 45-90 min por objetivo, `1 PR` por bloque (cambio tecnico + evidencia/docs si aplica).
- Validacion remota por hitos: checks locales durante el bloque; `CI/PR checks` y workflows manuales solo al cierre del bloque.
- Evitar micro-PRs de sincronizacion (`plan/status/board`) inmediatamente despues del PR tecnico; cerrar evidencia en lote en el mismo PR o en un unico PR de cierre de sesion.
- `Weekly KPI Report` manual: ejecutar una sola vez por bloque que modifique el reporte semanal (no por subcambio).

## Comandos oficiales del plan

- Validacion backend bloqueante: `npm run gate:prod:backend`
- Validacion strict hash (manual): `npm run gate:prod:hash-strict`
- Contrato calendario: `npm run test:calendar-contract`
- Escritura calendario: `npm run test:calendar-write`
- Consistencia fase 2 (concurrencia + paridad web/chat): `npm run test:phase2`
- Concurrencia real Fase 2 (manual en produccion): workflow `Phase 2 Concurrency Write (Manual)` con `enable_write=true`
- Verificacion Sentry (backend/frontend): `npm run verify:sentry:events` (requiere token/API env)
- Verificacion Sentry (manual GitHub Actions): workflow `Sentry Events Verify (Manual)`
- Errores chat agenda: `npm run test:chat-booking-calendar-errors`
- Smoke produccion: `npm run smoke:prod`

## Backlog diferido (no bloqueante de fase activa)

- Rediseño visual total.
- Optimizaciones avanzadas de bundle no criticas para conversion.
- Funcionalidades nuevas sin impacto directo en reserva.
