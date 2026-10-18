# Guía de verificación de la app de Priora

Esta guía es para revisar la app sin saber programar. Sigue los pasos en orden y marca cada casilla cuando lo veas funcionar.

Los textos y números de esta guía se comprobaron en la app el 17 de octubre de 2026. Algunos números dependen del día (por ejemplo, "faltan 9 días"). Si verificas otro día, pueden cambiar en 1 o 2.

Cómo anotar un problema, siempre igual:
1. Toma una captura de pantalla.
2. Escribe qué tocaste, en qué orden.
3. Escribe qué esperabas ver y qué viste.

---

## 1. Antes de empezar

[ ] 1.1 Abrir la app

Dónde: en tu computadora, con Google Chrome.

Haz esto:
1. Pide a alguien del equipo que deje la app encendida en tu computadora. Esa persona usa el comando `npm run dev` dentro de la carpeta `app`. No tienes que hacerlo tú.
2. Abre Google Chrome. Usa Chrome: es el navegador con el que se probó todo.
3. Escribe esta dirección y presiona Enter: http://localhost:5173/app
4. Si la app ya está publicada en internet, usa también esta otra dirección:

URL de Vercel: ______________________________________________

Debe pasar: ves la pantalla "¿Qué atiendo hoy?". A la izquierda hay un menú con Priora, ITS WOOD, Inicio, Pedidos, Mermín, Fidelización, Catálogo, Datos y Ajustes.

Si no pasa: anota la dirección que usaste y la captura de lo que ves (página en blanco, error, etc.).

[ ] 1.2 Reconocer el "Modo ejemplo"

Dónde: arriba a la derecha, en la barra superior.

Haz esto:
1. Busca una etiqueta color cobre que dice "Modo ejemplo".
2. Pasa el mouse encima, sin hacer clic.

Debe pasar: aparece el texto "No hay conexión con el servidor: se muestran datos de ejemplo y datos reales anonimizados."

Qué significa:
1. La app no está conectada al servidor del equipo (el "backend", la parte que guarda los datos de verdad).
2. Muestra ventas reales de ITS WOOD de junio a octubre de 2026, pero anonimizadas: sin nombres, sin teléfonos y sin direcciones. Cada cliente aparece como "Cliente 001", "Cliente 002", etc.
3. Muestra 6 pedidos inventados con la etiqueta gris "Ejemplo".
4. Todo lo que cambies se guarda solo mientras no recargues la página. Al recargar (tecla F5, o Cmd + R en Mac), todo vuelve a como estaba al inicio. Esto sirve para repetir la demo.

Si no pasa: si no ves "Modo ejemplo", anótalo. Puede significar que la app sí está conectada al servidor. En ese caso, los números de esta guía pueden ser distintos.

---

## 2. Recorrido rápido de 5 minutos (la demo del pitch)

Antes de empezar, recarga la página (F5 o Cmd + R) para partir de cero.

[ ] 2.1 Ver la campana al inicio

Dónde: http://localhost:5173/app, arriba a la derecha.

Haz esto:
1. Mira el ícono de campana.

Debe pasar: la campana tiene un círculo rojo con el número 2.

Si no pasa: anota el número que ves.

[ ] 2.2 Escenario "Empresa · 30 unidades"

Dónde: menú de la izquierda → "Mermín".

Haz esto:
1. Arriba a la derecha, busca "Escenario de demo".
2. Toca la lista que dice "Elige una conversación…".
3. Elige "Empresa · 30 unidades".
4. Espera unos 15 segundos sin tocar nada. La conversación se escribe sola.

Debe pasar:
1. En el chat de la izquierda aparecen los mensajes del cliente (en verde) y de Mermín (en blanco).
2. El último mensaje de Mermín dice "Todo listo ✨ Tu pedido quedó registrado. La dueña lo confirma y te escribe con el pago y la entrega."
3. En "Pedido en vivo" (a la derecha) se ven: Cliente "Grupo Miraflores SAC", Tipo "Empresa", Ocasión "Navidad", Cantidad "30 u.", Fecha de entrega "15 dic", Total referencial "S/ 2,400".
4. Aparece la etiqueta "Alta" con el texto "Prioridad calculada" y el motivo "Empresa · 30 u. · S/ 2,400".
5. Debajo dice "Ganancia estimada: S/ 1,200".
6. Abajo a la derecha aparece un aviso: "Nuevo pedido de prioridad alta", "Grupo Miraflores SAC · 30 u. · S/ 2,400", con el botón "Ver pedido".
7. La campana sube a 3.

Si no pasa: captura del chat y del panel derecho. Anota cuántos segundos esperaste.

[ ] 2.3 Escenario "Persona · 1 unidad"

Dónde: la misma pantalla de Mermín.

Haz esto:
1. Toca "Elige una conversación…".
2. Elige "Persona · 1 unidad".
3. Espera unos 15 segundos.

Debe pasar:
1. En "Pedido en vivo": Cliente "Valeria", Tipo "Persona", Cantidad "1 u.", Total referencial "S/ 115".
2. Aparece la etiqueta "Automático" con el motivo "Persona · 1 u.".
3. Aparece el aviso "Nuevo pedido resuelto por Mermín", "Valeria · 1 u. · S/ 115". Si cambiaste el nombre del asistente en Ajustes, el aviso usa ese nombre.
4. La campana sube a 4.

Si no pasa: captura y anota qué etiqueta salió.

[ ] 2.4 Escenario "Empresa · 150 unidades"

Dónde: la misma pantalla de Mermín.

Haz esto:
1. Toca "Elige una conversación…".
2. Elige "Empresa · 150 unidades".
3. Espera unos 15 segundos.

