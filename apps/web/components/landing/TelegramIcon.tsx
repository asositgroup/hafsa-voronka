type TelegramIconProps = {
  className?: string;
};

export function TelegramIcon({ className = "" }: TelegramIconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={`shrink-0 fill-current ${className}`}>
      <path d="M21.94 4.66 18.9 19.01c-.23 1-.82 1.25-1.66.78l-4.6-3.39-2.22 2.14c-.25.25-.45.45-.93.45l.33-4.71 8.57-7.74c.37-.33-.08-.52-.58-.19L7.22 13l-4.56-1.43c-.99-.31-1.01-.99.21-1.47l17.82-6.87c.83-.31 1.55.19 1.25 1.43Z" />
    </svg>
  );
}
