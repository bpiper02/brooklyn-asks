const INSIGHTS_URL = './data/311-insights.json';

const $ = (selector) => document.querySelector(selector);

function clean(value) {
  return String(value ?? '').trim();
}

export function validate311Insights(data) {
  if (!data || typeof data !== 'object') throw new Error('311 insights payload is missing');
  if (data.schemaVersion !== 1) throw new Error('Unsupported 311 insights schema');
  if (!Array.isArray(data.boards) || data.boards.length !== 18) throw new Error('311 insights must contain all 18 Brooklyn boards');
  const seen = new Set();
  for (const board of data.boards) {
    if (!Number.isInteger(board.board) || board.board < 1 || board.board > 18) throw new Error('Invalid Brooklyn board in 311 insights');
    if (seen.has(board.board)) throw new Error(`Duplicate 311 insight for board ${board.board}`);
    seen.add(board.board);
    if (!board.period || !Number.isInteger(board.period.months) || board.period.months < 1) throw new Error(`Invalid period for board ${board.board}`);
    if (!Number.isFinite(board.total) || board.total < 0) throw new Error(`Invalid total for board ${board.board}`);
    if (!Array.isArray(board.topProblems)) throw new Error(`Missing top problems for board ${board.board}`);
  }
  return true;
}

function monthName(month) {
  return new Intl.DateTimeFormat('en-US', {month:'short', timeZone:'UTC'}).format(new Date(Date.UTC(2024, month - 1, 1))).toUpperCase();
}

export function periodLabel(period) {
  if (!period || !Number.isInteger(period.endYear) || !Number.isInteger(period.endMonth) || !Number.isInteger(period.months)) return 'Latest complete period';
  const endOrdinal = period.endYear * 12 + (period.endMonth - 1);
  const startOrdinal = endOrdinal - period.months + 1;
  const startYear = Math.floor(startOrdinal / 12);
  const startMonth = (startOrdinal % 12) + 1;
  return `${monthName(startMonth)} ${startYear}–${monthName(period.endMonth)} ${period.endYear}`;
}

export function changeLabel(changePct) {
  if (!Number.isFinite(changePct)) return 'No reliable prior-year comparison';
  if (Math.abs(changePct) < 1) return 'About the same as the prior 12 months';
  const direction = changePct > 0 ? 'up' : 'down';
  return `${direction} ${Math.abs(changePct).toLocaleString('en-US',{maximumFractionDigits:1})}% vs the prior 12 months`;
}

function problemSignals(problem, months) {
  const signals = [];
  if (problem.monthsActive === months) signals.push(`reported every month`);
  else if (Number.isFinite(problem.monthsActive)) signals.push(`reported in ${problem.monthsActive} of ${months} months`);

  if (Number.isFinite(problem.changePct) && Math.abs(problem.changePct) >= 10) {
    signals.push(`${problem.changePct > 0 ? 'up' : 'down'} ${Math.abs(problem.changePct).toLocaleString('en-US',{maximumFractionDigits:1})}%`);
  }
  if (Number.isFinite(problem.overIndex) && problem.overIndex >= 1.2) {
    signals.push(`${problem.overIndex.toLocaleString('en-US',{maximumFractionDigits:1})}× its Brooklyn-wide share`);
  }
  return signals;
}

function escapeHtml(value='') {
  return clean(value).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[ch]));
}

function boardName(board) {
  const select = $('#boardFilter');
  const option = [...(select?.options || [])].find(item => Number(item.value) === Number(board));
  if (!option) return `Community Board ${String(board).padStart(2,'0')}`;
  return clean(option.textContent).replace(/^CB\s*\d+\s*[·•-]\s*/i,'') || `Community Board ${String(board).padStart(2,'0')}`;
}

function renderLoading() {
  const root = $('#neighborhoodPulse');
  if (!root) return;
  root.classList.add('is-loading');
  root.innerHTML = '<p class="pulse-state">Loading recent 311 patterns…</p>';
}

function renderError(message) {
  const root = $('#neighborhoodPulse');
  if (!root) return;
  root.classList.remove('is-loading');
  root.innerHTML = `<div class="pulse-state pulse-error"><strong>Recent 311 patterns are unavailable.</strong><span>${escapeHtml(message)}</span></div>`;
}

