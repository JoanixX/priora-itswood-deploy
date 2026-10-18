# Priora — Landing Page

Landing de **Priora**, un servicio B2B para dueños de negocio: un asistente que atiende a
sus clientes por chat, resuelve solo lo simple y le muestra primero a la dueña o al dueño
los pedidos que más valen, en un tablero. Primer negocio real: ITS WOOD (regalos en madera, Lima).

La landing vive en **`landing/`**: es un sitio **estático, sin framework ni build** (HTML5
semántico, CSS con custom properties y JavaScript vanilla). Se abre con cualquier servidor
estático y se despliega en Vercel con **Root Directory = `landing`**.

## Repositorio

```
.
├── landing/     Esta landing (sitio estático)
├── app/         App de React (tablero y demo)
├── backend/     API en FastAPI
├── docs/        Documentación
└── ref/         Material de referencia (ignorado: nunca se versiona ni se despliega)
```

---

## Estructura de la landing

```
landing/
├── index.html                  Estructura de la landing (sin textos: ver content/)
├── terms.html                  Términos (borrador para prototipo)
├── privacy.html                Privacidad (borrador para prototipo)
├── tools/og-image.html         Fuente de la imagen OG (no se despliega)
└── assets/
    ├── content/
    │   └── landing.es.js       TODOS los textos visibles de la landing
    ├── styles/
    │   ├── tokens.css          Paleta, tipografía y receta de vidrio (copiable al tablero)
    │   └── styles.css          Estilos de la página
    ├── scripts/
    │   ├── config.js           APP_URL y SITE_URL: único lugar para las URLs
    │   ├── content.js          Pinta los textos de landing.es.js en el HTML
    │   ├── main.js             Enlaces a la app, og:url, menú móvil, scrollspy, aparición
    │   └── hero-scene.js       Escena 3D de Spline con respaldo estático
    └── images/
        ├── favicon.svg
        └── og-image.png        Vista previa al compartir (1200×630)
```


---

## Cómo correrlo

Cualquier servidor estático desde `landing/`:

```bash
cd landing
python3 -m http.server 4173
# o
npx serve .
```

Luego abre <http://localhost:4173>.

---

## Configuración: `landing/assets/scripts/config.js`

| Constante  | Para qué |
|------------|----------|
| `APP_URL`  | URL base de la app, sin barra final. "Quiero Priora" lleva a `APP_URL + '/app'` y "Ver demo" a `APP_URL + '/app/mermin'`. Mientras sea `'#'`, la sección Demo, su enlace en la barra y el botón "Ver demo" se ocultan solos, y "Quiero Priora" lleva al cierre de la página. |
| `SITE_URL` | URL pública de la landing en Vercel, sin barra final. Completa `og:url` y vuelve absoluta la `og:image`. |

**Ojo con `SITE_URL`:** WhatsApp, Facebook y LinkedIn no ejecutan JavaScript al generar la
vista previa, así que solo leen lo que está escrito en el `<head>`. Cuando tengas la URL de
Vercel, escríbela también en `og:url` y `og:image` de `landing/index.html` (con la URL absoluta de
la imagen) para que la vista previa funcione en todas las redes.

---

## Cómo cambiar textos

Todo el copy está en `landing/assets/content/landing.es.js`. En `landing/index.html` cada nodo apunta a su
texto con `data-text="seccion.campo"` y las listas con `data-list` + `<template>`.

- Si falta un dato, deja `[POR COMPLETAR]`; lo no validado, márcalo `[SUPUESTO]`.
  Ambos se ven resaltados con un borde punteado.
- El correo de contacto va en `correo`. Se usa en el botón "Escríbenos" del cierre y en el pie.
- Los datos del diagnóstico de ITS WOOD (`caso.diagnostico`) tienen un TODO: confirmar con la
  dueña que se pueden publicar; si no, cambiarlos por texto cualitativo.
- Los metadatos SEO (`<title>`, `description`, `og:*`) están en el `<head>` de
  `landing/index.html`, porque buscadores y redes no ejecutan JS. Si cambias el titular, revísalos.

---

## Cómo cambiar la escena de Spline

La URL vive en **un solo lugar**: el atributo `data-spline-url` de `.hero-visual` en
`landing/index.html`.

```html
<div class="hero-visual" data-spline-url="https://my.spline.design/TU-ESCENA/" aria-hidden="true">
```

- Usa la URL pública de la página de la escena (`my.spline.design/...`).
- El fondo de la escena en Spline debe ser `#8F7A66` (`--taupe-oscuro`), el mismo del hero;
  si cambias uno, cambia el otro o se verá el borde del iframe.
- La cinta queda centrada en el iframe; su posición vertical se ajusta con `top` en
  `.hero-escena` (`landing/assets/styles/styles.css`). El iframe es más alto que el hero para recortar la insignia
  de Spline.
- Si más adelante tienes una URL `.splinecode`, se puede pasar al web component
  `@splinetool/viewer` (versión fijada, desde unpkg o jsDelivr) dentro de `hero-scene.js`.

**Respaldo:** el hero siempre trae una composición estática en CSS + SVG (paneles de vidrio,
esfera durazno y línea de luz). El iframe solo se inserta si hay WebGL, la pantalla mide
901 px o más, no hay `prefers-reduced-motion` y la URL existe; la composición se oculta
recién cuando el iframe dispara `load`. Si la escena falla o tarda más de 15 s, se queda
la composición.

---

## Imagen de vista previa (og-image.png)

Se genera desde `landing/tools/og-image.html` (fondo del hero, cinta en SVG, logo y titular;
no depende de Spline). Para regenerarla: sirve `landing/`, abre
`http://localhost:4173/tools/og-image.html` en una ventana de 1200×630 y captura la pantalla,
por ejemplo con las DevTools de Chrome (modo dispositivo 1200×630 → *Capture screenshot*).
Guárdala como `landing/assets/images/og-image.png`.

---

## Páginas legales

`landing/terms.html` y `landing/privacy.html` son **borradores para el prototipo** y lo dicen en un aviso
visible. Toman la Ley N.º 29733 como marco, sin afirmar que se cumple. Antes de un uso
real, debe revisarlas un abogado.

---

## Desplegar en Vercel (sitio estático)

Desde el panel:

1. **Add New → Project** e importa este repo.
2. **Root Directory:** `landing`.
3. **Framework Preset:** `Other`.
4. **Build Command:** vacío. **Output Directory:** vacío (la raíz de `landing/`). **Install Command:** vacío.
5. Deploy. No hay variables de entorno.

Desde la terminal, dentro de `landing/`:

```bash
cd landing
npx vercel        # despliegue de prueba
npx vercel --prod # producción
```

Con Root Directory = `landing`, solo se publica esa carpeta: `app/`, `backend/`, `docs/` y
`ref/` quedan fuera.

---

## Accesibilidad y calidad

- Contraste AA verificado en todos los pares de texto (ver comentario en `landing/assets/styles/tokens.css`).
- Navegación con teclado, skip-link, foco visible (crema sobre el hero, tinta sobre crema),
  menú móvil con `aria-expanded` y cierre con `Esc`.
- `prefers-reduced-motion`: sin escena 3D, sin flotación ni aparición al hacer scroll.
- Responsive de 320 px a pantallas de proyector.

---

## Flujo de Git

Gitflow simplificado: `main` (producción), `develop` (integración) y ramas `feature/*` que
salen de `develop`. Commits con Conventional Commits (`feat`, `fix`, `style`, `refactor`,
`docs`, `chore`, `perf`).
