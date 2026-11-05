import { beforeEach, describe, expect, it } from 'vitest';
import * as op from '../../datos/operaciones.ts';
import type { Datos } from '../../datos/tipos.ts';
import { ErrorDrive, type ArchivoRemoto, type Remoto } from '../api.ts';
import { Sincronizador, type AlmacenMemoria, type MemoriaDrive, type Puente, type Sesion } from '../sincronizador.ts';

const HOY = '2026-11-04';

class DriveFalso implements Remoto {
  archivo: { id: string; contenido: string; version: number } | null = null;
  caido = false;
  vencido = false;
  subidas = 0;

  private revisar() {
    if (this.caido) throw new ErrorDrive(0, 'sin internet');
    if (this.vencido) throw new ErrorDrive(401, 'token vencido');
  }
  async localizar() {
    this.revisar();
    return this.archivo ? { id: this.archivo.id, version: String(this.archivo.version) } : null;
  }
  async version(id: string) {
    this.revisar();
    return this.archivo?.id === id ? String(this.archivo.version) : null;
  }
  async descargar(id: string) {
    this.revisar();
    if (this.archivo?.id !== id) throw new ErrorDrive(404, 'no existe');
    return { contenido: JSON.parse(this.archivo.contenido), version: String(this.archivo.version) };
  }
  async crear(contenido: string): Promise<ArchivoRemoto> {
    this.revisar();
    this.subidas++;
    this.archivo = { id: `id${Math.random()}`, contenido, version: 1 };
    return { id: this.archivo.id, version: '1' };
  }
  async actualizar(id: string, contenido: string): Promise<ArchivoRemoto> {
    this.revisar();
    if (this.archivo?.id !== id) throw new ErrorDrive(404, 'no existe');
    this.subidas++;
    this.archivo.contenido = contenido;
    this.archivo.version++;
    return { id, version: String(this.archivo.version) };
  }
  /** Simula que otro dispositivo (el teléfono) subió datos. */
  escribirDesdeOtro(d: Datos) {
    this.archivo!.contenido = JSON.stringify(d);
    this.archivo!.version++;
  }
  datos(): Datos {
    return JSON.parse(this.archivo!.contenido);
  }
}

class SesionFalsa implements Sesion {
  t: string | null = null;
  token() {
    return this.t;
  }
  async iniciar() {
    this.t = 'token';
    return this.t;
  }
  cerrar() {
    this.t = null;
  }
}

class MemoriaFalsa implements AlmacenMemoria {
  m: MemoriaDrive | null = null;
  leer() {
    return this.m;
  }
  escribir(m: MemoriaDrive) {
    this.m = { ...m };
  }
}

let drive: DriveFalso;
let sesion: SesionFalsa;
let memoria: MemoriaFalsa;
let local: Datos;
let eleccion: 'drive' | 'pc' | null;
let preguntas: number;
let sync: Sincronizador;

const puente: Puente = {
  datos: () => local,
  adoptar: (d) => (local = structuredClone(d)),
  elegir: async () => {
    preguntas++;
    return eleccion;
  },
  hoy: () => HOY,
};

const nuevo = () => new Sincronizador(drive, sesion, puente, memoria, 0);

beforeEach(() => {
  drive = new DriveFalso();
  sesion = new SesionFalsa();
  memoria = new MemoriaFalsa();
  local = op.datosIniciales(new Date(2026, 10, 4, 12));
  eleccion = 'drive';
  preguntas = 0;
  sync = nuevo();
});

