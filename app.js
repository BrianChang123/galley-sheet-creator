"use strict";

/* ============================================================
   Galley Sheet Creator
   - Form input for an airline catering galley sheet
   - AI meal recognition from images (Claude or Gemini)
   - Styled Excel (.xlsx) export matching the printed layout
   ============================================================ */

const LS_KEY = "galleySheet.v1";
const LS_KEY_SECRET = "galleySheet.secret.v1"; // apiKey/model/provider kept separate

/* ---------- Default model per provider ---------- */
const DEFAULT_MODELS = {
  claude: "claude-opus-4-8",
  gemini: "gemini-2.5-flash",
  openai: "gpt-4o",
};

/* ---------- DOM helpers ---------- */
const $ = (id) => document.getElementById(id);
const els = {
  title: $("title"),
  pax: $("pax"),
  provider: $("provider"),
  model: $("model"),
  apiKey: $("apiKey"),
  mealImages: $("mealImages"),
  thumbs: $("thumbs"),
  recognizeBtn: $("recognizeBtn"),
  clearImgBtn: $("clearImgBtn"),
  aiStatus: $("aiStatus"),
  dishes1: $("dishes1"),
  dishes2: $("dishes2"),
  aBowl1: $("aBowl1"),
  dBowl1: $("dBowl1"),
  aBowl2: $("aBowl2"),
  dBowl2: $("dBowl2"),
  ssr: $("ssr"),
  noMeal: $("noMeal"),
  paxNote: $("paxNote"),
  gate: $("gate"),
  exportBtn: $("exportBtn"),
};

/* ---------- In-memory state ---------- */
let uploadedImages = []; // [{ name, mime, dataUrl, base64 }]

/* dishes state lives in the DOM; helpers below read/write it */

/* ============================================================
   Dish rows (dynamic kr/en pairs)
   ============================================================ */
function makeDishRow(meal, kr = "", en = "") {
  const wrap = document.createElement("div");
  wrap.className = "dish";
  wrap.innerHTML = `
    <input type="text" class="dish-kr" placeholder="한글 요리명" />
    <input type="text" class="dish-en" placeholder="English name" />
    <button class="btn icon" title="삭제" type="button">✕</button>`;
  wrap.querySelector(".dish-kr").value = kr;
  wrap.querySelector(".dish-en").value = en;
  wrap.querySelectorAll("input").forEach((i) => i.addEventListener("input", onChange));
  wrap.querySelector("button").addEventListener("click", () => {
    wrap.remove();
    onChange();
  });
  (meal === 1 ? els.dishes1 : els.dishes2).appendChild(wrap);
  return wrap;
}

function readDishes(meal) {
  const container = meal === 1 ? els.dishes1 : els.dishes2;
  return [...container.querySelectorAll(".dish")]
    .map((d) => ({
      kr: d.querySelector(".dish-kr").value.trim(),
      en: d.querySelector(".dish-en").value.trim(),
    }))
    .filter((d) => d.kr || d.en);
}

function setDishes(meal, dishes) {
  const container = meal === 1 ? els.dishes1 : els.dishes2;
  container.innerHTML = "";
  (dishes && dishes.length ? dishes : [{ kr: "", en: "" }]).forEach((d) =>
    makeDishRow(meal, d.kr || "", d.en || "")
  );
}

document.querySelectorAll("[data-add]").forEach((btn) =>
  btn.addEventListener("click", () => {
    makeDishRow(Number(btn.dataset.add));
    onChange();
  })
);

/* ============================================================
   Read full form -> data model
   ============================================================ */
function getModel() {
  return {
    title: els.title.value.trim() || "YP132",
    pax: els.pax.value.trim(),
    first: { dishes: readDishes(1), aBowl: els.aBowl1.value.trim(), dBowl: els.dBowl1.value.trim() },
    second: { dishes: readDishes(2), aBowl: els.aBowl2.value.trim(), dBowl: els.dBowl2.value.trim() },
    ssr: els.ssr.value,
    noMeal: els.noMeal.value,
    paxNote: els.paxNote.value,
    gate: els.gate.value,
  };
}

/* ============================================================
   Build MEAL text block (lines) for preview + Excel
   Each line: { text, bold, en }
   ============================================================ */
function buildMealLines(model) {
  const lines = [];
  const addMeal = (header, meal) => {
    lines.push({ text: header, bold: true });
    meal.dishes.forEach((d) => {
      if (d.kr) lines.push({ text: "-" + d.kr });
      if (d.en) lines.push({ text: "(" + d.en + ")", en: true });
    });
    if (meal.aBowl) lines.push({ text: "A bowl : " + meal.aBowl });
    if (meal.dBowl) lines.push({ text: "D bowl : " + meal.dBowl });
  };
  addMeal("1st Meal", model.first);
  addMeal("2nd Meal", model.second);
  return lines;
}

