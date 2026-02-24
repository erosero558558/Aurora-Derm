# 📋 PLAN DE TRABAJO DETALLADO PARA JULES
**Piel en Armonía - Orden de Implementación**  
**Fecha:** 20 de Febrero 2026 | **Estado:** 85% Completado

---

## 🎯 RESUMEN EJECUTIVO

```
┌──────────────────────────────────────────────────────────────┐
│  SPRINT ACTUAL: Finalización Fase 1 (P0 + P1 críticos)      │
│  Tiempo estimado: 2-3 semanas                                │
│  Objetivo: 95% completado, producción estable               │
└──────────────────────────────────────────────────────────────┘
```

---

## 🔴 FASE 1: P0 - CRÍTICOS (Esta Semana)

### ✅ TAREA 1.1: Seguridad - Remover Debug de Producción
**Archivos:** `bootstrap-inline-engine.js`, `chat-engine.js`, `script.js`, `utils.js`
**Tiempo:** 2 horas | **Prioridad:** MÁXIMA

```javascript
// ELIMINAR de todos los archivos JS:
// 1. Constantes DEBUG expuestas
const DEBUG = false; // <-- ELIMINAR

// 2. Funciones debugLog expuestas globalmente
window.debugLog = debugLog; // <-- ELIMINAR

// 3. Comandos debug accesibles (chat-engine.js:428-430)
// Reemplazar con: if (window.location.hostname === 'localhost')
```

**Checklist:**
- [ ] `bootstrap-inline-engine.js` - Línea 303
- [ ] `chat-engine.js` - Líneas 428-430
- [ ] `script.js` - Líneas 68-70
- [ ] `utils.js` - Líneas 16-25

**Verificación:**
```bash
# Buscar debug expuesto
grep -n "DEBUG\|debugLog\|window.debug" *.js
# No debe retornar resultados
```

---

### ✅ TAREA 1.2: Eliminar proxy.php Deprecado (Completado)
**Archivo:** `proxy.php`  
**Tiempo:** 30 minutos | **Riesgo:** Bajo (ya marcado como deprecated)

**Pasos:**
1. Verificar que ningún código usa `proxy.php`:
   ```bash
   grep -r "proxy.php" --include="*.js" --include="*.php" .
   ```
2. Si no hay referencias, eliminar archivo
3. Si hay referencias, migrar a `figo-chat.php`

---

## 🟡 FASE 2: P1 - IMPORTANTES (Semanas 2-3)

### ✅ TAREA 2.1: Completar Migración ES6
**Progreso actual:** 40% → 100%  
**Tiempo:** 3-4 días | **Impacto:** ALTO

#### 2.1.1 Crear Estructura src/modules/chat/
```
src/modules/chat/
├── index.js              # Exporta todo el módulo
├── ChatWidget.js         # UI del chat (migrar de chat-widget-engine.js)
├── ChatEngine.js         # Lógica principal (migrar de chat-engine.js)
├── ChatService.js        # Comunicación API
├── ChatState.js          # Estado interno
└── ChatUI.js             # Renderizado (migrar de chat-ui-engine.js)
```

**Migrar desde:**
- `chat-engine.js` (695 líneas)
- `chat-ui-engine.js` (286 líneas)
- `chat-widget-engine.js` (283 líneas)
- `chat-booking-engine.js` (624 líneas)
- `chat-state-engine.js` (líneas pequeñas)

**Template base:**
```javascript
// src/modules/chat/ChatEngine.js
export class ChatEngine {
  constructor(config = {}) {
    this.config = {
      endpoint: config.endpoint || '/figo-chat.php',
      timeout: config.timeout || 20000,
      ...config
    };
    this.state = new ChatState();
    this.ui = new ChatUI(this.state);
  }

  async init() {
    // Inicialización
  }

  async sendMessage(message) {
    // Lógica de envío
  }
}
```

#### 2.1.2 Crear Estructura src/modules/booking/
```
src/modules/booking/
├── index.js
├── BookingEngine.js      # (migrar de booking-engine.js)
├── BookingForm.js        # (migrar de booking-form.js)
├── BookingCalendar.js    # Nueva
├── BookingService.js     # API calls
├── BookingState.js       # Estado
└── PaymentIntegration.js # (migrar lógica de Stripe)
```

**Migrar desde:**
- `booking-engine.js` (591 líneas)
- `booking-ui.js` (363 líneas)
- `booking-form.js` (en src/modules/)

#### 2.1.3 Actualizar Rollup Config
```javascript
// rollup.config.mjs
export default {
  input: {
    main: 'src/main.js',
    chat: 'src/modules/chat/index.js',
    booking: 'src/modules/booking/index.js'
  },
  output: {
    dir: 'dist',
    format: 'es',
    entryFileNames: '[name].bundle.js',
    chunkFileNames: 'shared/[name]-[hash].js'
  }
};
```

