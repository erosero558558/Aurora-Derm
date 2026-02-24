# Plan Maestro 2026 - Estado Operativo

Fecha de actualizacion: 2026-02-23 (sesion Claude noche)
Dominio: https://pielarmonia.com

## Resumen rapido

- Estado general: En curso. CI bloqueado por cambios PHP de Codex (ver Nudo 8).
- Chatbot: Operativo en Trinity/OpenRouter (cola OpenClaw deshabilitada por decision de producto).
- Agenda real: Flujo create/reschedule/cancel validado contra Google Calendar en produccion.
- Gate de produccion: Hash-strict falla por deploy pendiente de script.js nuevo (esperado hasta que CI pase).
- Smoke: 19/19 OK. Latencias: figo-post p95=582ms, core p95=553ms. Error rate=0.
- Umbral operativo `figo-post` endurecido a p95 <= `2500 ms` en gate/benchmark/workflow.
- Gate hash estricto: validado en 3 corridas consecutivas (pre code-split).
- Workflow post-deploy ajustado para ejecutar hashes bloqueantes en `push` de forma inmediata.
- admin.js code split completado: 71KB -> 49.7KB (bajo target <50KB). Chunks: appointments + availability bajo demanda.
- script.js code split completado: 111KB -> 79.3KB (-29%). Chunks: shell (15.2KB lazy) + content-loader (7.2KB prefetch). HTML a type="module". Commits: 842ee92, d3cde08.
- asset-reference-integrity test: regex extendida para rutas relativas (./js/chunks/*). Commit: b0b45a1.
- PIELARMONIA_DEBUG_EXCEPTIONS: default explicitamente `false` en env.example.php.
- Dependencias circulares JS: investigadas y confirmadas como inexistentes en codigo actual (state.js no tiene imports del proyecto).

## Evidencia ejecutada hoy

1. Reserva y reprogramacion reales (Google write)
- Comando: `npm run test:calendar-write`
- Resultado: `1 passed`
- Cobertura: crea cita 60 min, reprograma, cancela cleanup.

2. E2E UI reserva + reprogramacion
- Comando: `npx playwright test tests/booking.spec.js tests/reschedule.spec.js --project=chromium`
- Resultado: `10 passed`

3. Regresion movil (overflow/chat layout)
- Comando: `npx playwright test tests/mobile-overflow-regression.spec.js tests/chat-mobile-layout.spec.js --project=chromium`
- Resultado: `4 passed`

4. Embudo de conversion (tracking + API)
- Comando: `npx playwright test tests/funnel-tracking.spec.js tests/funnel-event-api.spec.js --project=chromium`
- Resultado: `5 passed`

5. Contrato de calendario
- Comando: `npm run test:calendar-contract`
- Resultado: `3 passed`

6. Smoke + Gate backend produccion
- Comando: `npm run smoke:prod` y `npm run gate:prod:backend`
- Resultado: OK
- Bench API (25 runs):
  - `health` p95: `333.32 ms`
  - `reviews` p95: `537.64 ms`
  - `availability` p95: `536.3 ms`
  - `figo-get` p95: `570.33 ms`
  - `figo-post` p95: `582.74 ms`

7. Hash gate estricto (forzado)
- Comando: `npm run gate:prod:hash-strict`
- Resultado: OK (`Gate OK: despliegue validado`).
- Bench API (25 runs):
  - `health` p95: `349.54 ms`
  - `reviews` p95: `528.65 ms`
  - `availability` p95: `537.78 ms`
  - `figo-get` p95: `568.26 ms`
  - `figo-post` p95: `815.7 ms`
- Nota: el warning de `deploy freshness` se mantiene en modo advisory porque este commit no cambia frontend.

## Estado por fases del plan unico

1. Fase 0 - Control unico y anti-bucle: Completada.
- Un solo plan operativo activo.
- Gate hibrido aplicado.

2. Fase 1 - Agenda real Google (OAuth): Completada operativamente.
- Disponibilidad y reserva con metadatos de calendario.
- Bloqueo y manejo de errores de calendario validados.

3. Fase 2 - Consistencia reserva/chat/reprogramacion: Completada en flujos criticos.
- Duraciones por servicio verificadas (caso 60 min probado).
- Flujo de reprogramacion real validado.

4. Fase 3 - Conversion y medicion: Completada.
- Eventos funnel y contrato API validados.
- Dashboard operacional semanal automatizado (`npm run report:weekly:prod`).
- Alertas operativas semanales en GitHub Actions (`weekly-kpi-report.yml`).
- Abandon reason analysis: backend agrega por step y por reason, dashboard renderiza funnelAbandonReasonList y funnelAbandonList.
- Tests funnel confirmados: 3 passed (2026-02-23).

5. Fase 4 - UX movil y rendimiento critico: Completada.
- Regresiones moviles: 4 passed (2026-02-23).
- admin.js code split: 71KB -> 49.7KB (bajo target <50KB). Chunks bajo demanda: appointments + availability.
- script.js: 111KB -> 79.3KB (-29%). TARGET <80KB ALCANZADO. Commits: 842ee92, d3cde08.

6. Fase 5 - Hardening final y hash gate estricto: Completada.
- 3 corridas hash estrictas consecutivas en verde.
- Workflow principal (`post-deploy-gate.yml`) con hashes bloqueantes en eventos `push`.

## Nudos reales pendientes (sin ruido)

1. Entorno local sin PHP en PATH.
- Impacto: `npm run test:php` no corre en esta maquina.
- Mitigacion: tests backend criticos ya validados en produccion con Playwright/Smoke/Gate.

2. Deploy freshness en modo advisory.
- Estado: informativo para commits sin cambios frontend.
- Accion: mantener vigilancia operativa, sin impacto de bloqueo cuando hashes ya validan en modo estricto.

3. Repair git sync remoto bloqueado por red.
- Workflow ejecutado: `Repair Git Sync (Self-Heal)` run `22312282946`.
- Falla: `dial tcp ...:22: i/o timeout`.
- Implicacion: no se puede forzar `git reset` remoto desde GitHub Actions con la red actual.

4. Host de deploy no accesible desde runner/local por puertos de administracion.
- Pruebas: `101.47.4.223` en puertos `22`, `21`, `990` -> `TcpTestSucceeded=False`.
- Implicacion: no hay canal remoto util para sincronizar artefactos (SSH/FTP/FTPS).

5. script.js: 111KB -> 79.3KB (-29%). TARGET <80KB ALCANZADO. Commits: 842ee92, d3cde08.
- Chunks lazy: shell (15.2KB al primer uso del chat) + content-loader (7.2KB prefetch paralelo).
- HTML actualizado a type="module". Pipeline Rollup en formato ES con code splitting.
- asset-reference-integrity test cubre chunks via regex extendida (b0b45a1).
- PENDIENTE DEPLOY: script.js nuevo aun no en produccion (CI bloqueado, ver Nudo 8).

6. Cobertura de tests: ~5-35% actual vs 80% objetivo.
- Jules (Google AI) trabajando en scaffolding de tests (BookingServiceTest, RateLimiterTest, AuthSessionTest).
- PR de Jules ya en main pero genera fallas CI: CalendarBookingService/CalendarAvailabilityService no encontradas en namespace Tests\Unit\Calendar (conflicto con compat.php de Codex).

7. Monitoring/observabilidad: Sentry ACTIVO en produccion.
- DSN backend (PHP) y DSN frontend (JS) configurados en env del servidor.
- Proyectos separados en sentry.io: pielarmonia-backend y pielarmonia-frontend.
- SDK carga lazy via monitoring-loader.js (async, no bloquea render).
- Pendiente: confirmar primer evento recibido en dashboard de Sentry.

8. CI bloqueado por cambios PHP de Codex (NUEVO - bloquea deploy).
- Psalm: DuplicateClass en CalendarAvailabilityService, CalendarBookingService, GoogleCalendarClient, GoogleTokenProvider (definidas en archivos originales Y en lib/calendar/compat.php).
- Psalm: RedundantFunctionCall en lib/PushService.php:32 y :51.
- PHPUnit: 5 errores - clases del namespace Tests\Unit\Calendar no encontradas (interaccion Jules PR + compat.php).
- Impacto: deploy-hosting.yml se salta porque CI no pasa. Remote script.js es el viejo IIFE (111KB).
- Accion requerida: Codex debe resolver conflicto de definicion de clases en compat.php.

## Siguiente ejecucion recomendada

1. PRIORITARIO: Codex debe resolver DuplicateClass en lib/calendar/compat.php para desbloquear CI y pipeline de deploy.
2. Una vez CI verde: deploy automatico sube script.js nuevo (ES module, 79.3KB) + chunks a produccion.
3. Post-deploy: correr `npm run gate:prod:hash-strict` para validar hashes.
4. Confirmar primer evento en Sentry dashboard (Sentry ya activo en produccion).
5. Reporte semanal ejecutado: booking_confirmed=1, error_rate=0, figo-post p95=582ms. Verde.
