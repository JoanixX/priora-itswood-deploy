// Priora landing page
// Código en inglés (variables, funciones); el copy visible vive en assets/content/landing.es.js.


// ============================================
// APP LINKS (APP_URL en assets/scripts/config.js)
// Con una URL real: data-app-path="/app" -> APP_URL + "/app".
// Mientras APP_URL sea '#': se ocultan los nodos data-requiere-app (sección Demo, "Ver demo")
// y los links del navbar que apuntan a ellos; el resto de botones conserva su href (#contacto).
// ============================================

var siteConfig = window.PRIORA_CONFIG || {};
var appUrl = (siteConfig.APP_URL || '').replace(/\/+$/, '');
var hasApp = /^https?:\/\//.test(appUrl);

if (hasApp) {
    document.querySelectorAll('[data-app-path]').forEach(function (link) {
        link.setAttribute('href', appUrl + link.getAttribute('data-app-path'));
    });
} else {
    document.querySelectorAll('[data-requiere-app]').forEach(function (element) {
        element.hidden = true;
        if (!element.id) return;
        document.querySelectorAll('.nav-link[href="#' + element.id + '"]').forEach(function (link) {
            link.closest('li').hidden = true;
        });
    });
}


// ============================================
// SEO: og:url y og:image absoluta desde SITE_URL (config.js)
// Las redes que no ejecutan JS solo verán la og:image relativa: al tener la URL final,
// conviene escribirla también en el <head> de index.html.
// ============================================

var siteUrl = (siteConfig.SITE_URL || '').replace(/\/+$/, '');

if (/^https?:\/\//.test(siteUrl)) {
    var ogUrl = document.querySelector('meta[property="og:url"]');
    var ogImage = document.querySelector('meta[property="og:image"]');
    if (ogUrl) ogUrl.setAttribute('content', siteUrl + '/');
    if (ogImage) ogImage.setAttribute('content', siteUrl + '/' + ogImage.getAttribute('content').replace(/^\/+/, ''));
}


// ============================================
// MOBILE MENU
// ============================================

var hamburgerButton = document.getElementById('hamburger');
var navMenu = document.getElementById('nav-menu');

function setMobileMenu(isOpen) {
    navMenu.classList.toggle('open', isOpen);
    hamburgerButton.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
}

if (hamburgerButton && navMenu) {
    hamburgerButton.addEventListener('click', function () {
        setMobileMenu(!navMenu.classList.contains('open'));
    });

    // Cualquier enlace del menú lo cierra al navegar
    navMenu.addEventListener('click', function (event) {
        if (event.target.closest('a')) setMobileMenu(false);
    });

    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && navMenu.classList.contains('open')) {
            setMobileMenu(false);
            hamburgerButton.focus();
        }
    });
}


// ============================================
// NAVBAR: vidrio más opaco cuando la página ya se desplazó
// ============================================

var navbar = document.getElementById('navbar');

function updateNavbarState() {
    navbar.classList.toggle('is-scrolled', window.scrollY > 8);
}

if (navbar) {
    updateNavbarState();
    window.addEventListener('scroll', updateNavbarState, { passive: true });
}


// ============================================
// SCROLLSPY: resalta el link del navbar según la sección visible
// ============================================

var allNavLinks = document.querySelectorAll('.nav-link');

if ('IntersectionObserver' in window && allNavLinks.length) {
    var scrollSpyObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            var currentHref = '#' + entry.target.id;
            allNavLinks.forEach(function (link) {
                var isCurrent = link.getAttribute('href') === currentHref;
                link.classList.toggle('active', isCurrent);
                if (isCurrent) {
                    link.setAttribute('aria-current', 'true');
                } else {
                    link.removeAttribute('aria-current');
                }
            });
        });
    }, {
        // Se activa cuando la sección ocupa la franja central de la pantalla
        rootMargin: '-45% 0px -45% 0px'
    });

    document.querySelectorAll('main section[id]').forEach(function (section) {
        scrollSpyObserver.observe(section);
    });
}


// ============================================
// APARICIÓN AL HACER SCROLL (suave y breve; nada con prefers-reduced-motion)
// ============================================

var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if ('IntersectionObserver' in window && !reducedMotion) {
    var revealTargets = document.querySelectorAll(
        '.destacados .tarjeta, .seccion .contenedor > *:not(ul):not(ol):not(dl), .lista-puntos > li, .pasos > li, .rejilla-incluye > li, .rejilla-distinto > li, .caso-bloque'
    );

    var revealObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('is-visible');
            revealObserver.unobserve(entry.target);
        });
    }, { rootMargin: '0px 0px -8% 0px' });

    revealTargets.forEach(function (element) {
        // Escalonado dentro de cada grupo de tarjetas
        var siblings = element.parentElement.children;
        element.style.setProperty('--indice', Array.prototype.indexOf.call(siblings, element) % 4);
        element.classList.add('revelar');
        revealObserver.observe(element);
    });
}
