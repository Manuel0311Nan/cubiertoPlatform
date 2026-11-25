import type { PanelSectionKey } from "@/modules/tenancy/domain/panel-sections";

/** Iconos del panel (trazos de las vistas D6/M11). Decorativos: el nombre lo da el texto del enlace. */
const PATHS: Record<PanelSectionKey | "more", React.ReactNode> = {
  today: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="3" />
      <path d="M4 10h16M9 3v4M15 3v4" />
    </>
  ),
  reservations: (
    <>
      <path d="M10 7h10M10 12h10M10 17h10" />
      <path d="M4.5 7h.01M4.5 12h.01M4.5 17h.01" strokeWidth="3" />
    </>
  ),
  floor: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="2" />
      <rect x="13" y="4" width="7" height="7" rx="2" />
      <rect x="4" y="13" width="16" height="7" rx="2" />
    </>
  ),
  menu: (
    <>
      <path d="M6 4h9a4 4 0 0 1 4 4v12H10a4 4 0 0 1-4-4z" />
      <path d="M10 9h5M10 13h5" />
    </>
  ),
  site: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M4 12h16M12 4c2.5 2.5 2.5 13.5 0 16M12 4c-2.5 2.5-2.5 13.5 0 16" />
    </>
  ),
  messages: <path d="M5 5h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-8l-4 3v-3H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />,
  customers: (
    <>
      <circle cx="9" cy="9" r="3" />
      <path d="M3.5 19c.8-3 3-4.5 5.5-4.5s4.7 1.5 5.5 4.5" />
      <path d="M15.5 6.5a3 3 0 0 1 0 5M17.5 14.8c1.4.6 2.4 2 2.9 4.2" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
    </>
  ),
  more: <path d="M6 12h.01M12 12h.01M18 12h.01" strokeWidth="3.2" />,
};

export function PanelIcon({ name, className }: { name: PanelSectionKey | "more"; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {PATHS[name]}
    </svg>
  );
}
