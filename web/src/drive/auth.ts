// Inicio de sesión con Google Identity Services (modelo de token, sin servidor).
// El token dura ~1 hora; se guarda en el navegador para no pedirlo en cada recarga.

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const PERMISO = 'https://www.googleapis.com/auth/drive.file';
const CLAVE = 'cdccn.drive.token';
const MARGEN_MS = 60_000;

interface RespuestaToken {
  access_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
}
interface ClienteToken {
  requestAccessToken(opciones?: { prompt?: string }): void;
}
declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(config: {
            client_id: string;
            scope: string;
            callback: (r: RespuestaToken) => void;
            error_callback?: (e: { type: string; message?: string }) => void;
          }): ClienteToken;
          revoke(token: string, hecho?: () => void): void;
          hasGrantedAllScopes(r: RespuestaToken, ...permisos: string[]): boolean;
        };
      };
    };
  }
}

let cargaGis: Promise<void> | null = null;
function cargarGis(): Promise<void> {
  return (cargaGis ??= new Promise((ok, falla) => {
    if (window.google?.accounts?.oauth2) return ok();
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => ok();
    s.onerror = () => {
      cargaGis = null;
      falla(new Error('No se pudo cargar el inicio de sesión de Google. ¿Hay internet?'));
    };
    document.head.append(s);
  }));
}

function leerGuardado(): { token: string; expira: number } | null {
  try {
    const v = JSON.parse(localStorage.getItem(CLAVE) ?? 'null');
    return v && typeof v.token === 'string' && typeof v.expira === 'number' ? v : null;
  } catch {
    return null;
  }
}

export class SesionGoogle {
  private guardado = leerGuardado();

  get configurada() {
    return Boolean(CLIENT_ID);
  }

  /** Token vigente o null si venció. */
  token(): string | null {
    if (!this.guardado || Date.now() > this.guardado.expira - MARGEN_MS) return null;
    return this.guardado.token;
  }

  /** Carga por adelantado el script de Google, para que el clic en "Conectar" abra la ventana al instante. */
  precargar() {
    if (CLIENT_ID) cargarGis().catch(() => {});
  }

  /**
   * Abre la ventana de Google. Debe llamarse directamente desde un clic: si pasa tiempo entre el clic
   * y la apertura (p.ej. esperando a que cargue el script), el navegador bloquea la ventana.
   */
  async iniciar(primeraVez: boolean): Promise<string> {
    if (!CLIENT_ID) throw new Error('Falta VITE_GOOGLE_CLIENT_ID en web/.env');
    if (!window.google?.accounts?.oauth2) await cargarGis();
    return new Promise((ok, falla) => {
      const cliente = window.google!.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: PERMISO,
        callback: (r) => {
          if (r.error || !r.access_token) return falla(new Error(r.error_description || r.error || 'Google no entregó acceso.'));
          if (!window.google!.accounts.oauth2.hasGrantedAllScopes(r, PERMISO)) {
            return falla(new Error('Es necesario permitir el acceso a los archivos de Drive que crea la app.'));
          }
          this.guardado = { token: r.access_token, expira: Date.now() + (r.expires_in ?? 3600) * 1000 };
          try {
            localStorage.setItem(CLAVE, JSON.stringify(this.guardado));
          } catch {
            // sin almacenamiento: el token vive solo en esta pestaña
          }
          ok(r.access_token);
        },
        error_callback: (e) =>
          falla(new Error(e.type === 'popup_closed' ? 'Se cerró la ventana de Google.' : e.type === 'popup_failed_to_open' ? 'El navegador bloqueó la ventana de Google.' : e.message || e.type)),
      });
      cliente.requestAccessToken({ prompt: primeraVez ? 'consent' : '' });
    });
  }

  cerrar() {
    const t = this.guardado?.token;
    this.guardado = null;
    try {
      localStorage.removeItem(CLAVE);
    } catch {
      // nada que borrar
    }
    if (t && window.google?.accounts?.oauth2) window.google.accounts.oauth2.revoke(t);
  }
}
