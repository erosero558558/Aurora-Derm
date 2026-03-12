# Postgres Cutover CLI

`Patient Flow OS` incluye una CLI operativa para inspeccionar, exportar y ejecutar el cutover one-shot hacia el modelo canónico `patientCase-first` sobre Postgres real.

## Requisito

Definir `DATABASE_URL` antes de ejecutar la CLI, o inyectar un pool desde tests.

PowerShell:

```powershell
$env:DATABASE_URL = "postgresql://user:pass@localhost:5432/patient_flow_os"
```

## Comandos

Inspeccionar el estado canónico actual:

```powershell
npm run cutover -- inspect --json
```

Ejecutar smoke de invariantes canónicas:

```powershell
npm run cutover -- smoke --json
```

Exportar snapshot lógico del bootstrap state:

```powershell
npm run cutover -- export-state --output .\artifacts\patient-flow-state.json --json
```

Reemplazar completamente el estado desde un snapshot:

```powershell
npm run cutover -- replace-state --input .\artifacts\patient-flow-state.json --allow-destructive --json
```

Sembrar el estado demo local:

```powershell
npm run cutover -- seed-demo --allow-destructive --json
```

Importar el bundle proyectado de OpenClaw sin borrar el estado actual:

```powershell
npm run cutover -- import-openclaw --input .\artifacts\openclaw-bundle.json --mode merge --json
```

Importar OpenClaw como reemplazo total:

```powershell
npm run cutover -- import-openclaw --input .\artifacts\openclaw-bundle.json --mode replace --allow-destructive --json
```

Ejecutar el cutover OpenClaw con backup lógico, smoke y artifacts antes/después:

```powershell
npm run cutover -- cutover-openclaw --input .\artifacts\openclaw-bundle.json --artifacts-dir .\artifacts\cutovers --mode merge --json
```

Verificar que un `report.json` cumple el approval contract del cutover:

```powershell
npm run cutover -- verify-report --input .\artifacts\cutovers\...\report.json --json
```

Verificar que un `promotion-packet.json` de staging está listo para promoverse a producción:

```powershell
npm run cutover -- verify-promotion-packet --input .\artifacts\promotion\promotion-packet.json --source-environment staging --target-environment production --json
```

Verificar que un `rollback-packet.json` de producción está listo para rehearsal o restore:

```powershell
npm run cutover -- verify-rollback-packet --input .\artifacts\rollback\rollback-packet.json --source-environment production --json
```

Verificar que un `backup-drill-packet.json` cumple los budgets de `RTO/RPO`:

```powershell
npm run cutover -- verify-backup-drill --input .\artifacts\backup-drill\backup-drill-packet.json --source-environment production --max-rto-seconds 900 --max-rpo-seconds 3600 --json
```

Verificar que un `backup-escrow-packet.json` cumple la política del escrow externo:

```powershell
npm run cutover -- verify-backup-escrow --input .\artifacts\backup-drill\backup-escrow-packet.json --source-environment production --max-object-age-hours 24 --json
```

Construir un backup escrow replica packet desde `backup-escrow-replica-manifest.json`:

```powershell
npm run cutover -- backup-escrow-replica-packet --input .\artifacts\backup-drill\backup-escrow-replica-manifest.json --artifacts-dir .\artifacts\backup-drill --source-environment production --max-object-age-hours 24 --json
```

Verificar que un `backup-escrow-replica-packet.json` demuestra réplica multi-sitio íntegra y distinta del escrow primario:

```powershell
npm run cutover -- verify-backup-escrow-replica --input .\artifacts\backup-drill\backup-escrow-replica-packet.json --source-environment production --max-object-age-hours 24 --json
```

Construir un backup escrow restore packet desde `backup-escrow-restore-manifest.json`:

```powershell
npm run cutover -- backup-escrow-restore-packet --input .\artifacts\backup-drill\backup-escrow-restore-manifest.json --artifacts-dir .\artifacts\backup-escrow-restore --source-environment production --max-rto-seconds 900 --json
```

