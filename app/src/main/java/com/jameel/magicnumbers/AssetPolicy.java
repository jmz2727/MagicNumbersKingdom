package com.jameel.magicnumbers;

import java.net.URI;
import java.util.Set;

/** Pure routing and byte-range logic, independently testable without Android. */
final class AssetPolicy {
    static final String HOST = "appassets.androidplatform.net";
    static final String START = "https://" + HOST + "/app/index.html";

    static String file(String url, Set<String> files) {
        try {
            URI uri = new URI(url);
            if (!"https".equalsIgnoreCase(uri.getScheme()) || !HOST.equalsIgnoreCase(uri.getHost())
                    || uri.getPort() != -1 || uri.getRawUserInfo() != null || uri.getRawQuery() != null) return null;
            String path = uri.getPath();
            if (path == null || !path.startsWith("/app/")) return null;
            String name = path.substring(5);
            if (name.isEmpty() || name.indexOf('\\') >= 0 || name.indexOf('\0') >= 0) return null;
            for (String part : name.split("/", -1)) {
                if (part.isEmpty() || part.equals(".") || part.equals("..") || part.startsWith(".")) return null;
            }
            return files.contains(name) ? name : null;
        } catch (Exception invalid) { return null; }
    }

    static boolean navigation(String url, Set<String> files) {
        return "index.html".equals(file(url, files));
    }

    static String mime(String name) {
        if (name.endsWith(".html")) return "text/html";
        if (name.endsWith(".js")) return "application/javascript";
        if (name.endsWith(".css")) return "text/css";
        if (name.endsWith(".json")) return "application/json";
        if (name.endsWith(".mp3")) return "audio/mpeg";
        if (name.endsWith(".svg")) return "image/svg+xml";
        if (name.endsWith(".png")) return "image/png";
        return "application/octet-stream";
    }

    static final class Range {
        final int status, start, end;
        Range(int status, int start, int end) { this.status = status; this.start = start; this.end = end; }
        int length() { return end >= start ? end - start + 1 : 0; }
    }

    static Range range(String header, int size) {
        if (header == null) return new Range(200, 0, size - 1);
        try {
            if (size <= 0 || !header.matches("(?i)bytes=[0-9]*-[0-9]*")) throw new IllegalArgumentException();
            String[] bounds = header.substring(6).split("-", -1);
            long start, end;
            if (bounds[0].isEmpty()) {
                long suffix = Long.parseLong(bounds[1]);
                if (suffix <= 0) throw new IllegalArgumentException();
                start = Math.max(0L, size - suffix); end = size - 1L;
            } else {
                start = Long.parseLong(bounds[0]);
                end = bounds[1].isEmpty() ? size - 1L : Math.min(size - 1L, Long.parseLong(bounds[1]));
            }
            if (start < 0 || start >= size || end < start) throw new IllegalArgumentException();
            return new Range(206, (int) start, (int) end);
        } catch (Exception invalid) { return new Range(416, 0, -1); }
    }
}
