#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import os
import re
import sys

# Configurar encoding para Windows
sys.stdout.reconfigure(encoding='utf-8')

def analyze_security():
    print("\n" + "="*70)
    print("                    ANALISIS DE SEGURIDAD DETALLADO")
    print("="*70)
    
    # 1. Headers de seguridad
    print("\n[1] HEADERS DE SEGURIDAD HTTP")
    print("-" * 60)
    headers = [
        "Content-Security-Policy",
        "X-Frame-Options",
        "X-Content-Type-Options", 
        "X-XSS-Protection",
        "Strict-Transport-Security",
        "Referrer-Policy"
    ]
    
    for filepath in ["api.php", "index.php", "admin-auth.php"]:
        if os.path.exists(filepath):
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
            print(f"\n  {filepath}:")
            for header in headers:
                found = header in content
                status = "[OK]" if found else "[FALTA]"
                print(f"    {status} {header}")
    
    # 2. SQL Injection
    print("\n[2] PROTECCION SQL INJECTION")
    print("-" * 60)
    if os.path.exists("lib/storage.php"):
        with open("lib/storage.php", 'r', encoding='utf-8', errors='ignore') as f:
            storage = f.read()
        has_prepared = "prepare" in storage or "bind_param" in storage
        has_pdo = "PDO" in storage
        has_escape = "escape" in storage or "real_escape" in storage
        print(f"  Prepared statements: {has_prepared}")
        print(f"  PDO usage:           {has_pdo}")
        print(f"  Escape functions:    {has_escape}")
    
    # 3. Rate Limiting
    print("\n[3] RATE LIMITING")
    print("-" * 60)
    if os.path.exists("lib/ratelimit.php"):
        with open("lib/ratelimit.php", 'r', encoding='utf-8', errors='ignore') as f:
            rl = f.read()
        has_redis = "redis" in rl.lower() or "predis" in rl.lower()
        has_ip = "ip" in rl.lower() or "remote_addr" in rl.lower()
        has_window = "window" in rl.lower() or "ttl" in rl.lower()
        print(f"  Redis backend:   {has_redis}")
        print(f"  IP detection:    {has_ip}")
        print(f"  Time windows:    {has_window}")
    
    # 4. Datos sensibles
    print("\n[4] EXPOSICION DE DATOS SENSIBLES")
    print("-" * 60)
    patterns = [
        (r'api[_-]?key\s*[=:]\s*["\'][a-zA-Z0-9]{10,}', 'API Keys'),
        (r'secret\s*[=:]\s*["\'][a-zA-Z0-9]{10,}', 'Secrets'),
        (r'password\s*[=:]\s*["\'][^"\']{3,}["\']', 'Passwords'),
    ]
    
    found_any = False
    for pattern, name in patterns:
        for root, dirs, files in os.walk('.'):
            if any(x in root for x in ['vendor', 'node_modules', '.git']):
                continue
            for file in files:
                if file.endswith(('.php', '.js')):
                    try:
                        with open(os.path.join(root, file), 'r', encoding='utf-8', errors='ignore') as f:
                            if re.search(pattern, f.read(), re.IGNORECASE):
                                print(f"  [!] {name} en {file}")
                                found_any = True
                    except:
                        pass
    if not found_any:
        print("  [OK] No se detectaron datos sensibles")
    
    # 5. JavaScript
    print("\n[5] SEGURIDAD JAVASCRIPT")
    print("-" * 60)
    try:
        with open('script.js', 'r', encoding='utf-8', errors='ignore') as f:
            js = f.read()
        print(f"  XSS Protection:   {'textContent' in js}")
        print(f"  HTTPS:            {'https://' in js}")
        print(f"  Secrets exposed:  {'apikey' in js.lower()}")
        print(f"  Eval usage:       {'eval(' in js}")
    except Exception as e:
        print(f"  Error: {e}")
    
    # 6. Auth
    print("\n[6] AUTENTICACION")
    print("-" * 60)
    if os.path.exists("lib/auth.php"):
        with open("lib/auth.php", 'r', encoding='utf-8', errors='ignore') as f:
            auth = f.read()
        print(f"  Password hashing: {'password_hash' in auth}")
        print(f"  Session security: {'session_regenerate' in auth}")
        print(f"  JWT tokens:       {'jwt' in auth.lower()}")

if __name__ == "__main__":
    analyze_security()
