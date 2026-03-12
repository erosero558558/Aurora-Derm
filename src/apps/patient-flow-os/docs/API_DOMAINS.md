# API Domains

## `patient-cases`

- `GET /v1/patient-cases?tenantId=...`
- `GET /v1/patient-cases/:caseId?tenantId=...`
- `GET /v1/patient-cases/:caseId/timeline?tenantId=...`
- `POST /v1/patient-cases/:caseId/actions?tenantId=...`
- `POST /v1/patient-cases/:caseId/approvals/:approvalId/resolve?tenantId=...`
- `PATCH /v1/patient-cases/:caseId/status?tenantId=...`

## `callbacks`

- `POST /v1/callbacks?tenantId=...`

## `appointments`

- `GET /v1/appointments?tenantId=...`
- `POST /v1/appointments/:appointmentId/confirm?tenantId=...`
- `POST /v1/appointments/:appointmentId/reschedule-request?tenantId=...`
- `POST /v1/appointments/:appointmentId/check-in?tenantId=...`
- `POST /v1/appointments/:appointmentId/no-show?tenantId=...`

## `queue`

- `GET /v1/queue?tenantId=...`
- `POST /v1/queue/:ticketId/call?tenantId=...`
- `POST /v1/queue/:ticketId/complete?tenantId=...`

## `messages`

- `GET /v1/messages/threads?tenantId=...`
- `POST /v1/messages/patient-flow?tenantId=...`

## `agent-tasks`

- `GET /v1/agent-tasks?tenantId=...`
- `POST /v1/agent-tasks/ops-next-best-action?tenantId=...`

## `reports`

- `GET /v1/reports/kpi?tenantId=...`

## `audit`

- `GET /v1/audit?tenantId=...`
