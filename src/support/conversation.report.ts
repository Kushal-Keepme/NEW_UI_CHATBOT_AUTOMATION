/**
 * Chatbot conversation report → reports/result/<client>/result.html
 *
 * After every scenario attempt the hooks read the full chat history straight
 * from the chat iframe (exactly what was on screen, in order) and append it
 * here. result.html is rewritten after each attempt, so it always shows every
 * attempt of the run (e.g. a failed first try and the passing retry).
 */
import fs from 'fs';
import path from 'path';
import { Page } from '@playwright/test';
import { chatbotLocators } from '../locators/chatbot.locators';
import { redact } from '../utils/redact';

export interface ChatMessage {
    role: 'user' | 'bot';
    text: string;
}

export interface ConversationAttempt {
    scenario: string;
    attempt: number;
    status: string;          // PASSED | FAILED | ...
    error?: string;
    startedAt: string;
    finishedAt: string;
    messages: ChatMessage[];
}

interface RunInfo {
    env: string;             // agentdev | staging | prod
    client: string;
    clientName: string;
    agentTrainingUrl: string;
}

const ENV_LABEL: Record<string, { label: string; cls: string }> = {
    agentdev: { label: 'DEV', cls: 'env-dev' },
    staging: { label: 'STAGING', cls: 'env-staging' },
    prod: { label: 'PRODUCTION', cls: 'env-prod' },
};

export function resultDir(client: string): string {
    return path.join(process.cwd(), 'reports', 'result', client);
}

export function resetConversationReport(client: string): void {
    fs.rmSync(resultDir(client), { recursive: true, force: true });
    fs.mkdirSync(resultDir(client), { recursive: true });
}

/** Reads every chat bubble from the chat iframe, in on-screen order. */
export async function captureConversation(page: Page): Promise<ChatMessage[]> {
    try {
        const frame = page.frameLocator(chatbotLocators.chatbotIframe.value);
        const items = frame.locator(chatbotLocators.allMessages.value);
        if (await items.count() === 0) return [];
        const all = await items.evaluateAll(els => els.map(el => {
            const isBot = el.classList.contains('sent'); // li.sent = bot, li.replies = user
            const body = el.querySelector('#utterPara, #repliesPara') as HTMLElement | null;
            return { role: isBot ? 'bot' : 'user', text: (body ?? (el as HTMLElement)).innerText.trim() };
        })) as ChatMessage[];
        // The widget keeps empty placeholder bubbles in the DOM; skip them
        return all.filter(m => m.text !== '');
    } catch {
        return []; // chat never opened (e.g. login failed) or page already gone
    }
}

export function transcriptText(messages: ChatMessage[]): string {
    if (!messages.length) return '(no chatbot conversation — the chat was not opened)';
    return messages.map((m, i) => `${i + 1}. ${m.role === 'user' ? 'USER' : 'BOT '}: ${redact(m.text)}`).join('\n');
}

export function recordAttempt(info: RunInfo, attempt: Omit<ConversationAttempt, 'attempt'>): ConversationAttempt {
    const dir = resultDir(info.client);
    fs.mkdirSync(dir, { recursive: true });
    const jsonPath = path.join(dir, 'conversations.json');
    const attempts: ConversationAttempt[] = fs.existsSync(jsonPath)
        ? JSON.parse(fs.readFileSync(jsonPath, 'utf-8'))
        : [];

    const clean: ConversationAttempt = {
        ...attempt,
        attempt: attempts.filter(a => a.scenario === attempt.scenario).length + 1,
        error: attempt.error ? redact(attempt.error) : undefined,
        messages: attempt.messages.map(m => ({ ...m, text: redact(m.text) })),
    };
    attempts.push(clean);

    fs.writeFileSync(jsonPath, JSON.stringify(attempts, null, 2));
    fs.writeFileSync(path.join(dir, 'result.html'), renderHtml(info, attempts));
    return clean;
}

// ---------------------------------------------------------------- HTML ----

function esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtTime(iso: string): string {
    return new Date(iso).toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}

function duration(a: ConversationAttempt): string {
    const s = Math.round((Date.parse(a.finishedAt) - Date.parse(a.startedAt)) / 1000);
    return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
}

function renderAttempt(a: ConversationAttempt, isFinal: boolean): string {
    const passed = a.status === 'PASSED';
    const userCount = a.messages.filter(m => m.role === 'user').length;
    const botCount = a.messages.length - userCount;
    const bubbles = a.messages.length
        ? a.messages.map((m, i) => `
        <li class="msg ${m.role}">
          <span class="who">${m.role === 'user' ? 'Test input' : 'Bot'} · #${i + 1}</span>
          <div class="bubble">${esc(m.text).replace(/\n/g, '<br>')}</div>
        </li>`).join('')
        : `<li class="empty">No chatbot conversation — the chat was not opened in this attempt${a.error ? ' (see error above)' : ''}.</li>`;

    return `
  <section class="attempt" aria-labelledby="h-${a.attempt}">
    <header class="attempt-head">
      <h2 id="h-${a.attempt}">Attempt ${a.attempt}${isFinal ? ' <span class="final">final result</span>' : ''}</h2>
      <span class="status ${passed ? 'pass' : 'fail'}">${passed ? '✔ PASS' : '✖ FAIL'}</span>
    </header>
    <dl class="meta">
      <div><dt>Scenario</dt><dd>${esc(a.scenario)}</dd></div>
      <div><dt>Started</dt><dd>${fmtTime(a.startedAt)}</dd></div>
      <div><dt>Duration</dt><dd>${duration(a)}</dd></div>
      <div><dt>Messages</dt><dd>${userCount} sent · ${botCount} bot replies</dd></div>
    </dl>
    ${a.error ? `<div class="error" role="alert"><strong>Error</strong><pre>${esc(a.error)}</pre></div>` : ''}
    <ol class="chat">${bubbles}
    </ol>
  </section>`;
}

