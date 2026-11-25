import * as React from "react"
import { Slider as SliderPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root>) {
  const thumbValues = React.useMemo(() => {
    if (Array.isArray(value)) return value
    if (Array.isArray(defaultValue)) return defaultValue
    return [min]
  }, [value, defaultValue, min])

  return (
    <SliderPrimitive.Root
      className={cn(
        "relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50",
        className,
      )}
      data-slot="slider"
      defaultValue={defaultValue}
      max={max}
      min={min}
      value={value}
      {...props}
    >
      <SliderPrimitive.Track
        className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-muted"
        data-slot="slider-track"
      >
        <SliderPrimitive.Range
          className="absolute h-full bg-primary"
          data-slot="slider-range"
        />
      </SliderPrimitive.Track>
      {thumbValues.map((_, idx) => (
        <SliderPrimitive.Thumb
          className="block size-4 shrink-0 cursor-pointer rounded-full border-2 border-primary bg-background shadow-sm transition-shadow hover:ring-4 hover:ring-primary/20 focus-visible:ring-4 focus-visible:ring-ring/50 focus-visible:outline-none disabled:pointer-events-none"
          data-slot="slider-thumb"
          key={idx}
        />
      ))}
    </SliderPrimitive.Root>
  )
}

export { Slider }
