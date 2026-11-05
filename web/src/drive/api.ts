// Acceso a Google Drive (API REST v3) con el permiso drive.file:
// la app solo ve la carpeta y el archivo que ella misma crea.

export const CARPETA = 'cdccn';
export const ARCHIVO = 'cdccn-datos.json';

const API = 'https://www.googleapis.com/drive/v3/files';
const SUBIDA = 'https://www.googleapis.com/upload/drive/v3/files';
const CARPETA_MIME = 'application/vnd.google-apps.folder';

export class ErrorDrive extends Error {
  /** estado HTTP; 0 = sin conexión */
  constructor(public estado: number, mensaje: string) {
    super(mensaje);
  }
  get sesionVencida() {
    return this.estado === 401;
  }
  get sinInternet() {
    return this.estado === 0;
  }
}

export interface ArchivoRemoto {
  id: string;
  version: string;
}

/** Lo que el sincronizador necesita de Drive (se sustituye por uno falso en las pruebas). */
export interface Remoto {
  /** Busca el archivo de datos; null si no existe. */
  localizar(): Promise<ArchivoRemoto | null>;
  /** Versión actual del archivo; null si fue borrado. */
  version(id: string): Promise<string | null>;
  descargar(id: string): Promise<{ contenido: unknown; version: string }>;
  crear(contenido: string): Promise<ArchivoRemoto>;
  actualizar(id: string, contenido: string): Promise<ArchivoRemoto>;
}

export class DriveRest implements Remoto {
  constructor(private token: () => string | null) {}

  private async pedir(url: string, init: RequestInit = {}): Promise<Response> {
    const t = this.token();
    if (!t) throw new ErrorDrive(401, 'No hay sesión de Google.');
    let res: Response;
    try {
      res = await fetch(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${t}` } });
    } catch {
      throw new ErrorDrive(0, 'Sin conexión con Google Drive.');
    }
    if (!res.ok) {
      let mensaje = `Google Drive respondió ${res.status}.`;
      try {
        const cuerpo = await res.json();
        if (cuerpo?.error?.message) mensaje = `Google Drive: ${cuerpo.error.message}`;
      } catch {
        // sin cuerpo JSON
      }
      throw new ErrorDrive(res.status, mensaje);
    }
    return res;
  }

  private async buscar(q: string): Promise<{ id: string; version: string }[]> {
    const url = `${API}?${new URLSearchParams({ q, fields: 'files(id,version)', spaces: 'drive', orderBy: 'modifiedTime desc' })}`;
    return (await (await this.pedir(url)).json()).files ?? [];
  }

  private async carpeta(crearSiFalta: boolean): Promise<string | null> {
    const [existente] = await this.buscar(`name='${CARPETA}' and mimeType='${CARPETA_MIME}' and trashed=false`);
    if (existente) return existente.id;
    if (!crearSiFalta) return null;
    const res = await this.pedir(`${API}?fields=id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: CARPETA, mimeType: CARPETA_MIME }),
    });
    return (await res.json()).id;
  }

  async localizar(): Promise<ArchivoRemoto | null> {
    const idCarpeta = await this.carpeta(false);
    if (!idCarpeta) return null;
    const [archivo] = await this.buscar(`name='${ARCHIVO}' and '${idCarpeta}' in parents and trashed=false`);
    return archivo ?? null;
  }

  async version(id: string): Promise<string | null> {
    try {
      const res = await this.pedir(`${API}/${id}?fields=version,trashed`);
      const meta = await res.json();
      return meta.trashed ? null : String(meta.version);
    } catch (e) {
      if (e instanceof ErrorDrive && e.estado === 404) return null;
      throw e;
    }
  }

  async descargar(id: string): Promise<{ contenido: unknown; version: string }> {
    const version = await this.version(id);
    if (version === null) throw new ErrorDrive(404, 'El archivo de Drive ya no existe.');
    const res = await this.pedir(`${API}/${id}?alt=media`);
    const texto = await res.text();
    try {
      return { contenido: JSON.parse(texto), version };
    } catch {
      throw new ErrorDrive(422, 'El archivo de Drive no es un JSON válido.');
    }
  }

  async crear(contenido: string): Promise<ArchivoRemoto> {
    const idCarpeta = (await this.carpeta(true))!;
    const limite = `cdccn${crypto.getRandomValues(new Uint32Array(2)).join('')}`;
    const cuerpo =
      `--${limite}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
      JSON.stringify({ name: ARCHIVO, parents: [idCarpeta], mimeType: 'application/json' }) +
      `\r\n--${limite}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${contenido}\r\n--${limite}--`;
    const res = await this.pedir(`${SUBIDA}?uploadType=multipart&fields=id,version`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${limite}` },
      body: cuerpo,
    });
    const r = await res.json();
    return { id: r.id, version: String(r.version) };
  }

  async actualizar(id: string, contenido: string): Promise<ArchivoRemoto> {
    const res = await this.pedir(`${SUBIDA}/${id}?uploadType=media&fields=id,version`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: contenido,
    });
    const r = await res.json();
    return { id: r.id, version: String(r.version) };
  }
}
