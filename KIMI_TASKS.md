# KIMI_TASKS.md — Backlog local para Kimi Code

> Kimi ejecuta tareas **directamente en el repo local** (no crea PRs).
> Revisar con `git diff` antes de commitear.
>
> Correr una tarea: `node kimi-run.js "prompt"`
> Correr todas las pendientes: `node kimi-run.js --dispatch`
> Ver estado: `node kimi-run.js --list`
>
> Con auto-commit: `node kimi-run.js --dispatch --commit`

---

## Diferencia vs Jules

| Criterio | Jules | Kimi |
|---|---|---|
| Ejecución | Async, en la nube | Local, inmediata |
| Resultado | PR en GitHub | Archivos modificados |
| Revisión | Merge del PR | `git diff` + commit manual |
| Ideal para | Backend aislado, tests | Refactoring rápido, análisis |

---

## Formato de tarea

```
<!-- TASK
status: pending | running | done | failed
-->
### Título de la tarea

Prompt completo aquí...

<!-- /TASK -->
```

---

## Tareas

<!-- TASK
status: pending
-->
### Audit: dead code in js/engines/

Analyze all files in js/engines/ and identify:
1. Functions/variables that are defined but never called within the bundle
2. Console.log or debug statements that should not be in production
3. Any TODO/FIXME comments with their file and line number

Output a markdown report saved to docs/dead-code-audit.md. Do not modify
any JS files — analysis only.

<!-- /TASK -->

<!-- TASK
status: pending
-->
### Add .editorconfig and normalize indentation

Create a .editorconfig file for this project with:
- indent_style = space, indent_size = 4 for PHP and JS
- indent_style = space, indent_size = 2 for JSON, YAML, TOML
- end_of_line = lf
- charset = utf-8
- trim_trailing_whitespace = true
- insert_final_newline = true

Also check if .gitattributes exists and ensure it has:
  * text=auto
  *.php text eol=lf
  *.js text eol=lf
  *.css text eol=lf
  *.json text eol=lf

Do NOT modify any source files — only create/update config files.

<!-- /TASK -->

<!-- TASK
status: pending
-->
### JSDoc: document all public functions in lib/

Read every PHP file in lib/ and add PHPDoc blocks to any public/protected
function that lacks one. Format:
  /**
   * Brief description.
   *
   * @param type $name Description
   * @return type Description
   * @throws ExceptionType When condition
   */

Only add missing docs — do not modify existing ones. Do not change logic.
Focus on: lib/audit.php, lib/ratelimit.php, lib/appointments.php,
lib/payments.php, lib/email.php

<!-- /TASK -->
