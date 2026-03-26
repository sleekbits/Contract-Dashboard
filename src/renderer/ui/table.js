function getCellValue(row, key) {
  return row[key] ?? '';
}

export function createTable({ container, rows, columns, pageSize = 10, onRowClick }) {
  let state = {
    page: 1,
    pageSize,
    sortKey: columns[0]?.key,
    sortDir: 'asc',
    rows
  };

  function sortRows(data) {
    const sorted = [...data].sort((a, b) => {
      const av = String(getCellValue(a, state.sortKey));
      const bv = String(getCellValue(b, state.sortKey));
      return state.sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });
    return sorted;
  }

  function render() {
    const sorted = sortRows(state.rows);
    const start = (state.page - 1) * state.pageSize;
    const paged = sorted.slice(start, start + state.pageSize);
    const totalPages = Math.max(1, Math.ceil(state.rows.length / state.pageSize));

    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const hr = document.createElement('tr');

    columns.forEach((col) => {
      const th = document.createElement('th');
      th.textContent = col.label;
      th.addEventListener('click', () => {
        if (state.sortKey === col.key) state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
        else {
          state.sortKey = col.key;
          state.sortDir = 'asc';
        }
        render();
      });
      hr.appendChild(th);
    });

    thead.appendChild(hr);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    paged.forEach((row) => {
      const tr = document.createElement('tr');
      if (onRowClick) {
        tr.style.cursor = 'pointer';
        tr.addEventListener('click', () => onRowClick(row));
      }
      columns.forEach((col) => {
        const td = document.createElement('td');
        td.textContent = getCellValue(row, col.key);
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);

    const pagination = document.createElement('div');
    pagination.className = 'pagination';
    const prev = document.createElement('button');
    prev.textContent = 'Prev';
    prev.disabled = state.page <= 1;
    prev.onclick = () => {
      state.page -= 1;
      render();
    };

    const next = document.createElement('button');
    next.textContent = 'Next';
    next.disabled = state.page >= totalPages;
    next.onclick = () => {
      state.page += 1;
      render();
    };

    const label = document.createElement('span');
    label.textContent = `Page ${state.page} / ${totalPages}`;

    pagination.append(prev, next, label);

    container.innerHTML = '';
    container.appendChild(table);
    container.appendChild(pagination);
  }

  function setRows(rows) {
    state.rows = rows;
    state.page = 1;
    render();
  }

  render();
  return { setRows };
}
