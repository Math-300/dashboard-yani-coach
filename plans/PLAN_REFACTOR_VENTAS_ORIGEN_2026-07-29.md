# Refactor `ventas`: promover `origen` y eliminar `raw` — Plan de implementación

> **Para trabajadores agénticos:** SUB-SKILL REQUERIDA: usar `superpowers:subagent-driven-development` (recomendado) o `superpowers:executing-plans` para ejecutar tarea por tarea. Los pasos usan checkbox (`- [ ]`) para seguimiento.

**Goal:** Sacar la columna `raw` de `public.ventas` — el último resto de datos personales del espejo Supabase — sin mover ni un peso de la facturación histórica.

**Arquitectura:** `raw` no se puede tirar de una porque la columna GENERADA `es_duplicado` se calcula desde `raw->>'origen'`, y de `es_duplicado` dependen la política RLS de la tabla y dos vistas materializadas. La secuencia es: crear `origen` como columna real → backfillearla desde `raw` → reapuntar la expresión de `es_duplicado` a `origen` (PG 17 permite `ALTER COLUMN ... SET EXPRESSION`, sin dropear policy ni matviews) → desplegar el sync que ya no escribe `raw` → recién ahí dropear `raw`. Cada paso se valida contra una tabla-snapshot tomada antes de tocar nada: el invariante es que `es_duplicado` no cambie en **ninguna** de las 1.939 filas.

**Stack:** PostgreSQL 17.6 (Supabase `dwnxldvrrzkqsqzlcvwt`), TypeScript + tsx (sync), Docker Swarm en VPS `154.38.179.209`.

---

## Global Constraints

- **Nada se da por hecho: todo dato se mide en vivo.** Los números de este plan se midieron el 2026-07-29; se vuelven a medir al ejecutar.
- **Nunca imprimir valores de secretos ni datos personales.** Las queries de verificación cuentan filas, no muestran nombres.
- El invariante duro es `es_duplicado`: **0 filas pueden cambiar de valor** en todo el refactor.
- El ingreso neto (`sum(amount) where not es_duplicado`) debe terminar idéntico al de la línea base.
- El orden **código antes que DROP** no es negociable: si se dropea `raw` con el sync viejo desplegado, cada corrida revienta con PGRST204 y el espejo se congela.
- El sync corre **cada 1 h** (más un reconcile full cada 24 h). Cualquier ventana entre migraciones tiene que ser segura frente a una corrida espontánea.
- Migraciones nuevas van a `supabase/migrations/` con el patrón `YYYYMMDDHHMMSS_NN_descripcion.sql`. La última es la **22**; estas son la **23** y la **24**.
- Un commit por tarea. `npm run typecheck` verde antes de cada commit que toque TypeScript.

---

## Estado medido (línea base — 2026-07-29, último sync 13:22:26 UTC)

**Volumen y plata:**

| Métrica | Valor |
|---|---|
| Ventas totales | 1.939 |
| Marcadas duplicado | 424 |
| Netas (visibles) | 1.515 |
| Ingreso neto | 109.374,00 |
| Ingreso bruto | 126.721,00 |

**Procedencia de las filas — y por qué el sync no puede pisarlas:**

| `origen` | Filas | Dup. | Rango `nocodb_id` | ¿Tiene claves NocoDB en `raw`? |
|---|---|---|---|---|
| *(ausente)* → sync NocoDB | 884 | 424 | 18 – 901 | sí (884) |
| `systeme_csv_backfill` | 982 | 0 | 900001 – 901419 | no (0) |
| `stripe_recovery_junio` | 43 | 0 | 902001 – 902043 | no (0) |
| `stripe_recovery_julio_2026-07-13` | 30 | 0 | 903001 – 903030 | no (0) |

Los IDs sintéticos (900001+) no se solapan con los reales (18–901): el upsert del sync **no puede** tocar las filas de backfill. Esto es lo que hace seguro no mandar `origen` desde el sync.

**Expresión actual de `es_duplicado`:**

