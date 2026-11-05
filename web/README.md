# Web local — calendario-cdccn

Programa web que corre en tu PC para ver y modificar el calendario (HU-04). Usa el mismo diseño que la maquetación y guarda todo en un solo archivo JSON (ver [`../esquema/estructura-json.md`](../esquema/estructura-json.md)).

## Uso

Requisitos: Node.js y pnpm (ya instalados).

```fish
cd web
pnpm install        # solo la primera vez
pnpm dev            # abre http://localhost:5180
```

- La primera vez se crea `web/datos/cdccn-datos.json` con el calendario "Interacción" y las tres características de la HU-05.
- Cada cambio se **guarda solo** (arriba a la izquierda verás "✓ Guardado"). Antes de escribir, la versión anterior se copia a `cdccn-datos.json.bak`.
- La carpeta `web/datos/` está en `.gitignore`: tus datos personales **no** se suben al repositorio.
- El servidor solo escucha en `localhost`, así que nadie más en tu red puede abrirlo.

### Probar con los datos de ejemplo

```fish
pnpm datos:ejemplo   # copia ../esquema/ejemplo-datos.json (respalda tus datos si ya existían)
```

### Usar otro archivo de datos

```fish
CDCCN_DATOS=/ruta/a/mi-archivo.json pnpm dev
```

## Cómo se usa

| Acción | Resultado |
|---|---|
| **Clic** en un día | Sube su intensidad: 0 → 1 → 2 → 3 → 0 (los días futuros no se pueden marcar) |
| **Palomita** junto al nombre | Lo mismo, para el día de hoy |
| **Clic derecho** en un día | Abre sus opciones: características, eventos y notas |
| Clic en el **mapa de actividad** | El calendario salta a ese mes |
| 📊 / 🔍 / ⚙️ | Estadísticas, búsqueda y ajustes |
| `Ctrl + Enter` en una nota nueva | La agrega |
| `Esc` | Cierra el panel o el selector abierto |

## Comandos

| Comando | Para qué |
|---|---|
| `pnpm dev` | Web local con autoguardado |
| `pnpm test` | Pruebas de la lógica de datos (Vitest) |
| `pnpm typecheck` | Revisión de tipos |
| `pnpm build` | Compila a `dist/` (para la futura app Android con Capacitor) |

## Estructura

```
web/
├── servidor/plugin-datos.ts   ← GET/PUT /api/datos: lee y escribe el archivo, valida antes de guardar
├── src/
│   ├── datos/                 ← lógica sin interfaz (se reutilizará en Android)
│   │   ├── tipos.ts           ← tipos del archivo JSON
│   │   ├── operaciones.ts     ← intensidad, notas, etiquetas, eventos, racha, búsqueda…
│   │   ├── validar.ts         ← esquema JSON + reglas
│   │   ├── fechas.ts, ids.ts
│   │   └── __tests__/
│   ├── almacen.ts             ← copia local (archivo en la PC)
│   ├── drive/                 ← Google Drive: sesión (auth.ts), API REST (api.ts) y sincronizador
│   ├── estado.ts              ← estado de la app y autoguardado
│   ├── ui/                    ← pantallas (principal, panel del día, ajustes, buscar, estadísticas)
│   └── estilos.css
└── datos/                     ← tus datos (no se suben a git)
```

## Google Drive

En **Ajustes → Datos → Google Drive → Conectar** inicia sesión con tu cuenta de Google (la que agregaste como usuario de prueba). A partir de ahí:

- Cada cambio se guarda al instante en la copia local y ~3 s después se sube a **Mi unidad › cdccn › cdccn-datos.json** (el archivo completo; gana el último que sube).
- Al abrir la web, cada minuto y al volver internet, se descarga la versión de Drive si cambió y no hay cambios pendientes.
- Si es la primera conexión y Drive ya tiene datos distintos, te pregunta cuáles conservar.
- Arriba verás el estado: **✓ Drive**, *pendiente*, *sin internet* o **reconectar** (la sesión de Google en la web dura ~1 hora; un clic la renueva).

El ID de cliente de Google está en `web/.env` (no es secreto). El permiso es `drive.file`: la app solo ve los archivos que ella crea, no el resto de tu Drive.

## Pendiente

- Gráficas de estadísticas (CU-12): por ahora solo hay cifras (racha actual, racha más larga, días del mes, notas).
