const fs = require('node:fs');
const path = require('node:path');
const { app } = require('electron');
const chokidar = require('chokidar');
const XLSX = require('xlsx');

const REQUIRED_CONTRACT_KEYS = [
  'contract',
  'businessUnit',
  'referenceNumber',
  'contractorName',
  'commencementDate',
  'expiryDate'
];

const DEFAULT_COLUMN_ALIASES = {
  contract: ['Contract', 'Contract Key', 'Contract ID', 'Internal ID'],
  businessUnit: ['Business Unit', 'BU'],
  madeBy: ['Made By', 'Created By', 'Owner'],
  contractType: ['Type of Contract', 'Contract Type'],
  referenceNumber: ['Reference number of contract', 'Reference Number', 'Contract Reference'],
  description: ['Description of Contract', 'Description'],
  contractorName: [
    'Contractor / Services Provider Name',
    'Contractor/Services Provider Name',
    'Contractor',
    'Service Provider',
    'Service Provider Name'
  ],
  poNumber: ['PO Number for the Contract (If Any)', 'PO Number', 'PO'],
  signingDate: ['Both Parties signing date of contract', 'Signing Date', 'Both Parties Signing Date'],
  commencementDate: ['Commencement date of contract', 'Commencement Date', 'Start Date'],
  expiryDate: ['Expiry date of contract', 'Expiry Date', 'End Date'],
  numberOfExtensions: ['Number of extension for expiry', 'No. of Extensions'],
  extensionDates: ['Extension of expiry date', 'Extension Dates', 'Extended Expiry Date'],
  duration: ['Duration of Contract', 'Duration of Contract (days)', 'Duration']
};

const VO_COLUMN_ALIASES = {
  contractReference: ['ContractReference', 'Contract Reference', 'Reference number of contract', 'Contract'],
  voNumber: ['VONumber', 'VO Number'],
  voDate: ['VODate', 'VO Date'],
  voDescription: ['VODescription', 'VO Description'],
  voAmount: ['VOAmount', 'VO Amount'],
  voDaysExtension: ['VODaysExtension', 'VO Days Extension'],
  approvedBy: ['ApprovedBy', 'Approved By'],
  approvalReference: ['ApprovalReference', 'Approval Reference'],
  voPoNumber: ['VO_PO_Number', 'VO PO Number', 'VO_PO'],
  voStatus: ['VOStatus', 'VO Status']
};

class WorkbookManager {
  constructor() {
    this.livePath = '';
    this.templatePath = '';
    this.watcher = null;
    this.debounceTimer = null;
    this.lastData = null;
    this.onUpdate = null;
  }

  getMappingsPath() {
    return path.join(app.getPath('userData'), 'column-mappings.json');
  }

  loadUserMappings() {
    const mappingsPath = this.getMappingsPath();
    try {
      if (fs.existsSync(mappingsPath)) {
        return JSON.parse(fs.readFileSync(mappingsPath, 'utf-8'));
      }
    } catch (error) {
      console.warn('Could not load user mappings:', error);
    }
    return { contracts: {}, variationOrders: {} };
  }

  saveUserMappings(mappings) {
    const mappingsPath = this.getMappingsPath();
    fs.writeFileSync(mappingsPath, JSON.stringify(mappings, null, 2), 'utf-8');
  }

  resolveTemplatePath() {
    if (app.isPackaged) {
      return path.join(process.resourcesPath, 'assets', 'ContractIt.xlsx');
    }
    return path.join(app.getAppPath(), 'assets', 'ContractIt.xlsx');
  }

  async ensureLiveWorkbook() {
    this.templatePath = this.resolveTemplatePath();
    this.livePath = path.join(app.getPath('userData'), 'ContractIt.xlsx');

    if (!fs.existsSync(this.livePath)) {
      fs.copyFileSync(this.templatePath, this.livePath);
    }

    return this.livePath;
  }

  getLiveWorkbookPath() {
    return this.livePath;
  }

  resetFromTemplate() {
    const timestamp = new Date().toISOString().replace(/[:.-]/g, '').slice(0, 15);
    const backupPath = path.join(path.dirname(this.livePath), `ContractIt_backup_${timestamp}.xlsx`);

    if (fs.existsSync(this.livePath)) {
      fs.copyFileSync(this.livePath, backupPath);
    }
    fs.copyFileSync(this.templatePath, this.livePath);

    return { backupPath, livePath: this.livePath };
  }

