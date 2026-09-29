/**
 * Summarises cucumber JSON results per environment.
 *
 *  - prints a colour-coded banner to the terminal (ANSI; always paired with
 *    PASS/FAIL text so it doesn't rely on colour alone)
 *  - appends a markdown dashboard to $GITHUB_STEP_SUMMARY when running in
 *    GitHub Actions
 *  - writes reports/summary/<env>.json (consumed by the Slack notifier)
 *  - posts to Slack when --slack is passed and SLACK_WEBHOOK_URL is set
 *
 * Usage:
 *   ts-node scripts/ci-summary.ts dev=testDemoClientDev staging=demoAccountStaging
 *   ts-node scripts/ci-summary.ts            # uses ENV + CLIENT env vars
 *   ts-node scripts/ci-summary.ts --slack --fail-on-failure dev=testDemoClientDev
 *
 * Environment keys: dev | staging | prod
 */
import fs from 'fs';
import path from 'path';
import axios from 'axios';

type EnvKey = 'dev' | 'staging' | 'prod';
type Status = 'PASS' | 'FAIL' | 'NO RESULTS';

interface EnvResult {
    env: EnvKey;
    client: string;
    status: Status;
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    durationMs: number;
    failures: { scenario: string; step: string; error: string }[];
}

const ENV_META: Record<EnvKey, { label: string; icon: string; ansi: string }> = {
    dev: { label: 'DEV', icon: '🟢', ansi: '\x1b[32m' },
    staging: { label: 'STAGING', icon: '🔵', ansi: '\x1b[34m' },
    prod: { label: 'PRODUCTION', icon: '🔴', ansi: '\x1b[31m' },
};
const ENV_ALIASES: Record<string, EnvKey> = {
    dev: 'dev', agentdev: 'dev', staging: 'staging', prod: 'prod', production: 'prod',
};
const STATUS_ICON: Record<Status, string> = { PASS: '🟢', FAIL: '🔴', 'NO RESULTS': '🟡' };
const STATUS_ANSI: Record<Status, string> = { PASS: '\x1b[32m', FAIL: '\x1b[31m', 'NO RESULTS': '\x1b[33m' };
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

