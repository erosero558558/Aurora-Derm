# Admin v3 Design Charter

## Objetivo

Definir la gramatica de `sony_v3` para que el admin comparta lenguaje con la home publica sin romper contratos ni velocidad operativa.

## Reglas de diseno

- Base clara-editorial por defecto.
- Carbon/negro solo para enfasis, hero y estados criticos.
- Sans-first para operacion. Sin copy de showcase dentro del admin.
- Una pregunta principal por viewport.
- Maximo una CTA primaria y dos secundarias visibles por pantalla.
- La barra de comando deja de competir en el layout y pasa a `Ctrl+K`.

## Zonas canonicas

1. `SectionHero`
2. `PriorityRail`
3. `Workbench`
4. `DetailRail` o `EvidenceRail`

## Pantallas fase 1

- Login
- Dashboard
- Citas
- Callbacks
- Reviews
- Disponibilidad

## Fuera de alcance de esta ola

- Rediseño total de `Turnero Sala`
- Cambios de backend de dominio, auth o contratos de negocio
- Reescritura del core admin existente

## Implementacion

- Boot canonico: `src/apps/admin/index.js -> src/apps/admin-v3/index.js`
- Shell propio: `src/apps/admin-v3/**`
- CSS dedicada: `admin-v3.css`
- Runtimes historicos preservados en `src/apps/archive/admin-legacy/**` y
  `src/apps/archive/admin-v2/**`

## Criterios de aceptacion

- `sony_v3` se siente parte del mismo sistema que la home publica.
- El primer viewport de cada seccion responde una sola pregunta operacional.
- La UI nueva reduce ruido visual sin perder accesos ni contratos.
- El rollback se resuelve por `revert + deploy`, no por variante runtime.
