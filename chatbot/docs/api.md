# API del bot (backend a backend)

Flujo de n8n `ITS WOOD - API`. Permite que otra plataforma (web, CRM, app interna, el dashboard de Mermín) converse
con el bot, consulte datos, confirme órdenes y edite la configuración. Recibe peticiones y responde en JSON.

- **URL base:** `https://<n8n>/webhook/itswood/api/<ruta>` (local: `http://localhost:5678/webhook/itswood/api/<ruta>`).
  Las rutas pueden tener hasta tres tramos (`segmentos/VIP/clientes`): el flujo tiene un webhook por cantidad de
  tramos, todos con el mismo prefijo.
- **Autenticación:** cabecera `X-Api-Key: <clave>`. Sin clave o con una incorrecta responde **403**. La clave es una
  credencial "Header Auth" de n8n (`ITS WOOD API`); en local está en `.n8n-local.md`.
- **Formato:** `Content-Type: application/json` en los POST y PUT. Todas las respuestas son JSON con `ok`, salvo la
  exportación de audiencias (CSV).
- **Errores:** 400 (dato faltante o inválido), 403 (clave o carpeta sin compartir), 404 (ruta o recurso inexistente),
  405 (método), 422 (la sincronización encontró errores en la hoja), 500. Cuerpo: `{ "ok": false, "error": "<explicación>" }`.
- Las peticiones se procesan en serie con los mensajes de WhatsApp (`N8N_CONCURRENCY_PRODUCTION_LIMIT=1`), así que
  una respuesta puede tardar unos 20 segundos. Las rutas del dashboard leen varias pestañas del libro en cada llamada.

## Rutas

| Método | Ruta | Para qué |
| --- | --- | --- |
| GET | `salud` | Comprobar que la API está arriba. |
| POST | `mensaje` | Enviar un mensaje de un cliente al bot y recibir sus respuestas. |
| GET | `conversacion?wa_id=` | Estado de la conversación de un cliente (paso, datos, modo, intención). |
| GET | `solicitudes?estado=&intencion=&wa_id=&limite=` | Solicitudes registradas, la más reciente primero. |
| GET | `proveedores?limite=` | Lista de la pestaña `PROVEEDORES`. |
| GET | `cotizaciones?solicitud_id=&estado=&limite=` | Pedidos de cotización a proveedores y sus respuestas. |
| POST | `confirmar-orden` | Confirmar una orden y pedir cotización a los proveedores. |

### Dashboard de Mermín

| Método | Ruta | Para qué |
| --- | --- | --- |
| GET / PUT | `config` | Leer y editar la personalización (`BOT_CONFIG`): nombre, tono, bienvenida, descuento, URL, umbrales. |
| POST | `config/drive` | `{ url }`: conecta la carpeta de Drive y valida el acceso. |
| POST | `sync` | Fuerza la sincronización de la hoja `MERMIN_FUENTE`; responde con `ultima_sync` y los errores. |
| GET | `metricas?desde=&hasta=` | Las 5 métricas clave. |
| GET | `leads?orden=prioridad&nivel=ALTA&estado=&limite=` | Cola de leads por prioridad (`orden=fecha` para la más reciente primero). |
| GET | `segmentos` | Conteo de clientes por segmento de fidelización. |
| GET | `segmentos/{segmento}/clientes?limite=` | Clientes de un segmento, con su recomendación. |
| GET / PUT | `fidelizacion` | Reglas de canal, mensaje, oferta y frecuencia por segmento (`BOT_FIDELIZACION`). |
| POST | `campanas/{segmento}/preview` | A quién le toca la campaña del segmento y con qué mensaje (no envía). |
| POST | `campanas/{segmento}/enviar` | Envía la campaña por email (`{ "confirmar": true }` obligatorio). |
| GET | `audiencias/{segmento}.csv` | CSV `telefono,email` para subir como Custom Audience en Meta o Google Ads. |
| GET | `recomendaciones/{cliente_id}` | Recomendación postventa de un cliente. |

`limite` va de 1 a 500 (100 por defecto). Los filtros no distinguen mayúsculas. Segmentos: `CORPORATIVO`, `VIP`,
`RECURRENTE`, `NUEVO`, `DORMIDO` (los de las reglas) y, solo para consultar, `OCASIONAL` y `SIN_COMPRAS`.

