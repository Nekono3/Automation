import {test, expect, type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const accounts = JSON.parse(readFileSync(resolve(__dirname,'../../../.staging/browser_accounts.json'),'utf8')) as {role:string;email:string;password:string}[];
const sessions:Record<string,string> = {};
const landing:Record<string,string> = {director:'/dashboard',head_of_sales:'/dashboard/leads',manager:'/dashboard/leads',mentor:'/dashboard/students',operations_director:'/dashboard/team',finance_manager:'/dashboard/finance'};
test.beforeAll(() => {
  Object.assign(sessions,JSON.parse(readFileSync(resolve(__dirname,'../../../.staging/browser_sessions.json'),'utf8')));
});
async function authenticate(page:Page, role:string) {
  await page.addInitScript(token => localStorage.setItem('token',token), sessions[role]);
}
for (const width of [1440,768,375]) for (const account of accounts) {
  test(`real staging ${account.role} navigation at ${width}px`, async ({page}) => {
    await page.setViewportSize({width,height:1000});
    const errors:string[] = []; page.on('pageerror', e => errors.push(e.message));
    const failed:string[] = []; page.on('response',r=>{if(r.url().includes('/api/')&&r.status()>=500)failed.push(new URL(r.url()).pathname);});
    await authenticate(page,account.role);
    await page.goto('/dashboard');
    await expect(page).toHaveURL(new RegExp(landing[account.role]+'$'));
    const nav = page.locator('#workspace-navigation');
    await expect(nav.locator('a[href="/dashboard/finance"]')).toHaveCount(['director','finance_manager'].includes(account.role)?1:0);
    await expect(nav.locator('a[href="/dashboard/whatsapp"]')).toHaveCount(account.role==='director'?1:0);
    await expect(page.locator('#workspace-content')).toBeVisible();
    await expect(page.getByText(/Загрузка данных|Загружаем (поступления|расписание|диалоги)/)).toHaveCount(0);
    await expect(page.locator('.data-error')).toHaveCount(0);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth+1)).toBe(true);
    expect(errors).toEqual([]); expect(failed).toEqual([]);
    if(account.role==='mentor') {
      await expect(page.getByRole('button',{name:/Синхронизировать с таблицей|Добавить студента|Финансы и оплата/})).toHaveCount(0);
    }
    await page.screenshot({path:`test-results-staging/staging-${account.role}-${width}.png`,fullPage:true});
  });
}
test('real bridge offline preserves draft and persisted failed message',async ({page})=>{
  await authenticate(page,'manager');
  await page.goto('/dashboard/conversations');
  const conversation = page.locator('.conversation-item').first();
  if (await conversation.count()) await conversation.click();
  else await page.getByText('Synthetic client 2',{exact:true}).first().click();
  const input = page.locator('#reply-message');
  await expect(input).toBeVisible();
  await input.fill('Synthetic staging delivery failure');
  const responsePromise = page.waitForResponse(r=>r.request().method()==='POST'&&/\/messages$/.test(new URL(r.url()).pathname));
  await page.getByRole('button',{name:'Отправить',exact:true}).click();
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  const message = await response.json();
  expect(message.status).toBe('failed');
  expect(response.request().headers()['idempotency-key']).toBeTruthy();
  await expect(input).toHaveValue('Synthetic staging delivery failure');
  await expect(page.getByText('Сообщение не отправлено. Текст сохранён — попробуйте ещё раз.',{exact:true})).toBeVisible();
});
test('real API denies manager finance access and foreign conversation IDs',async ({request})=>{
  const headers={Authorization:'Bearer '+sessions.manager};
  expect((await request.get('/api/company/finance/report',{headers})).status()).toBe(403);
  const directorConversations = await (await request.get('/api/conversations',{headers:{Authorization:'Bearer '+sessions.director}})).json() as {id:number;customer:{name:string}}[];
  const foreign = directorConversations.find(c=>c.customer.name==='Synthetic client 1');
  expect(foreign).toBeTruthy();
  expect((await request.get(`/api/conversations/${foreign!.id}/messages`,{headers})).status()).toBe(404);
});
test('expired stored session redirects to login', async ({page})=>{
  await page.addInitScript(()=>localStorage.setItem('token','synthetic-expired-token'));
  await page.goto('/dashboard');
  await expect(page).toHaveURL('/');
  await expect(page.locator('#email')).toBeVisible();
  expect(await page.evaluate(()=>localStorage.getItem('token'))).toBeNull();
});
test('real browser login and logout',async ({page})=>{
  const account = accounts.find(a=>a.role==='manager')!;
  await page.goto('/');
  await page.locator('#email').fill(account.email);
  await page.locator('#password').fill(account.password);
  await page.getByRole('button',{name:'Войти в пространство'}).click();
  await expect(page).toHaveURL('/dashboard/leads');
  await page.getByRole('button',{name:'Выйти из аккаунта',exact:true}).first().click();
  await expect(page).toHaveURL('/');
  expect(await page.evaluate(()=>localStorage.getItem('token'))).toBeNull();
});

