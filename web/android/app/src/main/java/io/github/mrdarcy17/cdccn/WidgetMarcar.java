package io.github.mrdarcy17.cdccn;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;
import android.widget.Toast;

/** Widget "Marcar día" (CU-04): cada toque sube la intensidad de hoy 0 → 1 → 2 → 3 → 0, sin abrir la app. */
public class WidgetMarcar extends AppWidgetProvider {

    static final String ACCION_CICLAR = "io.github.mrdarcy17.cdccn.CICLAR_HOY";

    private static final int[] FONDOS = { R.drawable.widget_palomita_0, R.drawable.widget_palomita_1, R.drawable.widget_palomita_2, R.drawable.widget_palomita_3 };
    private static final int AMARILLO = 0xFFFACC15;
    private static final int OSCURO = 0xFF1A1500;

    @Override
    public void onUpdate(Context c, AppWidgetManager gestor, int[] ids) {
        int intensidad = DatosArchivo.intensidadDeHoy(c);
        for (int id : ids) gestor.updateAppWidget(id, vista(c, intensidad));
    }

    @Override
    public void onReceive(Context c, Intent intent) {
        super.onReceive(c, intent);
        if (!ACCION_CICLAR.equals(intent.getAction())) return;
        try {
            int nueva = DatosArchivo.ciclarHoy(c);
            if (nueva < 0) Toast.makeText(c, "Abre Sarger una vez para empezar", Toast.LENGTH_SHORT).show();
        } catch (Exception e) {
            Toast.makeText(c, "No se pudo marcar el día", Toast.LENGTH_SHORT).show();
        }
        actualizarTodos(c);
    }

    private static RemoteViews vista(Context c, int intensidad) {
        int i = Math.max(0, Math.min(3, intensidad));
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_marcar);
        v.setInt(R.id.palomita, "setBackgroundResource", FONDOS[i]);
        v.setInt(R.id.palomita, "setColorFilter", i >= 2 ? OSCURO : AMARILLO);
        Intent ciclar = new Intent(c, WidgetMarcar.class).setAction(ACCION_CICLAR);
        PendingIntent pi = PendingIntent.getBroadcast(c, 0, ciclar, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        v.setOnClickPendingIntent(R.id.raiz_widget_marcar, pi);
        return v;
    }

    /** Redibuja los widgets "Marcar día" y "Mapa de actividad" (también la llama la app tras guardar). */
    static void actualizarTodos(Context c) {
        WidgetMapa.actualizarTodos(c);
        AppWidgetManager gestor = AppWidgetManager.getInstance(c);
        int[] ids = gestor.getAppWidgetIds(new ComponentName(c, WidgetMarcar.class));
        if (ids.length == 0) return;
        int intensidad = DatosArchivo.intensidadDeHoy(c);
        for (int id : ids) gestor.updateAppWidget(id, vista(c, intensidad));
    }
}
