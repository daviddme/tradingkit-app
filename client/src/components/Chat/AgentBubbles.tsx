import { useMemo } from 'react';
import { EModelEndpoint } from 'librechat-data-provider';
import type { TEndpointsConfig } from 'librechat-data-provider';
import { TooltipAnchor } from '@librechat/client';
import { useGetEndpointsQuery, useGetStartupConfig } from '~/data-provider';
import { useAssistantsMapContext, useAgentsMapContext } from '~/Providers';
import { useGetConversation, useNewConvo } from '~/hooks';
import useSelectMention from '~/hooks/Input/useSelectMention';

const COLORS = ['#6366f1', '#0ea5e9', '#22c55e', '#f59e0b', '#ec4899', '#8b5cf6'];

function initials(name?: string): string {
  if (!name) {
    return '?';
  }
  const parts = name.trim().replace(/[—-].*$/, '').trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/**
 * A row of agent "bubbles" shown on the new/empty chat, below the composer.
 * Each is the agent's avatar (or an initials chip), tooltip "Chat with <name>",
 * and clicking switches the conversation to that agent's model spec.
 */
export default function AgentBubbles() {
  const getConversation = useGetConversation(0);
  const { newConversation } = useNewConvo();
  const assistantsMap = useAssistantsMapContext();
  const agentsMap = useAgentsMapContext();
  const { data: endpointsConfig = {} as TEndpointsConfig } = useGetEndpointsQuery();
  const { data: startupConfig } = useGetStartupConfig();

  const modelSpecs = useMemo(
    () => startupConfig?.modelSpecs?.list ?? [],
    [startupConfig?.modelSpecs?.list],
  );

  const { onSelectSpec } = useSelectMention({
    modelSpecs,
    assistantsMap,
    endpointsConfig,
    getConversation,
    newConversation,
    returnHandlers: true,
  });

  const agentSpecs = useMemo(() => {
    if (!agentsMap) {
      return [];
    }
    return modelSpecs
      .filter(
        (s) =>
          s.preset?.endpoint === EModelEndpoint.agents &&
          s.preset?.agent_id &&
          s.preset.agent_id in agentsMap,
      )
      .map((s) => ({ spec: s, agent: agentsMap[s.preset!.agent_id as string] }));
  }, [modelSpecs, agentsMap]);

  if (agentSpecs.length === 0) {
    return null;
  }

  return (
    <div className="mt-5 flex flex-col items-center gap-2.5">
      <div className="text-xs font-medium text-text-secondary">
        Or chat with one of the desk
      </div>
      <div className="flex flex-wrap items-start justify-center gap-3">
        {agentSpecs.map(({ spec, agent }, i) => {
          const name = agent?.name || spec.label || 'Agent';
          const avatar = agent?.avatar?.filepath;
          return (
            <TooltipAnchor
              key={spec.name}
              side="top"
              description={`Chat with ${name}`}
              render={
                <button
                  type="button"
                  aria-label={`Chat with ${name}`}
                  onClick={() => onSelectSpec?.(spec)}
                  className="flex w-16 flex-col items-center gap-1 rounded-lg p-1 outline-none transition-colors hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-border-heavy"
                >
                  <span
                    className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-border-medium transition-transform hover:scale-105"
                    style={avatar ? undefined : { background: COLORS[i % COLORS.length] }}
                  >
                    {avatar ? (
                      <img src={avatar} alt={name} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-sm font-semibold text-white">{initials(name)}</span>
                    )}
                  </span>
                  <span className="max-w-full truncate text-[11px] leading-tight text-text-secondary">
                    {name}
                  </span>
                </button>
              }
            />
          );
        })}
      </div>
    </div>
  );
}
