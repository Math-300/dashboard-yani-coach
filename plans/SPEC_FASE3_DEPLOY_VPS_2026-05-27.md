# Fase 3 — Deploy al VPS · Diseño (Spec)

**Fecha:** 2026-05-27
**Estado:** Aprobado por el usuario (yanizcoach@gmail.com)
**Precede a:** `PLAN_FASE3_DEPLOY_VPS_2026-05-27.md`

## Objetivo

El Dashboard Yani Coach corriendo en producción en el VPS del usuario (Traefik +
Docker Swarm), sirviendo el diseño dorado ya aprobado, protegido por login de
contraseña, con los datos refrescándose automáticamente cada hora — sin Vercel y
sin tocar los workflows operativos de n8n.

## Decisiones tomadas (gating)

| Decisión | Elección | Razón |
|----------|----------|-------|
| Reverse proxy | **Traefik** (labels Swarm) | Es el que ya enruta n8n y Chatwoot en el VPS |
| Dominio | **TBD** → parametrizado como `${DASHBOARD_DOMAIN}` | El usuario lo define al desplegar |
| Auth / API | **Login por contraseña, sin chat IA** | Mínima superficie; chat IA fuera de alcance v1 |
| Frontend serving | **Un contenedor Express** (static + `/api/auth`) | Una imagen, una label Traefik, una cosa que desplegar |
| Scheduler del sync | **Timer interno cada 1h** | Dashboard autocontenido, cero dependencia de n8n |

## Arquitectura

Dos servicios en la overlay externa `Yanicoach` (la misma que n8n), ambos detrás de Traefik.

```
                         ┌─ Traefik (TLS Let's Encrypt) ─┐
  Browser ── HTTPS ──────┤  Host(${DASHBOARD_DOMAIN})    │
                         └──────────────┬────────────────┘
                                        │
                         ┌──────────────▼──────────────┐
                         │  yani_dashboard_web  (NUEVO) │
                         │  Express: sirve dist/ (SPA)  │
                         │  + /api/auth/* (login)       │
                         │  env: ANON key, AUTH_*       │  ← NO service_role
                         └──────────────────────────────┘
   NocoDB+Chatwoot ──▶   ┌──────────────────────────────┐
                         │  yani_dashboard_sync (EXISTE) │
                         │  timer interno cada 1h → sync │──▶ Supabase (espejo)
                         │  + POST /run manual           │
                         │  env: SERVICE_ROLE_KEY        │  ← solo server-side
                         └──────────────────────────────┘
```

Supabase es el **espejo/caché**, no la fuente: solo muestra lo que el sync copió.
El sync (TypeScript/Node) es el único puente NocoDB/Chatwoot → Supabase. La lectura
del panel desde Supabase (anon) ya funciona desde Fase 2; no se re-construye.

## Componentes

### 1. `yani_dashboard_web` (nuevo)

- **Dockerfile multi-stage** en la raíz del repo:
  - *Stage build:* `node:20-alpine`, `npm ci`, `vite build` → `dist/`. Las vars
    `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` se inyectan como build args
    (Vite las hornea en el bundle en build-time).
  - *Stage runtime:* node slim, copia `dist/` + el server Express, corre el server.
- **Server Express** (`server/web.ts` o similar):
  - Sirve `dist/` como estático, con fallback SPA: cualquier ruta que no empiece con
    `/api/` devuelve `index.html` (equivalente al rewrite de `vercel.json`).
  - Monta 3 rutas portadas: `POST /api/auth/login`, `POST /api/auth/logout`,
    `GET /api/auth/session`.
  - `GET /health` → 200 para el healthcheck de Traefik/Swarm.
- **Auth portado a módulo agnóstico** `api/auth/core.ts`: extrae las funciones hoy
  duplicadas en los 3 archivos Vercel (`sign`, `verifyToken`, `buildCookie`,
  `base64Url`, `parseCookies`, constantes `COOKIE_NAME`/`COOKIE_TTL_SECONDS`).
  Mecánica idéntica: cookie HMAC-SHA256 `yd_auth`, `AUTH_SECRET` + `AUTH_PASSWORD`,
  TTL 12h, `HttpOnly; SameSite=Strict; Secure` en prod. **El frontend
  (`services/authService.ts`) NO cambia** — sigue llamando a `/api/auth/*`.
- **Ocultar ChatAssistant:** como se descarta `/api/chat`, el `ChatAssistant` no debe
  montarse (botón muerto = "feature rota a la vista", viola la regla cero-tolerancia).
  Se desmonta vía una bandera de build/config; el componente NO se borra (queda para
  cuando se retome el chat IA).
- **Labels Traefik:** `Host(${DASHBOARD_DOMAIN})`, entrypoint websecure + certresolver.
  Los **nombres exactos** de entrypoint y certresolver se copian de un servicio ya
  enrutado (n8n/Chatwoot) — primer paso del plan, no se inventan.
