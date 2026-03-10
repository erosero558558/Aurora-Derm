# Active Ops Scripts

Arbol canonico de implementaciones PowerShell activas del repositorio.

Subcarpetas:

- `admin/`: gates y contingencia del runtime admin.
- `deploy/`: empaquetado y soporte de despliegue.
- `prod/`: verificaciones, smoke, monitoreo y reportes de produccion.
- `setup/`: scripts de configuracion puntual para integraciones operativas.

Los archivos de raiz se mantienen como wrappers compatibles para no romper
`package.json`, workflows ni runbooks existentes.

Contrato local:

- `TEST_BASE_URL` gobierna las suites que reutilizan un servidor de
  desarrollo/pruebas local.
- `LOCAL_VERIFY_BASE_URL` queda reservado para verificaciones del host servido
  por Nginx en scripts de deploy live.
