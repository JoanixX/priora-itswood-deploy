# Plan: Mermín (configuración, conexiones y lógica)

Plan para la demo del hackathon. Solo lógica: el dashboard (frontend) lo hace otra persona contra el contrato de API
de la sección 9. Se construye sobre lo que ya existe: n8n como único backend, el libro de Google Sheets, las pestañas
`BOT_` y la API del flujo [7].

## 0. Decisiones base (para no sobredimensionar)

| Tema | Decisión | Por qué |
| --- | --- | --- |
| Backend | Se queda en **n8n**: lógica en `src/*.js`, incrustada con `npm run build` | Ya funciona y tiene pruebas. Un segundo backend solo para la demo es sobreingeniería. |
| Conexión a Drive y Sheets | Nodos **Google Drive** y **Google Sheets** de n8n con la cuenta de servicio que ya se usa | Es una conexión real, equivalente a `gspread`. `gspread` solo tendría sentido si alguien quiere hacer el sync en Python; queda como alternativa, no como plan. |
| Configuración | Pestaña nueva **`BOT_CONFIG`** (clave/valor) en el libro | El dashboard la edita por la API y el bot la lee en cada mensaje. No hace falta base de datos. |
| Inquilinos | **Un solo negocio** en la demo | Para varios negocios bastaría un libro por negocio más adelante. |
| Frontend | Fuera del alcance de este plan | Se entrega un **contrato de API** (sección 9) para quien hace el dashboard. |
| IA | Reglas fijas por defecto. Claude es **opcional** y solo redacta el texto de las recomendaciones | Rápido y predecible para la demo. |

---

## 1. Configuración y personalización del bot (`BOT_CONFIG`)

Pestaña `BOT_CONFIG` con las columnas `clave | valor | descripcion`. Claves iniciales:

| Clave | Valor por defecto |
| --- | --- |
| `nombre_bot` | `Mermín` |
| `nombre_negocio` | `ITS WOOD` |
| `tono` | `cercano` (`cercano` / `formal`) |
| `emoji_bot` | `🌳` |
| `url_web` | `https://...` |
| `codigo_descuento_web` | `WEB10` |
| `porcentaje_descuento_web` | `10` |
| `mensaje_bienvenida` | Plantilla con `{nombre_bot}`, `{porcentaje}`, `{codigo}`, `{url}` |
| `drive_folder_id` | Vacío; se llena desde el dashboard |
| `sheet_fuente_id` | Lo detecta el sync (sección 3) |
| `margen_por_defecto` | `0.40`, para productos sin costo |
| `umbral_prioridad_alta` / `umbral_prioridad_media` | `70` / `40` |
| `tfr_antes_minutos` | Línea base manual del tiempo de primera respuesta antes del bot (p. ej. `180`) |
| `avisos_whatsapp` / `avisos_email` | Destinos de las notificaciones al negocio |
| `hora_resumen_diario` | `19:00` |

**Lógica:**

- Archivo nuevo `src/config.js` con `leerConfig(filas)` → objeto con valores por defecto y `render(plantilla, config)`.
- En `src/motor.js`, los textos fijos que nombran al bot o al negocio pasan por `render()`. Con eso, el nombre
  "Mermín" se puede editar.
- El flujo [1] Procesar mensaje lee `BOT_CONFIG` junto con las otras pestañas (una lectura más por mensaje; para la
  demo no hace falta caché).

---

## 2. Primer mensaje: redirección a la web

- En `motor.js`, cuando la conversación es nueva (paso `SEGMENTO` y sin mensajes previos), Mermín antepone el
  mensaje de bienvenida:
  > ¡Hola! Soy Mermín 🌳. **Compra en nuestra web y llévate 10% de descuento** con el código **WEB10** 👉
  > {url_web}?utm_source=whatsapp&utm_campaign=mermin
  > ¿Prefieres que te ayude por aquí? Cuéntame si es para tu **empresa** o para **ti**.
- Usar el **UTM** y el **código** sirve para medir después qué ventas web vinieron del bot: columna `codigo` /
  `canal` en la hoja de ventas.
