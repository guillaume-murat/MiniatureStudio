import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/app/lib/utils"
import { Toggle as TogglePrimitive } from "radix-ui"

/** Raised, and sunk while pressed (aria-pressed too: a tooltip's trigger replaces data-state). */
const RAISED =
  "border-[1.5px] bg-background shadow-pop-soft active:translate-x-px active:translate-y-px active:shadow-none disabled:shadow-none data-[state=on]:translate-x-px data-[state=on]:translate-y-px data-[state=on]:shadow-none aria-pressed:translate-x-px aria-pressed:translate-y-px aria-pressed:shadow-none"

const toggleVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-all outline-none hover:bg-muted hover:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: `border-border ${RAISED}`,
        outline:
          `border-input ${RAISED} hover:bg-accent hover:text-accent-foreground`,
      },
      size: {
        default: "h-9 min-w-9 px-2",
        sm: "h-8 min-w-8 px-1.5",
        lg: "h-10 min-w-10 px-2.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Toggle({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> &
  VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive.Root
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Toggle, toggleVariants }
