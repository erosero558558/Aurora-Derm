# Architecture

## Canonical core

`patientCase` es la entidad operativa primaria.

- Un paciente puede tener un solo caso activo por tenant.
- Booking, queue, callbacks, mensajes, approvals y tareas se enlazan al mismo `patientCase`.
- Cuando un caso se cierra, el siguiente episodio abre un caso nuevo.

## Runtime split

- El core transaccional persiste `patient_cases`, timeline, actions, approvals y links.
- El runtime agentic consume `PatientCaseSnapshot`.
- Las acciones ambiguas crean `PatientCaseAction` o `PatientCaseApproval`; no ejecutan side effects inseguros.

## Surfaces

- `Ops Console`
- `Patient Flow Link`
- `Wait Room Display`
- `Clinic Dashboard`
