# Estado Producto Operativo

Fuente canonica para el semaforo operativo del producto.
`ESTADO_PRODUCTO_OPERATIVO.md` en la raiz queda solo como shim compatible.

Actualizado: 2026-03-21

## Semaforo Producto

- Estado actual: `RED`
- Fuente diaria: `verification/runtime/prod-readiness-summary.md` + `verification/last-deploy-verify.json`
- Fuente de contrato operativo: `gate:prod:fast` + health/smoke en produccion.
- Agenda real: `calendarSource=google`, `calendarMode=live`.
- Bloqueadores activos conocidos al `2026-03-21`:
    - `operator-auth-status` y `admin-auth.php?action=status` responden `HTTP 502`.
    - `health`, `availability`, `booked-slots`, `figo-chat.php` y `figo-backend.php` fallan en verificaciones remotas del corte piloto.
    - `public_main_sync` sigue sin verificacion host-side concluyente y los workflows criticos del release continúan en `failure` o `skipped`.

## Regla de salida a piloto

- No recomendar piloto externo mientras `production_stability` o `release_readiness` sigan en `RED`.
- Si `verification/runtime/prod-readiness-summary.md` contradice este documento, prevalece la evidencia mas reciente.
- Mientras backend/auth/readiness sigan en rojo, congelar scope en `admin v3 + queue/turnero + auth/readiness/deploy` y no abrir `expansion`, `renewal` ni `executive review`.

## Ciclo de recuperacion 2026-03-21 -> 2026-04-20

- Plan canonico: `docs/FLOW_OS_RECOVERY_PLAN.md`
- Ritual diario canonico: `npm run flow-os:recovery:daily`
- Slice permitida: `admin v3 + queue/turnero + auth Google + readiness + deploy`
- Frentes aparcados: superficies nativas nuevas, expansion LeadOps, ampliacion de estados, rediseno grande de la web publica, nuevas lineas comerciales y cualquier trabajo multi-sede.
- Si el ritual diario o `verification/runtime/prod-readiness-summary.md` siguen en `RED`, no reabrir scope lateral aunque haya trabajo listo en otras superficies.

## Semaforo Agentes (referencial, no bloquea ciclo diurno)

- Fuente: `AGENT_BOARD.yaml` + workflows de orquestacion.
- Uso: coordinacion y trazabilidad.
- No define bloqueo diario de deploy.

## Regla de bloqueo diaria

Solo bloquea deploy diurno:

1. `verify` / `smoke` / contratos criticos en rojo.
2. health de backend en rojo.

No bloquea deploy diurno:

1. benchmark pesado nightly.
2. drift no critico fuera de backend.
