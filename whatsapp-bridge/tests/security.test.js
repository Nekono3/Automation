const {test}=require('node:test');
const assert=require('node:assert/strict');
const {authorized,validAccount,strictSession,guard}=require('../security');
test('all bridge requests require a configured bearer secret',()=>{
 const token='synthetic-token-'.repeat(4);
 assert(!authorized(undefined,token)); assert(!authorized('Bearer wrong',token));
 assert(!authorized('Bearer ','')); assert(authorized(`Bearer ${token}`,token));
});
test('missing, unknown or disconnected account never falls back to another session',()=>{
 const connected={connectionStatus:'connected'};
 const sessions=new Map([['account_1',{connectionStatus:'disconnected'}],['account_2',connected]]);
 for (const id of [undefined,'unknown','account_1']) assert.throws(()=>strictSession(sessions,id));
 assert.equal(strictSession(sessions,'account_2'),connected);
});
test('session names cannot escape auth storage',()=>{
 for(const id of ['../account_1','/tmp/x','..','a/b','<script>'])assert(!validAccount(id));
 assert(validAccount('account_1'));
});
test('guard rejects anonymous clients and rate limits authenticated traffic',()=>{
 const token='synthetic-token-'.repeat(4), middleware=guard(token,{limit:1,now:()=>60000});
 let next=0;const req={headers:{},socket:{remoteAddress:'test-peer'},path:'/send',method:'POST'};
 const res={status(code){this.code=code;return this;},json(){return this;}};
 middleware(req,res,()=>next++);assert.equal(res.code,401);assert.equal(next,0);
 req.headers.authorization=`Bearer ${token}`;
 middleware(req,res,()=>next++);assert.equal(next,1);
 middleware(req,res,()=>next++);assert.equal(res.code,429);assert.equal(next,1);
});
