import { cn } from "../../utils/cn";

type BadgeProps = {
  label: string;
  color: string;
};

export function Badge({ label, color }: BadgeProps) {
  return (
    <span
      className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold text-white")}
      style={{ backgroundColor: color }}
    >
      {label}
    </span>
  );
}
