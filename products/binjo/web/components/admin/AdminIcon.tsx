import type { AdminNavKey } from "@/lib/adminNavigation";

export default function AdminIcon({ name }: { name: AdminNavKey }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (name === "today") {
    return (
      <svg {...common}>
        <path d="M4 10.5 12 4l8 6.5" />
        <path d="M6.5 9.5V20h11V9.5" />
        <path d="M9.5 20v-6h5v6" />
      </svg>
    );
  }

  if (name === "orders") {
    return (
      <svg {...common}>
        <path d="M4 7.5 12 3l8 4.5-8 4.5-8-4.5Z" />
        <path d="M4 7.5V17l8 4 8-4V7.5" />
        <path d="M12 12v9" />
      </svg>
    );
  }

  if (name === "products") {
    return (
      <svg {...common}>
        <path d="M12 7c-4.2-2.8-8.2.2-7 5.2C6.2 17.3 9.4 21 12 21s5.8-3.7 7-8.8C20.2 7.2 16.2 4.2 12 7Z" />
        <path d="M12 7c-.1-2.7 1.4-4.5 4.2-5" />
        <path d="M12.3 5.5c-2.4.2-4-.8-4.8-2.6" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M4 20V9l8-6 8 6v11" />
      <path d="M8 20v-7h8v7" />
      <path d="M2.5 20h19" />
    </svg>
  );
}

