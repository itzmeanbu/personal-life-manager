import { MODULES } from '../../app/navConfig';
import { ModuleTile } from '../ui/ModuleTile';
import { useToday } from '../../hooks/useToday';

interface ModuleDrawerProps {
  onClose: () => void;
}

export function ModuleDrawer({ onClose }: ModuleDrawerProps) {
  const today = useToday();

  return (
    <div className="module-drawer">
      <div className="module-drawer__scrim" onClick={onClose} />
      <div className="module-drawer__sheet">
        <div className="module-drawer__handle" />
        <div className="module-grid">
          {MODULES.map((mod) => (
            <ModuleTile
              key={mod.id}
              module={mod}
              emphasized={mod.emphasizeOnDays?.includes(today.dayIndex)}
              onClick={onClose}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
