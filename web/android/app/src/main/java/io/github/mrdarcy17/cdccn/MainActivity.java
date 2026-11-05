package io.github.mrdarcy17.cdccn;

import android.os.Bundle;
import android.view.View;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugin propio: inicio de sesión de Google para Drive.
        registerPlugin(GoogleDrivePlugin.class);
        super.onCreate(savedInstanceState);
        // Sin efecto de "estirar/rebotar" al llegar al borde: la pantalla queda fija.
        getBridge().getWebView().setOverScrollMode(View.OVER_SCROLL_NEVER);
    }
}
