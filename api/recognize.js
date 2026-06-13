/* ============================================================
   Serverless proxy for AI meal recognition (Vercel Node function)

   POST /api/recognize
     body: { provider: "claude"|"gemini"|"openai",
             images: [{ mime, base64 }, ...] }
     ->   { ok: true, text: "<JSON string from the model>" }
     err: { ok: false, code, error }   (HTTP 4xx/5xx)

   API keys are read from environment variables — never from the client:
     ANTHROPIC_API_KEY   (Claude)
     GEMINI_API_KEY      (Gemini)
     OPENAI_API_KEY      (OpenAI)
   Optional model overrides:
     CLAUDE_MODEL, GEMINI_MODEL, OPENAI_MODEL
   ============================================================ */

const heicConvert = require("heic-convert");

const KEY_ENV = {
  claude: "ANTHROPIC_API_KEY",
  gemini: "GEMINI_API_KEY",
  openai: "OPENAI_API_KEY",
};

const DEFAULT_MODELS = {
  claude: "claude-opus-4-8",
  gemini: "gemini-2.5-flash",
  openai: "gpt-4o",
};

const LABEL = { claude: "Claude", gemini: "Gemini", openai: "OpenAI" };

function modelFor(provider) {
  return process.env[`${provider.toUpperCase()}_MODEL`] || DEFAULT_MODELS[provider];
}

const EXTRACT_PROMPT = `You are reading an airline catering galley sheet / in-flight meal menu image.
Extract the "1st Meal" and "2nd Meal" information.

Return ONLY a valid JSON object, no markdown, no commentary, in exactly this shape:
{
  "first":  { "dishes": [ { "kr": "", "en": "" } ], "aBowl": "", "dBowl": "" },
  "second": { "dishes": [ { "kr": "", "en": "" } ], "aBowl": "", "dBowl": "" }
}

Rules:
- "kr" = Korean dish name (main dish line, without a leading dash).
- "en" = the English translation, WITHOUT the surrounding parentheses. Empty string if none.
- "aBowl" = the item after "A bowl :". "dBowl" = item after "D bowl :". Empty string if absent.
- Each meal usually has 1-3 main dishes in "dishes".
- If a meal is not present in the image, return it with an empty dishes array and empty bowls.
- Output JSON only.`;

/* Detect HEIC/HEIF by container brand in the first bytes (mime can be missing/wrong). */
function looksLikeHeic(buf) {
  if (buf.length < 12) return false;
  if (buf.toString("ascii", 4, 8) !== "ftyp") return false;
  const brand = buf.toString("ascii", 8, 12).toLowerCase();
  return ["heic", "heix", "heif", "hevc", "mif1", "msf1", "heim", "heis"].includes(brand);
}

/* Convert any HEIC/HEIF images to JPEG; pass other images through unchanged. */
async function prepareImages(images) {
  const out = [];
  for (const im of images) {
    const buf = Buffer.from(im.base64 || "", "base64");
    const isHeic = /heic|heif/i.test(im.mime || "") || looksLikeHeic(buf);
    if (isHeic) {
      try {
        const jpeg = await heicConvert({ buffer: buf, format: "JPEG", quality: 0.9 });
        out.push({ mime: "image/jpeg", base64: Buffer.from(jpeg).toString("base64") });
      } catch (e) {
        const err = new Error("HEIC 이미지를 변환하지 못했습니다. JPEG/PNG로 다시 시도해 주세요.");
        err.code = "HEIC_CONVERT_FAILED";
        throw err;
      }
    } else {
      out.push({ mime: im.mime, base64: im.base64 });
    }
  }
  return out;
}

/* Build an Error tagged with a code; INVALID_KEY -> 401 to the client */
function providerError(status, bodyText, name) {
  const e = new Error();
  if (status === 401 || status === 403) {
    e.code = "INVALID_KEY";
    e.message = `${name} API 키가 유효하지 않습니다. (서버 환경변수를 확인하세요)`;
  } else {
    e.code = "PROVIDER_ERROR";
    e.message = `${name} API 오류 (${status}): ${String(bodyText).slice(0, 200)}`;
  }
  return e;
}

async function callClaude(key, model, images) {
  const content = [
    ...images.map((im) => ({
      type: "image",
      source: { type: "base64", media_type: im.mime, data: im.base64 },
    })),
    { type: "text", text: EXTRACT_PROMPT },
  ];
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model, max_tokens: 2000, messages: [{ role: "user", content }] }),
  });
  if (!r.ok) throw providerError(r.status, await r.text(), "Claude");
  const j = await r.json();
  return (j.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
}

async function callGemini(key, model, images) {
  const parts = [
    ...images.map((im) => ({ inline_data: { mime_type: im.mime, data: im.base64 } })),
    { text: EXTRACT_PROMPT },
  ];
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(key)}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { responseMimeType: "application/json", temperature: 0 },
    }),
  });
  if (!r.ok) {
    const t = await r.text();
    if (r.status === 400 && /API_KEY_INVALID|API key not valid/i.test(t)) {
      const e = new Error("Gemini API 키가 유효하지 않습니다. (서버 환경변수를 확인하세요)");
      e.code = "INVALID_KEY";
      throw e;
    }
    throw providerError(r.status, t, "Gemini");
  }
  const j = await r.json();
  return (j.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("\n");
}

async function callOpenAI(key, model, images) {
  const content = [
    { type: "text", text: EXTRACT_PROMPT },
    ...images.map((im) => ({
      type: "image_url",
      image_url: { url: `data:${im.mime};base64,${im.base64}` },
    })),
  ];
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer " + key },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content }],
      max_tokens: 2000,
      temperature: 0,
      response_format: { type: "json_object" },
    }),
  });
  if (!r.ok) throw providerError(r.status, await r.text(), "OpenAI");
  const j = await r.json();
  return j.choices?.[0]?.message?.content || "";
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, code: "METHOD", error: "POST only" });
  }

  // Vercel auto-parses JSON bodies; guard for string bodies just in case.
  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch (_) { body = null; }
  }
  const provider = body?.provider;
  const images = body?.images;

  if (!provider || !KEY_ENV[provider]) {
    return res.status(400).json({ ok: false, code: "BAD_PROVIDER", error: "알 수 없는 AI 도구입니다." });
  }
  if (!Array.isArray(images) || images.length === 0) {
    return res.status(400).json({ ok: false, code: "NO_IMAGE", error: "분석할 이미지가 없습니다." });
  }

  const key = process.env[KEY_ENV[provider]];
  if (!key) {
    return res.status(400).json({
      ok: false,
      code: "NO_KEY",
      error: `${LABEL[provider]} API 키가 서버에 설정되지 않았습니다. (환경변수 ${KEY_ENV[provider]} 필요)`,
    });
  }

  const model = modelFor(provider);
  try {
    const prepared = await prepareImages(images); // HEIC/HEIF -> JPEG
    let text;
    if (provider === "claude") text = await callClaude(key, model, prepared);
    else if (provider === "gemini") text = await callGemini(key, model, prepared);
    else text = await callOpenAI(key, model, prepared);
    return res.status(200).json({ ok: true, text });
  } catch (e) {
    const code = e.code || "PROVIDER_ERROR";
    const status = code === "INVALID_KEY" ? 401 : code === "HEIC_CONVERT_FAILED" ? 400 : 502;
    return res.status(status).json({ ok: false, code, error: e.message || String(e) });
  }
};
