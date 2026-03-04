# Public V6 Visual Contract (Sony-Guided, Strict)

Version: `v6-r2`
Date: `2026-03-03`
Reference pack: `docs/reference/sony-captures/*`

## Scope

Contrato estricto para `/es/` y `/en/` con extensiones a hub/service/tele/legal.

## Scoring rule

- 1 punto por checkpoint cumplido.
- `pass` requiere `>= 96/96` checkpoints obligatorios.
- Auditoria automatica: `bin/audit-public-v6-visual-contract.js`.

## 96 Checkpoints

| ID    | Bloque          | Criterio estricto                                                         | Evidencia |
| ----- | --------------- | ------------------------------------------------------------------------- | --------- |
| VC-01 | Header          | Existe `data-v6-header` en home ES                                        | A,D       |
| VC-02 | Header          | Fondo header negro (`rgb <= 16`)                                          | A,D,F,G   |
| VC-03 | Header          | Altura header desktop entre 68px y 96px                                   | A,F,G     |
| VC-04 | Header          | Logo tipografico en mayusculas visible                                    | A,F,G     |
| VC-05 | Header          | Navegacion primaria con >= 7 items desktop                                | A,F,G     |
| VC-06 | Header          | Item de contacto visible en extremo derecho                               | A,F,G     |
| VC-07 | Header          | Icono de busqueda visible en desktop                                      | A,F,G     |
| VC-08 | Header          | Control de idioma visible en banda blanca interior                        | F,G       |
| VC-09 | Header          | `data-v6-mega` renderizado y oculto por defecto                           | D         |
| VC-10 | Header          | Mega abre por click en item primario                                      | D         |
| VC-11 | Header          | Mega cierra con `Escape`                                                  | D         |
| VC-12 | Header          | Mega tiene columna de categorias + links secundarios                      | D         |
| VC-13 | Header          | Drawer mobile existe (`data-v6-drawer`)                                   | E         |
| VC-14 | Header          | Drawer mobile bloquea scroll de body al abrir                             | E         |
| VC-15 | Header          | Estados focus visibles en links/botones                                   | A,D       |
| VC-16 | Hero            | Existe bloque `data-v6-hero` en home ES                                   | A         |
| VC-17 | Hero            | Hero presenta 3 paneles visuales simultaneos desktop                      | A         |
| VC-18 | Hero            | Panel central priorizado por escala/contraste                             | A         |
| VC-19 | Hero            | Paneles laterales visibles con recorte parcial                            | A         |
| VC-20 | Hero            | Cada slide expone `data-v6-slide`                                         | A         |
| VC-21 | Hero            | Overlay circular de play en media principal                               | A,E       |
| VC-22 | Hero            | Banda inferior semitransparente activa                                    | A,C       |
| VC-23 | Hero            | Banda incluye categoria/titulo/descripcion                                | A,C       |
| VC-24 | Hero            | Controles `data-v6-prev/next/toggle` visibles                             | A,C       |
| VC-25 | Hero            | Indicadores lineales renderizados >= 4                                    | A,C       |
| VC-26 | Hero            | Autoplay activo por defecto (7s +-500ms)                                  | A,C       |
| VC-27 | Hero            | Toggle pausa cambia a estado `paused` accesible                           | A,C       |
| VC-28 | Hero            | Navegacion teclado (ArrowLeft/ArrowRight) funcional                       | A,C       |
| VC-29 | Hero            | Relacion alto hero desktop entre 0.38 y 0.62 viewport                     | A         |
| VC-30 | Hero            | Relacion ancho panel central > panel lateral                              | A         |
| VC-31 | News strip      | Existe `data-v6-news-strip` bajo hero                                     | A,B       |
| VC-32 | News strip      | Fondo claro (gris/blanco) con 2 columnas                                  | A,B       |
| VC-33 | News strip      | Columna izquierda etiqueta editorial fija                                 | A,B       |
| VC-34 | News strip      | Columna derecha contiene titular + enlace                                 | A,B       |
| VC-35 | News strip      | Selector de idioma discreto alineado derecha                              | A,B       |
| VC-36 | Editorial       | Seccion atmosferica azul profunda en home                                 | B,C       |
| VC-37 | Editorial       | Fondo con glow vertical o gradiente multicapa                             | B,C       |
| VC-38 | Editorial       | Grid editorial 2 columnas desktop                                         | B,C       |
| VC-39 | Editorial       | Grid editorial 1 columna mobile (<900px)                                  | B,C       |
| VC-40 | Editorial       | Card tipo video con icono play presente                                   | B,C       |
| VC-41 | Editorial       | Card tipo info con categoria/titulo/copy/link                             | B,C       |
| VC-42 | Editorial       | Al menos 6 cards editoriales en home                                      | B,C       |
| VC-43 | Editorial       | Variacion de alturas tipo masonry controlada                              | B,C       |
| VC-44 | Editorial       | Hover sobrio (elevacion suave/opacidad overlay)                           | B,C       |
| VC-45 | Internas        | Plantilla interna con breadcrumb + H1 en banda clara                      | F,G       |
| VC-46 | Internas        | Hero full-bleed bajo banda de titulo                                      | F,G       |
| VC-47 | Internas        | Contenido centralizado con ancho maximo controlado                        | F,G       |
| VC-48 | Internas        | Grillas de cards en hub/servicios, min 3 columnas desktop                 | G         |
| VC-49 | Internas        | Cards con imagen arriba + metadata + CTA abajo                            | G         |
| VC-50 | Internas        | Boton back-to-top fijo en esquina inferior                                | B,C,F,G   |
| VC-51 | Internas        | Telemedicina muestra exactamente 3 KPI tiles en desktop                   | F,G       |
| VC-52 | Internas        | Telemedicina incluye >=4 cards de iniciativas con imagen/titulo/copy/cta  | F,G       |
| VC-53 | Internas        | Telemedicina mantiene bloque lead ancho (>=1.5x card estandar) en desktop | F,G       |
| VC-54 | Internas        | Legal expone >=4 tabs en indice superior                                  | F,G       |
| VC-55 | Internas        | Legal renderiza >=2 bloques de clausulas con filas numeradas              | F,G       |
| VC-56 | Internas        | Legal incluye indice visual de politicas con >=4 cards y metadata         | F,G       |
| VC-57 | Hub             | Hub incluye bloque `data-v6-hub-initiatives` visible                      | G         |
| VC-58 | Hub             | Hub iniciativas renderiza >=8 cards                                       | G         |
| VC-59 | Hub             | Grid de iniciativas usa 4 columnas en desktop                             | G         |
| VC-60 | Hub             | Card de iniciativa incluye imagen + categoria + titulo + copy + cta       | G         |
| VC-61 | Hub             | Menu de pagina en hub incluye ancla a iniciativas                         | G         |
| VC-62 | Hub             | Grid de iniciativas colapsa a 1 columna en mobile (<900px)                | G         |
| VC-63 | Internas        | Altura de banda corporativa interna en rango 120..240px                   | F,G       |
| VC-64 | Internas        | Hero interno mantiene ratio 0.34..0.58 del viewport                       | F,G       |
| VC-65 | Internas        | Bloque editorial interno (`data-v6-internal-message`) presente y denso    | F,G       |
| VC-66 | Service         | Grilla `v6-service-detail` en 2 columnas desktop con gap >= 24px          | G         |
| VC-67 | Tele            | Cards de iniciativas tele con min-height >= 340px                         | F,G       |
| VC-68 | Legal           | Tabs legales sticky con offset superior 68..90px                          | F,G       |
| VC-69 | Legal           | Numeracion de clausulas en formato de dos digitos                         | F,G       |
| VC-70 | Internas Mobile | Grillas de service/legal colapsan a 1 columna en mobile                   | F,G       |
| VC-71 | Hub             | Bloque destacado superior visible (`data-v6-hub-featured`)                | G         |
| VC-72 | Hub             | Bloque destacado renderiza exactamente 3 cards                            | G         |
| VC-73 | Hub             | Grid destacado usa 3 columnas desktop                                     | G         |
| VC-74 | Hub             | Card destacada incluye imagen + categoria + titulo + copy + cta           | G         |
| VC-75 | Hub             | Menu de pagina incluye ancla al bloque destacado                          | G         |
| VC-76 | Hub             | Imagen destacada mantiene presencia visual alta (>=220px)                 | G         |
| VC-77 | Hub Mobile      | Grid destacado colapsa a 1 columna mobile (<900px)                        | G         |
| VC-78 | Hub             | Bloque destacado aparece antes del stream de catalogo                     | G         |
| VC-79 | Service         | Rail interno sticky visible con mapa de ruta                              | F,G       |
| VC-80 | Tele            | Rail interno sticky visible con mapa de flujo                             | F,G       |
| VC-81 | Service         | Bloque `data-v6-internal-thesis` presente                                 | F,G       |
| VC-82 | Tele            | Bloque `data-v6-internal-thesis` presente                                 | F,G       |
| VC-83 | Legal           | Bloque `data-v6-internal-thesis` presente                                 | F,G       |
| VC-84 | Internas        | Thesis con ancho y densidad editorial controlados                         | F,G       |
| VC-85 | Internas Mobile | Rails internos cambian a `position: static` en mobile                     | F,G       |
| VC-86 | Internas        | Shell interno mantiene 2 columnas desktop (rail + cuerpo)                 | F,G       |
| VC-87 | Internas        | Service incluye statement band con imagen y narrativa                     | F,G       |
| VC-88 | Internas        | Tele incluye statement band con imagen y narrativa                        | F,G       |
| VC-89 | Internas        | Legal incluye statement band con imagen y narrativa                       | F,G       |
| VC-90 | Internas        | Statement band usa 2 columnas desktop y 1 columna mobile                  | F,G       |
| VC-91 | Header          | Mega desktop usa layout de dos paneles (categorias + detalle)             | D         |
| VC-92 | Header          | Hover en categoria del mega cambia el panel activo de detalle             | D         |
| VC-93 | Header          | Panel de detalle activo incluye bloque contextual completo                | D         |
| VC-94 | Header          | Navegacion por teclado en categorias del mega cambia panel activo         | D         |
| VC-95 | Hero            | Indicador activo muestra progreso temporal animado en estado playing      | A,C       |
| VC-96 | Hero            | Pausa detiene progreso de indicador y play lo reanuda                     | A,C       |

## Geometry tolerances

- Header desktop: `68px..96px`.
- Hero overlay band: `64px..140px`.
- Gap horizontal cards hero: `16px..40px`.
- Gap vertical editorial cards: `20px..44px`.
- Max content width internas: `1180px..1360px`.

## Mobile behavior

- Breakpoint principal: `900px`.
- Nav primaria se colapsa a drawer.
- Hero pasa de 3 paneles a 1 panel visible con avance lateral.
- News strip se vuelve stack vertical.
- Editorial grid pasa a una columna.
