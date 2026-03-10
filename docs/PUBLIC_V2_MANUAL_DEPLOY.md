# Public V2 Manual Deploy (Deprecated Alias)

Este documento queda como alias histórico. El runbook canónico es:

- [PUBLIC_V3_MANUAL_DEPLOY.md](./PUBLIC_V3_MANUAL_DEPLOY.md)

El nombre `PUBLIC_V3_MANUAL_DEPLOY.md` también es histórico: hoy publica artefactos V6.

Comando canónico:

```bash
bash ./bin/deploy-public-v3-live.sh
```

Compatibilidad temporal:

```bash
bash ./bin/deploy-public-v2-live.sh
```

`deploy-public-v2-live.sh` delega automáticamente a `deploy-public-v3-live.sh`.
Si el verify interno del VPS necesita otro host Nginx local, usar
`LOCAL_VERIFY_BASE_URL=...` igual que en el runbook V3.
