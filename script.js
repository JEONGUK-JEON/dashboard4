// ──────────────────────────────────────────────
//  채권현황 대시보드  script.js
// ──────────────────────────────────────────────
let dashboardData = null;
let selectedEntityName = null;
let trendChart = null, barChart = null, shareChart = null, momChart = null;

const numFmt  = new Intl.NumberFormat('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const numFmt0 = new Intl.NumberFormat('ko-KR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

function fmtEok(v) {
  if (v === null || v === undefined || isNaN(v)) return '-';
  return `${numFmt.format(v)}억`;
}
function fmtPct(v, total) {
  if (!total || total === 0) return '0.0%';
  return `${numFmt.format(v / total * 100)}%`;
}
function fmtChg(v) {
  if (v === null || v === undefined || isNaN(v)) return '-';
  const sign = v >= 0 ? '+' : '';
  return `${sign}${numFmt.format(v)}억`;
}
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
function findEntity(name) {
  return dashboardData.entities.find(e => e.name === name);
}
function getLeafEntities() {
  return dashboardData.entities.filter(e => e.is_leaf);
}
function getGroupEntities() {
  return dashboardData.entities.filter(e => !e.is_leaf);
}
function getCompareEntities(entity) {
  if (!entity) return getLeafEntities();
  if (entity.group === '합계')    return getLeafEntities();
  if (entity.group === '국내법인') return getLeafEntities().filter(e => e.group === '국내법인');
  if (entity.group === '해외법인') return getLeafEntities().filter(e => e.group === '해외법인');
  if (entity.group === '판매사')   return getLeafEntities().filter(e => e.group === '판매사');
  return getLeafEntities().filter(e => e.group === entity.group);
}

// ── 버튼 구성 ──
// 매출 대시보드와 동일한 레이아웃:
//   1행: [연합 총계] [국내법인] [해외법인] [판매사]   ← 그룹/총계 버튼
//   이하: 국내법인 | BWC BW BEX KCC ...
//         해외법인 | BWK SYTK VBC ...
//         판매사   | 범우케미칼 범우켐 범우화인켐

// 그룹 합계 엔티티 이름 → 표시 레이블 매핑
const GROUP_BTN_MAP = [
  { entity: '범우연합 합계', label: '연합 총계', extraClass: 'total-btn' },
  { entity: '국내사 합계',   label: '국내법인', extraClass: '' },
  { entity: '해외사 합계',   label: '해외법인', extraClass: '' },
  { entity: '판매사 합계',   label: '판매사',   extraClass: '' },
];
// 통합구매는 국내법인 그룹에 포함 (BWC/BW/BEX/KCC의 해외사 채권 통합)

function buildEntityButtons() {
  const container = document.getElementById('entityButtons');
  container.innerHTML = '';

  // ── 1행: 총계 + 그룹 버튼 ──
  const topRow = document.createElement('div');
  topRow.className = 'entity-row';
  GROUP_BTN_MAP.forEach(({ entity, label, extraClass }) => {
    if (!findEntity(entity)) return;
    const btn = document.createElement('button');
    btn.className = 'entity-btn' + (extraClass ? ' ' + extraClass : '');
    btn.textContent = label;
    btn.dataset.entity = entity;
    btn.addEventListener('click', () => selectEntity(entity));
    topRow.appendChild(btn);
  });
  container.appendChild(topRow);

  // ── 하위 법인 그룹별 행 ──
  [
    { groupName: '국내법인', label: '국내법인' },
    { groupName: '해외법인', label: '해외법인' },
    { groupName: '판매사',   label: '판매사'   },
  ].forEach(({ groupName, label }) => {
    const leaves = getLeafEntities().filter(e => e.group === groupName);
    if (!leaves.length) return;

    const wrap = document.createElement('div');
    wrap.className = 'entity-subgroup';

    const labelEl = document.createElement('div');
    labelEl.className = 'entity-group-label';
    labelEl.textContent = label;
    wrap.appendChild(labelEl);

    const row = document.createElement('div');
    row.className = 'entity-row';
    leaves.forEach(e => row.appendChild(makeBtn(e.name)));
    wrap.appendChild(row);

    container.appendChild(wrap);
  });
}

function makeBtn(name, extraClass = '') {
  const btn = document.createElement('button');
  btn.className = `entity-btn${extraClass ? ' ' + extraClass : ''}`;
  btn.textContent = name;
  btn.dataset.entity = name;
  btn.addEventListener('click', () => selectEntity(name));
  return btn;
}

function updateButtonState() {
  document.querySelectorAll('.entity-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.entity === selectedEntityName);
  });
}

