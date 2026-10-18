# API_CONTRATO.md — Mermín (ITS WOOD)

Contrato compartido entre `frontend/` y `backend/`. Si algo cambia, se cambia aquí y se avisa al equipo.
Repositorio: un solo repo (`itswood_code`) con carpetas `frontend/` y `backend/`, flujo gitflow simplificado (`main`, `develop`, ramas `feature/*`).

## Convenciones
- JSON en UTF-8, fechas ISO 8601 (`2026-12-15`), dinero en soles como número (`47` = S/ 47).
- CORS: el backend permite el dominio del frontend (variable `FRONTEND_ORIGIN`).
- Login de demo opcional (una sola cuenta, ver "Autenticación"). Datos de ejemplo marcados como tales; nunca clientes reales.
- Lo que NO existe todavía (no inventar): tabla de descuentos por volumen, plazo de producción, WhatsApp real.

## Modelo: Producto
```json
{ "id": "PR-4B75357B", "nombre": "Posacelular TRAPECIO", "categoria": "Oficina",
  "precio": 28, "stock": 12, "descripcion": "", "imagen_url": null }
```
`stock` es `null` si la tienda no registra stock de ese producto.

## Modelo: Pedido
```json
{
  "id": "PED-0001",
  "creado_en": "2026-10-17T16:00:00-05:00",
  "cliente": { "nombre": "María Pérez", "empresa": "Acme SAC", "telefono": "999111222",
               "correo": null, "tipo": "empresa", "ya_compro_antes": true },
  "ocasion": "Navidad",
  "cantidad_total": 30,
  "fecha_requerida": "2026-12-15",
  "productos": [ { "producto_id": "PR-4D655976", "nombre": "Dock 3 en 1", "cantidad": 30, "precio_unitario": 80 } ],
  "personalizacion": "Nombre de cada colaborador y logo",
  "entrega": { "direccion": "Av. Ejemplo 123, San Borja", "horario": "9:00 a 12:00" },
  "prioridad": "alta",
  "motivo_prioridad": "Empresa, 30 unidades, ya compró antes",
  "estado": "nuevo",
  "resumen": "Texto corto para la dueña"
}
```
- `cliente.tipo`: `"empresa"` | `"persona"`
- `prioridad`: `"alta"` | `"media"` | `"automatico"` | `"derivado"`
- `estado`: `"nuevo"` | `"derivado"` | `"confirmado"`

## Reglas de prioridad (viven en `/config`, no en el código)
Umbrales marcados [SUPUESTO] hasta que la dueña los confirme.
- `derivado`: cantidad_total > 100, diseño especial, reclamo, pedido de descuento.
- `alta`: tipo empresa y (cantidad_total >= 30 o fecha cercana o ya_compro_antes).
- `media`: empresa con 12–29 unidades y fecha holgada, o persona con fecha cercana.
- `automatico`: persona con pedido simple de catálogo y con stock.
- Empresa con menos de 12 unidades: se deriva a la dueña.
- "Fecha cercana": dentro de los próximos 14 días [SUPUESTO].
  El orden en el tablero es: derivado y alta primero, luego media, luego automático; dentro de cada grupo, por `fecha_requerida` ascendente.

## Endpoints

### GET /health
`200 {"ok": true, "auth": true}`. `auth` dice si el backend pide login.

### Autenticación (login de demo)
Una sola cuenta, definida en el backend con `ADMIN_EMAIL` y `ADMIN_PASSWORD` (nunca en el repo). Si el backend no
las tiene, no hay login (`"auth": false`) y todo funciona como antes.

`POST /auth/login`
```json
{ "correo": "joaquinsito@gmail.com", "contrasena": "..." }
```
`200 {"token": "<token>", "expira_en": "2026-10-18T04:00:00.000Z"}` · `401 {"error": "Correo o contraseña incorrectos"}` ·
`429` si hay más de 10 intentos por IP en 15 minutos. El token dura 12 h (firmado con HMAC-SHA256, `AUTH_SECRET`).

Con login activo, todas las rutas exigen `Authorization: Bearer <token>` salvo `GET /health`, `POST /auth/login` y
`POST /chat` (el chat es del cliente final). Sin token o con uno vencido o alterado: `401 {"error": "Inicia sesión..."}`.
`GET /auth/yo` → `200 {"correo": "...", "expira_en": "..."}`.

Frontend: página `/login`; el token va en `sessionStorage` (`priora.sesion`) y se borra al cerrar la pestaña o con
"Cerrar sesión". Un 401 cierra la sesión y vuelve a `/login`. En "Modo ejemplo" (sin `VITE_API_URL`) la cuenta de
demo se valida en el navegador con `VITE_DEMO_PASSWORD`; esa variable queda en el JavaScript publicado, no es un
secreto. Si está vacía, el modo ejemplo entra sin login.