- Se registra el evento `BIENVENIDA_WEB` en `BOT_EVENTOS`.
- Prueba: la conversación nueva recibe la bienvenida una sola vez y la conversación existente no.

---

## 3. Carpeta de Drive como fuente de datos (sincronización dinámica)

**Hoja predefinida** (plantilla que se entrega al usuario: `hoja/plantilla_fuente_mermin.xlsx`) dentro de la
carpeta de Drive, con tres pestañas:

| Pestaña | Columnas |
| --- | --- |
| `PRODUCTOS` | `sku, nombre, categoria, precio, costo, stock, activo` |
| `CLIENTES` | `cliente_id, nombre, telefono, email, tipo (EMPRESA/PERSONA), fecha_registro, acepta_marketing` |
| `VENTAS` | `fecha, pedido_id, cliente_id, sku, cantidad, total, canal (WEB/WHATSAPP/TIENDA), codigo` |

**Flujo nuevo [8] Sincronizar Drive:**

1. Disparadores: un **Schedule cada 10 min**, un **Google Drive Trigger** ("archivo actualizado en carpeta") y
   `POST /sync` desde el dashboard.
2. Lista la carpeta `drive_folder_id` y busca la hoja de cálculo cuyo nombre empiece por `MERMIN_FUENTE` (o la
   primera Sheet que encuentre). Guarda su id en `sheet_fuente_id`.
3. Lee las tres pestañas y valida las cabeceras. Si falta alguna columna, la registra en `BOT_ERRORES` y conserva la
   última copia válida.
4. Vuelca los datos a `BOT_PRODUCTOS`, `BOT_CLIENTES_FUENTE` y `BOT_VENTAS` (borra y reescribe; para la demo vale).
5. Recalcula los segmentos de fidelización (sección 5) y guarda `ultima_sync` en `BOT_CONFIG`.

**Conectar la carpeta desde el dashboard:** `POST /config/drive { url }`. Se extrae el `folderId` de la URL y se
comprueba que la cuenta de servicio tiene acceso. Si no lo tiene, la API responde con el correo de la cuenta de
servicio para que el usuario comparta la carpeta con él.

> Nota: el bot no lee la fuente directamente, sino la copia en `BOT_`. Así un error del usuario en su hoja no rompe
> la conversación.

---

## 4. Segmento del chatbot: prioridad por cantidad, valor y ganancia

Ya existe `calcularIntencion` (puntaje 0–100). Se agrega **`calcularPrioridad`** en `motor.js`:

```
valor    = precio × cantidad
ganancia = (precio − costo) × cantidad      // sin costo: precio × margen_por_defecto
puntaje  = 0.45·norm(ganancia) + 0.35·norm(valor) + 0.20·norm(cantidad)
           (norm = valor / tope fijo de config, recortado a 1) × 100
nivel    = ALTA ≥ 70 · MEDIA ≥ 40 · BAJA
```

- Columnas nuevas en `BOT_SOLICITUDES`: `valor_estimado`, `ganancia_estimada`, `prioridad`, `puntaje_prioridad`.
- **Efectos:**
  - `ALTA` → aviso inmediato al negocio (sección 6) y derivación a humano marcada con 🔴.
  - `MEDIA` → va a `PAUTAS` como hoy.
  - `BAJA` → el bot cierra la conversación con el enlace web y el descuento.
- `GET /leads?orden=prioridad` devuelve la cola ordenada para el dashboard.

---

## 5. Segmento de fidelización (postventa)

**Segmentos** con reglas simples sobre `BOT_VENTAS` y `BOT_CLIENTES_FUENTE` (archivo nuevo `src/fidelizacion.js`):

| Segmento | Regla | Canal | Acción / publicidad |
| --- | --- | --- | --- |
| `CORPORATIVO` | tipo = EMPRESA | Email y asesor por WhatsApp | Catálogo corporativo y descuento por volumen |
| `VIP` | Top 10 % en total comprado o ≥ 3 pedidos | WhatsApp personal (humano) | Acceso anticipado y regalo |
| `RECURRENTE` | 2 pedidos | Plantilla de WhatsApp | Venta cruzada (recomendación) |
| `NUEVO` | 1 pedido hace menos de 30 días | Email y WhatsApp | Agradecimiento, pedido de reseña y cupón para la segunda compra |
| `DORMIDO` | Más de 90 días sin comprar | WhatsApp con cupón y retargeting en Meta Ads | Reactivación |

