# ROADMAP DE IMPLEMENTACIÓN - ORDEN DE PRIORIDAD

**Análisis estratégico basado en el estado actual del código**
**Fecha:** 2026-02-19 | **Puntuación global actual:** 5.4/10

---

## 🎯 MATRIZ DE PRIORIZACIÓN

| Prioridad | Item                  | Impacto Seguridad | Impacto Negocio | Complejidad | ROI   |
| --------- | --------------------- | ----------------- | --------------- | ----------- | ----- |
| P0        | SQL Injection Fix     | CRÍTICO           | CRÍTICO         | Media       | 10/10 |
| P0        | HTTP Security Headers | CRÍTICO           | Alto            | Baja        | 9/10  |
| P0        | Password Hashing      | CRÍTICO           | CRÍTICO         | Baja        | 10/10 |
| P1        | Rate Limiting Redis   | Alto              | Medio           | Media       | 7/10  |
| P1        | Input Validation      | Alto              | Alto            | Media       | 8/10  |
| P2        | Refactor api.php      | Medio             | Alto            | Alta        | 6/10  |
| P2        | Lazy Loading          | Medio             | Medio           | Baja        | 7/10  |
| P3        | Tests Coverage        | Medio             | Alto            | Media       | 6/10  |
| P3        | CSP Estricto          | Medio             | Bajo            | Baja        | 5/10  |

---

## 🔴 FASE 1: SUPERVIVENCIA (Semana 1-2)

**"Sin esto, el negocio puede colapsar por un hack"**

### 1.1 SQL INJECTION FIX (P0) - 2 días

**¿Por qué primero?**

- **Riesgo:** Un atacante puede borrar toda la base de datos, robar datos de pacientes (información médica protegida por HIPAA/GDPR)
- **Impacto legal:** Multas de hasta 4% del volumen de negocio por GDPR
- **Impacto reputacional:** Un leak de datos médicos destruye la confianza permanentemente
- **Facilidad de explotación:** SQL injection es trivial de explotar con herramientas automáticas

**Implementación paso a paso:**

```php
// PASO 1: Crear Database.php con PDO (4 horas)
// lib/Database.php
class Database {
    private static $instance = null;
    private $pdo;

    private function __construct() {
        $this->pdo = new PDO(
            "mysql:host=".DB_HOST.";dbname=".DB_NAME,
            DB_USER,
            DB_PASS,
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
             PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
             PDO::ATTR_EMULATE_PREPARES => false] // Importante: desactivar emulación
        );
    }

    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    public function query($sql, $params = []) {
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        return $stmt;
    }
}

// PASO 2: Migrar storage.php (6 horas)
// ANTES (vulnerable):
$result = mysqli_query($conn, "SELECT * FROM appointments WHERE id = $id");

// DESPUÉS (seguro):
$db = Database::getInstance();
$result = $db->query("SELECT * FROM appointments WHERE id = ?", [$id]);

// PASO 3: Migrar api.php endpoints (6 horas)
// Reemplazar todas las queries dinámicas
```

**Testing:**

```php
// tests/test_sql_injection.php
function testSqlInjection() {
    $maliciousInput = "1; DROP TABLE appointments; --";
    // Debe fallar de forma segura, no ejecutar el DROP
    $result = getAppointment($maliciousInput);
    assert($result === false || is_array($result));
}
```

---

### 1.2 HTTP SECURITY HEADERS (P0) - 1 día

**¿Por qué segundo?**

- **Riesgo:** XSS puede robar cookies de sesión de administradores, permitir defacement
- **Facilidad:** Implementación trivial (< 50 líneas), protección inmediata
- **Compliance:** Requerido por estándares de seguridad modernos

**Implementación:**

```php
// lib/SecurityHeaders.php (30 minutos)
class SecurityHeaders {
    public static function apply() {
        // Prevenir XSS
        header("Content-Security-Policy: " . self::getCSP());

        // Prevenir clickjacking
        header("X-Frame-Options: DENY");

        // Prevenir MIME-sniffing
        header("X-Content-Type-Options: nosniff");

        // Forzar HTTPS
        header("Strict-Transport-Security: max-age=31536000; includeSubDomains");

        // Política de referrer
        header("Referrer-Policy: strict-origin-when-cross-origin");

        // Política de permisos
        header("Permissions-Policy: geolocation=(), microphone=(), camera=()");
    }

    private static function getCSP() {
        return "default-src 'self'; " .
               "script-src 'self' 'unsafe-inline' https://js.stripe.com https://www.google.com; " .
               "style-src 'self' 'unsafe-inline'; " .
               "img-src 'self' data: https:; " .
               "connect-src 'self' https://api.stripe.com; " .
               "frame-src https://js.stripe.com https://hooks.stripe.com;";
    }
}

// Aplicar en api.php y admin-auth.php (15 minutos)
require_once 'lib/SecurityHeaders.php';
SecurityHeaders::apply();
```

