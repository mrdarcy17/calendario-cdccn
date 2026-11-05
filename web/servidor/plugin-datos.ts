// Plugin de Vite: expone GET/PUT /api/datos para leer y escribir el archivo de datos en la PC.
// Es el almacenamiento de la primera versión; después se sustituye por la sincronización con Google Drive.

import { mkdir, readFile, rename, copyFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Connect, Plugin } from 'vite';
import { hoy } from '../src/datos/fechas.ts';
import { datosIniciales } from '../src/datos/operaciones.ts';
import { validarDatos } from '../src/datos/validar.ts';

const LIMITE_BYTES = 50 * 1024 * 1024;

function responder(res: ServerResponse, estado: number, cuerpo: unknown) {
  res.statusCode = estado;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(cuerpo));
}

function leerCuerpo(req: IncomingMessage): Promise<string> {
  return new Promise((ok, falla) => {
    let tam = 0;
    const partes: Buffer[] = [];
    req.on('data', (p: Buffer) => {
      tam += p.length;
      if (tam > LIMITE_BYTES) {
        falla(new Error('El archivo es demasiado grande.'));
        req.destroy();
      } else partes.push(p);
    });
    req.on('end', () => ok(Buffer.concat(partes).toString('utf8')));
    req.on('error', falla);
  });
}

async function escribirSeguro(ruta: string, contenido: string) {
  await mkdir(dirname(ruta), { recursive: true });
  // Respaldo de la versión anterior, por si algo sale mal.
  await copyFile(ruta, `${ruta}.bak`).catch(() => {});
  const temporal = `${ruta}.tmp`;
  await writeFile(temporal, contenido, 'utf8');
  await rename(temporal, ruta);
}

export function datosLocales(opciones: { archivo?: string } = {}): Plugin {
  let ruta = '';

  const middleware: Connect.NextHandleFunction = async (req, res, next) => {
    if (!req.url || req.url.split('?')[0] !== '/api/datos') return next();
    try {
      if (req.method === 'GET') {
        let texto: string;
        try {
          texto = await readFile(ruta, 'utf8');
        } catch (e) {
          if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
          const iniciales = datosIniciales();
          texto = JSON.stringify(iniciales, null, 2) + '\n';
          await escribirSeguro(ruta, texto);
        }
        let valor: unknown;
        try {
          valor = JSON.parse(texto);
        } catch {
          return responder(res, 500, { errores: [`${ruta} no es un JSON válido. Revísalo o restaura ${ruta}.bak.`] });
        }
        const r = validarDatos(valor, hoy());
        if (!r.ok) return responder(res, 500, { errores: [`${ruta} tiene errores:`, ...r.errores] });
        return responder(res, 200, r.datos);
      }

      if (req.method === 'PUT') {
        let valor: unknown;
        try {
          valor = JSON.parse(await leerCuerpo(req));
        } catch {
          return responder(res, 400, { errores: ['El cuerpo no es un JSON válido.'] });
        }
        const r = validarDatos(valor, hoy());
        if (!r.ok) return responder(res, 422, { errores: r.errores });
        await escribirSeguro(ruta, JSON.stringify(r.datos, null, 2) + '\n');
        return responder(res, 200, { ok: true });
      }

      res.setHeader('Allow', 'GET, PUT');
      return responder(res, 405, { errores: ['Método no permitido.'] });
    } catch (e) {
      return responder(res, 500, { errores: [(e as Error).message] });
    }
  };

  return {
    name: 'cdccn-datos-locales',
    configResolved(config) {
      ruta = resolve(config.root, opciones.archivo ?? process.env.CDCCN_DATOS ?? 'datos/cdccn-datos.json');
      config.logger.info(`  ➜  Datos:   ${ruta}`);
    },
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}