- Pestaña `BOT_FIDELIZACION` con una fila por segmento: `segmento, canal, mensaje, oferta, frecuencia_dias, activo`.
  Se edita desde el dashboard; esa es la "publicidad por segmento" de forma clara.
- **Audiencias publicitarias:** `GET /audiencias/{segmento}.csv` exporta `telefono,email` (solo con
  `acepta_marketing = SI`) para subirlos a mano como Custom Audience en Meta o Google Ads. En la demo no se integra
  la API de Ads.
- **Recomendaciones postventa:** `recomendar(cliente)` con reglas:
  1. Productos **comprados juntos** con más frecuencia (pares calculados a partir de `BOT_VENTAS`).
  2. Si no hay datos, **lo más vendido de la misma categoría** que aún no compró.
  3. **Momento de recompra**: promedio de días entre sus compras; sin historial, `frecuencia_dias` del segmento.
  4. Se ajustan al segmento: a los VIP y corporativos se les ofrecen productos de mayor ticket o margen y a los
     dormidos lo más barato que tenga stock.
  5. *(Opcional)* Claude solo redacta el mensaje a partir de la recomendación.
- **Flujo nuevo [9] Campañas de fidelización:** corre a diario y arma la lista de "a quién le toca" según
  `frecuencia_dias`. Por defecto queda en **vista previa** (`POST /campanas/{segmento}/preview`) y solo envía con
  `POST /campanas/{segmento}/enviar`. Fuera de la ventana de 24 h, WhatsApp exige una plantilla aprobada por Meta;
  en la demo se usa email (nodo Gmail/SMTP) o números de prueba.

---

## 6. Notificaciones continuas al negocio (leads y ventas)

**Flujo nuevo [10] Reportes:**

| Disparador | Contenido | Canal |
| --- | --- | --- |
| Lead `ALTA` (en el momento) | Cliente, producto, cantidad, valor y ganancia estimada, enlace a la conversación | WhatsApp a `avisos_whatsapp` (ya existe `waAvisos`) |
| Diario a las `hora_resumen_diario` | Leads del día por prioridad, pedidos y ventas del día, y las 5 métricas | Email; WhatsApp si hay plantilla aprobada |
| Lunes a las 08:00 | Lo mismo para la semana, comparado con la anterior, y los segmentos con más clientes por activar | Email |

El texto se arma en `src/reportes.js` (función pura, fácil de probar) y n8n solo lo envía.

---

## 7. Las 5 métricas clave (`src/metricas.js`)

| # | Métrica | Cálculo | Fuente |
| --- | --- | --- | --- |
| 1 | **Tiempo de primera respuesta (antes vs. después)** | Antes: `tfr_antes_minutos` (línea base manual). Después: mediana de (primer `ENVIADO` − primer `RECIBIDO`) por conversación | `BOT_CONFIG`, `BOT_EVENTOS` |
| 2 | **% de consultas que terminan en pedido** | Solicitudes confirmadas por el equipo (flujo [6]) ÷ conversaciones del período | `BOT_SOLICITUDES`, `BOT_CONVERSACIONES` |
| 3 | **Pedidos corporativos al mes** | Solicitudes confirmadas con segmento `EMPRESA` en el mes actual, y su comparación con el mes anterior | `BOT_SOLICITUDES` |
| 4 | **Ticket promedio por pedido** | Σ total ÷ n.º de pedidos del período | `BOT_VENTAS`, o el total referencial de `BOT_SOLICITUDES` si no hay ventas |
| 5 | **Clientes registrados (base para la recompra)** | Clientes únicos por teléfono en `BOT_CLIENTES` ∪ `BOT_CLIENTES_FUENTE`, desglosados por segmento | Ambas pestañas |

`GET /metricas?desde=&hasta=` devuelve exactamente estas 5 métricas, nada más. Las mismas funciones alimentan el
reporte de la sección 6.

---

## 8. Cambios por archivo

