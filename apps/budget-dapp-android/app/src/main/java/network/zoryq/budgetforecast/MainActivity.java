package network.zoryq.budgetforecast;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public class MainActivity extends Activity {
    private static final String HOST = "zoryq-evm-node-live-production.up.railway.app";
    private static final String FACTORY_URL = "https://" + HOST + "/launch-studio";
    private static final String PREFS = "zoryq_apps";
    private static final String LAST_APP_URL = "last_app_url";
    private WebView webView;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(7, 10, 16));
        getWindow().setNavigationBarColor(Color.rgb(7, 10, 16));

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(7, 10, 16));
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setUserAgentString(settings.getUserAgentString() + " ZORYQ-App-Runner-Android/1.1");

        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (isAllowed(uri)) return false;
                Intent external = new Intent(Intent.ACTION_VIEW, uri);
                startActivity(external);
                return true;
            }
        });

        if (savedInstanceState == null) {
            webView.loadUrl(resolveLaunchUrl(getIntent()));
        } else {
            webView.restoreState(savedInstanceState);
        }
    }

    private SharedPreferences prefs() {
        return getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private String rememberedAppOrFactory() {
        String raw = prefs().getString(LAST_APP_URL, FACTORY_URL);
        try {
            Uri candidate = Uri.parse(raw);
            return isAllowed(candidate) ? candidate.toString() : FACTORY_URL;
        } catch (Exception ignored) {
            return FACTORY_URL;
        }
    }

    private String resolveLaunchUrl(Intent intent) {
        if (intent == null || intent.getData() == null) return rememberedAppOrFactory();
        Uri deep = intent.getData();
        if (!"zoryqapp".equalsIgnoreCase(deep.getScheme()) || !"open".equalsIgnoreCase(deep.getHost())) return rememberedAppOrFactory();
        String raw = deep.getQueryParameter("url");
        if (raw == null || raw.isEmpty()) return rememberedAppOrFactory();
        try {
            Uri candidate = Uri.parse(raw);
            if (isAllowed(candidate)) {
                String value = candidate.toString();
                prefs().edit().putString(LAST_APP_URL, value).apply();
                return value;
            }
            return rememberedAppOrFactory();
        } catch (Exception ignored) {
            return rememberedAppOrFactory();
        }
    }

    private boolean isAllowed(Uri uri) {
        return uri != null && "https".equalsIgnoreCase(uri.getScheme()) && HOST.equalsIgnoreCase(uri.getHost());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        if (webView != null) webView.loadUrl(resolveLaunchUrl(intent));
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack(); else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) webView.destroy();
        super.onDestroy();
    }
}