describe('primera conexión', () => {
  it('si Drive está vacío, sube los datos de la PC', async () => {
    op.ciclarIntensidad(local, HOY, HOY);
    await sync.conectar();
    expect(sync.estado).toBe('al-dia');
    expect(drive.datos().dias[HOY].intensidad).toBe(1);
    expect(memoria.m?.conectado).toBe(true);
  });

  it('si ambos tienen lo mismo, no pregunta', async () => {
    drive.archivo = { id: 'a', contenido: JSON.stringify(local), version: 5 };
    await sync.conectar();
    expect(preguntas).toBe(0);
    expect(memoria.m?.version).toBe('5');
  });

  it('si son distintos y eliges Drive, reemplaza los de la PC', async () => {
    const remoto = structuredClone(local);
    op.ciclarIntensidad(remoto, HOY, HOY);
    drive.archivo = { id: 'a', contenido: JSON.stringify(remoto), version: 2 };
    eleccion = 'drive';
    await sync.conectar();
    expect(preguntas).toBe(1);
    expect(local.dias[HOY].intensidad).toBe(1);
  });

  it('si eliges la PC, reemplaza los de Drive', async () => {
    const remoto = structuredClone(local);
    op.ciclarIntensidad(remoto, HOY, HOY);
    drive.archivo = { id: 'a', contenido: JSON.stringify(remoto), version: 2 };
    eleccion = 'pc';
    await sync.conectar();
    expect(drive.datos().dias[HOY]).toBeUndefined();
    expect(memoria.m?.version).toBe('3');
  });

  it('si cancelas, no se conecta ni cambia nada', async () => {
    const remoto = structuredClone(local);
    op.ciclarIntensidad(remoto, HOY, HOY);
    drive.archivo = { id: 'a', contenido: JSON.stringify(remoto), version: 2 };
    eleccion = null;
    await sync.conectar();
    expect(sync.estado).toBe('apagado');
    expect(sync.conectado).toBe(false);
    expect(drive.archivo.version).toBe(2);
  });

  it('rechaza un archivo de Drive inválido sin tocar nada', async () => {
    drive.archivo = { id: 'a', contenido: JSON.stringify({ hola: 1 }), version: 1 };
    await expect(sync.conectar()).rejects.toThrow('no es válido');
    expect(sync.conectado).toBe(false);
    expect(drive.archivo.contenido).toBe('{"hola":1}');
  });
});

