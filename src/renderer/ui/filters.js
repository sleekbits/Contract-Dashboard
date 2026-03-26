export function uniqueValues(rows, key) {
  return [...new Set(rows.map((r) => r[key]).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
}

export function applyContractFilters(rows, filterState) {
  return rows.filter((r) => {
    if (filterState.search) {
      const blob = JSON.stringify(r).toLowerCase();
      if (!blob.includes(filterState.search.toLowerCase())) return false;
    }
    if (filterState.businessUnit && r.businessUnit !== filterState.businessUnit) return false;
    if (filterState.contractorName && r.contractorName !== filterState.contractorName) return false;
    if (filterState.contractType && r.contractType !== filterState.contractType) return false;
    if (filterState.status && r.contractStatusAuto !== filterState.status) return false;
    if (filterState.expiringSoonOnly && r.contractStatusAuto !== 'Expiring Soon') return false;

    const rangeChecks = [
      ['signingDate', filterState.signingStart, filterState.signingEnd],
      ['commencementDate', filterState.commencementStart, filterState.commencementEnd],
      ['expiryDate', filterState.expiryStart, filterState.expiryEnd]
    ];

    for (const [field, start, end] of rangeChecks) {
      const value = r[field] || '';
      if (start && value && value < start) return false;
      if (end && value && value > end) return false;
    }

    return true;
  });
}

export function applyVOFilters(rows, filterState) {
  return rows.filter((vo) => {
    if (filterState.contractReference && vo.contractReference !== filterState.contractReference) return false;
    if (filterState.voStatus && vo.voStatus !== filterState.voStatus) return false;
    if (filterState.voStart && vo.voDate && vo.voDate < filterState.voStart) return false;
    if (filterState.voEnd && vo.voDate && vo.voDate > filterState.voEnd) return false;
    return true;
  });
}
