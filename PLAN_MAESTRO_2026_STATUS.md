# Plan Maestro 2026 - Estado Operativo

Fecha de actualizacion: 2026-02-23
Dominio: https://pielarmonia.com

## Resumen rapido

- Estado general: En curso, estable.
- Chatbot: Operativo en Trinity/OpenRouter (cola OpenClaw deshabilitada por decision de producto).
- Agenda real: Flujo create/reschedule/cancel validado contra Google Calendar en produccion.
- Gate de produccion: Verde en modo backend (hash checks en modo warning temporal hasta 2026-03-08).
- Gate hash estricto: ya valida hashes aun con deploy stale (fix aplicado en scripts de verificacion).

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
- Resultado: falla por drift real de assets (`9 hash mismatches`).
- Causa: hosting remoto no sincronizado con `main` (frontend viejo en produccion).

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

4. Fase 3 - Conversion y medicion: En progreso avanzado.
- Eventos funnel y contrato API validados.
- Dashboard operacional semanal automatizado implementado (`npm run report:weekly:prod`).
- Alertas operativas semanales implementadas en GitHub Actions (`weekly-kpi-report.yml`).

5. Fase 4 - UX movil y rendimiento critico: En progreso avanzado.
- Regresiones moviles criticas en verde.
- Pendiente: seguimiento visual continuo post deploy.

6. Fase 5 - Hardening final y hash gate estricto: Programada.
- Cambio automatico a hash blocking despues de 2026-03-08 (ya parametrizado en `GATE-POSTDEPLOY.ps1`).
- Pendiente: ejecutar 3 despliegues consecutivos en verde con hash estricto.

## Nudos reales pendientes (sin ruido)

1. Entorno local sin PHP en PATH.
- Impacto: `npm run test:php` no corre en esta maquina.
- Mitigacion: tests backend criticos ya validados en produccion con Playwright/Smoke/Gate.

2. Deploy freshness en modo advisory.
- Estado: no bloqueante y esperado mientras hash gate temporal esta en warning.
- Accion: revalidar en modo hash estricto a partir del 2026-03-08.

3. Repair git sync remoto bloqueado por red.
- Workflow ejecutado: `Repair Git Sync (Self-Heal)` run `22312282946`.
- Falla: `dial tcp ...:22: i/o timeout`.
- Implicacion: no se puede forzar `git reset` remoto desde GitHub Actions con la red actual.

4. Host de deploy no accesible desde runner/local por puertos de administracion.
- Pruebas: `101.47.4.223` en puertos `22`, `21`, `990` -> `TcpTestSucceeded=False`.
- Implicacion: no hay canal remoto util para sincronizar artefactos (SSH/FTP/FTPS).

## Siguiente ejecucion recomendada

1. Correr `npm run gate:prod:hash-strict` en ventana controlada de despliegue.
2. Si pasa, activar `gate:prod` como bloqueante total en workflow principal.
3. Publicar dashboard semanal de `booking_confirmed`, error rate y p95 de `figo-post`.
