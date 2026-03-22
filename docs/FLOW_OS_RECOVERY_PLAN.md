# Flow OS Recovery Plan

Plan canonico del ciclo `2026-03-21 -> 2026-04-20`.

## Objetivo

Sacar `Flow OS` de estado `RED` y dejar la slice actual en condicion real de
recomendar piloto externo para `Aurora Derm`.

## Freeze duro

Slice permitida durante este ciclo:

- `admin v3`
- `queue/turnero`
- `auth Google`
- `readiness`
- `deploy`

Frentes aparcados:

- superficies nativas nuevas
- expansion LeadOps
- ampliacion de estados
- rediseno grande de la web publica
- nuevas lineas comerciales
- cualquier trabajo multi-sede

Mientras `docs/PRODUCT_OPERATIONAL_STATUS.md` o
`verification/runtime/prod-readiness-summary.md` sigan en `RED`, no reabrir
scope lateral.

## Ritual diario

1. `npm run flow-os:recovery:daily`
2. `npm run gate:admin:rollout:auth:node`
3. `npm run verify:prod:turnero:web-pilot`
4. `npm run monitor:prod`

El corte diario debe dejar evidencia en:

- `verification/runtime/flow-os-recovery-daily.json`
- `verification/runtime/prod-readiness-summary.json`
- `verification/runtime/prod-readiness-summary.md`
- `verification/last-admin-openclaw-auth-diagnostic.json`

## Checkpoints semanales

### Semana 1

- recuperar `operator-auth-status`
- recuperar `admin-auth.php?action=status`
- volver utiles `CI`, `Post-Deploy Gate`, `Deploy Hosting`, `Production Monitor`
- triar todas las issues `[ALERTA PROD]`

### Semana 2

- dejar en verde `health`, `availability`, `booked-slots`, `figo-chat.php`,
  `figo-backend.php`
- confirmar `calendarSource=google` + `calendarMode=live`
- cerrar gap minimo de observabilidad y evidencia Sentry

### Semana 3

- pasar `admin v3 + queue/turnero + auth Google` como una sola slice
- fijar gates obligatorios del admin y del piloto web por clinica
- bajar claims publicos que el runtime todavia no sostenga

### Semana 4

- completar dos corridas semanales consecutivas sin warnings criticos
- ejecutar go/no-go con evidencia
- habilitar piloto externo solo si `production_stability=GREEN` y
  `release_readiness=GREEN`

## Criterio de salida

El producto solo pasa a "recomendable para piloto" cuando coinciden:

- `docs/PRODUCT_OPERATIONAL_STATUS.md`
- `verification/runtime/prod-readiness-summary.md`
- gates del admin/Operator Auth
- verify/smoke/gate del piloto web por clinica
