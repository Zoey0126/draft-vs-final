// review_app.js — 三区域审核结果对比页
(function () {
  'use strict';

  let DATA = null;
  let currentKey = null;

  document.addEventListener('DOMContentLoaded', load);

  function load() {
    fetch('review_data.json?v=' + Date.now())
      .then(r => r.json())
      .then(json => {
        DATA = json;
        document.getElementById('genTime').textContent =
          `生成时间：${json.generated_at}  |  共 ${json.issue_count} 个 Issue（双侧 ${json.bilateral_count}）`;
        document.title = `审核对比 · ${json.bilateral_count} 双侧 / ${json.issue_count} 总计`;
        renderLanding();
      })
      .catch(err => {
        document.body.innerHTML =
          `<div style="padding:40px;text-align:center;color:#c0392b;">加载 review_data.json 失败：${err.message}` +
          '<br>请先运行 scripts/build_review_compare.py</div>';
      });
  }

  // ---------- Issue 列表 ----------

  function renderLanding(filter = '') {
    const box = document.getElementById('regionDiff');
    const list = DATA.issues
      .filter(i => !filter || i.key.toLowerCase().includes(filter.toLowerCase()))
      .sort((a, b) => a.key.localeCompare(b.key));

    let html = `<div class="section-label">Issue 列表（点击查看对比） · ${list.length} 条</div>`;
    html += '<div class="issue-list">';
    // 顶部汇总
    const cc = DATA.cross_conclusion;
    const gapMean = cc.coverage_gap_mean;
    const gapLabel = gapMean == null ? 'N/A' : `${gapMean >= 0 ? '+' : ''}${gapMean.toFixed(2)}%`;
    const gapClass = gapMean == null ? 'na' : (gapMean > 5 ? 'bad' : (gapMean < -5 ? 'good' : 'neutral'));
    html += `
      <div style="padding:8px 12px;background:#f7f9fb;border-radius:6px;margin-bottom:10px;font-size:12px;">
        双侧齐备 Issue 覆盖度均值差：
        <strong>${gapLabel}</strong>
        <span class="diff-pill ${gapClass}">COZE − TRAE</span>
        &nbsp;|&nbsp;COZE 胜 <strong>${cc.coze_wins}</strong> 持平 <strong>${cc.ties}</strong> TRAE 胜 <strong>${cc.trae_wins}</strong>
      </div>`;

    for (const issue of list) {
      const hasC = !!issue.coze_review;
      const hasT = !!issue.trae_review;
      const cls = hasC && hasT ? 'has-both' : (hasC ? 'has-coze' : 'has-trae');
      const badge = hasC && hasT
        ? '<span class="badge both">双侧</span>'
        : (hasC ? '<span class="badge coze">仅 COZE</span>'
                : '<span class="badge trae">仅 TRAE</span>');
      const covC = hasC && issue.coze_review.coverage_pct != null ? issue.coze_review.coverage_pct + '%' : '-';
      const covT = hasT && issue.trae_review.coverage_pct != null ? issue.trae_review.coverage_pct + '%' : '-';
      html += `<div class="file-item ${cls}" data-key="${issue.key}">
        <span class="key">${issue.key}</span>${badge}
        <span style="font-size:11px;color:#7f8c8d;margin-left:10px;">COZE ${covC}  TRAE ${covT}</span>
      </div>`;
    }
    html += '</div>';
    box.innerHTML = html;
    box.querySelectorAll('.file-item').forEach(el => {
      el.addEventListener('click', () => selectIssue(el.dataset.key));
    });
  }

  // ---------- 选择 Issue ----------

  function selectIssue(key) {
    currentKey = key;
    const issue = DATA.issues.find(i => i.key === key);
    if (!issue) return;

    document.getElementById('modeTag').textContent = issue.diff.status === 'ok' ? '双侧齐备' : '单侧缺失';

    document.getElementById('cozeFile').textContent = issue.coze_review_file || '未上传';
    document.getElementById('traeFile').textContent = issue.trae_review_file || '未上传';

    document.getElementById('regionCoze').innerHTML = issue.coze_review
      ? renderSide(issue.coze_review, 'coze')
      : '<div class="side-empty">COZE 侧审核报告未上传</div>';
    document.getElementById('regionTrae').innerHTML = issue.trae_review
      ? renderSide(issue.trae_review, 'trae')
      : '<div class="side-empty">TRAE 侧审核报告未上传</div>';
    document.getElementById('regionDiff').innerHTML = renderDiff(issue);
  }

  // ---------- 单侧渲染 ----------

  function renderSide(rev, kind) {
    if (!rev) return '<div class="empty">该侧无数据</div>';
    const color = kind === 'coze' ? '#2980b9' : '#8e44ad';

    const covRow = rev.coverage_pct != null
      ? `<div class="ratio-row"><span class="key">覆盖度</span>
           <div class="ratio-bar"><div style="width:${rev.coverage_pct}%;background:${color};"></div></div>
           <span class="pct" style="color:${color}">${rev.coverage_pct.toFixed(0)}%</span></div>`
      : `<div class="ratio-row"><span class="key">覆盖度</span>
           <span class="empty" style="margin-left:10px;">未记录</span></div>`;

    const scoreRow = rev.design_score != null
      ? `<div class="ratio-row"><span class="key">设计评分</span>
           <div class="ratio-bar"><div style="width:${rev.design_score}%;background:${color};"></div></div>
           <span class="pct" style="color:${color}">${rev.design_score}</span></div>`
      : `<div class="ratio-row"><span class="key">设计评分</span>
           <span class="empty" style="margin-left:10px;">未记录</span></div>`;

    let missHtml = '';
    if (rev.missing_cases && rev.missing_cases.length) {
      missHtml = '<div class="section-label">缺失用例（' + rev.missing_cases.length + ' 条）</div><ul class="simple-list">';
      for (const m of rev.missing_cases) {
        missHtml += `<li>${escapeHtml(m.name)}</li>`;
      }
      missHtml += '</ul>';
    }

    let tblHtml = '';
    if (rev.coverage_table && rev.coverage_table.length) {
      tblHtml = '<div class="section-label">需求-用例对照表（' + rev.coverage_table.length + ' 行）</div>';
      tblHtml += '<table class="detail"><thead><tr><th>需求点</th><th>状态</th></tr></thead><tbody>';
      for (const r of rev.coverage_table.slice(0, 40)) {
        tblHtml += `<tr><td class="title-cell" title="${escapeHtml(r.req)}">${escapeHtml(r.req || '-')}</td>
          <td>${r.status || '-'} ${escapeHtml(r.status_text || '')}</td></tr>`;
      }
      tblHtml += '</tbody></table>';
      if (rev.coverage_table.length > 40) {
        tblHtml += `<div style="font-size:11px;color:#999;text-align:center;">（还有 ${rev.coverage_table.length - 40} 行省略）</div>`;
      }
    }

    let sugHtml = '';
    if (rev.suggestions && rev.suggestions.length) {
      sugHtml = '<div class="section-label">改进建议（' + rev.suggestions.length + ' 条）</div><ul class="simple-list">';
      for (const s of rev.suggestions.slice(0, 30)) {
        sugHtml += `<li>${escapeHtml(s)}</li>`;
      }
      sugHtml += '</ul>';
      if (rev.suggestions.length > 30) {
        sugHtml += `<div style="font-size:11px;color:#999;text-align:center;">（还有 ${rev.suggestions.length - 30} 条省略）</div>`;
      }
    }

    let futHtml = '';
    if (rev.future && rev.future.length) {
      futHtml = '<div class="section-label">未来考虑（' + rev.future.length + ' 条）</div><ul class="simple-list">';
      for (const f of rev.future) futHtml += `<li>${escapeHtml(f)}</li>`;
      futHtml += '</ul>';
    }

    return `
      ${covRow}
      ${scoreRow}
      ${missHtml}
      ${tblHtml}
      ${sugHtml}
      ${futHtml}
    `;
  }

  // ---------- Diff 区域 ----------

  function renderDiff(issue) {
    const d = issue.diff;
    if (!d || d.status === 'missing_one_side') {
      return `<div class="empty">${d && d.status === 'missing_one_side'
        ? '仅一侧有审核报告，无法对比'
        : '双侧齐备 Issue 点击后查看对比'}</div>`;
    }

    const cC = issue.coze_review.coverage_pct;
    const tC = issue.trae_review.coverage_pct;
    const cS = issue.coze_review.design_score;
    const tS = issue.trae_review.design_score;

    // 覆盖度双柱
    let covBar = '<div class="section-label">覆盖度对比</div>';
    if (cC != null && tC != null) {
      const gap = d.coverage_gap;
      const pillClass = gap == null ? 'na' : (gap > 5 ? 'bad' : (gap < -5 ? 'good' : 'neutral'));
      const pillText = gap == null ? 'N/A' : `${gap >= 0 ? '+' : ''}${gap.toFixed(1)}%`;
      covBar += `
        <div class="coverage-bar coze"><span class="label">COZE</span>
          <div class="bar"><div style="width:${cC}%">${cC}%</div></div></div>
        <div class="coverage-bar trae"><span class="label">TRAE</span>
          <div class="bar"><div style="width:${tC}%">${tC}%</div></div></div>
        <div style="text-align:right;margin-top:4px;">差值 <strong>${pillText}</strong>
          <span class="diff-pill ${pillClass}">COZE − TRAE</span></div>`;
    } else {
      covBar += '<div class="empty">至少一侧未记录覆盖度</div>';
    }

    // 设计评分
    let scoreRow = '';
    if (cS != null && tS != null) {
      const gap = d.design_gap;
      const pillClass = gap == null ? 'na' : (gap > 5 ? 'bad' : (gap < -5 ? 'good' : 'neutral'));
      scoreRow = `<div class="section-label">设计评分对比</div>
        <div class="ratio-row"><span class="key">COZE</span>
          <div class="ratio-bar"><div style="width:${cS}%;background:#2980b9;"></div></div>
          <span class="pct" style="color:#2980b9">${cS}</span></div>
        <div class="ratio-row"><span class="key">TRAE</span>
          <div class="ratio-bar"><div style="width:${tS}%;background:#8e44ad;"></div></div>
          <span class="pct" style="color:#8e44ad">${tS}</span></div>
        <div style="text-align:right;margin-top:4px;">差值 ${gap >= 0 ? '+' : ''}${gap}
          <span class="diff-pill ${pillClass}">COZE − TRAE</span></div>`;
    }

    // 缺失用例三分栏
    let missHtml = '';
    const md = d.missing_case_diff || {};
    const common = md.common || [];
    const cozeOnly = md.only_coze_missing || [];
    const traeOnly = md.only_trae_missing || [];
    if (common.length || cozeOnly.length || traeOnly.length) {
      missHtml = '<div class="section-label">缺失用例对比</div>';
      missHtml += '<div class="missing-3col">' +
        renderMissCol('共同缺失', common.map(x => x.name_a || x.name_b), 'c') +
        renderMissCol('仅 COZE 侧缺失', cozeOnly.map(x => x.name), 'a') +
        renderMissCol('仅 TRAE 侧缺失', traeOnly.map(x => x.name), 'b') +
        '</div>';
    }

    // 对照表冲突
    let tblHtml = '';
    if (d.table_conflicts && d.table_conflicts.length) {
      tblHtml = '<div class="section-label">需求-用例对照表状态冲突（' + d.table_conflicts.length + ' 项）</div>';
      tblHtml += '<table class="detail"><thead><tr><th>需求点</th><th>COZE</th><th>TRAE</th></tr></thead><tbody>';
      for (const c of d.table_conflicts.slice(0, 30)) {
        tblHtml += `<tr><td class="title-cell" title="${escapeHtml(c.req_a)}">${escapeHtml(c.req_a || c.req_b || '')}</td>
          <td>${c.coze_status}</td><td>${c.trae_status}</td></tr>`;
      }
      tblHtml += '</tbody></table>';
    }

    // 建议交集
    let sugHtml = '';
    const sd = d.suggestion_diff || {};
    if ((sd.common || []).length || (sd.coze_only || []).length || (sd.trae_only || []).length) {
      sugHtml = '<div class="section-label">改进建议交集 / 独存</div>';
      sugHtml += '<div class="sug-3col">' +
        renderMissCol('交集', sd.common.map(x => x.a), 'c') +
        renderMissCol('仅 COZE', sd.coze_only, 'a') +
        renderMissCol('仅 TRAE', sd.trae_only, 'b') +
        '</div>';
    }

    // 结论
    const con = d.conclusion || {};
    let conHtml = '';
    if (con.overall) {
      const betterLabel = con.better_side === 'coze' ? 'COZE 整体更优'
        : con.better_side === 'trae' ? 'TRAE 整体更优'
        : con.better_side === 'tie' ? '两侧基本持平' : '覆盖度差无法判定';
      conHtml = `<div class="conclusion-card">
        <h4>📌 结论：${betterLabel}</h4>
        <div>${escapeHtml(con.overall).replace(/；/g, '；<br>')}</div>
        <div class="act"><strong>可执行建议：</strong>${escapeHtml(con.actionable || '')}</div>
      </div>`;
    }

    return covBar + scoreRow + missHtml + tblHtml + sugHtml + conHtml;
  }

  function renderMissCol(title, items, cls) {
    if (!items || !items.length) {
      return `<div><h5 class="${cls}">${title} · 0</h5><div class="empty">—</div></div>`;
    }
    let h = `<div><h5 class="${cls}">${title} · ${items.length}</h5><ul>`;
    for (const it of items.slice(0, 20)) h += `<li title="${escapeHtml(it)}">${escapeHtml(it)}</li>`;
    h += '</ul></div>';
    return h;
  }

  // ---------- 工具 ----------

  function escapeHtml(s) {
    if (!s) return '';
    return String(s).replace(/[&<>"']/g, c =>
      ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  }

  // ---------- 搜索 ----------

  document.getElementById('issueSearch').addEventListener('input', e => {
    currentKey = null;
    renderLanding(e.target.value.trim());
  });
  document.getElementById('resetBtn').addEventListener('click', () => {
    document.getElementById('issueSearch').value = '';
    currentKey = null;
    renderLanding('');
  });
})();
