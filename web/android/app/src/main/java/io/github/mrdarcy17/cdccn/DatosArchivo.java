package io.github.mrdarcy17.cdccn;

import android.content.Context;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.HashSet;
import java.util.Iterator;
import java.util.Locale;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Lectura y escritura del archivo de datos (cdccn-datos.json) desde los widgets, sin abrir la app.
 * Sigue las reglas de esquema/estructura-json.md: ids únicos, días vacíos eliminados, respaldo .bak
 * y escritura en dos pasos. Deja una marca para que la app, al abrirse, recargue y suba a Drive.
 */
final class DatosArchivo {

    static final String ARCHIVO = "cdccn-datos.json";
    /** Marca de "hubo cambios desde un widget": la app la consume al abrirse (WidgetsPlugin). */
    static final String MARCA_CAMBIOS = "cambios-externos";

    private static final String ALFABETO = "abcdefghijklmnopqrstuvwxyz0123456789";
    private static final SecureRandom AZAR = new SecureRandom();

    private DatosArchivo() {}

    static String hoy() {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
    }

    /** Fecha y hora con zona horaria, p.ej. 2026-11-05T21:40:12-06:00. */
    static String ahoraIso() {
        return new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssXXX", Locale.US).format(new Date());
    }

    private static File archivo(Context c) {
        return new File(c.getFilesDir(), ARCHIVO);
    }

