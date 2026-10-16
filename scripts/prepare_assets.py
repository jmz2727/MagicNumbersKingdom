"""Create the Android bundle from the exact, tested 1.5.0 curriculum snapshot."""
import hashlib
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'dist'
ASSETS = ROOT / 'app/src/main/assets'
TARGET = ASSETS / 'www'

def replace_once(text, old, new):
    if text.count(old) != 1:
        raise ValueError('Source snapshot changed: expected exactly one native adaptation point')
    return text.replace(old, new, 1)

def prepare():
    ASSETS.mkdir(parents=True, exist_ok=True)
    if TARGET.exists():
        shutil.rmtree(TARGET)
    TARGET.mkdir()
    for f in SOURCE.rglob('*'):
        if not f.is_file() or any(p.startswith('.') for p in f.relative_to(SOURCE).parts):
            continue
        if f.name in ['sw.js', 'manifest.webmanifest', '_headers']:
            continue
        dest = TARGET / f.relative_to(SOURCE)
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(f, dest)
    p = TARGET / 'index.html'
    html = p.read_text()
    html = replace_once(html, '<link rel="manifest" href="./manifest.webmanifest">', '')
    html = replace_once(html, '<script src="./app.js" defer></script>', '<script src="./native.js" defer></script><script src="./app.js" defer></script>')
    html = html.replace('لا يحتاج التطبيق إلى الإنترنت بعد تنزيل موارده.', 'جميع الدروس والأصوات مضمّنة في التطبيق وتعمل دون إنترنت.')
    p.write_text(html)
    (TARGET / 'native.js').write_text("'use strict';\nwindow.KINGDOM_ANDROID_BUNDLE=true;\n")
    p = TARGET / 'app.js'
    app = p.read_text()
    app = replace_once(app, "async function registerOffline(force=false){", """async function registerOffline(force=false){
 if(window.KINGDOM_ANDROID_BUNDLE){offlineReady=true;offlineStatus('الدروس والأصوات جاهزة دون إنترنت ✓');document.getElementById('offline-detail').hidden=true;return;}""")
    start = app.index('function exportProgress(){')
    end = app.index('function setupCanvas(){', start)
    app = app[:start] + """function exportProgress(){
 try{window.KingdomAndroid.saveProgress(JSON.stringify(state));}catch{toast('تعذّر فتح نافذة حفظ التقدم. حاول مرة أخرى.');}
}
window.addEventListener('kingdom-native-import',event=>{
 try{
  const imported=K.importProgress(event.detail);
  if(!window.confirm('استبدال التقدم الحالي بالتقدم الموجود في هذه النسخة؟'))return;
  state=imported;persist();screen='progress';answered=false;render();toast('استعدنا مغامرتك بنجاح.');
 }catch{toast('هذه النسخة غير صالحة. لم يتغير تقدمك.');}
});
window.addEventListener('kingdom-native-pause',()=>{stopAudio();persist();});
""" + app[end:]
    app = replace_once(app, "case'print':window.print();break;", "case'print':try{window.KingdomAndroid.printCertificate();}catch{toast('الطباعة غير متاحة على هذا الجهاز.');}break;case'native-import':try{window.KingdomAndroid.chooseProgressFile();}catch{toast('تعذّر فتح نافذة استعادة التقدم.');}break;")
    app = replace_once(app, '<label class="btn secondary" for="import-file" tabindex="0" role="button">استعادة نسخة ↑</label><input id="import-file" type="file" accept="application/json,.json" hidden>', '<button class="btn secondary" data-act="native-import">استعادة نسخة ↑</button>')
    start = app.index('<section class="panel"><h2>حقيبة تعمل دون إنترنت</h2>')
    end = app.index('</section></div>`;}', start)
    app = app[:start] + """<section class="panel"><h2>تطبيق مستقل دون إنترنت</h2><p>جميع الدروس والأعداد المائة وأصواتها موجودة داخل التطبيق من أول تشغيل. لا تحتاج إلى حساب أو اتصال بالإنترنت.</p><p>يمكن مشاركة ملف APK مع هاتف آخر وتثبيته ليبدأ من المستوى الأول. تحديث المحتوى يكون بتثبيت نسخة APK أحدث تحمل توقيع التطبيق نفسه.</p></section><section class="panel"><h2>التقدم والخصوصية</h2><p>الاسم والنجوم والمستويات محفوظة داخل بيانات هذا التطبيق على جهازك فقط، ولا تتزامن تلقائيًا بين الهواتف. لا توجد إعلانات أو تتبع أو صلاحيات إنترنت أو ملفات عامة.</p><p>من لوحة تقدّمي يمكنك تصدير ملف نسخة احتياطية إلى مكان تختاره، أو استعادة ملف محفوظ. لا تمسح بيانات التطبيق ولا تحذفه قبل تصدير التقدم إذا أردت الاحتفاظ به.</p><p>النطق عربي محلي محفوظ في ملفات MP3. يمكن كتم المؤثرات وإيقاف الحركة من أزرار اللعب.</p><a class="btn secondary small" href="#progress">إدارة التقدم والنسخ الاحتياطي</a>""" + app[end:]
    p.write_text(app)
    inventory = {}
    for f in sorted(TARGET.rglob('*')):
        if f.is_file():
            body = f.read_bytes()
            inventory[f.relative_to(TARGET).as_posix()] = {'sha256': hashlib.sha256(body).hexdigest(), 'bytes': len(body)}
    if len([x for x in inventory if x.startswith('audio/') and x.endswith('.mp3')]) != 100:
        raise ValueError('All 100 local number recordings are required')
    (ASSETS / 'bundle.json').write_text(json.dumps({'version': '1.5.0', 'files': inventory}, ensure_ascii=False, indent=2))
    print(f'Bundled {len(inventory)} local files, including all 100 MP3 recordings.')
    return inventory

if __name__ == '__main__':
    prepare()
