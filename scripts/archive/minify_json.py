import json
import re

filepath = 'content/index.json'

try:
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Minify HTML strings inside values
    # Regex to replace multiple whitespace characters (including newlines) with a single space
    html_whitespace_regex = re.compile(r'\s+')

    def minify_html_string(s):
        if not isinstance(s, str):
            return s
        return html_whitespace_regex.sub(' ', s).strip()

    if isinstance(data, dict):
        for key, value in data.items():
            if isinstance(value, str):
                data[key] = minify_html_string(value)

    # Save the minified JSON
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, separators=(',', ':'))

    print(f"Minified {filepath}")

except Exception as e:
    print(f"Error: {e}")
