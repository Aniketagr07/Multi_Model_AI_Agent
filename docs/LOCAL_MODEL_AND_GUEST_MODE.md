# Local Browser AI Model, Multimodal Vision Intelligence & Guest Mode Architecture

OmniAI features a 100% on-device AI system with dedicated text generation, verified conversational vision-language problem solving, voice input (speech-to-text), and voice narration (text-to-speech).

This enables guests and registered users to converse with high-capability AI models directly in their web browser—without cloud API keys or external inference fees.

---

## 1. Primary On-Device Models

| Role | Model Identifier | Display Name | Parameters | Quantization | Approx Download | VRAM Required | License | Badge |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **General Text** | **`qwen2.5-1.5b`** *(Default)* | **Qwen2.5 1.5B** | 1.54 Billion | `q4f16_1` | **~850 MB** | **~1,630 MB** | Apache-2.0 | `Text / On-device` |
| **Vision + Text** | **`qwen2.5-vl-3b`** | **Qwen2.5-VL 3B** | 3.09 Billion | `q4` ONNX | **~2,200 MB** | **~3,200 MB** | Apache-2.0 | `Vision + Text / On-device` |

### A. Qwen2.5-1.5B (Text Generation Model)
- **Role**: General conversation, question answering, code writing, and reasoning.
- **Runtime**: WebLLM WebGPU engine (`Qwen2.5-1.5B-Instruct-q4f16_1-MLC`).
- **Strict Guard**: Strictly text-only. Cannot receive or process images.

### B. Qwen2.5-VL 3B (Primary Conversational Vision-Language Model)
- **Role**: Primary conversational vision model for image understanding, mathematics and physics problem solving from images, programming challenges, diagram analysis, chart interpretation, and multi-turn visual conversations.
- **Repository**: [`onnx-community/Qwen2.5-VL-3B-Instruct-ONNX`](https://huggingface.co/onnx-community/Qwen2.5-VL-3B-Instruct-ONNX).
- **Runtime**: Transformers.js v3 (`AutoProcessor`, `Qwen2_5_VLForConditionalGeneration`, `RawImage`) with WebGPU acceleration.
- **Artifacts**: Quantized 4-bit ONNX weights (`vision_encoder_q4.onnx`, `decoder_model_merged_q4.onnx`, `embed_tokens_q4.onnx`).
- **Florence-2 Status**: Removed from primary vision model routing and conversational responses. (May serve as a supporting optical utility, but never produces the primary conversation response).

---

## 2. Advanced Visual Intelligence & Intent Detection

OmniAI does not merely dump raw OCR text or describe images. The visual intelligence engine ([`visualIntelligence.js`](file:///d:/Lpu%20lecture%20ppt/Sem%203/CSE%20276/Project/1/frontend/src/services/visualIntelligence.js)) detects image intent across 12 categories:

1. **Mathematics & Physics**: Identifies equations, diagrams, and numerical problems; solves step-by-step with formulas and verified final answers.
2. **Multiple-Choice Questions (MCQs)**: Evaluates options (`A`, `B`, `C`, `D`), explains why the correct option is right and others are wrong, and highlights the answer.
3. **Programming Questions**: Extracts problem statements and constraints from images, explains the algorithm, provides formatted code, and details time/space complexity.
4. **CV & Resume Evaluation**: Analyzes layout hierarchy, strengths, weaknesses, ATS compatibility, and actionable improvements.
5. **Charts & Graphs**: Identifies axes, data distribution, trends, extremes, and analytical conclusions.
6. **Technical Diagrams**: Explains components, relationships, signal propagation, and working mechanisms for flowcharts, circuits, UML, and system architectures.
7. **Screenshots & Error Logs**: Identifies exceptions and stack traces, provides root-cause analysis, and step-by-step resolutions.
8. **Follow-Up Questions**: Retains original visual perception in memory for seamless follow-up conversations without requesting re-uploads.

---

## 3. Strict Model Routing Rules

```
                             [User Message]
                                   │
                    ┌──────────────┴──────────────┐
                    ▼                             ▼
             [Image Attached?]         [Prior Image Context?]
               ├── YES ──────┐               ├── YES ──────┐
               │             │               │             │
               ▼             ▼               ▼             ▼
      [Qwen2.5-VL 3B]               [Qwen2.5-VL 3B]
      (qwen2.5-vl-3b)               (Follow-up Query)
               │                             │
               └──────────────┬──────────────┘
                              │
                              ▼ [No Image / Regular Chat]
                      [Qwen2.5 1.5B]
                      (qwen2.5-1.5b)
```

- **Image Attached**: Strictly routed to **`Qwen2.5-VL 3B`**.
- **Follow-up on Image**: Routed to **`Qwen2.5-VL 3B`** using cached image context.
- **Text-Only**: Routed to **`Qwen2.5 1.5B`**.
- **Text-Only Guard**: `Qwen2.5 1.5B` is blocked from receiving image analysis requests.

---

## 4. Privacy & Zero Cloud Transmission

- **100% Client-Side**: Both `Qwen2.5 1.5B` and `Qwen2.5-VL 3B` execute inside the browser via WebGPU.
- No image pixels, prompts, or voice recordings are sent to Gemini, Groq, or backend servers.
- **Guest Mode Persistence**: Unauthenticated visitors store their conversations entirely in `localStorage`.


---

## 5. Download Accounting & Loading Lifecycle Architecture

### High-Precision Multi-Shard Progress Tracker
- **Deduplicated Shard Accounting**: Model files (`vision_encoder_q4.onnx`, `decoder_model_merged_q4.onnx`, `embed_tokens_q4.onnx`, tokenizers, configs) are tracked by unique keys in [`frontend/src/services/progressTracker.js`](file:///d:/Lpu%20lecture%20ppt/Sem%203/CSE%20276/Project/1/frontend/src/services/progressTracker.js).
- **Mathematical Formula**:
  $$\text{percentage} = \min\left(100, \max\left(0, \operatorname{round}\left(\frac{\sum_{\text{unique files}} \text{loaded bytes}}{\max(\sum \text{expected bytes}, \text{total expected})} \times 100\right)\right)\right)$$
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
- **Cancellation & Stale Callback Rejection**: Uses `AbortController` signal to abort in-flight transfers and ignore delayed worker callbacks, allowing clean, non-corrupting retries.
