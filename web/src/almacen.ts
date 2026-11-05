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
