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

export function ChevronUpIcon({ className }: IconProps) {
  return (
    <StrokeIcon className={className} strokeWidth={1.8}>
      <path d="m6 15 6-6 6 6" />
    </StrokeIcon>
  );
}

export function BoldIcon({ className }: IconProps) {
  return (
    <StrokeIcon className={className} strokeWidth={2.2}>
      <path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z" />
    </StrokeIcon>
  );
}

export function ItalicIcon({ className }: IconProps) {
  return (
    <StrokeIcon className={className}>
      <path d="M10 5h8M6 19h8M14 5l-4 14" />
    </StrokeIcon>
  );
}

export function UnderlineIcon({ className }: IconProps) {
  return (
    <StrokeIcon className={className}>
      <path d="M7 5v7a5 5 0 0 0 10 0V5M5 20h14" />
    </StrokeIcon>
  );
}

export function StrikeIcon({ className }: IconProps) {
  return (
    <StrokeIcon className={className}>
      <path d="M4 12h16M16.5 7.5C16 6 14.3 5 12 5c-2.6 0-4.3 1.2-4.3 3 0 1.4 1 2.3 3 3M8 16.5C8.6 18 10.2 19 12.3 19c2.6 0 4.4-1.2 4.4-3.1 0-1-.4-1.7-1.2-2.4" />
    </StrokeIcon>
  );
}

export function LinkIcon({ className }: IconProps) {
  return (
    <StrokeIcon className={className}>
      <path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" />
    </StrokeIcon>
  );
}

export function VariableIcon({ className }: IconProps) {
  return (
    <StrokeIcon className={className}>
      <path d="M8 4C6 4 5.5 5 5.5 6.5v2c0 1.5-.8 2.5-2 3.5 1.2 1 2 2 2 3.5v2C5.5 19 6 20 8 20M16 4c2 0 2.5 1 2.5 2.5v2c0 1.5.8 2.5 2 3.5-1.2 1-2 2-2 3.5v2C18.5 19 18 20 16 20" />
    </StrokeIcon>
  );
}

export function SpoilerIcon({ className }: IconProps) {
  return (
    <StrokeIcon className={className} strokeWidth={1.8}>
      <path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M4 20 20 4" />
    </StrokeIcon>
  );
}

export function CodeIcon({ className }: IconProps) {
  return (
    <StrokeIcon className={className}>
      <path d="m8 7-5 5 5 5M16 7l5 5-5 5" />
    </StrokeIcon>
  );
}

export function CodeBlockIcon({ className }: IconProps) {
  return (
    <StrokeIcon className={className} strokeWidth={1.8}>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <path d="m9.5 9-3 3 3 3M14.5 9l3 3-3 3" />
    </StrokeIcon>
  );
}

export function QuoteIcon({ className }: IconProps) {
  return (
    <StrokeIcon className={className} strokeWidth={1.8}>
      <path d="M4 5v14" />
      <path d="M9 8h11M9 12h11M9 16h6" />
    </StrokeIcon>
  );
}

export function UndoIcon({ className }: IconProps) {
  return (
    <StrokeIcon className={className}>
      <path d="M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3" />
    </StrokeIcon>
  );
}

export function RedoIcon({ className }: IconProps) {
  return (
    <StrokeIcon className={className}>
      <path d="m15 14 5-5-5-5M20 9H10a6 6 0 0 0 0 12h3" />
    </StrokeIcon>
  );
}

export function PhotoIcon({ className }: IconProps) {
  return (
    <StrokeIcon className={className} strokeWidth={1.8}>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="m21 16-5-5-9 9" />
    </StrokeIcon>
  );
}

export function VideoIcon({ className }: IconProps) {
  return (
    <StrokeIcon className={className} strokeWidth={1.8}>
      <rect x="3" y="5" width="14" height="14" rx="2.5" />
      <path d="m17 10 4-2.5v9L17 14" />
    </StrokeIcon>
  );
}

export function VoiceIcon({ className }: IconProps) {
  return (
    <StrokeIcon className={className} strokeWidth={1.8}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </StrokeIcon>
  );
}

export function ButtonsIcon({ className }: IconProps) {
  return (
    <StrokeIcon className={className} strokeWidth={1.8}>
      <rect x="3" y="4" width="18" height="6" rx="2" />
      <rect x="3" y="14" width="18" height="6" rx="2" />
    </StrokeIcon>
  );
}

export function InfoIcon({ className }: IconProps) {
  return (
    <StrokeIcon className={className} strokeWidth={1.8}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </StrokeIcon>
  );
}

export function PencilIcon({ className }: IconProps) {
  return (
    <StrokeIcon className={className} strokeWidth={1.8}>
      <path d="M4 20h4L19 9a2.83 2.83 0 0 0-4-4L4 16v4Z" />
      <path d="m13.5 6.5 4 4" />
    </StrokeIcon>
  );
}

export function CalendarIcon({ className }: IconProps) {
  return (
    <StrokeIcon className={className} strokeWidth={1.8}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
      <path d="M8 3v4M16 3v4M3.5 10h17" />
    </StrokeIcon>
  );
}

export function ClockIcon({ className }: IconProps) {
  return (
    <StrokeIcon className={className} strokeWidth={1.8}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </StrokeIcon>
  );
}

export function RestartIcon({ className }: IconProps) {
  return (
    <StrokeIcon className={className} strokeWidth={2}>
      <path d="M4 12a8 8 0 1 0 2.6-5.9" />
      <path d="M4 4v4.5h4.5" />
    </StrokeIcon>
  );
}

export function PlayTriangleIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="currentColor" className={`shrink-0 ${className ?? ""}`}>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

export function TrashIcon({ className }: IconProps) {
  return (
    <StrokeIcon className={className}>
      <path d="M4 7h16" />
      <path d="M10 11v6M14 11v6" />
      <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </StrokeIcon>
  );
}

export function ArchiveIcon({ className }: IconProps) {
  return (
    <StrokeIcon className={className}>
      <rect x="3" y="4" width="18" height="4" rx="1" />
      <path d="M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8" />
      <path d="M10 12h4" />
    </StrokeIcon>
  );
}