Debe pasar:
1. A mitad de la conversación, Mermín dice "Para más de 100 unidades la dueña te arma una propuesta; igual tomo tus datos."
2. En "Pedido en vivo": Cliente "Constructora Pacífico SAC", Cantidad "150 u.", Total referencial "S/ 4,200".
3. Aparece la etiqueta "Derivado" con el motivo "Empresa · 150 u. · más de 100, lo negocias tú". "Derivado" quiere decir que Mermín no lo cierra solo: se lo pasa a la dueña.
4. El último mensaje de Mermín dice "Todo listo ✨ Registré tu pedido. Por el volumen, la dueña te escribe hoy con una propuesta a medida."
5. Aparece el aviso "Pedido derivado: lo negocias tú", "Constructora Pacífico SAC · 150 u. · S/ 4,200".
6. La campana sube a 5.

Si no pasa: captura y anota qué etiqueta salió.

[ ] 2.5 Ver los pedidos nuevos en Inicio

Dónde: menú → "Inicio".

Haz esto:
1. Mira el recuadro "Atiende primero".
2. Baja hasta "¿Cómo va mi negocio?" y mira la tarjeta "Consultas que terminan en pedido".

Debe pasar:
1. "Atiende primero" muestra 5 pedidos. Los recién llegados van arriba, del más nuevo al más antiguo:
   1. "Derivado" · Constructora Pacífico SAC (el último que llegó).
   2. "Alta" · Grupo Miraflores SAC.
   3. "Alta" · Inversiones Andinas SAC.
   4. "Derivado" · Estudio Contable Ríos.
   5. "Alta" · Colegio Los Pinos.
2. "Valeria" no aparece, porque su pedido es "Automático": Mermín lo resolvió solo.
3. "Consultas que terminan en pedido" dice "40 %" y "18 de 45 conversaciones" (antes decía "36 %" y "15 de 42").

Si no pasa: captura del recuadro.

[ ] 2.6 Ver los pedidos nuevos en Pedidos

Dónde: menú → "Pedidos".

Haz esto:
1. Mira el número que aparece encima de la tabla.
2. En el buscador "Buscar producto o cliente", escribe Grupo Miraflores.
3. Borra lo que escribiste y escribe Valeria.

Debe pasar:
1. Encima de la tabla dice "273 pedidos" (antes eran 270).
2. Con "Grupo Miraflores" queda 1 pedido, con la etiqueta "Alta".
3. Con "Valeria" queda 1 pedido, con la etiqueta "Automático".

Si no pasa: anota el número que viste y la captura.

[ ] 2.7 Ver los avisos en la campana

Dónde: cualquier pantalla, campana arriba a la derecha.

Haz esto:
1. Toca la campana.

Debe pasar: se abre un panel "Notificaciones". Arriba están los 3 avisos nuevos, cada uno con "Ahora · sin leer" o "Hace 1 min · sin leer": "Pedido derivado: lo negocias tú", "Nuevo pedido resuelto por Mermín" y "Nuevo pedido de prioridad alta".

Si no pasa: captura del panel.

---

## 3. Verificación completa por pantalla

Antes de empezar esta sección, recarga la página (F5 o Cmd + R).

### Inicio

[ ] 3.1 Bandeja "Atiende primero"

Dónde: http://localhost:5173/app

Haz esto:
1. Mira el recuadro "Atiende primero".

Debe pasar: hay 5 pedidos. Los que llegaron por Mermín en las últimas 24 horas van primero, del más nuevo al más antiguo. Los 6 pedidos "Ejemplo" cuentan como recién llegados, así que el orden es:
1. "Alta" · Inversiones Andinas SAC · "Empresa · 30 u. · S/ 2,400 · ya compró antes" · 21 días (llegó hace unos 25 minutos).
2. "Derivado" · Estudio Contable Ríos · "Empresa · 150 u. · más de 100, lo negocias tú" · 35 días.
3. "Alta" · Colegio Los Pinos · "Empresa · 45 u. · S/ 3,825 · entrega en 9 d" · 9 días.
4. "Alta" · Clínica Sol · "Empresa · 18 u. · S/ 1,080" · 45 días.
5. "Derivado" · Andrés · "Reclamo: lo atiende la dueña" · 4 días (el más antiguo de los 5).

Lucía no aparece: su pedido es "Automático".

Todos llevan la etiqueta gris "Ejemplo" y los botones "Ver" y "Confirmar".

Si no pasa: captura y anota qué pedido falta o cambió de lugar.

[ ] 3.2 Botón "Ver" de la bandeja

Dónde: Inicio, recuadro "Atiende primero".

Haz esto:
1. En "Clínica Sol", toca "Ver".

Debe pasar: se abre la pantalla Pedidos con un panel a la derecha, titulado "Box Navideno Mini Tabla y Cuchillo".

Si no pasa: anota a dónde te llevó.

[ ] 3.3 Las 5 métricas

Dónde: Inicio, debajo de "¿Cómo va mi negocio?", con la lista de la derecha en "Todo 2026".

Haz esto:
1. Lee las 5 tarjetas.
2. En cada una, toca el círculo con la "i".

Debe pasar:
1. "Tiempo de primera respuesta": un número de pocos segundos (por ejemplo "3 s ahora") y debajo "Antes: Por medir con la dueña". Lleva la etiqueta "Ejemplo".
2. "Consultas que terminan en pedido": "36 %" y "15 de 42 conversaciones". Lleva la etiqueta "Ejemplo".
3. "Pedidos corporativos al mes": "27", con una línea pequeña que sube y baja.
4. "Ticket promedio por pedido": "S/ 423" y debajo "Empresa S/ 708 · Persona S/ 117".
5. "Clientes registrados en la hoja": "225" y debajo "Base para la recompra · 29 ya compraron 2 o más veces".
6. Al tocar la "i", aparece una explicación corta del dato. Al pie de cada tarjeta se ve de dónde sale: "Fuente: registros de Mermín." o "Fuente: datos reales anonimizados de la hoja Ventas 2026 (jun–oct 2026)."

