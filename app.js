/* Test Report Draft vs Final — three-region interactive SPA */
"use strict";

let DATA = null;

const $ = (id) => document.getElementById(id);
const sprintSel = $("sprintSelect");
const issueSel = $("issueSelect");
const rDraft = $("regionDraft");
const rFinal = $("regionFinal");
const rCompare = $("regionCompare");
const modeTag = $("modeTag");

const FIELD_LABELS = {
  title: "标题",
  prerequisites: "前置条件",
  steps: "执行步骤",
  results: "执行结果",
  environment: "执行环境",
};

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

function ratioColor(r) {
  return r >= 80 ? "#27ae60" : r >= 50 ? "#e67e22" : "#c0392b";
}

function getSprint(name) {
  return DATA.sprints.find((s) => s.name === name);
}
function getIssue(sprint, key) {
  return sprint.issues.find((i) => i.key === key);
}

/* ---------------- Init ---------------- */
fetch("data.json?_=" + Date.now())
  .then((r) => r.json())
  .then((data) => {
    DATA = data;
    $("genTime").textContent = "数据生成时间：" + data.generated_at;
    data.sprints.forEach((s) => {
      const opt = el("option", null, s.name);
      opt.value = s.name;
      sprintSel.appendChild(opt);
    });
    sprintSel.addEventListener("change", onSprintChange);
    $("confirmBtn").addEventListener("click", onConfirm);
    issueSel.addEventListener("change", () => {
      /* issue chosen — enter issue mode immediately on confirm */
    });
    // Show all-sprints landing summary by default
    renderLanding();
  })
  .catch((e) => {
    rCompare.innerHTML = "";
    rCompare.appendChild(el("div", "empty", "数据加载失败：" + e.message));
  });

function onSprintChange() {
  issueSel.innerHTML = "";
  if (!sprintSel.value) {
    issueSel.disabled = true;
    issueSel.appendChild(el("option", null, "— 先选择 Sprint —"));
    return;
  }
  issueSel.disabled = false;
  issueSel.appendChild(el("option", null, "— 全部 Issue（概览）—"));
  const sp = getSprint(sprintSel.value);
  sp.issues.forEach((i) => {
    const opt = el("option", null, i.key + (i.summary ? "  " + i.summary.slice(0, 40) : ""));
    opt.value = i.key;
    issueSel.appendChild(opt);
  });
}

function onConfirm() {
  if (!sprintSel.value) {
    renderLanding();
    return;
  }
  const sp = getSprint(sprintSel.value);
  if (issueSel.value) {
    renderIssue(sp, getIssue(sp, issueSel.value));
  } else {
    renderSprint(sp);
  }
}

/* ---------------- Landing (all sprints) ---------------- */
function renderLanding() {
  modeTag.textContent = "全部 Sprint 概览";
  rDraft.innerHTML = "";
  rFinal.innerHTML = "";
  rCompare.innerHTML = "";

  DATA.sprints.forEach((s) => {
    const cardD = el("div", "file-item");
    cardD.appendChild(el("span", "key", s.name));
    cardD.appendChild(el("span", "fname", s.issue_count + " 份初稿报告"));
    cardD.addEventListener("click", () => { sprintSel.value = s.name; onSprintChange(); renderSprint(s); });
    rDraft.appendChild(cardD);

    const cardF = el("div", "file-item");
    cardF.appendChild(el("span", "key", s.name));
    cardF.appendChild(el("span", "fname", s.issue_count + " 份最终版报告"));
    cardF.addEventListener("click", () => { sprintSel.value = s.name; onSprintChange(); renderSprint(s); });
    rFinal.appendChild(cardF);

    const row = el("div", "ratio-row");
    row.appendChild(el("span", "key", s.name));
    const bar = el("div", "ratio-bar");
    const fill = el("div");
    fill.style.width = Math.max(s.avg_ratio, 1.5) + "%";
    fill.style.background = ratioColor(s.avg_ratio);
    bar.appendChild(fill);
    row.appendChild(bar);
    const cs = el("span", "cases", s.issue_count + " issues");
    const pct = el("span", "pct", s.avg_ratio.toFixed(1) + "%");
    pct.style.color = ratioColor(s.avg_ratio);
    row.appendChild(cs);
    row.appendChild(pct);
    row.addEventListener("click", () => { sprintSel.value = s.name; onSprintChange(); renderSprint(s); });
    rCompare.appendChild(row);
  });
}

