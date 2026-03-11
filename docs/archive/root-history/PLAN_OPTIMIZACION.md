# 📋 Plan de Optimización de Código - Piel en Armonía

**Fecha:** 2026-02-20  
**Estado Actual:** 92% completado, código funcional pero con deuda técnica acumulada  
**Objetivo:** Reducir complejidad, mejorar mantenibilidad, aumentar cobertura de tests a 80%

---

## 🎯 VISIÓN GENERAL

```
FASE 1 (Semana 1-2): Seguridad & Estabilidad
FASE 2 (Semana 3-4): Testing & Refactor Core
FASE 3 (Semana 5-6): Frontend Modularización
FASE 4 (Semana 7-8): Performance & Limpieza
```

---

## 🔴 FASE 1: Seguridad & Estabilidad (Semanas 1-2)

### 1.1 Seguridad Inmediata (Día 1-2)

**Prioridad:** CRÍTICA | **Riesgo:** Alto | **Tiempo:** 4h

```bash
# Tareas:
- [ ] Rotar API keys expuestas (FIGO_AI_API_KEY en historial)
- [ ] Auditar env.php en historial de git
- [ ] Configurar GitHub Secrets para CI/CD
- [ ] Revisar permisos de archivos en servidor
```

**Archivos a modificar:**

- `.github/workflows/*.yml` - Usar secrets en lugar de variables hardcodeadas
- `env.example.php` - Documentar mejor prácticas de seguridad

### 1.2 Pentesting Automatizado (Día 3-4)

**Prioridad:** CRÍTICA | **Tiempo:** 6h

```bash
# Crear suite de pentesting en CI:
tests/security/
├── SqlInjectionTest.php      # Probar endpoints con payloads
├── XssProtectionTest.php     # Validar sanitización de output
├── CsrfValidationTest.php    # Verificar tokens en forms
├── RateLimitingTest.php      # Confirmar bloqueos
└── AuthBypassTest.php        # Protección de rutas admin
```

**Integración en CI:**

```yaml
# .github/workflows/security.yml (nuevo)
security-pentest:
    runs-on: ubuntu-latest
    steps:
        - name: Run SQLMap scan
        - name: Run XSS payloads
        - name: Test rate limiting
```

### 1.3 Sistema de Backups Verificado (Día 5)

**Prioridad:** ALTA | **Tiempo:** 3h

```php
// tests/Integration/BackupSystemTest.php
- [ ] Test: Backup diario se ejecuta
- [ ] Test: Backup es descargable
- [ ] Test: Restore de backup funciona
- [ ] Test: Backup offsite sincroniza
```

---

## 🟠 FASE 2: Testing & Refactor Core (Semanas 3-4)

### 2.1 Tests Unitarios Críticos (Día 1-5)

**Meta:** 30% → 60% cobertura | **Tiempo:** 20h

```php
tests/Unit/
├── Auth/
│   ├── AuthSessionTest.php       # Sesiones, timeouts, cookies
│   └── PasswordHashingTest.php   # Verificación de passwords
├── Booking/
│   ├── BookingServiceTest.php    # Crear, cancelar, reprogramar
│   ├── AvailabilityCalculatorTest.php  # Slots disponibles
│   └── BookingConflictTest.php   # Prevención de duplicados
├── Payment/
│   ├── StripeServiceTest.php     # Intents, webhooks, reembolsos
│   └── IdempotencyKeyTest.php    # Claves únicas
├── Security/
│   ├── RateLimiterTest.php       # Límites por IP/usuario
│   ├── InputValidatorTest.php    # Sanitización de inputs
│   └── CsrfTokenTest.php         # Generación y validación
└── Lib/
    ├── StorageTest.php           # Lectura/escritura JSON
    └── EncryptionTest.php        # Encriptación de datos
```

**Ejemplo de test a crear:**

```php
// tests/Unit/Booking/BookingServiceTest.php
class BookingServiceTest extends TestCase
{
    public function testCreateBookingSuccess(): void;
    public function testCreateBookingTimeSlotTaken(): void;
    public function testCreateBookingPastDate(): void;
    public function testCancelBooking(): void;
    public function testRescheduleBooking(): void;
}
```