Verificar que un `backup-escrow-restore-packet.json` demuestra restore íntegro desde el objeto cifrado externo:

```powershell
npm run cutover -- verify-backup-escrow-restore --input .\artifacts\backup-escrow-restore\backup-escrow-restore-packet.json --source-environment production --max-rto-seconds 900 --json
```

`backup-escrow-restore-packet` acepta como `backupEscrowPacketPath` tanto un `backup-escrow-packet.json` primario como un `backup-escrow-replica-packet.json`; el manifest debe declarar `restoreSource=primary|replica` cuando se quiera fijar explícitamente el origen.

Construir un promotion packet desde `workflow-manifest.json` y los artifacts post-cutover:

```powershell
npm run cutover -- promotion-packet --input .\artifacts\cutovers\workflow-manifest.json --artifacts-dir .\artifacts\promotion --post-smoke .\artifacts\post-cutover-smoke.json --post-inspect .\artifacts\post-cutover-inspect.json --target-environment staging --json
```

Construir un rollback packet desde `workflow-manifest.json` y el `before-state.json` capturado por el cutover:

```powershell
npm run cutover -- rollback-packet --input .\artifacts\cutovers\workflow-manifest.json --artifacts-dir .\artifacts\rollback --source-environment production --json
```

Construir un backup drill packet desde `backup-drill-manifest.json`:

```powershell
npm run cutover -- backup-drill-packet --input .\artifacts\backup-drill\backup-drill-manifest.json --artifacts-dir .\artifacts\backup-drill --source-environment production --max-rto-seconds 900 --max-rpo-seconds 3600 --json
```

Construir un backup escrow packet desde `backup-escrow-manifest.json`:

```powershell
npm run cutover -- backup-escrow-packet --input .\artifacts\backup-drill\backup-escrow-manifest.json --artifacts-dir .\artifacts\backup-drill --source-environment production --max-object-age-hours 24 --json
```

## Guardrails

- `replace-state` exige `--allow-destructive`.
- `seed-demo` exige `--allow-destructive`.
- `import-openclaw --mode replace` exige `--allow-destructive`.
- `cutover-openclaw --mode replace` exige `--allow-destructive`.
- `import-openclaw --mode merge` preserva el estado existente y agrega/actualiza entidades canónicas.
- `smoke` falla con exit code distinto de cero si detecta errores de integridad canónica.
- `cutover-openclaw` escribe `before-state.json`, `after-state.json`, `input-openclaw-bundle.json` y `report.json`.
- `verify-report` falla si el `report.json` no demuestra `smokeGate.passed`, `afterSmoke.ok` y la presencia de los artifacts requeridos.
- `verify-promotion-packet` falla si el paquete no está listo para el target esperado (`staging -> production` o `production -> completed`).
- `promotion-packet` falla si el bundle de evidencia no está listo para promoverse al siguiente environment.
- `verify-rollback-packet` falla si el paquete no está listo para ejecutar `replace-state` sobre el `before-state.json` capturado.
- `rollback-packet` falla si el bundle de evidencia del cutover no deja rollback trazable y verificable.
- `verify-backup-drill` falla si el packet no cumple smoke, integridad de restore o budgets de `RTO/RPO`.
- `backup-drill-packet` falla si la evidencia de `pg_dump/pg_restore` no deja un drill verificable.
- `backup-drill-packet` y `verify-backup-drill` exigen evidencia de dump cifrado, checksum cifrado y metadatos de retención/expiración.
- `backup-escrow-packet` falla si la evidencia del escrow externo no deja bucket/key/tags/metadata trazables.
- `verify-backup-escrow` falla si el objeto externo no existe en evidencia local, si deriva de un drill no verde o si excede el budget de edad configurado.
- `backup-escrow-replica-packet` falla si la réplica secundaria no conserva checksum, metadata/tags o aislamiento respecto del escrow primario.
- `verify-backup-escrow-replica` falla si la réplica no es trazable, si no deriva de un escrow primario verde o si no aporta un target distinto.
- `backup-escrow-restore-packet` falla si el restore desde el escrow primario o desde la réplica no conserva checksums, smoke o totales canónicos.
- `verify-backup-escrow-restore` falla si el restore desde escrow excede el budget de `RTO`, si no preserva integridad o si la evidencia local está incompleta.