| Archivo / flujo | Cambio |
| --- | --- |
| `src/hojas.js` | Pestañas nuevas: `BOT_CONFIG`, `BOT_PRODUCTOS`, `BOT_CLIENTES_FUENTE`, `BOT_VENTAS`, `BOT_FIDELIZACION` |
| `src/config.js` *(nuevo)* | Lectura, valores por defecto y `render` de plantillas |
| `src/motor.js` | Bienvenida con redirección web, textos con `{nombre_bot}`, `calcularPrioridad` |
| `src/fidelizacion.js` *(nuevo)* | `segmentar`, `recomendar`, `audiencia` |
| `src/metricas.js` *(nuevo)* | Las 5 métricas |
| `src/reportes.js` *(nuevo)* | Textos del aviso inmediato, del resumen diario y del semanal |
| `src/api.js` | Rutas de la sección 9 |
| n8n | Flujos nuevos [8] Sincronizar Drive, [9] Campañas, [10] Reportes; [1] lee `BOT_CONFIG` |
| `hoja/` | Plantilla de la fuente `MERMIN_FUENTE` y de las pestañas `BOT_` nuevas |
| `test/` | Un caso por regla: bienvenida, prioridad, cada segmento, recomendación y cada métrica |

---

## 9. Contrato de API para el dashboard (flujo [7], header `X-Api-Key`)

| Método | Ruta | Uso |
| --- | --- | --- |
| GET / PUT | `/config` | Leer y editar la personalización (nombre, tono, bienvenida, descuento, URL, umbrales) |
| POST | `/config/drive` | `{ url }` → conecta la carpeta y valida el acceso |
| POST | `/sync` | Fuerza la sincronización; responde con `ultima_sync` y los errores |
| GET | `/metricas` | Las 5 métricas |
| GET | `/leads?orden=prioridad&nivel=ALTA` | Cola de leads |
| GET | `/segmentos` | Conteo por segmento |
| GET | `/segmentos/{id}/clientes` | Clientes de un segmento, con su recomendación |
| GET / PUT | `/fidelizacion` | Reglas de canal, mensaje y oferta por segmento |
| POST | `/campanas/{segmento}/preview` y `/enviar` | Vista previa y envío |
| GET | `/audiencias/{segmento}.csv` | Exportación para Ads |
| GET | `/recomendaciones/{cliente_id}` | Recomendación postventa de un cliente |

Se documenta en `docs/api.md` con un JSON de ejemplo por ruta, para que quien hace el frontend trabaje en paralelo
con datos simulados.

---

## 10. Orden de trabajo (prioridad para la demo)

1. `BOT_CONFIG` y bienvenida con redirección web: se ve en el primer mensaje.
2. Sincronización de Drive con la hoja predefinida: es la base de datos de todo lo demás.
3. Prioridad por valor y ganancia, con aviso inmediato de lead `ALTA`.
4. Las 5 métricas y `GET /metricas`.
5. Segmentos de fidelización, recomendaciones y exportación de audiencias.
6. Resumen diario y semanal.
7. Rutas restantes de la API y `docs/api.md`.

**Guion de la demo:**

1. Se pega la URL de la carpeta de Drive.
2. Se edita una venta en la hoja y en menos de 10 minutos (o con "sincronizar") cambian las métricas.
3. Un cliente escribe, Mermín lo manda a la web con el 10 % y, si pide 50 unidades, llega el aviso 🔴 al negocio.
4. En el dashboard se muestran los segmentos, la recomendación de un cliente dormido y la descarga de la audiencia.

## 11. Fuera de alcance (a propósito)

Varios negocios a la vez, login de usuarios, integración automática con las APIs de Meta/Google Ads, modelos de
recomendación con ML, caché o colas, y la aprobación de plantillas de Meta: es un trámite que puede tardar, así que
conviene pedirla ya.

## 12. Notas para el equipo

- **Envíos a clientes:** WhatsApp no deja enviar mensajes iniciados por el negocio sin una plantilla aprobada, así
  que en la demo las campañas y resúmenes se envían por email.
- **Ganancia por producto:** la columna `costo` de la hoja fuente es la que permite priorizar por ganancia. Si el
  negocio no la llena, se aplica el `margen_por_defecto` a todos los productos.
