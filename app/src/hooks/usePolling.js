import { useEffect, useRef } from 'react';

/** Llama a `fn` al montar y cada `ms`; se pausa mientras la pestaña está oculta. */
export function usePolling(fn, ms = 10000) {
  const ref = useRef(fn);
  ref.current = fn;

  useEffect(() => {
    let timer = null;
    const tick = () => ref.current();
    const iniciar = () => {
      clearInterval(timer);
      timer = setInterval(tick, ms);
    };
    const alCambiar = () => {
      if (document.hidden) clearInterval(timer);
      else {
        tick();
        iniciar();
      }
    };
    tick();
    iniciar();
    document.addEventListener('visibilitychange', alCambiar);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', alCambiar);
    };
  }, [ms]);
}
