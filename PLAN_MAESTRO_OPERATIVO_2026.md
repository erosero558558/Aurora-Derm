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
Estado: `IN_PROGRESS`
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
- [ ] `TEST_REQUIRE_GOOGLE_CALENDAR=true npm run test:calendar-contract` en verde contra produccion.

## Fase 2 - Consistencia web/chat/reprogramacion
Estado: `PENDING`
Entregables:
- [x] Duracion por servicio centralizada (30/60 min).
- [x] `indiferente` por menor carga + round-robin.
- [x] Chat y reprogramacion consultan disponibilidad por `doctor + service`.
- [x] Admin disponibilidad en solo lectura cuando source=google.
- [x] API normaliza conflicto a `slot_conflict` en 409.

Criterio de salida:
- [ ] Test de concurrencia: 1x `201`, 1x `409 slot_conflict`.
- [ ] Misma oferta de slots entre web y chat para misma fecha/servicio.

## Fase 3 - Embudo de conversion y errores accionables
Estado: `PENDING`
Entregables:
- [ ] Eventos GA4 obligatorios en todo el embudo.
- [ ] Registro de abandono por paso y razon.
- [ ] Mensajes UX claros para calendar unavailable, slot conflict y pago.

Criterio de salida:
- [ ] Dashboard con embudo completo operativo.
- [ ] Error rate de reserva < 2% (ventana 7 dias).

## Fase 4 - Mobile UX y rendimiento critico
Estado: `PENDING`
Entregables:
- [ ] Correccion de solapes chat/header/nav movil.
- [ ] Correccion de alineaciones y saltos tipograficos.
- [ ] Resolucion de assets 404 declarados en smoke/gate.
- [ ] Reduccion de carga JS/CSS no critica.

Criterio de salida:
- [ ] QA en 360x800, 390x844, 412x915 sin defectos criticos.
- [ ] Smoke de assets sin 404 en componentes esperados.

## Fase 5 - Cierre hardening y vuelta a hash estricto
Estado: `COMPLETED`
Entregables:
- [x] Eliminar drift de hashes local/remoto.
- [x] Reactivar hash gate bloqueante.
- [x] Playbook de incidentes actualizado.

Criterio de salida:
- [x] `npm run gate:prod` en verde en 3 corridas consecutivas (validado con corridas strict manuales 2026-02-23 21:59, 22:00 y 22:02 hora local servidor).

## Comandos oficiales del plan
- Validacion backend bloqueante: `npm run gate:prod:backend`
- Validacion strict hash (manual): `npm run gate:prod:hash-strict`
- Contrato calendario: `npm run test:calendar-contract`
- Escritura calendario: `npm run test:calendar-write`
- Errores chat agenda: `npm run test:chat-booking-calendar-errors`
- Smoke produccion: `npm run smoke:prod`

## Backlog diferido (no bloqueante de fase activa)
- Rediseño visual total.
- Optimizaciones avanzadas de bundle no criticas para conversion.
- Funcionalidades nuevas sin impacto directo en reserva.
