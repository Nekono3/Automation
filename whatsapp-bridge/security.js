'use strict';
const crypto = require('node:crypto');
const validAccount = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(value);
function authorized(header, token) {
  if (!token || token.length < 32 || typeof header !== 'string') return false;
  const expected = Buffer.from(`Bearer ${token}`); const supplied = Buffer.from(header);
  return expected.length === supplied.length && crypto.timingSafeEqual(expected, supplied);
}
function strictSession(sessions, account) {
  if (!validAccount(account)) throw Object.assign(new Error('Explicit account_id required'), {status:400});
  const session = sessions.get(account);
  if (!session || session.connectionStatus !== 'connected') throw Object.assign(new Error('Requested account unavailable'), {status:503});
  return session;
}
function guard(token, {limit=120, now=Date.now}={}) {
  const buckets=new Map();
  return (req,res,next) => {
    if (!authorized(req.headers.authorization,token)) return res.status(401).json({error:'Service authentication required'});
    const epoch=Math.floor(now()/60000);
    for (const [key,value] of buckets) if (value.epoch!==epoch) buckets.delete(key);
    const key=req.socket.remoteAddress;
    const bucket=buckets.get(key)||{epoch,count:0}; bucket.count++; buckets.set(key,bucket);
    if (bucket.count>limit) return res.status(429).json({error:'Rate limit exceeded'});
    console.info(JSON.stringify({event:'bridge_request',method:req.method,path:req.path}));
    if (req.params?.sessionId && !validAccount(req.params.sessionId)) return res.status(400).json({error:'Invalid session id'});
    return next();
  };
}
module.exports={authorized,validAccount,strictSession,guard};
