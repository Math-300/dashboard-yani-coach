# Plantillas (día a día) + Tiempo de respuesta humano — Diseño

**Fecha:** 2026-06-02
**Autor:** sesión Yani Coach
**Estado:** aprobado en dirección (decisiones de usuario tomadas), pendiente review del spec escrito

## Problema

1. La métrica "tiempo de respuesta del equipo" marca ~0 min porque cuenta como "respuesta" cualquier
   mensaje saliente posterior al inbound del lead — incluido el **mensaje automático** (templates y
   mensajes del bot/cuenta automática "Yanina Zapino"). Resultado: muestra "0 min" (mediana 2 seg en
   junio), que no es el tiempo real de la asesora humana. Engaña, aunque el dato sea técnicamente real.

2. No existe visibilidad de los **templates del día a día** (bienvenida, revisión de perfil IG, primer
   contacto, recordatorio de asesoría, etc.): cuántos se envían, si se entregan, si se abren (read
   receipt) y si el lead responde. Es información valiosa que hoy se pierde. **No** se habla de los
   masivos (campañas) — esos se excluyen.

## Decisiones del usuario (ya tomadas)

- **Separación día a día vs masivo:** automática. Un template es "masivo" si está linkeado a una
  campaña en `Campanias_Mensajeria` (NocoDB). El resto = día a día. Cero mantenimiento manual.
- **Tasa de apertura:** `leídos / entregados`, con una nota honesta en la UI de que algunos leads
  tienen el read receipt de WhatsApp desactivado (por eso un número bajo no significa "no lo leyeron").

## Hallazgos de datos (verificados contra Chatwoot/NocoDB en vivo)

Chatwoot (`/api/v1/accounts/1/conversations/{id}/messages`) ya entrega por mensaje todo lo necesario:
- `message_type`: 0=inbound (lead), 1=outbound, 2=activity.
- `private`: true para notas internas.
- `status`: `sent` | `delivered` | `read` | `failed`  ← **read receipt SÍ se captura.**
- `content_attributes.is_template_replay`: `true` en mensajes de template.
- `content_attributes.template_name`: ej. `"bienvenida_plataforma_v2"`.
- `sender.name` / `sender.type`: el automático lo manda "Yanina Zapino" (cuenta auto, no asesora).
- `id`: id del mensaje (para idempotencia del upsert).

Muestreo real (25 conversaciones, 72 outbound): status `{read:37, delivered:20, sent:12, failed:3}`;
templates `{revision_perfil_ig:17, bienvenida_plataforma_v2:5, primer_contacto_yanicoach:2}`;
senders `{Yanina Zapino:40, María Beatriz Juzviachik:12, María del Carmen Vera:20}`.

NocoDB:
- `Templates_Outbound` (mer3gkc3xj2stxj): catálogo (`template_name`, `shortcode`, `descripcion`,
  `activo`, link `Campanias_Mensajeria`). **Está incompleto** — no lista los templates reales más usados.
  Por eso NO es la fuente de verdad de envíos; sí sirve para descripciones y para derivar masivos.
- `Campanias_Mensajeria` (mddr3l9stxa4hl1): campañas (masivos), cada una con link `Template` → un
  registro de `Templates_Outbound`. Hoy: 1 campaña "Salto Cuántico 11 días" → template
  `salto_cuantico_11dias`. **Ese es el único masivo actual.**

Derivación de masivos: `masivo = { template_name de Templates_Outbound cuyo Campanias_Mensajeria ≠ [] }`.
Cualquier `template_name` visto en Chatwoot que NO esté en ese set = día a día.

## Arquitectura

Se extiende el pipeline existente (NocoDB+Chatwoot → Supabase → dashboard). Sin servicios nuevos.

### 1. Sync — captura enriquecida de mensajes

`scripts/sync/respondio.ts` → `ChatwootMessage` agrega: `id: number`, `status: string | null`,
`is_template_replay: boolean`, `template_name: string | null`, `sender_name: string | null`.

`scripts/sync/chatwootClient.ts` → `listMessages` mapea esos campos desde la respuesta cruda
(`m.content_attributes?.is_template_replay`, `m.content_attributes?.template_name`, `m.status`,
`m.sender?.name`).

### 2. Sync — tiempo de respuesta HUMANO

`deriveRespondio(messages, opts)` agrega parámetro `opts.automationSenders: Set<string>`
(default `new Set(['Yanina Zapino'])`, configurable). El cálculo de
`tiempo_primera_respuesta_seg` cambia: la "respuesta de la asesora" es el primer outbound
posterior al primer inbound que **además** cumpla:
- `is_template_replay !== true`, y
- `sender_name` NO está en `automationSenders`.

Si no existe tal mensaje humano → `tiempo_primera_respuesta_seg = null` (queda fuera de la mediana;
honesto: no sabemos el tiempo humano). `respondio` (señal de que el lead contestó) **no cambia**.

`get_responsividad` (RPC) ya lee `tiempo_primera_respuesta_seg`; al corregir la derivación, la
métrica pasa a reflejar el tiempo humano real sin tocar el RPC.

### 3. Sync — envíos de templates