## Workflow manual en GitHub Actions

Existe un workflow manual en `.github/workflows/patient-flow-os-cutover.yml` para ejecutar el cutover sobre un `DATABASE_URL` real sin correr comandos desde la terminal local.

Requisitos:

- Environment de GitHub protegido: `patient-flow-os-staging` o `patient-flow-os-production`.
- Secret del environment o del repositorio: `PATIENT_FLOW_OS_DATABASE_URL`.
- Bundle OpenClaw versionado dentro del repo y accesible por ruta relativa, por ejemplo `verification/patient-flow-os/openclaw-bundle.json`.
- Si se elige `cutover_mode=replace`, el dispatch debe enviar `confirm_replace=true`.

Inputs del workflow:

- `openclaw_bundle_path`: ruta repo-relative al bundle JSON.
- `cutover_mode`: `merge` o `replace`.
- `target_environment`: `staging` o `production`, usado para resolver el environment protegido `patient-flow-os-*`.
- `run_post_cutover_smoke`: ejecuta un segundo smoke canónico, separado del import principal.
- `confirm_replace`: guardrail explícito para corridas destructivas.

Artifacts generados por el workflow:

- `preflight-smoke.json`
- `cutover-result.json`
- `cutover-stderr.log`
- `approval-contract.json`
- `workflow-manifest.json`
- `before-state.json`
- `after-state.json`
- `input-openclaw-bundle.json`
- `report.json`
- `post-cutover-smoke.json`
- `post-cutover-inspect.json`
- `promotion-packet.json`
- `promotion-packet.md`
- `promotion-checklist.json`
- `promotion-checklist.md`

## Workflow de promoción `staging -> production`

Existe un segundo workflow manual en `.github/workflows/patient-flow-os-promote.yml`.

Objetivo:

- descargar artifacts del run staging aprobado,
- verificar `promotion-packet.json`,
- repetir el cutover sobre `patient-flow-os-production`,
- emitir un packet final de producción con estado `completed`.

Inputs principales:

- `source_run_id`: run id del workflow `Patient Flow OS Cutover` ya ejecutado en staging.
- `promotion_packet_path`: ruta dentro del artifact staging hacia `promotion-packet.json`.
- `source_cutover_artifact_name`: por defecto `patient-flow-os-cutover-artifacts`.
- `source_post_cutover_artifact_name`: por defecto `patient-flow-os-post-cutover-artifacts`.
- `confirm_production_cutover`: debe ser `true` para permitir mutación de producción.

Artifacts de promoción:

- `patient-flow-os-promotion-source`
- `patient-flow-os-production-promotion-artifacts`
- `source-promotion-packet.json`
- `source-promotion-checklist.json`
- `source-promotion-verification.json`
- `promotion-source-manifest.json`
- `promotion-packet.json`
- `promotion-packet.md`
- `promotion-checklist.json`
- `promotion-checklist.md`
- `promotion-verification.json`

El workflow de promoción también publica evidencia de rollback lista para uso posterior:

- `rollback-packet.json`
- `rollback-packet.md`
- `rollback-checklist.json`
- `rollback-checklist.md`
- `rollback-verification.json`

## Workflow de rollback y rehearsal

Existe un tercer workflow manual en `.github/workflows/patient-flow-os-rollback.yml`.

Objetivo:

- descargar artifacts con `rollback-packet.json` y `before-state.json`,
- verificar el packet de rollback,
- ejecutar `replace-state --allow-destructive` como `rehearsal` o `restore`,
- correr smoke/inspect posteriores y publicar evidencia del restore.

