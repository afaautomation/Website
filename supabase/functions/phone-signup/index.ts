import { createRemoteJWKSet, jwtVerify } from 'npm:jose@5.9.6';
import { phoneSignupHandler } from './handler.mjs';
const project='kompetenzen-9712d';
const keys=createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));
Deno.serve(phoneSignupHandler({
  env:(key:string)=>Deno.env.get(key)||'',
  verify:async(token:string)=>(await jwtVerify(token,keys,{algorithms:['RS256'],issuer:`https://securetoken.google.com/${project}`,audience:project})).payload
}));
