-- Esquema de Gestión Diaria CD (PostgreSQL). Se aplica solo al iniciar el servidor.

CREATE TABLE IF NOT EXISTS parametros (
  clave  text PRIMARY KEY,
  valor  text NOT NULL
);

CREATE TABLE IF NOT EXISTS cd_config (
  cd            text PRIMARY KEY,
  activo        boolean NOT NULL DEFAULT true,
  rec_inv       integer NOT NULL DEFAULT 2,
  op_cons       integer NOT NULL DEFAULT 4,
  sup_t1        text NOT NULL DEFAULT '',
  sup_t2        text NOT NULL DEFAULT '',
  sup_t3        text NOT NULL DEFAULT '',
  stock_unitario boolean NOT NULL DEFAULT false,
  turno_su      integer NOT NULL DEFAULT 1,
  op_su         integer NOT NULL DEFAULT 2,
  prefijo       text NOT NULL DEFAULT 'OP',
  turno_sm      integer NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS ubic_reservadas (
  ubicacion text PRIMARY KEY,
  grupo     text NOT NULL DEFAULT '',
  max       integer
);

-- Cada archivo de stock cargado: INICIO = base del inicio de la jornada; CIERRE = foto al cierre de un turno.
CREATE TABLE IF NOT EXISTS cargas (
  id         serial PRIMARY KEY,
  fecha      date NOT NULL,
  tipo       text NOT NULL CHECK (tipo IN ('INICIO','CIERRE')),
  turno      integer,
  archivo    text NOT NULL DEFAULT '',
  filas      integer NOT NULL DEFAULT 0,
  columnas   jsonb,
  avisos     jsonb,
  creado_en  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stock (
  carga_id  integer NOT NULL REFERENCES cargas(id) ON DELETE CASCADE,
  cd text, sku text, descripcion text, marca text, depto text, piso text, zona_pasillo text, pasillo text,
  bahia text, nivel text, ubicacion text, qty numeric, fecha_ult_alm date, dias numeric, ventas numeric,
  temporada text, costo numeric
);
CREATE INDEX IF NOT EXISTS stock_carga_idx ON stock (carga_id);

CREATE TABLE IF NOT EXISTS asignaciones (
  id         serial PRIMARY KEY,
  fecha      date NOT NULL,
  carga_id   integer REFERENCES cargas(id) ON DELETE SET NULL,
  creado_en  timestamptz NOT NULL DEFAULT now(),
  segundos   numeric,
  resumen    jsonb,
  log        jsonb
);

CREATE TABLE IF NOT EXISTS plan_lineas (
  asignacion_id integer NOT NULL REFERENCES asignaciones(id) ON DELETE CASCADE,
  cd text, fecha date, turno integer, tarea text, piso text, zona text, hh numeric, pct numeric,
  operarios text, ubicaciones integer, movimientos integer, orden numeric
);

CREATE TABLE IF NOT EXISTS tareas (
  id            serial PRIMARY KEY,
  asignacion_id integer REFERENCES asignaciones(id) ON DELETE CASCADE,
  fecha         date NOT NULL,
  cd            text NOT NULL,
  turno         integer NOT NULL,
  proceso       text NOT NULL,         -- INV | CONS | SU | SM
  folio         text,
  sub           text,
  secuencia     integer,
  piso          text,
  zona          text,
  ubic_origen   text,
  sku           text,
  descripcion   text,
  ubic_destino  text,
  asignado_a    text,
  supervisor    text,
  unid_asig     numeric NOT NULL DEFAULT 0,
  unid_real     numeric,
  estado        text NOT NULL DEFAULT 'PENDIENTE',   -- PENDIENTE | PARCIAL | EJECUTADO | NO EJECUTADO | SIN DESTINO
  fuente        text,
  observacion   text,
  detalle       text,
  ext_id        text,
  actualizado_en timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tareas_fecha_idx ON tareas (fecha, cd, turno);

CREATE TABLE IF NOT EXISTS avance_inventario (
  cd text, piso text, zona text, fecha date,
  PRIMARY KEY (cd, piso, zona)
);

CREATE TABLE IF NOT EXISTS sm_cola (
  id          serial PRIMARY KEY,
  creado_en   timestamptz NOT NULL DEFAULT now(),
  cd text, sku text, descripcion text, depto text, temporada text, mes text,
  piso text, zona text, ubicacion text, unidades numeric, destino text,
  estado      text NOT NULL DEFAULT 'EN COLA',   -- EN COLA | ASIGNADA
  fecha_asig  date
);

CREATE TABLE IF NOT EXISTS conciliaciones (
  id serial PRIMARY KEY,
  fecha date, carga_id integer REFERENCES cargas(id) ON DELETE CASCADE, turno integer,
  creado_en timestamptz NOT NULL DEFAULT now(), resumen jsonb
);
