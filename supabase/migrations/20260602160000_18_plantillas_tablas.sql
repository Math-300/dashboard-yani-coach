-- Plantillas: catálogo (espejo de Templates_Outbound) + envíos por mensaje (de Chatwoot).
-- RLS habilitado SIN policies para anon: el dashboard lee solo vía RPC SECURITY DEFINER
-- (get_plantillas_stats). El sync escribe con service_role (bypassa RLS).

create table if not exists public.plantillas_catalogo (
  tenant_id     uuid    not null,
  template_name text    not null,
  shortcode     text,
  descripcion   text,
  activo        boolean,
  es_masivo     boolean not null default false,
  synced_at     timestamptz not null default now(),
  primary key (tenant_id, template_name)
);
alter table public.plantillas_catalogo enable row level security;
create index if not exists idx_plantillas_catalogo_masivo
  on public.plantillas_catalogo (tenant_id, es_masivo);

create table if not exists public.plantillas_envios (
  id                       uuid primary key default gen_random_uuid(),
  tenant_id                uuid    not null,
  chatwoot_conversation_id bigint,
  chatwoot_message_id      bigint  not null,
  template_name            text    not null,
  es_masivo                boolean not null default false,
  enviado_at               timestamptz,
  status                   text,
  entregado                boolean not null default false,
  leido                    boolean not null default false,
  fallido                  boolean not null default false,
  contacto_nocodb_id       integer,
  respondido               boolean not null default false,
  synced_at                timestamptz not null default now(),
  unique (tenant_id, chatwoot_message_id)
);
alter table public.plantillas_envios enable row level security;
create index if not exists idx_plantillas_envios_rango
  on public.plantillas_envios (tenant_id, es_masivo, enviado_at);

-- service_role escribe (sync). anon/authenticated: sin grants directos (solo vía RPC).
grant select, insert, update, delete on public.plantillas_catalogo to service_role;
grant select, insert, update, delete on public.plantillas_envios   to service_role;
