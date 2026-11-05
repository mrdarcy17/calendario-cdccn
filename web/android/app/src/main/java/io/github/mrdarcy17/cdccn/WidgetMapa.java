package io.github.mrdarcy17.cdccn;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.os.Bundle;
import android.widget.RemoteViews;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Locale;

/**
 * Widget "Mapa de actividad" (2×2, redimensionable): las semanas más recientes como en la parte de arriba de la app,
 * solo las casillas (sin días ni meses) y fijo (no se desliza). Las casillas llenan todo el alto;
 * el ancho decide cuántas semanas caben. Mismos colores que la app:
 * amarillo según la intensidad, verde detrás de los días con eventos y borde blanco en hoy.
 * Al tocarlo se abre Sarger.
 */
public class WidgetMapa extends AppWidgetProvider {

    private static final int MAX_SEMANAS = 53;
    private static final int[] INTENSIDAD = { 0xFF272314, 0xFF5A4D16, 0xFF9F8315, 0xFFFACC15 };
    /** Verde #34D399 con la opacidad de 1, 2 y 3+ eventos (igual que en la app). */
    private static final int[] EVENTO = { Color.argb(41, 52, 211, 153), Color.argb(77, 52, 211, 153), Color.argb(117, 52, 211, 153) };

    @Override
    public void onUpdate(Context c, AppWidgetManager gestor, int[] ids) {
        for (int id : ids) dibujar(c, gestor, id);
    }

    @Override
    public void onAppWidgetOptionsChanged(Context c, AppWidgetManager gestor, int id, Bundle opciones) {
        dibujar(c, gestor, id);
    }

    static void actualizarTodos(Context c) {
        AppWidgetManager gestor = AppWidgetManager.getInstance(c);
        for (int id : gestor.getAppWidgetIds(new ComponentName(c, WidgetMapa.class))) dibujar(c, gestor, id);
    }

    private static void dibujar(Context c, AppWidgetManager gestor, int id) {
        Bundle op = gestor.getAppWidgetOptions(id);
        float d = c.getResources().getDisplayMetrics().density;
        // En vertical el widget mide minWidth × maxHeight (dp); se resta el margen interior de 6 dp por lado.
        int anchoDp = op.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 140);
        int altoDp = op.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 70);
        int ancho = Math.max(1, Math.round((Math.max(anchoDp, 60) - 12) * d));
        int alto = Math.max(1, Math.round((Math.max(altoDp, 30) - 12) * d));

        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_mapa);
        v.setImageViewBitmap(R.id.mapa, imagen(DatosArchivo.leerMapa(c), ancho, alto, d));
        Intent abrir = new Intent(c, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        v.setOnClickPendingIntent(R.id.raiz_widget_mapa, PendingIntent.getActivity(c, 2, abrir, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        gestor.updateAppWidget(id, v);
    }

    static Bitmap imagen(DatosArchivo.Mapa mapa, int ancho, int alto, float densidad) {
        final float proporcionHueco = 0.22f;
        // Las 7 filas ocupan todo el alto; caben tantas semanas como permita el ancho.
        float celda = alto / (7 + 6 * proporcionHueco);
        float hueco = celda * proporcionHueco;
        int semanas = (int) Math.floor((ancho + hueco) / (celda + hueco));
        semanas = Math.max(1, Math.min(MAX_SEMANAS, semanas));
        float radio = celda * 0.22f;
        float anchoRejilla = semanas * celda + (semanas - 1) * hueco;
        float altoRejilla = 7 * celda + 6 * hueco;
        float x0 = (ancho - anchoRejilla) / 2f;
        float y0 = (alto - altoRejilla) / 2f;

        Bitmap bmp = Bitmap.createBitmap(ancho, alto, Bitmap.Config.ARGB_8888);
        Canvas lienzo = new Canvas(bmp);
        Paint relleno = new Paint(Paint.ANTI_ALIAS_FLAG);
        Paint borde = new Paint(Paint.ANTI_ALIAS_FLAG);
        borde.setStyle(Paint.Style.STROKE);

        SimpleDateFormat formato = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
        Calendar dia = Calendar.getInstance();
        String hoy = formato.format(dia.getTime());
        int desdeLunes = (dia.get(Calendar.DAY_OF_WEEK) + 5) % 7;
        dia.add(Calendar.DAY_OF_MONTH, -desdeLunes - 7 * (semanas - 1)); // lunes de la primera semana visible

        for (int s = 0; s < semanas; s++) {
            for (int f = 0; f < 7; f++) {
                String fecha = formato.format(dia.getTime());
                dia.add(Calendar.DAY_OF_MONTH, 1);
                float x = x0 + s * (celda + hueco);
                float y = y0 + f * (celda + hueco);
                RectF r = new RectF(x, y, x + celda, y + celda);

                if (fecha.compareTo(hoy) > 0) { // futuro: solo el contorno
                    borde.setColor(0xFF1F1F1F);
                    borde.setStrokeWidth(Math.max(1f, densidad * 0.6f));
                    lienzo.drawRoundRect(r, radio, radio, borde);
                    continue;
                }
                Integer valor = mapa.intensidades.get(fecha);
                int intensidad = valor == null ? 0 : Math.max(0, Math.min(3, valor));
                int eventos = mapa.eventosEn(fecha);
                if (eventos > 0) { // el verde rodea la casilla y llena el hueco; el amarillo queda encima
                    relleno.setColor(EVENTO[Math.min(eventos, 3) - 1]);
                    RectF halo = new RectF(r.left - hueco / 2, r.top - hueco / 2, r.right + hueco / 2, r.bottom + hueco / 2);
                    lienzo.drawRoundRect(halo, radio, radio, relleno);
                }
                if (intensidad > 0 || eventos == 0) {
                    relleno.setColor(INTENSIDAD[intensidad]);
                    lienzo.drawRoundRect(r, radio, radio, relleno);
                }
                if (fecha.equals(hoy)) {
                    borde.setColor(0xFFF2F2F2);
                    borde.setStrokeWidth(Math.max(1.5f, densidad * 1.2f));
                    lienzo.drawRoundRect(r, radio, radio, borde);
                }
            }
        }
        return bmp;
    }
}
