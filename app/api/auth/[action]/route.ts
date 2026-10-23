import { env } from 'cloudflare:workers';
import { handleAuth } from '../../../../lib/auth.mjs';
export const dynamic='force-dynamic';
export async function POST(request:Request,{params}:{params:Promise<{action:string}>}){
  return handleAuth(request,(await params).action,env.DB);
}
