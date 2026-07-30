# Baseline vivo pre-cierre espejo anon — 2026-07-29 / medido 2026-07-30

Task 0 del plan `PLAN_CIERRE_ESPEJO_ANON_2026-07-29`. Red de seguridad: todo número
aquí se midió en vivo contra producción (`mcp__supabase__execute_sql`, SOLO SELECT,
proyecto `dwnxldvrrzkqsqzlcvwt`, PG 17.6) el **2026-07-30 ~20:40 UTC**. Ningún número
viene de `.brain/` ni de memoria — la SQL de cada fila corrió realmente y su resultado
se pegó tal cual.

**Tenant UUID usado en todo `p_tenant_id` / `tenant_id`:** `7558d73a-e97b-4422-ab5c-db87f6626592`
(descubierto vía `select distinct tenant_id from public.mv_funnel_counts;` — coincide
con el prefijo `7558d7…` del brief).

**Rangos usados en todo el documento:**
- **(a) all-time** — sin filtro de fecha (NULL/NULL en las funciones, sin `.gte/.lte` en SQL).
- **(b) mes fijo** — `[2026-07-01T00:00:00Z, 2026-07-31T23:59:59.999Z]` inclusive.

Este archivo es para diffear después del cierre de las 3 tablas al `anon` key: si un
número cambia de valor (no de mecanismo de lectura), algo se rompió.

---

## Step 1 — KPIs vía `get_funnel_respondio` (función viva, 9 columnas)

Firma real (leída de `pg_proc`):
`get_funnel_respondio(p_tenant_id uuid, p_start timestamptz DEFAULT NULL, p_end timestamptz DEFAULT NULL)`
retorna `TABLE(leads_nuevos bigint, primer_mensaje bigint, respondieron bigint, interesados bigint, agendo bigint, venta_cerrada bigint, venta_cerrada_monto numeric, venta_perdida bigint, tiempo_resp_mediana_min numeric)`.

### (a) All-time

```sql
select * from get_funnel_respondio('7558d73a-e97b-4422-ab5c-db87f6626592'::uuid, null, null);
```

| leads_nuevos | primer_mensaje | respondieron | interesados | agendo | venta_cerrada | venta_cerrada_monto | venta_perdida | tiempo_resp_mediana_min |
|---|---|---|---|---|---|---|---|---|
| 33067 | 3946 | 2140 | 351 | 274 | 1565 | 110537 | 419 | 129.8 |

### (b) Mes 2026-07

```sql
select * from get_funnel_respondio('7558d73a-e97b-4422-ab5c-db87f6626592'::uuid, '2026-07-01'::timestamptz, '2026-07-31'::timestamptz);
```

| leads_nuevos | primer_mensaje | respondieron | interesados | agendo | venta_cerrada | venta_cerrada_monto | venta_perdida | tiempo_resp_mediana_min |
|---|---|---|---|---|---|---|---|---|
| 800 | 621 | 377 | 19 | 14 | 347 | 23876 | 28 | 95.6 |

---

## Step 2 — 4 KPIs crudos (replica de `getKpiCounts`, dataSource.ts:364–427)

Reglas copiadas del código:
- `leads_created` = `count(*)` de `contactos` en rango por `nocodb_created_at`.
- `new_leads` = idem + `estado_simplificado='Nuevo'`.
- `urgent_follow_ups` = `contactos` con `estado_simplificado NOT IN ('Venta Cerrada','Venta Perdida') AND proximo_contacto < now() AND proximo_contacto IS NOT NULL`. **No tiene rango de fecha en el código** (no se filtra por `nocodb_created_at`) — un solo valor, no dos.
- `sales_count` = `count(*)` de `ventas` en rango por `fecha`, **sin filtro `es_duplicado`** (así está el código hoy — a diferencia de `getSales()`/`EquipoView`, que sí dedupean).

### (a) All-time

