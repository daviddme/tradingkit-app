import { useMemo } from 'react';
import { PermissionBits } from 'librechat-data-provider';
import type { TAgentsMap } from 'librechat-data-provider';
import { useListAgentsQuery } from '~/data-provider';
import { mapAgents } from '~/utils';

export default function useAgentsMap({
  isAuthenticated,
}: {
  isAuthenticated: boolean;
}): TAgentsMap | undefined {
  const { data: mappedAgents = null } = useListAgentsQuery(
    { requiredPermission: PermissionBits.VIEW },
    {
      select: (res) => mapAgents(res.data),
      enabled: isAuthenticated,
      // Always refetch on mount so the agent picker / model-spec filter reflects
      // the current roster. Without this, a stale cache (e.g. from before an
      // agent was published) hides newly-available agents until cache eviction.
      refetchOnMount: 'always',
    },
  );

  const agentsMap = useMemo<TAgentsMap | undefined>(() => {
    return mappedAgents !== null ? mappedAgents : undefined;
  }, [mappedAgents]);

  return agentsMap;
}
