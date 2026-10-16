"""Non-secret evidence accompanies the CI artifact before local signing."""
import hashlib, json, os, subprocess, sys
from pathlib import Path
out=Path(sys.argv[1]); root=Path(__file__).resolve().parents[1]
report={'commit':os.environ.get('GITHUB_SHA'),'run_id':os.environ.get('GITHUB_RUN_ID'),'repository':os.environ.get('GITHUB_REPOSITORY'),'signing':'Not signed in CI; signing keys remain on owner trusted machine','curriculum_version':'1.5.0','files':{}}
for p in sorted(out.iterdir()):
 if p.is_file():report['files'][p.name]={'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
report['asset_count']=len(json.loads((root/'app/src/main/assets/bundle.json').read_text())['files'])
(out/'BUILD-EVIDENCE.json').write_text(json.dumps(report,indent=2))
