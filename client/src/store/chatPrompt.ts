import { atom } from 'jotai';

/**
 * One-shot chat prompt queue. A sidebar panel sets this (e.g. "New alert" or
 * "Re-test strategy"); the in-chat ChatPromptBridge submits it via `ask()` and
 * clears it. Decouples sidebar components from the chat context.
 */
export const pendingChatPromptAtom = atom<string | null>(null);
