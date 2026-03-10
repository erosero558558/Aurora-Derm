# 📋 HANDOFF PARA JULES - Continuación de Trabajo

**Fecha:** 2026-02-20  
**Estado Actual:** Sistema estable en producción, API keys rotadas, seguridad implementada  
**Prioridad:** Testing y cobertura de código

---

## 🎯 CONTEXTO RÁPIDO

### ✅ Estado Actual (Funcionando)

- **Producción:** https://pielarmonia.com - Gate pasa ✅
- **Seguridad:** SQL injection protegido, headers CSP, rate limiting ✅
- **CI/CD:** 5 workflows activos, deploy automático ✅
- **API Key:** Recién rotada (línea 40 de env.php)

### 🔴 Problema Principal

**Cobertura de tests: ~5%** (solo 1 test unitario existe: `tests/Unit/ApiLibTest.php`)

**Consecuencia:** Cualquier cambio en booking/payments es riesgoso sin validación automática.

---

## 📋 PASOS A SEGUIR (En Orden)

### **PASO 1: Verificar Entorno de Desarrollo**

```bash
# 1.1 Clonar y entrar al proyecto
git clone https://github.com/erosero558558/piel-en-armonia.git
cd piel-en-armonia

# 1.2 Verificar que estás en main y actualizado
git checkout main
git pull origin main

# 1.3 Verificar dependencias de PHP (para tests)
composer install

# 1.4 Verificar dependencias de Node
npm ci

# 1.5 Verificar que todo funciona
npm run gate:prod:strict
```

**Éxito:** El comando `gate:prod:strict` debe mostrar "Gate OK" al final.

---

### **PASO 2: Crear Estructura de Tests Unitarios**

Crear los archivos que faltan:

```bash
# Crear directorios faltantes
mkdir -p tests/Unit/Booking
mkdir -p tests/Unit/Payment
mkdir -p tests/Unit/Security
mkdir -p tests/Unit/Auth
mkdir -p tests/Integration
```

**Estructura objetivo:**

```
tests/
├── Unit/
│   ├── ApiLibTest.php              (ya existe ✅)
│   ├── Booking/
│   │   ├── BookingServiceTest.php  (crear)
│   │   └── AvailabilityTest.php    (crear)
│   ├── Payment/
│   │   └── StripeServiceTest.php   (crear)
│   ├── Security/
│   │   └── RateLimiterTest.php     (crear)
│   └── Auth/
│       └── AuthSessionTest.php     (crear)
└── Integration/
    └── BookingFlowTest.php         (crear)
```

---

### **PASO 3: Implementar Tests (Prioridad 1)**

#### **3.1 BookingServiceTest.php** (MÁS IMPORTANTE)

Crear archivo: `tests/Unit/Booking/BookingServiceTest.php`

```php
<?php
declare(strict_types=1);

namespace Tests\Unit\Booking;

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../../lib/booking.php';

class BookingServiceTest extends TestCase
{
    // Test 1: Crear booking válido
    public function testCreateBookingSuccess(): void
    {
        $data = [
            'service' => 'consulta',
            'doctor' => 'rosero',
            'date' => '2026-03-15',
            'time' => '10:00',
            'name' => 'Juan Pérez',
            'email' => 'juan@test.com',
            'phone' => '0991234567'
        ];

        // TODO: Llamar función que crea booking
        // $result = create_booking($data);

        // $this->assertArrayHasKey('id', $result);
        // $this->assertEquals('pending', $result['status']);
    }

    // Test 2: Prevenir booking en slot ocupado
    public function testCreateBookingTimeSlotTaken(): void
    {
        // TODO: Crear booking en slot X, intentar crear otro en mismo slot
        // Debe fallar con error de conflicto
    }

    // Test 3: Prevenir booking en fecha pasada
    public function testCreateBookingPastDate(): void
    {
        $data = [
            'date' => '2020-01-01', // Fecha pasada
            'time' => '10:00'
        ];

        // TODO: Intentar crear booking
        // Debe fallar con error de fecha inválida
    }

    // Test 4: Cancelar booking
    public function testCancelBooking(): void
    {
        // TODO: Crear booking, luego cancelarlo
        // Verificar que status cambia a 'cancelled'
    }

    // Test 5: Reprogramar booking
    public function testRescheduleBooking(): void
    {
        // TODO: Crear booking, cambiar fecha/hora
        // Verificar que se actualiza correctamente
    }
}
```

**Comando para probar:**

```bash
vendor/bin/phpunit tests/Unit/Booking/BookingServiceTest.php
```

---

#### **3.2 RateLimiterTest.php** (SEGURIDAD)

Crear archivo: `tests/Unit/Security/RateLimiterTest.php`

