import { ErrorAlmacen, type Almacen } from './almacen';
import { hoy } from './datos/fechas';
import { marcarModificado, paraGuardar, type Filtro } from './datos/operaciones';
import type { Datos, Fecha } from './datos/tipos';

export type Vista = 'principal' | 'buscar' | 'ajustes' | 'estadisticas';
export type EstadoGuardado = 'cargando' | 'guardado' | 'pendiente' | 'guardando' | 'error';

export interface UI {
  vista: Vista;
  /** Primer día del mes que muestra el calendario mensual. */
  mesVisible: Fecha;
  /** Día cuyas opciones están abiertas (clic derecho). */
  diaAbierto: Fecha | null;
  selectorMes: { abierto: boolean; anio: number };
  /** Nota cuyo selector de etiquetas está abierto. */
  notaEtiquetando: string | null;
  /** Evento que se está editando, o 'nuevo'. */
  editandoEvento: string | null;
  /** Característica cuyo selector de ícono está abierto, o 'calendario'. */
  eligiendoIcono: string | null;
  filtro: Filtro;
  /** Primera conexión a Drive con datos distintos: resumen para elegir. */
  eleccionDrive: { local: ResumenDatos; remoto: ResumenDatos } | null;
  guardado: EstadoGuardado;
  errores: string[];
  aviso: string | null;
}

export interface ResumenDatos {
  dias: number;
  notas: number;
  modificado: string;
  modificadoPor: string;
}

export function resumir(d: Datos): ResumenDatos {
  const dias = Object.values(d.dias);
  return { dias: dias.length, notas: dias.reduce((n, x) => n + x.notas.length, 0), modificado: d.modificado, modificadoPor: d.modificadoPor };
}

type Oyente = () => void;

const ESPERA_GUARDADO_MS = 500;

export class Estado {
  datos!: Datos;
  ui: UI;
  private oyentes: Oyente[] = [];
  /** Se llama tras cada cambio hecho por el usuario (para subirlo a Drive). */
  alCambioLocal: (() => void) | null = null;
  private temporizador: ReturnType<typeof setTimeout> | null = null;
  private guardando: Promise<void> | null = null;
  private temporizadorAviso: ReturnType<typeof setTimeout> | null = null;

  constructor(private almacen: Almacen) {
    const h = hoy();
    this.ui = {
      vista: 'principal',
      mesVisible: h.slice(0, 8) + '01',
      diaAbierto: null,
      selectorMes: { abierto: false, anio: Number(h.slice(0, 4)) },
      notaEtiquetando: null,
      editandoEvento: null,
      eligiendoIcono: null,
      filtro: {},
      eleccionDrive: null,
      guardado: 'cargando',
      errores: [],
      aviso: null,
    };
  }

  alCambiar(oyente: Oyente) {
    this.oyentes.push(oyente);
  }

  notificar() {
    this.oyentes.forEach((o) => o());
  }

  async cargar() {
    try {
      this.datos = await this.almacen.cargar();
      this.ui.guardado = 'guardado';
      this.ui.errores = [];
    } catch (e) {
      this.ui.guardado = 'error';
      this.ui.errores = e instanceof ErrorAlmacen ? e.errores : [(e as Error).message];
    }
    this.notificar();
  }

  /** Cambia la interfaz (no se guarda). */
  cambiarUI(fn: (ui: UI) => void, render = true) {
    fn(this.ui);
    if (render) this.notificar();
  }

  /** Cambia los datos y programa el autoguardado. Con render=false no se redibuja (p.ej. mientras se escribe). */
  cambiarDatos(fn: (datos: Datos) => void, render = true) {
    fn(this.datos);
    marcarModificado(this.datos, 'web');
    this.programarGuardado();
    this.alCambioLocal?.();
    if (render) this.notificar();
  }

  /** Reemplaza todos los datos (importar). */
  reemplazarDatos(nuevos: Datos) {
    this.datos = nuevos;
    marcarModificado(this.datos, 'web');
    this.programarGuardado();
    this.alCambioLocal?.();
    this.notificar();
  }

  /** Datos que llegan de Drive: se guardan en la copia local, pero no son un cambio local. */
  adoptarRemoto(remotos: Datos) {
    this.datos = remotos;
    this.programarGuardado();
    this.notificar();
  }

  avisar(texto: string) {
    this.ui.aviso = texto;
    if (this.temporizadorAviso) clearTimeout(this.temporizadorAviso);
    this.temporizadorAviso = setTimeout(() => {
      this.ui.aviso = null;
      this.notificar();
    }, 3000);
    this.notificar();
  }

  private programarGuardado() {
    this.ui.guardado = 'pendiente';
    if (this.temporizador) clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => void this.guardarAhora(), ESPERA_GUARDADO_MS);
    this.actualizarIndicador();
  }

  async guardarAhora(alSalir = false): Promise<void> {
    if (this.temporizador) {
      clearTimeout(this.temporizador);
      this.temporizador = null;
    }
    if (this.guardando) await this.guardando;
    if (this.ui.guardado !== 'pendiente' && this.ui.guardado !== 'error') return;
    this.ui.guardado = 'guardando';
    this.actualizarIndicador();
    this.guardando = this.almacen
      .guardar(paraGuardar(this.datos), { alSalir })
      .then(() => {
        if (this.ui.guardado === 'guardando') this.ui.guardado = 'guardado';
        this.ui.errores = [];
      })
      .catch((e) => {
        this.ui.guardado = 'error';
        this.ui.errores = e instanceof ErrorAlmacen ? e.errores : ['No se pudo guardar. ¿Está corriendo el servidor local (pnpm dev)?'];
      })
      .finally(() => {
        this.guardando = null;
        this.actualizarIndicador();
      });
    await this.guardando;
  }

  hayCambiosSinGuardar() {
    return this.ui.guardado === 'pendiente' || this.ui.guardado === 'guardando' || this.ui.guardado === 'error';
  }

  /** Actualiza solo el indicador de guardado, sin redibujar todo (no interrumpe la escritura). */
  private actualizarIndicador() {
    document.dispatchEvent(new CustomEvent('cdccn:guardado'));
  }
}
