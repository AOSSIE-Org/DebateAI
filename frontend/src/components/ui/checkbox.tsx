// components/ui/checkbox.tsx
import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils"; // Ensure you have a utility for class merging

export interface CheckboxProps extends React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> {}

const Checkbox = React.forwardRef<React.ElementRef<typeof CheckboxPrimitive.Root>, CheckboxProps>(
  ({ className, ...props }, ref) => (
    <CheckboxPrimitive.Root
      ref={ref}
      className={cn(
        "w-4 h-4 rounded border border-gray-300 data-[state=checked]:bg-primary flex items-center justify-center",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="text-white">
        <Check className="w-2 h-2" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
);

Checkbox.displayName = "Checkbox";

export { Checkbox };
