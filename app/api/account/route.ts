import { env } from 'cloudflare:workers';
import { sessionUser } from '../../../lib/auth.mjs';
import { handleAccount } from '../../../lib/account-api.mjs';
export const dynamic = 'force-dynamic';
const handle = async (request:Request) => {
  try { return await handleAccount(request,await sessionUser(request,env.DB),env.DB); }
  catch { return Response.json({error:'Não foi possível verificar sua sessão. Tente novamente.'},{status:503,headers:{'Cache-Control':'no-store'}}); }
};
export const GET=handle;
export const PUT=handle;
