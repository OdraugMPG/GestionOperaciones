import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
pg.types.setTypeParser(1082, (v) => v);            // date -> 'YYYY-MM-DD'
pg.types.setTypeParser(1700, (v) => (v === null ? null : Number(v))); // numeric -> number

export const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/gestion_diaria';
export const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 10 });

export const q = (text, params) => pool.query(text, params);

export async function tx(fn) {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const r = await fn(c);
    await c.query('COMMIT');
    return r;
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    c.release();
  }
}

/** Crea la base de datos si no existe y aplica el esquema. */
export async function prepararBase() {
  const url = new URL(DATABASE_URL);
  const nombre = url.pathname.replace(/^\//, '') || 'gestion_diaria';
  try {
    await pool.query('SELECT 1');
  } catch (e) {
    if (e.code !== '3D000') throw e; // 3D000 = la base no existe
    const adminUrl = new URL(DATABASE_URL);
    adminUrl.pathname = '/postgres';
    const admin = new pg.Client({ connectionString: adminUrl.toString() });
    await admin.connect();
    await admin.query(`CREATE DATABASE "${nombre.replace(/"/g, '')}"`);
    await admin.end();
    console.log(`Base de datos "${nombre}" creada.`);
  }
  await pool.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
}