```sql
select
  (select count(*) from public.contactos where tenant_id='7558d73a-e97b-4422-ab5c-db87f6626592') as leads_created_alltime,
  (select count(*) from public.contactos where tenant_id='7558d73a-e97b-4422-ab5c-db87f6626592' and estado_simplificado='Nuevo') as new_leads_alltime,
  (select count(*) from public.contactos where tenant_id='7558d73a-e97b-4422-ab5c-db87f6626592' and estado_simplificado not in ('Venta Cerrada','Venta Perdida') and proximo_contacto < now() and proximo_contacto is not null) as urgent_follow_ups_now,
  (select count(*) from public.ventas where tenant_id='7558d73a-e97b-4422-ab5c-db87f6626592') as sales_count_alltime;
```

| leads_created | new_leads | urgent_follow_ups (⚠️ depende de `now()`, ver nota) | sales_count |
|---|---|---|---|
| 33067 | 24255 | 5761 | 1989 |

> ⚠️ **`urgent_follow_ups` es intrínsecamente dependiente del tiempo** (`proximo_contacto < now()`).
> El valor `5761` es válido solo para el instante de medición (**2026-07-30 ~20:40 UTC**).
> Cuando se re-mida tras el cierre, este número habrá cambiado por el simple paso del
> tiempo — eso NO es una regresión. Para verificar "no cambió nada" en este KPI hay que
> comparar el **mecanismo** (misma condición SQL, mismo resultado si se corre en el
> mismo instante lógico), no el valor absoluto.

### (b) Mes 2026-07

`urgent_follow_ups` no tiene variante fechada en el código (ver arriba), así que no se repite aquí.

```sql
select
  (select count(*) from public.contactos where tenant_id='7558d73a-e97b-4422-ab5c-db87f6626592'
     and nocodb_created_at >= '2026-07-01T00:00:00Z' and nocodb_created_at <= '2026-07-31T23:59:59.999Z') as leads_created_month,
  (select count(*) from public.contactos where tenant_id='7558d73a-e97b-4422-ab5c-db87f6626592'
     and estado_simplificado='Nuevo'
     and nocodb_created_at >= '2026-07-01T00:00:00Z' and nocodb_created_at <= '2026-07-31T23:59:59.999Z') as new_leads_month,
  (select count(*) from public.ventas where tenant_id='7558d73a-e97b-4422-ab5c-db87f6626592'
     and fecha >= '2026-07-01T00:00:00Z' and fecha <= '2026-07-31T23:59:59.999Z') as sales_count_month;
```

| leads_created | new_leads | sales_count |
|---|---|---|
| 800 | 134 | 347 |

---

## Step 3 — Volúmenes que hoy bajan al navegador (arrays, LIMIT 1000)

Réplica de `getContacts` (dataSource.ts:111–142, orden `nocodb_created_at desc`, `LIMIT 1000`),
`getInteractions` (153–176, orden `fecha desc`, `LIMIT 1000`) y `getAttempts`
(284–309, orden `fecha desc`, `LIMIT 1000`). Ninguna de las tres filtra por
`es_duplicado` (eso solo aplica a `ventas`/`getSales`).

Se midió el **conteo real de filas en el rango** (SQL `count(*)`, sin límite) — es el
número contra el que hay que diffear tras el cierre. Donde el conteo real supera 1000,
se anota el "entregado" real (lo que el navegador efectivamente recibe hoy: los 1000
más recientes por la columna de orden), porque **ese** es el número visible en pantalla,
no el conteo total.

### (a) All-time

```sql
select
  (select count(*) from public.contactos where tenant_id='7558d73a-e97b-4422-ab5c-db87f6626592') as contactos_alltime,
  (select count(*) from public.interacciones where tenant_id='7558d73a-e97b-4422-ab5c-db87f6626592') as interacciones_alltime,
  (select count(*) from public.intentos_compra where tenant_id='7558d73a-e97b-4422-ab5c-db87f6626592') as intentos_compra_alltime;
```

| tabla | count real | entregado hoy (cap LIMIT 1000) |
|---|---|---|
| contactos | 33067 | **1000** (capado — se pierden 32067 filas) |
| interacciones | 34554 | **1000** (capado — se pierden 33554 filas) |
| intentos_compra | 291 | 291 (bajo el límite) |

### (b) Mes 2026-07

