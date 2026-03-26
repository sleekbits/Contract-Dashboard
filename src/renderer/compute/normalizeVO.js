export function groupVOsByContract(variationOrders = []) {
  const grouped = new Map();
  for (const vo of variationOrders) {
    const key = vo.contractReference || 'UNMAPPED';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(vo);
  }
  return grouped;
}
