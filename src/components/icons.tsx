import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: 'sm' | 'md' };

function Svg({ size = 'md', className, children, ...rest }: P) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`${size === 'sm' ? 'icon icon-sm' : 'icon'}${className ? ' ' + className : ''}`}
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IconBook = (p: P) => (
  <Svg {...p}>
    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" />
    <path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5" />
    <path d="M9 8h7M9 12h5" />
  </Svg>
);
export const IconChevronLeft = (p: P) => (<Svg {...p}><path d="m15 18-6-6 6-6" /></Svg>);
export const IconChevronRight = (p: P) => (<Svg {...p}><path d="m9 18 6-6-6-6" /></Svg>);
export const IconCalendar = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
    <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
  </Svg>
);
export const IconCopy = (p: P) => (
  <Svg {...p}>
    <rect x="8" y="8" width="13" height="13" rx="2.5" />
    <path d="M16 8V5.5A2.5 2.5 0 0 0 13.5 3h-8A2.5 2.5 0 0 0 3 5.5v8A2.5 2.5 0 0 0 5.5 16H8" />
  </Svg>
);
export const IconPrinter = (p: P) => (
  <Svg {...p}>
    <path d="M6 9V3h12v6" />
    <rect x="3" y="9" width="18" height="8" rx="2" />
    <path d="M6 14h12v7H6z" />
  </Svg>
);
export const IconPlus = (p: P) => (<Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>);
export const IconSearch = (p: P) => (<Svg {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Svg>);
export const IconTrash = (p: P) => (
  <Svg {...p}>
    <path d="M4 7h16M10 11v6M14 11v6M5.5 7l1 13a2 2 0 0 0 2 1.8h7a2 2 0 0 0 2-1.8l1-13M9 7V4h6v3" />
  </Svg>
);
export const IconRestore = (p: P) => (<Svg {...p}><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></Svg>);
export const IconUsers = (p: P) => (
  <Svg {...p}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6" />
  </Svg>
);
export const IconHistory = (p: P) => (<Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Svg>);
export const IconMegaphone = (p: P) => (
  <Svg {...p}>
    <path d="M3 11v2a2 2 0 0 0 2 2h2l5 4V5L7 9H5a2 2 0 0 0-2 2z" />
    <path d="M16 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />
  </Svg>
);
export const IconDatabase = (p: P) => (
  <Svg {...p}>
    <ellipse cx="12" cy="5.5" rx="8" ry="3" />
    <path d="M4 5.5v13c0 1.7 3.6 3 8 3s8-1.3 8-3v-13M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
  </Svg>
);
export const IconUser = (p: P) => (<Svg {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></Svg>);
export const IconLogout = (p: P) => (<Svg {...p}><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H3" /></Svg>);
export const IconMenu = (p: P) => (<Svg {...p}><path d="M4 6h16M4 12h16M4 18h16" /></Svg>);
export const IconX = (p: P) => (<Svg {...p}><path d="M18 6 6 18M6 6l12 12" /></Svg>);
export const IconCheck = (p: P) => (<Svg {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></Svg>);
export const IconAlert = (p: P) => (<Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5M12 16.5v.01" /></Svg>);
export const IconClock = (p: P) => (<Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5h4" /></Svg>);
export const IconList = (p: P) => (<Svg {...p}><path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" /></Svg>);
export const IconShield = (p: P) => (<Svg {...p}><path d="M12 3 4.5 6v6c0 4.5 3.2 8 7.5 9 4.3-1 7.5-4.5 7.5-9V6z" /><path d="m9 12 2 2 4-4" /></Svg>);
export const IconEdit = (p: P) => (<Svg {...p}><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="m13.5 6.5 4 4" /></Svg>);
export const IconKey = (p: P) => (<Svg {...p}><circle cx="8" cy="15" r="4" /><path d="m11 12 9-9M17 6l2 2M15 8l2 2" /></Svg>);
export const IconExternal = (p: P) => (<Svg {...p}><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></Svg>);
export const IconGrid = (p: P) => (<Svg {...p}><rect x="3.5" y="4" width="17" height="16" rx="2" /><path d="M3.5 9.5h17M9 9.5V20M14.5 9.5V20" /></Svg>);
export const IconPhone = (p: P) => (<Svg {...p}><rect x="6.5" y="2.5" width="11" height="19" rx="2.5" /><path d="M11 18.5h2" /></Svg>);