// Bot replies end up in error messages; never publish anything that looks
// like a credential (e.g. a connection string pasted into a bot greeting).
function redact(text: string): string {
    return text
        .replace(/\b[a-z][a-z0-9+.-]*:\/\/[^\s:@/]+:[^\s@/]+@[^\s"'<>]+/gi, '[REDACTED CONNECTION STRING]')
        .replace(/\b(password|passwd|pwd|secret|token|api[_-]?key)\b\s*[:=]\s*\S+/gi, '$1=[REDACTED]');
}

function formatDuration(ms: number): string {
    const totalSeconds = Math.round(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function summarise(env: EnvKey, client: string): EnvResult {
    const file = path.join(process.cwd(), 'reports', 'cucumber', client, `${client}.json`);
    const result: EnvResult = {
        env, client, status: 'NO RESULTS', total: 0, passed: 0, failed: 0, skipped: 0, durationMs: 0, failures: [],
    };
    if (!fs.existsSync(file)) return result;

    let features: any[] = [];
    try {
        features = JSON.parse(fs.readFileSync(file, 'utf-8'));
    } catch {
        return result;
    }

    for (const feature of features) {
        for (const scenario of feature.elements ?? []) {
            if (scenario.type && scenario.type !== 'scenario') continue;
            const steps: any[] = scenario.steps ?? [];
            result.total++;
            result.durationMs += steps.reduce((sum, s) => sum + (s.result?.duration ?? 0), 0) / 1e6;

            const failedStep = steps.find(s => s.result?.status === 'failed');
            if (failedStep) {
                result.failed++;
                const firstLine = String(failedStep.result?.error_message ?? '').split('\n')[0];
                result.failures.push({
                    scenario: scenario.name,
                    step: `${failedStep.keyword ?? ''}${failedStep.name ?? ''}`.trim(),
                    error: redact(firstLine).slice(0, 300),
                });
            } else if (steps.length > 0 && steps.every(s => ['passed'].includes(s.result?.status))) {
                result.passed++;
            } else {
                result.skipped++;
            }
        }
    }

    result.status = result.failed > 0 ? 'FAIL' : result.total > 0 && result.passed > 0 ? 'PASS' : 'NO RESULTS';
    return result;
}

function printConsole(r: EnvResult): void {
    const meta = ENV_META[r.env];
    const line = '─'.repeat(40);
    console.log('');
    console.log(`${meta.ansi}${BOLD}${meta.icon} ${meta.label}${RESET}`);
    console.log(line);
    console.log(`Environment: ${meta.ansi}${meta.label}${RESET}   Client: ${r.client}`);
    console.log(`Status:      ${STATUS_ANSI[r.status]}${BOLD}${r.status}${RESET}`);
    console.log(`Tests:       ${r.total}`);
    console.log(`Passed:      \x1b[32m${r.passed}${RESET}`);
    console.log(`Failed:      ${r.failed > 0 ? '\x1b[31m' : ''}${r.failed}${RESET}`);
    console.log(`Skipped:     ${r.skipped > 0 ? '\x1b[33m' : ''}${r.skipped}${RESET}`);
    console.log(`Duration:    ${formatDuration(r.durationMs)}`);
    for (const f of r.failures) {
        console.log(`\x1b[31m  ✖ FAIL${RESET} ${f.scenario} → ${f.step}`);
        console.log(`      ${f.error}`);
    }
    console.log(line);
}

function runUrl(): string | undefined {
    const { GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID } = process.env;
    if (!GITHUB_SERVER_URL || !GITHUB_REPOSITORY || !GITHUB_RUN_ID) return undefined;
    return `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`;
}

function markdown(results: EnvResult[]): string {
    const url = runUrl();
    const e = process.env;
    const out: string[] = [];
    out.push('# QA Automation Results', '');
    out.push('> **Environment colour ≠ test result.** 🟢 DEV / 🔵 STAGING / 🔴 PRODUCTION identify the *environment*; ' +
        'the **Status** column (🟢 PASS / 🔴 FAIL / 🟡 NO RESULTS) is the *test result*.', '');
    out.push('| Environment | Client | Status | Tests | Passed | Failed | Skipped | Duration |');
    out.push('|-------------|--------|--------|-------|--------|--------|---------|----------|');
    for (const r of results) {
        const m = ENV_META[r.env];
        out.push(`| ${m.icon} ${m.label} | ${r.client} | ${STATUS_ICON[r.status]} **${r.status}** | ${r.total} | ${r.passed} | ${r.failed} | ${r.skipped} | ${formatDuration(r.durationMs)} |`);
    }
    out.push('');

    const failures = results.flatMap(r => r.failures.map(f => ({ ...f, env: ENV_META[r.env].label })));
    if (failures.length) {
        out.push('## ❌ Failed tests', '');
        for (const f of failures) {
            out.push(`- **${f.env}** — ${f.scenario} → \`${f.step}\``);
            out.push(`  <br><sub>${f.error.replace(/[<>|]/g, ' ')}</sub>`);
        }
        out.push('');
    }

    out.push('## Run details', '');
    out.push('| | |', '|---|---|');
    out.push(`| Branch | \`${e.GITHUB_REF_NAME ?? 'local'}\` |`);
    out.push(`| Commit | \`${(e.GITHUB_SHA ?? 'local').slice(0, 7)}\` |`);
    out.push(`| Triggered by | ${e.GITHUB_ACTOR ?? 'local'} (${e.GITHUB_EVENT_NAME ?? 'manual'}) |`);
    out.push(`| Suite (tags) | \`${e.TAGS ?? '@controlcentre'}\` |`);
    out.push('| Browser | Chromium (headless) |');
    out.push(`| Summary generated | ${new Date().toISOString()} |`);
    if (url) {
        out.push(`| Run | [GitHub Actions run](${url}) |`);
        out.push(`| Artifacts | [HTML report, screenshots, videos, traces, logs](${url}#artifacts) |`);
    }
    out.push('');
    out.push('<sub>Debug a failure: download the `<env>-artifacts` bundle → open `reports/html/<client>/index.html`; ' +
        'traces: `npx playwright show-trace traces/<client>/trace-*.zip`.</sub>', '');
    return out.join('\n');
}

function slackText(results: EnvResult[]): string {
    const anyFail = results.some(r => r.status !== 'PASS');
    const url = runUrl();
    const lines = [anyFail ? '🔴 *QA AUTOMATION FAILED*' : '🟢 *QA AUTOMATION PASSED*', ''];
    for (const r of results) {
        const m = ENV_META[r.env];
        lines.push(`${m.icon} *${m.label}* — ${STATUS_ICON[r.status]} ${r.status}`);
        lines.push(`Client: ${r.client} | Passed: ${r.passed} | Failed: ${r.failed} | Skipped: ${r.skipped} | Duration: ${formatDuration(r.durationMs)}`);
        for (const f of r.failures) lines.push(`❌ ${f.scenario} → ${f.step}`);
        lines.push('');
    }
    if (url) lines.push(`🔗 <${url}|GitHub Actions run>   🔗 <${url}#artifacts|Report & artifacts>`);
    return lines.join('\n');
}

async function main(): Promise<void> {
    const args = process.argv.slice(2);
    const flags = new Set(args.filter(a => a.startsWith('--')));
    let pairs = args.filter(a => !a.startsWith('--')).map(a => a.split('='));
    if (pairs.length === 0 && process.env.ENV && process.env.CLIENT) {
        pairs = [[process.env.ENV, process.env.CLIENT]];
    }
    if (pairs.length === 0) {
        console.error('Usage: ts-node scripts/ci-summary.ts <env>=<client> [...] [--slack] [--fail-on-failure]');
        process.exit(1);
    }

    const results = pairs.map(([envArg, client]) => {
        const env = ENV_ALIASES[envArg];
        if (!env || !client) throw new Error(`Invalid argument "${envArg}=${client}" (env must be dev|staging|prod)`);
        return summarise(env, client);
    });

    results.forEach(printConsole);

    // Surface each failure as a GitHub annotation so it shows on the run page
    // (and via the API) without opening the logs. Error text is already redacted.
    if (process.env.GITHUB_ACTIONS) {
        for (const r of results) {
            for (const f of r.failures) {
                const msg = `${f.step}: ${f.error}`.replace(/%/g, '%25').replace(/\r?\n/g, ' ');
                console.log(`::error title=${ENV_META[r.env].label} · ${f.scenario}::${msg}`);
            }
        }
    }

    const outDir = path.join(process.cwd(), 'reports', 'summary');
    fs.mkdirSync(outDir, { recursive: true });
    for (const r of results) fs.writeFileSync(path.join(outDir, `${r.env}.json`), JSON.stringify(r, null, 2));

    if (process.env.GITHUB_STEP_SUMMARY) {
        fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown(results) + '\n');
    }

    if (flags.has('--slack')) {
        const webhook = process.env.SLACK_WEBHOOK_URL;
        if (!webhook) {
            console.log('\x1b[33mWARNING\x1b[0m SLACK_WEBHOOK_URL not set — skipping Slack notification');
        } else {
            await axios.post(webhook, { text: slackText(results) })
                .then(() => console.log('Slack notification sent'))
                .catch(err => console.log(`\x1b[33mWARNING\x1b[0m Slack notification failed: ${err.message}`));
        }
    }

    if (flags.has('--fail-on-failure') && results.some(r => r.status !== 'PASS')) process.exit(1);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