#### 2.1.4 Lazy Loading en index.html
```html
<!-- ANTES -->
<script src="chat-engine.js" defer></script>
<script src="booking-engine.js" defer></script>

<!-- DESPUÉS -->
<script type="module">
  // Cargar chat solo cuando se abre
  document.getElementById('chat-btn').addEventListener('click', async () => {
    const { ChatEngine } = await import('./dist/chat.bundle.js');
    window.chat = new ChatEngine();
    await window.chat.init();
  });

  // Cargar booking solo en página de booking
  if (document.getElementById('booking-form')) {
    import('./dist/booking.bundle.js').then(({ BookingEngine }) => {
      window.booking = new BookingEngine();
    });
  }
</script>
```

---

### ✅ TAREA 2.2: Optimizar index.html (127KB → <80KB)
**Tiempo:** 2 días | **Prioridad:** MEDIA

#### 2.2.1 Separar Contenido a JSON
```javascript
// data/sections.json
{
  "hero": {
    "title": "Dermatología Especializada en Quito",
    "subtitle": "Tu piel en las mejores manos...",
    "cta": "Reserva tu cita"
  },
  "services": [
    { "id": "facial", "name": "Tratamientos Faciales", ... },
    { "id": "laser", "name": "Láser Dermatológico", ... }
  ],
  "doctors": [...],
  "testimonials": [...]
}
```

#### 2.2.2 Crear Loader Dinámico
```javascript
// src/content-loader.js
export async function loadSection(sectionName) {
  const response = await fetch('/data/sections.json');
  const data = await response.json();
  return data[sectionName];
}

export function renderTemplate(templateId, data) {
  const template = document.getElementById(templateId);
  const html = template.innerHTML.replace(/\{\{(\w+)\}\}/g, (match, key) => data[key] || '');
  return html;
}
```

#### 2.2.3 HTML Optimizado
```html
<!-- index.html -->
<!DOCTYPE html>
<html>
<head>
  <!-- Solo CSS crítico inline (~10KB) -->
  <style>
    /* Critical CSS: solo above-the-fold */
  </style>
  
  <!-- Resto de CSS lazy loaded -->
  <link rel="preload" href="styles-deferred.css" as="style" 
        onload="this.onload=null;this.rel='stylesheet'">
</head>
<body>
  <!-- Contenido estático mínimo -->
  <header id="header"></header>
  
  <!-- Templates -->
  <template id="hero-template">
    <h1>{{title}}</h1>
    <p>{{subtitle}}</p>
  </template>

  <!-- Cargar contenido dinámicamente -->
  <script type="module">
    import { loadSection, renderTemplate } from './src/content-loader.js';
    
    // Cargar hero inmediatamente
    const heroData = await loadSection('hero');
    document.getElementById('hero').innerHTML = 
      renderTemplate('hero-template', heroData);
    
    // Cargar servicios en lazy (cuando se hace scroll)
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          loadServices();
          observer.unobserve(entry.target);
        }
      });
    });
    observer.observe(document.getElementById('services'));
  </script>
</body>
</html>
```

---

### ✅ TAREA 2.3: Consolidar Tests Duplicados
**Tiempo:** 1 día | **Complejidad:** Baja

**Problema identificado:**
```
tests/BookingServiceTest.php 
  vs 
tests/Unit/Booking/BookingServiceTest.php

tests/StripeServiceTest.php 
  vs 
tests/Payment/StripeServiceTest.php
```

**Solución:**
```
tests/
├── Unit/                          # Tests con mocks (rápidos)
│   ├── Booking/
│   │   └── BookingServiceTest.php # (mover de tests/Unit/Booking/)
│   └── Payment/
│       └── StripeServiceTest.php  # (mover de tests/Payment/)
├── Integration/                   # Tests con BD real (lentos)
│   ├── Booking/
│   │   └── BookingServiceIntegrationTest.php # (renombrar de tests/Booking/)
│   └── Payment/
│       └── StripeServiceIntegrationTest.php
└── E2E/                          # Tests Playwright
    ├── booking.spec.js
    └── payment.spec.js
```

**Pasos:**
1. Renombrar tests de integración con sufijo `Integration`
2. Mover tests unitarios a estructura clara
3. Actualizar `phpunit.xml`:
```xml
<testsuites>
  <testsuite name="Unit">
    <directory>tests/Unit</directory>
  </testsuite>
  <testsuite name="Integration">
    <directory>tests/Integration</directory>
  </testsuite>
</testsuites>
```

---

## 🟢 FASE 3: P2 - MEJORAS (Semana 4)

### ✅ TAREA 3.1: Feature Flags Frontend
**Backend listo:** `lib/features.php` ✅  
**UI Admin listo:** Panel básico ✅  
**Falta:** Leer flags en JavaScript

**Implementación:**
```javascript
// src/feature-flags.js
export class FeatureFlags {
  static async init() {
    const response = await fetch('/api.php?resource=features');
    this.flags = await response.json();
  }

  static isEnabled(flagName, userId = null) {
    const flag = this.flags[flagName];
    if (!flag?.enabled) return false;
    
    // Gradual rollout
    if (flag.percentage && userId) {
      const hash = this.hashCode(userId);
      return (hash % 100) < flag.percentage;
    }
    
    return true;
  }

  static hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
}

// Uso
await FeatureFlags.init();

if (FeatureFlags.isEnabled('new_booking_ui', user.id)) {
  renderNewBookingUI();
} else {
  renderLegacyBookingUI();
}
```

