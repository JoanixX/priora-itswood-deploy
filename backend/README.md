# Backend de la app (Priora · Mermín · ITS WOOD)

API REST que usa la app (`app/`, en Vercel) según `docs/API_CONTRATO.md`. Node 20+ sin dependencias. Guarda todo en
una hoja de Google Sheets con una cuenta de servicio; sin credenciales funciona en memoria (para probar).

| Ruta | Qué hace |
| --- | --- |
| `GET /health` | Estado: `ok`, almacén (`memoria` o `sheets`), si hay Google, si hay login (`auth`) y el último error de escritura. |
| `POST /auth/login` · `GET /auth/yo` | Login de demo del dashboard (ver abajo). |
| `GET` / `PATCH /config` | Configuración del negocio (pestaña `Config`). El PATCH valida y aplica de inmediato. |
| `GET /catalogo` · `POST /catalogo/validar` · `POST /catalogo/confirmar` · `GET /catalogo/plantilla` | Catálogo; subida `.xlsx` o `.csv` (campo `archivo`), validación por fila, plantilla `.xlsx`. |
| `POST /chat` | Chat guiado de Mermín (mismo flujo de botones que el modo ejemplo de la app). Al confirmar crea el pedido. |
| `GET /pedidos?estado=` · `GET` / `PATCH /pedidos/{id}` | Pedidos ordenados por prioridad, recalculada con la config actual. El PATCH solo cambia `estado`. |
| `GET /metricas?periodo=2026` o `2026-09` | Tiempo de primera respuesta, conversión, pedidos corporativos por mes, ticket promedio, clientes. |
| `GET /segmentos` · `GET /segmentos/{id}/recomendaciones` | Segmentos de postventa sobre la pestaña `Ventas` y recomendaciones con borradores (no envía nada). |
| `GET` / `POST /fuentes` · `POST /fuentes/{id}/sincronizar` | Conectar una hoja o carpeta de Drive (ventas, catálogo, clientes, pedidos) compartida con la cuenta de servicio. |
| `GET /notificaciones` · `PATCH /notificaciones/{id}` | Avisos de pedidos alta/derivado/resueltos, sincronizaciones y resumen del día (desde las 19:00). |

Las respuestas salen de memoria y la copia a Sheets va en segundo plano (la app corta a los 4 s). Al arrancar se
lee la hoja; las pestañas que falten se crean con los datos iniciales (catálogo de ITS WOOD, histórico de ventas
anonimizado y, si `SEMBRAR_EJEMPLOS=true`, 6 pedidos y 2 avisos de ejemplo marcados con `ejemplo: true`).

## Login de demo del dashboard

Una sola cuenta, definida con `ADMIN_EMAIL` y `ADMIN_PASSWORD` (variables de entorno, nunca en el repo). Con las dos
puestas, todas las rutas piden `Authorization: Bearer <token>` salvo `GET /health`, `POST /auth/login` y
`POST /chat` (el chat es del cliente final). Sin ellas el backend queda abierto como antes y `/health` dice
`"auth": false`.

```json
POST /auth/login  { "correo": "joaquinsito@gmail.com", "contrasena": "<ADMIN_PASSWORD>" }
200 { "token": "eyJzdWIi...", "expira_en": "2026-10-18T04:00:00.000Z" }
401 { "error": "Correo o contraseña incorrectos" }
429 { "error": "Demasiados intentos. Espera 15 minutos y vuelve a probar." }
```

- El token dura 12 h y va firmado con HMAC-SHA256 con `AUTH_SECRET`. Sin `AUTH_SECRET` se usa una clave al azar y
  las sesiones se cierran en cada reinicio.
- Correo y contraseña se comparan en tiempo constante; hay un máximo de 10 intentos por IP cada 15 minutos.
- `GET /auth/yo` devuelve `{ correo, expira_en }` del token.
- Es un login de demo: una cuenta compartida, sin usuarios, roles ni recuperación de contraseña.

## Correr en local

```bash
cd backend
```

```bash
npm test
```

```bash
npm start
```

Con variables propias: copiar `env.example` a `.env` y usar `npm run dev`. En la app, `VITE_API_URL=http://localhost:3000`
en `app/.env` y `FRONTEND_ORIGIN=http://localhost:5173` aquí.

## Probar un backend levantado

```bash
node scripts/probar_backend.mjs https://priora-backend.onrender.com --origen https://priora-app.vercel.app
```

Recorre todas las rutas, valida los dos CSV de prueba, corre los 3 escenarios de la demo (alta, automático,
derivado), confirma un pedido y avisa si alguna respuesta tarda más de 4 s. `--solo-lectura` no crea pedidos.
Si el backend tiene login, agrega `--correo` y `--contrasena`, o mejor define `PRIORA_CORREO` y `PRIORA_CONTRASENA`
para que la clave no quede en el historial de la terminal. El script comprueba también que sin token responda 401.

## Desplegar en Render

1. Google Cloud: crear (o reutilizar) un proyecto, habilitar **Google Sheets API** y **Google Drive API**, crear una
   cuenta de servicio y descargar su clave JSON.
2. Crear una hoja de Google Sheets vacía (por ejemplo "Priora · ITS WOOD") y compartirla con el `client_email` de la
   cuenta de servicio como **Editor**. Su ID es la parte entre `/d/` y `/edit` de la URL.
3. Render: **New › Blueprint**, elegir este repositorio (usa `render.yaml` de la raíz) y completar las variables:

   | Variable | Valor |
   | --- | --- |
   | `FRONTEND_ORIGIN` | URL de la app en Vercel, sin barra final (varias separadas por coma). |
   | `GOOGLE_SHEET_ID` | ID de la hoja del paso 2. |
   | `GOOGLE_SERVICE_ACCOUNT_JSON` | Contenido completo del JSON de la clave (o en base64). |
   | `ADMIN_EMAIL` | Correo de la cuenta de demo del dashboard (`joaquinsito@gmail.com`). |
   | `ADMIN_PASSWORD` | Su contraseña. Solo aquí, nunca en el repo. |
   | `AUTH_SECRET` | Texto largo al azar para firmar las sesiones (ver `env.example`). |

   `NODE_VERSION=22`, `TZ=America/Lima` y `SEMBRAR_EJEMPLOS=true` ya vienen en el blueprint.
4. Comprobar `https://<servicio>.onrender.com/health` (debe decir `"almacen": "sheets"`) y correr el script de arriba.
5. Vercel (proyecto de `app/`): `VITE_API_URL=https://<servicio>.onrender.com` y volver a desplegar (Vite lee la
   variable al compilar).

**Plan gratis de Render:** el servicio se duerme tras 15 minutos sin uso y tarda ~1 minuto en despertar. La app espera
4 s y, si no hay respuesta, pasa a "Modo ejemplo". Antes de una demo, abrir `/health` y esperar a que responda (o
usar un plan pago / un ping periódico).
