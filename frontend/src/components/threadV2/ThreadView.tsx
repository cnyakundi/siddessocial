import React from "react";

/**
 * ThreadView (Feed V2)
 * -------------------------------------------------------
 * PURPOSE:
 * - Full thread view for a root post
 * - Nested replies with indentation
 * - Reply composer (sticky)
 *
 * STATUS:
 * - Scaffold only (no routing yet)
 */

type Props = {
  postId: string;
  onClose?: () => void;
};

export default function ThreadView({ postId, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-40 bg-white p-6 text-sm text-gray-400">
      <div className="mb-4 font-bold text-gray-900">ThreadView scaffold</div>
      <div>postId: {postId}</div>
      <button
        onClick={onClose}
        className="mt-4 rounded bg-gray-100 px-3 py-1 text-xs"
      >
        Close
      </button>
    </div>
  );
}
