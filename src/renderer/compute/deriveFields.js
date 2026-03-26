import { groupVOsByContract } from './normalizeVO.js';

const DAY_MS = 24 * 60 * 60 * 1000;

function parseIsoDate(value) {
  if (!value) return null;
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

function toIso(date) {
  return date ? date.toISOString().slice(0, 10) : '';
}

export function deriveDataset(raw, expiringSoonDays = 60) {
  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const voByContract = groupVOsByContract(raw.variationOrders);

  const contracts = raw.contracts.map((c) => {
    const commencement = parseIsoDate(c.commencementDate);
    const expiry = parseIsoDate(c.expiryDate);
    const extensionDates = (c.extensionDates || []).map(parseIsoDate).filter(Boolean);

    const revisedExpiryDate = extensionDates.length
      ? new Date(Math.max(...extensionDates.map((d) => d.getTime())))
      : expiry;

    const contractDurationDays = commencement && expiry ? Math.round((expiry - commencement) / DAY_MS) : null;
    const daysToExpiry = expiry ? Math.round((expiry - todayUtc) / DAY_MS) : null;

    let contractStatusAuto = 'Active';
    if (daysToExpiry !== null && daysToExpiry < 0) contractStatusAuto = 'Expired';
    else if (daysToExpiry !== null && daysToExpiry <= expiringSoonDays) contractStatusAuto = 'Expiring Soon';

    const key = c.referenceNumber || c.contract;
    const vos = voByContract.get(key) || [];

    const totalVOCount = vos.length;
    const totalVOAmount = vos.reduce((sum, vo) => sum + (Number(vo.voAmount) || 0), 0);
    const totalVODaysExtension = vos.reduce((sum, vo) => sum + (Number(vo.voDaysExtension) || 0), 0);
    const revisedExpiryWithVO = expiry ? new Date(expiry.getTime() + totalVODaysExtension * DAY_MS) : null;

    return {
      ...c,
      contractDurationDays,
      daysToExpiry,
      contractStatusAuto,
      revisedExpiryDate: toIso(revisedExpiryDate),
      totalVOCount,
      totalVOAmount,
      totalVODaysExtension,
      revisedExpiryWithVO: toIso(revisedExpiryWithVO)
    };
  });

  return {
    ...raw,
    contracts
  };
}
