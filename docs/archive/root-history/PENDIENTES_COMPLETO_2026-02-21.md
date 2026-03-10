# 📋 Lista Completa de Pendientes - Piel en Armonía

> **Fecha:** 2026-02-21  
> **Commit actual:** 9c95da6  
> **Working tree:** 28 archivos modificados sin commit

---

## 🔴 CRÍTICO - Bloqueantes para Producción

### 1. Archivos Modificados sin Commit (28 archivos)

**Estado:** Cambios locales que necesitan revisión y commit

| Archivo                                         | Tipo           | Prioridad |
| ----------------------------------------------- | -------------- | --------- |
| `admin.css`                                     | CSS            | Media     |
| `admin.html`                                    | HTML           | Media     |
| `controllers/PaymentController.php`             | PHP Backend    | **Alta**  |
| `index.html`                                    | HTML Principal | **Alta**  |
| `js/engines/analytics-engine.js`                | JS Engine      | Media     |
| `js/engines/booking-engine.js`                  | JS Engine      | **Alta**  |
| `js/engines/booking-utils.js`                   | JS Engine      | **Alta**  |
| `js/engines/chat-engine.js`                     | JS Engine      | Media     |
| `js/engines/data-bundle.js`                     | JS Engine      | Media     |
| `js/router.js`                                  | JS Router      | Media     |
| `lib/validation.php`                            | PHP Lib        | Media     |
| `rollup.config.mjs`                             | Build Config   | Baja      |
| `script.js`                                     | JS Principal   | **Alta**  |
| `servicios/acne.html`                           | HTML Servicio  | Media     |
| `servicios/laser.html`                          | HTML Servicio  | Media     |
| `src/apps/booking/engine.js`                    | Source         | **Alta**  |
| `src/apps/chat/engine.js`                       | Source         | Media     |
| `src/apps/shared/router.js`                     | Source         | Media     |
| `styles-deferred.css`                           | CSS            | Media     |
| `styles.css`                                    | CSS            | Media     |
| `sw.js`                                         | Service Worker | Media     |
| `telemedicina.html`                             | HTML           | Media     |
| `tests/BookingFlowTest.php`                     | Test PHP       | Baja      |
| `tests/Integration/PaymentFlowTest.php`         | Test PHP       | Baja      |
| `tests/Unit/Booking/BookingServiceUnitTest.php` | Test PHP       | Baja      |
| `tests/Unit/chat-engine.spec.js`                | Test JS        | Baja      |
| `tests/sw-policy.spec.js`                       | Test JS        | Baja      |

**Acción:** Revisar diferencias (`git diff`) y commitear o descartar.

---

### 2. Console Logs en Producción (8 encontrados)

**Impacto:** Fuga de información en consola del navegador

| Archivo     | Cantidad | Ubicación aproximada |
| ----------- | -------- | -------------------- |
| `script.js` | 5        | Líneas ~1800-2000    |
| `utils.js`  | 2        | Línea ~18-25         |
| `sw.js`     | 1        | Línea ~50-80         |

**Solución:** Reemplazar con sistema de logging condicional o eliminar.

---

### 3. Código Duplicado (8 definiciones)

**Funciones duplicadas encontradas:**

- `escapeHtml` - Múltiples definiciones
- `formatDate` - Múltiples definiciones
- `debugLog` - Múltiples definiciones
- `getDefaultTimeSlots` - Múltiples definiciones

**Impacto:** Mantenimiento difícil, inconsistencias.

---

## 🟡 ALTO - Mejoras Necesarias

### 4. Tests con Skip (2 archivos)

| Test                           | Estado  | Razón                       |
| ------------------------------ | ------- | --------------------------- |
| `api-security-headers.spec.js` | ⚠️ SKIP | Deshabilitado temporalmente |
| `checklist-production.spec.js` | ⚠️ SKIP | Deshabilitado temporalmente |

**Acción:** Revisar y re-habilitar o eliminar.

---

### 5. Base de Datos SQLite

**Estado actual:**

- ✅ `data/store.json` - Creado (5 días de disponibilidad)
- ⚠️ `data/store.sqlite` - **NO EXISTE** (se creará en runtime)

