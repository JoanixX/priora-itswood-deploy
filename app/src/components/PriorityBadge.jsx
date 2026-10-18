import { AlertTriangle, ArrowUp, Minus, Bot } from 'lucide-react';
import s from './PriorityBadge.module.css';

const INFO = {
  derivado: { texto: 'Derivado', icono: AlertTriangle },
  alta: { texto: 'Alta', icono: ArrowUp },
  media: { texto: 'Media', icono: Minus },
  automatico: { texto: 'Automático', icono: Bot },
};

export default function PriorityBadge({ prioridad }) {
  const i = INFO[prioridad] || INFO.automatico;
  const Icono = i.icono;
  return (
    <span className={`${s.badge} ${s[prioridad] || ''}`}>
      <Icono size={13} aria-hidden="true" />
      {i.texto}
    </span>
  );
}

export function EstadoBadge({ estado }) {
  const clase = { Confirmado: s.confirmado, Entregado: s.confirmado, Derivado: s.derivado, Nuevo: s.nuevo }[estado] || '';
  return <span className={`${s.estado} ${clase}`}>{estado}</span>;
}
