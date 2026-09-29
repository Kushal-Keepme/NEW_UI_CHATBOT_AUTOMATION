// Bot replies and error messages end up in reports; never publish anything
// that looks like a credential (e.g. a connection string pasted into a bot
// greeting, as happened on production).
export function redact(text: string): string {
    return text
        .replace(/\b[a-z][a-z0-9+.-]*:\/\/[^\s:@/]+:[^\s@/]+@[^\s"'<>]+/gi, '[REDACTED CONNECTION STRING]')
        .replace(/\b(password|passwd|pwd|secret|token|api[_-]?key)\b\s*[:=]\s*\S+/gi, '$1=[REDACTED]');
}
