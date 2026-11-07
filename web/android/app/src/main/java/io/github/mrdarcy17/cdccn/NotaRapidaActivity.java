package io.github.mrdarcy17.cdccn;

import android.os.Bundle;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;
import androidx.activity.OnBackPressedCallback;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Bloc de notas del widget "Nota del día": solo un campo de texto. Al guardar, el texto se agrega como
 * nota nueva del día de hoy. No muestra nada del calendario, por eso no pide PIN.
 */
public class NotaRapidaActivity extends AppCompatActivity {

    private EditText texto;
    /** Etiquetas disponibles { id, nombre, color } y las elegidas (ids). */
    private List<String[]> etiquetas = new ArrayList<>();
    private final Set<String> elegidas = new LinkedHashSet<>();
    private TextView botonEtiquetas;

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
        etiquetas = DatosArchivo.etiquetasActivas(this);
        botonEtiquetas = findViewById(R.id.boton_etiquetas);
        botonEtiquetas.setOnClickListener(v -> elegirEtiquetas());
        botonEtiquetas.setVisibility(etiquetas.isEmpty() ? View.INVISIBLE : View.VISIBLE);

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
            List<String> etiquetas = new ArrayList<>(elegidas);
            if (DatosArchivo.agregarNotaHoy(this, contenido, etiquetas)) {
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

    private int dp(float v) {
        return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics()));
    }

    /** Cuadro chico, arriba (debajo del botón), con una casilla por etiqueta para marcar una o varias. */
    private void elegirEtiquetas() {
        LinearLayout lista = new LinearLayout(this);
        lista.setOrientation(LinearLayout.VERTICAL);
        lista.setPadding(dp(12), dp(8), dp(12), dp(8));
        for (String[] e : etiquetas) {
            String id = e[0];
            CheckBox casilla = new CheckBox(this);
            casilla.setText(e[1]);
            casilla.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
            casilla.setTextColor(0xFFE5E5E5);
            casilla.setMinHeight(dp(34));
            casilla.setMinimumHeight(dp(34));
            casilla.setPadding(dp(4), 0, 0, 0);
            casilla.setChecked(elegidas.contains(id));
            casilla.setOnCheckedChangeListener((v, marcada) -> {
                if (marcada) elegidas.add(id);
                else elegidas.remove(id);
            });
            lista.addView(casilla, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(34)));
        }
        // Sin botón: se cierra tocando fuera del cuadro o con "atrás"; lo marcado ya queda guardado.
        AlertDialog cuadro = new AlertDialog.Builder(this).setView(lista).create();
        cuadro.setCanceledOnTouchOutside(true);
        cuadro.show();
        Window ventana = cuadro.getWindow();
        if (ventana != null) {
            WindowManager.LayoutParams lp = ventana.getAttributes();
            lp.gravity = Gravity.TOP;
            lp.y = dp(56); // justo debajo de la barra con las flechas
            lp.width = dp(220);
            ventana.setAttributes(lp);
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
