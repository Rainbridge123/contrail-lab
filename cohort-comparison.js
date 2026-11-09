const altitudeFormat = new Intl.NumberFormat('en-US', { signDisplay: 'exceptZero' });
const machFormat = new Intl.NumberFormat('en-US', {
  signDisplay: 'exceptZero', minimumFractionDigits: 2, maximumFractionDigits: 2,
});

function changeLine(label, unchanged) {
  const line = document.createElement('span');
  line.className = 'cohort-delta';
  line.classList.toggle('cohort-zero', unchanged);
  line.textContent = label;
  return line;
}

export function renderCohortComparison(host, flights, plans, translate, onSelect) {
  const groups = new Map();
  for (const plan of plans) {
    if (!groups.has(plan.family)) groups.set(plan.family, []);
    groups.get(plan.family).push(plan);
  }

  const scroll = document.createElement('div');
  scroll.className = 'cohort-table-scroll';
  scroll.tabIndex = 0;
  scroll.setAttribute('role', 'region');
  const label = translate('cohortTableLabel');
  scroll.setAttribute('aria-label', label);

  const table = document.createElement('table');
  table.className = 'cohort-table';
  const caption = table.createCaption();
  caption.className = 'sr-only';
  caption.textContent = label;
  table.append(document.createElement('colgroup'));

  const head = table.createTHead();
  const familyRow = head.insertRow();
  const planRow = head.insertRow();
  const aircraftHeader = document.createElement('th');
  aircraftHeader.scope = 'col';
  aircraftHeader.rowSpan = 2;
  aircraftHeader.textContent = translate('cohortAircraft');
  familyRow.append(aircraftHeader);

  const columns = [];
  for (const [family, group] of groups) {
    const colgroup = document.createElement('colgroup');
    colgroup.span = group.length;
    table.insertBefore(colgroup, head);

    const groupHeader = document.createElement('th');
    groupHeader.className = 'cohort-group-start';
    groupHeader.scope = 'colgroup';
    groupHeader.colSpan = group.length;
    groupHeader.textContent = family;
    familyRow.append(groupHeader);

    for (const [index, plan] of group.entries()) {
      const planHeader = document.createElement('th');
      planHeader.scope = 'col';
      planHeader.classList.toggle('cohort-group-start', index === 0);
      planHeader.textContent = plan.label;
      const count = flights.filter(flight => (flight.plans[plan.key]?.change ?? 'none') !== 'none').length;
      const planCount = document.createElement('span');
      planCount.className = 'cohort-column-count';
      planCount.textContent = translate('cohortColumnCount', { count });
      planHeader.append(planCount);
      planRow.append(planHeader);
      columns.push({ key: plan.key, groupStart: index === 0 });
    }
  }

  const body = table.createTBody();
  for (const flight of flights) {
    const row = body.insertRow();
    row.dataset.aircraftId = flight.id;
    const aircraftCell = document.createElement('th');
    aircraftCell.scope = 'row';
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.cohortAircraft = flight.id;
    button.textContent = '#' + flight.id;
    button.setAttribute('aria-label', translate('cohortSelectAircraft', { id: flight.id }));
    button.addEventListener('click', () => onSelect(flight.id));
    aircraftCell.append(button);
    row.append(aircraftCell);

    for (const { key, groupStart } of columns) {
      const cell = row.insertCell();
      const plan = flight.plans[key];
      cell.dataset.plan = key;
      cell.classList.toggle('cohort-group-start', groupStart);
      if (!plan) {
        cell.textContent = translate('metricUnavailable');
        continue;
      }
      cell.dataset.change = plan.change;
      if (plan.change === 'none') {
        cell.textContent = translate('cohortUnchanged');
        continue;
      }
      const altitude = translate('altitudeAdjustment', { amount: altitudeFormat.format(plan.altitudeOffset) });
      const mach = translate('machAdjustment', { amount: machFormat.format(plan.machOffset) });
      cell.append(changeLine(altitude, plan.altitudeOffset === 0), changeLine(mach, plan.machOffset === 0));
    }
  }

  scroll.append(table);
  host.replaceChildren(scroll);
}

