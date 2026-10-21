import React, { useEffect, useState } from 'react';
import { hoyIso } from './api.js';
import { Toaster } from './ui.jsx';
import Hoy from './views/Hoy.jsx';
import Tareas from './views/Tareas.jsx';
import Conciliacion from './views/Conciliacion.jsx';
import MiTurno from './views/MiTurno.jsx';
import Cierre from './views/Cierre.jsx';
import Slow from './views/Slow.jsx';
import Config from './views/Config.jsx';
import AbcXyz from './views/AbcXyz.jsx';
import Optimizacion from './views/Optimizacion.jsx';

const VISTAS = {
  hoy: ['Asignación del día', Hoy],
  tareas: ['Tareas', Tareas],
  conciliacion: ['Conciliación', Conciliacion],
  turno: ['Mi turno', MiTurno],
  cierre: ['Cierre de turno', Cierre],
  slow: ['Slow moving', Slow],
  abc: ['ABC / XYZ', AbcXyz],
  opt: ['Optimización ABC', Optimizacion],
  config: ['Configuración', Config],
};
const NAV = { plan: ['hoy', 'tareas', 'conciliacion', 'cierre', 'slow', 'abc', 'opt', 'config'], sup: ['turno', 'cierre'], ger: ['cierre', 'slow', 'abc', 'opt'] };
const leer = (k, d) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };

export default function App() {
  const [rol, setRol] = useState(() => leer('gd-rol', 'plan'));
  const [vista, setVista] = useState(() => leer('gd-vista', 'hoy'));
  const [fecha, setFecha] = useState(hoyIso());
  useEffect(() => { if (!NAV[rol].includes(vista)) setVista(NAV[rol][0]); guardar('gd-rol', rol); }, [rol]);
  useEffect(() => guardar('gd-vista', vista), [vista]);
  const [, V] = VISTAS[NAV[rol].includes(vista) ? vista : NAV[rol][0]];
  return (
    <div className="app">
      <aside>
        <div className="brand">Gestión Diaria CD<small>Planificación · asignación · control</small></div>
        <div>
          <label className="lbl" htmlFor="rol">Entrar como</label>
          <select id="rol" value={rol} onChange={(e) => setRol(e.target.value)} style={{ width: '100%' }}>
            <option value="plan">Planificador</option>
            <option value="sup">Supervisor</option>
            <option value="ger">Gerencia</option>
          </select>
        </div>
        <div>
          <label className="lbl" htmlFor="fecha">Jornada</label>
          <input id="fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value || hoyIso())} style={{ width: '100%' }} />
        </div>
        <nav aria-label="Módulos">
          {NAV[rol].map((v) => (
            <button key={v} aria-current={vista === v ? 'page' : undefined} onClick={() => setVista(v)}>{VISTAS[v][0]}</button>
          ))}
        </nav>
        <div className="foot">Las tareas se ejecutan en el WMS. Esta plataforma planifica, asigna y mide el avance comparando el stock del inicio con el del cierre de cada turno.</div>
      </aside>
      <main><V fecha={fecha} rol={rol} irA={setVista} /></main>
      <Toaster />
    </div>
  );
}
