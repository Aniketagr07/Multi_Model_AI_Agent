# Root Cause Diagnosis & Resolution: Qwen2.5-1.5B In-Browser Download Failure

**Date:** 2026-11-03  
**Target Architecture:** OmniAI Single-Page Application (Cloudflare Workers Static Assets)  
**WebLLM Version:** `@mlc-ai/web-llm` 0.2.87  
**Model:** Qwen2.5-1.5B-Instruct-q4f16_1-MLC (WebLLM / WebGPU)  
**Live Frontend:** `https://omniai.aniket-agr2007.workers.dev/`  
**Repository:** [Multi_Model_AI_Agent](https://github.com/Aniketagr07/Multi_Model_AI_Agent)  

---

## 1. Executive Summary & Root Cause

The persistent initialization failure of local **Qwen2.5-1.5B** on the deployed website had two interconnected root causes:

1. **W3C Cache API Redirect Prohibition (`response.redirected === true` rejection)**:
   - WebLLM's `ArtifactCache` downloads model parameter shards (`params_shard_0.bin` through `params_shard_29.bin`, totaling ~850 MB) by invoking `this.cache.add(request)`.
   - Hugging Face responds with `HTTP 302 Found`, redirecting cross-origin to AWS CloudFront storage on `https://us.aws.cdn.hf.co/...`.
   - While the destination returns `HTTP 200 OK` with CORS header `access-control-allow-origin: *`, the resulting response has `response.redirected = true`.
   - The WHATWG Cache API specification dictates that `cache.put(req, res)` or `cache.add(req)` **must reject with a `TypeError` when passed a response that underwent a redirect chain**.
   - Because of this, both native `cache.add()` and un-sanitized `cache.put()` failed inside browser engines, causing WebLLM to throw `Cannot fetch https://huggingface.co/.../params_shard_*.bin`.
2. **Error Message Masking & Generic Collapsing**:
   - `categorizeDownloadError` was catching all `Cannot fetch` / `Failed to fetch` errors and mapping them to a hardcoded generic string `"Unable to download model shards from Hugging Face or CDN"`, hiding the actual failed request URL, HTTP status code, and exception name.

---

## 2. Complete Initialization Flow & Network Request Trace

Every network request during Qwen2.5-1.5B loading was verified using live HTTP traces:

```
[1. Model Config]  GET https://huggingface.co/mlc-ai/Qwen2.5-1.5B-Instruct-q4f16_1-MLC/resolve/main/mlc-chat-config.json
                   --> HTTP 307 Temporary Redirect
                   --> Location: /api/resolve-cache/models/.../mlc-chat-config.json
                   --> HTTP 200 OK (2,043 bytes, ACAO: https://omniai.aniket-agr2007.workers.dev)

[2. WASM Library]  GET https://cdn.jsdelivr.net/gh/mlc-ai/binary-mlc-llm-libs@main/web-llm-models/v0_2_87/base/Qwen2-1.5B-Instruct-q4f16_1_cs1k-webgpu.wasm
                   --> HTTP 200 OK (741,822 bytes, ACAO: *)
                   --> Compiled via WebAssembly.instantiate()

[3. GPU Device]    WebGPU device detection & adapter initialization
                   --> Device initialized (ShaderF16 / FP16 verified)

[4. Tokenizer]     GET https://huggingface.co/mlc-ai/Qwen2.5-1.5B-Instruct-q4f16_1-MLC/resolve/main/tokenizer.json
                   --> HTTP 307 Temporary Redirect
                   --> HTTP 200 OK (7.03 MB, ACAO: https://omniai.aniket-agr2007.workers.dev)

[5. Tensor Cache]  GET https://huggingface.co/mlc-ai/Qwen2.5-1.5B-Instruct-q4f16_1-MLC/resolve/main/tensor-cache.json
                   --> HTTP 307 Temporary Redirect
                   --> HTTP 200 OK (124 KB, 30 shard records)

[6. 30 Shards]     GET https://huggingface.co/mlc-ai/Qwen2.5-1.5B-Instruct-q4f16_1-MLC/resolve/main/params_shard_[0-29].bin
                   --> HTTP 302 Found
                   --> Location: https://us.aws.cdn.hf.co/xet-bridge-us/...
                   --> HTTP 200 OK (Streamed binary, ACAO: *)
                   --> Cached into IndexedDB / Cache Storage
```

---

## 3. WebLLM Compatibility Verification

- **Package Version**: `@mlc-ai/web-llm` `0.2.87` (verified in `package.json`).
- **Configured Model ID**: `Qwen2.5-1.5B-Instruct-q4f16_1-MLC` (official prebuilt model in WebLLM v0.2.87).
- **WebGPU Library URL**: Points to `Qwen2-1.5B-Instruct-q4f16_1_cs1k-webgpu.wasm` hosted on `cdn.jsdelivr.net` (with secondary fallbacks on `fastly.jsdelivr.net` and `gcore.jsdelivr.net`).
- **Compatibility**: **100% Compatible**. The `qwen2` model architecture, quantization layout (`q4f16_1`), and 4096-token context window match the compiled WebGPU library.

---

## 4. Exact Fixes Implemented

### 4.1 Native IndexedDB Binary Cache (`frontend/src/services/localInference.js`)
WebLLM contains a built-in `ArtifactIndexedDBCache` backend that downloads model shards via standard `fetch(request)` and writes the ArrayBuffers directly into IndexedDB (`webllm/model`).
- Standard `fetch()` natively follows all HTTP 302 redirects to `us.aws.cdn.hf.co` without Cache API redirect restrictions.
- IndexedDB has no cross-origin redirect prohibitions.
- In `buildWebLLMAppConfig`, `cacheBackend: 'indexeddb'` is now configured as the primary storage engine for attempts 1 and 2.

### 4.2 Sanitized Response Cache Polyfill (`frontend/src/services/localInference.js`)
For attempt 3 (Cache Storage fallback):
- Intercepts `Cache.prototype.add`.
- Fetches the resource with `fetch(new Request(reqUrl, { mode: 'cors', credentials: 'omit', signal }))`.
- **Strips the redirect taint**: Creates a clean `new Response(response.body, { status, statusText, headers })`, ensuring `cleanResponse.redirected === false`.
- Commits to Cache Storage via `cache.put(reqUrl, cleanResponse)` without throwing `TypeError`.

### 4.3 Detailed Diagnostic Error Reporting (`frontend/src/services/localInference.js` & `LocalModelModal.jsx`)
- `categorizeDownloadError` no longer masks errors with a generic sentence. It extracts and displays:
  - Exact exception class and message (`[TypeError] Cannot fetch ...`).
  - Target URL that failed.
  - HTTP status code (if applicable).
- In `LocalModelModal.jsx`, the error banner displays the exact exception, target URL, and full diagnostics in a monospace selectable container.

### 4.4 Multi-Engine Cache Reset (`frontend/src/services/localInference.js`)
- `clearCache()` purges both IndexedDB databases (`webllm/model`, `webllm/config`, `webllm/wasm`, `tvmjs`) and Cache Storage keys matching `webllm/` and `tvmjs`.

---

## 5. Build & Test Verification

| Test Suite | Commands Executed | Result |
|---|---|---|
| **Unit Tests** | `npm --prefix frontend test -- --run` | **14/14 test suites passed (75/75 tests)** |
| **Vite Production Build** | `npm --prefix frontend run build` | Built in 6.38s (`dist/assets/index-DEB1ZCdp.js` 691 KB) |
| **Wrangler Dry-Run** | `npx wrangler deploy --dry-run` | Succeeded with code 0 (6 static assets, 0 bindings, SPA routing) |

---

## 6. Remaining Limitations

1. **Browser Storage Space Requirement**:
   - The user's device requires at least ~850 MB of free storage space in IndexedDB / Cache Storage. If the browser runs in Private/Incognito mode or has restrictive disk quotas, download may fail with `QuotaExceededError`.
2. **Hardware Constraints**:
   - Requires a browser with WebGPU support (Chrome 113+, Edge 113+, Safari 18+). Mobile browsers or older GPUs lacking FP16 shader extensions may run into WebGPU device memory limits.
3. **Initial Download Latency**:
   - The 850 MB model weights download depends on client bandwidth. Subsequent visits load instantly from local IndexedDB cache without internet.