// ── KPI ──
function renderKpis(entity) {
  const p = entity.periods['2026-04'];
  const tot = p.total, m3 = p['3m'], m46 = p['4_6m'], m712 = p['7_12m'], over1 = p.over1y;

  setText('kpiTotal',   fmtEok(tot));
  setText('kpi3m',      fmtEok(m3));
  setText('kpi3mPct',   `비중 ${fmtPct(m3, tot)}`);
  setText('kpi4_6m',    fmtEok(m46));
  setText('kpi4_6mPct', `비중 ${fmtPct(m46, tot)}`);
  setText('kpi7_12m',   fmtEok(m712));
  setText('kpi7_12mPct',`비중 ${fmtPct(m712, tot)}`);
  setText('kpiOver1y',  fmtEok(over1));
  setText('kpiOver1yPct',`비중 ${fmtPct(over1, tot)}`);

  const momEl = document.getElementById('kpiMoM');
  setText('kpiMoM', fmtChg(entity.mom_total));
  if (momEl) {
    momEl.className = `kpi-value ${entity.mom_total > 0 ? 'up' : entity.mom_total < 0 ? 'down' : ''}`;
  }
  setText('kpiMoMDetail', `전월대비 / 전년대비 ${fmtChg(entity.yoy_total)}`);

  // 총계/그룹 합계 표시명 정리
  const displayName = {
    '범우연합 합계': '연합 총계', '국내사 합계': '국내법인 합계',
    '해외사 합계': '해외법인 합계', '판매사 합계': '판매사 합계'
  }[entity.name] || entity.name;
  setText('selectedEntityName', displayName);
  setText('selectedEntityGroup', entity.group === '합계' ? '전체' : entity.group);
  setText('selectedMonth', '2026-04');
  setText('selectedTotal', fmtEok(tot));
  setText('latestMonthLabel', '2026-04');
  setText('trendSubtitle', `${entity.name} 기준 월별 채권잔액 추이`);

  // 비고
  const noteBox = document.getElementById('noteBox');
  if (entity.note) {
    noteBox.textContent = entity.note;
    noteBox.classList.remove('hidden');
  } else {
    noteBox.classList.add('hidden');
  }
}

// ── 추이 차트 (스택 바) ──
const PERIOD_LABELS = ['25-12', '26-01', '26-02', '26-03', '26-04'];
const PERIODS       = ['2025-12', '2026-01', '2026-02', '2026-03', '2026-04'];

