# Root Cause Diagnosis & Resolution: Qwen2.5-1.5B In-Browser Download Failure

**Date:** 2026-11-03  
**Target Architecture:** OmniAI Single-Page Application (Cloudflare Workers Static Assets)  
**WebLLM Version:** `@mlc-ai/web-llm` 0.2.87  
**Model:** Qwen2.5-1.5B-Instruct-q4f16_1-MLC (WebLLM / WebGPU)  
**Live Frontend:** `https://omniai.aniket-agr2007.workers.dev/`  
**Repository:** [Multi_Model_AI_Agent](https://github.com/Aniketagr07/Multi_Model_AI_Agent)  

---

## 1. Executive Summary

When attempting to initialize the local **Qwen2.5-1.5B** model in OmniAI on Cloudflare Workers, the browser threw:
```text
Initialization Failed
Failed to initialize Qwen2.5-1.5B: Network connection failed while downloading model files. Hugging Face or the CDN mirror could not be reached.
```
While hardware detection succeeded with `"WebGPU Hardware Acceleration Available"`, network inspection revealed:
- `mlc-chat-config.json` and `tensor-cache.json` reporting `HTTP 404 Not Found` under certain paths.
- CORS policy errors on fallback mirrors (`hf-mirror.com`).
- `Cache.prototype.add` rejecting cross-origin redirected binary shards (`params_shard_*.bin`).

All root causes have been systematically traced with live HTTP redirection tests, WebLLM source audits, and browser Cache API analysis. The application now uses an authoritative Hugging Face `/resolve/main/` URL structure, high-availability jsDelivr CDN mirrors for WebGPU WASM, an idempotent `Cache.prototype.add` CORS recovery polyfill, and refined error reporting.

---

## 2. WebLLM Compatibility Audit

We inspected the installed `@mlc-ai/web-llm` package (`v0.2.87`) in `frontend/node_modules/@mlc-ai/web-llm`.

### 2.1 Official Prebuilt AppConfig Inspection
In `webllm.prebuiltAppConfig.model_list`, `Qwen2.5-1.5B-Instruct-q4f16_1-MLC` is registered as:
```json
{
  "model": "https://huggingface.co/mlc-ai/Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
  "model_id": "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
  "model_lib": "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0_2_87/base/Qwen2-1.5B-Instruct-q4f16_1_cs1k-webgpu.wasm",
  "low_resource_required": true,
  "vram_required_MB": 1629.75,
  "overrides": {
    "context_window_size": 4096
  }
}
```

### 2.2 Model Library & Architecture Compatibility
- **Model Architecture**: `qwen2` (Qwen2.5 shares the same compute graph and tensor architecture as Qwen2).
- **Compiled WASM Library**: `Qwen2-1.5B-Instruct-q4f16_1_cs1k-webgpu.wasm` (741 KB).
- **Compatibility Status**: **100% Compatible**. The compiled WebGPU model library matches the model's weight quantization (`q4f16_1`) and 4k context size window.

---

## 3. HTTP Redirection & CORS Investigation

We tested the exact model endpoints using live HTTP requests carrying browser headers (`Origin: https://omniai.aniket-agr2007.workers.dev`):

### 3.1 Endpoint Redirection Matrix

| Target File | Initial Status | Initial Location Header | Initial CORS (`A-C-A-O`) | Final Destination Host | Final HTTP Status | Final CORS (`A-C-A-O`) | Content-Type |
|---|---|---|---|---|---|---|---|
| `mlc-chat-config.json` | `307 Temporary Redirect` | `/api/resolve-cache/models/.../mlc-chat-config.json?etag=...` | `https://omniai.aniket-agr2007.workers.dev` | `huggingface.co` | `200 OK` | `https://omniai.aniket-agr2007.workers.dev` | `text/plain; charset=utf-8` |
| `tensor-cache.json` | `307 Temporary Redirect` | `/api/resolve-cache/models/.../tensor-cache.json?etag=...` | `https://omniai.aniket-agr2007.workers.dev` | `huggingface.co` | `200 OK` | `https://omniai.aniket-agr2007.workers.dev` | `text/plain; charset=utf-8` |
| `params_shard_0.bin` (111.3 MB) | `302 Found` | `https://us.aws.cdn.hf.co/xet-bridge-us/...` | `https://omniai.aniket-agr2007.workers.dev` | `us.aws.cdn.hf.co` | `200 OK` | `*` | `application/octet-stream` |
| `hf-mirror.com` (Fallback) | `308 Permanent Redirect` | `https://huggingface.co/...` | `null` (Header missing) | N/A (Blocked) | N/A | `null` | N/A |

### 3.2 Findings from the Trace
1. **The 404 Cause**:
   - Hugging Face only serves repository files under `/resolve/<branch>/` or `/raw/<branch>/`.
   - When a base URL like `https://huggingface.co/mlc-ai/Qwen2.5-1.5B-Instruct-q4f16_1-MLC` (or with a trailing slash without `resolve/main`) is resolved via `new URL('mlc-chat-config.json', base)`, it produces:
     `https://huggingface.co/mlc-ai/Qwen2.5-1.5B-Instruct-q4f16_1-MLC/mlc-chat-config.json`
   - Direct testing confirmed that Hugging Face immediately responds with **`HTTP 404 Not Found`** to this URL.
   - When the base URL explicitly includes `/resolve/main/`, resolution produces:
     `https://huggingface.co/mlc-ai/Qwen2.5-1.5B-Instruct-q4f16_1-MLC/resolve/main/mlc-chat-config.json`
     which redirects to `/api/resolve-cache/...` and returns **`HTTP 200 OK`**.
2. **The CORS Error Cause**:
   - `hf-mirror.com` was configured as a secondary mirror. When queried with an `Origin` header, `hf-mirror.com` issues a `308 Permanent Redirect` with **no CORS header (`access-control-allow-origin: null`)**. The browser rejects this redirect instantly as a CORS security violation.
3. **The `Cache.prototype.add` Failure**:
   - While `params_shard_0.bin` returns `200 OK` with `A-C-A-O: *` on AWS CloudFront/S3 (`us.aws.cdn.hf.co`), the initial request on `huggingface.co` returns `302 Found`.
   - The W3C Cache API specification permits browsers to reject cross-origin redirected responses in `Cache.prototype.add(request)`. When this happens, Chromium and WebKit throw `TypeError: Failed to fetch`.

---

## 4. Codebase Corrections

### 4.1 Authoritative Base URL Configuration (`frontend/src/core/localModelRegistry.js`)
We updated `QWEN_CDN_MIRRORS`:
- Explicitly pinned `model` to `'https://huggingface.co/mlc-ai/Qwen2.5-1.5B-Instruct-q4f16_1-MLC/resolve/main/'`.
- Completely removed `hf-mirror.com` to eliminate the missing-CORS redirect blocker.
- Configured 3 global jsDelivr CDN mirrors for the WebGPU WASM library (`cdn.jsdelivr.net`, `fastly.jsdelivr.net`, `gcore.jsdelivr.net`), completely replacing `raw.githubusercontent.com`.

### 4.2 Robust Cache API Polyfill (`frontend/src/services/localInference.js`)
We hardened `installCacheAddPolyfill()`:
- Intercepts `Cache.prototype.add`. If the native call throws due to cross-origin redirects, it initiates a standard CORS-mode `fetch(new Request(reqUrl, { mode: 'cors', credentials: 'omit', signal }))`.
- Stores the 200 OK response into Cache Storage via `cache.put(reqUrl, response)`. Using `reqUrl` (the original requested URL string) ensures `cache.match(new Request(url))` finds the resource without failing on URL divergence.

### 4.3 AppConfig Model Registry Guarantee (`frontend/src/services/localInference.js`)
In `buildWebLLMAppConfig(webllm)`:
- Ensures that if `prebuiltAppConfig` does not yet contain `Qwen2.5-1.5B-Instruct-q4f16_1-MLC`, the full record with all required properties (`model_id`, `model`, `model_lib`, `low_resource_required`, `vram_required_MB`, `overrides`) is injected.

### 4.4 Comprehensive Cache Purging (`frontend/src/services/localInference.js`)
In `clearCache()`:
- Purges `tvmjs` alongside `webllm/model`, `webllm/config`, and `webllm/wasm`.
- Iterates over all Cache Storage keys matching `webllm/` and `tvmjs` to ensure corrupt or 404 cache responses are wiped prior to retrying.

### 4.5 Modern Content Security Policy (`frontend/public/_headers`)
Added explicit permissions for WebAssembly compilation and model host connections:
```http
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; worker-src 'self' blob:; connect-src 'self' https://huggingface.co https://*.huggingface.co https://*.hf.co https://cdn.jsdelivr.net https://fastly.jsdelivr.net https://gcore.jsdelivr.net https://*.onrender.com wss://*.onrender.com https://generativelanguage.googleapis.com https://api.groq.com;
```

---

## 5. Verification & Test Summary

| Test Category | Description | Result |
|---|---|---|
| **Live Network Redirection Test** | Inspected `mlc-chat-config.json`, `tensor-cache.json`, and `params_shard_0.bin` with browser `Origin` header | Initial 307/302 followed to final 200 OK with verified `Access-Control-Allow-Origin` |
| **Model Library URL Check** | Verified `Qwen2-1.5B-Instruct-q4f16_1_cs1k-webgpu.wasm` on jsDelivr CDN | `HTTP 200 OK` (741,822 bytes, `A-C-A-O: *`) |
| **Unit Test Suite** | Executed `npm --prefix frontend test -- --run` | **14/14 test files passed (75/75 tests)** |
| **Production Build** | Executed `npm --prefix frontend run build` | Built in 6.41s (`dist/` generated with 320 modules transformed) |
| **Wrangler Dry-Run** | Executed `npx wrangler deploy --dry-run` | Succeeded with code 0 (6 static assets, 0 bindings, SPA routing) |

---

## 6. How to Apply the Fix to Cloudflare Workers

Run the following commands:

```bash
git add frontend/public/_headers frontend/src/core/localModelRegistry.js frontend/src/services/localInference.js frontend/src/test/local_model_guest.test.jsx docs/QWEN_DOWNLOAD_FAILURE_DIAGNOSIS.md
git commit -m "fix(local-inference): resolve Qwen2.5 404 and CORS errors with resolve/main URL and hardened Cache API polyfill"
git push origin main
```

Cloudflare Workers will automatically trigger a build and publish the updated assets. When opening `https://omniai.aniket-agr2007.workers.dev/`, click "Clear Model Cache" or "Reset Cache & Retry" to purge any corrupt remnants from previous attempts.
