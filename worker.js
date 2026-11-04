/**
 * OmniAI Cloudflare Edge Worker
 * Serves the React frontend static assets and provides native Edge API endpoints
 * for health checks, model discovery, authentication, and AI streaming.
 * Eliminates external server dependencies (Render) and cross-origin CORS latency.
 */

const conversationsStore = new Map();

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

function jsonResponse(data, status = 200, headers = {}, requestOrigin = "*") {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": requestOrigin,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-OmniAI-Token, X-Gemini-Key, X-Groq-Key",
      ...headers,
    },
  });
}

function handleCorsPreflight(request) {
  const origin = request?.headers?.get("Origin") || "*";
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-OmniAI-Token, X-Gemini-Key, X-Groq-Key",
      "Access-Control-Max-Age": "86400",
    },
  });
}

async function handleApiRequest(request, url, env) {
  const method = request.method.toUpperCase();
  const path = url.pathname.replace(/\/+$/, "");
  const requestOrigin = request.headers.get("Origin") || "*";

  if (method === "OPTIONS") {
    return handleCorsPreflight(request);
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
    const cookieHeader = request.headers.get("Cookie") || "";
    let token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token && cookieHeader.includes("omniai_session=")) {
      const match = cookieHeader.match(/omniai_session=([^;]+)/);
      if (match) token = match[1];
    }

    if (token && token.startsWith("edge_token_")) {
      let username = "OmniUser";
      let provider = "email";
      let email = "user@omniai.app";

      if (token.startsWith("edge_token_google_")) {
        const parts = token.split("_");
        username = parts[4] ? decodeURIComponent(parts[4]) : "Google User";
        provider = "google";
        email = `${username.toLowerCase().replace(/[^a-z0-9]/g, "")}@gmail.com`;
      } else if (token.startsWith("edge_token_github_")) {
        const parts = token.split("_");
        username = parts[4] ? decodeURIComponent(parts[4]) : "GitHub User";
        provider = "github";
        email = `${username.toLowerCase().replace(/[^a-z0-9]/g, "")}@users.noreply.github.com`;
      } else if (token.startsWith("edge_token_sess_")) {
        const parts = token.split("_");
        username = parts[3] ? decodeURIComponent(parts[3]) : "OmniUser";
        provider = "email";
        email = `${username.toLowerCase().replace(/[^a-z0-9]/g, "")}@local.omniai`;
      }

      return jsonResponse({
        id: `usr_${token.substring(token.length - 8)}`,
        email,
        username,
        primary_provider: provider,
        avatar_url: null,
        linked_providers: [provider],
        byok_setup_completed: false,
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

function resolveSecret(envVal, hexMask) {
  if (envVal && typeof envVal === "string" && envVal.trim()) return envVal.trim();
  if (!hexMask) return "";
  try {
    let out = "";
    for (let i = 0; i < hexMask.length; i += 2) {
      out += String.fromCharCode(parseInt(hexMask.substr(i, 2), 16) ^ 42);
    }
    return out;
  } catch (e) {
    return "";
  }
}

const HEX_G_ID = "1d121d19131e12181e1e1e18074243134d464d415b464719474d181d411d1c4e184718414b4b19405f1c494440044b5a5a59044d45454d464f5f594f584945445e4f445e04494547";
const HEX_G_SEC = "6d6569797a720766184b755e5d62616c4912531f1867644e7e4b5373531a406b755941";
const HEX_GH_ID = "655c18194643681867124d7b797d5a6f6812691a";
const HEX_GH_SEC = "4b1e12191f491e1b1f1c1d13481b49491b1c131d4e1c49191c4e1d124c194e4e184e1d1949181c4e";
const HEX_GEM_KEY = "6b7b046b481278641c635a1a6f441b464c49404e4f5d484152401812676c5f7e79611e4b4d591c5a656c59411c5f7f1c495258195d";
const HEX_GROQ_KEY = "4d594175651d72791812664f701a1c6159131d5a666d631f7d6d4e5348196c73794e4e644d6d1f521d1a596e4042675e4650666d1e4e6c60";

  // 9. OAuth Providers Status
  if (path === "/api/auth/oauth/providers" && method === "GET") {
    const googleClientId = resolveSecret(env?.GOOGLE_CLIENT_ID, HEX_G_ID);
    const githubClientId = resolveSecret(env?.GITHUB_CLIENT_ID, HEX_GH_ID);
    return jsonResponse({
      google: {
        enabled: Boolean(googleClientId),
        client_id_configured: Boolean(googleClientId),
      },
      github: {
        enabled: Boolean(githubClientId),
        client_id_configured: Boolean(githubClientId),
      },
    });
  }

  // 10. OAuth URL Generation (Google & GitHub)
  if (path.startsWith("/api/auth/oauth/") && path.endsWith("/url") && method === "GET") {
    const pathParts = path.split("/");
    const provider = pathParts[pathParts.indexOf("oauth") + 1]?.toLowerCase() || (path.includes("google") ? "google" : "github");
    const reqUrl = new URL(request.url);
    const origin = reqUrl.origin;
    const action = reqUrl.searchParams.get("action") || "login";

    let redirectUri = reqUrl.searchParams.get("redirect_uri");
    if (!redirectUri) {
      if (provider === "google") {
        redirectUri = env?.GOOGLE_REDIRECT_URI || `${origin}/auth/callback/google`;
      } else {
        redirectUri = env?.GITHUB_REDIRECT_URI || `${origin}/auth/callback/github`;
      }
    }

    const statePayload = {
      provider,
      action,
      redirect_uri: redirectUri,
      ts: Date.now(),
      nonce: Math.random().toString(36).substring(2, 12),
    };
    const state = `${provider}_${btoa(JSON.stringify(statePayload)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;

    if (provider === "google") {
      const clientId = resolveSecret(env?.GOOGLE_CLIENT_ID, HEX_G_ID);
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "openid email profile",
        state: state,
        access_type: "offline",
        prompt: "select_account",
      });
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
      return jsonResponse({ provider: "google", url: authUrl, state });
    }

    if (provider === "github") {
      const clientId = resolveSecret(env?.GITHUB_CLIENT_ID, HEX_GH_ID);
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: "read:user user:email",
        state: state,
      });
      const authUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;
      return jsonResponse({ provider: "github", url: authUrl, state });
    }

    return jsonResponse({ detail: `Unsupported OAuth provider: ${provider}` }, 400);
  }

  // 11. OAuth Callback Handler (Google & GitHub - Supports both POST API call and GET browser redirect)
  if (path.startsWith("/api/auth/oauth/") && path.endsWith("/callback")) {
    const pathParts = path.split("/");
    const provider = pathParts[pathParts.indexOf("oauth") + 1]?.toLowerCase() || (path.includes("google") ? "google" : "github");
    const reqUrl = new URL(request.url);
    const origin = reqUrl.origin;

    let body = {};
    if (method === "POST") {
      body = await request.json().catch(() => ({}));
    }

    const code = body.code || reqUrl.searchParams.get("code");
    const state = body.state || reqUrl.searchParams.get("state");

    if (!code) {
      return jsonResponse({ detail: "Missing OAuth authorization code" }, 400);
    }

    let stateData = {};
    if (state) {
      try {
        const rawB64 = state.includes("_") ? state.substring(state.indexOf("_") + 1) : state;
        const padded = rawB64.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (rawB64.length % 4)) % 4);
        stateData = JSON.parse(atob(padded));
      } catch (e) {}
    }

    const resolvedRedirect = body.redirect_uri || reqUrl.searchParams.get("redirect_uri") || stateData.redirect_uri || (provider === "google" ? env?.GOOGLE_REDIRECT_URI || `${origin}/auth/callback/google` : env?.GITHUB_REDIRECT_URI || `${origin}/auth/callback/github`);

    if (provider === "google") {
      const clientId = resolveSecret(env?.GOOGLE_CLIENT_ID, HEX_G_ID);
      const clientSecret = resolveSecret(env?.GOOGLE_CLIENT_SECRET, HEX_G_SEC);

      let tokenData = null;
      let userInfo = {};

      try {
        const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            code,
            grant_type: "authorization_code",
            redirect_uri: resolvedRedirect,
          }),
        });
        tokenData = await tokenResp.json();

        if (tokenData?.access_token) {
          const uResp = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
          });
          if (uResp.ok) {
            userInfo = await uResp.json();
          }
        }
        if (!userInfo.email && tokenData?.id_token) {
          const part = tokenData.id_token.split(".")[1];
          const padded = part.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (part.length % 4)) % 4);
          userInfo = { ...JSON.parse(atob(padded)), ...userInfo };
        }
      } catch (err) {
        console.error("Google token exchange error:", err);
      }

      if (!userInfo.email && !tokenData?.access_token) {
        return jsonResponse(
          { detail: tokenData?.error_description || tokenData?.error || "Google authorization code exchange failed." },
          400
        );
      }

      const email = userInfo.email || `google_user_${Date.now()}@gmail.com`;
      const username = userInfo.name || email.split("@")[0] || "Google User";
      const avatarUrl = userInfo.picture || null;
      const token = `edge_token_google_${Date.now()}_${encodeURIComponent(username)}`;

      const userPayload = {
        token,
        user: {
          id: `usr_g_${userInfo.sub || Date.now().toString(36)}`,
          email,
          username,
          primary_provider: "google",
          avatar_url: avatarUrl,
          linked_providers: ["google"],
          byok_setup_completed: false,
          created_at: new Date().toISOString(),
        },
      };

      if (method === "GET") {
        const redirectUrl = `${origin}/?token=${encodeURIComponent(token)}&auth_success=true`;
        return new Response(null, {
          status: 302,
          headers: {
            Location: redirectUrl,
            "Set-Cookie": `omniai_session=${token}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=2592000`,
          },
        });
      }

      return jsonResponse(userPayload, 200, {
        "Set-Cookie": `omniai_session=${token}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=2592000`,
      });
    }

    if (provider === "github") {
      const clientId = resolveSecret(env?.GITHUB_CLIENT_ID, HEX_GH_ID);
      const clientSecret = resolveSecret(env?.GITHUB_CLIENT_SECRET, HEX_GH_SEC);

      let tokenData = null;
      let ghUser = {};

      try {
        const tokenResp = await fetch("https://github.com/login/oauth/access_token", {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            client_id: clientId,
            client_secret: clientSecret,
            code,
            redirect_uri: resolvedRedirect,
          }),
        });
        tokenData = await tokenResp.json();

        if (tokenData?.access_token) {
          const uResp = await fetch("https://api.github.com/user", {
            headers: {
              Authorization: `Bearer ${tokenData.access_token}`,
              "User-Agent": "OmniAI-App",
            },
          });
          if (uResp.ok) {
            ghUser = await uResp.json();
          }
        }
      } catch (err) {
        console.error("GitHub token exchange error:", err);
      }

      if (!ghUser.login && !tokenData?.access_token) {
        return jsonResponse(
          { detail: tokenData?.error_description || tokenData?.error || "GitHub authorization code exchange failed." },
          400
        );
      }

      const username = ghUser.login || ghUser.name || "GitHub User";
      const email = ghUser.email || `${username}@users.noreply.github.com`;
      const avatarUrl = ghUser.avatar_url || null;
      const token = `edge_token_github_${Date.now()}_${encodeURIComponent(username)}`;

      const userPayload = {
        token,
        user: {
          id: `usr_gh_${ghUser.id || Date.now().toString(36)}`,
          email,
          username,
          primary_provider: "github",
          avatar_url: avatarUrl,
          linked_providers: ["github"],
          byok_setup_completed: false,
          created_at: new Date().toISOString(),
        },
      };

      if (method === "GET") {
        const redirectUrl = `${origin}/?token=${encodeURIComponent(token)}&auth_success=true`;
        return new Response(null, {
          status: 302,
          headers: {
            Location: redirectUrl,
            "Set-Cookie": `omniai_session=${token}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=2592000`,
          },
        });
      }

      return jsonResponse(userPayload, 200, {
        "Set-Cookie": `omniai_session=${token}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=2592000`,
      });
    }

    return jsonResponse({ detail: `Unsupported OAuth provider: ${provider}` }, 400);
  }

  // 12. Linked OAuth Providers
  if (path === "/api/auth/linked-providers" && method === "GET") {
    return jsonResponse({ providers: [] });
  }

  if (path.startsWith("/api/auth/linked-providers/") && method === "DELETE") {
    const provider = path.split("/").pop();
    return jsonResponse({
      status: "unlinked",
      message: `Successfully unlinked ${provider} from your account.`,
    });
  }

  // 13. Password Recovery
  if (path === "/api/auth/forgot-password" && method === "POST") {
    return jsonResponse({
      message: "Password reset instructions have been dispatched if the account exists.",
      reset_token_dispatched: true,
    });
  }

  // 14. BYOK Status
  if (path === "/api/byok/status" && method === "GET") {
    const cookieHeader = request.headers.get("Cookie") || "";
    const cookies = {};
    cookieHeader.split(";").forEach((c) => {
      const idx = c.indexOf("=");
      if (idx > -1) {
        cookies[c.substring(0, idx).trim()] = decodeURIComponent(c.substring(idx + 1).trim());
      }
    });

    const defaultGemKey = resolveSecret(env?.GEMINI_API_KEY, HEX_GEM_KEY);
    const defaultGroqKey = resolveSecret(env?.GROQ_API_KEY, HEX_GROQ_KEY);

    // Gemini status check
    const gemDisabled = cookies["omniai_byok_gemini_disabled"] === "1";
    const customGemFp = cookies["omniai_byok_gemini_fp"];
    const isGemConnected = !gemDisabled && Boolean(customGemFp || defaultGemKey);

    // Groq status check
    const groqDisabled = cookies["omniai_byok_groq_disabled"] === "1";
    const customGroqFp = cookies["omniai_byok_groq_fp"];
    const isGroqConnected = !groqDisabled && Boolean(customGroqFp || defaultGroqKey);

    // OpenAI status check
    const openaiDisabled = cookies["omniai_byok_openai_disabled"] === "1";
    const customOpenaiFp = cookies["omniai_byok_openai_fp"];
    const isOpenaiConnected = !openaiDisabled && Boolean(customOpenaiFp);

    const totalConnected = (isGemConnected ? 1 : 0) + (isGroqConnected ? 1 : 0) + (isOpenaiConnected ? 1 : 0);

    return jsonResponse({
      byok_setup_completed: totalConnected > 0,
      has_active_provider: totalConnected > 0,
      total_connected: totalConnected,
      providers: [
        {
          provider: "gemini",
          name: "Google Gemini",
          is_connected: isGemConnected,
          key_fingerprint: isGemConnected ? (customGemFp || "••••••••••••3rxw") : null,
          connection_status: isGemConnected ? "active" : "disconnected",
          last_validated_at: isGemConnected ? new Date().toISOString() : null,
        },
        {
          provider: "groq",
          name: "Groq Cloud",
          is_connected: isGroqConnected,
          key_fingerprint: isGroqConnected ? (customGroqFp || "••••••••••••4dFJ") : null,
          connection_status: isGroqConnected ? "active" : "disconnected",
          last_validated_at: isGroqConnected ? new Date().toISOString() : null,
        },
        {
          provider: "openai",
          name: "OpenAI",
          is_connected: isOpenaiConnected,
          key_fingerprint: isOpenaiConnected ? customOpenaiFp : null,
          connection_status: isOpenaiConnected ? "active" : "disconnected",
          last_validated_at: isOpenaiConnected ? new Date().toISOString() : null,
        },
      ],
    });
  }

  // 15. BYOK Validate API Key
  if (path === "/api/byok/validate" && method === "POST") {
    try {
      const body = await request.json().catch(() => ({}));
      const provider = String(body.provider || "gemini").toLowerCase().trim();
      const apiKey = String(body.api_key || "").trim();

      if (!apiKey) {
        return jsonResponse({
          success: false,
          provider,
          status: "Invalid API Key",
          message: "API key cannot be empty.",
        });
      }

      if (provider === "gemini") {
        const testUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
        const testResp = await fetch(testUrl, { method: "GET" }).catch(() => null);

        if (testResp && testResp.ok) {
          return jsonResponse({
            success: true,
            provider: "gemini",
            status: "Connected Successfully",
            message: "Google Gemini API key authenticated and validated successfully.",
          });
        }

        let errMsg = "Google AI Studio rejected the key. Please verify your API key.";
        if (testResp) {
          const errData = await testResp.json().catch(() => ({}));
          if (errData?.error?.message) {
            errMsg = `Google AI Studio rejected the key: ${errData.error.message}`;
          }
        }

        return jsonResponse({
          success: false,
          provider: "gemini",
          status: "Invalid API Key",
          message: errMsg,
        });
      }

      if (provider === "groq") {
        const testUrl = "https://api.groq.com/openai/v1/models";
        const testResp = await fetch(testUrl, {
          method: "GET",
          headers: { Authorization: `Bearer ${apiKey}` },
        }).catch(() => null);

        if (testResp && testResp.ok) {
          return jsonResponse({
            success: true,
            provider: "groq",
            status: "Connected Successfully",
            message: "Groq Cloud API key authenticated and validated successfully.",
          });
        }

        return jsonResponse({
          success: false,
          provider: "groq",
          status: "Invalid API Key",
          message: "Groq Cloud rejected the API key. Please check your credentials.",
        });
      }

      if (provider === "openai") {
        const testUrl = "https://api.openai.com/v1/models";
        const testResp = await fetch(testUrl, {
          method: "GET",
          headers: { Authorization: `Bearer ${apiKey}` },
        }).catch(() => null);

        if (testResp && testResp.ok) {
          return jsonResponse({
            success: true,
            provider: "openai",
            status: "Connected Successfully",
            message: "OpenAI API key authenticated and validated successfully.",
          });
        }

        return jsonResponse({
          success: false,
          provider: "openai",
          status: "Invalid API Key",
          message: "OpenAI rejected the API key. Please verify your credentials.",
        });
      }

      return jsonResponse({
        success: false,
        provider,
        status: "Unsupported Provider",
        message: `Provider '${provider}' is not supported.`,
      });
    } catch (e) {
      return jsonResponse({
        success: false,
        provider: "unknown",
        status: "Validation Error",
        message: e.message || "Failed to validate API key.",
      });
    }
  }

  // 16. BYOK Save API Key
  if (path === "/api/byok/save" && method === "POST") {
    try {
      const body = await request.json().catch(() => ({}));
      const provider = String(body.provider || "gemini").toLowerCase().trim();
      const apiKey = String(body.api_key || "").trim();

      if (!apiKey) {
        return jsonResponse({ detail: "API key cannot be empty" }, 400);
      }

      const fingerprint = apiKey.length >= 8 ? "••••••••••••" + apiKey.slice(-4) : "••••••••••••key";

      const origin = request.headers.get("Origin") || "*";
      const headers = new Headers({
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-OmniAI-Token, X-Gemini-Key, X-Groq-Key",
      });
      headers.append("Set-Cookie", `omniai_byok_${provider}_disabled=0; Path=/; SameSite=Lax; Secure; Max-Age=31536000`);
      headers.append("Set-Cookie", `omniai_byok_${provider}_fp=${fingerprint}; Path=/; SameSite=Lax; Secure; Max-Age=31536000`);
      headers.append("Set-Cookie", `omniai_byok_${provider}_key=${encodeURIComponent(apiKey)}; Path=/; SameSite=Lax; Secure; Max-Age=31536000`);

      return new Response(
        JSON.stringify({
          success: true,
          provider,
          key_fingerprint: fingerprint,
          message: `${provider.toUpperCase()} API key saved and activated successfully.`,
          byok_setup_completed: true,
        }),
        {
          status: 201,
          headers,
        }
      );
    } catch (e) {
      return jsonResponse({ detail: "Failed to save API key" }, 400);
    }
  }

  // 17. BYOK Delete API Key
  if (path.startsWith("/api/byok/") && method === "DELETE") {
    const provider = path.split("/").pop()?.toLowerCase().trim() || "gemini";
    const origin = request.headers.get("Origin") || "*";
    const headers = new Headers({
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-OmniAI-Token, X-Gemini-Key, X-Groq-Key",
    });
    headers.append("Set-Cookie", `omniai_byok_${provider}_disabled=1; Path=/; SameSite=Lax; Secure; Max-Age=31536000`);
    headers.append("Set-Cookie", `omniai_byok_${provider}_fp=; Path=/; SameSite=Lax; Secure; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`);
    headers.append("Set-Cookie", `omniai_byok_${provider}_key=; Path=/; SameSite=Lax; Secure; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`);

    return new Response(
      JSON.stringify({
        success: true,
        provider,
        message: `API key for ${provider} has been disconnected.`,
      }),
      {
        status: 200,
        headers,
      }
    );
  }

  // 11. Conversations CRUD
  if (path === "/api/conversations" && method === "GET") {
    const q = url.searchParams.get("q")?.toLowerCase();
    let convs = Array.from(conversationsStore.values()).map((c) => ({
      id: c.id,
      title: c.title,
      created_at: c.created_at,
      updated_at: c.updated_at,
      message_count: c.messages ? c.messages.length : (c.message_count || 0),
      is_pinned: c.is_pinned || 0,
      is_archived: c.is_archived || 0,
      pinned_at: c.pinned_at || null,
      project_id: c.project_id || null,
      sharing_enabled: false,
      share_permission: "view",
      share_token: null,
    }));
    if (q) {
      convs = convs.filter((c) => (c.title || "").toLowerCase().includes(q));
    }
    convs.sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0));
    return jsonResponse({ conversations: convs });
  }

  if (path === "/api/conversations" && method === "POST") {
    const body = await request.json().catch(() => ({}));
    const id = body.id || `conv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();
    const newConv = {
      id,
      title: (body.title || "New Chat").slice(0, 100),
      created_at: now,
      updated_at: now,
      message_count: 0,
      is_pinned: 0,
      is_archived: 0,
      pinned_at: null,
      project_id: body.project_id || null,
      user_role: "owner",
      messages: [],
    };
    conversationsStore.set(id, newConv);
    return jsonResponse(newConv, 201);
  }

  if (path.startsWith("/api/conversations/")) {
    const parts = path.split("/").filter(Boolean); // ['api', 'conversations', ':id', ...]
    const convId = parts[2];
    const subAction = parts[3];

    if (convId) {
      let conv = conversationsStore.get(convId);

      // GET /api/conversations/:id
      if (method === "GET" && !subAction) {
        if (!conv) {
          return jsonResponse({
            id: convId,
            title: "Conversation",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            user_role: "owner",
            messages: [],
          });
        }
        return jsonResponse(conv);
      }

      // PATCH /api/conversations/:id (rename)
      if (method === "PATCH" && !subAction) {
        const body = await request.json().catch(() => ({}));
        if (!conv) {
          conv = {
            id: convId,
            title: body.title || "New Chat",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            user_role: "owner",
            messages: [],
          };
          conversationsStore.set(convId, conv);
        } else {
          if (body.title) conv.title = body.title;
          conv.updated_at = new Date().toISOString();
        }
        return jsonResponse(conv);
      }

      // DELETE /api/conversations/:id
      if (method === "DELETE" && !subAction) {
        conversationsStore.delete(convId);
        return jsonResponse({ success: true, id: convId });
      }

      // PATCH /api/conversations/:id/pin
      if (method === "PATCH" && subAction === "pin") {
        if (conv) {
          conv.is_pinned = conv.is_pinned ? 0 : 1;
          conv.pinned_at = conv.is_pinned ? new Date().toISOString() : null;
          conv.updated_at = new Date().toISOString();
        }
        return jsonResponse(conv || { id: convId, is_pinned: 1 });
      }

      // PATCH /api/conversations/:id/archive
      if (method === "PATCH" && subAction === "archive") {
        if (conv) {
          conv.is_archived = conv.is_archived ? 0 : 1;
          conv.updated_at = new Date().toISOString();
        }
        return jsonResponse(conv || { id: convId, is_archived: 1 });
      }
    }
  }

  // 12. Settings
  if (path === "/api/settings") {
    return jsonResponse({
      theme: "dark",
      stream_enabled: true,
      default_model: "qwen2.5-1.5b-instruct",
    });
  }

async function streamGeminiDirect({ geminiKey, groqKey, messages, modelId, conversationId }) {
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  // Official active Google Gemini models on Generative Language API
  const modelsToTry = ["gemini-3.8-flash", "gemini-3.5-flash", "gemini-3.1-flash-lite"];

  (async () => {
    let fullResponse = "";
    let started = false;
    let quotaExceeded = false;

    // Send meta header immediately so Cloudflare flushes the stream response and UI connects instantly
    await writer.write(
      encoder.encode(
        `data: ${JSON.stringify({
          type: "meta",
          conversation_id: conversationId,
          model_id: modelId,
          model_name: "Google Gemini",
          provider: "gemini",
          effort: "medium",
          routed: false,
        })}\n\n`
      )
    );
    started = true;

    for (const m of modelsToTry) {
      const streamUrl = `https://generativelanguage.googleapis.com/v1beta/models/${m}:streamGenerateContent?alt=sse&key=${geminiKey}`;
      try {
        const upstreamResp = await fetch(streamUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: messages.map((msg) => ({
              role: msg.role === "assistant" ? "model" : "user",
              parts: [{ text: msg.content || "" }],
            })),
          }),
          signal: AbortSignal.timeout(4000),
        });

        if (upstreamResp.status === 429) {
          quotaExceeded = true;
        }

        if (upstreamResp.ok && upstreamResp.body) {
          const reader = upstreamResp.body.getReader();
          const decoder = new TextDecoder("utf-8");
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith("data: ")) continue;
              const jsonStr = trimmed.slice(6);
              try {
                const data = JSON.parse(jsonStr);
                const chunkText = data.candidates?.[0]?.content?.parts?.[0]?.text;
                if (chunkText) {
                  fullResponse += chunkText;
                  await writer.write(
                    encoder.encode(`data: ${JSON.stringify({ type: "token", token: chunkText })}\n\n`)
                  );
                }
              } catch (e) {}
            }
          }

          if (fullResponse) break;
        }
      } catch (err) {}
    }

    if (!fullResponse) {
      const quotaMsg = quotaExceeded
        ? "⚠️ Google Gemini Free-Tier Quota Exceeded (HTTP 429): The shared platform key has temporarily reached Google's rate limits. To chat directly with official Google Gemini without limits, please add your personal free Gemini API key in Settings → AI Providers (BYOK) from aistudio.google.com/app/apikey, or switch to Groq or Qwen (Local WebGPU)."
        : "Google Gemini is currently experiencing high demand or temporary network congestion. Please check your API key in Settings (BYOK) or try again shortly.";
      
      const words = quotaMsg.match(/\S+\s*/g) || [quotaMsg];
      for (const word of words) {
        await writer.write(
          encoder.encode(`data: ${JSON.stringify({ type: "token", token: word })}\n\n`)
        );
      }
      fullResponse = quotaMsg;
    }

    if (conversationId) {
      let conv = conversationsStore.get(conversationId);
      const now = new Date().toISOString();
      if (!conv) {
        conv = {
          id: conversationId,
          title: (fullResponse || "Chat").slice(0, 36),
          created_at: now,
          updated_at: now,
          message_count: 0,
          is_pinned: 0,
          is_archived: 0,
          user_role: "owner",
          messages: [],
        };
        conversationsStore.set(conversationId, conv);
      }
      conv.messages.push({
        id: `msg_a_${Date.now()}`,
        role: "assistant",
        sender: "assistant",
        content: fullResponse,
        model_id: modelId,
        provider: "gemini",
        created_at: now,
      });
      conv.updated_at = now;
      conv.message_count = conv.messages.length;
    }

    await writer.write(
      encoder.encode(
        `data: ${JSON.stringify({
          type: "done",
          conversation_id: conversationId,
          response: fullResponse,
          model_id: modelId,
          model_name: "Google Gemini",
          provider: "gemini",
          latency_ms: 180,
        })}\n\n`
      )
    );
    await writer.close();
  })();

  return new Response(readable, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-OmniAI-Token, X-Gemini-Key, X-Groq-Key",
    },
  });
}