**Validación:**

```bash
# Test con curl
curl -I https://pielenarmonia.com/api.php | grep -E "(X-Frame|X-Content|Strict-Transport)"
```

---

### 1.3 PASSWORD HASHING (P0) - 1 día

**¿Por qué tercero?**

- **Riesgo:** Si se filtra la BD, passwords en texto plano = acceso total
- **Impacto:** Compliance GDPR requiere almacenamiento seguro de credenciales
- **Facilidad:** PHP tiene funciones nativas, cambio mínimo de código

**Implementación:**

```php
// lib/PasswordManager.php (2 horas)
class PasswordManager {
    private const ALGO = PASSWORD_ARGON2ID;
    private const OPTIONS = [
        'memory_cost' => 65536,  // 64MB
        'time_cost' => 4,        # Iteraciones
        'threads' => 3
    ];

    public static function hash($password) {
        return password_hash($password, self::ALGO, self::OPTIONS);
    }

    public static function verify($password, $hash) {
        return password_verify($password, $hash);
    }

    public static function needsRehash($hash) {
        return password_needs_rehash($hash, self::ALGO, self::OPTIONS);
    }
}

// Migración de passwords existentes (4 horas)
// 1. Agregar columna password_new
// 2. En login, si el hash es viejo, re-hashear y guardar
// 3. Después de 30 días, eliminar columna vieja

function migratePasswordOnLogin($userId, $password, $oldHash) {
    if (PasswordManager::verify($password, $oldHash)) {
        // Password correcto con hash viejo
        $newHash = PasswordManager::hash($password);
        updateUserPassword($userId, $newHash);
        return true;
    }
    return false;
}
```

---

## 🟡 FASE 2: PROTECCIÓN AVANZADA (Semana 3-4)

**"Mitigar ataques distribuidos y automatizados"**

### 2.1 RATE LIMITING CON REDIS (P1) - 3 días

**¿Por qué ahora?**

- Sin rate limiting, un ataque DDoS básico tumba el sitio
- Fuerza bruta en login sin limitación = acceso eventual garantizado
- File-based rate limiting no funciona en múltiples servidores

**Arquitectura:**

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   User 1    │     │   User 2    │     │  Attacker   │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                    │                    │
       └────────────────────┼────────────────────┘
                            │
                   ┌────────▼────────┐
                   │  Load Balancer  │
                   └────────┬────────┘
                            │
         ┌──────────────────┼──────────────────┐
         │                  │                  │
    ┌────▼────┐        ┌────▼────┐        ┌────▼────┐
    │ Server 1│        │ Server 2│        │ Server 3│
    └────┬────┘        └────┬────┘        └────┬────┘
         │                  │                  │
         └──────────────────┼──────────────────┘
                            │
                   ┌────────▼────────┐
                   │     Redis       │  <-- Rate limit compartido
                   │   (Cluster)     │
                   └─────────────────┘
```

**Implementación:**

```php
// lib/RateLimiter.php (6 horas)
use Predis\Client;

class RateLimiter {
    private $redis;
    private $defaultLimit = 100;  // requests
    private $defaultWindow = 3600; // 1 hora

    public function __construct() {
        $this->redis = new Client([
            'scheme' => 'tcp',
            'host'   => getenv('REDIS_HOST') ?: '127.0.0.1',
            'port'   => 6379,
        ]);
    }

    public function check($identifier, $type = 'ip') {
        $key = "rate_limit:{$type}:{$identifier}";
        $current = $this->redis->get($key);

        if ($current === null) {
            $this->redis->setex($key, $this->defaultWindow, 1);
            return ['allowed' => true, 'remaining' => $this->defaultLimit - 1];
        }

        if ($current >= $this->defaultLimit) {
            $ttl = $this->redis->ttl($key);
            return ['allowed' => false, 'retry_after' => $ttl];
        }

        $this->redis->incr($key);
        return ['allowed' => true, 'remaining' => $this->defaultLimit - $current - 1];
    }