Nueva tabla **`plantillas_catalogo`** (espejo liviano de Templates_Outbound):
`tenant_id, template_name (uniq), shortcode, descripcion, activo, es_masivo, synced_at`.
`es_masivo = (Campanias_Mensajeria ≠ [])`. Se sincroniza en un módulo nuevo `syncPlantillas.ts`.

Nueva tabla **`plantillas_envios`** (un row por template detectado en Chatwoot):
`id uuid pk, tenant_id, chatwoot_conversation_id, chatwoot_message_id (uniq con tenant),
template_name, es_masivo, enviado_at timestamptz, status, entregado bool, leido bool, fallido bool,
contacto_nocodb_id, respondido bool, synced_at`.
- `entregado = status in (delivered, read)`; `leido = status = read`; `fallido = status = failed`.
- `es_masivo`: lookup en el set de masivos derivado del catálogo; template desconocido → `false`.
- `respondido`: existe algún inbound (message_type=0, no private) en la conversación con
  `created_at > enviado_at` del template.
Se llena en el mismo loop de `syncChatwoot` (reusa los mensajes ya traídos; sin requests extra).
Upsert idempotente por `(tenant_id, chatwoot_message_id)`.

### 4. Base de datos — RPC de agregación

`get_plantillas_stats(p_tenant_id uuid, p_start timestamptz, p_end timestamptz)` →
filtra `plantillas_envios` por `enviado_at ∈ [start,end]` y `es_masivo = false`, agrupa por
`template_name`, devuelve:
`template_name, shortcode, descripcion, enviados, entregados, leidos, fallidos, respondidos,
tasa_entrega (entregados/enviados), tasa_apertura (leidos/entregados), tasa_respuesta
(respondidos/entregados)`. `SET statement_timeout='120s'`, `SET search_path=public,pg_temp`,
`security_invoker` no aplica (SQL stable). `GRANT EXECUTE ... TO anon` (solo lectura, igual que los
otros RPC del dashboard). Join opcional a `plantillas_catalogo` para shortcode/descripcion.

Denominadores (definición explícita):
- `tasa_entrega = entregados / NULLIF(enviados,0)` — enviados incluye fallidos (un fallo es un no-entregado).
- `tasa_apertura = leidos / NULLIF(entregados,0)` — sobre los que sí se entregaron.
- `tasa_respuesta = respondidos / NULLIF(entregados,0)` — sobre los entregados (no tiene sentido
  esperar respuesta de un fallido).

### 5. Frontend — sección "Plantillas"

- Activar el item "Plantillas" del sidebar (`Sidebar.tsx`): quitar el badge "pronto", hacerlo
  navegable. Nueva sección `'plantillas'` en el estado de `App.tsx`, monta `PlantillasView`.
- `services/dataSource.ts`: `getPlantillasStats(dateRange?)` → RPC `get_plantillas_stats`.
- `services/cacheService.ts` + `hooks/useDashboardData.ts`: cablear el nuevo dato respetando el
  filtro de fechas (igual que responsividad/embudo).
- `components/views/PlantillasView.tsx`: tabla/tarjetas por template (estilo mockup `yc-*`):
  nombre humano (descripcion o shortcode), enviados, tasa de entrega, **tasa de apertura** (con la
  nota del read receipt), tasa de respuesta. Ordenado por enviados desc. Respeta el rango de fechas
  del topbar. Estados skeleton/empty/error re-skinneados como las otras vistas.
- La nota honesta de apertura: una línea tipo "La apertura se mide con el read receipt de WhatsApp;
  algunos contactos lo tienen desactivado, así que el número real puede ser mayor."

## Qué NO entra (YAGNI)

- Masivos / campañas (excluidos por diseño).
- Editar o crear templates desde el dashboard (solo lectura).
- Históricos por día/sparklines por template (se puede agregar después si Yani lo pide).
- Tracking de clicks en links (Meta no lo da por esta vía).

## Testing

- `respondio.test.ts`: casos nuevos — outbound template antes/después del inbound no cuenta como
  respuesta humana; outbound del automation sender no cuenta; primer outbound humano sí; sin humano →
  null. `respondido` por template (inbound posterior al envío).
- Mapeo puro de `plantillas_envios` desde mensajes crudos (función testeable sin I/O).
- RPC: verificación manual vía SQL comparando contra conteos crudos por rango.
- Verificación en vivo: la sección renderiza con datos reales, el filtro de fecha cambia los números,
  0 errores de consola, `salto_cuantico_11dias` NO aparece (es masivo).

## Riesgos / notas

- `automationSenders` hardcodeado por defecto a `["Yanina Zapino"]`. Si agregan otra cuenta
  automática o la renombran, hay que actualizar la constante. Documentado en el código.
- El catálogo NocoDB incompleto: un template realmente masivo pero sin link de campaña se contaría
  como día a día. Hoy no pasa (salto_cuantico está bien linkeado). Aceptable; se corrige agregando el
  link en NocoDB.
- `plantillas_envios` crece ~1 row por template enviado (~miles). Index por `(tenant_id, enviado_at)`
  y `(tenant_id, es_masivo, enviado_at)` para el RPC.
- El sync de Chatwoot ya hace full-scan (~2230 convs, ~3min). Esto agrega trabajo en el mismo loop,
  sin requests extra. Aceptable.
