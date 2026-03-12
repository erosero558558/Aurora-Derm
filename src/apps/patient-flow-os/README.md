# Patient Flow OS

Bootstrap source-only del núcleo operativo de `Patient Flow OS`.

## Qué incluye

- `packages/core`: contratos canónicos de patient cases, approvals, actions y Copilot.
- `packages/agent-runtime`: motor `decide/prepare` para el `PatientCase Copilot`.
- `apps/api`: repositorio bootstrap y servicio que une snapshot + runtime + review decisions.
- `apps/ops-console`: view-model de la case card de Ops con los cinco bloques fijos.

## Comandos

```bash
npm test
npm run build
```

## Filosofía

El primer release del copiloto no es un chat libre. Es un motor que responde:

- qué sigue
- por qué sigue eso
- qué riesgo hay si no se hace
- qué acción deja preparada
- qué gate humano aplica
