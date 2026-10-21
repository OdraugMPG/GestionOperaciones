# Gestión Diaria CD · versión local (etapa 1)

Plataforma web que reemplaza el flujo diario del libro **Consolidacion_V4.4.xlsm**. Usa la misma Base de stock que hoy se pega en la hoja `Base`. La plataforma planifica, asigna y mide. Las tareas se ejecutan en el WMS, así que no hay pantalla para operarios.

| En el libro Excel | En la web |
|---|---|
| Paso 1 · 3D · 5 · 6 · 9 y ASIGNACIÓN DIARIA (mod1, mod2, mod3, mod7, mod9, mod11) | **Asignación del día**: cargar la Base y generar todo con un clic |
| Hojas `Tareas_Operarios`, `Tareas_Stock_Unitario`, `Tareas_SlowMoving` | **Tareas**: filtros, secuencia por operario y edición |
| 10 EXPORTAR TURNO / 11 IMPORTAR AVANCES (mod10) | Archivo `.xlsx` por turno e importación de avances (se mantienen como respaldo) |
| Avance digitado por el supervisor | **Conciliación**: el avance se calcula con el stock de cierre de cada turno |
| 12 INFORME DE CIERRE (mod10) | **Cierre de turno**: KPI por tareas y por unidades contra la meta del 95% |
| SlowMoving_Simulador + GENERAR TAREAS (mod8) | **Slow moving**: simulador con selección múltiple; las tareas quedan en cola para la próxima asignación |
| `Config_Diaria`, `Simulacion_Tiempos`, `Blq_Stk_unit` | **Configuración** |

## 1. Requisitos

- **Node.js 20 LTS** (sirve desde la 18.11). Para comprobarlo, escribe `node -v` en una terminal.
- **PostgreSQL 14 o superior**, con el servicio iniciado. Si ya lo usas con MentorSuites, sirve el mismo servidor. La plataforma crea su propia base `gestion_diaria`.
  - Si no tienes PostgreSQL pero sí Docker, ejecuta `docker compose up -d` en esta carpeta.

## 2. Instalación (Windows)

1. Descomprime el zip, por ejemplo en `C:\CENCOSUD\gestion-diaria-cd`.
2. Abre una terminal en esa carpeta. En el Explorador, escribe `cmd` en la barra de dirección y presiona Enter.
3. Instala las dependencias:
   ```
   npm install
   ```
4. Prepara todo:
   ```
   npm run setup
   ```
   Este paso crea el archivo `.env`, crea la base de datos y compila la web.
   - Si tu PostgreSQL no usa `postgres/postgres` en el puerto 5432, edita la línea `DATABASE_URL` del archivo `.env` y vuelve a ejecutar `npm run setup`.
5. Inicia la plataforma:
   ```
   npm start
   ```
6. Abre **http://localhost:3000** en el navegador.

Para dejarla corriendo, deja la terminal abierta. Para detenerla, presiona `Ctrl + C`.

## 3. Prueba guiada con datos de ejemplo

La carpeta `ejemplo/` trae una Base con la misma estructura de columnas del libro:

- 3 CD: CD01, CD02 y OSR.
- Un `Blq_Stk_unit` de ejemplo.

Para regenerar estos archivos, ejecuta `npm run ejemplo`.

1. Entra como **Planificador**. Deja la **Jornada** en la fecha de hoy; si hoy es domingo, elige un día hábil.
2. Ve a **Configuración**, presiona **Cargar Blq_Stk_unit** y elige `ejemplo/Blq_Stk_unit_ejemplo.xlsx`.
3. Ve a **Asignación del día**, presiona **Cargar Base de stock** y elige `ejemplo/Base_inicio_ejemplo.xlsx`. Los CD se crean solos y OSR queda inactivo.
4. Vuelve a **Configuración** y completa por CD:
   - los supervisores T1, T2 y T3;
   - los operarios de consolidación;
   - si hace stock unitario y en qué turno.

   Presiona **Guardar** en cada fila.
5. Opcional: en **Slow moving**, filtra (por ejemplo, CD01, sin venta, tramo "Sin movimiento") y presiona **Generar tareas**. Esas tareas entran en la asignación.
6. En **Asignación del día**, presiona **Generar asignación diaria**. Verás las tareas por CD y turno, los avisos y el plan diario. Desde ahí puedes descargar:
   - el archivo para el WMS;
   - el `.xlsx` de cada supervisor.
7. Simula lo que el WMS ejecutó en el turno 1. En la terminal, con la plataforma corriendo en otra ventana, escribe:
   ```
   npm run ejemplo -- cierre AAAA-MM-DD 1
   ```
   Usa la fecha de la jornada, por ejemplo `2026-10-20`. Se crea `ejemplo/Stock_cierre_T1_ejemplo.xlsx`, con cerca del 85% de las tareas del T1 ejecutadas.
