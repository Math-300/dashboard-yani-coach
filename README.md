# Dashboard Yani Coach

Dashboard de ventas y métricas para Yani Coach. Conecta con NocoDB como backend y muestra KPIs de ventas, pipeline, desempeño de vendedoras y más.

## Stack Tecnológico

- **Frontend**: React 19 + TypeScript + Vite
- **Estilos**: Tailwind CSS v4 + tema personalizado gold
- **Gráficos**: @antv/g2 (importación dinámica)
- **Backend**: NocoDB (API REST)
- **Deployment**: Vercel (serverless functions)

## Estructura del Proyecto

```
├── components/           # Vistas del dashboard (7 vistas)
│   ├── ExecutiveView.tsx    # Resumen ejecutivo con KPIs principales
│   ├── SalesView.tsx        # Ventas e ingresos
│   ├── PerformanceView.tsx  # Desempeño de vendedoras
│   ├── PipelineView.tsx     # Pipeline y actividad
│   ├── BusinessView.tsx     # Visión general
│   ├── TeamView.tsx         # Equipo
│   └── RecoveryView.tsx     # Calidad y recuperación
├── services/             # Servicios de datos y cálculo de métricas
│   ├── noco.ts              # Conexión a NocoDB, normalización de datos
│   ├── metricsCalculator.ts # Cálculo de KPIs y métricas
│   └── dataService.ts       # Servicio de datos con fallback a demo
├── hooks/                # Custom hooks
│   └── useG2Chart.ts        # Hook para gráficos G2 con cleanup automático
├── api/                  # API serverless para Vercel
│   └── nocodb/[...table].ts # Proxy serverless para NocoDB
└── docs/                 # Documentación técnica
    └── SOLUCION_COLORES_GOLD.md
```

## Configuración de Entorno

### Desarrollo Local

1. Crea un archivo `.env.local` en la raíz del proyecto:

```env
VITE_NOCODB_URL=https://app.nocodb.com
VITE_NOCODB_TOKEN=tu_token_aqui
VITE_TABLE_SELLERS=me6kwgo0qvg0aug
VITE_TABLE_CONTACTS=mrwhtwissgz1xzr
VITE_TABLE_INTERACTIONS=m6gx25reozjbbt3
VITE_TABLE_SALES=mm9p02mlk0i5ysy
VITE_TABLE_ATTEMPTS=mqdlglkwjvvtplc

# Auth serverless (server-only)
AUTH_SECRET=
AUTH_PASSWORD=

# OpenAI chat (server-only)
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4.1-mini
```

> **Nota**: Las variables `AUTH_*` y `OPENAI_*` son server-only y no llevan el prefijo `VITE_`.

2. Instala las dependencias:

```bash
npm install
```

### Vercel (Producción)

Configura las variables de entorno en Vercel Dashboard → Settings → Environment Variables:

| Variable | Descripción |
|----------|-------------|
| `NOCODB_TOKEN` | Token API de NocoDB (obligatorio) |
| `NOCODB_URL` | URL de NocoDB (por defecto: https://app.nocodb.com) |
| `TABLE_SELLERS` | ID de tabla Vendedoras |
| `TABLE_CONTACTS` | ID de tabla Contactos |
| `TABLE_INTERACTIONS` | ID de tabla Interacciones |
| `TABLE_SALES` | ID de tabla Ventas |
| `TABLE_ATTEMPTS` | ID de tabla Intentos |
| `AUTH_SECRET` | Clave secreta para firmar cookies (mín. 32 caracteres) |
| `AUTH_PASSWORD` | Contraseña maestra del dashboard |
| `OPENAI_API_KEY` | API key de OpenAI (server-only) |
| `OPENAI_BASE_URL` | Endpoint base de OpenAI (default https://api.openai.com/v1) |
| `OPENAI_MODEL` | Modelo de OpenAI (default gpt-4.1-mini) |

> **Nota**: En Vercel las variables no llevan el prefijo `VITE_`.
> **Nota**: Tras cambiar variables en Vercel, ejecuta un **Redeploy**.

**Checklist rápido**
- `/login` valida `AUTH_PASSWORD` y crea sesión firmada con `AUTH_SECRET`.
- `/api/chat` responde usando `OPENAI_API_KEY` y `OPENAI_MODEL`.

Referencia: revisa [`.env.example`](.env.example:1) y [`vercel.env.example`](vercel.env.example:1) para el listado completo.

## Autenticación `/login`

El acceso al dashboard es solo para uso interno y requiere una contraseña maestra.

**Flujo de login**
1. Abre `/login`.
2. Ingresa `AUTH_PASSWORD`.
3. Se crea una sesión firmada con `AUTH_SECRET` y se redirige al dashboard.

**Notas**
- Si `AUTH_SECRET` o `AUTH_PASSWORD` no están configuradas, el login falla.
- Para cerrar sesión: `POST /api/auth/logout`.
- Para verificar sesión activa: `GET /api/auth/session`.
- En desarrollo local, configura `.env.local` y reinicia `npm run dev`.

## Asistente Yani

Asistente de chat interno dentro del dashboard (no público).

**Uso**
- Endpoint: `POST /api/chat`.
- Requiere `OPENAI_API_KEY` y `OPENAI_MODEL`.
- Si faltan variables `OPENAI_*`, el chat no responde.
- `OPENAI_MODEL` permite controlar el modelo usado.

## Scripts Disponibles

```bash
# Desarrollo
npm run dev

# Construir para producción
npm run build

# Vista previa de producción
npm run preview
```

## Deployment

El proyecto está configurado para desplegarse automáticamente en Vercel.

1. Conecta tu repositorio a Vercel
2. Configura las variables de entorno (ver sección anterior)
3. Haz push a la rama principal

## Solución de Problemas

### Error: "Unexpected token '<', is not valid JSON"

La API está devolviendo HTML en lugar de JSON. Causas comunes:

1. **Variables de entorno no configuradas** → Configura `NOCODB_TOKEN` en Vercel
2. **Deploy desactualizado** → Haz Redeploy después de cambiar variables
3. **Token inválido** → Verifica que el token de NocoDB sea correcto

### Error: "Token API no configurado en el servidor"

La variable `NOCODB_TOKEN` no está configurada en Vercel.

### Error: "Error de NocoDB: 401"

El token de NocoDB no es válido o expiró. Genera un nuevo token en NocoDB.

### Error: "Error de NocoDB: 404"

El ID de la tabla no es correcto. Verifica los IDs en tu configuración.

## Licencia

Privado - Solo para uso interno.
