import { DIAS_CORTOS, MESES_CORTOS, deFecha, diaSemana, lunesDe, sumarDias } from '../datos/fechas';
import { eventosEn, obtenerDia, racha } from '../datos/operaciones';
import type { Datos, Fecha } from '../datos/tipos';
import type { Estado } from '../estado';
import { clases, esc } from './html';
import { icono } from './iconos';

const SEMANAS_MINIMAS = 53;

export function botonesSuperiores(): string {
  return `
    <div class="fila-superior">
      <span class="indicador" id="indicador"></span>
      <div class="botones-redondos">
        <button class="btn-redondo" data-accion="vista" data-vista="estadisticas" title="Estadísticas" aria-label="Estadísticas">${icono('estadisticas')}</button>
        <button class="btn-redondo" data-accion="vista" data-vista="buscar" title="Buscar" aria-label="Buscar">${icono('buscar')}</button>
        <button class="btn-redondo" data-accion="vista" data-vista="ajustes" title="Ajustes" aria-label="Ajustes">${icono('ajustes')}</button>
      </div>
    </div>`;
}

export function palomita(datos: Datos, fecha: Fecha, hoy: Fecha, extra = ''): string {
  const futura = fecha > hoy;
  const i = obtenerDia(datos, fecha).intensidad;
  const etiqueta = futura ? 'Los días futuros no se pueden marcar' : `Intensidad ${i} · clic para cambiar`;
  return `<button class="${clases('palomita', `i${i}`, extra)}" data-accion="ciclar" data-fecha="${fecha}" ${futura ? 'disabled' : ''}
    title="${etiqueta}" aria-label="${etiqueta}">${icono('check')}</button>`;
}

function encabezado(datos: Datos, hoy: Fecha): string {
  const { nombre, descripcion, icono: ic } = datos.calendario;
  return `
    <header class="encabezado">
      <div class="icono-app">${icono(ic)}</div>
      <div class="titulos">
        <h1>${esc(nombre)}</h1>
        <p>${descripcion ? esc(descripcion) : 'Sin descripción'}</p>
      </div>
      ${palomita(datos, hoy, hoy)}
    </header>`;
}

function primeraFechaConDatos(datos: Datos): Fecha | null {
  const fechas = [...Object.keys(datos.dias), ...datos.eventos.map((e) => e.inicio)].sort();
  return fechas[0] ?? null;
}

function mapaActividad(datos: Datos, hoy: Fecha): string {
  const lunesActual = lunesDe(hoy);
  let inicio = sumarDias(lunesActual, -7 * (SEMANAS_MINIMAS - 1));
  const primera = primeraFechaConDatos(datos);
  if (primera && primera < inicio) inicio = lunesDe(primera);

  const semanas = Math.round((deFecha(lunesActual).getTime() - deFecha(inicio).getTime()) / (7 * 864e5)) + 1;
  let celdas = '';
  for (let s = 0; s < semanas; s++) {
    const lunes = sumarDias(inicio, s * 7);
    let etiqueta = '';
    for (let d = 0; d < 7; d++) {
      const f = sumarDias(lunes, d);
      if (f.endsWith('-01')) etiqueta = MESES_CORTOS[deFecha(f).getMonth()];
    }
    celdas += `<span class="mapa-mes" data-accion="ir-mes" data-fecha="${lunes}">${etiqueta}</span>`;
    for (let d = 0; d < 7; d++) {
      const f = sumarDias(lunes, d);
      if (f > hoy) {
        celdas += `<span class="celda futura"></span>`;
        continue;
      }
      const i = obtenerDia(datos, f).intensidad;
      const nEv = eventosEn(datos, f).length;
      celdas += `<span class="${clases('celda', i ? `i${i}` : 'vacia', nEv > 0 && `con-evento ev${Math.min(nEv, 3)}`, f === hoy && 'hoy')}"
        data-accion="ir-mes" data-fecha="${f}" title="${f}"></span>`;
    }
  }
  return `
    <section class="tarjeta mapa">
      <div class="mapa-dias"><span></span><span>Lun</span><span></span><span>Mié</span><span></span><span>Vie</span><span></span><span></span></div>
      <div class="mapa-desplazable" data-preservar="mapa" data-al-final>
        <div class="mapa-rejilla">${celdas}</div>
      </div>
    </section>`;
}

function chipRacha(datos: Datos, hoy: Fecha): string {
  const n = racha(datos, hoy);
  return `<div class="chips"><span class="chip" title="Días seguidos con actividad">${icono('fuego')}${n} ${n === 1 ? 'día' : 'días'}</span></div>`;
}