## Conversación y órdenes

### POST mensaje

```json
{ "wa_id": "51987654321", "texto": "Hola, quiero cotizar tablas", "nombre": "Ana", "mensaje_id": "opcional" }
```

`wa_id` identifica al cliente (con código de país); la conversación es la misma que tendría por WhatsApp. Si se
repite un `mensaje_id`, el mensaje se descarta como duplicado. La respuesta **no** se envía por WhatsApp: vuelve en
la respuesta HTTP y queda en `BOT_EVENTOS` con resultado `API`.

```json
{ "ok": true, "ruta": "mensaje", "mensaje_id": "API-...", "wa_id": "51987654321",
  "respuestas": ["¡Hola! Soy Mermín 🌳, el asistente de ITS WOOD. *Compra en nuestra web*..."], "atendido_por": "bot" }
```

`respuestas` vacío con `atendido_por: "equipo_o_sin_respuesta"` significa que el caso está con una persona del
equipo (el bot no responde), que el mensaje era duplicado o que el modo cambió mientras se procesaba.

### POST confirmar-orden

```json
{ "solicitud_id": "SOL-20261017-0001-24GP", "simular": false, "responsable": "Plataforma X" }
```

Marca la solicitud como `ORDEN_CONFIRMADA` y envía la plantilla de cotización a los proveedores que atienden el
producto (ver [proveedores.md](proveedores.md)). Repetir la llamada no vuelve a escribir a los proveedores ya
contactados; sí reintenta los que quedaron en `ERROR_ENVIO`. Con `"simular": true` no envía nada y registra las
cotizaciones como `SIMULADA` (para pruebas). Las órdenes confirmadas cuentan como pedidos en las métricas.

```json
{ "ok": true, "resumen": "Orden SOL-... confirmada. Se pidió cotización a 2 proveedor(es): ...",
  "cotizaciones": [{ "proveedor": "Maderas del Norte", "estado": "ENVIADA" }] }
```

Error típico (400): la solicitud no tiene producto o cantidad (por ejemplo, el cliente pidió un asesor antes de
terminar).

## Dashboard: configuración y datos

### GET config

```json
{ "ok": true, "ruta": "config",
  "config": { "nombre_bot": "Mermín", "nombre_negocio": "ITS WOOD", "tono": "cercano", "emoji_bot": "🌳",
              "url_web": "https://tienda.example", "codigo_descuento_web": "WEB10", "porcentaje_descuento_web": "10",
              "mensaje_bienvenida": "", "drive_folder_id": "1AbC...", "sheet_fuente_id": "1XyZ...",
              "ultima_sync": "2026-10-17T15:00:00.000Z", "margen_por_defecto": "0.40",
              "umbral_prioridad_alta": "70", "umbral_prioridad_media": "40", "tope_valor": "3000",
              "tope_ganancia": "1200", "tope_cantidad": "50", "tfr_antes_minutos": "180",
              "avisos_whatsapp": "51999000111", "avisos_email": "duena@itswood.pe", "hora_resumen_diario": "19:00" },
  "descripciones": { "nombre_bot": "Nombre con el que se presenta el bot.", "...": "..." },
  "solo_lectura": ["sheet_fuente_id", "ultima_sync", "drive_folder_id"] }
```

### PUT config

Solo las claves que cambian. `mensaje_bienvenida` acepta `{hola}`, `{nombre_bot}`, `{emoji_bot}`,
`{nombre_negocio}`, `{porcentaje}`, `{codigo}`, `{url}` y `{web}` (la frase con el enlace y el descuento); vacío usa
la plantilla del tono. Las claves de `solo_lectura` se cambian con `config/drive` y `sync`.

```json
{ "nombre_bot": "Mermín", "tono": "formal", "porcentaje_descuento_web": "15", "url_web": "https://tienda.example" }
```

```json
{ "ok": true, "ruta": "config", "guardados": ["nombre_bot", "tono", "porcentaje_descuento_web", "url_web"] }
```

### POST config/drive

```json
{ "url": "https://drive.google.com/drive/folders/1AbC_dEfGhIjKlMn?usp=sharing" }
```

