type IconProps = {
  className?: string;
};

function StrokeIcon({ className = "", strokeWidth = 2, children }: IconProps & { strokeWidth?: number; children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
    >
      {children}
    </svg>
  );
}

export function UserIcon({ className }: IconProps) {
  return (
    <StrokeIcon className={className}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </StrokeIcon>
  );
}

export function PhoneIcon({ className }: IconProps) {
  return (
    <StrokeIcon className={className}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </StrokeIcon>
  );
}

export function CloseIcon({ className }: IconProps) {
  return (
    <StrokeIcon className={className}>
      <path d="M18 6 6 18M6 6l12 12" />
    </StrokeIcon>
  );
}

export function CheckIcon({ className }: IconProps) {
  return (
    <StrokeIcon className={className}>
      <path d="M20 6 9 17l-5-5" />
    </StrokeIcon>
  );
}

export function LockIcon({ className }: IconProps) {
  return (
    <StrokeIcon className={className}>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </StrokeIcon>
  );
}

export function ArrowRightIcon({ className }: IconProps) {
  return (
    <StrokeIcon className={className}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </StrokeIcon>
  );
}

export function LogoutIcon({ className }: IconProps) {
  return (
    <StrokeIcon className={className}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
    </StrokeIcon>
  );
}

export function DownloadIcon({ className }: IconProps) {
  return (
    <StrokeIcon className={className}>
      <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
    </StrokeIcon>
  );
}

export function FunnelIcon({ className }: IconProps) {
  return (
    <StrokeIcon className={className}>
      <path d="M3 4h18l-7 8.5V19l-4 2v-8.5L3 4Z" />
    </StrokeIcon>
  );
}

export function SpinnerIcon({ className = "" }: IconProps) {
  return (
    <StrokeIcon className={`animate-spin motion-reduce:animate-none ${className}`}>
      <path d="M21 12a9 9 0 1 1-6.22-8.56" />
    </StrokeIcon>
  );
}

export function ChartIcon({ className }: IconProps) {
  return (
    <StrokeIcon className={className} strokeWidth={1.8}>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </StrokeIcon>
  );
}

export function TableIcon({ className }: IconProps) {
  return (
    <StrokeIcon className={className} strokeWidth={1.8}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 10h18M9 10v10" />
    </StrokeIcon>
  );
}

export function ChatIcon({ className }: IconProps) {
  return (
    <StrokeIcon className={className} strokeWidth={1.8}>
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" />
    </StrokeIcon>
  );
}

export function PlayIcon({ className }: IconProps) {
  return (
    <StrokeIcon className={className} strokeWidth={1.8}>
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="m10 9.5 4.5 2.5-4.5 2.5Z" />
    </StrokeIcon>
  );
}

export function MoreIcon({ className }: IconProps) {
  return (
    <StrokeIcon className={className} strokeWidth={1.8}>
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </StrokeIcon>
  );
}

export function TextIcon({ className }: IconProps) {
  return (
    <StrokeIcon className={className} strokeWidth={1.8}>
      <path d="M4 6h16M4 12h10M4 18h14" />
    </StrokeIcon>
  );
}

export function SettingsIcon({ className }: IconProps) {
  return (
    <StrokeIcon className={className} strokeWidth={1.8}>
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="8" cy="17" r="2" />
    </StrokeIcon>
  );
}

export function PlusIcon({ className }: IconProps) {
  return (
    <StrokeIcon className={className} strokeWidth={1.8}>
      <path d="M12 5v14M5 12h14" />
    </StrokeIcon>
  );
}

export function GripIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="currentColor" className={`shrink-0 ${className}`}>
      <circle cx="9" cy="6" r="1.6" />
      <circle cx="15" cy="6" r="1.6" />
      <circle cx="9" cy="12" r="1.6" />
      <circle cx="15" cy="12" r="1.6" />
      <circle cx="9" cy="18" r="1.6" />
      <circle cx="15" cy="18" r="1.6" />
    </svg>
  );
}

export function ChevronDownIcon({ className }: IconProps) {
  return (
    <StrokeIcon className={className} strokeWidth={1.8}>
      <path d="m6 9 6 6 6-6" />
    </StrokeIcon>
  );
}
