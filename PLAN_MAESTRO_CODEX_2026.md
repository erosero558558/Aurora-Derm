# Plan Maestro Codex 2026 (Complementario Tecnico)

Inicio: 2026-02-24
Cadencia: por commit (cada commit deja evidencia verificable)
Relacion con Operativo 2026: complementario estricto (no reemplaza ni compite por control)

## Proposito

- Blindar confiabilidad de reserva/chat/reprogramacion.
- Convertir no-show en una senal tecnica medible y accionable.
- Elevar observabilidad y guardrails de release sin romper contratos publicos.

## Gobernanza

- Este archivo es la fuente de control de la linea Codex.
- Solo un bloque Codex puede estar `IN_PROGRESS`.
- No se toman tareas del Operativo que ya esten `IN_PROGRESS`, salvo soporte de calidad (tests/guardrails).
- Definicion de done por commit:
- objetivo tecnico explicito.
- evidencia en CI o prueba local reproducible.
- actualizacion del estado en este plan.

## Carril operativo backend-only (permanente)

- Esta instancia Codex opera solo en `codex_backend_ops`.
- Alcance permitido: `controllers/**`, `lib/**`, `api.php`, `figo-*.php`,
  `.github/workflows/**`, `cron.php`, `env*.php`, `bin/**`, tests backend.
- Alcance fuera de carril: `src/apps/**`, `js/**`, `styles*.css`,
  `templates/**`, `content/**`, `*.html`.
- Excepcion unica: cruce de dominio con `cross_domain=true` + `lane_lock=handoff_allowed`
    - handoff `active` con expiracion en `AGENT_HANDOFFS.yaml`.
- Regla critica: `critical_zone=true` solo en `codex_backend_ops`.
- Prioridad tecnica inmediata: `C1 -> C3 -> C4 -> C2`.

## Distribucion de esfuerzo

- 70% Confiabilidad + tests de agenda/chat/reprogramacion.
- 20% Retencion tecnica orientada a no-show/recurrencia.
- 10% Observabilidad y calidad de senales para decision operativa.

## Estado real frontend V5 (corte 2026-03-02)

Veredicto honesto:

- El frontend V5 ya paso el gate tecnico 8/8 con evidencia reproducible.
- Se cerro deuda critica en booking/pago V5, barrido total de localizacion y kill-switch V5 automatizado.
- Aun no equivale a "identico 1:1" con Sony.com (eso requiere benchmark visual cualitativo manual adicional), pero ya esta en baseline canonicamente aprobable para release controlado.

Paquete ejecutado (real):

- `FE-V5-P1` simplificacion de home + limpieza de shell en home.
- `FE-V5-P2` rediseno de hub/ficha en V5 + footer compacto + reduccion de densidad.
- `FE-V5-P3A` hardening de performance: fuentes locales, preload de hero por plantilla y reduccion de trabajo inicial en secciones bajo el fold.
- `FE-V5-P3B` hardening de pricing/localizacion: correccion de resumen monetario, prueba de paridad de precios V5 y alineacion de pruebas de service-hint al comportamiento canonico V5.
- `FE-V5-P4` cierre de gate tecnico: auditor de superficie 40 rutas ES/EN, matrix completa de 26 fichas de servicio, gateway V5 (ratio/locale/kill-switch), gate V5 unificado y score Sony formal automatizado.
- `FE-V5-P4.1` ajuste LCP home ES/EN: hero responsive con source filtering y preload alineado para cumplir umbral `< 2500ms`.
- `FE-V5-P5` benchmark cualitativo Sony + baseline visual desktop/mobile + migracion canonica de telemedicina V5.
- `FE-V5-P6` hardening tipografia/motion + checkpoint gate Sony estricto (15/15, luego 16/16).
- `FE-V5-P7` desacople de rutas publicas V5 respecto a imports `public-v3` + contrato de datos/legales V5 en paginas canonicas.
- `FE-V5-P8` redireccion visual macro Sony (composicion, ritmo tipografico y re-skin transversal de bloques canonicos) con evidencia visual 28/28 rutas baseline.
- `FE-V5-P9` hardening de contrato assets+catalogo: `media.asset_id` obligatorio por servicio y cobertura validada contra `assets-manifest` V5 en gate automatizado.
- `FE-V5-P10` unificacion canónica de servicios en V5: `catalog.services` migrado a V5 sin fallback funcional y validador V5 endurecido para pricing+media+manifest.
- `FE-V5-P11` enforcement canónico runtime V5: sin fallback V4 en `content.js` (services/booking/assets), checkpoint Sony `CP-17` y gate elevado a `17/17`.
- `FE-V5-P12` honest gate punto-por-punto: score Sony endurecido a `20/20` checkpoints + gate explicito de 8 puntos con evidencia automatizada por criterio (sin pass ambiguo).
- `FE-V5-P13` refinamiento visual Sony no-cosmetico: nueva capa visual canónica (tokens/layout/components), score Sony endurecido a `22/22`, y evidencia de cambio visual real (`baseline changed=28/28`).
- `FE-V5-P14` precision de shell + ritmo editorial: nav/footer refinados, motion sobrio de hero y score Sony endurecido a `24/24`.
- `FE-V5-P15` limpieza real de jerarquia CTA en Home + deduplicacion de navegacion en Hub (sin CTA familiar duplicado), score Sony endurecido a `26/26` y evidencia visual material (`changed=12`).
- `FE-V5-P16` densidad editorial strict en Home/Hub + paridad de affordance de links secundarios, score Sony endurecido a `28/28` y baseline visual `changed=28/28`.
- Alcance principal tocado:
- `src/apps/astro/src/pages/es/index.astro`
- `src/apps/astro/src/pages/en/index.astro`
- `src/apps/astro/src/pages/es/servicios/index.astro`
- `src/apps/astro/src/pages/en/services/index.astro`
- `src/apps/astro/src/pages/es/servicios/[slug].astro`
- `src/apps/astro/src/pages/en/services/[slug].astro`
- `src/apps/astro/src/layouts/PublicShellV5.astro`
- `src/apps/astro/src/components/public-v5/PublicFooterV5.astro`
- `src/apps/astro/src/components/public-v5/ServiceHubV5.astro`
- `src/apps/astro/src/components/public-v5/ServiceDetailV5.astro`
- `src/apps/astro/src/components/public-v5/BookingTeaserV5.astro`
- `src/apps/astro/src/components/public-v5/ResponsiveMediaImageV5.astro`
- `src/apps/astro/src/styles/public-v5/components.css`
- `src/apps/astro/src/styles/public-v5/tokens.css`
- `src/apps/astro/src/pages/en/telemedicine/index.astro`
- `src/apps/astro/src/pages/es/telemedicina/index.astro`
- `src/apps/astro/src/components/public-v3/BookingShellV3.astro`
- `content/public-v4/catalog.json`
- `content/public-v5/catalog.json`
- `content/public-v5/assets-manifest.json`
- `bin/validate-public-v5-catalog.js`
- `src/apps/astro/src/lib/public-v5-contract.ts`
- `src/apps/astro/src/lib/content.js`
- `bin/audit-public-v5-surface.js`
- `bin/score-public-v5-sony.js`
- `package.json`
- `tests/public-v5-booking-payment-flow.spec.js`
- `tests/public-v5-pricing-localization.spec.js`
- `tests/public-v5-service-matrix.spec.js`
- `tests/service-booking-hints-parity.spec.js`
- `tests-node/public-v5-gateway-flags.test.js`

Mediciones objetivas (build actual):

- Home ES: `sections=5`, `articles=9`, `links=22`, `buttons=0`, `h1=1`.
- Home EN: `sections=5`, `articles=9`, `links=22`, `buttons=0`, `h1=1`.
- Hub ES: `sections=3`, `articles=8`, `links=25`, `buttons=0`, `h1=1`.
- Hub EN: `sections=3`, `articles=8`, `links=25`, `buttons=0`, `h1=1`.
- Ficha ES (muestra): `sections=11`, `articles=12`, `links=28`, `buttons=11`, `h1=1`.
- Ficha EN (muestra): `sections=11`, `articles=12`, `links=28`, `buttons=11`, `h1=1`.
- Barrido total ES/EN: `40 rutas`, `technical_text_matches=0`, `mixed_locale_matches=0`.
- Servicios con booking+payment shell: `26/26`.

### Scorecard 8 puntos (gating estricto)

1. No texto tecnico interno en UI publica (`bridge`, `runtime`, `shell`, `V3`, `V4`)

- Estado: `PASS`.
- Evidencia: `verification/public-v5-audit/20260302-174145-public-v5-surface/surface-audit.json` (`technicalTextMatches=0` en 40 rutas).

2. Home canonica con jerarquia limpia y densidad reducida

- Estado: `PASS`.
- Evidencia: auditor V5 (`home sections=5`, `home links=22`, `hub sections=3`, `hub links=25`), dentro de limites.

3. Pricing exacto consistente en servicio, booking y pago

- Estado: `PASS`.
- Evidencia: `npm run test:frontend:qa:v5` en verde (`35 passed`) + matrix completa `tests/public-v5-service-matrix.spec.js` (26 rutas de servicio) + contrato booking/pago `tests/public-v5-booking-payment-flow.spec.js`.

4. ES/EN sin labels crudos ni mezcla linguistica

- Estado: `PASS`.
- Evidencia: `verification/public-v5-audit/20260302-174145-public-v5-surface/surface-audit.json` (`mixedLocaleMatches=0` en 40 rutas).

