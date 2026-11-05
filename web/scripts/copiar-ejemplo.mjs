// Copia esquema/ejemplo-datos.json a datos/cdccn-datos.json para probar la web con datos de ejemplo.
// Si ya existe un archivo de datos, primero lo respalda.
import { copyFile, mkdir, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const origen = resolve(raiz, '../esquema/ejemplo-datos.json');
const destino = resolve(raiz, process.env.CDCCN_DATOS ?? 'datos/cdccn-datos.json');

await mkdir(dirname(destino), { recursive: true });
try {
  await access(destino);
  const respaldo = `${destino}.antes-del-ejemplo`;
  await copyFile(destino, respaldo);
  console.log(`Respaldo de tus datos: ${respaldo}`);
} catch {
  // no había datos
}
await copyFile(origen, destino);
console.log(`Datos de ejemplo copiados a ${destino}`);
