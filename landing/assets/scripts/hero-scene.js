// Priora landing page - escena 3D decorativa del Hero (Spline, en <iframe>)
// La URL de la escena vive en un solo lugar: el atributo data-spline-url de .hero-visual (index.html).
// La composición estática (CSS + SVG) sigue en el HTML como respaldo: solo se oculta cuando
// el iframe disparó "load". No se inserta nada en pantallas de 900px o menos, con
// prefers-reduced-motion, sin WebGL o sin URL; en esos casos Spline ni siquiera se descarga.

(function () {
    // Margen tras "load" para que Spline dibuje su primer cuadro antes de quitar el respaldo
    var FIRST_FRAME_DELAY_MS = 700;
    // Si la escena no carga en este tiempo, se descarta y queda la composición estática
    var LOAD_TIMEOUT_MS = 15000;

    var heroVisual = document.querySelector('.hero-visual');
    var desktopQuery = window.matchMedia('(min-width: 901px)');
    var reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    if (!heroVisual || !desktopQuery.matches || reducedMotionQuery.matches) return;

    var sceneUrl = heroVisual.getAttribute('data-spline-url');
    if (!sceneUrl || !hasWebGL()) return;

    function hasWebGL() {
        try {
            var canvas = document.createElement('canvas');
            return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
        } catch (error) {
            return false;
        }
    }

    function insertScene() {
        var iframe = document.createElement('iframe');
        iframe.className = 'hero-escena';
        iframe.src = sceneUrl;
        iframe.title = 'Escena 3D decorativa: una cinta ondulada en crema, durazno y cobre';
        iframe.loading = 'lazy';
        iframe.setAttribute('tabindex', '-1');   // decorativa: fuera del foco del teclado
        iframe.setAttribute('aria-hidden', 'true');
        iframe.allowFullscreen = false;

        var timeoutId = setTimeout(function () {
            console.warn('[Priora Landing] La escena 3D tardó demasiado, se muestra la composición estática.');
            iframe.remove();
        }, LOAD_TIMEOUT_MS);

        iframe.addEventListener('load', function () {
            clearTimeout(timeoutId);
            setTimeout(function () {
                heroVisual.classList.add('has-scene');   // recién ahora se oculta la composición estática
            }, FIRST_FRAME_DELAY_MS);
        });

        iframe.addEventListener('error', function () {
            clearTimeout(timeoutId);
            iframe.remove();
        });

        heroVisual.appendChild(iframe);
        watchVisibility(iframe);
    }

    // Fuera de pantalla el iframe se oculta: el navegador deja de pintarlo y no gasta GPU
    function watchVisibility(iframe) {
        if (!('IntersectionObserver' in window)) return;
        new IntersectionObserver(function (entries) {
            iframe.style.visibility = entries[0].isIntersecting ? '' : 'hidden';
        }).observe(heroVisual);
    }

    // Primero el texto y los botones: la escena se pide después de "load" de la página
    // y solo cuando el Hero está (o está por estar) en pantalla
    function startWhenVisible() {
        if (!('IntersectionObserver' in window)) {
            insertScene();
            return;
        }
        var observer = new IntersectionObserver(function (entries) {
            if (!entries[0].isIntersecting) return;
            observer.disconnect();
            insertScene();
        }, { rootMargin: '200px 0px' });
        observer.observe(heroVisual);
    }

    if (document.readyState === 'complete') {
        startWhenVisible();
    } else {
        window.addEventListener('load', startWhenVisible, { once: true });
    }
})();