```sql
select
  (select count(*) from public.contactos where tenant_id='7558d73a-e97b-4422-ab5c-db87f6626592'
     and nocodb_created_at >= '2026-07-01T00:00:00Z' and nocodb_created_at <= '2026-07-31T23:59:59.999Z') as contactos_month,
  (select count(*) from public.interacciones where tenant_id='7558d73a-e97b-4422-ab5c-db87f6626592'
     and fecha >= '2026-07-01T00:00:00Z' and fecha <= '2026-07-31T23:59:59.999Z') as interacciones_month,
  (select count(*) from public.intentos_compra where tenant_id='7558d73a-e97b-4422-ab5c-db87f6626592'
     and fecha >= '2026-07-01T00:00:00Z' and fecha <= '2026-07-31T23:59:59.999Z') as intentos_compra_month;
```

| tabla | count real | entregado hoy (cap LIMIT 1000) |
|---|---|---|
| contactos | 800 | 800 (bajo el límite) |
| interacciones | 6511 | **1000** (capado — se pierden 5511 filas) |
| intentos_compra | 89 | 89 (bajo el límite) |

> ⚠️ **Hallazgo (preexistente, no introducido por Task 0):** el cap de 1000 filas ya
> recorta hoy `contactos` all-time y `interacciones` en all-time y en el mes de julio.
> Cualquier tarea futura que toque el `LIMIT`/paginación de estos endpoints DEBE
> compararse contra el **count real** de esta tabla, no contra el "entregado hoy" — si
> el cap se levanta, el número visible en pantalla subirá legítimamente sin que eso sea
> una regresión del cierre del `anon`.

---

## Step 4 — Snapshot per-vendedora de EquipoView (mes fijo 2026-07)

Réplica de `EquipoView.tsx:455–594`. Fuentes verificadas en `App.tsx`/`useDashboardData.ts`/
`cacheService.ts`:
- `sales` prop = `getSales(dateRange)` → excluye `es_duplicado=true` (mantiene `false`/`null`), filtrado por `fecha` en el mes.
- `contacts` prop = `getContacts(dateRange)` → filtrado por `nocodb_created_at` en el mes, `LIMIT 1000` (el mes trae 800, no se capa).
- `interactions` prop = `getInteractions(dateRange)` → filtrado por `fecha` en el mes, `LIMIT 1000`, orden `fecha desc` (el mes trae 6511 → **se capa a los 1000 más recientes**, ver Step 3). El breakdown Llamadas/WhatsApp/Email de `EquipoView` corre sobre ese array ya capado, así que el SQL de abajo replica el cap con un `ORDER BY fecha DESC LIMIT 1000` antes de agrupar — es la única forma honesta de reproducir lo que la UI muestra hoy.
- `salesAmount` = `sum(amount)` de las ventas del vendedor.
- `activeLeads` = contactos del vendedor (dentro del array `contacts`, ya limitado al mes) con estado en `[NEW, CONTACTED, INTERESTED]` → en `estado_simplificado` crudo esto equivale a "no Venta Cerrada y no Venta Perdida" (el mapeo `toLeadStatus` manda `null`/`'Otro'`/cualquier valor no reconocido a `NEW`, que sí cuenta como activo).
- `leadsAssigned` = contactos del vendedor dentro del array `contacts` que además caen en el rango (redundante hoy porque `contacts` ya viene filtrado por servidor al mismo rango — confirmado en `cacheService.filterByDateRange`, rama `isSameDateRange`).

Vendedoras activas (de `mv_vendedora_performance`, tenant `7558d7…`): `1=Melanie González (Inactivo)`, `2=María del Carmen Vera (Activo)`, `3=María Beatriz Juzviachik (Activo)`.

### Sales + contactos (mes 2026-07)