```sql
CASE
  WHEN COALESCE(raw ->> 'origen', '') <> 'systeme_csv_backfill'
       AND fecha < '2026-06-01 05:00:00+00'::timestamptz THEN true
  WHEN (raw ->> 'origen') = 'systeme_csv_backfill'
       AND fecha >= '2026-06-09 05:00:00+00'::timestamptz THEN true
  ELSE false
END
```

**Dependencias de `es_duplicado`:**

- Policy `ventas_select_anon` — `SELECT` para `{anon, authenticated}`, `USING (es_duplicado = false)`.
- Matview `mv_sales_trend_monthly` — `WHERE fecha IS NOT NULL AND es_duplicado = false`.
- Matview `mv_vendedora_performance` — CTE `ventas_agg`, `WHERE es_duplicado = false`.
- `mv_funnel_counts` **NO** depende (lee `contactos`).
- Funciones: ninguna usa `es_duplicado` ni `raw`. (`get_funnel_respondio` y `resolve_foreign_keys` nombran `ventas` pero no esas columnas.)

**Quién lee y quién escribe `raw`:**

- Escritores: **solo** `scripts/sync/syncVentas.ts:80`.
- Lectores en el front (`src/`): **cero**. `grep -rn "\braw\b" src/` no devuelve nada.
- Otros lectores de `ventas`: `scripts/smoke_datasource.ts:78` (solo `nocodb_id, amount, fecha`).

**Exposición que este refactor cierra** — `anon` tiene `SELECT` sobre la columna `raw` y la policy le deja ver las 1.515 filas netas:

| Dato expuesto hoy vía anon key | Filas |
|---|---|
| Nombre del comprador (`raw->'Contacto que Compró'->>'Nombre'`) | 444 |
| `stripe_customer` | 30 |

---

## File Structure

| Archivo | Estado | Responsabilidad |
|---|---|---|
| `supabase/migrations/20260729140000_23_ventas_origen_columna.sql` | crear | Snapshot + columna `origen` + backfill + `SET EXPRESSION` |
| `supabase/migrations/20260729160000_24_ventas_drop_raw.sql` | crear | `DROP COLUMN raw` + limpieza del snapshot |
| `scripts/sync/syncVentas.ts` | modificar (4, 21-28, 80) | Dejar de espejar `raw` |
| `scripts/sync/helpers.ts` | verificar | `cleanRaw` queda sin usuarios; se conserva exportada |
| `plans/PLAN_REFACTOR_VENTAS_ORIGEN_2026-07-29.md` | este archivo | Plan y checklist |

---

### Task 1: Snapshot de seguridad y línea base

Sin esto no hay rollback: una vez dropeado `raw`, el contenido no vuelve. El snapshot guarda `raw` completo hasta que la verificación final pase.

**Files:**
- Ninguno en disco. DDL vía `mcp__supabase__execute_sql` sobre `dwnxldvrrzkqsqzlcvwt`.

**Interfaces:**
- Produce: tabla `public._refactor_ventas_baseline (id uuid, nocodb_id int, es_duplicado bool, amount numeric, fecha timestamptz, origen text, raw jsonb)` — la consumen las verificaciones de las Tareas 2, 4 y 5.

- [ ] **Paso 1: Crear el snapshot y blindarlo**

```sql
create table public._refactor_ventas_baseline as
select id, nocodb_id, es_duplicado, amount, fecha, raw->>'origen' as origen, raw
from public.ventas;

alter table public._refactor_ventas_baseline enable row level security;
revoke all on public._refactor_ventas_baseline from anon, authenticated;
```

`enable row level security` sin políticas = nadie salvo `service_role` lee, aunque un GRANT por defecto se cuele. Doble candado a propósito: esta tabla tiene los 444 nombres.

- [ ] **Paso 2: Verificar que el snapshot está completo y cerrado**

```sql
select (select count(*) from public._refactor_ventas_baseline) as filas_snapshot,
       (select count(*) from public.ventas) as filas_ventas,
       (select count(*) from information_schema.role_table_grants
         where table_name='_refactor_ventas_baseline' and grantee in ('anon','authenticated')) as grants_publicos;
```

