# Hoja de Google Sheets: pestañas y columnas

Revisado contra el libro entregado ("Copy de ITSWOOD", 14 pestañas del negocio) el 17/10/2026.

## Qué toca el bot en el libro

| Pestaña | Uso del bot | Por qué |
| --- | --- | --- |
| `BOT_CONVERSACIONES`, `BOT_SOLICITUDES`, `BOT_CLIENTES`, `BOT_EVENTOS`, `BOT_ERRORES` | Lee y escribe | Estado técnico del bot. Pestañas nuevas, solo del bot. |
| `BOT_CATALOGO` | Lee | Catálogo web (precios) + `nombre_interno` para cruzar con el libro. |
| `INVENTARIO` | Lee `H3:I300` | Stock de producto terminado (`ITEM ` / `UNIDADES `). |
| `PAUTAS ` | Añade una fila por derivación | Es donde el equipo ya sigue a los prospectos. |
| `VENTAS 2026`, `OT`, `CRONOGRAMA`, `STOCK ACTUAL` y el resto | **No los toca** | Una fila del bot en `VENTAS 2026` alteraría `STOCK ACTUAL` (SUMIF por producto) y `CRONOGRAMA` (QUERY de pendientes). La venta la registra el equipo al confirmarla. |

Las pestañas `BOT_` ya están creadas en "Copy de ITSWOOD" (17/10/2026, sheetId 900001 a 900006), al final del libro,
con cabeceras y `BOT_CATALOGO` cargado. Para otro archivo: importar `hoja/pestanas_bot_itswood.xlsx` con
Archivo › Importar › Subir › **Insertar hojas nuevas**, que no modifica las pestañas existentes ni cambia el enlace.

## BOT_CATALOGO

Borrador generado con `node hoja/generar_catalogo_bot.js` desde el CSV web.

| Columna | Uso |
| --- | --- |
| `id`, `nombre`, `precio_unitario_web_S` | Del CSV web. Precio en soles. Un cambio aplica desde el siguiente mensaje. |
| `nombre_interno` | Nombre exacto en `NOMBRES` / `INVENTARIO` (con sus espacios finales). De aquí salen el stock y el producto que va a `PAUTAS`. |
| `stock` | Solo se usa si el producto no figura en `INVENTARIO`. |
| `minimo` | Opcional. Mínimo autorizado. Vacío = sin mínimo (no se asume 12). |
| `activo` | Opcional. `NO` lo oculta. |
| `nota_equivalencia` | Para revisar. El bot la ignora. |

Estado del borrador: 45 de 55 productos con nombre interno. **Revisar con el equipo:**

- Sin equivalente (no muestran stock; en `PAUTAS` va el nombre web): los 6 box, cera de abeja, portavela GIRLY,
  portacorchos Pale, portarretrato Letra a Mano.
- Dudosos: Soporte para Reloj (`STAND RELOJ` o `WATCH HOLDER`), Posacelular Doble Ranura (¿`POSA CEL CRUZADO`?),
  Mini Tabla Quesos ARBOLITO = `MINI TABLA ARBOL`.
- Mini Tabla quesera Racket figura `DESCONTINUADO` en `INVENTARIO`: el bot no la ofrecerá.

## INVENTARIO

`UNIDADES` numérico = stock; `SIN STOCK` = 0; `DESCONTINUADO` = el bot no ofrece el producto; vacío = no informado.
Con stock menor que la cantidad pedida, el bot avisa que el resto depende de producción.

## PAUTAS (pestaña del equipo; el nombre lleva un espacio final)

| Columna | Lo que escribe el bot |
| --- | --- |
| FECHA MENSAJE, ULTIMO CONTACTO | Fecha de la derivación |
| CLIENTE | Nombre, o "Empresa (contacto)" |
| NUMERO | 9 dígitos sin 51, como texto (igual que las filas actuales) |
| CELEBRACION | Ocasión (camino empresa) |
| FECHA EVENTO | Fecha deseada, o "Sin fecha definida" / "Lo antes posible" |
| LISTADO DE PRODUCTOS | `nombre_interno` (coincide con la validación contra `NOMBRES`) o el nombre web |
| CANTIDAD | Número |
| PROXIMO SEGUIMIENTO | Fecha + 2 días, como la fórmula de las filas existentes |
| ESTADO, MOTIVO DE PERDIDA | Vacíos: los decide el equipo |

