import type React from "react"
import { cn } from "@/lib/utils"

interface CustomRadioProps {
  checked: boolean
  className?: string
  size?: "sm" | "md" | "lg"
  disabled?: boolean
}

const CustomRadio: React.FC<CustomRadioProps> = ({ checked, className, size = "md", disabled }) => {
  const sizeClasses = {
    sm: "w-3 h-3",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  }

  const dotSizeClasses = {
    sm: "w-1.5 h-1.5",
    md: "w-2 h-2",
    lg: "w-2.5 h-2.5",
  }

  return (
    <div className={cn("relative ml-[-25px] mr-[15px]", className)}>
      <div
        className={cn(
          "rounded-full border transition-all duration-200 ease-in-out",
          sizeClasses[size],
          disabled
            ? "border-muted bg-muted-foreground/20 cursor-not-allowed"
            : checked
              ? "border-foreground bg-background cursor-pointer"
              : "border-muted-foreground/40 bg-background hover:border-foreground/60 cursor-pointer"
        )}
      >
        {checked && (
          <div
            className={cn(
              "rounded-full bg-foreground absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2",
              dotSizeClasses[size],
            )}
          />
        )}
      </div>
    </div>

  )
}

export default CustomRadio