- **Env:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (build args), `AUTH_PASSWORD`,
  `AUTH_SECRET`, `NODE_ENV=production`. **Nunca** `service_role`.

### 2. `yani_dashboard_sync` (extender lo existente)

- **Refactor:** extraer la lógica "correr el pipeline" que hoy vive embebida en
  `POST /run` de `scripts/sync/server.ts` a una función reutilizable con guarda de
  solapamiento (el flag `running` que ya existe).
- **Timer interno:** función pura `scheduleSync(intervalMs, runFn)` que dispara `runFn`
  cada `intervalMs` (1h) y respeta la guarda anti-solape. Se monta al arrancar el
  server. `POST /run` se mantiene para refresh manual.
- **Fallo visible (no morir el contenedor):** en modo timer un fallo del pipeline NO
  debe tumbar el contenedor cada hora. El fallo queda **visible** marcando el
  `sync_run` correspondiente como `status='error'` (hoy el orquestador solo hace
  `exit 1`). Se loguea claro. Esto respeta cero-tolerancia: el fallo es real y
  consultable en la tabla `sync_runs`, no se traga.
- **Env sin cambios** (service_role, NocoDB token, IDs de tabla, tenant slug).

### 3. Stack único `docker-stack.yml`

- Reemplaza a `docker-compose.sync.yml`: define **ambos** servicios (`yani_dashboard_web`
  + `yani_dashboard_sync`) en la overlay `Yanicoach`. Un solo "Deploy" en Portainer.
- Mantiene las restart policies, límites de memoria y healthchecks del compose actual,
  y agrega los equivalentes para el servicio web.

## Flujo de datos

- **Cada 1h (frescura):** timer → pipeline → lee NocoDB/Chatwoot → escribe espejo
  Supabase → `resolve_foreign_keys` + `resolve_chatwoot_fks` → `refresh_materialized_views`
  → registra en `sync_runs`.
- **Continuo (lectura):** browser → Traefik → web → SPA → Supabase anon (datos) +
  `/api/auth` (login/sesión). Ya operativo desde Fase 2.

## Manejo de errores / observabilidad

- **Sync:** fallo del timer-run → `sync_run.status='error'` + log; contenedor sigue vivo.
  Healthcheck `GET /health` ya existe.
- **Web:** `/api/auth` responde códigos correctos (401 credenciales, 500 config
  incompleta); fallback SPA para rutas no-API; `GET /health` para healthcheck.
- **Swarm:** restart_policy on-failure y límites de memoria por servicio.

## Seguridad

- `service_role` **solo** en `yani_dashboard_sync` (server-side); jamás llega al browser.
- `yani_dashboard_web` solo recibe anon key + `AUTH_*`.
- Cookie `HttpOnly; SameSite=Strict; Secure` en prod (ya implementado).
- Secrets vía env del stack en Portainer; el plan documenta las vars requeridas.
- Deuda multi-tenant RLS (`USING(true)` + GRANT anon) sigue documentada; no bloquea
  el deploy single-tenant.

## Testing

- **TDD (unidades puras):**
  - `scheduleSync(intervalMs, runFn)` → timers fake: dispara tras el intervalo,
    no solapa si ya hay un run en curso.
  - `api/auth/core.ts` → round-trip sign/verify, firma inválida rechazada,
    token malformado rechazado.
- **Integración local:** `docker build` de ambas imágenes → levantar → `GET /health`,
  `POST /run`, cargar la SPA, login OK y login con contraseña errada.
- **Playwright smoke** contra el contenedor: login → dashboard carga → embudo renderiza,
  0 errores de consola (reusa el setup Playwright existente).

## Qué se deprecia / elimina

- `vercel.json`, `vercel.env.example`, `api/chat.ts`, devDep `@vercel/node` → se eliminan.
- Wrappers Vercel `api/auth/{login,logout,session}.ts` → su lógica se mueve a
  `api/auth/core.ts`; Express los reemplaza. (Se eliminan los wrappers; se conserva `core.ts`.)

## Fuera de alcance (explícito)

- Chat IA (`/api/chat`) y el botón ChatAssistant montado.
- CI/CD automático y registry de imágenes (build directo en el VPS, como ya se hace
  con la imagen de sync).
- Deuda RLS multi-tenant.
- Verificación visual pixel-a-pixel de las vistas no-Resumen contra el prototipo
  (tarea de frontend-design, separada del deploy).

## Criterios de éxito

1. `https://${DASHBOARD_DOMAIN}` carga con TLS válido detrás de Traefik.
2. Login con la contraseña maestra funciona; contraseña errada es rechazada.
3. El dashboard muestra el embudo y KPIs con datos reales de Supabase, 0 errores de consola.
4. El sync corre solo cada 1h y registra cada corrida en `sync_runs`; un fallo queda
   visible como `status='error'` sin tumbar el contenedor.
5. `service_role` no aparece en ningún bundle ni var del servicio web.
6. No hay botón de chat muerto en la UI.
