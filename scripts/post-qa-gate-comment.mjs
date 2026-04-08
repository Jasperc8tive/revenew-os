#!/usr/bin/env node

/**
 * Post QA Gate Results as PR Comment
 * 
 * Reads qa-report.json and posts a formatted comment with:
 * - Gate pass/fail status
 * - Top actionable findings (up to 10)
 * - QA gate check details
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function postQaGateComment() {
  // Read environment variables
  const githubToken = process.env.GITHUB_TOKEN;
  const githubRepository = process.env.GITHUB_REPOSITORY;
  const githubPullRequestNumber = process.env.GITHUB_REF_NAME.match(/\d+/)?.[0] || process.env.GITHUB_PR_NUMBER;
  const githubEventName = process.env.GITHUB_EVENT_NAME;

  // Validate required environment variables
  if (!githubToken) {
    console.error('❌ GITHUB_TOKEN not set');
    process.exit(1);
  }

  if (!githubRepository) {
    console.error('❌ GITHUB_REPOSITORY not set');
    process.exit(1);
  }

  // Only post comments on pull_request events
  if (githubEventName !== 'pull_request') {
    console.log(`⏭️  Skipping comment: event is '${githubEventName}', only 'pull_request' supported`);
    process.exit(0);
  }

  if (!githubPullRequestNumber) {
    console.error('❌ Could not determine PR number from GITHUB_REF_NAME or GITHUB_PR_NUMBER');
    process.exit(1);
  }

  // Read qa-report.json
  const reportPath = path.join(__dirname, '../artifacts/ui-crawler/qa-report.json');
  let report;

  try {
    const reportContent = await fs.promises.readFile(reportPath, 'utf8');
    report = JSON.parse(reportContent);
  } catch (err) {
    console.error(`❌ Failed to read or parse ${reportPath}: ${err.message}`);
    process.exit(1);
  }

  // Extract gate results
  const qaGate = report.qaGate || {};
  const actionableIssues = report.actionableIssues || [];
  const issuesSummary = report.issuesSummary || {};

  // Format QA Gate status
  const gateStatus = qaGate.passed ? '✅ PASS' : '❌ FAIL';
  const gateBadge = qaGate.passed ? ':white_check_mark:' : ':x:';

  // Format gate check details
  let gateCheckDetails = '';
  if (qaGate.checks && qaGate.checks.length > 0) {
    gateCheckDetails = '\n\n### Gate Checks\n';
    for (const check of qaGate.checks) {
      const checkStatus = check.ok ? '✅' : '❌';
      const checkLine = `${checkStatus} **${check.key}**: ${check.actual} ${check.comparator} ${check.threshold}`;
      gateCheckDetails += `${checkLine}\n`;
    }
  }

  // Format top actionable findings (up to 10)
  let findingsContent = '';
  if (actionableIssues.length > 0) {
    findingsContent = '\n\n### Top Actionable Findings (up to 10)\n';
    const topFindings = actionableIssues.slice(0, 10);
    for (let i = 0; i < topFindings.length; i++) {
      const finding = topFindings[i];
      const description = finding.description || finding.type;
      const count = finding.count || 1;
      const countLabel = count > 1 ? `(${count} instances)` : '';
      findingsContent += `${i + 1}. **${finding.type}** ${countLabel}: ${description}\n`;
      if (finding.routes && finding.routes.length > 0) {
        const routeSample = finding.routes.slice(0, 2).join(', ');
        const routeLabel = finding.routes.length > 2 ? ` + ${finding.routes.length - 2} more` : '';
        findingsContent += `   Routes: \`${routeSample}\`${routeLabel}\n`;
      }
    }
  } else if (qaGate.passed) {
    findingsContent = '\n\n### Issues Summary\n';
    findingsContent += `- **Critical**: ${issuesSummary.critical || 0}\n`;
    findingsContent += `- **Medium**: ${issuesSummary.medium || 0}\n`;
    findingsContent += `- **Minor**: ${issuesSummary.minor || 0}\n`;
  }

  // Create markdown comment
  const comment = `## ${gateBadge} QA Gate ${gateStatus}
${gateCheckDetails}${findingsContent}

---
**Report**: [View full report](artifacts/ui-crawler/qa-report.json)`;

  // Post comment to GitHub API
  const [owner, repo] = githubRepository.split('/');
  const apiUrl = `https://api.github.com/repos/${githubRepository}/issues/${githubPullRequestNumber}/comments`;

  try {
    console.log(`📝 Posting QA gate comment to PR #${githubPullRequestNumber}...`);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `token ${githubToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json',
      },
      body: JSON.stringify({ body: comment }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`GitHub API error: ${response.status} ${errorBody}`);
    }

    const result = await response.json();
    console.log(`✅ Comment posted successfully! Comment ID: ${result.id}`);
    process.exit(0);
  } catch (err) {
    console.error(`❌ Failed to post comment: ${err.message}`);
    process.exit(1);
  }
}

postQaGateComment().catch(err => {
  console.error(`❌ Unexpected error: ${err.message}`);
  process.exit(1);
});
