// Preparación en un paso: crea .env, crea la base de datos en PostgreSQL y compila la web.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(raiz);
if (!fs.existsSync('.env')) {
  fs.copyFileSync('.env.example', '.env');
  console.log('1) Creé el archivo .env (revisa DATABASE_URL si tu PostgreSQL usa otra clave o puerto).');
} else console.log('1) Archivo .env encontrado.');
await import('dotenv/config');
const { prepararBase, pool, DATABASE_URL } = await import('../backend/db.js');
try {
  await prepararBase();
  console.log('2) PostgreSQL OK y tablas listas en', DATABASE_URL.replace(/:[^:@/]+@/, ':****@'));
} catch (e) {
  console.error('2) No pude conectar con PostgreSQL:', e.message);
  console.error('   Revisa que el servicio esté iniciado y que usuario/clave/puerto de DATABASE_URL en .env sean correctos.');
  process.exit(1);
} finally {
  await pool.end();
}
const { build } = await import('vite');
await build({ configFile: path.join(raiz, 'frontend', 'vite.config.js'), logLevel: 'warn' });
console.log('3) Web compilada en frontend/dist.');
console.log('\nListo. Ejecuta:  npm start   y abre http://localhost:' + (process.env.PORT || 3000));
