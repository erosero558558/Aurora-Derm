# Estado Producto Operativo

Fuente canonica para el semaforo operativo del producto.
`ESTADO_PRODUCTO_OPERATIVO.md` en la raiz queda solo como shim compatible.

Actualizado: 2026-03-17

## Semaforo Producto

- Estado actual: `GREEN`
- Fuente: `gate:prod:fast` + health/smoke en produccion.
- Agenda real: `calendarSource=google`, `calendarMode=live`.

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
