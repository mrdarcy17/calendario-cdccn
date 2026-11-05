# Casos de uso — calendario-cdccn

> Propósito: visualizar y medir mis interacciones sociales mediante un calendario único con intensidad diaria, características del día, notas y eventos, accesible desde una app móvil y una web local, con almacenamiento en la nube.

**Versión:** borrador 0.2 · **Fecha:** 2026-11-04 · **Basado en:** `hu.md`

> ⚠️ Los puntos marcados como **[Supuesto]** son decisiones provisionales que tomé donde las historias de usuario no lo especifican. Deben confirmarse o corregirse.

---

## 1. Actores

| Actor | Descripción |
|---|---|
| **Usuario** | Única persona que usa el sistema (uso personal). |
| **App móvil** | Aplicación Android con widgets y biometría. |
| **Web local** | Aplicación web que corre en la PC del usuario (`localhost`). |
| **Nube (Google Drive)** | Almacenamiento gratuito (15 GB) donde vive el archivo de datos, compartido por ambas apps. |
| **Sistema operativo** | Proveedor de biometría (huella) y widgets. |

## 2. Entidades principales

| Entidad | Atributos clave |
|---|---|
| **Día** | fecha, intensidad (0–3), características, notas |
| **Característica** (catálogo) | nombre, ícono, activo/archivado |
| **Característica del día** | día, característica |
| **Nota** | día, texto, etiqueta(s), fecha de creación/modificación |
| **Etiqueta** | nombre, color, archivada |
| **Evento (subrayado)** | nombre, fecha inicio, fecha fin (color único fijo, ver RNF-05) |
| **Ajustes** | modo de acceso (libre / protegido), PIN de 4 dígitos (hash, solo existe en modo protegido) |

## 3. Mapa HU → Casos de uso

| HU | Casos de uso |
|---|---|
| HU-01 Contraseña | CU-01, CU-02, CU-03 |
| HU-02 Ajustes | CU-03, CU-15 |
| HU-03 Widgets | CU-04, CU-07 |
| HU-04 Programa web | CU-05, CU-06 (y todos los CU de gestión en web) |
| HU-05 Características del día | CU-08 |
| HU-06 Notas | CU-09, CU-10 |
| HU-07 Almacenamiento | CU-11, CU-14 |
| HU-08 Estadísticas | CU-12 |
| HU-09 Eventos | CU-13 |
| HU-10 Visualización principal | CU-02, CU-05, CU-06, CU-07 |

---

## 4. Casos de uso

### CU-01 — Primer uso
- **HU:** 01, 02 · **Actor:** Usuario · **Plataforma:** Móvil
- **Precondición:** la app se abre por primera vez.
- **Flujo principal:**
  1. La app arranca en **modo libre**: no pide crear PIN.
  2. Se muestra directamente la pantalla principal (CU-05).
- **Postcondición:** modo de acceso libre. Para proteger la app, el usuario activa el modo protegido en Ajustes y crea un PIN (CU-03). La huella no requiere configuración en la app: se usa la registrada en el dispositivo.

### CU-02 — Desbloquear la app
- **HU:** 01 · **Actor:** Usuario · **Plataforma:** Móvil
- **Precondición:** PIN configurado y modo de acceso **protegido**.
- **Flujo principal:**
  1. El usuario abre la app; se muestra la pantalla de bloqueo con el teclado del PIN y un **botón de huella**.
  2. El diálogo de huella **no** se abre solo, salvo que esté activado el ajuste **"Abrir la huella al entrar"** (CU-03).
  3. El usuario ingresa el PIN.
  4. Se muestra directamente la **pantalla principal** (CU-05).
- **Alternativos:**
  - 3a. El usuario pulsa el botón de huella → se lanza el diálogo biométrico del SO → si la huella es válida, continúa en el paso 4.
  - 3b. Huella fallida o cancelada → se vuelve a la pantalla de bloqueo para ingresar el PIN.
  - 3c. PIN incorrecto → se muestra error y se puede reintentar de inmediato. **No hay límite de intentos** ni bloqueo temporal (en la huella sí aplica el límite propio de Android, pero el PIN siempre queda disponible).
  - 1a. El dispositivo no tiene huella registrada → no se muestra el botón de huella.
  - 1b. Modo de acceso **libre** → no se muestra la pantalla de bloqueo; la app abre directo a la pantalla principal (CU-05).