```json
{ "ok": true, "ruta": "config-drive", "folder_id": "1AbC_dEfGhIjKlMn",
  "hoja": { "id": "1XyZ...", "nombre": "MERMIN_FUENTE ITS WOOD" } }
```

Si la cuenta de servicio no ve ninguna hoja en la carpeta (403), la respuesta trae el correo con el que hay que
compartirla:

```json
{ "ok": false, "error": "No veo ninguna hoja de cálculo en esa carpeta. Compártela con bot@proyecto.iam.gserviceaccount.com (como lector) y sube la plantilla MERMIN_FUENTE.",
  "correo_servicio": "bot@proyecto.iam.gserviceaccount.com" }
```

### POST sync

Cuerpo vacío (`{}`). Corre el flujo `Mermín - Sincronizar Drive` (que también corre cada 10 minutos y cuando cambia
un archivo de la carpeta).

```json
{ "ok": true, "ruta": "sync", "errores": [], "avisos": ["VENTAS: 1 fila(s) con cliente_id que no está en CLIENTES."],
  "resumen": "9 productos, 7 clientes y 12 líneas de venta desde \"MERMIN_FUENTE ITS WOOD\".",
  "ultima_sync": "2026-10-17T15:00:00.000Z" }
```

Con errores (422) no se toca la copia anterior y el error queda en `BOT_ERRORES`:

```json
{ "ok": false, "ruta": "sync", "errores": ["A la pestaña VENTAS le faltan columnas: total."], "avisos": [], "resumen": "", "ultima_sync": "" }
```

### GET metricas

Período en días de Lima (`AAAA-MM-DD`); por defecto, los últimos 30 días hasta hoy.

```json
{ "ok": true, "ruta": "metricas", "periodo": { "desde": "2026-09-18", "hasta": "2026-10-17" },
  "tiempo_primera_respuesta": { "antes_minutos": 180, "despues_minutos": 0.5, "mejora_pct": 99.7, "conversaciones_medidas": 42 },
  "conversion": { "conversaciones": 42, "pedidos": 6, "porcentaje": 14.3 },
  "pedidos_corporativos": { "mes": "2026-10", "mes_actual": 3, "mes_anterior": 2, "variacion_pct": 50 },
  "ticket_promedio": { "valor": 713.75, "pedidos": 4, "total_vendido": 2855, "fuente": "BOT_VENTAS" },
  "clientes_registrados": { "total": 57, "por_segmento": { "EMPRESA": 9, "PERSONA": 48, "SIN_SEGMENTO": 0 }, "solo_bot": 12, "en_ambas": 5 } }
```

1. **Tiempo de primera respuesta:** antes = `tfr_antes_minutos` de `BOT_CONFIG`; después = mediana de minutos entre
   el primer mensaje del cliente y la primera respuesta, por conversación (`BOT_EVENTOS`).
2. **Conversión:** solicitudes confirmadas (`ORDEN_CONFIRMADA`, o marcadas como pagadas/entregadas) ÷ conversaciones.
3. **Pedidos corporativos:** confirmados con segmento `EMPRESA` en el mes de `hasta` y en el anterior.
4. **Ticket promedio:** total por `pedido_id` de `BOT_VENTAS`; sin ventas, el total referencial de las confirmadas
   (`fuente: "BOT_SOLICITUDES"`).
5. **Clientes registrados:** únicos por teléfono en `BOT_CLIENTES` ∪ `BOT_CLIENTES_FUENTE`.

### GET leads

```json
{ "ok": true, "ruta": "leads", "orden": "prioridad", "total": 2, "conteo": { "ALTA": 1, "MEDIA": 1, "BAJA": 0 },
  "datos": [
    { "solicitud_id": "SOL-20261017-0001-2ABC", "fecha_registro": "2026-10-17T15:00:12.000Z", "wa_id": "51987000001",
      "segmento": "PERSONA", "nombre": "Ana", "producto_nombre": "Posataza para cafe - Koi", "cantidad": 50,
      "total_referencial": 2250, "estado": "PENDIENTE_HUMANO", "intencion": "ALTA", "puntaje_intencion": 70,
      "valor_estimado": 2250, "ganancia_estimada": 1350, "prioridad": "ALTA", "puntaje_prioridad": 89, "...": "..." }
  ] }
```

