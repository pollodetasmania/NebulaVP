// Iconos dibujados con líneas (estilo Lucide), sin librerías extra.

export type IconName =
  | 'home'
  | 'grid'
  | 'chat'
  | 'tag'
  | 'box'
  | 'receipt'
  | 'sliders'
  | 'plus'
  | 'minus'
  | 'close'
  | 'check'
  | 'trash'
  | 'camera'
  | 'back'
  | 'search'
  | 'lock'
  | 'logout'
  | 'eye'
  | 'undo'
  | 'alert';

interface IconProps {
  name: IconName;
  size?: number;
}

function iconPaths(name: IconName) {
  switch (name) {
    case 'home':
      return <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />;
    case 'grid':
      return (
        <>
          <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
          <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
          <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
          <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
        </>
      );
    case 'chat':
      return <path d="M4 19.5 5.3 15A8 8 0 1 1 9 18.7z" />;
    case 'tag':
      return (
        <>
          <path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z" />
          <circle cx="7.5" cy="7.5" r="1.5" />
        </>
      );
    case 'box':
      return (
        <>
          <path d="M21 8 12 3 3 8v8l9 5 9-5z" />
          <path d="m3 8 9 5 9-5M12 13v8" />
        </>
      );
    case 'receipt':
      return (
        <>
          <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
          <path d="M9 8h6M9 12h6M9 16h3" />
        </>
      );
    case 'sliders':
      return (
        <>
          <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" />
          <circle cx="16" cy="6" r="2" />
          <circle cx="10" cy="12" r="2" />
          <circle cx="18" cy="18" r="2" />
        </>
      );
    case 'plus':
      return <path d="M12 5v14M5 12h14" />;
    case 'minus':
      return <path d="M5 12h14" />;
    case 'close':
      return <path d="M6 6l12 12M18 6 6 18" />;
    case 'check':
      return <path d="m5 12.5 4.5 4.5L19 7.5" />;
    case 'trash':
      return (
        <>
          <path d="M4 7h16M10 11v6M14 11v6" />
          <path d="M6 7l1 13h10l1-13M9 7V4h6v3" />
        </>
      );
    case 'camera':
      return (
        <>
          <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
          <circle cx="12" cy="13.5" r="3.5" />
        </>
      );
    case 'back':
      return <path d="M15 5l-7 7 7 7" />;
    case 'search':
      return (
        <>
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4.5 4.5" />
        </>
      );
    case 'lock':
      return (
        <>
          <rect x="5" y="10.5" width="14" height="10" rx="2" />
          <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
        </>
      );
    case 'logout':
      return <path d="M14 4h5a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-5M10 16l-4-4 4-4M6 12h10" />;
    case 'eye':
      return (
        <>
          <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
          <circle cx="12" cy="12" r="3" />
        </>
      );
    case 'undo':
      return <path d="M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />;
    case 'alert':
      return <path d="M12 8v5M12 16.5v.5M10.3 3.9 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />;
    default:
      return null;
  }
}

export function Icon(props: IconProps) {
  const size = props.size || 22;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {iconPaths(props.name)}
    </svg>
  );
}