Esperado: `filas_snapshot = filas_ventas`, `grants_publicos = 0`.

- [ ] **Paso 3: Registrar la línea base**

```sql
select count(*) as total,
       count(*) filter (where es_duplicado) as duplicadas,
       round(sum(amount) filter (where not es_duplicado),2) as ingreso_neto,
       round(sum(amount),2) as ingreso_bruto
from public._refactor_ventas_baseline;
```

Anotar los cuatro números en la sección "Bitácora" al final de este archivo. Son la vara contra la que se mide todo lo que sigue. Si difieren de la tabla de arriba (1.939 / 424 / 109.374,00 / 126.721,00), **no es un error**: el sync corrió y sumó ventas. Se usa lo medido hoy, no lo escrito acá.

---

### Task 2: Migración 23 — `origen` como columna real

**Files:**
- Crear: `supabase/migrations/20260729140000_23_ventas_origen_columna.sql`

**Interfaces:**
- Consume: `public._refactor_ventas_baseline` (Task 1).
- Produce: `public.ventas.origen text` y `es_duplicado` recalculada desde `origen`. La Task 3 depende de que `origen` ya exista; la Task 4 depende de que `es_duplicado` ya no referencie `raw`.

- [ ] **Paso 1: Escribir la migración**

```sql
-- Migración 23 (2026-07-29): promover `origen` a columna real en `ventas`.
--
-- Por qué: `ventas` es la única tabla del espejo que todavía guarda `raw`, y no por
-- comodidad — la columna GENERADA `es_duplicado` se calcula desde `raw->>'origen'`.
-- De `es_duplicado` cuelgan la policy `ventas_select_anon` y dos matviews
-- (mv_sales_trend_monthly, mv_vendedora_performance). Mientras la expresión mire a
-- `raw`, `raw` no se puede dropear.
--
-- Medido antes de escribir esto (2026-07-29): `raw` es legible por `anon` y deja a la
-- vista 444 nombres de comprador y 30 `stripe_customer` en las 1.515 filas no duplicadas.
--
-- PG 17 permite `ALTER COLUMN ... SET EXPRESSION`, así que NO hace falta dropear la
-- policy ni las matviews: dependen de la COLUMNA, no de su expresión. La sentencia
-- reescribe la tabla (1.939 filas, instantáneo).

-- 1) La columna. Nullable a propósito: las 884 filas que vienen del sync NocoDB no
--    tienen origen, y `COALESCE(origen,'')` en la expresión conserva esa semántica.
alter table public.ventas add column if not exists origen text;

-- 2) Backfill desde `raw`. Solo las 1.055 filas que traen la clave.
update public.ventas set origen = raw->>'origen' where raw ? 'origen';

-- 3) Reapuntar la expresión. Misma lógica, mismos cortes, misma semántica de NULL.
alter table public.ventas
  alter column es_duplicado set expression as (
    case
      when coalesce(origen, '') <> 'systeme_csv_backfill'
           and fecha < '2026-06-01 05:00:00+00'::timestamptz then true
      when origen = 'systeme_csv_backfill'
           and fecha >= '2026-06-09 05:00:00+00'::timestamptz then true
      else false
    end
  );

create index if not exists ventas_origen_idx on public.ventas (origen);

comment on column public.ventas.origen is
  'Procedencia de la fila: NULL = sync NocoDB; systeme_csv_backfill / stripe_recovery_* = cargas puntuales. Alimenta la columna generada es_duplicado. Antes vivía en raw->>''origen''.';
```

- [ ] **Paso 2: Aplicarla**

Vía `mcp__supabase__apply_migration`, nombre `23_ventas_origen_columna`.

Si `SET EXPRESSION` falla (sintaxis no soportada), ir al **Plan B** al final de esta tarea. No improvisar.

- [ ] **Paso 3: Verificar el invariante — 0 filas cambiadas**

```sql
select count(*) as filas_que_cambiaron
from public.ventas v
join public._refactor_ventas_baseline b using (id)
where v.es_duplicado is distinct from b.es_duplicado;
```

