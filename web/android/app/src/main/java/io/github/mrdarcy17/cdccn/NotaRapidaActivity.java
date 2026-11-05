package io.github.mrdarcy17.cdccn;

import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Toast;
import androidx.activity.OnBackPressedCallback;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * Bloc de notas del widget "Nota del día": solo un campo de texto. Al guardar, el texto se agrega como
 * nota nueva del día de hoy. No muestra nada del calendario, por eso no pide PIN.
 */
public class NotaRapidaActivity extends AppCompatActivity {

    private EditText texto;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_nota_rapida);
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_STATE_VISIBLE | WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);

        // Android 15 dibuja la ventana detrás de las barras del sistema: se deja margen para ellas y el teclado.
        View raiz = findViewById(R.id.raiz_nota);
        ViewCompat.setOnApplyWindowInsetsListener(raiz, (v, insets) -> {
            Insets barras = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.ime());
            v.setPadding(barras.left, barras.top, barras.right, barras.bottom);
            return WindowInsetsCompat.CONSUMED;
        });

        texto = findViewById(R.id.texto_nota);
        TextView fecha = findViewById(R.id.fecha_nota);
        fecha.setText(new SimpleDateFormat("EEE, d 'de' MMM 'de' yyyy", new Locale("es", "MX")).format(new Date()));

        findViewById(R.id.boton_guardar).setOnClickListener(v -> guardar());
        findViewById(R.id.boton_cancelar).setOnClickListener(v -> salir());
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                salir();
            }
        });
        texto.requestFocus();
    }

    private void guardar() {
        String contenido = texto.getText().toString();
        if (contenido.trim().isEmpty()) {
            Toast.makeText(this, "Escribe algo antes de guardar", Toast.LENGTH_SHORT).show();
            return;
        }
        try {
            if (DatosArchivo.agregarNotaHoy(this, contenido)) {
                Toast.makeText(this, "Nota agregada a hoy", Toast.LENGTH_SHORT).show();
                WidgetMarcar.actualizarTodos(this);
                finish();
            } else {
                Toast.makeText(this, "Abre Sarger una vez para empezar", Toast.LENGTH_LONG).show();
            }
        } catch (Exception e) {
            Toast.makeText(this, "No se pudo guardar la nota", Toast.LENGTH_LONG).show();
        }
    }

    /** Si hay texto sin guardar, pregunta antes de descartarlo. */
    private void salir() {
        if (texto.getText().toString().trim().isEmpty()) {
            finish();
            return;
        }
        new AlertDialog.Builder(this)
            .setMessage("¿Descartar la nota?")
            .setPositiveButton("Descartar", (d, w) -> finish())
            .setNegativeButton("Seguir escribiendo", null)
            .show();
    }
}
