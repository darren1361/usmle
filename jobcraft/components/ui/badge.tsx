import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "bg-indigo-100 text-indigo-700",
        new: "bg-blue-100 text-blue-700",
        generated: "bg-green-100 text-green-700",
        archived: "bg-gray-100 text-gray-600",
        priority: "bg-amber-100 text-amber-700",
        interested: "bg-indigo-100 text-indigo-700",
        save_later: "bg-purple-100 text-purple-700",
        not_interested: "bg-gray-100 text-gray-500",
        applied: "bg-teal-100 text-teal-700",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
