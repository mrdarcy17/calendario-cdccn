package io.github.mrdarcy17.cdccn;

import android.app.Activity;
import android.app.PendingIntent;
import android.content.Intent;
import androidx.activity.result.ActivityResult;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.IntentSenderRequest;
import androidx.activity.result.contract.ActivityResultContracts;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.auth.api.identity.AuthorizationClient;
import com.google.android.gms.auth.api.identity.AuthorizationRequest;
import com.google.android.gms.auth.api.identity.AuthorizationResult;
import com.google.android.gms.auth.api.identity.ClearTokenRequest;
import com.google.android.gms.auth.api.identity.Identity;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.common.api.CommonStatusCodes;
import com.google.android.gms.common.api.Scope;
import java.util.Collections;

/**
 * Pide a Google el permiso drive.file con el inicio de sesión de Android (Google Identity Services).
 * Google reconoce la app por el nombre del paquete y la huella SHA-1 registrados en Google Cloud.
 * Tras la primera autorización, los tokens nuevos se obtienen sin mostrar nada al usuario.
 */
@CapacitorPlugin(name = "GoogleDrive")
public class GoogleDrivePlugin extends Plugin {

    private static final Scope DRIVE_FILE = new Scope("https://www.googleapis.com/auth/drive.file");

    private ActivityResultLauncher<IntentSenderRequest> lanzador;
    private PluginCall pendiente;

    @Override
    public void load() {
        lanzador = getActivity()
            .getActivityResultRegistry()
            .register("sarger-google-drive", new ActivityResultContracts.StartIntentSenderForResult(), this::alVolverDeGoogle);
    }

    @Override
    protected void handleOnDestroy() {
        if (lanzador != null) lanzador.unregister();
    }

    private AuthorizationClient cliente() {
        return Identity.getAuthorizationClient(getActivity());
    }

    /** { interactivo: boolean } → { accessToken }. Sin interacción falla con código NECESITA_INTERACCION. */
    @PluginMethod
    public void autorizar(PluginCall call) {
        boolean interactivo = Boolean.TRUE.equals(call.getBoolean("interactivo", false));
        AuthorizationRequest solicitud = AuthorizationRequest.builder().setRequestedScopes(Collections.singletonList(DRIVE_FILE)).build();
        cliente()
            .authorize(solicitud)
            .addOnSuccessListener(resultado -> {
                if (!resultado.hasResolution()) {
                    resolver(call, resultado);
                    return;
                }
                if (!interactivo) {
                    call.reject("Se necesita iniciar sesión en Google.", "NECESITA_INTERACCION");
                    return;
                }
                if (pendiente != null) {
                    call.reject("Ya hay un inicio de sesión en curso.", "EN_CURSO");
                    return;
                }
                PendingIntent pi = resultado.getPendingIntent();
                if (pi == null) {
                    call.reject("Google no entregó la pantalla de inicio de sesión.", "ERROR");
                    return;
                }
                pendiente = call;
                lanzador.launch(new IntentSenderRequest.Builder(pi.getIntentSender()).build());
            })
            .addOnFailureListener(e -> call.reject(mensaje(e), codigo(e)));
    }

    private void alVolverDeGoogle(ActivityResult resultado) {
        PluginCall call = pendiente;
        pendiente = null;
        if (call == null) return;
        Intent datos = resultado.getData();
        if (resultado.getResultCode() == Activity.RESULT_CANCELED || datos == null) {
            call.reject("Se canceló el inicio de sesión.", "CANCELADO");
            return;
        }
        try {
            resolver(call, cliente().getAuthorizationResultFromIntent(datos));
        } catch (ApiException e) {
            call.reject(mensaje(e), codigo(e));
        }
    }

    private void resolver(PluginCall call, AuthorizationResult resultado) {
        String token = resultado.getAccessToken();
        if (token == null) {
            call.reject("Google no entregó acceso.", "ERROR");
            return;
        }
        if (!resultado.getGrantedScopes().contains(DRIVE_FILE.getScopeUri())) {
            call.reject("Es necesario permitir el acceso a los archivos de Drive que crea la app.", "SIN_PERMISO");
            return;
        }
        JSObject respuesta = new JSObject();
        respuesta.put("accessToken", token);
        call.resolve(respuesta);
    }

    /** { token } — descarta un token vencido para que el siguiente autorizar() entregue uno nuevo. */
    @PluginMethod
    public void olvidarToken(PluginCall call) {
        String token = call.getString("token");
        if (token == null || token.isEmpty()) {
            call.resolve();
            return;
        }
        cliente().clearToken(ClearTokenRequest.builder().setToken(token).build()).addOnCompleteListener(t -> call.resolve());
    }

    private static String codigo(Exception e) {
        if (e instanceof ApiException) {
            int estado = ((ApiException) e).getStatusCode();
            if (estado == CommonStatusCodes.DEVELOPER_ERROR) return "CONFIGURACION";
            if (estado == CommonStatusCodes.NETWORK_ERROR) return "SIN_INTERNET";
            if (estado == CommonStatusCodes.CANCELED) return "CANCELADO";
        }
        return "ERROR";
    }

    private static String mensaje(Exception e) {
        switch (codigo(e)) {
            case "CONFIGURACION":
                return "Google rechazó la app: revisa en Google Cloud el ID de cliente Android (paquete io.github.mrdarcy17.cdccn y huella SHA-1).";
            case "SIN_INTERNET":
                return "Sin conexión con Google.";
            case "CANCELADO":
                return "Se canceló el inicio de sesión.";
            default:
                return e.getMessage() != null ? e.getMessage() : "Error al iniciar sesión con Google.";
        }
    }
}
