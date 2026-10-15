export type IconName =
  | 'overview'
  | 'devices'
  | 'bell'
  | 'clock'
  | 'users'
  | 'warehouse'
  | 'warning'
  | 'critical'
  | 'info'
  | 'check'
  | 'back'
export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths = {
    overview: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),
    devices: (
      <>
        <rect x="6" y="6" width="12" height="12" rx="2" />
        <path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" />
      </>
    ),
    bell: (
      <>
        <path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7 2.5 7h-17S6 15 6 9z" />
        <path d="M10 20a2 2 0 0 0 4 0" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    users: (
      <>
        <circle cx="9" cy="8" r="3.5" />
        <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.8a3.5 3.5 0 0 1 0 6.4M18 14.2a6.5 6.5 0 0 1 3.5 5.8" />
      </>
    ),
    warehouse: (
      <>
        <path d="M3 10.5 12 4l9 6.5V20H3v-9.5z" />
        <path d="M8 20v-6h8v6" />
      </>
    ),
    warning: (
      <>
        <path d="M12 3 22 21H2L12 3z" />
        <path d="M12 9v5M12 17v.2" />
      </>
    ),
    critical: (
      <>
        <path d="M8 2.5h8l5.5 5.5v8L16 21.5H8L2.5 16V8L8 2.5z" />
        <path d="M12 7.5v5.5M12 16.2v.3" />
      </>
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v6M12 7v.2" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    back: <path d="m14.5 5.5-6.5 6.5 6.5 6.5" />,
  }
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  )
}
