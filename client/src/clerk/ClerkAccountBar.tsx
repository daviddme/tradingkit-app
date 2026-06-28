import { useState } from 'react';
import type { CSSProperties } from 'react';
import { PricingTable, UserButton } from '@clerk/clerk-react';

/**
 * Fixed top-right cluster shown once a Clerk user is bridged in: an "Upgrade"
 * pill that opens Clerk Billing's <PricingTable/> in a modal, plus Clerk's
 * <UserButton/> for account management / sign-out. Lives above the LibreChat
 * app so it needs no surgery to LibreChat's own chrome.
 */
export default function ClerkAccountBar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div style={cluster}>
        <button onClick={() => setOpen(true)} style={pill} aria-label="Upgrade plan">
          ⚡ Upgrade
        </button>
        <UserButton afterSignOutUrl="/" />
      </div>

      {open && (
        <div style={overlay} onClick={() => setOpen(false)}>
          <div style={modal} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeader}>
              <span style={{ fontWeight: 700, color: '#e6e8f0', fontSize: 16 }}>
                Choose your plan
              </span>
              <button onClick={() => setOpen(false)} style={closeBtn} aria-label="Close">
                ✕
              </button>
            </div>
            <div style={{ padding: 16 }}>
              <PricingTable />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const cluster: CSSProperties = {
  position: 'fixed',
  top: 12,
  right: 14,
  zIndex: 60,
  display: 'flex',
  alignItems: 'center',
  gap: 10,
};

const pill: CSSProperties = {
  background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
  color: 'white',
  border: 'none',
  borderRadius: 999,
  padding: '7px 14px',
  fontWeight: 600,
  fontSize: 13,
  cursor: 'pointer',
  boxShadow: '0 2px 10px rgba(99,102,241,0.35)',
};

const overlay: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(4, 6, 12, 0.7)',
  backdropFilter: 'blur(2px)',
  zIndex: 1000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 20,
};

const modal: CSSProperties = {
  width: 'min(960px, 96vw)',
  maxHeight: '90vh',
  overflow: 'auto',
  background: '#0e1322',
  border: '1px solid #1e2540',
  borderRadius: 14,
  boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
};

const modalHeader: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '14px 16px',
  borderBottom: '1px solid #1e2540',
  position: 'sticky',
  top: 0,
  background: '#0e1322',
};

const closeBtn: CSSProperties = {
  background: 'transparent',
  color: '#9aa3b2',
  border: 'none',
  fontSize: 16,
  cursor: 'pointer',
};
