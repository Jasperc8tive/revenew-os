# Revenew UI Crawler QA Gate Policy

This document defines CI-ready QA gate profiles for the UI crawler.

## Scripts

- `npm run qa:ui:crawl`: direct crawler run with current environment values.
- `npm run qa:ui:crawl:ci`: staging profile defaults.
- `npm run qa:ui:crawl:ci:staging`: staging profile defaults.
- `npm run qa:ui:crawl:ci:production`: production profile defaults.

All CI profile scripts are cross-platform and use `scripts/run_ui_crawl_profile.mjs`.

## Profile Defaults

### Staging

- `UI_CRAWL_GATE_ENFORCE=1`
- `UI_CRAWL_START_SERVICES=0`
- `UI_CRAWL_MAX_PAGES=30`
- `UI_CRAWL_MAX_CLICKS=14`
- `UI_CRAWL_GATE_MAX_CRITICAL=0`
- `UI_CRAWL_GATE_MAX_MEDIUM=0`
- `UI_CRAWL_GATE_MAX_AI_FAILURES=0`
- `UI_CRAWL_GATE_MAX_OUTAGE_FAILURES=0`
- `UI_CRAWL_GATE_MAX_CONTRACT_FAILURES=1`
- `UI_CRAWL_GATE_MAX_ACTIONABLE=12`
- `UI_CRAWL_GATE_MIN_PAGES=15`

### Production

- `UI_CRAWL_GATE_ENFORCE=1`
- `UI_CRAWL_START_SERVICES=0`
- `UI_CRAWL_MAX_PAGES=80`
- `UI_CRAWL_MAX_CLICKS=22`
- `UI_CRAWL_GATE_MAX_CRITICAL=0`
- `UI_CRAWL_GATE_MAX_MEDIUM=0`
- `UI_CRAWL_GATE_MAX_AI_FAILURES=0`
- `UI_CRAWL_GATE_MAX_OUTAGE_FAILURES=0`
- `UI_CRAWL_GATE_MAX_CONTRACT_FAILURES=0`
- `UI_CRAWL_GATE_MAX_ACTIONABLE=6`
- `UI_CRAWL_GATE_MIN_PAGES=20`

## Override Rules

- Any existing environment variable overrides profile defaults.
- This allows per-branch or per-pipeline tuning without code edits.

Example (override pages in staging):

```powershell
$env:UI_CRAWL_MAX_PAGES='40'; npm run qa:ui:crawl:ci:staging
```

## CI Pass/Fail Behavior

- The crawler writes gate results into `qa-report.json` under `qaGate`.
- If `qaGate.passed` is false and `qaGate.enforced` is true, process exits with code `1`.
- If `qaGate.enforced` is false, the run can complete with exit code `0` even if the gate fails.

## GitHub Actions Workflow

- Workflow file: `.github/workflows/ui-crawler-qa-gate.yml`.
- Pull requests to `main` run the staging gate profile.
- Pushes to `main` run the production gate profile.
- `workflow_dispatch` runs both jobs by default.
- Both jobs upload crawler artifacts and service logs for triage.
- Production job supports failure escalation notifications via webhooks.

### Branch Protection Setup (GitHub)

Use repository settings to require these checks on `main`:

- `UI Crawler QA Gate / qa-gate-staging`
- `UI Crawler QA Gate / qa-gate-production`

Recommended enforcement:

- Require pull request before merging
- Require status checks to pass before merging
- Restrict direct pushes to `main`

### Production Failure Escalation

On production gate failure, the workflow runs `scripts/notify-qa-gate-failure.mjs`.

- It sends a summary to Slack and/or Discord when webhooks are configured.
- It includes run URL, branch, failed gate checks, and top actionable findings.
- It routes escalation to collaboration roles based on failed checks.
- It formats Slack notifications with block sections for quick scanning.
- It formats Discord notifications with markdown and applies safe message truncation.
- If no webhook secrets are configured, it exits cleanly and skips notification.

Role routing logic:

- `critical`, `medium`, `contract-failures`, `outage-failures` → Owner + Staff + Delivery Manager
- `ai-failures`, `actionable-findings`, `min-pages-tested` → Staff + Delivery Manager
- Any other failure → Staff + Delivery Manager

Optional repository secrets:

- `UI_QA_GATE_SLACK_WEBHOOK_URL`
- `UI_QA_GATE_DISCORD_WEBHOOK_URL`
- `UI_QA_GATE_OWNER_MENTION` (example: Slack `<@U12345>`)
- `UI_QA_GATE_STAFF_MENTION`
- `UI_QA_GATE_DELIVERY_MANAGER_MENTION`

### Controlled Smoke Test (Production Failure Notifications)

Use this when you need to validate alert delivery without waiting for an organic failure.

Run steps:

1. Ensure all five `UI_QA_GATE_*` secrets above are configured in repository Actions secrets.
2. Open Actions and run `UI Crawler QA Gate` using `workflow_dispatch`.
3. Set input `smoke_test_notifications` to `true`.
4. Let the run proceed until the production job reaches `Force failure for notification smoke test`.
5. Confirm `Notify on production gate failure` executes and the run ends in failed state.

Validation criteria:

- The production job fails at the forced-failure step and does not silently pass.
- Slack receives one alert containing repository, branch, run URL, status, and failed checks.
- Discord receives one alert containing repository, branch, run URL, status, and failed checks.
- Mentions resolve according to secret values for Owner, Staff, and Delivery Manager.
- Alert payload includes actionable findings section when findings exist.
- If webhook secrets are intentionally removed, notifier logs `No webhook configured. Skipping notification.` and exits cleanly.

Rollback after smoke test:

1. Re-run workflow_dispatch with `smoke_test_notifications=false` for normal behavior.
2. Do not enable the smoke input for regular production checks.

## Automated PR Comments

When a pull request triggers the staging QA gate:

- The workflow automatically posts a comment with gate results.
- Comment includes gate status (pass/fail) and check details.
- Top 10 actionable findings are listed with sample routes.
- Script: `scripts/post-qa-gate-comment.mjs`.
- Requires: `GITHUB_TOKEN` (provided by GitHub Actions automatically).

Example comment format:

```markdown
## ✅ QA Gate PASS

### Gate Checks
✅ **critical**: 0 <= 0
✅ **medium**: 0 <= 0
...

### Top Actionable Findings (up to 10)
1. **keyboard-nav-stuck**: Found on routes: /dashboard, /settings
2. **accessibility-issue**: (3 instances) Found on routes: /products, +1 more
```

## Quick Config Check

Print resolved profile config without running a crawl:

```bash
node scripts/run_ui_crawl_profile.mjs staging --print-config
node scripts/run_ui_crawl_profile.mjs production --print-config
```
