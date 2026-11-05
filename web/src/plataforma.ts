import { Capacitor } from '@capacitor/core';
import type { Plataforma } from './datos/tipos';

/** true dentro de la app Android; false en la web local. */
export const esNativo = Capacitor.isNativePlatform();
export const plataforma: Plataforma = esNativo ? 'android' : 'web';
