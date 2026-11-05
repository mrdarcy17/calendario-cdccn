import { registerPlugin } from '@capacitor/core';

/** Plugin nativo BiometriaPlugin.java (solo Android). */
interface BiometriaPlugin {
  disponible(): Promise<{ disponible: boolean }>;
  autenticar(): Promise<void>;
}

export const Biometria = registerPlugin<BiometriaPlugin>('Biometria');

/** true si el teléfono tiene huella registrada; si no, el botón de huella no se muestra (CU-02, 1a). */
export async function huellaDisponible(): Promise<boolean> {
  try {
    return (await Biometria.disponible()).disponible;
  } catch {
    return false;
  }
}
