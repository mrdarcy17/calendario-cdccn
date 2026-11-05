import './estilos.css';
import { AlmacenArchivoLocal, AlmacenNativo } from './almacen';
import { hoy } from './datos/fechas';
import { DriveRest } from './drive/api';
import { SesionGoogle } from './drive/auth';
import { SesionAndroid } from './drive/auth-android';
import { Sincronizador, memoriaLocalStorage } from './drive/sincronizador';
import { Estado } from './estado';
import { esNativo, plataforma } from './plataforma';
import { huellaDisponible } from './biometria';
import { AlmacenSeguridadNativo } from './seguridad';
import { huboCambiosDeWidgets } from './widgets';
import { iniciarApp } from './ui/app';

const REVISAR_DRIVE_MS = 60_000;

// En el teléfono la copia local vive en los archivos de la app; en la PC, en web/datos/ vía el servidor local.
const estado = new Estado(esNativo ? new AlmacenNativo() : new AlmacenArchivoLocal(), plataforma);
// En la web: inicio de sesión de Google en el navegador. En Android: inicio de sesión nativo.
const sesionWeb = esNativo ? null : new SesionGoogle();
const sesion = sesionWeb ?? new SesionAndroid();
let app: ReturnType<typeof iniciarApp> | null = null;

const sync = new Sincronizador(new DriveRest(() => sesion.token()), sesion, {
  datos: () => estado.datos,
  adoptar: (d) => estado.adoptarRemoto(d),
  elegir: (local, remoto) => app!.elegir(local, remoto),
  hoy: () => hoy(),
}, memoriaLocalStorage);

estado.alCambioLocal = () => sync.cambioLocal();
sesionWeb?.precargar();
// Modo de acceso (solo Android): se lee antes de dibujar nada, para que el calendario no se vea si hay PIN.
const almacenSeguridad = esNativo ? new AlmacenSeguridadNativo() : null;
if (almacenSeguridad) {
  const [seguridad, huella] = await Promise.all([almacenSeguridad.leer(), huellaDisponible()]);
  estado.ui.seguridad = seguridad;
  estado.ui.bloqueo.activo = seguridad.modo === 'protegido';
  estado.ui.huellaDisponible = huella;
}

app = iniciarApp(document.getElementById('app')!, estado, sync, almacenSeguridad);

await estado.cargar();

// Widgets (Android): lo que marcaron o escribieron mientras la app estaba cerrada se sube a Drive.
// estado.cargar() ya leyó el archivo actualizado; solo falta avisar al sincronizador.
if (esNativo && estado.datos && (await huboCambiosDeWidgets())) sync.cambioLocal();
if (esNativo) {
  const { App } = await import('@capacitor/app');
  App.addListener('resume', async () => {
    if (!(await huboCambiosDeWidgets())) return;
    await estado.recargar();
    sync.cambioLocal();
  });
}

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
