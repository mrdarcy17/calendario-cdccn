import { fechaLarga } from '../datos/fechas';
import { eventosEn, obtenerDia } from '../datos/operaciones';
import type { Datos, Evento, Fecha, Nota } from '../datos/tipos';
import type { Estado } from '../estado';
import { clases, esc } from './html';
import { icono } from './iconos';
import { palomita } from './principal';

export const COLORES_ETIQUETA = ['#FACC15', '#60A5FA', '#F87171', '#A78BFA', '#34D399', '#FB923C', '#F472B6', '#94A3B8'];

function chipEtiqueta(datos: Datos, id: string): string {
  const et = datos.etiquetas.find((x) => x.id === id);
  if (!et) return '';
  return `<span class="${clases('etiqueta', et.archivada && 'archivada')}"><i style="background:${esc(et.color)}"></i>${esc(et.nombre)}</span>`;
}

function caracteristicas(datos: Datos, fecha: Fecha, futura: boolean): string {
  const marcadas = obtenerDia(datos, fecha).caracteristicas;
  const visibles = datos.caracteristicas.filter((c) => !c.archivada || marcadas.includes(c.id));
  const chips = visibles
    .map((c) => {
      const on = marcadas.includes(c.id);
      return `<button class="${clases('caracteristica', on && 'on', c.archivada && 'archivada')}" data-accion="alternar-car" data-id="${c.id}" data-fecha="${fecha}"
        ${futura ? 'disabled' : ''} aria-pressed="${on}" title="${c.archivada ? 'Archivada' : ''}">${icono(on ? 'check' : c.icono)}${esc(c.nombre)}</button>`;
    })
    .join('');
  return `
    <section class="seccion">
      <p class="titulo-seccion">Características</p>
      <div class="chips-envolver">${chips || '<span class="tenue">Agrega características en Ajustes.</span>'}</div>
    </section>`;
}

function formularioEvento(fecha: Fecha, ev?: Evento): string {
  return `
    <form class="form-evento" data-form="evento" data-id="${ev?.id ?? ''}">
      <input name="nombre" placeholder="Nombre del evento" value="${esc(ev?.nombre ?? '')}" required maxlength="60" autocomplete="off">
      <div class="fila-fechas">
        <label>Desde<input type="date" name="inicio" value="${ev?.inicio ?? fecha}" required></label>
        <label>Hasta<input type="date" name="fin" value="${ev?.fin ?? fecha}" required></label>
      </div>
      <div class="fila-botones">
        ${ev ? `<button type="button" class="btn-texto peligro" data-accion="borrar-evento" data-id="${ev.id}">${icono('borrar')}Borrar</button>` : ''}
        <span class="espacio"></span>
        <button type="button" class="btn-texto" data-accion="cancelar-evento">Cancelar</button>
        <button type="submit" class="btn-chico">${ev ? 'Guardar' : 'Crear evento'}</button>
      </div>
    </form>`;
}

function eventos(e: Estado, fecha: Fecha): string {
  const lista = eventosEn(e.datos, fecha);
  const editando = e.ui.editandoEvento;
  const pastillas = lista
    .map((ev) =>
      editando === ev.id
        ? formularioEvento(fecha, ev)
        : `<button class="evento" data-accion="editar-evento" data-id="${ev.id}" title="${ev.inicio} → ${ev.fin} · clic para editar"><i></i>${esc(ev.nombre)}</button>`,
    )
    .join('');
  return `
    <section class="seccion">
      <p class="titulo-seccion">Eventos</p>
      <div class="chips-envolver">
        ${pastillas}
        ${editando === 'nuevo' ? '' : `<button class="btn-texto" data-accion="nuevo-evento">${icono('mas')}Nuevo evento</button>`}
      </div>
      ${editando === 'nuevo' ? formularioEvento(fecha) : ''}
    </section>`;
}

