import { Link } from 'react-router-dom';
import type { ModuleDef } from '../../app/navConfig';

interface ModuleTileProps {
  module: ModuleDef;
  emphasized?: boolean;
  onClick?: () => void;
}

export function ModuleTile({ module, emphasized, onClick }: ModuleTileProps) {
  return (
    <Link
      to={module.path}
      className={`module-tile ${emphasized ? 'module-tile--emphasized' : ''}`.trim()}
      onClick={onClick}
    >
      <span className="module-tile__glyph" style={{ background: `var(${module.colorVar})` }}>
        {module.emoji ?? module.monogram}
      </span>
      <span className="module-tile__label">{module.label}</span>
    </Link>
  );
}
