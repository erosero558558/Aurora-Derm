# 📋 Lista de Pendientes ULTRADETALLADA - Post-Refactorización

> **Fecha**: 2026-02-20  
> **Commit Base**: 34be7d7 (fix: resolve stash conflicts after PR merges)  
> **Estado**: Working tree clean, up to date with origin/main  
> **PRs Fusionados**: 18+

---

## 🔴 CRÍTICO - Bloqueantes para Producción

### 1. **REFERENCIAS ROTAS EN INDEX.HTML** ⚠️

**Archivo**: `index.html`

```html
<!-- ESTAS REFERENCIAS NO EXISTEN -->
<script src="bootstrap-inline-engine.js?v=figo-20260221-phase10-realagenda1"></script>
<script src="script.js?v=figo-20260221-phase10-realagenda1"></script>
```

**Impacto**: La aplicación no carga correctamente en producción.

**Solución**: Actualizar paths:

- `bootstrap-inline-engine.js` → `js/bootstrap-inline-engine.js`
- `script.js` → `js/script.js` (si existe) o usar el bundle de Rollup

---

### 2. **CONSOLE.LOGS EN PRODUCCIÓN** ⚠️

**Archivos afectados**:
| Archivo | Líneas | Contenido |
|---------|--------|-----------|
| `script.js` | 6 | Múltiples logs de debug |
| `utils.js` | 2 | `DEBUG && console.log` |
| `sw.js` | 1 | `console.log` |

**Impacto**: Fuga de información en consola del navegador.

**Solución**: Reemplazar con sistema de logging condicional o eliminar.

---

### 3. **BANDERAS DE DEBUG ACTIVAS** ⚠️

**Variable**: `PIELARMONIA_DEBUG_EXCEPTIONS`

| Archivo                   | Ubicación   | Estado                                    |
| ------------------------- | ----------- | ----------------------------------------- |
| `env.example.php`         | Línea ~10   | Expuesta                                  |
| `lib/api_helpers.php`     | Línea ~45   | Usada en `api_error_message_for_client()` |
| `utils.js`                | Línea 18    | `DEBUG = true`                            |
| `src/apps/admin/index.js` | Desconocida | Posiblemente presente                     |

**Impacto**: Mensajes de error técnicos expuestos a usuarios.

---

## 🟡 ALTO - Mejoras Necesarias

### 4. **TAMAÑO DE BUNDLES**

| Bundle                        | Tamaño       | Umbral Recomendado | Estado        |
| ----------------------------- | ------------ | ------------------ | ------------- |
| `admin.js`                    | **80.2 KB**  | < 50 KB            | ❌ Excede 60% |
| `script.js`                   | **104.8 KB** | < 80 KB            | ❌ Excede 30% |
| `js/engines/ui-bundle.js`     | 27 KB        | < 30 KB            | ✅ OK         |
| `js/engines/booking-utils.js` | 17 KB        | < 20 KB            | ✅ OK         |

**Solución propuesta**:

- `admin.js`: Code splitting por funcionalidad (dashboard, appointments, callbacks, reviews)
- `script.js`: Lazy loading de módulos no críticos (analytics, chat, engagement)

---

### 5. **DEPENDENCIAS CIRCULARES**

**Archivo**: `js/main.js`

```javascript
// Importa 15+ módulos que pueden crear ciclos
import { initAnalytics } from './analytics.js';
import { initBooking } from './booking.js';
import { initChat } from './chat.js';
// ... más imports
```

**Módulos problemáticos**:

- `main.js` → `router.js` → `state.js` → `main.js`
- `booking.js` → `data.js` → `booking.js`

**Herramienta**: `madge` para detectar ciclos.

---

### 6. **DUPLICACIÓN DE CÓDIGO**

**Funciones duplicadas** (6 definiciones cada una):

- `getDefaultTimeSlots()` - En múltiples archivos de booking
- `debugLog()` - En utils.js y src/apps/shared/
- `escapeHtml()` - En admin.js y utils.js

**Impacto**: Mantenimiento difícil, inconsistencias.

---

### 7. **ARCHIVOS LEGACY SIN MIGRAR**

| Archivo         | Tamaño  | Destino Propuesto          | Prioridad |
| --------------- | ------- | -------------------------- | --------- |
| `utils.js`      | 2.2 KB  | `src/apps/shared/utils.js` | Media     |
| `legal-i18n.js` | 19.5 KB | `src/apps/i18n/legal.js`   | Baja      |

---

### 8. **PATHS RELATIVOS EN SERVICIOS**

**Archivos afectados**: `servicios/acne.html`, `servicios/rosacea.html`

```html
<!-- Referencias problemáticas encontradas -->
<link rel="stylesheet" href="../styles.css" />
<script src="../script.js"></script>
<img src="../images/..." />
```

**Total de paths relativos**: 5+ en acne.html

---

## 🟢 MEDIO - Optimizaciones

### 9. **TESTS PENDIENTES**