8. Ve a **Conciliación**, elige **T1** y presiona **Cargar stock de cierre** con ese archivo. Las tareas pasan a EJECUTADO o PARCIAL sin digitar nada.
9. Cambia a **Supervisor** y abre **Mi turno**:
   - marca las zonas de inventario contadas;
   - registra una tarea NO EJECUTADO con su motivo.
10. Abre **Cierre de turno**. Verás el cumplimiento por tareas y por unidades, por CD y proceso, por turno y supervisor, y las excepciones.

## 4. Prueba con tu Base real

Usa el mismo archivo de stock que hoy pegas en la hoja `Base`, en `.xlsx`, `.xlsm` o `.csv`.

- Se lee la hoja `Base` si existe; si no, la primera hoja.
- Los encabezados se buscan en las primeras 10 filas, con los mismos alias del libro.
- Columnas obligatorias: **CD, SKU, UBICACION, QTY, PISO, ZONA_PASILLO (o PASILLO), DESC_DEPTO**.
- Columnas opcionales:
  - DESCRIPCION, MARCA, PASILLO, BAHIA y NIVEL;
  - FECHA_ULT_ALMACENAMIENTO, VENTAS, TEMPORADA y COSTO, para slow moving.

Si falta una columna, la pantalla muestra cuál es y la lista de encabezados que leyó.

Recomendación para la primera semana: corre el libro y la web en paralelo con la misma Base y compara el número de movimientos y de SKU unitarios.

### Cómo se mide el avance

Al cierre de cada turno se carga el mismo archivo de stock y se compara con la Base del inicio:

| Proceso | Regla |
|---|---|
| Consolidación | Baja en la ubicación de origen y sube en la de destino. Cuenta lo menor de ambos. |
| Stock unitario | La unidad aparece en la ubicación reservada y salió del origen. |
| Slow moving | Baja en la ubicación de origen. |
| Inventario | El stock no lo muestra: el supervisor marca la zona como contada. |

Una tarea nunca retrocede de estado. Las tareas NO EJECUTADO exigen motivo.

Si un turno no tiene foto de stock, el `.xlsx` del supervisor se completa y se importa igual que en el libro.

## 5. Diferencias con el libro, conocidas y a propósito

- **Ubicación repetida en la Base:** si un SKU aparece en varias filas de la misma ubicación, se suman antes de consolidar. El libro las trataba por separado.
- **Zona de consolidación repartida entre dos turnos:** sus movimientos se reparten según el % de la zona en cada turno. Así no se repiten en los dos turnos.
- **Ciclo de inventario:** una zona entra al ciclo cuando todas sus tareas de inventario del día quedan EJECUTADAS y el plan cubría el 100% de la zona. Cuando todo el CD está inventariado, el ciclo se reinicia solo.
- **Aún no están en esta etapa:**
  - el plan semanal;
  - la hoja `Analisis_Fisico` (Fase 2);
  - el informe gerencial de slow moving con historial;
  - el inicio de sesión con la cuenta corporativa. Por ahora el rol se elige arriba a la izquierda.

## 6. Para desarrollo

```
npm run dev
```

Levanta la API en el puerto 3000 y la web con recarga automática en http://localhost:5173.

Para probar el motor sin base de datos:

```
npm run prueba-motor -- ruta\a\Base.xlsx 2026-10-20
```

```
backend/
  engine/        motor de cálculo, port directo de los módulos VBA (sin base de datos)
    base.js            lectura de la Base y de Blq_Stk_unit (alias del libro)
    plan.js            plan diario por turno (mod7)
    consolidacion.js   tareas de consolidación Fase 1 y reparto por zona (mod2, mod3)
    stockUnitario.js   stock unitario, secuencia en S y reparto con máximo 2 por piso (mod9)
    slowMoving.js      detalle, tramos y simulador (mod8)
    conciliacion.js    avance por comparación de fotos de stock
  services/      asignación diaria (mod11), tareas, KPI, archivos .xlsx, slow moving
  schema.sql     tablas PostgreSQL
  index.js       API REST (Express)
frontend/          React (Vite): una vista por módulo
scripts/         setup, datos de ejemplo y prueba del motor
```

## 7. Problemas comunes

- **"No pude conectar con PostgreSQL":** revisa que el servicio esté iniciado (en Windows: Servicios, `postgresql-x64-16`) y la línea `DATABASE_URL` de `.env`.
- **El puerto 3000 está ocupado:** cambia `PORT` en `.env`.
- **"No hay Base del inicio de la jornada":** la Base se carga por fecha. Revisa que la **Jornada** elegida sea la misma del día en que cargaste el archivo.
- **"ya tiene tareas con avance registrado":** al regenerar una asignación con avance, ese avance se pierde. La pantalla pide confirmación.
