package br.com.svrota;

import android.Manifest;
import android.app.AlertDialog;
import android.content.Intent;
import android.net.Uri;
import org.json.JSONObject;
import org.json.JSONArray;
import java.net.HttpURLConnection;
import java.net.URL;
import java.io.InputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import android.app.Activity;
import android.content.Context;
import android.os.Bundle;
import android.os.Build;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebChromeClient;
import android.webkit.JavascriptInterface;
import android.widget.Toast;
import android.speech.tts.TextToSpeech;
import java.util.Locale;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewAssetLoader.AssetsPathHandler;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewAssetLoader.PathHandler;
import androidx.webkit.WebViewAssetLoader;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;

public class MainActivity extends Activity {
    private WebView web;
    private LocationManager locations;
    private TextToSpeech tts;
    private boolean voiceReady=false;
    private final LocationListener listener = location -> {
        double lat = location.getLatitude(), lon = location.getLongitude();
        runOnUiThread(() -> {
            if (web != null) web.evaluateJavascript("window.onNativeLocation("+lat+","+lon+");", null);
        });
    };
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        tts = new TextToSpeech(this, result -> {
            if (result == TextToSpeech.SUCCESS) {
                voiceReady = tts.setLanguage(new Locale("pt", "BR")) >= 0;
            }
        });
        web = new WebView(this);
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
        web.getSettings().setAllowFileAccess(false);
        web.getSettings().setAllowContentAccess(false);
        web.addJavascriptInterface(new Object() {
            @JavascriptInterface public String getTrafficKey() {
                return getSharedPreferences("sv_rota_settings", Context.MODE_PRIVATE).getString("tomtom_key", "");
            }
            @JavascriptInterface public void saveTrafficKey(String key) {
                getSharedPreferences("sv_rota_settings", Context.MODE_PRIVATE).edit().putString("tomtom_key", key == null ? "" : key.trim()).apply();
            }
            @JavascriptInterface public void checkUpdates() {
                runOnUiThread(() -> checkForUpdates(true));
            }
            @JavascriptInterface public void requestLocation() {
                runOnUiThread(() -> startGps());
            }
            @JavascriptInterface public void speak(String message) {
                runOnUiThread(() -> {
                    if (tts != null && voiceReady) tts.speak(message, TextToSpeech.QUEUE_FLUSH, null, "svrota-instruction");
                    else Toast.makeText(MainActivity.this, "Voz do Android indisponível", Toast.LENGTH_SHORT).show();
                });
            }
            @JavascriptInterface public void stopSpeaking() {
                runOnUiThread(() -> { if(tts != null) tts.stop(); });
            }
        }, "SVRota");
        WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this)).build();
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return loader.shouldInterceptRequest(request.getUrl());
            }
        });
        web.setWebChromeClient(new WebChromeClient());
        setContentView(web);
        web.loadUrl("https://appassets.androidplatform.net/assets/index.html");
        locations = (LocationManager) getSystemService(LOCATION_SERVICE);
        startGps();
        checkForUpdates(false);
    }
    private void checkForUpdates(boolean manual) {
        new Thread(() -> {
            HttpURLConnection conn = null;
            try {
                conn = (HttpURLConnection) new URL("https://api.github.com/repos/kelvinprincesinha-ops/SV-Rota1/releases/latest").openConnection();
                conn.setConnectTimeout(8000);
                conn.setReadTimeout(8000);
                conn.setRequestProperty("Accept", "application/vnd.github+json");
                conn.setRequestProperty("User-Agent", "SV-Rota-Android");
                if (conn.getResponseCode() != 200) throw new Exception("HTTP " + conn.getResponseCode());
                InputStream in = conn.getInputStream();
                ByteArrayOutputStream bytes = new ByteArrayOutputStream();
                byte[] buffer = new byte[4096];
                int n;
                while ((n = in.read(buffer)) != -1 && bytes.size() < 262144) bytes.write(buffer, 0, n);
                in.close();
                JSONObject release = new JSONObject(new String(bytes.toByteArray(), StandardCharsets.UTF_8));
                String tag = release.optString("tag_name", "");
                if (!tag.matches("android-[0-9]+")) throw new Exception("Versão desconhecida");
                int latest = Integer.parseInt(tag.substring(8));
                int installed = getPackageManager().getPackageInfo(getPackageName(), 0).versionCode;
                JSONArray assets = release.optJSONArray("assets");
                String apkUrl = "";
                if (assets != null) for (int i=0;i<assets.length();i++) {
                    JSONObject asset = assets.getJSONObject(i);
                    if ("SV-Rota1.apk".equals(asset.optString("name"))) {
                        apkUrl = asset.optString("browser_download_url", "");
                        break;
                    }
                }
                final String downloadUrl = apkUrl;
                if (!downloadUrl.startsWith("https://github.com/kelvinprincesinha-ops/SV-Rota1/releases/download/")) throw new Exception("APK não encontrado");
                runOnUiThread(() -> {
                    if (isFinishing() || isDestroyed()) return;
                    if (latest > installed) new AlertDialog.Builder(this)
                        .setTitle("Atualização do SV Rota")
                        .setMessage("Nova versão #" + latest + " disponível. Instalada: #" + installed + ". Deseja baixar o APK para atualizar?")
                        .setNegativeButton("Depois", null)
                        .setPositiveButton("Baixar atualização", (dialog, which) -> startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(downloadUrl))))
                        .show();
                    else if (manual) Toast.makeText(this, "SV Rota já está atualizado", Toast.LENGTH_LONG).show();
                });
            } catch (Exception e) {
                if (manual) runOnUiThread(() -> Toast.makeText(this, "Não foi possível verificar atualizações", Toast.LENGTH_LONG).show());
            } finally { if (conn != null) conn.disconnect(); }
        }).start();
    }
    private void startGps() {
        if (Build.VERSION.SDK_INT >= 23 && checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED
                && checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}, 42);
            return;
        }
        try {
            if (locations.isProviderEnabled(LocationManager.GPS_PROVIDER))
                locations.requestLocationUpdates(LocationManager.GPS_PROVIDER, 3000, 3, listener);
            if (locations.isProviderEnabled(LocationManager.NETWORK_PROVIDER))
                locations.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 3000, 3, listener);
            Location last = locations.getLastKnownLocation(LocationManager.GPS_PROVIDER);
            if (last == null) last = locations.getLastKnownLocation(LocationManager.NETWORK_PROVIDER);
            if (last != null) listener.onLocationChanged(last);
        } catch (SecurityException e) { Toast.makeText(this, "Permita acesso à localização", Toast.LENGTH_LONG).show(); }
    }
    @Override public void onRequestPermissionsResult(int request, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(request, permissions, results);
        if (request == 42) startGps();
    }
    @Override protected void onDestroy() {
        if (locations != null) locations.removeUpdates(listener);
        if (tts != null) { tts.stop(); tts.shutdown(); }
        if (web != null) web.destroy();
        super.onDestroy();
    }
}