Si no pasa: anota la tarjeta y el número que viste.

[ ] 3.4 Los 3 gráficos

Dónde: Inicio, debajo de las métricas.

Haz esto:
1. Lee el título de cada gráfico.
2. Pasa el mouse sobre una barra.
3. Toca "Ver como tabla" debajo de un gráfico.

Debe pasar:
1. Primer gráfico: "Los pedidos de 12+ unidades son el 86 % del ingreso" y debajo "132 de 264 pedidos en todo 2026. Por eso Mermín los pone primero." Es una barra larga cobre ("12+ unidades · S/ 92,021") y una corta azul ("14 %").
2. Segundo gráfico: "Septiembre 2026 fue el mes más fuerte: S/ 49,228". Las barras son jun, jul, ago, sep y oct, con etiquetas "6 mil", "13 mil", "20 mil", "49 mil" y "12 mil".
3. Tercer gráfico: "WhatsApp trae el 54 % de las ventas". Las barras son WhatsApp 54 %, Pautas 27 %, Redes 16 %, Web 0 % y Otros 3 %.
4. Al pasar el mouse, aparece un recuadro con el monto en soles, por ejemplo "S/ 49,228".
5. "Ver como tabla" muestra los mismos datos en filas.
6. Abajo de todo dice "Incluye 26 ventas sin fecha registrada; al elegir un mes no se cuentan."

Si no pasa: captura del gráfico.

[ ] 3.5 Cambiar el período

Dónde: Inicio, lista a la derecha de "¿Cómo va mi negocio?".

Haz esto:
1. Toca la lista "Todo 2026".
2. Elige "septiembre 2026".
3. Al terminar, vuelve a elegir "Todo 2026".

Debe pasar con septiembre:
1. "Pedidos corporativos al mes": "46".
2. "Ticket promedio por pedido": "S/ 713", con "Empresa S/ 1,061 · Persona S/ 139".
3. "Clientes registrados en la hoja": "62", con "8 ya compraron 2 o más veces".
4. El primer gráfico dice "Los pedidos de 12+ unidades son el 93 % del ingreso" y "45 de 79 pedidos en septiembre 2026".
5. El tercer gráfico dice "WhatsApp trae el 66 % de las ventas".

Si no pasa: anota el mes elegido y los números que viste.

### Pedidos

[ ] 3.6 Orden de la tabla

Dónde: menú → "Pedidos".

Haz esto:
1. Mira el número encima de la tabla.
2. Mira las primeras 7 filas.
3. Baja hasta el final de la página.

Debe pasar:
1. Dice "270 pedidos".
2. Arriba van los 6 pedidos "Ejemplo": Andrés (Derivado), Colegio Los Pinos (Alta), Inversiones Andinas SAC (Alta), Estudio Contable Ríos (Derivado), Clínica Sol (Alta) y Lucía (Automático).
3. Después siguen los pedidos de la hoja de ventas, con clientes como "Cliente 180".
4. Cada fila muestra la prioridad con texto y un ícono (no solo color) y, debajo, el motivo en letra pequeña.
5. Abajo dice "Página 1 de 11", con los botones "Anterior" y "Siguiente".

Cómo ordena la app:
1. Primero los pedidos que llegaron por Mermín.
2. Luego los pedidos de la hoja que aún no se entregan.
3. Al final, lo ya entregado o enviado.
4. Dentro de cada grupo: Derivado y Alta primero, luego Media, luego Automático. A igual prioridad, primero la fecha de entrega más cercana y luego el monto más alto.

Si no pasa: captura de las primeras filas.

[ ] 3.7 Cada filtro

Dónde: Pedidos, recuadro de filtros.

Haz esto, uno por vez (después de cada uno, vuelve la lista a "todos"):
1. Lista "Prioridad: todos" → elige cada opción.
2. Lista "Estado: todos" (en qué va el pedido) → elige cada opción.
3. Lista "Tipo: todos" → elige cada opción.
4. Lista "Canal: todos" → elige cada opción.
5. Lista "Origen: todos" → elige cada opción.

Debe pasar (el número aparece encima de la tabla):
1. Prioridad: Derivado 7 · Alta 71 · Media 62 · Automático 130. Estos pueden variar 1 o 2 según el día.
2. Estado: Cantidad completa 10 · Entregado 207 · Enviado 4 · Nueva OT 12 · Nuevo 6 · Pendiente 31.
3. Tipo: Empresa 139 · Persona 131.
4. Canal: Cliente antiguo 4 · Instagram 16 · Orgánico 2 · Otro 12 · Pauta 79 · TikTok 21 · Web 5 · WhatsApp 131.
5. Origen: Mermín 6 · Histórico 264.

Si no pasa: anota el filtro, la opción y el número que viste.

[ ] 3.8 Buscador, fechas y "Limpiar"

Dónde: Pedidos, recuadro de filtros.

Haz esto:
1. En "Buscar producto o cliente", escribe dock.
2. Borra el texto.
3. En "Entrega desde", elige 1 de noviembre de 2026.
4. En "hasta", elige 30 de noviembre de 2026.
5. Mira los botones que aparecen debajo de los filtros.
6. Toca "Limpiar".

Debe pasar:
1. Con "dock" quedan 14 pedidos.
2. Con las fechas de noviembre quedan 4 pedidos.
3. Debajo aparecen dos botones: "Desde: 1 nov" y "Hasta: 30 nov". Tocar uno quita solo ese filtro.
4. Con "Limpiar" vuelven los 270 pedidos.

Si no pasa: anota qué escribiste y el número que viste.

[ ] 3.9 Panel de detalle y "Confirmar"

Dónde: Pedidos.

