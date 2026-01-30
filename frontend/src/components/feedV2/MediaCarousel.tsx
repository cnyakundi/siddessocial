import React from "react";

/**
 * MediaCarousel (Feed V2)
 * -------------------------------------------------------
 * PURPOSE:
 * - Threads-style horizontal swipe carousel (images + video)
 * - Mobile: swipe + dots + counter
 * - Desktop: hover arrows + click
 *
 * STATUS:
 * - Scaffold only (no behavior yet)
 */

export type MediaItem =
  | { type: "image"; src: string; alt?: string }
  | { type: "video"; src: string; poster?: string };

type Props = {
  media: MediaItem[];
  onOpen?: (index: number) => void;
};

export default function MediaCarousel({ media }: Props) {
  return (
    <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50 p-4 text-xs text-gray-400">
      MediaCarousel scaffold ({media.length} items)
    </div>
  );
}
