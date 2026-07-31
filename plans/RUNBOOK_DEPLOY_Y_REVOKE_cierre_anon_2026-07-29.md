# Runbook — Deploy prod + Revoke (cierre espejo anon)

Estado: Task 0–5 hechas y revisadas en la rama `cierre-espejo-anon` (HEAD `d0c14d6`).
Falta lo que requiere el VPS (lo hace el usuario) y el revoke final.

Objetivo: que el tenedor anónimo de la `anon` key horneada en el bundle **no pueda leer ni una fila** de
`contactos`, `interacciones`, `intentos_compra` — SIN que cambie ningún número del tablero.
`ventas` queda intacta (fuera de alcance, sin PII).

---

## Por qué en este orden (no saltarse)

El front YA no lee esas 3 tablas por anon: ahora pide las filas a `/api/metrics/*` (Express, service_role,
detrás de la cookie de sesión). PERO ese endpoint sólo existe en el contenedor web nuevo. Si se hace el
**revoke ANTES** de desplegar el contenedor nuevo, el tablero en prod (que sigue leyendo por anon) se queda
sin datos. Regla: **front arreglado y desplegado primero, revoke después** (lección migración-25).

---

## FASE A — Deploy de producción  (lo hace el usuario en el VPS)

Referencias: `Dockerfile.web`, `docker-stack.yml`, memorias `dashboard_produccion_deploy`,
`swarm_local_image_force_update`.

1. **Traer la rama al VPS** (o build desde el repo `/opt/dashboard-yani-coach`):
   ```
   git fetch && git checkout cierre-espejo-anon && git pull
   ```

2. **Build de la imagen web** (los `--build-arg VITE_*` son los mismos de hoy — anon key pública para el bundle):
   ```
   docker build -f Dockerfile.web \
     --build-arg VITE_SUPABASE_URL=... \
     --build-arg VITE_SUPABASE_ANON_KEY=... \
     --build-arg VITE_SUPABASE_TENANT_ID=7558d73a-e97b-4422-ab5c-db87f6626592 \
     -t yani-dashboard-web:local .
   ```
   (El runtime ya instala `@supabase/supabase-js@2.103.3` — arreglado en Task 3.)

3. **Setear las env NUEVAS del servicio web** en Portainer/Swarm (además de las que ya tenía):
   - `SUPABASE_URL` = la URL del proyecto (`https://dwnxldvrrzkqsqzlcvwt.supabase.co`)
   - `SUPABASE_SERVICE_ROLE_KEY` = **la service_role real** (secreto server-side; NUNCA al bundle, nunca al repo)
   - `SUPABASE_TENANT_ID` = `7558d73a-e97b-4422-ab5c-db87f6626592` (tiene default en el stack, pero setearla explícita)
   Ya usa `AUTH_PASSWORD` y `AUTH_SECRET` — no tocarlas.

4. **Redeploy del stack**. OJO memoria `swarm_local_image_force_update`: con tag `:local`, `stack deploy` NO
   toma la imagen nueva por sí solo. Forzar update de la imagen del servicio web (p.ej. `docker service update
   --force yani_dashboard_web`, o re-tag/re-deploy) para que corra el código nuevo, no sólo las env.

5. **Verificar en vivo, con sesión iniciada** (esto es el gate para Fase B):
   - Loguearse en `dashboard.yanicoach.com`.
   - Cargar Equipo, Ventas, Recuperación, Resumen. Los números deben coincidir con el baseline
     `plans/baseline_cierre_anon_2026-07-29.md` (tolerar drift de pocas filas — es actividad real de prod,
     ver nota LIVE DRIFT en el ledger). Estructura y magnitud idénticas; nada en cero ni faltante.
   - En la pestaña Red del navegador: `/api/metrics/contacts|interactions|attempts|product-buyers` responden
     200 con la cookie. Sin sesión deben dar 401.
   - Si algo sale en cero o falta → **PARAR, no hacer el revoke**, avisame y diagnosticamos.

---

## FASE B — Revoke  (Task 6 — IRREVERSIBLE-ish — sólo con Fase A verificada OK)

Sólo después de confirmar que el tablero en prod carga bien con las filas viniendo de `/api/metrics/*`.

1. **Migración 30** `supabase/migrations/20260730xxxxxx_30_revoke_anon_person_tables.sql`:
   `REVOKE SELECT ON contactos, interacciones, intentos_compra FROM anon;`
   (y de cualquier matview que exponga esas columnas y aún tenga grant a `anon` — revisar; memoria
   `mv_expone_columnas_que_la_tabla_revoca`: una matview tiene sus propios grants. `mv_vendedora_performance`
   ya tapada.) NO tocar `ventas`. NO tocar `authenticated` si el endpoint usa service_role (lo usa).

2. **Probar cierre — NO con get_advisors** (nunca listó estas 3: están abiertas por RLS `USING(true)`, no por
   RLS faltante — ver ledger Task 0). Probar con las dos evidencias:
   - `select has_table_privilege('anon','contactos','SELECT');` → **false** (y las otras 2).
   - Smoke con la anon key real contra las 3 tablas → **42501 permission denied**. De hecho, tras el revoke las
     3 líneas `contactos`/`interacciones`/`intentos_compra` del `scripts/smoke_datasource.ts` DEBEN pasar a
     rojo 42501 — eso es la señal de cierre, no un bug.

3. **Re-verificar el tablero en prod** con sesión: sigue idéntico al baseline (las filas ahora sólo llegan por
   `/api/metrics/*`, que usa service_role — inmune al revoke).

4. **Commit** de la migración 30 + cerrar el ledger.

---

## Rollback de la Fase B (si algo se rompe tras el revoke)
`GRANT SELECT ON contactos, interacciones, intentos_compra TO anon;` restaura el estado previo al instante.
(Vuelve a exponer los datos — sólo como medida temporal mientras se diagnostica.)

## Deudas anotadas para el review final (no bloquean el deploy)
- `api/auth/core.ts`: `verifyToken` no valida `iat` vs TTL server-side → una cookie capturada vale indefinido.
  Pre-existente, pero AHORA es la única defensa del endpoint `product-buyers` (nombres de clientas). Candidato
  a arreglar antes del merge.
- `services/dataSource.ts`: `requireTenant()` vestigial en las 4 funciones nuevas (no-op inofensivo).
- `scripts/web/metricsRoutes.ts`: query de nombre de vendedora usa columnas propias en vez de reusar `getSellers`.