Haz esto:
1. Toca la fila de "Clínica Sol".
2. Lee el panel que se abre a la derecha.
3. Toca "Confirmar".
4. Cierra el panel con la "X" de arriba (o la tecla Esc).
5. Ve a Inicio y mira "Atiende primero".

Debe pasar:
1. El panel muestra "PED-E004", la etiqueta "Ejemplo" y el título "Box Navideno Mini Tabla y Cuchillo".
2. Debajo dice "Alta" y "¿Por qué? Empresa · 18 u. · S/ 1,080".
3. También se ven: Cliente "Clínica Sol", Ocasión "Navidad", Cantidad "18 u.", Monto "S/ 1,080", Ganancia estimada "S/ 540", Entrega "1 dic · 45 días", Personalización "No" y el resumen "Box navideño para el área administrativa."
4. Al tocar "Confirmar" aparece el aviso "Pedido confirmado". El botón cambia a "Confirmado" y ya no se puede tocar. El campo Estado del panel dice "Confirmado".
5. En Inicio, Clínica Sol ya no está en "Atiende primero". Su lugar lo toma un pedido urgente de la hoja de ventas (por ejemplo "Cliente 216", con entrega cercana). Ese pedido no tiene botón "Confirmar", porque viene del histórico.

Si no pasa: captura del panel.

[ ] 3.10 Pedido de la hoja (solo lectura)

Dónde: Pedidos.

Haz esto:
1. Toca una fila de "Cliente 180".

Debe pasar: el panel dice "Origen: Histórico (anonimizado)". Abajo dice "Este pedido viene del histórico: solo se puede consultar." No hay botones "Confirmar" ni "Marcar como derivado".

Si no pasa: captura.

[ ] 3.11 "Marcar como derivado"

Dónde: Pedidos.

Haz esto:
1. Toca la fila de "Lucía".
2. Toca "Marcar como derivado".

Debe pasar:
1. Aparecen dos avisos: "Marcado como derivado" y, al momento o unos segundos después, "Pedido marcado como derivado", "Lucía", con el botón "Ver pedido".
2. La etiqueta de Lucía cambia a "Derivado". El motivo dice "Marcado como derivado".
3. La campana suma 1 aviso.

Si no pasa: captura.

[ ] 3.12 Exportar a CSV

Dónde: Pedidos, botón "Exportar CSV" arriba a la derecha. CSV es un archivo de tabla que se abre con Excel o Google Sheets.

Haz esto:
1. Toca "Exportar CSV".
2. Abre el archivo descargado "pedidos_priora.csv" con Excel o Google Sheets.
3. Repite con un filtro puesto (por ejemplo "Origen: Mermín") y vuelve a exportar.

Debe pasar:
1. Se descarga "pedidos_priora.csv".
2. Las columnas son: id, origen, prioridad, motivo, cliente, tipo, producto, cantidad, monto, ganancia_estimada, fecha_entrega, canal y estado.
3. Sin filtros tiene 270 filas de pedidos. Con un filtro, solo las filas filtradas.
4. No hay columnas de teléfono, dirección, correo ni forma de pago.
5. Las tildes se leen bien (por ejemplo "Automático").

Si no pasa: guarda el archivo y anota qué columna o fila está mal.

### Mermín

[ ] 3.13 Mensaje de bienvenida y enlace a la tienda

Dónde: menú → "Mermín".

Haz esto:
1. Lee el primer mensaje del chat.
2. Toca el botón "Ir a la tienda".

Debe pasar:
1. Arriba del chat dice, en amarillo, "Simulación de WhatsApp para la demo".
2. El primer mensaje dice "¡Hola! Soy Mermín, el asistente de ITS WOOD. Mira el catálogo completo en nuestra web 👉", con un botón cobre "Ir a la tienda".
3. No aparece ninguna promoción ni descuento: viene apagada.
4. El segundo mensaje dice "¿En qué te ayudo hoy?", con los botones "Regalos para empresa", "Regalo personal" y "Hablar con la dueña".
5. "Ir a la tienda" abre itswood.pe en una pestaña nueva.

Si no pasa: captura del chat.

[ ] 3.14 Conversación escrita a mano

Dónde: Mermín.

Haz esto:
1. Toca "Regalos para empresa".
2. Toca "Aniversario".
3. En la caja "Escribe como si fueras el cliente…", escribe 25 y toca el botón verde de enviar.
4. Toca "En 1 mes".
5. Toca "Posacelular TRAPECIO · S/ 28".
6. Toca "No, así está bien".
7. Escribe Prueba Veinticinco SAC y envía.
8. Toca "Confirmar pedido".

Debe pasar:
1. Antes de confirmar, Mermín muestra un resumen con "25 × Posacelular TRAPECIO: S/ 700" y "Total referencial: S/ 700 (sin delivery)".
2. En "Pedido en vivo", los recuadros se llenan a medida que respondes.
3. Al confirmar, la etiqueta es "Media", con el motivo "Empresa · 25 u.".
4. Aparece el aviso "Nuevo pedido resuelto por Mermín", "Prueba Veinticinco SAC · 25 u. · S/ 700".

No recargues la página: este pedido se usa en la actividad 3.24.

Si no pasa: captura y anota en qué paso se trabó.

[ ] 3.15 "Hablar con la dueña"

Dónde: Mermín.

Haz esto:
1. Toca "Reiniciar conversación".
2. Toca "Hablar con la dueña".
3. Espera hasta 10 segundos.

Debe pasar:
1. Mermín responde "Entiendo. Le paso tu caso a la dueña de ITS WOOD y te escribe muy pronto por aquí. Gracias por elegirnos."
2. En hasta 10 segundos aparece el aviso "Pidió hablar contigo".
3. No se crea un pedido.

Si no pasa: captura.

[ ] 3.16 "Reiniciar conversación"

Dónde: Mermín.

