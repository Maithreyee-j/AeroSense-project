import {spawn} from 'node:child_process';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const cases=JSON.parse(fs.readFileSync(new URL('./testcases.json',import.meta.url)));
assert.equal(cases.length,300,'testcases.json must contain exactly 300 cases');
const port=3210;
const child=spawn(process.execPath,['backend/server.js'],{env:{...process.env,PORT:String(port),JWT_SECRET:'test-secret',DATA_FILE:':memory:'},stdio:['ignore','pipe','pipe']});
let output=''; child.stdout.on('data',d=>output+=d); child.stderr.on('data',d=>output+=d);
const base=`http://127.0.0.1:${port}`;
async function wait(){for(let i=0;i<80;i++){try{const r=await fetch(base+'/api/health');if(r.ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}throw new Error('Server did not start: '+output)}
async function request(c,token){const headers={};if(c.body)headers['content-type']='application/json';if(token&&c.auth)headers.authorization='Bearer '+token;const r=await fetch(base+c.path,{method:c.method,headers,body:c.body?JSON.stringify(c.body):undefined});const text=await r.text();let data;try{data=JSON.parse(text)}catch{data=text}return {r,data};}
await wait();
let token=null;let pass=0;let fail=0;
for(const c of cases){try{const {r,data}=await request(c,token);const allowed=Array.isArray(c.expectStatus)?c.expectStatus.includes(r.status):r.status===c.expectStatus;assert.ok(allowed,`${c.id}: expected ${c.expectStatus}, got ${r.status}`);if(c.expectKey)assert.ok(data&&Object.hasOwn(data,c.expectKey),`${c.id}: missing ${c.expectKey}`);if(c.expectText)assert.match(String(data),new RegExp(c.expectText));if(c.category==='registration'&&data.token&&(!token||c.body?.email==='test1@aerosense.local'))token=data.token;if(c.category==='login'&&data.token&&c.body?.email==='test1@aerosense.local')token=data.token;pass++;console.log(`PASS ${c.id} ${c.category}`)}catch(e){fail++;console.error(`FAIL ${c.id}: ${e.message}`)}}
child.kill();console.log(`\nAeroSense 300-test run: ${pass} passed, ${fail} failed, total ${cases.length}`);process.exit(fail?1:0);

