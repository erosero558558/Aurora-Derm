# Plan Maestro 2026 - Estado Operativo

Fecha de actualizacion: 2026-02-23 (sesion Claude tarde)
Dominio: https://pielarmonia.com

## Resumen rapido

- Estado general: En curso, estable.
- Chatbot: Operativo en Trinity/OpenRouter (cola OpenClaw deshabilitada por decision de producto).
- Agenda real: Flujo create/reschedule/cancel validado contra Google Calendar en produccion.
- Gate de produccion: Verde en modo bloqueante total (hash checks activos en `push`).
- Umbral operativo `figo-post` endurecido a p95 <= `2500 ms` en gate/benchmark/workflow.
- Gate hash estricto: validado en 3 corridas consecutivas.
- Workflow post-deploy ajustado para ejecutar hashes bloqueantes en `push` de forma inmediata.
- admin.js code split completado: 71KB -> 49.7KB (bajo target <50KB). Chunks: appointments + availability bajo demanda.
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
- script.js (111KB): deuda tecnica pendiente en sesion dedicada.

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

5. script.js (111KB > target 80KB): deuda tecnica activa.
- Causa: chat/shell.js (15KB) importado estaticamente por main.js y router.js. Split requiere refactor coordinado de ambos.
- Accion recomendada: sesion dedicada para extraer chat shell a dynamic import compartido.

6. Cobertura de tests: ~5-35% actual vs 80% objetivo.
- Jules (Google AI) trabajando en scaffolding de tests (BookingServiceTest, RateLimiterTest, AuthSessionTest).
- Pendiente integracion de su PR.

7. Monitoring/observabilidad: Sentry ACTIVO en produccion.
- DSN backend (PHP) y DSN frontend (JS) configurados en env del servidor.
- Proyectos separados en sentry.io: pielarmonia-backend y pielarmonia-frontend.
- SDK carga lazy via monitoring-loader.js (async, no bloquea render).
- Pendiente: confirmar primer evento recibido en dashboard de Sentry.

## Siguiente ejecucion recomendada

1. Mantener corrida diaria de `npm run gate:prod:hash-strict` como control preventivo.
2. Publicar dashboard semanal de `booking_confirmed`, error rate y p95 de `figo-post`.
3. Integrar PR de Jules (tests unitarios) cuando este listo.
4. Confirmar primer evento en Sentry dashboard (Sentry ya activo en produccion).
5. Sesion dedicada para split de script.js (chat/shell refactor, ~31KB de ahorro potencial).
