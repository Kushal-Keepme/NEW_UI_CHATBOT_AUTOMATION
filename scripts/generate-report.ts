import { generate } from 'multiple-cucumber-html-reporter';
import path from 'path';
import fs from 'fs';
import open from "open";

const client = process.env.CLIENT || 'report';
// Each client's cucumber JSON lives in its own folder so the reporter
// doesn't pick up probe JSON files (or other clients) from reports/.
const jsonDir = path.join(process.cwd(), 'reports', 'cucumber', client);
const jsonReportPath = path.join(jsonDir, `${client}.json`);
const htmlReportDir = path.join(process.cwd(), 'reports', 'html', client === 'report' ? 'default' : client);

if (!fs.existsSync(jsonReportPath)) {
    console.warn(`No JSON report found at ${jsonReportPath}`);
    process.exit(0);
}

console.log(`Generating HTML report for client: ${client}...`);

generate({
    jsonDir,
    reportPath: htmlReportDir,
    metadata: {
        browser: { name: 'chromium', version: 'latest' },
        device: 'Local / CI',
        platform: { name: process.platform, version: process.version },
    },
    customData: {
        title: 'Execution Info',
        data: [
            { label: 'Project', value: 'Palm Mind Chatbot' },
            { label: 'Client', value: client },
            { label: 'Environment', value: process.env.ENV || 'local' },
            { label: 'Executed At', value: new Date().toLocaleString() },
        ],
    },
});

async function openReport() {
    console.log(`HTML report generated at: ${htmlReportDir}`);
    const reportUrl = `${htmlReportDir}//index.html`;
    console.log("Final report url:", reportUrl);
    // No browser on CI runners — the report is uploaded as an artifact instead
    if (process.env.CI) return;
    await open(reportUrl);
}

openReport();