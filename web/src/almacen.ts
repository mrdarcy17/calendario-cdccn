import type { Datos } from './datos/tipos';

/** Dónde se leen y guardan los datos. Hoy: archivo en la PC. Después: Google Drive. */
export interface Almacen {
  cargar(): Promise<Datos>;
  guardar(datos: Datos, opciones?: { alSalir?: boolean }): Promise<void>;
}

export class ErrorAlmacen extends Error {
  constructor(public errores: string[]) {
    super(errores.join('\n'));
  }
}

async function errores(res: Response): Promise<string[]> {
  try {
    const cuerpo = await res.json();
    if (Array.isArray(cuerpo?.errores)) return cuerpo.errores;
  } catch {
    // sin cuerpo JSON
  }
  return [`Error ${res.status} del servidor local.`];
}

/** Archivo local servido por el plugin de Vite (servidor/plugin-datos.ts). */
export class AlmacenArchivoLocal implements Almacen {
  constructor(private url = '/api/datos') {}

  async cargar(): Promise<Datos> {
    const res = await fetch(this.url, { cache: 'no-store' });
    if (!res.ok) throw new ErrorAlmacen(await errores(res));
    return res.json();
  }

  async guardar(datos: Datos, opciones: { alSalir?: boolean } = {}): Promise<void> {
    const res = await fetch(this.url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
      keepalive: opciones.alSalir,
    });
    if (!res.ok) throw new ErrorAlmacen(await errores(res));
  }
}

/** Copia local en el teléfono: archivo privado de la app (solo ella puede leerlo). */
export class AlmacenNativo implements Almacen {
  private static ARCHIVO = 'cdccn-datos.json';

  async cargar(): Promise<Datos> {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
    const { datosIniciales } = await import('./datos/operaciones');
    const { validarDatos } = await import('./datos/validar');
    const { hoy } = await import('./datos/fechas');
    // Solo si el archivo NO existe se crean datos iniciales; cualquier otro error se muestra
    // (nunca se sobrescriben datos que no se pudieron leer).
    const existe = await Filesystem.stat({ path: AlmacenNativo.ARCHIVO, directory: Directory.Data }).then(
      () => true,
      () => false,
    );
    if (!existe) {
      const iniciales = datosIniciales(new Date(), 'android');
      await this.guardar(iniciales);
      return iniciales;
    }
    let texto: string;
    try {
      texto = (await Filesystem.readFile({ path: AlmacenNativo.ARCHIVO, directory: Directory.Data, encoding: Encoding.UTF8 })).data as string;
    } catch (e) {
      throw new ErrorAlmacen([`No se pudo leer el archivo de datos del teléfono: ${(e as Error).message}`]);
    }
    let valor: unknown;
    try {
      valor = JSON.parse(texto);
    } catch {
      throw new ErrorAlmacen(['El archivo de datos del teléfono no es un JSON válido. Hay un respaldo (.bak) en los datos de la app.']);
    }
    const r = validarDatos(valor, hoy());
    if (!r.ok) throw new ErrorAlmacen(['El archivo de datos del teléfono tiene errores:', ...r.errores]);
    return r.datos;
  }

  async guardar(datos: Datos): Promise<void> {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
    const { validarDatos } = await import('./datos/validar');
    const { hoy } = await import('./datos/fechas');
    const r = validarDatos(datos, hoy());
    if (!r.ok) throw new ErrorAlmacen(r.errores);
    const ruta = AlmacenNativo.ARCHIVO;
    const dir = Directory.Data;
    // Respaldo de la versión anterior y escritura en dos pasos, como en la PC.
    await Filesystem.copy({ from: ruta, to: `${ruta}.bak`, directory: dir, toDirectory: dir }).catch(() => {});
    await Filesystem.writeFile({ path: `${ruta}.tmp`, directory: dir, encoding: Encoding.UTF8, data: JSON.stringify(datos, null, 2) + '\n' });
    await Filesystem.rename({ from: `${ruta}.tmp`, to: ruta, directory: dir, toDirectory: dir });
    // El widget "Marcar día" muestra la intensidad de hoy: se redibuja con lo recién guardado.
    const { actualizarWidgets } = await import('./widgets');
    actualizarWidgets();
  }
}