Haz esto:
1. Toca "Reiniciar conversación".

Debe pasar: el chat se borra y vuelven el mensaje de bienvenida y los 3 botones. "Pedido en vivo" queda vacío, con guiones (—).

Si no pasa: captura.

### Fidelización

[ ] 3.17 Segmentos

Dónde: menú → "Fidelización". Un segmento es un grupo de clientes parecidos.

Haz esto:
1. Lee el texto de arriba y las 5 tarjetas.

Debe pasar:
1. Arriba dice "Ideas para que tus clientes vuelvan. Tú decides qué enviar."
2. "Empresas recurrentes": 16 clientes · S/ 15,873 comprados · Última compra: 12 oct.
3. "Empresas de un solo pedido": 106 clientes · S/ 77,122 · 15 oct.
4. "Personas recurrentes": 13 clientes · S/ 4,030 · 7 oct.
5. "Personas de una sola compra": 90 clientes · S/ 10,006 · 14 oct.
6. "Inactivos": 84 clientes · S/ 26,206 · 12 ago. Este número cambia con los días, porque cuenta a quien no compra hace más de 60 días.
7. Debajo dice que no se agrupa por edad, porque no se tiene ese dato.

Si no pasa: anota la tarjeta y los números.

[ ] 3.18 Recomendaciones y mensajes

Dónde: Fidelización.

Haz esto:
1. Toca la tarjeta "Empresas recurrentes".
2. Lee "Recomendaciones postventa".
3. Lee "Canal y campaña sugeridos".
4. Cambia una palabra del borrador del mensaje.
5. Toca "Copiar mensaje".
6. Abre un documento o un chat tuyo y pega (Ctrl + V, o Cmd + V en Mac). No lo envíes a nadie.

Debe pasar:
1. Aparecen 3 recomendaciones, cada una con "¿Por qué?". La primera es "Escríbeles 3 semanas antes de Navidad con Porta Velas".
2. El canal sugerido es "WhatsApp directo".
3. El borrador empieza con "Hola [nombre], te saluda ITS WOOD." y se puede editar.
4. Al tocar "Copiar mensaje", el botón dice "Copiado" por 2 segundos. Al lado dice "En la demo no se envía nada."
5. Lo que pegas es el texto con tu cambio.
6. Hay un "Seguimiento en 3 mensajes": "Gracias", "¿Cómo te fue?" y "Próxima ocasión", cada uno con su botón "Copiar mensaje".
7. La lista "Clientes del segmento (16)" muestra solo alias, como "Cliente 185".
8. La app no envía nada: no hay botón de enviar en ninguna parte.

Si no pasa: captura.

### Catálogo

Haz esta sección al final de la sección 3. Después de subir un catálogo, recarga la página (ver "Diferencias conocidas", punto 2).

[ ] 3.19 Catálogo activo

Dónde: menú → "Catálogo".

Haz esto:
1. Mira el título "Catálogo activo".
2. Escribe arbolito en "Buscar producto".

Debe pasar:
1. Dice "Catálogo activo (55)".
2. Aparece "Mini Tabla Quesos - ARBOLITO", S/ 45, stock 2, con la etiqueta coral "Poco stock". Es el único con esa etiqueta, porque es el único con menos de 5 unidades.
3. Los productos sin stock anotado dicen "Sin registro".

Si no pasa: captura.

[ ] 3.20 Descargar plantilla

Dónde: Catálogo, botón "Descargar plantilla".

Haz esto:
1. Toca "Descargar plantilla".
2. Abre el archivo con Excel o Google Sheets.

Debe pasar: se descarga "plantilla_catalogo_priora.xlsx". Tiene las columnas producto, categoria, precio, stock y descripcion, y una fila de ejemplo ("Posacelular TRAPECIO").

Si no pasa: anota si no se descargó o si se descargó con otro nombre.

[ ] 3.21 Subir un archivo con errores

Dónde: Catálogo, recuadro "Actualizar catálogo".

Archivo: docs/archivos-de-prueba/catalogo_con_errores.csv. Son productos inventados, sin datos personales.

Haz esto:
1. Arrastra el archivo al recuadro punteado, o toca "Elegir archivo" y búscalo.

Debe pasar:
1. Aparece "Hay 3 cosas por corregir:" con estas líneas:
   "Fila 2: precio no es un número"
   "Fila 3: falta el nombre del producto"
   "Fila 4: stock debe ser un número entero o quedar vacío"
2. Aparece una "Vista previa (primeras 10 filas)".
3. No aparece el botón "Confirmar catálogo".

Si no pasa: captura de los mensajes.

[ ] 3.22 Subir un archivo correcto

Dónde: Catálogo.

Archivo: docs/archivos-de-prueba/catalogo_correcto.csv

Haz esto:
1. Sube el archivo igual que antes.
2. Toca "Confirmar catálogo".
3. Recarga la página (F5 o Cmd + R) para volver al catálogo original.

Debe pasar:
1. Aparece "Todo bien: 3 productos."
2. La vista previa muestra "Tabla de prueba OLIVO" (S/ 95, 3, "Poco stock"), "Posacelular de prueba ROBLE" (S/ 30, 20) y "Portavela de prueba CEDRO" (S/ 25, "Sin registro").
3. Al confirmar, aparece el aviso "Catálogo actualizado", "3 productos activos. Mermín ya usa estos precios.", y el título cambia a "Catálogo activo (3)".
4. Después de recargar, vuelve a decir "Catálogo activo (55)".

Prueba extra: sube cualquier imagen. Debe decir "Hay 1 cosa por corregir: El archivo debe ser .xlsx o .csv."

Si no pasa: captura.

### Datos

[ ] 3.23 Conectar una hoja (en modo ejemplo)

Dónde: menú → "Datos".

