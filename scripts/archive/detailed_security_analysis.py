#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import os
import re

def analyze_file_security():
    print("\n" + "="*70)
    print("              ANALISIS DE SEGURIDAD POR ARCHIVO")
    print("="*70)
    
    # Analizar archivos clave
    key_files = [
        "api.php",
        "api-lib.php", 
        "lib/validation.php",
        "lib/auth.php",
        "lib/ratelimit.php",
        "lib/captcha.php",
        "lib/email.php",
        "lib/storage.php"
    ]
    
    for filepath in key_files:
        if os.path.exists(filepath):
            print(f"\n[+] {filepath}")
            print("-" * 60)
            
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
            
            # Buscar patrones de seguridad
            checks = {
                "Input validation": bool(re.search(r'filter_var|preg_match|strlen|empty\s*\(', content)),
                "Sanitization": bool(re.search(r'htmlspecialchars|strip_tags|trim|sanitize', content, re.I)),
                "Error handling": bool(re.search(r'try\s*{|catch\s*\(|throw\s+new', content)),
                "Type checking": bool(re.search(r'is_string|is_int|is_array|is_bool', content)),
                "Nonce/Tokens": bool(re.search(r'nonce|token|csrf', content, re.I)),
                "Password hashing": bool(re.search(r'password_hash|password_verify', content)),
            }
            
            for check, present in checks.items():
                status = "[OK]" if present else "[--]"
                print(f"  {status} {check}")
    
    print("\n" + "="*70)
    print("              ANALISIS DE VULNERABILIDADES COMUNES")
    print("="*70)
    
    vulns = []
    
    # Buscar SQL injection potencial
    for root, dirs, files in os.walk('.'):
        dirs[:] = [d for d in dirs if d not in ['node_modules', '.git', 'vendor']]
        for file in files:
            if file.endswith('.php'):
                filepath = os.path.join(root, file)
                try:
                    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                        content = f.read()
                        
                        # SQL injection
                        if re.search(r'\$_(GET|POST|REQUEST)\[.*\].*\$sql|mysql_query.*\$', content):
                            vulns.append((filepath, "Posible SQL Injection"))
                        
                        # XSS
                        if re.search(r'echo.*\$_(GET|POST|REQUEST)', content):
                            vulns.append((filepath, "Posible XSS"))
                        
                        # Path traversal
                        if re.search(r'include.*\$_(GET|POST)|require.*\$', content):
                            vulns.append((filepath, "Posible Path Traversal"))
                        
                        # Command injection
                        if re.search(r'exec\s*\(|system\s*\(|shell_exec\s*\(', content):
                            if re.search(r'\$_(GET|POST|REQUEST)', content):
                                vulns.append((filepath, "Posible Command Injection"))
                                
                except:
                    pass
    
    if vulns:
        print("\n[!] VULNERABILIDADES POTENCIALES ENCONTRADAS:")
        for filepath, vuln in vulns[:15]:
            print(f"  - {filepath}: {vuln}")
        if len(vulns) > 15:
            print(f"  ... y {len(vulns)-15} mas")
    else:
        print("\n[OK] No se encontraron vulnerabilidades obvias")

def analyze_api_endpoints():
    print("\n" + "="*70)
    print("              ANALISIS DE ENDPOINTS API")
    print("="*70)
    
    if os.path.exists("api.php"):
        with open("api.php", 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
        
        # Encontrar endpoints
        endpoints = re.findall(r"case\s*['\"](\w+)['\"]|['\"](\w+)['\"]\s*=>|if.*action.*==.*['\"](\w+)['\"]", content)
        unique_endpoints = set([e for sub in endpoints for e in sub if e])
        
        print(f"\n[+] Endpoints API encontrados: {len(unique_endpoints)}")
        print("-" * 60)
        for ep in sorted(unique_endpoints):
            print(f"  - {ep}")
        
        # Verificar autenticación en endpoints
        print(f"\n[+] Verificacion de autenticacion:")
        print("-" * 60)
        
        protected = re.findall(r'if.*auth|checkAuth|isAuthenticated|verifyToken', content, re.I)
        print(f"  Controles de auth encontrados: {len(protected)}")

def analyze_dependencies_security():
    print("\n" + "="*70)
    print("              SEGURIDAD DE DEPENDENCIAS")
    print("="*70)
    
    print("\n[+] PHP Dependencies (composer):")
    print("-" * 60)
    if os.path.exists("composer.lock"):
        import json
        with open("composer.lock", 'r') as f:
            lock = json.load(f)
        packages = lock.get('packages', [])
        for pkg in packages:
            name = pkg.get('name', 'unknown')
            version = pkg.get('version', 'unknown')
            print(f"  - {name}: {version}")
    else:
        print("  No hay composer.lock")
    
    print("\n[+] JavaScript Dependencies:")
    print("-" * 60)
    if os.path.exists("package-lock.json"):
        import json
        with open("package-lock.json", 'r') as f:
            lock = json.load(f)
        packages = lock.get('packages', {}).get('', {}).get('dependencies', {})
        for name, version in list(packages.items())[:10]:
            print(f"  - {name}: {version}")
    else:
        print("  No hay package-lock.json")

if __name__ == "__main__":
    analyze_file_security()
    analyze_api_endpoints()
    analyze_dependencies_security()
