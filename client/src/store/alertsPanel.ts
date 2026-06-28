import { atom } from 'jotai';

/**
 * One-shot hand-off from the My Alerts panel to the in-chat bridge: when the
 * panel's "New alert" button sets `pendingPrompt`, the bridge (mounted inside
 * the main chat context) submits it via `ask()` and clears it.
 */
export const alertsPanelAtom = atom<{ pendingPrompt: string | null }>({
  pendingPrompt: null,
});
