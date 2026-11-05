'use strict';
const {test, before, after} = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
process.env.BRIDGE_API_TOKEN = crypto.randomBytes(48).toString('hex');
process.env.BRIDGE_WEBHOOK_TOKEN = crypto.randomBytes(48).toString('hex');
process.env.AUTH_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'consulteam-bridge-test-'));
process.env.BRIDGE_AUTO_START = 'false';
const {app, sessions} = require('../server');
let server, base;
before(async () => {
  server = await new Promise(resolve => {const s = app.listen(0, '127.0.0.1', () => resolve(s));});
  base = 'http://127.0.0.1:'+server.address().port;
});
after(async () => {
  await new Promise(resolve => server.close(resolve));
  fs.rmSync(process.env.AUTH_DIR, {recursive: true, force: true});
});
const headers = () => ({Authorization:'Bearer '+process.env.BRIDGE_API_TOKEN, 'Content-Type':'application/json'});
const send = body => fetch(base+'/send', {method:'POST', headers:headers(), body:JSON.stringify(body)});

test('actual HTTP endpoints deny missing, wrong and callback credentials', async () => {
  for (const route of ['/api/sessions', '/qr', '/status', '/']) {
    for (const token of ['', 'wrong', process.env.BRIDGE_WEBHOOK_TOKEN]) {
      assert.equal((await fetch(base+route, {headers:{Authorization:'Bearer '+token}})).status, 401);
    }
  }
  for (const route of ['/send', '/api/sessions/start', '/api/sessions/account_1/logout', '/api/sessions/account_1/restart']) {
    assert.equal((await fetch(base+route, {method:'POST', headers:{'Content-Type':'application/json'}, body:'{}'})).status, 401);
  }
});

test('real send route selects exactly account_1, account_2 and account_3', async () => {
  const calls = [];
  sessions.clear();
  for (const account of ['account_1','account_2','account_3']) {
    sessions.set(account, {connectionStatus:'connected', sendMessage:async () => {
      calls.push(account); return {session_id:account, message_id:'synthetic-'+account};
    }});
  }
  for (const account of sessions.keys()) {
    const r = await send({to:'00000',text:'Synthetic',account_id:account});
    assert.equal(r.status, 200); assert.equal((await r.json()).session_id, account);
  }
  assert.deepEqual(calls, ['account_1','account_2','account_3']);
  sessions.get('account_1').connectionStatus = 'disconnected';
  assert.equal((await send({to:'00000',text:'Synthetic',account_id:'account_1'})).status, 503);
  assert.equal(calls.length, 3);
  for (const account_id of [undefined, '../account_2', 'unknown']) {
    assert.ok([400,503].includes((await send({to:'00000',text:'Synthetic',account_id})).status));
  }
  assert.equal(calls.length, 3);
});

test('provider exceptions are sanitized and never fall through to another account', async () => {
  let otherCalls = 0;
  sessions.clear();
  sessions.set('account_1', {connectionStatus:'connected',sendMessage:async () => {throw new Error(process.env.BRIDGE_API_TOKEN);}});
  sessions.set('account_2', {connectionStatus:'connected',sendMessage:async () => {otherCalls++;}});
  const r = await send({to:'00000',text:'Synthetic',account_id:'account_1'});
  assert.equal(r.status, 502);
  assert.equal((await r.text()).includes(process.env.BRIDGE_API_TOKEN), false);
  assert.equal(otherCalls, 0);
});

test('invalid session paths and oversized JSON are rejected before session operations', async () => {
  assert.equal((await fetch(base+'/api/sessions/%2E%2E%2Fescape/restart', {method:'POST',headers:headers(),body:'{}'})).status, 400);
  assert.equal((await send({to:'00000',text:'x'.repeat(300*1024),account_id:'account_1'})).status, 413);
});
