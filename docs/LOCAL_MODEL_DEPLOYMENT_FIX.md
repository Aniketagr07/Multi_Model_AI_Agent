# OmniAI — Local Qwen2.5-1.5B WebLLM Model Download & Initialization Fix

**Date**: November 3, 2026  
**Auditor**: Antigravity Automated Verification Agent  
**Target Model**: Qwen2.5-1.5B-Instruct-q4f16_1-MLC (~850 MB weights + WebGPU WASM runtime)  
**Live Frontend**: `https://omniai.aniket-agr2007.workers.dev/`  
**Repository**: `https://github.com/Aniketagr07/Multi_Model_AI_Agent`

---

## 1. Exact Root Cause Analysis

### A. The Failing Network Request (`Failed to fetch`)
When initializing `Qwen2.5-1.5B-Instruct-q4f16_1-MLC`, `@mlc-ai/web-llm` (v0.2.87) references its default `prebuiltAppConfig.model_list`. In that configuration:

```json
{
  "model": "https://huggingface.co/mlc-ai/Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
  "model_id": "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
  "model_lib": "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0_2_87/base/Qwen2-1.5B-Instruct-q4f16_1_cs1k-webgpu.wasm",
  "low_resource_required": true,
  "vram_required_MB": 1629.75
}
```

* **Failing URL**: `https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0_2_87/base/Qwen2-1.5B-Instruct-q4f16_1_cs1k-webgpu.wasm`
* **Network Diagnosis**: Direct network probing demonstrated `ConnectTimeoutError: Connect Timeout Error (attempted addresses: 185.199.109.133:443, timeout: 10000ms)`.
* **Reason**: `raw.githubusercontent.com` is frequently throttled, DNS-poisoned, or blocked by several regional ISPs and university/enterprise campus networks (e.g. Jio, Airtel, campus firewalls). When the browser attempts to fetch this ~742 KB WASM module, the request hangs until timeout, causing browser `fetch()` to throw `TypeError: Failed to fetch`.
* **Single Point of Failure**: WebLLM was called with `webllm.prebuiltAppConfig` with no fallback mirror or retry logic, causing the entire initialization pipeline to immediately fail.

### B. Conflicting UI Copy
`LocalModelModal.jsx` previously claimed:
> *"Run private browser text & vision intelligence via WebGPU"*

This contradicted the single local model architecture where `Qwen2.5-1.5B` is strictly a text-only language model.

---

## 2. Files Modified

