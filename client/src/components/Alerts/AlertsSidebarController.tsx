import { useEffect, useRef } from 'react';
import { useAtomValue } from 'jotai';
import { useSetRecoilState } from 'recoil';
import { useActivePanel } from '~/Providers/ActivePanelContext';
import { alertsSignalAtom } from '~/store/alertsPanel';
import store from '~/store';

/**
 * Mounted inside the sidebar (within ActivePanelProvider). When an alert tool
 * completes in chat, the global `open` signal increments; this opens + expands
 * the My Alerts panel so the user sees the change immediately. Renders nothing.
 */
export default function AlertsSidebarController() {
  const { open } = useAtomValue(alertsSignalAtom);
  const { setActive } = useActivePanel();
  const setExpanded = useSetRecoilState(store.sidebarExpanded);
  const seen = useRef(0);

  useEffect(() => {
    if (open > seen.current) {
      seen.current = open;
      setActive('alerts');
      setExpanded(true);
    }
  }, [open, setActive, setExpanded]);

  return null;
}