Esperado: **0**. Cualquier otro número aborta el refactor y dispara el rollback de esta tarea.

- [ ] **Paso 4: Verificar backfill, totales y la expresión nueva**

```sql
select (select count(*) from public.ventas v join public._refactor_ventas_baseline b using (id)
          where v.origen is distinct from b.origen) as origen_mal_backfilleado,
       (select count(*) from public.ventas where origen is not null) as con_origen,
       (select round(sum(amount) filter (where not es_duplicado),2) from public.ventas) as ingreso_neto,
       (select generation_expression from information_schema.columns
         where table_name='ventas' and column_name='es_duplicado') as expresion;
```

Esperado: `origen_mal_backfilleado = 0`; `con_origen = 1055` (o el valor de la línea base); `ingreso_neto` idéntico al de la Bitácora; `expresion` menciona `origen` y **no** menciona `raw`.

- [ ] **Paso 5: Refrescar matviews y confirmar que no se movieron**

```sql
select public.refresh_materialized_views();
select sum(ventas_monto) as monto_total, sum(ventas_cantidad) as cantidad
from public.mv_sales_trend_monthly;
```

Anotar en la Bitácora. Se vuelve a medir en la Task 5.

- [ ] **Paso 6: Commit**

```bash
git add supabase/migrations/20260729140000_23_ventas_origen_columna.sql
git commit -m "feat(db): migración 23 — \`origen\` como columna real en ventas"
```

**Rollback de la Task 2:** la expresión vieja se restaura sin pérdida, porque `raw` sigue intacta.

```sql
alter table public.ventas
  alter column es_duplicado set expression as (
    case
      when coalesce(raw ->> 'origen', '') <> 'systeme_csv_backfill'
           and fecha < '2026-06-01 05:00:00+00'::timestamptz then true
      when (raw ->> 'origen') = 'systeme_csv_backfill'
           and fecha >= '2026-06-09 05:00:00+00'::timestamptz then true
      else false
    end
  );
alter table public.ventas drop column if exists origen;
```

**Plan B (solo si `SET EXPRESSION` no está disponible):** dropear en orden `mv_vendedora_performance`, `mv_sales_trend_monthly`, policy `ventas_select_anon`, columna `es_duplicado`; recrear la columna con la expresión nueva; recrear la policy con `USING (es_duplicado = false)` para `{anon, authenticated}`; recrear las dos matviews con los `SELECT` transcritos en la sección "Dependencias" de arriba; `refresh_materialized_views()`. Después, las verificaciones de los Pasos 3–5 sin cambios.

---

### Task 3: El sync deja de espejar `raw`

**Files:**
- Modificar: `scripts/sync/syncVentas.ts` (líneas 4, 21-28, 80)
- Test: `npm run typecheck` + `npx tsx --test scripts/sync/*.test.ts`

**Interfaces:**
- Consume: la columna `origen` de la Task 2 debe existir ya (aunque este código no la escriba).
- Produce: `VentaRecord` sin la propiedad `raw`. La Task 4 depende de que esto esté **desplegado y corriendo** antes del DROP.

**Decisión de diseño — el sync NO escribe `origen`:** las 884 filas que sincroniza no tienen origen (es NULL y así debe quedar), y las 1.055 de backfill viven en el rango de IDs 900001+, que el upsert nunca alcanza. Al no mandar la columna, el `ON CONFLICT DO UPDATE` no la toca jamás. Si en cambio mandáramos `origen: null`, una futura colisión de IDs borraría la procedencia de 982 filas y reclasificaría la facturación de feb–may. No mandarla es la opción segura.

- [ ] **Paso 1: Quitar `raw` de la interfaz**

En `scripts/sync/syncVentas.ts`, reemplazar el bloque de las líneas 21-28 (el comentario largo + `raw: Record<string, unknown>;`) por:

