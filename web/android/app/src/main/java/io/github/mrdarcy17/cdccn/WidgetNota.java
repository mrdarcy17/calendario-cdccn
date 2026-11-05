package io.github.mrdarcy17.cdccn;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

/** Widget "Nota del día" (CU-04): abre un bloc de notas que agrega una nota al día de hoy. */
public class WidgetNota extends AppWidgetProvider {

    @Override
    public void onUpdate(Context c, AppWidgetManager gestor, int[] ids) {
        Intent abrir = new Intent(c, NotaRapidaActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        PendingIntent pi = PendingIntent.getActivity(c, 1, abrir, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        for (int id : ids) {
            RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_nota);
            v.setOnClickPendingIntent(R.id.raiz_widget_nota, pi);
            gestor.updateAppWidget(id, v);
        }
    }
}
