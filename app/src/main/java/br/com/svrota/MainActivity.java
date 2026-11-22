package br.com.svrota;

import android.Manifest;
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