- **Postcondición:** sesión desbloqueada. En cuanto la app pasa a segundo plano (cambiar de app, ir al inicio, apagar la pantalla o reiniciar el teléfono) se **bloquea al instante**: al volver se pide el PIN otra vez. No hay tiempo de espera. En "apps recientes" tampoco se ve el calendario.
- **Excepción:** abrir algo del sistema desde la propia app (lector de huella, ventana de Google, compartir, elegir un archivo) no cuenta como salir.
- **Regla:** en modo protegido el PIN y la huella están siempre disponibles juntos (no se puede desactivar uno solo). La huella es opcional: se usa al pulsar su botón o, si el ajuste está activo, se abre sola al entrar.

### CU-03 — Configurar acceso
- **HU:** 01, 02 · **Actor:** Usuario · **Plataforma:** Móvil
- **Precondición:** app desbloqueada.
- **Flujo principal (cambiar modo de acceso):**
  1. El usuario abre Ajustes → Seguridad → Modo de acceso.
  2. Elige **Libre** o **Protegido (PIN/huella)**. **No se pide el PIN actual.**
  3. Si elige **Libre** → el PIN se **borra** y la app abrirá directo al calendario.
  4. Si elige **Protegido** → se ejecuta *Crear PIN* (ver abajo); no se reutiliza ningún PIN anterior.
  5. Se guarda el modo; el siguiente inicio de la app lo respeta.
- **Flujo alternativo (abrir la huella al entrar, solo en modo protegido y si el teléfono tiene huella):**
  1. El usuario activa en Ajustes → Seguridad el interruptor **"Abrir la huella al entrar"**.
  2. Desde entonces, cada vez que entra a la app se abre el lector de huella sin pulsar su botón; si lo cancela, puede usar el PIN.
- **Flujo alternativo (cambiar PIN, solo en modo protegido):**
  1. El usuario abre Ajustes → Seguridad → Cambiar PIN. **No se pide el PIN actual.**
  2. Se ejecuta *Crear PIN* (ver abajo).
- **Crear PIN:**
  1. El usuario ingresa el nuevo PIN de **4 dígitos**.
  2. El usuario lo ingresa **por segunda vez** para confirmarlo.
  3. Si ambos coinciden → se guarda.
  4. Si no coinciden → se muestra "Los PIN no coinciden" y se vuelve al paso 1.
- **Notas:**
  - Los widgets (CU-04) nunca piden desbloqueo, en ningún modo.

### CU-04 — Usar widgets
- **HU:** 03 · **Actor:** Usuario · **Plataforma:** Móvil (pantalla de inicio)
- **Widgets:**
  - **W1 Nota del día:** abre un editor mínimo para crear una nota en el día actual (CU-09). **No pide desbloqueo.**
  - **W2 Marcar día:** botón de palomita que sube la intensidad del día de hoy, igual que la palomita de la pantalla principal (CU-07). **No pide desbloqueo.**
- **Postcondición:** el cambio se refleja en el calendario y se sincroniza.