### 2.2 Refactor api.php → Controladores (Día 6-10)

**Meta:** 980 líneas → <200 líneas | **Tiempo:** 16h

**Plan de migración:**

```php
// Antes (api.php):
case 'appointments':
    // 150 líneas de lógica mezclada...

// Después (AppointmentsController.php):
class AppointmentsController
{
    public function create(Request $request): Response;
    public function list(Request $request): Response;
    public function update(string $id, Request $request): Response;
    public function delete(string $id): Response;
}

// api.php solo hace routing:
$router->post('/appointments', [AppointmentsController::class, 'create']);
```

**Checklist de migración:**

- [ ] `/appointments` → `AppointmentController`
- [ ] `/booked-slots` → `AvailabilityController::getBookedSlots()`
- [ ] `/callbacks` → `CallbackController`
- [ ] `/reviews` → `ReviewController`
- [ ] `/payments/*` → `PaymentController` (expandir)
- [ ] `/admin/*` → `AdminController` (nuevo)

### 2.3 Typed Properties PHP 8.2 (Día 11-14)

**Tiempo:** 12h

```php
// Antes:
function processBooking($data) {
    $name = $data['name'];
}

// Después:
function processBooking(array $data): BookingResult {
    $name = (string) ($data['name'] ?? '');
    // Validación explícita...
}

// Clases con tipado estricto:
class BookingRequest {
    public function __construct(
        public readonly string $name,
        public readonly string $email,
        public readonly DateTimeImmutable $date,
        public readonly string $service
    ) {}
}
```

---

## 🟡 FASE 3: Frontend Modularización (Semanas 5-6)

### 3.1 Refactor script.js → Módulos ES6 (Día 1-7)

**Meta:** 1,856 líneas → módulos <300 líneas | **Tiempo:** 28h

```
js/
├── core/
│   ├── app.js              (100 líneas) - Inicialización
│   ├── router.js           (150 líneas) - SPA routing
│   └── state.js            (100 líneas) - Estado global
├── modules/
│   ├── booking/
│   │   ├── BookingForm.js      (200 líneas)
│   │   ├── BookingCalendar.js  (150 líneas)
│   │   └── BookingService.js   (100 líneas)
│   ├── chat/
│   │   ├── ChatWidget.js       (200 líneas)
│   │   ├── ChatUI.js           (150 líneas)
│   │   └── ChatService.js      (100 líneas)
│   ├── payment/
│   │   └── StripeIntegration.js (150 líneas)
│   ├── analytics/
│   │   └── TrackingService.js   (80 líneas)
│   └── ui/
│       ├── ModalManager.js      (100 líneas)
│       ├── FormValidator.js     (80 líneas)
│       └── ToastNotifications.js (50 líneas)
└── utils/
    ├── dom.js              (50 líneas) - Helpers DOM
    ├── validators.js       (80 líneas) - Validación
    └── api.js              (80 líneas) - Fetch wrapper
```

**Build process:**

```json
// package.json
{
    "scripts": {
        "build:js": "rollup -c rollup.config.js",
        "build:prod": "npm run build:js && npm run minify"
    }
}
```

### 3.2 Optimización index.html (Día 8-10)

**Meta:** 120KB → <50KB | **Tiempo:** 12h

```html
<!-- ANTES: Todo inline -->
<html>
    <head>
        <style>
            /* 20KB de CSS crítico */
        </style>
        <script>
            /* 10KB de JS inline */
        </script>
    </head>
    <body>
        <!-- 80KB de HTML con contenido duplicado -->
    </body>
</html>

<!-- DESPUÉS: Componentes -->
<html>
    <head>
        <link rel="preload" href="css/critical.css" as="style" />
        <script type="module" src="js/core/app.js"></script>
    </head>
    <body>
        <div id="app"></div>
        <!-- Contenido cargado vía JS o templates separados -->
    </body>
</html>
```

**Estrategia:**

- [ ] Separar contenido estático a templates JSON
- [ ] Lazy load de secciones no críticas
- [ ] Critical CSS extraído automáticamente

### 3.3 Sistema de Templates (Día 11-14)

