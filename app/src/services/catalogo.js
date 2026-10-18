import { pedir, conRespaldo } from './api.js';
import { demo } from './demo/store.js';
import { leerArchivo, validarCatalogo, catalogoDesdeFilas, conIdsActuales, descargarPlantilla as plantillaLocal } from '../lib/catalogo.js';

export async function obtenerCatalogo() {
  return conRespaldo(() => pedir('/catalogo'), async () => structuredClone(demo.catalogo));
}

const conArchivo = (archivo) => {
  const form = new FormData();
  form.append('archivo', archivo);
  return form;
};

export async function validarArchivo(archivo) {
  return conRespaldo(
    () => pedir('/catalogo/validar', { method: 'POST', form: conArchivo(archivo) }),
    async () => validarCatalogo(await leerArchivo(archivo)),
  );
}

export async function confirmarArchivo(archivo) {
  return conRespaldo(
    () => pedir('/catalogo/confirmar', { method: 'POST', form: conArchivo(archivo) }),
    async () => {
      const filas = await leerArchivo(archivo);
      demo.catalogo = conIdsActuales(catalogoDesdeFilas(filas), demo.catalogo);
      return { ok: true, filas: filas.length };
    },
  );
}

export async function descargarPlantilla() {
  return conRespaldo(
    async () => {
      const blob = await pedir('/catalogo/plantilla');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'plantilla_catalogo_priora.xlsx';
      a.click();
      URL.revokeObjectURL(a.href);
    },
    async () => plantillaLocal(),
  );
}
