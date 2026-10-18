// Priora landing page — todos los textos visibles de la página, en español peruano.
// index.html solo tiene la estructura; assets/scripts/content.js pinta estos textos
// en los nodos con data-text / data-list. Los metadatos SEO (<title>, description, og:*)
// se repiten en el <head> de index.html porque los buscadores y redes no ejecutan JS.
// Reglas: sin precios, cifras de mercado, testimonios ni logos inventados.
// Si falta un dato, se deja "[POR COMPLETAR]" visible; lo no validado se marca "[SUPUESTO]".

window.PRIORA_CONTENT = {
    marca: 'Priora',
    saltarContenido: 'Ir al contenido principal',

    // Correo de contacto: solo se muestra en el cierre ("Escríbenos") y en el pie
    correo: 'priora2026@gmail.com',

    nav: {
        inicioAria: 'Priora, ir al inicio',
        menuAria: 'Abrir menú de navegación',
        links: [
            { href: '#problema', texto: 'El problema' },
            { href: '#como-funciona', texto: 'Cómo funciona' },
            { href: '#que-incluye', texto: 'Qué incluye' },
            { href: '#caso-its-wood', texto: 'Caso ITS WOOD' },
            { href: '#demo', texto: 'Demo' }
        ],
        cta: 'Quiero Priora'
    },

    hero: {
        etiqueta: 'Para dueños de negocio',
        titulo: 'Que tu negocio atienda a todos, sin que tú te satures.',
        subtitulo: 'Priora atiende a tus clientes, resuelve solo lo simple y te muestra primero los pedidos que más valen.',
        ctaPrincipal: 'Quiero Priora',
        ctaSecundario: 'Ver demo'
    },

    // Tarjetas de vidrio bajo el hero
    destacados: {
        cifra: { valor: '3 pasos', texto: 'Tus clientes te escriben por WhatsApp, Priora atiende y tú confirmas.' },
        caracteristica: { titulo: 'Primero lo que más vale', texto: 'Tu tablero ordena los pedidos por prioridad, no por llegada.' },
        // Paráfrasis, no cita textual: aún no hay testimonio con permiso para publicar
        voz: {
            titulo: 'El problema, en palabras de una dueña',
            texto: 'En temporada alta no alcanzo a responder a todos, y la información de los pedidos se pierde entre chats.',
            rotulo: 'ITS WOOD, Lima'
        }
    },

    problema: {
        etiqueta: 'El problema',
        titulo: 'En temporada alta, los mensajes no esperan.',
        texto: 'Llegan muchos clientes a la vez y no te das abasto. Repites lo mismo una y otra vez, y los pedidos que importan se pierden entre chats.',
        puntos: [
            'No llegas a responder a todos a tiempo.',
            'Las preguntas simples se comen tu día.',
            'La información queda regada en conversaciones.'
        ]
    },

    comoFunciona: {
        etiqueta: 'Cómo funciona',
        titulo: 'Tres pasos. Tú sigues al mando.',
        pasos: [
            { numero: '01', titulo: 'Tus clientes escriben.', texto: 'Tus clientes te escriben por WhatsApp, a cualquier hora.' },
            { numero: '02', titulo: 'Priora los atiende.', texto: 'Responde lo simple con tu catálogo, tu tono y tus reglas.' },
            { numero: '03', titulo: 'Tú confirmas.', texto: 'Ves primero los pedidos que más valen y decides.' }
        ]
    },

    incluye: {
        etiqueta: 'Qué incluye',
        titulo: 'Todo listo para tu negocio.',
        items: [
            { titulo: 'Asistente a tu medida', texto: 'Configurado con tu catálogo, tu tono y tus reglas.' },
            { titulo: 'Tablero para ti', texto: 'Tus pedidos ordenados por prioridad, en un solo lugar.' },
            { titulo: 'Catálogo desde Excel', texto: 'Subes tu Excel y Priora ya conoce tus productos.' },
            { titulo: 'Puesta en marcha', texto: 'Lo dejamos funcionando y le damos mantenimiento.' }
        ]
    },

    distinto: {
        etiqueta: 'Qué lo hace distinto',
        titulo: 'No es un chatbot más.',
        tarjetas: [
            { titulo: 'Filtra y prioriza', texto: 'Resuelve solo lo simple y te pasa primero lo que más vale.' },
            { titulo: 'Viene con tu negocio puesto', texto: 'No empiezas de cero: llega con tu catálogo, tu forma de hablar y tus reglas.' }
        ]
    },

    caso: {
        etiqueta: 'Caso real',
        titulo: 'ITS WOOD, nuestro primer negocio.',
        bajada: 'Regalos en madera, en Lima.',
        bloques: [
            { titulo: 'El reto', texto: 'Responder a tiempo en temporada alta, cuando los mensajes llegan todos juntos.' },
            { titulo: 'Lo que hará Priora', texto: 'Atender por WhatsApp las consultas simples y mostrarle a la dueña primero los pedidos que más valen.' }
        ],
        // Diagnóstico, NO resultados: el piloto aún no empieza. Solo porcentajes, sin montos.
        // TODO: confirmar con la dueña de ITS WOOD que estos datos se pueden publicar;
        // si no, cambiarlos por texto cualitativo.
        diagnostico: {
            titulo: 'Diagnóstico con datos reales de ITS WOOD (jun–oct 2026)',
            puntos: [
                'Los pedidos de 12 unidades o más son la mitad de los pedidos, pero cerca del 86 % del ingreso.',
                'WhatsApp concentra alrededor de la mitad de las ventas.'
            ]
        },
        nota: 'En validación con ITS WOOD.'
    },

    demo: {
        etiqueta: 'Demo',
        titulo: 'Mira a Priora en acción.',
        texto: 'Prueba cómo atiende a un cliente y cómo se ve tu tablero.',
        nota: 'En la demo, el chat es una simulación de WhatsApp.',
        cta: 'Ver demo'
    },

    cierre: {
        titulo: 'Que ningún pedido importante se quede esperando.',
        texto: 'Cuéntanos de tu negocio y vemos juntos si Priora es para ti.',
        cta: 'Quiero Priora',
        escribenos: 'Escríbenos'
    },

    footer: {
        derechos: '© 2026 Priora',
        terminos: 'Términos',
        privacidad: 'Privacidad'
    }
};
