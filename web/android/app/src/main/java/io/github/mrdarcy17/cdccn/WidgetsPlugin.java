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

    /** → { hubo }: true si un widget cambió el archivo desde la última vez (y borra la marca). */
    @PluginMethod
    public void consumirCambios(PluginCall call) {
        JSObject r = new JSObject();
        r.put("hubo", DatosArchivo.consumirMarca(getContext()));
        call.resolve(r);
    }
}
