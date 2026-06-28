import { atom } from 'jotai';

/**
 * Drives the "My Alerts" left-edge panel. `pendingPrompt` is a one-shot hand-off
 * to the in-chat bridge: when the panel's "New alert" button sets it, the bridge
 * (mounted inside the chat context) submits it via `ask()` and clears it.
 */
export const alertsPanelAtom = atom<{ open: boolean; pendingPrompt: string | null }>({
  open: false,
  pendingPrompt: null,
});
