# OmniAI Local On-Device Model Architecture & Guest Mode

OmniAI provides a privacy-first, on-device AI experience powered by WebGPU and MLC WebLLM.

---

## 1. Local Model Specifications

| Category | Model ID | Display Name | Parameters | Format | Download Size | Est. VRAM | License | Badge |
|---|---|---|---|---|---|---|---|---|
| **Text & Reasoning** | **`qwen2.5-1.5b`** | **Qwen2.5 1.5B** | 1.54 Billion | `q4f16_1` MLC | **~850 MB** | **~1,630 MB** | Apache-2.0 | `Text / On-device` |

### Qwen2.5 1.5B (On-Device Text Model)
- **Role**: General conversational chat, programming assistance, code explanations, mathematics and logical reasoning, text summarization, problem solving, and writing.
- **Engine**: MLC WebLLM (`@mlc-ai/web-llm`) with WebGPU acceleration.
- **Model Key**: `Qwen2.5-1.5B-Instruct-q4f16_1-MLC`.
- **Context Window**: 4k tokens.

---

## 2. Text-Only Architecture & Image Handling

- **Text-Only Design**: `Qwen2.5 1.5B` is strictly a text-only language model.
- **Image Policy**:
  - Images are never routed to the local text model.
  - The local model never fabricates or hallucinates image descriptions.
  - If a user attaches an image while using `Qwen2.5 1.5B`, the system clearly explains:
    > "Local Image Understanding Unavailable: OmniAI's on-device model (`Qwen2.5 1.5B`) is a text-only language model and does not process image inputs. Please select a vision-capable cloud model or remove the image attachment."
  - Image upload options are hidden or disabled when `Qwen2.5 1.5B` is selected, exposing image analysis only to models that genuinely support multimodal vision (e.g. Gemini, GPT-4o).

---

## 3. Privacy & Zero Cloud Transmission

- **100% Client-Side**: `Qwen2.5 1.5B` executes inside the browser via WebGPU.
- No prompts, text, or tokens are sent to external servers or cloud providers.
- **Guest Mode Persistence**: Unauthenticated visitors store their conversations entirely in client-side `localStorage`.

---

## 4. Download Accounting & Loading Lifecycle Architecture

### High-Precision Progress Tracker
- **Deduplicated Byte Accounting**: Model shards and weights are tracked by unique keys in [`frontend/src/services/progressTracker.js`](file:///d:/Lpu%20lecture%20ppt/Sem%203/CSE%20276/Project/1/frontend/src/services/progressTracker.js).
- **Guaranteed Invariants**:
  - Bound strictly within $[0, 100]\%$.
  - Never displays `NaN`, `Infinity`, negative numbers, or percentages $> 100\%$.
  - Exactly synchronized between progress bar width, percentage label, and status message.
- **8 Distinct Lifecycle States**:
  1. `Preparing Download`
  2. `Downloading Model Files`
  3. `Download Complete`
  4. `Initializing Model`
  5. `Model Ready`
  6. `Download Failed`
  7. `Initialization Failed`
  8. `Download Cancelled`
- **Cancellation & Retry**: Uses `AbortController` signal to abort in-flight transfers and ignore delayed callbacks, allowing clean, non-corrupting retries.