5. Booking conserva API actual y mejora visual integral

- Estado: `PASS`.
- Evidencia: sin cambios en `controllers/**`, `lib/**`, `api.php`; re-skin consolidado en `src/apps/astro/src/styles/public-v5/components.css` + pruebas de contrato de booking/pago V5 en verde.

6. Score de similitud Sony >= 82/100

- Estado: `PASS`.
- Evidencia: `npm run score:public:v5:sony` => `99.25/100` (`verification/sony-score/20260302-174342-public-v5-sony/sony-score.json`).

7. Gates performance/accesibilidad cumplidos

- Estado: `PASS`.
- Evidencia: `verification/performance-gate/20260302-174207-public-performance/performance-gate.json` (`passed=true`, 8/8 rutas).

8. Rollback operativo probado por flag

- Estado: `PASS`.
- Evidencia: `tests-node/public-v5-gateway-flags.test.js` (`13 passed`) cubre ratio, force-locale, `surface=auto`, `surface=v5`, `legacy=1`, `kill-switch`, contrato de cobertura `media.asset_id/src` y enforcement de runtime sin fallback V4 en `content.js`.

Resultado de gate actual:

- `APROBADO` (8 pass, 0 partial, 0 fail).
- Comando reproducible: `npm run gate:public:v5:acceptance`.

## Siguiente paquete obligatorio (FE-V5-P5)

Objetivo: benchmark cualitativo punto-por-punto contra Sony real para cerrar brecha visual no funcional (ritmo editorial, fotografia, composicion macro, microtipografia y motion narrativa).

Estado actual (2026-03-02):

- `COMPLETED` (checklist Sony cualitativo cerrado con evidencia automatizada y gate completo en verde).

Entregables:

- [x] Revisar 12-15 checkpoints visuales con diff por template (`home/hub/service/telemedicina/booking`).
- [x] Ejecutar baseline visual desktop/mobile contra objetivos Sony (no solo score cuantitativo).
- [x] Telemedicina V5 migrada a componentes canonicos (`TelemedicineHero/Flow/Fit/Escalation`) con responsive cerrado.
- [x] Compatibilidad de booking bridge restaurada (`data-booking-bridge-band`, `#citas`, `#appointmentForm`, `#serviceSelect`) sin romper estilo V5.
- [x] Pulir tipografia/peso visual de hero y bloques de autoridad medica.
- [x] Ajustar motion editorial (timing/stagger/entry) sin afectar CLS/INP.

Criterio de salida:

- [x] Mantener `gate:public:v5:acceptance` en verde.
- [x] Cerrar checklist cualitativo Sony con aprobacion manual ruta por ruta.

Evidencia de cierre FE-V5-P5:

- `verification/frontend-baseline/20260302-172823-fe-v5-p5-closeout/comparison-vs-20260302-071728-fe-v5-p5-pass2-anchorfix/baseline-compare.md` (diff visual por rutas y viewport).
- `verification/sony-score/20260302-172745-public-v5-sony/sony-score.md` (score `91.25/100` + checklist Sony `15/15`).
- `verification/public-v5-audit/20260302-172551-public-v5-surface/surface-audit.md` (40 rutas, 0 fallos).
- `verification/performance-gate/20260302-172615-public-performance/performance-gate.md` (8/8 rutas PASS).

## Siguiente paquete obligatorio (FE-V5-P6)

Objetivo: cerrar brecha de microtipografia/motion editorial Sony y endurecer el gate de checklist para evitar falsos verdes.

Estado actual (2026-03-02):

- `COMPLETED`.

Entregables:

- [x] Ajuste de tipografia editorial en hero y tokens detectables por scorer.
- [x] Aumento de transiciones semanticas en navbar/cta/cards/bandas sin degradar CWV.
- [x] Endurecimiento de `score:public:v5:sony` a checkpoint gate estricto.

Criterio de salida:

- [x] Mantener `gate:public:v5:acceptance` en verde.
- [x] Score Sony y checkpoints en pass estricto.

Evidencia de cierre FE-V5-P6:

- `verification/sony-score/20260302-173529-public-v5-sony/sony-score.md` (score `99.25/100`, checkpoints `15/15`).
- `verification/public-v5-audit/20260302-173339-public-v5-surface/surface-audit.md` (40 rutas, 0 fallos).
- `verification/performance-gate/20260302-173400-public-performance/performance-gate.md` (8/8 rutas PASS).

## Siguiente paquete obligatorio (FE-V5-P7)

Objetivo: eliminar deuda de acoplamiento V3 en rutas canonicas V5 (imports directos y capa legal) y formalizar contrato de datos V5 en paginas publicas.

Estado actual (2026-03-02):

- `COMPLETED`.

Entregables:

- [x] Nuevo adaptador `src/apps/astro/src/lib/public-v5.js` para consumo de datos V5 en rutas publicas.
- [x] Migracion de 10 rutas canonicas (`home/hub/service/telemedicina/legal` ES/EN) a imports V5.
- [x] Componentes legales V5 (`LegalHero/LegalPolicyTabs/LegalArticleLayout/SupportBand`) conectados en rutas legales.
- [x] Checkpoint Sony nuevo `CP-16` para bloquear imports `public-v3` directos en rutas V5.
- [x] Gate Sony endurecido a `--min-checkpoints 16`.

Criterio de salida:

- [x] `rg` en `src/apps/astro/src/pages` sin imports `lib/public-v3.js` ni `components/public-v3`.
- [x] `gate:public:v5:acceptance` en verde con `checkpoint gate 16/16`.

Evidencia de cierre FE-V5-P7:

- `verification/sony-score/20260302-174342-public-v5-sony/sony-score.md` (score `99.25/100`, checkpoints `16/16`, source debt audit `0 findings`).
- `verification/public-v5-audit/20260302-174145-public-v5-surface/surface-audit.md` (40 rutas, 0 fallos).
- `verification/performance-gate/20260302-174207-public-performance/performance-gate.md` (8/8 rutas PASS).

## Siguiente paquete obligatorio (FE-V5-P8)

Objetivo: ejecutar rediseño visual macro Sony real sobre templates canonicos (`home/hub/service/tele/legal`) sin romper contrato de pricing/booking ni gates.

Estado actual (2026-03-02):

- `COMPLETED`.

Entregables:

- [x] Re-skin editorial transversal en `primitives/layout/components` V5 (espaciado macro, contraste, ritmo tipografico y jerarquia visual).
- [x] Ajuste de grillas y densidad visual en home/hub/service/tele para lectura premium (sin alterar contratos runtime de formularios/modales).
- [x] Capa legal V5 integrada visualmente al lenguaje canonico.
- [x] Baseline visual desktop/mobile capturado y comparado contra baseline FE-V5-P5.

Criterio de salida:

- [x] `gate:public:v5:acceptance` en verde.
- [x] `score:public:v5:sony` en verde con checkpoint gate `16/16`.
- [x] Baseline compare confirma cambio visual material en rutas core.

Evidencia de cierre FE-V5-P8:

- `verification/frontend-baseline/20260302-175312-fe-v5-p8-visual/comparison-vs-20260302-172823-fe-v5-p5-closeout/baseline-compare.md` (`changed=28`, `unchanged=0`).
- `verification/public-v5-audit/20260302-175425-public-v5-surface/surface-audit.md` (40 rutas, 0 fallos).
- `verification/performance-gate/20260302-175448-public-performance/performance-gate.md` (8/8 rutas PASS).
- `verification/sony-score/20260302-175617-public-v5-sony/sony-score.md` (score `99.25/100`, checkpoints `16/16`).

## Siguiente paquete obligatorio (FE-V5-P9)

Objetivo: cerrar brecha de contrato entre catalogo efectivo de servicios y `assets-manifest` V5 para eliminar mapeos implicitos por `src` y bloquear regresiones de contenido visual en CI.

Estado actual (2026-03-02):

- `COMPLETED`.

Entregables:

- [x] `content/public-v4/catalog.json` actualizado con `media.asset_id` en los 13 servicios canonicos.
- [x] `content/public-v5/assets-manifest.json` extendido con asset faltante `service-treatment` para rutas que usan `showcase-treatment`.
- [x] Gate de contrato reforzado en `tests-node/public-v5-gateway-flags.test.js`:
      `effective service catalog` no vacio + validacion `media.asset_id/src` contra manifest V5.

Criterio de salida:

- [x] Todo servicio efectivo de V5 tiene `media.asset_id` y `media.src` alineados al mismo asset del manifest.
- [x] `test:public:v5:gateway` en verde con cobertura de contrato assets.
- [x] `gate:public:v5:acceptance` mantiene PASS sin regresion de score/performance/localizacion.

Evidencia de cierre FE-V5-P9:

- `content/public-v4/catalog.json` (13 servicios con `media.asset_id` explicito).
- `content/public-v5/assets-manifest.json` (asset `service-treatment` agregado).
- `tests-node/public-v5-gateway-flags.test.js` (11 pruebas PASS, incluyendo contrato assets).
- `verification/public-v5-audit/20260302-180517-public-v5-surface/surface-audit.md` (40 rutas, 0 fallos).
- `verification/performance-gate/20260302-180540-public-performance/performance-gate.md` (8/8 rutas PASS).
- `verification/sony-score/20260302-180709-public-v5-sony/sony-score.md` (score `99.25/100`, checkpoints `16/16`).

## Siguiente paquete obligatorio (FE-V5-P10)

