# Configuración del entorno

## 1. n8n local (Docker)

En esta máquina npm no llega a registry.npmjs.org (la conexión se corta), así que n8n corre en Docker.
Versión instalada y verificada: **n8n 2.43.7**.

```bash
docker run -d --name itswood-n8n -p 5678:5678 -v itswood_n8n_data:/home/node/.n8n -e GENERIC_TIMEZONE=America/Lima -e TZ=America/Lima -e N8N_CONCURRENCY_PRODUCTION_LIMIT=1 -e EXECUTIONS_DATA_PRUNE=true -e EXECUTIONS_DATA_MAX_AGE=168 -e N8N_DIAGNOSTICS_ENABLED=false n8nio/n8n:latest
```

```bash
docker start itswood-n8n
```

Interfaz: http://localhost:5678 (la primera vez pide crear la cuenta de propietario). Los datos quedan en el volumen
`itswood_n8n_data`.

| Variable | Valor | Motivo |
| --- | --- | --- |
| `N8N_CONCURRENCY_PRODUCTION_LIMIT` | `1` | Serializa las ejecuciones para no escribir la misma conversación a la vez. |
| `GENERIC_TIMEZONE`, `TZ` | `America/Lima` | Fechas del negocio. |
| `EXECUTIONS_DATA_PRUNE`, `EXECUTIONS_DATA_MAX_AGE` | `true`, `168` | No acumular conversaciones en la base interna de n8n. |

Para que Meta llegue al webhook hace falta una URL HTTPS pública (túnel para la demo, servidor para operación) y
arrancar el contenedor con `-e WEBHOOK_URL=https://<dominio>/`.

## 2. Generar e importar los flujos

1. Copiar `config.example.json` a `config.local.json` y completar `sheetId`, `phoneNumberId`, `waAvisos` y los IDs.
2. `npm run build`: genera `n8n/flujos/` (con marcadores, para compartir) y `n8n/flujos_local/` (con tus valores;
   no compartir: lleva el ID de la hoja).
3. Importar (con IDs fijos, reimportar actualiza los flujos en vez de duplicarlos):

```bash
MSYS_NO_PATHCONV=1 docker exec itswood-n8n mkdir -p /tmp/flujos
```

```bash
for f in n8n/flujos_local/*.json; do MSYS_NO_PATHCONV=1 docker cp "$f" itswood-n8n:/tmp/flujos/; done
```

```bash
docker exec itswood-n8n n8n import:workflow --separate --input=/tmp/flujos
```

IDs actuales en la instancia local: Procesar mensaje `jP354wbPGTBrRimv`, Entrada WhatsApp `j6aeImAEcCktI1Gp`,
Atención humana `dCZ3PbL7k66xrIOb`, Errores `gh5w0Kqt8c2nGNn3`, Prueba local `itswoodPrueba0001`,
Confirmar orden `itswoodConfirmar1`, API `itswoodApi000001`. Con ellos quedan enlazados los subflujos y el flujo de
errores.

4. Publicar (n8n 2.x llama a la versión publicada de los subflujos) y reiniciar:

```bash
for id in jP354wbPGTBrRimv gh5w0Kqt8c2nGNn3 itswoodConfirmar1 itswoodApi000001; do docker exec itswood-n8n n8n publish:workflow --id=$id; done
```

```bash
docker restart itswood-n8n
```

Tras reiniciar, los webhooks tardan unos segundos en quedar disponibles (antes responden 404).

| Flujo | Qué es |
| --- | --- |
| 1 Procesar mensaje | Subflujo del bot: clientes, intención de compra y respuestas de proveedores. |
| 2 Entrada WhatsApp | Webhook de Meta. Se publica cuando haya credenciales de WhatsApp. |
| 3 Atención humana | Formulario del equipo (incluye Confirmar orden). Necesita la credencial Basic Auth. |
| 4 Errores | Registra fallos en `BOT_ERRORES`. |
| 5 Prueba local | Webhook de pruebas sin WhatsApp. No publicar en operación. |
| 6 Confirmar orden | Subflujo: marca la orden y pide cotización a proveedores. |
| 7 API | API para otras plataformas y el dashboard ([api.md](api.md)). Credencial Header Auth `ITS WOOD API` en sus tres webhooks. |
| 8 Sincronizar Drive | Copia la hoja `MERMIN_FUENTE` de la carpeta de Drive a `BOT_PRODUCTOS`, `BOT_CLIENTES_FUENTE` y `BOT_VENTAS`. Cada 10 min, al cambiar la carpeta y con `POST /sync`. |
| 9 Campañas de fidelización | Vista previa diaria (09:00) en `BOT_CAMPANAS`; envía por email solo con `POST /campanas/{segmento}/enviar`. |
| 10 Reportes | Resumen diario (a `hora_resumen_diario`) y semanal (lunes 08:00) por email a `avisos_email`. |

Claves nuevas de `config.local.json` (opcionales): `idSync`, `idCampanas`, `idReportes` (IDs de los flujos 8 a 10),
`driveFolderId` (carpeta que vigila el Google Drive Trigger; sin ella el trigger queda desactivado y la sincronización
sigue por Schedule y por la API), `correoServicio` (correo de la cuenta de servicio, que la API muestra para pedir que
se comparta la carpeta) y `correoRemitente` (remitente de campañas y reportes).

## 3. Credenciales (se crean en n8n, nunca en la hoja)

| Credencial | Dónde se usa |
| --- | --- |
| Google Sheets (OAuth2 o cuenta de servicio) | Todos los nodos de Sheets. Compartir el archivo con esa identidad como editor. |
| WhatsApp API (token de acceso + Business Account ID) | Nodos de envío. |
| WhatsApp OAuth / Trigger (App ID + App Secret) | WhatsApp Trigger. |
| Header Auth | Webhook de simulación. |
| Basic Auth | Formulario de atención humana. |
| Google Drive (la misma cuenta de servicio) | Búsqueda de la hoja en la carpeta y Google Drive Trigger (flujos 7 y 8). El negocio comparte su carpeta con el correo de la cuenta como lector. |
| SMTP | Envío de campañas (flujo 9) y reportes (flujo 10). Se puede cambiar el nodo por Gmail. |

Después de crearlas, abrir cada flujo y elegir la credencial en los nodos marcados. Activar los flujos 1 a 4 y
desactivar el nodo **Webhook de simulación** al pasar a operación.

## 4. Meta / WhatsApp Business

Pendiente de verificar con las cuentas existentes:

- Que el número tenga acceso a WhatsApp Business Platform (Cloud API) y no solo a la aplicación móvil.
- App de Meta vinculada, WhatsApp Business Account ID y Phone Number ID.
- Token con permisos `whatsapp_business_messaging` y `whatsapp_business_management`.
- Suscripción del webhook a `messages` (incluye estados de entrega). Al activar el flujo 2, n8n registra la URL.
- Si el número sigue en la app móvil: comprobar si la coexistencia está disponible. No se presupone.
- Para la demo, una app y un número de prueba de Meta separados.

## 5. Avisos al equipo

**Avisar al equipo** manda un WhatsApp a `avisos_whatsapp` de `BOT_CONFIG` (o, si está vacío, a `waAvisos`) al
derivar. Un lead de prioridad ALTA llega marcado con 🔴, con el valor y la ganancia estimados y el enlace al chat. Es provisional: solo funciona si ese número escribió
al número comercial en las últimas 24 h; si no, falla sin detener la atención. El caso igualmente aparece en
`PAUTAS ` y en `BOT_SOLICITUDES`.