describe('uso normal', () => {
  beforeEach(async () => {
    await sync.conectar();
  });

  it('un cambio local se sube', async () => {
    op.ciclarIntensidad(local, HOY, HOY);
    sync.cambioLocal();
    expect(sync.estado).toBe('pendiente');
    await sync.sincronizar();
    expect(sync.estado).toBe('al-dia');
    expect(drive.datos().dias[HOY].intensidad).toBe(1);
  });

  it('un cambio del teléfono se descarga si no hay pendientes', async () => {
    const delTelefono = structuredClone(local);
    op.agregarNota(delTelefono, HOY, 'desde el teléfono', [], HOY);
    drive.escribirDesdeOtro(delTelefono);
    await sync.sincronizar();
    expect(local.dias[HOY].notas[0].texto).toBe('desde el teléfono');
  });

  it('sin cambios en Drive no descarga ni sube', async () => {
    const subidas = drive.subidas;
    const antes = local;
    await sync.sincronizar();
    expect(local).toBe(antes);
    expect(drive.subidas).toBe(subidas);
  });

  it('forma simple: si hay cambios locales, gana la subida local', async () => {
    const delTelefono = structuredClone(local);
    op.agregarNota(delTelefono, HOY, 'desde el teléfono', [], HOY);
    drive.escribirDesdeOtro(delTelefono);
    op.ciclarIntensidad(local, HOY, HOY);
    sync.cambioLocal();
    await sync.sincronizar();
    expect(drive.datos().dias[HOY].intensidad).toBe(1);
    expect(drive.datos().dias[HOY].notas).toHaveLength(0);
  });

  it('sin internet queda pendiente y sube al volver', async () => {
    drive.caido = true;
    op.ciclarIntensidad(local, HOY, HOY);
    sync.cambioLocal();
    await sync.sincronizar();
    expect(sync.estado).toBe('sin-internet');
    expect(memoria.m?.pendiente).toBe(true);
    drive.caido = false;
    await sync.sincronizar();
    expect(sync.estado).toBe('al-dia');
    expect(drive.datos().dias[HOY].intensidad).toBe(1);
  });

  it('pendientes sobreviven a recargar la página', async () => {
    drive.caido = true;
    op.ciclarIntensidad(local, HOY, HOY);
    sync.cambioLocal();
    await sync.sincronizar();
    drive.caido = false;
    const otraVez = nuevo(); // recarga: misma memoria y sesión
    expect(otraVez.pendiente).toBe(true);
    await otraVez.sincronizar();
    expect(drive.datos().dias[HOY].intensidad).toBe(1);
  });

  it('token vencido pide reconectar y después sube', async () => {
    sesion.t = null;
    op.ciclarIntensidad(local, HOY, HOY);
    sync.cambioLocal();
    await sync.sincronizar();
    expect(sync.estado).toBe('reconectar');
    await sync.reconectar();
    expect(sync.estado).toBe('al-dia');
    expect(drive.datos().dias[HOY].intensidad).toBe(1);
  });

  it('error 401 de Drive pide reconectar', async () => {
    drive.vencido = true;
    await sync.sincronizar();
    expect(sync.estado).toBe('reconectar');
  });

  it('si borraron el archivo en Drive, lo vuelve a crear', async () => {
    drive.archivo = null;
    await sync.sincronizar();
    expect(drive.archivo).not.toBeNull();
    expect(sync.estado).toBe('al-dia');
  });

  it('no adopta un archivo inválido subido por otro', async () => {
    drive.archivo!.contenido = '{"roto":true}';
    drive.archivo!.version++;
    const antes = local;
    await sync.sincronizar();
    expect(sync.estado).toBe('error');
    expect(local).toBe(antes);
  });

  it('desconectar olvida la conexión pero deja el archivo en Drive', async () => {
    sync.desconectar();
    expect(sync.estado).toBe('apagado');
    expect(memoria.m?.conectado).toBe(false);
    expect(drive.archivo).not.toBeNull();
  });
});

describe('Android: renovación del token sin molestar al usuario', () => {
  class SesionAndroidFalsa extends SesionFalsa {
    renovaciones = 0;
    puedeRenovar = true;
    async renovar() {
      this.renovaciones++;
      this.t = this.puedeRenovar ? `token${this.renovaciones}` : null;
      return this.t;
    }
  }
  let android: SesionAndroidFalsa;

  beforeEach(async () => {
    android = new SesionAndroidFalsa();
    sesion = android;
    sync = nuevo();
    await sync.conectar();
  });

  it('al abrir la app sin token, lo renueva solo y sincroniza', async () => {
    android.t = null; // la app se cerró: el token vivía en memoria
    sync = nuevo();
    expect(sync.estado).toBe('al-dia'); // no muestra "reconectar" al arrancar
    op.ciclarIntensidad(local, HOY, HOY);
    sync.cambioLocal();
    await sync.sincronizar();
    expect(android.renovaciones).toBe(1);
    expect(sync.estado).toBe('al-dia');
    expect(drive.datos().dias[HOY].intensidad).toBe(1);
  });

  it('si Google rechaza el token (401), pide otro y reintenta una vez', async () => {
    let rechazos = 1;
    const original = drive.version.bind(drive);
    drive.version = async (id: string) => {
      if (rechazos-- > 0) throw new ErrorDrive(401, 'token vencido');
      return original(id);
    };
    await sync.sincronizar();
    expect(android.renovaciones).toBe(1);
    expect(sync.estado).toBe('al-dia');
  });

  it('si Google pide volver a autorizar, muestra "reconectar"', async () => {
    android.t = null;
    android.puedeRenovar = false;
    await sync.sincronizar();
    expect(sync.estado).toBe('reconectar');
  });
});