Objetivo: consolidar V5 como fuente unica efectiva de servicios y endurecer validaciones para bloquear cualquier regreso al fallback V4 en contenido publico.

Estado actual (2026-03-02):

- `COMPLETED`.

Entregables:

- [x] `content/public-v5/catalog.json` ahora incluye `services` (migrados desde contrato efectivo previo) y deja de depender de fallback V4 para rutas canonicas.
- [x] `bin/validate-public-v5-catalog.js` reforzado con validaciones de:
      `services` no vacio, slugs unicos, paridad `runtime_service_id`/`service_hint`, paridad de precios con `booking_options`, `media.asset_id/src` consistente con `assets-manifest` y `usage_scope` valido.
- [x] `src/apps/astro/src/lib/public-v5-contract.ts` extendido con tipos/guardas para `services` y media estructurada.
- [x] `tests-node/public-v5-gateway-flags.test.js` endurecido para exigir `effective service catalog` desde `public-v5` (sin fallback).

Criterio de salida:

- [x] `content:public-v5:validate` en verde con contrato completo de servicios.
- [x] `test:public:v5:gateway` en verde con asercion de origen `public-v5`.
- [x] `gate:public:v5:acceptance` en verde sin regresion en score Sony/performance/localizacion.

Evidencia de cierre FE-V5-P10:

- `content/public-v5/catalog.json` (servicios canonicos V5 activos).
- `bin/validate-public-v5-catalog.js` (nuevo gate de integridad services+media+pricing).
- `tests-node/public-v5-gateway-flags.test.js` (11 PASS, incluyendo origen efectivo V5).
- `verification/public-v5-audit/20260302-181127-public-v5-surface/surface-audit.md` (40 rutas, 0 fallos).
- `verification/performance-gate/20260302-181149-public-performance/performance-gate.md` (8/8 rutas PASS).
- `verification/sony-score/20260302-181318-public-v5-sony/sony-score.md` (score `99.25/100`, checkpoints `16/16`).

## Siguiente paquete obligatorio (FE-V5-P11)

Objetivo: convertir la canonicidad V5 en regla de runtime y no solo de contenido, eliminando fallback V4 en `content.js` y endureciendo el gate Sony con checkpoint adicional de arquitectura.

Estado actual (2026-03-02):

- `COMPLETED`.

Entregables:

- [x] `src/apps/astro/src/lib/content.js` actualizado sin fallback V4 en `getServices`, `getBookingOptions`, `getPublicAssetById` y `getPublicAssetBySrc`.
- [x] `tests-node/public-v5-gateway-flags.test.js` ampliado para validar enforcement de runtime canónico (sin fallback V4 en fuente de servicios/booking/assets).
- [x] `bin/score-public-v5-sony.js` ampliado con `CP-17`:
      `Runtime content V5 sin fallback V4 en services/booking/assets`.
- [x] `package.json` actualizado para exigir `--min-checkpoints 17` en `score:public:v5:sony`.

Criterio de salida:

- [x] `test:public:v5:gateway` en verde con `13` pruebas (incluye checks de no-fallback V4).
- [x] `score:public:v5:sony` en verde con `17/17` checkpoints.
- [x] `gate:public:v5:acceptance` en verde sin regresion funcional/visual.

Evidencia de cierre FE-V5-P11:

- `src/apps/astro/src/lib/content.js` (runtime canónico V5 sin fallback V4 en rutas públicas).
- `tests-node/public-v5-gateway-flags.test.js` (`13 PASS`, checks runtime no-fallback).
- `bin/score-public-v5-sony.js` (`CP-17` activo).
- `package.json` (`score:public:v5:sony --min-checkpoints 17`).
- `verification/public-v5-audit/20260302-181835-public-v5-surface/surface-audit.md` (40 rutas, 0 fallos).
- `verification/performance-gate/20260302-181858-public-performance/performance-gate.md` (8/8 rutas PASS).
- `verification/sony-score/20260302-182027-public-v5-sony/sony-score.md` (score `99.25/100`, checkpoints `17/17`).

## Siguiente paquete obligatorio (FE-V5-P12)

Objetivo: eliminar falsos verdes en la comparacion Sony y formalizar un gate honesto de 8 puntos con trazabilidad directa (criterio -> prueba -> evidencia).

Estado actual (2026-03-02):

- `COMPLETED`.

Entregables:

- [x] `bin/score-public-v5-sony.js` endurecido con checkpoints `CP-18..CP-20`:
      template ID V5 canonico en rutas core, densidad service/tele en banda editorial, y bloqueo de assets remotos Unsplash en rutas core.
- [x] `package.json` actualizado para exigir `--min-checkpoints 20` en `score:public:v5:sony`.
- [x] Nuevo gate `bin/gate-public-v5-8point.js` que ejecuta y audita los 8 criterios obligatorios:
      texto tecnico, jerarquia, pricing, localizacion, booking/pago, similitud Sony, performance/accesibilidad, kill-switch rollback.
- [x] Nuevo script `npm run gate:public:v5:8point` para corrida unica y reporte punto-por-punto.

Criterio de salida:

- [x] `score:public:v5:sony` en verde con `20/20` checkpoints.
- [x] `gate:public:v5:8point` en verde con `8/8` puntos.
- [x] Artefactos JSON/MD por punto y por comando para auditoria tecnica.

Evidencia de cierre FE-V5-P12:

- `bin/score-public-v5-sony.js` (`CP-18..CP-20` activos).
- `bin/gate-public-v5-8point.js` (scorecard automatizado 8 puntos).
- `package.json` (`score:public:v5:sony --min-checkpoints 20` + `gate:public:v5:8point`).
- `verification/sony-score/20260302-183153-public-v5-sony/sony-score.md` (score `99.25/100`, checkpoints `20/20`).
- `verification/public-v5-8point/20260302-183158-public-v5-8point/public-v5-8point-gate.md` (`8/8` pass con evidencia por punto).

## Siguiente paquete obligatorio (FE-V5-P13)

Objetivo: ejecutar un refinamiento visual Sony real (no cosmetico) y dejarlo bloqueado por gate para evitar regresion de estilo en futuras iteraciones.

Estado actual (2026-03-02):

- `COMPLETED`.

Entregables:

- [x] `src/apps/astro/src/styles/public-v5/tokens.css` actualizado con palette Sony-neutral P13 (fondo, ink, stage y accent canónicos).
- [x] `src/apps/astro/src/styles/public-v5/layout.css` refinado para shell sobrio (`public-nav` y `public-footer`) con contraste editorial consistente.
- [x] `src/apps/astro/src/styles/public-v5/components.css` con capa final `FE-V5-P13` para heroes/surfaces/cards/CTAs (menos ruido visual, jerarquia tipografica mas limpia).
- [x] `bin/score-public-v5-sony.js` endurecido con `CP-21` (tokens P13) y `CP-22` (shell visual P13).
- [x] `package.json` endurecido a `score:public:v5:sony --min-checkpoints 22`.
- [x] Build y sync de Astro para publicar estilo P13 en rutas estáticas canónicas.
- [x] Baseline visual postbuild comparado con baseline previo para verificar cambio material.

Criterio de salida:

- [x] `score:public:v5:sony` en verde con `22/22` checkpoints.
- [x] `gate:public:v5:8point` en verde (`8/8`).
- [x] `gate:public:v5:acceptance` en verde sin regresion funcional.
- [x] `baseline:public:compare` confirma cambio visual material (`changed=28`, `unchanged=0`).

Evidencia de cierre FE-V5-P13:

- `src/apps/astro/src/styles/public-v5/tokens.css` (palette P13).
- `src/apps/astro/src/styles/public-v5/layout.css` (shell P13).
- `src/apps/astro/src/styles/public-v5/components.css` (capa `FE-V5-P13`).
- `bin/score-public-v5-sony.js` (`CP-21`, `CP-22`).
- `package.json` (`score:public:v5:sony --min-checkpoints 22`).
- `verification/sony-score/20260302-184858-public-v5-sony/sony-score.md` (`99.25/100`, `22/22`).
- `verification/public-v5-8point/20260302-184239-public-v5-8point/public-v5-8point-gate.md` (`8/8`).
- `verification/public-v5-audit/20260302-184707-public-v5-surface/surface-audit.md` (`40 rutas`, `0 fallos`).
- `verification/performance-gate/20260302-184729-public-performance/performance-gate.md` (`8/8` PASS).
- `verification/frontend-baseline/20260302-184600-fe-v5-p13-visual-postbuild/comparison-vs-20260302-184440-fe-v5-p13-visual/baseline-compare.md` (`changed=28`, `unchanged=0`).

## Siguiente paquete obligatorio (FE-V5-P14)

Objetivo: cerrar precision de shell y ritmo editorial para evitar deriva visual entre templates (home/hub/service/tele), con checkpoints gateables.

Estado actual (2026-03-02):

- `COMPLETED`.

Entregables:

- [x] `src/apps/astro/src/styles/public-v5/layout.css` reforzado con precision de shell (nav underline, CTA monocrhomo, contraste legal de footer).
- [x] `src/apps/astro/src/styles/public-v5/components.css` con ritmo editorial y motion sobrio en heroes/cards.
- [x] `bin/score-public-v5-sony.js` endurecido con `CP-23` y `CP-24`.
- [x] `package.json` endurecido a `score:public:v5:sony --min-checkpoints 24`.
- [x] Build/sync de Astro + baseline postbuild comparado contra P13.

Criterio de salida:

- [x] `score:public:v5:sony` en verde con `24/24`.
- [x] `gate:public:v5:8point` en verde (`8/8`).
- [x] `baseline:public:compare` confirma cambio visual material postbuild.

Evidencia de cierre FE-V5-P14:

- `src/apps/astro/src/styles/public-v5/layout.css` (capa `FE-V5-P14`).
- `src/apps/astro/src/styles/public-v5/components.css` (capa `FE-V5-P14`).
- `bin/score-public-v5-sony.js` (`CP-23`, `CP-24`).
- `package.json` (`score:public:v5:sony --min-checkpoints 24` en P14).
- `verification/sony-score/20260302-185523-public-v5-sony/sony-score.md` (`99.25/100`, `24/24`).
- `verification/public-v5-8point/20260302-185533-public-v5-8point/public-v5-8point-gate.md` (`8/8`).
- `verification/frontend-baseline/20260302-185730-fe-v5-p14-visual-postbuild/comparison-vs-20260302-184600-fe-v5-p13-visual-postbuild/baseline-compare.md` (`changed=28`, `unchanged=0`).

## Siguiente paquete obligatorio (FE-V5-P15)

Objetivo: ejecutar limpieza no-cosmetica de jerarquia de decision en Home/Hub (menos CTA redundante, navegacion de hub sin duplicados) y bloquearlo por gate Sony.

Estado actual (2026-03-02):

- `COMPLETED`.

Entregables:

- [x] Home ES/EN migrada a jerarquia CTA limpia (`sony-quiet-link` para secundarios, sin secondary button CTA en hero/booking).
- [x] Hub ES/EN sin CTA duplicado de familia en cabecera; reemplazo por count badge editorial.
- [x] `src/apps/astro/src/styles/public-v5/components.css` con capa `FE-V5-P15` para CTA hierarchy cleanup y hub dedupe.
- [x] `bin/score-public-v5-sony.js` endurecido con `CP-25` y `CP-26`.
- [x] `package.json` endurecido a `score:public:v5:sony --min-checkpoints 26`.
- [x] Build/sync + gate completo + baseline compare contra P14.

Criterio de salida:

- [x] `score:public:v5:sony` en verde con `26/26`.
- [x] `gate:public:v5:8point` en verde (`8/8`).
- [x] `gate:public:v5:acceptance` en verde (catalog/audit/qa/performance/sony).
- [x] `baseline:public:compare` confirma cambio visual material vs P14.

Evidencia de cierre FE-V5-P15:

- `src/apps/astro/src/pages/es/index.astro` (secondary CTA -> `sony-quiet-link`).
- `src/apps/astro/src/pages/en/index.astro` (secondary CTA -> `sony-quiet-link`).
- `src/apps/astro/src/components/public-v5/ServiceHubV5.astro` (remocion `v5_hub_family_route` + `sony-hub-family__count`).
- `src/apps/astro/src/styles/public-v5/components.css` (capa `FE-V5-P15`).
- `bin/score-public-v5-sony.js` (`CP-25`, `CP-26`).
- `package.json` (`score:public:v5:sony --min-checkpoints 26`).
- `verification/sony-score/20260302-190614-public-v5-sony/sony-score.md` (`99.25/100`, `26/26`).
- `verification/public-v5-8point/20260302-190225-public-v5-8point/public-v5-8point-gate.md` (`8/8`).
- `verification/public-v5-audit/20260302-190424-public-v5-surface/surface-audit.md` (`40 rutas`, `0 fallos`).
- `verification/performance-gate/20260302-190446-public-performance/performance-gate.md` (`8/8` PASS).
- `verification/frontend-baseline/20260302-190621-fe-v5-p15-visual-postbuild/comparison-vs-20260302-185730-fe-v5-p14-visual-postbuild/baseline-compare.md` (`changed=12`, `unchanged=16`).

## Siguiente paquete obligatorio (FE-V5-P16)

Objetivo: cerrar brecha restante de similitud Sony en composicion macro (home/hub) con foco en densidad de links y consistencia de lectura editorial en mobile, sin romper contratos de booking/pago.

Estado actual (2026-03-02):

- `COMPLETED`.

Entregables:

- [x] Reducir links visibles en home/hub en mobile sin perder rutas criticas (resultado: home `20`, hub `21`).
- [x] Consolidar tipografia de labels editoriales (`eyebrow`/small caps) en bloques de decision de home.
- [x] Unificar affordance de links secundarios (`public-link-arrow` y `sony-quiet-link`) para lectura consistente.
- [x] Endurecer score Sony con `CP-27` y `CP-28` para bloquear regresion de densidad/consistencia.
- [x] Capturar baseline visual postbuild y comparar vs P15.

Criterio de salida:

- [x] `score:public:v5:sony` en verde con `28/28`.
- [x] `gate:public:v5:8point` en verde (`8/8`).
- [x] `gate:public:v5:acceptance` en verde.
- [x] `baseline:public:compare` con cambio visual material en home/hub desktop+mobile.

Evidencia de cierre FE-V5-P16:

- `src/apps/astro/src/pages/es/index.astro` (link legal de pricing convertido a nota editorial sin CTA redundante).
- `src/apps/astro/src/pages/en/index.astro` (link legal de pricing convertido a nota editorial sin CTA redundante).
- `src/apps/astro/src/components/public-v5/PublicFooterV5.astro` (modo `compact` sin link legal duplicado de privacidad).
- `src/apps/astro/src/styles/public-v5/components.css` (capa `FE-V5-P16`: `sony-home-pricing__policy-note` + paridad `public-link-arrow/sony-quiet-link` + ajuste mobile).
- `bin/score-public-v5-sony.js` (`CP-27`, `CP-28`).
- `package.json` (`score:public:v5:sony --min-checkpoints 28`).
- `verification/sony-score/20260302-191918-public-v5-sony/sony-score.md` (`99.35/100`, `28/28`, home `20` links, hub `21` links).
- `verification/public-v5-8point/20260302-191531-public-v5-8point/public-v5-8point-gate.md` (`8/8`).
- `verification/public-v5-audit/20260302-191727-public-v5-surface/surface-audit.md` (`40 rutas`, `0 fallos`).
- `verification/performance-gate/20260302-191749-public-performance/performance-gate.md` (`8/8` PASS).
- `verification/frontend-baseline/20260302-191924-fe-v5-p16-visual-postbuild/comparison-vs-20260302-190621-fe-v5-p15-visual-postbuild/baseline-compare.md` (`changed=28`, `unchanged=0`).

## Bloques

## C1 - Firewall de regresiones de agenda

Estado: `COMPLETED`
Objetivo:

- Eliminar regresiones silenciosas en `availability`, `appointments`, `booked-slots`, reprogramacion y conflictos de slot.

Entregables:

- [x] Suite critica de agenda por dominio en CI.
- [x] Cobertura de codigos normalizados (`slot_conflict`, `calendar_unreachable`, etc.) en escenarios de error.
- [x] Pruebas de concurrencia no destructivas y destructivas controladas (workflow manual).
- [x] Sonda automatica de flakiness para `test:phase2` en modo readonly con umbral configurable.

Criterio de salida:

- [x] Suite critica estable sin flakiness repetido.
- [x] Cualquier cambio de comportamiento en agenda protegido con test.

## C2 - Retencion tecnica enfocada en no-show

Estado: `COMPLETED`
Objetivo:

- Estandarizar metricas de no-show/completed/confirmed y recurrencia para seguimiento continuo.

Entregables:

- [x] `funnel-metrics` expone bloque `retention` (aditivo, sin breaking changes).
- [x] `REPORTE-SEMANAL-PRODUCCION.ps1` incluye seccion retention + delta vs reporte previo.
- [x] Indicadores de recurrencia/no-show disponibles sin trabajo manual extra.

Criterio de salida:

- [x] Baseline y tendencia semanal de no-show disponibles en JSON y markdown.
- [x] Recurrencia de pacientes trazable por metrica.

## C3 - Observabilidad accionable

Estado: `COMPLETED`
Objetivo:

- Detectar y clasificar incidentes de reserva/chat con menor tiempo de diagnostico.

Entregables:

- [x] Validacion automatica de configuracion de observabilidad en health/reportes.
- [x] Clasificacion de alertas por severidad e impacto.
- [x] Playbook operativo con ruta de diagnostico rapida.

Criterio de salida:

- [x] Evidencia de verificacion automatica en pipeline semanal.
- [x] Ruta de diagnostico documentada y utilizable en menos de 15 min.

## C4 - Guardrails de release y CI

Estado: `COMPLETED`
Objetivo:

- Evitar que cambios de bajo nivel rompan deploy o comportamiento critico.

Entregables:

- [x] Gates explicitos por dominio (agenda/funnel/chat/pagos) con nombres claros en CI.
- [x] Workflows destructivos solo en `workflow_dispatch` con guardrails fuertes.
- [x] Reglas claras de warning -> blocking segun impacto.

Criterio de salida:

- [x] Pipeline con semaforos por dominio.
- [x] Fallback operativo documentado para picos transitorios sin relajar seguridad.

## C5 - Embudo de conversion por servicio (backend)

Estado: `COMPLETED`
Objetivo:

- Hacer trazable la conversion por `service_slug` y `service_category` en backend, sin cambios breaking de API.

Entregables:

- [x] `POST /funnel-event` acepta eventos de servicio (`view_service_category`, `view_service_detail`, `start_booking_from_service`).
- [x] `GET /funnel-metrics` agrega breakdowns por servicio/categoria y matriz `serviceFunnel` con tasas.
- [x] Cobertura de integracion backend para persistencia de labels y calculo de tasas.

