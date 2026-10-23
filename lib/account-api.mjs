import { z } from 'zod';

const id = z.string().min(1).max(200).regex(/^[a-zA-Z0-9_-]+$/);
const text = z.string().max(10000);
const row = z.object({ weight:z.union([z.number().min(0).max(1000),z.literal('')]), reps:z.union([z.number().int().min(0).max(200),z.literal('')]), done:z.boolean() });
const item = z.object({exerciseId:id,sets:z.number().int().min(1).max(20),reps:z.number().int().min(0).max(200),weight:z.number().min(0).max(1000)}).passthrough();
const workout = z.object({id,name:z.string().trim().min(1).max(100),style:z.enum(['push','pull','legs']),status:z.enum(['active','draft','archived']),items:z.array(item).max(50)}).passthrough();
const session = z.object({id,name:text,startedAt:z.string().datetime(),entries:z.array(z.object({exerciseId:id,name:text,rows:z.array(row).max(20)}).passthrough()).max(50)}).passthrough();
export const stateSchema = z.object({
  version:z.literal(1),
  profile:z.object({name:z.string().trim().min(1).max(80),goal:z.enum(['Hipertrofia','Força','Condicionamento','Qualidade de vida']),level:z.enum(['Iniciante','Intermediário','Avançado']),frequency:z.number().int().min(1).max(7),duration:z.number().int().min(15).max(120),preferences:z.string().max(500)}),
  workouts:z.array(workout).max(200), sessions:z.array(session).max(2000),active:session.nullable(),
  consent:z.boolean(),aiAvailable:z.boolean(),messages:z.array(z.object({id,role:z.enum(['user','assistant']),text}).passthrough()).max(2000),
  proposals:z.array(z.object({id,workout:workout.omit({id:true,status:true}),status:z.enum(['pending','applied','rejected'])}).passthrough()).max(500),audit:z.array(z.object({type:z.string().max(100),at:z.string()}).passthrough()).max(10000)
}).strict();
const json = (data,status=200) => Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Cookie'}});
export async function handleAccount(request, user, db) {
  if (!['GET','POST','PUT'].includes(request.method)) return json({error:'Método não permitido.'},405);
  if (request.method!=='GET') {
    const origin=request.headers.get('origin');
    if (!origin || origin!==new URL(request.url).origin || request.headers.get('sec-fetch-site')==='cross-site') return json({error:'Origem não autorizada.'},403);
  }
  if (!user) return request.method==='GET'?json({user:null}):json({error:'Entre na sua conta para continuar.'},401);
  if (!db) return json({error:'O armazenamento está temporariamente indisponível.'},503);
  const identity={id:user.userId,email:user.email,name:user.fullName||''};
  try {
    if (request.method==='GET') {
      const account=await db.prepare('SELECT data, revision, updated_at FROM repwise_accounts WHERE user_id = ?').bind(user.userId).first();
      return json({user:identity,account:account?{state:JSON.parse(account.data),revision:account.revision,updatedAt:account.updated_at}:null});
    }
    if (!(request.headers.get('content-type')||'').startsWith('application/json')) return json({error:'Envie dados em JSON.'},415);
    if (Number(request.headers.get('content-length'))>2_000_000) return json({error:'Os dados excedem o limite de 2 MB. Exporte um backup.'},413);
    const raw=await request.text();
    if (new TextEncoder().encode(raw).length>2_000_000) return json({error:'Os dados excedem o limite de 2 MB. Exporte um backup.'},413);
    let body;try{body=JSON.parse(raw);}catch{return json({error:'JSON inválido.'},400);}
    const parsed=stateSchema.safeParse(body.state);
    if (!parsed.success) return json({error:'Revise os dados do perfil e dos treinos.'},422);
    const data=JSON.stringify(parsed.data),now=new Date().toISOString();
    if(request.method==='POST') {
      const result=await db.prepare('INSERT OR IGNORE INTO repwise_accounts (user_id, email, data, revision, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)').bind(user.userId,user.email,data,now,now).run();
      if (!result.meta.changes) return json({error:'Sua conta já existe. Atualize a página para entrar.'},409);
      return json({revision:1,updatedAt:now},201);
    }
    if (!Number.isSafeInteger(body.revision)||body.revision<1) return json({error:'Versão dos dados inválida.'},422);
    const result=await db.prepare('UPDATE repwise_accounts SET data = ?, email = ?, revision = revision + 1, updated_at = ? WHERE user_id = ? AND revision = ?').bind(data,user.email,now,user.userId,body.revision).run();
    if (!result.meta.changes) return json({error:'Seus dados mudaram em outro aparelho ou aba. Exporte o backup e recarregue para continuar.'},409);
    return json({revision:body.revision+1,updatedAt:now});
  } catch { return json({error:'Não foi possível acessar sua conta. Tente novamente em instantes.'},503); }
}