### GET /config
Configuración del negocio (viene de la hoja `Config`, nunca escrita en código).
```json
{ "negocio": "ITS WOOD", "asistente": "Mermín",
  "marca": { "colores": { "marron_oscuro": "#50280a", "marron_medio": "#784b32", "verde": "#6e8264",
                          "coral": "#eb8278", "naranja": "#f09646", "crema": "#e6d7c3" } },
  "textos": { "saludo": "...", "aviso_ia": "...", "no_sabe": "..." },
  "tono": "premium",
  "derivar": { "reclamos": true, "descuentos": true, "disenos_especiales": true, "pide_persona": true },
  "reglas": { "minimo_empresa": 12, "umbral_alta": 30, "maximo_sin_derivar": 100, "dias_fecha_cercana": 14 } }
```

### PATCH /config
Edición mínima desde la vista Ajustes. Solo acepta estos campos (cualquier otro → 400):
```json
{ "asistente": "Mermín", "textos": { "saludo": "¡Hola! Soy Mermín..." }, "tono": "cercano",
  "reglas": { "minimo_empresa": 12, "umbral_alta": 30, "maximo_sin_derivar": 100, "dias_fecha_cercana": 14 },
  "derivar": { "reclamos": true, "descuentos": true, "disenos_especiales": true, "pide_persona": true } }
```
Todos opcionales (merge parcial). Validación: `asistente` 1–20 caracteres; `saludo` 1–200; `tono` ∈ `cercano` | `formal` | `premium`; reglas enteras positivas con `minimo_empresa < umbral_alta < maximo_sin_derivar`; `dias_fecha_cercana` entre 1 y 60.
Guarda en la hoja `Config` y aplica de inmediato: el siguiente mensaje de `/chat` usa el nuevo saludo y tono, y `GET /pedidos` recalcula las prioridades con los nuevos umbrales. `200` devuelve la configuración completa. Error: `400 {"error": "umbral_alta debe ser mayor que minimo_empresa"}`.

### GET /catalogo
`200 [Producto, ...]`

### POST /catalogo/validar  (multipart, campo `archivo`: .xlsx o .csv)
Valida columnas `producto, categoria, precio, stock, descripcion` y que `precio` sea numérico. No guarda nada.
`200 {"valido": true, "filas": 55, "errores": [], "vista_previa": [Producto, ...primeros 10]}`
`200 {"valido": false, "errores": ["Fila 4: precio no es un número"], ...}`

### POST /catalogo/confirmar  (multipart, igual que arriba)
Guarda el catálogo en la hoja `Catalogo` (persistente) y lo deja activo. `200 {"ok": true, "filas": 55}`

### GET /catalogo/plantilla
Descarga la plantilla `.xlsx` vacía con las columnas correctas.

### POST /chat
Request:
```json
{ "conversacion_id": null, "texto": "Necesito 30 regalos para mi equipo", "boton_id": null }
```
Response:
```json
{ "conversacion_id": "c-abc123",
  "mensajes": [ { "texto": "¡Hola! Soy Mermín...", "botones": [ { "id": "empresa", "texto": "Regalos para empresa" } ] } ],
  "paso": "E2",
  "pedido_id": null }
```
Cuando el pedido se cierra, `pedido_id` trae el id del pedido creado. Máximo 3 botones por mensaje.

### GET /pedidos
Query opcional `?estado=nuevo`. `200 [Pedido, ...]` ya ordenados según la regla de prioridad.

### GET /pedidos/{id}
`200 Pedido`

### PATCH /pedidos/{id}
Request `{"estado": "confirmado"}`. `200 Pedido`

## Almacenamiento (Google Sheets, hoja de la dueña)
Pestañas: `Config`, `Catalogo`, `Pedidos`, `Clientes`. Acceso con cuenta de servicio.
Variables de entorno del backend: `GEMINI_API_KEY`, `GOOGLE_SHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `FRONTEND_ORIGIN`,
`ADMIN_EMAIL`, `ADMIN_PASSWORD`, `AUTH_SECRET` (login de demo).
Variables del frontend: `VITE_API_URL`, `VITE_DEMO_PASSWORD` (solo modo ejemplo; no es secreta).

## Errores
`{"error": "mensaje claro en español"}` con el código HTTP correspondiente.

## Propuestas del frontend (por confirmar con backend)
Rutas que necesita la app según el alcance nuevo (fidelización, métricas, Drive/Sheets, notificaciones). El backend confirma, cambia o descarta cada una; el frontend las usa detrás del modo ejemplo hasta entonces.

### GET /metricas?periodo=2026-09   (o `periodo=2026` para todo el año)
```json
{ "tiempo_primera_respuesta": { "antes_min": null, "despues_min": 2.5, "fuente": "registros de Mermín" },
  "conversion_consultas": { "consultas": 40, "pedidos": 12, "porcentaje": 30 },
  "pedidos_corporativos_mes": [ { "mes": "2026-08", "pedidos": 42 }, { "mes": "2026-09", "pedidos": 46 } ],
  "ticket_promedio": { "total": 422, "empresa": 699, "persona": 117 },
  "clientes_registrados": { "total": 208, "recurrentes": 27 } }