**Nota:** En producción, SQLite se creará automáticamente. El fallback JSON está activo.

---

### 6. Archivos Grandes (>50KB)

| Archivo                | Tamaño   | Umbral  | Acción         |
| ---------------------- | -------- | ------- | -------------- |
| `script.js`            | 105.0 KB | < 80 KB | Code splitting |
| `admin.js`             | 80.2 KB  | < 50 KB | Code splitting |
| `styles-deferred.css`  | 79.8 KB  | < 60 KB | PurgeCSS       |
| `styles.optimized.css` | 80.7 KB  | < 60 KB | Optimizar      |

---

## 🟢 MEDIO - Optimizaciones

### 7. TODOs en Código (10 encontrados)

Ubicaciones:

- `admin.js` - Líneas 323, 325, 1220, 1222: Duplicación de traducciones
- `admin.js` - Línea 2227: Confirmación de restore
- `backup-receiver.php` - Línea 79: Mensaje de error
- `figo-backend.php` - Línea 814: Mensaje de error
- `figo-brain.php` - Línea 89: Keywords de pago
- `figo-chat.php` - Línea 413: Mensaje de error
- `index.php` - Línea 76: Comentario de DOMDocument

---

### 8. Dependencias sin Actualizar

**Verificar:** `npm audit` para vulnerabilidades conocidas.

---

### 9. Documentación Duplicada

26 archivos MD en raíz. Algunos pueden consolidarse:

- `ANALISIS_ULTRADETALLADO_2026-02-20.md`
- `ANALYSIS_REPORT.md`
- `AUDITORIA_COMPLETA.md`
- `CONSOLIDADO_ESTADO_ACTUAL.md`
- `LISTA_PENDIENTES_ULTRADETALLADA.md`
- `PENDIENTES_ACTUALES.md`
- `TODOS_LOS_PENDIENTES.md`

**Nota:** Todos actualizados hoy, pero información similar.

---

### 10. Archivos Legacy Sin Migrar

| Archivo           | Destino Propuesto          | Estado    |
| ----------------- | -------------------------- | --------- |
| `utils.js` (raíz) | `src/apps/shared/utils.js` | Pendiente |
| `legal-i18n.js`   | `src/apps/i18n/legal.js`   | Pendiente |

---

## 🔵 BAJO - Limpieza

### 11. Git Working Tree

```bash
# Revisar cambios
$ git diff --stat
# 25 files changed, 1016 insertions(+), 692 deletions(-)
```

**Acción recomendada:**

1. `git diff` para revisar cambios
2. `git add <archivos relevantes>`
3. `git commit -m "..."`
4. `git restore <archivos no deseados>`

---

### 12. CI/CD Checks

Verificar estado de GitHub Actions:

- [ ] CI Workflow pasando
- [ ] Deploy a staging exitoso
- [ ] Tests E2E pasando

---

## 📊 Estadísticas del Proyecto

```
Código:
- JS:        1,432 archivos
- PHP:         146 archivos
- HTML:         27 archivos
- CSS:          25 archivos

Tests:
- Playwright:   27 archivos (25 ✅, 2 ⚠️ SKIP)
- PHP Unit:     ~58 archivos

Documentación:
- Markdown:     26 archivos

Tamaño:
- Repositorio:  ~150 MB
- Imágenes:     118 archivos
```

---

## 🎯 Plan de Acción Recomendado

### Semana 1 (Prioridad Alta)

1. [ ] Commitear o descartar los 28 archivos modificados
2. [ ] Eliminar console.logs de producción
3. [ ] Re-habilitar tests skipeados o documentar por qué están skip

### Semana 2 (Prioridad Media)

4. [ ] Consolidar código duplicado (escapeHtml, formatDate, etc.)
5. [ ] Reducir tamaño de script.js y admin.js
6. [ ] Migrar utils.js y legal-i18n.js a src/apps/

### Semana 3 (Prioridad Baja)

7. [ ] Consolidar documentación MD
8. [ ] npm audit y actualizar dependencias
9. [ ] Optimizar CSS restante

---

_Generado: 2026-02-21_  
_Para actualizar: Re-ejecutar análisis_
