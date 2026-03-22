# Windows Hosting Remote SSH

Wrappers canonicos para ejecutar y diagnosticar el hosting Windows desde Linux,
sin usar el checkout local como fuente de despliegue.

Entrypoints:

- `scripts/ops/setup/DIAGNOSTICAR-HOSTING-WINDOWS-SSH.sh`
- `scripts/ops/setup/EXECUTAR-HOSTING-WINDOWS-SSH.sh`

Contrato operativo:

- Por defecto toma el pin desde `origin/main` actual y lo verifica otra vez
  antes de mutar el host.
- Si necesitas fijar un release concreto, usa `WINDOWS_EXPECTED_COMMIT`.
- El fallback historico conservador queda en
  `c7619c25ad5ad5ad0436b80d75d6effb7d9f1e8b`.
- El mirror productivo debe ser `C:\dev\pielarmonia-clean-main`.
- El env sensible canonico debe vivir en
  `C:\ProgramData\Pielarmonia\hosting\env.php`.
- El wrapper remoto valida `http://127.0.0.1/__hosting/runtime`,
  `repair-hosting-status.json`, `main-sync-status.json`,
  `hosting-supervisor-status.json` y `admin-auth.php?action=status`
  local/publico.

Variables soportadas:

- `SSH_HOST`
- `SSH_PORT`
- `SSH_USERNAME`
- `SSH_IDENTITY_FILE`
- `SSH_HOST_ALIAS`
- `WINDOWS_EXPECTED_COMMIT`
- `WINDOWS_MIRROR_PATH`
- `WINDOWS_ENV_PATH`
- `WINDOWS_RELEASE_TARGET_PATH`
- `WINDOWS_HOSTING_DIR`
- `WINDOWS_PUBLIC_DOMAIN`

Uso rapido:

```bash
export SSH_HOST='windows-host.example'
export SSH_USERNAME='ernesto'
export SSH_IDENTITY_FILE="$HOME/.ssh/windows-host"

scripts/ops/setup/DIAGNOSTICAR-HOSTING-WINDOWS-SSH.sh
scripts/ops/setup/EXECUTAR-HOSTING-WINDOWS-SSH.sh
```

Criterio de cierre del wrapper mutante:

- `main-sync-status.json.ok = true`
- `main-sync-status.json.site_root_ok = true`
- `main-sync-status.json.served_site_root = C:\dev\pielarmonia-clean-main`
- `main-sync-status.json.current_commit = WINDOWS_EXPECTED_COMMIT`
- `main-sync-status.json.auth_contract_ok = true`
- `hosting-supervisor-status.json` presente
- `hosting-supervisor-status.json.supervisor_state = running | recovering`
- `http://127.0.0.1/admin-auth.php?action=status` con
  `mode=google_oauth` y `transport=web_broker`
- `https://pielarmonia.com/admin-auth.php?action=status` con
  `mode=google_oauth` y `transport=web_broker`