function renderBrooklynOverview(data) {
  const root = $('#neighborhoodPulse');
  const totals = data.boards.reduce((sum, board) => sum + Number(board.total || 0), 0);
  const period = data.boards[0]?.period;
  root.classList.remove('is-loading');
  root.innerHTML = `
    <div class="pulse-overview">
      <div>
        <p class="section-label">WHAT PEOPLE ARE REPORTING NOW</p>
        <h3>Pick a neighborhood for its recent 311 pattern.</h3>
        <p>See what people reported most, what persisted month after month, and which complaint types take up an unusually large share locally.</p>
      </div>
      <div class="pulse-overview-stat">
        <strong>${totals.toLocaleString()}</strong>
        <span>311 reports assigned to Brooklyn community boards</span>
        <small>${escapeHtml(periodLabel(period))}</small>
      </div>
    </div>
    <p class="pulse-caution">311 reports are service requests, not unique people or verified incidents. Pick a board from the map, board key, or Neighborhood filter.</p>
  `;
}

function renderBoardInsight(data, boardNumber) {
  const root = $('#neighborhoodPulse');
  const insight = data.boards.find(item => item.board === boardNumber);
  if (!insight) {
    renderError(`No 311 summary was found for Community Board ${boardNumber}.`);
    return;
  }

  const problems = insight.topProblems.slice(0,5);
  root.classList.remove('is-loading');
  root.innerHTML = `
    <div class="pulse-head">
      <div>
        <p class="section-label">WHAT PEOPLE ARE REPORTING NOW</p>
        <h3>${escapeHtml(boardName(boardNumber))}</h3>
        <p>${escapeHtml(periodLabel(insight.period))} · last ${insight.period.months} complete months</p>
      </div>
      <div class="pulse-total">
        <strong>${Number(insight.total).toLocaleString()}</strong>
        <span>311 reports</span>
        <small>${escapeHtml(changeLabel(insight.changePct))}</small>
      </div>
    </div>
    <div class="pulse-problems">
      ${problems.length ? problems.map((problem,index) => {
        const signals = problemSignals(problem, insight.period.months);
        return `<article class="pulse-problem">
          <span class="pulse-rank">${String(index+1).padStart(2,'0')}</span>
          <div>
            <h4>${escapeHtml(problem.problem)}</h4>
            <p><strong>${Number(problem.count).toLocaleString()}</strong> reports · ${Number(problem.sharePct || 0).toLocaleString('en-US',{maximumFractionDigits:1})}% of this board’s 311 reports</p>
            ${signals.length ? `<small>${signals.map(escapeHtml).join(' · ')}</small>` : '<small>No stronger comparison signal shown.</small>'}
          </div>
        </article>`;
      }).join('') : '<p class="pulse-state">No recent 311 complaint summary is available for this board.</p>'}
    </div>
    <div class="pulse-foot">
      <span>Source: NYC 311 Service Requests</span>
      <span>Brooklyn comparison uses complaint share, not raw board volume.</span>
    </div>
  `;
}

async function loadInsights() {
  renderLoading();
  const response = await fetch(INSIGHTS_URL, {cache:'no-cache'});
  if (!response.ok) throw new Error(`311 data file returned ${response.status}`);
  const data = await response.json();
  validate311Insights(data);
  return data;
}

function selectedBoard() {
  const value = $('#boardFilter')?.value;
  if (!value || value === 'all') return null;
  const board = Number(value);
  return Number.isInteger(board) && board >= 1 && board <= 18 ? board : null;
}

function renderForSelection(data) {
  const board = selectedBoard();
  if (board) renderBoardInsight(data, board);
  else renderBrooklynOverview(data);
}

async function start() {
  const root = $('#neighborhoodPulse');
  if (!root) return;
  try {
    const data = await loadInsights();
    renderForSelection(data);
    $('#boardFilter')?.addEventListener('change', () => renderForSelection(data));
  } catch (error) {
    console.warn('311 intelligence unavailable', error);
    renderError(error?.message || 'Could not load the recent 311 summary.');
  }
}

document.addEventListener('DOMContentLoaded', start);