  startWatching(onUpdate) {
    this.onUpdate = onUpdate;
    if (this.watcher) {
      this.watcher.close();
    }

    this.watcher = chokidar.watch(this.livePath, {
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 800,
        pollInterval: 100
      }
    });

    this.watcher.on('change', () => {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => {
        try {
          const data = this.readWorkbook();
          this.lastData = data;
          if (this.onUpdate) this.onUpdate(data);
        } catch (error) {
          console.error('Error while reloading workbook:', error);
        }
      }, 600);
    });
  }

  stopWatching() {
    if (this.watcher) this.watcher.close();
  }

  parseDate(value) {
    if (value === null || value === undefined || value === '') return null;

    if (typeof value === 'number') {
      const parsed = XLSX.SSF.parse_date_code(value);
      if (!parsed) return null;
      return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
    }

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
    }

    if (typeof value === 'string') {
      const normalized = value.trim();
      if (!normalized) return null;
      const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (match) {
        return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
      }
      const parsed = new Date(normalized);
      if (!Number.isNaN(parsed.getTime())) {
        return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
      }
    }

    return null;
  }

  formatDate(date) {
    if (!date) return '';
    return date.toISOString().slice(0, 10);
  }

  mapHeaders(headers, aliases, userMappings = {}) {
    const normalizedHeaders = headers.map((h) => String(h || '').trim());
    const map = {};

    for (const [key, options] of Object.entries(aliases)) {
      const forced = userMappings[key];
      if (forced && normalizedHeaders.includes(forced)) {
        map[key] = forced;
        continue;
      }
      const match = options.find((alias) => normalizedHeaders.includes(alias));
      if (match) map[key] = match;
    }

    return map;
  }

  detectWideVOColumns(rowKeys) {
    const patterns = [
      /VO\s*(\d+)\s*(Amount|Amt)/i,
      /VO\s*(\d+)\s*(Date)/i,
      /VO\s*(\d+)\s*(Desc|Description)/i,
      /VO\s*(\d+)\s*(Days|Extension)/i,
      /VO\s*(\d+)\s*(Status)/i,
      /VO\s*(\d+)\s*(PO|PO Number)/i
    ];

    return rowKeys.filter((key) => patterns.some((pattern) => pattern.test(key)));
  }

  normalizeContracts(rows, headerMap) {
    return rows.map((row, idx) => {
      const contract = {
        rowNumber: idx + 2,
        contract: row[headerMap.contract] || `ROW-${idx + 2}`,
        businessUnit: row[headerMap.businessUnit] || '',
        madeBy: row[headerMap.madeBy] || '',
        contractType: row[headerMap.contractType] || '',
        referenceNumber: row[headerMap.referenceNumber] || '',
        description: row[headerMap.description] || '',
        contractorName: row[headerMap.contractorName] || '',
        poNumber: row[headerMap.poNumber] || '',
        signingDate: this.formatDate(this.parseDate(row[headerMap.signingDate])),
        commencementDate: this.formatDate(this.parseDate(row[headerMap.commencementDate])),
        expiryDate: this.formatDate(this.parseDate(row[headerMap.expiryDate])),
        numberOfExtensions: Number(row[headerMap.numberOfExtensions] || 0),
        extensionDatesRaw: row[headerMap.extensionDates] || '',
        durationRaw: row[headerMap.duration] || ''
      };

      contract.extensionDates = String(contract.extensionDatesRaw)
        .split(/[;,]/)
        .map((v) => this.formatDate(this.parseDate(v)))
        .filter(Boolean);

      contract._wideVoColumns = this.detectWideVOColumns(Object.keys(row));
      return contract;
    });
  }

  normalizeVariationOrders(rows, headerMap) {
    return rows
      .map((row, idx) => ({
        rowNumber: idx + 2,
        contractReference: row[headerMap.contractReference] || '',
        voNumber: row[headerMap.voNumber] || '',
        voDate: this.formatDate(this.parseDate(row[headerMap.voDate])),
        voDescription: row[headerMap.voDescription] || '',
        voAmount: Number(row[headerMap.voAmount] || 0),
        voDaysExtension: Number(row[headerMap.voDaysExtension] || 0),
        approvedBy: row[headerMap.approvedBy] || '',
        approvalReference: row[headerMap.approvalReference] || '',
        voPoNumber: row[headerMap.voPoNumber] || '',
        voStatus: row[headerMap.voStatus] || ''
      }))
      .filter((vo) => Object.values(vo).some((value) => value));
  }

  parseWideVOs(contractsRows, contractHeaderMap) {
    const vos = [];

    contractsRows.forEach((row) => {
      const contractRef = row[contractHeaderMap.referenceNumber] || row[contractHeaderMap.contract] || '';
      const keys = Object.keys(row);
      const voIndexes = new Set();

      keys.forEach((k) => {
        const m = k.match(/VO\s*(\d+)/i);
        if (m) voIndexes.add(Number(m[1]));
      });

      for (const idx of voIndexes) {
        const amount = keys.find((k) => new RegExp(`VO\\s*${idx}\\s*(Amount|Amt)`, 'i').test(k));
        const date = keys.find((k) => new RegExp(`VO\\s*${idx}\\s*(Date)`, 'i').test(k));
        const desc = keys.find((k) => new RegExp(`VO\\s*${idx}\\s*(Desc|Description)`, 'i').test(k));
        const days = keys.find((k) => new RegExp(`VO\\s*${idx}\\s*(Days|Extension)`, 'i').test(k));
        const status = keys.find((k) => new RegExp(`VO\\s*${idx}\\s*(Status)`, 'i').test(k));
        const po = keys.find((k) => new RegExp(`VO\\s*${idx}\\s*(PO|PO Number)`, 'i').test(k));

        const rowHasData = [amount, date, desc, days, status, po].some((col) => col && row[col] !== undefined && row[col] !== '');
        if (!rowHasData) continue;

        vos.push({
          contractReference: contractRef,
          voNumber: `VO-${String(idx).padStart(3, '0')}`,
          voDate: this.formatDate(this.parseDate(date ? row[date] : '')),
          voDescription: desc ? row[desc] || '' : '',
          voAmount: Number(amount ? row[amount] || 0 : 0),
          voDaysExtension: Number(days ? row[days] || 0 : 0),
          approvedBy: '',
          approvalReference: '',
          voPoNumber: po ? row[po] || '' : '',
          voStatus: status ? row[status] || '' : ''
        });
      }
    });

    return vos;
  }

  detectMissingRequiredMappings(contractHeaderMap) {
    return REQUIRED_CONTRACT_KEYS.filter((key) => !contractHeaderMap[key]);
  }

  readWorkbook() {
    const workbook = XLSX.readFile(this.livePath, { cellDates: false });

    const contractsSheetName = workbook.SheetNames.includes('Contracts') ? 'Contracts' : workbook.SheetNames[0];
    const voSheetName = workbook.SheetNames.includes('VariationOrders') ? 'VariationOrders' : null;

    const contractsRows = XLSX.utils.sheet_to_json(workbook.Sheets[contractsSheetName], { defval: '' });
    const voRows = voSheetName ? XLSX.utils.sheet_to_json(workbook.Sheets[voSheetName], { defval: '' }) : [];

    const contractHeaders = contractsRows.length ? Object.keys(contractsRows[0]) : [];
    const voHeaders = voRows.length ? Object.keys(voRows[0]) : [];

    const userMappings = this.loadUserMappings();
    const contractHeaderMap = this.mapHeaders(contractHeaders, DEFAULT_COLUMN_ALIASES, userMappings.contracts || {});
    const voHeaderMap = this.mapHeaders(voHeaders, VO_COLUMN_ALIASES, userMappings.variationOrders || {});

    const contracts = this.normalizeContracts(contractsRows, contractHeaderMap);
    const variationOrdersFromSheet = this.normalizeVariationOrders(voRows, voHeaderMap);
    const variationOrdersWide = this.parseWideVOs(contractsRows, contractHeaderMap);

    const data = {
      contracts,
      variationOrders: [...variationOrdersFromSheet, ...variationOrdersWide],
      meta: {
        contractsSheetName,
        variationOrdersSheetName: voSheetName,
        headerMappings: {
          contracts: contractHeaderMap,
          variationOrders: voHeaderMap
        },
        missingRequiredMappings: this.detectMissingRequiredMappings(contractHeaderMap),
        liveWorkbookPath: this.livePath,
        loadedAt: new Date().toISOString()
      }
    };

    this.lastData = data;
    return data;
  }
}

module.exports = {
  WorkbookManager,
  DEFAULT_COLUMN_ALIASES,
  VO_COLUMN_ALIASES
};
