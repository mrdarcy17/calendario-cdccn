# Estructura del archivo de datos — calendario-cdccn

**Versión del formato:** 1 · **Fecha:** 2026-11-04 · **Relacionado con:** CU-11 (sincronización), CU-14 (exportar/importar)

Todos los datos que se sincronizan viven en **un solo archivo JSON**:

- **En Google Drive:** `cdccn/cdccn-datos.json`
- **En cada dispositivo:** una copia local del mismo archivo.
- **Al exportar (CU-14):** el mismo contenido, con el nombre `cdccn-respaldo-AAAA-MM-DD.json`.

| Archivo | Para qué |
|---|---|
| [`cdccn-datos.schema.json`](cdccn-datos.schema.json) | Esquema (JSON Schema 2020-12) para validar el archivo; la app lo usa al importar y al descargar de Drive. |
| [`ejemplo-datos.json`](ejemplo-datos.json) | Archivo de ejemplo válido con los mismos datos de la maquetación. |

---

## 1. Vista general

```jsonc
{
  "formato": "cdccn-datos",          // identifica que el archivo es de esta app
  "version": 1,                      // versión del formato (para futuras migraciones)
  "modificado": "2026-11-04T22:40:12-06:00",
  "modificadoPor": "android",        // "android" | "web"

  "calendario":      { ... },        // nombre, descripción e ícono
  "caracteristicas": [ ... ],        // catálogo de características
  "etiquetas":       [ ... ],        // catálogo de etiquetas de notas
  "eventos":         [ ... ],        // periodos subrayados en verde
  "dias":            { ... }         // un registro por fecha con datos
}
```

## 2. Campos

### Raíz

| Campo | Tipo | Descripción |
|---|---|---|
| `formato` | `"cdccn-datos"` | Siempre este valor. Si no coincide, el archivo se rechaza al importar. |
| `version` | entero | Versión del formato. Hoy es `1`. |
| `modificado` | fecha-hora | Momento del último cambio guardado. |
| `modificadoPor` | `"android"` \| `"web"` | Plataforma que hizo el último cambio. Útil para saber qué copia "ganó" (CU-11). |

### `calendario` (CU-15)

| Campo | Tipo | Ejemplo |
|---|---|---|
| `nombre` | texto (1–40) | `"Interacción"` |
| `descripcion` | texto (0–120) | `""` (se muestra "Sin descripción") |
| `icono` | nombre de ícono | `"personas"` |

### `caracteristicas[]` (CU-08)

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | id `car_…` | Identificador único. |
| `nombre` | texto (1–40) | p.ej. `"Sacar un contacto"` |
| `icono` | nombre de ícono | p.ej. `"telefono"` |
| `archivada` | booleano | `true` = ya no aparece para marcar, pero sigue visible en los días pasados donde se marcó. |

El **orden del arreglo** es el orden en que se muestran.

### `etiquetas[]` (CU-09)

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | id `eti_…` | Identificador único. |
| `nombre` | texto (1–30) | p.ej. `"café"` |
| `color` | `#RRGGBB` | Color del punto de la etiqueta. |
| `archivada` | booleano | `true` = ya no aparece para asignarla a notas nuevas, pero sigue visible en las notas que ya la tienen. |

### `eventos[]` (CU-13)

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | id `eve_…` | Identificador único. |
| `nombre` | texto (1–60) | p.ej. `"Viaje puerto"` |
| `inicio` | fecha | Primer día del evento. |
| `fin` | fecha | Último día del evento (igual a `inicio` si dura un día). |

No hay campo de color: todos los eventos usan el verde `#34D399` (RNF-05).

### `dias` (CU-07, CU-08, CU-09)

Es un **objeto cuya llave es la fecha** (`"AAAA-MM-DD"`), no un arreglo. Así, encontrar un día es directo y no puede haber dos registros para la misma fecha.

