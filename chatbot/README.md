# Chatbot de WhatsApp de ITS WOOD (n8n + Google Sheets)

Mensaje de WhatsApp → preguntas por camino (empresa o persona) → calificación de la intención de compra → registro
en Sheets → derivación → respuesta humana por el mismo chat con el bot en pausa. Al confirmar el equipo una orden,
el bot pide cotización a los proveedores por WhatsApp y guarda sus respuestas. Otras plataformas se conectan por una
API.

**Mermín** (plan en [docs/plan_mermin.md](docs/plan_mermin.md)) suma: personalización desde `BOT_CONFIG`, primer
mensaje con redirección a la web (descuento + UTM), la hoja `MERMIN_FUENTE` de una carpeta de Drive como fuente de
productos, clientes y ventas, prioridad de leads por cantidad, valor y ganancia (aviso 🔴 inmediato), las 5 métricas
clave, segmentos de fidelización con recomendaciones, audiencias para Ads y campañas, y resúmenes diario y semanal.
El dashboard (otro equipo) trabaja contra el contrato de [docs/api.md](docs/api.md).

n8n es el único backend. El registro es el libro de Google Sheets de ITS WOOD: el bot usa sus propias pestañas `BOT_`,
lee `INVENTARIO` y `PROVEEDORES` y añade prospectos a `PAUTAS`; no toca `VENTAS 2026` ni el resto. No hay servidor propio.

```
WhatsApp Cloud API ──webhook──> [2] Entrada WhatsApp ──cada mensaje──> [1] Procesar mensaje ──> WhatsApp
                                                                         │  (clientes o respuestas de proveedores)
Otra plataforma ──HTTP + X-Api-Key──> [7] API ──┬──> [1] Procesar mensaje (respuesta por HTTP)
                                                ├──> lecturas: conversación, solicitudes, proveedores, cotizaciones
                                                └──> [6] Confirmar orden ──plantilla──> proveedores por WhatsApp
Formulario web (equipo) ──> [3] Atención humana ──> Sheets + WhatsApp, o [6] Confirmar orden
Cualquier fallo ──> [4] Errores ──> Sheets (pestaña BOT_ERRORES)

Dashboard ──HTTP + X-Api-Key──> [7] API ──┬──> config, métricas, leads, segmentos, recomendaciones, audiencias (lee el libro)
                                          ├──> [8] Sincronizar Drive (POST /sync)
                                          └──> [9] Campañas (POST /campanas/{segmento}/enviar) ──> email
Carpeta de Drive (MERMIN_FUENTE) ──cada 10 min / al cambiar──> [8] ──> BOT_PRODUCTOS, BOT_CLIENTES_FUENTE, BOT_VENTAS
Cada hora / lunes 08:00 ──> [10] Reportes ──> email al negocio
```

## Estructura

| Ruta | Contenido |
| --- | --- |
| `src/motor.js` | Conversación: pasos, validaciones, catálogo, resumen, derivación, bienvenida web, intención y prioridad. |
| `src/config.js` | `BOT_CONFIG`: valores por defecto, plantillas (`render`) y validación de cambios. |
| `src/sync.js` | Carpeta de Drive y hoja `MERMIN_FUENTE`: elección, validación de columnas y copia a las pestañas `BOT_`. |
| `src/metricas.js` | Las 5 métricas clave. |
| `src/fidelizacion.js` | Segmentos, reglas por segmento, recomendaciones, audiencias y campañas. |
| `src/reportes.js` | Textos del resumen diario y semanal. |
| `src/panel.js` | Respuestas de las rutas del dashboard a partir de las pestañas leídas. |
| `src/ordenes.js` | Confirmación de órdenes, elección de proveedores, plantilla y respuestas de proveedores. |
| `src/api.js` | Rutas, validación y formato de respuestas de la API. |
| `src/normalizar.js`, `src/pasos.js`, `src/humano.js`, `src/hojas.js` | Webhooks, duplicados, cambio de modo, formulario y nombres de pestañas. |
| `n8n/build.js` | Genera `n8n/flujos/*.json` incrustando `src/` en los nodos Code. |
| `n8n/flujos/` | Exportaciones para compartir: **sin credenciales** y con marcadores. |
| `n8n/flujos_local/` | Las mismas con `config.local.json` aplicado (ID de la hoja e IDs de la instancia). No compartir. |
| `hoja/` | Catálogo, equivalencias (`catalogo_bot.csv`), plantilla de pestañas `BOT_` y plantilla de la hoja fuente (`plantilla_fuente_mermin.xlsx`). |
| `sim/` | Simulador local, chat de terminal, clientes de prueba (`enviar_prueba.js`, `llamar_api.js`) y datos de ejemplo de la fuente (`fuente_demo.js`). |
| `test/` | Pruebas de los casos del plan, de proveedores, intención y API, de Mermín (`mermin.test.js`) y del código de los nodos. |
| `docs/` | [Hoja](docs/hoja.md) · [API](docs/api.md) · [Proveedores](docs/proveedores.md) · [Configuración](docs/configuracion.md) · [Atención humana](docs/atencion_humana.md) · [Pruebas](docs/pruebas.md) |

## Uso rápido

```bash
npm test
```

```bash
npm run chat
```

```bash
npm run build
```

`npm run chat` abre una conversación local con el bot (sin WhatsApp ni Sheets). `npm run build` vuelve a generar
los flujos y la plantilla después de cambiar `src/` o `config.local.json`.

## Estado

- 79 pruebas automáticas pasan (hoja en memoria con las pestañas reales y el código real de los nodos Code).
- n8n 2.43.7 en Docker con los 7 primeros flujos importados; escritura real en el libro probada con una cuenta de servicio.
- Pestañas `BOT_`, `PROVEEDORES` y `BOT_COTIZACIONES` creadas en el libro.
- **Mermín, pendiente de probar en n8n:** importar los flujos 8 a 10 y crear en el libro las pestañas nuevas
  (`BOT_CONFIG`, `BOT_PRODUCTOS`, `BOT_CLIENTES_FUENTE`, `BOT_VENTAS`, `BOT_FIDELIZACION`, `BOT_CAMPANAS`) con
  `hoja/pestanas_bot_itswood.xlsx`; credenciales de Drive (la misma cuenta de servicio) y SMTP; cargar `url_web` en
  `BOT_CONFIG` (sin URL el bot no redirige a la web ni cierra los leads BAJA); pedir ya a Meta la aprobación de
  plantillas para campañas por WhatsApp.
- **Pendiente:** compartir el libro con la cuenta de servicio y quitar el acceso público; cargar proveedores;
  aprobar la plantilla `itswood_solicitud_cotizacion` en Meta; conectar WhatsApp Cloud API. Ver [docs/pruebas.md](docs/pruebas.md).
- Fuera de esta entrega: transcripción de audios, botones/listas, varios negocios a la vez, login, APIs de Ads.