/* ============================================================
   Live preview
   ============================================================ */
function renderPreview() {
  const m = getModel();
  $("pvTitle").textContent = m.title;
  $("pvPax").textContent = m.pax;

  const mealHtml = buildMealLines(m)
    .map((l) => {
      const cls = l.bold ? "mh" : l.en ? "en" : "";
      const esc = l.text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      return `<div class="${cls}">${esc}</div>`;
    })
    .join("");
  $("pvMeal").innerHTML = mealHtml;

  $("pvSsr").textContent = m.ssr;
  $("pvNoMeal").textContent = m.noMeal;
  $("pvPaxNote").textContent = m.paxNote;
  $("pvGate").textContent = m.gate;
}

/* ============================================================
   Persistence (localStorage)
   ============================================================ */
function save() {
  const m = getModel();
  localStorage.setItem(LS_KEY, JSON.stringify(m));
  localStorage.setItem(
    LS_KEY_SECRET,
    JSON.stringify({ provider: els.provider.value, model: els.model.value, apiKey: els.apiKey.value })
  );
}

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(LS_KEY_SECRET) || "{}");
    if (s.provider) els.provider.value = s.provider;
    if (s.model) els.model.value = s.model;
    if (s.apiKey) els.apiKey.value = s.apiKey;
  } catch (_) {}

  let m = null;
  try {
    m = JSON.parse(localStorage.getItem(LS_KEY) || "null");
  } catch (_) {}

  if (m) {
    els.title.value = m.title || "YP132";
    els.pax.value = m.pax || "";
    els.aBowl1.value = m.first?.aBowl || "";
    els.dBowl1.value = m.first?.dBowl || "";
    els.aBowl2.value = m.second?.aBowl || "";
    els.dBowl2.value = m.second?.dBowl || "";
    els.ssr.value = m.ssr || "";
    els.noMeal.value = m.noMeal || "";
    els.paxNote.value = m.paxNote || "";
    els.gate.value = m.gate || "";
    setDishes(1, m.first?.dishes);
    setDishes(2, m.second?.dishes);
  } else {
    setDishes(1, []);
    setDishes(2, []);
  }
}

let saveTimer = null;
function onChange() {
  renderPreview();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 400);
}

/* ============================================================
   Image upload handling
   ============================================================ */
function fileToImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const base64 = String(dataUrl).split(",")[1];
      resolve({ name: file.name, mime: file.type || "image/jpeg", dataUrl, base64 });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

els.mealImages.addEventListener("change", async (e) => {
  const files = [...e.target.files];
  for (const f of files) {
    try {
      uploadedImages.push(await fileToImage(f));
    } catch (_) {}
  }
  renderThumbs();
});

els.clearImgBtn.addEventListener("click", () => {
  uploadedImages = [];
  els.mealImages.value = "";
  renderThumbs();
  setStatus("", "");
});

function renderThumbs() {
  els.thumbs.innerHTML = uploadedImages.map((im) => `<img src="${im.dataUrl}" alt="${im.name}" />`).join("");
}

/* ============================================================
   AI meal recognition
   ============================================================ */
function setStatus(msg, kind) {
  els.aiStatus.textContent = msg;
  els.aiStatus.className = "ai-status" + (kind ? " " + kind : "");
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

async function recognizeMeals() {
  if (!uploadedImages.length) {
    setStatus("먼저 메뉴 이미지를 첨부하세요.", "err");
    return;
  }
  const apiKey = els.apiKey.value.trim();
  if (!apiKey) {
    setStatus("API Key를 입력하세요.", "err");
    return;
  }
  const provider = els.provider.value;
  const model = els.model.value.trim() || DEFAULT_MODELS[provider];

  els.recognizeBtn.disabled = true;
  setStatus("AI가 메뉴를 인식하는 중…", "busy");

  try {
    const text =
      provider === "claude"
        ? await callClaude(apiKey, model)
        : provider === "gemini"
        ? await callGemini(apiKey, model)
        : await callOpenAI(apiKey, model);

    const data = parseJsonLoose(text);
    applyExtraction(data);
    setStatus("✅ 인식 완료 — 필드를 확인/수정하세요.", "ok");
  } catch (err) {
    console.error(err);
    setStatus("오류: " + (err?.message || err), "err");
  } finally {
    els.recognizeBtn.disabled = false;
  }
}

/* ---- Claude (Anthropic Messages API, direct browser call) ---- */
async function callClaude(apiKey, model) {
  const content = [
    ...uploadedImages.map((im) => ({
      type: "image",
      source: { type: "base64", media_type: im.mime, data: im.base64 },
    })),
    { type: "text", text: EXTRACT_PROMPT },
  ];

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model,
      max_tokens: 2000,
      messages: [{ role: "user", content }],
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Claude API ${res.status}: ${t.slice(0, 300)}`);
  }
  const json = await res.json();
  return (json.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

/* ---- Gemini (Google Generative Language API, direct browser call) ---- */
async function callGemini(apiKey, model) {
  const parts = [
    ...uploadedImages.map((im) => ({
      inline_data: { mime_type: im.mime, data: im.base64 },
    })),
    { text: EXTRACT_PROMPT },
  ];

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { responseMimeType: "application/json", temperature: 0 },
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Gemini API ${res.status}: ${t.slice(0, 300)}`);
  }
  const json = await res.json();
  const cand = json.candidates?.[0];
  return (cand?.content?.parts || []).map((p) => p.text || "").join("\n");
}

