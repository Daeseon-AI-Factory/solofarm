import type { ReactNode } from "react";

type NoticeTone = "error" | "warning" | "success" | "info";

const NOTICE_STYLES: Record<NoticeTone, { backgroundColor: string; borderColor: string; color: string }> = {
  error: { backgroundColor: "#FFF0ED", borderColor: "#F0B7AA", color: "#8F2D18" },
  warning: { backgroundColor: "#FFF7E8", borderColor: "#EAC890", color: "#7A4B12" },
  success: { backgroundColor: "#EEF6EA", borderColor: "#BFD5B4", color: "#2D5016" },
  info: { backgroundColor: "#EEF4F7", borderColor: "#C4D5DE", color: "#31566B" },
};

interface AdminNoticeProps {
  tone: NoticeTone;
  title?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}

export default function AdminNotice({
  tone,
  title,
  children,
  action,
  className = "",
}: AdminNoticeProps) {
  const style = NOTICE_STYLES[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-2xl border p-4 ${className}`}
      style={style}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {title && <p className="font-bold">{title}</p>}
          <div className={`${title ? "mt-1" : ""} text-sm leading-relaxed`}>{children}</div>
        </div>
        {action}
      </div>
    </div>
  );
}

