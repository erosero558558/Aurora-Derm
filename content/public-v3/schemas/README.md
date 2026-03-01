# Public V3 Schemas

`schema-version.json` controls which schema version is requested by default and which fallback is allowed during migrations.

```json
{
    "active": "v2",
    "fallback": "v2",
    "allowFallback": false
}
```

Rules:

- `active`: primary schema version (for example `v2` during rollout).
- `fallback`: version used when an `active` schema file is missing and fallback is allowed.
- `allowFallback`: if `false`, missing files in `active` fail validation.

Current rollout:

- `v2` covers `navigation`, `home`, `hub`, `service`, `telemedicine`, `legal`, and `legal-page`.
- Default mode is strict (`allowFallback=false`) to prevent silent schema drift.

CLI overrides:

- `node bin/validate-public-v3-content.js --schema-version v2`
- `node bin/validate-public-v3-content.js --schema-version v2 --fallback-version v1`
- `node bin/validate-public-v3-content.js --schema-version v2 --no-fallback`
