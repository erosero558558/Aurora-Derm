# Deploy Ops Scripts

Implementaciones canonicas para empaquetado y soporte de despliegue.

Entrypoints:

- `PREPARAR-PAQUETE-DESPLIEGUE.ps1`

El bundle canonico del admin incluye `admin-v3.css` y `queue-ops.css`.
Los CSS legacy archivados no forman parte del paquete.
`npm run bundle:deploy` preserva los wrappers raiz junto con
`scripts/ops/prod`, `scripts/ops/setup` y `bin/powershell` para que el
tooling incluido siga siendo ejecutable fuera del repo.
El bundle canonico de produccion tambien incluye la shell publica V6
(`es/**`, `en/**`, `_astro/**`, `js/public-v6-shell.js`), el runtime admin V3
(`admin.js`, `js/admin-chunks/**`, `js/admin-preboot-shortcuts.js`) y las
superficies de turnero publicadas.

El archivo de raiz se mantiene como wrapper compatible.
