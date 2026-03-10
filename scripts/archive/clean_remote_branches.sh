#!/bin/bash

# Script para limpiar ramas remotas mergeadas a main
# Uso: ./clean_remote_branches.sh

echo "==================================================="
echo "LIMPIEZA DE RAMAS REMOTAS MERGEADAS A MAIN"
echo "==================================================="
echo ""

# Fetch latest
echo "1. Actualizando referencias remotas..."
git fetch --prune

# Obtener ramas remotas mergeadas a main (excluyendo main y HEAD)
echo ""
echo "2. Identificando ramas mergeadas..."
MERGED_BRANCHES=$(git branch -r --merged origin/main | grep -v "origin/main" | grep -v "origin/HEAD" | sed 's/origin\///' | xargs)

if [ -z "$MERGED_BRANCHES" ]; then
    echo "   No hay ramas remotas mergeadas para eliminar."
    exit 0
fi

echo "   Ramas a eliminar:"
for branch in $MERGED_BRANCHES; do
    echo "     - $branch"
done

echo ""
echo "3. Eliminando ramas remotas..."
echo "   Total: $(echo $MERGED_BRANCHES | wc -w) ramas"
echo ""

# Eliminar cada rama
for branch in $MERGED_BRANCHES; do
    echo "   Eliminando: origin/$branch"
    git push origin --delete "$branch" 2>/dev/null || echo "     ⚠️ No se pudo eliminar (protegida o ya eliminada)"
done

echo ""
echo "==================================================="
echo "LIMPIEZA COMPLETADA"
echo "==================================================="
echo ""
echo "Ramas remotas restantes:"
git branch -r | wc -l
echo ""
