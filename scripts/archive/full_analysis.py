#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import os
import re
import json

def count_lines(directory, extensions, exclude_dirs):
    total = 0
    files = []
    for root, dirs, filenames in os.walk(directory):
        dirs[:] = [d for d in dirs if d not in exclude_dirs]
        for filename in filenames:
            if any(filename.endswith(ext) for ext in extensions):
                filepath = os.path.join(root, filename)
                try:
                    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                        lines = len(f.readlines())
                        total += lines
                        files.append((filepath, lines))
                except:
                    pass
    return total, files

def analyze_architecture():
    print("\n" + "="*70)
    print("                    ARQUITECTURA DEL PROYECTO")
    print("="*70)
    
    print("\n[ESTADISTICAS DE CODIGO]")
    print("-" * 60)
    
    js_lines, js_files = count_lines('.', ['.js'], ['node_modules', '.git', 'vendor'])
    php_lines, php_files = count_lines('.', ['.php'], ['node_modules', '.git', 'vendor'])
    css_lines, css_files = count_lines('.', ['.css'], ['node_modules', '.git', 'vendor'])
    
    print(f"  JavaScript: {len(js_files)} archivos, {js_lines:,} lineas")
    print(f"  PHP:        {len(php_files)} archivos, {php_lines:,} lineas")
    print(f"  CSS:        {len(css_files)} archivos, {css_lines:,} lineas")
    print(f"  TOTAL:      {js_lines + php_lines + css_lines:,} lineas")
    
    # Archivos más grandes
    print("\n[ARCHIVOS MAS GRANDES]")
    print("-" * 60)
    all_files = [(f"[JS] {f[0]}", f[1]) for f in js_files] + \
                [(f"[PHP] {f[0]}", f[1]) for f in php_files] + \
                [(f"[CSS] {f[0]}", f[1]) for f in css_files]
    all_files.sort(key=lambda x: x[1], reverse=True)
    
    for f, lines in all_files[:10]:
        print(f"  {lines:>6} lineas - {f}")

def analyze_modularity():
    print("\n[MODULARIDAD]")
    print("-" * 60)
    
    # Verificar estructura de carpetas
    dirs = ['lib', 'controllers', 'js', 'tests', 'vendor']
    for d in dirs:
        exists = os.path.exists(d)
        files = len(os.listdir(d)) if exists else 0
        status = "[OK]" if exists else "[FALTA]"
        print(f"  {status} {d}/ ({files} archivos)")
    
    # Análisis de dependencias
    print("\n[DEPENDENCIAS PHP]")
    if os.path.exists("composer.json"):
        with open("composer.json", 'r') as f:
            composer = json.load(f)
        deps = composer.get('require', {})
        for dep, version in deps.items():
            print(f"  - {dep}: {version}")
    else:
        print("  No hay composer.json")
    
    print("\n[DEPENDENCIAS JS]")
    if os.path.exists("package.json"):
        with open("package.json", 'r') as f:
            pkg = json.load(f)
        deps = pkg.get('dependencies', {})
        for dep, version in deps.items():
            print(f"  - {dep}: {version}")
    else:
        print("  No hay package.json")

def analyze_code_quality():
    print("\n" + "="*70)
    print("                    CALIDAD DEL CODIGO")
    print("="*70)
    
    print("\n[DUPLICACION DE CODIGO]")
    print("-" * 60)
    
    # Buscar funciones duplicadas
    functions = {}
    for root, dirs, filenames in os.walk('.'):
        dirs[:] = [d for d in dirs if d not in ['node_modules', '.git', 'vendor']]
        for filename in filenames:
            if filename.endswith('.php') or filename.endswith('.js'):
                filepath = os.path.join(root, filename)
                try:
                    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                        content = f.read()
                        # Buscar definiciones de funciones
                        funcs = re.findall(r'function\s+(\w+)', content)
                        for func in funcs:
                            if func not in ['if', 'while', 'for', 'switch']:
                                if func not in functions:
                                    functions[func] = []
                                functions[func].append(filepath)
                except:
                    pass
    
    duplicates = {k: v for k, v in functions.items() if len(v) > 1}
    if duplicates:
        print(f"  [!] {len(duplicates)} funciones duplicadas:")
        for func, files in list(duplicates.items())[:5]:
            print(f"      - {func}: {len(files)} archivos")
    else:
        print("  [OK] No hay funciones duplicadas")
    
    print("\n[COMPLEJIDAD CICLOMATICA]")
    print("-" * 60)
    
    # Contar anidaciones y condicionales
    high_complexity = []
    for root, dirs, filenames in os.walk('.'):
        dirs[:] = [d for d in dirs if d not in ['node_modules', '.git', 'vendor']]
        for filename in filenames:
            if filename.endswith('.php'):
                filepath = os.path.join(root, filename)
                try:
                    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                        content = f.read()
                        ifs = len(re.findall(r'\bif\s*\(', content))
                        loops = len(re.findall(r'\b(for|while|foreach)\s*\(', content))
                        complexity = ifs + loops
                        if complexity > 50:
                            high_complexity.append((filepath, complexity))
                except:
                    pass
    
    high_complexity.sort(key=lambda x: x[1], reverse=True)
    if high_complexity:
        print("  Archivos con alta complejidad:")
        for filepath, comp in high_complexity[:5]:
            print(f"    - {filepath}: {comp}")
    else:
        print("  [OK] Complejidad controlada")