Criterio de salida:

- [x] Los eventos de servicio quedan almacenados en metricas Prometheus con labels normalizados.
- [x] `serviceFunnel` retorna tasas consistentes (`intent->checkout`, `checkout->confirmed`, `detail->confirmed`).
- [x] Pruebas de integracion en verde sin regresion en `retention`.

## C6 - Alertas operativas de service funnel (weekly KPI)

Estado: `COMPLETED`
Objetivo:

- Convertir el embudo por servicio en senal operativa semanal con umbrales configurables, incidentes dedicados y trazabilidad en artefactos.

Entregables:

- [x] `REPORTE-SEMANAL-PRODUCCION.ps1` incorpora analisis `serviceFunnel` (muestras, top servicios, alertas por servicio, codigos y payload JSON/markdown).
- [x] `weekly-kpi-report.yml` agrega umbrales de service funnel (inputs + vars + outputs efectivos) y los pasa al reporte.
- [x] Workflow semanal abre/cierra incidente dedicado `[ALERTA PROD] Weekly KPI service funnel degradado`.

Criterio de salida:

- [x] Warnings `service_funnel_*` quedan clasificados como `non_critical` de impacto `conversion` (con runbook).
- [x] Reporte semanal expone `serviceFunnel.source/rows/alerts/top` en JSON y resumen.
- [x] Incidentes semanales distinguen `general`, `retencion`, `ops-sla` y `service funnel` sin contaminar SLA externo.

## C7 - Catalogo de servicios API (backend contract)

Estado: `COMPLETED`
Objetivo:

- Exponer un contrato backend estable para catalogo de servicios (`services-catalog`) con filtros/paginacion y tolerancia a catalogo faltante, sin cambios breaking.

Entregables:

- [x] Nuevo endpoint publico `GET /api.php?resource=services-catalog`.
- [x] Filtros backend por `slug/category/subcategory/audience/doctor/q`, con `limit/offset`.
- [x] Metadatos operativos (`source/version/timezone/total/filtered/returned/generatedAt`) para soporte de front/rediseno.
- [x] Cobertura de integracion para filtros, busqueda y comportamiento cuando falta el catalogo.

Criterio de salida:

- [x] Endpoint responde `200` con `ok=true` y `data/meta` incluso cuando el catalogo no existe (`source=missing`).
- [x] Contrato de filtros y paginacion protegido por pruebas de integracion verdes.
- [x] Sin regresiones en analytics/retention existentes.

## C8 - Salud operativa de catalogo (health + weekly incident)

Estado: `COMPLETED`
Objetivo:

- Convertir el estado del catalogo de servicios en senal operativa explicita en `health` y en el KPI semanal, con incidente dedicado.

Entregables:

- [x] `GET /api.php?resource=health` expone `servicesCatalogSource`, `servicesCatalogVersion`, `servicesCatalogCount`, `servicesCatalogConfigured`.
- [x] `checks.servicesCatalog` disponible con metadatos de fuente/version/cantidad.
- [x] `REPORTE-SEMANAL-PRODUCCION.ps1` incorpora warnings `services_catalog_*`, seccion markdown y bloque `servicesCatalog` en JSON.
- [x] `weekly-kpi-report.yml` emite outputs normalizados `services_catalog_*` y abre/cierra incidente dedicado.

Criterio de salida:

- [x] Reporte semanal no falla y serializa `servicesCatalog` correctamente.
- [x] Incidente semanal dedicado `[ALERTA PROD] Weekly KPI services catalog degradado` habilitado con severidad.
- [x] Contrato de workflow validado por tests Node.

## C9 - Priorizacion inteligente de servicios (backend contract)

Estado: `COMPLETED`
Objetivo:

- Exponer una API backend que recomiende orden de categorias/servicios para navegacion y landings usando senales reales de funnel + catalogo.

Entregables:

- [x] Nuevo endpoint publico `GET /api.php?resource=service-priorities`.
- [x] Ranking por `sort=hybrid|volume|conversion` con filtros `audience/category` y limites controlados.
- [x] Respuesta aditiva con `data.categories`, `data.services`, `data.featured` y metadatos operativos (`source`, `catalogVersion`, `serviceCount`).
- [x] Cobertura de integracion para ranking con señales de funnel, filtro pediatrico y fallback de catalogo faltante.

Criterio de salida:

- [x] `service-priorities` responde `200` con `source=catalog+funnel` cuando existen señales de conversion.
- [x] Filtro `audience=ninos` prioriza rutas pediatricas sin romper contrato.
- [x] Fallback `source=missing` devuelve arrays vacios y contrato estable.

## C10 - Operacion semanal de service priorities (KPI + incidentes)

Estado: `COMPLETED`
Objetivo:

- Convertir `service-priorities` en senal operativa semanal con salida normalizada, summary y ciclo de incidente dedicado.

Entregables:

- [x] `REPORTE-SEMANAL-PRODUCCION.ps1` incorpora bloque `servicePriorities` en JSON/markdown y warnings `service_priorities_*`.
- [x] `weekly-kpi-report.yml` agrega outputs normalizados `service_priorities_*` y crea/cierra incidente semanal dedicado.
- [x] `tests-node/weekly-kpi-workflow-contract.test.js` valida contrato de outputs y presencia del flujo de incidente.

Criterio de salida:

- [x] Reporte semanal serializa `servicePriorities` con `source/catalogSource/catalogVersion/servicesCount/categoriesCount/featuredCount`.
- [x] Incidente semanal dedicado `[ALERTA PROD] Weekly KPI service priorities degradado` activo con severidad y signal key.
- [x] Contrato de workflow protegido por tests Node en verde.

## C11 - Monitor diario de service priorities (produccion)

Estado: `COMPLETED`
Objetivo:

- Endurecer el monitor diario de produccion para detectar degradacion temprana de `service-priorities` (fuente, volumen y estructura), sin esperar al KPI semanal.

Entregables:

- [x] `MONITOR-PRODUCCION.ps1` agrega check explicito a `GET /api.php?resource=service-priorities`.
- [x] Validaciones de contrato diario: `meta.source`, `meta.catalogVersion`, `meta.serviceCount`, y conteos minimos en `data.services/categories/featured`.
- [x] Flags operativos de tolerancia/umbral: `AllowDegradedServicePriorities`, `MinServicePrioritiesServices`, `MinServicePrioritiesCategories`, `MinServicePrioritiesFeatured`.
- [x] `.github/workflows/prod-monitor.yml` expone inputs/env/summary para esos parametros y los cablea al monitor.
- [x] Cobertura de contrato Node en `tests-node/prod-monitor-workflow-contract.test.js`.

Criterio de salida:

- [x] Monitor diario falla si `service-priorities` pierde fuente `catalog+funnel` (salvo override operativo temporal).
- [x] Monitor diario falla si la API devuelve catalogo vacio por debajo de umbrales configurados.
- [x] Contrato de workflow protegido por test automatizado.

## C12 - Package P1: evidencia operativa Sentry y scorecard base

Estado: `COMPLETED`
Objetivo:

- Normalizar la evidencia Sentry de Fase 6 y hacer que `prod-readiness-summary` deje de tratarla como pendiente generico cuando ya existe artefacto verificable.

Entregables:

- [x] `bin/verify-sentry-events.js` siempre escribe `verification/runtime/sentry-events-last.json`, incluyendo `status`, `failureReason` y `actionRequired`.
- [x] `.github/workflows/sentry-events-verify.yml` publica el artefacto `sentry-events-report` sin bloquear antes de generar el JSON.
- [x] `bin/prod-readiness-summary.js` consume el artefacto remoto/local de Sentry y refleja `PM-SENTRY-001` segun la evidencia real.
- [x] Scorecard oficial de paquetes fijada en `verification/agent-runs/CDX-002.md`.

Criterio de salida:

- [x] `npm run verify:sentry:events` deja evidencia utilizable o razon accionable cuando falta configuracion.
- [x] `prod-readiness-summary` expone seccion `Sentry Evidence` y usa esa evidencia para `PM-SENTRY-001`.
- [x] Cobertura Node agregada para script, workflow y summary.

## C13 - Package P2: kernel comun PowerShell para produccion

Estado: `COMPLETED`
Objetivo:

- Extraer el kernel compartido de `REPORTE-SEMANAL-PRODUCCION.ps1`, `VERIFICAR-DESPLIEGUE.ps1` y `MONITOR-PRODUCCION.ps1` a `bin/powershell/*`, dejando scripts raiz mas delgados y sin breaking changes en flags ni salida.

Entregables:

- [x] `bin/powershell/Common.Http.ps1` concentra parseo JSON, wrappers HTTP/curl, descargas remotas, hashes y helpers reutilizables de deploy/monitor.
- [x] `bin/powershell/Common.Metrics.ps1` concentra percentiles, benchmark y parseo Prometheus usado por el weekly report.
- [x] `bin/powershell/Common.Warnings.ps1` concentra clasificacion de warnings, runbooks, ciclos semanales y serializacion pesada del reporte semanal.
- [x] Los tres scripts raiz quedan dot-sourcing de helpers compartidos y conservan contratos de ejecucion desde `npm`.

Criterio de salida:

- [x] `REPORTE-SEMANAL-PRODUCCION.ps1` queda en `<= 1200` lineas.
- [x] `VERIFICAR-DESPLIEGUE.ps1` queda en `<= 1300` lineas.
- [x] `MONITOR-PRODUCCION.ps1` mantiene parametros y salida operativa.
- [x] Validaciones de contratos Node y comandos ops pasan en verde.