function selectorEtiquetas(datos: Datos, nota: Nota): string {
  const opciones = datos.etiquetas
    .filter((et) => !et.archivada || nota.etiquetas.includes(et.id))
    .map((et) => {
      const on = nota.etiquetas.includes(et.id);
      return `<button class="${clases('etiqueta', 'opcion', on && 'on', et.archivada && 'archivada')}" data-accion="alternar-etiqueta" data-id="${et.id}" data-nota="${nota.id}" aria-pressed="${on}">
        <i style="background:${esc(et.color)}"></i>${esc(et.nombre)}</button>`;
    })
    .join('');
  return `
    <div class="selector-etiquetas">
      <div class="chips-envolver">${opciones}</div>
      <form data-form="nueva-etiqueta" data-nota="${nota.id}" class="nueva-etiqueta">
        <input name="nombre" placeholder="Nueva etiqueta" maxlength="30" autocomplete="off">
        <button type="submit" class="btn-chico">${icono('mas')}</button>
      </form>
    </div>`;
}

function notas(e: Estado, fecha: Fecha, futura: boolean): string {
  const lista = obtenerDia(e.datos, fecha).notas;
  const items = lista
    .map(
      (n) => `
      <div class="nota">
        <textarea data-campo="nota-texto" data-id="${n.id}" data-fecha="${fecha}" rows="2" aria-label="Texto de la nota">${esc(n.texto)}</textarea>
        <div class="nota-pie">
          <div class="chips-envolver">${n.etiquetas.map((id) => chipEtiqueta(e.datos, id)).join('')}</div>
          <button class="btn-icono" data-accion="etiquetar" data-id="${n.id}" title="Etiquetas" aria-label="Etiquetas">${icono('etiqueta')}</button>
          <button class="btn-icono peligro" data-accion="borrar-nota" data-id="${n.id}" data-fecha="${fecha}" title="Eliminar nota" aria-label="Eliminar nota">${icono('borrar')}</button>
        </div>
        ${e.ui.notaEtiquetando === n.id ? selectorEtiquetas(e.datos, n) : ''}
      </div>`,
    )
    .join('');
  const nueva = futura
    ? '<p class="tenue">No se pueden escribir notas en días futuros.</p>'
    : `<form data-form="nueva-nota" data-fecha="${fecha}" class="nueva-nota">
        <textarea name="texto" rows="2" placeholder="Iniciar escritura" aria-label="Nueva nota"></textarea>
        <button type="submit" class="btn-chico">${icono('mas')}Agregar nota</button>
      </form>`;
  return `
    <section class="seccion">
      <p class="titulo-seccion">Notas</p>
      ${items}
      ${nueva}
    </section>`;
}

export function vistaPanel(e: Estado, hoy: Fecha): string {
  const fecha = e.ui.diaAbierto;
  if (!fecha) {
    return `
      <div class="panel-vacio">
        <div class="icono-app">${icono('calendario')}</div>
        <b>Opciones del día</b>
        <span>Haz clic derecho en un día del calendario para ver y editar sus características, eventos y notas.</span>
      </div>`;
  }
  const futura = fecha > hoy;
  return `
    <div class="panel-contenido" data-preservar="panel">
      <div class="asa"></div>
      <div class="panel-encabezado">
        <div class="icono-app chico">${icono(e.datos.calendario.icono)}</div>
        <div class="titulos-panel"><b>${esc(e.datos.calendario.nombre)}</b><span>${fechaLarga(fecha)}</span></div>
        ${palomita(e.datos, fecha, hoy)}
      </div>
      ${futura ? '<p class="aviso-futuro">Día futuro: solo puedes agregar eventos.</p>' : ''}
      ${caracteristicas(e.datos, fecha, futura)}
      ${eventos(e, fecha)}
      ${notas(e, fecha, futura)}
      <div class="panel-acciones">
        <label class="btn-redondo grande" title="Ir a otra fecha">${icono('calendario')}<input type="date" data-campo="ir-fecha" value="${fecha}" aria-label="Ir a otra fecha"></label>
        <button class="btn-principal" data-accion="cerrar-panel">Listo</button>
      </div>
    </div>`;
}
