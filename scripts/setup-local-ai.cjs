// Downloads public model weights once; no applicant data or AI inference API.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const dependencies = fs.existsSync(path.join(root, 'node_modules/@huggingface/transformers'))
  ? path.join(root, 'node_modules') : path.join(root, 'tmp/local-ai/node_modules');
const model = 'Xenova/all-MiniLM-L6-v2';
async function get(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(180000) });
  if (!response.ok) throw Error(`${response.status}: ${url}`);
  return response;
}
async function main() {
  const runtime = path.join(dependencies, '@huggingface/transformers/dist');
  if (!fs.existsSync(runtime)) throw Error('Install the pinned runtime first; see LOCAL_AI.md.');
  const vendor = path.join(root, 'js/vendor/local-ai');
  fs.mkdirSync(vendor, { recursive: true });
  const onnx = path.join(dependencies, 'onnxruntime-web/dist');
  const files = ['ort-wasm-simd-threaded.mjs', 'ort-wasm-simd-threaded.wasm'];
  for (const file of files) fs.copyFileSync(path.join(onnx, file), path.join(vendor, file));
  require(path.join(dependencies, 'esbuild')).buildSync({
    entryPoints: [path.join(runtime, 'transformers.web.js')],
    outfile: path.join(vendor, 'transformers.web.js'), bundle: true,
    platform: 'browser', format: 'esm', minify: true, target: 'es2022',
    // CPU/WASM only. Avoid shipping the larger unused WebGPU runtime.
    alias: { 'onnxruntime-web/webgpu': path.join(onnx, 'ort.wasm.min.mjs') }
  });
  fs.copyFileSync(path.join(dependencies, '@huggingface/transformers/LICENSE'), path.join(vendor, 'LICENSE.txt'));
  fs.copyFileSync(path.join(__dirname, 'local-ai-ONNX-LICENSE.txt'), path.join(vendor, 'ONNX-LICENSE.txt'));
  for (const obsolete of ['transformers.node.mjs', 'transformers.node.min.mjs', 'ort-wasm-simd-threaded.jsep.mjs', 'ort-wasm-simd-threaded.jsep.wasm']) {
    const target = path.join(vendor, obsolete);
    if (fs.existsSync(target)) fs.unlinkSync(target);
  }
  const lockPath = path.join(root, 'scripts/local-ai-model-lock.json');
  const lock = fs.existsSync(lockPath) ? JSON.parse(fs.readFileSync(lockPath)) : null;
  const revision = lock?.revision || (await (await get(`https://huggingface.co/api/models/${model}`)).json()).sha;
  if (!/^[a-f0-9]{40}$/.test(revision)) throw Error('Invalid model revision');
  const manifest = { model, revision, runtime: '4.3.1', files: {} };
  for (const file of ['config.json', 'tokenizer.json', 'tokenizer_config.json', 'special_tokens_map.json', 'onnx/model_quantized.onnx']) {
    const target = path.join(root, 'js/models', model, file);
    let bytes = fs.existsSync(target) ? fs.readFileSync(target) : null;
    const hash = data => crypto.createHash('sha256').update(data).digest('hex');
    if (!bytes || !lock?.files[file] || hash(bytes) !== lock.files[file]) {
      console.log('Downloading ' + file);
      bytes = Buffer.from(await (await get(`https://huggingface.co/${model}/resolve/${revision}/${file}`)).arrayBuffer());
    }
    if (lock?.files[file] && hash(bytes) !== lock.files[file]) throw Error('Checksum mismatch: ' + file);
    // Cloudflare Pages cannot publish individual assets larger than 25 MiB.
    if (bytes.length > 25 * 1024 * 1024) throw Error('Model asset exceeds Pages file limit: ' + file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bytes);
    manifest.files[file] = hash(bytes);
  }
  fs.writeFileSync(lockPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log('Local AI model and runtime installed. No inference API is configured.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