**Tiempo:** 12h

```php
// lib/TemplateEngine.php
class TemplateEngine {
    public function render(string $template, array $data): string;
    public function partial(string $name, array $data): string;
}

// Uso:
$template->render('booking/confirmation', [
    'appointment' => $booking,
    'doctor' => $doctor
]);
```

---

## 🟢 FASE 4: Performance & Limpieza (Semanas 7-8)

### 4.1 Optimización de Imágenes (Día 1-3)

**Tiempo:** 10h

```bash
# Script de optimización:
scripts/optimize-images.php
- [ ] Convertir todas a WebP con fallback JPEG
- [ ] Generar srcset automáticamente
- [ ] Implementar LQIP (Low Quality Image Placeholders)
- [ ] Lazy loading nativo + Intersection Observer
```

### 4.2 Limpieza de Ramas Git (Día 4)

**Tiempo:** 4h

```bash
# 118 ramas remotas → limpiar las mergeadas y obsoletas
./scripts/cleanup-branches.sh

# Mantener solo:
- main
- staging
- feature/* activas (últimos 30 días)
- hotfix/* activas
```

### 4.3 Documentación Automatizada (Día 5-7)

**Tiempo:** 12h

```bash
# Generar docs automáticas:
composer require --dev phpdocumentor/phpdocumentor

# Cobertura visual:
npm install --save-dev @codecov/webpack-plugin
```

### 4.4 Monitoreo Avanzado (Día 8-10)

**Tiempo:** 12h

```yaml
# .github/workflows/performance.yml
performance-budget:
    runs-on: ubuntu-latest
    steps:
        - name: Lighthouse CI
          run: |
              npm install -g @lhci/cli
              lhci autorun
          env:
              LHCI_GITHUB_APP_TOKEN: ${{ secrets.LHCI_GITHUB_APP_TOKEN }}
```

---

## 📊 METAS Y KPIs

| Métrica           | Actual | Objetivo | Fase |
| ----------------- | ------ | -------- | ---- |
| Cobertura tests   | 5%     | 80%      | 2    |
| Tamaño script.js  | 72KB   | <30KB    | 3    |
| Tamaño api.php    | 33KB   | <15KB    | 2    |
| Líneas index.html | 120KB  | <50KB    | 3    |
| Ramas git         | 118    | <10      | 4    |
| Psalm errors      | ~50    | 0        | 2    |
| Tiempo CI/CD      | ~8min  | <5min    | 2    |

---

## 🛠️ HERRAMIENTAS NECESARIAS

```bash
# PHP
composer require --dev phpunit/phpunit:^10 psalm/phar phpmd/phpmd

# JavaScript
npm install --save-dev rollup @rollup/plugin-node-resolve \\
    @rollup/plugin-terser @rollup/plugin-typescript

# Testing E2E
npx playwright install

# Performance
npm install --save-dev lighthouse @lhci/cli
```

---

## ⏰ CRONOGRAMA SUGERIDO

| Semana | Enfoque         | Tareas Principales           | Entregable          |
| ------ | --------------- | ---------------------------- | ------------------- |
| 1      | Seguridad       | Rotar keys, pentest, backups | Sistema auditado    |
| 2      | Tests core      | Unit tests críticos          | +40% cobertura      |
| 3      | Refactor PHP    | api.php → controladores      | Código modularizado |
| 4      | Tipado estricto | PHP 8.2 features             | Tipado completo     |
| 5      | JS modular      | script.js → ES6 modules      | Bundle optimizado   |
| 6      | Frontend        | index.html refactor          | <50KB HTML          |
| 7      | Performance     | Imágenes, lazy loading       | Lighthouse 90+      |
| 8      | Limpieza        | Ramas, docs, monitoreo       | Deuda técnica 0     |

---

## 🚀 COMANDOS DE VERIFICACIÓN

```bash
# Después de cada fase, ejecutar:
npm run gate:prod:strict
npm run test
vendor/bin/phpunit --coverage-text
vendor/bin/psalm --no-cache
npm run smoke:prod
```

---

_Plan creado el 2026-02-20_
_Próxima revisión: 2026-02-27_
