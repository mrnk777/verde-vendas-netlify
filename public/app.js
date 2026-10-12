(() => {
  'use strict';

  const UNIT_PRICE = 750;
  const MAX_QUANTITY = 100000;
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));
  const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const dateFormat = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeFormat = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
  let sales = [];
  let serverOnline = false;
  let posting = false;
  let refreshTimer = null;

  const quantityInput = $('#quantity');
  const confirmDialog = $('#confirm-dialog');
  const confirmButton = $('#confirm-sale');
  const openConfirmButton = $('#open-confirm');
  const searchInput = $('#history-search');

  function safeQuantity(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 1;
    return Math.min(MAX_QUANTITY, Math.max(1, Math.floor(parsed)));
  }

  function getQuantity() {
    return safeQuantity(quantityInput.value);
  }

  function setQuantity(value) {
    quantityInput.value = String(safeQuantity(value));
    updateCalculator();
  }

  function updateCalculator() {
    const quantity = getQuantity();
    const total = quantity * UNIT_PRICE;
    const plural = quantity === 1 ? 'unidade' : 'unidades';
    $('#order-total').textContent = money.format(total);
    $('#calculation-line').textContent = `${quantity.toLocaleString('pt-BR')} ${plural} × ${money.format(UNIT_PRICE)}`;
    $('#quantity-help').textContent = quantity === MAX_QUANTITY ? 'Limite máximo atingido' : 'Mínimo de 1 unidade';
    $$('.quick-chip').forEach((chip) => chip.classList.toggle('selected', Number(chip.dataset.qty) === quantity));
    $('#dialog-quantity').textContent = `${quantity.toLocaleString('pt-BR')} ${plural}`;
    $('#dialog-total').textContent = money.format(total);
    openConfirmButton.disabled = !serverOnline || posting;
  }

  function showToast(title, message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast${type === 'error' ? ' error' : ''}`;
    const icon = type === 'error' ? '!' : '✓';
    toast.innerHTML = `<span class="toast-icon" aria-hidden="true">${icon}</span><div><strong></strong><p></p></div><button type="button" class="toast-close" aria-label="Fechar aviso">×</button>`;
    toast.querySelector('strong').textContent = title;
    toast.querySelector('p').textContent = message;
    toast.querySelector('.toast-close').addEventListener('click', () => toast.remove());
    $('#toast-region').appendChild(toast);
    window.setTimeout(() => toast.remove(), 6500);
  }

  function setConnection(online) {
    serverOnline = online;
    const line = $('.connection-line');
    line.classList.toggle('offline', !online);
    $('#connection-text').textContent = online ? 'Conexão ativa' : 'Sem conexão com o servidor';
    $('#connection-dot').style.background = online ? 'var(--green)' : '#f19c63';
    updateCalculator();
  }

  function localDateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function saleDate(sale) {
    const d = new Date(sale.createdAt);
    return Number.isNaN(d.getTime()) ? new Date(0) : d;
  }

  function shortSaleId(id) {
    const value = String(id || '').replaceAll('-', '').slice(0, 8).toUpperCase();
    return value || 'REGISTRO';
  }

  function renderMetrics() {
    const totalRevenue = sales.reduce((sum, sale) => sum + Number(sale.total || Number(sale.quantity) * UNIT_PRICE), 0);
    const units = sales.reduce((sum, sale) => sum + Number(sale.quantity || 0), 0);
    const today = localDateKey(new Date());
    const todaySales = sales.filter((sale) => localDateKey(saleDate(sale)) === today);
    const todayRevenue = todaySales.reduce((sum, sale) => sum + Number(sale.total || Number(sale.quantity) * UNIT_PRICE), 0);
    $('#metric-revenue').textContent = money.format(totalRevenue);
    $('#metric-units').textContent = units.toLocaleString('pt-BR');
    $('#metric-sales').textContent = sales.length.toLocaleString('pt-BR');
    $('#today-count').textContent = `${todaySales.length.toLocaleString('pt-BR')} hoje`;
    $('#today-revenue').textContent = money.format(todayRevenue);
    $('#avg-sale').textContent = money.format(sales.length ? totalRevenue / sales.length : 0);
    $('#nav-count').textContent = sales.length > 99 ? '99+' : String(sales.length);
    $('#history-total').textContent = sales.length.toLocaleString('pt-BR');
    $('#units-progress').style.width = `${units ? Math.max(5, Math.min(100, units / (units + 20) * 100)) : 0}%`;
  }

  function buildCell(text, className = '') {
    const td = document.createElement('td');
    if (className) td.className = className;
    td.textContent = text;
    return td;
  }

  function renderHistory() {
    const tbody = $('#sales-tbody');
    const term = searchInput.value.trim().toLowerCase();
    const sorted = [...sales].sort((a, b) => saleDate(b) - saleDate(a));
    const filtered = sorted.filter((sale) => {
      const date = saleDate(sale);
      const haystack = [shortSaleId(sale.id), sale.quantity, dateFormat.format(date), timeFormat.format(date), money.format(sale.total || sale.quantity * UNIT_PRICE)].join(' ').toLowerCase();
      return haystack.includes(term);
    });

    tbody.replaceChildren();
    $('#history-empty').hidden = filtered.length > 0;
    $('.table-wrap').hidden = filtered.length === 0;

    if (filtered.length === 0) {
      $('#empty-title').textContent = term ? 'Nenhuma venda encontrada' : 'Ainda não há vendas registradas';
      $('#empty-description').textContent = term ? 'Tente buscar por outro código, quantidade ou data.' : (sales.length ? 'Não encontramos vendas que correspondam à sua busca.' : 'Quando a primeira venda for confirmada, ela aparecerá aqui para toda a equipe.');
      $('#empty-action').hidden = term.length > 0 || sales.length > 0;
    }

    filtered.forEach((sale) => {
      const row = document.createElement('tr');
      const id = document.createElement('td');
      id.innerHTML = `<div class="sale-id"><span class="sale-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l-1 12H6L5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg></span><span><strong></strong><small>Produto</small></span></div>`;
      id.querySelector('strong').textContent = `#${shortSaleId(sale.id)}`;
      row.appendChild(id);

      const date = saleDate(sale);
      const dateCell = document.createElement('td');
      dateCell.className = 'date-cell';
      dateCell.innerHTML = '<span></span><small></small>';
      dateCell.querySelector('span').textContent = dateFormat.format(date);
      dateCell.querySelector('small').textContent = timeFormat.format(date);
      row.appendChild(dateCell);

      const qtyCell = document.createElement('td');
      qtyCell.innerHTML = '<span class="quantity-badge"><span></span> unidades</span>';
      qtyCell.querySelector('span span').textContent = Number(sale.quantity).toLocaleString('pt-BR');
      row.appendChild(qtyCell);
      row.appendChild(buildCell(money.format(Number(sale.unitPrice || UNIT_PRICE)), 'money-cell'));
      row.appendChild(buildCell(money.format(Number(sale.total || sale.quantity * UNIT_PRICE)), 'money-total'));
      const status = document.createElement('td');
      status.innerHTML = '<span class="status-badge"><span></span> Confirmada</span>';
      row.appendChild(status);
      tbody.appendChild(row);
    });

    $('#showing-count').textContent = `Mostrando ${filtered.length.toLocaleString('pt-BR')} de ${sales.length.toLocaleString('pt-BR')} ${sales.length === 1 ? 'venda' : 'vendas'}`;
  }

  function renderAll() {
    renderMetrics();
    renderHistory();
  }

  async function loadSales({ quiet = false } = {}) {
    try {
      const response = await fetch('/api/sales', { cache: 'no-store' });
      if (!response.ok) throw new Error('Não foi possível carregar o histórico.');
      const data = await response.json();
      if (!Array.isArray(data.sales)) throw new Error('Resposta inesperada do servidor.');
      sales = data.sales;
      setConnection(true);
      renderAll();
    } catch (error) {
      setConnection(false);
      if (!quiet) showToast('Não foi possível conectar', 'Confira sua conexão com o servidor. As vendas não serão salvas neste momento.', 'error');
    }
  }

  function openConfirmation() {
    if (!serverOnline) {
      showToast('Servidor indisponível', 'Conecte-se ao servidor para registrar uma venda compartilhada.', 'error');
      return;
    }
    if (posting) return;
    updateCalculator();
    confirmDialog.showModal();
  }

  async function confirmSale() {
    if (posting || !serverOnline) return;
    const quantity = getQuantity();
    posting = true;
    confirmButton.disabled = true;
    confirmButton.innerHTML = '<span class="loading-spinner"></span> Registrando venda...';
    openConfirmButton.disabled = true;

    try {
      const response = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'A venda não pôde ser registrada.');
      confirmDialog.close();
      quantityInput.value = '1';
      updateCalculator();
      await loadSales({ quiet: true });
      showToast('Venda confirmada!', `${quantity.toLocaleString('pt-BR')} ${quantity === 1 ? 'unidade registrada' : 'unidades registradas'} — ${money.format(quantity * UNIT_PRICE)}. O histórico já foi atualizado para todos.`);
    } catch (error) {
      showToast('Venda não registrada', error.message || 'Confira a conexão e tente novamente.', 'error');
    } finally {
      posting = false;
      confirmButton.disabled = false;
      confirmButton.innerHTML = 'Sim, confirmar <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
      updateCalculator();
    }
  }

  function exportCsv() {
    if (!sales.length) {
      showToast('Histórico vazio', 'Registre uma venda antes de exportar.', 'error');
      return;
    }
    const rows = [
      ['Código da venda', 'Data', 'Hora', 'Produto', 'Quantidade', 'Valor unitário (BRL)', 'Valor total (BRL)', 'Status'],
      ...[...sales].sort((a, b) => saleDate(b) - saleDate(a)).map((sale) => {
        const date = saleDate(sale);
        return [shortSaleId(sale.id), dateFormat.format(date), timeFormat.format(date), 'Produto', sale.quantity, Number(sale.unitPrice || UNIT_PRICE).toFixed(2).replace('.', ','), Number(sale.total || sale.quantity * UNIT_PRICE).toFixed(2).replace('.', ','), 'Confirmada'];
      })
    ];
    const csv = '\uFEFF' + rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(';')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = `historico-vendas-${localDateKey(new Date())}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(href);
    showToast('Exportação pronta', 'O histórico foi exportado em formato CSV.');
  }

  $('#qty-minus').addEventListener('click', () => setQuantity(getQuantity() - 1));
  $('#qty-plus').addEventListener('click', () => setQuantity(getQuantity() + 1));
  quantityInput.addEventListener('input', () => {
    if (quantityInput.value === '') {
      $('#order-total').textContent = money.format(0);
      openConfirmButton.disabled = true;
      return;
    }
    updateCalculator();
  });
  quantityInput.addEventListener('blur', () => setQuantity(quantityInput.value));
  quantityInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') { event.preventDefault(); openConfirmation(); }
  });
  $$('.quick-chip').forEach((chip) => chip.addEventListener('click', () => setQuantity(Number(chip.dataset.qty))));
  openConfirmButton.addEventListener('click', openConfirmation);
  confirmButton.addEventListener('click', confirmSale);
  $('#cancel-confirm').addEventListener('click', () => confirmDialog.close());
  searchInput.addEventListener('input', renderHistory);
  $('#export-csv').addEventListener('click', exportCsv);
  $$('.nav-item').forEach((item) => item.addEventListener('click', () => {
    $$('.nav-item').forEach((nav) => nav.classList.remove('active'));
    item.classList.add('active');
  }));
  document.addEventListener('keydown', (event) => {
    if (event.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName) && !confirmDialog.open) {
      event.preventDefault();
      searchInput.focus();
    }
    if (event.key === 'Escape' && confirmDialog.open && !posting) confirmDialog.close();
  });
  $('#top-date').textContent = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).format(new Date()).replace('.', '').toUpperCase();
  $('#year').textContent = new Date().getFullYear();
  updateCalculator();
  loadSales();
  refreshTimer = window.setInterval(() => loadSales({ quiet: true }), 20000);
  window.addEventListener('beforeunload', () => window.clearInterval(refreshTimer));
})();