Haz esto:
1. Lee los pasos de "Conecta tu hoja".
2. Toca "Copiar" al lado del correo.
3. En "Enlace de Google Sheets o carpeta de Drive", escribe hola y toca "Conectar".
4. Borra y escribe https://docs.google.com/spreadsheets/d/prueba-123/edit
5. En "¿Qué es?", elige "Pedidos".
6. Toca "Conectar" y espera unos segundos.
7. Ahora escribe https://drive.google.com/drive/folders/carpeta-de-prueba, elige "Ventas" y toca "Conectar".

Debe pasar:
1. Paso 1 dice "Comparte tu hoja (como lector) con este correo:" y muestra el correo de ejemplo "priora-sheets@priora-demo.iam.gserviceaccount.com". "Copiar" cambia a "Copiado".
2. Con "hola" aparece en rojo: "Pega el enlace de una hoja de Google Sheets (docs.google.com/spreadsheets/…) o de una carpeta de Drive."
3. Con el enlace bueno aparece el aviso "Hoja conectada", "Estamos leyendo tus datos. Te avisamos al terminar."
4. En "Fuentes conectadas" aparece "Pedidos (ejemplo)" con "Sincronizando…". Unos 3 segundos después cambia a "Sincronizada" y "12 filas · Última sincronización: Hace un momento".
5. En hasta 10 segundos aparece el aviso "Hoja Pedidos sincronizada", "12 filas leídas", con el botón "Ver datos".
6. La carpeta de Drive aparece como "Ventas (ejemplo)" con "Error" y el motivo "La carpeta no tiene una hoja con las columnas esperadas."
7. La fuente "Ventas 2026 (ejemplo)" ya estaba conectada desde el inicio, con 264 filas.
8. En ninguna parte se pide una contraseña. Abajo dice "Nunca te pediremos tu contraseña de Google."
9. "Cómo preparar tu hoja" lista las columnas que debe tener cada tipo de hoja: Ventas, Pedidos, Clientes y Catálogo.

Si no pasa: captura.

### Ajustes

Usa el pedido "Prueba Veinticinco SAC" de la actividad 3.14. Si recargaste, créalo de nuevo.

[ ] 3.24 Umbral de alta de 30 a 20

Dónde: menú → "Ajustes", sección "Prioridad".

Haz esto:
1. Busca "Unidades para prioridad alta". Debe decir 30.
2. Cámbialo a 20.
3. Toca "Guardar" en la barra de abajo.
4. Ve a Pedidos y busca Veinticinco.

Debe pasar:
1. La barra de abajo dice "Solo se guarda en esta demo."
2. Al guardar aparece "Cambios guardados", "Mermín ya usa la nueva configuración y las prioridades se recalcularon."
3. El pedido "Prueba Veinticinco SAC" (25 u.) pasa de "Media" a "Alta".

Si no pasa: captura del pedido antes y después.

[ ] 3.25 Umbral inválido

Dónde: Ajustes, sección "Prioridad".

Haz esto:
1. En "Unidades para prioridad alta", escribe 10.
2. Toca "Guardar".
3. Ahora escribe 150.
4. Vuelve a escribir 20.

Debe pasar:
1. Con 10 aparece en rojo, debajo del campo: "Debe ser mayor que el mínimo para empresa".
2. Al tocar "Guardar" aparece el aviso "Revisa los campos marcados" y no se guarda.
3. Con 150 aparece, debajo de "Máximo sin derivar": "Debe ser mayor que las unidades para prioridad alta".
4. Con 20 desaparecen los mensajes rojos.

Si no pasa: captura.

[ ] 3.26 Cambiar el saludo

Dónde: Ajustes, sección "Identidad".

Haz esto:
1. En "Saludo", borra el texto y escribe: ¡Hola! Soy Mermín. Te ayudo a elegir tu regalo de madera.
2. Mira "Así se verá", en la sección "Mensaje de bienvenida".
3. Toca "Guardar".
4. Ve a Mermín. Si el chat ya tenía mensajes tuyos, toca "Reiniciar conversación".

Debe pasar:
1. "Así se verá" cambia mientras escribes.
2. En Mermín, el primer mensaje dice "¡Hola! Soy Mermín. Te ayudo a elegir tu regalo de madera. Mira el catálogo completo en nuestra web 👉".

Prueba extra: cambia "Nombre del asistente" a Lupita y guarda. El menú de la izquierda dice "Lupita". Si el saludo decía "Mermín", ahora dice "Lupita".

Si no pasa: captura.

[ ] 3.27 Activar la promoción

Dónde: Ajustes, sección "Mensaje de bienvenida".

Haz esto:
1. Activa el interruptor "Mostrar promoción". Se pone verde.
2. Mira "Así se verá".
3. Toca "Guardar".
4. Ve a Mermín (o toca "Reiniciar conversación").

Debe pasar:
1. Junto al texto de la promoción dice "SUPUESTO" y "Confirma con la dueña antes de activarla."
2. "Así se verá" agrega "10 % de descuento comprando en la web".
3. En Mermín, esa línea aparece debajo del botón "Ir a la tienda".

Si no pasa: captura.

[ ] 3.28 Dato "antes" del tiempo de respuesta

Dónde: Ajustes, sección "Medición".

Haz esto:
1. En "Tiempo de primera respuesta antes de Mermín (min)", escribe 120.
2. Toca "Guardar".
3. Ve a Inicio.

Debe pasar: la tarjeta "Tiempo de primera respuesta" muestra "120 min →" seguido de los segundos actuales (por ejemplo "120 min → 3 s").

Si no pasa: captura.

[ ] 3.29 Volver a los valores iniciales

Dónde: Ajustes, barra de abajo.

Haz esto:
1. Toca "Restaurar valores".
2. El botón cambia a "Toca otra vez para restaurar". Tócalo de nuevo antes de 4 segundos.
3. Revisa los campos sin recargar la página.

