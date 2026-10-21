// Optimización con ABC/XYZ: cruza la clasificación consolidada (por SKU) con la Base del día para recomendar
// consolidación, reasignación hacia el CD prioritario (el más cercano a OSR y empaque), stock unitario e inventario cíclico.
import { q, tx } from '../db.js';
import { leerParametros } from './parametros.js';
import { filasDeCarga, ultimaCargaInicio } from './stock.js';
import { clasificacionActual } from './abcXyz.js';
import { TODOS } from '../engine/abcXyz.js';
import { up, cmp } from '../engine/util.js';

// SKU de alta rotación que conviene tener en el CD prioritario
export const CLASES_TRAER = ['AX', 'AY', 'BX'];
// SKU sin venta (o sin stock) que liberan espacio en el CD prioritario
export const CLASES_LIBERAR = ['CZ'];

const nuevo = () => ({ A: 0, B: 0, C: 0 });

async function datos() {
  const carga = await ultimaCargaInicio();
  if (!carga) throw Object.assign(new Error('Carga primero una Base de stock en Asignación del día.'), { status: 400 });
  const p = await leerParametros();
  const d = await clasificacionActual();
  const clase = new Map(d.grupos.get(TODOS).map((x) => [x.sku, x]));
  const filas = (await filasDeCarga(carga.id)).filter((r) => r.cd && r.sku && r.ubic && r.qty > 0);
  return { carga, p, d, clase, filas };
}

/** SKU x CD con sus ubicaciones; y cuántos SKU distintos hay en cada ubicación. */
function indexar(filas, clase) {
  const sk = new Map(), skuEnUb = new Map();
  for (const r of filas) {
    const k = r.cd + '|' + r.sku;
    let x = sk.get(k);
    if (!x) {
      const c = clase.get(r.sku);
      x = { cd: r.cd, sku: r.sku, desc: r.desc, depto: r.depto, matriz: c?.matriz || 'CZ', abc: c?.abc || 'C', ventas: c?.ventas || 0, uni: 0, ubic: new Map() };
      sk.set(k, x);
    }
    x.uni += r.qty;
    if (!x.ubic.has(r.ubic)) x.ubic.set(r.ubic, { ubic: r.ubic, piso: r.piso, zp: r.zp, qty: 0 });
    x.ubic.get(r.ubic).qty += r.qty;
    const ku = r.cd + '|' + r.ubic;
    if (!skuEnUb.has(ku)) skuEnUb.set(ku, new Set());
    skuEnUb.get(ku).add(r.sku);
  }
  return { sk, skuEnUb };
}

