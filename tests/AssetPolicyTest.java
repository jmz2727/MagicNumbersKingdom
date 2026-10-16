package com.jameel.magicnumbers;
import java.util.Set;
public final class AssetPolicyTest {
    static int checks;
    static void expect(boolean ok) { checks++; if (!ok) throw new AssertionError("Check " + checks); }
    public static void main(String[] args) {
        Set<String> files=Set.of("index.html","app.js","audio/25.mp3","style.css");
        expect("index.html".equals(AssetPolicy.file(AssetPolicy.START,files)));
        expect(AssetPolicy.navigation(AssetPolicy.START+"#progress",files));
        expect(!AssetPolicy.navigation("https://appassets.androidplatform.net/app/app.js",files));
        for (String bad : new String[]{"file:///android_asset/index.html","content://storage/private","https://evil.example/app/index.html","http://appassets.androidplatform.net/app/index.html","https://appassets.androidplatform.net.evil.example/app/index.html","https://user@appassets.androidplatform.net/app/index.html","https://appassets.androidplatform.net:443/app/index.html","https://appassets.androidplatform.net/app/../index.html","https://appassets.androidplatform.net/app/%2e%2e/index.html","https://appassets.androidplatform.net/app/%252e%252e/index.html","https://appassets.androidplatform.net/app/.hidden","https://appassets.androidplatform.net/app/audio//25.mp3","https://appassets.androidplatform.net/app/index.html?token=x","https://appassets.androidplatform.net/app/missing.js","https://appassets.androidplatform.net/app/%00index.html","not a url"}) expect(AssetPolicy.file(bad,files)==null);
        expect("audio/25.mp3".equals(AssetPolicy.file("https://appassets.androidplatform.net/app/audio/25.mp3",files)));
        expect(AssetPolicy.mime("audio/25.mp3").equals("audio/mpeg"));
        expect(AssetPolicy.range(null,100).status==200);
        expect(AssetPolicy.range("bytes=0-9",100).length()==10);
        expect(AssetPolicy.range("bytes=20-",100).start==20);
        expect(AssetPolicy.range("bytes=-10",100).start==90);
        expect(AssetPolicy.range("bytes=-1000",100).length()==100);
        expect(AssetPolicy.range("bytes=0-999",100).length()==100);
        expect(AssetPolicy.range("bytes=99-99",100).length()==1);
        for (String bad : new String[]{"bytes=100-","bytes=-0","bytes=-","bytes=20-10","bytes=a-b","bytes=0-1,3-4","bytes=999999999999999999999-","items=0-1","bytes=+0-1"}) expect(AssetPolicy.range(bad,100).status==416);
        expect(AssetPolicy.range("bytes=0-0",0).status==416);
        System.out.println("Asset policy: " + checks + " checks passed.");
    }
}
