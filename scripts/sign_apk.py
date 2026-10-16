"""Sign a verified CI build locally; private keys are never sent to GitHub."""
import hashlib, json, os, subprocess, sys, zipfile
from pathlib import Path
root=Path(__file__).resolve().parents[1]
if len(sys.argv)!=3:raise SystemExit('Usage: python3 scripts/sign_apk.py BUILD_DIRECTORY OUTPUT_APK')
build=Path(sys.argv[1]).resolve();output=Path(sys.argv[2]).resolve()
report=json.loads((build/'BUILD-EVIDENCE.json').read_text())
if report.get('repository')!='jmz2727/MagicNumbersKingdom':raise SystemExit('Unexpected build repository')
for name in ['Magic-Numbers-Kingdom-unsigned.apk','apksigner.jar']:
 body=(build/name).read_bytes();assert hashlib.sha256(body).hexdigest()==report['files'][name]['sha256'],name
subprocess.run([sys.executable,str(root/'scripts/verify_apk.py'),str(build/'Magic-Numbers-Kingdom-unsigned.apk')],check=True)
values=json.loads((root/'.signing/signing-values.json').read_text());env=os.environ.copy();env.update(values)
subprocess.run(['java','-jar',str(build/'apksigner.jar'),'sign','--ks',str(root/'.signing/magic-numbers.jks'),'--ks-key-alias',values['KINGDOM_KEY_ALIAS'],'--ks-pass','env:KINGDOM_KEYSTORE_PASSWORD','--key-pass','env:KINGDOM_KEY_PASSWORD','--out',str(output),str(build/'Magic-Numbers-Kingdom-unsigned.apk')],check=True,env=env)
subprocess.run(['java','-jar',str(build/'apksigner.jar'),'verify','--verbose','--print-certs',str(output)],check=True)
subprocess.run([sys.executable,str(root/'scripts/verify_apk.py'),str(output)],check=True)
print('Signed APK SHA256:',hashlib.sha256(output.read_bytes()).hexdigest())
