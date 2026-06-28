import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useAtom } from 'jotai';
import { useChatContext } from '~/Providers/ChatContext';
import { useAuthContext } from '~/hooks/AuthContext';
import { alertsPanelAtom } from '~/store/alertsPanel';

type Channel = { type?: string; to?: string; url?: string; chat_id?: string };
type Alert = {
  id: string;
  name: string;
  symbol: string;
  timeframe: string;
  status: string;
  channels: Channel[];
  lastFiredAt: string | null;
  sourceStrategyId?: string | null;
};
type Quota = {
  used: number | string;
  limit: number | null;
  tier: string;
  unlimited: boolean;
  remaining: number | null;
};

const NEW_ALERT_PROMPT =
  'I want to set up a live alert. Show me the channel options (Webhook, Telegram, Email) and walk me through connecting one.';

const PRIMARY = '#6366f1';
const PANEL_BG = '#0e1322';
const BORDER = '#1e2540';

/** Authed fetch against the LibreChat alerts proxy using the in-memory JWT. */
function useAlertsApi() {
  const { token } = useAuthContext();
  return useCallback(
    async (method: string, path: string, body?: unknown) => {
      const res = await fetch(`/api/tk-alerts${path}`, {
        method,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        credentials: 'include',
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => null);
      return { ok: res.ok, status: res.status, data };
    },
    [token],
  );
}

function channelLabel(type?: string): string {
  switch ((type || '').toLowerCase()) {
    case 'webhook':
      return 'Webhook';
    case 'telegram':
      return 'Telegram';
    case 'email':
      return 'Email';
    default:
      return type || 'Channel';
  }
}

function relativeTime(ms: string | null): string {
  if (!ms) {
    return 'never';
  }
  const n = Number(ms);
  if (!Number.isFinite(n)) {
    return 'never';
  }
  const diff = Date.now() - n;
  if (diff < 0) {
    return 'just now';
  }
  const mins = Math.floor(diff / 60000);
  if (mins < 1) {
    return 'just now';
  }
  if (mins < 60) {
    return `${mins}m ago`;
  }
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) {
    return `${hrs}h ago`;
  }
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function AlertsDock() {
  const [panel, setPanel] = useAtom(alertsPanelAtom);
  const { ask } = useChatContext();
  const api = useAlertsApi();

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, q] = await Promise.all([api('GET', '/'), api('GET', '/quota')]);
      if (list.ok && Array.isArray(list.data)) {
        setAlerts(list.data as Alert[]);
      } else {
        setError('Could not load alerts.');
      }
      if (q.ok && q.data) {
        setQuota(q.data as Quota);
      }
    } catch {
      setError('Could not load alerts.');
    } finally {
      setLoading(false);
    }
  }, [api]);

  // Load whenever the panel opens.
  useEffect(() => {
    if (panel.open) {
      load();
    }
  }, [panel.open, load]);

  // Bridge: the panel sets pendingPrompt; submit it into the chat and clear it.
  useEffect(() => {
    if (!panel.pendingPrompt) {
      return;
    }
    const text = panel.pendingPrompt;
    setPanel((p) => ({ ...p, pendingPrompt: null, open: false }));
    try {
      ask({ text });
    } catch (e) {
      console.error('[AlertsDock] failed to submit new-alert prompt', e);
    }
  }, [panel.pendingPrompt, ask, setPanel]);

  const act = useCallback(
    async (id: string, verb: 'pause' | 'resume' | 'test' | 'delete') => {
      setBusyId(id);
      try {
        if (verb === 'delete') {
          await api('DELETE', `/${id}`);
        } else {
          await api('POST', `/${id}/${verb}`);
        }
        if (verb !== 'test') {
          await load();
        }
      } finally {
        setBusyId(null);
      }
    },
    [api, load],
  );

  const newAlert = () =>
    setPanel((p) => ({ ...p, pendingPrompt: NEW_ALERT_PROMPT }));

  const quotaText = quota
    ? quota.unlimited
      ? `${quota.used} active · unlimited`
      : `${quota.used} / ${quota.limit ?? '—'} active`
    : '';

  return (
    <>
      {/* Left-edge launcher */}
      <button
        onClick={() => setPanel((p) => ({ ...p, open: !p.open }))}
        style={launcher}
        title="My Alerts"
        aria-label="My Alerts"
      >
        <BellIcon />
        <span style={launcherText}>Alerts</span>
      </button>

      {panel.open && (
        <>
          <div style={scrim} onClick={() => setPanel((p) => ({ ...p, open: false }))} />
          <aside style={panelStyle}>
            <div style={header}>
              <div>
                <div style={{ fontWeight: 700, color: '#e6e8f0', fontSize: 15 }}>My Alerts</div>
                {quotaText && <div style={{ color: '#7f8aa3', fontSize: 12 }}>{quotaText}</div>}
              </div>
              <button onClick={load} style={iconBtn} title="Refresh" aria-label="Refresh">
                ⟳
              </button>
              <button
                onClick={() => setPanel((p) => ({ ...p, open: false }))}
                style={iconBtn}
                title="Close"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div style={body}>
              {loading && <div style={muted}>Loading…</div>}
              {error && !loading && <div style={{ ...muted, color: '#ef6b6b' }}>{error}</div>}
              {!loading && !error && alerts.length === 0 && (
                <div style={muted}>
                  No alerts yet. Create one to get notified the moment a strategy fires.
                </div>
              )}

              {!loading &&
                alerts.map((a) => {
                  const paused = a.status === 'paused';
                  const busy = busyId === a.id;
                  return (
                    <div key={a.id} style={card}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={cardTitle} title={a.name}>
                            {a.name || 'Untitled alert'}
                          </div>
                          <div style={cardMeta}>
                            {a.symbol} · {a.timeframe} · fired {relativeTime(a.lastFiredAt)}
                          </div>
                        </div>
                        <span style={paused ? pillPaused : pillActive}>
                          {paused ? 'Paused' : 'Active'}
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                        {(a.channels || []).length === 0 ? (
                          <span style={chanBadgeMuted}>No channels</span>
                        ) : (
                          a.channels.map((c, i) => (
                            <span key={i} style={chanBadge}>
                              {channelLabel(c.type)}
                            </span>
                          ))
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                        <button
                          style={miniBtn}
                          disabled={busy}
                          onClick={() => act(a.id, paused ? 'resume' : 'pause')}
                        >
                          {paused ? 'Resume' : 'Pause'}
                        </button>
                        <button style={miniBtn} disabled={busy} onClick={() => act(a.id, 'test')}>
                          Test
                        </button>
                        <button
                          style={miniDanger}
                          disabled={busy}
                          onClick={() => {
                            if (window.confirm(`Delete alert "${a.name}"?`)) {
                              act(a.id, 'delete');
                            }
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>

            <div style={footer}>
              <button onClick={newAlert} style={newBtn}>
                ＋ New alert
              </button>
            </div>
          </aside>
        </>
      )}
    </>
  );
}

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const launcher: CSSProperties = {
  position: 'fixed',
  left: 0,
  top: '42%',
  zIndex: 55,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 4,
  padding: '10px 8px',
  background: 'linear-gradient(180deg, #6366f1, #8b5cf6)',
  color: 'white',
  border: 'none',
  borderRadius: '0 10px 10px 0',
  cursor: 'pointer',
  boxShadow: '0 2px 12px rgba(99,102,241,0.4)',
};
const launcherText: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: 0.3,
  writingMode: 'vertical-rl',
  transform: 'rotate(180deg)',
};

const scrim: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(4,6,12,0.45)',
  zIndex: 56,
};

const panelStyle: CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  height: '100vh',
  width: 'min(380px, 92vw)',
  background: PANEL_BG,
  borderRight: `1px solid ${BORDER}`,
  zIndex: 57,
  display: 'flex',
  flexDirection: 'column',
  boxShadow: '8px 0 30px rgba(0,0,0,0.45)',
};

const header: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '14px 14px',
  borderBottom: `1px solid ${BORDER}`,
};

const body: CSSProperties = { flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 };
const footer: CSSProperties = { padding: 12, borderTop: `1px solid ${BORDER}` };
const muted: CSSProperties = { color: '#7f8aa3', fontSize: 13, padding: '8px 4px' };

const card: CSSProperties = {
  background: '#121829',
  border: `1px solid ${BORDER}`,
  borderRadius: 10,
  padding: 12,
};
const cardTitle: CSSProperties = {
  color: '#e6e8f0',
  fontSize: 14,
  fontWeight: 600,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};
const cardMeta: CSSProperties = { color: '#7f8aa3', fontSize: 12, marginTop: 2 };

const pillBase: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  padding: '3px 8px',
  borderRadius: 999,
  height: 'fit-content',
  whiteSpace: 'nowrap',
};
const pillActive: CSSProperties = { ...pillBase, background: 'rgba(34,197,94,0.15)', color: '#4ade80' };
const pillPaused: CSSProperties = { ...pillBase, background: 'rgba(148,163,184,0.15)', color: '#94a3b8' };

const chanBadge: CSSProperties = {
  fontSize: 11,
  color: '#c7cee0',
  background: '#1b2236',
  border: `1px solid ${BORDER}`,
  borderRadius: 6,
  padding: '2px 7px',
};
const chanBadgeMuted: CSSProperties = { ...chanBadge, color: '#6b7490' };

const iconBtn: CSSProperties = {
  background: 'transparent',
  color: '#9aa3b2',
  border: 'none',
  fontSize: 15,
  cursor: 'pointer',
  padding: 4,
};

const miniBtn: CSSProperties = {
  flex: 1,
  background: '#1b2236',
  color: '#dfe3ee',
  border: `1px solid ${BORDER}`,
  borderRadius: 7,
  padding: '6px 0',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
};
const miniDanger: CSSProperties = {
  ...miniBtn,
  color: '#ef8a8a',
  borderColor: 'rgba(239,107,107,0.35)',
  background: 'rgba(239,107,107,0.08)',
};

const newBtn: CSSProperties = {
  width: '100%',
  background: `linear-gradient(90deg, ${PRIMARY}, #8b5cf6)`,
  color: 'white',
  border: 'none',
  borderRadius: 9,
  padding: '10px 0',
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
};