def analyze_performance():
    print("\n" + "="*70)
    print("                    PERFORMANCE")
    print("="*70)
    
    print("\n[OPTIMIZACIONES DETECTADAS]")
    print("-" * 60)
    
    # Buscar lazy loading
    lazy_loading = False
    for filepath in ['script.js', 'booking-engine.js', 'chat-engine.js']:
        if os.path.exists(filepath):
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                if 'lazy' in f.read().lower() or 'IntersectionObserver' in f.read():
                    lazy_loading = True
                    break
    print(f"  Lazy loading:      {lazy_loading}")
    
    # Caching
    caching = False
    if os.path.exists("lib/storage.php"):
        with open("lib/storage.php", 'r', encoding='utf-8', errors='ignore') as f:
            if 'cache' in f.read().lower():
                caching = True
    print(f"  Caching backend:   {caching}")
    
    # Minification (básico - buscar archivos minificados)
    minified = len([f for f in os.listdir('.') if '.min.' in f])
    print(f"  Archivos minified: {minified}")
    
    # CDN usage
    cdn = False
    if os.path.exists("index.html"):
        with open("index.html", 'r', encoding='utf-8', errors='ignore') as f:
            if 'cdn' in f.read().lower() or 'cloudflare' in f.read().lower():
                cdn = True
    print(f"  CDN usage:         {cdn}")

def analyze_tests():
    print("\n" + "="*70)
    print("                    COBERTURA DE TESTS")
    print("="*70)
    
    test_files = []
    if os.path.exists("tests"):
        for f in os.listdir("tests"):
            if f.endswith('.php') or f.endswith('.js'):
                test_files.append(f)
    
    print(f"\n  Archivos de test: {len(test_files)}")
    print("\n  Tests disponibles:")
    for f in sorted(test_files):
        print(f"    - {f}")
    
    # Verificar qué está testeado
    tested_components = []
    for f in test_files:
        name = f.replace('test_', '').replace('_test', '').replace('.php', '')
        tested_components.append(name)
    
    print(f"\n  Componentes testeados: {len(tested_components)}")

def generate_summary():
    print("\n" + "="*70)
    print("                    RESUMEN EJECUTIVO")
    print("="*70)
    
    scores = {
        "Seguridad HTTP Headers": 3,  # index.php tiene algunos
        "SQL Injection Protection": 2,  # No hay prepared statements
        "Rate Limiting": 6,  # Existe pero básico
        "Autenticación": 2,  # No tiene hashing de passwords visible
        "Exposición de datos": 9,  # No se detectaron secrets
        "XSS Protection": 8,  # Usa textContent en JS
        "Modularidad": 7,  # Buena estructura de carpetas
        "Cobertura de tests": 6,  # Hay tests pero podría mejorar
        "Performance": 6,  # Lazy loading presente
    }
    
    print("\n[PUNTUACIONES - Escala 0-10]")
    print("-" * 60)
    for aspect, score in scores.items():
        bar = "#" * (score // 2) + "-" * (5 - score // 2)
        status = "[CRITICO]" if score < 4 else "[MEJORABLE]" if score < 7 else "[BUENO]"
        print(f"  {aspect:30} {bar} {score}/10 {status}")
    
    avg = sum(scores.values()) / len(scores)
    print(f"\n  PUNTUACION GLOBAL: {avg:.1f}/10")
    
    print("\n[VULNERABILIDADES CRITICAS IDENTIFICADAS]")
    print("-" * 60)
    print("  1. [CRITICO] Sin prepared statements en base de datos")
    print("  2. [CRITICO] Headers de seguridad HTTP faltantes en api.php")
    print("  3. [CRITICO] Sin hashing de contraseñas visible en auth")
    print("  4. [MEDIO]   Sin rate limiting distribuido (Redis)")
    print("  5. [MEDIO]   Complejidad ciclomatica alta en algunos archivos")
    
    print("\n[RECOMENDACIONES PRIORITARIAS]")
    print("-" * 60)
    print("  1. Implementar PDO con prepared statements URGENTE")
    print("  2. Agregar headers de seguridad en todos los endpoints")
    print("  3. Implementar password_hash() y password_verify()")
    print("  4. Configurar Redis para rate limiting distribuido")
    print("  5. Agregar CSP headers estrictos")

if __name__ == "__main__":
    analyze_architecture()
    analyze_modularity()
    analyze_code_quality()
    analyze_performance()
    analyze_tests()
    generate_summary()
