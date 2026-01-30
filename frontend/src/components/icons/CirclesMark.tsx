import * as React from "react";

/**
 * CirclesMark — brand icon for Circles
 * Two overlapping circles. Each circle is split into two halves:
 * - Left circle: Public (blue) + Friends (emerald)
 * - Right circle: Close (rose) + Work (slate)
 *
 * IMPORTANT: This component intentionally matches the Lucide IconType shape:
 *   { size?: string|number; className?: string; strokeWidth?: string|number; absoluteStrokeWidth?: boolean }
 * so it can be used anywhere the nav expects a lucide icon.
 */
export type CirclesMarkProps = {
  size?: string | number;
  className?: string;
  strokeWidth?: string | number;
  absoluteStrokeWidth?: boolean;
};

export const CirclesMark: React.FC<CirclesMarkProps> = ({
  size = 24,
  className,
  strokeWidth = 1.75,
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
      shapeRendering="geometricPrecision"
    >
      {/* Left circle (Public/Friends) halves */}
      {/* Left half (Public / blue) */}
      <path d="M9 6 A6 6 0 0 0 9 18 L9 12 Z" fill="#2563EB" />
      {/* Right half (Friends / emerald) */}
      <path d="M9 6 A6 6 0 0 1 9 18 L9 12 Z" fill="#059669" />

      {/* Right circle (Close/Work) halves */}
      {/* Left half (Close / rose) */}
      <path d="M15 6 A6 6 0 0 0 15 18 L15 12 Z" fill="#E11D48" />
      {/* Right half (Work / slate) */}
      <path d="M15 6 A6 6 0 0 1 15 18 L15 12 Z" fill="#334155" />

      {/* Outline follows current text color (neutral in nav) */}
      <circle cx="9" cy="12" r="6" stroke="currentColor" strokeWidth={strokeWidth} />
      <circle cx="15" cy="12" r="6" stroke="currentColor" strokeWidth={strokeWidth} />
    </svg>
  );
};
