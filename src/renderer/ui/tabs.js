const TAB_CONFIG = [
  { id: 'overview', label: 'Overview' },
  { id: 'register', label: 'Contract Register' },
  { id: 'details', label: 'Contract Details' },
  { id: 'vos', label: 'Variation Orders' },
  { id: 'expiry', label: 'Expiry & Renewals' },
  { id: 'quality', label: 'Data Quality' }
];

export function initTabs() {
  const tabsEl = document.getElementById('tabs');
  tabsEl.innerHTML = '';

  TAB_CONFIG.forEach((tab, index) => {
    const btn = document.createElement('button');
    btn.className = `tab-btn ${index === 0 ? 'active' : ''}`;
    btn.textContent = tab.label;
    btn.addEventListener('click', () => setActiveTab(tab.id));
    tabsEl.appendChild(btn);
  });
}

export function setActiveTab(id) {
  const panes = document.querySelectorAll('.tab-pane');
  panes.forEach((pane) => pane.classList.remove('active'));
  document.getElementById(`tab-${id}`).classList.add('active');

  const btns = document.querySelectorAll('.tab-btn');
  btns.forEach((btn, i) => {
    btn.classList.toggle('active', TAB_CONFIG[i].id === id);
  });
}
