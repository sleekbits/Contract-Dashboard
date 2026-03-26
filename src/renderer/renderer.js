import { initTabs, setActiveTab } from './ui/tabs.js';
import { createTable } from './ui/table.js';
import { renderOverviewCharts, renderVOCharts } from './ui/charts.js';
import { applyContractFilters, applyVOFilters, uniqueValues } from './ui/filters.js';
import { showToast } from './ui/toasts.js';
import { deriveDataset } from './compute/deriveFields.js';
import { runQualityChecks } from './compute/qualityChecks.js';

(function setupNetworkGuard() {
  window.fetch = async () => {
    throw new Error('Network access is blocked in offline mode.');
  };
  window.XMLHttpRequest = class BlockedXHR {
    constructor() {
      throw new Error('XMLHttpRequest is blocked in offline mode.');
    }
  };
  window.WebSocket = class BlockedWebSocket {
    constructor() {
      throw new Error('WebSocket is blocked in offline mode.');
    }
  };
})();

let state = {
  data: { contracts: [], variationOrders: [], meta: {} },
  filteredContracts: [],
  filteredVOs: [],
  selectedContract: null
};

let contractsTable;
let voTable;

const contractFilters = {
  search: '', businessUnit: '', contractorName: '', contractType: '', status: '',
  signingStart: '', signingEnd: '', commencementStart: '', commencementEnd: '', expiryStart: '', expiryEnd: '', expiringSoonOnly: false
};

const voFilters = { contractReference: '', voStatus: '', voStart: '', voEnd: '' };

function exportCsv(rows, fileName) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const csv = [keys.join(',')]
    .concat(rows.map((r) => keys.map((k) => `"${String(r[k] ?? '').replace(/"/g, '""')}"`).join(',')))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

function renderOverview() {
  const el = document.getElementById('tab-overview');
  const total = state.filteredContracts.length;
  const active = state.filteredContracts.filter((c) => c.contractStatusAuto === 'Active').length;
  const expired = state.filteredContracts.filter((c) => c.contractStatusAuto === 'Expired').length;
  const soon = state.filteredContracts.filter((c) => c.contractStatusAuto === 'Expiring Soon').length;

  el.innerHTML = `
    <div class="grid">
      <div class="card"><div>Total contracts</div><div class="kpi-value">${total}</div></div>
      <div class="card"><div>Active</div><div class="kpi-value">${active}</div></div>
      <div class="card"><div>Expired</div><div class="kpi-value">${expired}</div></div>
      <div class="card"><div>Expiring Soon</div><div class="kpi-value">${soon}</div></div>
    </div>
    <div class="filter-row" id="quick-filters"></div>
    <div class="grid">
      <div class="card"><h3>Contracts by Business Unit</h3><canvas id="chart-bu"></canvas></div>
      <div class="card"><h3>Top Contractors by Count</h3><canvas id="chart-contractors"></canvas></div>
      <div class="card"><h3>Expiry Timeline</h3><canvas id="chart-expiry"></canvas></div>
      <div class="card"><h3>Total VO Amount Trend</h3><canvas id="chart-vo-trend"></canvas></div>
    </div>
  `;

  const quick = document.getElementById('quick-filters');
  quick.innerHTML = '';

  const qDefs = [
    ['businessUnit', 'Business Unit', uniqueValues(state.data.contracts, 'businessUnit')],
    ['contractorName', 'Contractor', uniqueValues(state.data.contracts, 'contractorName')],
    ['contractType', 'Type', uniqueValues(state.data.contracts, 'contractType')],
    ['status', 'Status', ['Active', 'Expired', 'Expiring Soon']]
  ];

  qDefs.forEach(([key, label, vals]) => {
    const select = document.createElement('select');
    select.innerHTML = `<option value="">${label}: All</option>${vals.map((v) => `<option>${v}</option>`).join('')}`;
    select.value = contractFilters[key] || '';
    select.onchange = () => {
      contractFilters[key] = select.value;
      applyAndRender();
    };
    quick.appendChild(select);
  });

  renderOverviewCharts({ ...state.data, contracts: state.filteredContracts });
}

