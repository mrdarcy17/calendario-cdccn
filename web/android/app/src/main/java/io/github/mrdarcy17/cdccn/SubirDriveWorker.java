package io.github.mrdarcy17.cdccn;

import android.content.Context;
import androidx.annotation.NonNull;
import androidx.work.BackoffPolicy;
import androidx.work.Constraints;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
import com.google.android.gms.auth.api.identity.AuthorizationRequest;
import com.google.android.gms.auth.api.identity.AuthorizationResult;
import com.google.android.gms.auth.api.identity.ClearTokenRequest;
import com.google.android.gms.auth.api.identity.Identity;
import com.google.android.gms.common.api.Scope;
import com.google.android.gms.tasks.Tasks;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.concurrent.TimeUnit;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Sube a Google Drive, en segundo plano, lo que se marcó o escribió desde un widget (CU-04 + CU-11).
 * Forma simple: reemplaza el archivo completo de Drive. Solo corre con internet; si falla, reintenta.
 * Al terminar deja constancia (drive-subido.json) para que la app, al abrirse, no vuelva a subirlo.
 */
public class SubirDriveWorker extends Worker {

    private static final String TRABAJO = "sarger-subir-drive";
    /** Lo escribe la app: { conectado, archivoId, version } (ver src/main.ts). */
    static final String ESTADO_DRIVE = "drive-estado.json";
    /** Lo escribe este worker: { version, modificado } de la última subida hecha desde aquí. */
    static final String SUBIDO = "drive-subido.json";

    private static final Scope DRIVE_FILE = new Scope("https://www.googleapis.com/auth/drive.file");
    private static final String API = "https://www.googleapis.com/drive/v3/files";
    private static final String SUBIDA = "https://www.googleapis.com/upload/drive/v3/files";

    public SubirDriveWorker(@NonNull Context contexto, @NonNull WorkerParameters parametros) {
        super(contexto, parametros);
    }

