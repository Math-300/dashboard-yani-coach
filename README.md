# Dashboard Yani Coach

Dashboard de Business Intelligence para visualización de datos de ventas y coaching.

## 🚀 Despliegue en Vercel

### Configuración de Variables de Entorno (IMPORTANTE)

**La API NO funcionará hasta que configures las variables de entorno en Vercel.**

Sigue estos pasos:

1. Ve a [Vercel Dashboard](https://vercel.com/dashboard)
2. Selecciona tu proyecto
3. Ve a **Settings** → **Environment Variables**
4. Agrega esta variable **OBLIGATORIA**:

| Variable | Valor | Descripción |
|----------|-------|-------------|
| `NOCODB_TOKEN` | Tu token de NocoDB | Token API de NocoDB (Settings → API Tokens) |

5. Haz clic en **Save**
6. Ve a **Deployments** → Clic en **Redeploy** en el último deploy

### Variables Opcionales

Estas variables ya tienen valores por defecto, solo cámbialas si es necesario:

| Variable | Valor por defecto |
|----------|-------------------|
| `NOCODB_URL` | `https://app.nocodb.com` |
| `TABLE_SELLERS` | `me6kwgo0qvg0aug` |
| `TABLE_CONTACTS` | `mrwhtwissgz1xzr` |
| `TABLE_INTERACTIONS` | `m6gx25reozjbbt3` |
| `TABLE_SALES` | `mm9p02mlk0i5ysy` |
| `TABLE_ATTEMPTS` | `mqdlglkwjvvtplc` |

## 🔧 Desarrollo Local

```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev

# Construir para producción
npm run build
```

## 📁 Estructura del Proyecto

```
├── api/
│   └── nocodb/
│       └── [...table].ts    # API Serverless de Vercel (catch-all route)
├── components/
│   ├── BusinessView.tsx     # Vista de negocio
│   ├── DateRangePicker.tsx  # Selector de fechas
│   ├── KPICard.tsx          # Tarjetas de KPIs
│   ├── RecoveryView.tsx     # Vista de recuperación
│   └── TeamView.tsx         # Vista de equipo
├── services/
│   ├── dataService.ts       # Servicio de datos
│   └── noco.ts              # Cliente de NocoDB
├── vercel.json              # Configuración de Vercel
└── vercel.env.example       # Ejemplo de variables de entorno
```

## 🐛 Solución de Problemas

### Error: "Unexpected token '<', is not valid JSON"

Este error significa que la API está devolviendo HTML en lugar de JSON. Causas:

1. **Variables de entorno no configuradas** → Configura `NOCODB_TOKEN` en Vercel
2. **Deploy desactualizado** → Haz Redeploy después de cambiar variables
3. **Token inválido** → Verifica que el token de NocoDB sea correcto
4. **Ruta de API incorrecta** → Verifica que el archivo `api/nocodb/[...table].ts` existe

### Cómo verificar que la API funciona:

1. Abre tu sitio en Vercel
2. Abre la consola del navegador (F12 → Console)
3. Deberías ver mensajes como:
   ```
   [API] Fetching Vendedoras from: https://tu-sitio.vercel.app/api/nocodb/sellers
   [API] Vendedoras: X registros recibidos
   ```

### Cómo probar la API directamente:

Abre estas URLs en tu navegador (reemplaza con tu dominio):
- `https://tu-sitio.vercel.app/api/nocodb/sellers`
- `https://tu-sitio.vercel.app/api/nocodb/contacts`
- `https://tu-sitio.vercel.app/api/nocodb/sales`

Si ves JSON, la API funciona. Si ves HTML, hay un problema de configuración.

### Error: "Token API no configurado en el servidor"

La variable `NOCODB_TOKEN` no está configurada en Vercel. Sigue los pasos de configuración arriba.

### Error: "Error de NocoDB: 401"

El token de NocoDB no es válido o expiró. Genera un nuevo token en NocoDB.

### Error: "Error de NocoDB: 404"

El ID de la tabla no es correcto. Verifica los IDs en `vercel.env.example`.

## 📝 Licencia

Privado - Solo para uso interno.