function renderTrendChart(entity) {
  const ctx = document.getElementById('trendChart');
  const totals = PERIODS.map(p => entity.periods[p].total);
  const m3     = PERIODS.map(p => entity.periods[p]['3m']);
  const m46    = PERIODS.map(p => entity.periods[p]['4_6m']);
  const m712   = PERIODS.map(p => entity.periods[p]['7_12m']);
  const over1  = PERIODS.map(p => entity.periods[p].over1y);

  if (trendChart) trendChart.destroy();
  trendChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: PERIOD_LABELS,
      datasets: [
        { label: 'A 3개월이내', data: m3,   backgroundColor: 'rgba(47,107,255,0.78)',  borderRadius: 0, stack: 's' },
        { label: 'B 4~6개월',  data: m46,  backgroundColor: 'rgba(15,184,165,0.75)',  borderRadius: 0, stack: 's' },
        { label: 'C 7~12개월', data: m712, backgroundColor: 'rgba(245,158,11,0.80)',  borderRadius: 0, stack: 's' },
        { label: 'D 1년초과',  data: over1, backgroundColor: 'rgba(229,57,53,0.85)',  borderRadius: 4, stack: 's' },
        { label: '합계', data: totals, type: 'line', borderColor: '#334155', backgroundColor: 'transparent',
          tension: 0.25, pointRadius: 4, pointHoverRadius: 6, borderWidth: 2.5, yAxisID: 'y', borderDash: [5, 4] }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: '#334155', usePointStyle: true, boxWidth: 10, padding: 16 } },
        tooltip: {
          backgroundColor: 'rgba(15,23,42,0.92)', padding: 12,
          callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${fmtEok(ctx.parsed.y)}` }
        }
      },
      scales: {
        x: { stacked: true, ticks: { color: '#64748b' }, grid: { color: 'rgba(148,163,184,0.12)', drawBorder: false } },
        y: { stacked: true, title: { display: true, text: '억원', color: '#64748b', font: { weight: '700' } },
          ticks: { color: '#64748b' }, grid: { color: 'rgba(148,163,184,0.14)', drawBorder: false } }
      }
    }
  });
}

// ── 도넛 차트 ──
function renderShareChart(entity) {
  const canvas = document.getElementById('shareChart');
  if (!canvas) return;
  const p = entity.periods['2026-04'];
  const labels = ['A 3개월이내', 'B 4~6개월', 'C 7~12개월', 'D 1년초과'];
  const values = [p['3m'], p['4_6m'], p['7_12m'], p.over1y];
  const total = values.reduce((a, b) => a + b, 0);

  setText('shareSubtitle', `${entity.name} — 2026-04 채권 구성비`);
  if (shareChart) shareChart.destroy();
  shareChart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: ['rgba(47,107,255,0.85)', 'rgba(15,184,165,0.82)', 'rgba(245,158,11,0.85)', 'rgba(229,57,53,0.85)'],
        borderColor: '#ffffff', borderWidth: 2, hoverOffset: 8
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '62%',
      plugins: {
        legend: { position: 'bottom', labels: { color: '#334155', usePointStyle: true, boxWidth: 10, padding: 10, font: { size: 11 } } },
        tooltip: {
          backgroundColor: 'rgba(15,23,42,0.92)',
          callbacks: { label: (ctx) => `${ctx.label}: ${fmtEok(ctx.parsed)} (${total ? (ctx.parsed / total * 100).toFixed(1) : '0.0'}%)` }
        }
      }
    }
  });
}

// ── 바 비교 차트 ──
function renderBarChart(entity) {
  const ctx = document.getElementById('barChart');
  const compareList = getCompareEntities(entity);
  const data = compareList
    .map(e => ({ name: e.name, value: e.periods['2026-04'].total || 0 }))
    .filter(d => d.value > 0)
    .sort((a, b) => b.value - a.value);

  setText('compareSubtitle', `2026-04 기준 ${entity.group === '합계' ? '전체' : entity.group} 법인별 채권 비교`);
  if (barChart) barChart.destroy();
  barChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.map(d => d.name),
      datasets: [{
        label: '채권합계',
        data: data.map(d => d.value),
        backgroundColor: data.map(d => d.name === entity.name ? 'rgba(47,107,255,0.88)' : 'rgba(15,184,165,0.60)'),
        borderColor: data.map(d => d.name === entity.name ? 'rgba(47,107,255,1)' : 'rgba(15,184,165,0.75)'),
        borderWidth: 1, borderRadius: 10, maxBarThickness: 34
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false },
        tooltip: { backgroundColor: 'rgba(15,23,42,0.92)', callbacks: { label: (ctx) => ` ${fmtEok(ctx.parsed.y)}` } }
      },
      scales: {
        x: { ticks: { color: '#64748b', autoSkip: false, minRotation: 35, maxRotation: 35 }, grid: { display: false } },
        y: { title: { display: true, text: '억원', color: '#64748b', font: { weight: '700' } },
          ticks: { color: '#64748b' }, grid: { color: 'rgba(148,163,184,0.14)', drawBorder: false } }
      }
    }
  });
}

// ── 전월대비 증감 차트 ──
function renderMomChart(entity) {
  const ctx = document.getElementById('momChart');
  const compareList = getCompareEntities(entity);
  const data = compareList
    .map(e => ({ name: e.name, value: e.mom_total || 0 }))
    .sort((a, b) => b.value - a.value);

  setText('momSubtitle', `2026-04 기준 ${entity.group === '합계' ? '전체' : entity.group} 법인별 전월대비 채권 증감`);
  if (momChart) momChart.destroy();
  momChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.map(d => d.name),
      datasets: [{
        label: '전월대비',
        data: data.map(d => d.value),
        backgroundColor: data.map(d => d.value > 0 ? 'rgba(229,57,53,0.75)' : 'rgba(21,101,192,0.72)'),
        borderColor: data.map(d => d.value > 0 ? 'rgba(229,57,53,0.95)' : 'rgba(21,101,192,0.90)'),
        borderWidth: 1, borderRadius: 6, maxBarThickness: 30
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false },
        tooltip: { backgroundColor: 'rgba(15,23,42,0.92)', callbacks: { label: (ctx) => ` ${fmtChg(ctx.parsed.y)}` } }
      },
      scales: {
        x: { ticks: { color: '#64748b', autoSkip: false, minRotation: 35, maxRotation: 35 }, grid: { display: false } },
        y: { title: { display: true, text: '억원', color: '#64748b', font: { weight: '700' } },
          ticks: { color: '#64748b' }, grid: { color: 'rgba(148,163,184,0.14)', drawBorder: false } }
      }
    }
  });
}

// ── 상세 테이블 ──
function renderDetailTable(entity) {
  const tbody = document.getElementById('detailTableBody');
  tbody.innerHTML = '';
  PERIODS.forEach(period => {
    const p = entity.periods[period];
    const label = period.replace('20', '');
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${label}</td>
      <td>${fmtEok(p.total)}</td>
      <td>${fmtEok(p['3m'])}</td>
      <td>${fmtEok(p['4_6m'])}</td>
      <td>${fmtEok(p['7_12m'])}</td>
      <td>${fmtEok(p.over1y)}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ── 법인 선택 ──
function selectEntity(name) {
  selectedEntityName = name;
  const entity = findEntity(name);
  if (!entity) return;
  updateButtonState();
  renderKpis(entity);
  renderTrendChart(entity);
  renderBarChart(entity);
  renderShareChart(entity);
  renderDetailTable(entity);
  renderMomChart(entity);
}

// ── 인증 ──
async function sha256(text) {
  const enc = new TextEncoder().encode(text);
  const buffer = await crypto.subtle.digest('SHA-256', enc);
  return [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function unlock() {
  const input = document.getElementById('passwordInput').value;
  const msg   = document.getElementById('gateMsg');
  const hash  = await sha256(input);
  if (hash === window.DASHBOARD_CONFIG.passwordHash) {
    document.getElementById('gate').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    msg.textContent = '';
  } else {
    msg.textContent = '비밀번호가 올바르지 않습니다.';
  }
}

async function checkAutoLogin() {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('v'), user = urlParams.get('u');
  if (!token || !user) return false;
  const today   = new Date();
  const todayStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2,'0')}${String(today.getDate()).padStart(2,'0')}`;
  const expected = await sha256(`buhmwoo2026!@#${user}${todayStr}`);
  if (token === expected) {
    document.getElementById('gate').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    return true;
  }
  return false;
}

