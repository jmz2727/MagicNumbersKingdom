package com.jameel.magicnumbers;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.print.PrintAttributes;
import android.print.PrintManager;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.JsResult;
import android.webkit.PermissionRequest;
import android.webkit.ServiceWorkerClient;
import android.webkit.ServiceWorkerController;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;
import org.json.JSONObject;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Offline-only shell. All requests terminate in the packaged asset allowlist. */
public final class MainActivity extends Activity {
    private static final int EXPORT = 40, IMPORT = 41, MAX_BACKUP = 65536;
    private final ExecutorService files = Executors.newSingleThreadExecutor();
    private Set<String> allowedFiles = Collections.emptySet();
    private WebView web;
    private byte[] pendingExport;
    private boolean documentOpen;

    @SuppressLint({"SetJavaScriptEnabled", "JavascriptInterface"})
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        try {
            String inventory;
            try (InputStream in = getAssets().open("bundle.json")) {
                inventory = new String(readBounded(in, 256 * 1024), StandardCharsets.UTF_8);
            }
            JSONObject entries = new JSONObject(inventory).getJSONObject("files");
            Set<String> names = new HashSet<>();
            Iterator<String> keys = entries.keys();
            while (keys.hasNext()) names.add(keys.next());
            if (!names.contains("index.html") || !names.contains("audio/100.mp3")) throw new IOException();
            allowedFiles = Collections.unmodifiableSet(names);
        } catch (Exception error) {
            fatal("تعذّر قراءة محتويات التطبيق. أعد تثبيت ملف APK الأصلي."); return;
        }
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(250, 249, 244));
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                    insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            return insets.consumeSystemWindowInsets();
        });
        web = new WebView(this);
        root.addView(web, new FrameLayout.LayoutParams(-1, -1));
        setContentView(root);
        root.requestApplyInsets();
        web.setBackgroundColor(Color.rgb(250, 249, 244));
        WebView.setWebContentsDebuggingEnabled(false);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setGeolocationEnabled(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        CookieManager.getInstance().setAcceptCookie(false);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);
        web.addJavascriptInterface(new BackupBridge(), "KingdomAndroid");
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return localResponse(request);
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !AssetPolicy.navigation(request.getUrl().toString(), allowedFiles);
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) runOnUiThread(() -> fatal("تعذّر فتح الدرس المحلي. أغلق التطبيق وافتحه مرة أخرى."));
            }
        });
        // No service-worker network fallback, including after a future app update.
        ServiceWorkerController.getInstance().setServiceWorkerClient(new ServiceWorkerClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebResourceRequest request) { return localResponse(request); }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onPermissionRequest(PermissionRequest request) { request.deny(); }
            @Override public boolean onJsConfirm(WebView view, String url, String message, JsResult result) {
                if (!trusted()) { result.cancel(); return true; }
                new AlertDialog.Builder(MainActivity.this).setMessage(message)
                        .setPositiveButton("متابعة", (dialog, which) -> result.confirm())
                        .setNegativeButton("إلغاء", (dialog, which) -> result.cancel())
                        .setOnCancelListener(dialog -> result.cancel()).show();
                return true;
            }
        });
        web.loadUrl(AssetPolicy.START);
    }

    private WebResourceResponse localResponse(WebResourceRequest request) {
        String name = AssetPolicy.file(request.getUrl().toString(), allowedFiles);
        if (name == null || !"GET".equals(request.getMethod())) return failure(403, "Forbidden");
        try (InputStream in = getAssets().open("www/" + name)) {
            byte[] bytes = readBounded(in, 4 * 1024 * 1024);
            String rangeHeader = null;
            if (name.endsWith(".mp3")) {
                for (Map.Entry<String, String> header : request.getRequestHeaders().entrySet())
                    if ("range".equalsIgnoreCase(header.getKey())) rangeHeader = header.getValue();
            }
            AssetPolicy.Range range = AssetPolicy.range(rangeHeader, bytes.length);
            Map<String, String> headers = new HashMap<>();
            headers.put("Cache-Control", "no-store");
            headers.put("X-Content-Type-Options", "nosniff");
            headers.put("Referrer-Policy", "no-referrer");
            headers.put("Accept-Ranges", "bytes");
            headers.put("Content-Length", String.valueOf(range.length()));
            if (range.status == 206) headers.put("Content-Range", "bytes " + range.start + "-" + range.end + "/" + bytes.length);
            if (range.status == 416) headers.put("Content-Range", "bytes */" + bytes.length);
            String mime = AssetPolicy.mime(name);
            String charset = mime.startsWith("text/") || mime.contains("javascript") || mime.contains("json") || mime.contains("svg") ? "UTF-8" : null;
            return new WebResourceResponse(mime, charset, range.status,
                    range.status == 206 ? "Partial Content" : range.status == 416 ? "Range Not Satisfiable" : "OK", headers,
                    new ByteArrayInputStream(bytes, range.start, range.length()));
        } catch (IOException missing) { return failure(404, "Not Found"); }
    }

    private static WebResourceResponse failure(int code, String reason) {
        return new WebResourceResponse("text/plain", "UTF-8", code, reason,
                Collections.singletonMap("Cache-Control", "no-store"), new ByteArrayInputStream(new byte[0]));
    }

    private boolean trusted() {
        return web != null && !isFinishing() && !isDestroyed() && AssetPolicy.navigation(web.getUrl(), allowedFiles);
    }

    public final class BackupBridge {
        @JavascriptInterface public void saveProgress(String raw) {
            if (raw == null || raw.length() > MAX_BACKUP) { message("ملف التقدم أكبر من المسموح."); return; }
            byte[] content = raw.getBytes(StandardCharsets.UTF_8);
            if (content.length > MAX_BACKUP) { message("ملف التقدم أكبر من المسموح."); return; }
            try {
                JSONObject value = new JSONObject(raw);
                if (value.getInt("version") != 1 || !(value.get("completed") instanceof JSONObject)
                        || !(value.get("seen") instanceof JSONObject)) throw new IllegalArgumentException();
            } catch (Exception invalid) { message("تعذّر تجهيز نسخة التقدم."); return; }
            runOnUiThread(() -> {
                if (!trusted() || documentOpen) return;
                pendingExport = content;
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
                        .setType("application/json").putExtra(Intent.EXTRA_TITLE, "magic-numbers-progress.json");
                launchDocument(intent, EXPORT);
            });
        }
        @JavascriptInterface public void chooseProgressFile() {
            runOnUiThread(() -> {
                if (!trusted() || documentOpen) return;
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
                        .setType("*/*").putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"application/json", "text/plain", "application/octet-stream"});
                launchDocument(intent, IMPORT);
            });
        }
        @JavascriptInterface public void printCertificate() {
            runOnUiThread(() -> {
                if (!trusted()) return;
                try {
                    PrintManager manager = (PrintManager) getSystemService(PRINT_SERVICE);
                    if (manager == null) throw new IllegalStateException();
                    manager.print("شهادة مملكة الأعداد السحرية", web.createPrintDocumentAdapter("شهادة الإنجاز"),
                            new PrintAttributes.Builder().build());
                } catch (RuntimeException unavailable) { message("الطباعة غير متاحة على هذا الجهاز."); }
            });
        }
    }

    private void launchDocument(Intent intent, int request) {
        try { documentOpen = true; startActivityForResult(intent, request); }
        catch (ActivityNotFoundException | SecurityException error) {
            documentOpen = false; pendingExport = null;
            message("لا يتوفر منتقي ملفات. يمكنك متابعة التعلم؛ تقدمك محفوظ داخل التطبيق.");
        }
    }

    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request != EXPORT && request != IMPORT) return;
        documentOpen = false;
        byte[] export = pendingExport; pendingExport = null;
        if (result != RESULT_OK || data == null || data.getData() == null) return;
        Uri uri = data.getData();
        if (!"content".equals(uri.getScheme())) { message("اختر ملفًا من منتقي ملفات الهاتف."); return; }
        if (request == EXPORT) {
            if (export == null) { message("أعد محاولة تصدير التقدم."); return; }
            files.execute(() -> {
                try (OutputStream out = getContentResolver().openOutputStream(uri, "wt")) {
                    if (out == null) throw new IOException();
                    out.write(export); out.flush(); message("حُفظت نسخة التقدم بنجاح ✓");
                } catch (Exception error) { message("تعذّر حفظ الملف. اختر مكانًا آخر؛ تقدمك داخل التطبيق لم يتغير."); }
            });
        } else {
            files.execute(() -> {
                try (InputStream in = getContentResolver().openInputStream(uri)) {
                    if (in == null) throw new IOException();
                    String raw = new String(readBounded(in, MAX_BACKUP), StandardCharsets.UTF_8);
                    String quoted = JSONObject.quote(raw);
                    runOnUiThread(() -> {
                        if (trusted()) web.evaluateJavascript("window.dispatchEvent(new CustomEvent('kingdom-native-import',{detail:" + quoted + "}));", null);
                    });
                } catch (Exception error) { message("تعذّر قراءة النسخة أو تجاوزت الحجم المسموح. لم يتغير تقدمك."); }
            });
        }
    }

    static byte[] readBounded(InputStream input, int max) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192]; int count;
        while ((count = input.read(buffer)) != -1) {
            if (out.size() + count > max) throw new IOException("File exceeds limit");
            out.write(buffer, 0, count);
        }
        return out.toByteArray();
    }

    private void message(String text) {
        runOnUiThread(() -> { if (!isFinishing() && !isDestroyed()) Toast.makeText(this, text, Toast.LENGTH_LONG).show(); });
    }
    private void fatal(String text) {
        if (isFinishing() || isDestroyed()) return;
        new AlertDialog.Builder(this).setTitle("مملكة الأعداد السحرية").setMessage(text)
                .setPositiveButton("إغلاق", (dialog, which) -> finish()).setCancelable(false).show();
    }
    @Override protected void onPause() {
        if (web != null) {
            web.evaluateJavascript("window.dispatchEvent(new Event('kingdom-native-pause'));", null);
            web.onPause();
        }
        super.onPause();
    }
    @Override protected void onResume() { super.onResume(); if (web != null) web.onResume(); }
    @SuppressWarnings("deprecation")
    @Override public void onBackPressed() {
        if (!trusted()) { finish(); return; }
        web.evaluateJavascript("location.hash", hash -> {
            if (!"\"#home\"".equals(hash) && !"\"\"".equals(hash)) {
                web.evaluateJavascript("location.hash='home';", null);
            } else {
                new AlertDialog.Builder(this).setMessage("نحفظ تقدمك ونستريح؟")
                        .setNegativeButton("نكمل اللعب", null)
                        .setPositiveButton("أحفظ وأخرج", (dialog, which) -> web.evaluateJavascript(
                                "window.dispatchEvent(new Event('kingdom-native-pause'));", ignored -> finish())).show();
            }
        });
    }
    @Override protected void onDestroy() {
        files.shutdown();
        if (web != null) { web.removeJavascriptInterface("KingdomAndroid"); web.stopLoading(); web.destroy(); web = null; }
        super.onDestroy();
    }
}
