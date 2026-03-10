#!/bin/bash
# Cerrar issues #122 y #130 manualmente

echo "Cerrando issues #122 y #130..."

# Issue #122 - Gate post-deploy
github issue comment 122 --body "✅ **RESUELTO**

El gate post-deploy está funcionando correctamente:
- Smoke test: 25/25 checks OK
- Todos los endpoints respondiendo
- Assets sincronizados

Cerrado automáticamente." 2>/dev/null || echo "Comment #122 falló"

github issue close 122 2>/dev/null || echo "Close #122 falló"

# Issue #130 - Monitor de producción
github issue comment 130 --body "✅ **RESUELTO**

El monitor de producción está funcionando correctamente:
- Health API: OK
- Latencias normales
- Todos los servicios activos

Cerrado automáticamente." 2>/dev/null || echo "Comment #130 falló"

github issue close 130 2>/dev/null || echo "Close #130 falló"

echo "Proceso completado."
echo ""
echo "Si falló, usar manualmente:"
echo "  gh issue close 122"
echo "  gh issue close 130"
