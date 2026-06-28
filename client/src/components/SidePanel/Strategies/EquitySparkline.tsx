import { useEffect, useState } from 'react';

// Module-level cache so re-renders / re-opens don't refetch the equity blob.
const cache = new Map<string, number[]>();

function downsample(values: number[], target = 120): number[] {
  if (values.length <= target) {
    return values;
  }
  const step = values.length / target;
  const out: number[] = [];
  for (let i = 0; i < target; i++) {
    out.push(values[Math.floor(i * step)]);
  }
  out.push(values[values.length - 1]);
  return out;
}

function buildPath(values: number[], w: number, h: number, pad = 2): string {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const n = values.length;
  const innerH = h - pad * 2;
  return values
    .map((v, i) => {
      const x = (i / (n - 1)) * w;
      const y = pad + (innerH - ((v - min) / range) * innerH);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

/** Renders a small equity-curve sparkline from a Trader.dev r2 result blob. */
export default function EquitySparkline({ url, up }: { url: string; up: boolean }) {
  const [values, setValues] = useState<number[] | null>(cache.get(url) ?? null);
  const w = 280;
  const h = 44;

  useEffect(() => {
    if (cache.has(url)) {
      setValues(cache.get(url) as number[]);
      return;
    }
    let alive = true;
    fetch(url)
      .then((r) => r.json())
      .then((j) => {
        const eq = Array.isArray(j?.equity) ? j.equity : [];
        const vals = eq
          .map((p: { equity?: number }) => Number(p?.equity))
          .filter((x: number) => Number.isFinite(x));
        const ds = downsample(vals);
        cache.set(url, ds);
        if (alive) {
          setValues(ds);
        }
      })
      .catch(() => {
        if (alive) {
          setValues([]);
        }
      });
    return () => {
      alive = false;
    };
  }, [url]);

  if (values === null) {
    return <div className="h-[44px] w-full animate-pulse rounded bg-surface-tertiary" />;
  }
  if (values.length < 2) {
    return null;
  }

  const color = up ? '#22c55e' : '#ef4444';
  const path = buildPath(values, w, h);
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width="100%"
      height={h}
      preserveAspectRatio="none"
      className="block"
      aria-hidden="true"
    >
      <path d={path} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}
