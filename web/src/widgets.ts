import { registerPlugin } from '@capacitor/core';

/** Plugin nativo WidgetsPlugin.java (solo Android). */
interface WidgetsPlugin {
  actualizar(): Promise<void>;
  consumirCambios(): Promise<{ hubo: boolean }>;
}

const Widgets = registerPlugin<WidgetsPlugin>('Widgets');

/** Redibuja el widget "Marcar día" tras guardar. */
export function actualizarWidgets(): void {
  void Widgets.actualizar().catch(() => {});
}

/** true si algún widget cambió el archivo de datos desde la última revisión. */
export async function huboCambiosDeWidgets(): Promise<boolean> {
  try {
    return (await Widgets.consumirCambios()).hubo;
  } catch {
    return false;
  }
}
