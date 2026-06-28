import { atom } from 'jotai';

/**
 * Bumped when a backtest tool (quick_backtest / run_backtest) finishes in chat,
 * so the open My Strategies panel reloads its list (the new backtest is recorded
 * upstream automatically).
 */
export const strategiesSignalAtom = atom<{ refresh: number }>({ refresh: 0 });
