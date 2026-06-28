import { useRef, useState, useCallback } from 'react';
import { useAtom } from 'jotai';
import { strategyWindowAtom } from '~/store/strategyWindow';

/**
 * Docked bottom "Strategy Window". Renders the full report (the Trader.dev
 * /backtest/<id> or /optimize/<id> page) in an iframe at the bottom of the chat,
 * so the user never leaves the conversation. Opened via the strategy-window
 * MCP-UI action (see handleUIAction). Resizable by dragging the top edge.
 */
export default function StrategyWindowDock() {
  const [sw, setSw] = useAtom(strategyWindowAtom);
  const [height, setHeight] = useState<number>(420);
  const dragging = useRef(false);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    dragging.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);
  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) {
      return;
    }
    const next = window.innerHeight - e.clientY;
    setHeight(Math.max(200, Math.min(next, window.innerHeight - 120)));
  }, []);
  const onPointerUp = useCallback((e: React.PointerEvent) => {
    dragging.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
  }, []);

  if (!sw.open || !sw.url) {
    return null;
  }

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height,
        zIndex: 40,
        background: '#0b0e1a',
        borderTop: '1px solid #1c2333',
        boxShadow: '0 -8px 24px rgba(0,0,0,0.35)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* drag handle */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{ height: 6, cursor: 'ns-resize', background: 'transparent' }}
        aria-label="Resize Strategy Window"
      />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 12px',
          borderBottom: '1px solid #1c2333',
          background: '#0e1322',
          color: '#e2e8f0',
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {sw.title || 'Strategy Window'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <a
            href={sw.url}
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: 12, color: '#94a3b8', textDecoration: 'none' }}
          >
            Open in new tab ↗
          </a>
          <button
            onClick={() => setSw({ ...sw, open: false })}
            aria-label="Close Strategy Window"
            style={{
              fontSize: 14,
              lineHeight: 1,
              color: '#94a3b8',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
            }}
          >
            ✕
          </button>
        </div>
      </div>
      <iframe
        src={sw.url}
        title={sw.title || 'Strategy Window'}
        style={{ flex: 1, width: '100%', border: 0, background: '#0b0e1a' }}
      />
    </div>
  );
}
