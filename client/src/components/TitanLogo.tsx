interface TitanLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  dark?: boolean;
}

const sizeMap = {
  sm: { container: "h-8 w-8", icon: 20 },
  md: { container: "h-14 w-14", icon: 36 },
  lg: { container: "h-20 w-20", icon: 52 },
  xl: { container: "h-32 w-32", icon: 84 },
};

/**
 * Archibald Titan inline SVG logo — never breaks, no external images needed.
 * Renders a shield with "AT" monogram in the brand blue gradient.
 */
export function TitanLogo({ className, size = "md" }: TitanLogoProps) {
  const { container, icon } = sizeMap[size];

  return (
    <div className={`${container} flex items-center justify-center shrink-0 ${className ?? ""}`}>
      <svg
        width={icon}
        height={icon}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="titanShield" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#60a5fa" />
            <stop offset="50%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#6366f1" />
          </linearGradient>
          <linearGradient id="titanGlow" x1="32" y1="0" x2="32" y2="64" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#93c5fd" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>
        </defs>
        {/* Shield shape */}
        <path
          d="M32 4L8 16v16c0 14.4 10.24 27.84 24 32 13.76-4.16 24-17.6 24-32V16L32 4z"
          fill="url(#titanShield)"
          opacity="0.15"
        />
        <path
          d="M32 4L8 16v16c0 14.4 10.24 27.84 24 32 13.76-4.16 24-17.6 24-32V16L32 4z"
          stroke="url(#titanGlow)"
          strokeWidth="2"
          fill="none"
        />
        {/* AT monogram */}
        <text
          x="32"
          y="42"
          textAnchor="middle"
          fontFamily="system-ui, -apple-system, sans-serif"
          fontWeight="800"
          fontSize="22"
          fill="url(#titanGlow)"
          letterSpacing="-0.5"
        >
          AT
        </text>
      </svg>
    </div>
  );
}