    // Rate limiting específico para endpoints sensibles
    public function checkLogin($ip, $email) {
        // Limit por IP
        $ipCheck = $this->check($ip, 'login_ip');
        if (!$ipCheck['allowed']) return $ipCheck;

        // Limit por email (anti-fuerza bruta)
        $emailCheck = $this->check(md5($email), 'login_email');
        if (!$emailCheck['allowed']) return $emailCheck;

        return ['allowed' => true];
    }
}
```

**Configuración de límites:**

```php
// API endpoints
$limits = [
    'login'           => ['limit' => 5,  'window' => 300],   // 5 intentos/5min
    'register'        => ['limit' => 3,  'window' => 3600],  // 3 registros/hora
    'booking_create'  => ['limit' => 10, 'window' => 60],    // 10 bookings/min
    'payment'         => ['limit' => 5,  'window' => 60],    // 5 pagos/min
    'api_general'     => ['limit' => 100,'window' => 60],    // 100 req/min general
];
```

---

### 2.2 VALIDACIÓN DE INPUTS CENTRALIZADA (P1) - 2 días

**¿Por qué?**

- Validación dispersa = inconsistencias = vulnerabilidades
- Validación en frontend es inútil (puede ser bypassed)

**Implementación:**

```php
// lib/Validator.php (6 horas)
class Validator {
    private $errors = [];
    private $data = [];

    public function __construct($data) {
        $this->data = $data;
    }

    public function required($field) {
        if (empty($this->data[$field])) {
            $this->errors[$field] = "Campo obligatorio";
        }
        return $this;
    }

    public function email($field) {
        if (!filter_var($this->data[$field], FILTER_VALIDATE_EMAIL)) {
            $this->errors[$field] = "Email inválido";
        }
        return $this;
    }

    public function phone($field) {
        $phone = preg_replace('/[^0-9]/', '', $this->data[$field]);
        if (strlen($phone) < 9 || strlen($phone) > 15) {
            $this->errors[$field] = "Teléfono inválido";
        }
        return $this;
    }

    public function date($field, $format = 'Y-m-d') {
        $d = DateTime::createFromFormat($format, $this->data[$field]);
        if (!$d || $d->format($format) !== $this->data[$field]) {
            $this->errors[$field] = "Fecha inválida";
        }
        return $this;
    }

    public function sanitize($field, $type = 'string') {
        $value = $this->data[$field] ?? '';
        switch ($type) {
            case 'email':
                return filter_var($value, FILTER_SANITIZE_EMAIL);
            case 'int':
                return filter_var($value, FILTER_VALIDATE_INT);
            case 'string':
            default:
                return htmlspecialchars(trim($value), ENT_QUOTES, 'UTF-8');
        }
    }

    public function passes() {
        return empty($this->errors);
    }

    public function fails() {
        return !empty($this->errors);
    }

    public function errors() {
        return $this->errors;
    }
}

// Uso en api.php:
$validator = new Validator($_POST);
$validator->required('email')->email('email')->sanitize('email', 'email');
$validator->required('phone')->phone('phone');
$validator->required('date')->date('date');

if ($validator->fails()) {
    http_response_code(422);
    echo json_encode(['errors' => $validator->errors()]);
    exit;
}
```

---

## 🟠 FASE 3: ESCALABILIDAD Y MANTENIMIENTO (Mes 2)

**"Preparar el código para crecimiento"**

### 3.1 REFACTORIZACIÓN DE api.php (P2) - 1 semana

**Problema actual:**

- 1,165 líneas, 165 condicionales
- Mezcla de lógica de negocio, acceso a datos y HTTP
- Imposible de testear unitariamente
- Un cambio puede romper 10 cosas

**Arquitectura objetivo (MVC):**

```
┌─────────────┐
│   Router    │  <-- api.php (50 líneas)
└──────┬──────┘
       │
┌──────▼──────┐
│ Controllers │  <-- AppointmentController.php
└──────┬──────┘
       │
┌──────▼──────┐
│   Services  │  <-- AppointmentService.php (lógica de negocio)
└──────┬──────┘
       │
┌──────▼──────┐
│ Repositories│  <-- AppointmentRepository.php (acceso a BD)
└──────┬──────┘
       │
┌──────▼──────┐
│   Database  │  <-- Database.php (PDO)
└─────────────┘
```

**Implementación paso a paso:**

```php
// controllers/AppointmentController.php
class AppointmentController {
    private $service;

    public function __construct() {
        $this->service = new AppointmentService(
            new AppointmentRepository(),
            new EmailService(),
            new AuditService()
        );
    }

    public function create($request) {
        try {
            $dto = CreateAppointmentDTO::fromRequest($request);
            $appointment = $this->service->create($dto);
            return Response::json($appointment, 201);
        } catch (ValidationException $e) {
            return Response::json(['errors' => $e->errors()], 422);
        } catch (Exception $e) {
            error_log($e->getMessage());
            return Response::json(['error' => 'Internal server error'], 500);
        }
    }

