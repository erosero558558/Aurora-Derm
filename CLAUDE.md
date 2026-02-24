# CLAUDE.md — Guía de trabajo para Claude Code

## Proyecto: Piel en Armonía
Clínica dermatológica · pielarmonia.com · Stack: PHP 8 + Vanilla JS + Rollup

---

## Comandos esenciales

```bash
npm run build          # Rollup: compila src/ → js/engines/ y script.js
npm run test:php       # PHP unit tests (auto-descubre tests/)
npm run lint:js        # ESLint
npm test               # Playwright E2E
```

---

## Arquitectura clave

| Capa | Dónde |
|---|---|
| Fuentes JS | `src/apps/` → bundled → `js/engines/` via Rollup |
| Traducciones | `content/es.json`, `content/en.json` |
| Contenido diferido | `content/index.json` (cargado por content-loader.js) |
| Estilos críticos | `styles-critical.css` (inline en HTML) |
| Estilos diferidos | `styles-deferred.css` (preload async) |
| Backend | PHP en raíz + `lib/` |
| Tests PHP | `tests/` — run-php-tests.php auto-descubre |
| Namespace JS | `window.Piel.*` y legacy `window.Piel{Engine}` |

---

## Reglas de trabajo

### Lo que NO tocar nunca sin preguntar
- Flujo de pagos Stripe (`js/booking.js`, `stripe-webhook.php`)
- Credenciales en `.env` o `config.php`
- Force push a `main`
- Borrar ramas sin confirmar

### Antes de cada commit
1. Si modifiqué `src/`, ejecutar `npm run build`
2. Si modifiqué `styles-deferred.css` o CSS crítico, verificar que no rompe responsive
3. `git pull --rebase origin main` antes de push (Codex y Jules pushean en paralelo)

### Pattern de rescue cuando hay conflictos con Codex/Jules
```bash
git stash && git pull --rebase origin main && git stash pop && git push origin main
```

---

## Sistema de dos agentes: Claude Code + Jules

### División de trabajo

| Tarea | Asignada a |
|---|---|
| Decisiones de arquitectura | **Claude Code** |
| Debugging interactivo / tiempo real | **Claude Code** |
| Fixes pequeños y precisos | **Claude Code** |
| Review de PRs de Jules | **Claude Code** |
| Coordinación y priorización | **Claude Code** |
| Tareas PHP aisladas y bien definidas | **Jules** |
| Tests automatizados nuevos | **Jules** |
| Refactoring de archivos grandes | **Jules** |
| Documentación técnica (JSDoc, OpenAPI) | **Jules** |
| Email templates, migrations, scripts | **Jules** |
| Tareas del backlog de `JULES_TASKS.md` | **Jules** |

### Cómo agregar tareas para Jules
1. Editar `JULES_TASKS.md` — agregar entrada en la sección `## Pendiente`
2. Ejecutar: `JULES_API_KEY=xxx node jules-dispatch.js dispatch`
3. Monitorear: `JULES_API_KEY=xxx node jules-dispatch.js watch`
4. Jules abre un PR → CI corre automáticamente → revisar y mergear

### Cuándo NO delegar a Jules
- La tarea requiere decisiones de negocio no documentadas
- Toca el flujo de pago o autenticación
- Depende de estado de otra sesión Jules activa (pueden generar conflictos)
- Requiere múltiples iteraciones interactivas

---

## Memoria importante

- Los archivos `js/booking-calendar.js` y `js/engines/booking-utils.js` son regenerados por el build — no editarlos directamente
- `window.debugLog` fue removido intencionalmente — si Codex o Jules lo re-añaden, restaurar desde HEAD
- Vendor files (`vendor/composer/`) — si cambian sin un `composer install` explícito, restaurar desde HEAD
- El SW tiene `CACHE_NAME` — bumpearlo cuando se modifiquen assets en precache
- i18n: `state.js` usa `navigator.language` como fallback, `localStorage.language` como preferencia explícita

---

## Jules — fuente de verdad

- **Backlog**: `JULES_TASKS.md`
- **Dispatcher**: `jules-dispatch.js`
- **PRs de Jules**: etiquetados automáticamente con `jules` por `.github/workflows/jules-pr.yml`
- **Source ID**: `github/erosero558558/piel-en-armonia`
- **API key**: variable de entorno `JULES_API_KEY` (nunca commitear)
