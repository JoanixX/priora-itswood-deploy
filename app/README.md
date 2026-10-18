# Priora · app web (ITS WOOD)

La plataforma que usa la dueña del negocio: pedidos ordenados por prioridad, su asistente **Mermín**, métricas, fidelización, catálogo y conexión con Google Sheets.

React 18 + Vite + React Router · Recharts · SheetJS (`xlsx`) · lucide-react · CSS Modules + custom properties · estado con Context + hooks.

## Cómo correr

```bash
cd app
npm install
npm run dev        # http://localhost:5173/app
npm test           # Vitest: anonimización, parseo, prioridad, Ajustes y métricas
npm run build      # genera dist/
```

Sin `VITE_API_URL` la app arranca en **Modo ejemplo** (se ve en la barra superior): usa el histórico anonimizado, el catálogo real, 6 pedidos "Ejemplo" y un chat guiado local. Si el backend no responde en 4 s, también pasa a modo ejemplo. La demo nunca queda en blanco.

## Variables de entorno

Copia `env.example` a `.env.local` (se llama así, sin punto, para que no parezca un `.env` real en el repo):

| Variable | Para qué |
|---|---|
| `VITE_API_URL` | Backend en Render. Vacía = modo ejemplo. |
| `VITE_LANDING_URL` | Landing de Priora (logo y "Volver a Priora"). |
| `VITE_WEB_TIENDA_URL` | Web de la tienda (`https://itswood.pe`), botón de la bienvenida si `/config` no trae `bienvenida.url_tienda`. |

Nunca pongas claves ni credenciales de Google en el frontend: la conexión con Sheets la hace el backend con su cuenta de servicio.

## Regenerar los datos de demo

`ref/` (en la raíz del repo, ignorada por git) tiene los datos reales. El script los anonimiza:

```bash
cd app
npm run anonimizar                 # lee ref/ventas_2026.csv o ref/ventas_2026_itswood.xlsx
npm run anonimizar -- otra/ruta.csv
```

Genera:
- `src/data/ventas_2026.demo.json`: sin nombre, teléfono, dirección, RUC, forma de pago ni cuenta. Cliente → alias estable (`Cliente 001`, mismo teléfono o nombre = mismo alias). Tipo `empresa` si parece razón social o pidió 12+ u. El distrito se limpia si alguien escribió la dirección completa. Grabado: sí/no, sin copiar el texto.
- `src/data/catalogo.demo.json`: el catálogo de 55 productos (no tiene datos personales).

`MONTO TOTAL` viene vacío en la hoja (fórmula sin valor guardado), así que el monto se calcula como `cantidad × precio unitario + delivery`. Las filas sin estado quedan como "Pendiente". 26 ventas no tienen ninguna fecha: cuentan en "Todo 2026" pero no en un mes.

Valores que salen (y que prueban los tests): 264 registros · S/ 107,031 · 12+ u. = 86 % del monto · ticket S/ 423 (empresa S/ 708, persona S/ 117) · 225 clientes, 29 con 2+ pedidos · WhatsApp 54 %.

## Rutas

`/` → `/app` · `/app` Inicio · `/app/pedidos` (`?id=` abre el detalle) · `/app/mermin` · `/app/fidelizacion` · `/app/catalogo` · `/app/datos` · `/app/ajustes`.
`/app` y `/app/mermin` abren directo gracias al rewrite de `vercel.json`.

## Estructura

```
src/
  services/   api.js (fetch + timeout 4 s + modo ejemplo) y un archivo por dominio
  services/demo/  estado en memoria y chat guiado del modo ejemplo
  lib/        lógica pura: prioridad, métricas, segmentos, parseo, CSV, catálogo
  context/    AppContext: config, pedidos, notificaciones, toasts y polling (10 s, se pausa con la pestaña oculta)
  pages/      una vista por ruta
  components/ layout, badges, panel de detalle, cajón de avisos, toasts
  data/       JSON anonimizados y configuración por defecto
```