export async function optimizacion() {
  const { carga, p, d, filas, clase } = await datos();
  const { sk, skuEnUb } = indexar(filas, clase);
  const cdPri = up(p.cdPrioritario);
  const cds = [...new Set(filas.map((r) => r.cd))].sort(cmp);
  const porCd = new Map(cds.map((cd) => [cd, { cd, skus: 0, uni: 0, ubic: 0, ubicAbc: nuevo(), uniAbc: nuevo(), cz: { skus: 0, uni: 0, ubic: 0 },
    cons: { A: { skus: 0, libera: 0 }, B: { skus: 0, libera: 0 }, C: { skus: 0, libera: 0 } }, su: nuevo() }]));
  // clase de una ubicación = la mejor clase de los SKU que guarda
  const claseUb = new Map();
  for (const x of sk.values()) {
    const c = porCd.get(x.cd);
    c.skus++; c.uni += x.uni; c.uniAbc[x.abc] += x.uni;
    if (x.matriz === 'CZ') { c.cz.skus++; c.cz.uni += x.uni; }
    for (const u of x.ubic.keys()) {
      const ku = x.cd + '|' + u;
      if (!claseUb.has(ku) || x.abc < claseUb.get(ku)) claseUb.set(ku, x.abc);
    }
    // consolidación: un SKU en n ubicaciones del CD libera hasta n - 1
    if (x.ubic.size > 1) { c.cons[x.abc].skus++; c.cons[x.abc].libera += x.ubic.size - 1; }
    // stock unitario: 1 unidad en 1 ubicación (OSR no se procesa)
    if (x.uni === 1 && x.ubic.size === 1 && !p.excluidos.has(x.cd)) c.su[x.abc]++;
  }
  for (const [ku, a] of claseUb) {
    const c = porCd.get(ku.split('|')[0]);
    c.ubic++; c.ubicAbc[a]++;
    if ([...skuEnUb.get(ku)].every((s) => (clase.get(s)?.matriz || 'CZ') === 'CZ')) c.cz.ubic++;
  }

  // --- reasignación hacia el CD prioritario
  const traer = [], liberar = [];
  for (const x of sk.values()) {
    if (x.cd !== cdPri && !p.excluidos.has(x.cd) && CLASES_TRAER.includes(x.matriz)) {
      traer.push({ cd: x.cd, sku: x.sku, desc: x.desc, depto: x.depto, matriz: x.matriz, ventas: x.ventas, uni: x.uni, nUb: x.ubic.size,
        enPri: sk.get(cdPri + '|' + x.sku)?.uni || 0, ubic: [...x.ubic.keys()].slice(0, 4) });
    }
    if (x.cd === cdPri && CLASES_LIBERAR.includes(x.matriz)) {
      const libera = [...x.ubic.keys()].filter((u) => skuEnUb.get(cdPri + '|' + u).size === 1).length;
      liberar.push({ cd: x.cd, sku: x.sku, desc: x.desc, depto: x.depto, matriz: x.matriz, uni: x.uni, nUb: x.ubic.size, libera, ubic: [...x.ubic.keys()].slice(0, 4) });
    }
  }
  traer.sort((a, b) => b.ventas - a.ventas || cmp(a.sku, b.sku));
  liberar.sort((a, b) => b.libera - a.libera || b.uni - a.uni);
  const sum = (l, k) => l.reduce((s, x) => s + x[k], 0);

  // --- inventario cíclico por clase: cada ubicación se cuenta cada N días según su clase
  const dias = { A: p.invDiasA, B: p.invDiasB, C: p.invDiasC };
  const inventario = [...porCd.values()].map((c) => ({ cd: c.cd, ubicAbc: c.ubicAbc, porDia: ['A', 'B', 'C'].reduce((s, a) => s + c.ubicAbc[a] / Math.max(1, dias[a]), 0) }));

  const { rows: cola } = await q("SELECT tipo, cd, count(*)::int AS n FROM sm_cola WHERE estado = 'EN COLA' GROUP BY tipo, cd ORDER BY tipo, cd");
  return {
    carga, metodo: d.metodo, cdPri, existePri: porCd.has(cdPri), excluidos: [...p.excluidos], dias,
    clasesTraer: CLASES_TRAER, clasesLiberar: CLASES_LIBERAR,
    cds: [...porCd.values()], inventario, cola,
    reasignacion: {
      traer: { skus: new Set(traer.map((x) => x.sku)).size, ubic: sum(traer, 'nUb'), uni: sum(traer, 'uni'), detalle: traer.slice(0, 300) },
      liberar: { skus: liberar.length, ubic: sum(liberar, 'nUb'), libera: sum(liberar, 'libera'), uni: sum(liberar, 'uni'), detalle: liberar.slice(0, 300) },
    },
  };
}

/**
 * Deja en cola las tareas de reasignación del CD prioritario (entran a la próxima asignación diaria):
 * - 'traer': una tarea REU por ubicación de los SKU AX/AY/BX que están en otros CD, con destino el CD prioritario;
 * - 'liberar': una tarea SM por ubicación de los SKU CZ del CD prioritario, hacia la zona de slow moving.
 */
export async function generarReasignacion(tipo, limite = 200) {
  const { p, filas, clase } = await datos();
  const { sk } = indexar(filas, clase);
  const cdPri = up(p.cdPrioritario);
  const lista = [...sk.values()].filter((x) => (tipo === 'traer'
    ? x.cd !== cdPri && !p.excluidos.has(x.cd) && CLASES_TRAER.includes(x.matriz)
    : x.cd === cdPri && CLASES_LIBERAR.includes(x.matriz)));
  lista.sort((a, b) => (tipo === 'traer' ? b.ventas - a.ventas : b.uni - a.uni) || cmp(a.sku, b.sku));
  const sel = lista.slice(0, Math.max(1, Number(limite) || 200));
  const destino = tipo === 'traer' ? `${cdPri} · ZONA ALTA ROTACIÓN` : (p.smDestino || 'ZONA SLOW MOVING');
  let n = 0;
  await tx(async (c) => {
    for (const x of sel) {
      for (const u of x.ubic.values()) {
        const ya = await c.query("SELECT 1 FROM sm_cola WHERE cd=$1 AND sku=$2 AND ubicacion=$3 AND estado='EN COLA'", [x.cd, x.sku, u.ubic]);
        if (ya.rowCount) continue;
        await c.query('INSERT INTO sm_cola (cd, sku, descripcion, depto, temporada, mes, piso, zona, ubicacion, unidades, destino, tipo) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
          [x.cd, x.sku, x.desc, x.depto || '', x.matriz, '', u.piso, u.zp, u.ubic, u.qty, destino, tipo === 'traer' ? 'REU' : 'SM']);
        n++;
      }
    }
  });
  return { tareas: n, skus: sel.length, destino };
}
