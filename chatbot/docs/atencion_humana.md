# Guía de atención humana

Cuando el cliente pide un asesor, confirma su solicitud o el bot no lo entiende tres veces, la conversación pasa a
`PENDIENTE_HUMANO`: el bot deja de responderle y se crea una fila en **BOT_SOLICITUDES** con el resumen y un prospecto en **PAUTAS**.

## Dónde ver los casos

- **PAUTAS**: el prospecto aparece con fecha, cliente, número, producto y cantidad, como los demás. ESTADO queda vacío para que lo ponga el equipo. Solo llegan los de intención MEDIA o ALTA.
- **BOT_SOLICITUDES**: la columna `intencion` (ALTA, MEDIA, BAJA) ayuda a priorizar; el aviso al equipo también la trae.
- **BOT_SOLICITUDES**: filtrar `estado = PENDIENTE_HUMANO`. La columna `resumen` tiene todo lo conversado.
- **BOT_EVENTOS**: filtrar por `wa_id` para leer los mensajes del cliente, incluidos los que llegan mientras lo atiende una persona.

## Cómo responder

Abrir el formulario de atención (`https://<n8n>/form/itswood-atencion`, con usuario y clave):

| Acción | Efecto |
| --- | --- |
| Tomar caso | Modo `HUMANO` y queda tu nombre como responsable. Si escribes un mensaje, se envía. |
| Responder | Envía el mensaje al cliente por el mismo chat de WhatsApp. |
| Devolver al bot | Modo `BOT`: el bot responde desde el próximo mensaje del cliente. |
| Cerrar caso | Modo `CERRADO`: si el cliente vuelve a escribir, empieza un pedido nuevo (recuerda su nombre). |
| Confirmar orden | Confirma la última solicitud del cliente y pide cotización a los proveedores de ese producto (ver [proveedores.md](proveedores.md)). No cambia el modo ni escribe al cliente: deja el mensaje vacío. |

La página confirma lo que pasó. Si el mensaje no se envió, muestra el error de WhatsApp.

## Reglas

- No cambiar `modo` a mano en la hoja: el formulario deja registro y evita estados inválidos.
- Fuera de las 24 h desde el último mensaje del cliente, WhatsApp no permite texto libre: el formulario lo rechaza y no cambia nada.
- El precio que ve el cliente es referencial (precio web × cantidad). Precio final, fecha, personalización y pago los confirma el equipo.
- Al cerrar la venta, registrarla en **VENTAS 2026** como siempre (el bot no escribe ahí) y actualizar `estado` / `fecha_confirmada` en **BOT_SOLICITUDES**.

## Limitaciones de esta entrega

- El equipo lee los mensajes en la hoja y responde con el formulario: no es una bandeja de chat.
- Las imágenes del cliente quedan como `media_id` y no se guardan en Drive. Meta las conserva por un tiempo limitado;
  falta decidir si se descargan a una carpeta.
