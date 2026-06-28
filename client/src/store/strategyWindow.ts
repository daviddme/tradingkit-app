import { atom } from 'jotai';

/**
 * TradingKit Strategy Window: a docked bottom panel that hosts the full
 * backtest / optimisation report (the Trader.dev report page) inside the chat,
 * opened when an MCP-UI card posts an `intent: 'strategy-window'` action.
 */
export interface StrategyWindowState {
  open: boolean;
  url: string | null;
  title: string;
}

export const strategyWindowAtom = atom<StrategyWindowState>({
  open: false,
  url: null,
  title: '',
});
