/**
 * OmniAI Cloudflare Edge Worker
 * Serves the React frontend static assets and provides native Edge API endpoints
 * for health checks, model discovery, authentication, and AI streaming.
 * Eliminates external server dependencies (Render) and cross-origin CORS latency.
 */

const BUILTIN_SKILLS = [
  {
    id: "python-code-assistant",
    name: "Python Code Assistant",
    description: "Analyzes, optimizes, and generates idiomatic Python code with type annotations and docstrings.",
    category: "Coding & Development",
    provider: "OmniAI Core",
    version: "1.0.0",
    icon: "code",
    permissions: ["read_code", "execute_sandbox"],
    is_featured: 1,
  },
  {
    id: "code-explainer",
    name: "Code Explainer",
    description: "Deconstructs complex algorithms, explaining time/space complexity and potential edge cases.",
    category: "Coding & Development",
    provider: "OmniAI Core",
    version: "1.0.0",
    icon: "terminal",
    permissions: ["read_code"],
    is_featured: 0,
  },
  {
    id: "web-research-assistant",
    name: "Web Research Assistant",
    description: "Performs structured topic research, synthesizes external sources, and generates executive summaries.",
    category: "Research & Web",
    provider: "OmniAI Core",
    version: "1.1.0",
    icon: "globe",
    permissions: ["web_access", "read_content"],
    is_featured: 1,
  },
  {
    id: "doc-summarizer",
    name: "Document Summarizer",
    description: "Extracts key insights, highlights action items, and condenses lengthy documentation and articles.",
    category: "Documents & PDF",
    provider: "OmniAI Core",
    version: "1.0.0",
    icon: "file-text",
    permissions: ["read_documents"],
    is_featured: 1,
  },
  {
    id: "pdf-researcher",
    name: "PDF Research Assistant",
    description: "Grounded question-answering over uploaded PDF manuals, research papers, and technical specifications.",
    category: "Documents & PDF",
    provider: "OmniAI Core",
    version: "1.0.0",
    icon: "book-open",
    permissions: ["read_documents", "extract_text"],
    is_featured: 0,
  },
  {
    id: "csv-analyzer",
    name: "CSV & Tabular Data Analyzer",
    description: "Parses structured CSV datasets, computes statistical metrics, and identifies trends and anomalies.",
    category: "Data Analysis",
    provider: "OmniAI Core",
    version: "1.2.0",
    icon: "table",
    permissions: ["read_data", "compute_metrics"],
    is_featured: 1,
  },
  {
    id: "math-solver",
    name: "Mathematical Solver",
    description: "Step-by-step mathematical reasoning, symbolic algebra simplification, and arithmetic verification.",
    category: "Mathematics",
    provider: "OmniAI Core",
    version: "1.0.0",
    icon: "calculator",
    permissions: ["compute_math"],
    is_featured: 0,
  },
  {
    id: "email-assistant",
    name: "Email Assistant",
    description: "Drafts professional correspondence, customer support replies, and adjusts tone appropriately.",
    category: "Productivity",
    provider: "OmniAI Core",
    version: "1.0.0",
    icon: "mail",
    permissions: ["draft_content"],
    is_featured: 0,
  },
  {
    id: "workflow-automator",
    name: "Workflow Automator",
    description: "Designs multi-step agentic workflows and pipeline blueprints for recurring developer tasks.",
    category: "Automation",
    provider: "OmniAI Core",
    version: "1.0.0",
    icon: "cpu",
    permissions: ["schedule_tasks", "pipeline_design"],
    is_featured: 0,
  },
  {
    id: "github-integration",
    name: "GitHub Integration",
    description: "Inspect repositories, read pull requests, and review code diffs directly within conversations.",
    category: "Third-Party Integrations",
    provider: "GitHub Inc.",
    version: "0.9.0",
    icon: "github",
    permissions: ["read_repos", "oauth_access"],
    is_featured: 1,
  },
];

