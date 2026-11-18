"""Version the offline cache from the actual runtime asset contents."""
import hashlib
import json
from password_config import load_config
from pathlib import Path

root = Path(__file__).resolve().parents[1]
load_config(root / 'password-config.json')
files = ['password-config.json', 'password-utils.js', 'access.js', 'password-setup.html', 'password-setup.js', 'index.html', 'styles.css', 'catalog.js', 'pdf.js', 'app.js', 'pwa.js',
         'manifest.webmanifest', 'assets/sucoot-logo.png', 'assets/pwa/icon-192.png',
         'assets/pwa/icon-512.png', 'assets/pwa/apple-touch-icon.png']
template = (root / 'scripts/sw-template.js').read_text(encoding='utf8')
digest = hashlib.sha256(template.encode('utf8'))
for name in files:
    digest.update(name.encode('utf8'))
    digest.update((root / name).read_bytes())
version = digest.hexdigest()[:16]
worker = template.replace('__CACHE_VERSION__', version).replace('__SHELL_FILES__', json.dumps(['./'] + ['./' + name for name in files], ensure_ascii=False, indent=2))
(root / 'sw.js').write_text(worker, encoding='utf8')
print('Offline cache version:', version)