export function createAircraftSelection(host, { onChange, translate }) {
  const details = document.createElement('details');
  details.className = 'aircraft-selection';
  const summary = document.createElement('summary');
  const panel = document.createElement('div');
  panel.className = 'aircraft-selection-panel';

  const actions = document.createElement('div');
  actions.className = 'aircraft-selection-actions';
  const selectChanged = document.createElement('button');
  const selectAll = document.createElement('button');
  const clearAll = document.createElement('button');
  selectChanged.type = selectAll.type = clearAll.type = 'button';
  actions.append(selectChanged, selectAll, clearAll);

  const field = document.createElement('fieldset');
  const legend = document.createElement('legend');
  legend.className = 'sr-only';
  const grid = document.createElement('div');
  grid.className = 'aircraft-selection-grid';
  field.append(legend, grid);

  const empty = document.createElement('p');
  empty.className = 'aircraft-selection-empty';
  const hint = document.createElement('p');
  hint.className = 'aircraft-selection-hint';
  panel.append(actions, field, empty, hint);
  details.append(summary, panel);
  host.replaceChildren(details);

  let options = [];
  let changedIds = [];
  let listKey;
  let previousSummary;
  grid.addEventListener('change', () => {
    onChange(options.filter(({ input }) => input.checked).map(({ id }) => id));
  });
  selectChanged.addEventListener('click', () => onChange(changedIds, 'changed'));
  selectAll.addEventListener('click', () => onChange(options.map(({ id }) => id), 'all'));
  clearAll.addEventListener('click', () => onChange([]));
  host.ownerDocument.addEventListener('click', event => {
    if (details.open && !details.contains(event.target)) details.open = false;
  }, { capture: true });
  details.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !details.open) return;
    event.stopPropagation();
    details.open = false;
    summary.focus();
  });

  return {
    render(flights, selectedIds, changedAircraftIds) {
      const fieldLabel = translate('aircraftSelectionLabel');
      const key = fieldLabel + ':' + flights.map(({ id }) => id).join(',');
      if (key !== listKey) {
        listKey = key;
        legend.textContent = fieldLabel;
        selectChanged.title = translate('aircraftSelectChangedHint');
        selectAll.textContent = translate('aircraftSelectAll');
        clearAll.textContent = translate('aircraftClearAll');
        empty.textContent = translate('aircraftSelectionEmpty');
        hint.textContent = translate('aircraftSelectionHint');
        options = flights.map(({ id }) => {
          const label = document.createElement('label');
          const input = document.createElement('input');
          input.type = 'checkbox';
          input.value = id;
          input.setAttribute('aria-label', translate('aircraftLabel', { id }));
          label.append(input, '#' + id);
          return { id, label, input };
        });
        grid.replaceChildren(...options.map(({ label }) => label));
        actions.hidden = field.hidden = !options.length;
        empty.hidden = Boolean(options.length);
      }

      changedIds = changedAircraftIds;
      selectChanged.textContent = translate('aircraftSelectChanged', { count: changedIds.length });
      selectChanged.disabled = changedIds.length === 0;
      const selection = new Set(selectedIds);
      let count = 0;
      for (const { id, input } of options) {
        const checked = selection.has(id);
        if (input.checked !== checked) input.checked = checked;
        if (checked) count++;
      }
      const summaryText = translate(selectedIds === null ? 'aircraftSelectionOpen' : 'aircraftSelectionEdit');
      if (summaryText !== previousSummary) {
        previousSummary = summaryText;
        summary.textContent = summaryText;
      }
      selectAll.disabled = count === options.length;
      clearAll.disabled = count === 0;
    },
    close() { details.open = false; },
  };
}