function renderHtml(info: RunInfo, attempts: ConversationAttempt[]): string {
    const env = ENV_LABEL[info.env] ?? { label: info.env.toUpperCase(), cls: 'env-dev' };
    const final = attempts[attempts.length - 1];
    const finalPassed = final?.status === 'PASSED';

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Chatbot Conversation · ${esc(env.label)} · ${esc(info.clientName)}</title>
<style>
  :root {
    --bg: #f6f7f9; --card: #ffffff; --text: #1b1f24; --muted: #5b6470; --line: #e3e6ea;
    --user-bg: #1f4ed8; --user-text: #ffffff; --bot-bg: #eef1f5; --bot-text: #1b1f24;
    --pass: #137333; --pass-bg: #e6f4ea; --fail: #b3261e; --fail-bg: #fce8e6;
    --dev: #188038; --staging: #1a56db; --prod: #c5221f;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #111418; --card: #1a1e24; --text: #e7eaee; --muted: #9aa4b1; --line: #2b313a;
      --user-bg: #3b6ef5; --bot-bg: #252b33; --bot-text: #e7eaee;
      --pass: #81c995; --pass-bg: #16301f; --fail: #f28b82; --fail-bg: #3a1a18;
    }
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text);
         font: 15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  .wrap { max-width: 880px; margin: 0 auto; padding: 24px 16px 48px; }
  .top { background: var(--card); border: 1px solid var(--line); border-radius: 12px; overflow: hidden; }
  .band { height: 6px; }
  .env-dev .band { background: var(--dev); } .env-staging .band { background: var(--staging); } .env-prod .band { background: var(--prod); }
  .top-body { padding: 16px 20px; display: flex; flex-wrap: wrap; gap: 12px 24px; align-items: center; justify-content: space-between; }
  h1 { font-size: 20px; margin: 0; }
  .env-tag { display: inline-block; font-size: 12px; font-weight: 700; letter-spacing: .04em; padding: 2px 8px;
             border-radius: 999px; color: #fff; margin-right: 8px; vertical-align: middle; }
  .env-dev .env-tag { background: var(--dev); } .env-staging .env-tag { background: var(--staging); } .env-prod .env-tag { background: var(--prod); }
  .sub { color: var(--muted); font-size: 13px; margin-top: 4px; word-break: break-all; }
  .note { color: var(--muted); font-size: 12px; margin: 10px 2px 0; }
  .status { font-weight: 700; font-size: 13px; padding: 4px 10px; border-radius: 999px; white-space: nowrap; }
  .status.pass { color: var(--pass); background: var(--pass-bg); } .status.fail { color: var(--fail); background: var(--fail-bg); }
  .attempt { background: var(--card); border: 1px solid var(--line); border-radius: 12px; margin-top: 20px; padding: 16px 20px; }
  .attempt-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
  h2 { font-size: 17px; margin: 0; }
  .final { font-size: 11px; font-weight: 600; color: var(--muted); border: 1px solid var(--line); border-radius: 999px; padding: 1px 8px; margin-left: 6px; vertical-align: middle; }
  .meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 8px 16px; margin: 12px 0; }
  .meta dt { font-size: 12px; color: var(--muted); } .meta dd { margin: 0; font-size: 14px; }
  .error { background: var(--fail-bg); color: var(--fail); border-radius: 8px; padding: 10px 12px; margin: 8px 0 12px; }
  .error pre { margin: 6px 0 0; white-space: pre-wrap; word-break: break-word; font: 12px/1.45 ui-monospace, Menlo, monospace; }
  .chat { list-style: none; margin: 8px 0 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
  .msg { display: flex; flex-direction: column; max-width: 78%; }
  .msg.user { align-self: flex-end; align-items: flex-end; } .msg.bot { align-self: flex-start; }
  .who { font-size: 11px; color: var(--muted); margin: 0 4px 2px; }
  .bubble { padding: 9px 13px; border-radius: 14px; white-space: normal; word-break: break-word; }
  .user .bubble { background: var(--user-bg); color: var(--user-text); border-bottom-right-radius: 4px; }
  .bot .bubble { background: var(--bot-bg); color: var(--bot-text); border-bottom-left-radius: 4px; }
  .empty { color: var(--muted); font-style: italic; }
  @media (max-width: 560px) { .msg { max-width: 92%; } }
</style>
</head>
<body class="${env.cls}">
<main class="wrap">
  <div class="top">
    <div class="band" aria-hidden="true"></div>
    <div class="top-body">
      <div>
        <h1><span class="env-tag">${esc(env.label)}</span>Chatbot conversation</h1>
        <div class="sub">Client: <strong>${esc(info.clientName)}</strong> (${esc(info.client)}) · ${attempts.length} attempt${attempts.length === 1 ? '' : 's'}</div>
        <div class="sub">${esc(info.agentTrainingUrl)}</div>
      </div>
      ${final ? `<span class="status ${finalPassed ? 'pass' : 'fail'}">Result: ${finalPassed ? '✔ PASS' : '✖ FAIL'}</span>` : ''}
    </div>
  </div>
  <p class="note">The coloured band shows the <strong>environment</strong>; the badge shows the <strong>test result</strong>.
     Right-hand blue bubbles are what the test typed; left-hand bubbles are the bot's replies, exactly as shown in the chat.</p>
  ${attempts.map((a, i) => renderAttempt(a, i === attempts.length - 1)).join('\n')}
</main>
</body>
</html>
`;
}
