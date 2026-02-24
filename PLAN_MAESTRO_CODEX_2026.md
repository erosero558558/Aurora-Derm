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
