import { useEffect, useId, useRef, useState } from 'react';
import { Info } from 'lucide-react';
import s from './InfoTip.module.css';

/** Ícono "i" con la definición y la fuente del dato. Se abre con clic o teclado. */
export default function InfoTip({ titulo, children }) {
  const [abierto, setAbierto] = useState(false);
  const id = useId();
  const ref = useRef(null);

  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (e) => !ref.current?.contains(e.target) && setAbierto(false);
    const esc = (e) => e.key === 'Escape' && setAbierto(false);
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('keydown', esc);
    };
  }, [abierto]);

  return (
    <span className={s.caja} ref={ref}>
      <button type="button" className={s.boton} aria-label={`Qué es: ${titulo}`} aria-expanded={abierto} aria-controls={id} onClick={() => setAbierto((x) => !x)}>
        <Info size={15} aria-hidden="true" />
      </button>
      {abierto && <span id={id} role="tooltip" className={`${s.globo} vidrio vidrio-opaco`}>{children}</span>}
    </span>
  );
}
