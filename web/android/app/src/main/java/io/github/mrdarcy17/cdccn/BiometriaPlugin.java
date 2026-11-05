package io.github.mrdarcy17.cdccn;

import androidx.annotation.NonNull;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Huella (o el biométrico que tenga el teléfono) para desbloquear la app (CU-02).
 * El límite de intentos lo pone Android; el PIN siempre queda disponible como alternativa.
 */
@CapacitorPlugin(name = "Biometria")
public class BiometriaPlugin extends Plugin {

    private static final int AUTENTICADORES = BiometricManager.Authenticators.BIOMETRIC_WEAK;

    /** → { disponible }: true si el teléfono tiene huella registrada. */
    @PluginMethod
    public void disponible(PluginCall call) {
        int estado = BiometricManager.from(getContext()).canAuthenticate(AUTENTICADORES);
        JSObject r = new JSObject();
        r.put("disponible", estado == BiometricManager.BIOMETRIC_SUCCESS);
        call.resolve(r);
    }

    /** Muestra el diálogo de huella. Se resuelve si la huella es válida; se rechaza si se cancela o falla. */
    @PluginMethod
    public void autenticar(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            BiometricPrompt.PromptInfo info = new BiometricPrompt.PromptInfo.Builder()
                .setTitle("Desbloquear Sarger")
                .setSubtitle("Usa tu huella")
                .setNegativeButtonText("Usar PIN")
                .setAllowedAuthenticators(AUTENTICADORES)
                .build();
            BiometricPrompt dialogo = new BiometricPrompt(
                (FragmentActivity) getActivity(),
                ContextCompat.getMainExecutor(getContext()),
                new BiometricPrompt.AuthenticationCallback() {
                    @Override
                    public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult resultado) {
                        call.resolve();
                    }

                    @Override
                    public void onAuthenticationError(int codigo, @NonNull CharSequence mensaje) {
                        call.reject(mensaje.toString(), String.valueOf(codigo));
                    }
                    // onAuthenticationFailed: una huella no reconocida; el diálogo sigue abierto para reintentar.
                }
            );
            dialogo.authenticate(info);
        });
    }
}
