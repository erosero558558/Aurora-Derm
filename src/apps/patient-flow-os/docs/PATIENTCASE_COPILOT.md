# PatientCase Copilot

`PatientCase Copilot` es el corazón operativo de OpenClaw dentro de `Patient Flow OS`.

## Contrato

- `CopilotRecommendation`: decisión estructurada y auditable.
- `PreparedActionPacket`: payload listo para revisión o ejecución.
- `CopilotReviewDecision`: rastro humano (`approve`, `edit_and_run`, `reject`, `snooze`).

## Primer surface

La primera surface real es la case card de Ops con cinco bloques fijos:

- `Ahora`
- `Por qué`
- `Riesgo si no`
- `Qué te dejo listo`
- `Aprobación humana`

## Regla operativa

El copiloto puede razonar sobre queue, scheduling, payments, approvals, follow-up y handoff, pero no ejecuta silenciosamente pasos sensibles. Todo queda estructurado y revisable.
