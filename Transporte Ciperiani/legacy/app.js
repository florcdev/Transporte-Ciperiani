/* =========================================================
   Transporte Ciperiani - lógica de la aplicación
   Sin servicios externos: persistencia mediante localStorage.
   ========================================================= */

(function () {
  'use strict';

  const STORAGE = {
    trips: 'ciperiani.trips.v2',
    settings: 'ciperiani.settings.v1'
  };

  const DRIVER_RATE = 0.15;
  const defaultSettings = {
    commissionRate: 10,
    driverRate: 15
  };

  const seedTrips = [
    { id:'000248', date:'2026-09-30', origin:'Gral. Pico', destination:'Rosario', ctg:'12334871', tons:34, tariff:28500, advance:250000, commissionRate:10, status:'proceso', paid:false, model:'Scania R450', plate:'AB 123 CD', driver:'Marcelo Funes' },
    { id:'000247', date:'2026-09-29', origin:'Realicó', destination:'Bahía Blanca', ctg:'12331190', tons:32, tariff:31200, advance:0, commissionRate:10, status:'proceso', paid:false, model:'Mercedes-Benz Actros', plate:'AC 456 EF', driver:'Julián Aguirre' },
    { id:'000246', date:'2026-09-27', origin:'Gral. Pico', destination:'Quequén', ctg:'12327654', tons:33, tariff:36800, advance:300000, commissionRate:10, status:'espera', paid:false, model:'Scania R450', plate:'AB 123 CD', driver:'Marcelo Funes' },
    { id:'000245', date:'2026-09-25', origin:'Eduardo Castex', destination:'Rosario', ctg:'12322018', tons:35, tariff:29400, advance:200000, commissionRate:10, status:'pagado', paid:true, model:'Iveco Hi-Way', plate:'AD 789 GH', driver:'Carlos Benítez' },
    { id:'000244', date:'2026-09-23', origin:'Gral. Pico', destination:'San Lorenzo', ctg:'12319502', tons:34, tariff:28900, advance:250000, commissionRate:10, status:'pagado', paid:true, model:'Scania R450', plate:'AB 123 CD', driver:'Marcelo Funes' },
    { id:'000243', date:'2026-09-20', origin:'Trenel', destination:'Bahía Blanca', ctg:'12314477', tons:30, tariff:30100, advance:0, commissionRate:10, status:'pagado', paid:true, model:'Mercedes-Benz Actros', plate:'AC 456 EF', driver:'Julián Aguirre' },
    { id:'000242', date:'2026-09-18', origin:'Gral. Pico', destination:'Villa Constitución', ctg:'12309931', tons:34, tariff:29800, advance:250000, commissionRate:10, status:'pagado', paid:true, model:'Iveco Hi-Way', plate:'AD 789 GH', driver:'Carlos Benítez' }
  ];

  const moneyFmt = new Intl.NumberFormat('es-AR', { style:'currency', currency:'ARS', maximumFractionDigits:0 });
  const numFmt = new Intl.NumberFormat('es-AR', { maximumFractionDigits:2 });

  const money = n => moneyFmt.format(Number(n) || 0).replace(/\s/g, '');
  const num = n => numFmt.format(Number(n) || 0);

  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function save(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  let settings = load(STORAGE.settings, defaultSettings);
  let trips = load(STORAGE.trips, null);

  if (!Array.isArray(trips)) {
    trips = seedTrips.map(t => ({ ...t }));
    save(STORAGE.trips, trips);
  }

  const chips = {
    pagado: ['ok', 'Pagado'],
    proceso: ['warn', 'En proceso'],
    espera: ['wait', 'En espera']
  };

  function calculate(trip) {
    const gross = Number(trip.tons) * Number(trip.tariff);
    const commission = gross * (Number(trip.commissionRate) / 100);
    const subtotal = gross - commission;
    const driver = subtotal * DRIVER_RATE;
    const total = Math.max(0, subtotal - Number(trip.advance || 0));

    return { gross, commission, subtotal, driver, total };
  }

  function formatDate(iso) {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  function statusFromTrip(trip) {
    if (trip.paid) return 'pagado';
    return trip.status || 'proceso';
  }

  function nextId() {
    const max = trips.reduce((acc, t) => Math.max(acc, Number(t.id) || 0), 0);
    return String(max + 1).padStart(6, '0');
  }

  function persist() {
    save(STORAGE.trips, trips);
  }

  // ---------- Referencias ----------
  const app = document.getElementById('app');
  const login = document.getElementById('v-login');
  const content = document.getElementById('content');
  const title = document.getElementById('pageTitle');
  const crumbs = document.getElementById('pageCrumbs');

  const modal = document.getElementById('tripModal');
  const form = document.getElementById('tripForm');
  const formError = document.getElementById('tripFormError');

  let currentTripId = null;
  let editingTripId = null;
  let currentReportGroup = 'general';

  // ---------- Viajes ----------
  function row(trip) {
    const status = statusFromTrip(trip);
    const chip = chips[status] || chips.proceso;
    const c = calculate(trip);

    return `<tr data-trip-id="${trip.id}" data-go="viaje">
      <td class="c-estado" data-label="Estado"><span class="chip ${chip[0]}">${chip[1]}</span></td>
      <td class="c-id" data-label="Viaje"><a class="link-id" href="#viaje/${trip.id}">${trip.id}</a></td>
      <td class="c-fecha" data-label="Fecha">${formatDate(trip.date)}</td>
      <td class="c-origen" data-label="Origen">${escapeHtml(trip.origin)}</td>
      <td class="c-destino" data-label="Destino">${escapeHtml(trip.destination)}</td>
      <td class="c-ctg" data-label="ctg">${escapeHtml(trip.ctg)}</td>
      <td class="c-tn num" data-label="Toneladas">${num(trip.tons)}</td>
      <td class="c-tarifa num" data-label="Tarifa">${money(trip.tariff)}</td>
      <td class="c-com num" data-label="Comisión">${money(c.commission)}</td>
      <td class="c-ade num" data-label="Adelanto">${money(trip.advance)}</td>
      <td class="c-sub num" data-label="Subtotal">${money(c.subtotal)}</td>
      <td class="c-total num" data-label="Total">${money(c.total)}</td>
    </tr>`;
  }

  function renderTrips() {
    const activeFilter = document.querySelector('.seg button[data-trip-filter][aria-pressed="true"]')?.dataset.tripFilter || 'todos';
    const search = (document.querySelector('.search input')?.value || '').trim().toLowerCase();

    const filtered = trips.filter(t => {
      const status = statusFromTrip(t);
      const filterOk = activeFilter === 'todos' || status === activeFilter;
      const haystack = [t.id, t.origin, t.destination, t.ctg, t.plate, t.driver].join(' ').toLowerCase();
      return filterOk && (!search || haystack.includes(search));
    });

    const allBody = document.querySelector('[data-rows="all"]');
    const recentBody = document.querySelector('[data-rows="recent"]');

    if (allBody) {
      allBody.innerHTML = filtered.length
        ? filtered.map(row).join('')
        : '<tr><td colspan="12" class="empty-cell">No hay viajes que coincidan con la búsqueda.</td></tr>';
    }

    if (recentBody) {
      recentBody.innerHTML = trips.slice().sort((a,b) => b.date.localeCompare(a.date)).slice(0,5).map(row).join('');
    }

    const footer = document.querySelector('.table-f span');
    if (footer) footer.textContent = `Mostrando ${filtered.length} de ${trips.length} viajes`;

    updateDashboard();
  }

  function updateDashboard() {
    const monthPrefix = new Date().toISOString().slice(0,7);
    // El demo usa septiembre 2026; si no hay datos del mes actual, mostramos el último mes disponible.
    const availableMonths = [...new Set(trips.map(t => t.date.slice(0,7)))].sort().reverse();
    const targetMonth = availableMonths.includes(monthPrefix) ? monthPrefix : availableMonths[0];

    const monthTrips = trips.filter(t => t.date.startsWith(targetMonth));
    const paid = monthTrips.filter(t => statusFromTrip(t) === 'pagado').length;
    const process = monthTrips.filter(t => statusFromTrip(t) === 'proceso').length;

    document.querySelector('[data-view="inicio"] .stat:nth-child(1) .val').textContent = num(monthTrips.length);
    document.querySelector('[data-view="inicio"] .stat:nth-child(2) .val').textContent = num(process);
    document.querySelector('[data-view="inicio"] .stat:nth-child(3) .val').textContent = num(paid);
  }

  // ---------- Detalle ----------
  function getTripFromHash() {
    const match = location.hash.match(/^#viaje(?:\/(.+))?$/);
    if (!match) return trips[0] || null;
    const id = match[1] || trips[0]?.id;
    return trips.find(t => t.id === id) || trips[0] || null;
  }

  function renderDetail(trip) {
    if (!trip) return;

    currentTripId = trip.id;
    const status = statusFromTrip(trip);
    const chip = chips[status] || chips.proceso;
    const c = calculate(trip);

    document.getElementById('detailStatus').className = `chip ${chip[0]}`;
    document.getElementById('detailStatus').textContent = chip[1];
    document.getElementById('detailLoaded').textContent = `Cargado el ${formatDate(trip.date)}`;

    const values = {
      'd-fecha': formatDate(trip.date),
      'd-origen': trip.origin,
      'd-destino': trip.destination,
      'd-modelo': trip.model || '—',
      'd-patente': trip.plate,
      'd-chofer': trip.driver,
      'd-ctg': trip.ctg,
      'd-tn': num(trip.tons),
      'q-tarifa': money(trip.tariff).replace('$',''),
      'q-com': money(c.commission).replace('$',''),
      'q-sub': money(c.subtotal).replace('$',''),
      'q-driver': money(c.driver).replace('$',''),
      'q-ade': money(trip.advance).replace('$','')
    };

    Object.entries(values).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el) el.value = value;
    });

    document.getElementById('q-com-label').textContent = `Comisión del transporte (${num(trip.commissionRate)}%)`;
    document.getElementById('q-bruto').textContent = money(c.gross);
    document.getElementById('q-total').textContent = money(c.total);

    document.getElementById('btnMarkPaid').hidden = trip.paid;
    document.getElementById('btnEditTrip').hidden = false;
    document.getElementById('btnSaveTrip').hidden = true;

    setDetailReadonly(true);
  }

  function setDetailReadonly(readonly) {
    document.querySelectorAll('.detail-input').forEach(input => {
      input.readOnly = readonly;
    });
  }

  // ---------- Alta / edición ----------
  function openTripModal(trip = null) {
    editingTripId = trip?.id || null;
    form.reset();
    formError.hidden = true;
    document.getElementById('tripModalTitle').textContent = trip ? `Editar viaje ${trip.id}` : 'Nuevo viaje';

    const commission = trip?.commissionRate ?? settings.commissionRate;
    document.getElementById('f-commission').value = commission;
    document.getElementById('f-date').value = trip?.date || new Date().toISOString().slice(0,10);
    document.getElementById('f-origin').value = trip?.origin || '';
    document.getElementById('f-destination').value = trip?.destination || '';
    document.getElementById('f-model').value = trip?.model || '';
    document.getElementById('f-plate').value = trip?.plate || '';
    document.getElementById('f-driver').value = trip?.driver || '';
    document.getElementById('f-ctg').value = trip?.ctg || '';
    document.getElementById('f-tons').value = trip?.tons ?? '';
    document.getElementById('f-tariff').value = trip?.tariff ?? '';
    document.getElementById('f-advance').value = trip?.advance ?? 0;
    document.getElementById('f-paid').checked = !!trip?.paid;

    modal.hidden = false;
    document.body.classList.add('modal-open');
    updateFormCalculation();
    document.getElementById('f-origin').focus();
  }

  function closeTripModal() {
    modal.hidden = true;
    document.body.classList.remove('modal-open');
    editingTripId = null;
  }

  function formDataToTrip() {
    const get = name => form.elements[name].value.trim();
    return {
      date: get('date'),
      origin: get('origin'),
      destination: get('destination'),
      model: get('model'),
      plate: get('plate'),
      driver: get('driver'),
      ctg: get('ctg'),
      tons: Number(get('tons')),
      tariff: Number(get('tariff')),
      advance: Number(get('advance') || 0),
      commissionRate: Number(get('commissionRate')),
      paid: form.elements.paid.checked
    };
  }

  function updateFormCalculation() {
    const temp = formDataToTrip();
    const c = calculate(temp);
    document.getElementById('formGross').textContent = money(c.gross);
    document.getElementById('formCommission').textContent = money(c.commission);
    document.getElementById('formSubtotal').textContent = money(c.subtotal);
    document.getElementById('formDriver').textContent = money(c.driver);
    document.getElementById('formTotal').textContent = money(c.total);
  }

  function saveTripFromForm(e) {
    e.preventDefault();
    const data = formDataToTrip();

    if (!data.date || !data.origin || !data.destination || !data.plate || !data.driver || !data.ctg ||
        !Number.isFinite(data.tons) || data.tons <= 0 || !Number.isFinite(data.tariff) || data.tariff < 0 ||
        !Number.isFinite(data.commissionRate) || data.commissionRate < 0 || data.commissionRate > 100) {
      formError.textContent = 'Completá los campos obligatorios y verificá los valores numéricos.';
      formError.hidden = false;
      return;
    }

    if (editingTripId) {
      const index = trips.findIndex(t => t.id === editingTripId);
      if (index >= 0) {
        trips[index] = {
          ...trips[index],
          ...data,
          status: data.paid ? 'pagado' : (trips[index].status === 'espera' ? 'espera' : 'proceso')
        };
      }
    } else {
      trips.push({
        id: nextId(),
        ...data,
        status: data.paid ? 'pagado' : 'proceso'
      });
    }

    persist();
    renderTrips();
    closeTripModal();

    const id = editingTripId || trips[trips.length - 1].id;
    location.hash = `#viaje/${id}`;
  }

  function markCurrentAsPaid() {
    const trip = trips.find(t => t.id === currentTripId);
    if (!trip) return;

    trip.paid = true;
    trip.status = 'pagado';
    persist();
    renderTrips();
    renderDetail(trip);
  }

  // ---------- Reportes ----------
  function monthsAvailable() {
    return [...new Set(trips.map(t => t.date.slice(0,7)))].sort().reverse();
  }

  function monthLabel(ym) {
    const [y,m] = ym.split('-');
    const d = new Date(Number(y), Number(m)-1, 1);
    return d.toLocaleDateString('es-AR', { month:'long', year:'numeric' })
      .replace(/^./, x => x.toUpperCase());
  }

  function initReportMonths() {
    const select = document.getElementById('reportMonth');
    const current = select.value;
    select.innerHTML = monthsAvailable().map(m => `<option value="${m}">${monthLabel(m)}</option>`).join('');
    if (current && monthsAvailable().includes(current)) select.value = current;
  }

  function reportTrips() {
    const month = document.getElementById('reportMonth').value;
    return trips.filter(t => t.date.startsWith(month));
  }

  function renderReports() {
    initReportMonths();
    const data = reportTrips();
    const paid = data.filter(t => statusFromTrip(t) === 'pagado').reduce((s,t) => s + calculate(t).subtotal, 0);
    const process = data.filter(t => statusFromTrip(t) === 'proceso').reduce((s,t) => s + calculate(t).subtotal, 0);
    const wait = data.filter(t => statusFromTrip(t) === 'espera').reduce((s,t) => s + calculate(t).subtotal, 0);

    document.getElementById('reportPaid').textContent = money(paid);
    document.getElementById('reportProcess').textContent = money(process);
    document.getElementById('reportWait').textContent = money(wait);

    const total = data.reduce((s,t) => s + calculate(t), 0);
    const totals = data.reduce((acc,t) => {
      const c = calculate(t);
      acc.tons += Number(t.tons);
      acc.commission += c.commission;
      acc.advance += Number(t.advance || 0);
      acc.subtotal += c.subtotal;
      acc.driver += c.driver;
      return acc;
    }, { tons:0, commission:0, advance:0, subtotal:0, driver:0 });

    document.getElementById('reportTrips').textContent = num(data.length);
    document.getElementById('reportTons').textContent = `${num(totals.tons)} tn`;
    document.getElementById('reportCommission').textContent = money(totals.commission);
    document.getElementById('reportAdvance').textContent = money(totals.advance);
    document.getElementById('reportSubtotal').textContent = money(totals.subtotal);
    document.getElementById('reportDrivers').textContent = money(totals.driver);

    renderReportTable(data);
    renderChart(data);
  }

  function groupData(data, key) {
    const map = new Map();

    data.forEach(t => {
      const c = calculate(t);
      const name = key === 'truck' ? `${t.plate} · ${t.model || 'Modelo no indicado'}` :
                   key === 'driver' ? t.driver : 'General';

      if (!map.has(name)) {
        map.set(name, { name, trips:0, tons:0, gross:0, commission:0, subtotal:0, driver:0, advance:0, total:0 });
      }

      const g = map.get(name);
      g.trips++;
      g.tons += Number(t.tons);
      g.gross += c.gross;
      g.commission += c.commission;
      g.subtotal += c.subtotal;
      g.driver += c.driver;
      g.advance += Number(t.advance || 0);
      g.total += c.total;
    });

    return [...map.values()].sort((a,b) => a.name.localeCompare(b.name));
  }

  function renderReportTable(data) {
    const head = document.getElementById('reportHead');
    const body = document.getElementById('reportBody');

    const configs = {
      general: {
        title:'Resumen general',
        subtitle:'Cuenta consolidada de los viajes del período.',
        headers:['Viajes','Toneladas','Bruto','Comisión','Subtotal','15% chofer','Adelantos','Total a cobrar'],
        rows: groupData(data, 'general')
      },
      truck: {
        title:'Resumen por camión',
        subtitle:'Liquidación agrupada por patente y modelo.',
        headers:['Camión','Viajes','Toneladas','Bruto','Comisión','Subtotal','15% chofer','Total a cobrar'],
        rows: groupData(data, 'truck')
      },
      driver: {
        title:'Resumen por chofer',
        subtitle:'Liquidación agrupada por chofer.',
        headers:['Chofer','Viajes','Toneladas','Bruto','Comisión','Subtotal','15% chofer','Total a cobrar'],
        rows: groupData(data, 'driver')
      }
    };

    const cfg = configs[currentReportGroup];
    document.getElementById('reportTableTitle').textContent = cfg.title;
    document.getElementById('reportTableSubtitle').textContent = cfg.subtitle;

    head.innerHTML = `<tr>${cfg.headers.map((h,i) => `<th class="${i > 1 ? 'num' : ''}">${h}</th>`).join('')}</tr>`;

    if (!cfg.rows.length) {
      body.innerHTML = `<tr><td colspan="${cfg.headers.length}" class="empty-cell">No hay datos para el período seleccionado.</td></tr>`;
      return;
    }

    body.innerHTML = cfg.rows.map(g => {
      const first = currentReportGroup === 'general' ? '' : `<td><strong>${escapeHtml(g.name)}</strong></td>`;
      return currentReportGroup === 'general'
        ? `<tr><td class="num">${g.trips}</td><td class="num">${num(g.tons)}</td><td class="num">${money(g.gross)}</td><td class="num">${money(g.commission)}</td><td class="num">${money(g.subtotal)}</td><td class="num">${money(g.driver)}</td><td class="num">${money(g.advance)}</td><td class="num c-total">${money(g.total)}</td></tr>`
        : `<tr>${first}<td class="num">${g.trips}</td><td class="num">${num(g.tons)}</td><td class="num">${money(g.gross)}</td><td class="num">${money(g.commission)}</td><td class="num">${money(g.subtotal)}</td><td class="num">${money(g.driver)}</td><td class="num c-total">${money(g.total)}</td></tr>`;
    }).join('');
  }

  function renderChart(data) {
    const chart = document.getElementById('chart');
    if (!chart) return;

    const byWeek = {};
    data.forEach(t => {
      const day = Number(t.date.slice(8,10));
      const week = day <= 7 ? '1–7' : day <= 14 ? '8–14' : day <= 21 ? '15–21' : '22–31';
      if (!byWeek[week]) byWeek[week] = { paid:0, process:0, wait:0 };
      const value = calculate(t).subtotal / 1000000;
      const status = statusFromTrip(t);
      if (status === 'pagado') byWeek[week].paid += value;
      if (status === 'proceso') byWeek[week].process += value;
      if (status === 'espera') byWeek[week].wait += value;
    });

    const weeks = ['1–7','8–14','15–21','22–31'];
    const values = weeks.map(w => byWeek[w] || {paid:0,process:0,wait:0});
    const max = Math.max(1, ...values.map(w => w.paid + w.process + w.wait));
    const y = `<div class="y-axis">${[0,1,2,3,4,5,6].map(i => `<span style="bottom:${i/6*100}%">${(max*i/6).toFixed(1)}</span>`).join('')}</div>`;

    const cols = values.map(w => {
      const total = w.paid + w.process + w.wait;
      const h = total ? total/max*100 : 0;
      const pct = total ? {
        paid:w.paid/total*100,
        process:w.process/total*100,
        wait:w.wait/total*100
      } : {paid:0,process:0,wait:0};

      return `<div class="col"><span class="tot">${total.toFixed(1).replace('.',',')}</span>
        <div class="stack" style="height:${h}%">
          <i class="p" style="height:${pct.paid}%"></i>
          <i class="e" style="height:${pct.process}%"></i>
          <i class="w" style="height:${pct.wait}%"></i>
        </div>
      </div>`;
    }).join('');

    chart.innerHTML = `${y}<div class="plot">${cols}</div><div class="x-axis">${weeks.map(w => `<span>${w}</span>`).join('')}</div>`;
  }

  // ---------- Navegación ----------
  const titles = {inicio:'Inicio', viajes:'Viajes', reportes:'Reportes', config:'Configuración'};
  const navFor = { viaje:'viajes' };

  function route() {
    const raw = (location.hash || '#inicio').slice(1);
    const name = raw.startsWith('viaje/') ? 'viaje' : raw;

    const known = ['login','inicio','viajes','viaje','reportes','config'];
    const safeName = known.includes(name) ? name : 'inicio';

    document.body.classList.remove('drawer');

    login.hidden = safeName !== 'login';
    app.hidden = safeName === 'login';

    if (app.hidden) return;

    document.querySelectorAll('[data-view]').forEach(section => {
      section.hidden = section.dataset.view !== safeName;
    });

    const active = navFor[safeName] || safeName;
    document.querySelectorAll('[data-nav]').forEach(a => {
      if (a.dataset.nav === active) a.setAttribute('aria-current','page');
      else a.removeAttribute('aria-current');
    });

    const isDetail = safeName === 'viaje';
    title.hidden = isDetail;
    crumbs.hidden = !isDetail;

    if (isDetail) {
      const trip = getTripFromHash();
      if (trip) {
        crumbs.querySelector('span').textContent = trip.id;
        renderDetail(trip);
        document.title = `Viaje ${trip.id} · Transporte Ciperiani`;
      }
    } else {
      title.textContent = titles[safeName];
      document.title = `${titles[safeName]} · Transporte Ciperiani`;
    }

    if (safeName === 'viajes') renderTrips();
    if (safeName === 'reportes') renderReports();

    content.scrollTop = 0;
  }

  // ---------- Configuración ----------
  function loadSettings() {
    settings = load(STORAGE.settings, defaultSettings);
    const commissionInput = document.getElementById('c-com');
    if (commissionInput) commissionInput.value = settings.commissionRate;
  }

  function saveSettings() {
    const value = Number(document.getElementById('c-com').value);
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      alert('La comisión debe estar entre 0% y 100%.');
      return;
    }
    settings.commissionRate = value;
    settings.driverRate = DRIVER_RATE * 100;
    save(STORAGE.settings, settings);
    alert('Configuración de liquidación guardada.');
  }

  // ---------- Utilidades ----------
  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;'
    }[char]));
  }

  // ---------- Eventos ----------
  document.getElementById('btnNewTrip')?.addEventListener('click', () => openTripModal());

  document.querySelectorAll('[data-close-modal]').forEach(el => {
    el.addEventListener('click', closeTripModal);
  });

  form?.addEventListener('input', updateFormCalculation);
  form?.addEventListener('submit', saveTripFromForm);

  document.getElementById('btnEditTrip')?.addEventListener('click', () => {
    const trip = trips.find(t => t.id === currentTripId);
    if (trip) openTripModal(trip);
  });

  document.getElementById('btnMarkPaid')?.addEventListener('click', markCurrentAsPaid);

  document.getElementById('menuBtn')?.addEventListener('click', () => document.body.classList.add('drawer'));
  document.getElementById('scrim')?.addEventListener('click', () => document.body.classList.remove('drawer'));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.body.classList.remove('drawer');
      if (!modal.hidden) closeTripModal();
    }
  });

  document.addEventListener('click', e => {
    const rowEl = e.target.closest('tr[data-go="viaje"]');
    if (rowEl && !e.target.closest('a')) location.hash = `#viaje/${rowEl.dataset.tripId}`;

    const go = e.target.closest('[data-go]');
    if (go && !e.target.closest('a')) location.hash = `#${go.dataset.go}`;
  });

  document.querySelectorAll('.seg button').forEach(button => {
    if (button.dataset.reportGroup) return;
    if (button.textContent.trim() === 'Todos') button.dataset.tripFilter = 'todos';
    if (button.textContent.trim() === 'Pagados') button.dataset.tripFilter = 'pagado';
    if (button.textContent.trim() === 'En proceso') button.dataset.tripFilter = 'proceso';
    if (button.textContent.trim() === 'En espera') button.dataset.tripFilter = 'espera';

    button.addEventListener('click', () => {
      const group = button.parentElement;
      group.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed','false'));
      button.setAttribute('aria-pressed','true');
      renderTrips();
    });
  });

  document.querySelector('.search input')?.addEventListener('input', renderTrips);

  document.querySelectorAll('[data-report-group]').forEach(button => {
    button.addEventListener('click', () => {
      currentReportGroup = button.dataset.reportGroup;
      document.querySelectorAll('[data-report-group]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
      renderReports();
    });
  });

  document.getElementById('reportMonth')?.addEventListener('change', renderReports);

  document.getElementById('btnPrintReport')?.addEventListener('click', () => window.print());

  document.querySelector('[data-view="config"] .set:nth-child(2) .btn')?.addEventListener('click', saveSettings);

  document.getElementById('c-com')?.addEventListener('change', () => {
    settings.commissionRate = Number(document.getElementById('c-com').value) || 0;
  });

  window.addEventListener('hashchange', route);

  // Inicio.
  loadSettings();
  renderTrips();
  route();
})();
