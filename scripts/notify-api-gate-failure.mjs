#!/usr/bin/env node

function resolveMentions() {
  return [
    process.env.OWNER_MENTION || 'Owner',
    process.env.STAFF_MENTION || 'Staff',
    process.env.DELIVERY_MANAGER_MENTION || 'Delivery Manager',
  ];
}

function buildContext() {
  const repo = process.env.GITHUB_REPOSITORY || 'unknown-repo';
  const ref = process.env.GITHUB_REF_NAME || 'unknown-ref';
  const runId = process.env.GITHUB_RUN_ID || '';
  const serverUrl = process.env.GITHUB_SERVER_URL || 'https://github.com';
  const runUrl = runId ? `${serverUrl}/${repo}/actions/runs/${runId}` : 'N/A';

  return {
    repo,
    ref,
    runUrl,
    mentions: resolveMentions(),
  };
}

function formatSlackPayload(ctx) {
  const text = [
    ':x: API Quality Gate FAILED',
    `Repository: ${ctx.repo}`,
    `Branch: ${ctx.ref}`,
    `Run: ${ctx.runUrl}`,
    `Escalate to: ${ctx.mentions.join(', ')}`,
  ].join('\n');

  return {
    text,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: 'API Quality Gate FAILED',
        },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Repository*\n${ctx.repo}` },
          { type: 'mrkdwn', text: `*Branch*\n${ctx.ref}` },
          { type: 'mrkdwn', text: `*Run*\n<${ctx.runUrl}|View workflow run>` },
          { type: 'mrkdwn', text: `*Escalate to*\n${ctx.mentions.join(', ')}` },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Failure scope*\nStable in-band API tests or analytics smoke audit failed. Review logs immediately before promotion.',
        },
      },
    ],
  };
}

function formatDiscordPayload(ctx) {
  const content = [
    '**❌ API Quality Gate FAILED**',
    `**Repository:** ${ctx.repo}`,
    `**Branch:** ${ctx.ref}`,
    `**Run:** ${ctx.runUrl}`,
    `**Escalate to:** ${ctx.mentions.join(', ')}`,
    '',
    'Stable in-band API tests or analytics smoke audit failed. Review workflow logs before release promotion.',
  ].join('\n');

  return { content: content.slice(0, 1900) };
}

async function postWebhook(url, payload) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Webhook failed (${response.status}): ${body}`);
  }
}

async function main() {
  const slackWebhook = process.env.SLACK_WEBHOOK_URL;
  const discordWebhook = process.env.DISCORD_WEBHOOK_URL;

  if (!slackWebhook && !discordWebhook) {
    console.log('No webhook configured. Skipping API quality gate notification.');
    process.exit(0);
  }

  const context = buildContext();
  const sent = [];

  if (slackWebhook) {
    await postWebhook(slackWebhook, formatSlackPayload(context));
    sent.push('Slack');
  }

  if (discordWebhook) {
    await postWebhook(discordWebhook, formatDiscordPayload(context));
    sent.push('Discord');
  }

  console.log(`API quality gate notification sent to: ${sent.join(', ')}`);
}

main().catch((error) => {
  console.error(`API quality gate notification failed: ${error.message}`);
  process.exit(1);
});