// ── 컨트롤 버튼 ──
function setupAppControls() {
  const btnBack   = document.getElementById('btnBackToMain');
  const btnLogout = document.getElementById('btnAppLogout');
  const urlParams = new URLSearchParams(window.location.search);
  const returnUrl = urlParams.get('return_url');

  if (btnBack) {
    btnBack.addEventListener('click', () => {
      const target = returnUrl || document.referrer;
      if (target) window.top.location.href = target;
      else window.history.back();
    });
  }
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      let target = returnUrl || document.referrer;
      if (!target) { window.history.back(); return; }
      const sep = target.includes('?') ? '&' : '?';
      window.top.location.href = target + sep + 'logout=true';
    });
  }
}

// ── 초기화 ──
async function initDashboard() {
  const isAuto = await checkAutoLogin();
  if (!isAuto) {
    const hintWrap = document.getElementById('gateHintWrap');
    const hintText = document.getElementById('passwordHint');
    if (window.DASHBOARD_CONFIG.passwordHint) {
      hintText.textContent = window.DASHBOARD_CONFIG.passwordHint;
      hintWrap.classList.remove('hidden');
    }
    document.getElementById('unlockBtn').addEventListener('click', unlock);
    document.getElementById('passwordInput').addEventListener('keydown', e => { if (e.key === 'Enter') unlock(); });
  }

  dashboardData = {"latestMonth": "2026-04", "unit": "억원", "entities": [{"name": "범우연합 합계", "group": "합계", "is_leaf": false, "periods": {"2025-12": {"total": 935.71, "3m": 651.97, "4_6m": 92.2, "7_12m": 147.59, "over1y": 43.95}, "2026-01": {"total": 969.14, "3m": 693.27, "4_6m": 86.83, "7_12m": 141.62, "over1y": 47.42}, "2026-02": {"total": 926.21, "3m": 635.54, "4_6m": 97.99, "7_12m": 129.85, "over1y": 62.84}, "2026-03": {"total": 953.57, "3m": 653.26, "4_6m": 115.12, "7_12m": 114.48, "over1y": 70.7}, "2026-04": {"total": 1010.73, "3m": 724.28, "4_6m": 107.62, "7_12m": 102.87, "over1y": 75.96}}, "yoy_total": 75.02, "yoy_3m": 72.31, "yoy_4_6m": 15.42, "yoy_7_12m": -44.72, "yoy_over1y": 32.01, "mom_total": 57.16, "mom_3m": 71.02, "mom_4_6m": -7.51, "mom_7_12m": -11.62, "mom_over1y": 5.27, "note": ""}, {"name": "국내사 합계", "group": "국내법인", "is_leaf": false, "periods": {"2025-12": {"total": 642.25, "3m": 428.03, "4_6m": 57.31, "7_12m": 131.43, "over1y": 25.48}, "2026-01": {"total": 666.51, "3m": 457.6, "4_6m": 53.73, "7_12m": 124.25, "over1y": 30.94}, "2026-02": {"total": 634.55, "3m": 412.91, "4_6m": 64.59, "7_12m": 111.24, "over1y": 45.8}, "2026-03": {"total": 659.54, "3m": 428.03, "4_6m": 78.2, "7_12m": 98.14, "over1y": 55.17}, "2026-04": {"total": 701.06, "3m": 475.38, "4_6m": 75.7, "7_12m": 88.71, "over1y": 61.27}}, "yoy_total": 58.81, "yoy_3m": 47.35, "yoy_4_6m": 18.38, "yoy_7_12m": -42.72, "yoy_over1y": 35.8, "mom_total": 41.52, "mom_3m": 47.35, "mom_4_6m": -2.51, "mom_7_12m": -9.43, "mom_over1y": 6.1, "note": ""}, {"name": "해외사 합계", "group": "해외법인", "is_leaf": false, "periods": {"2025-12": {"total": 260.42, "3m": 193.57, "4_6m": 33.61, "7_12m": 15.1, "over1y": 18.13}, "2026-01": {"total": 267.8, "3m": 203.4, "4_6m": 31.96, "7_12m": 16.55, "over1y": 15.89}, "2026-02": {"total": 258.4, "3m": 192.72, "4_6m": 31.45, "7_12m": 17.93, "over1y": 16.3}, "2026-03": {"total": 255.69, "3m": 189.7, "4_6m": 35.54, "7_12m": 15.9, "over1y": 14.55}, "2026-04": {"total": 269.41, "3m": 211.31, "4_6m": 30.67, "7_12m": 14.09, "over1y": 13.34}}, "yoy_total": 9.0, "yoy_3m": 17.73, "yoy_4_6m": -2.94, "yoy_7_12m": -1.01, "yoy_over1y": -4.79, "mom_total": 13.72, "mom_3m": 21.61, "mom_4_6m": -4.87, "mom_7_12m": -1.81, "mom_over1y": -1.21, "note": ""}, {"name": "판매사 합계", "group": "판매사", "is_leaf": false, "periods": {"2025-12": {"total": 33.04, "3m": 30.36, "4_6m": 1.27, "7_12m": 1.06, "over1y": 0.35}, "2026-01": {"total": 34.83, "3m": 32.28, "4_6m": 1.15, "7_12m": 0.82, "over1y": 0.59}, "2026-02": {"total": 33.26, "3m": 29.91, "4_6m": 1.95, "7_12m": 0.68, "over1y": 0.73}, "2026-03": {"total": 38.34, "3m": 35.54, "4_6m": 1.38, "7_12m": 0.44, "over1y": 0.97}, "2026-04": {"total": 40.25, "3m": 37.59, "4_6m": 1.25, "7_12m": 0.06, "over1y": 1.35}}, "yoy_total": 7.21, "yoy_3m": 7.23, "yoy_4_6m": -0.02, "yoy_7_12m": -1.0, "yoy_over1y": 1.0, "mom_total": 1.91, "mom_3m": 2.05, "mom_4_6m": -0.13, "mom_7_12m": -0.38, "mom_over1y": 0.38, "note": ""}, {"name": "BWC", "group": "국내법인", "is_leaf": true, "periods": {"2025-12": {"total": 365.69, "3m": 217.25, "4_6m": 38.22, "7_12m": 88.48, "over1y": 21.73}, "2026-01": {"total": 361.98, "3m": 222.23, "4_6m": 37.42, "7_12m": 76.27, "over1y": 26.05}, "2026-02": {"total": 345.17, "3m": 201.32, "4_6m": 38.76, "7_12m": 69.61, "over1y": 35.49}, "2026-03": {"total": 357.88, "3m": 196.74, "4_6m": 45.1, "7_12m": 66.18, "over1y": 49.86}, "2026-04": {"total": 381.65, "3m": 220.78, "4_6m": 39.42, "7_12m": 62.23, "over1y": 59.21}}, "yoy_total": 15.95, "yoy_3m": 3.52, "yoy_4_6m": 1.2, "yoy_7_12m": -26.25, "yoy_over1y": 37.48, "mom_total": 23.77, "mom_3m": 24.04, "mom_4_6m": -5.67, "mom_7_12m": -3.95, "mom_over1y": 9.35, "note": ""}, {"name": "BW", "group": "국내법인", "is_leaf": true, "periods": {"2025-12": {"total": 62.88, "3m": 49.48, "4_6m": 4.97, "7_12m": 8.43, "over1y": 0.01}, "2026-01": {"total": 72.05, "3m": 56.79, "4_6m": 4.15, "7_12m": 11.1, "over1y": 0.01}, "2026-02": {"total": 69.49, "3m": 52.84, "4_6m": 6.77, "7_12m": 8.62, "over1y": 1.26}, "2026-03": {"total": 68.44, "3m": 50.43, "4_6m": 9.32, "7_12m": 8.06, "over1y": 0.63}, "2026-04": {"total": 71.8, "3m": 51.56, "4_6m": 11.06, "7_12m": 9.16, "over1y": 0.01}}, "yoy_total": 8.91, "yoy_3m": 2.09, "yoy_4_6m": 6.09, "yoy_7_12m": 0.73, "yoy_over1y": 0.0, "mom_total": 3.36, "mom_3m": 1.14, "mom_4_6m": 1.73, "mom_7_12m": 1.1, "mom_over1y": -0.61, "note": ""}, {"name": "BEX", "group": "국내법인", "is_leaf": true, "periods": {"2025-12": {"total": 125.3, "3m": 74.39, "4_6m": 12.9, "7_12m": 34.52, "over1y": 3.49}, "2026-01": {"total": 135.83, "3m": 82.67, "4_6m": 11.65, "7_12m": 36.88, "over1y": 4.63}, "2026-02": {"total": 135.48, "3m": 76.31, "4_6m": 17.35, "7_12m": 33.01, "over1y": 8.81}, "2026-03": {"total": 124.21, "3m": 73.88, "4_6m": 21.97, "7_12m": 23.9, "over1y": 4.45}, "2026-04": {"total": 128.12, "3m": 85.13, "4_6m": 23.68, "7_12m": 17.32, "over1y": 2.0}}, "yoy_total": 2.82, "yoy_3m": 10.74, "yoy_4_6m": 10.78, "yoy_7_12m": -17.2, "yoy_over1y": -1.49, "mom_total": 3.92, "mom_3m": 11.24, "mom_4_6m": 1.71, "mom_7_12m": -6.58, "mom_over1y": -2.46, "note": ""}, {"name": "KCC", "group": "국내법인", "is_leaf": true, "periods": {"2025-12": {"total": 88.38, "3m": 86.92, "4_6m": 1.22, "7_12m": 0.0, "over1y": 0.24}, "2026-01": {"total": 96.65, "3m": 95.91, "4_6m": 0.5, "7_12m": 0.0, "over1y": 0.24}, "2026-02": {"total": 84.4, "3m": 82.45, "4_6m": 1.72, "7_12m": 0.0, "over1y": 0.24}, "2026-03": {"total": 109.02, "3m": 106.98, "4_6m": 1.81, "7_12m": 0.0, "over1y": 0.24}, "2026-04": {"total": 119.5, "3m": 117.92, "4_6m": 1.53, "7_12m": 0.0, "over1y": 0.05}}, "yoy_total": 31.12, "yoy_3m": 31.0, "yoy_4_6m": 0.31, "yoy_7_12m": 0.0, "yoy_over1y": -0.19, "mom_total": 10.48, "mom_3m": 10.94, "mom_4_6m": -0.28, "mom_7_12m": 0.0, "mom_over1y": -0.18, "note": ""}, {"name": "통합구매", "group": "국내법인", "is_leaf": true, "periods": {"2025-12": {"total": 287.28, "3m": 85.1, "4_6m": 50.81, "7_12m": 131.29, "over1y": 20.09}, "2026-01": {"total": 284.21, "3m": 86.94, "4_6m": 47.75, "7_12m": 123.87, "over1y": 25.64}, "2026-02": {"total": 280.7, "3m": 74.84, "4_6m": 54.0, "7_12m": 110.71, "over1y": 41.15}, "2026-03": {"total": 280.52, "3m": 62.77, "4_6m": 69.91, "7_12m": 97.19, "over1y": 50.66}, "2026-04": {"total": 270.05, "3m": 58.48, "4_6m": 67.57, "7_12m": 87.72, "over1y": 56.28}}, "yoy_total": -17.23, "yoy_3m": -26.62, "yoy_4_6m": 16.77, "yoy_7_12m": -43.57, "yoy_over1y": 36.19, "mom_total": -10.47, "mom_3m": -4.29, "mom_4_6m": -2.33, "mom_7_12m": -9.47, "mom_over1y": 5.62, "note": "- 4월 : VBC $84만, BWA $80만, YBI $45만, BWI $34만, BWA USA $37만"}, {"name": "BWK", "group": "해외법인", "is_leaf": true, "periods": {"2025-12": {"total": 68.31, "3m": 43.24, "4_6m": 19.04, "7_12m": 3.03, "over1y": 3.0}, "2026-01": {"total": 67.34, "3m": 44.22, "4_6m": 15.88, "7_12m": 4.45, "over1y": 2.78}, "2026-02": {"total": 63.55, "3m": 38.67, "4_6m": 16.87, "7_12m": 5.79, "over1y": 2.23}, "2026-03": {"total": 67.94, "3m": 40.75, "4_6m": 19.36, "7_12m": 5.82, "over1y": 2.02}, "2026-04": {"total": 64.45, "3m": 43.27, "4_6m": 13.51, "7_12m": 5.37, "over1y": 2.31}}, "yoy_total": -3.85, "yoy_3m": 0.03, "yoy_4_6m": -5.53, "yoy_7_12m": 2.35, "yoy_over1y": -0.7, "mom_total": -3.49, "mom_3m": 2.51, "mom_4_6m": -5.85, "mom_7_12m": -0.45, "mom_over1y": 0.29, "note": "- 악화 : 위해범우 +66,  소주보가몽 +25, 위해범우 +17, 강소진합 +9  등
- 위험 : 일조코넥, 항력발동 등"}, {"name": "SYTK", "group": "해외법인", "is_leaf": true, "periods": {"2025-12": {"total": 4.51, "3m": 3.67, "4_6m": 0.84, "7_12m": 0.0, "over1y": 0.0}, "2026-01": {"total": 4.39, "3m": 3.72, "4_6m": 0.67, "7_12m": 0.0, "over1y": 0.0}, "2026-02": {"total": 4.23, "3m": 3.37, "4_6m": 0.85, "7_12m": 0.0, "over1y": 0.0}, "2026-03": {"total": 3.89, "3m": 3.01, "4_6m": 0.89, "7_12m": 0.0, "over1y": 0.0}, "2026-04": {"total": 3.92, "3m": 3.15, "4_6m": 0.77, "7_12m": 0.0, "over1y": 0.0}}, "yoy_total": -0.59, "yoy_3m": -0.52, "yoy_4_6m": -0.07, "yoy_7_12m": 0.0, "yoy_over1y": 0.0, "mom_total": 0.03, "mom_3m": 0.14, "mom_4_6m": -0.11, "mom_7_12m": 0.0, "mom_over1y": 0.0, "note": "- 악화 : 위해범우 +7, 진황도아이스디 +5, 강음한일 +2 등"}, {"name": "VBC", "group": "해외법인", "is_leaf": true, "periods": {"2025-12": {"total": 104.11, "3m": 70.01, "4_6m": 8.78, "7_12m": 11.57, "over1y": 13.75}, "2026-01": {"total": 118.06, "3m": 85.4, "4_6m": 9.28, "7_12m": 11.67, "over1y": 11.7}, "2026-02": {"total": 105.75, "3m": 73.8, "4_6m": 7.41, "7_12m": 11.83, "over1y": 12.71}, "2026-03": {"total": 97.54, "3m": 67.14, "4_6m": 9.38, "7_12m": 9.75, "over1y": 11.28}, "2026-04": {"total": 105.47, "3m": 75.76, "4_6m": 11.56, "7_12m": 8.4, "over1y": 9.76}}, "yoy_total": 1.36, "yoy_3m": 5.75, "yoy_4_6m": 2.78, "yoy_7_12m": -3.17, "yoy_over1y": -3.99, "mom_total": 7.93, "mom_3m": 8.62, "mom_4_6m": 2.18, "mom_7_12m": -1.35, "mom_over1y": -1.51, "note": "- 악화 : KND +57, Tech Oil +42, KHANG DUY PHÁT + 41, M&C +39 등
- 위험 : 서진그룹, Texon, M&C, DSP 등"}, {"name": "YBI", "group": "해외법인", "is_leaf": true, "periods": {"2025-12": {"total": 50.48, "3m": 46.7, "4_6m": 2.29, "7_12m": 0.24, "over1y": 1.26}, "2026-01": {"total": 48.78, "3m": 45.19, "4_6m": 2.18, "7_12m": 0.13, "over1y": 1.28}, "2026-02": {"total": 51.7, "3m": 46.81, "4_6m": 3.49, "7_12m": 0.13, "over1y": 1.27}, "2026-03": {"total": 52.85, "3m": 49.5, "4_6m": 2.13, "7_12m": 0.05, "over1y": 1.18}, "2026-04": {"total": 64.96, "3m": 61.67, "4_6m": 1.99, "7_12m": 0.1, "over1y": 1.19}}, "yoy_total": 14.48, "yoy_3m": 14.97, "yoy_4_6m": -0.3, "yoy_7_12m": -0.14, "yoy_over1y": -0.06, "mom_total": 12.11, "mom_3m": 12.18, "mom_4_6m": -0.14, "mom_7_12m": 0.06, "mom_over1y": 0.01, "note": "- 악화 : Sultan +42, Amber +24, Intelii +14, Aprocool +20, ASM +9
           Focus +4 등
- 위험 : C J POLYTECH, Intelii, CNH 등"}, {"name": "BWI", "group": "해외법인", "is_leaf": true, "periods": {"2025-12": {"total": 7.87, "3m": 5.19, "4_6m": 2.41, "7_12m": 0.15, "over1y": 0.12}, "2026-01": {"total": 8.16, "3m": 5.06, "4_6m": 2.79, "7_12m": 0.19, "over1y": 0.12}, "2026-02": {"total": 8.08, "3m": 5.68, "4_6m": 2.13, "7_12m": 0.18, "over1y": 0.08}, "2026-03": {"total": 8.48, "3m": 5.74, "4_6m": 2.37, "7_12m": 0.28, "over1y": 0.08}, "2026-04": {"total": 8.22, "3m": 5.52, "4_6m": 2.41, "7_12m": 0.21, "over1y": 0.08}}, "yoy_total": 0.35, "yoy_3m": 0.33, "yoy_4_6m": -0.0, "yoy_7_12m": 0.06, "yoy_over1y": -0.04, "mom_total": -0.26, "mom_3m": -0.22, "mom_4_6m": 0.04, "mom_7_12m": -0.07, "mom_over1y": 0.0, "note": "- 악화 : Win + 95, JY + 24,  SSK +18, YOOWON +6, KTI +6 등
- 위험 : Skyline, Tongil, Mugunghwa, TUNGGAL 등"}, {"name": "BWA", "group": "해외법인", "is_leaf": true, "periods": {"2025-12": {"total": 21.25, "3m": 20.98, "4_6m": 0.25, "7_12m": 0.02, "over1y": 0.0}, "2026-01": {"total": 14.14, "3m": 13.29, "4_6m": 0.83, "7_12m": 0.02, "over1y": 0.0}, "2026-02": {"total": 18.99, "3m": 18.53, "4_6m": 0.45, "7_12m": 0.0, "over1y": 0.01}, "2026-03": {"total": 17.77, "3m": 16.38, "4_6m": 1.38, "7_12m": 0.0, "over1y": 0.0}, "2026-04": {"total": 13.96, "3m": 13.67, "4_6m": 0.28, "7_12m": 0.01, "over1y": 0.0}}, "yoy_total": -7.29, "yoy_3m": -7.31, "yoy_4_6m": 0.03, "yoy_7_12m": -0.01, "yoy_over1y": 0.0, "mom_total": -3.8, "mom_3m": -2.71, "mom_4_6m": -1.1, "mom_7_12m": 0.01, "mom_over1y": 0.0, "note": "- 악화 : DYP +14, YSM +3, KIXX + 2 등
- 위험 : INTERMEX"}, {"name": "BWA USA", "group": "해외법인", "is_leaf": true, "periods": {"2025-12": {"total": 3.89, "3m": 3.79, "4_6m": 0.0, "7_12m": 0.1, "over1y": 0.0}, "2026-01": {"total": 6.93, "3m": 6.5, "4_6m": 0.33, "7_12m": 0.1, "over1y": 0.0}, "2026-02": {"total": 6.11, "3m": 5.86, "4_6m": 0.25, "7_12m": 0.0, "over1y": 0.0}, "2026-03": {"total": 7.22, "3m": 7.19, "4_6m": 0.04, "7_12m": 0.0, "over1y": 0.0}, "2026-04": {"total": 8.43, "3m": 8.28, "4_6m": 0.15, "7_12m": 0.0, "over1y": 0.0}}, "yoy_total": 4.54, "yoy_3m": 4.49, "yoy_4_6m": 0.15, "yoy_7_12m": -0.1, "yoy_over1y": 0.0, "mom_total": 1.2, "mom_3m": 1.09, "mom_4_6m": 0.11, "mom_7_12m": 0.0, "mom_over1y": 0.0, "note": "- 악화 : 현대트랜시스 +6, MS AUTOSYS +6, YBM TECH +3 등"}, {"name": "범우케미칼", "group": "판매사", "is_leaf": true, "periods": {"2025-12": {"total": 16.75, "3m": 15.14, "4_6m": 0.22, "7_12m": 1.06, "over1y": 0.33}, "2026-01": {"total": 18.53, "3m": 16.83, "4_6m": 0.32, "7_12m": 0.82, "over1y": 0.57}, "2026-02": {"total": 15.8, "3m": 14.13, "4_6m": 0.28, "7_12m": 0.67, "over1y": 0.71}, "2026-03": {"total": 19.71, "3m": 18.01, "4_6m": 0.32, "7_12m": 0.43, "over1y": 0.95}, "2026-04": {"total": 22.11, "3m": 20.2, "4_6m": 0.53, "7_12m": 0.06, "over1y": 1.33}}, "yoy_total": 5.36, "yoy_3m": 5.06, "yoy_4_6m": 0.3, "yoy_7_12m": -1.0, "yoy_over1y": 1.0, "mom_total": 2.41, "mom_3m": 2.2, "mom_4_6m": 0.21, "mom_7_12m": -0.38, "mom_over1y": 0.38, "note": "- 악화 : 범우루브 +28, 범우루브 +27, 세종엠테크 +2, 셰플러 +2 등"}, {"name": "㈜범우켐", "group": "판매사", "is_leaf": true, "periods": {"2025-12": {"total": 11.44, "3m": 10.97, "4_6m": 0.45, "7_12m": 0.0, "over1y": 0.02}, "2026-01": {"total": 10.64, "3m": 10.29, "4_6m": 0.33, "7_12m": 0.0, "over1y": 0.02}, "2026-02": {"total": 10.03, "3m": 9.44, "4_6m": 0.57, "7_12m": 0.01, "over1y": 0.02}, "2026-03": {"total": 10.13, "3m": 9.78, "4_6m": 0.31, "7_12m": 0.01, "over1y": 0.02}, "2026-04": {"total": 11.95, "3m": 11.78, "4_6m": 0.14, "7_12m": 0.01, "over1y": 0.02}}, "yoy_total": 0.51, "yoy_3m": 0.81, "yoy_4_6m": -0.3, "yoy_7_12m": 0.01, "yoy_over1y": -0.0, "mom_total": 1.82, "mom_3m": 1.99, "mom_4_6m": -0.17, "mom_7_12m": -0.01, "mom_over1y": 0.0, "note": "- 악화 : 오케이쿨텍 + 4, 오일테크 +  2 , 동원시스템 +2 등
- 위험 : 동원시스템"}, {"name": "범우화인켐", "group": "판매사", "is_leaf": true, "periods": {"2025-12": {"total": 4.85, "3m": 4.25, "4_6m": 0.6, "7_12m": 0.0, "over1y": 0.0}, "2026-01": {"total": 5.65, "3m": 5.16, "4_6m": 0.5, "7_12m": 0.0, "over1y": 0.0}, "2026-02": {"total": 7.44, "3m": 6.34, "4_6m": 1.1, "7_12m": 0.0, "over1y": 0.0}, "2026-03": {"total": 8.5, "3m": 7.75, "4_6m": 0.75, "7_12m": 0.0, "over1y": 0.0}, "2026-04": {"total": 6.19, "3m": 5.61, "4_6m": 0.58, "7_12m": 0.0, "over1y": 0.0}}, "yoy_total": 1.34, "yoy_3m": 1.36, "yoy_4_6m": -0.03, "yoy_7_12m": 0.0, "yoy_over1y": 0.0, "mom_total": -2.32, "mom_3m": -2.14, "mom_4_6m": -0.18, "mom_7_12m": 0.0, "mom_over1y": 0.0, "note": "- 악화 : 범우화학공업㈜호남 +23, 세풍코리아 +16, 엘케이네스트 +4
셰플러 + 3 등"}]};
  buildEntityButtons();
  setupAppControls();
  selectEntity('범우연합 합계');
}

initDashboard();
