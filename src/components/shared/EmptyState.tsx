import { ReactNode } from "react";
import { Inbox } from "lucide-react";

export function EmptyState({
  title,
  body,
  action,
  icon,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="border border-dashed border-border rounded-2xl bg-surface p-10 text-center">
      <div className="mx-auto w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
        {icon ?? <Inbox className="size-5" />}
      </div>
      <div className="mt-3 text-sm font-medium text-forest">{title}</div>
      {body && (
        <div className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
          {body}
        </div>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
