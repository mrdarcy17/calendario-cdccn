// Gráfica de barras apiladas por semana (CU-12): días marcados de cada semana, apilados por intensidad.
// Sigue la guía de visualización: barras <= 24 px con punta redondeada y base recta, 2 px de separación
// entre niveles, rejilla tenue, leyenda siempre visible, detalle al pasar el dedo y vista de tabla.

import { MESES_CORTOS, deFecha, fechaLarga, sumarDias } from '../datos/fechas';
import type { Semana } from '../datos/estadisticas';
import { esc } from './html';

const NIVELES = [
  { clave: 'n1', nombre: 'Nivel 1', color: 'var(--i1)' },
  { clave: 'n2', nombre: 'Nivel 2', color: 'var(--i2)' },
  { clave: 'n3', nombre: 'Nivel 3', color: 'var(--i3)' },
] as const;

/** Rectángulo con las esquinas de arriba redondeadas (punta) y la base recta. */
function puntaRedondeada(x: number, y: number, ancho: number, alto: number, r: number): string {
  const rr = Math.min(r, alto, ancho / 2);
  return `M${x},${y + alto}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + ancho - rr}Q${x + ancho},${y} ${x + ancho},${y + rr}V${y + alto}Z`;
}

export function rangoSemana(s: Semana): string {
  const fin = sumarDias(s.lunes, 6);
  const a = deFecha(s.lunes);
  const b = deFecha(fin);
  return a.getMonth() === b.getMonth()
    ? `${a.getDate()}–${b.getDate()} ${MESES_CORTOS[a.getMonth()]}`
    : `${a.getDate()} ${MESES_CORTOS[a.getMonth()]} – ${b.getDate()} ${MESES_CORTOS[b.getMonth()]}`;
}

export function detalleSemana(s: Semana): string {
  const partes = NIVELES.filter((n) => s[n.clave] > 0).map((n) => `${n.nombre.toLowerCase()}: ${s[n.clave]}`);
  return `Semana ${rangoSemana(s)}${s.enCurso ? ' (en curso)' : ''} · ${s.total} ${s.total === 1 ? 'día' : 'días'}${partes.length ? ' · ' + partes.join(', ') : ''}`;
}

export function barrasPorSemana(semanas: Semana[], verTabla: boolean, periodo: number): string {
  const ANCHO = 360;
  const ALTO = 200;
  const izq = 22; // espacio para las marcas del eje Y
  const abajo = 22; // espacio para los meses
  const arriba = 8;
  const altoPlot = ALTO - abajo - arriba;
  const escala = (dias: number) => (dias / 7) * altoPlot;
  const ranura = (ANCHO - izq) / semanas.length;
  const anchoBarra = Math.min(24, Math.max(3, ranura * 0.62));
  const SEPARACION = 2;

  let rejilla = '';
  for (const v of [0, 2, 4, 6]) {
    const y = arriba + altoPlot - escala(v);
    rejilla += `<line x1="${izq}" x2="${ANCHO}" y1="${y}" y2="${y}" class="rejilla${v === 0 ? ' base' : ''}"/>`;
    rejilla += `<text x="${izq - 6}" y="${y + 3.5}" class="marca-y">${v}</text>`;
  }

  let barras = '';
  let meses = '';
  semanas.forEach((s, i) => {
    const xCentro = izq + ranura * (i + 0.5);
    const x = xCentro - anchoBarra / 2;
    // Mes debajo de la semana que contiene el día 1.
    for (let d = 0; d < 7; d++) {
      const f = sumarDias(s.lunes, d);
      if (f.endsWith('-01')) meses += `<text x="${xCentro}" y="${ALTO - 6}" class="marca-x">${MESES_CORTOS[deFecha(f).getMonth()]}</text>`;
    }
    // Segmentos de abajo hacia arriba: nivel 1, 2 y 3; solo el de hasta arriba lleva la punta redondeada.
    const visibles = NIVELES.filter((n) => s[n.clave] > 0);
    let base = arriba + altoPlot;
    let segmentos = '';
    visibles.forEach((n, k) => {
      const alto = escala(s[n.clave]) - (k > 0 ? SEPARACION : 0);
      const y = base - alto - (k > 0 ? SEPARACION : 0);
      const ultimo = k === visibles.length - 1;
      segmentos += ultimo
        ? `<path d="${puntaRedondeada(x, y, anchoBarra, alto, 4)}" fill="${n.color}"/>`
        : `<rect x="${x}" y="${y}" width="${anchoBarra}" height="${alto}" fill="${n.color}"/>`;
      base = y;
    });
    // Zona de toque más grande que la barra: toda la ranura y todo el alto.
    barras += `<g class="barra${s.enCurso ? ' en-curso' : ''}" data-barra="${esc(detalleSemana(s))}" tabindex="0" role="img" aria-label="${esc(detalleSemana(s))}">
      <rect x="${izq + ranura * i}" y="${arriba}" width="${ranura}" height="${altoPlot}" class="zona"/>${segmentos}</g>`;
  });

  const leyenda = NIVELES.map((n) => `<span class="clave"><i style="background:${n.color}"></i>${n.nombre}</span>`).join('');
  const opciones = [12, 26, 52]
    .map((p) => `<button class="${p === periodo ? 'on' : ''}" data-accion="periodo-grafica" data-semanas="${p}" aria-pressed="${p === periodo}">${p} sem</button>`)
    .join('');
  const totalDias = semanas.reduce((n, s) => n + s.total, 0);

  const tabla = `
    <table class="tabla-grafica">
      <thead><tr><th>Semana</th><th>Nivel 1</th><th>Nivel 2</th><th>Nivel 3</th><th>Total</th></tr></thead>
      <tbody>${[...semanas]
        .reverse()
        .map((s) => `<tr><td>${rangoSemana(s)}${s.enCurso ? ' ·' : ''}</td><td>${s.n1}</td><td>${s.n2}</td><td>${s.n3}</td><td><b>${s.total}</b></td></tr>`)
        .join('')}</tbody>
    </table>`;

  return `
    <section class="tarjeta grafica">
      <div class="grafica-cabecera">
        <div><b>Días marcados por semana</b><span>${totalDias} ${totalDias === 1 ? 'día' : 'días'} en ${periodo} semanas · desde el ${fechaLarga(semanas[0].lunes).split(', ')[1]}</span></div>
      </div>
      <div class="filtros-grafica">
        <div class="segmento chico" role="group" aria-label="Periodo">${opciones}</div>
        <button class="btn-texto" data-accion="tabla-grafica" aria-pressed="${verTabla}">${verTabla ? 'Ver gráfica' : 'Ver tabla'}</button>
      </div>
      ${
        verTabla
          ? tabla
          : `<div class="lienzo-grafica">
              <svg viewBox="0 0 ${ANCHO} ${ALTO}" class="svg-grafica" role="group" aria-label="Barras apiladas: días marcados por semana según intensidad">
                ${rejilla}${barras}${meses}
              </svg>
              <div class="tooltip-grafica" id="tooltip-grafica" hidden></div>
            </div>
            <div class="leyenda-grafica">${leyenda}</div>`
      }
    </section>`;
}