/* ---------------- Sprint overview ---------------- */
function renderSprint(sp) {
  modeTag.textContent = "Sprint 概览 · " + sp.name;
  rDraft.innerHTML = "";
  rFinal.innerHTML = "";
  rCompare.innerHTML = "";

  const sorted = [...sp.issues].sort((a, b) => a.comparison.match_ratio - b.comparison.match_ratio);

  sorted.forEach((i) => {
    const c = i.comparison;

    // Region 1: draft files
    const d = el("div", "file-item");
    d.title = i.draft_file;
    d.appendChild(el("span", "key", i.key));
    d.appendChild(el("span", "fname", i.draft_file));
    d.appendChild(el("span", "count", c.draft_case_count + " 用例"));
    d.addEventListener("click", () => { issueSel.value = i.key; renderIssue(sp, i); });
    rDraft.appendChild(d);

    // Region 2: final files
    const f = el("div", "file-item");
    f.title = i.final_file;
    f.appendChild(el("span", "key", i.key));
    f.appendChild(el("span", "fname", i.final_file));
    f.appendChild(el("span", "count", c.final_case_count + " 用例"));
    f.addEventListener("click", () => { issueSel.value = i.key; renderIssue(sp, i); });
    rFinal.appendChild(f);

    // Region 3: ratio rows
    const row = el("div", "ratio-row");
    row.appendChild(el("span", "key", i.key));
    const bar = el("div", "ratio-bar");
    const fill = el("div");
    fill.style.width = Math.max(c.match_ratio, 1.5) + "%";
    fill.style.background = ratioColor(c.match_ratio);
    bar.appendChild(fill);
    row.appendChild(bar);
    row.appendChild(el("span", "cases", "D" + c.draft_case_count + " / F" + c.final_case_count));
    const pct = el("span", "pct", c.match_ratio.toFixed(1) + "%");
    pct.style.color = ratioColor(c.match_ratio);
    row.appendChild(pct);
    row.addEventListener("click", () => { issueSel.value = i.key; renderIssue(sp, i); });
    rCompare.appendChild(row);
  });
}

/* ---------------- Case cards ---------------- */
function caseCard(tc, kind, pairId) {
  const card = el("div", "case-card " + kind);
  card.dataset.pair = pairId || "";
  const h = el("h4");
  h.textContent = tc.title || "(无标题)";
  const tagText = kind === "paired" ? "匹配" : kind === "draft-only" ? "仅初稿" : "仅最终版";
  h.appendChild(el("span", "case-tag tag-" + kind, tagText));
  card.appendChild(h);

  ["section", "prerequisites", "steps", "results", "environment"].forEach((fk) => {
    const val = tc[fk];
    if (!val || !String(val).trim()) return;
    if (fk === "section") return; // section already reflected in title context
    const wrap = el("div", "case-field");
    wrap.appendChild(el("span", "fname", FIELD_LABELS[fk] || fk));
    wrap.appendChild(el("pre", null, val));
    card.appendChild(wrap);
  });
  return card;
}

function envBox(text, label) {
  const box = el("div", "env-box");
  box.textContent = (label ? label + "：" : "") + (text && text.trim() ? text : "（未记录）");
  return box;
}

/* Pair highlighting between region 3 and regions 1/2 */
function bindPairHighlight() {
  const allCards = document.querySelectorAll(".case-card[data-pair]");
  const allRows = document.querySelectorAll("tr.pair-row");
  const setHi = (pairId, on) => {
    allCards.forEach((c) => {
      if (pairId && c.dataset.pair === pairId) c.classList.toggle("highlight", on);
    });
    allRows.forEach((r) => {
      if (pairId && r.dataset.pair === pairId) r.classList.toggle("highlight", on);
    });
  };
  allRows.forEach((r) => {
    const id = r.dataset.pair;
    r.addEventListener("mouseenter", () => setHi(id, true));
    r.addEventListener("mouseleave", () => setHi(id, false));
  });
  allCards.forEach((c) => {
    const id = c.dataset.pair;
    if (!id) return;
    c.addEventListener("mouseenter", () => setHi(id, true));
    c.addEventListener("mouseleave", () => setHi(id, false));
  });
}