Se escribe con `USER_ENTERED` para que las fechas sean fechas. Todo texto del cliente que Sheets podría leer como
fórmula o número va con apóstrofo delante (por ejemplo `'=IMPORTXML(...)`), así que no se ejecuta.
Las validaciones de lista de `PAUTAS` cubren solo hasta la fila 41; las filas nuevas no las tendrán.

## Pestañas BOT_

Reglas: se busca por `wa_id` / `mensaje_id` (nunca por número de fila), las escrituras usan `RAW`, y las columnas
`responsable`, `notas`, `notas_equipo` son del equipo y el bot no las escribe.

- **BOT_CONVERSACIONES**: una fila por cliente. `modo` (`BOT`, `PENDIENTE_HUMANO`, `HUMANO`, `CERRADO`), `paso`,
  datos reunidos, `intentos`, `ultima_entrada` (ventana de 24 h).
- **BOT_SOLICITUDES**: una fila por solicitud completa o derivación, con total referencial (precio web × cantidad).
- **BOT_CLIENTES**: una fila por `wa_id`.
- **BOT_EVENTOS**: cada mensaje entrante y saliente. `resultado`: `RECIBIDO`, `PROCESADO`,
  `SIN_RESPUESTA_ATENCION_HUMANA`, `OMITIDO_CAMBIO_MODO`, `ENVIADO`, `ERROR_ENVIO`, `SIMULADO`, `BIENVENIDA_WEB`; `estado_entrega`
  con los avisos de Meta.
- **BOT_ERRORES**: fallos de los flujos, con tokens ocultos.

## Intención de compra (filtro de clientes)

En cada mensaje el bot califica al cliente con reglas fijas (sin IA). Suma puntos por lo que ya definió y por lo
que dice:

| Señal | Puntos |
| --- | --- |
| Eligió producto | +20 |
| Dio cantidad exacta | +15 |
| Volumen (12 o más unidades, o camino empresa) | +10 |
| Fecha concreta | +10 (+10 más si es dentro de 45 días) |
| "Lo antes posible" | +20 |
| Pidió personalización | +5 |
| Dio nombre / dirección | +5 / +10 |
| Confirmó el resumen | +20 |
| Frases de compra ("quiero comprar", "cotizar", "hacer un pedido"…) | +10 |
| Frases de solo mirar ("solo estoy viendo", "más adelante", "lo voy a pensar"…) | −25 |

**ALTA** desde 60, **MEDIA** desde 30, **BAJA** por debajo. Queda en `intencion`, `puntaje_intencion` y
`senales_intencion` de `BOT_CONVERSACIONES`, y en `intencion` / `puntaje_intencion` de `BOT_SOLICITUDES` y del
aviso al equipo. La API filtra solicitudes con `?intencion=ALTA`.

Qué filtra:
- Una derivación con intención **BAJA** no crea fila en `PAUTAS ` (el seguimiento del equipo queda limpio), pero el
  cliente igual se atiende: queda en `BOT_SOLICITUDES` y pasa a una persona si la pidió.
- Si el cliente dice que solo está mirando, el bot no lo cuenta como respuesta inválida ni insiste.

Los puntos y umbrales están en `src/motor.js` (`PUNTOS_INTENCION`, `UMBRAL_ALTA`, `UMBRAL_MEDIA`).

## Pestañas de Mermín (configuración, fuente de datos y fidelización)

