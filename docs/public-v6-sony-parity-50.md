# Public V6 Sony Parity 50 (Strict)

Version: `v6-r2`  
Date: `2026-03-03`

## Objetivo

Cerrar paridad estructural/visual con Sony usando **50 puntos estrictos** con evidencia reproducible, sin validaciones subjetivas.

## Regla de evaluacion

- Punto obligatorio: `SP-001..SP-050`.
- Mapeo canonico: `SP-001 -> VC-01` ... `SP-050 -> VC-50`.
- Fuente de verdad de checks base: `verification/public-v6-audit/visual-contract.json`.
- Evidencia visual obligatoria por punto: `verification/public-v6-screenshots/*.png`.
- Resultado `PASS` solo si:
    - `passed >= 50`,
    - `missing_source_ids = 0`,
    - `missing_evidence_files = 0`.

## Bloques y referencias Sony

| Rango SP       | Rango VC     | Bloque                                        | Referencia Sony | Evidencia principal                              |
| -------------- | ------------ | --------------------------------------------- | --------------- | ------------------------------------------------ |
| SP-001..SP-015 | VC-01..VC-15 | Header + Mega + Drawer                        | A, D, E         | `home-es-desktop.png`                            |
| SP-016..SP-030 | VC-16..VC-30 | Hero 3 paneles + banda blur + controles       | A, C, E         | `home-es-desktop.png`                            |
| SP-031..SP-035 | VC-31..VC-35 | News strip bajo hero                          | A, B            | `home-es-desktop.png`                            |
| SP-036..SP-044 | VC-36..VC-44 | Editorial atmosferico + grid                  | B, C            | `home-es-desktop.png`, `home-es-mobile.png`      |
| SP-045..SP-050 | VC-45..VC-50 | Internas (breadcrumb, hero full-bleed, cards) | F, G            | `service-es-desktop.png`, `legal-es-desktop.png` |

## Comando canonico

```bash
npm run audit:public:v6:sony-parity
```

## Artefactos de salida

- `verification/public-v6-audit/sony-parity-50.json`
- `verification/public-v6-audit/sony-parity-50.md`

## Nota de trazabilidad

Cada fila de `sony-parity-50.md` incluye:

- ID del punto (`SP-*`),
- check fuente (`VC-*`),
- bloque,
- referencia Sony (A..G),
- path de evidencia,
- metrica observada (`source_meta`) cuando aplica.