function renderRegister() {
  const el = document.getElementById('tab-register');
  el.innerHTML = `
    <div class="card">
      <div class="filter-row" id="register-filters"></div>
      <div class="filter-row">
        <button id="btn-export-contracts">Export Filtered CSV</button>
      </div>
      <div id="register-table"></div>
    </div>
  `;

  const filters = document.getElementById('register-filters');
  filters.innerHTML = `
    <input id="f-search" placeholder="Search contracts..." value="${contractFilters.search}" />
    <select id="f-bu"></select>
    <select id="f-contractor"></select>
    <select id="f-type"></select>
    <select id="f-status"></select>
    <label><input type="checkbox" id="f-soon" ${contractFilters.expiringSoonOnly ? 'checked' : ''}/> Expiring Soon only</label>
    <input id="f-signing-start" type="date" value="${contractFilters.signingStart}" title="Signing Start" />
    <input id="f-signing-end" type="date" value="${contractFilters.signingEnd}" title="Signing End" />
    <input id="f-comm-start" type="date" value="${contractFilters.commencementStart}" title="Commencement Start" />
    <input id="f-comm-end" type="date" value="${contractFilters.commencementEnd}" title="Commencement End" />
    <input id="f-exp-start" type="date" value="${contractFilters.expiryStart}" title="Expiry Start" />
    <input id="f-exp-end" type="date" value="${contractFilters.expiryEnd}" title="Expiry End" />
  `;

  const fillSelect = (id, values, selected) => {
    const s = document.getElementById(id);
    s.innerHTML = `<option value="">All</option>${values.map((v) => `<option>${v}</option>`).join('')}`;
    s.value = selected || '';
  };
  fillSelect('f-bu', uniqueValues(state.data.contracts, 'businessUnit'), contractFilters.businessUnit);
  fillSelect('f-contractor', uniqueValues(state.data.contracts, 'contractorName'), contractFilters.contractorName);
  fillSelect('f-type', uniqueValues(state.data.contracts, 'contractType'), contractFilters.contractType);
  fillSelect('f-status', ['Active', 'Expired', 'Expiring Soon'], contractFilters.status);

  const bind = (id, key, check = false) => {
    const node = document.getElementById(id);
    node.addEventListener('input', () => {
      contractFilters[key] = check ? node.checked : node.value;
      applyAndRender();
    });
    node.addEventListener('change', () => {
      contractFilters[key] = check ? node.checked : node.value;
      applyAndRender();
    });
  };

  bind('f-search', 'search');
  bind('f-bu', 'businessUnit');
  bind('f-contractor', 'contractorName');
  bind('f-type', 'contractType');
  bind('f-status', 'status');
  bind('f-soon', 'expiringSoonOnly', true);
  bind('f-signing-start', 'signingStart');
  bind('f-signing-end', 'signingEnd');
  bind('f-comm-start', 'commencementStart');
  bind('f-comm-end', 'commencementEnd');
  bind('f-exp-start', 'expiryStart');
  bind('f-exp-end', 'expiryEnd');

  document.getElementById('btn-export-contracts').onclick = () => exportCsv(state.filteredContracts, 'contracts_filtered.csv');

  contractsTable = createTable({
    container: document.getElementById('register-table'),
    rows: state.filteredContracts,
    columns: [
      { key: 'contract', label: 'Contract' },
      { key: 'referenceNumber', label: 'Reference' },
      { key: 'businessUnit', label: 'Business Unit' },
      { key: 'contractorName', label: 'Contractor' },
      { key: 'contractType', label: 'Type' },
      { key: 'expiryDate', label: 'Expiry' },
      { key: 'contractStatusAuto', label: 'Status' },
      { key: 'totalVOAmount', label: 'Total VO Amount' }
    ],
    pageSize: 12,
    onRowClick: (row) => {
      state.selectedContract = row;
      renderDetails();
      setActiveTab('details');
    }
  });
}

function renderDetails() {
  const el = document.getElementById('tab-details');
  const c = state.selectedContract || state.filteredContracts[0];
  if (!c) {
    el.innerHTML = '<div class="card">No contracts available.</div>';
    return;
  }
  state.selectedContract = c;
  const voRows = state.data.variationOrders.filter((v) => v.contractReference === c.referenceNumber || v.contractReference === c.contract);

  const statusClass = c.contractStatusAuto === 'Expired' ? 'badge-expired' : c.contractStatusAuto === 'Expiring Soon' ? 'badge-soon' : 'badge-active';
  el.innerHTML = `
    <div class="grid">
      <div class="card">
        <h3>${c.contract} (${c.referenceNumber || 'No reference'})</h3>
        <p>${c.description || ''}</p>
        <p><strong>Business Unit:</strong> ${c.businessUnit}</p>
        <p><strong>Contractor:</strong> ${c.contractorName}</p>
        <p><strong>Type:</strong> ${c.contractType}</p>
        <p><strong>Status:</strong> <span class="${statusClass}">${c.contractStatusAuto}</span></p>
      </div>
      <div class="card">
        <h3>Derived Values</h3>
        <p><strong>Duration Days:</strong> ${c.contractDurationDays ?? '-'}</p>
        <p><strong>Days To Expiry:</strong> ${c.daysToExpiry ?? '-'}</p>
        <p><strong>Revised Expiry Date:</strong> ${c.revisedExpiryDate || '-'}</p>
        <p><strong>Revised Expiry With VO:</strong> ${c.revisedExpiryWithVO || '-'}</p>
        <p><strong>Total VO Count:</strong> ${c.totalVOCount}</p>
        <p><strong>Total VO Amount:</strong> ${c.totalVOAmount}</p>
      </div>
      <div class="card">
        <h3>Timeline</h3>
        <ul class="timeline">
          <li>Signing: ${c.signingDate || '-'}</li>
          <li>Commencement: ${c.commencementDate || '-'}</li>
          <li>Expiry: ${c.expiryDate || '-'}</li>
          ${(c.extensionDates || []).map((d) => `<li>Extension: ${d}</li>`).join('')}
          <li>Revised: ${c.revisedExpiryDate || c.expiryDate || '-'}</li>
        </ul>
      </div>
    </div>
    <div class="card">
      <h3>Variation Orders (${voRows.length})</h3>
      <div id="details-vo-table"></div>
    </div>
  `;

  createTable({
    container: document.getElementById('details-vo-table'),
    rows: voRows,
    columns: [
      { key: 'voNumber', label: 'VO Number' },
      { key: 'voDate', label: 'Date' },
      { key: 'voDescription', label: 'Description' },
      { key: 'voAmount', label: 'Amount' },
      { key: 'voDaysExtension', label: 'Days Extension' },
      { key: 'voStatus', label: 'Status' }
    ],
    pageSize: 8
  });
}

