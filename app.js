"use strict";

/* ============================================================
   Galley Sheet Creator (client)
   - Form input for an airline catering galley sheet
   - AI meal recognition via serverless proxy (/api/recognize)
     -> API keys live in server env vars, never in the browser
   - Styled Excel (.xlsx) export matching the printed layout
   ============================================================ */

const LS_KEY = "galleySheet.v1";
const LS_PROVIDER = "galleySheet.provider"; // non-secret UI preference

/* ---------- DOM helpers ---------- */
const $ = (id) => document.getElementById(id);
const els = {
  title: $("title"),
  pax: $("pax"),
  provider: $("provider"),
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

/* ============================================================
   Toast notifications
   ============================================================ */
function toast(message, type = "info", ms = 4000) {
  const wrap = $("toasts");
  const t = document.createElement("div");
  t.className = "toast " + type;
  t.textContent = message;
  wrap.appendChild(t);
  requestAnimationFrame(() => t.classList.add("show"));
  setTimeout(() => {
    t.classList.remove("show");
    setTimeout(() => t.remove(), 300);
  }, ms);
}

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
  lines.push({ text: "", spacer: true }); // blank line(s) between 1st and 2nd meal
  lines.push({ text: "", spacer: true });
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
      return `<div class="${cls}">${esc || "&nbsp;"}</div>`;
    })
    .join("");
  $("pvMeal").innerHTML = mealHtml;

  $("pvSsr").textContent = m.ssr;
  $("pvNoMeal").textContent = m.noMeal;
  $("pvPaxNote").textContent = m.paxNote;
  $("pvGate").textContent = m.gate;
}

/* ============================================================
   Persistence (localStorage) — no secrets stored
   ============================================================ */
function save() {
  localStorage.setItem(LS_KEY, JSON.stringify(getModel()));
  localStorage.setItem(LS_PROVIDER, els.provider.value);
}

