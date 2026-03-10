# Deploy Ops Scripts

Implementaciones canonicas para empaquetado y soporte de despliegue.

Entrypoints:

- `PREPARAR-PAQUETE-DESPLIEGUE.ps1`

El bundle canonico del admin incluye `admin-v3.css` y `queue-ops.css`.
Los CSS legacy archivados no forman parte del paquete.
`npm run bundle:deploy` preserva los wrappers raiz junto con
`scripts/ops/prod`, `scripts/ops/setup` y `bin/powershell` para que el
tooling incluido siga siendo ejecutable fuera del repo.

El archivo de raiz se mantiene como wrapper compatible.