| File Path | Status | Changes Implemented |
|---|---|---|
| [`frontend/src/core/localModelRegistry.js`](file:///d:/Lpu%20lecture%20ppt/Sem%203/CSE%20276/Project/1/frontend/src/core/localModelRegistry.js) | **Updated** | Added `QWEN_CDN_MIRRORS` with jsDelivr global CDN as primary wasm host and HuggingFace/hf-mirror configurations. |
| [`frontend/src/services/localInference.js`](file:///d:/Lpu%20lecture%20ppt/Sem%203/CSE%20276/Project/1/frontend/src/services/localInference.js) | **Updated** | Implemented `buildWebLLMAppConfig` with CDN mirror injection; 3-attempt retry loop with exponential backoff; cache eviction on corruption; translated friendly error messages; added `checkCapabilities` and safe `clearCache`. |
| [`frontend/src/components/LocalModelModal.jsx`](file:///d:/Lpu%20lecture%20ppt/Sem%203/CSE%20276/Project/1/frontend/src/components/LocalModelModal.jsx) | **Updated** | Corrected subtitle to `"Run private on-device text intelligence via WebGPU"`; clarified text-only privacy policy; added `"Reset Cache & Retry"` action button in error state. |
| [`frontend/src/test/local_model_guest.test.jsx`](file:///d:/Lpu%20lecture%20ppt/Sem%203/CSE%20276/Project/1/frontend/src/test/local_model_guest.test.jsx) | **Updated** | Added unit tests covering CDN mirror resolution, capabilities checking, cache clearing isolation, and modal copy verification. |

---

## 3. Detailed Fixes Implemented

### 1. High-Speed, CORS-Compliant CDN Mirror
Probed candidate hosts for the required WebGPU WASM runtime (`Qwen2-1.5B-Instruct-q4f16_1_cs1k-webgpu.wasm`):
* `raw.githubusercontent.com`: **FAILED** (Timeout / Connection reset)
* `cdn.jsdelivr.net`: **SUCCESS** (`HTTP 200`, Size: 741,822 bytes, CORS: `access-control-allow-origin: *`, Response latency: ~300ms)

Configured primary WASM distribution via jsDelivr with fallback to GitHub web:
```javascript
export const QWEN_CDN_MIRRORS = {
  wasm: [
    'https://cdn.jsdelivr.net/gh/mlc-ai/binary-mlc-llm-libs@main/web-llm-models/v0_2_87/base/Qwen2-1.5B-Instruct-q4f16_1_cs1k-webgpu.wasm',
    'https://github.com/mlc-ai/binary-mlc-llm-libs/raw/main/web-llm-models/v0_2_87/base/Qwen2-1.5B-Instruct-q4f16_1_cs1k-webgpu.wasm',
    'https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0_2_87/base/Qwen2-1.5B-Instruct-q4f16_1_cs1k-webgpu.wasm',
  ],
  model: [
    'https://huggingface.co/mlc-ai/Qwen2.5-1.5B-Instruct-q4f16_1-MLC',
    'https://hf-mirror.com/mlc-ai/Qwen2.5-1.5B-Instruct-q4f16_1-MLC',
  ],
};
```

### 2. Automatic Retries with Exponential Backoff
In `LocalTextModel.initialize`:
* Attempt 1 connects using primary jsDelivr WASM CDN + Hugging Face weights.
* Attempt 2 (after 1s delay) switches mirrors.
* Attempt 3 (after 2s delay) purges any corrupted partial model cache before final attempt.
* User cancellation (`signal.aborted`) immediately halts without executing retries.

### 3. Targeted Cache Purging (`clearCache`)
* Purges only WebLLM cache namespaces in browser `CacheStorage`:
  - `webllm/model`
  - `webllm/config`
  - `webllm/wasm`
* **Guarantees**: User conversations, local database, API keys, and theme settings are never deleted.

### 4. Hardware & Storage Diagnostic Checks (`checkCapabilities`)
* Probes `navigator.gpu.requestAdapter()`.
* Probes `navigator.storage.estimate()` to verify adequate storage (~1.5 GB free space for weights and temporary cache).

### 5. Corrected UI Text
* Modal header: `"Run private on-device text intelligence via WebGPU"`.
* Privacy guarantee: `"Local text model responses are generated 100% on your device via WebGPU. Prompts and conversation data are never sent to external servers. (Note: Qwen2.5 1.5B is text-only; document or image analysis is routed to cloud vision providers)."`

---

## 4. Verification & Test Results

### A. Automated Unit Tests (Mocked Inference)
```bash
npm --prefix frontend test -- --run
```
* **Status**: **PASS (14 / 14 suites, 74 / 74 tests passed, 100%)**
* Tests verify:
  - AppConfig construction and CDN mirror selection.
  - Diagnostics and storage verification.
  - Safe cache clearing without wiping application data.
  - LocalModelModal rendering corrected text and error recovery controls.
  - Vision rejection guardrails for text-only model.

### B. Production Frontend Build
```bash
npm --prefix frontend run build
```
* **Status**: **SUCCESS (Built in 6.34s)**
* Transformed 320 modules, verified output in `frontend/dist/`.

### C. Cloudflare Deployment Dry Run
```bash
npx wrangler deploy --dry-run
```
* **Status**: **SUCCESS (Exit Code 0)**
* 6 files read, 0 bindings, valid assets-only Worker configuration.

---

## 5. Live Browser Testing Instructions

Because WebGPU and CacheStorage require a genuine browser environment with GPU hardware, verify on the live site:

1. **Push Changes to GitHub**:
   ```bash
   git add .
   git commit -m "fix(local-model): resolve WebLLM fetch failures with jsDelivr CDN mirrors and retries"
   git push origin main
   ```

2. **Open the Live Application**:
   - Navigate to `https://omniai.aniket-agr2007.workers.dev/` in Chrome, Edge, or Safari 18.

3. **Open Developer Tools (F12 > Network Tab)**:
   - Filter by `wasm` or `json`.

4. **Trigger Qwen2.5 1.5B Download**:
   - In the model selector, choose **Qwen2.5 1.5B (LOCAL MODELS)**.
   - Click **Download & Start (~850MB)** in the modal.
   - Observe Network tab: `Qwen2-1.5B-Instruct-q4f16_1_cs1k-webgpu.wasm` downloads from `cdn.jsdelivr.net` with HTTP 200.
   - Observe weights downloading from Hugging Face into `CacheStorage` (`webllm/model`).
   - Confirm progress advances smoothly to 100% and shader compilation finishes with *"Your local text model is ready"*.

