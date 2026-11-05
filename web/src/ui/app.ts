import { deFecha, hoy } from '../datos/fechas';
import * as op from '../datos/operaciones';
import type { Datos } from '../datos/tipos';
import { validarDatos } from '../datos/validar';
import type { Sincronizador } from '../drive/sincronizador';
import { resumir, type Estado, type Vista } from '../estado';
import { esNativo } from '../plataforma';
import { dialogoEleccion, filaDrive, indicadorDrive } from './drive';
import { esc } from './html';
import { COLORES_ETIQUETA, vistaPanel } from './panel';
import { vistaPrincipal } from './principal';
import { resultadosBusqueda, vistaAjustes, vistaBuscar, vistaEstadisticas } from './vistas';

const primeroDelMes = (f: string) => f.slice(0, 8) + '01';

function moverMes(primero: string, delta: number): string {
  const d = deFecha(primero);
  d.setMonth(d.getMonth() + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function ajustarAltura(t: HTMLTextAreaElement) {
  t.style.height = 'auto';
  t.style.height = `${t.scrollHeight + 2}px`;
}

export function iniciarApp(raiz: HTMLElement, e: Estado, sync: Sincronizador) {
  const desplazamientos = new Map<string, { x: number; y: number }>();
  let resolverEleccion: ((r: 'drive' | 'pc' | null) => void) | null = null;
  /** Tras abrir el panel con "Agregar nota nueva", el cursor va al campo de la nota. */
  let enfocarNotaNueva = false;

  // ---------- Dibujo ----------

  function pintarIndicador() {
    const textos = {
      cargando: ['Cargando…', ''],
      guardado: ['Guardado', 'ok'],
      pendiente: ['Guardando…', ''],
      guardando: ['Guardando…', ''],
      error: ['Error al guardar · reintentar', 'error'],
    } as const;
    const [texto, clase] = textos[e.ui.guardado];
    raiz.querySelectorAll<HTMLElement>('#indicador').forEach((el) => {
      el.textContent = texto;
      el.className = `indicador ${clase}`;
      el.dataset.accion = e.ui.guardado === 'error' ? 'reintentar' : '';
      el.title = e.ui.errores.join('\n');
    });
    const [textoDrive, claseDrive, accionDrive] = indicadorDrive(sync);
    raiz.querySelectorAll<HTMLElement>('#indicador-drive').forEach((el) => {
      el.textContent = textoDrive;
      el.className = `indicador indicador-drive ${claseDrive}`;
      el.hidden = !textoDrive;
      el.dataset.accion = accionDrive;
      el.title = sync.error ?? '';
    });
    const fila = raiz.querySelector<HTMLElement>('#fila-drive');
    if (fila) fila.innerHTML = filaDrive(sync);
    const banda = raiz.querySelector<HTMLElement>('#errores');
    if (banda) {
      banda.hidden = !e.ui.errores.length;
      banda.innerHTML = e.ui.errores.map((x) => `<div>${esc(x)}</div>`).join('');
    }
  }

  function render() {
    // Guarda posición de desplazamiento y foco.
    raiz.querySelectorAll<HTMLElement>('[data-preservar]').forEach((el) => {
      desplazamientos.set(el.dataset.preservar!, { x: el.scrollLeft, y: el.scrollTop });
    });
    const activo = document.activeElement as HTMLInputElement | null;
    const foco = activo?.dataset?.campo ? { campo: activo.dataset.campo, id: activo.dataset.id ?? '', inicio: activo.selectionStart } : null;

    if (!e.datos) {
      raiz.innerHTML = `
        <div class="pantalla-carga">
          ${e.ui.guardado === 'error'
            ? `<b>No se pudieron cargar los datos</b>${e.ui.errores.map((x) => `<span>${esc(x)}</span>`).join('')}
               <button class="btn-principal" data-accion="recargar">Reintentar</button>`
            : '<span>Cargando…</span>'}
        </div>`;
      return;
    }

    const h = hoy();
    const v = e.ui.vista;
    const contenido =
      v === 'ajustes' ? vistaAjustes(e, sync) : v === 'buscar' ? vistaBuscar(e) : v === 'estadisticas' ? vistaEstadisticas(e, h) : vistaPrincipal(e, h);
    const conPanel = v === 'principal' || v === 'buscar';

    raiz.innerHTML = `
      <div class="app vista-${v} ${conPanel ? 'con-panel' : ''} ${e.ui.diaAbierto ? 'panel-abierto' : ''}">
        <main class="columna" data-preservar="columna-${v}">${contenido}</main>
        ${conPanel ? `<div class="velo" data-accion="cerrar-panel"></div><aside class="panel" aria-label="Opciones del día">${vistaPanel(e, h)}</aside>` : ''}
      </div>
      <div class="errores" id="errores" hidden></div>
      ${e.ui.aviso ? `<div class="aviso" role="status">${esc(e.ui.aviso)}</div>` : ''}
      ${dialogoEleccion(e.ui)}`;

    raiz.querySelectorAll<HTMLElement>('[data-preservar]').forEach((el) => {
      const pos = desplazamientos.get(el.dataset.preservar!);
      if (pos) {
        el.scrollLeft = pos.x;
        el.scrollTop = pos.y;
      } else if ('alFinal' in el.dataset) {
        el.scrollLeft = el.scrollWidth;
      }
    });
    raiz.querySelectorAll<HTMLTextAreaElement>('textarea').forEach(ajustarAltura);
    if (foco) {
      const sel = `[data-campo="${foco.campo}"]${foco.id ? `[data-id="${foco.id}"]` : ''}`;
      const el = raiz.querySelector<HTMLInputElement>(sel);
      if (el) {
        el.focus();
        if (foco.inicio !== null && 'setSelectionRange' in el) {
          try {
            el.setSelectionRange(foco.inicio, foco.inicio);
          } catch {
            // algunos tipos de input no admiten selección
          }
        }
      }
    }
    pintarIndicador();
    if (enfocarNotaNueva) {
      enfocarNotaNueva = false;
      const campo = raiz.querySelector<HTMLTextAreaElement>('form[data-form="nueva-nota"] textarea');
      if (campo) {
        campo.focus({ preventScroll: true });
        setTimeout(() => campo.scrollIntoView({ block: 'center', behavior: 'smooth' }), 250);
      }
    }
  }

  e.alCambiar(render);
  document.addEventListener('cdccn:guardado', pintarIndicador);
  sync.alCambiar(pintarIndicador);

  /** Primera conexión con datos distintos: muestra el diálogo y espera la elección. */
  function elegir(local: Datos, remoto: Datos): Promise<'drive' | 'pc' | null> {
    return new Promise((ok) => {
      resolverEleccion = ok;
      ui((u) => (u.eleccionDrive = { local: resumir(local), remoto: resumir(remoto) }));
    });
  }

  const conError = (p: Promise<unknown>) => p.catch((err: Error) => e.avisar(err.message));

  // ---------- Acciones ----------

  const ui = (fn: Parameters<Estado['cambiarUI']>[0]) => e.cambiarUI(fn);
  const datos = (fn: Parameters<Estado['cambiarDatos']>[0]) => e.cambiarDatos(fn);

  function abrirDia(fecha: string) {
    ui((u) => {
      u.diaAbierto = fecha;
      u.editandoEvento = null;
      u.notaEtiquetando = null;
      u.selectorMes.abierto = false;
      if (primeroDelMes(fecha) !== u.mesVisible && u.vista === 'principal') u.mesVisible = primeroDelMes(fecha);
    });
  }

  async function exportar() {
    const contenido = JSON.stringify(op.paraGuardar(e.datos), null, 2) + '\n';
    const nombre = `cdccn-respaldo-${hoy()}.json`;
    if (esNativo) {
      // En el teléfono: se guarda en la caché de la app y se abre el menú de compartir (Drive, correo, archivos…).
      const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
      const { Share } = await import('@capacitor/share');
      const { uri } = await Filesystem.writeFile({ path: nombre, directory: Directory.Cache, encoding: Encoding.UTF8, data: contenido });
      await Share.share({ title: 'Respaldo de cdccn', files: [uri] }).catch(() => {});
      return;
    }
    const url = URL.createObjectURL(new Blob([contenido], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    a.click();
    URL.revokeObjectURL(url);
    e.avisar('Respaldo exportado');
  }

  async function importar(archivo: File) {
    let valor: unknown;
    try {
      valor = JSON.parse(await archivo.text());
    } catch {
      return e.avisar('El archivo no es un JSON válido');
    }
    const r = validarDatos(valor, hoy());
    if (!r.ok) {
      alert(`El archivo no es un respaldo válido de cdccn:\n\n${r.errores.slice(0, 10).join('\n')}`);
      return;
    }
    const dias = Object.keys(r.datos.dias).length;
    if (!confirm(`Se reemplazarán TODOS los datos actuales por los del respaldo (${dias} días con datos). ¿Continuar?`)) return;
    e.reemplazarDatos(r.datos);
    e.avisar('Datos importados');
  }

  raiz.addEventListener('click', (ev) => {
    // El clic que sigue a un "mantener presionado" no debe además cambiar la intensidad.
    if (suprimirClic) {
      suprimirClic = false;
      ev.preventDefault();
      return;
    }
    const objetivo = ev.target as HTMLElement;
    // Cierra el selector de mes al hacer clic fuera de él.
    if (e.ui.selectorMes.abierto && !objetivo.closest('.ancla-selector')) ui((u) => (u.selectorMes.abierto = false));

    const el = objetivo.closest<HTMLElement>('[data-accion]');
    if (!el || !el.dataset.accion) return;
    const { accion, fecha = '', id = '' } = el.dataset;
    const h = hoy();

    switch (accion) {
      case 'vista':
        return ui((u) => {
          u.vista = el.dataset.vista as Vista;
          u.eligiendoIcono = null;
          u.selectorMes.abierto = false;
        });
      case 'ciclar':
        if (fecha > h) return; // los días futuros no se marcan (sin aviso)
        return datos((d) => op.ciclarIntensidad(d, fecha, h));
      case 'ir-mes':
        return ui((u) => (u.mesVisible = primeroDelMes(fecha)));
      case 'selector-mes':
        return ui((u) => {
          u.selectorMes.abierto = !u.selectorMes.abierto;
          u.selectorMes.anio = Number(u.mesVisible.slice(0, 4));
        });
      case 'anio':
        return ui((u) => (u.selectorMes.anio += Number(el.dataset.delta)));
      case 'elegir-mes':
        return ui((u) => {
          u.mesVisible = `${el.dataset.mes}-01`;
          u.selectorMes.abierto = false;
        });
      case 'ir-hoy':
        return ui((u) => (u.mesVisible = primeroDelMes(h)));
      case 'mes':
        return ui((u) => (u.mesVisible = moverMes(u.mesVisible, Number(el.dataset.delta))));
      case 'abrir-dia':
        return abrirDia(fecha);
      case 'nota-nueva':
        enfocarNotaNueva = true;
        return abrirDia(fecha);
      case 'cerrar-panel':
        return ui((u) => {
          u.diaAbierto = null;
          u.editandoEvento = null;
          u.notaEtiquetando = null;
        });
      case 'alternar-car':
        return datos((d) => op.alternarCaracteristica(d, fecha, id, h));
      case 'nuevo-evento':
        return ui((u) => (u.editandoEvento = 'nuevo'));
      case 'editar-evento':
        return ui((u) => (u.editandoEvento = id));
      case 'cancelar-evento':
        return ui((u) => (u.editandoEvento = null));
      case 'borrar-evento': {
        const evento = e.datos.eventos.find((x) => x.id === id);
        if (evento && confirm(`¿Borrar el evento "${evento.nombre}"? Las notas y características de esos días no se borran.`)) {
          datos((d) => op.borrarEvento(d, id));
          ui((u) => (u.editandoEvento = null));
        }
        return;
      }
      case 'etiquetar':
        return ui((u) => (u.notaEtiquetando = u.notaEtiquetando === id ? null : id));
      case 'alternar-etiqueta':
        if (e.ui.diaAbierto) datos((d) => op.alternarEtiquetaDeNota(d, e.ui.diaAbierto!, el.dataset.nota!, id));
        return;
      case 'borrar-nota':
        if (confirm('¿Eliminar esta nota?')) datos((d) => op.borrarNota(d, fecha, id));
        return;
      case 'abrir-iconos':
        return ui((u) => (u.eligiendoIcono = u.eligiendoIcono === el.dataset.objetivo ? null : el.dataset.objetivo!));
      case 'elegir-icono': {
        const destino = el.dataset.objetivo!;
        const nombre = el.dataset.icono!;
        datos((d) => {
          if (destino === 'calendario') d.calendario.icono = nombre;
          else op.editarCaracteristica(d, destino, { icono: nombre });
        });
        return ui((u) => (u.eligiendoIcono = null));
      }
      case 'mover-car':
        return datos((d) => op.moverCaracteristica(d, id, Number(el.dataset.delta) as -1 | 1));
      case 'eliminar-car': {
        let r = '';
        datos((d) => (r = op.eliminarCaracteristica(d, id)));
        return e.avisar(r === 'archivada' ? 'Característica archivada: sigue visible en los días pasados' : 'Característica eliminada');
      }
      case 'restaurar-car':
        return datos((d) => op.restaurarCaracteristica(d, id));
      case 'eliminar-eti': {
        let r = '';
        datos((d) => (r = op.eliminarEtiqueta(d, id)));
        return e.avisar(r === 'archivada' ? 'Etiqueta archivada: sigue visible en sus notas' : 'Etiqueta eliminada');
      }
      case 'restaurar-eti':
        return datos((d) => op.restaurarEtiqueta(d, id));
      case 'exportar':
        return void conError(exportar());
      case 'reintentar':
        return void e.guardarAhora();
      case 'recargar':
        return void e.cargar();
      case 'drive-conectar':
        return void conError(sync.conectar().then(() => sync.conectado && e.avisar('Conectado con Google Drive')));
      case 'drive-reconectar':
        return void conError(sync.reconectar());
      case 'drive-sincronizar':
        return void sync.sincronizar();
      case 'drive-desconectar':
        if (confirm(`¿Desconectar Google Drive? Tus datos se quedan en ${esNativo ? 'este teléfono' : 'esta PC'} y el archivo sigue en tu Drive; solo se deja de sincronizar.`)) sync.desconectar();
        return;
      case 'elegir-drive': {
        const opcion = el.dataset.opcion;
        const r = opcion === 'drive' ? 'drive' : opcion === 'pc' ? 'pc' : null;
        const aqui = esNativo ? 'este teléfono' : 'esta PC';
        if (r === 'drive' && !confirm(`Se reemplazarán los datos de ${aqui} por los de Drive. ¿Continuar?`)) return;
        if (r === 'pc' && !confirm(`Se reemplazarán los datos de Drive por los de ${aqui}. ¿Continuar?`)) return;
        ui((u) => (u.eleccionDrive = null));
        resolverEleccion?.(r);
        resolverEleccion = null;
        return;
      }
    }
  });

  // Mantener presionado un día (táctil) o clic derecho (ratón): abre sus opciones.
  const MANTENER_MS = 500;
  let suprimirClic = false;
  let presion: { id: number; x: number; y: number; temporizador: ReturnType<typeof setTimeout> } | null = null;
  const cancelarPresion = () => {
    if (presion) clearTimeout(presion.temporizador);
    presion = null;
  };
  raiz.addEventListener('pointerdown', (ev) => {
    if (ev.pointerType === 'mouse') return;
    const dia = (ev.target as HTMLElement).closest<HTMLElement>('[data-menu-dia]');
    if (!dia) return;
    cancelarPresion();
    presion = {
      id: ev.pointerId,
      x: ev.clientX,
      y: ev.clientY,
      temporizador: setTimeout(() => {
        presion = null;
        suprimirClic = true;
        setTimeout(() => (suprimirClic = false), 800);
        navigator.vibrate?.(15);
        abrirDia(dia.dataset.fecha!);
      }, MANTENER_MS),
    };
  });
  raiz.addEventListener('pointermove', (ev) => {
    if (presion && ev.pointerId === presion.id && Math.hypot(ev.clientX - presion.x, ev.clientY - presion.y) > 10) cancelarPresion();
  });
  ['pointerup', 'pointercancel'].forEach((tipo) => raiz.addEventListener(tipo, cancelarPresion));
  raiz.addEventListener('contextmenu', (ev) => {
    const dia = (ev.target as HTMLElement).closest<HTMLElement>('[data-menu-dia]');
    if (!dia) return;
    ev.preventDefault();
    // En pantallas táctiles el menú contextual llega con la presión larga, que ya abrió el día.
    if (!suprimirClic && !presion) abrirDia(dia.dataset.fecha!);
  });

  // Botón "atrás" de Android: cierra lo abierto, vuelve a la pantalla principal o minimiza.
  if (esNativo) {
    void import('@capacitor/app').then(({ App }) =>
      App.addListener('backButton', () => {
        if (e.ui.eleccionDrive) {
          ui((u) => (u.eleccionDrive = null));
          resolverEleccion?.(null);
          resolverEleccion = null;
        } else if (e.ui.selectorMes.abierto) ui((u) => (u.selectorMes.abierto = false));
        else if (e.ui.eligiendoIcono) ui((u) => (u.eligiendoIcono = null));
        else if (e.ui.editandoEvento) ui((u) => (u.editandoEvento = null));
        else if (e.ui.notaEtiquetando) ui((u) => (u.notaEtiquetando = null));
        else if (e.ui.diaAbierto) ui((u) => (u.diaAbierto = null));
        else if (e.ui.vista !== 'principal') ui((u) => (u.vista = 'principal'));
        else void App.minimizeApp();
      }),
    );
  }

  raiz.addEventListener('submit', (ev) => {
    const form = ev.target as HTMLFormElement;
    ev.preventDefault();
    const campos = new FormData(form);
    const texto = (nombre: string) => String(campos.get(nombre) ?? '');
    const h = hoy();
    const fechaAbierta = e.ui.diaAbierto;

    switch (form.dataset.form) {
      case 'evento': {
        const nombre = texto('nombre').trim();
        const inicio = texto('inicio');
        const fin = texto('fin');
        if (!nombre || !inicio || !fin) return;
        const id = form.dataset.id;
        datos((d) => (id ? op.editarEvento(d, id, { nombre, inicio, fin }) : op.crearEvento(d, nombre, inicio, fin)));
        return ui((u) => (u.editandoEvento = null));
      }
      case 'nueva-nota': {
        if (!fechaAbierta || !texto('texto').trim()) return;
        if (fechaAbierta > h) return e.avisar('No se pueden escribir notas en días futuros');
        return datos((d) => op.agregarNota(d, fechaAbierta, texto('texto'), [], h));
      }
      case 'nueva-etiqueta': {
        const notaId = form.dataset.nota!;
        if (!fechaAbierta || !texto('nombre').trim()) return;
        return datos((d) => {
          const et = op.crearEtiqueta(d, texto('nombre'), COLORES_ETIQUETA[d.etiquetas.length % COLORES_ETIQUETA.length]);
          const nota = d.dias[fechaAbierta]?.notas.find((n) => n.id === notaId);
          if (et && nota && !nota.etiquetas.includes(et.id)) op.alternarEtiquetaDeNota(d, fechaAbierta, notaId, et.id);
        });
      }
      case 'nueva-car':
        if (!texto('nombre').trim()) return;
        return datos((d) => op.crearCaracteristica(d, texto('nombre'), 'estrella'));
      case 'nueva-eti':
        if (!texto('nombre').trim()) return;
        return datos((d) => op.crearEtiqueta(d, texto('nombre'), COLORES_ETIQUETA[d.etiquetas.length % COLORES_ETIQUETA.length]));
    }
  });

  raiz.addEventListener('input', (ev) => {
    const el = ev.target as HTMLInputElement;
    const { campo, id = '', fecha = '' } = el.dataset;
    if (el instanceof HTMLTextAreaElement) ajustarAltura(el);
    switch (campo) {
      // Mientras se escribe no se redibuja, para no perder el cursor; se guarda solo.
      case 'nota-texto':
        return e.cambiarDatos((d) => op.editarNota(d, fecha, id, { texto: el.value }), false);
      case 'cal-nombre':
        if (el.value.trim()) e.cambiarDatos((d) => (d.calendario.nombre = el.value.trim()), false);
        return;
      case 'cal-descripcion':
        return e.cambiarDatos((d) => (d.calendario.descripcion = el.value.trim()), false);
      case 'car-nombre':
        if (el.value.trim()) e.cambiarDatos((d) => op.editarCaracteristica(d, id, { nombre: el.value }), false);
        return;
      case 'eti-nombre':
        if (el.value.trim()) e.cambiarDatos((d) => op.editarEtiqueta(d, id, { nombre: el.value }), false);
        return;
      case 'buscar-texto':
        e.cambiarUI((u) => (u.filtro.texto = el.value), false);
        raiz.querySelector('#resultados')!.innerHTML = resultadosBusqueda(e);
        return;
    }
  });

  raiz.addEventListener('change', (ev) => {
    const el = ev.target as HTMLInputElement;
    const { campo, id = '' } = el.dataset;
    switch (campo) {
      case 'eti-color':
        return datos((d) => op.editarEtiqueta(d, id, { color: el.value }));
      case 'buscar-etiqueta':
      case 'buscar-car':
        e.cambiarUI((u) => {
          if (campo === 'buscar-etiqueta') u.filtro.etiqueta = el.value || undefined;
          else u.filtro.caracteristica = el.value || undefined;
        }, false);
        raiz.querySelector('#resultados')!.innerHTML = resultadosBusqueda(e);
        return;
      case 'ir-fecha':
        if (el.value) abrirDia(el.value);
        return;
      case 'importar':
        if (el.files?.[0]) void importar(el.files[0]);
        el.value = '';
        return;
      // Si un nombre quedó vacío, se restaura el último válido.
      case 'cal-nombre':
        if (!el.value.trim()) el.value = e.datos.calendario.nombre;
        return;
      case 'car-nombre':
        if (!el.value.trim()) el.value = e.datos.caracteristicas.find((c) => c.id === id)?.nombre ?? '';
        return;
      case 'eti-nombre':
        if (!el.value.trim()) el.value = e.datos.etiquetas.find((x) => x.id === id)?.nombre ?? '';
        return;
    }
  });

  raiz.addEventListener('keydown', (ev) => {
    const el = ev.target as HTMLElement;
    if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey) && el.closest('form[data-form="nueva-nota"]')) {
      ev.preventDefault();
      el.closest('form')!.requestSubmit();
    } else if (ev.key === 'Enter' && el.classList.contains('entrada-fila') && !el.closest('form')) {
      (el as HTMLInputElement).blur();
    }
  });

  document.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Escape') return;
    if (e.ui.eleccionDrive) {
      ui((u) => (u.eleccionDrive = null));
      resolverEleccion?.(null);
      resolverEleccion = null;
    } else if (e.ui.selectorMes.abierto) ui((u) => (u.selectorMes.abierto = false));
    else if (e.ui.eligiendoIcono) ui((u) => (u.eligiendoIcono = null));
    else if (e.ui.editandoEvento) ui((u) => (u.editandoEvento = null));
    else if (e.ui.notaEtiquetando) ui((u) => (u.notaEtiquetando = null));
    else if (e.ui.diaAbierto) ui((u) => (u.diaAbierto = null));
  });

  // Guarda lo pendiente al cambiar de pestaña o cerrar.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && e.datos && e.hayCambiosSinGuardar()) void e.guardarAhora(true);
  });
  window.addEventListener('beforeunload', (ev) => {
    if (e.datos && e.hayCambiosSinGuardar()) {
      void e.guardarAhora(true);
      ev.preventDefault();
    }
  });

  render();
  return { elegir };
}