```php
<?php
declare(strict_types=1);

namespace Tests\Unit\Security;

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../../lib/ratelimit.php';

class RateLimiterTest extends TestCase
{
    // Test 1: Permitir requests dentro del límite
    public function testAllowRequestsWithinLimit(): void
    {
        // TODO: Llamar check_rate_limit 5 veces
        // Todas deben retornar true (permitido)
    }

    // Test 2: Bloquear requests que exceden límite
    public function testBlockRequestsExceedingLimit(): void
    {
        // TODO: Llamar check_rate_limit 100 veces rápido
        // Después de X intentos, debe retornar false (bloqueado)
    }

    // Test 3: Reset después de ventana de tiempo
    public function testRateLimitResetsAfterWindow(): void
    {
        // TODO: Llamar hasta bloquear, esperar 1 minuto
        // Verificar que se permite de nuevo
    }
}
```

**Comando para probar:**

```bash
vendor/bin/phpunit tests/Unit/Security/RateLimiterTest.php
```

---

#### **3.3 AuthSessionTest.php** (AUTENTICACIÓN)

Crear archivo: `tests/Unit/Auth/AuthSessionTest.php`

```php
<?php
declare(strict_types=1);

namespace Tests\Unit\Auth;

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../../lib/auth.php';

class AuthSessionTest extends TestCase
{
    // Test 1: Sesión se crea con flags seguros
    public function testSessionCreatedWithSecureFlags(): void
    {
        // TODO: Iniciar sesión
        // Verificar: httponly, secure, samesite
    }

    // Test 2: Sesión expira por inactividad
    public function testSessionExpiresAfterInactivity(): void
    {
        // TODO: Simular 31 minutos de inactividad
        // Verificar que sesión se destruye
    }

    // Test 3: Password verificación funciona
    public function testPasswordVerification(): void
    {
        // TODO: Crear hash de password, verificar contra hash correcto e incorrecto
    }
}
```

---

### **PASO 4: Integrar en CI/CD**

Verificar que `phpunit.xml` incluye los nuevos tests:

```xml
<!-- phpunit.xml -->
<testsuites>
    <testsuite name="Unit">
        <directory>tests/Unit</directory>
        <directory>tests/Unit/Booking</directory>
        <directory>tests/Unit/Security</directory>
        <directory>tests/Unit/Auth</directory>
    </testsuite>
</testsuites>
```

**Probar todo:**

```bash
vendor/bin/phpunit --coverage-text
```

**Meta:** Ver "Coverage: ~30%" (vs 5% actual)

---

### **PASO 5: Verificar en GitHub Actions**

Hacer commit y push:

```bash
git add tests/
git commit -m "test: Add unit tests for Booking, Security, and Auth

- BookingServiceTest: 5 tests (create, conflict, past date, cancel, reschedule)
- RateLimiterTest: 3 tests (within limit, blocking, reset)
- AuthSessionTest: 3 tests (secure flags, timeout, password)"

git push origin main
```

**Verificar en:** https://github.com/erosero558558/piel-en-armonia/actions

Buscar workflow "CI" → Job "unit-tests" → Debe pasar ✅

---

## 🎯 CRITERIOS DE ÉXITO

### Antes de empezar:

- [ ] `npm run gate:prod:strict` pasa
- [ ] `vendor/bin/phpunit` corre (aunque con pocos tests)

### Después de completar:

- [ ] Al menos 3 archivos de tests nuevos creados
- [ ] Cobertura sube de 5% a ~25-30%
- [ ] CI/CD pasa en GitHub Actions
- [ ] Tests verifican lógica crítica (booking, seguridad, auth)

---

## 📚 REFERENCIAS ÚTILES

### Archivos importantes ya existentes:

- `tests/Unit/ApiLibTest.php` - Ejemplo de test funcional
- `lib/booking.php` - Lógica de booking (si existe)
- `lib/ratelimit.php` - Rate limiting
- `lib/auth.php` - Autenticación
- `phpunit.xml` - Configuración de PHPUnit
- `.github/workflows/ci.yml` - CI/CD pipeline

### Comandos útiles:

```bash
# Ver cobertura detallada
vendor/bin/phpunit --coverage-html coverage/

# Correr solo un test específico
vendor/bin/phpunit tests/Unit/Booking/BookingServiceTest.php --filter testCreateBookingSuccess

# Ver estado de tests antes de push
npm run test:php
```

---

## ⚠️ NOTAS IMPORTANTES

1. **NO modificar `env.php`** - Ya está configurado y tiene la API key nueva
2. **NO modificar lógica de producción** - Solo agregar tests, no cambiar comportamiento
3. **Si un test falla** - Puede ser que el código tenga un bug, documentarlo
4. **Prioridad:** Booking > Seguridad > Auth > Otros
5. **Si atascado:** Revisar `tests/Unit/ApiLibTest.php` como ejemplo de patrón

---

## 🆘 ESCALACIÓN

Si encuentras problemas:

1. **Tests no corren localmente** → Verificar `composer install` funcionó
2. **Código no tiene funciones testeables** → Refactorizar a clases/funciones puras
3. **Dependencias de BD** → Crear mocks/stubs (no usar BD real en unit tests)
4. **Dudas de arquitectura** → Revisar `lib/` existente como referencia

---

**Buena suerte, Jules! 🚀**

_Documento creado por Kimi - 2026-02-20_