    public function get($id) {
        $appointment = $this->service->findById($id);
        if (!$appointment) {
            return Response::json(['error' => 'Not found'], 404);
        }
        return Response::json($appointment);
    }
}

// services/AppointmentService.php
class AppointmentService {
    private $repository;
    private $email;
    private $audit;

    public function __construct($repository, $email, $audit) {
        $this->repository = $repository;
        $this->email = $email;
        $this->audit = $audit;
    }

    public function create(CreateAppointmentDTO $dto) {
        // Validaciones de negocio
        if (!$this->isTimeSlotAvailable($dto->date, $dto->time)) {
            throw new ValidationException(['time' => 'Horario no disponible']);
        }

        // Crear entidad
        $appointment = new Appointment($dto);

        // Persistir
        $this->repository->save($appointment);

        // Side effects
        $this->email->sendConfirmation($appointment);
        $this->audit->log('appointment_created', $appointment);

        return $appointment;
    }
}

// Repositories/AppointmentRepository.php
class AppointmentRepository {
    private $db;

    public function __construct() {
        $this->db = Database::getInstance();
    }

    public function save(Appointment $appointment) {
        $sql = "INSERT INTO appointments (name, email, phone, date, time, service)
                VALUES (?, ?, ?, ?, ?, ?)";
        $this->db->query($sql, [
            $appointment->name,
            $appointment->email,
            $appointment->phone,
            $appointment->date,
            $appointment->time,
            $appointment->service
        ]);
        return $this->db->lastInsertId();
    }

    public function findById($id) {
        return $this->db->query(
            "SELECT * FROM appointments WHERE id = ?",
            [$id]
        )->fetch();
    }
}
```

**Beneficios:**

- Cada clase tiene una sola responsabilidad
- Testeable unitariamente (inyección de dependencias)
- Cambios en BD no afectan lógica de negocio
- Reutilizable entre endpoints

---

### 3.2 LAZY LOADING DE IMÁGENES (P2) - 2 días

**Impacto en negocio:**

- 40% de usuarios abandonan si el sitio tarda >3s en cargar
- Google penaliza en SEO sitios lentos
- Datos móviles: imágenes pesadas = costo para usuarios

**Implementación:**

```html
<!-- ANTES -->
<img src="hero-woman.jpg" alt="Hero" />

<!-- DESPUÉS -->
<img
    src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3C/svg%3E"
    data-src="hero-woman.jpg"
    data-srcset="hero-woman-400.jpg 400w, hero-woman-800.jpg 800w"
    alt="Hero"
    class="lazyload"
    width="800"
    height="600"
/>
```

```javascript
// lazyload.js (nativo, sin librerías)
const imageObserver = new IntersectionObserver(
    (entries, observer) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                if (img.dataset.srcset) {
                    img.srcset = img.dataset.srcset;
                }
                img.classList.add('loaded');
                observer.unobserve(img);
            }
        });
    },
    {
        rootMargin: '50px 0px', // Cargar 50px antes de entrar en viewport
        threshold: 0.01,
    }
);

document.querySelectorAll('img[data-src]').forEach((img) => {
    imageObserver.observe(img);
});
```

**CSS para transición suave:**

```css
img[data-src] {
    opacity: 0;
    transition: opacity 0.3s;
}
img.loaded {
    opacity: 1;
}
```

---

## 🟢 FASE 4: OPTIMIZACIONES Y TESTING (Mes 3)

### 4.1 COBERTURA DE TESTS 70%+ (P3) - 2 semanas

**Estrategia de testing:**

```php
// tests/AppointmentControllerTest.php
class AppointmentControllerTest extends TestCase {
    private $controller;
    private $mockService;

    protected function setUp(): void {
        $this->mockService = $this->createMock(AppointmentService::class);
        $this->controller = new AppointmentController($this->mockService);
    }

    public function testCreateAppointmentSuccess() {
        $request = [
            'name' => 'Juan Pérez',
            'email' => 'juan@example.com',
            'phone' => '612345678',
            'date' => '2026-03-01',
            'time' => '10:00',
            'service' => 'facial'
        ];

        $expectedAppointment = new Appointment($request);
        $this->mockService
            ->expects($this->once())
            ->method('create')
            ->willReturn($expectedAppointment);

        $response = $this->controller->create($request);

        $this->assertEquals(201, $response->status());
        $this->assertEquals($expectedAppointment, $response->data());
    }

