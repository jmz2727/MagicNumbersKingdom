"""Run once on an owner's trusted machine. Never commit the result."""
import json
import os
import secrets
import shutil
import subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[1]
dest=root/'.signing'
if dest.exists():
    raise SystemExit('Signing directory already exists: preserve the existing key for updates.')
if not shutil.which('keytool'):
    raise SystemExit('keytool is required (part of JDK). No files have been changed.')
dest.mkdir(mode=0o700)
password=secrets.token_urlsafe(32)
key=dest/'magic-numbers.jks'
values={'KINGDOM_KEYSTORE_PASSWORD':password,'KINGDOM_KEY_ALIAS':'magic-numbers','KINGDOM_KEY_PASSWORD':password}
env=os.environ.copy();env['KINGDOM_SIGNING_PASSWORD']=password
subprocess.run(['keytool','-genkeypair','-keystore',str(key),'-storetype','JKS','-alias','magic-numbers','-keyalg','RSA','-keysize','3072','-validity','10000','-dname','CN=Magic Numbers Kingdom, O=Private Educational App','-storepass:env','KINGDOM_SIGNING_PASSWORD','-keypass:env','KINGDOM_SIGNING_PASSWORD','-noprompt'],check=True,env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
key.chmod(0o600)
p=dest/'signing-values.json';p.write_text(json.dumps(values));p.chmod(0o600)
print('Created private signing key. It is excluded from source control and source archives.')