| Tipo           | Cantidad    | Estado              |
| -------------- | ----------- | ------------------- |
| E2E Playwright | 26 archivos | ⚠️ Verificar fallos |
| PHP Unit       | 58 archivos | ✅ 88 tests pasando |
| Cobertura      | Desconocida | ⚠️ Medir            |

**Tests con fallos reportados previamente**:

- `funnel-tracking.spec.js` - `serviceSelect not defined`
- `hero-preload-paths.spec.js` - 404 errors

---

### 10. **CSS SIN USAR**

**Clases detectadas** (muestra):

- `.service-price` - No aparece en index.html
- Potencialmente más con PurgeCSS

**Recomendación**: Ejecutar PurgeCSS para identificar todas.

---

### 11. **OPTIMIZACIÓN DE IMÁGENES**

| Formato             | Cantidad | Estado                 |
| ------------------- | -------- | ---------------------- |
| WebP                | ~30      | ✅ Optimizadas         |
| AVIF                | ~15      | ✅ Optimizadas         |
| JPEG/PNG originales | ~40      | ⚠️ Considerar eliminar |

**Espacio recuperable**: ~2-3 MB eliminando originales no usados.

---

## 🔵 BAJO - Documentación y Limpieza

### 12. **DOCUMENTACIÓN PENDIENTE**

**Archivos existentes** (26 documentos MD):

- `ANALISIS_ULTRADETALLADO_2026-02-20.md` - Este análisis
- `LISTA_PENDIENTES_ULTRADETALLADA.md` - Lista de pendientes
- `ROADMAP_PRIORIDADES.md` - Roadmap estratégico
- `AUDITORIA_COMPLETA.md` - Auditoría de seguridad
- `SECURITY_AUDIT.md` - Reporte de seguridad
- Y 21 más...

**Duplicación detectada**: Múltiples documentos con información similar.

---

### 13. **GITHUB ACTIONS**

**Workflows activos** (5):

1. `ci.yml` - Build, lint, test
2. `close-resolved-issues.yml` - Auto-cierre de issues
3. `deploy-hosting.yml` - Despliegue a hosting
4. `deploy-staging.yml` - Despliegue a staging
5. `post-deploy-gate.yml` - Verificación post-deploy
6. `prod-monitor.yml` - Monitoreo en producción

**Verificar**: Todos los workflows deben pasar en el commit actual.

---

## 📊 ESTADÍSTICAS DEL PROYECTO

### Código

| Tipo          | Cantidad |
| ------------- | -------- |
| Archivos JS   | 1,432    |
| Archivos PHP  | 146      |
| Archivos HTML | 27       |
| Archivos CSS  | 25       |
| Imágenes      | 118      |

### Micro-frontends (src/apps/)

| Módulo        | Archivos JS |
| ------------- | ----------- |
| admin         | 12          |
| analytics     | 1           |
| booking       | 5           |
| chat          | 5           |
| consent       | 1           |
| engagement    | 1           |
| modal-ux      | 1           |
| payment       | 1           |
| reschedule    | 1           |
| reviews       | 1           |
| shared        | 2           |
| success-modal | 1           |
| theme         | 1           |
| ui-effects    | 1           |
| **Total**     | **34**      |

---

## 🎯 PLAN DE ACCIÓN RECOMENDADO

### Fase 1: Hotfixes (Inmediato)

1. [ ] Corregir referencias rotas en index.html
2. [ ] Eliminar console.logs de producción
3. [ ] Desactivar PIELARMONIA_DEBUG_EXCEPTIONS

### Fase 2: Optimización (Semana 1)

4. [ ] Implementar code splitting para admin.js
5. [ ] Migrar utils.js y legal-i18n.js a src/apps/
6. [ ] Resolver dependencias circulares

### Fase 3: Testing (Semana 2)

7. [ ] Verificar todos los tests de Playwright
8. [ ] Medir cobertura de código
9. [ ] Documentar funciones duplicadas

### Fase 4: Limpieza (Semana 3)

10. [ ] Consolidar documentación
11. [ ] Eliminar imágenes originales no usadas
12. [ ] Verificar paths en servicios/\*.html

---

## 🔍 COMANDOS ÚTILES PARA VERIFICACIÓN

```powershell
# Verificar referencias rotas
Select-String -Path "*.html" -Pattern 'src="([^"]+)"' | ?{ !($_.Matches[0].Groups[1].Value -match '^http') }

# Buscar console.logs
Select-String -Path "*.js" -Pattern "console\.(log|warn|error)" | ?{ $_.Filename -notmatch "test" }

# Detectar duplicación
Select-String -Path "*.js" -Pattern "function (escapeHtml|debugLog)" | Group-Object Pattern

# Verificar encoding
Get-Content content/index.json -Encoding UTF8 | Select-Object -First 5
```

---

## 📌 NOTAS

- El encoding de `content/index.json` está **CORREGIDO** (no más "��")
- Las secciones deferred cargan correctamente (15 secciones)
- No hay scripts vacíos en index.html
- El build de Rollup está configurado correctamente

---

**Generado**: 2026-02-20  
**Próxima revisión**: Después de completar Fase 1
