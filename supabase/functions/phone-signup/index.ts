import { phoneSignupHandler } from './handler.mjs';
Deno.serve(phoneSignupHandler({ env:(key:string)=>Deno.env.get(key)||'' }));
