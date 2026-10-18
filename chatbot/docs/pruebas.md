# Pruebas

## Hechas

**Automáticas (`npm test`, 34 pruebas)**: hoja en memoria con las pestañas reales (`BOT_*`, `PAUTAS `, `INVENTARIO`)
y el mismo código de los nodos Code.

| Caso | Prueba en `test/flujo.test.js` |
| --- | --- |
| Caminos empresa y persona completos | camino persona completo, camino empresa |
| Pedir asesor desde cualquier paso | pedir un asesor…, ASESOR desde el primer mensaje |
| Mínimos por producto, sin asumir 12 | mínimos |
| Cantidad exacta ("50 o más" no vale) | camino empresa |
| Fecha pendiente de confirmación, fechas pasadas | fechas, camino persona |
| Personalización como solicitud, logo por imagen | camino empresa |
| Nombre, dirección y horario separados | nombre, dirección y horario… |
| Cambio de segmento conservando datos | cambiar de camino… |
| Dos mensajes seguidos, dos clientes, duplicado | dos clientes…, dos mensajes seguidos…, mensaje duplicado |
| Reinicio y recuperación desde la hoja | reinicio |
| Caída de Sheets, error de envío | caída de Sheets…, error de envío… |
| Toma humana durante el procesamiento | si una persona toma el caso… (dos momentos) |
| Derivación y respuesta por el mismo chat | atención humana… |
| Prospecto en PAUTAS con nombre interno y fechas | PAUTAS… (dos pruebas) |
| Stock de INVENTARIO, descontinuados, sin stock | INVENTARIO… |
| Audios, texto con fórmula, estados de entrega | audios…, texto que empieza como fórmula…, estados de entrega… |

`test/n8n.test.js` ejecuta el código de los nodos generados con `$` y `$input` simulados.

**En n8n 2.43.7 (Docker)**:

- Los 4 flujos se importan sin errores (`n8n import:workflow`).
- Todas las versiones de nodo usadas existen en esa instalación.
- El validador de parámetros de n8n (`NodeHelpers.getNodeParametersIssues`) no reporta problemas en ninguno de los
  53 nodos. Con un control negativo (nodos incompletos a propósito) sí los detecta.

**Contra el libro real (lectura)**: estructura de las 14 pestañas, cabeceras, fórmulas, validaciones y permisos.
Hallazgos en [hoja.md](hoja.md).

**Escritura real en el libro (n8n + cuenta de servicio, 17/10/2026)**, con `node sim/enviar_prueba.js "<texto>" <número>`
contra el flujo `ITS WOOD - Prueba local`:

- Camino empresa completo: estado, eventos, solicitud (cantidad 20, total 1700 como números), cliente y fila en
  `PAUTAS ` con fechas reales y la fórmula de seguimiento. Stock leído de `INVENTARIO` (aviso de "sin stock").
- Derivación a mitad de camino: cantidad y total vacíos (no 0) y el bot deja de responder.
- Mensaje con ID repetido: descartado como duplicado.
- Error encontrado y corregido en esta prueba: la cantidad vacía se guardaba como 0 (ver [hoja.md](hoja.md)).
- Tiempo medido: unos 20 segundos por mensaje.

Los datos de prueba (números `51900000001` a `51900000003` y las filas 15 a 17 de `PAUTAS `) se borraron después,
y en esas filas se restauró la fórmula original de `PROXIMO SEGUIMIENTO`.

**Proveedores, intención de compra y API en n8n real (17/10/2026)**, con `sim/llamar_api.js` y un proveedor ficticio:

- API: `salud` 200, sin clave 403, método incorrecto 405, ruta inexistente 404.
- `POST mensaje`: conversación completa por HTTP (persona, "quiero cotizar", 15 unidades, "lo antes posible");
  intención **ALTA 100** y fila en `PAUTAS `. Otro cliente "solo estoy viendo" + ASESOR: **BAJA 0**, atendido pero
  **sin** fila en `PAUTAS `.
- `GET solicitudes?intencion=ALTA|BAJA` y `GET conversacion` devuelven lo esperado.
- `POST confirmar-orden` (simular): orden `ORDEN_CONFIRMADA` y cotización `SIMULADA`; la segunda llamada no repite
  el contacto; una solicitud sin cantidad devuelve 400.
- Respuesta del proveedor por el webhook de WhatsApp: cotización `RESPONDIDA` con su texto; el bot de clientes no le
  contestó. `GET cotizaciones` la muestra.
- Sin errores en `BOT_ERRORES`. Tiempos: 20 a 60 segundos por mensaje y unos 20 segundos al confirmar una orden.
- No probado: el envío real de la plantilla (falta la credencial de WhatsApp y la aprobación en Meta).
- Los datos de prueba se borraron después.

## Pendientes (necesitan acciones del equipo)

1. ~~Crear las pestañas BOT_~~ (hecho el 17/10/2026). Falta que el equipo revise los `nombre_interno` marcados
   "revisar" o "sin equivalente" en `BOT_CATALOGO`.
2. **Credencial de Google en n8n** con acceso de editor al libro. Luego, con el webhook de simulación:

```bash
curl -X POST http://localhost:5678/webhook/itswood-simulacion -H "X-Api-Key: <clave>" -H "Content-Type: application/json" -d @sim/ejemplo_mensaje.json
```

   Revisar que: `appendOrUpdate` no toca `responsable` / `notas`; `wa_id` queda como texto; la fila de `PAUTAS `
   tiene fechas reales y el producto coincide con `NOMBRES`; `INVENTARIO` se lee desde `H3`; ninguna otra pestaña cambia.
3. **WhatsApp de prueba** con teléfonos del equipo: los dos caminos, ASESOR, toma con el formulario y respuesta por el mismo chat.
4. **Firma del webhook**: confirmar que el WhatsApp Trigger rechaza peticiones sin firma válida de Meta.
5. **Concurrencia**: dos teléfonos a la vez con `N8N_CONCURRENCY_PRODUCTION_LIMIT=1`; medir la espera.
6. **Piloto** con el número comercial.
