import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import R from '../src/core.js';
const encoder=new TextEncoder();
const credentialsSchema=z.object({email:z.string().trim().email().max(254).transform(v=>v.toLowerCase()),password:z.string().min(8).max(128)});
const registrationSchema=credentialsSchema.extend({name:z.string().trim().min(1).max(80),confirmPassword:z.string()}).refine(v=>v.password===v.confirmPassword,{message:'As senhas precisam ser iguais.'});
const hex=bytes=>Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,'0')).join('');
const random=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
const digest=async text=>hex(await crypto.subtle.digest('SHA-256',encoder.encode(text)));
const json=(body,status=200,headers={})=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
const cookieName=request=>new URL(request.url).protocol==='https:'?'__Host-repwise_session':'repwise_session';
const tokenOf=request=>(request.headers.get('cookie')||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(cookieName(request)+'='))?.split('=')[1]||'';
const cookie=(request,token,maxAge=604800)=>`${cookieName(request)}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${new URL(request.url).protocol==='https:'?'; Secure':''}`;
export async function passwordHash(password,salt=hex(crypto.getRandomValues(new Uint8Array(16)))){
  const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
  const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-512',salt:Uint8Array.from(salt.match(/../g),v=>parseInt(v,16)),iterations:100000},key,256);
  return {scheme:'pbkdf2-sha512-100000',salt,hash:hex(bits)};
}
async function passwordMatches(password,stored){const value=JSON.parse(stored);if(value.scheme!=='pbkdf2-sha512-100000')return false;const candidate=await passwordHash(password,value.salt);return timingSafeEqual(encoder.encode(candidate.hash),encoder.encode(value.hash));}
export async function sessionUser(request,db){
  const token=tokenOf(request);if(!db||!/^[a-f0-9]{64}$/.test(token))return null;
  const account=await db.prepare('SELECT a.user_id, a.email FROM repwise_sessions s JOIN repwise_accounts a ON a.user_id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?').bind(await digest(token),Date.now()).first();
  return account?{userId:account.user_id,email:account.email}:null;
}
async function newSession(request,db,userId){
  const token=random();await db.prepare('INSERT INTO repwise_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').bind(await digest(token),userId,Date.now()+604800000).run();
  await db.prepare('DELETE FROM repwise_sessions WHERE token_hash IN (SELECT token_hash FROM repwise_sessions WHERE expires_at < ? LIMIT 50)').bind(Date.now()).run();
  return cookie(request,token);
}
async function limited(db,key,limit){
  const now=Date.now(),window=Math.floor(now/900000),hashed=await digest(`${key}:${window}`);
  const row=await db.prepare('INSERT INTO repwise_auth_attempts (key, count, expires_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = count + 1 RETURNING count').bind(hashed,(window+1)*900000).first();
  await db.prepare('DELETE FROM repwise_auth_attempts WHERE key IN (SELECT key FROM repwise_auth_attempts WHERE expires_at < ? LIMIT 50)').bind(now).run();
  return row.count>limit;
}
export async function handleAuth(request,action,db){
  if(request.method!=='POST')return json({error:'Método não permitido.'},405);
  if(request.headers.get('origin')!==new URL(request.url).origin||request.headers.get('sec-fetch-site')==='cross-site')return json({error:'Origem não autorizada.'},403);
  if(!db)return json({error:'O armazenamento está temporariamente indisponível.'},503);
  try{
    if(action==='logout'){
      const token=tokenOf(request);if(token)await db.prepare('DELETE FROM repwise_sessions WHERE token_hash = ?').bind(await digest(token)).run();
      return json({ok:true},200,{'Set-Cookie':cookie(request,'',0)});
    }
    if(!['login','register'].includes(action))return json({error:'Operação não encontrada.'},404);
    if(!(request.headers.get('content-type')||'').startsWith('application/json'))return json({error:'Envie os dados em JSON.'},415);
    const raw=await request.text();if(raw.length>4096)return json({error:'Formulário muito grande.'},413);
    let body;try{body=JSON.parse(raw);}catch{return json({error:'Formulário inválido.'},400);}
    const parsed=(action==='register'?registrationSchema:credentialsSchema).safeParse(body);
    if(!parsed.success)return json({error:action==='register'?'Preencha nome, e-mail e senha de 8 a 128 caracteres. A confirmação deve ser igual à senha.':'Informe um e-mail válido e a senha de 8 a 128 caracteres.'},422);
    const {email,password}=parsed.data;
    const ip=request.headers.get('cf-connecting-ip')||'local';
    if(await limited(db,`${action}:ip:${ip}`,action==='register'?15:50)||await limited(db,`${action}:email:${email}`,action==='register'?5:15))return json({error:'Muitas tentativas. Aguarde até 15 minutos e tente novamente.'},429,{'Retry-After':'900'});
    if(action==='register'){
      if(await db.prepare('SELECT user_id FROM repwise_credentials WHERE email = ?').bind(email).first())return json({error:'Já existe uma conta com este e-mail. Entre na sua conta.'},409);
      const userId=crypto.randomUUID(),now=new Date().toISOString(),state=R.seed(new Date(),false);state.profile.name=parsed.data.name;
      const hashed=JSON.stringify(await passwordHash(password));
      try{await db.batch([
        db.prepare('INSERT INTO repwise_accounts (user_id, email, data, revision, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)').bind(userId,email,JSON.stringify(state),now,now),
        db.prepare('INSERT INTO repwise_credentials (user_id, email, password) VALUES (?, ?, ?)').bind(userId,email,hashed)
      ]);}catch(error){if(String(error).includes('UNIQUE'))return json({error:'Já existe uma conta com este e-mail. Entre na sua conta.'},409);throw error;}
      return json({ok:true},201,{'Set-Cookie':await newSession(request,db,userId)});
    }
    const record=await db.prepare('SELECT user_id, password FROM repwise_credentials WHERE email = ?').bind(email).first();
    if(!record){await passwordHash(password,'00000000000000000000000000000000');return json({error:'E-mail ou senha inválidos.'},401);}
    if(!await passwordMatches(password,record.password))return json({error:'E-mail ou senha inválidos.'},401);
    return json({ok:true},200,{'Set-Cookie':await newSession(request,db,record.user_id)});
  }catch{return json({error:'Não foi possível acessar a conta agora. Tente novamente em instantes.'},503);}
}
