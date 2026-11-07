import { MESES, fechaLarga, sumarDias } from '../datos/fechas';
import { buscar, caracteristicaEnUso, etiquetaEnUso, racha } from '../datos/operaciones';
import type { Datos, Fecha } from '../datos/tipos';
import type { Sincronizador } from '../drive/sincronizador';
import type { Estado } from '../estado';
import { filaDrive } from './drive';
import { esNativo } from '../plataforma';
import { semanasApiladas } from '../datos/estadisticas';
import { calcularRecords, esReciente } from '../datos/records';
import { barrasPorSemana } from './graficas';
import { clases, esc } from './html';
import { CATALOGO, icono } from './iconos';

function cabecera(titulo: string): string {
  return `
    <div class="cabecera-vista">
      <button class="btn-redondo" data-accion="vista" data-vista="principal" aria-label="Volver">${icono('izquierda')}</button>
      <h1>${titulo}</h1>
      <span class="indicador indicador-drive" id="indicador-drive" hidden></span>
      <span class="indicador" id="indicador"></span>
    </div>`;
}

function selectorIconos(objetivo: string, actual: string): string {
  return `
    <div class="selector-iconos">
      ${Object.entries(CATALOGO)
        .map(
          ([nombre, { nombre: etiqueta }]) =>
            `<button class="${clases('btn-icono', nombre === actual && 'on')}" data-accion="elegir-icono" data-objetivo="${objetivo}" data-icono="${nombre}" title="${etiqueta}" aria-label="${etiqueta}">${icono(nombre)}</button>`,
        )
        .join('')}
    </div>`;
}

// ---------- Ajustes ----------

/** Modo de acceso y PIN (CU-03). Solo en Android. */
function grupoSeguridad(e: Estado): string {
  const libre = e.ui.seguridad.modo === 'libre';
  return `
    <p class="titulo-grupo">Seguridad</p>
    <section class="tarjeta grupo">
      <div class="fila">
        <span class="ico">${icono('escudo')}</span>
        <div class="txt"><b>Modo de acceso</b><span>${libre ? 'Libre: la app abre directo al calendario' : 'Protegido: pide el PIN cada vez que entras'}</span></div>
      </div>
      <div class="segmento" role="radiogroup" aria-label="Modo de acceso">
        <button role="radio" aria-checked="${libre}" class="${libre ? 'on' : ''}" data-accion="modo-acceso" data-modo="libre">Libre</button>
        <button role="radio" aria-checked="${!libre}" class="${libre ? '' : 'on'}" data-accion="modo-acceso" data-modo="protegido">Protegido</button>
      </div>
      <button class="fila boton-fila ${libre || !e.ui.huellaDisponible ? 'deshabilitada' : ''}" data-accion="huella-al-entrar" role="switch"
        aria-checked="${!libre && e.ui.seguridad.huellaAlEntrar}" ${libre || !e.ui.huellaDisponible ? 'disabled' : ''}>
        <span class="ico">${icono('huella')}</span>
        <div class="txt"><b>Abrir la huella al entrar</b><span>${
          libre ? 'Disponible en modo protegido' : !e.ui.huellaDisponible ? 'Tu teléfono no tiene huella registrada' : 'El lector aparece solo al abrir la app'
        }</span></div>
        <span class="interruptor ${!libre && e.ui.seguridad.huellaAlEntrar ? 'on' : ''}"></span>
      </button>
      <button class="fila boton-fila ${libre ? 'deshabilitada' : ''}" data-accion="cambiar-pin" ${libre ? 'disabled' : ''}>
        <span class="ico">${icono('llave')}</span>
        <div class="txt"><b>Cambiar PIN</b><span>${libre ? 'Disponible en modo protegido' : 'Escribe el nuevo PIN dos veces'}</span></div>
        ${icono('derecha', 'chev')}
      </button>
    </section>`;
}

