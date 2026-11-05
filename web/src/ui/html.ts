/** Escapa texto para insertarlo en HTML o en atributos. */
export function esc(valor: unknown): string {
  return String(valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Clases condicionales: clases('a', cond && 'b') → "a b". */
export function clases(...lista: (string | false | null | undefined)[]): string {
  return lista.filter(Boolean).join(' ');
}
