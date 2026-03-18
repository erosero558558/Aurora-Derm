# Aurora-Derm Flow OS foundation patch

## Incluye

### Archivos modificados

- `README.md`
- `package.json`

### Archivos nuevos

- `docs/FLOW_OS_FOUNDATION.md`
- `docs/FLOW_OS_ORCHESTRATION.md`
- `data/flow-os/manifest.v1.json`
- `src/domain/flow-os/load-manifest.js`
- `src/domain/flow-os/patient-journey.js`
- `bin/flow-os-summary.js`
- `tests-node/flow-os-domain.test.js`
- `lib/flow_os_manifest.php`

## Validacion local ejecutada

- `node --test tests-node/flow-os-domain.test.js`
- `node bin/flow-os-summary.js care_plan_ready`
- `php -l lib/flow_os_manifest.php`

## Intencion del cambio

Este patch no intenta reescribir todo el runtime clinico.
Primero fija la base conceptual y tecnica de `Flow OS` dentro del repo:

- journey canonico del paciente
- manifest compartido de estados
- reglas de siguientes acciones
- plan de delegacion de subagentes
- fuente documental para orientar el roadmap