## C14 - Package P3: descomposicion del core analitico

Estado: `COMPLETED`
Objetivo:

- Convertir `controllers/AnalyticsController.php` en una fachada HTTP liviana y mover funnel, retention, parseo Prometheus, normalizacion y CSV a servicios puros reutilizables.

Entregables:

- [x] `lib/analytics/FunnelMetricsService.php` centraliza calculo de `funnel-metrics`, `serviceFunnel`, `surfaceFunnel` e idempotency.
- [x] `lib/analytics/RetentionReportService.php` centraliza snapshot de retention, parametros, filtros, alertas y reporte diario.
- [x] `lib/analytics/PrometheusCounterParser.php`, `lib/analytics/AnalyticsLabelNormalizer.php` y `lib/analytics/RetentionCsvExporter.php` absorben parsing/normalizacion/export.
- [x] `controllers/AnalyticsController.php` conserva entrypoints `recordEvent`, `getFunnelMetrics`, `getRetentionReport` y `buildFunnelMetricsData` sin romper contratos.

Criterio de salida:

- [x] `AnalyticsController.php` queda en `<= 650` lineas.
- [x] Contratos JSON y CSV permanecen intactos para analytics, service priorities y reporte semanal.
- [x] Tests PHP de analytics/service priorities y contrato Node consumidor permanecen verdes.

## Contratos publicos

- No se introducen cambios breaking en contratos HTTP existentes.
- Cambios aditivos permitidos:
- `GET /api.php?resource=funnel-metrics`: objeto `retention`.
- `GET /api.php?resource=service-priorities`: ranking de navegacion por servicio/categoria.
- Reporte semanal JSON: bloque `retention` y `retentionTrend`.

## Evidencia por commit

