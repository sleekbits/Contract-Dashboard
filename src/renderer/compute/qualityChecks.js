export function runQualityChecks(data) {
  const missingMandatoryFields = [];
  const duplicates = [];
  const invalidDates = [];
  const commencementAfterExpiry = [];
  const voMissingContractReference = [];

  const referenceMap = new Map();

  data.contracts.forEach((c) => {
    const missing = [];
    if (!c.referenceNumber) missing.push('Reference number');
    if (!c.contractorName) missing.push('Contractor name');
    if (!c.businessUnit) missing.push('Business unit');
    if (!c.commencementDate) missing.push('Commencement date');
    if (!c.expiryDate) missing.push('Expiry date');
    if (missing.length) {
      missingMandatoryFields.push({ contract: c.contract, referenceNumber: c.referenceNumber, missing });
    }

    if (c.referenceNumber) {
      if (referenceMap.has(c.referenceNumber)) {
        duplicates.push({ referenceNumber: c.referenceNumber, contracts: [referenceMap.get(c.referenceNumber), c.contract] });
      } else {
        referenceMap.set(c.referenceNumber, c.contract);
      }
    }

    const cDate = c.commencementDate ? new Date(c.commencementDate) : null;
    const eDate = c.expiryDate ? new Date(c.expiryDate) : null;

    if ((c.commencementDate && Number.isNaN(cDate.getTime())) || (c.expiryDate && Number.isNaN(eDate.getTime()))) {
      invalidDates.push({ contract: c.contract, commencementDate: c.commencementDate, expiryDate: c.expiryDate });
    }

    if (cDate && eDate && cDate > eDate) {
      commencementAfterExpiry.push({ contract: c.contract, commencementDate: c.commencementDate, expiryDate: c.expiryDate });
    }
  });

  data.variationOrders.forEach((vo) => {
    if (!vo.contractReference) voMissingContractReference.push(vo);
  });

  return {
    missingMandatoryFields,
    duplicates,
    invalidDates,
    commencementAfterExpiry,
    voMissingContractReference
  };
}
