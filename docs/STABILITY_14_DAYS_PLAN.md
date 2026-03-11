# Plan Estabilidad 14 Dias (Codex Directo)

Fuente canonica para la estrategia de estabilidad operativa de 14 dias.
`PLAN_ESTABILIDAD_14DIAS.md` en la raiz queda solo como shim compatible.

Fecha base: 2026-02-25
Objetivo: estabilidad operativa con ciclo diario de validacion <= 10 minutos.

## Semaforo Unico

- `GREEN`: `gate:prod:fast` en verde en `main`.
- `YELLOW`: fast en verde, pero nightly fallida en ultimas 24h.
- `RED`: fast fallida o contratos criticos caidos en produccion.

## Politica Diaria

1. Todo cambio normal en `main` usa `post-deploy-fast.yml`.
2. Todo cambio critico (`payments|auth|calendar|deploy|env|security`) exige:
    - `gate:prod:fast`
    - prueba critica del dominio tocado.
3. El benchmark pesado sale del ciclo diario y corre en nightly.

## Politica Nightly (23:00 America/Guayaquil)

Workflow: `.github/workflows/nightly-stability.yml`

Ejecuta:

- `npm run gate:prod` (full regression)
- `npm run test:critical:agenda`
- `npm run test:critical:funnel`
- `npm run test:critical:payments`

## Baseline tiempos (2026-02-25)

- `verify:prod`: 5.9s
- `smoke:prod`: 6.2s
- `gate:prod`: 62.5s
- `gate:prod:fast`: 13.3s

## KPIs de la ventana (2 semanas)

- Incidentes P1/P2 por semana (tendencia a la baja).
- MTTR < 4h.
- p95 cambio->validacion diaria <= 10 min.
- Nightly success rate >= 90%.
- Regresiones criticas no detectadas = 0.

## Definicion de terminado

1. 5 dias seguidos con fast lane <= 10 min.
2. 7 corridas nightly con >= 90% green.
3. MTTR medido por debajo de 4h en la ventana.