---

### ✅ TAREA 3.2: Service Worker Mejorado
**Archivo:** `sw.js`  
**Estado actual:** Básico  
**Mejoras:**

```javascript
// sw.js - Service Worker optimizado
const CACHE_NAME = 'pielarmonia-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/script.js',
  '/offline.html'  // Crear página offline
];

// Install: Precache crítico
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Fetch: Estrategia Cache First para assets, Network First para API
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API calls: Network First
  if (url.pathname.startsWith('/api.php')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Assets: Cache First
  event.respondWith(cacheFirst(request));
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  
  const response = await fetch(request);
  const cache = await caches.open(CACHE_NAME);
  cache.put(request, response.clone());
  return response;
}

async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, networkResponse.clone());
    return networkResponse;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw error;
  }
}
```

---

### ✅ TAREA 3.3: CSP Estricto
**Archivo:** `lib/security.php`  
**Cambio:** Eliminar `'unsafe-inline'`

```php
// ANTES
$csp .= "style-src 'self' https://fonts.googleapis.com 'unsafe-inline';";

// DESPUÉS - Opción A: Nonces
$nonce = base64_encode(random_bytes(16));
$csp .= "style-src 'self' https://fonts.googleapis.com 'nonce-{$nonce}';";
// Insertar $nonce en todos los <style nonce="...">

// DESPUÉS - Opción B: Hashes (más complejo, más seguro)
// Calcular hash de cada bloque de estilo inline
```

---

## 📊 CRONOGRAMA DETALLADO

### Semana 1 (Feb 24-28)
| Día | Tarea | Horas | Entregable |
|-----|-------|-------|------------|
| Lun | Tarea 1.1: Remover debug | 2h | Debug eliminado de 4 archivos |
| Lun | Tarea 1.2: Eliminar proxy.php | 0.5h | Archivo eliminado, verificado |
| Mar | Tarea 2.1.1: Estructura chat/ | 6h | src/modules/chat/ creado |
| Mié | Tarea 2.1.1: Migrar chat-engine.js | 6h | ChatEngine.js ES6 funcional |
| Jue | Tarea 2.1.2: Estructura booking/ | 6h | src/modules/booking/ creado |
| Vie | Tarea 2.1.3: Rollup config | 4h | Build genera bundles correctos |

### Semana 2 (Mar 3-7)
| Día | Tarea | Horas | Entregable |
|-----|-------|-------|------------|
| Lun | Tarea 2.1.4: Lazy loading | 6h | index.html con imports dinámicos |
| Mar | Tarea 2.1: Testing ES6 | 4h | Tests pasando, bundles funcionando |
| Mié | Tarea 2.2.1: JSON sections | 4h | data/sections.json creado |
| Jue | Tarea 2.2.2: Content loader | 4h | content-loader.js funcional |
| Vie | Tarea 2.2.3: HTML optimizado | 6h | index.html <80KB |

### Semana 3 (Mar 10-14)
| Día | Tarea | Horas | Entregable |
|-----|-------|-------|------------|
| Lun | Tarea 2.3: Tests duplicados | 4h | Estructura tests/ organizada |
| Mar | Tarea 3.1: Feature flags | 4h | Frontend lee flags correctamente |
| Mié | Tarea 3.2: Service Worker | 4h | sw.js con estrategias optimizadas |
| Jue | Tarea 3.3: CSP estricto | 4h | CSP sin unsafe-inline |
| Vie | Buffer/Testing final | 4h | Todo funcionando en staging |

---

## ✅ DEFINITION OF DONE

Cada tarea se considera **DONE** cuando:

1. **Código implementado** siguiendo estándares del proyecto
2. **Tests pasando** (unitarios + integración)
3. **Linting sin errores** (ESLint, PHP_CodeSniffer)
4. **Revisado en staging** (https://staging.pielarmonia.com)
5. **Verificación de seguridad** (no expone datos sensibles)
6. **Documentado** (JSDoc/PHPDoc actualizado)
7. **Commit con mensaje claro**:
   ```
   feat(chat): migrate to ES6 modules with lazy loading
   
   - Create src/modules/chat/ structure
   - Migrate chat-engine.js to ChatEngine class
   - Implement dynamic imports in index.html
   - Add tests for ChatEngine
   
   Closes #47
   ```

---

## 🚨 ESCALACIÓN

**Si algo bloquea el trabajo >2 horas:**
1. Documentar el problema con logs/screenshots
2. Crear issue en GitHub con label `blocking`
3. Mover a siguiente tarea mientras se resuelve

**Contacto emergencia:**
- Slack: #dev-pielarmonia
- Email: dev@pielarmonia.com

---

*Documento creado: 20 de Febrero 2026*  
*Última actualización: 20 de Febrero 2026*  
*Versión: 1.0*
