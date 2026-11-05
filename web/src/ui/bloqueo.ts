// Pantalla de bloqueo (CU-02) y creación de PIN (CU-03). Solo en la app Android.

import { LARGO_PIN } from '../seguridad.ts';
import type { UI } from '../estado.ts';
import { clases, esc } from './html.ts';
import { icono } from './iconos.ts';

/** Símbolo ⎎ de Sarger (contorno de Noto Sans Symbols Bold, licencia OFL). */
export function logoSarger(clase = ''): string {
  return `<svg class="logo-sarger ${clase}" viewBox="30 30 48 48" aria-hidden="true"><path fill="currentColor" d="M35.76 76V72.12Q38.41 71.19 39.58 69.28Q40.75 67.37 40.75 64.29V43.28Q40.75 38.1 43.59 35.05Q46.42 32 51.29 32H72.24V35.88Q69.59 36.81 68.42 38.72Q67.25 40.63 67.25 43.65V64.72Q67.25 69.9 64.45 72.95Q61.64 76 56.77 76ZM46.48 69.28H56.77Q58.5 69.28 59.52 68.11Q60.53 66.94 60.53 64.72V43.65Q60.53 40.57 61.52 38.84V38.72H51.29Q49.5 38.72 48.52 39.92Q47.53 41.12 47.53 43.28V64.29Q47.53 67.37 46.48 69.16Z"/></svg>`;
}

function puntos(largo: number, error: boolean): string {
  let html = '';
  for (let i = 0; i < LARGO_PIN; i++) html += `<i class="${i < largo ? 'lleno' : ''}"></i>`;
  return `<div class="${clases('puntos-pin', error && 'error')}" aria-label="${largo} de ${LARGO_PIN} dígitos">${html}</div>`;
}

/** Teclado numérico; la tecla de abajo a la izquierda cambia según la pantalla. */
function teclado(teclaIzquierda: string): string {
  const tecla = (d: string) => `<button class="tecla" data-accion="pin-digito" data-d="${d}" aria-label="${d}">${d}</button>`;
  return `
    <div class="teclado">
      ${['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(tecla).join('')}
      ${teclaIzquierda}
      ${tecla('0')}
      <button class="tecla fantasma" data-accion="pin-borrar" aria-label="Borrar">${icono('retroceso')}</button>
    </div>`;
}

export function pantallaBloqueo(ui: UI): string {
  const { pin, error } = ui.bloqueo;
  const huella = ui.huellaDisponible
    ? `<button class="tecla huella" data-accion="pin-huella" aria-label="Usar huella">${icono('huella')}</button>`
    : '<span class="tecla vacia"></span>';
  return `
    <div class="pantalla-pin" role="dialog" aria-modal="true" aria-label="Desbloquear">
      <div class="logo-caja">${logoSarger()}</div>
      <h1>Sarger</h1>
      <p>Ingresa tu PIN</p>
      ${puntos(pin.length, Boolean(error))}
      <p class="error-pin" role="alert">${error ? esc(error) : ''}</p>
      ${teclado(huella)}
    </div>`;
}

export function pantallaCrearPin(ui: UI): string {
  const c = ui.crearPin;
  if (!c) return '';
  const titulo = c.paso === 1 ? (c.motivo === 'cambiar' ? 'Escribe tu nuevo PIN' : `Crea un PIN de ${LARGO_PIN} dígitos`) : 'Confirma tu PIN';
  const ayuda = c.paso === 1 ? 'Lo pedirá la app al abrirse en modo protegido' : 'Escríbelo otra vez para evitar errores';
  return `
    <div class="pantalla-pin creando" role="dialog" aria-modal="true" aria-label="${esc(titulo)}">
      <div class="logo-caja">${logoSarger()}</div>
      <h1>${esc(titulo)}</h1>
      <p>${ayuda}</p>
      ${puntos(c.pin.length, Boolean(c.error))}
      <p class="error-pin" role="alert">${c.error ? esc(c.error) : ''}</p>
      ${teclado('<button class="tecla texto" data-accion="pin-cancelar">Cancelar</button>')}
    </div>`;
}
