import * as dotenv from 'dotenv';
import * as path from 'path';
import fs from 'fs';

// agentdev = dev, staging = agentstaging, prod = production.
// "dev" and "production" are accepted as aliases.
const ENV_ALIASES: Record<string, string> = { dev: 'agentdev', production: 'prod' };
const RAW_ENV = process.env.ENV || 'agentdev';
const ENV_NAME = ENV_ALIASES[RAW_ENV] ?? RAW_ENV;
const CLIENT = process.env.CLIENT;
const CRM = process.env.CRM || 'keepme';

if (!CLIENT) throw new Error('CLIENT environment variable not specified');

// Most specific first: with override:false the first file to set a key wins,
// so CRM → client → env override base. *.local.env files hold credentials,
// are gitignored, and are optional (CI passes EMAIL/PASSWORD as secrets).
// Real process env vars (CI secrets) still win over all files.
const paths = [
  path.resolve(`configs/crm/${CRM}.env`),
  path.resolve(`configs/clients/${CLIENT}.env`),
  path.resolve(`configs/env/${ENV_NAME}.local.env`),
  path.resolve(`configs/env/${ENV_NAME}.env`),
  path.resolve(`configs/env/base.local.env`),
  path.resolve(`configs/env/base.env`)
];

paths.forEach(p => {
  if (!fs.existsSync(p)) {
    if (!p.endsWith('.local.env')) console.warn(`Env file not found: ${p}`);
    return;
  }
  dotenv.config({ path: p, override: false });
});

if (!process.env.EMAIL || !process.env.PASSWORD) {
  throw new Error(
    `EMAIL/PASSWORD not set for ENV=${ENV_NAME}. Set them as environment variables (CI secrets) ` +
    `or in configs/env/${ENV_NAME}.local.env / configs/env/base.local.env (see configs/env/local.env.example).`
  );
}

export const ENV = {
  env: ENV_NAME,
  client: CLIENT,
  clientName: process.env.CLIENT_NAME!,
  crm: CRM,
  headless: process.env.HEADLESS === 'true',
  baseUrl: process.env.BASE_URL!,
  agentTrainingUrl: process.env.AGENT_TRAINING_URL!,
  email: process.env.EMAIL!,
  password: process.env.PASSWORD!,
  apiKey: process.env.API_KEY!,
  organizationId: process.env.ORGANIZATION_ID!,
  timeout: Number(process.env.TIMEOUT ?? 30000),
  retryAttempts: Number(process.env.RETRY_ATTEMPTS ?? 2),
  
  crmConfig: {
    type: process.env.CRM!,
    url: process.env.CRM_URL!,
    username: process.env.CRM_USERNAME,
    password: process.env.CRM_PASSWORD,
    location: process.env.LOCATION!,
    apiKey: process.env.CRM_API_KEY,
    apibaseurl: process.env.API_BASE_URL!,
    leadFname : process.env.LEAD_NAME,
    xclientid: process.env.XCLIENTID,
    xclientsecret: process.env.XCLIENTSECRET,
    cookie: process.env.COOKIE
  }
};
