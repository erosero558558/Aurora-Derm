# Reporte de Auditoria de Seguridad - Piel en Armonia

Fuente canonica del baseline de auditoria de seguridad.
`SECURITY_AUDIT.md` en la raiz queda solo como shim compatible.
Guia viva relacionada: `docs/SECURITY.md`.

**Fecha:** 19 de Febrero de 2026
**Auditor:** Jules (AI Software Engineer)
**Alcance:** API Backend (`api.php`), Autenticación, Rate Limiting, Validaciones de Entrada.

## Resumen Ejecutivo

Se realizaron pruebas de penetracion basicas sobre la aplicacion web "Piel en Armonia". Las pruebas cubrieron inyeccion SQL, XSS, CSRF, validacion de autenticacion y verificacion de rate limiting.

**Resultado General:** La aplicación demuestra un nivel de seguridad adecuado para su arquitectura actual. No se encontraron vulnerabilidades críticas explotables de inmediato, aunque se recomienda fortalecer la sanitización de entradas para mitigar riesgos de XSS almacenado.

---

## 1. Inyección SQL

**Prueba:** Se intentó inyectar payloads SQL (`' OR '1'='1`) en los parámetros `doctor` y `id` de los endpoints de citas.
**Resultado:** **PASÓ (No Vulnerable)**
**Detalle:** La aplicación utiliza almacenamiento basado en archivos JSON (`data/store.json`) y no una base de datos SQL relacional. Por lo tanto, no es vulnerable a inyección SQL clásica. La herramienta `sqlmap` no es aplicable en este contexto.
**Recomendación:** Mantener el uso de almacenamiento seguro de archivos con permisos adecuados (ya implementado mediante `.htaccess` en `lib/storage.php`).

## 2. Cross-Site Scripting (XSS)

**Prueba:** Se enviaron payloads XSS (`<script>alert('XSS')</script>`) al endpoint `POST /appointments`.
**Resultado:** **ADVERTENCIA (Payload Almacenado)**
**Detalle:** El backend (`lib/models.php`) **no sanitiza** las entradas HTML, permitiendo que scripts maliciosos se guarden en `store.json`.
**Mitigación:** El panel de administración (`admin.js`) utiliza consistentemente `escapeHtml()` antes de renderizar cualquier dato del usuario en el DOM, lo que previene la ejecución del script.
**Recomendación:** Implementar sanitización en el backend (ej. `htmlspecialchars`) en `lib/models.php` o `lib/validation.php` para defensa en profundidad, evitando depender únicamente del frontend.

## 3. Cross-Site Request Forgery (CSRF)

**Prueba:** Se intentó acceder a endpoints protegidos de administración (`POST /import`) sin el encabezado `X-CSRF-Token`.
**Resultado:** **PASÓ (Protegido)**
**Detalle:** La aplicación rechaza correctamente las solicitudes sin token con un código `403 Forbidden`. Las solicitudes autenticadas con token válido fueron aceptadas.

## 4. Autenticación y Control de Acceso

**Prueba:** Se intentó acceder a recursos protegidos sin cookies de sesión.
**Resultado:** **PASÓ (Protegido)**
**Detalle:** El sistema responde con `401 Unauthorized` al intentar acceder sin sesión válida. Las sesiones se gestionan con cookies `HttpOnly` y `Secure`.

## 5. Rate Limiting

**Prueba:** Se enviaron ráfagas de solicitudes al endpoint `POST /appointments` (límite: 5 req/60s).
**Resultado:** **PASÓ (Efectivo)**
**Detalle:** El sistema bloqueó las solicitudes excedentes a partir de la 6ª petición, devolviendo `429 Too Many Requests`.
**Observación:** La implementación basada en archivos (`lib/ratelimit.php`) es adecuada para el tráfico esperado, aunque podría tener condiciones de carrera en alta concurrencia (mitigado parcialmente con `LOCK_EX` en escritura, pero lectura no bloqueante).

---

## Conclusión

La aplicación es resistente a los ataques probados. La principal área de mejora es la sanitización de datos en el backend para prevenir XSS almacenado de manera redundante.