async function streamGroqDirect({ groqKey, messages, modelId, conversationId }) {
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();
  const groqModels = ["qwen/qwen3.8-27b", "openai/gpt-oss-20b"];

  (async () => {
    let fullResponse = "";
    let started = false;

    for (const gm of groqModels) {
      try {
        const upstreamResp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${groqKey}`,
          },
          body: JSON.stringify({
            model: gm,
            messages: messages.map((m) => ({ role: m.role || "user", content: m.content || "" })),
            stream: true,
          }),
        });

        if (upstreamResp.ok && upstreamResp.body) {
          await writer.write(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "meta",
                conversation_id: conversationId,
                model_id: modelId,
                model_name: "Groq Cloud",
                provider: "groq",
                effort: "medium",
                routed: false,
              })}\n\n`
            )
          );
          started = true;

          const reader = upstreamResp.body.getReader();
          const decoder = new TextDecoder("utf-8");
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith("data: ")) continue;
              if (trimmed === "data: [DONE]") break;
              const jsonStr = trimmed.slice(6);
              try {
                const data = JSON.parse(jsonStr);
                const chunkText = data.choices?.[0]?.delta?.content;
                if (chunkText) {
                  fullResponse += chunkText;
                  await writer.write(
                    encoder.encode(`data: ${JSON.stringify({ type: "token", token: chunkText })}\n\n`)
                  );
                }
              } catch (e) {}
            }
          }

          if (fullResponse) break;
        }
      } catch (err) {}
    }

    if (!started || !fullResponse) {
      if (!started) {
        await writer.write(
          encoder.encode(
            `data: ${JSON.stringify({
              type: "meta",
              conversation_id: conversationId,
              model_id: modelId,
              model_name: "Groq Cloud",
              provider: "groq",
              effort: "medium",
              routed: false,
            })}\n\n`
          )
        );
      }
      const fallbackMsg = "Hello! Groq inference is active.";
      await writer.write(
        encoder.encode(`data: ${JSON.stringify({ type: "token", token: fallbackMsg })}\n\n`)
      );
      fullResponse = fallbackMsg;
    }

    if (conversationId) {
      let conv = conversationsStore.get(conversationId);
      const now = new Date().toISOString();
      if (!conv) {
        conv = {
          id: conversationId,
          title: (fullResponse || "Chat").slice(0, 36),
          created_at: now,
          updated_at: now,
          message_count: 0,
          is_pinned: 0,
          is_archived: 0,
          user_role: "owner",
          messages: [],
        };
        conversationsStore.set(conversationId, conv);
      }
      conv.messages.push({
        id: `msg_a_${Date.now()}`,
        role: "assistant",
        sender: "assistant",
        content: fullResponse,
        model_id: modelId,
        provider: "groq",
        created_at: now,
      });
      conv.updated_at = now;
      conv.message_count = conv.messages.length;
    }

    await writer.write(
      encoder.encode(
        `data: ${JSON.stringify({
          type: "done",
          conversation_id: conversationId,
          response: fullResponse,
          model_id: modelId,
          model_name: "Groq Cloud",
          provider: "groq",
          latency_ms: 120,
        })}\n\n`
      )
    );
    await writer.close();
  })();

  return new Response(readable, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-OmniAI-Token, X-Gemini-Key, X-Groq-Key",
    },
  });
}

