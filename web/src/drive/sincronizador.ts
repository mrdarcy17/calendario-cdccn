// Sincronización del archivo único con Google Drive (CU-11, "forma simple"):
// - Cada cambio local se sube completo a Drive y reemplaza al que había (gana el último que sube).
// - Si no hay cambios locales pendientes, se descarga la versión de Drive cuando cambia.
// - Sin conexión, los cambios quedan pendientes y se suben al volver.

import { paraGuardar } from '../datos/operaciones.ts';
import type { Datos, Fecha } from '../datos/tipos.ts';
import { validarDatos } from '../datos/validar.ts';
import { ErrorDrive, type Remoto } from './api.ts';

export type EstadoDrive = 'apagado' | 'conectando' | 'reconectar' | 'sincronizando' | 'al-dia' | 'pendiente' | 'sin-internet' | 'error';

export interface MemoriaDrive {
  conectado: boolean;
  archivoId: string | null;
  /** Versión de Drive con la que coinciden los datos locales. */
  version: string | null;
  /** Hay cambios locales que todavía no se suben. */
  pendiente: boolean;
  ultimaSync: string | null;
}

export interface AlmacenMemoria {
  leer(): MemoriaDrive | null;
  escribir(m: MemoriaDrive): void;
}

export interface Sesion {
  token(): string | null;
  iniciar(primeraVez: boolean): Promise<string>;
  cerrar(): void;
}

export interface Puente {
  datos(): Datos;
  /** Reemplaza los datos locales por los de Drive (sin marcarlos como cambio local). */
  adoptar(datos: Datos): void;
  /** Primera conexión con datos distintos en ambos lados: ¿cuáles se conservan? */
  elegir(local: Datos, remoto: Datos): Promise<'drive' | 'pc' | null>;
  hoy(): Fecha;
}

const MEMORIA_VACIA: MemoriaDrive = { conectado: false, archivoId: null, version: null, pendiente: false, ultimaSync: null };

/** Contenido comparable: sin la marca de modificación. */
function huella(d: Datos): string {
  const { modificado: _m, modificadoPor: _p, ...resto } = paraGuardar(d);
  return JSON.stringify(resto);
}

export class Sincronizador {
  estado: EstadoDrive;
  error: string | null = null;
  private memoria: MemoriaDrive;
  private enCurso: Promise<void> | null = null;
  private temporizador: ReturnType<typeof setTimeout> | null = null;
  private cambios = 0;
  private oyentes: (() => void)[] = [];

  constructor(
    private remoto: Remoto,
    private sesion: Sesion,
    private puente: Puente,
    private almacen: AlmacenMemoria,
    private esperaSubidaMs = 3000,
  ) {
    this.memoria = { ...MEMORIA_VACIA, ...(almacen.leer() ?? {}) };
    this.estado = !this.memoria.conectado ? 'apagado' : this.sesion.token() ? (this.memoria.pendiente ? 'pendiente' : 'al-dia') : 'reconectar';
  }

  get conectado() {
    return this.memoria.conectado;
  }
  get ultimaSync() {
    return this.memoria.ultimaSync;
  }
  get pendiente() {
    return this.memoria.pendiente;
  }

  alCambiar(fn: () => void) {
    this.oyentes.push(fn);
  }

  private poner(estado: EstadoDrive, error: string | null = null) {
    this.estado = estado;
    this.error = error;
    this.oyentes.forEach((f) => f());
  }

  private guardarMemoria(cambios: Partial<MemoriaDrive>) {
    this.memoria = { ...this.memoria, ...cambios };
    this.almacen.escribir(this.memoria);
  }

  private contenidoLocal(): string {
    return JSON.stringify(paraGuardar(this.puente.datos()), null, 2) + '\n';
  }

  private validar(contenido: unknown): Datos {
    const r = validarDatos(contenido, this.puente.hoy());
    if (!r.ok) throw new ErrorDrive(422, `El archivo de Drive no es válido: ${r.errores.slice(0, 3).join(' · ')}`);
    return r.datos;
  }

  // ---------- Acciones del usuario (desde un clic) ----------