Inputs principales:

- `source_run_id`: run id del workflow `Patient Flow OS Promote` que dejó artifacts de rollback.
- `rollback_packet_path`: ruta dentro del artifact fuente hacia `rollback-packet.json`.
- `source_artifact_name`: por defecto `patient-flow-os-production-promotion-artifacts`.
- `target_environment`: `staging` o `production`.
- `operation_mode`: `rehearsal` o `restore`.
- `confirm_restore`: debe ser `true` cuando `operation_mode=restore`.

Artifacts de rollback:

- `patient-flow-os-rollback-source`
- `patient-flow-os-rollback-artifacts`
- `source-rollback-packet.json`
- `source-rollback-checklist.json`
- `source-rollback-verification.json`
- `source-before-state.json`
- `rollback-source-manifest.json`
- `preflight-smoke.json`
- `rollback-result.json`
- `post-rollback-smoke.json`
- `post-rollback-inspect.json`
- `rollback-manifest.json`

## Workflow de backup drill

Existe un cuarto workflow manual en `.github/workflows/patient-flow-os-backup-drill.yml`.

Objetivo:

- ejecutar `pg_dump` sobre `PATIENT_FLOW_OS_DATABASE_URL`,
- restaurar el dump en `PATIENT_FLOW_OS_DRILL_DATABASE_URL`,
- cifrar el dump con `gpg --symmetric` antes de retener artifacts,
- publicar el dump cifrado a un escrow externo S3-compatible con tags y metadata de retención,
- correr smoke/inspect en source y restore,
- calcular evidencia explícita de `RTO/RPO`,
- emitir `backup-drill-packet.json`, `backup-escrow-packet.json` y sus verificaciones.

Secrets requeridos por environment:

- `PATIENT_FLOW_OS_DATABASE_URL`
- `PATIENT_FLOW_OS_DRILL_DATABASE_URL`
- `PATIENT_FLOW_OS_BACKUP_ENCRYPTION_PASSPHRASE`
- `PATIENT_FLOW_OS_BACKUP_ESCROW_AWS_ACCESS_KEY_ID`
- `PATIENT_FLOW_OS_BACKUP_ESCROW_AWS_SECRET_ACCESS_KEY`
- `PATIENT_FLOW_OS_BACKUP_ESCROW_AWS_REGION`
- `PATIENT_FLOW_OS_BACKUP_ESCROW_BUCKET`
- `PATIENT_FLOW_OS_BACKUP_ESCROW_REPLICA_BUCKET`

Variables recomendadas por environment:

- `PATIENT_FLOW_OS_BACKUP_ESCROW_PREFIX`
- `PATIENT_FLOW_OS_BACKUP_ESCROW_LIFECYCLE_POLICY_REF`
- `PATIENT_FLOW_OS_BACKUP_ESCROW_REPLICA_REGION`
- `PATIENT_FLOW_OS_BACKUP_ESCROW_REPLICA_PREFIX`
- `PATIENT_FLOW_OS_BACKUP_ESCROW_REPLICA_LIFECYCLE_POLICY_REF`

Inputs principales:

- `target_environment`: `staging` o `production`.
- `max_rto_seconds`: budget máximo de restore time objective.
- `max_rpo_seconds`: budget máximo de recovery point objective.
- `retention_days`: días de retención del dump cifrado y del artifact publicado.
- `max_escrow_age_hours`: edad máxima aceptada para el objeto subido al escrow externo al momento de verificarlo.
- `confirm_drill_reset`: debe ser `true` para resetear el drill database antes del restore.

Artifacts de backup drill:

- `patient-flow-os-backup-drill-artifacts`
- `backup-drill-manifest.json`
- `patient-flow-os.dump.sha256`
- `patient-flow-os.dump.gpg`
- `patient-flow-os.dump.gpg.sha256`
- `source-smoke.json`
- `source-inspect.json`
- `restore-smoke.json`
- `restore-inspect.json`
- `backup-drill-packet-command.json`
- `backup-drill-packet.json`
- `backup-drill-packet.md`
- `backup-drill-checklist.json`
- `backup-drill-checklist.md`
- `backup-drill-verification.json`
- `backup-escrow-manifest.json`
- `escrow-put-object-response.json`
- `escrow-head-object.json`
- `escrow-object-tagging.json`
- `backup-escrow-packet-command.json`
- `backup-escrow-packet.json`
- `backup-escrow-packet.md`
- `backup-escrow-checklist.json`
- `backup-escrow-checklist.md`
- `backup-escrow-verification.json`
- `backup-escrow-replica-manifest.json`
- `replica-escrow-put-object-response.json`
- `replica-escrow-head-object.json`
- `replica-escrow-object-tagging.json`
- `backup-escrow-replica-packet-command.json`
- `backup-escrow-replica-packet.json`
- `backup-escrow-replica-packet.md`
- `backup-escrow-replica-checklist.json`
- `backup-escrow-replica-checklist.md`
- `backup-escrow-replica-verification.json`

Notas operativas:

- El dump plano se usa solo dentro del runner efímero para `pg_restore`; el artifact retenido es `patient-flow-os.dump.gpg`.
- El manifest registra `archiveDestination=github_artifact_encrypted`, `encryptionMode=gpg_symmetric`, `encryptionKeyRef`, `retentionDays` y `expiresAt`.
- `verify-backup-drill` ahora bloquea si falta el dump cifrado, su checksum o la ventana auditable de expiración.
- El escrow externo publica el dump cifrado en S3 con `archiveDestination=aws_s3_encrypted`, metadata (`source_environment`, `retention_days`, `expires_at`, `backup_mode`, `lifecycle_policy_ref`) y tags equivalentes.
- `verify-backup-escrow` bloquea si el escrow no deriva de un `backup-drill-packet` verde, si el objeto excede `max_escrow_age_hours` o si tags/metadata no reflejan la política de retención.
- El mismo workflow publica una réplica secundaria del dump cifrado con `replicationMode=escrow_replica_copy`, bucket/region distintos y verificación explícita de checksum y aislamiento frente al escrow primario.
- `verify-backup-escrow-replica` bloquea si la réplica apunta al mismo target del escrow primario, si no conserva el mismo checksum cifrado o si metadata/tags no reflejan el contrato de lifecycle replica.

## Workflow de escrow restore

Existe un quinto workflow manual en `.github/workflows/patient-flow-os-escrow-restore.yml`.

Objetivo:

- descargar el `backup-escrow-packet.json` y el resto de evidencia del run `Patient Flow OS Backup Drill`,
- verificar el escrow packet antes de tocar el drill database,
- descargar el objeto cifrado desde S3-compatible, descifrarlo y restaurarlo en `PATIENT_FLOW_OS_DRILL_DATABASE_URL`,
- correr smoke/inspect post-restore,
- emitir `backup-escrow-restore-packet.json` y su verificación como evidencia formal de disaster recovery desde escrow externo.

Secrets requeridos por environment:

- `PATIENT_FLOW_OS_DRILL_DATABASE_URL`
- `PATIENT_FLOW_OS_BACKUP_ENCRYPTION_PASSPHRASE`
- `PATIENT_FLOW_OS_BACKUP_ESCROW_AWS_ACCESS_KEY_ID`
- `PATIENT_FLOW_OS_BACKUP_ESCROW_AWS_SECRET_ACCESS_KEY`
- `PATIENT_FLOW_OS_BACKUP_ESCROW_AWS_REGION`

Inputs principales:

- `source_run_id`: run id del workflow `Patient Flow OS Backup Drill` que publicó el escrow packet.
- `backup_escrow_packet_path`: ruta dentro del artifact fuente hacia `backup-escrow-packet.json`.
- `source_artifact_name`: por defecto `patient-flow-os-backup-drill-artifacts`.
- `target_environment`: `staging` o `production`, usado para resolver el environment protegido `patient-flow-os-*`.
- `max_rto_seconds`: budget máximo permitido para el restore desde escrow.

Artifacts de escrow restore:

- `patient-flow-os-escrow-restore-artifacts`
- `source-backup-escrow-packet.json`
- `source-backup-drill-packet.json`
- `source-smoke.json`
- `source-inspect.json`
- `source-backup-escrow-checklist.json`
- `source-backup-escrow-verification.json`
- `escrow-get-object-response.json`
- `downloaded-patient-flow-os.dump.gpg.sha256`
- `restored-patient-flow-os.dump.sha256`
- `restore-smoke.json`
- `restore-inspect.json`
- `backup-escrow-restore-manifest.json`
- `backup-escrow-restore-packet.json`
- `backup-escrow-restore-packet.md`
- `backup-escrow-restore-checklist.json`
- `backup-escrow-restore-checklist.md`
- `backup-escrow-restore-verification.json`

Notas operativas:

- El workflow usa el mismo environment declarado como `source_environment` al verificar el escrow packet y al construir/verificar el restore packet.
- El restore corre sobre un drill DB aislado; no muta el `PATIENT_FLOW_OS_DATABASE_URL` primario.
- El restore exige coincidencia entre checksum del dump cifrado descargado y el checksum declarado en el escrow packet, y entre checksum del dump descifrado y el checksum del dump fuente del backup drill.
- `verify-backup-escrow-restore` bloquea si cambian los totales canónicos entre source/restore, si el smoke restaurado falla o si el `RTO` medido excede el budget configurado.

## Workflow de escrow replica restore

Existe un sexto workflow manual en `.github/workflows/patient-flow-os-escrow-replica-restore.yml`.

Objetivo:

- descargar el `backup-escrow-replica-packet.json` y el resto de evidencia del run `Patient Flow OS Backup Drill`,
- verificar el replica packet antes de tocar el drill database,
- descargar el objeto cifrado desde el bucket secundario, descifrarlo y restaurarlo en `PATIENT_FLOW_OS_DRILL_DATABASE_URL`,
- correr smoke/inspect post-restore,
- emitir `backup-escrow-restore-packet.json` y su verificación como evidencia formal de disaster recovery desde la réplica multi-sitio.

Secrets requeridos por environment:

- `PATIENT_FLOW_OS_DRILL_DATABASE_URL`
- `PATIENT_FLOW_OS_BACKUP_ENCRYPTION_PASSPHRASE`
- `PATIENT_FLOW_OS_BACKUP_ESCROW_AWS_ACCESS_KEY_ID`
- `PATIENT_FLOW_OS_BACKUP_ESCROW_AWS_SECRET_ACCESS_KEY`
- `PATIENT_FLOW_OS_BACKUP_ESCROW_AWS_REGION`

Inputs principales:

- `source_run_id`: run id del workflow `Patient Flow OS Backup Drill` que publicó el replica escrow packet.
- `backup_escrow_replica_packet_path`: ruta dentro del artifact fuente hacia `backup-escrow-replica-packet.json`.
- `source_artifact_name`: por defecto `patient-flow-os-backup-drill-artifacts`.
- `target_environment`: `staging` o `production`, usado para resolver el environment protegido `patient-flow-os-*`.
- `max_rto_seconds`: budget máximo permitido para el restore desde escrow réplica.

Artifacts de escrow replica restore:

- `patient-flow-os-escrow-replica-restore-artifacts`
- `source-backup-escrow-replica-packet.json`
- `source-backup-drill-packet.json`
- `source-smoke.json`
- `source-inspect.json`
- `source-backup-escrow-replica-checklist.json`
- `source-backup-escrow-replica-verification.json`
- `escrow-replica-get-object-response.json`
- `downloaded-patient-flow-os.dump.gpg.sha256`
- `restored-patient-flow-os.dump.sha256`
- `restore-smoke.json`
- `restore-inspect.json`
- `backup-escrow-restore-manifest.json`
- `backup-escrow-restore-packet.json`
- `backup-escrow-restore-packet.md`
- `backup-escrow-restore-checklist.json`
- `backup-escrow-restore-checklist.md`
- `backup-escrow-restore-verification.json`

Notas operativas:

- El workflow fuerza `restoreSource=replica` al construir el manifest y valida que el packet fuente realmente sea de réplica.
- El restore corre sobre un drill DB aislado; no muta el `PATIENT_FLOW_OS_DATABASE_URL` primario.
- El restore exige coincidencia entre checksum del dump cifrado descargado y el checksum declarado en el replica packet, y entre checksum del dump descifrado y el checksum del dump fuente del backup drill.
- `verify-backup-escrow-restore` bloquea igual que en el restore primario: si cambian los totales canónicos entre source/restore, si el smoke restaurado falla o si el `RTO` medido excede el budget configurado.

## Flujo recomendado

1. `inspect` para validar que el schema y los conteos esperados existen.
2. `smoke` para confirmar que el estado canónico actual no arranca con errores.
3. `export-state` para tomar backup lógico explícito antes del cutover.
4. `cutover-openclaw --mode merge` para generar artifacts, correr smoke y validar el bundle contra un merge real.
5. Revisar `report.json` y comparar `before-state.json` vs `after-state.json`.
6. `cutover-openclaw --mode replace --allow-destructive` solo cuando el cutover definitivo ya esté aprobado.
7. `verify-report` para convertir `report.json` en un approval contract verificable por CLI o CI.
8. `promotion-packet` para convertir el bundle completo de artifacts en un paquete promovible con checklist manual.
9. `verify-promotion-packet` para bloquear promoción cuando el packet staging no está listo para producción.
10. `rollback-packet` para preservar evidencia verificable del `before-state.json` que serviría para rollback posterior.
11. `verify-rollback-packet` para bloquear un restore cuando el packet no es seguro o incompleto.
12. `backup-drill-packet` para convertir evidencia de `pg_dump/pg_restore` en un packet con métricas de `RTO/RPO`, cifrado y expiración auditable.
13. `verify-backup-drill` para bloquear un drill cuando no cumple budgets, cuando el restore no conserva el estado canónico o cuando falta la evidencia de cifrado/retención.
14. `backup-escrow-packet` para convertir la publicación del dump cifrado a S3 en un packet de escrow auditable con bucket/key/tags/metadata.
15. `verify-backup-escrow` para bloquear un escrow cuando el objeto externo no respeta la política declarada o cuando su evidencia local es incompleta.
16. `backup-escrow-replica-packet` para convertir la publicación al escrow secundario en un packet verificable de réplica multi-sitio.
17. `verify-backup-escrow-replica` para bloquear una réplica cuando no aporta aislamiento real respecto del bucket primario o cuando no conserva el checksum cifrado.
18. `backup-escrow-restore-packet` para convertir la restauración desde el objeto cifrado externo, primario o réplica, en un packet verificable de disaster recovery.
19. `verify-backup-escrow-restore` para bloquear restores desde escrow cuando no preservan checksums, smoke, totales o budget de `RTO`.
20. En CI, usar el workflow `Patient Flow OS Cutover` para generar el packet de staging, `Patient Flow OS Promote` para consumir ese packet y ejecutar el replay en `patient-flow-os-production`, `Patient Flow OS Rollback` para rehearsal/restore simétricos, `Patient Flow OS Backup Drill` para validar backup físico real, escrow externo primario y réplica multi-sitio sobre un drill DB aislado, `Patient Flow OS Escrow Restore` para probar la recuperación real desde el objeto cifrado externo primario y `Patient Flow OS Escrow Replica Restore` para probar la recuperación desde el bucket secundario.
