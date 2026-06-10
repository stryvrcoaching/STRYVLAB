import { Slider as SliderPrimitive } from "@base-ui/react/slider";

import { cn } from "@/lib/utils";

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  ...props
}: SliderPrimitive.Root.Props) {
  const _values = Array.isArray(value)
    ? value
    : Array.isArray(defaultValue)
      ? defaultValue
      : [min, max];

  return (
    <SliderPrimitive.Root
      className={cn("w-full", className)}
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      thumbAlignment="edge"
      {...props}
    >
      <SliderPrimitive.Control
        style={{
          position: "relative",
          display: "flex",
          width: "100%",
          alignItems: "center",
          touchAction: "none",
          userSelect: "none",
          height: "20px",
        }}
      >
        <SliderPrimitive.Track
          data-slot="slider-track"
          style={{
            position: "relative",
            flexGrow: 1,
            borderRadius: "9999px",
            background: "rgba(255,255,255,0.15)",
            height: "4px",
            overflow: "hidden",
          }}
        >
          <SliderPrimitive.Indicator
            data-slot="slider-range"
            style={{
              background: "#1f8a65",
              height: "100%",
            }}
          />
        </SliderPrimitive.Track>
        {Array.from({ length: _values.length }, (_, index) => (
          <SliderPrimitive.Thumb
            data-slot="slider-thumb"
            key={index}
            style={{
              display: "block",
              width: "16px",
              height: "16px",
              borderRadius: "9999px",
              background: "white",
              flexShrink: 0,
              cursor: "pointer",
              outline: "none",
            }}
          />
        ))}
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  );
}

export { Slider };