export function vistaAjustes(e: Estado, sync: Sincronizador): string {
  const d = e.datos;
  const activas = d.caracteristicas.filter((c) => !c.archivada);
  const archivadas = d.caracteristicas.filter((c) => c.archivada);
  const etiquetasActivas = d.etiquetas.filter((x) => !x.archivada);
  const etiquetasArchivadas = d.etiquetas.filter((x) => x.archivada);

  const filaCaracteristica = (c: Datos['caracteristicas'][number], i: number) => `
    <div class="fila">
      <button class="ico" data-accion="abrir-iconos" data-objetivo="${c.id}" title="Cambiar ícono" aria-label="Cambiar ícono">${icono(c.icono)}</button>
      <input class="entrada-fila" data-campo="car-nombre" data-id="${c.id}" value="${esc(c.nombre)}" maxlength="40" aria-label="Nombre de la característica">
      <button class="btn-icono" data-accion="mover-car" data-id="${c.id}" data-delta="-1" ${i === 0 ? 'disabled' : ''} aria-label="Subir">${icono('arriba')}</button>
      <button class="btn-icono" data-accion="mover-car" data-id="${c.id}" data-delta="1" ${i === activas.length - 1 ? 'disabled' : ''} aria-label="Bajar">${icono('abajo')}</button>
      <button class="btn-icono peligro" data-accion="eliminar-car" data-id="${c.id}"
        title="${caracteristicaEnUso(d, c.id) ? 'Archivar (se usa en días pasados)' : 'Eliminar'}" aria-label="Eliminar">${icono(caracteristicaEnUso(d, c.id) ? 'archivar' : 'borrar')}</button>
    </div>
    ${e.ui.eligiendoIcono === c.id ? selectorIconos(c.id, c.icono) : ''}`;

  const filaEtiqueta = (x: Datos['etiquetas'][number]) => `
    <div class="fila">
      <input type="color" class="color" data-campo="eti-color" data-id="${x.id}" value="${esc(x.color)}" aria-label="Color">
      <input class="entrada-fila" data-campo="eti-nombre" data-id="${x.id}" value="${esc(x.nombre)}" maxlength="30" aria-label="Nombre de la etiqueta">
      <button class="btn-icono peligro" data-accion="eliminar-eti" data-id="${x.id}"
        title="${etiquetaEnUso(d, x.id) ? 'Archivar (se usa en notas)' : 'Eliminar'}" aria-label="Eliminar">${icono(etiquetaEnUso(d, x.id) ? 'archivar' : 'borrar')}</button>
    </div>`;

  const filaArchivada = (nombre: string, accion: string, id: string, ic: string) => `
    <div class="fila archivada">
      <span class="ico">${ic}</span>
      <span class="txt">${esc(nombre)}</span>
      <button class="btn-texto" data-accion="${accion}" data-id="${id}">${icono('restaurar')}Restaurar</button>
    </div>`;

  return `
    ${cabecera('Ajustes')}

    <p class="titulo-grupo">Calendario</p>
    <section class="tarjeta grupo">
      <div class="fila">
        <button class="ico" data-accion="abrir-iconos" data-objetivo="calendario" title="Cambiar ícono" aria-label="Cambiar ícono">${icono(d.calendario.icono)}</button>
        <div class="campos">
          <input class="entrada-fila" data-campo="cal-nombre" value="${esc(d.calendario.nombre)}" maxlength="40" placeholder="Nombre" aria-label="Nombre del calendario">
          <input class="entrada-fila tenue" data-campo="cal-descripcion" value="${esc(d.calendario.descripcion)}" maxlength="120" placeholder="Sin descripción" aria-label="Descripción">
        </div>
      </div>
      ${e.ui.eligiendoIcono === 'calendario' ? selectorIconos('calendario', d.calendario.icono) : ''}
    </section>

    ${esNativo ? grupoSeguridad(e) : ''}

    <p class="titulo-grupo">Características</p>
    <section class="tarjeta grupo">
      ${activas.map(filaCaracteristica).join('') || '<p class="fila tenue">Sin características.</p>'}
      <form class="fila" data-form="nueva-car">
        <span class="ico">${icono('mas')}</span>
        <input class="entrada-fila" name="nombre" placeholder="Nueva característica" maxlength="40" autocomplete="off">
        <button type="submit" class="btn-chico">Agregar</button>
      </form>
      ${archivadas.map((c) => filaArchivada(c.nombre, 'restaurar-car', c.id, icono(c.icono))).join('')}
    </section>

    <p class="titulo-grupo">Etiquetas</p>
    <section class="tarjeta grupo">
      ${etiquetasActivas.map(filaEtiqueta).join('') || '<p class="fila tenue">Sin etiquetas. También puedes crearlas desde una nota.</p>'}
      <form class="fila" data-form="nueva-eti">
        <span class="ico">${icono('mas')}</span>
        <input class="entrada-fila" name="nombre" placeholder="Nueva etiqueta" maxlength="30" autocomplete="off">
        <button type="submit" class="btn-chico">Agregar</button>
      </form>
      ${etiquetasArchivadas.map((x) => filaArchivada(x.nombre, 'restaurar-eti', x.id, `<i class="punto-color" style="background:${esc(x.color)}"></i>`)).join('')}
    </section>

    <p class="titulo-grupo">Datos</p>
    <section class="tarjeta grupo">
      <div class="fila">
        <span class="ico">${icono('archivo')}</span>
        <div class="txt"><b>Copia local</b><span>${esNativo ? 'En el teléfono (archivos privados de la app)' : 'web/datos/cdccn-datos.json'} · se guarda sola</span></div>
      </div>
      <div class="fila" id="fila-drive">${filaDrive(sync)}</div>
      <button class="fila boton-fila" data-accion="exportar">
        <span class="ico">${icono('descargar')}</span>
        <div class="txt"><b>Exportar datos</b><span>${esNativo ? 'Comparte un archivo JSON (Drive, correo, archivos…)' : 'Descarga un archivo JSON'}</span></div>
      </button>
      <label class="fila boton-fila">
        <span class="ico">${icono('subir')}</span>
        <div class="txt"><b>Importar datos</b><span>Reemplaza todos los datos actuales</span></div>
        <input type="file" accept="application/json,.json" data-campo="importar" hidden>
      </label>
    </section>
    <p class="nota-pie-vista">${esNativo ? 'El PIN se guarda solo en este teléfono; nunca se sube a Drive.' : 'El PIN y el modo de acceso solo existen en la app Android.'}</p>`;
}

