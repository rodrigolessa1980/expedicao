import { cn } from "../../utils/cn";

type CardProps = React.HTMLAttributes<HTMLDivElement>;

export function Card({ className, ...props }: CardProps) {
  return <div className={cn("rounded-2xl border border-slate-200 bg-white shadow-sm", className)} {...props} />;
}
