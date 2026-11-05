// Sesión de Google en la app Android, a través del plugin nativo GoogleDrivePlugin.java.
// A diferencia de la web, después de la primera autorización el token se renueva sin pedir nada.

import { registerPlugin } from '@capacitor/core';
import type { Sesion } from './sincronizador.ts';

interface GoogleDrivePlugin {
  autorizar(opciones: { interactivo: boolean }): Promise<{ accessToken: string }>;
  olvidarToken(opciones: { token: string }): Promise<void>;
}

const GoogleDrive = registerPlugin<GoogleDrivePlugin>('GoogleDrive');

/** Los tokens de Google duran ~1 h; se renuevan un poco antes. */
const VIGENCIA_MS = 50 * 60_000;

export class SesionAndroid implements Sesion {
  private actual: { token: string; obtenido: number } | null = null;

  token(): string | null {
    if (!this.actual || Date.now() - this.actual.obtenido > VIGENCIA_MS) return null;
    return this.actual.token;
  }

  private guardar(token: string): string {
    this.actual = { token, obtenido: Date.now() };
    return token;
  }

  async iniciar(): Promise<string> {
    const { accessToken } = await GoogleDrive.autorizar({ interactivo: true });
    return this.guardar(accessToken);
  }

  /** Token nuevo sin mostrar nada; null si Google necesita que el usuario vuelva a autorizar. */
  async renovar(forzar = false): Promise<string | null> {
    if (forzar && this.actual) {
      await GoogleDrive.olvidarToken({ token: this.actual.token }).catch(() => {});
      this.actual = null;
    }
    try {
      const { accessToken } = await GoogleDrive.autorizar({ interactivo: false });
      return this.guardar(accessToken);
    } catch {
      return null;
    }
  }

  cerrar() {
    if (this.actual) void GoogleDrive.olvidarToken({ token: this.actual.token }).catch(() => {});
    this.actual = null;
  }
}
