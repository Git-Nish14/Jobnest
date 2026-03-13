import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { ApplicationStatus } from "@/lib/types/database";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
        outline: "text-foreground",
        applied: "border-transparent bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400",
        phoneScreen: "border-transparent bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400",
        interview: "border-transparent bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400",
        offer: "border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400",
        rejected: "border-transparent bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

// Status badge helper component
const statusToVariant: Record<ApplicationStatus, BadgeProps["variant"]> = {
  "Applied": "applied",
  "Phone Screen": "phoneScreen",
  "Interview": "interview",
  "Offer": "offer",
  "Rejected": "rejected",
};

interface StatusBadgeProps extends Omit<BadgeProps, "variant"> {
  status: ApplicationStatus;
}

function StatusBadge({ status, className, ...props }: StatusBadgeProps) {
  return (
    <Badge variant={statusToVariant[status]} className={className} {...props}>
      {status}
    </Badge>
  );
}

export { Badge, StatusBadge, badgeVariants };
