import { MESES, fechaLarga, sumarDias } from '../datos/fechas';
import { buscar, caracteristicaEnUso, etiquetaEnUso, racha } from '../datos/operaciones';
import type { Datos, Fecha } from '../datos/tipos';
import type { Sincronizador } from '../drive/sincronizador';
import type { Estado } from '../estado';
import { filaDrive } from './drive';
import { esNativo } from '../plataforma';
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
    <p class="nota-pie-vista">${esNativo ? 'PIN, huella y modo de acceso: próximamente.' : 'El PIN y el modo de acceso solo existen en la app Android.'}</p>`;
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

function rachaMasLarga(datos: Datos): number {
  const fechas = Object.keys(datos.dias).filter((f) => datos.dias[f].intensidad > 0).sort();
  let mejor = 0;
  let actual = 0;
  let anterior: Fecha | null = null;
  for (const f of fechas) {
    actual = anterior && sumarDias(anterior, 1) === f ? actual + 1 : 1;
    mejor = Math.max(mejor, actual);
    anterior = f;
  }
  return mejor;
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
      ${cifra(rachaMasLarga(d), 'Racha más larga')}
      ${cifra(diasMes, `Días marcados en ${MESES[Number(mes.slice(5)) - 1]}`)}
      ${cifra(totalNotas, 'Notas en total')}
    </div>
    <section class="tarjeta proximamente">
      ${icono('estadisticas')}
      <b>Gráficas en definición</b>
      <span>La gráfica lineal de intensidad y la de radar de características llegarán en una próxima versión (CU-12).</span>
    </section>`;
}
