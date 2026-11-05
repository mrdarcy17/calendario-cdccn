import type { Sincronizador } from '../drive/sincronizador.ts';
import type { ResumenDatos, UI } from '../estado.ts';
import { esc } from './html.ts';
import { icono } from './iconos.ts';

export function haceCuanto(iso: string | null): string {
  if (!iso) return 'nunca';
  const seg = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seg < 60) return 'hace unos segundos';
  const min = Math.round(seg / 60);
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  return new Date(iso).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
}

/** Indicador compacto junto a "Guardado". Devuelve [texto, clase, acción]. */
export function indicadorDrive(s: Sincronizador): [string, string, string] {
  switch (s.estado) {
    case 'apagado':
      return ['', '', ''];
    case 'conectando':
      return ['Drive: conectando…', '', ''];
    case 'sincronizando':
      return ['Drive: sincronizando…', '', ''];
    case 'al-dia':
      return ['Drive', 'ok', ''];
    case 'pendiente':
      return ['Drive: pendiente', '', ''];
    case 'sin-internet':
      return ['Drive: sin internet', 'aviso', 'drive-sincronizar'];
    case 'reconectar':
      return ['Drive: reconectar', 'aviso', 'drive-reconectar'];
    case 'error':
      return ['Drive: error', 'error', 'drive-sincronizar'];
  }
}

/** Contenido de la fila "Google Drive" en Ajustes. */
export function filaDrive(s: Sincronizador): string {
  const boton = (accion: string, texto: string, principal = false) =>
    `<button class="${principal ? 'btn-chico' : 'btn-texto'}" data-accion="${accion}">${texto}</button>`;
  let detalle = '';
  let botones = '';
  switch (s.estado) {
    case 'apagado':
      detalle = 'Sin conectar · tus datos solo están en esta PC';
      botones = boton('drive-conectar', 'Conectar', true);
      break;
    case 'conectando':
      detalle = 'Conectando… revisa la ventana de Google';
      break;
    case 'reconectar':
      detalle = `La sesión de Google venció${s.pendiente ? ' · hay cambios por subir' : ''}`;
      botones = boton('drive-reconectar', 'Reconectar', true) + boton('drive-desconectar', 'Desconectar');
      break;
    case 'error':
      detalle = esc(s.error ?? 'Error desconocido');
      botones = boton('drive-sincronizar', 'Reintentar', true) + boton('drive-desconectar', 'Desconectar');
      break;
    default:
      detalle =
        s.estado === 'sincronizando'
          ? 'Sincronizando…'
          : s.estado === 'sin-internet'
            ? 'Sin internet · los cambios se subirán al volver la conexión'
            : s.estado === 'pendiente'
              ? 'Cambios por subir…'
              : `Sincronizado ${haceCuanto(s.ultimaSync)}`;
      botones = boton('drive-sincronizar', 'Sincronizar ahora') + boton('drive-desconectar', 'Desconectar');
  }
  return `
    <span class="ico verde">${icono('nube')}</span>
    <div class="txt"><b>Google Drive</b><span>${detalle}</span><span class="ruta">Mi unidad › cdccn › cdccn-datos.json</span></div>
    <div class="botones-fila">${botones}</div>`;
}

function tarjetaResumen(titulo: string, r: ResumenDatos, opcion: string, ic: string): string {
  return `
    <button class="opcion-eleccion" data-accion="elegir-drive" data-opcion="${opcion}">
      <span class="ico">${icono(ic)}</span>
      <b>${titulo}</b>
      <span>${r.dias} días con datos · ${r.notas} notas</span>
      <span class="tenue">Último cambio: ${esc(new Date(r.modificado).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }))} (${r.modificadoPor === 'android' ? 'teléfono' : 'web'})</span>
    </button>`;
}

/** Diálogo de la primera conexión cuando Drive y la PC tienen datos distintos. */
export function dialogoEleccion(ui: UI): string {
  const e = ui.eleccionDrive;
  if (!e) return '';
  return `
    <div class="velo-dialogo"></div>
    <div class="dialogo" role="dialog" aria-modal="true" aria-labelledby="titulo-eleccion">
      <h2 id="titulo-eleccion">Ya hay datos en Google Drive</h2>
      <p>Los datos de Drive y los de esta PC son distintos. Elige cuáles conservar; los otros se reemplazarán.</p>
      <div class="opciones-eleccion">
        ${tarjetaResumen('Usar los de Drive', e.remoto, 'drive', 'nube')}
        ${tarjetaResumen('Usar los de esta PC', e.local, 'pc', 'archivo')}
      </div>
      <p class="tenue">Si no estás seguro, cancela, exporta un respaldo en Ajustes → Exportar datos y vuelve a conectar.</p>
      <button class="btn-texto" data-accion="elegir-drive" data-opcion="cancelar">Cancelar y no conectar</button>
    </div>`;
}