```sql
with sellers as (
  select vendedora_nocodb_id, nombre from public.mv_vendedora_performance where tenant_id='7558d73a-e97b-4422-ab5c-db87f6626592'
),
sales_m as (
  select vendedora_nocodb_id, count(*) as sales_count, sum(amount) as sales_amount
  from public.ventas
  where tenant_id='7558d73a-e97b-4422-ab5c-db87f6626592'
    and not (es_duplicado is true)
    and fecha >= '2026-07-01T00:00:00Z' and fecha <= '2026-07-31T23:59:59.999Z'
  group by vendedora_nocodb_id
),
contacts_m as (
  select vendedora_nocodb_id,
    count(*) as leads_assigned,
    count(*) filter (where estado_simplificado is distinct from 'Venta Cerrada' and estado_simplificado is distinct from 'Venta Perdida') as active_leads
  from public.contactos
  where tenant_id='7558d73a-e97b-4422-ab5c-db87f6626592'
    and nocodb_created_at >= '2026-07-01T00:00:00Z' and nocodb_created_at <= '2026-07-31T23:59:59.999Z'
  group by vendedora_nocodb_id
)
select s.vendedora_nocodb_id, s.nombre,
  coalesce(sm.sales_count,0) as sales_count,
  coalesce(sm.sales_amount,0) as sales_amount,
  coalesce(cm.leads_assigned,0) as leads_assigned,
  coalesce(cm.active_leads,0) as active_leads
from sellers s
left join sales_m sm on sm.vendedora_nocodb_id = s.vendedora_nocodb_id
left join contacts_m cm on cm.vendedora_nocodb_id = s.vendedora_nocodb_id
order by s.vendedora_nocodb_id;
```

| vendedora_id | nombre | salesCount | salesAmount | leadsAssigned | activeLeads |
|---|---|---|---|---|---|
| 1 | Melanie González | 0 | 0 | 0 | 0 |
| 2 | María del Carmen Vera | 93 | 6273.00 | 392 | 391 |
| 3 | María Beatriz Juzviachik | 126 | 10702.00 | 377 | 369 |

**Nota (verificada):** `sales_count` deduped total del mes = 93+126 = 219, mientras que el KPI
crudo del Step 2 (`sales_count_month`, sin dedup y sin filtro de vendedora) es 347. No es
un bug de dedup — se comprobó que en julio `es_duplicado` es `false` en las 347 filas
(`dup_true=0`); la diferencia son **128 ventas sin `vendedora_nocodb_id` asignado**
(verificado con `count(*) filter (where not es_duplicado is true and vendedora_nocodb_id is null) = 128`).
Esas 128 no aparecen en ninguna fila de vendedora de `EquipoView` — comportamiento
actual, no algo que Task 0 deba arreglar.

### Interacciones (mes 2026-07, capadas a las 1000 más recientes por `fecha desc` — igual que la UI)

```sql
with capped as (
  select vendedora_nocodb_id, medio_canal, tipo, fecha
  from public.interacciones
  where tenant_id='7558d73a-e97b-4422-ab5c-db87f6626592'
    and fecha >= '2026-07-01T00:00:00Z' and fecha <= '2026-07-31T23:59:59.999Z'
  order by fecha desc
  limit 1000
),
classified as (
  select vendedora_nocodb_id,
    case
      when lower(coalesce(medio_canal, tipo, '')) like '%whatsapp%' then 'WhatsApp'
      when lower(coalesce(medio_canal, tipo, '')) like '%llamada%' then 'Llamadas'
      when lower(coalesce(medio_canal, tipo, '')) like '%email%' then 'Email'
      else 'Otro'
    end as tipo_norm
  from capped
)
select vendedora_nocodb_id,
  count(*) as interactions_count,
  count(*) filter (where tipo_norm='Llamadas') as llamadas,
  count(*) filter (where tipo_norm='WhatsApp') as whatsapp,
  count(*) filter (where tipo_norm='Email') as email,
  count(*) filter (where tipo_norm='Otro') as otro
from classified
group by vendedora_nocodb_id
order by vendedora_nocodb_id;
```

| vendedora_id | interactionsCount | Llamadas | WhatsApp | Email | Otro (no clasificado en la UI) |
|---|---|---|---|---|---|
| 2 (María del Carmen Vera) | 314 | 2 | 287 | 24 | 1 |
| 3 (María Beatriz Juzviachik) | 306 | 0 | 278 | 28 | 0 |
| NULL (sin vendedora) | 380 | 0 | 90 | 0 | 290 |

(314 + 306 + 380 = 1000, confirma el cap. Vendedora 1 no aparece — 0 interacciones
capadas. Las 380 con `vendedora_nocodb_id IS NULL` no matchean ningún `seller.id` en
`EquipoView`, así que hoy no se suman a ninguna fila de vendedora — quedan invisibles
en el tablero pero están en el array.)

