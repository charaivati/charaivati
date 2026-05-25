package com.charaivati.store;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        CookieManager.getInstance().setAcceptCookie(true);

        WebView webView = getBridge().getWebView();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);
        }

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();

                // Send Maps URLs and geo: URIs to the native Maps app via OS intent.
                if (isMapsUrl(url)) {
                    Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                    intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(intent);
                    return true;
                }

                if (url.contains("charaivati.com")) {
                    view.loadUrl(url);
                    return true;
                }
                return false;
            }
        });
    }

    private static boolean isMapsUrl(String url) {
        return url.startsWith("geo:")
                || url.startsWith("https://maps.google.com")
                || url.startsWith("http://maps.google.com")
                || url.startsWith("https://www.google.com/maps")
                || url.startsWith("http://www.google.com/maps");
    }
}