### CU-05 — Ver pantalla principal (calendario)
- **HU:** 04, 09, 10 · **Actor:** Usuario · **Plataforma:** Móvil / Web
- **Referencia visual:** `media/visualizacionPrincipal.jpeg`
- **Precondición:** app desbloqueada (o modo libre).
- **Flujo principal:**
  1. Al abrir la app (tras el PIN/huella en modo protegido), se muestra directamente la pantalla principal, de arriba hacia abajo:
     1. **Encabezado:** ícono y nombre del calendario ("Interacción"); a su derecha, un **botón circular con palomita** (✓) para marcar el día de hoy (CU-07), que se pinta con la intensidad actual de hoy. Arriba, tres botones redondos: **Estadísticas** (CU-12), **Buscar** (CU-10) y **Ajustes**.
     2. **Mapa de actividad** estilo gráfico de contribuciones de GitHub: una cuadrícula con columnas = semanas y filas = días de la semana, con los meses rotulados arriba, que muestra **5 meses** a la vez y se puede **desplazar** hacia meses anteriores. Los eventos también se muestran aquí con el mismo verde detrás de las casillas.
     3. **Racha:** chip con ícono de fuego y los días consecutivos con intensidad 1 o mayor (p.ej. "🔥 5 días").
     4. **Calendario mensual** (lun–dom) con selector de mes/año, botón **"Hoy"** y flechas de mes anterior/siguiente. El día actual se resalta con borde amarillo. Texto de ayuda: "Toca un día para marcarlo · Mantén pulsado para ver sus opciones".
     5. **Botón "Agregar nota nueva"** (móvil y web): abre el panel del **día de hoy** (CU-06) con el cursor en el campo de nota nueva.
  2. **Intensidad:** cada día muestra la **intensidad que el usuario le asignó** (CU-07), no las características del día:

     | Intensidad | Mapa de actividad (color) | Calendario mensual (bolitas bajo el número) |
     |---|---|---|
     | 0 — sin marcar | casilla oscura | ninguna |
     | 1 — mínima | amarillo tenue | ● |
     | 2 — media | amarillo medio | ●● |
     | 3 — máxima | amarillo pleno | ●●● |

  3. Los eventos (CU-13) pintan de verde el **fondo detrás de los días** que abarcan, como una franja continua; el cuadro de intensidad de cada día queda por encima.
  4. Los días con notas muestran un puntito gris en la esquina superior derecha del número.
  5. **Toque corto** en un día → **solo** cambia su intensidad (CU-07); no muestra notas.
  6. **Mantener presionado** un día (en web: clic derecho) → abre las opciones del día (CU-06), donde están sus notas.
  7. La pantalla principal no se desliza ni "rebota" cuando el contenido cabe en la pantalla.
- **Alternativos:**
  - 5a. Toque en un área del mapa de actividad → el calendario mensual cambia al **mes** correspondiente a la zona tocada (no se selecciona un día específico).
  - 3a. La racha se reinicia a 0 si ayer quedó con intensidad 0; el día de hoy sin marcar no rompe la racha hasta que termine.
- **Fuera de alcance:** el chip de frecuencia ("Todos los días") de la referencia **no** se incluye.

### CU-06 — Ver y editar opciones de un día
- **HU:** 04, 05, 06, 10 · **Actor:** Usuario · **Plataforma:** Móvil / Web
- **Referencia visual:** `media/visualizaciónDeNotas.jpeg`
- **Flujo principal:**
  1. El usuario **mantiene presionado** un día en el calendario (en web: **clic derecho**, ya que el clic normal cambia la intensidad).
  2. Se abre un **panel inferior deslizable** con:
     - Ícono, nombre del calendario y fecha del día (p.ej. "jue, 29 de oct de 2026").
     - Botón de **palomita** que cambia la intensidad de ese día (CU-07).
     - Campo de texto para escribir una nota ("¿Qué fue bien? ¿Qué se interpuso?").
     - Botón de calendario para cambiar la fecha.
     - Acceso a características, notas y eventos del día.
     - Botón **Guardar**.
  3. Desde aquí puede iniciar CU-07, CU-08, CU-09 o CU-13.
  4. El usuario desliza el panel hacia abajo o pulsa Guardar para cerrarlo.
- **Postcondición:** cambios guardados automáticamente (CU-11).

### CU-07 — Marcar intensidad de un día
- **HU:** 03, 10 · **Actor:** Usuario · **Plataforma:** Móvil / Web / Widget
- **Flujo principal:**
  1. El usuario toca un día en el calendario mensual, **o** pulsa la palomita circular junto a "Interacción" (aplica al **día de hoy**), **o** la palomita del panel de opciones / widget.
  2. La intensidad del día avanza un nivel en ciclo: **0 → 1 → 2 → 3 → 0** (después de la máxima vuelve a sin marcar).
  3. El primer toque sobre un día sin marcar lo deja como **realizado con intensidad mínima (1)**.
  4. La casilla del calendario, el mapa de actividad y la racha se actualizan al instante.
- **Alternativos:**
  - 1a. Día futuro → el toque no hace nada (sin aviso); los días futuros no se pueden marcar.
  - 2a. La palomita del encabezado sigue el **mismo ciclo** y se pinta igual que la casilla de hoy: oscura (0), amarillo tenue (1), medio (2) o pleno (3).
- **Postcondición:** intensidad guardada automáticamente (CU-11).

