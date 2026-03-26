const chartRegistry = new Map();

export function destroyCharts() {
  chartRegistry.forEach((chart) => chart.destroy());
  chartRegistry.clear();
}

function renderChart(canvasId, config) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  if (chartRegistry.has(canvasId)) chartRegistry.get(canvasId).destroy();
  const chart = new window.Chart(canvas, config);
  chartRegistry.set(canvasId, chart);
}

export function renderOverviewCharts(data) {
  const buCounts = data.contracts.reduce((acc, c) => {
    acc[c.businessUnit || 'Unknown'] = (acc[c.businessUnit || 'Unknown'] || 0) + 1;
    return acc;
  }, {});

  const contractorCounts = data.contracts.reduce((acc, c) => {
    acc[c.contractorName || 'Unknown'] = (acc[c.contractorName || 'Unknown'] || 0) + 1;
    return acc;
  }, {});

  const expiryByMonth = data.contracts.reduce((acc, c) => {
    const month = (c.expiryDate || '').slice(0, 7) || 'Unknown';
    acc[month] = (acc[month] || 0) + 1;
    return acc;
  }, {});

  const voByMonth = data.variationOrders.reduce((acc, vo) => {
    const month = (vo.voDate || '').slice(0, 7);
    if (!month) return acc;
    acc[month] = (acc[month] || 0) + (Number(vo.voAmount) || 0);
    return acc;
  }, {});

  renderChart('chart-bu', {
    type: 'bar',
    data: { labels: Object.keys(buCounts), datasets: [{ label: 'Contracts', data: Object.values(buCounts) }] }
  });

  const topContractors = Object.entries(contractorCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);
  renderChart('chart-contractors', {
    type: 'bar',
    data: { labels: topContractors.map(([k]) => k), datasets: [{ label: 'Count', data: topContractors.map(([, v]) => v) }] }
  });

  renderChart('chart-expiry', {
    type: 'line',
    data: { labels: Object.keys(expiryByMonth), datasets: [{ label: 'Expiries', data: Object.values(expiryByMonth) }] }
  });

  renderChart('chart-vo-trend', {
    type: 'line',
    data: { labels: Object.keys(voByMonth), datasets: [{ label: 'VO Amount', data: Object.values(voByMonth) }] }
  });
}

export function renderVOCharts(data) {
  const byContract = data.variationOrders.reduce((acc, vo) => {
    const key = vo.contractReference || 'Unknown';
    acc[key] = (acc[key] || 0) + (Number(vo.voAmount) || 0);
    return acc;
  }, {});

  const top = Object.entries(byContract).sort((a, b) => b[1] - a[1]).slice(0, 10);

  const byMonth = data.variationOrders.reduce((acc, vo) => {
    const month = (vo.voDate || '').slice(0, 7);
    if (!month) return acc;
    acc[month] = (acc[month] || 0) + (Number(vo.voAmount) || 0);
    return acc;
  }, {});

  renderChart('chart-vo-top-contracts', {
    type: 'bar',
    data: { labels: top.map(([k]) => k), datasets: [{ label: 'VO Amount', data: top.map(([, v]) => v) }] }
  });

  renderChart('chart-vo-month', {
    type: 'line',
    data: { labels: Object.keys(byMonth), datasets: [{ label: 'VO by Month', data: Object.values(byMonth) }] }
  });
}
