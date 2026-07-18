type FarmerIconName =
  | "today"
  | "record"
  | "logs"
  | "finance"
  | "calendar"
  | "fields";

interface FarmerIconProps {
  name: FarmerIconName;
  className?: string;
}

export default function FarmerIcon({
  name,
  className = "h-6 w-6",
}: FarmerIconProps) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      focusable="false"
      {...common}
    >
      {name === "today" && (
        <>
          <path d="m3.5 10.5 8.5-7 8.5 7" />
          <path d="M5.5 9.5V21h13V9.5M9.5 21v-7h5v7" />
        </>
      )}
      {name === "record" && (
        <>
          <path d="M5 3.5h10.5L19 7v13.5H5z" />
          <path d="M15.5 3.5V7H19M8 11h8M8 15h8M8 18.5h5" />
        </>
      )}
      {name === "logs" && (
        <>
          <rect x="4" y="4" width="16" height="16" rx="2.5" />
          <path d="M8 2.5v3M16 2.5v3M7.5 9h9M8 13h3M8 17h5" />
        </>
      )}
      {name === "finance" && (
        <>
          <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
          <path d="M3.5 9h17M7.5 14h3" />
        </>
      )}
      {name === "calendar" && (
        <>
          <rect x="3.5" y="5" width="17" height="16" rx="2.5" />
          <path d="M8 3v4M16 3v4M3.5 9.5h17M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01" />
        </>
      )}
      {name === "fields" && (
        <>
          <path d="M4 20c1.5-5.5 4.2-8.5 8-9M20 20c-1.5-5.5-4.2-8.5-8-9" />
          <path d="M12 20V7" />
          <path d="M12 10c-3.2 0-5.5-1.7-6-5 3.6-.2 5.7 1.4 6 5ZM12 7.5c2.9 0 4.8-1.5 5.2-4.5-3.2-.1-5 1.3-5.2 4.5Z" />
        </>
      )}
    </svg>
  );
}