/* ---------------- Issue detail ---------------- */
function renderIssue(sp, issue) {
  modeTag.textContent = "Issue 明细 · " + issue.key;
  const c = issue.comparison;

  /* ---- Region 1: draft content ---- */
  rDraft.innerHTML = "";
  const dHead = el("div", "section-label", issue.key + (issue.summary ? "　" + issue.summary : ""));
  rDraft.appendChild(dHead);
  rDraft.appendChild(el("div", "fname", issue.draft_file));
  rDraft.appendChild(envBox(c.draft_environment, "初稿执行环境"));
  c.matched_cases.forEach((m, idx) => {
    if (m.draft_case) rDraft.appendChild(caseCard(m.draft_case, "paired", "p" + idx));
  });
  c.draft_only.forEach((tc) => rDraft.appendChild(caseCard(tc, "draft-only", "")));

  /* ---- Region 2: final content ---- */
  rFinal.innerHTML = "";
  rFinal.appendChild(el("div", "section-label", issue.key));
  rFinal.appendChild(el("div", "fname", issue.final_file));
  rFinal.appendChild(envBox(c.final_environment, "最终版执行环境"));
  c.matched_cases.forEach((m, idx) => {
    if (m.final_case) rFinal.appendChild(caseCard(m.final_case, "paired", "p" + idx));
  });
  c.final_only.forEach((tc) => rFinal.appendChild(caseCard(tc, "final-only", "")));

  /* ---- Region 3: comparison result ---- */
  rCompare.innerHTML = "";
  const big = el("div", "ratio-big");
  const num = el("div", "num", c.match_ratio.toFixed(1) + "%");
  num.style.color = ratioColor(c.match_ratio);
  big.appendChild(num);
  big.appendChild(el("div", "desc",
    "整体匹配率（初稿 " + c.draft_case_count + " 用例 / 最终版 " + c.final_case_count + " 用例）"));
  rCompare.appendChild(big);

  // Matched cases detail table
  rCompare.appendChild(el("div", "section-label",
    "✅ 匹配的用例（" + c.matched_cases.length + "）— 悬停联动左右区域"));
  if (c.matched_cases.length) {
    const table = el("table", "detail");
    table.innerHTML =
      "<thead><tr><th>用例标题</th><th>标题</th><th>前置</th><th>步骤</th><th>结果</th><th>整体</th></tr></thead>";
    const tbody = el("tbody");
    c.matched_cases.forEach((m, idx) => {
      const tr = el("tr", "pair-row");
      tr.dataset.pair = "p" + idx;
      const tdTitle = el("td", "title-cell", (m.draft_case || m.final_case || {}).title || "?");
      tdTitle.title = (m.draft_case || m.final_case || {}).title || "";
      tr.appendChild(tdTitle);
      const badge = (ok) => el("td", null, ok ? "✅" : "❌");
      tr.appendChild(badge(m.title_match));
      tr.appendChild(badge(m.field_matches.prerequisites));
      tr.appendChild(badge(m.field_matches.steps));
      tr.appendChild(badge(m.field_matches.results));
      const ov = el("td", null);
      ov.appendChild(el("span", "case-tag " + (m.overall_match ? "tag-paired" : "tag-draft-only"),
        m.overall_match ? "匹配" : "差异"));
      tr.appendChild(ov);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    rCompare.appendChild(table);
  } else {
    rCompare.appendChild(el("div", "empty", "无标题匹配的用例"));
  }

  // Draft only
  rCompare.appendChild(el("div", "section-label",
    "🟠 仅在初稿中（" + c.draft_only.length + "）"));
  if (c.draft_only.length) {
    const ul = el("ul", "simple-list");
    c.draft_only.forEach((tc) => {
      const li = el("li");
      li.appendChild(el("span", "mini-tag tag-draft-only", "仅初稿"));
      li.appendChild(document.createTextNode(tc.title || "(无标题)"));
      ul.appendChild(li);
    });
    rCompare.appendChild(ul);
  }

  // Final only
  rCompare.appendChild(el("div", "section-label",
    "🟣 仅在最终版中（" + c.final_only.length + "）"));
  if (c.final_only.length) {
    const ul = el("ul", "simple-list");
    c.final_only.forEach((tc) => {
      const li = el("li");
      li.appendChild(el("span", "mini-tag tag-final-only", "仅最终版"));
      li.appendChild(document.createTextNode(tc.title || "(无标题)"));
      ul.appendChild(li);
    });
    rCompare.appendChild(ul);
  }

  bindPairHighlight();
}
