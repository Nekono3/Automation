import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const catalog=JSON.parse(readFileSync(resolve(__dirname,'../../backend/migrations/initial_grants.json'),'utf8')) as {grants:Record<string,string[]>};
const landing:Record<string,string>={director:'/dashboard',head_of_sales:'/dashboard/leads',manager:'/dashboard/leads',mentor:'/dashboard/students',operations_director:'/dashboard/team',finance_manager:'/dashboard/finance'};
async function fixture(page:Page,role:string,chat=false) {
  await page.addInitScript(()=>localStorage.setItem('token','synthetic-ui-token'));
  const user={id:1,email:'synthetic@example.test',full_name:'Synthetic employee',role,is_active:true,permissions:catalog.grants[role]};
  const conversation={id:'1',customer_id:123,channel:'whatsapp',mode:'human',status:'open',priority:'normal',unread_count:0,whatsapp_account_id:1,whatsapp_account:{id:1,account_id:'account_1',name:'Synthetic account',role:'manager'},created_at:'2026-11-05T00:00:00Z',updated_at:'2026-11-05T00:00:00Z',last_message_at:'2026-11-05T00:00:00Z',customer:{id:'123',name:'Synthetic student',phone:'0000000000',tags:[]},messages:[]};
  await page.route('**/api/**',async route=>{
    const request=route.request(),path=new URL(request.url()).pathname;
    let data:unknown={};
    if(path==='/api/auth/me')data=user;
    else if(path==='/api/company/directory')data={users:[user],categories:[],countries:[]};
    else if(path==='/api/company/leads'||path==='/api/company/finance/transactions')data={total:0,items:[]};
    else if(path==='/api/company/finance/report')data={totals:[],categories:[],months:[],years:[]};
    else if(path==='/api/enrolled-students/stats')data={total_students:0,completed_count:0,in_process_count:0,countries_breakdown:{},stages_breakdown:{},managers_breakdown:{},risks_breakdown:{}};
    else if(path==='/api/dashboard/stats')data={open_conversations:0,ai_conversations:0,human_conversations:0,pending_bookings:0,total_customers:0,total_bookings:0};
    else if(path==='/api/conversations/global-ai')data={global_mode:'human',global_ai_whatsapp:false,global_ai_instagram:false,total_open:0,ai_open:0,human_open:0,paused_open:0};
    else if(path==='/api/conversations')data=chat?[conversation]:[];
    else if(path==='/api/conversations/1/messages')data=request.method()==='POST'?{id:1,conversation_id:1,text:(request.postDataJSON() as {text:string}).text,status:'failed',sender_type:'employee',direction:'outbound',created_at:'2026-11-05T00:00:00Z'}:[];
    else if(path.endsWith('/profile'))data=null;
    else if(path==='/api/customers/123')data=conversation.customer;
    else data=[];
    await route.fulfill({json:data});
  });
}
for(const width of [1440,768,375])for(const role of Object.keys(landing)) {
  test(`${role} landing and permission menu at ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:1000});
    const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
    await fixture(page,role);
    await page.goto('/dashboard');
    await expect(page).toHaveURL(new RegExp(landing[role]+'$'));
    const nav=page.locator('#workspace-navigation');
    await expect(nav.locator('a[href="/dashboard/finance"]')).toHaveCount(['director','finance_manager'].includes(role)?1:0);
    await expect(nav.locator('a[href="/dashboard/whatsapp"]')).toHaveCount(role==='director'?1:0);
    await expect(nav.locator('a[href="/dashboard/automations"]')).toHaveCount(role==='director'?1:0);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
    expect(errors).toEqual([]);
  });
}
test('a failed send preserves the draft and displays an error',async({page})=>{
  await fixture(page,'director',true);
  await page.goto('/dashboard/conversations?customer_id=123');
  const input=page.locator('#reply-message');
  await expect(input).toBeVisible();
  await input.fill('Synthetic unsent message');
  await page.getByRole('button',{name:'Отправить',exact:true}).click();
  await expect(input).toHaveValue('Synthetic unsent message');
  await expect(page.getByText('Сообщение не отправлено. Текст сохранён — попробуйте ещё раз.',{exact:true})).toBeVisible();
});
test('mobile navigation opens by keyboard and Escape restores the trigger',async({page})=>{
  await page.setViewportSize({width:375,height:1000});
  await fixture(page,'manager');
  await page.goto('/dashboard/leads');
  const trigger=page.getByRole('button',{name:'Открыть навигацию',exact:true});
  await trigger.focus();await page.keyboard.press('Enter');
  await expect(trigger).toHaveAttribute('aria-expanded','true');
  await page.keyboard.press('Escape');
  await expect(trigger).toHaveAttribute('aria-expanded','false');
  await expect(trigger).toBeFocused();
});

test('session expiration during an API request returns to login',async({page})=>{
  await fixture(page,'manager');
  await page.route('**/api/company/leads?**',route=>route.fulfill({status:401,json:{detail:'Expired session'}}));
  await page.goto('/dashboard/leads');
  await expect(page).toHaveURL('/');
  expect(await page.evaluate(()=>localStorage.getItem('token'))).toBeNull();
});
test('network timeout keeps the unsent draft and reports failure',async({page})=>{
  await fixture(page,'director',true);
  await page.route('**/api/conversations/1/messages',route=>route.request().method()==='POST'?route.abort('timedout'):route.fulfill({json:[]}));
  await page.goto('/dashboard/conversations?customer_id=123');
  const input=page.locator('#reply-message');
  await input.fill('Synthetic timed out message');
  await page.getByRole('button',{name:'Отправить',exact:true}).click();
  await expect(input).toHaveValue('Synthetic timed out message');
  await expect(page.locator('p.form-error[role="alert"]')).toBeVisible();
});
test('Russian and Kyrgyz security dictionaries cover all roles',async()=>{
  const {securityText}=await import('../src/i18n/security');
  for(const locale of ['ru','ky'] as const){
    expect(Object.keys(securityText[locale].roles).sort()).toEqual(Object.keys(landing).sort());
    expect(securityText[locale].deliveryFailed.length).toBeGreaterThan(20);
    expect(securityText[locale].denied.length).toBeGreaterThan(10);
  }
});