### CU-08 — Gestionar características del día
- **HU:** 05 · **Actor:** Usuario · **Plataforma:** Móvil / Web
- **Descripción:** las características son una lista de cosas que pasaron en el día (p.ej. "Sacar un contacto", "Conocer a alguien nuevo", "Salir con alguien nuevo"). **No se reflejan en los calendarios**; sirven como registro y para estadísticas.
- **Flujo principal (marcar en un día):**
  1. En las opciones del día (CU-06), el usuario abre "Características".
  2. Marca o desmarca las características que aplican a ese día.
- **Flujo alternativo (catálogo):**
  1. El usuario abre Ajustes → Características.
  2. Crea una característica con nombre e ícono.
  3. Puede editar nombre/ícono o reordenar.
  4. Eliminar una característica con registros históricos → se **archiva** (deja de aparecer para marcar, pero sigue apareciendo en los días pasados donde se marcó).

### CU-09 — Gestionar notas de un día
- **HU:** 06 · **Actor:** Usuario · **Plataforma:** Móvil / Web
- **Flujo principal:**
  1. En el detalle del día, el usuario pulsa "Nueva nota".
  2. Escribe el texto y asigna **una o varias** etiquetas.
  3. La nota se guarda automáticamente mientras escribe.
- **Alternativos:**
  - 1a. Editar una nota existente.
  - 1b. Eliminar una nota (con confirmación).
  - 1c. Día futuro → no se pueden escribir notas.
  - 2a. La etiqueta no existe → se crea en ese momento (nombre + color).
  - 2b. Eliminar una etiqueta → se **archiva**: deja de aparecer para asignarla a notas nuevas, pero se conserva en las notas que ya la tienen.

### CU-10 — Buscar y filtrar
- **HU:** 06 (derivado) · **Actor:** Usuario · **Plataforma:** Móvil / Web
- **Flujo principal:**
  1. El usuario pulsa el botón **Buscar** de la pantalla principal y escribe texto o selecciona una etiqueta / característica.
  2. El sistema lista los días y notas que coinciden.
  3. El usuario abre un resultado → CU-06.

### CU-11 — Autoguardado y sincronización con la nube
- **HU:** 07 · **Actor:** App móvil, Web local, Google Drive
- **Formato de almacenamiento:** **un solo archivo JSON** (`cdccn-datos.json`) con todo: días (intensidad, características, notas), etiquetas, catálogo de características, eventos y ajustes (excepto el PIN, que se queda solo en el teléfono).
- **Flujo principal:**
  1. Cada cambio (intensidad, característica, nota, evento, ajuste) se guarda al instante en la copia local del archivo.
  2. En segundo plano, la app sube su copia local a **Google Drive**, **reemplazando el archivo completo**.
  3. La otra plataforma descarga el archivo al abrirse, cada minuto mientras está abierta y al recuperar internet, siempre que no tenga cambios pendientes de subir.
- **Primera conexión:** si Drive ya tiene datos distintos a los locales, la app pregunta cuáles conservar (los de Drive o los del dispositivo); los otros se reemplazan. Si son iguales, no pregunta.
- **Alternativos:**
  - 2a. Sin conexión → la app funciona normal; los cambios quedan en la copia local y se sincronizan al recuperar conexión.
  - 2b. Conflicto → **gana el último archivo subido**, completo. Si se hicieron cambios en el móvil y en la web sin sincronizar entre ellos, los cambios del archivo que se subió primero **se pierden**. Riesgo aceptado por el usuario; se resolverá al migrar a base de datos.
- **Notas:**
  - Tamaño estimado: ~3–11 MB tras 5 años de uso.
  - La subida se agrupa: ocurre ~3 s después del último cambio.
  - Si la sesión de Google vence (~1 h en la web), los cambios quedan pendientes y se pide "Reconectar".
  - Permiso de Google `drive.file`: la app solo ve la carpeta y el archivo que ella misma crea.
  - El archivo vive en una carpeta de Google Drive, `cdccn/cdccn-datos.json`; la app móvil y la web local acceden con la misma cuenta de Google (inicio de sesión una sola vez en cada una).
  - Los datos se guardan **sin cifrar**; la protección es la de la cuenta de Google.

### CU-12 — Ver estadísticas
- **HU:** 08 · **Actor:** Usuario · **Plataforma:** Móvil / Web
- **Estado:** 🟡 en definición (la HU indica que aún se está pensando).
- **Flujo principal (propuesta):**
  1. El usuario pulsa el botón **Estadísticas** de la pantalla principal y elige un periodo (semana, mes, año, personalizado).
  2. Se muestra:
     - Gráfica **lineal**: intensidad por día/semana a lo largo del tiempo.
     - Gráfica de **radar**: frecuencia de cada característica en el periodo.
     - Rachas: racha actual (también visible en la pantalla principal, CU-05) y racha más larga.
  3. El usuario puede filtrar por característica o comparar con el periodo anterior.