/* ---- OpenAI (Chat Completions API, direct browser call) ---- */
async function callOpenAI(apiKey, model) {
  const content = [
    { type: "text", text: EXTRACT_PROMPT },
    ...uploadedImages.map((im) => ({
      type: "image_url",
      image_url: { url: im.dataUrl }, // data URL (base64) accepted directly
    })),
  ];

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer " + apiKey,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content }],
      max_tokens: 2000,
      temperature: 0,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OpenAI API ${res.status}: ${t.slice(0, 300)}`);
  }
  const json = await res.json();
  return json.choices?.[0]?.message?.content || "";
}

/* ---- Robust JSON parsing (strips code fences / surrounding prose) ---- */
function parseJsonLoose(text) {
  if (!text) throw new Error("AI 응답이 비어 있습니다.");
  let t = text.trim();
  // strip ```json ... ``` fences
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  // fallback: take from first { to last }
  if (!t.startsWith("{")) {
    const a = t.indexOf("{");
    const b = t.lastIndexOf("}");
    if (a >= 0 && b > a) t = t.slice(a, b + 1);
  }
  return JSON.parse(t);
}

function applyExtraction(data) {
  const norm = (meal) => ({
    dishes: Array.isArray(meal?.dishes)
      ? meal.dishes.map((d) => ({ kr: (d.kr || "").trim(), en: (d.en || "").trim() }))
      : [],
    aBowl: (meal?.aBowl || "").trim(),
    dBowl: (meal?.dBowl || "").trim(),
  });
  const first = norm(data.first);
  const second = norm(data.second);

  setDishes(1, first.dishes);
  els.aBowl1.value = first.aBowl;
  els.dBowl1.value = first.dBowl;
  setDishes(2, second.dishes);
  els.aBowl2.value = second.aBowl;
  els.dBowl2.value = second.dBowl;

  onChange();
}

els.recognizeBtn.addEventListener("click", recognizeMeals);

/* ============================================================
   Excel export (ExcelJS) — mirrors the printed sheet layout
   Grid: 4 columns (A..D). Borders, merges, bold headers, red text.
   ============================================================ */
const THIN = { style: "thin", color: { argb: "FF000000" } };
const ALL_BORDERS = { top: THIN, left: THIN, bottom: THIN, right: THIN };

function applyBorderToRange(ws, top, left, bottom, right) {
  for (let r = top; r <= bottom; r++) {
    for (let c = left; c <= right; c++) {
      ws.getCell(r, c).border = {
        top: r === top ? THIN : undefined,
        bottom: r === bottom ? THIN : undefined,
        left: c === left ? THIN : undefined,
        right: c === right ? THIN : undefined,
      };
    }
  }
}

async function exportExcel() {
  const m = getModel();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(m.title || "Galley Sheet", {
    pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 1, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } },
  });

  // Column widths (4 columns)
  ws.getColumn(1).width = 30;
  ws.getColumn(2).width = 12;
  ws.getColumn(3).width = 12;
  ws.getColumn(4).width = 40;

  const KR_FONT = { name: "Malgun Gothic" };

  /* ---- Row 1: Header  <TITLE>   PAX : N ---- */
  ws.mergeCells("A1:B1");
  ws.mergeCells("C1:D1");
  const titleCell = ws.getCell("A1");
  titleCell.value = `<${m.title}>`;
  titleCell.font = { ...KR_FONT, bold: true, size: 16 };
  titleCell.alignment = { vertical: "middle", horizontal: "left" };
  const paxCell = ws.getCell("C1");
  paxCell.value = `PAX : ${m.pax || ""}`;
  paxCell.font = { ...KR_FONT, bold: true, size: 16 };
  paxCell.alignment = { vertical: "middle", horizontal: "left" };
  ws.getRow(1).height = 30;

  /* ---- MEAL block: A2:C13 (left), D2:D13 open area ---- */
  const MEAL_TOP = 2, MEAL_BOTTOM = 13;
  ws.mergeCells(MEAL_TOP, 1, MEAL_BOTTOM, 3);
  ws.mergeCells(MEAL_TOP, 4, MEAL_BOTTOM, 4);
  for (let r = MEAL_TOP; r <= MEAL_BOTTOM; r++) ws.getRow(r).height = 16;

  const mealCell = ws.getCell(MEAL_TOP, 1);
  const richText = [{ text: "●MEAL\n", font: { ...KR_FONT, bold: true, size: 12 } }];
  buildMealLines(m).forEach((l) => {
    richText.push({
      text: l.text + "\n",
      font: { ...KR_FONT, bold: !!l.bold, size: l.en ? 9 : 10, color: { argb: "FF000000" } },
    });
  });
  mealCell.value = { richText };
  mealCell.alignment = { vertical: "top", horizontal: "left", wrapText: true };

  /* ---- Middle band: SSR + 미취식 (A14:C18) | PAX note (D14:D18) ---- */
  const MID_TOP = 14, MID_BOTTOM = 18;
  ws.mergeCells(MID_TOP, 1, MID_BOTTOM, 3);
  ws.mergeCells(MID_TOP, 4, MID_BOTTOM, 4);
  for (let r = MID_TOP; r <= MID_BOTTOM; r++) ws.getRow(r).height = 18;

  const leftMid = ws.getCell(MID_TOP, 1);
  leftMid.value = {
    richText: [
      { text: "●SSR\n", font: { ...KR_FONT, bold: true, size: 12 } },
      { text: (m.ssr || "") + "\n\n", font: { ...KR_FONT, size: 10 } },
      { text: "●미취식\n", font: { ...KR_FONT, bold: true, size: 12 } },
      { text: m.noMeal || "", font: { ...KR_FONT, size: 10 } },
    ],
  };
  leftMid.alignment = { vertical: "top", horizontal: "left", wrapText: true };

  const rightMid = ws.getCell(MID_TOP, 4);
  rightMid.value = {
    richText: [
      { text: "●PAX 특이사항 및 약제공\n", font: { ...KR_FONT, bold: true, size: 12 } },
      { text: m.paxNote || "", font: { ...KR_FONT, size: 10, color: { argb: "FFD40000" } } },
    ],
  };
  rightMid.alignment = { vertical: "top", horizontal: "left", wrapText: true };

  /* ---- Bottom: 2 Door open Gate (A19:D22) ---- */
  const GATE_TOP = 19, GATE_BOTTOM = 22;
  ws.mergeCells(GATE_TOP, 1, GATE_BOTTOM, 4);
  for (let r = GATE_TOP; r <= GATE_BOTTOM; r++) ws.getRow(r).height = 18;
  const gateCell = ws.getCell(GATE_TOP, 1);
  gateCell.value = {
    richText: [
      { text: "★2 Door open Gate★\n", font: { ...KR_FONT, bold: true, size: 13, color: { argb: "FFD40000" } } },
      { text: m.gate || "", font: { ...KR_FONT, size: 11, color: { argb: "FFD40000" } } },
    ],
  };
  gateCell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };

  /* ---- Borders on every region (outer + section dividers) ---- */
  applyBorderToRange(ws, 1, 1, 1, 4);                       // header
  applyBorderToRange(ws, MEAL_TOP, 1, MEAL_BOTTOM, 3);      // meal left
  applyBorderToRange(ws, MEAL_TOP, 4, MEAL_BOTTOM, 4);      // meal right
  applyBorderToRange(ws, MID_TOP, 1, MID_BOTTOM, 3);        // mid left
  applyBorderToRange(ws, MID_TOP, 4, MID_BOTTOM, 4);        // mid right
  applyBorderToRange(ws, GATE_TOP, 1, GATE_BOTTOM, 4);      // gate

  /* ---- Download ---- */
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `galley_${(m.title || "sheet").replace(/[^\w가-힣-]/g, "")}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

els.exportBtn.addEventListener("click", () => {
  exportExcel().catch((e) => alert("엑셀 생성 오류: " + (e?.message || e)));
});

/* ============================================================
   Provider switch updates the default model field
   ============================================================ */
els.provider.addEventListener("change", () => {
  els.model.value = DEFAULT_MODELS[els.provider.value] || "";
  onChange();
});

/* ============================================================
   Wire up change listeners + init
   ============================================================ */
[
  "title", "pax", "aBowl1", "dBowl1", "aBowl2", "dBowl2",
  "ssr", "noMeal", "paxNote", "gate", "model", "apiKey",
].forEach((id) => els[id].addEventListener("input", onChange));

load();
renderPreview();
