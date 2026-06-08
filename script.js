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

  const res = await fetch('data.json');
  dashboardData = await res.json();
  buildEntityButtons();
  setupAppControls();
  selectEntity('범우연합 합계');
}

initDashboard();