function load() {
  const provider = localStorage.getItem(LS_PROVIDER);
  if (provider) els.provider.value = provider;

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
   Image upload handling (with downscaling to keep payload small)
   ============================================================ */
const MAX_DIM = 1568; // long edge; keeps request body well under serverless limit

function readFileAsDataURL(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

/* HEIC/HEIF can't be decoded by <img> in most browsers; the server converts these. */
function isHeic(file) {
  const t = (file.type || "").toLowerCase();
  const n = (file.name || "").toLowerCase();
  return t.includes("heic") || t.includes("heif") || n.endsWith(".heic") || n.endsWith(".heif");
}

function loadImageEl(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function fileToImage(file) {
  // HEIC/HEIF: can't decode in-browser reliably -> send raw bytes; server converts to JPEG.
  if (isHeic(file)) {
    const original = await readFileAsDataURL(file);
    return {
      name: file.name,
      mime: file.type || "image/heic",
      dataUrl: original,
      base64: String(original).split(",")[1],
      isHeic: true,
    };
  }

  // Decodable image -> downscale client-side to keep the upload small.
  const original = await readFileAsDataURL(file);
  try {
    const img = await loadImageEl(original);
    const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d").drawImage(img, 0, 0, w, h);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    return { name: file.name, mime: "image/jpeg", dataUrl, base64: dataUrl.split(",")[1] };
  } catch (_) {
    return {
      name: file.name,
      mime: file.type || "image/jpeg",
      dataUrl: original,
      base64: String(original).split(",")[1],
    };
  }
}

els.mealImages.addEventListener("change", async (e) => {
  const files = [...e.target.files];
  for (const f of files) {
    try {
      uploadedImages.push(await fileToImage(f));
    } catch (err) {
      toast(`이미지 처리 실패: ${f.name} — ${err?.message || err}`, "err", 6000);
    }
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
  els.thumbs.innerHTML = uploadedImages
    .map((im) =>
      im.isHeic
        ? `<div class="thumb-ph" title="${im.name}">HEIC</div>`
        : `<img src="${im.dataUrl}" alt="${im.name}" />`
    )
    .join("");
}

/* ============================================================
   AI meal recognition (via serverless proxy)
   ============================================================ */
function setStatus(msg, kind) {
  els.aiStatus.textContent = msg;
  els.aiStatus.className = "ai-status" + (kind ? " " + kind : "");
}

async function recognizeMeals() {
  if (!uploadedImages.length) {
    toast("먼저 메뉴 이미지를 첨부하세요.", "err");
    setStatus("이미지를 첨부하세요.", "err");
    return;
  }
  const provider = els.provider.value;

  els.recognizeBtn.disabled = true;
  setStatus("AI가 메뉴를 인식하는 중…", "busy");

  try {
    const res = await fetch("/api/recognize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        provider,
        images: uploadedImages.map((im) => ({ mime: im.mime, base64: im.base64 })),
      }),
    });

    let body = null;
    try {
      body = await res.json();
    } catch (_) {}

    if (!res.ok || !body || body.ok === false) {
      const msg = body?.error || `요청 실패 (HTTP ${res.status})`;
      toast(msg, "err", 6000);
      setStatus("오류: " + msg, "err");
      return;
    }

    const data = parseJsonLoose(body.text || "");
    applyExtraction(data);
    setStatus("✅ 인식 완료 — 필드를 확인/수정하세요.", "ok");
    toast("메뉴 인식 완료", "ok", 2500);
  } catch (err) {
    const msg = "네트워크 오류: " + (err?.message || err);
    toast(msg, "err", 6000);
    setStatus(msg, "err");
  } finally {
    els.recognizeBtn.disabled = false;
  }
}

/* ---- Robust JSON parsing (strips code fences / surrounding prose) ---- */
function parseJsonLoose(text) {
  if (!text) throw new Error("AI 응답이 비어 있습니다.");
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
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
   ============================================================ */
const THIN = { style: "thin", color: { argb: "FF000000" } };

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
    pageSetup: {
      paperSize: 9, // A4
      orientation: "portrait",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
      horizontalCentered: true,
      verticalCentered: true,
      margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
    },
  });

  // Column widths sized to roughly fill A4 portrait width.
  ws.getColumn(1).width = 34;
  ws.getColumn(2).width = 13;
  ws.getColumn(3).width = 13;
  ws.getColumn(4).width = 44;

  const KR_FONT = { name: "Malgun Gothic" };

  /* Row 1: Header. Divider sits at the col3|col4 boundary so it lines up
     with the vertical line to the right of the MEAL block below. */
  ws.mergeCells("A1:C1");
  const titleCell = ws.getCell("A1");
  titleCell.value = `<${m.title}>`;
  titleCell.font = { ...KR_FONT, bold: true, size: 18 };
  titleCell.alignment = { vertical: "middle", horizontal: "left" };
  const paxCell = ws.getCell("D1");
  paxCell.value = `PAX : ${m.pax || ""}`;
  paxCell.font = { ...KR_FONT, bold: true, size: 18 };
  paxCell.alignment = { vertical: "middle", horizontal: "left" };
  ws.getRow(1).height = 38;

  /* MEAL block (~2/3 height; slightly smaller fonts so content still fits) */
  const MEAL_TOP = 2, MEAL_BOTTOM = 8;
  ws.mergeCells(MEAL_TOP, 1, MEAL_BOTTOM, 3);
  ws.mergeCells(MEAL_TOP, 4, MEAL_BOTTOM, 4);
  for (let r = MEAL_TOP; r <= MEAL_BOTTOM; r++) ws.getRow(r).height = 27;

  const mealCell = ws.getCell(MEAL_TOP, 1);
  const richText = [{ text: "●MEAL\n", font: { ...KR_FONT, bold: true, size: 12 } }];
  buildMealLines(m).forEach((l) => {
    richText.push({
      text: l.text + "\n",
      font: { ...KR_FONT, bold: !!l.bold, size: l.en ? 8 : 9, color: { argb: "FF000000" } },
    });
  });
  mealCell.value = { richText };
  mealCell.alignment = { vertical: "top", horizontal: "left", wrapText: true };

  /* Middle band: SSR and 미취식 are SEPARATE stacked cells (divider line between them) */
  const SSR_TOP = 9, SSR_BOTTOM = 12;
  const NOMEAL_TOP = 13, NOMEAL_BOTTOM = 16;
  for (let r = SSR_TOP; r <= NOMEAL_BOTTOM; r++) ws.getRow(r).height = 28;

  ws.mergeCells(SSR_TOP, 1, SSR_BOTTOM, 3);
  ws.mergeCells(NOMEAL_TOP, 1, NOMEAL_BOTTOM, 3);
  ws.mergeCells(SSR_TOP, 4, NOMEAL_BOTTOM, 4); // PAX note spans both rows on the right

  const ssrCell = ws.getCell(SSR_TOP, 1);
  ssrCell.value = {
    richText: [
      { text: "●SSR\n", font: { ...KR_FONT, bold: true, size: 13 } },
      { text: m.ssr || "", font: { ...KR_FONT, size: 11 } },
    ],
  };
  ssrCell.alignment = { vertical: "top", horizontal: "left", wrapText: true };

  const noMealCell = ws.getCell(NOMEAL_TOP, 1);
  noMealCell.value = {
    richText: [
      { text: "●미취식\n", font: { ...KR_FONT, bold: true, size: 13 } },
      { text: m.noMeal || "", font: { ...KR_FONT, size: 11 } },
    ],
  };
  noMealCell.alignment = { vertical: "top", horizontal: "left", wrapText: true };

  const rightMid = ws.getCell(SSR_TOP, 4);
  rightMid.value = {
    richText: [
      { text: "●PAX 특이사항 및 약제공\n", font: { ...KR_FONT, bold: true, size: 13 } },
      { text: m.paxNote || "", font: { ...KR_FONT, size: 11, color: { argb: "FFD40000" } } },
    ],
  };
  rightMid.alignment = { vertical: "top", horizontal: "left", wrapText: true };

  /* Bottom: Gate (enlarged to take the space freed from the MEAL block) */
  const GATE_TOP = 17, GATE_BOTTOM = 25;
  ws.mergeCells(GATE_TOP, 1, GATE_BOTTOM, 4);
  for (let r = GATE_TOP; r <= GATE_BOTTOM; r++) ws.getRow(r).height = 33;
  const gateCell = ws.getCell(GATE_TOP, 1);
  gateCell.value = {
    richText: [
      { text: "★2 Door open Gate★\n", font: { ...KR_FONT, bold: true, size: 15, color: { argb: "FFD40000" } } },
      { text: m.gate || "", font: { ...KR_FONT, size: 12, color: { argb: "FFD40000" } } },
    ],
  };
  gateCell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };

  /* Borders (each region bordered -> SSR/미취식 get a divider line between them) */
  applyBorderToRange(ws, 1, 1, 1, 4);
  applyBorderToRange(ws, MEAL_TOP, 1, MEAL_BOTTOM, 3);
  applyBorderToRange(ws, MEAL_TOP, 4, MEAL_BOTTOM, 4);
  applyBorderToRange(ws, SSR_TOP, 1, SSR_BOTTOM, 3);
  applyBorderToRange(ws, NOMEAL_TOP, 1, NOMEAL_BOTTOM, 3);
  applyBorderToRange(ws, SSR_TOP, 4, NOMEAL_BOTTOM, 4);
  applyBorderToRange(ws, GATE_TOP, 1, GATE_BOTTOM, 4);

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
  exportExcel().catch((e) => toast("엑셀 생성 오류: " + (e?.message || e), "err", 6000));
});

/* ============================================================
   Wire up change listeners + init
   ============================================================ */
els.provider.addEventListener("change", onChange);
[
  "title", "pax", "aBowl1", "dBowl1", "aBowl2", "dBowl2",
  "ssr", "noMeal", "paxNote", "gate",
].forEach((id) => els[id].addEventListener("input", onChange));

load();
renderPreview();
