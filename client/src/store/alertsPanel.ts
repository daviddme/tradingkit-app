import { atom } from 'jotai';

/**
 * Bumped when an alert mutation tool (create/update/pause/resume/delete) finishes
 * in chat. `open` is watched by the sidebar controller to open + expand the My
 * Alerts panel; `refresh` is watched by the panel to reload its list. Two
 * counters so an already-open panel reloads even when `open` doesn't change.
 */
export const alertsSignalAtom = atom<{ open: number; refresh: number }>({
  open: 0,
  refresh: 0,
});
