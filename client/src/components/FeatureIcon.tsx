/**
 * FeatureIcon — renders custom PNG icons from /icons/ with the same API as Lucide icons.
 * Usage: <FeatureIcon name="icon_01_r1c1" className="h-4 w-4" />
 * Or use the factory: const MyIcon = featureIcon("icon_01_r1c1"); <MyIcon className="h-4 w-4" />
 */
import React from "react";

interface FeatureIconProps {
  name: string;
  className?: string;
}

export function FeatureIcon({ name, className = "h-4 w-4" }: FeatureIconProps) {
  // Detect if the active (blue) state is applied via className
  const isActive = className?.includes("text-blue-400");
  return (
    <img
      src={`/icons/${name}_24.png`}
      alt=""
      className={`${className} object-contain`}
      style={{
        filter: isActive
          ? "brightness(0) invert(1) sepia(1) saturate(5) hue-rotate(190deg)"
          : "brightness(0) invert(0.65)",
      }}
      draggable={false}
    />
  );
}

/**
 * Factory function that creates a component compatible with the MenuItem icon type.
 * The returned component accepts `className` just like Lucide icons.
 */
export function featureIcon(name: string) {
  const IconComponent = ({ className }: { className?: string }) => (
    <FeatureIcon name={name} className={className} />
  );
  IconComponent.displayName = `FeatureIcon(${name})`;
  return IconComponent;
}