    /** null si la app nunca se ha abierto (todavía no hay archivo). */
    static synchronized JSONObject leer(Context c) throws IOException, JSONException {
        File f = archivo(c);
        if (!f.exists()) return null;
        try (InputStream in = new FileInputStream(f)) {
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) > 0) bytes.write(buf, 0, n);
            return new JSONObject(new String(bytes.toByteArray(), StandardCharsets.UTF_8));
        }
    }

    static synchronized void escribir(Context c, JSONObject datos) throws IOException, JSONException {
        datos.put("modificado", ahoraIso());
        datos.put("modificadoPor", "android");
        File f = archivo(c);
        File bak = new File(c.getFilesDir(), ARCHIVO + ".bak");
        File tmp = new File(c.getFilesDir(), ARCHIVO + ".tmp");
        if (f.exists()) copiar(f, bak);
        try (OutputStream out = new FileOutputStream(tmp)) {
            out.write((datos.toString(2) + "\n").getBytes(StandardCharsets.UTF_8));
        }
        if (!tmp.renameTo(f)) throw new IOException("No se pudo reemplazar el archivo de datos.");
        new File(c.getFilesDir(), MARCA_CAMBIOS).createNewFile();
        // Lo hecho desde un widget se sube solo a Drive (si está conectado), aunque la app no se abra.
        SubirDriveWorker.programar(c);
    }

    private static void copiar(File de, File a) throws IOException {
        try (InputStream in = new FileInputStream(de); OutputStream out = new FileOutputStream(a)) {
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
        }
    }

    private static JSONObject dias(JSONObject datos) throws JSONException {
        JSONObject d = datos.optJSONObject("dias");
        if (d == null) {
            d = new JSONObject();
            datos.put("dias", d);
        }
        return d;
    }

    private static JSONObject asegurarDia(JSONObject datos, String fecha) throws JSONException {
        JSONObject todos = dias(datos);
        JSONObject dia = todos.optJSONObject(fecha);
        if (dia == null) {
            dia = new JSONObject();
            dia.put("intensidad", 0);
            dia.put("caracteristicas", new JSONArray());
            dia.put("notas", new JSONArray());
            todos.put(fecha, dia);
        }
        return dia;
    }

    /** Regla: un día sin intensidad, sin características y sin notas se elimina. */
    private static void limpiarDia(JSONObject datos, String fecha) throws JSONException {
        JSONObject dia = dias(datos).optJSONObject(fecha);
        if (dia == null) return;
        boolean vacio = dia.optInt("intensidad", 0) == 0
            && dia.optJSONArray("caracteristicas") != null && dia.getJSONArray("caracteristicas").length() == 0
            && dia.optJSONArray("notas") != null && dia.getJSONArray("notas").length() == 0;
        if (vacio) dias(datos).remove(fecha);
    }

    static int intensidadDeHoy(Context c) {
        try {
            JSONObject datos = leer(c);
            if (datos == null) return 0;
            JSONObject dia = dias(datos).optJSONObject(hoy());
            return dia == null ? 0 : dia.optInt("intensidad", 0);
        } catch (Exception e) {
            return 0;
        }
    }

    /** Ciclo 0 → 1 → 2 → 3 → 0 del día de hoy (CU-07). Devuelve la nueva intensidad o -1 si no hay datos. */
    static synchronized int ciclarHoy(Context c) throws IOException, JSONException {
        JSONObject datos = leer(c);
        if (datos == null) return -1;
        String fecha = hoy();
        JSONObject dia = asegurarDia(datos, fecha);
        int nueva = (dia.optInt("intensidad", 0) + 1) % 4;
        dia.put("intensidad", nueva);
        limpiarDia(datos, fecha);
        escribir(c, datos);
        return nueva;
    }

    /** Etiquetas no archivadas, en orden: { id, nombre, color }. */
    static java.util.List<String[]> etiquetasActivas(Context c) {
        java.util.List<String[]> lista = new java.util.ArrayList<>();
        try {
            JSONObject datos = leer(c);
            JSONArray arr = datos == null ? null : datos.optJSONArray("etiquetas");
            if (arr != null) {
                for (int i = 0; i < arr.length(); i++) {
                    JSONObject e = arr.getJSONObject(i);
                    if (!e.optBoolean("archivada", false)) lista.add(new String[] { e.optString("id"), e.optString("nombre"), e.optString("color", "#FACC15") });
                }
            }
        } catch (Exception ignorado) {
            // sin datos legibles: sin etiquetas
        }
        return lista;
    }

    /** Agrega una nota nueva al día de hoy (CU-09) con las etiquetas elegidas. false si no hay datos o el texto está vacío. */
    static synchronized boolean agregarNotaHoy(Context c, String texto, java.util.List<String> etiquetas) throws IOException, JSONException {
        String limpio = texto == null ? "" : texto.trim();
        if (limpio.isEmpty()) return false;
        JSONObject datos = leer(c);
        if (datos == null) return false;
        String marca = ahoraIso();
        JSONObject nota = new JSONObject();
        nota.put("id", nuevoId("not", datos));
        nota.put("texto", limpio);
        // Solo etiquetas que existen (por si se borraron mientras el bloc de notas estaba abierto), sin repetir.
        Set<String> validas = new HashSet<>();
        JSONArray todas = datos.optJSONArray("etiquetas");
        if (todas != null) for (int i = 0; i < todas.length(); i++) validas.add(todas.getJSONObject(i).optString("id"));
        JSONArray elegidas = new JSONArray();
        Set<String> puestas = new HashSet<>();
        if (etiquetas != null) for (String id : etiquetas) if (validas.contains(id) && puestas.add(id)) elegidas.put(id);
        nota.put("etiquetas", elegidas);
        nota.put("creada", marca);
        nota.put("modificada", marca);
        asegurarDia(datos, hoy()).getJSONArray("notas").put(nota);
        escribir(c, datos);
        return true;
    }

    /** id como not_k3x9q2mf, que no se repita con ningún otro id del archivo. */
    private static String nuevoId(String prefijo, JSONObject datos) throws JSONException {
        Set<String> usados = new HashSet<>();
        for (String lista : new String[] { "caracteristicas", "etiquetas", "eventos" }) {
            JSONArray arr = datos.optJSONArray(lista);
            if (arr != null) for (int i = 0; i < arr.length(); i++) usados.add(arr.getJSONObject(i).optString("id"));
        }
        JSONObject todos = dias(datos);
        for (Iterator<String> it = todos.keys(); it.hasNext(); ) {
            JSONArray notas = todos.getJSONObject(it.next()).optJSONArray("notas");
            if (notas != null) for (int i = 0; i < notas.length(); i++) usados.add(notas.getJSONObject(i).optString("id"));
        }
        while (true) {
            StringBuilder sb = new StringBuilder(prefijo).append('_');
            for (int i = 0; i < 8; i++) sb.append(ALFABETO.charAt(AZAR.nextInt(ALFABETO.length())));
            String id = sb.toString();
            if (!usados.contains(id)) return id;
        }
    }

    /** Lo que necesita el widget "Mapa de actividad": intensidad por fecha y cuántos eventos cubren cada fecha. */
    static final class Mapa {
        final java.util.Map<String, Integer> intensidades = new java.util.HashMap<>();
        final java.util.List<String[]> eventos = new java.util.ArrayList<>();

        int eventosEn(String fecha) {
            int n = 0;
            for (String[] e : eventos) if (e[0].compareTo(fecha) <= 0 && fecha.compareTo(e[1]) <= 0) n++;
            return n;
        }
    }

    static Mapa leerMapa(Context c) {
        Mapa m = new Mapa();
        try {
            JSONObject datos = leer(c);
            if (datos == null) return m;
            JSONObject todos = dias(datos);
            for (Iterator<String> it = todos.keys(); it.hasNext(); ) {
                String fecha = it.next();
                m.intensidades.put(fecha, todos.getJSONObject(fecha).optInt("intensidad", 0));
            }
            JSONArray eventos = datos.optJSONArray("eventos");
            if (eventos != null) {
                for (int i = 0; i < eventos.length(); i++) {
                    JSONObject e = eventos.getJSONObject(i);
                    m.eventos.add(new String[] { e.optString("inicio"), e.optString("fin") });
                }
            }
        } catch (Exception ignorado) {
            // Sin datos legibles: el mapa se dibuja vacío.
        }
        return m;
    }

    /** true si un widget cambió los datos desde la última vez que la app los leyó; borra la marca. */
    static synchronized boolean consumirMarca(Context c) {
        File m = new File(c.getFilesDir(), MARCA_CAMBIOS);
        return m.exists() && m.delete();
    }
}