    /** Programa la subida unos segundos después (varios toques seguidos se suben una sola vez). */
    static void programar(Context c) {
        OneTimeWorkRequest trabajo = new OneTimeWorkRequest.Builder(SubirDriveWorker.class)
            .setConstraints(new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .setInitialDelay(5, TimeUnit.SECONDS)
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
            .build();
        WorkManager.getInstance(c).enqueueUniqueWork(TRABAJO, ExistingWorkPolicy.REPLACE, trabajo);
    }

    @NonNull
    @Override
    public Result doWork() {
        Context c = getApplicationContext();
        try {
            JSONObject estado = leerJson(new File(c.getFilesDir(), ESTADO_DRIVE));
            if (estado == null || !estado.optBoolean("conectado", false)) return Result.success(); // Drive no conectado
            File archivo = new File(c.getFilesDir(), DatosArchivo.ARCHIVO);
            if (!archivo.exists()) return Result.success();
            String contenido = leerTexto(archivo);
            String modificado = new JSONObject(contenido).optString("modificado");

            String token = token(c, null);
            if (token == null) return Result.success(); // hay que volver a autorizar: lo hará la app al abrirse
            String id = estado.optString("archivoId", "");
            if (id.isEmpty()) id = buscarArchivo(token);
            if (id == null) return Result.success(); // la app lo creará

            int codigo;
            String version;
            HttpURLConnection con = subir(token, id, contenido);
            codigo = con.getResponseCode();
            if (codigo == 401) { // token rechazado: se pide otro y se reintenta una vez
                con.disconnect();
                token = token(c, token);
                if (token == null) return Result.success();
                con = subir(token, id, contenido);
                codigo = con.getResponseCode();
            }
            if (codigo == 404) return Result.success(); // borraron el archivo en Drive: la app lo recreará
            if (codigo < 200 || codigo >= 300) return codigo >= 500 || codigo == 429 ? Result.retry() : Result.failure();
            version = new JSONObject(leerTexto(con.getInputStream())).optString("version");
            con.disconnect();

            JSONObject subido = new JSONObject();
            subido.put("version", version);
            subido.put("modificado", modificado);
            escribirTexto(new File(c.getFilesDir(), SUBIDO), subido.toString());
            estado.put("archivoId", id);
            estado.put("version", version);
            escribirTexto(new File(c.getFilesDir(), ESTADO_DRIVE), estado.toString());
            return Result.success();
        } catch (IOException e) {
            return Result.retry(); // sin conexión o falla temporal
        } catch (Exception e) {
            return Result.failure();
        }
    }

    /** Token de Google sin mostrar nada; null si hace falta que el usuario vuelva a autorizar. */
    private static String token(Context c, String vencido) throws Exception {
        if (vencido != null) Tasks.await(Identity.getAuthorizationClient(c).clearToken(ClearTokenRequest.builder().setToken(vencido).build()));
        AuthorizationRequest solicitud = AuthorizationRequest.builder().setRequestedScopes(Collections.singletonList(DRIVE_FILE)).build();
        AuthorizationResult r = Tasks.await(Identity.getAuthorizationClient(c).authorize(solicitud), 30, TimeUnit.SECONDS);
        return r.hasResolution() ? null : r.getAccessToken();
    }

    private static HttpURLConnection subir(String token, String id, String contenido) throws IOException {
        HttpURLConnection con = (HttpURLConnection) new URL(SUBIDA + "/" + id + "?uploadType=media&fields=id,version").openConnection();
        // HttpURLConnection no admite PATCH: se usa POST con el encabezado que Google acepta para PATCH.
        con.setRequestMethod("POST");
        con.setRequestProperty("X-HTTP-Method-Override", "PATCH");
        con.setRequestProperty("Authorization", "Bearer " + token);
        con.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
        con.setConnectTimeout(20000);
        con.setReadTimeout(30000);
        con.setDoOutput(true);
        try (OutputStream out = con.getOutputStream()) {
            out.write(contenido.getBytes(StandardCharsets.UTF_8));
        }
        return con;
    }

    /** Busca cdccn/cdccn-datos.json (con drive.file solo se ven los archivos que creó la app). */
    private static String buscarArchivo(String token) throws Exception {
        String carpeta = primerId(token, "name='cdccn' and mimeType='application/vnd.google-apps.folder' and trashed=false");
        return carpeta == null ? null : primerId(token, "name='cdccn-datos.json' and '" + carpeta + "' in parents and trashed=false");
    }

    private static String primerId(String token, String q) throws Exception {
        URL url = new URL(API + "?spaces=drive&fields=files(id)&orderBy=modifiedTime%20desc&q=" + URLEncoder.encode(q, "UTF-8"));
        HttpURLConnection con = (HttpURLConnection) url.openConnection();
        con.setRequestProperty("Authorization", "Bearer " + token);
        con.setConnectTimeout(20000);
        con.setReadTimeout(30000);
        if (con.getResponseCode() != 200) throw new IOException("Drive respondió " + con.getResponseCode());
        JSONArray archivos = new JSONObject(leerTexto(con.getInputStream())).optJSONArray("files");
        con.disconnect();
        return archivos != null && archivos.length() > 0 ? archivos.getJSONObject(0).optString("id") : null;
    }

    private static JSONObject leerJson(File f) {
        try {
            return f.exists() ? new JSONObject(leerTexto(f)) : null;
        } catch (Exception e) {
            return null;
        }
    }

    static String leerTexto(File f) throws IOException {
        try (InputStream in = new FileInputStream(f)) {
            return leerTexto(in);
        }
    }

    private static String leerTexto(InputStream in) throws IOException {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        int n;
        while ((n = in.read(buf)) > 0) bytes.write(buf, 0, n);
        return new String(bytes.toByteArray(), StandardCharsets.UTF_8);
    }

    private static void escribirTexto(File f, String texto) throws IOException {
        File tmp = new File(f.getPath() + ".tmp");
        try (OutputStream out = new FileOutputStream(tmp)) {
            out.write(texto.getBytes(StandardCharsets.UTF_8));
        }
        if (!tmp.renameTo(f)) throw new IOException("No se pudo escribir " + f.getName());
    }
}