Mapeo desde Vitalita (Vue): `views/` → `pages/`; `*-api.js` + `BaseApi` → `services/`; stores de Pinia → `AppContext` + hooks; `vue-router` → React Router con `Layout` + `<Outlet>`; `side-navigation.vue` / `layout.vue` → `components/Layout.jsx`; `notification-bell.vue` → campana + `NotificationDrawer`.

Si el backend cambia rutas o campos, solo se toca `src/services/`.

## Despliegue en Vercel

Proyecto propio: **Root Directory `app`**, **Framework Vite**, build `npm run build`, salida `dist`. Variables: las tres de arriba. `vercel.json` reescribe todo a `index.html`.

## Diferencias con el backend

No existe `ref/PLAN_BACKEND.md` en este repo, así que no se comparó contra un plan del backend. Contra `docs/API_CONTRATO.md`:

- El contrato habla de la carpeta `frontend/`; este prompt pide `app/`.
- Las rutas nuevas (`/metricas`, `/segmentos`, `/fuentes`, `/notificaciones`) y los campos nuevos de `/config` siguen las **Propuestas del frontend** que ya estaban en el contrato. Faltan confirmar con backend.
- El anexo del contrato lista campos extra que la app usa si vienen: `bienvenida.mensaje`, `prioridad.monto_alta`, `metricas.tiempo_respuesta_antes_min`, `correo_negocio`, y en `/chat` `mensajes[].enlace`, `mensajes[].promo`, `borrador` y `prioridad`. Sin `borrador`, el panel "Pedido en vivo" se llena recién cuando llega `pedido_id`.
- `prioridad.peso_valor` del contrato es booleano: la app lo usa como interruptor ("tomar en cuenta el valor") y agrega `monto_alta` para el umbral.
- El histórico de ventas no tiene ruta en el contrato: se usa siempre el JSON anonimizado local. `/metricas` solo aporta lo que sale de Mermín (tiempo de respuesta y conversión).
- Si el backend devuelve `prioridad` en un pedido, la app la respeta; si no, la calcula con las reglas de `/config`.

## Datos marcados [SUPUESTO]

Todos esperan confirmación de la dueña:

- Umbrales de prioridad: mínimo empresa 12 u., alta 30 u., máximo sin derivar 100 u., fecha cercana 14 días.
- Monto que sube un pedido a alta: S/ 1,000.
- Margen estimado general: 50 % (no hay margen por producto). Ganancia estimada = monto × margen.
- Promoción "10 % de descuento comprando en la web": **apagada por defecto**, solo se muestra si se activa en Ajustes.
- Inactivo = más de 60 días sin comprar.
- Tiempo de respuesta "antes": no se inventa; Inicio muestra "Por medir con la dueña" hasta que se cargue en Ajustes → Medición.
- Métricas de Mermín en modo ejemplo (42 conversaciones, 15 con pedido, ~3 s de respuesta) están rotuladas "Ejemplo".
- Correo de la cuenta de servicio y fuente "Ventas 2026 (ejemplo)" en Datos: valores de demo.

## Decisiones de la demo

- Orden de Pedidos: primero lo vivo de Mermín, luego lo abierto del histórico y al final lo entregado/enviado; dentro de cada bloque, derivado y alta → media → automático, luego fecha de entrega y luego valor.
- Sin login, sin envío real de mensajes ni campañas ("Copiar mensaje"), sin WebSockets.
- En modo ejemplo lo que se guarda (Ajustes, pedidos confirmados, catálogo subido) vive en memoria: se pierde al recargar.
- Tipografía y tokens: los de la landing (`landing/assets/styles/tokens.css`, Manrope 300/400/600; la app suma 700 para negritas). La primera parte de `src/styles/tokens.css` es copia exacta; debajo van solo los extras de la app (colores de estado, series de gráficos y alias).