test('manager creates and updates an own lead through the real UI',async({page})=>{
  await authenticate(page,'manager');
  await page.goto('/dashboard/leads');
  await page.getByRole('button',{name:'Добавить лид',exact:true}).click();
  const form=page.locator('form.company-form');
  const name='Synthetic browser lead '+Date.now();
  await form.locator('input[name="name"]').fill(name);
  await form.locator('input[name="category"]').fill('Synthetic staging');
  await form.locator('textarea[name="next_action"]').fill('Synthetic follow-up');
  await form.getByRole('button',{name:'Сохранить',exact:true}).click();
  const row=page.locator('tr').filter({hasText:name});
  await expect(row).toBeVisible();
  await row.getByRole('button',{name:'Изменить',exact:true}).click();
  await form.locator('select[name="status"]').selectOption('contacted');
  await form.getByRole('button',{name:'Сохранить',exact:true}).click();
  await expect(row).toContainText('В работе');
});
test('real mentor download is private and finance cannot retrieve it',async({request})=>{
  const director={Authorization:'Bearer '+sessions.director};
  const students=await (await request.get('/api/enrolled-students',{headers:director})).json() as {id:number;full_name:string}[];
  const student=students.find(s=>s.full_name==='Synthetic student')!;
  expect(student).toBeTruthy();
  const content=Buffer.from('%PDF-1.4\nSynthetic staging document\n%%EOF');
  const uploaded=await request.post(`/api/company/students/${student.id}/documents?name=synthetic.pdf`,{headers:{...director,'Content-Type':'application/pdf'},data:content});
  expect(uploaded.status()).toBe(201);
  const path=`/api/company/documents/${(await uploaded.json()).id}/download`;
  const allowed=await request.get(path,{headers:{Authorization:'Bearer '+sessions.mentor}});
  expect(allowed.status()).toBe(200);expect(await allowed.body()).toEqual(content);
  expect((await request.get(path,{headers:{Authorization:'Bearer '+sessions.finance_manager}})).status()).toBe(403);
  expect((await request.get(path)).status()).toBe(401);
  expect((await request.get('/uploads/synthetic.pdf')).status()).toBe(404);
});

test('mentor edits assigned process without sending protected finance fields',async({page})=>{
  await authenticate(page,'mentor');
  await page.goto('/dashboard/students');
  await expect(page.getByText(/Загрузка данных/)).toHaveCount(0);
  await page.getByRole('button',{name:'Редактировать студента',exact:true}).first().click();
  await expect(page.getByText('Финансы и оплата по договору',{exact:true})).toHaveCount(0);
  await page.getByPlaceholder('Визага кайра кирүү, Виза процесси...').fill('Synthetic mentor follow-up');
  const pending=page.waitForResponse(r=>r.request().method()==='PATCH'&&new URL(r.url()).pathname.startsWith('/api/enrolled-students/'));
  await page.getByRole('button',{name:'Сохранить изменения',exact:true}).click();
  const response=await pending;
  expect(response.status()).toBe(200);
  const payload=response.request().postDataJSON() as Record<string,unknown>;
  expect(payload).not.toHaveProperty('contract_amount');expect(payload).not.toHaveProperty('paid_amount');
  expect((await response.json()).contract_amount).toBeNull();
  await expect(page.getByText('Synthetic mentor follow-up',{exact:true})).toBeVisible();
});