```ts
  // `ventas` ya no espeja `raw`. La columna generada `es_duplicado` ahora se calcula
  // desde la columna real `origen` (migración 23), así que el JSON crudo dejó de ser
  // necesario — y con él se van los 444 nombres de comprador y 30 `stripe_customer`
  // que `anon` podía leer.
  // `origen` NO se escribe desde acá a propósito: las filas del sync no tienen origen,
  // y las de backfill (nocodb_id 900001+) están fuera del alcance de este upsert.
  // Mandarla como null borraría la procedencia de 982 filas ante una colisión de IDs.
```

- [ ] **Paso 2: Quitar la asignación y el import**

Línea 80, borrar entera:

```ts
    raw: cleanRaw(row, ['Usuario Vendedora', 'email']),
```

Línea 4, sacar `cleanRaw` del import:

```ts
import { chunk, toIsoDate, toNumber, toText } from './helpers.js';
```

`cleanRaw` queda sin usuarios en todo `scripts/`. Se conserva exportada en `helpers.ts` — es utilitario genérico y borrarlo no aporta nada.

- [ ] **Paso 3: Typecheck y tests**

```bash
cd "/home/jruiz300/Dev/PROYECTOS/Yani Coach/Dashboard Yani Coach"
npm run typecheck
npx tsx --test scripts/sync/scheduler.test.ts scripts/sync/respondio.test.ts scripts/sync/plantillas.test.ts
```

Esperado: typecheck sin salida (exit 0); tests `# fail 0`.

- [ ] **Paso 4: Confirmar que no quedó ningún escritor de `raw` en ventas**

```bash
grep -rn "cleanRaw\|\braw:" scripts/sync/*.ts
```

Esperado: solo la definición en `helpers.ts`. Ninguna referencia en `syncVentas.ts`.

- [ ] **Paso 5: Commit**

```bash
git add scripts/sync/syncVentas.ts
git commit -m "security(sync): ventas deja de espejar el JSON crudo de NocoDB"
```

---

### Task 4: Desplegar y verificar una corrida real

El DROP de la Task 5 depende de que **producción** ya corra este código. Verificar el deploy, no asumirlo.

**Files:**
- Ninguno. Deploy sobre VPS `154.38.179.209`, servicio Swarm `yani-dashboard_yani_dashboard_sync` (imagen `yani-dashboard-sync:local`).

- [ ] **Paso 1: Llevar el código al VPS**

```bash
ssh root@154.38.179.209 'cd /opt/dashboard-yani-coach && git fetch origin && git status --short | head'
```

El árbol del VPS está sucio sobre `4ce1f68` (deuda conocida). Antes de tirar de `origin`, comparar los archivos que importan y decidir; **no** hacer `git checkout -f` a ciegas: `.env.build` / `.env.deploy` / `.env.sync` viven ahí sin trackear y tienen los tokens.

- [ ] **Paso 2: Rebuild y force-update**

Con tag `:local`, `stack deploy` **no** toma la imagen nueva — hay que forzar:

```bash
ssh root@154.38.179.209 'cd /opt/dashboard-yani-coach && \
  docker build -f scripts/sync/Dockerfile -t yani-dashboard-sync:local . && \
  docker service update --force --image yani-dashboard-sync:local yani-dashboard_yani_dashboard_sync'
```

- [ ] **Paso 3: Confirmar que el contenedor levantó**

```bash
ssh root@154.38.179.209 'docker service ps yani-dashboard_yani_dashboard_sync --no-trunc --format "{{.Name}}\t{{.CurrentState}}\t{{.Error}}" | head -3'
```

Esperado: la tarea más nueva en `Running`, sin error.

- [ ] **Paso 4: Disparar un sync a mano y ver el resultado**

El servicio solo escucha en la overlay interna, así que se dispara desde adentro del contenedor:

```bash
ssh root@154.38.179.209 'CID=$(docker ps -q -f name=yani-dashboard_yani_dashboard_sync | head -1); \
  docker exec "$CID" sh -c "curl -s -m 1500 -X POST localhost:3000/run" | head -c 600'
```

Esperado: JSON con `"ok":true`. Si devuelve 409, hay un sync en curso: esperar y reintentar.

- [ ] **Paso 5: Verificar en la base que la corrida entró y no rompió nada**