function selectorMes(e: Estado): string {
  const { anio } = e.ui.selectorMes;
  const actual = e.ui.mesVisible.slice(0, 7);
  const meses = MESES_CORTOS.map((m, i) => {
    const valor = `${anio}-${String(i + 1).padStart(2, '0')}`;
    return `<button class="${clases('mes-opcion', valor === actual && 'activo')}" data-accion="elegir-mes" data-mes="${valor}">${m}</button>`;
  }).join('');
  return `
    <div class="selector-mes" role="dialog" aria-label="Elegir mes">
      <div class="selector-anio">
        <button class="btn-redondo chico" data-accion="anio" data-delta="-1" aria-label="Año anterior">${icono('izquierda')}</button>
        <b>${anio}</b>
        <button class="btn-redondo chico" data-accion="anio" data-delta="1" aria-label="Año siguiente">${icono('derecha')}</button>
      </div>
      <div class="selector-meses">${meses}</div>
    </div>`;
}

function calendarioMensual(e: Estado, hoy: Fecha): string {
  const { datos } = e;
  const primero = e.ui.mesVisible;
  const mes = deFecha(primero).getMonth();
  const inicio = lunesDe(primero);
  let dias = '';
  for (let k = 0; k < 42; k++) {
    const f = sumarDias(inicio, k);
    const dia = obtenerDia(datos, f);
    const futura = f > hoy;
    const col = diaSemana(f);
    const nEv = eventosEn(datos, f).length;
    let franja = '';
    if (nEv) {
      const antes = col > 0 && eventosEn(datos, sumarDias(f, -1)).length > 0;
      const despues = col < 6 && eventosEn(datos, sumarDias(f, 1)).length > 0;
      franja = `<span class="${clases('franja', `ev${Math.min(nEv, 3)}`, !antes && 'izq', !despues && 'der')}"></span>`;
    }
    const conNotas = dia.notas.some((n) => n.texto.trim());
    const nombres = eventosEn(datos, f).map((ev) => ev.nombre).join(', ');
    dias += `
      <button class="${clases('dia', deFecha(f).getMonth() !== mes && 'otro-mes', futura ? 'futuro' : dia.intensidad > 0 && `i${dia.intensidad}`, f === hoy && 'hoy', f === e.ui.diaAbierto && 'abierto')}"
        data-accion="ciclar" data-menu-dia data-fecha="${f}"
        title="${f}${nombres ? ' · ' + esc(nombres) : ''}${futura ? ' · futuro' : ''}">
        ${franja}<span class="num">${deFecha(f).getDate()}${conNotas ? '<span class="punto"></span>' : ''}</span>
      </button>`;
  }
  const d = deFecha(primero);
  return `
    <section class="tarjeta mes">
      <div class="dias-semana">${DIAS_CORTOS.map((x) => `<span>${x}</span>`).join('')}</div>
      <div class="dias">${dias}</div>
      <div class="controles-mes">
        <div class="ancla-selector">
          <button class="pastilla crece" data-accion="selector-mes" aria-expanded="${e.ui.selectorMes.abierto}">${MESES_CORTOS[d.getMonth()]} ${d.getFullYear()} ${icono('abajo')}</button>
          ${e.ui.selectorMes.abierto ? selectorMes(e) : ''}
        </div>
        <button class="pastilla" data-accion="ir-hoy">Hoy</button>
        <button class="pastilla circulo relleno" data-accion="mes" data-delta="-1" aria-label="Mes anterior">${icono('izquierda')}</button>
        <button class="pastilla circulo" data-accion="mes" data-delta="1" aria-label="Mes siguiente">${icono('derecha')}</button>
      </div>
      <p class="ayuda">Clic en un día para marcarlo · Clic derecho para ver sus opciones</p>
    </section>`;
}

function notasAbajo(e: Estado): string {
  const fecha = e.ui.diaAbierto;
  const notas = fecha ? obtenerDia(e.datos, fecha).notas.filter((n) => n.texto.trim()) : [];
  if (!fecha || !notas.length) {
    return `
      <section class="tarjeta notas-vacias solo-angosto">
        <div class="icono-app chico">${icono('editar')}</div>
        <div><b>Notas del día</b><span>${fecha ? 'Este día no tiene notas' : 'Clic derecho en un día para verlas'}</span></div>
      </section>`;
  }
  return `
    <section class="tarjeta notas-abajo solo-angosto">
      ${notas.map((n) => `<p>${esc(n.texto)}</p>`).join('')}
    </section>`;
}

export function vistaPrincipal(e: Estado, hoy: Fecha): string {
  return `
    ${botonesSuperiores()}
    ${encabezado(e.datos, hoy)}
    ${mapaActividad(e.datos, hoy)}
    ${chipRacha(e.datos, hoy)}
    ${calendarioMensual(e, hoy)}
    ${notasAbajo(e)}`;
}
