import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import {
  ClerkProvider,
  SignedIn,
  SignedOut,
  SignIn,
  useAuth,
  useClerk,
} from '@clerk/clerk-react';
import ClerkAccountBar from './ClerkAccountBar';

type StartupCfg = {
  clerkPublishableKey?: string | null;
  clerkIsSatellite?: boolean | null;
  clerkDomain?: string | null;
  clerkSignInUrl?: string | null;
} | null;

const CONFIG_ENDPOINT = '/api/config';
const SESSION_ENDPOINT = '/api/clerk/session';

const SHELL: CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'radial-gradient(1200px 600px at 50% -10%, #11162a 0%, #080a12 60%)',
};

const PRIMARY = '#6366f1';

function Shell({ children }: { children: ReactNode }) {
  return <div style={SHELL}>{children}</div>;
}

/**
 * Keeps the native LibreChat session in step with Clerk: when the user signs
 * out of Clerk, clear the LibreChat cookie so a fresh sign-in re-bridges.
 */
function SessionSync() {
  const { isLoaded, isSignedIn } = useAuth();
  const wasSignedIn = useRef(false);
  useEffect(() => {
    if (!isLoaded) {
      return;
    }
    if (wasSignedIn.current && !isSignedIn) {
      fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    }
    wasSignedIn.current = !!isSignedIn;
  }, [isLoaded, isSignedIn]);
  return null;
}

/**
 * Once Clerk reports a signed-in user, exchange the Clerk session token for a
 * native LibreChat session (sets the refreshToken cookie). Only after that
 * succeeds do we mount the LibreChat app, whose AuthContext silently refreshes
 * off the cookie and logs the user in with zero extra surgery.
 */
function ClerkBridge({ children }: { children: ReactNode }) {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [state, setState] = useState<'working' | 'ready' | 'error'>('working');
  const ran = useRef(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || ran.current) {
      return;
    }
    ran.current = true;
    (async () => {
      try {
        const token = await getToken();
        const res = await fetch(SESSION_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ token }),
        });
        if (!res.ok) {
          throw new Error(`bridge failed: ${res.status}`);
        }
        setState('ready');
      } catch (err) {
        console.error('[ClerkBridge] failed to establish LibreChat session', err);
        setState('error');
      }
    })();
  }, [isLoaded, isSignedIn, getToken]);

  if (state === 'ready') {
    return (
      <>
        {children}
        <ClerkAccountBar />
      </>
    );
  }

  if (state === 'error') {
    return (
      <Shell>
        <div style={{ color: '#e6e8f0', textAlign: 'center', maxWidth: 360 }}>
          <p style={{ fontSize: 18, marginBottom: 12 }}>We could not start your session.</p>
          <button onClick={() => window.location.reload()} style={primaryButton}>
            Try again
          </button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div style={{ color: '#9aa3b2' }}>Setting up your TradingKit workspace…</div>
    </Shell>
  );
}

const primaryButton: CSSProperties = {
  background: PRIMARY,
  color: 'white',
  border: 'none',
  borderRadius: 8,
  padding: '10px 18px',
  fontWeight: 600,
  cursor: 'pointer',
};

/**
 * Satellite sign-in screen. TradingKit runs on Trader.dev's shared Clerk
 * instance, so chat.tradingkit.com is a satellite domain and credentials are
 * entered on the Trader.dev primary. We show a branded screen and hand off to
 * the primary sign-in; Clerk syncs the session back to this domain on return.
 */
function SatelliteSignIn() {
  const { redirectToSignIn } = useClerk();
  return (
    <Shell>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ color: '#e6e8f0', fontSize: 28, fontWeight: 700, marginBottom: 6 }}>
          TradingKit
        </h1>
        <p style={{ color: '#9aa3b2', marginBottom: 24 }}>
          Backtest trading strategies in plain English.
        </p>
        <button
          onClick={() => redirectToSignIn({ redirectUrl: window.location.href })}
          style={primaryButton}
        >
          Continue with Trader.dev
        </button>
      </div>
    </Shell>
  );
}

/**
 * Top-level auth gate. Reads the runtime startup config; if a Clerk publishable
 * key is present, the whole app is gated behind Clerk (sign-in screen, then the
 * session bridge). If absent (e.g. production until validated), it transparently
 * renders the native LibreChat app.
 */
export default function ClerkAuthGate({ children }: { children: ReactNode }) {
  const [cfg, setCfg] = useState<StartupCfg | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    fetch(CONFIG_ENDPOINT, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && setCfg(d))
      .catch(() => alive && setCfg(null));
    return () => {
      alive = false;
    };
  }, []);

  if (cfg === undefined) {
    return (
      <Shell>
        <div style={{ color: '#9aa3b2' }}>Loading…</div>
      </Shell>
    );
  }

  const publishableKey = cfg?.clerkPublishableKey;
  if (!publishableKey) {
    // Clerk disabled — native LibreChat auth.
    return <>{children}</>;
  }

  // Satellite mode (Trader.dev's shared instance): authentication redirects to
  // the Trader.dev primary. Single-instance mode renders sign-in inline.
  const satellite = !!cfg?.clerkIsSatellite;
  const satelliteProps = satellite
    ? {
        isSatellite: true,
        domain: cfg?.clerkDomain || undefined,
        signInUrl: cfg?.clerkSignInUrl || undefined,
      }
    : {};

  return (
    <ClerkProvider publishableKey={publishableKey} afterSignOutUrl="/" {...satelliteProps}>
      <SessionSync />
      <SignedOut>
        {satellite ? (
          <SatelliteSignIn />
        ) : (
          <Shell>
            <div style={{ textAlign: 'center' }}>
              <h1 style={{ color: '#e6e8f0', fontSize: 28, fontWeight: 700, marginBottom: 6 }}>
                TradingKit
              </h1>
              <p style={{ color: '#9aa3b2', marginBottom: 24 }}>
                Backtest trading strategies in plain English.
              </p>
              <div style={{ display: 'inline-block' }}>
                <SignIn routing="hash" />
              </div>
            </div>
          </Shell>
        )}
      </SignedOut>
      <SignedIn>
        <ClerkBridge>{children}</ClerkBridge>
      </SignedIn>
    </ClerkProvider>
  );
}
