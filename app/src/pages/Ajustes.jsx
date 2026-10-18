import { useEffect, useMemo, useState } from 'react';
import { Save, ExternalLink, Sparkles, RotateCcw } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { validarConfig } from '../lib/prioridad.js';
import { CONFIG_DEMO } from '../data/configDemo.js';
import s from './Ajustes.module.css';

const TONOS = [
  ['cercano', 'Cercano', 'Habla de tú, con emojis suaves.'],
  ['formal', 'Formal', 'Directo y respetuoso.'],
  ['premium', 'Premium', 'Cuidado y elegante, como la marca.'],
];

const DERIVAR = [
  ['reclamos', 'Reclamos'],
  ['descuentos', 'Pedidos de descuento'],
  ['disenos_especiales', 'Diseños especiales'],
  ['pide_persona', 'Pide hablar con una persona'],
];

const reemplazarPalabra = (texto, viejo, nuevo) => {
  const escapado = viejo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return texto.replace(new RegExp(`(?<!\\p{L})${escapado}(?!\\p{L})`, 'gu'), nuevo);
};

// Solo los campos que se pueden editar aquí (lo que acepta PATCH /config).
const editables = (c) => ({
  asistente: c.asistente.trim(), textos: { saludo: c.textos.saludo.trim() }, tono: c.tono,
  reglas: c.reglas, derivar: c.derivar, bienvenida: c.bienvenida, prioridad: c.prioridad,
  notificaciones: c.notificaciones, metricas: c.metricas,
});