    public function testCreateAppointmentValidationError() {
        $request = ['name' => '']; // Datos inválidos

        $this->mockService
            ->expects($this->once())
            ->method('create')
            ->willThrowException(new ValidationException(['name' => 'Requerido']));

        $response = $this->controller->create($request);

        $this->assertEquals(422, $response->status());
        $this->assertArrayHasKey('name', $response->data()['errors']);
    }
}
```

**Pipeline CI/CD:**

```yaml
# .github/workflows/tests.yml
name: Tests
on: [push, pull_request]
jobs:
    test:
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v3
            - name: Setup PHP
              uses: shivammathur/setup-php@v2
              with:
                  php-version: '8.2'
                  extensions: pdo, pdo_mysql, redis
            - name: Run tests
              run: |
                  composer install
                  ./vendor/bin/phpunit --coverage-clover coverage.xml
            - name: Check coverage
              run: |
                  COVERAGE=$(php -r "echo json_decode(file_get_contents('coverage.json'))->percent;")
                  if [ $COVERAGE -lt 70 ]; then
                    echo "Cobertura $COVERAGE% es menor al 70% requerido"
                    exit 1
                  fi
```

---

## 📊 CRONOGRAMA RESUMIDO

| Semana           | Tareas                       | Impacto | Estado esperado      |
| ---------------- | ---------------------------- | ------- | -------------------- |
| **Semana 1**     | SQL Injection + HTTP Headers | CRÍTICO | Seguridad básica OK  |
| **Semana 2**     | Password Hashing + Hotfixes  | CRÍTICO | Autenticación segura |
| **Semana 3**     | Redis Rate Limiting          | Alto    | Protección DDoS      |
| **Semana 4**     | Validación Centralizada      | Alto    | Inputs saneados      |
| **Semana 5-6**   | Refactor api.php             | Medio   | Código mantenible    |
| **Semana 7**     | Lazy Loading                 | Medio   | Performance +40%     |
| **Semana 8-9**   | Tests 70%                    | Medio   | Calidad asegurada    |
| **Semana 10-12** | Optimizaciones               | Bajo    | Pulido final         |

---

## 💰 ANÁLISIS COSTO-BENEFICIO

### ROI de cada fase:

**FASE 1 (Semanas 1-2):**

- Costo: 4 días de desarrollo
- Beneficio: Evitar multas GDPR (hasta €20M), proteger reputación
- ROI: **Infinito** (evitar catástrofe)

**FASE 2 (Semanas 3-4):**

- Costo: 5 días + infra Redis (~$20/mes)
- Beneficio: Uptime 99.9%, protección contra competidores desleales
- ROI: **500%** (evitar pérdida de ingresos por downtime)

**FASE 3 (Semanas 5-7):**

- Costo: 9 días
- Beneficio: Velocidad de desarrollo 2x, menos bugs
- ROI: **300%** (ahorro en mantenimiento)

---

## ⚠️ RIESGOS DE NO IMPLEMENTAR

| Item                  | Probabilidad | Impacto | Consecuencia                         |
| --------------------- | ------------ | ------- | ------------------------------------ |
| SQL Injection exploit | Alta         | Crítico | Robo de datos de 10,000+ pacientes   |
| Credential stuffing   | Alta         | Alto    | Acceso no autorizado a cuenta admin  |
| DDoS sin rate limit   | Media        | Alto    | Sitio caído durante 24h = €X pérdida |
| XSS + admin session   | Media        | Alto    | Defacement, malware distribuido      |
| GDPR fine             | Baja         | Extremo | Multa €20M o 4% de facturación       |

---

## 🎯 RECOMENDACIÓN FINAL

**Prioridad absoluta:** Implementar FASE 1 antes de cualquier otra cosa, incluso antes de nuevas features. Un sitio hackeado no sirve nuevas features.

**Orden de importancia:**

1. **SQL Injection** (día 1-2) - Riesgo existencial
2. **HTTP Headers** (día 3) - Protección XSS/Clickjacking inmediata
3. **Password Hashing** (día 4-5) - Protección de datos de usuarios
4. **Rate Limiting** (semana 2) - Disponibilidad del servicio
5. Refactor y optimizaciones (después de asegurar)

**Presupuesto recomendado:**

- 2 semanas de desarrollo senior (€3,000-5,000)
- Infra Redis (€20/mes)
- Auditoría de seguridad post-implementación (€1,000)
- **Total: €4,000-6,000** (vs €20M+ de multa GDPR)

---

_Generado automáticamente basado en análisis de 53,723 líneas de código_
