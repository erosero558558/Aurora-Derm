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

## Sistema de tres agentes: Claude Code + Jules + Kimi

### División de trabajo

| Tarea | Agente | Velocidad |
|---|---|---|
| Decisiones de arquitectura | **Claude Code** | Inmediata |
| Debugging interactivo / tiempo real | **Claude Code** | Inmediata |
| Fixes pequeños y precisos | **Claude Code** | Inmediata |
| Review de PRs y coordinación | **Claude Code** | Inmediata |
| Tareas PHP aisladas → PR en GitHub | **Jules** | Async (horas) |
| Tests automatizados nuevos | **Jules** | Async (horas) |
| Migrations, scripts, OpenAPI | **Jules** | Async (horas) |
| Refactoring local sin PR | **Kimi** | Local (~minutos) |
| Análisis y auditoría de código | **Kimi** | Local (~minutos) |
| JSDoc / PHPDoc masivo | **Kimi** | Local (~minutos) |
| Tareas del backlog de `JULES_TASKS.md` | **Jules** | Async |
| Tareas del backlog de `KIMI_TASKS.md` | **Kimi** | Local |

### Cuándo usar cada agente

```
¿Necesita PR en GitHub?
  ├─ Sí  → Jules (jules-dispatch.js dispatch)
  └─ No  ┬─ ¿Requiere decisión interactiva?
         │   ├─ Sí → Claude Code
         │   └─ No → Kimi (kimi-run.js "prompt")
```

### Comandos rápidos

```bash
# Jules — async, crea PRs
JULES_API_KEY=xxx node jules-dispatch.js dispatch   # despachar pendientes
JULES_API_KEY=xxx node jules-dispatch.js status     # ver sesiones
JULES_API_KEY=xxx node jules-dispatch.js watch      # monitorear

# Kimi — local, modifica archivos directamente
node kimi-run.js "Agrega PHPDoc a lib/audit.php"   # tarea inline
node kimi-run.js --dispatch                         # correr KIMI_TASKS.md
node kimi-run.js --list                             # ver estado
node kimi-run.js --dispatch --commit                # correr y auto-commitear
```

### Cuándo NO delegar (ni a Jules ni a Kimi)
- Toca el flujo de pago Stripe o autenticación
- Requiere conocimiento de negocio no documentado
- Hay sesiones activas que tocan los mismos archivos (riesgo de conflicto)

---

## Memoria importante

- `js/booking-calendar.js` y `js/engines/booking-utils.js` son generados por el build — no editar directo
- `window.debugLog` fue removido — si algún agente lo re-añade, restaurar: `git checkout HEAD -- <file>`
- Vendor files (`vendor/composer/`) — si cambian sin `composer install` explícito, restaurar desde HEAD
- El SW tiene `CACHE_NAME` — bumpearlo cuando cambien assets en precache
- i18n: `state.js` usa `navigator.language` como fallback, `localStorage.language` como preferencia

---

## Referencias rápidas

### Jules
- **Backlog**: `JULES_TASKS.md`
- **Dispatcher**: `jules-dispatch.js`
- **CI/labels**: `.github/workflows/jules-pr.yml`
- **Source ID**: `github/erosero558558/piel-en-armonia`
- **API key**: env var `JULES_API_KEY` (nunca commitear)

### Kimi
- **Backlog**: `KIMI_TASKS.md`
- **Runner**: `kimi-run.js`
- **Binario**: `%APPDATA%\Code\User\globalStorage\moonshot-ai.kimi-code\bin\kimi\kimi.exe`
- **Modelo**: `kimi-for-coding` (262k contexto, thinking mode disponible)
- **Override bin**: env var `KIMI_BIN`
