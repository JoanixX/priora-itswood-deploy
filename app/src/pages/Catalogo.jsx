import { useMemo, useRef, useState } from 'react';
import { Download, Upload, Search, AlertTriangle, CheckCircle2, X, PackageX } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { descargarPlantilla, validarArchivo, confirmarArchivo } from '../services/catalogo.js';
import { formatoSoles } from '../lib/format.js';
import EmptyState from '../components/EmptyState.jsx';
import s from './Catalogo.module.css';

const POCO_STOCK = 5;

export default function Catalogo() {
  const { catalogo, refrescarCatalogo, toast, config } = useApp();
  const [archivo, setArchivo] = useState(null);
  const [validacion, setValidacion] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);
  const [q, setQ] = useState('');
  const input = useRef(null);

  const elegir = async (file) => {
    if (!file) return;
    if (!/\.(xlsx|csv)$/i.test(file.name)) {
      setArchivo(null);
      setValidacion({ valido: false, errores: ['El archivo debe ser .xlsx o .csv.'], vista_previa: [] });
      return;
    }
    setArchivo(file);
    setValidacion(null);
    setCargando(true);
    try {
      setValidacion(await validarArchivo(file));
    } catch (e) {
      setValidacion({ valido: false, errores: [e.message], vista_previa: [] });
    } finally {
      setCargando(false);
    }
  };

  const confirmar = async () => {
    setCargando(true);
    try {
      const r = await confirmarArchivo(archivo);
      await refrescarCatalogo();
      toast({ titulo: 'Catálogo actualizado', texto: `${r.filas} productos activos. ${config.asistente} ya usa estos precios.` });
      setArchivo(null);
      setValidacion(null);
    } catch (e) {
      toast({ titulo: 'No se pudo guardar el catálogo', texto: e.message, tono: 'coral' });
    } finally {
      setCargando(false);
    }
  };

  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase();
    return catalogo.filter((p) => !t || `${p.nombre} ${p.categoria}`.toLowerCase().includes(t));
  }, [catalogo, q]);

  return (
    <div className="pagina">
      <div className="cabecera">
        <div>
          <h1>Catálogo</h1>
          <p className="muted">Sube tu catálogo en Excel o CSV. {config.asistente} usa estos precios para armar los pedidos.</p>
        </div>
        <button className="btn" onClick={() => descargarPlantilla().catch((e) => toast({ titulo: 'No se pudo descargar', texto: e.message, tono: 'coral' }))}>
          <Download size={16} aria-hidden="true" /> Descargar plantilla
        </button>
      </div>

      <section className={`${s.subida} vidrio`} aria-labelledby="subir-titulo">
        <h2 id="subir-titulo">Actualizar catálogo</h2>
        <div
          className={`${s.zona} ${arrastrando ? s.arrastrando : ''}`}
          onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
          onDragLeave={() => setArrastrando(false)}
          onDrop={(e) => { e.preventDefault(); setArrastrando(false); elegir(e.dataTransfer.files[0]); }}
        >
          <Upload size={26} aria-hidden="true" />
          <p>Arrastra tu archivo aquí o</p>
          <button type="button" className="btn btn-primario" onClick={() => input.current?.click()}>Elegir archivo</button>
          <input ref={input} type="file" accept=".xlsx,.csv" className="sr-only" aria-label="Elegir archivo de catálogo" onChange={(e) => { elegir(e.target.files[0]); e.target.value = ''; }} />
          <small className="muted">Columnas: producto, categoria, precio, stock, descripcion</small>
        </div>

        {cargando && <p className="muted" aria-live="polite">Revisando el archivo…</p>}

        {validacion && (
          <div aria-live="polite" className={s.resultado}>
            {archivo && <p className={s.archivo}><strong>{archivo.name}</strong> <button className="btn btn-chico btn-icono" onClick={() => { setArchivo(null); setValidacion(null); }} aria-label="Quitar archivo"><X size={14} /></button></p>}
            {validacion.errores?.length > 0 ? (
              <div className={s.errores}>
                <p><AlertTriangle size={16} aria-hidden="true" /> Hay {validacion.errores.length} {validacion.errores.length === 1 ? 'cosa' : 'cosas'} por corregir:</p>
                <ul>{validacion.errores.slice(0, 20).map((e) => <li key={e}>{e}</li>)}</ul>
                {validacion.errores.length > 20 && <p>…y {validacion.errores.length - 20} más.</p>}
              </div>
            ) : (
              <p className={s.ok}><CheckCircle2 size={16} aria-hidden="true" /> Todo bien: {validacion.filas} productos.</p>
            )}
            {validacion.vista_previa?.length > 0 && (
              <>
                <h3>Vista previa (primeras 10 filas)</h3>
                <TablaProductos productos={validacion.vista_previa} />
              </>
            )}
            {validacion.valido && (
              <button className="btn btn-primario" onClick={confirmar} disabled={cargando}><CheckCircle2 size={16} aria-hidden="true" /> Confirmar catálogo</button>
            )}
          </div>
        )}
      </section>

      <section aria-labelledby="activo-titulo" className={s.activo}>
        <div className={s.activoCabeza}>
          <h2 id="activo-titulo">Catálogo activo ({catalogo.length})</h2>
          <label className={s.buscar}>
            <Search size={16} aria-hidden="true" />
            <span className="sr-only">Buscar producto</span>
            <input className="input" placeholder="Buscar producto" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
        </div>
        {catalogo.length === 0 ? (
          <EmptyState icono={PackageX} texto="Aún no hay catálogo. Descarga la plantilla, llénala y súbela aquí." />
        ) : filtrados.length === 0 ? (
          <EmptyState texto="Ningún producto coincide con tu búsqueda." />
        ) : (
          <TablaProductos productos={filtrados} />
        )}
      </section>
    </div>
  );
}

function TablaProductos({ productos }) {
  return (
    <div className={`${s.tablaCaja} vidrio vidrio-opaco`}>
      <table className={s.tabla}>
        <thead><tr><th scope="col">Producto</th><th scope="col">Categoría</th><th scope="col" className={s.num}>Precio</th><th scope="col" className={s.num}>Stock</th></tr></thead>
        <tbody>
          {productos.map((p) => (
            <tr key={p.id}>
              <td>{p.nombre}</td>
              <td className="muted">{p.categoria}</td>
              <td className={s.num}>{formatoSoles(p.precio)}</td>
              <td className={s.num}>
                {p.stock === null ? <span className="muted">Sin registro</span> : p.stock}
                {p.stock !== null && p.stock < POCO_STOCK && <span className={s.poco}><AlertTriangle size={12} aria-hidden="true" /> Poco stock</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
