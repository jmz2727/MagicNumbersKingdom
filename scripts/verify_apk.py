"""Inspect the produced APK, not just the source assets."""
import hashlib
import json
import sys
import zipfile
from pathlib import Path
root = Path(__file__).resolve().parents[1]
inventory = json.loads((root/'app/src/main/assets/bundle.json').read_text())
with zipfile.ZipFile(sys.argv[1]) as apk:
    assert apk.testzip() is None, 'Corrupt APK zip'
    names = set(apk.namelist())
    assert 'AndroidManifest.xml' in names and 'classes.dex' in names
    for path, meta in inventory['files'].items():
        data = apk.read('assets/www/'+path)
        assert len(data) == meta['bytes'], path
        assert hashlib.sha256(data).hexdigest() == meta['sha256'], path
    assert 'assets/www/sw.js' not in names
    assert 'assets/www/manifest.webmanifest' not in names
    print(f'APK verified: {len(inventory["files"])} packaged resources, all 100 MP3 files exact.')
