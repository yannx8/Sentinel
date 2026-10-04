import React from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Navigation sidebar item. Renders a button that navigates to `to` on click.
 * Supports an optional badge count displayed on the right side.
 */
export function NavItem({ to, icon, text, active, badge }: { to: string; icon: React.ReactNode; text: string; active: boolean; badge?: number }) {
  const nav = useNavigate();
  return (
    <button className={`nav-item${active ? ' nav-active' : ''}`} onClick={() => nav(to)}>
      {React.cloneElement(icon as React.ReactElement, { size: 18, strokeWidth: active ? 2.3 : 1.8 })}
      <span>{text}</span>
      {badge !== undefined && badge > 0 && <span className="nav-badge">{badge}</span>}
    </button>
  );
}
