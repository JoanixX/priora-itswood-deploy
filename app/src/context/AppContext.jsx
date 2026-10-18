import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { alCambiarModo, detectarBackend, enModoEjemplo } from '../services/api.js';
import { obtenerConfig, guardarConfig as guardarConfigApi } from '../services/config.js';
import { listarPedidos, actualizarPedido as actualizarPedidoApi } from '../services/pedidos.js';
import { listarNotificaciones, marcarLeida as marcarLeidaApi } from '../services/notificaciones.js';
import { obtenerCatalogo } from '../services/catalogo.js';
import { CONFIG_DEMO } from '../data/configDemo.js';
import { enriquecer, ordenarPorPrioridad } from '../lib/prioridad.js';
import { usePolling } from '../hooks/usePolling.js';
import { tituloNotificacion } from '../lib/notificaciones.js';

const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

export function AppProvider({ children }) {
  const [modoEjemplo, setModoEjemplo] = useState(enModoEjemplo());
  const [config, setConfig] = useState(CONFIG_DEMO);
  const [pedidosCrudos, setPedidosCrudos] = useState([]);
  const [cargandoPedidos, setCargandoPedidos] = useState(true);
  const [notificaciones, setNotificaciones] = useState([]);
  const [catalogo, setCatalogo] = useState([]);
  const [toasts, setToasts] = useState([]);
  const vistas = useRef(null); // ids de avisos ya vistos, para lanzar toasts solo de los nuevos

  useEffect(() => alCambiarModo(setModoEjemplo), []);

  const toast = useCallback((t) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((ts) => [...ts, { id, ...t }]);
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), t.duracion || 6000);
  }, []);
  const cerrarToast = useCallback((id) => setToasts((ts) => ts.filter((x) => x.id !== id)), []);

  const refrescarPedidos = useCallback(async () => {
    try {
      setPedidosCrudos(await listarPedidos());
    } catch (e) {
      // 401: la sesión venció y RequiereSesion ya lleva a /login.
      if (e?.status !== 401) throw e;
    } finally {
      setCargandoPedidos(false);
    }
  }, []);

  const refrescarNotificaciones = useCallback(async () => {
    const lista = await listarNotificaciones().catch(() => null);
    if (!lista) return;
    if (vistas.current) {
      for (const n of lista) {
        if (!vistas.current.has(n.id) && !n.leida && n.tipo !== 'resumen_diario') {
          toast({
            titulo: tituloNotificacion(n), texto: n.titulo ? n.texto : null, enlace: n.enlace,
            accion: n.tipo === 'sync' ? 'Ver datos' : 'Ver pedido',
            tono: n.tipo === 'pedido_derivado' ? 'coral' : n.tipo === 'sync' ? undefined : 'cobre',
          });
        }
      }
    }
    vistas.current = new Set(lista.map((n) => n.id));
    setNotificaciones(lista);
  }, [toast]);

  const refrescarCatalogo = useCallback(async () => setCatalogo(await obtenerCatalogo()), []);

  useEffect(() => {
    (async () => {
      await detectarBackend();
      setConfig(await obtenerConfig());
      await refrescarCatalogo();
    })().catch((e) => {
      if (e?.status !== 401) throw e; // 401: la sesión venció y RequiereSesion ya lleva a /login.
    });
  }, [refrescarCatalogo]);

  usePolling(refrescarPedidos, 10000);
  usePolling(refrescarNotificaciones, 10000);

  const guardarConfig = useCallback(async (cambios) => {
    const nueva = await guardarConfigApi(cambios);
    setConfig(nueva);
    await refrescarPedidos();
    return nueva;
  }, [refrescarPedidos]);

  const actualizarPedido = useCallback(async (id, cambios) => {
    await actualizarPedidoApi(id, cambios);
    await Promise.all([refrescarPedidos(), refrescarNotificaciones()]);
  }, [refrescarPedidos, refrescarNotificaciones]);

  const marcarLeida = useCallback(async (id) => {
    setNotificaciones((ns) => ns.map((n) => (n.id === id ? { ...n, leida: true } : n)));
    await marcarLeidaApi(id).catch(() => {});
  }, []);

  // Prioridad recalculada cada vez que cambia la configuración.
  const pedidos = useMemo(() => ordenarPorPrioridad(enriquecer(pedidosCrudos, config)), [pedidosCrudos, config]);

  const valor = {
    modoEjemplo, config, guardarConfig,
    pedidos, cargandoPedidos, refrescarPedidos, actualizarPedido,
    notificaciones, refrescarNotificaciones, marcarLeida,
    catalogo, refrescarCatalogo,
    toasts, toast, cerrarToast,
  };
  return <AppContext.Provider value={valor}>{children}</AppContext.Provider>;
}