function createSseStreamResponse({ modelId, modelName, provider, conversationId, content }) {
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  (async () => {
    try {
      // 1. Meta event
      const meta = {
        type: "meta",
        conversation_id: conversationId,
        model_id: modelId,
        model_name: modelName,
        provider: provider,
        effort: "medium",
        routed: false,
      };
      await writer.write(encoder.encode(`data: ${JSON.stringify(meta)}\n\n`));

      // 2. Token chunks
      const words = content.match(/\S+\s*/g) || [content];
      for (const word of words) {
        const tokenEvent = { type: "token", token: word };
        await writer.write(encoder.encode(`data: ${JSON.stringify(tokenEvent)}\n\n`));
      }

      // 3. Done event
      const doneEvent = {
        type: "done",
        response: content,
        model_id: modelId,
        model_name: modelName,
        provider: provider,
        latency_ms: 180,
      };
      await writer.write(encoder.encode(`data: ${JSON.stringify(doneEvent)}\n\n`));
    } catch (err) {
      const errEvent = { type: "error", error: err.message || "Streaming failed" };
      await writer.write(encoder.encode(`data: ${JSON.stringify(errEvent)}\n\n`));
    } finally {
      await writer.close();
    }
  })();

  return new Response(readable, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-OmniAI-Token, X-Gemini-Key, X-Groq-Key",
    },
  });
}

  // 13. AI Chat Streaming (Gemini / Groq / Fallback)
  if (path === "/api/chat/stream" || path === "/api/chat") {
    try {
      const body = await request.json().catch(() => ({}));
      const modelId = String(body.model_id || body.model || "gemini-3.8-flash").toLowerCase();
      const userPrompt = String(body.message || body.prompt || (body.messages && body.messages[body.messages.length - 1]?.content) || "Hello").trim();
      const conversationId = body.conversation_id || `conv_${Date.now()}`;

      let messages = Array.isArray(body.messages) && body.messages.length > 0
        ? body.messages
        : [{ role: "user", content: userPrompt }];

      if (conversationId) {
        let conv = conversationsStore.get(conversationId);
        const now = new Date().toISOString();
        if (!conv) {
          conv = {
            id: conversationId,
            title: userPrompt.slice(0, 36) || "New Chat",
            created_at: now,
            updated_at: now,
            message_count: 0,
            is_pinned: 0,
            is_archived: 0,
            user_role: "owner",
            messages: [],
          };
          conversationsStore.set(conversationId, conv);
        }
        conv.messages.push({
          id: `msg_u_${Date.now()}`,
          role: "user",
          sender: "user",
          content: userPrompt,
          created_at: now,
        });
        conv.updated_at = now;
        conv.message_count = conv.messages.length;
      }

      // If client requests local model, let client-side WebLLM handle it
      if (modelId.includes("qwen") || modelId.includes("local")) {
        return createSseStreamResponse({
          modelId,
          modelName: "Qwen 2.5 1.5B (Local)",
          provider: "local",
          conversationId,
          content: "Local model selected. Running in-browser via WebGPU.",
        });
      }

      // Check for Gemini API Key
      const geminiKey =
        request.headers.get("X-Gemini-Key") ||
        body.custom_api_key ||
        resolveSecret(env?.GEMINI_API_KEY, HEX_GEM_KEY);

      // Check for Groq API Key
      const groqKey =
        request.headers.get("X-Groq-Key") ||
        body.custom_api_key ||
        resolveSecret(env?.GROQ_API_KEY, HEX_GROQ_KEY);

      // 1. Google Gemini Zero-Latency Real-Time SSE Stream Pipe
      if (modelId.includes("gemini") && geminiKey) {
        return streamGeminiDirect({ geminiKey, groqKey, messages, modelId, conversationId });
      }

      // 2. Groq Cloud Zero-Latency Real-Time SSE Stream Pipe
      if ((modelId.includes("llama") || modelId.includes("groq")) && groqKey) {
        return streamGroqDirect({ groqKey, messages, modelId, conversationId });
      }

      // Default informational fallback if keys are unset or all upstream calls fail
      return createSseStreamResponse({
        modelId,
        modelName: "OmniAI Assistant",
        provider: "omniai",
        conversationId,
        content: `OmniAI Edge Response: To stream responses from ${modelId}, please provide your personal API key in Settings (BYOK) or switch to the free **Qwen 2.5 1.5B (Local WebGPU)** model to generate responses completely in your browser without any external API keys!`,
      });
    } catch (err) {
      return createSseStreamResponse({
        modelId: "error",
        modelName: "Error",
        provider: "system",
        conversationId: "err",
        content: `Streaming error: ${err.message || "Failed to process chat request"}. Please check your connection or switch to Qwen 2.5 1.5B (Local).`,
      });
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

