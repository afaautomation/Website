import { env, pipeline } from './vendor/local-ai/transformers.web.js';
import { MODEL_ID, scoreProfile } from './local-ai-core.mjs';
import { semanticReview } from './applicant-agent.mjs';

const localFetch = self.fetch.bind(self);
self.fetch = (input, options) => {
  const url = new URL(typeof input === 'string' ? input : input.url, self.location.href);
  if (url.origin !== self.location.origin) throw Error('External network access is disabled for local AI.');
  return localFetch(input, options);
};
env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = '/js/models/';
env.backends.onnx.wasm.wasmPaths = {
  mjs: '/js/vendor/local-ai/ort-wasm-simd-threaded.mjs',
  wasm: '/js/vendor/local-ai/ort-wasm-simd-threaded.wasm'
};
env.backends.onnx.wasm.numThreads = 1;
env.backends.onnx.wasm.proxy = false;
let extractor;
const cache = new Map();
async function embed(text) {
  if (!cache.has(text)) {
    const tensor = await extractor(text, { pooling: 'mean', normalize: true });
    if (cache.size >= 2048) cache.delete(cache.keys().next().value);
    cache.set(text, Array.from(tensor.data));
  }
  return cache.get(text);
}
let queue=Promise.resolve();
self.onmessage = ({data}) => { queue=queue.then(()=>handle(data)); };
async function handle(data) {
  try {
    if(data.type==='agent-review') {
      self.postMessage({type:'status',taskId:data.taskId,text:'Local AI is comparing related skill evidence…'});
      extractor ||= await pipeline('feature-extraction',MODEL_ID,{dtype:'q8',device:'wasm',local_files_only:true});
      const results=await semanticReview(data.items,embed);
      self.postMessage({type:'agent-complete',taskId:data.taskId,results});
      return;
    }
    if (data.type !== 'score') return;
    self.postMessage({ type: 'status', text: 'Loading the local AI model…' });
    extractor ||= await pipeline('feature-extraction', MODEL_ID, { dtype: 'q8', device: 'wasm',
      local_files_only: true });
    const results = [];
    for (let i = 0; i < data.applicants.length; i++) {
      const applicant = data.applicants[i];
      results.push({ id: applicant.id, result: await scoreProfile(data.rules, applicant.evidence, embed) });
      self.postMessage({ type: 'status', text: `AI reviewed ${i + 1} of ${data.applicants.length} applicants…` });
    }
    self.postMessage({ type: 'complete', results });
  } catch (error) {
    if(data.type==='agent-review') {
      self.postMessage({type:'agent-error',taskId:data.taskId,message:'Local AI comparison unavailable: '+error.message});return;
    }
    self.postMessage({ type: 'error', message: 'Local model could not run. Check that its files are installed. ' + error.message });
  }
}
