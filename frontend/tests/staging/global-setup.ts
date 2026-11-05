import {request} from '@playwright/test';
import {readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';

export default async function setup() {
  // Once per suite, including when Playwright restarts a failed worker.
  const state = resolve(__dirname,'../../../.staging');
  const accounts = JSON.parse(readFileSync(resolve(state,'browser_accounts.json'),'utf8')) as {role:string;email:string;password:string}[];
  const api = await request.newContext({baseURL:'https://localhost:8443',ignoreHTTPSErrors:true});
  const sessions:Record<string,string> = {};
  try {
    for (const account of accounts) {
      const response = await api.post('/api/auth/login',{data:{email:account.email,password:account.password}});
      if (response.status() !== 200) throw new Error(`Staging login failed (${response.status()}); honor the configured login rate limit before retrying`);
      sessions[account.role] = (await response.json()).access_token;
    }
    writeFileSync(resolve(state,'browser_sessions.json'),JSON.stringify(sessions),{mode:0o600});
  } finally {
    await api.dispose();
  }
}