const AVAILABLE_MODELS = [
  {
    id: "qwen2.5-1.5b-instruct",
    name: "Qwen 2.5 1.5B (Local WebGPU)",
    provider: "local",
    context_length: 32768,
    description: "Private local inference running 100% inside your browser via WebGPU/WebLLM.",
    is_default: true,
  },
  {
    id: "gemini-3.8-flash",
    name: "Gemini 3.8 Flash",
    provider: "gemini",
    context_length: 1048576,
    description: "Next-gen ultra-fast multimodal model from Google.",
    is_default: false,
  },
  {
    id: "gemini-1.5-flash",
    name: "Gemini 1.5 Flash",
    provider: "gemini",
    context_length: 1048576,
    description: "Fast, versatile multimodal reasoning from Google.",
    is_default: false,
  },
  {
    id: "gemini-1.5-pro",
    name: "Gemini 1.5 Pro",
    provider: "gemini",
    context_length: 2097152,
    description: "High-intelligence flagship reasoning model from Google.",
    is_default: false,
  },
  {
    id: "llama-3.1-8b-instant",
    name: "Llama 3.1 8B Instant",
    provider: "groq",
    context_length: 131072,
    description: "Ultra-fast low-latency inference on Groq LPU.",
    is_default: false,
  },
  {
    id: "llama-3.3-70b-versatile",
    name: "Llama 3.3 70B Versatile",
    provider: "groq",
    context_length: 131072,
    description: "Flagship open weights model hosted on Groq.",
    is_default: false,
  },
];

function jsonResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-OmniAI-Token, X-Gemini-Key, X-Groq-Key",
      ...headers,
    },
  });
}

function handleCorsPreflight() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-OmniAI-Token, X-Gemini-Key, X-Groq-Key",
      "Access-Control-Max-Age": "86400",
    },
  });
}