Debe pasar:
1. Con el primer toque no cambia nada: solo pide confirmar. Si esperas 4 segundos, vuelve a decir "Restaurar valores".
2. Con el segundo toque aparece el aviso "Valores restaurados", "Volvió la configuración inicial. Mermín ya la usa."
3. "Unidades para prioridad alta" vuelve a 30.
4. El nombre vuelve a "Mermín" y el saludo a "¡Hola! Soy Mermín, el asistente de ITS WOOD."
5. "Mostrar promoción" vuelve a estar apagado y el tiempo "antes" queda vacío.
6. Los pedidos y avisos que creaste en la demo no se borran. Para borrar también eso, recarga la página (F5 o Cmd + R).

El botón "Descartar" es otra cosa: solo deshace lo que aún no guardaste.

Si no pasa: captura.

### Notificaciones (la campana)

[ ] 3.30 Abrir, ir al lugar correcto y marcar como leído

Dónde: cualquier pantalla, campana arriba a la derecha. Recarga antes para partir con 2 avisos sin leer.

Haz esto:
1. Toca la campana.
2. Toca "Nuevo pedido de prioridad alta".
3. Cierra el panel del pedido y vuelve a abrir la campana.
4. Toca "Hoja Ventas sincronizada".
5. Abre la campana otra vez y toca "Marcar todo como leído".
6. Cierra con la "X" o la tecla Esc.

Debe pasar:
1. Hay 4 avisos: "Nuevo pedido de prioridad alta", "Pedido derivado: reclamo", "Resumen del día" y "Hoja Ventas sincronizada". Los 2 primeros dicen "sin leer" y tienen una franja de color a la izquierda.
2. "Nuevo pedido de prioridad alta" te lleva a Pedidos, con el panel del pedido "Dock 3 en 1 de Madera Personalizado" abierto. La campana baja a 1.
3. "Hoja Ventas sincronizada" te lleva a Datos.
4. "Marcar todo como leído" deja la campana sin número. El botón desaparece.
5. "Resumen del día" lleva a Inicio. "Pedido derivado: reclamo" lleva a Pedidos, con el panel del pedido "Joyero de Madera en Forma de Corazon" abierto.

Prueba extra: en Ajustes → Notificaciones, apaga "Resumen diario de métricas" y guarda. "Resumen del día" ya no aparece en la campana.

Si no pasa: anota qué aviso tocaste y a dónde te llevó.

---

## 4. Celular

[ ] 4.1 Cómo ver la app en tamaño celular

Opción A, en un celular de verdad: abre la URL de Vercel (sección 1). La dirección localhost solo funciona en la computadora donde corre la app.

Opción B, en la computadora:
1. En Chrome, presiona Cmd + Opción + I (Mac) o Ctrl + Shift + I (Windows). Se abre un panel de herramientas.
2. Presiona Cmd + Shift + M (Mac) o Ctrl + Shift + M (Windows). La página se ve como en un celular.
3. Arriba, en la lista de modelos, elige "iPhone SE" (375 de ancho).

Opción C: achica la ventana de Chrome todo lo que puedas, arrastrando el borde derecho hacia la izquierda.

[ ] 4.2 Qué revisar en el celular

Dónde: la app en tamaño celular.

Haz esto:
1. Mira la barra de arriba.
2. Toca el botón de tres rayas ("Abrir menú").
3. Elige "Pedidos".
4. Elige "Mermín" y toca "Pedido", y luego "Chat".
5. Prueba Inicio, Fidelización, Catálogo, Datos y Ajustes.

Debe pasar:
1. El menú de la izquierda desaparece y arriba aparece el botón de tres rayas. Al tocarlo, se abre un menú. Se cierra con la "X", con Esc o tocando fuera.
2. En Pedidos, la tabla se convierte en tarjetas, una por pedido, con títulos pequeños (PRIORIDAD, CLIENTE, PRODUCTO…).
3. En Mermín aparecen dos pestañas: "Chat" y "Pedido". Cada una muestra su parte.
4. En ninguna pantalla hay que mover la página hacia los lados para leer.
5. Los botones se pueden tocar con el dedo sin tocar otro por error.

Si no pasa: captura del celular y el nombre del modelo o del tamaño usado.

---

## 5. Privacidad

[ ] 5.1 Sin datos personales reales

Dónde: todas las pantallas y el archivo CSV.

Haz esto:
1. En Pedidos, elige "Origen: Histórico" y mira la columna Cliente en varias páginas.
2. En Fidelización, abre cada segmento y mira "Clientes del segmento".
3. Abre el CSV exportado (actividad 3.12) y revisa la columna "cliente".
4. Busca en todas las pantallas números de 9 dígitos, direcciones (Av., Calle, Jr.) o RUC.

Debe pasar:
1. Los pedidos de la hoja (origen "Histórico") muestran solo "Cliente 001", "Cliente 002", etc.
2. Los únicos nombres que aparecen son inventados: los 6 pedidos con la etiqueta "Ejemplo" (Andrés, Lucía, Colegio Los Pinos, etc.) y los que tú escribas en Mermín (Grupo Miraflores SAC, Valeria, Constructora Pacífico SAC…). En el CSV no llevan la etiqueta "Ejemplo", pero su columna "origen" dice "Mermín".
3. No aparecen teléfonos, direcciones, RUC, forma de pago ni cuentas bancarias.
4. La columna "Distrito" no se muestra en ninguna pantalla.

Si no pasa: es un problema grave. Haz captura, anota la pantalla exacta y avisa al equipo de inmediato. No compartas la captura fuera del equipo.

---

## 6. Enlaces

[ ] 6.1 Logo y "Volver a Priora"

Dónde: menú de la izquierda: el logo "Priora" arriba y "Volver a Priora" abajo.