| Pestaña | Quién la escribe | Contenido |
| --- | --- | --- |
| `BOT_CONFIG` | Dashboard (`PUT /config`), sincronización | `clave`, `valor`, `descripcion`. Nace con los valores por defecto de `src/config.js`. El bot la lee en cada mensaje. |
| `BOT_PRODUCTOS` | Flujo [8] | Copia de `PRODUCTOS` de la hoja fuente: `sku, nombre, categoria, precio, costo, stock, activo`. El `costo` alimenta la prioridad por ganancia. |
| `BOT_CLIENTES_FUENTE` | Flujo [8] | Copia de `CLIENTES` más `segmento, pedidos, total_comprado, ultima_compra` (fidelización). |
| `BOT_VENTAS` | Flujo [8] | Copia de `VENTAS`: `fecha, pedido_id, cliente_id, sku, cantidad, total, canal, codigo`. |
| `BOT_FIDELIZACION` | Dashboard (`PUT /fidelizacion`) | Una fila por segmento: `segmento, canal, mensaje, oferta, frecuencia_dias, activo`. |
| `BOT_CAMPANAS` | Flujo [9] | Vista previa diaria (`PREVISTA`) y envíos (`ENVIADO`, `ERROR_ENVIO`), una fila por `campana_id`. |

`BOT_SOLICITUDES` suma `valor_estimado`, `ganancia_estimada`, `prioridad` y `puntaje_prioridad`; `BOT_EVENTOS` registra
`BIENVENIDA_WEB` (dirección `SISTEMA`) cuando el primer mensaje redirige a la web.

**Hoja fuente del negocio:** `hoja/plantilla_fuente_mermin.xlsx` (pestañas `PRODUCTOS`, `CLIENTES`, `VENTAS` con datos
de ejemplo). Se sube a la carpeta de Drive como Google Sheets con un nombre que empiece por `MERMIN_FUENTE`. El bot
nunca la lee directo: si falta una columna, la sincronización lo anota en `BOT_ERRORES` y conserva la copia anterior.
Fechas en `dd/mm/aaaa` o `aaaa-mm-dd`; teléfonos de 9 dígitos se completan con 51; un `total` vacío se calcula con el
precio.

## PROVEEDORES y BOT_COTIZACIONES

Ver [proveedores.md](proveedores.md). `PROVEEDORES` la llena el equipo; `BOT_COTIZACIONES` la escribe el bot.

## Observaciones del libro entregado

- **Permisos:** el archivo está compartido como "cualquiera con el enlace puede editar". Incluye `BALANCE GENERAL`,
  `FLUJO DE CAJA` y datos de clientes. Recomendación: quitar el acceso público y compartirlo solo con el equipo y
  con la cuenta que usará n8n.
- `VENTAS 2026` mezcla teléfonos como número y como texto con espacios, sin código de país; el bot no depende de ellos.
- `NOMBRES` no tiene precios; por eso el precio sale del catálogo web.
- Cuotas: cada mensaje hace unas 11 operaciones de Sheets (300 por minuto por proyecto como referencia).
- **Tiempo de respuesta medido** en n8n local con la hoja real: unos 20 segundos por mensaje, porque las
  operaciones de Sheets van en serie. Funciona, pero se nota. Mejoras posibles: guardar en caché `BOT_CATALOGO` e
  `INVENTARIO` unos minutos, unir las relecturas de `BOT_CONVERSACIONES` y escribir `BOT_EVENTOS` al final.

## Prueba de escritura real (17/10/2026)

Hecha con el webhook de prueba (`ITS WOOD - Prueba local`) y números ficticios `519000000xx`, con la cuenta de
servicio `n8n-itswood@itswood-bot.iam.gserviceaccount.com`. Por ahora la cuenta escribe gracias al enlace público
de edición: **hay que compartir el archivo con esa cuenta (lo hace el propietario) antes de quitar el acceso público.**

- Error encontrado y corregido: n8n convertía la cantidad vacía en 0 en `BOT_CONVERSACIONES` (columna marcada como
  número) y el bot se saltaba la pregunta. Ahora esa pestaña se escribe solo como texto.
- `PAUTAS `: la fila se añade justo después del último prospecto. Las fechas van con `=DATE()` (se ven d/M/yyyy) y
  `PROXIMO SEGUIMIENTO` con la misma regla de +2 días que usa el equipo.
