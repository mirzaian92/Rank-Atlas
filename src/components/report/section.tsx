import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { InfoTip } from "./info-tip";
import { MockTag } from "./source-badge";

/** Standard white report card with title, optional description, info tip and actions. */
export function Section({ title, description, info, actions, children, className, contentClassName, mock, footer, flush }: {
  title: React.ReactNode;
  description?: React.ReactNode;
  info?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  mock?: boolean;
  footer?: React.ReactNode;
  /** Remove inner padding (for edge-to-edge tables). */
  flush?: boolean;
}) {
  return (
    <Card className={cn("flex min-w-0 flex-col", className)}>
      <CardHeader>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <CardTitle>{title}</CardTitle>
            {info && <InfoTip content={info} />}
            {mock && <MockTag />}
          </div>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </CardHeader>
      <CardContent className={cn("min-w-0 flex-1", flush && "px-0 pb-0", contentClassName)}>{children}</CardContent>
      {footer}
    </Card>
  );
}