### CU-13 — Gestionar eventos (subrayado de periodos)
- **HU:** 09 · **Actor:** Usuario · **Plataforma:** Móvil / Web
- **Flujo principal:**
  1. El usuario selecciona un rango de días (p.ej. 4 al 7) en el calendario.
  2. Pulsa "Crear evento" y escribe el nombre ("Viaje puerto").
  3. El calendario pinta el fondo de esos días con el **color único de eventos** (RNF-05).
- **Alternativos:**
  - 1a. Evento de un solo día.
  - 2a. Editar nombre o rango de un evento existente.
  - 2b. Eliminar el evento (no borra notas ni características de esos días).
  - 3a. Eventos que se cruzan → se muestra **un solo fondo** y el verde se vuelve **más intenso** en los días donde coinciden: 1 evento = verde tenue, 2 = verde medio, 3 o más = verde pleno. Al mantener presionado el día se ven los nombres de todos sus eventos (CU-06).

### CU-14 — Exportar e importar datos
- **HU:** 07 (derivado) · **Actor:** Usuario · **Plataforma:** Móvil / Web (Ajustes)
- **Flujo principal (exportar):**
  1. El usuario abre Ajustes → Datos → Exportar.
  2. La app genera un archivo JSON con días, intensidades, características, notas, etiquetas, eventos y ajustes (sin el PIN), p.ej. `cdccn-respaldo-2026-11-04.json`.
  3. El usuario elige dónde guardarlo o compartirlo.
- **Flujo alternativo (importar):**
  1. El usuario abre Ajustes → Datos → Importar y selecciona un archivo de respaldo.
  2. La app avisa que se **reemplazarán** todos los datos actuales y pide confirmación.
  3. Se cargan los datos y se sincronizan con la nube (CU-11).
- **Excepciones:**
  - Archivo inválido o de otro programa → se muestra error y no se modifica nada.
- **Nota:** es manual; no hay respaldos automáticos.

### CU-15 — Editar calendario
- **HU:** 02 (derivado) · **Actor:** Usuario · **Plataforma:** Móvil / Web
- **Flujo principal:**
  1. El usuario abre Ajustes → Calendario.
  2. Cambia el **nombre** (p.ej. "Interacción"), la **descripción** y el **ícono**.
  3. Los cambios se ven en el encabezado de la pantalla principal y en los widgets.

---

## 5. Futuras actualizaciones (fuera de esta versión)

- **Migrar a base de datos:** pasar del archivo JSON único a una base de datos con tablas y entidades.
- **Puntaje** (HU-08).
- **Registro de personas:** vincular notas y características a una persona concreta.
- **Grabación de voz:** se hará como una aplicación aparte.

## 6. Descartado

- Pedir PIN en la web local: la web **no** pide PIN.
- Notificaciones y recordatorios: la app **no** envía notificaciones.
- Cifrado de datos en la nube.

## 7. Requisitos no funcionales (borrador)

- **RNF-01 Privacidad:** PIN de 4 dígitos almacenado como hash; datos en Google Drive sin cifrar; la web local no pide PIN.
- **RNF-02 Offline:** la app móvil funciona sin conexión y sincroniza después.
- **RNF-03 Autoguardado:** ningún cambio requiere pulsar "Guardar".
- **RNF-04 Plataforma:** app solo para **Android**; web local en navegador de escritorio.
- **RNF-05 Estilo visual** (según `media/`):
  - Tema **oscuro** (fondo casi negro, tarjetas gris oscuro con esquinas redondeadas).
  - Color principal **amarillo `#FACC15`**: días con actividad, día actual, racha, botones e íconos.
  - Escala de intensidad: 3 tonos del mismo amarillo, de tenue (1) a pleno (3).
  - Color de **eventos**: un único **verde esmeralda `#34D399`**, que armoniza con el amarillo y se distingue bien de él sobre el fondo oscuro. No es configurable. Se pinta detrás de los días y su intensidad aumenta donde se cruzan eventos (CU-13).
  - Tipografía monoespaciada para fechas y números del calendario.
