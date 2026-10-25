import { whatsappOtpHandler } from './handler.mjs';
Deno.serve(whatsappOtpHandler({ env:(key:string)=>Deno.env.get(key)||'' }));
