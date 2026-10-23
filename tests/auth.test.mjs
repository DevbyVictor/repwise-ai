import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {handleAuth,sessionUser} from '../lib/auth.mjs';
import {handleAccount} from '../lib/account-api.mjs';
function database(){
  const sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON');
  for(const file of readdirSync(new URL('../drizzle/',import.meta.url)).filter(v=>v.endsWith('.sql')).sort())sqlite.exec(readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));
  return {
    prepare(sql){return {bind(...args){return {
      first:async()=>sqlite.prepare(sql).get(...args)||null,
      run:async()=>({meta:{changes:sqlite.prepare(sql).run(...args).changes}})
    };}};},
    async batch(statements){sqlite.exec('BEGIN');try{const result=[];for(const statement of statements)result.push(await statement.run());sqlite.exec('COMMIT');return result;}catch(error){sqlite.exec('ROLLBACK');throw error;}}
  };
}
const form={name:'Victor',email:'victor@example.test',password:'SenhaTeste_123',confirmPassword:'SenhaTeste_123'};
const req=(body={},cookie='',origin='https://repwise.test')=>new Request('https://repwise.test/api/auth/register',{method:'POST',headers:{origin,'content-type':'application/json',cookie,'cf-connecting-ip':'192.0.2.1'},body:JSON.stringify(body)});
const cookieOf=response=>response.headers.get('set-cookie').split(';')[0];
test('cadastro salva hash, cria sessão protegida e abre uma conta vazia',async()=>{const db=database();const response=await handleAuth(req(form),'register',db);assert.equal(response.status,201);const cookie=response.headers.get('set-cookie');assert.match(cookie,/HttpOnly/);assert.match(cookie,/SameSite=Lax/);assert.match(cookie,/Secure/);const user=await sessionUser(req({},cookieOf(response)),db);assert.equal(user.email,form.email);const credential=await db.prepare('SELECT password FROM repwise_credentials WHERE email = ?').bind(form.email).first();assert.equal(credential.password.includes(form.password),false);assert.equal(JSON.parse(credential.password).hash.length,64);const account=await (await handleAccount(new Request('https://repwise.test/api/account'),user,db)).json();assert.equal(account.account.state.profile.name,'Victor');assert.equal(account.account.state.sessions.length,0);assert.equal(account.account.state.workouts.length,0);});
test('valida confirmação, impede e-mail duplicado e permite login após sair',async()=>{const db=database();assert.equal((await handleAuth(req({...form,confirmPassword:'OutraSenha'}),'register',db)).status,422);const registered=await handleAuth(req({...form,email:'VICTOR@example.test'}),'register',db);assert.equal(registered.status,201);assert.equal((await handleAuth(req(form),'register',db)).status,409);assert.equal((await handleAuth(req({...form,password:'SenhaErrada'}),'login',db)).status,401);assert.equal((await handleAuth(req({...form,email:'naoexiste@example.test'}),'login',db)).status,401);const cookie=cookieOf(registered);assert.equal((await handleAuth(req({},cookie),'logout',db)).status,200);assert.equal(await sessionUser(req({},cookie),db),null);const login=await handleAuth(req(form),'login',db);assert.equal(login.status,200);assert.equal((await sessionUser(req({},cookieOf(login)),db)).email,form.email);});
test('sessão forjada ou expirada e origem externa não autorizam acesso',async()=>{const db=database();assert.equal((await handleAuth(req(form,'','https://externo.test'),'register',db)).status,403);assert.equal(await sessionUser(req({},'__Host-repwise_session='+('a'.repeat(64))),db),null);const response=await handleAuth(req(form),'register',db);await db.prepare('UPDATE repwise_sessions SET expires_at = ?').bind(0).run();assert.equal(await sessionUser(req({},cookieOf(response)),db),null);});
test('contas distintas recebem registros separados e limites de tentativas',async()=>{const db=database();const first=await handleAuth(req(form),'register',db);const second=await handleAuth(req({...form,name:'Ana',email:'ana@example.test'}),'register',db);const ana=await sessionUser(req({},cookieOf(second)),db),victor=await sessionUser(req({},cookieOf(first)),db);assert.notEqual(ana.userId,victor.userId);assert.equal((await (await handleAccount(new Request('https://repwise.test/api/account'),ana,db)).json()).account.state.profile.name,'Ana');for(let i=0;i<15;i++)await handleAuth(req({...form,password:'SenhaErrada'}),'login',db);assert.equal((await handleAuth(req(form),'login',db)).status,429);});