function renderVOSection() {
  const el = document.getElementById('tab-vos');
  el.innerHTML = `
    <div class="card">
      <div class="filter-row" id="vo-filters"></div>
      <div class="filter-row"><button id="btn-export-vos">Export Filtered VOs CSV</button></div>
      <div id="vo-table"></div>
    </div>
    <div class="grid">
      <div class="card"><h3>Top Contracts by VO Amount</h3><canvas id="chart-vo-top-contracts"></canvas></div>
      <div class="card"><h3>VO Amount by Month</h3><canvas id="chart-vo-month"></canvas></div>
    </div>
  `;

  const f = document.getElementById('vo-filters');
  const contractRefs = uniqueValues(state.data.variationOrders, 'contractReference');
  const statuses = uniqueValues(state.data.variationOrders, 'voStatus');
  f.innerHTML = `
    <select id="vo-contract"><option value="">All Contracts</option>${contractRefs.map((v) => `<option>${v}</option>`).join('')}</select>
    <select id="vo-status"><option value="">All Statuses</option>${statuses.map((v) => `<option>${v}</option>`).join('')}</select>
    <input id="vo-start" type="date" value="${voFilters.voStart}" />
    <input id="vo-end" type="date" value="${voFilters.voEnd}" />
  `;

  const bind = (id, key) => {
    const node = document.getElementById(id);
    node.value = voFilters[key] || '';
    node.addEventListener('change', () => {
      voFilters[key] = node.value;
      applyAndRender();
    });
  };
  bind('vo-contract', 'contractReference');
  bind('vo-status', 'voStatus');
  bind('vo-start', 'voStart');
  bind('vo-end', 'voEnd');

  voTable = createTable({
    container: document.getElementById('vo-table'),
    rows: state.filteredVOs,
    columns: [
      { key: 'contractReference', label: 'Contract Reference' },
      { key: 'voNumber', label: 'VO Number' },
      { key: 'voDate', label: 'VO Date' },
      { key: 'voDescription', label: 'Description' },
      { key: 'voAmount', label: 'Amount' },
      { key: 'voDaysExtension', label: 'Days Ext' },
      { key: 'voStatus', label: 'Status' }
    ],
    pageSize: 12
  });

  document.getElementById('btn-export-vos').onclick = () => exportCsv(state.filteredVOs, 'variation_orders_filtered.csv');

  renderVOCharts({ ...state.data, variationOrders: state.filteredVOs });
}

