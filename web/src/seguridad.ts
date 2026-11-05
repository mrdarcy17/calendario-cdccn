// Modo de acceso y PIN (CU-02, CU-03). Solo existen en el teléfono: nunca se suben a Drive ni se exportan.

export type ModoAcceso = 'libre' | 'protegido';

/** El PIN no se guarda: se guarda su huella (PBKDF2-SHA256 con sal aleatoria). */
export interface HuellaPin {
  sal: string;
  hash: string;
  iteraciones: number;
}

export interface ConfigSeguridad {
  modo: ModoAcceso;
  pin: HuellaPin | null;
  /** Al entrar a la app, abrir el lector de huella sin tener que pulsar su botón. */
  huellaAlEntrar: boolean;
}

export const LARGO_PIN = 4;
/** Primer uso: modo libre (CU-01). */
export const CONFIG_INICIAL: ConfigSeguridad = { modo: 'libre', pin: null, huellaAlEntrar: false };

const ITERACIONES = 150_000;

const aBase64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const deBase64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derivar(pin: string, sal: Uint8Array, iteraciones: number): Promise<Uint8Array> {
  const llave = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: sal as BufferSource, iterations: iteraciones }, llave, 256);
  return new Uint8Array(bits);
}

export function pinValido(pin: string): boolean {
  return new RegExp(`^\\d{${LARGO_PIN}}$`).test(pin);
}

export async function crearHuella(pin: string): Promise<HuellaPin> {
  if (!pinValido(pin)) throw new Error(`El PIN debe tener ${LARGO_PIN} dígitos.`);
  const sal = crypto.getRandomValues(new Uint8Array(16));
  return { sal: aBase64(sal), hash: aBase64(await derivar(pin, sal, ITERACIONES)), iteraciones: ITERACIONES };
}

export async function verificarPin(pin: string, huella: HuellaPin): Promise<boolean> {
  if (!pinValido(pin)) return false;
  const calculado = await derivar(pin, deBase64(huella.sal), huella.iteraciones);
  const guardado = deBase64(huella.hash);
  if (calculado.length !== guardado.length) return false;
  let diferencia = 0;
  for (let i = 0; i < calculado.length; i++) diferencia |= calculado[i] ^ guardado[i];
  return diferencia === 0;
}

/** En modo protegido, salir de la app (o apagar la pantalla) la bloquea: al volver se pide el PIN (CU-02). */
export function debeBloquearAlSalir(config: ConfigSeguridad): boolean {
  return config.modo === 'protegido' && config.pin !== null;
}

/** Valida lo leído del disco; ante cualquier rareza vuelve al modo libre en vez de dejar la app inutilizable. */
export function normalizar(valor: unknown): ConfigSeguridad {
  const v = valor as Partial<ConfigSeguridad> | null;
  const pin = v?.pin;
  const pinOk = pin && typeof pin.sal === 'string' && typeof pin.hash === 'string' && Number.isInteger(pin.iteraciones) && pin.iteraciones > 0;
  if (v?.modo === 'protegido' && pinOk) return { modo: 'protegido', pin, huellaAlEntrar: v.huellaAlEntrar === true };
  return { ...CONFIG_INICIAL };
}

export interface AlmacenSeguridad {
  leer(): Promise<ConfigSeguridad>;
  escribir(config: ConfigSeguridad): Promise<void>;
}

/** Archivo privado de la app en el teléfono. */
export class AlmacenSeguridadNativo implements AlmacenSeguridad {
  private static ARCHIVO = 'seguridad.json';

  async leer(): Promise<ConfigSeguridad> {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
    try {
      const { data } = await Filesystem.readFile({ path: AlmacenSeguridadNativo.ARCHIVO, directory: Directory.Data, encoding: Encoding.UTF8 });
      return normalizar(JSON.parse(data as string));
    } catch {
      return { ...CONFIG_INICIAL };
    }
  }

  async escribir(config: ConfigSeguridad): Promise<void> {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
    const ruta = AlmacenSeguridadNativo.ARCHIVO;
    await Filesystem.writeFile({ path: `${ruta}.tmp`, directory: Directory.Data, encoding: Encoding.UTF8, data: JSON.stringify(config) });
    await Filesystem.rename({ from: `${ruta}.tmp`, to: ruta, directory: Directory.Data, toDirectory: Directory.Data });
  }
}