// ---------- Buscar ----------

export function resultadosBusqueda(e: Estado): string {
  const resultados = buscar(e.datos, e.ui.filtro);
  const hayFiltro = Boolean(e.ui.filtro.texto?.trim() || e.ui.filtro.etiqueta || e.ui.filtro.caracteristica);
  if (!hayFiltro) return '<p class="tenue centrado">Escribe un texto o elige una etiqueta o característica.</p>';
  if (!resultados.length) return '<p class="tenue centrado">Sin resultados.</p>';
  const texto = e.ui.filtro.texto?.trim() ?? '';
  const resaltar = (s: string) => {
    const seguro = esc(s);
    if (!texto) return seguro;
    const patron = new RegExp(esc(texto).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    return seguro.replace(patron, (m) => `<mark>${m}</mark>`);
  };
  return `
    <p class="tenue">${resultados.length} ${resultados.length === 1 ? 'resultado' : 'resultados'}</p>
    ${resultados
      .map(
        (r) => `
      <button class="tarjeta resultado" data-accion="abrir-dia" data-fecha="${r.fecha}">
        <span class="fecha">${fechaLarga(r.fecha)}</span>
        ${r.nota ? `<span class="texto">${resaltar(r.nota.texto)}</span>` : '<span class="texto tenue">Día con la característica, sin notas</span>'}
      </button>`,
      )
      .join('')}`;
}

export function vistaBuscar(e: Estado): string {
  const d = e.datos;
  const f = e.ui.filtro;
  const opciones = (lista: { id: string; nombre: string; archivada: boolean }[], actual?: string) =>
    lista
      .map((x) => `<option value="${x.id}" ${x.id === actual ? 'selected' : ''}>${esc(x.nombre)}${x.archivada ? ' (archivada)' : ''}</option>`)
      .join('');
  return `
    ${cabecera('Buscar')}
    <div class="buscador">
      <label class="campo-busqueda">${icono('buscar')}<input type="search" data-campo="buscar-texto" value="${esc(f.texto ?? '')}" placeholder="Buscar en las notas" autofocus></label>
      <div class="filtros">
        <select data-campo="buscar-etiqueta" aria-label="Etiqueta"><option value="">Todas las etiquetas</option>${opciones(d.etiquetas, f.etiqueta)}</select>
        <select data-campo="buscar-car" aria-label="Característica"><option value="">Todas las características</option>${opciones(d.caracteristicas, f.caracteristica)}</select>
      </div>
    </div>
    <div class="resultados" id="resultados">${resultadosBusqueda(e)}</div>`;
}

// ---------- Estadísticas (CU-12, en definición) ----------

const DIAS_SEMANA = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const MESES_CORTOS_R = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** "3 mar 2026" */
function fechaCorta(f: Fecha): string {
  return `${Number(f.slice(8))} ${MESES_CORTOS_R[Number(f.slice(5, 7)) - 1]} ${f.slice(0, 4)}`;
}
/** "3 – 14 mar 2026" o "28 feb – 3 mar 2026" */
function rango(inicio: Fecha, fin: Fecha): string {
  if (inicio === fin) return fechaCorta(inicio);
  if (inicio.slice(0, 7) === fin.slice(0, 7)) return `${Number(inicio.slice(8))} – ${fechaCorta(fin)}`;
  return `${fechaCorta(inicio).replace(` ${inicio.slice(0, 4)}`, inicio.slice(0, 4) === fin.slice(0, 4) ? '' : ` ${inicio.slice(0, 4)}`)} – ${fechaCorta(fin)}`;
}
/** "marzo 2026" */
const nombreMes = (mes: string) => `${MESES[Number(mes.slice(5)) - 1]} ${mes.slice(0, 4)}`;
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

function tarjetaRecord(titulo: string, valor: string, detalle: string, nuevo: boolean, esTexto = false): string {
  return `
    <div class="tarjeta record${nuevo ? ' nuevo' : ''}">
      <span class="titulo-record">${titulo}</span>
      <b class="${esTexto ? 'texto' : ''}">${valor}</b>
      <span class="detalle-record">${detalle}</span>
      ${nuevo ? '<em class="etiqueta-nuevo">¡Nuevo!</em>' : ''}
    </div>`;
}

/** Récords (CU-12): 1–7 y 9–12 de la lista acordada. */
function seccionRecords(d: Datos, hoy: Fecha): string {
  const r = calcularRecords(d, hoy);
  if (!r.total.dias) {
    return `<p class="titulo-grupo">Récords</p><section class="tarjeta proximamente"><span>Marca tus primeros días para empezar a ver récords.</span></section>`;
  }
  const t: string[] = [];
  const sinDato = '—';
  t.push(r.rachaMasLarga
    ? tarjetaRecord('Racha más larga', plural(r.rachaMasLarga.dias, 'día', 'días'), rango(r.rachaMasLarga.inicio, r.rachaMasLarga.fin), esReciente(r.rachaMasLarga.fin, hoy) && r.rachaMasLarga.dias > 1)
    : tarjetaRecord('Racha más larga', sinDato, '', false));
  if (r.mejorSemana) {
    const fin = sumarDias(r.mejorSemana.lunes, 6);
    t.push(tarjetaRecord('Mejor semana', plural(r.mejorSemana.dias, 'día', 'días'), `${rango(r.mejorSemana.lunes, fin)} · ${r.mejorSemana.puntos} puntos`, esReciente(fin < hoy ? fin : hoy, hoy)));
  }
  if (r.mejorMes) t.push(tarjetaRecord('Mejor mes', plural(r.mejorMes.dias, 'día', 'días'), nombreMes(r.mejorMes.mes), r.mejorMes.mes === hoy.slice(0, 7)));
  if (r.semanasActivas) {
    t.push(tarjetaRecord('Semanas seguidas activas', plural(r.semanasActivas.semanas, 'semana', 'semanas'),
      `${rango(r.semanasActivas.inicio, sumarDias(r.semanasActivas.fin, 6))} · ahora llevas ${r.semanasActivasActual}`,
      r.semanasActivasActual === r.semanasActivas.semanas && r.semanasActivas.semanas > 1 && esReciente(sumarDias(r.semanasActivas.fin, 6) > hoy ? hoy : sumarDias(r.semanasActivas.fin, 6), hoy)));
  }
  t.push(tarjetaRecord('Semanas perfectas', String(r.semanasPerfectas.cuantas),
    r.semanasPerfectas.ultima ? `7 de 7 días · la última: ${fechaCorta(r.semanasPerfectas.ultima)}` : '7 de 7 días · aún ninguna',
    esReciente(r.semanasPerfectas.ultima, hoy)));
  t.push(r.rachaMaxima
    ? tarjetaRecord('Racha al máximo', plural(r.rachaMaxima.dias, 'día', 'días'), `en nivel 3 · ${rango(r.rachaMaxima.inicio, r.rachaMaxima.fin)}`, esReciente(r.rachaMaxima.fin, hoy) && r.rachaMaxima.dias > 1)
    : tarjetaRecord('Racha al máximo', sinDato, 'aún no hay días en nivel 3', false));
  t.push(r.mesMasIntenso
    ? tarjetaRecord('Mes más intenso', plural(r.mesMasIntenso.dias, 'día', 'días'), `en nivel 3 · ${nombreMes(r.mesMasIntenso.mes)}`, r.mesMasIntenso.mes === hoy.slice(0, 7))
    : tarjetaRecord('Mes más intenso', sinDato, 'aún no hay días en nivel 3', false));
  t.push(tarjetaRecord('Total histórico', plural(r.total.dias, 'día', 'días'), `marcados en ${plural(r.total.diasDesdeElPrimero, 'día', 'días')} desde el ${fechaCorta(r.total.primerDia!)}`, false));
  if (r.mejorDiaSemana) t.push(tarjetaRecord('Tu mejor día', DIAS_SEMANA[r.mejorDiaSemana.dia], `${plural(r.mejorDiaSemana.veces, 'vez', 'veces')} · ${r.mejorDiaSemana.porcentaje}% de tus días`, false, true));
  t.push(r.caracteristicaFrecuente
    ? tarjetaRecord('Característica más frecuente', esc(r.caracteristicaFrecuente.nombre), `en ${plural(r.caracteristicaFrecuente.veces, 'día', 'días')}`, false, true)
    : tarjetaRecord('Característica más frecuente', sinDato, 'marca características en tus días', false));

  const filas = r.porCaracteristica.map((c) => {
    const fin = sumarDias(c.lunes, 6);
    const nuevo = esReciente(fin > hoy ? hoy : fin, hoy);
    return `<div class="fila-record"><span class="txt">${esc(c.nombre)}${c.archivada ? ' <span class="tenue">(archivada)</span>' : ''}</span>
      <b>${c.veces}</b><span class="tenue">en la semana ${rango(c.lunes, fin)}</span>${nuevo ? '<em class="etiqueta-nuevo">¡Nuevo!</em>' : ''}</div>`;
  });
  return `
    <p class="titulo-grupo">Récords</p>
    <div class="records">${t.join('')}</div>
    <section class="tarjeta records-caracteristicas">
      <b>Récord semanal por característica</b>
      <span class="tenue">Más veces en una misma semana</span>
      ${filas.length ? filas.join('') : '<p class="tenue">Marca características en tus días para ver estos récords.</p>'}
    </section>`;
}

export function vistaEstadisticas(e: Estado, hoy: Fecha): string {
  const d = e.datos;
  const mes = hoy.slice(0, 7);
  const diasMes = Object.entries(d.dias).filter(([f, dia]) => f.startsWith(mes) && dia.intensidad > 0).length;
  const totalNotas = Object.values(d.dias).reduce((n, dia) => n + dia.notas.filter((x) => x.texto.trim()).length, 0);
  const cifra = (valor: number, etiqueta: string) => `<div class="tarjeta cifra"><b>${valor}</b><span>${etiqueta}</span></div>`;
  return `
    ${cabecera('Estadísticas')}
    <div class="cifras">
      ${cifra(racha(d, hoy), 'Racha actual')}
      ${cifra(diasMes, `Días marcados en ${MESES[Number(mes.slice(5)) - 1]}`)}
      ${cifra(totalNotas, 'Notas en total')}
    </div>
    ${barrasPorSemana(semanasApiladas(d, hoy, e.ui.graficas.semanas), e.ui.graficas.tabla, e.ui.graficas.semanas)}
    ${seccionRecords(d, hoy)}`;
}
