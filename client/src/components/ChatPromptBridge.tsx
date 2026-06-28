import { useEffect } from 'react';
import { useAtom } from 'jotai';
import { useChatContext } from '~/Providers/ChatContext';
import { pendingChatPromptAtom } from '~/store/chatPrompt';

/**
 * Mounted inside the main chat context. When a sidebar panel queues a prompt
 * (New alert, Re-test strategy, ...), this submits it into the conversation via
 * `ask()` and clears it. Renders nothing.
 */
export default function ChatPromptBridge() {
  const [pending, setPending] = useAtom(pendingChatPromptAtom);
  const { ask } = useChatContext();

  useEffect(() => {
    if (!pending) {
      return;
    }
    const text = pending;
    setPending(null);
    try {
      ask({ text });
    } catch (e) {
      console.error('[ChatPromptBridge] failed to submit prompt', e);
    }
  }, [pending, ask, setPending]);

  return null;
}
