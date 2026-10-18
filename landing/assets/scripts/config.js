// Priora landing page — configuración. Único lugar para las URLs del sitio y de la app.

window.PRIORA_CONFIG = {
    // URL base de la app, sin barra final (p. ej. 'https://priora-app.vercel.app').
    // La landing es la entrada: "Iniciar sesión" y "Quiero Priora" llevan al login de la app
    // (APP_URL + '/login?volver=/app') y "Ver demo" al login y luego a Mermín ('/login?volver=/app/mermin').
    // Mientras sea '#': se ocultan "Iniciar sesión", la sección Demo y los botones "Ver demo",
    // y "Quiero Priora" lleva al cierre de la página.
    APP_URL: 'https://priora-itswood-deploy.vercel.app',

    // URL pública de esta landing en Vercel, sin barra final. Se usa para og:url y para
    // volver absoluta la og:image.
    // TODO: completar tras el primer despliegue (p. ej. 'https://<proyecto>.vercel.app').
    SITE_URL: 'https://priora-itswood-landing.vercel.app'
};
