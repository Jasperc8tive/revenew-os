// Agent runner - orchestrates execution of all AI agents
// Triggers different agents based on schedules and triggers

const AGENTS_BASE_URL = process.env.AGENTS_BASE_URL ?? 'http://localhost:8000';

function getOrganizationIds() {
  const raw = process.env.AGENT_RUNNER_ORG_IDS ?? '';
  return raw
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

function getAgentTypes() {
  const raw = process.env.AGENT_RUNNER_AGENT_TYPES ?? 'growth,forecasting,retention';
  return raw
    .split(',')
    .map((agentType) => agentType.trim())
    .filter(Boolean);
}

async function triggerAgent(agentType: string, organizationId: string) {
  const params = new URLSearchParams({
    agent_type: agentType,
    organization_id: organizationId,
  });

  const response = await fetch(`${AGENTS_BASE_URL}/agents/run?${params.toString()}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Agent trigger failed (${agentType}): ${response.status} ${body}`);
  }
}

export async function runAgents() {
  const organizationIds = getOrganizationIds();
  if (organizationIds.length === 0) {
    throw new Error('Set AGENT_RUNNER_ORG_IDS with comma-separated organization IDs.');
  }

  const agentTypes = getAgentTypes();
  for (const organizationId of organizationIds) {
    for (const agentType of agentTypes) {
      await triggerAgent(agentType, organizationId);
    }
  }
}

runAgents().catch((error) => {
  console.error('Agent runner failed:', error);
  process.exit(1);
});