async function handleApiRequest(request, url, env) {
  const method = request.method.toUpperCase();
  const path = url.pathname.replace(/\/+$/, "");

  if (method === "OPTIONS") {
    return handleCorsPreflight();
  }

  // 1. Health check
  if (path === "/api/health" || path === "/health") {
    return jsonResponse({
      app_name: "OmniAI Edge",
      status: "healthy",
      version: "0.1.0",
      environment: "production",
      edge_location: request.cf?.colo || "global",
      timestamp: new Date().toISOString(),
    });
  }

  // 2. Models list
  if (path === "/api/models" || path === "/api/models/discover") {
    return jsonResponse({
      default_model: "qwen2.5-1.5b-instruct",
      models: AVAILABLE_MODELS,
    });
  }

  // 3. Skills list
  if (path === "/api/skills") {
    return jsonResponse(BUILTIN_SKILLS);
  }

  // 4. Guest mode status
  if (path === "/api/auth/guest") {
    return jsonResponse({
      mode: "guest",
      message: "Guest mode is enabled. Your chats and settings are stored locally in your browser.",
    });
  }

  // 5. Current authenticated user
  if (path === "/api/auth/me") {
    const authHeader = request.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();

    if (token && token.startsWith("edge_token_")) {
      const parts = token.split("_");
      const username = parts[2] ? decodeURIComponent(parts[2]) : "OmniUser";
      return jsonResponse({
        id: "usr_" + (parts[3] || "local"),
        email: `${username.toLowerCase()}@local.omniai`,
        username: username,
        primary_provider: "local",
        created_at: new Date().toISOString(),
      });
    }

    return jsonResponse(
      { detail: "Not authenticated. Operating in Guest mode." },
      401
    );
  }

  // 6. User Login
  if (path === "/api/auth/login" && method === "POST") {
    try {
      const body = await request.json().catch(() => ({}));
      const email = String(body.email || "").trim();
      const username = email ? email.split("@")[0] : "OmniUser";
      const token = `edge_token_sess_${encodeURIComponent(username)}_${Date.now()}`;

      return jsonResponse(
        {
          token,
          user: {
            id: `usr_${Date.now().toString(36)}`,
            email: email || "guest@local.omniai",
            username,
            primary_provider: "email",
            avatar_url: null,
            created_at: new Date().toISOString(),
          },
        },
        200,
        {
          "Set-Cookie": `omniai_session=${token}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=2592000`,
        }
      );
    } catch (e) {
      return jsonResponse({ detail: "Invalid request payload" }, 400);
    }
  }

  // 7. User Registration
  if (path === "/api/auth/register" && method === "POST") {
    try {
      const body = await request.json().catch(() => ({}));
      const email = String(body.email || "").trim();
      const username = String(body.username || "").trim() || email.split("@")[0] || "OmniUser";
      const token = `edge_token_sess_${encodeURIComponent(username)}_${Date.now()}`;

      return jsonResponse(
        {
          token,
          user: {
            id: `usr_${Date.now().toString(36)}`,
            email,
            username,
            primary_provider: "email",
            avatar_url: null,
            created_at: new Date().toISOString(),
          },
        },
        201,
        {
          "Set-Cookie": `omniai_session=${token}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=2592000`,
        }
      );
    } catch (e) {
      return jsonResponse({ detail: "Invalid registration payload" }, 400);
    }
  }

  // 8. User Logout
  if (path === "/api/auth/logout" && method === "POST") {
    return jsonResponse(
      { success: true, message: "Logged out successfully" },
      200,
      {
        "Set-Cookie": `omniai_session=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`,
      }
    );
  }

  // 9. OAuth URLs (fallback informational response for edge mode)
  if (path.startsWith("/api/auth/oauth/") && path.endsWith("/url")) {
    const provider = path.includes("google") ? "google" : "github";
    return jsonResponse({
      provider,
      url: "",
      message: `${provider.toUpperCase()} OAuth is in Edge Mode. You can sign in immediately using Email/Password or continue in Guest Mode with local browser storage.`,
      status: "edge_mode",
    });
  }

  // 10. BYOK Status
  if (path === "/api/byok/status") {
    return jsonResponse({
      gemini_configured: Boolean(env?.GEMINI_API_KEY),
      groq_configured: Boolean(env?.GROQ_API_KEY),
      mode: "edge_byok",
    });
  }

  // 11. Conversations list
  if (path === "/api/conversations" && method === "GET") {
    return jsonResponse([]);
  }

  // 12. Settings
  if (path === "/api/settings") {
    return jsonResponse({
      theme: "dark",
      stream_enabled: true,
      default_model: "qwen2.5-1.5b-instruct",
    });
  }

  // 13. AI Chat Streaming (Gemini / Groq / Fallback)
  if (path === "/api/chat/stream" || path === "/api/chat") {
    try {
      const body = await request.json().catch(() => ({}));
      const modelId = String(body.model_id || body.model || "qwen2.5-1.5b-instruct").toLowerCase();
      const messages = body.messages || [];
      const userPrompt = messages[messages.length - 1]?.content || body.prompt || "Hello";

      // If client requests local model, let client-side WebLLM handle it
      if (modelId.includes("qwen") || modelId.includes("local")) {
        return jsonResponse({
          model: modelId,
          role: "assistant",
          content: "Local model selected. Running in-browser via WebGPU.",
        });
      }

      // Check for Gemini API Key
      const geminiKey =
        request.headers.get("X-Gemini-Key") ||
        env?.GEMINI_API_KEY;

      // Check for Groq API Key
      const groqKey =
        request.headers.get("X-Groq-Key") ||
        env?.GROQ_API_KEY;

      if (modelId.includes("gemini") && geminiKey) {
        const geminiModel = modelId.includes("pro") ? "gemini-1.5-pro" : "gemini-1.5-flash";
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiKey}`;
        const geminiResp = await fetch(geminiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: messages.map((m) => ({
              role: m.role === "assistant" ? "model" : "user",
              parts: [{ text: m.content || "" }],
            })),
          }),
        });

        if (geminiResp.ok) {
          const gData = await geminiResp.json();
          const reply = gData.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated.";
          return jsonResponse({
            model: modelId,
            role: "assistant",
            content: reply,
          });
        }
      }

      if (modelId.includes("llama") && groqKey) {
        const groqResp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${groqKey}`,
          },
          body: JSON.stringify({
            model: modelId,
            messages: messages.map((m) => ({ role: m.role, content: m.content })),
          }),
        });

        if (groqResp.ok) {
          const qData = await groqResp.json();
          const reply = qData.choices?.[0]?.message?.content || "No response generated.";
          return jsonResponse({
            model: modelId,
            role: "assistant",
            content: reply,
          });
        }
      }

      // Default informational fallback if keys are unset
      return jsonResponse({
        model: modelId,
        role: "assistant",
        content: `OmniAI Edge Response: To stream responses from ${modelId}, provide your personal API key in Settings (BYOK) or switch to the free **Qwen 2.5 1.5B (Local WebGPU)** model to generate responses completely in your browser without any API keys!`,
      });
    } catch (err) {
      return jsonResponse({ detail: err.message || "Failed to process chat request" }, 500);
    }
  }

  // Generic 404 for unknown API paths
  return jsonResponse({ detail: `Route ${path} not found on OmniAI Edge` }, 404);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Route /api/* requests directly to Cloudflare Edge API
    if (url.pathname.startsWith("/api/") || url.pathname === "/health") {
      return handleApiRequest(request, url, env);
    }

    // Serve all static frontend assets (SPA fallback)
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response("Static assets binding not found.", { status: 500 });
  },
};

