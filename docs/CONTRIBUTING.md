# Guía de Contribución

Gracias por tu interés en contribuir a Piel en Armonía. Este documento describe el proceso para configurar el entorno de desarrollo y enviar cambios.

## 1. Configuración del Entorno

### Requisitos Previos

- **PHP 8.0+** (Recomendado 8.2) con extensiones `mbstring`, `json`, `openssl`, `gd`.
- **Node.js 18+** y npm.
- **Git**.

### Instalación

1.  Clonar el repositorio:

    ```bash
    git clone https://github.com/tu-usuario/pielarmonia.git
    cd pielarmonia
    ```

2.  Instalar dependencias de Node.js:

    ```bash
    npm install
    ```

3.  Instalar navegadores para pruebas E2E (Playwright):

    ```bash
    npx playwright install chromium
    ```

4.  Iniciar servidor local:
    ```bash
    php -S 127.0.0.1:8011 -t . bin/local-stage-router.php
    ```
    Ahora puedes acceder a `http://127.0.0.1:8011`.
    Si una suite debe reutilizar otro servidor ya levantado, apunta `TEST_BASE_URL`
    a ese host en lugar de depender de puertos locales heredados.

## 2. Estándares de Código

### JavaScript

Utilizamos **ESLint** para asegurar la calidad del código JS.

- Ejecutar linter: `npm run lint:js`
- Configuración: `eslint.config.js` (Soporte para ES Modules y CommonJS).

### PHP

Nos adherimos a buenas prácticas de PHP moderno y verificamos la sintaxis.

- Verificar sintaxis: `npm run lint:php`
- Estilo: Mantener consistencia con el código existente (espaciado, llaves, tipos estrictos `declare(strict_types=1);`).

## 3. Pruebas (Testing)

Es obligatorio que todos los cambios pasen las pruebas automatizadas antes de enviar un PR.

### Unitarias (PHP)

Prueban la lógica de negocio en `lib/`.

```bash
npm run test:php
# O directamente: bash tests/run-php-tests.sh
```

`php tests/run-php-tests.php` ya levanta sus servidores locales con un helper
portable (`127.0.0.1`) y funciona igual en Windows o Unix. Para sumar los
smokes/integration opt-in usa `PIELARMONIA_TEST_INCLUDE_INTEGRATION=1`.

### End-to-End (Playwright)

Prueban el flujo completo de usuario en el navegador.

```bash
# Ejecutar todos los tests (headless)
npm test

# Ejecutar con interfaz visual
npm run test:ui
```

## 4. Proceso de Pull Request (PR)

1.  **Branching:** Crea una rama descriptiva desde `origin/main`:
    - `feature/nueva-funcionalidad`
    - `bugfix/arreglo-critico`
    - `docs/actualizacion-guia`

    Flujo recomendado:

    ```bash
    bash ./bin/git-branch-publish.sh start feature/nueva-funcionalidad
    ```

    Cuando el branch ya tenga commits listos para subir:

    ```bash
    bash ./bin/git-branch-publish.sh publish
    ```

    El comando `publish` exige `git status` limpio, bloquea `push` directo a `main` y, si detecta cambios de gobernanza/orquestación, ejecuta `npm run agent:conflicts`, `npm run agent:handoffs:lint` y `npm run agent:codex-check` antes del `push`.

    Si la iniciativa toca mas de una superficie grande, no la metas en una
    sola rama. Usa `docs/BRANCH_SLICING_GUARDRAILS.md` y separa, por defecto:
    - `ops/deploy`
    - `queue runtime`
    - `desktop shells`
    - `tests`
    - `governance evidence`

    Regla corta: source + outputs generados pueden viajar juntos; limpieza
    amplia de tests, cambios de deploy y evidencia de gobernanza no deben
    colarse en la misma rama salvo que el acople sea explicito y lo expliques
    en el PR.

2.  **Commits:** Usa mensajes claros y en imperativo.
    - Bien: `Add appointment validation logic`
    - Mal: `fix bug`

3.  **Descripción:** En el PR, describe _qué_ cambiaste y _por qué_. Adjunta capturas de pantalla si es un cambio visual.

4.  **Review:** Espera la aprobación de un mantenedor. El CI ejecutará automáticamente los tests.

## 5. Reporte de Bugs

Si encuentras un error, por favor abre un Issue en GitHub incluyendo:

- Pasos para reproducir.
- Comportamiento esperado vs real.
- Capturas de pantalla o logs si aplica.