> ⚠️ **Confirmación del cap:** julio tiene 6511 interacciones reales pero la UI de hoy
> solo ve las 1000 más recientes. El breakdown por vendedora arriba refleja **lo que
> `EquipoView` efectivamente calcula y muestra hoy**, no el total real del mes. Ver
> también Step 3.

---

## Step 5 — `get_advisors(type=security)` — baseline

Corrido el 2026-07-30. 10 findings, ninguno menciona explícitamente `contactos`,
`interacciones` ni `intentos_compra` como tabla expuesta — el advisor de Supabase solo
reporta RLS faltante, `search_path` mutable, materialized views expuestas por la API y
funciones `SECURITY DEFINER` ejecutables por `anon`/`authenticated`. La exposición de
`contactos`/`interacciones`/`intentos_compra` al `anon` (documentada en memoria del
proyecto: `dashboard_anon_key_publica_expone_tablas`) es por **política RLS `USING (true)`**,
no por ausencia de RLS — por eso el advisor no la marca. Este listado es el baseline
de lo que el advisor SÍ marca hoy; sirve para comparar que el cierre no introduce
nuevos findings de este tipo.

| # | name | level | detail |
|---|---|---|---|
| 1 | rls_enabled_no_policy | INFO | `public.plantillas_catalogo` tiene RLS habilitado pero sin políticas |
| 2 | rls_enabled_no_policy | INFO | `public.plantillas_envios` tiene RLS habilitado pero sin políticas |
| 3 | function_search_path_mutable | WARN | `public.get_funnel_respondio` con `search_path` mutable |
| 4 | materialized_view_in_api | WARN | `public.mv_funnel_counts` seleccionable por `anon`/`authenticated` |
| 5 | anon_security_definer_function_executable | WARN | `get_plantillas_stats(...)` ejecutable por `anon` vía RPC (SECURITY DEFINER) |
| 6 | anon_security_definer_function_executable | WARN | `get_responsividad(...)` ejecutable por `anon` vía RPC (SECURITY DEFINER) |
| 7 | anon_security_definer_function_executable | WARN | `get_responsividad_general(...)` ejecutable por `anon` vía RPC (SECURITY DEFINER) |
| 8 | authenticated_security_definer_function_executable | WARN | `get_plantillas_stats(...)` ejecutable por `authenticated` vía RPC |
| 9 | authenticated_security_definer_function_executable | WARN | `get_responsividad(...)` ejecutable por `authenticated` vía RPC |
| 10 | authenticated_security_definer_function_executable | WARN | `get_responsividad_general(...)` ejecutable por `authenticated` vía RPC |

**Nota:** solo 10 findings hoy y ninguno cubre `contactos`/`interacciones`/`intentos_compra`
directamente. La tarea siguiente que cierre esas 3 tablas al `anon` debe verificar el
cambio con una query directa de grants (`information_schema.role_table_grants` o probar
un `select` con la `anon` key) — el diff contra `get_advisors` por sí solo NO va a mostrar
que esas tablas "dejaron de estar expuestas", porque el advisor nunca las marcó como
expuestas para empezar. Esto se deja anotado explícitamente para que la tarea de cierre
no asuma que un `get_advisors` limpio prueba el cierre.

---

## Resumen de sorpresas / notas para tareas siguientes

1. `urgent_follow_ups` es dependiente de `now()` — no comparar el valor absoluto, comparar el mecanismo (ver Step 2).
2. `contactos` y `interacciones` ya están capadas a 1000 filas hoy (all-time, y en julio para interacciones) — preexistente, no confundir con una regresión del cierre (ver Step 3).
3. 128 ventas de julio no tienen `vendedora_nocodb_id` — no cuentan en ninguna fila de `EquipoView` (ver Step 4).
4. El breakdown de interacciones por vendedora en `EquipoView` está calculado sobre un array ya capado a 1000 filas — 380 de esas 1000 no tienen vendedora asignada y quedan invisibles en el tablero (ver Step 4).
5. `get_advisors(security)` no marca hoy la exposición de `contactos`/`interacciones`/`intentos_compra` al `anon` — es por política RLS `USING(true)`, no por falta de RLS, así que el advisor no la detecta como finding (ver Step 5).
