#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const HIGH_SEVERITY_KEYS = new Set(['critical', 'medium', 'contract-failures', 'outage-failures']);
const STAFF_FOCUS_KEYS = new Set(['ai-failures', 'actionable-findings', 'min-pages-tested']);

function collectFailedCheckKeys(qaGate) {
  const keys = new Set();

  if (qaGate && Array.isArray(qaGate.checks)) {
    for (const check of qaGate.checks) {
      if (check && check.ok === false && typeof check.key === 'string' && check.key.trim()) {
        keys.add(check.key.trim());
      }
    }
  }

  if (qaGate && Array.isArray(qaGate.failures)) {
    for (const line of qaGate.failures) {
      if (typeof line !== 'string') continue;
      const idx = line.indexOf(':');
      const key = idx > 0 ? line.slice(0, idx).trim() : '';
      if (key) keys.add(key);
    }
  }

  return keys;
}

function determineEscalationTargets(failedKeys) {
  const targetRoles = new Set();

  if (failedKeys.size > 0) {
    targetRoles.add('Delivery Manager');
  }

  for (const key of failedKeys) {
    if (HIGH_SEVERITY_KEYS.has(key)) {
      targetRoles.add('Owner');
      targetRoles.add('Staff');
      continue;
    }

    if (STAFF_FOCUS_KEYS.has(key)) {
      targetRoles.add('Staff');
    }
  }

  if (failedKeys.size > 0 && !targetRoles.has('Staff') && !targetRoles.has('Owner')) {
    targetRoles.add('Staff');
  }

  return Array.from(targetRoles);
}

function resolveRoleMentions(escalationTargets) {
  const mentions = {
    'Owner': process.env.OWNER_MENTION || 'Owner',
    'Staff': process.env.STAFF_MENTION || 'Staff',
    'Delivery Manager': process.env.DELIVERY_MANAGER_MENTION || 'Delivery Manager',
  };

  return escalationTargets.map((role) => mentions[role] || role);
}

function summarizeFailures(qaGate) {
  if (!qaGate || !Array.isArray(qaGate.failures) || qaGate.failures.length === 0) {
    return 'No explicit gate failure lines were provided.';
  }
  return qaGate.failures.slice(0, 6).map((line) => `- ${line}`).join('\n');
}

function summarizeActionable(actionableIssues) {
  if (!Array.isArray(actionableIssues) || actionableIssues.length === 0) {
    return 'No actionable issues were listed in the report.';
  }

  const top = actionableIssues.slice(0, 5);
  return top
    .map((item, index) => {
      const count = item.count ?? 1;
      const desc = item.description || item.type || 'unknown';
      return `${index + 1}. ${item.type || 'issue'} (${count}): ${desc}`;
    })
    .join('\n');
}

function buildNotificationContext({ status, repo, ref, runUrl, targetMentions, failures, actionable }) {
  return {
    status,
    repo,
    ref,
    runUrl,
    targetMentions,
    failures,
    actionable,
  };
}

function formatSlackPayload(ctx) {
  const statusIcon = ctx.status === 'PASS' ? ':white_check_mark:' : ':x:';
  const title = `${statusIcon} UI QA Gate ${ctx.status} on ${ctx.repo}`;
  const fallbackText = [
    title,
    `Branch: ${ctx.ref}`,
    `Run: ${ctx.runUrl}`,
    `Escalate to: ${ctx.targetMentions.join(', ')}`,
  ].join('\n');

  return {
    text: fallbackText,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `UI QA Gate ${ctx.status}`,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Repository*\n${ctx.repo}`,
          },
          {
            type: 'mrkdwn',
            text: `*Branch*\n${ctx.ref}`,
          },
          {
            type: 'mrkdwn',
            text: `*Run*\n<${ctx.runUrl}|View workflow run>`,
          },
          {
            type: 'mrkdwn',
            text: `*Escalate to*\n${ctx.targetMentions.join(', ')}`,
          },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Gate failures*\n${ctx.failures}`,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Top actionable findings*\n${ctx.actionable}`,
        },
      },
    ],
  };
}

function formatDiscordPayload(ctx) {
  const statusIcon = ctx.status === 'PASS' ? '✅' : '❌';
  const content = [
    `**${statusIcon} UI QA Gate ${ctx.status} on ${ctx.repo}**`,
    `**Branch:** ${ctx.ref}`,
    `**Run:** ${ctx.runUrl}`,
    `**Escalate to:** ${ctx.targetMentions.join(', ')}`,
    '',
    '**Gate failures**',
    ctx.failures,
    '',
    '**Top actionable findings**',
    ctx.actionable,
  ].join('\n');

  // Discord message hard limit is 2000 chars.
  return { content: content.slice(0, 1950) };
}

async function sendSlack(webhookUrl, payload) {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Slack webhook failed (${response.status}): ${body}`);
  }
}

async function sendDiscord(webhookUrl, payload) {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Discord webhook failed (${response.status}): ${body}`);
  }
}

async function main() {
  const slackWebhook = process.env.SLACK_WEBHOOK_URL;
  const discordWebhook = process.env.DISCORD_WEBHOOK_URL;

  if (!slackWebhook && !discordWebhook) {
    console.log('No webhook configured. Skipping notification.');
    process.exit(0);
  }

  const reportPath = path.join(__dirname, '../artifacts/ui-crawler/qa-report.json');
  let report;

  try {
    report = JSON.parse(await fs.promises.readFile(reportPath, 'utf8'));
  } catch (error) {
    // Fall back to a synthetic failure report so notification still goes out.
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      report = {
        qaGate: {
          passed: false,
          failures: [`critical: qa-report-missing (${reportPath})`],
        },
        actionableIssues: [
          {
            type: 'qa-report-missing',
            count: 1,
            description: 'UI crawler did not produce artifacts/ui-crawler/qa-report.json before notification step.',
          },
        ],
      };
    } else {
      console.error(`Failed to parse report file at ${reportPath}: ${error.message}`);
      process.exit(1);
    }
  }

  const qaGate = report.qaGate || {};
  if (qaGate.passed === true) {
    console.log('QA gate passed. No escalation needed.');
    process.exit(0);
  }

  const repo = process.env.GITHUB_REPOSITORY || 'unknown-repo';
  const ref = process.env.GITHUB_REF_NAME || 'unknown-ref';
  const runId = process.env.GITHUB_RUN_ID || '';
  const serverUrl = process.env.GITHUB_SERVER_URL || 'https://github.com';
  const runUrl = runId ? `${serverUrl}/${repo}/actions/runs/${runId}` : 'N/A';

  const status = qaGate.passed ? 'PASS' : 'FAIL';
  const failures = summarizeFailures(qaGate);
  const actionable = summarizeActionable(report.actionableIssues || []);
  const failedKeys = collectFailedCheckKeys(qaGate);
  const escalationTargets = determineEscalationTargets(failedKeys);
  const targetMentions = resolveRoleMentions(escalationTargets);
  const notificationContext = buildNotificationContext({
    status,
    repo,
    ref,
    runUrl,
    targetMentions,
    failures,
    actionable,
  });

  const sentTo = [];

  if (slackWebhook) {
    await sendSlack(slackWebhook, formatSlackPayload(notificationContext));
    sentTo.push('Slack');
  }

  if (discordWebhook) {
    await sendDiscord(discordWebhook, formatDiscordPayload(notificationContext));
    sentTo.push('Discord');
  }

  console.log(`Notification sent to: ${sentTo.join(', ')}`);
}

main().catch((error) => {
  console.error(`Notification script failed: ${error.message}`);
  process.exit(1);
});
