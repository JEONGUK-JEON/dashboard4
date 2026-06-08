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
function getCompareEntities(entity) {
  if (!entity) return getLeafEntities();
  if (entity.group === '합계')   return getLeafEntities();
  if (entity.group === '국내법인') return getLeafEntities().filter(e => e.group === '국내법인');
  if (entity.group === '해외법인') return getLeafEntities().filter(e => e.group === '해외법인');
  if (entity.group === '판매사')  return getLeafEntities().filter(e => e.group === '판매사');
  return getLeafEntities().filter(e => e.group === entity.group);
}
function getLeafEntities() {
  const excludeNames = new Set(['범우연합 합계', '국내사 합계', '해외사 합계', '판매사 합계']);
  return dashboardData.entities.filter(e => !excludeNames.has(e.name));
}
function getGroupEntities() {
  return ['범우연합 합계', '국내사 합계', '해외사 합계', '판매사 합계']
    .map(n => findEntity(n)).filter(Boolean);
}

// ── 버튼 구성 ──
const GROUP_LABELS = {
  '국내법인': '국내법인',
  '해외법인': '해외법인',
  '판매사': '판매사',
};

function buildEntityButtons() {
  const container = document.getElementById('entityButtons');
  container.innerHTML = '';

  // 상단: 전체 + 그룹 합계
  const topRow = document.createElement('div');
  topRow.className = 'entity-row';
  getGroupEntities().forEach(e => {
    const btn = makeBtn(e.name, e.group === '합계' ? 'total-btn' : '');
    topRow.appendChild(btn);
  });
  container.appendChild(topRow);

  // 하위 법인 그룹별
  ['국내법인', '해외법인', '판매사'].forEach(groupName => {
    const leaves = getLeafEntities().filter(e => e.group === groupName);
    if (!leaves.length) return;
    const wrap = document.createElement('div');
    wrap.className = 'entity-subgroup';
    const label = document.createElement('div');
    label.className = 'entity-group-label';
    label.textContent = GROUP_LABELS[groupName] || groupName;
    wrap.appendChild(label);
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

  setText('selectedEntityName', entity.name);
  setText('selectedEntityGroup', entity.group);
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

  dashboardData = {"latestMonth": "2026-04", "unit": "억원", "entities": [{"name": "범우연합 합계", "group": "합계", "periods": {"2025-12": {"total": 648.43, "3m": 566.87, "4_6m": 41.39, "7_12m": 16.3, "over1y": 23.87}, "2026-01": {"total": 684.93, "3m": 606.33, "4_6m": 39.08, "7_12m": 17.75, "over1y": 21.77}, "2026-02": {"total": 645.52, "3m": 560.7, "4_6m": 43.99, "7_12m": 19.14, "over1y": 21.69}, "2026-03": {"total": 673.05, "3m": 590.5, "4_6m": 45.22, "7_12m": 17.3, "over1y": 20.04}, "2026-04": {"total": 740.68, "3m": 665.8, "4_6m": 40.04, "7_12m": 15.15, "over1y": 19.69}}, "yoy_total": 92.25, "yoy_3m": 98.93, "yoy_4_6m": -1.35, "yoy_7_12m": -1.15, "yoy_over1y": -4.18, "mom_total": 67.63, "mom_3m": 75.3, "mom_4_6m": -5.17, "mom_7_12m": -2.15, "mom_over1y": -0.35, "note": ""}, {"name": "국내사 합계", "group": "국내법인", "periods": {"2025-12": {"total": 354.98, "3m": 342.94, "4_6m": 6.51, "7_12m": 0.14, "over1y": 5.39}, "2026-01": {"total": 382.3, "3m": 370.65, "4_6m": 5.97, "7_12m": 0.38, "over1y": 5.29}, "2026-02": {"total": 353.85, "3m": 338.07, "4_6m": 10.59, "7_12m": 0.53, "over1y": 4.66}, "2026-03": {"total": 379.02, "3m": 365.26, "4_6m": 8.29, "7_12m": 0.95, "over1y": 4.51}, "2026-04": {"total": 431.02, "3m": 416.91, "4_6m": 8.12, "7_12m": 0.99, "over1y": 4.99}}, "yoy_total": 76.04, "yoy_3m": 73.97, "yoy_4_6m": 1.62, "yoy_7_12m": 0.85, "yoy_over1y": -0.39, "mom_total": 52.0, "mom_3m": 51.63, "mom_4_6m": -0.17, "mom_7_12m": 0.04, "mom_over1y": 0.49, "note": ""}, {"name": "해외사 합계", "group": "해외법인", "periods": {"2025-12": {"total": 287.28, "3m": 85.1, "4_6m": 50.81, "7_12m": 131.29, "over1y": 20.09}, "2026-01": {"total": 284.21, "3m": 86.94, "4_6m": 47.75, "7_12m": 123.87, "over1y": 25.64}, "2026-02": {"total": 280.7, "3m": 74.84, "4_6m": 53.98, "7_12m": 110.71, "over1y": 41.15}, "2026-03": {"total": 280.52, "3m": 62.77, "4_6m": 66.91, "7_12m": 97.19, "over1y": 53.66}, "2026-04": {"total": 270.05, "3m": 58.48, "4_6m": 67.57, "7_12m": 87.72, "over1y": 56.28}}, "yoy_total": -17.23, "yoy_3m": -26.62, "yoy_4_6m": 16.76, "yoy_7_12m": -43.57, "yoy_over1y": 36.19, "mom_total": -10.47, "mom_3m": -4.29, "mom_4_6m": 0.66, "mom_7_12m": -9.47, "mom_over1y": 2.62, "note": ""}, {"name": "판매사 합계", "group": "판매사", "periods": {"2025-12": {"total": 6.17, "3m": 5.21, "4_6m": 0.0, "7_12m": 0.0, "over1y": 0.0}, "2026-01": {"total": 8.42, "3m": 7.84, "4_6m": 0.0, "7_12m": 0.0, "over1y": 0.0}, "2026-02": {"total": 10.97, "3m": 10.21, "4_6m": 0.0, "7_12m": 0.0, "over1y": 0.0}, "2026-03": {"total": 13.51, "3m": 12.46, "4_6m": 0.0, "7_12m": 0.0, "over1y": 0.0}, "2026-04": {"total": 39.61, "3m": 38.3, "4_6m": 0.0, "7_12m": 0.0, "over1y": 0.0}}, "yoy_total": 33.44, "yoy_3m": 33.44, "yoy_4_6m": 0.0, "yoy_7_12m": 0.0, "yoy_over1y": 0.0, "mom_total": 26.1, "mom_3m": 25.84, "mom_4_6m": 0.0, "mom_7_12m": 0.0, "mom_over1y": 0.0, "note": ""}, {"name": "BWC", "group": "국내법인", "periods": {"2025-12": {"total": 365.69, "3m": 217.25, "4_6m": 38.22, "7_12m": 88.48, "over1y": 21.73}, "2026-01": {"total": 361.98, "3m": 222.23, "4_6m": 37.42, "7_12m": 76.27, "over1y": 26.05}, "2026-02": {"total": 345.17, "3m": 201.32, "4_6m": 38.76, "7_12m": 69.61, "over1y": 35.49}, "2026-03": {"total": 357.88, "3m": 196.74, "4_6m": 45.1, "7_12m": 66.18, "over1y": 49.86}, "2026-04": {"total": 381.65, "3m": 220.78, "4_6m": 39.42, "7_12m": 62.23, "over1y": 59.21}}, "yoy_total": 15.95, "yoy_3m": 21.37, "yoy_4_6m": -0.68, "yoy_7_12m": -0.42, "yoy_over1y": -2.01, "mom_total": 23.77, "mom_3m": 24.04, "mom_4_6m": -5.68, "mom_7_12m": -3.95, "mom_over1y": 9.35, "note": "- 악화 : 대영테크 +8, 영신에프엔에스 +7, 삼덕특수유 +5 등\n- 위험 : 보성선재, 일흥하이텍"}, {"name": "BW", "group": "국내법인", "periods": {"2025-12": {"total": 62.88, "3m": 49.48, "4_6m": 4.97, "7_12m": 8.43, "over1y": 0.01}, "2026-01": {"total": 72.05, "3m": 56.79, "4_6m": 4.15, "7_12m": 11.1, "over1y": 0.01}, "2026-02": {"total": 69.49, "3m": 52.84, "4_6m": 6.77, "7_12m": 8.62, "over1y": 1.26}, "2026-03": {"total": 68.44, "3m": 50.43, "4_6m": 9.32, "7_12m": 8.06, "over1y": 0.63}, "2026-04": {"total": 71.8, "3m": 51.56, "4_6m": 11.06, "7_12m": 9.16, "over1y": 0.01}}, "yoy_total": 8.91, "yoy_3m": 6.56, "yoy_4_6m": 8.59, "yoy_7_12m": 7.33, "yoy_over1y": 0.0, "mom_total": 3.36, "mom_3m": 1.13, "mom_4_6m": 1.74, "mom_7_12m": 1.1, "mom_over1y": -0.62, "note": "- 악화 : 제이에스피정밀 +1"}, {"name": "BEX", "group": "국내법인", "periods": {"2025-12": {"total": 125.3, "3m": 74.39, "4_6m": 12.9, "7_12m": 34.52, "over1y": 3.49}, "2026-01": {"total": 135.83, "3m": 82.67, "4_6m": 11.65, "7_12m": 36.88, "over1y": 4.63}, "2026-02": {"total": 135.48, "3m": 76.31, "4_6m": 17.35, "7_12m": 33.01, "over1y": 8.81}, "2026-03": {"total": 124.21, "3m": 73.88, "4_6m": 21.97, "7_12m": 23.9, "over1y": 4.45}, "2026-04": {"total": 128.12, "3m": 85.13, "4_6m": 23.68, "7_12m": 17.32, "over1y": 2.0}}, "yoy_total": 2.82, "yoy_3m": 10.74, "yoy_4_6m": 10.78, "yoy_7_12m": -17.2, "yoy_over1y": -1.49, "mom_total": 3.92, "mom_3m": 11.26, "mom_4_6m": 1.71, "mom_7_12m": -6.58, "mom_over1y": -2.45, "note": "- 악화 : 청솔케미칼 +72, 에이원케미칼 +36, 우리종합금속 +336, 서브원 +33, 제일종합상사 +17 등\n- 위험 : 우리종합금속, 지에스테크"}, {"name": "KCC", "group": "국내법인", "periods": {"2025-12": {"total": 88.38, "3m": 86.92, "4_6m": 1.22, "7_12m": 0.0, "over1y": 0.24}, "2026-01": {"total": 96.65, "3m": 95.91, "4_6m": 0.5, "7_12m": 0.0, "over1y": 0.24}, "2026-02": {"total": 84.4, "3m": 82.45, "4_6m": 1.72, "7_12m": 0.0, "over1y": 0.24}, "2026-03": {"total": 109.02, "3m": 106.98, "4_6m": 1.81, "7_12m": 0.0, "over1y": 0.24}, "2026-04": {"total": 119.5, "3m": 117.92, "4_6m": 1.53, "7_12m": 0.0, "over1y": 0.05}}, "yoy_total": 31.12, "yoy_3m": 30.99, "yoy_4_6m": 0.31, "yoy_7_12m": 0.0, "yoy_over1y": -0.19, "mom_total": 10.48, "mom_3m": 10.94, "mom_4_6m": -0.28, "mom_7_12m": 0.0, "mom_over1y": -0.18, "note": "- 악화 : 동성유화 +45, 호원켐 +34, 한국훅스윤활유 +14, 영남상사 +11 등"}, {"name": "BWK", "group": "해외법인", "periods": {"2025-12": {"total": 31.2, "3m": 3.12, "4_6m": 4.52, "7_12m": 4.94, "over1y": 0.04}, "2026-01": {"total": 33.57, "3m": 4.35, "4_6m": 9.87, "7_12m": 9.16, "over1y": 0.0}, "2026-02": {"total": 28.38, "3m": 4.09, "4_6m": 4.37, "7_12m": 11.49, "over1y": 8.43}, "2026-03": {"total": 28.9, "3m": 4.25, "4_6m": 10.72, "7_12m": 8.71, "over1y": 5.22}, "2026-04": {"total": 27.47, "3m": 3.91, "4_6m": 14.39, "7_12m": 9.17, "over1y": 0.0}}, "yoy_total": -3.73, "yoy_3m": 0.79, "yoy_4_6m": 9.87, "yoy_7_12m": 4.23, "yoy_over1y": -4.13, "mom_total": -1.43, "mom_3m": -0.35, "mom_4_6m": 3.67, "mom_7_12m": 0.46, "mom_over1y": -5.22, "note": ""}, {"name": "SYTK", "group": "해외법인", "periods": {"2025-12": {"total": 8.53, "3m": 5.71, "4_6m": 1.44, "7_12m": 1.38, "over1y": 0.0}, "2026-01": {"total": 7.87, "3m": 5.18, "4_6m": 2.12, "7_12m": 0.57, "over1y": 0.0}, "2026-02": {"total": 7.63, "3m": 4.86, "4_6m": 2.24, "7_12m": 0.53, "over1y": 0.0}, "2026-03": {"total": 7.05, "3m": 4.5, "4_6m": 1.48, "7_12m": 1.07, "over1y": 0.0}, "2026-04": {"total": 5.26, "3m": 3.77, "4_6m": 1.33, "7_12m": 0.16, "over1y": 0.0}}, "yoy_total": -3.27, "yoy_3m": -1.94, "yoy_4_6m": -0.11, "yoy_7_12m": -1.22, "yoy_over1y": 0.0, "mom_total": -1.8, "mom_3m": -0.73, "mom_4_6m": -0.15, "mom_7_12m": -0.91, "mom_over1y": 0.0, "note": ""}, {"name": "VBC", "group": "해외법인", "periods": {"2025-12": {"total": 93.85, "3m": 20.2, "4_6m": 17.86, "7_12m": 55.79, "over1y": 0.0}, "2026-01": {"total": 93.58, "3m": 19.58, "4_6m": 14.38, "7_12m": 59.62, "over1y": 0.0}, "2026-02": {"total": 92.56, "3m": 17.55, "4_6m": 20.2, "7_12m": 54.81, "over1y": 0.0}, "2026-03": {"total": 99.52, "3m": 14.62, "4_6m": 25.36, "7_12m": 42.17, "over1y": 17.37}, "2026-04": {"total": 101.91, "3m": 12.26, "4_6m": 20.2, "7_12m": 16.42, "over1y": 0.0}}, "yoy_total": 8.06, "yoy_3m": -7.94, "yoy_4_6m": 2.34, "yoy_7_12m": -39.37, "yoy_over1y": 0.0, "mom_total": 2.39, "mom_3m": -2.36, "mom_4_6m": -5.16, "mom_7_12m": -25.75, "mom_over1y": -17.37, "note": "- 4월 : VBC $84만"}, {"name": "YBI", "group": "해외법인", "periods": {"2025-12": {"total": 6.5, "3m": 5.75, "4_6m": 0.0, "7_12m": 0.75, "over1y": 0.0}, "2026-01": {"total": 6.46, "3m": 5.46, "4_6m": 0.0, "7_12m": 1.0, "over1y": 0.0}, "2026-02": {"total": 5.57, "3m": 4.22, "4_6m": 0.0, "7_12m": 1.35, "over1y": 0.0}, "2026-03": {"total": 5.28, "3m": 4.12, "4_6m": 0.0, "7_12m": 0.69, "over1y": 0.0}, "2026-04": {"total": 3.82, "3m": 3.11, "4_6m": 0.0, "7_12m": 0.52, "over1y": 0.0}}, "yoy_total": -2.68, "yoy_3m": -2.64, "yoy_4_6m": 0.0, "yoy_7_12m": -0.23, "yoy_over1y": 0.0, "mom_total": -1.47, "mom_3m": -1.01, "mom_4_6m": 0.0, "mom_7_12m": -0.17, "mom_over1y": 0.0, "note": "- 4월 : YBI $45만"}, {"name": "BWI", "group": "해외법인", "periods": {"2025-12": {"total": 22.73, "3m": 14.79, "4_6m": 5.78, "7_12m": 2.16, "over1y": 0.0}, "2026-01": {"total": 28.37, "3m": 16.63, "4_6m": 8.55, "7_12m": 3.19, "over1y": 0.0}, "2026-02": {"total": 27.93, "3m": 14.48, "4_6m": 8.5, "7_12m": 4.95, "over1y": 0.0}, "2026-03": {"total": 26.68, "3m": 13.21, "4_6m": 6.42, "7_12m": 7.05, "over1y": 0.0}, "2026-04": {"total": 28.08, "3m": 14.04, "4_6m": 1.39, "7_12m": 9.16, "over1y": 3.49}}, "yoy_total": 5.35, "yoy_3m": -0.75, "yoy_4_6m": -4.39, "yoy_7_12m": 6.97, "yoy_over1y": 3.53, "mom_total": 1.4, "mom_3m": 0.83, "mom_4_6m": -5.03, "mom_7_12m": 2.11, "mom_over1y": 3.49, "note": "- 4월 : BWI $34만"}, {"name": "BWA", "group": "해외법인", "periods": {"2025-12": {"total": 74.8, "3m": 22.08, "4_6m": 16.88, "7_12m": 23.36, "over1y": 12.48}, "2026-01": {"total": 61.52, "3m": 13.89, "4_6m": 8.55, "7_12m": 20.61, "over1y": 18.47}, "2026-02": {"total": 68.06, "3m": 16.1, "4_6m": 12.63, "7_12m": 23.3, "over1y": 16.03}, "2026-03": {"total": 56.67, "3m": 10.36, "4_6m": 14.3, "7_12m": 21.68, "over1y": 10.33}, "2026-04": {"total": 60.74, "3m": 12.1, "4_6m": 22.5, "7_12m": 16.63, "over1y": 9.51}}, "yoy_total": -14.06, "yoy_3m": -9.98, "yoy_4_6m": 5.62, "yoy_7_12m": -6.73, "yoy_over1y": -2.97, "mom_total": 4.07, "mom_3m": 1.74, "mom_4_6m": 8.2, "mom_7_12m": -5.05, "mom_over1y": -0.82, "note": "- 4월 : BWA $80만"}, {"name": "BWA USA", "group": "해외법인", "periods": {"2025-12": {"total": 8.17, "3m": 5.07, "4_6m": 4.86, "7_12m": 7.17, "over1y": 0.0}, "2026-01": {"total": 10.85, "3m": 8.28, "4_6m": 4.74, "7_12m": 7.17, "over1y": 0.0}, "2026-02": {"total": 11.87, "3m": 7.73, "4_6m": 10.76, "7_12m": 0.0, "over1y": 0.0}, "2026-03": {"total": 14.98, "3m": 8.43, "4_6m": 6.58, "7_12m": 4.35, "over1y": 0.0}, "2026-04": {"total": 11.41, "3m": 6.83, "4_6m": 4.86, "7_12m": 5.6, "over1y": 0.0}}, "yoy_total": 3.24, "yoy_3m": 1.76, "yoy_4_6m": 0.0, "yoy_7_12m": -1.57, "yoy_over1y": 0.0, "mom_total": -3.57, "mom_3m": -1.6, "mom_4_6m": -1.72, "mom_7_12m": 1.25, "mom_over1y": 0.0, "note": "- 4월 : BWA USA $37만"}, {"name": "BEX USA", "group": "해외법인", "periods": {"2025-12": {"total": 31.48, "3m": 8.1, "4_6m": 0.0, "7_12m": 16.42, "over1y": 6.96}, "2026-01": {"total": 41.99, "3m": 13.79, "4_6m": 0.0, "7_12m": 21.4, "over1y": 6.8}, "2026-02": {"total": 37.66, "3m": 11.2, "4_6m": 0.0, "7_12m": 18.52, "over1y": 7.94}, "2026-03": {"total": 41.44, "3m": 7.28, "4_6m": 7.05, "7_12m": 19.39, "over1y": 7.73}, "2026-04": {"total": 31.44, "3m": 6.4, "4_6m": 2.9, "7_12m": 20.26, "over1y": 1.85}}, "yoy_total": -0.04, "yoy_3m": -1.7, "yoy_4_6m": 2.9, "yoy_7_12m": 3.84, "yoy_over1y": -5.11, "mom_total": -10.0, "mom_3m": -0.88, "mom_4_6m": -4.15, "mom_7_12m": 0.87, "mom_over1y": -5.88, "note": ""}, {"name": "범우케미칼", "group": "판매사", "periods": {"2025-12": {"total": 2.95, "3m": 2.95, "4_6m": 0.0, "7_12m": 0.0, "over1y": 0.0}, "2026-01": {"total": 3.88, "3m": 3.88, "4_6m": 0.0, "7_12m": 0.0, "over1y": 0.0}, "2026-02": {"total": 5.17, "3m": 5.17, "4_6m": 0.0, "7_12m": 0.0, "over1y": 0.0}, "2026-03": {"total": 6.09, "3m": 6.09, "4_6m": 0.0, "7_12m": 0.0, "over1y": 0.0}, "2026-04": {"total": 21.74, "3m": 21.74, "4_6m": 0.0, "7_12m": 0.0, "over1y": 0.0}}, "yoy_total": 18.79, "yoy_3m": 18.79, "yoy_4_6m": 0.0, "yoy_7_12m": 0.0, "yoy_over1y": 0.0, "mom_total": 15.65, "mom_3m": 15.65, "mom_4_6m": 0.0, "mom_7_12m": 0.0, "mom_over1y": 0.0, "note": ""}, {"name": "범우켐", "group": "판매사", "periods": {"2025-12": {"total": 1.71, "3m": 1.71, "4_6m": 0.0, "7_12m": 0.0, "over1y": 0.0}, "2026-01": {"total": 2.29, "3m": 2.29, "4_6m": 0.0, "7_12m": 0.0, "over1y": 0.0}, "2026-02": {"total": 2.68, "3m": 2.68, "4_6m": 0.0, "7_12m": 0.0, "over1y": 0.0}, "2026-03": {"total": 3.2, "3m": 3.2, "4_6m": 0.0, "7_12m": 0.0, "over1y": 0.0}, "2026-04": {"total": 9.39, "3m": 9.39, "4_6m": 0.0, "7_12m": 0.0, "over1y": 0.0}}, "yoy_total": 7.68, "yoy_3m": 7.68, "yoy_4_6m": 0.0, "yoy_7_12m": 0.0, "yoy_over1y": 0.0, "mom_total": 6.19, "mom_3m": 6.19, "mom_4_6m": 0.0, "mom_7_12m": 0.0, "mom_over1y": 0.0, "note": ""}, {"name": "범우화인켐", "group": "판매사", "periods": {"2025-12": {"total": 1.51, "3m": 1.51, "4_6m": 0.0, "7_12m": 0.0, "over1y": 0.0}, "2026-01": {"total": 2.25, "3m": 2.25, "4_6m": 0.0, "7_12m": 0.0, "over1y": 0.0}, "2026-02": {"total": 3.12, "3m": 3.12, "4_6m": 0.0, "7_12m": 0.0, "over1y": 0.0}, "2026-03": {"total": 4.22, "3m": 4.22, "4_6m": 0.0, "7_12m": 0.0, "over1y": 0.0}, "2026-04": {"total": 8.48, "3m": 8.48, "4_6m": 0.0, "7_12m": 0.0, "over1y": 0.0}}, "yoy_total": 6.97, "yoy_3m": 6.97, "yoy_4_6m": 0.0, "yoy_7_12m": 0.0, "yoy_over1y": 0.0, "mom_total": 4.26, "mom_3m": 4.26, "mom_4_6m": 0.0, "mom_7_12m": 0.0, "mom_over1y": 0.0, "note": ""}]};
  buildEntityButtons();
  setupAppControls();
  selectEntity('범우연합 합계');
}

initDashboard();
