import { useEffect } from 'react';
import { useAtom } from 'jotai';
import { useChatContext } from '~/Providers/ChatContext';
import { alertsPanelAtom } from '~/store/alertsPanel';

/**
 * Mounted inside the main chat context. When the My Alerts panel's "New alert"
 * button sets `pendingPrompt`, this submits it into the conversation via `ask()`
 * and clears it. Renders nothing.
 */
export default function AlertsChatBridge() {
  const [{ pendingPrompt }, setPanel] = useAtom(alertsPanelAtom);
  const { ask } = useChatContext();

  useEffect(() => {
    if (!pendingPrompt) {
      return;
    }
    const text = pendingPrompt;
    setPanel({ pendingPrompt: null });
    try {
      ask({ text });
    } catch (e) {
      console.error('[AlertsChatBridge] failed to submit new-alert prompt', e);
    }
  }, [pendingPrompt, ask, setPanel]);

  return null;
}
