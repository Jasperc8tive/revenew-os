// Nightly analytics job - recalculates all metrics
// Runs daily to aggregate metrics from all integrations and update dashboards

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3001';
const SERVICE_TOKEN = process.env.SERVICE_AUTH_TOKEN;

function buildHeaders() {
  return {
    'Content-Type': 'application/json',
    ...(SERVICE_TOKEN ? { Authorization: `Bearer ${SERVICE_TOKEN}` } : {}),
  };
}

function getOrganizationIds() {
  const raw = process.env.NIGHTLY_ANALYTICS_ORG_IDS ?? '';
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

export async function runNightlyAnalytics() {
  const organizationIds = getOrganizationIds();
  if (organizationIds.length === 0) {
    throw new Error('Set NIGHTLY_ANALYTICS_ORG_IDS with comma-separated organization IDs.');
  }

  await request('/benchmarks/aggregate', {
    method: 'POST',
    body: JSON.stringify({}),
  });

  for (const organizationId of organizationIds) {
    await request(`/analytics/executive-summary?organizationId=${encodeURIComponent(organizationId)}`);
    await request(
      `/data-quality/anomalies/scan?organizationId=${encodeURIComponent(organizationId)}&lookbackDays=30`,
      {
        method: 'POST',
        body: JSON.stringify({}),
      },
    );
  }
}

runNightlyAnalytics().catch((error) => {
  console.error('Nightly analytics job failed:', error);
  process.exit(1);
});