```
`antes_min` es `null` hasta que la dueña dé el dato (no se inventa).

### GET /segmentos
`200 [ { "id": "empresas_recurrentes", "nombre": "Empresas recurrentes", "clientes": 12, "monto": 30500, "ultima_compra": "2026-10-10" }, ... ]`
Segmentos: `empresas_recurrentes`, `empresas_un_pedido`, `personas_recurrentes`, `personas_una_compra`, `inactivos` (sin compra > 60 días, [SUPUESTO]). Sin edad ni generación.

### GET /segmentos/{id}/recomendaciones
```json
{ "segmento": "empresas_un_pedido",
  "recomendaciones": [ { "titulo": "Escríbeles antes de Navidad", "motivo": "Compraron en sept. para fin de año",
                         "canal": "whatsapp", "mensaje_borrador": "Hola ..., ¿repetimos el pedido de este año?" } ],
  "secuencia_postventa": [ "Gracias por tu compra...", "¿Cómo les fue con los regalos?...", "Se viene ... ¿te ayudo?" ] }
```
No envía mensajes; solo sugiere. Clientes siempre por alias.

### GET /fuentes · POST /fuentes · POST /fuentes/{id}/sincronizar
`POST /fuentes` → `{ "url": "https://docs.google.com/spreadsheets/d/...", "tipo": "ventas" }` (`tipo`: ventas | pedidos | clientes | catalogo; también URL de carpeta de Drive).
`GET /fuentes` → `{ "correo_servicio": "priora@<proyecto>.iam.gserviceaccount.com", "fuentes": [ { "id": "f1", "tipo": "ventas", "nombre": "Ventas 2026", "estado": "ok", "ultima_sync": "2026-10-17T19:00:00-05:00", "filas": 264, "error": null } ] }`
`estado`: ok | sincronizando | error. La dueña comparte la hoja con `correo_servicio`; el frontend nunca maneja credenciales.

### GET /notificaciones · PATCH /notificaciones/{id}
`GET` → `[ { "id": "n1", "tipo": "pedido_alta" | "pedido_derivado" | "resumen_diario" | "sync", "texto": "...", "enlace": "/app/pedidos?id=PED-0007", "creado_en": "...", "leida": false } ]`
`PATCH` → `{ "leida": true }`.

### Campos nuevos en GET/PATCH /config
```json
{ "bienvenida": { "url_tienda": "https://itswood.pe", "texto_boton": "Ir a la tienda",
                  "promo_activa": false, "promo_texto": "10% de descuento comprando en la web [SUPUESTO: confirmar con la dueña]" },
  "prioridad": { "peso_valor": true, "margen_estimado": 0.5 },
  "notificaciones": { "pedido_alta": true, "pedido_derivado": true, "resumen_diario": true, "canal": "app" } }
```
`margen_estimado` es global ([SUPUESTO] 50 %): no hay margen por producto.

### Anexo: campos extra que usa la app (por confirmar)
La app ya adapta las propuestas de arriba en `app/src/services/`. Además usa estos campos opcionales; si el backend no los manda, funciona igual con valores por defecto.

- **`/config`**
  - `bienvenida.mensaje`: texto antes del botón de la tienda (por defecto "Mira el catálogo completo en nuestra web 👉").
  - `prioridad.monto_alta`: monto (S/) desde el cual un pedido sube a `alta` cuando `peso_valor` es `true` [SUPUESTO: 1000].
  - `metricas.tiempo_respuesta_antes_min`: el "antes" que da la dueña (Ajustes → Medición). Es lo que alimenta `tiempo_primera_respuesta.antes_min` en `/metricas`.
  - `correo_negocio`: correo que se muestra en Ajustes → Notificaciones.
- **`POST /chat`** (respuesta)
  - `mensajes[].enlace`: `{ "url": "https://itswood.pe", "texto": "Ir a la tienda" }` para el botón de la bienvenida.
  - `mensajes[].promo`: texto de la promoción o `null` (solo si `bienvenida.promo_activa`).
  - `borrador`: el pedido armándose, para el panel "Pedido en vivo":
    `{ "tipo": "empresa", "ocasion": "Navidad", "cantidad": 30, "fecha_requerida": "2026-12-15", "productos": [ { "producto_id": "PR-4D655976", "nombre": "Dock 3 en 1", "cantidad": 30, "precio_unitario": 80 } ], "personalizacion": "Logo", "cliente": "Acme SAC" }`
  - `prioridad`: `{ "prioridad": "alta", "motivo": "Empresa · 30 u. · S/ 2,400" }` cuando el pedido se cierra.
- **`Pedido`**: `flags` `{ "reclamo": false, "descuento": false, "diseno_especial": false, "pide_persona": false }` para explicar por qué se derivó.
- **`GET /notificaciones`**: `titulo` opcional (si falta, se usa `texto`) y el tipo `pedido` para pedidos resueltos por Mermín que no son de prioridad alta.
