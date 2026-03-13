# Deploy Ops Scripts

Implementaciones canonicas para empaquetado y soporte de despliegue.

Entrypoints:

- `PREPARAR-PAQUETE-DESPLIEGUE.ps1`

El bundle canonico del admin incluye `admin-v3.css` y `queue-ops.css`.
Los CSS legacy archivados no forman parte del paquete.
`npm run bundle:deploy` preserva los wrappers raiz junto con
`scripts/ops/prod`, `scripts/ops/setup` y `bin/powershell` para que el
tooling incluido siga siendo ejecutable fuera del repo.
La documentacion operativa incluida en el bundle viaja desde
`docs/DEPLOYMENT.md`, `docs/DEPLOY_HOSTING_PLAYBOOK.md` y
`docs/PRODUCTION_TEST_CHECKLIST.md`; no depende de los shims markdown de
raiz.
El bundle canonico de produccion tambien incluye la shell publica V6
(`es/**`, `en/**`, `_astro/**`, `js/public-v6-shell.js`), la capa de soporte
del gateway publico (`styles.css`, `styles-deferred.css`), el runtime
versionado del gateway (`script.js`, `js/chunks/**`, `js/engines/**`), el
runtime admin V3 (`admin.js`, `js/admin-chunks/**`,
`js/admin-preboot-shortcuts.js`) y las superficies de turnero publicadas.

La frontera canonica entre source y outputs versionados vive en
`docs/RUNTIME_ARTIFACT_POLICY.md`; para revisar esos outputs como artefactos
usar `npm run check:deploy:artifacts`.

El archivo de raiz se mantiene como wrapper compatible.
