import os
import re
import sys

def get_imports(filepath):
    imports = []
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            # Match import ... from '...'
            matches = re.findall(r"import\s+.*?from\s+['\"](.*?)['\"]", content)
            for match in matches:
                imports.append(match)
            # Match import '...'
            matches = re.findall(r"import\s+['\"](.*?)['\"]", content)
            for match in matches:
                imports.append(match)
            # Match dynamic import(...) - harder to trace statically but worth noting if we could
            # For now let's stick to static imports
    except Exception as e:
        print(f"Error reading {filepath}: {e}")
    return imports

def resolve_path(base_path, import_path):
    # This is a simplified resolver. It assumes imports are relative or from src root.
    # It doesn't fully emulate node resolution (node_modules etc) but we are interested in internal loops.

    if import_path.startswith('.'):
        # Relative path
        base_dir = os.path.dirname(base_path)
        resolved = os.path.normpath(os.path.join(base_dir, import_path))
        if not resolved.endswith('.js'):
             if os.path.exists(resolved + '.js'):
                 resolved += '.js'
             elif os.path.exists(os.path.join(resolved, 'index.js')):
                 resolved = os.path.join(resolved, 'index.js')
        return resolved
    else:
        # Assuming non-relative imports might be aliases or node_modules.
        # If the project uses 'src/' as root alias, we might need to handle it.
        # For now, let's ignore node_modules and focus on relative imports which are most likely to cause internal loops.
        return None

def find_cycles(start_dir):
    graph = {}
    files = []
    for root, _, filenames in os.walk(start_dir):
        for filename in filenames:
            if filename.endswith('.js') or filename.endswith('.mjs'):
                files.append(os.path.join(root, filename))

    file_map = {os.path.abspath(f): f for f in files}

    for f in files:
        abs_path = os.path.abspath(f)
        graph[abs_path] = []
        imports = get_imports(f)
        for imp in imports:
            resolved = resolve_path(f, imp)
            if resolved and os.path.abspath(resolved) in file_map:
                graph[abs_path].append(os.path.abspath(resolved))

    # Detect cycles using DFS
    visited = set()
    recursion_stack = set()
    cycles = []

    def dfs(node, path):
        visited.add(node)
        recursion_stack.add(node)
        path.append(node)

        if node in graph:
            for neighbor in graph[node]:
                if neighbor not in visited:
                    dfs(neighbor, path)
                elif neighbor in recursion_stack:
                    # Cycle detected
                    cycle = path[path.index(neighbor):] + [neighbor]
                    cycles.append(cycle)

        recursion_stack.remove(node)
        path.pop()

    for node in graph:
        if node not in visited:
            dfs(node, [])

    return cycles, file_map

if __name__ == '__main__':
    cycles, file_map = find_cycles('src')
    if cycles:
        print(f"Found {len(cycles)} circular dependencies:")
        for cycle in cycles:
            print(" -> ".join([file_map[node] for node in cycle]))
    else:
        print("No circular dependencies found in src/")
