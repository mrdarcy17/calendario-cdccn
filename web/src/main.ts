import './estilos.css';
import { AlmacenArchivoLocal } from './almacen';
import { hoy } from './datos/fechas';
import { DriveRest } from './drive/api';
import { SesionGoogle } from './drive/auth';
import { Sincronizador, memoriaLocalStorage } from './drive/sincronizador';
import { Estado } from './estado';
import { iniciarApp } from './ui/app';

const REVISAR_DRIVE_MS = 60_000;

const estado = new Estado(new AlmacenArchivoLocal());
const sesion = new SesionGoogle();
let app: ReturnType<typeof iniciarApp> | null = null;

const sync = new Sincronizador(new DriveRest(() => sesion.token()), sesion, {
  datos: () => estado.datos,
  adoptar: (d) => estado.adoptarRemoto(d),
  elegir: (local, remoto) => app!.elegir(local, remoto),
  hoy: () => hoy(),
}, memoriaLocalStorage);

estado.alCambioLocal = () => sync.cambioLocal();
sesion.precargar();
app = iniciarApp(document.getElementById('app')!, estado, sync);

await estado.cargar();
if (estado.datos) {
  // Al abrir: sube lo pendiente o descarga lo que haya cambiado en Drive.
  void sync.sincronizar();
  setInterval(() => {
    if (document.visibilityState === 'visible') void sync.sincronizar();
  }, REVISAR_DRIVE_MS);
  window.addEventListener('online', () => void sync.sincronizar());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void sync.sincronizar();
  });
}