`puntaje_prioridad = (0.45·ganancia + 0.35·valor + 0.20·cantidad) × 100`, cada parte dividida por su tope
(`tope_ganancia`, `tope_valor`, `tope_cantidad`) y recortada a 1. La ganancia usa el `costo` de la hoja fuente o, si
falta, `margen_por_defecto`. `ALTA` avisa al negocio por WhatsApp al momento; `BAJA` en un pedido completo se cierra
con la web y el descuento (estado `CERRADO_WEB`).

## Dashboard: fidelización

### GET segmentos

```json
{ "ok": true, "ruta": "segmentos", "total_clientes": 7, "ultima_sync": "2026-10-17T15:00:00.000Z",
  "segmentos": [
    { "segmento": "CORPORATIVO", "clientes": 1, "con_permiso_marketing": 1, "canal": "EMAIL + ASESOR POR WHATSAPP",
      "oferta": "Descuento por volumen desde 50 unidades y logo grabado sin costo", "activo": "SI" },
    { "segmento": "DORMIDO", "clientes": 1, "con_permiso_marketing": 1, "canal": "WHATSAPP CON CUPÓN + RETARGETING EN META ADS",
      "oferta": "Cupón VUELVE15 por 15 días", "activo": "SI" },
    { "segmento": "SIN_COMPRAS", "clientes": 1, "con_permiso_marketing": 0, "canal": "", "oferta": "", "activo": "" }
  ] }
```

Reglas: `CORPORATIVO` tipo EMPRESA · `DORMIDO` más de 90 días sin comprar · `VIP` top 10 % en total comprado o 3+
pedidos · `RECURRENTE` 2 pedidos · `NUEVO` 1 pedido hace menos de 30 días · `OCASIONAL` 1 pedido de 30 a 90 días ·
`SIN_COMPRAS`. Se aplican en ese orden y se recalculan en cada consulta y en cada sincronización.

### GET segmentos/{segmento}/clientes

```json
{ "ok": true, "ruta": "segmento-clientes", "segmento": "VIP", "total": 1,
  "clientes": [
    { "cliente_id": "C002", "nombre": "Ana Pérez", "telefono": "51987000001", "email": "ana@example.com", "tipo": "PERSONA",
      "acepta_marketing": "SI", "pedidos": 3, "total_comprado": 415, "ultima_compra": "2026-10-05", "dias_sin_comprar": 12,
      "segmento": "VIP", "recomendacion": { "productos": [{ "sku": "PR-432598B6", "nombre": "Mesa Picnic Plegable - YARD", "...": "..." }], "...": "..." } }
  ] }
```

### GET recomendaciones/{cliente_id}

```json
{ "ok": true, "ruta": "recomendacion", "cliente": { "cliente_id": "C004", "nombre": "Carla Ruiz", "segmento": "NUEVO", "...": "..." },
  "cliente_id": "C004", "nombre": "Carla Ruiz", "segmento": "NUEVO",
  "productos": [
    { "sku": "PR-4D383833", "nombre": "Posataza para cafe - Koi", "categoria": "Posatazas", "precio": 45, "motivo": "COMPRADO_JUNTO" },
    { "sku": "PR-4966E8E6", "nombre": "Tabla Quesera - TOSCANA", "categoria": "Tablas queseras", "precio": 110, "motivo": "MAS_VENDIDO_DE_SU_CATEGORIA" }
  ],
  "recompra": { "dias": 20, "base": "FRECUENCIA_DEL_SEGMENTO", "proxima_compra": "2026-10-27", "dias_para_recompra": 10 },
  "canal": "EMAIL Y WHATSAPP", "oferta": "Cupón SEGUNDA10 para tu segunda compra",
  "mensaje": "¡Gracias por tu compra, Carla! ¿Nos dejas una reseña? Como agradecimiento: Cupón SEGUNDA10 para tu segunda compra. Te podría gustar Posataza para cafe - Koi." }
```

`motivo`: `COMPRADO_JUNTO` (pares de productos del mismo pedido), `MAS_VENDIDO_DE_SU_CATEGORIA`, `MAS_VENDIDO` o
`MAS_ECONOMICO_CON_STOCK` (dormidos). A VIP y corporativos se les ordena por ganancia y ticket. `recompra.base` es
`PROMEDIO_ENTRE_COMPRAS` cuando el cliente tiene dos pedidos o más.

