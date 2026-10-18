# Proveedores y cotizaciones

Cuando **el equipo confirma una orden**, el bot pide cotización por WhatsApp a los proveedores que atienden ese
producto y guarda sus respuestas. El cliente confirma su solicitud, pero la orden la confirma el equipo después de
acordar precio y pago, para no escribir a proveedores por pedidos que no se concretan.

## Cómo se confirma una orden

- **Formulario de atención:** acción **Confirmar orden** con el WhatsApp del cliente (usa su última solicitud).
- **API:** `POST confirmar-orden` con el `solicitud_id` (ver [api.md](api.md)).

Requisitos: la solicitud debe tener producto y cantidad. Se marca `ORDEN_CONFIRMADA` en `BOT_SOLICITUDES`.

## Pestaña PROVEEDORES (la llena el equipo)

| Columna | Uso |
| --- | --- |
| `proveedor_id` | Código corto y único (P01, MADERAS-01…). |
| `nombre` | Aparece en el saludo de la plantilla. |
| `whatsapp` | Con código de país o 9 dígitos (se completa con 51). |
| `rubro`, `contacto`, `notas` | Informativas. |
| `productos` | `TODOS`, o nombres de la pestaña `NOMBRES` separados por coma. Vacío: no se le pide cotización. |
| `activo` | `NO` lo excluye. |

El producto de la orden se cruza con `productos` mediante el `nombre_interno` de `BOT_CATALOGO`. Si un producto no
tiene `nombre_interno`, solo se contacta a los proveedores con `TODOS`.

## Plantilla de WhatsApp (hay que crearla y aprobarla en Meta)

Un proveedor normalmente no habrá escrito al número comercial en las últimas 24 horas, así que WhatsApp exige una
plantilla aprobada. En WhatsApp Manager › Plantillas de mensajes:

- **Nombre:** `itswood_solicitud_cotizacion` · **Idioma:** Español (`es`) · **Categoría:** Utilidad
- **Cuerpo propuesto:**

```text
Hola {{1}}, le escribimos de ITS WOOD. Necesitamos su cotización para el pedido {{2}}: {{3}}, {{4}} unidades. Personalización: {{5}}. Fecha requerida: {{6}}. ¿Nos puede indicar precio y plazo de entrega respondiendo a este mensaje? Gracias.
```

Variables: 1 nombre del proveedor, 2 código de la solicitud, 3 producto, 4 cantidad, 5 personalización,
6 fecha deseada. Si Meta cambia el texto al aprobarla, el orden de las variables debe mantenerse. El nombre y el
idioma se pueden cambiar en `src/ordenes.js` (`PLANTILLA_COTIZACION`).

## Pestaña BOT_COTIZACIONES (la escribe el bot)

Una fila por proveedor y solicitud: `estado` `ENVIADA`, `ERROR_ENVIO` (con el error de WhatsApp en `detalle`),
`SIMULADA` o `RESPONDIDA`. Confirmar de nuevo reintenta los `ERROR_ENVIO` y no repite los ya contactados.

**Respuestas:** cuando un número de `PROVEEDORES` escribe, su mensaje no pasa por el bot de clientes: se guarda en
`respuesta` de su cotización abierta más reciente (varios mensajes se unen con `|`), con `estado = RESPONDIDA`. El
precio y el plazo los lee el equipo; el bot no interpreta montos. Si el proveedor escribe sin cotización abierta, el
mensaje queda en `BOT_EVENTOS` como `PROVEEDOR_SIN_COTIZACION_ABIERTA`.

## Pendiente

- Crear y aprobar la plantilla en Meta; hasta entonces, el envío real devuelve error y queda como `ERROR_ENVIO`.
- Si el equipo quiere un aviso cuando un proveedor responde, se puede agregar al flujo (no está incluido).
