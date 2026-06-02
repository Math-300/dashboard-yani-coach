// Yani Coach Dashboard — inline SVG icons (lucide-style)
// Standardized 18x18 viewbox, strokeWidth 1.6, currentColor.
import React from 'react';

export interface IcoProps {
  d?: string;
  size?: number;
  sw?: number;
  fill?: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

export const Ico = ({ d, size = 18, sw = 1.6, fill, children, style }: IcoProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={fill || 'none'}
    stroke="currentColor"
    strokeWidth={sw}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ flexShrink: 0, ...style }}
  >
    {d ? <path d={d} /> : children}
  </svg>
);

export const Icons = {
  Logo: (p: IcoProps) => (
    <Ico {...p}>
      <path d="M5 3l7 9-7 9" />
      <path d="M12 12h7" />
    </Ico>
  ),
  Sparkle: (p: IcoProps) => (
    <Ico {...p}>
      <path d="M12 3l1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7z" />
    </Ico>
  ),
  Summary: (p: IcoProps) => (
    <Ico {...p}>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </Ico>
  ),
  Sales: (p: IcoProps) => (
    <Ico {...p}>
      <path d="M12 2v20" />
      <path d="M17 6H9.5a3 3 0 100 6h5a3 3 0 110 6H6" />
    </Ico>
  ),
  Team: (p: IcoProps) => (
    <Ico {...p}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2.5 20c.8-3.4 3.5-5.5 6.5-5.5s5.7 2.1 6.5 5.5" />
      <circle cx="17" cy="9" r="2.6" />
      <path d="M16 14.6c2.5.3 4.4 2.2 5 5.4" />
    </Ico>
  ),
  Funnel: (p: IcoProps) => (
    <Ico {...p}>
      <path d="M3 4h18l-7 9v7l-4-2v-5z" />
    </Ico>
  ),
  Templates: (p: IcoProps) => (
    <Ico {...p}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18" />
      <path d="M9 21V9" />
    </Ico>
  ),
  Whats: (p: IcoProps) => (
    <Ico {...p}>
      <path d="M21 11.5a8.5 8.5 0 11-3.6-6.9L21 4l-1.4 3.5A8.4 8.4 0 0121 11.5z" />
      <path d="M8 11c.3 2 2 3.7 4 4l1.6-1.6c.3-.3.7-.4 1.1-.2l2.4 1.1" strokeWidth="1.4" />
    </Ico>
  ),
  Clients: (p: IcoProps) => (
    <Ico {...p}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20.5c1-3.6 4-5.5 7-5.5s6 1.9 7 5.5" />
    </Ico>
  ),
  ChevronLeft: (p: IcoProps) => <Ico {...p} d="M15 6l-6 6 6 6" />,
  ChevronRight: (p: IcoProps) => <Ico {...p} d="M9 6l6 6-6 6" />,
  ChevronDown: (p: IcoProps) => <Ico {...p} d="M6 9l6 6 6-6" />,
  ArrowUp: (p: IcoProps) => <Ico {...p} d="M12 19V5M5 12l7-7 7 7" />,
  ArrowDown: (p: IcoProps) => <Ico {...p} d="M12 5v14M19 12l-7 7-7-7" />,
  Dollar: (p: IcoProps) => (
    <Ico {...p}>
      <path d="M12 2v20" />
      <path d="M17 6H9.5a3 3 0 100 6h5a3 3 0 110 6H6" />
    </Ico>
  ),
  Clock: (p: IcoProps) => (
    <Ico {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Ico>
  ),
  Target: (p: IcoProps) => (
    <Ico {...p}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </Ico>
  ),
  Check: (p: IcoProps) => <Ico {...p} d="M20 6L9 17l-5-5" />,
  X: (p: IcoProps) => <Ico {...p} d="M18 6L6 18M6 6l12 12" />,
  Bell: (p: IcoProps) => (
    <Ico {...p}>
      <path d="M6 8a6 6 0 0112 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10 21a2 2 0 004 0" />
    </Ico>
  ),
  Alert: (p: IcoProps) => (
    <Ico {...p}>
      <path d="M12 3l10 18H2L12 3z" />
      <path d="M12 10v5" />
      <circle cx="12" cy="18" r=".5" fill="currentColor" />
    </Ico>
  ),
  Calendar: (p: IcoProps) => (
    <Ico {...p}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v4M16 3v4" />
    </Ico>
  ),
  Sun: (p: IcoProps) => (
    <Ico {...p}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </Ico>
  ),
  Search: (p: IcoProps) => (
    <Ico {...p}>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </Ico>
  ),
  Settings: (p: IcoProps) => (
    <Ico {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" />
    </Ico>
  ),
  Refresh: (p: IcoProps) => (
    <Ico {...p}>
      <path d="M3 12a9 9 0 0115-6.7L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 01-15 6.7L3 16" />
      <path d="M3 21v-5h5" />
    </Ico>
  ),
  Trend: (p: IcoProps) => <Ico {...p} d="M3 17l6-6 4 4 8-8M21 7h-6M21 7v6" />,
};