Haz esto:
1. Toca el logo "Priora".
2. Vuelve atrás y toca "Volver a Priora".

Debe pasar:
1. En la URL de Vercel (con la dirección de la landing configurada), los dos llevan a la landing de Priora.
2. En http://localhost:5173/app, los dos te dejan en la misma app, en Inicio. Es normal: ver "Diferencias conocidas", punto 1.

Si no pasa: anota la dirección a la que te llevó.

[ ] 6.2 "Ir a la tienda"

Dónde: Mermín, primer mensaje del chat.

Haz esto:
1. Toca "Ir a la tienda".

Debe pasar: se abre itswood.pe en una pestaña nueva. La app sigue abierta en la pestaña anterior.

Si no pasa: anota la dirección que se abrió.

---

## 7. Al terminar

Marca cada sección:

1. Antes de empezar: [ ] OK [ ] Con problemas
2. Recorrido rápido de 5 minutos: [ ] OK [ ] Con problemas
3. Inicio: [ ] OK [ ] Con problemas
4. Pedidos: [ ] OK [ ] Con problemas
5. Mermín: [ ] OK [ ] Con problemas
6. Fidelización: [ ] OK [ ] Con problemas
7. Catálogo: [ ] OK [ ] Con problemas
8. Datos: [ ] OK [ ] Con problemas
9. Ajustes: [ ] OK [ ] Con problemas
10. Notificaciones: [ ] OK [ ] Con problemas
11. Celular: [ ] OK [ ] Con problemas
12. Privacidad: [ ] OK [ ] Con problemas
13. Enlaces: [ ] OK [ ] Con problemas

Problemas encontrados (número de actividad, qué pasó, dónde está la captura):

1. ____________________________________________________________
2. ____________________________________________________________
3. ____________________________________________________________
4. ____________________________________________________________
5. ____________________________________________________________

Fecha de la verificación: ____ / ____ / ________

Nombre de quien verificó: ________________________________

Dirección usada (localhost o Vercel): ______________________

---

## 8. Diferencias conocidas y datos marcados [SUPUESTO]

### Diferencias conocidas

Son cosas que funcionan distinto a lo pedido, o que todavía no están. No son errores de quien verifica.

1. Sin la dirección de la landing configurada, el logo y "Volver a Priora" no llevan a la landing: te dejan en la misma app. En Vercel hay que configurar esa dirección (se llama VITE_LANDING_URL).
2. Después de subir un catálogo nuevo, Mermín ya no sugiere productos (la lista de productos sale vacía) hasta que recargas la página.
3. "Hablar con la dueña", los reclamos y los pedidos de descuento solo crean un aviso, no un pedido. El aviso llega hasta 10 segundos después y lleva a Pedidos en general, no a un pedido.
4. Algunos textos todavía dicen "Mermín" aunque cambies el nombre del asistente: el origen "Mermín" en Pedidos y en el CSV, "Fuente: registros de Mermín." en Inicio, la ayuda de Ajustes → Medición y el resumen de un pedido de ejemplo. El menú, el chat, los títulos y los avisos sí usan el nombre nuevo.
5. Si cambias el saludo o la promoción con una conversación en curso, esa conversación no cambia. Hay que entrar de nuevo a Mermín o tocar "Reiniciar conversación".
6. En modo ejemplo, el chat no usa inteligencia artificial: sigue una conversación guiada. Si escribes algo fuera del guion, Mermín responde "Esa no la sé…" o te pide el dato de nuevo.
7. Algunos pedidos de la hoja muestran monto "S/ 0", porque en la hoja original no tenían precio.
8. En la vista previa del catálogo, una fila con el precio mal escrito se muestra con "S/ 0" (igual se marca el error).
9. En Datos, en modo ejemplo, una carpeta de Drive siempre da "Error" (salvo si eliges "Catálogo"). Sirve para ver cómo se muestra un error.
10. El correo de la cuenta de servicio de Datos es de ejemplo. Una cuenta de servicio es el correo con el que el servidor lee las hojas de Google.
11. Algunos números cambian con el día: "Faltan", "Inactivos" y las prioridades que dependen de una fecha cercana.
12. El "tiempo de primera respuesta" de modo ejemplo cambia un poco después de cada conversación (por ejemplo, de "3 s" a "2 s").
13. Todavía no hay una URL de Vercel publicada.
14. "Atiende primero" pone arriba lo que llegó por Mermín en las últimas 24 horas, aunque otro pedido entregue antes. Por eso, al abrir la app, el reclamo de Andrés (entrega en 4 días) aparece 5.º.
15. Lo que no se construyó a propósito, porque así lo pide el alcance de la demo: no hay inicio de sesión, no se envían mensajes ni campañas reales, no hay WhatsApp real, no se agrupa por edad, no hay precios por volumen ni plazos de producción.

### Datos marcados [SUPUESTO]

Son valores que la dueña todavía tiene que confirmar. En la app llevan la etiqueta "SUPUESTO".

1. Mínimo de unidades para considerar a una empresa: 12.
2. Unidades para prioridad alta: 30.
3. Máximo sin derivar a la dueña: 100 unidades.
4. Días de "fecha cercana": 14.
5. Monto que sube un pedido a prioridad alta: S/ 1,000.
6. Margen estimado para la ganancia: 50 %. No hay margen por producto, así que se usa uno general.
7. Promoción "10 % de descuento comprando en la web": apagada hasta que la dueña la apruebe.
8. Cliente inactivo: más de 60 días sin comprar.
9. Tiempo de respuesta "antes" de Mermín: no se inventa. Dice "Por medir con la dueña" hasta que alguien lo escriba en Ajustes.
10. Métricas de Mermín en modo ejemplo (42 conversaciones, 15 con pedido, unos 3 segundos de respuesta): valores de prueba, con la etiqueta "Ejemplo".
