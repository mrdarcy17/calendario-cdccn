import { registerPlugin } from '@capacitor/core';

/** Plugin nativo WidgetsPlugin.java (solo Android). */
interface WidgetsPlugin {
  actualizar(): Promise<void>;
  consumirCambios(): Promise<{ hubo: boolean; versionSubida?: string | null }>;
}

const Widgets = registerPlugin<WidgetsPlugin>('Widgets');

/** Redibuja los widgets tras guardar. */
export function actualizarWidgets(): void {
  void Widgets.actualizar().catch(() => {});
}

/**
 * ¿Algún widget cambió el archivo de datos desde la última revisión?
 * versionSubida: si la subida en segundo plano ya llevó ese mismo archivo a Drive, su versión.
 */
export async function cambiosDeWidgets(): Promise<{ hubo: boolean; versionSubida: string | null }> {
  try {
    const r = await Widgets.consumirCambios();
    return { hubo: r.hubo, versionSubida: r.versionSubida || null };
  } catch {
    return { hubo: false, versionSubida: null };
  }
}

/** Le deja a la parte nativa (subida en segundo plano) el estado de Drive: solo la app sabe si está conectado. */
export async function compartirEstadoDrive(estado: { conectado: boolean; archivoId: string | null; version: string | null }): Promise<void> {
  try {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
    await Filesystem.writeFile({ path: 'drive-estado.json', directory: Directory.Data, encoding: Encoding.UTF8, data: JSON.stringify(estado) });
  } catch {
    // sin acceso al archivo: la subida en segundo plano simplemente no ocurre
  }
}