### GET / PUT fidelizacion

```json
{ "ok": true, "ruta": "fidelizacion", "reglas": [
  { "segmento": "VIP", "canal": "WHATSAPP PERSONAL (HUMANO)", "frecuencia_dias": "45", "activo": "SI",
    "oferta": "Acceso anticipado a la nueva colección y un regalo en tu próximo pedido",
    "mensaje": "Hola {nombre}, eres de nuestros clientes favoritos de {negocio} 🌳 {oferta}. Te separamos {producto} antes que nadie." } ] }
```

PUT con solo los campos que cambian (el resto de la regla se conserva). `mensaje` acepta `{nombre}`, `{producto}`,
`{oferta}`, `{negocio}` y `{url}`.

```json
{ "reglas": [{ "segmento": "VIP", "oferta": "Envío gratis", "frecuencia_dias": "30" }] }
```

```json
{ "ok": true, "ruta": "fidelizacion", "guardados": ["VIP"] }
```

### POST campanas/{segmento}/preview

Cuerpo vacío (`{}`). No envía nada.

```json
{ "ok": true, "ruta": "campana-preview", "status": 200, "segmento": "NUEVO", "fecha": "2026-10-17", "total": 1,
  "regla": { "segmento": "NUEVO", "canal": "EMAIL Y WHATSAPP", "frecuencia_dias": "20", "activo": "SI", "oferta": "...", "mensaje": "..." },
  "omitidos": { "sin_permiso": 0, "contactado_recientemente": 0, "sin_email": 0 },
  "destinatarios": [
    { "campana_id": "CAMP-NUEVO-20261017-C004", "cliente_id": "C004", "nombre": "Carla Ruiz", "email": "carla@example.com",
      "telefono": "51987000004", "producto": "Posataza para cafe - Koi", "asunto": "ITS WOOD: Cupón SEGUNDA10 para tu segunda compra",
      "mensaje": "¡Gracias por tu compra, Carla! ..." } ] }
```

Solo entran clientes con `acepta_marketing = SI`, con email y a los que no se les envió esa campaña en los últimos
`frecuencia_dias`.

### POST campanas/{segmento}/enviar

```json
{ "confirmar": true }
```

```json
{ "ok": true, "ruta": "campana-enviar", "segmento": "NUEVO", "destinatarios": 1, "errores": 0,
  "omitidos": { "sin_permiso": 0, "contactado_recientemente": 0, "sin_email": 0 } }
```

Envía por email (nodo SMTP del flujo `Mermín - Campañas de fidelización`) y registra cada envío en `BOT_CAMPANAS`
(`ENVIADO` o `ERROR_ENVIO`). Por WhatsApp, fuera de la ventana de 24 h, hace falta una plantilla aprobada por Meta.
Cada día a las 09:00 el mismo flujo deja la vista previa de todos los segmentos en `BOT_CAMPANAS` como `PREVISTA`.

### GET audiencias/{segmento}.csv

Responde `text/csv` como archivo `audiencia_<segmento>.csv`, solo con `acepta_marketing = SI`:

```
telefono,email
+51987000005,diego@example.com
```

## Ejemplos

```bash
curl -H "X-Api-Key: $CLAVE" "http://localhost:5678/webhook/itswood/api/leads?orden=prioridad&nivel=ALTA"
```

```bash
curl -X PUT -H "X-Api-Key: $CLAVE" -H "Content-Type: application/json" -d "{\"nombre_bot\":\"Mermín\"}" http://localhost:5678/webhook/itswood/api/config
```

```bash
curl -X POST -H "X-Api-Key: $CLAVE" -H "Content-Type: application/json" -d "{\"wa_id\":\"51987654321\",\"texto\":\"Hola\"}" http://localhost:5678/webhook/itswood/api/mensaje
```

```bash
node sim/llamar_api.js GET "segmentos/DORMIDO/clientes"
```

## Seguridad

- Rotar la clave cambiando la credencial `ITS WOOD API` en n8n; las plataformas deben guardarla como secreto.
- Exponer n8n solo por HTTPS. La API lee datos de clientes (nombre, teléfono, dirección, email) y exporta audiencias:
  darla solo a sistemas del negocio.
- `campanas/{segmento}/enviar` escribe a clientes reales: revisar antes la vista previa.