```json
"dias": {
  "2026-11-02": {
    "intensidad": 3,
    "caracteristicas": ["car_k3x9q2mf", "car_p7d1w8za"],
    "notas": [ { ... } ]
  }
}
```

| Campo | Tipo | Descripción |
|---|---|---|
| `intensidad` | 0–3 | 0 = sin marcar, 1 = mínima, 2 = media, 3 = máxima. |
| `caracteristicas` | lista de ids `car_…` | Características marcadas ese día. |
| `notas` | lista de notas | Ordenadas por fecha de creación. |

### `dias[fecha].notas[]`

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | id `not_…` | Identificador único. |
| `texto` | texto (≥1) | Contenido de la nota. |
| `etiquetas` | lista de ids `eti_…` | Una o varias etiquetas (o ninguna). |
| `creada` | fecha-hora | Cuándo se creó. |
| `modificada` | fecha-hora | Última edición. |

## 3. Formatos

| Tipo | Formato | Ejemplo |
|---|---|---|
| **id** | prefijo + `_` + 8 caracteres `a-z0-9` aleatorios | `car_k3x9q2mf`, `eti_a4f8k1zp`, `eve_r5t8y2ui`, `not_b5n6m7q8` |
| **fecha** | `AAAA-MM-DD`, en la zona horaria local del usuario | `2026-11-04` |
| **fecha-hora** | ISO 8601 con zona horaria | `2026-11-04T22:40:12-06:00` |
| **ícono** | nombre en minúsculas del conjunto de íconos de la app | `personas`, `cafe`, `telefono` |

Los prefijos de los ids hacen que un id siempre diga de qué tipo es, lo que ayuda al depurar y al migrar a base de datos en el futuro.

## 4. Reglas que la app debe cumplir

El esquema valida la forma del archivo; estas reglas las valida el código:

1. **Referencias válidas:** cada id en `dias[].caracteristicas` existe en `caracteristicas`, y cada id en `notas[].etiquetas` existe en `etiquetas`.
2. **Eventos coherentes:** `fin` es igual o posterior a `inicio`.
3. **Días futuros:** un día posterior a hoy no puede existir en `dias`: no se puede marcar intensidad (CU-07), ni características, ni escribir notas (CU-09).
4. **Días vacíos:** si un día queda con `intensidad: 0`, sin características y sin notas, se **elimina** de `dias` para no inflar el archivo.
5. **Archivar en vez de borrar:** las características y las etiquetas nunca se borran del catálogo si algún día o nota las usa; se marcan `archivada: true`.
6. **Ids únicos:** ningún id se repite en todo el archivo.
7. **Al guardar:** se actualizan `modificado` y `modificadoPor`, y la nota editada actualiza su `modificada`.

## 5. Lo que **no** va en este archivo

Estos datos son propios de cada dispositivo y nunca se suben a Drive ni se exportan:

| Dato | Dónde vive | Por qué |
|---|---|---|
| Modo de acceso (libre/protegido) | Teléfono | Solo aplica a la app Android; la web no pide PIN. |
| PIN (hash) | Teléfono | Seguridad: no debe salir del dispositivo. |
| Sesión de Google | Cada dispositivo | Credenciales de acceso a Drive. |
| Última sincronización | Cada dispositivo | Estado técnico, no es dato del usuario. |

## 6. Tamaño esperado

| Uso | Por día | En 5 años |
|---|---|---|
| Normal (2 notas cortas) | ~1,5 KB | ~3 MB |
| Intenso (5 notas largas) | ~6 KB | ~11 MB |

## 7. Futuras versiones

- Cualquier cambio de estructura sube `version` (2, 3…). La app debe saber leer versiones anteriores y convertirlas al abrir el archivo.
- Al migrar a base de datos, cada sección se vuelve una tabla: `caracteristicas`, `etiquetas`, `eventos`, `dias`, `notas`, `nota_etiqueta` (relación) y `dia_caracteristica` (relación). Los ids actuales se conservan.
