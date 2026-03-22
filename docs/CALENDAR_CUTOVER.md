# Cutover Agenda Real (Google Calendar OAuth)

Fuente canonica para el corte de agenda real a Google Calendar.
`CALENDAR-CUTOVER.md` en la raiz queda solo como shim compatible.

Fecha objetivo: cuando vayas a pasar de `store` a `google` en produccion.

## 1) Variables de servidor (env.php en hosting)

Configura:

```php
putenv('AURORADERM_AVAILABILITY_SOURCE=google');
putenv('AURORADERM_REQUIRE_GOOGLE_CALENDAR=true');
putenv('AURORADERM_CALENDAR_BLOCK_ON_FAILURE=true');
putenv('AURORADERM_CALENDAR_AUTH_MODE=oauth_refresh_token');

putenv('AURORADERM_GOOGLE_OAUTH_CLIENT_ID=...');
putenv('AURORADERM_GOOGLE_OAUTH_CLIENT_SECRET=...');
putenv('AURORADERM_GOOGLE_OAUTH_REFRESH_TOKEN=...');

putenv('AURORADERM_GOOGLE_CALENDAR_ID_ROSERO=...');
putenv('AURORADERM_GOOGLE_CALENDAR_ID_NARVAEZ=...');
putenv('AURORADERM_CALENDAR_TIMEZONE=America/Guayaquil');
putenv('AURORADERM_CALENDAR_CACHE_TTL_SEC=60');
```

Aliases transitorios que todavia deben quedar alineados si el hosting legacy los usa:

```php
putenv('PIELARMONIA_AVAILABILITY_SOURCE=google');
putenv('PIELARMONIA_REQUIRE_GOOGLE_CALENDAR=true');
```

Duraciones:

```php
putenv('AURORADERM_SERVICE_DURATION_MAP=consulta:30,telefono:30,video:30,acne:30,cancer:30,laser:60,rejuvenecimiento:60');
```

Nota de hardening:

- Con `AURORADERM_REQUIRE_GOOGLE_CALENDAR=true`, si por error el servidor queda en `source=store`, la API bloquea:
    - `GET availability` / `GET booked-slots` con `503 calendar_unreachable`
    - `POST appointments` / `PATCH reschedule` con `503 calendar_unreachable`
- Esto evita reservas falsas cuando el cutover no esta activo en Google.

## 2) Variables de GitHub Actions (repo variables)

Antes del corte:

- `REQUIRE_GOOGLE_CALENDAR=false`
- `PROD_MONITOR_ALLOW_STORE_CALENDAR=true` (opcional)
- Para validacion previa sin tocar vars globales: en `workflow_dispatch` usar `require_google_calendar=true` (Post-Deploy Gate / Production Monitor).

Al hacer corte:

- `REQUIRE_GOOGLE_CALENDAR=true`
- `PROD_MONITOR_ALLOW_STORE_CALENDAR=false`

Efecto:

- `post-deploy-gate` falla si `health.calendarSource != google`.
- `Production Monitor` deja de permitir `store` automaticamente.
- Hardening adicional: aunque `REQUIRE_GOOGLE_CALENDAR=false`, si `health.calendarRequired=true` el gate y monitor fuerzan validacion strict Google automaticamente.

## 3) Validacion tecnica

1. Manual:
    - `Actions -> Production Monitor` con defaults.
2. Contrato:
    - `Actions -> Post-Deploy Gate (Git Sync)` debe pasar.
    - Si aun no cambiaste vars globales, ejecutar manual con `require_google_calendar=true`.
3. Escritura real:
    - `Actions -> Calendar Write Smoke (Manual)` con `enable_write=true`.
    - Ese workflow ya corre en modo estricto Google (`TEST_REQUIRE_GOOGLE_CALENDAR=true`).

## 4) Criterio de aprobado

- `GET /api.php?resource=health`
    - `calendarSource=google`
    - `calendarReachable=true`
    - `calendarAuth=oauth_refresh`
    - `calendarTokenHealthy=true`
- `Post-Deploy Gate` en verde.
- `Production Monitor` en verde.
- `Calendar Write Smoke` en verde.