function renderExpiryRenewals() {
  const el = document.getElementById('tab-expiry');
  const buckets = [30, 60, 90].map((days) => ({
    days,
    rows: state.data.contracts.filter((c) => c.daysToExpiry !== null && c.daysToExpiry >= 0 && c.daysToExpiry <= days)
  }));

  const grouped = state.data.contracts.reduce((acc, c) => {
    const key = `${c.businessUnit || 'Unknown'} | ${c.contractType || 'Unknown'}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(c);
    return acc;
  }, {});

  el.innerHTML = `
    <div class="grid">
      ${buckets
        .map((b) => `<div class="card"><h3>Expiring in ${b.days} days (${b.rows.length})</h3><ul>${b.rows
          .map((r) => `<li>${r.contract} (${r.expiryDate})</li>`)
          .join('')}</ul></div>`)
        .join('')}
    </div>
    <div class="card">
      <h3>Grouped by Business Unit and Type</h3>
      <ul>${Object.entries(grouped)
        .map(([group, rows]) => `<li>${group}: ${rows.length}</li>`)
        .join('')}</ul>
    </div>
    <div class="card">
      <h3>Expired with Extensions Present</h3>
      <ul>${state.data.contracts
        .filter((c) => c.contractStatusAuto === 'Expired' && c.extensionDates?.length)
        .map((c) => `<li>${c.contract} – Expired ${c.expiryDate}, extensions: ${c.extensionDates.join(', ')}</li>`)
        .join('')}</ul>
    </div>
  `;
}

function renderQuality() {
  const q = runQualityChecks(state.data);
  const el = document.getElementById('tab-quality');

  el.innerHTML = `
    <div class="grid">
      <div class="card"><h3>Missing Mandatory Fields (${q.missingMandatoryFields.length})</h3><pre>${JSON.stringify(q.missingMandatoryFields, null, 2)}</pre></div>
      <div class="card"><h3>Duplicate Reference Numbers (${q.duplicates.length})</h3><pre>${JSON.stringify(q.duplicates, null, 2)}</pre></div>
      <div class="card"><h3>Invalid Date Formats (${q.invalidDates.length})</h3><pre>${JSON.stringify(q.invalidDates, null, 2)}</pre></div>
      <div class="card"><h3>Commencement &gt; Expiry (${q.commencementAfterExpiry.length})</h3><pre>${JSON.stringify(q.commencementAfterExpiry, null, 2)}</pre></div>
      <div class="card"><h3>VO Rows Missing ContractReference (${q.voMissingContractReference.length})</h3><pre>${JSON.stringify(q.voMissingContractReference, null, 2)}</pre></div>
    </div>
  `;
}

function renderMappingModalIfNeeded() {
  const missing = state.data.meta?.missingRequiredMappings || [];
  const modal = document.getElementById('mapping-modal');
  if (!missing.length) {
    modal.classList.add('hidden');
    return;
  }

  const contracts = state.data.contracts;
  const allHeaders = contracts.length ? Object.keys(contracts[0]) : [];
  const fields = document.getElementById('mapping-fields');
  fields.innerHTML = '';

  missing.forEach((field) => {
    const row = document.createElement('div');
    row.className = 'mapping-row';
    row.innerHTML = `<label>${field}</label><select data-field="${field}"><option value="">Select column</option>${allHeaders
      .map((h) => `<option value="${h}">${h}</option>`)
      .join('')}</select>`;
    fields.appendChild(row);
  });

  modal.classList.remove('hidden');

  document.getElementById('mapping-save').onclick = async () => {
    const selections = {};
    fields.querySelectorAll('select').forEach((s) => {
      if (s.value) selections[s.dataset.field] = s.value;
    });
    await window.contractItApi.saveColumnMappings({ contracts: selections, variationOrders: {} });
    modal.classList.add('hidden');
    showToast('Column mappings saved. Refreshing...');
    const data = await window.contractItApi.requestRefresh();
    handleIncomingData(data);
  };

  document.getElementById('mapping-cancel').onclick = () => modal.classList.add('hidden');
}

function applyAndRender() {
  state.filteredContracts = applyContractFilters(state.data.contracts, contractFilters);
  state.filteredVOs = applyVOFilters(state.data.variationOrders, voFilters);

  renderOverview();
  renderRegister();
  renderDetails();
  renderVOSection();
  renderExpiryRenewals();
  renderQuality();
}

function handleIncomingData(rawData) {
  state.data = deriveDataset(rawData);
  renderMappingModalIfNeeded();
  applyAndRender();
}

function initHeaderActions() {
  document.getElementById('btn-open-excel').onclick = () => window.contractItApi.openWorkbook();
  document.getElementById('btn-open-folder').onclick = () => window.contractItApi.openWorkbookFolder();
  document.getElementById('btn-refresh').onclick = async () => {
    const data = await window.contractItApi.requestRefresh();
    handleIncomingData(data);
    showToast('Workbook reloaded.');
  };
  document.getElementById('btn-reset').onclick = async () => {
    const result = await window.contractItApi.resetWorkbookFromTemplate();
    if (result.cancelled) return;
    handleIncomingData(result.data);
    showToast('Workbook reset from template and dashboard refreshed.');
  };
}

async function init() {
  initTabs();
  setActiveTab('overview');
  initHeaderActions();

  const path = await window.contractItApi.getLiveWorkbookPath();
  document.getElementById('live-path').textContent = `Live workbook: ${path}`;

  const initial = await window.contractItApi.requestRefresh();
  handleIncomingData(initial);

  window.contractItApi.startWorkbookWatcher();
  window.contractItApi.onWorkbookUpdated((data) => {
    handleIncomingData(data);
    showToast('Workbook updated – dashboard refreshed');
  });
}

init();
