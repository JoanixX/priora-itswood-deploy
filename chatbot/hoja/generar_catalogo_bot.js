'use strict';

// Genera hoja/catalogo_bot.csv (contenido de la pestaña BOT_CATALOGO): el catálogo web con el nombre interno
// que usa el equipo en NOMBRES / INVENTARIO / PAUTAS. Es un BORRADOR: las filas con "revisar" necesitan
// confirmación del equipo, y las que no tienen equivalente no muestran stock ni se cruzan con PAUTAS.
// Los nombres internos se copian tal cual de NOMBRES, con sus espacios finales.

const fs = require('fs');
const path = require('path');
const { leerCsv } = require('../sim/hoja_memoria');

const MAPEO = {
  'PR-49D88389': ['BENDICION DE PUERTA'],
  'PR-49D88359': ['PORTA VELAS'],
  'PR-4B52269D': ['CRUZ DE MADERA'],
  'PR-4D65596A': ['TABLA PARRILERA SMOKEY'],
  'PR-4D655976': ['DOCK 3 EN 1 '],
  'PR-43BDD2E6': ['LAPTOP STAND'],
  'PR-49D55EA7': ['RELOJ TEMPO'],
  'PR-4D6553B6': ['POST IT HOLDER'],
  'PR-478AA935': ['PARLANTE SONE'],
  'PR-49D5587B': ['STAND RELOJ', 'revisar: puede ser STAND RELOJ o WATCH HOLDER'],
  'PR-496A7867': ['JOYERO CORAZON'],
  'PR-48AD92BE': ['MESA PICNIC SUNNY'],
  'PR-4966E8E6': ['TABLA QUESERA TOSCANA'],
  'PR-475BEE5D': ['MINI TABLA BRIE'],
  'PR-42A6886A': ['TABLA QUESERA ARBOL'],
  'PR-4DD3BD67': ['TABLA QUESERA CAPRI'],
  'PR-4AD35DAE': ['MINI TABLA ARBOL', 'revisar: Mini Tabla Quesos ARBOLITO = MINI TABLA ARBOL'],
  'PR-4DD3BDE7': ['ECODESK'],
  'PR-459E2D67': ['ESPEJO AURA'],
  'PR-48A953D9': ['', 'revisar: Posacelular Doble Ranura ¿es POSA CEL CRUZADO?'],
  'PR-4DD3B2DD': ['POSA CEL HEXAGONO'],
  'PR-4BD3A66B': ['POSA CEL CORAZON'],
  'PR-492A873B': ['TABLA QUESERA ROMA '],
  'PR-45BAB372': ['POSA VASO SCAR '],
  'PR-4B75357B': ['POSA CEL TRAPECIO'],
  'PR-4A7796BE': ['PORTA RETRATO LIBRO '],
  'PR-425592EB': ['POSA TAZA LATTE'],
  'PR-4888DED2': ['POSA TAZA CORAZON'],
  'PR-4B78A976': ['PORTA INCIENSO SOULMATE'],
  'PR-4257E8A7': ['PORTA RETRATO LIBRO '],
  'PR-43AD53AB': ['PORTA RETRATO LIBRO '],
  'PR-4D383833': ['POSA TAZA KOI '],
  'PR-489239EA': ['MINI TABLA RACKET ', 'figura DESCONTINUADO en INVENTARIO: el bot no lo ofrecerá'],
  'PR-45E6DE83': ['MINI TABLA CACHIMBO '],
  'PR-4E769779': ['PORTALLAVES LAU'],
  'PR-432598B6': ['MESA PICNIC YARD'],
  'PR-45E6D3AD': ['MESA PICNIC PRAIA'],
  'PR-432598A6': ['MESA PICNIC CORAZON'],
  'PR-48923B88': ['MESA PICNIC GRACE'],
  'PR-47B369A8': ['TOPPERS '],
  'PR-4D3A2E5D': ['TOPPERS '],
  'PR-45E6D377': ['TABLA QUESERA SICILIANA '],
  'PR-4325996A': ['PLATO PARRILERO'],
  'PR-4658AAE2': ['TABLA PARRILLERA  T BONE'],
  'PR-4A398B5B': ['TABLA PARRILERA BRASA'],
  'PR-4A3986E2': ['MINI TABLA LOPEZ '],
};
// Sin comas: el CSV se escribe sin comillas.
const SIN_EQUIVALENTE = 'sin equivalente en NOMBRES: box o modelo que no figura';

const filas = leerCsv(path.join(__dirname, 'catalogo_itswood.csv'));
const columnas = ['id', 'nombre', 'precio_unitario_web_S', 'stock', 'nombre_interno', 'minimo', 'activo', 'nota_equivalencia'];
const csv = [columnas.join(',')];
for (const f of filas) {
  const [interno, nota] = MAPEO[f.id] || ['', SIN_EQUIVALENTE];
  csv.push([f.id, f.nombre, f.precio_unitario_web_S, f.stock, interno, '', '', nota || ''].join(','));
}
fs.writeFileSync(path.join(__dirname, 'catalogo_bot.csv'), csv.join('\n') + '\n');
const sinMapeo = filas.filter(f => !MAPEO[f.id] || !MAPEO[f.id][0]).length;
console.log(`catalogo_bot.csv: ${filas.length} productos, ${filas.length - sinMapeo} con nombre interno, ${sinMapeo} sin equivalente`);
