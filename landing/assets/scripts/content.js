// Priora landing page — pinta los textos de assets/content/landing.es.js en el HTML.
// Se carga de forma síncrona al final del <body>, antes de main.js, para que el texto
// aparezca de inmediato y nunca después de la escena 3D.
//   data-text="hero.titulo"          -> textContent del nodo
//   data-aria-label="nav.menuAria"   -> atributo aria-label
//   data-href="seccion.url"          -> atributo href
//   data-list="incluye.items"        -> clona el <template> hijo por cada elemento;
//                                       dentro, data-item="titulo" lee del elemento
//                                       (data-item="." usa el elemento entero, para listas de textos)
// Un texto con "[POR COMPLETAR]" o "[SUPUESTO]" recibe la clase is-pendiente para verse marcado.

(function () {
    var content = window.PRIORA_CONTENT;
    if (!content) return;

    var PENDING_PATTERN = /\[(POR COMPLETAR|SUPUESTO)[^\]]*\]/;

    function read(source, path) {
        if (path === '.') return source;
        return path.split('.').reduce(function (value, key) {
            return value == null ? undefined : value[key];
        }, source);
    }

    function setText(element, text) {
        if (typeof text !== 'string') return;
        element.textContent = text;
        element.classList.toggle('is-pendiente', PENDING_PATTERN.test(text));
    }

    function fill(root, source, textAttribute) {
        root.querySelectorAll('[' + textAttribute + ']').forEach(function (element) {
            setText(element, read(source, element.getAttribute(textAttribute)));
        });
    }

    document.querySelectorAll('[data-list]').forEach(function (list) {
        var template = list.querySelector('template');
        var items = read(content, list.getAttribute('data-list'));
        if (!template || !Array.isArray(items)) return;

        items.forEach(function (item) {
            var fragment = template.content.cloneNode(true);
            fill(fragment, item, 'data-item');
            fragment.querySelectorAll('[data-item-href]').forEach(function (element) {
                element.setAttribute('href', read(item, element.getAttribute('data-item-href')));
            });
            list.appendChild(fragment);
        });
    });

    fill(document, content, 'data-text');

    document.querySelectorAll('[data-aria-label]').forEach(function (element) {
        element.setAttribute('aria-label', read(content, element.getAttribute('data-aria-label')));
    });

    document.querySelectorAll('[data-href]').forEach(function (element) {
        element.setAttribute('href', read(content, element.getAttribute('data-href')));
    });

    // Correo de contacto: data-email abre el correo; con data-email-visible también lo muestra
    document.querySelectorAll('[data-email]').forEach(function (element) {
        element.setAttribute('href', 'mailto:' + content.correo);
        if (element.hasAttribute('data-email-visible')) setText(element, content.correo);
    });
})();
