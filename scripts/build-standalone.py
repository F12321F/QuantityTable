"""Produce the single-file offline worksheet and an optional source ZIP."""
import argparse
import base64
import re
import runpy
import json
from password_config import load_config
from pathlib import Path
import zipfile

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--output', type=Path)
args = parser.parse_args()
runpy.run_path(str(root / 'scripts/build-pwa.py'))
html = (root / 'index.html').read_text(encoding='utf8')
html = re.sub(r'<!-- PWA_START -->.*?<!-- PWA_END -->', '', html, flags=re.S)
html = html.replace('<link rel="stylesheet" href="styles.css">', '<style>' + (root / 'styles.css').read_text(encoding='utf8') + '</style>')
logo = base64.b64encode((root / 'assets/sucoot-logo.png').read_bytes()).decode('ascii')
html = html.replace('src="assets/sucoot-logo.png"', 'src="data:image/png;base64,' + logo + '"')
scripts = ['password-utils.js', 'access.js', 'catalog.js', 'pdf.js', 'app.js']
config = load_config(root / 'password-config.json')
html = html.replace('</head>', '<script id="embeddedPasswordConfig" type="application/json">' + json.dumps(config) + '</script></head>')
for script in scripts:
    html = html.replace(f'<script src="{script}" defer></script>', '')
html = html.replace('</body>', ''.join('<script>' + (root / script).read_text(encoding='utf8') + '</script>' for script in scripts) + '</body>')
html = '\n'.join('' if not line.strip() else line for line in html.split('\n'))
release = root / 'downloads/quantity-table.html'
release.parent.mkdir(parents=True, exist_ok=True)
release.write_text(html, encoding='utf8')
print(release)
if args.output:
    args.output.mkdir(parents=True, exist_ok=True)
    (args.output / '圓盤系統支撐架數量表.html').write_text(html, encoding='utf8')
    with zipfile.ZipFile(args.output / 'QuantityTable.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
        for name in ['index.html', 'styles.css', *scripts, 'README.md', 'catalog/SOURCES.md', 'assets/sucoot-logo.png', 'assets/README.md', 'scripts/build-standalone.py', 'scripts/build-catalog.py', 'tests/workbook.cjs', 'tests/pwa.cjs', 'tests/password.cjs', 'password-config.json', 'password-setup.html', 'password-setup.js', 'scripts/password_config.py', 'pwa.js', 'sw.js', 'manifest.webmanifest', 'scripts/build-pwa.py', 'scripts/sw-template.js', 'assets/pwa/icon-192.png', 'assets/pwa/icon-512.png', 'assets/pwa/apple-touch-icon.png']:
            archive.write(root / name, 'QuantityTable/' + name)
