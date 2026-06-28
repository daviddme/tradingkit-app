/**
 * TradingKit mark — a clean single-color glyph (rising arrow + candlesticks)
 * that inherits `currentColor`, so it reads crisply at small sizes (conversation
 * list, AI avatar) in both light and dark themes. The full brand logo lives in
 * /assets for the login page + favicon.
 */
export default function TradingKitIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      role="img"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g fill="currentColor" opacity="0.55">
        <rect x="4.4" y="13.5" width="2.4" height="5.2" rx="0.6" />
        <rect x="10.2" y="9.8" width="2.4" height="6.4" rx="0.6" />
      </g>
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 18.5 L8.6 13 L12.6 16 L20.5 8" />
        <path d="M15.3 8 H21 V13.7" />
      </g>
    </svg>
  );
}