  /** Primera conexión: inicia sesión y decide qué datos conservar. */
  async conectar(): Promise<void> {
    this.poner('conectando');
    try {
      await this.sesion.iniciar(true);
      const existente = await this.remoto.localizar();
      if (!existente) {
        const creado = await this.remoto.crear(this.contenidoLocal());
        this.guardarMemoria({ conectado: true, archivoId: creado.id, version: creado.version, pendiente: false, ultimaSync: new Date().toISOString() });
        return this.poner('al-dia');
      }
      const { contenido, version } = await this.remoto.descargar(existente.id);
      const remotos = this.validar(contenido);
      const locales = this.puente.datos();
      let decision: 'drive' | 'pc' | null = 'drive';
      if (huella(remotos) !== huella(locales)) decision = await this.puente.elegir(locales, remotos);
      if (decision === null) {
        this.sesion.cerrar();
        return this.poner('apagado');
      }
      if (decision === 'drive') {
        this.puente.adoptar(remotos);
        this.guardarMemoria({ conectado: true, archivoId: existente.id, version, pendiente: false, ultimaSync: new Date().toISOString() });
      } else {
        const subido = await this.remoto.actualizar(existente.id, this.contenidoLocal());
        this.guardarMemoria({ conectado: true, archivoId: subido.id, version: subido.version, pendiente: false, ultimaSync: new Date().toISOString() });
      }
      this.poner('al-dia');
    } catch (e) {
      this.poner(this.memoria.conectado ? 'error' : 'apagado', (e as Error).message);
      throw e;
    }
  }

  /** Vuelve a iniciar sesión cuando el token venció. */
  async reconectar(): Promise<void> {
    try {
      await this.sesion.iniciar(false);
    } catch (e) {
      this.poner('reconectar', (e as Error).message);
      throw e;
    }
    await this.sincronizar();
  }

  desconectar() {
    if (this.temporizador) clearTimeout(this.temporizador);
    this.sesion.cerrar();
    this.memoria = { ...MEMORIA_VACIA };
    this.almacen.escribir(this.memoria);
    this.poner('apagado');
  }

  // ---------- Automático ----------

  /** Avisa que hubo un cambio local; la subida se agrupa unos segundos. */
  cambioLocal() {
    this.cambios++;
    this.guardarMemoria({ pendiente: true });
    if (!this.memoria.conectado) return;
    if (this.estado !== 'reconectar' && this.estado !== 'sincronizando') this.poner('pendiente');
    if (this.temporizador) clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => void this.sincronizar(), this.esperaSubidaMs);
  }

  /** Sube lo pendiente o descarga lo nuevo. Nunca lanza errores: los refleja en el estado. */
  async sincronizar(): Promise<void> {
    if (this.enCurso) return this.enCurso;
    if (!this.memoria.conectado) return;
    if (!this.sesion.token()) return this.poner('reconectar');
    this.enCurso = (async () => {
      this.poner('sincronizando');
      try {
        if (this.memoria.pendiente) await this.subir();
        else await this.bajar();
        this.guardarMemoria({ ultimaSync: new Date().toISOString() });
        this.poner(this.memoria.pendiente ? 'pendiente' : 'al-dia');
      } catch (e) {
        const err = e instanceof ErrorDrive ? e : new ErrorDrive(-1, (e as Error).message);
        if (err.sesionVencida) this.poner('reconectar');
        else if (err.sinInternet) this.poner('sin-internet');
        else this.poner('error', err.message);
      } finally {
        this.enCurso = null;
      }
    })();
    await this.enCurso;
    // Si llegaron cambios durante la subida, se suben enseguida.
    if (this.memoria.pendiente && this.estado === 'pendiente') await this.sincronizar();
  }

  private async subir() {
    const cambiosAntes = this.cambios;
    const contenido = this.contenidoLocal();
    let id = this.memoria.archivoId;
    if (!id) id = (await this.remoto.localizar())?.id ?? null;
    let resultado;
    if (id) {
      try {
        resultado = await this.remoto.actualizar(id, contenido);
      } catch (e) {
        if (!(e instanceof ErrorDrive && e.estado === 404)) throw e;
        resultado = await this.remoto.crear(contenido); // lo borraron en Drive: se vuelve a crear
      }
    } else {
      resultado = await this.remoto.crear(contenido);
    }
    this.guardarMemoria({ archivoId: resultado.id, version: resultado.version, pendiente: this.cambios !== cambiosAntes });
  }

  private async bajar() {
    let id = this.memoria.archivoId;
    if (!id) {
      id = (await this.remoto.localizar())?.id ?? null;
      if (!id) return this.subir();
      this.guardarMemoria({ archivoId: id });
    }
    const version = await this.remoto.version(id);
    if (version === null) {
      this.guardarMemoria({ archivoId: null });
      return this.subir();
    }
    if (version === this.memoria.version) return;
    const { contenido, version: v } = await this.remoto.descargar(id);
    const datos = this.validar(contenido);
    // Un cambio local mientras se descargaba gana: no se sobrescribe.
    if (this.memoria.pendiente) return;
    this.puente.adoptar(datos);
    this.guardarMemoria({ version: v });
  }
}

export const memoriaLocalStorage: AlmacenMemoria = {
  leer() {
    try {
      return JSON.parse(localStorage.getItem('cdccn.drive') ?? 'null');
    } catch {
      return null;
    }
  },
  escribir(m) {
    try {
      localStorage.setItem('cdccn.drive', JSON.stringify(m));
    } catch {
      // sin almacenamiento disponible
    }
  },
};