export default function Ajustes() {
  const { config, guardarConfig, modoEjemplo, toast } = useApp();
  const [f, setF] = useState(() => structuredClone(config));
  const [guardando, setGuardando] = useState(false);

  useEffect(() => setF(structuredClone(config)), [config]);

  const errores = useMemo(() => validarConfig(f), [f]);
  const hayCambios = JSON.stringify(f) !== JSON.stringify(config);
  const set = (ruta, valor) => setF((x) => {
    const y = structuredClone(x);
    const partes = ruta.split('.');
    let o = y;
    partes.slice(0, -1).forEach((p) => { o[p] = o[p] ?? {}; o = o[p]; });
    o[partes.at(-1)] = valor;
    return y;
  });
  // Si el saludo menciona el nombre actual, se actualiza junto con el nombre.
  const cambiarNombre = (nuevo) => setF((x) => ({
    ...x,
    asistente: nuevo,
    textos: { ...x.textos, saludo: x.asistente && nuevo ? reemplazarPalabra(x.textos.saludo, x.asistente, nuevo) : x.textos.saludo },
  }));
  const entero = (v) => (v === '' ? '' : Math.round(Number(v)));
  const err = (k) => errores[k];

  // Pide un segundo toque para no borrar la configuración por accidente.
  const [confirmarRestaurar, setConfirmarRestaurar] = useState(false);
  useEffect(() => {
    if (!confirmarRestaurar) return undefined;
    const timer = setTimeout(() => setConfirmarRestaurar(false), 4000);
    return () => clearTimeout(timer);
  }, [confirmarRestaurar]);

  const restaurar = async () => {
    if (!confirmarRestaurar) {
      setConfirmarRestaurar(true);
      return;
    }
    setConfirmarRestaurar(false);
    setGuardando(true);
    try {
      await guardarConfig(editables(CONFIG_DEMO));
      toast({ titulo: 'Valores restaurados', texto: `Volvió la configuración inicial. ${CONFIG_DEMO.asistente} ya la usa.` });
    } catch (ex) {
      toast({ titulo: 'No se pudo restaurar', texto: ex.message, tono: 'coral' });
    } finally {
      setGuardando(false);
    }
  };

  const guardar = async (e) => {
    e.preventDefault();
    if (Object.keys(errores).length) {
      toast({ titulo: 'Revisa los campos marcados', tono: 'coral' });
      return;
    }
    setGuardando(true);
    try {
      await guardarConfig(editables(f));
      toast({ titulo: 'Cambios guardados', texto: `${f.asistente} ya usa la nueva configuración y las prioridades se recalcularon.` });
    } catch (ex) {
      toast({ titulo: 'No se pudo guardar', texto: ex.message, tono: 'coral' });
    } finally {
      setGuardando(false);
    }
  };

  const b = f.bienvenida;

  return (
    <form className="pagina" onSubmit={guardar} noValidate>
      <div className="cabecera">
        <div>
          <h1>Ajustes de {config.asistente}</h1>
          <p className="muted">Personaliza cómo habla y cómo prioriza. Los valores marcados <span className="supuesto">SUPUESTO</span> esperan tu confirmación.</p>
        </div>
      </div>

      <section className={`${s.seccion} vidrio`} aria-labelledby="sec-identidad">
        <h2 id="sec-identidad">Identidad</h2>
        <div className={s.grid}>
          <label className="campo">Nombre del asistente
            <input value={f.asistente} maxLength={20} onChange={(e) => cambiarNombre(e.target.value)} aria-invalid={!!err('asistente')} />
            <small>{f.asistente.length}/20</small>
            {err('asistente') && <span className="error">{errores.asistente}</span>}
          </label>
          <label className={`campo ${s.ancho}`}>Saludo
            <textarea rows={2} value={f.textos.saludo} maxLength={200} onChange={(e) => set('textos.saludo', e.target.value)} aria-invalid={!!err('saludo')} />
            <small>{f.textos.saludo.length}/200</small>
            {err('saludo') && <span className="error">{errores.saludo}</span>}
          </label>
        </div>
        <fieldset className={s.tonos}>
          <legend>Tono</legend>
          {TONOS.map(([v, t, d]) => (
            <label key={v} className={`${s.tono} ${f.tono === v ? s.tonoActivo : ''}`}>
              <input type="radio" name="tono" value={v} checked={f.tono === v} onChange={() => set('tono', v)} />
              <strong>{t}</strong><small>{d}</small>
            </label>
          ))}
        </fieldset>
      </section>

      <section className={`${s.seccion} vidrio`} aria-labelledby="sec-bienvenida">
        <h2 id="sec-bienvenida">Mensaje de bienvenida</h2>
        <div className={s.dosCol}>
          <div className={s.grid}>
            <label className={`campo ${s.ancho}`}>Texto antes del botón
              <input value={b.mensaje} maxLength={160} onChange={(e) => set('bienvenida.mensaje', e.target.value)} />
            </label>
            <label className="campo">URL de la tienda web
              <input type="url" value={b.url_tienda} onChange={(e) => set('bienvenida.url_tienda', e.target.value)} aria-invalid={!!err('url_tienda')} />
              {err('url_tienda') && <span className="error">{errores.url_tienda}</span>}
            </label>
            <label className="campo">Texto del botón
              <input value={b.texto_boton} maxLength={30} onChange={(e) => set('bienvenida.texto_boton', e.target.value)} />
            </label>
            <div className={`${s.ancho} ${s.promoCaja}`}>
              <label className={s.interruptor}>
                <input type="checkbox" role="switch" checked={b.promo_activa} onChange={(e) => set('bienvenida.promo_activa', e.target.checked)} />
                <span>Mostrar promoción</span>
              </label>
              <label className="campo">Texto de la promoción <span className="supuesto">SUPUESTO</span>
                <input value={b.promo_texto} maxLength={80} onChange={(e) => set('bienvenida.promo_texto', e.target.value)} disabled={!b.promo_activa} />
                <small>Confirma con la dueña antes de activarla.</small>
              </label>
            </div>
          </div>
          <div className={s.preview} aria-label="Vista previa del primer mensaje">
            <span className={s.previewTitulo}>Así se verá</span>
            <div className={s.burbuja}>
              <p>{f.textos.saludo} {b.mensaje}</p>
              <span className={s.botonTienda}>{b.texto_boton || 'Ir a la tienda'} <ExternalLink size={13} aria-hidden="true" /></span>
              {b.promo_activa && b.promo_texto && <p className={s.promo}><Sparkles size={13} aria-hidden="true" /> {b.promo_texto}</p>}
            </div>
          </div>
        </div>
      </section>

      <section className={`${s.seccion} vidrio`} aria-labelledby="sec-prioridad">
        <h2 id="sec-prioridad">Prioridad <span className="supuesto">SUPUESTO</span></h2>
        <p className="muted">Deben ir de menor a mayor: mínimo para empresa &lt; unidades para alta &lt; máximo sin derivar.</p>
        <label className={s.interruptor}>
          <input type="checkbox" role="switch" checked={f.prioridad.peso_valor !== false} onChange={(e) => set('prioridad.peso_valor', e.target.checked)} />
          <span>Tomar en cuenta el valor del pedido (monto y ganancia)</span>
        </label>
        <div className={s.grid}>
          <Numero etiqueta="Mínimo de unidades para empresa" valor={f.reglas.minimo_empresa} onChange={(v) => set('reglas.minimo_empresa', entero(v))} error={err('minimo_empresa')} ayuda="Desde aquí cuenta como pedido corporativo." />
          <Numero etiqueta="Unidades para prioridad alta" valor={f.reglas.umbral_alta} onChange={(v) => set('reglas.umbral_alta', entero(v))} error={err('umbral_alta')} />
          <Numero etiqueta="Máximo sin derivar" valor={f.reglas.maximo_sin_derivar} onChange={(v) => set('reglas.maximo_sin_derivar', entero(v))} error={err('maximo_sin_derivar')} ayuda="Más de esto lo negocias tú." />
          <Numero etiqueta="Días de fecha cercana" valor={f.reglas.dias_fecha_cercana} onChange={(v) => set('reglas.dias_fecha_cercana', entero(v))} error={err('dias_fecha_cercana')} />
          <Numero etiqueta="Monto que sube a alta (S/)" valor={f.prioridad.monto_alta ?? ''} onChange={(v) => set('prioridad.monto_alta', v === '' ? '' : Number(v))} error={err('monto_alta')} ayuda="Un pedido de este monto o más va primero, sea de quien sea." disabled={f.prioridad.peso_valor === false} />
          <Numero etiqueta="Margen estimado (%)" valor={Math.round(f.prioridad.margen_estimado * 100)} onChange={(v) => set('prioridad.margen_estimado', v === '' ? '' : Number(v) / 100)} error={err('margen_estimado')} ayuda="No hay margen por producto: se usa uno general." />
        </div>
      </section>

      <section className={`${s.seccion} vidrio`} aria-labelledby="sec-derivar">
        <h2 id="sec-derivar">Derivar a la dueña</h2>
        <p className="muted">{f.asistente} no responde estos casos: te los pasa con aviso.</p>
        <div className={s.checks}>
          {DERIVAR.map(([k, t]) => (
            <label key={k} className={s.interruptor}>
              <input type="checkbox" role="switch" checked={!!f.derivar[k]} onChange={(e) => set(`derivar.${k}`, e.target.checked)} />
              <span>{t}</span>
            </label>
          ))}
        </div>
      </section>

      <section className={`${s.seccion} vidrio`} aria-labelledby="sec-notif">
        <h2 id="sec-notif">Notificaciones</h2>
        <div className={s.checks}>
          <label className={s.interruptor}><input type="checkbox" role="switch" checked={f.notificaciones.pedido_alta} onChange={(e) => set('notificaciones.pedido_alta', e.target.checked)} /><span>Pedido de prioridad alta</span></label>
          <label className={s.interruptor}><input type="checkbox" role="switch" checked={f.notificaciones.pedido_derivado} onChange={(e) => set('notificaciones.pedido_derivado', e.target.checked)} /><span>Pedido derivado</span></label>
          <label className={s.interruptor}><input type="checkbox" role="switch" checked={f.notificaciones.resumen_diario} onChange={(e) => set('notificaciones.resumen_diario', e.target.checked)} /><span>Resumen diario de métricas</span></label>
        </div>
        <fieldset className={s.radios}>
          <legend>¿Dónde te avisamos?</legend>
          <label><input type="radio" name="canal" checked={f.notificaciones.canal === 'app'} onChange={() => set('notificaciones.canal', 'app')} /> En la app</label>
          <label><input type="radio" name="canal" checked={f.notificaciones.canal === 'correo'} onChange={() => set('notificaciones.canal', 'correo')} /> Por correo a <strong>{config.correo_negocio}</strong></label>
        </fieldset>
      </section>

      <section className={`${s.seccion} vidrio`} aria-labelledby="sec-medicion">
        <h2 id="sec-medicion">Medición</h2>
        <div className={s.grid}>
          <Numero etiqueta="Tiempo de primera respuesta antes de Mermín (min)" valor={f.metricas?.tiempo_respuesta_antes_min ?? ''} onChange={(v) => set('metricas.tiempo_respuesta_antes_min', v === '' ? null : Number(v))} ayuda="Lo mide la dueña. Si lo dejas vacío, Inicio muestra “Por medir con la dueña”." />
        </div>
      </section>

      <p className="muted" style={{ fontSize: '.82rem' }}>El nombre del negocio, la marca y el catálogo no se editan aquí.</p>

      <div className={`${s.barraGuardar} vidrio vidrio-opaco`}>
        <span className="muted">{modoEjemplo ? 'Solo se guarda en esta demo.' : hayCambios ? 'Tienes cambios sin guardar.' : 'Todo guardado.'}</span>
        <button type="button" className={`btn ${confirmarRestaurar ? s.restaurarConfirmar : ''}`} onClick={restaurar} disabled={guardando} aria-live="polite">
          <RotateCcw size={16} aria-hidden="true" /> {confirmarRestaurar ? 'Toca otra vez para restaurar' : 'Restaurar valores'}
        </button>
        <button type="button" className="btn" onClick={() => setF(structuredClone(config))} disabled={!hayCambios || guardando}>Descartar</button>
        <button type="submit" className="btn btn-primario" disabled={!hayCambios || guardando}><Save size={16} aria-hidden="true" /> {guardando ? 'Guardando…' : 'Guardar'}</button>
      </div>
    </form>
  );
}

function Numero({ etiqueta, valor, onChange, error, ayuda, disabled }) {
  return (
    <label className="campo">{etiqueta}
      <input type="number" inputMode="numeric" min="0" value={valor} onChange={(e) => onChange(e.target.value)} aria-invalid={!!error} disabled={disabled} />
      {ayuda && <small>{ayuda}</small>}
      {error && <span className="error">{error}</span>}
    </label>
  );
}
