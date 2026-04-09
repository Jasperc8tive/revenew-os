// Background worker for syncing data from integrations
// Runs scheduled jobs to fetch data from marketing, payment, CRM, and analytics platforms

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3001';
const SERVICE_TOKEN = process.env.SERVICE_AUTH_TOKEN;

function buildHeaders() {
  return {
    'Content-Type': 'application/json',
    ...(SERVICE_TOKEN ? { Authorization: `Bearer ${SERVICE_TOKEN}` } : {}),
  };
}

function getOrganizationIds() {
  const raw = process.env.INTEGRATION_SYNC_ORG_IDS ?? '';
  return raw
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

async function request(path: string, options?: RequestInit) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...buildHeaders(),
      ...(options?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Request failed for ${path}: ${response.status} ${body}`);
  }

  return response.json();
}

export async function syncIntegrationData() {
  const organizationIds = getOrganizationIds();
  if (organizationIds.length === 0) {
    throw new Error('Set INTEGRATION_SYNC_ORG_IDS with comma-separated organization IDs.');
  }

  for (const organizationId of organizationIds) {
    const integrations = (await request(
      `/integrations?organizationId=${encodeURIComponent(organizationId)}`,
    )) as Array<{ id: string; status: string }>;

    const activeIntegrations = integrations.filter((integration) => integration.status === 'ACTIVE');
    for (const integration of activeIntegrations) {
      await request(`/integrations/${encodeURIComponent(integration.id)}/sync`, {
        method: 'POST',
        body: JSON.stringify({
          organizationId,
          initiatedBy: 'system:data-sync-worker',
        }),
      });
    }
  }
}

syncIntegrationData().catch((error) => {
  console.error('Data sync worker failed:', error);
  process.exit(1);
});
