const fs = require('node:fs');
const path = require('node:path');
const XLSX = require('xlsx');

const assetsDir = path.join(__dirname, '..', 'assets');
const outputPath = path.join(assetsDir, 'ContractIt.xlsx');

const contractsHeaders = [
  'Contract',
  'Business Unit',
  'Made By',
  'Type of Contract',
  'Reference number of contract',
  'Description of Contract',
  'Contractor / Services Provider Name',
  'PO Number for the Contract (If Any)',
  'Both Parties signing date of contract',
  'Commencement date of contract',
  'Expiry date of contract',
  'Number of extension for expiry',
  'Extension of expiry date',
  'Duration of Contract (days)'
];

const voHeaders = [
  'ContractReference',
  'VONumber',
  'VODate',
  'VODescription',
  'VOAmount',
  'VODaysExtension',
  'ApprovedBy',
  'ApprovalReference',
  'VO_PO_Number',
  'VOStatus'
];

const contractsRows = [
  {
    Contract: 'CON-001',
    'Business Unit': 'Operations',
    'Made By': 'A. Manager',
    'Type of Contract': 'Service Agreement',
    'Reference number of contract': 'REF-OPS-2025-001',
    'Description of Contract': 'Facilities management services',
    'Contractor / Services Provider Name': 'Acme Facilities Ltd',
    'PO Number for the Contract (If Any)': 'PO-1001',
    'Both Parties signing date of contract': '2025-01-02',
    'Commencement date of contract': '2025-01-15',
    'Expiry date of contract': '2026-01-14',
    'Number of extension for expiry': 1,
    'Extension of expiry date': '2026-03-31',
    'Duration of Contract (days)': ''
  },
  {
    Contract: 'CON-002',
    'Business Unit': 'IT',
    'Made By': 'B. Owner',
    'Type of Contract': 'Software License',
    'Reference number of contract': 'REF-IT-2025-002',
    'Description of Contract': 'Security platform annual license',
    'Contractor / Services Provider Name': 'SecureStack Inc',
    'PO Number for the Contract (If Any)': 'PO-1002',
    'Both Parties signing date of contract': '2025-03-10',
    'Commencement date of contract': '2025-03-15',
    'Expiry date of contract': '2026-03-14',
    'Number of extension for expiry': 0,
    'Extension of expiry date': '',
    'Duration of Contract (days)': ''
  },
  {
    Contract: 'CON-003',
    'Business Unit': 'Finance',
    'Made By': 'C. Lead',
    'Type of Contract': 'Consultancy',
    'Reference number of contract': 'REF-FIN-2025-003',
    'Description of Contract': 'Audit advisory services',
    'Contractor / Services Provider Name': 'Prime Advisory',
    'PO Number for the Contract (If Any)': '',
    'Both Parties signing date of contract': '2025-05-01',
    'Commencement date of contract': '2025-05-07',
    'Expiry date of contract': '2025-12-31',
    'Number of extension for expiry': 2,
    'Extension of expiry date': '2026-01-31;2026-04-30',
    'Duration of Contract (days)': ''
  }
];

const voRows = [
  {
    ContractReference: 'REF-OPS-2025-001',
    VONumber: 'VO-001',
    VODate: '2025-06-15',
    VODescription: 'Additional security patrol scope',
    VOAmount: 12000,
    VODaysExtension: 30,
    ApprovedBy: 'Head Operations',
    ApprovalReference: 'APR-OPS-01',
    VO_PO_Number: 'PO-VO-001',
    VOStatus: 'Approved'
  },
  {
    ContractReference: 'REF-IT-2025-002',
    VONumber: 'VO-001',
    VODate: '2025-08-20',
    VODescription: 'Extra endpoint licenses',
    VOAmount: 6500,
    VODaysExtension: 0,
    ApprovedBy: 'CIO',
    ApprovalReference: 'APR-IT-07',
    VO_PO_Number: 'PO-VO-002',
    VOStatus: 'Approved'
  }
];

function generate() {
  fs.mkdirSync(assetsDir, { recursive: true });

  const wb = XLSX.utils.book_new();
  const contractsSheet = XLSX.utils.json_to_sheet(contractsRows, { header: contractsHeaders });
  const voSheet = XLSX.utils.json_to_sheet(voRows, { header: voHeaders });

  XLSX.utils.book_append_sheet(wb, contractsSheet, 'Contracts');
  XLSX.utils.book_append_sheet(wb, voSheet, 'VariationOrders');

  XLSX.writeFile(wb, outputPath);
  console.log(`Template workbook generated at ${outputPath}`);
}

generate();
