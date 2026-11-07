package io.github.mrdarcy17.cdccn;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Puente entre la app y los widgets. */
@CapacitorPlugin(name = "Widgets")
public class WidgetsPlugin extends Plugin {

    /** La app guardó datos: redibuja el widget "Marcar día" con la intensidad de hoy. */
    @PluginMethod
    public void actualizar(PluginCall call) {
        WidgetMarcar.actualizarTodos(getContext());
        call.resolve();
    }

    /**
     * → { hubo, versionSubida }: hubo = un widget cambió el archivo desde la última vez (borra la marca);
     * versionSubida = versión de Drive si la subida en segundo plano ya subió exactamente el archivo actual.
     */
    @PluginMethod
    public void consumirCambios(PluginCall call) {
        JSObject r = new JSObject();
        r.put("hubo", DatosArchivo.consumirMarca(getContext()));
        r.put("versionSubida", versionSubida());
        call.resolve(r);
    }

    private String versionSubida() {
        java.io.File subido = new java.io.File(getContext().getFilesDir(), SubirDriveWorker.SUBIDO);
        if (!subido.exists()) return null;
        try {
            org.json.JSONObject s = new org.json.JSONObject(SubirDriveWorker.leerTexto(subido));
            org.json.JSONObject datos = DatosArchivo.leer(getContext());
            // Solo vale si lo subido es lo que hay ahora (si hubo otro toque después, la app debe subirlo).
            boolean coincide = datos != null && s.optString("modificado").equals(datos.optString("modificado"));
            return coincide ? s.optString("version") : null;
        } catch (Exception e) {
            return null;
        } finally {
            subido.delete();
        }
    }
}