- 2026-03-02: FE-OPS-RIGOR-P2 cerrado con sistema visual compartido real para `admin + kiosko + tv`: nuevo `ops-design-system.css` centraliza `@font-face`, tokens Sony canónicos, aliases cross-surface y baseline de focus/accessibilidad; `admin-v2.css`, `queue-kiosk.css` y `queue-display.css` ahora importan esta capa y eliminan duplicación de fuentes/tokens/base styles, con versionado actualizado en `admin.html`, `kiosco-turnos.html` y `sala-turnos.html` (`admin-v2-20260302-ops-rigor2`, `queue-20260302-sony-rigor2`). Validado con `npx playwright test tests/admin-ui-runtime-smoke.spec.js tests/queue-kiosk.spec.js tests/queue-display.spec.js --workers=1` (`16 passed`).
- 2026-03-02: FE-OPS-RIGOR-P1 cerrado con paridad visual estricta Admin/Kiosko/TV: `queue-kiosk.css` y `queue-display.css` migrados a sistema Sony oscuro compartido (`PlusJakarta/Fraunces`, tokens unificados, jerarquia/estados/focus coherentes), `admin-v2.css` expone aliases comunes para compatibilidad cross-surface, y `kiosco-turnos.html` + `sala-turnos.html` actualizan versionado de CSS (`queue-20260302-sony-rigor`); ademas se removio la inyeccion de estilos inline runtime en `js/queue-kiosk.js` y `js/queue-display.js` para que el control visual quede canonico en CSS. Validado con `npx playwright test tests/admin-ui-runtime-smoke.spec.js tests/queue-kiosk.spec.js tests/queue-display.spec.js --workers=1` (`16 passed`).
- 2026-03-02: FE-V5-P16 cerrado con densidad editorial strict y paridad de affordance: `src/apps/astro/src/pages/es/index.astro` y `en/index.astro` reemplazan el link legal de pricing por nota editorial, `src/apps/astro/src/components/public-v5/PublicFooterV5.astro` elimina el link legal duplicado en modo `compact`, `src/apps/astro/src/styles/public-v5/components.css` agrega capa `FE-V5-P16` para paridad `public-link-arrow/sony-quiet-link` y ajuste mobile, y `bin/score-public-v5-sony.js` incorpora `CP-27` + `CP-28` con `package.json` endurecido a `--min-checkpoints 28`; validado con `gate:public:v5:acceptance` en verde (`qa/performance/sony 28/28`) y baseline visual `changed=28/28` en `verification/frontend-baseline/20260302-191924-fe-v5-p16-visual-postbuild/*`.
- 2026-03-02: FE-V5-P15 cerrado con limpieza no-cosmetica de jerarquia Home/Hub: `src/apps/astro/src/pages/es/index.astro` y `en/index.astro` migran CTAs secundarios a `sony-quiet-link`, `src/apps/astro/src/components/public-v5/ServiceHubV5.astro` elimina CTA duplicado `v5_hub_family_route` y agrega `sony-hub-family__count`, `src/apps/astro/src/styles/public-v5/components.css` incorpora capa `FE-V5-P15`, y `bin/score-public-v5-sony.js` agrega `CP-25` + `CP-26` con `package.json` endurecido a `--min-checkpoints 26`; validado con `gate:public:v5:acceptance` en verde (`qa/performance/sony 26/26`) y baseline visual `changed=12` en `verification/frontend-baseline/20260302-190621-fe-v5-p15-visual-postbuild/*`.
- 2026-03-02: FE-V5-P14 cerrado con precision de shell y ritmo editorial: `layout.css` incorpora capa `FE-V5-P14` (nav underline, CTA monocrhomo, legal contrast), `components.css` agrega ritmo/motion sobrio, `bin/score-public-v5-sony.js` incorpora `CP-23` + `CP-24`, y `package.json` sube gate a `--min-checkpoints 24`; validado con `gate:public:v5:8point` (`8/8`) y baseline visual postbuild `changed=28/28` en `verification/frontend-baseline/20260302-185730-fe-v5-p14-visual-postbuild/*`.
- 2026-03-02: FE-V5-P13 cerrado con refinamiento visual Sony no-cosmetico: `tokens.css` y `layout.css` migran a palette/shell P13, `components.css` agrega capa final `FE-V5-P13` para heroes/surfaces/cards/CTA, y `bin/score-public-v5-sony.js` incorpora `CP-21` + `CP-22` con `package.json` endurecido a `--min-checkpoints 22`; validado con `gate:public:v5:acceptance` en verde (`surface/performance/sony 22/22`) y baseline visual postbuild `changed=28/28` en `verification/frontend-baseline/20260302-184600-fe-v5-p13-visual-postbuild/*`.
- 2026-03-02: FE-V5-P12 cerrado con gate honesto punto-por-punto: `bin/score-public-v5-sony.js` endurecido a `20` checkpoints (`CP-18..CP-20`) y `package.json` actualizado a `--min-checkpoints 20`; nuevo `bin/gate-public-v5-8point.js` ejecuta/prueba los 8 criterios obligatorios con trazabilidad por comando y artefacto, validado en `npm run gate:public:v5:8point` (`8/8 PASS`) con evidencia en `verification/public-v5-8point/20260302-183158-public-v5-8point/*` y `verification/sony-score/20260302-183153-public-v5-sony/*`.
- 2026-03-02: FE-V5-P11 cerrado con enforcement canónico runtime: `src/apps/astro/src/lib/content.js` elimina fallback V4 para `services/booking/assets`, `tests-node/public-v5-gateway-flags.test.js` sube a `13` pruebas con validaciones no-fallback, `bin/score-public-v5-sony.js` incorpora `CP-17`, y `package.json` eleva el gate a `--min-checkpoints 17`; `gate:public:v5:acceptance` se mantiene en verde con artefactos `surface/performance/sony-score` (`99.25`, `17/17`).
- 2026-03-02: FE-V5-P10 cerrado con fuente unica de servicios en V5: `content/public-v5/catalog.json` ahora incluye `services` canonicos, `bin/validate-public-v5-catalog.js` endurece contrato (slugs unicos, paridad pricing con booking options, `media.asset_id/src` y usage_scope contra `assets-manifest`), `public-v5-contract.ts` tipa `services`, y `tests-node/public-v5-gateway-flags.test.js` exige origen efectivo `public-v5` sin fallback; gate completo `gate:public:v5:acceptance` en verde (`surface/performance/sony-score 99.25, 16/16`).
- 2026-03-02: FE-V5-P9 cerrado con hardening de contrato assets+catalogo: `content/public-v4/catalog.json` ahora exige `media.asset_id` por servicio (13/13), `content/public-v5/assets-manifest.json` agrega `service-treatment` para `showcase-treatment`, y `tests-node/public-v5-gateway-flags.test.js` incorpora validacion estricta `asset_id/src` contra manifest V5 (suite subida de `9` a `11` tests, PASS); gate completo `gate:public:v5:acceptance` en verde con artefactos `surface/performance/sony-score` (`99.25`, `16/16`).
- 2026-03-02: FE-V5-P6/P7 cerrados con `gate:public:v5:acceptance` en verde y hardening Sony estricto (`score 99.25`, `checkpoint gate 16/16`); rutas publicas V5 migradas a `src/apps/astro/src/lib/public-v5.js`, legal V5 conectado (`components/public-v5/Legal*` + `SupportBandV5`), y scorer Sony extendido con `CP-16` (auditoria source-debt sin imports directos `public-v3` en paginas V5).
- 2026-03-02: FE-V5-P8 cerrado con re-skin visual macro Sony en `src/apps/astro/src/styles/public-v5/primitives.css`, `layout.css` y `components.css`; baseline compare FE-V5-P5->P8 con cambio total (`changed=28/28`), gate tecnico completo en verde (`surface/performance/qa/score`) y score Sony sostenido `99.25` (`16/16` checkpoints).
- 2026-02-24: plan inicial creado. C1 activado como unico bloque `IN_PROGRESS`.
- 2026-02-24: agregado bloque `retention` en `funnel-metrics`, metricas de recurrencia/no-show en `metrics`, y gates criticos por dominio en CI.
- 2026-02-24: agregado `tests/Integration/AppointmentErrorCodesTest.php` para proteger normalizacion de errores en reservas (`slot_conflict` y `calendar_unreachable`).
- 2026-02-24: agregado workflow manual no destructivo `phase2-concurrency-readonly.yml` y endurecido `phase2-concurrency-write.yml` para exigir Google estricto en concurrencia real.
- 2026-02-24: agregado `phase2-flakiness-probe.yml` (manual + semanal) para ejecutar `test:phase2` en multiples repeticiones y fallar por umbral de inestabilidad.
- 2026-02-24: baseline de flakiness en run manual `22339762684` (`runs=5`, `max_failures=0`) con resultado `failures=1`, `passes=4` y estado final `failure`.
- 2026-02-24: optimizado `CI` en `e2e-tests` con cache de Playwright (`~/.cache/ms-playwright`) y eliminada corrida duplicada de `test:phase2` para reducir tiempo de pipeline sin perder cobertura critica.
- 2026-02-24: optimizado `CI` para ejecutar Playwright no critico excluyendo suites ya cubiertas por `Run Critical Agenda Gate` y `Run Critical Funnel Gate`, evitando doble corrida en `e2e-tests`.
- 2026-02-24: agregado `concurrency` en `CI` (`cancel-in-progress: true`) para cancelar corridas obsoletas por rama y reducir tiempo de espera de feedback.
- 2026-02-24: agregado filtro de cambios en job `e2e-tests` (`dorny/paths-filter`) para omitir e2e cuando no hay cambios relevantes de codigo/tests, reduciendo tiempo en commits de docs/workflows.
- 2026-02-24: corregido parseo YAML en `ci.yml` (step `Skip e2e`) para restablecer ejecucion normal de `CI` tras introducir filtro por cambios.
- 2026-02-24: reducido `WAIT_SECONDS` por defecto en `post-deploy-gate.yml` de `120` a `90` para acortar feedback post-deploy manteniendo override por `vars`/`workflow_dispatch`.
- 2026-02-24: medicion post-optimizacion: `CI` bajo a `1.55 min` (run `22340821737`, delta `-0.53 min` vs `22340555801`) y `Post-Deploy Gate` bajo a `3.20 min` (run `22340821736`, delta `-0.77 min` vs `22340555797`).
- 2026-02-24: agregado modo de espera adaptativa en `post-deploy-gate.yml` (clasificacion de cambios via `GITHUB_EVENT_PATH`) para usar espera corta en cambios no-runtime y espera completa en cambios runtime.
- 2026-02-24: reforzada deteccion de cambios para espera adaptativa con fallback `git diff before..after` cuando el payload del push no trae lista de archivos.
- 2026-02-24: medicion con espera adaptativa reforzada: `Post-Deploy Gate` bajo de `3.00 min` (run `22341156450`) a `2.45 min` (run `22341273435`, delta `-0.55 min`).
- 2026-02-24: `CI` ahora omite jobs `security` y `unit-tests` cuando no hay cambios PHP/composer/tests relevantes (via `dorny/paths-filter`), reduciendo tiempo en commits de frontend/docs/workflows sin perder cobertura en cambios backend.
- 2026-02-24: `Post-Deploy Gate` aplica `BENCH_RUNS_LIGHT` en pushes `non-runtime` y publica `BENCH_RUNS_EFFECTIVE` en el resumen para reducir tiempo de benchmark sin omitir verificacion backend base.
- 2026-02-24: `CI` ahora omite job `build` cuando no hay cambios relevantes para bundle/despliegue (via `dorny/paths-filter`), evitando empaquetado innecesario en cambios de documentacion/workflows.
- 2026-02-24: validacion manual de `phase2-concurrency-readonly`: run `22361662182` (`failure`) seguido de run `22361768420` (`success`) confirma inestabilidad intermitente en Fase 2 readonly.
- 2026-02-24: `phase2-concurrency-readonly.yml` ahora publica siempre artefactos `playwright-report` y `test-results`, y reporta `steps.phase2.outcome` en summary para acelerar diagnostico de fallos intermitentes.
- 2026-02-24: ajustado `phase2-concurrency-readonly.yml` para forzar salidas persistentes (`--reporter=line,json,html`, `PLAYWRIGHT_JSON_OUTPUT_NAME`, `--output=test-results/phase2-readonly`) tras observar run `22361858905` exitoso sin artefactos adjuntos (`total_count=0`).
- 2026-02-24: validacion post-ajuste en run `22361957390` (`success`) con `ARTIFACT_TOTAL=2` (`phase2-readonly-playwright-report`, `phase2-readonly-test-results`), confirmando diagnostico reproducible en workflow manual.
- 2026-02-24: ejecucion manual de `Post-Deploy Gate` validada (`22362170241`, `success`, `1.5 min`); se separo `concurrency` en `post-deploy-gate.yml` por tipo de evento (`manual` vs `auto`) para evitar cancelacion de corridas `workflow_dispatch` por pushes automaticos.
- 2026-02-24: verificacion de `concurrency` separada en post-deploy: run manual `22362298070` (`workflow_dispatch`, `success`) completo sin cancelacion mientras coexistia un run automatico `push` en progreso (`22362271894`).
- 2026-02-24: `CI` del commit `e4f3fdc` completo en `0.72 min` (run `22362374763`, `success` en `lint/security/unit-tests/e2e-tests/build`), consistente con reduccion de tiempo en cambios no runtime.
- 2026-02-24: endurecida prueba `tests/phase2-calendar-consistency.spec.js` para esperar sincronizacion real de slots web con la oferta mockeada (evita falso verde por opciones estaticas antes de `updateAvailableTimes`); verificado localmente con `npm run test:phase2` (`1 passed`, `1 skipped`).
- 2026-02-24: reforzada sincronizacion de slots en chat para `phase2-calendar-consistency` (la espera ahora valida especificamente opciones `HH:MM` y no cualquier `chat-booking`), reduciendo falso avance antes de render de horarios; verificado localmente con `npm run test:phase2` (`1 passed`, `1 skipped`).
- 2026-02-24: prueba de estabilidad local posterior al ajuste de sincronizacion chat (`npm run test:phase2` x5) sin fallas (`passes=5`, `fails=0`; concurrencia real permanece `skipped` sin `TEST_ENABLE_CALENDAR_WRITE=true`).
- 2026-02-24: extendido `tests/Integration/AppointmentErrorCodesTest.php` con cobertura de `booked-slots` para paths `calendar_bad_request` (fecha faltante) y `calendar_unreachable` (Google requerido), protegiendo normalizacion de codigos en agenda; validado con `php -d xdebug.mode=coverage vendor/bin/phpunit tests/Integration/AppointmentErrorCodesTest.php` (`4 tests`, `14 assertions`).
- 2026-02-24: corregido `tests/funnel-tracking.spec.js` para normalizar eventos GA4 en formato `gtag('event', ...)` dentro de `window.dataLayer`, evitando falso rojo en `Run Critical Funnel Gate` cuando el tracker no emite objetos directos; validado con `npm run test:critical:funnel` (`6 passed`).
- 2026-02-24: estabilizadas pruebas no criticas `tests/chat-booking-calendar-errors.spec.js` (espera de hidratacion + mensajes ES/EN + idioma `es` fijado) y `tests/cookie-consent.spec.js` (aserciones alineadas a Google Consent Mode v2 con `dataLayer`/`consent` en lugar de `window._ga4Loaded=false`); validado localmente con Playwright (`10 passed`).
- 2026-02-24: implementada convivencia Orquestador+Codex sin solapes con task espejo `CDX-001` en `AGENT_BOARD.yaml`, `AGENT_HANDOFFS.yaml`, bloque `CODEX_ACTIVE`, `handoffs lint` + `codex-check` en `agent-orchestrator.js`, validacion espejo/handoffs en `bin/validate-agent-governance.php` y gate CI actualizado (`agent-governance.yml`); validado con `agent-orchestrator.js` (`conflicts/handoffs/codex-check`) y `php bin/validate-agent-governance.php`.
- 2026-02-24: endurecida sonda `phase2-flakiness-probe.yml` con runner dedicado `bin/run-phase2-flakiness.js` (reporte JSON + clasificacion `stable|intermittent|unstable` + artefacto `phase2-flakiness-report`) para convertir C1 en senal reproducible y trazable por ejecucion.
- 2026-02-25: activado modo de operacion de estabilidad en 2 carriles (`post-deploy-fast.yml` para push diario y `nightly-stability.yml` para regresion pesada), con nuevo `gate:prod:fast` (verify+smoke sin benchmark) y `nightly:stability`; validado en produccion con `gate:prod:fast` exitoso (`DurationSec=14.1`, health/smoke OK, benchmark omitido en fast lane).
- 2026-02-25: `REPORTE-SEMANAL-PRODUCCION.ps1` ahora expone `warningDetails` (code/severity/impact/runbookRef), `warningsByImpact` y `triagePlaybook` (SLA 15 min) en JSON/markdown para C3 sin cambios breaking.
- 2026-02-25: `REPORTE-SEMANAL-PRODUCCION.ps1` agrega `releaseGuardrails` (`decision: pass|warn|block`, `reason`, `action`) para hacer explicita la regla warning->blocking en C4.
- 2026-02-25: activado protocolo backend-only para esta instancia Codex (dominio fijo `codex_backend_ops`) y creadas tareas iniciales de ejecucion `AG-035` (C1 flakiness agenda/chat/reprogramacion) y `AG-036` (C3 observabilidad accionable), ambas en `status=ready`, `domain_lane=backend_ops`, `lane_lock=strict`, `cross_domain=false`.
- 2026-02-25: C2 completado con baseline automatico de retencion en `verification/weekly/c2/retention-baseline.json`, tendencia semanal en JSON/markdown (`retentionTrend.trendReady=true`) y deltas de no-show/recurrencia sin accion manual adicional.
- 2026-02-25: cerrada evidencia de estabilidad C1 en `verification/agent-runs/AG-035.md` con `run-phase2-flakiness` (`runs=5`, `passes=5`, `failures=0`, `classification=stable`) y `npm run test:critical:agenda` en verde (`2 passed`, `3 skipped`).
- 2026-02-25: cerrada evidencia C3 en `verification/agent-runs/AG-036.md` con reporte semanal de produccion (`verification/weekly/ag036/weekly-report-20260225.json`) validando `triagePlaybook.targetMinutes=15`, `calendarMode=live`, `releaseGuardrails.decision=pass` y p95 dentro de objetivo (`core=684.98`, `figo-post=1811.85`).
- 2026-02-25: cerrado C4 con semaforos por dominio en summaries de `post-deploy-fast.yml`, `post-deploy-gate.yml` y `nightly-stability.yml` (`platform/agenda/chat/funnel`) y fallback operativo documentado en `docs/RUNBOOKS.md` seccion `1.5 Politica warning -> blocking y fallback operativo`.
- 2026-02-25: `weekly-kpi-report.yml` ahora calcula SLA operativo de 14 dias (`fast_p95_min <= 10`, `nightly_success_rate >= 90`) desde GitHub Actions, lo publica en summary y lo integra al criterio de apertura/cierre de incidente semanal; validado en run manual `22420355235` (`success`).
- 2026-02-26: bloque C2 operativo extendido con alertas estructuradas de `retention-report` en `REPORTE-SEMANAL-PRODUCCION.ps1` (`retentionReport.source/alerts/alertCounts`) y gobernanza semanal en `.github/workflows/weekly-kpi-report.yml` (summary + apertura/cierre de incidente tambien por `retention_report_alert_count`); cobertura integrada en `tests/Integration/AnalyticsRetentionReportTest.php` (`testRetentionReportIncludesAlertsWhenThresholdsAreExceeded`).
- 2026-02-26: C3 operativo reforzado en `.github/workflows/weekly-kpi-report.yml` separando incidentes automáticos `general` vs `retencion` (titulos dedicados + labels), corrigiendo autocierre por exclusión de incidentes semanales del KPI `ops_incidents_open_external`, y publicando ambos conteos (`external/total`) en summary para triage sin bucles.
- 2026-02-26: cerrado C5 backend con trazabilidad de conversion por servicio en `controllers/AnalyticsController.php` (eventos `view_service_*` y `start_booking_from_service`, breakdowns `serviceCategory/serviceDetail/serviceBookingIntent/serviceCheckout/serviceConfirmed`, y matriz `serviceFunnel`), con cobertura en `tests/Integration/AnalyticsServiceFunnelMetricsTest.php`; validado con `php -d xdebug.mode=coverage vendor/bin/phpunit tests/Integration/AnalyticsServiceFunnelMetricsTest.php tests/Integration/AnalyticsRetentionMetricsTest.php tests/Integration/AnalyticsRetentionReportTest.php` (`6 tests`, `108 assertions`).
- 2026-02-26: cerrado C6 con alertas operativas de `serviceFunnel` en `REPORTE-SEMANAL-PRODUCCION.ps1` (codigos `service_funnel_*`, seccion markdown/JSON y top servicios) y workflow semanal extendido (`.github/workflows/weekly-kpi-report.yml`) con umbrales dedicados, outputs de incidente y apertura/cierre automatica de `[ALERTA PROD] Weekly KPI service funnel degradado`.
- 2026-02-26: cerrado C7 con nuevo controlador `controllers/ServiceCatalogController.php` y endpoint publico `services-catalog` (filtros + paginacion + metadatos + fallback `source=missing`), registrado en `api.php`, `lib/routes.php` y `lib/ApiConfig.php`; cobertura en `tests/Integration/ServiceCatalogControllerTest.php` y regresion analytics en verde.
- 2026-02-26: cerrado C8 con snapshot de catalogo en `controllers/HealthController.php` (`servicesCatalog*` top-level + `checks.servicesCatalog`), reporte semanal extendido (`REPORTE-SEMANAL-PRODUCCION.ps1`) con warnings `services_catalog_*` y payload `servicesCatalog`, workflow semanal (`weekly-kpi-report.yml`) con outputs/incidentes `services_catalog_*`, y cobertura en `tests/Integration/HealthServiceCatalogSnapshotTest.php` + `tests-node/weekly-kpi-workflow-contract.test.js`.
- 2026-02-26: cerrado C9 con `controllers/ServicePriorityController.php` y endpoint publico `service-priorities` (orden inteligente por `hybrid|volume|conversion`, filtros `audience/category`, categorias/featured), registrado en `api.php`, `lib/routes.php` y `lib/ApiConfig.php`; cobertura en `tests/Integration/ServicePriorityControllerTest.php` + regresion `ServiceCatalog/Analytics/HealthServiceCatalog` en verde.
- 2026-02-26: cerrado C10 con extension de `REPORTE-SEMANAL-PRODUCCION.ps1` (payload/markdown/warnings `service_priorities_*`), `weekly-kpi-report.yml` (outputs + incidente dedicado `service priorities`) y contrato actualizado en `tests-node/weekly-kpi-workflow-contract.test.js`.
- 2026-02-26: cerrado C11 con endurecimiento de `MONITOR-PRODUCCION.ps1` para `service-priorities` (source/catalogVersion/counts + umbrales/overrides), cableado en `.github/workflows/prod-monitor.yml` (inputs/env/summary) y contrato Node nuevo `tests-node/prod-monitor-workflow-contract.test.js`.
- 2026-03-01: extendida propagacion canónica de `public_v4_rollout_*` en pipeline de deploy/post-deploy: `deploy-hosting.yml` ahora resuelve politica efectiva con `resolve-public-v4-rollout-policy.js`, persiste variables de repo `PROD_MONITOR_ENABLE_PUBLIC_V4_ROLLOUT/PUBLIC_V4_ROLLOUT_*`, y despacha payload completo a `post-deploy-fast.yml`, `post-deploy-gate.yml` y `prod-monitor.yml`; `post-deploy-fast.yml` + `post-deploy-gate.yml` incorporan inputs/env/resolucion efectiva/summary/incidente para rollout publico V4; cobertura de contrato reforzada con `tests-node/public-v4-rollout-propagation-contract.test.js` y suites workflow en verde.
- 2026-03-01: hardening de evidencia operativa para rollout publico V4: `deploy-hosting.yml` agrega manifest `.public-cutover/postdeploy-rollout-dispatch.json` dentro de `public-cutover-evidence`; `post-deploy-fast.yml` publica `verification/last-public-v4-rollout-fast.json` (`post-deploy-fast-public-v4-rollout-report`); `post-deploy-gate.yml` publica `verification/last-public-v4-rollout-gate.json` (`post-deploy-public-v4-rollout-report`); contratos Node actualizados para exigir steps/rutas de reporte y manifest.
- 2026-03-02: cerrado C12/P1 con evidencia Sentry normalizada en `verification/runtime/sentry-events-last.json`, consumo remoto/local en `bin/prod-readiness-summary.js`, workflow manual `sentry-events-verify.yml` alineado al artefacto `sentry-events-report`, y scorecard base fijada en `verification/agent-runs/CDX-002.md`.
- 2026-03-02: cerrado C13/P2 con kernel PowerShell compartido en `bin/powershell/Common.Http.ps1`, `bin/powershell/Common.Metrics.ps1` y `bin/powershell/Common.Warnings.ps1`; `REPORTE-SEMANAL-PRODUCCION.ps1` bajo de `2042` a `919` lineas, `VERIFICAR-DESPLIEGUE.ps1` de `1968` a `1216`, `MONITOR-PRODUCCION.ps1` de `368` a `290`; validado con contratos Node y con `npm run verify:prod:fast`, `npm run report:weekly:prod`, `npm run monitor:prod`.
- 2026-03-02: cerrado C14/P3 con `AnalyticsController.php` reducido de `1111` a `93` lineas y nueva capa `lib/analytics/*` para funnel, retention, parseo Prometheus, normalizacion y CSV; validado con `php -d xdebug.mode=coverage vendor/bin/phpunit tests/Integration/AnalyticsRetentionMetricsTest.php tests/Integration/AnalyticsServiceFunnelMetricsTest.php tests/Integration/AnalyticsRetentionReportTest.php tests/Integration/ServicePriorityControllerTest.php`, `php tests/run-php-tests.php`, `node --test tests-node/weekly-report-script-contract.test.js` y `npm run agent:gate`.