```sql
select status, rows_inserted, rows_updated, rows_failed, error, finished_at
from public.sync_runs where table_name='ventas' order by started_at desc limit 3;
```

Esperado: última corrida `status = 'ok'`, `rows_failed = 0`, `error` nulo.

- [ ] **Paso 6: Re-verificar el invariante después de que producción escribió**

```sql
select (select count(*) from public.ventas v join public._refactor_ventas_baseline b using (id)
          where v.es_duplicado is distinct from b.es_duplicado) as filas_que_cambiaron,
       (select count(*) from public.ventas where origen is not null) as con_origen,
       (select round(sum(amount) filter (where not es_duplicado),2) from public.ventas) as ingreso_neto;
```

Esperado: `filas_que_cambiaron = 0`; `con_origen` sin cambios (el sync no lo toca); `ingreso_neto` = línea base **más** las ventas nuevas que hayan entrado, si entraron. Si subió, verificar que el delta se explique con filas cuyo `synced_at` sea posterior al snapshot — no aceptarlo sin explicar.

**Esta es la barrera crítica.** Si el Paso 6 no da limpio, no se pasa a la Task 5.

---

### Task 5: Migración 24 — dropear `raw`

**Files:**
- Crear: `supabase/migrations/20260729160000_24_ventas_drop_raw.sql`

**Interfaces:**
- Consume: Tasks 2, 3 y 4 completas y verificadas.
- Produce: `ventas` sin `raw`. Irreversible una vez borrado el snapshot (Task 6).

- [ ] **Paso 1: Confirmar que nada depende ya de `raw`**

```sql
select distinct dependente.relname as objeto_dependiente, dependente.relkind
from pg_depend d
join pg_class dependente on dependente.oid = d.objid
join pg_class origen on origen.oid = d.refobjid
join pg_attribute a on a.attrelid = d.refobjid and a.attnum = d.refobjsubid
where origen.relname = 'ventas' and a.attname = 'raw';
```

Esperado: **0 filas**. Si aparece algo, parar y resolver esa dependencia primero.

- [ ] **Paso 2: Escribir la migración**

```sql
-- Migración 24 (2026-07-29): dropear `ventas.raw`.
--
-- Requisitos cumplidos antes de esta migración:
--   - Migración 23: `es_duplicado` se calcula desde la columna `origen`, no desde `raw`.
--   - syncVentas.ts desplegado en el VPS sin escribir `raw` (verificado con una corrida real).
--   - pg_depend: cero objetos dependen de ventas.raw.
--
-- Qué se va con la columna: los 444 nombres de comprador y los 30 `stripe_customer`
-- que `anon` podía leer con la key que viaja en el bundle del navegador.
-- El JSON crudo sigue existiendo en NocoDB, que es su lugar. El espejo es una caché
-- de lectura para el dashboard, y el dashboard nunca leyó `raw` (grep en src/ = 0).

alter table public.ventas drop column raw;
```

- [ ] **Paso 3: Aplicarla**

Vía `mcp__supabase__apply_migration`, nombre `24_ventas_drop_raw`.

- [ ] **Paso 4: Verificación final — cierre y totales**

```sql
select (select count(*) from information_schema.columns
          where table_schema='public' and table_name='ventas' and column_name='raw') as raw_existe,
       (select count(*) from public.ventas v join public._refactor_ventas_baseline b using (id)
          where v.es_duplicado is distinct from b.es_duplicado) as filas_que_cambiaron,
       (select count(*) from public.ventas) as total,
       (select count(*) filter (where es_duplicado) from public.ventas) as duplicadas,
       (select round(sum(amount) filter (where not es_duplicado),2) from public.ventas) as ingreso_neto;
```

Esperado: `raw_existe = 0`; `filas_que_cambiaron = 0`; `total`, `duplicadas` e `ingreso_neto` coincidiendo con la Bitácora (más las ventas nuevas explicadas en la Task 4).

- [ ] **Paso 5: Verificar la exposición desde el rol `anon`**

Simular al anónimo de verdad, no deducirlo del catálogo:

```sql
create temp table _chk(que text, valor bigint);
do $$
declare n bigint;
begin
  set local role anon;
  select count(*) into n from public.ventas;
  reset role;
  insert into _chk values ('filas_ventas_visibles_anon', n);
end $$;
select * from _chk;
```

Esperado: `filas_ventas_visibles_anon` = las netas (1.515 en la línea base). Que siga viendo las filas es correcto — el dashboard las necesita. Lo que cambió es que ya no vienen con el JSON adentro.

- [ ] **Paso 6: Refrescar matviews y comparar contra la Task 2**

```sql
select public.refresh_materialized_views();
select sum(ventas_monto) as monto_total, sum(ventas_cantidad) as cantidad
from public.mv_sales_trend_monthly;
```

Esperado: idéntico a lo anotado en el Paso 5 de la Task 2.

- [ ] **Paso 7: Commit**

```bash
git add supabase/migrations/20260729160000_24_ventas_drop_raw.sql
git commit -m "security(db): migración 24 — dropear ventas.raw del espejo"
```

**Rollback de la Task 5:** mientras el snapshot exista, `raw` se restaura:

```sql
alter table public.ventas add column raw jsonb not null default '{}'::jsonb;
update public.ventas v set raw = b.raw from public._refactor_ventas_baseline b where b.id = v.id;
```

---

### Task 6: Cierre — borrar el snapshot y documentar

El snapshot tiene los 444 nombres. Dejarlo ahí sería reintroducir el problema que este refactor cierra.

- [ ] **Paso 1: Última confirmación antes de quemar la red**

Releer la Bitácora: los cinco números de la Task 5 Paso 4 tienen que estar anotados y cuadrar. Si falta uno, volver a medir antes de seguir.

- [ ] **Paso 2: Dropear el snapshot**

```sql
drop table public._refactor_ventas_baseline;
```

- [ ] **Paso 3: Verificar que no quedó rastro**

```sql
select count(*) as tablas_temporales
from information_schema.tables
where table_schema='public' and table_name like '\_refactor%';
```

Esperado: **0**.

- [ ] **Paso 4: Documentar en `.brain/supabase_setup.md`**

Agregar la conclusión: `ventas.origen` es columna real, `es_duplicado` se calcula desde ella (no desde `raw`), `raw` ya no existe en **ninguna** tabla del espejo, y los cortes de fecha (2026-06-01 / 2026-06-09) siguen siendo la regla de deduplicación del backfill CSV. Registrar también la exposición que se cerró: 444 nombres de comprador + 30 `stripe_customer` que `anon` podía leer.

Nota: `.brain/` está gitignorado desde el commit `2c837bf`, así que este cambio no entra al repo — es memoria local a propósito.

- [ ] **Paso 5: Commit y push**

```bash
git add -A && git status --short
git commit -m "docs: cierre del refactor de ventas — el espejo queda sin JSON crudo"
git push origin feature/fase1-senal-respondio
```

---

## Bitácora de ejecución

Se completa al ejecutar. Los valores medidos mandan sobre los escritos en este plan.

| Momento | Total | Dup. | Ingreso neto | Ingreso bruto | `filas_que_cambiaron` |
|---|---|---|---|---|---|
| Línea base (Task 1) | | | | | — |
| Post migración 23 (Task 2) | | | | | |
| Post corrida real (Task 4) | | | | | |
| Post DROP (Task 5) | | | | | |

| Momento | `mv_sales_trend_monthly` monto | cantidad |
|---|---|---|
| Task 2 Paso 5 | | |
| Task 5 Paso 6 | | |

---

## Puntos de no retorno

1. **Task 5 Paso 3** (`drop column raw`) — reversible solo mientras viva el snapshot.
2. **Task 6 Paso 2** (`drop table _refactor_ventas_baseline`) — a partir de acá, `raw` solo existe en NocoDB.

Entre 1 y 2 conviene dejar pasar al menos un ciclo de sync (1 h) con el dashboard funcionando, para que un problema aparezca mientras la red todavía está puesta.
