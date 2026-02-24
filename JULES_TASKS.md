# JULES_TASKS.md — Cola derivada desde AGENT_BOARD.yaml

> Archivo generado por `node agent-orchestrator.js sync`.
> No editar manualmente; los cambios se sobrescriben.
> Ejecutar cola: `JULES_API_KEY=xxx node jules-dispatch.js dispatch`

---

## Formato de tarea

```
<!-- TASK
status: pending | dispatched | done | failed
task_id: AG-XXX
risk: low|medium|high
scope: docs|frontend|backend|platform|security|ops
files: path1,path2
acceptance_ref: verification/agent-runs/AG-XXX.md
dispatched_by: agent-orchestrator
session:
dispatched:
-->
### Titulo

Prompt...

<!-- /TASK -->
```

---

## Tareas

<!-- TASK
status: done
task_id: AG-001
risk: high
scope: platform
files: backup-receiver.php,verify-backup.php,lib/backup.php,tests/BackupReceiverTest.php,env.example.php,docs/RUNBOOKS.md
acceptance_ref: tests/BackupReceiverTest.php
dispatched_by: agent-orchestrator
session: 
dispatched: 
-->
### Backup integrity verification and at-rest encryption

Implementar checksum SHA-256 por header, cifrado AES-256-CBC y prueba de integridad con test.

<!-- /TASK -->

<!-- TASK
status: done
task_id: AG-002
risk: medium
scope: backend
files: lib/ratelimit.php,tests/RateLimiterTest.php,tests/Security/RateLimiterTest.php,tests/Unit/Security/RateLimiterTest.php,env.example.php
acceptance_ref: tests/RateLimiterTest.php
dispatched_by: agent-orchestrator
session: 
dispatched: 
-->
### PHP rate-limiter sliding window and per-user limits

Actualizar rate-limiter a sliding window, incluir limite por user token y pruebas de regresion.

<!-- /TASK -->

<!-- TASK
status: done
task_id: AG-003
risk: low
scope: docs
files: docs/openapi.yaml,README.md
acceptance_ref: docs/openapi.yaml,README.md
dispatched_by: agent-orchestrator
session: 
dispatched: 
-->
### OpenAPI 3.1 specification for public API resources

Generar OpenAPI 3.1 para api.php recursos principales y documentar como visualizarla localmente.

<!-- /TASK -->

<!-- TASK
status: done
task_id: AG-004
risk: medium
scope: backend
files: lib/mailer.php,templates/email,tests/MailerTest.php
acceptance_ref: verification/agent-runs/AG-004.md
dispatched_by: agent-orchestrator
session: 
dispatched: 
-->
### Email notification system for appointment confirmations

Implementar wrapper PHPMailer para confirmaciones y recordatorios con templates HTML y test.

<!-- /TASK -->
