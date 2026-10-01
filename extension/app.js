import { EXAMPLE_LOADS, COMMON_LOADS, calculatePlan, toCSV, toSummary } from './calculator.js';

const $ = selector => document.querySelector(selector);
const STORAGE_KEY = 'generatorPlanV1';
const storage = globalThis.chrome?.storage?.local;
const params = new URLSearchParams(location.search);
const fullpage = params.get('view') === 'tab';
document.body.classList.toggle('fullpage', fullpage);
$('#open-tab').hidden = fullpage;
const headrooms = [0.1, 0.15, 0.2, 0.25];
const clone = value => structuredClone(value);
const emptyLoad = () => ({ id: crypto.randomUUID(), name: '', runningWatts: '', startingWatts: '' });
const example = () => ({ schemaVersion: 1, loads: clone(EXAMPLE_LOADS), headroom: 0.15 });
let plan = example();
let isExample = true;
let undoState = null;
let result;
let saveQueue = Promise.resolve();
let active = false;

function restoreDraft(value) {
  const p = value?.plan;
  if (!p || p.schemaVersion !== 1 || !Array.isArray(p.loads) || p.loads.length > 100 || !headrooms.includes(p.headroom)) return null;
  const ids = new Set();
  for (const load of p.loads) {
    if (!load || typeof load.id !== 'string' || !/^[\w-]{1,80}$/.test(load.id) || ids.has(load.id) || typeof load.name !== 'string' || load.name.length > 120) return null;
    ids.add(load.id);
    for (const field of ['runningWatts', 'startingWatts']) {
      const n = load[field];
      if (!(typeof n === 'string' && n.length <= 40) && !(typeof n === 'number' && Number.isFinite(n))) return null;
    }
  }
  return { plan: clone(p), isExample: value.isExample === true };
}

function drawLoads() {
  $('#loads').replaceChildren();
  for (const load of plan.loads) {
    const row = $('#load-template').content.firstElementChild.cloneNode(true);
    row.dataset.id = load.id;
    for (const [cls, field] of [['load-name', 'name'], ['load-running', 'runningWatts'], ['load-starting', 'startingWatts']]) {
      const input = row.querySelector(`.${cls}`);
      input.id = `${cls}-${load.id}`;
      input.value = load[field];
      input.previousElementSibling.htmlFor = input.id;
    }
    row.querySelector('.remove-load').setAttribute('aria-label', `Remove ${load.name || 'unnamed load'}`);
    $('#loads').append(row);
  }
}

function readInputs() {
  plan.loads = [...$('#loads').children].map(row => ({
    id: row.dataset.id,
    name: row.querySelector('.load-name').value,
    runningWatts: row.querySelector('.load-running').value,
    startingWatts: row.querySelector('.load-starting').value,
  }));
  plan.headroom = Number($('#headroom').value);
}

function update() {
  result = calculatePlan(plan.loads, plan.headroom);
  const kw = value => result.valid ? `${(value / 1000).toFixed(1)} kW` : '—';
  $('#required-kw').textContent = result.valid ? (result.requiredWatts / 1000).toFixed(1) : '—';
  $('#running-kw').textContent = kw(result.runningWatts);
  $('#starting-kw').textContent = kw(result.largestStartingWatts);
  $('#continuous-kw').textContent = kw(result.continuousWatts);
  $('#load-count').textContent = `${plan.loads.length} ${plan.loads.length === 1 ? 'load' : 'loads'}`;
  $('#example-notice').hidden = !isExample;
  $('#undo').hidden = !undoState;
  $('#add-load').disabled = plan.loads.length >= 100;
  $('#formula').textContent = result.valid ? `(${result.runningWatts.toLocaleString('en-US')} + ${result.largestStartingWatts.toLocaleString('en-US')}) × ${(1 + plan.headroom).toFixed(2)} = ${Math.round(result.requiredWatts).toLocaleString('en-US')} W` : 'Complete your load list to see the calculation.';
  const fieldClasses = { name: 'load-name', runningWatts: 'load-running', startingWatts: 'load-starting' };
  [...$('#loads').children].forEach((row, index) => row.querySelector('.remove-load').setAttribute('aria-label', `Remove ${plan.loads[index].name || 'unnamed load'}`));
  $('#loads').querySelectorAll('input').forEach(input => input.setAttribute('aria-invalid', 'false'));
  for (const error of result.errors) {
    const row = [...$('#loads').children][error.index];
    if (row && fieldClasses[error.field]) row.querySelector(`.${fieldClasses[error.field]}`).setAttribute('aria-invalid', 'true');
  }
  $('#input-errors').textContent = result.valid ? '' : (plan.loads.length === 0 ? 'Add at least one load to build your plan.' : 'Enter a name and whole-number watts from 0 to 1,000,000 for each load. At least one running load must be above zero.');
  for (const selector of ['#download', '#copy', '#print']) $(selector).disabled = !result.valid;
  $('#print-summary').textContent = result.valid ? toSummary(plan) : '';
  $('#result-announcement').textContent = result.valid ? `Estimated requirement ${kw(result.requiredWatts)}. Running with headroom ${kw(result.continuousWatts)}.` : 'Estimate unavailable. Complete your load entries.';
}

function persist() {
  if (!storage) { $('#save-status').textContent = 'Preview mode · plans are not saved'; return Promise.resolve(true); }
  const snapshot = { plan: clone(plan), isExample };
  // Dispatch the write within the input event, before a toolbar popup can close.
  saveQueue = storage.set({ [STORAGE_KEY]: snapshot }).then(() => {
    $('#save-status').textContent = 'Plan saved on this device';
    return true;
  }).catch(() => { $('#save-status').textContent = 'Could not save. Download your worksheet to keep a copy.'; return false; });
  return saveQueue;
}

function changed() {
  readInputs();
  isExample = false;
  $('#export-status').textContent = '';
  update();
  $('#save-status').textContent = storage ? 'Saving on this device…' : 'Preview mode · plans are not saved';
  persist();
}

function replacePlan(next, nextExample = false) {
  undoState = { plan: clone(plan), isExample };
  plan = next;
  isExample = nextExample;
  $('#headroom').value = String(plan.headroom);
  $('#export-status').textContent = '';
  drawLoads();
  update();
  persist();
}

function downloadFile(text, filename, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

$('#loads').addEventListener('input', changed);
$('#headroom').addEventListener('change', changed);
$('#loads').addEventListener('click', event => {
  const button = event.target.closest('.remove-load');
  if (!button || !active) return;
  button.closest('.load-row').remove();
  changed();
  $('#add-load').focus();
});
$('#add-load').addEventListener('click', () => {
  if (!active || plan.loads.length >= 100) return;
  plan.loads.push(emptyLoad());
  drawLoads();
  changed();
  $('#loads').lastElementChild.querySelector('input').focus();
});
$('#blank-plan').addEventListener('click', () => {
  replacePlan({ schemaVersion: 1, loads: [emptyLoad()], headroom: 0.15 });
  $('#loads').querySelector('input').focus();
});
$('#example-plan').addEventListener('click', () => replacePlan(example(), true));
$('#undo').addEventListener('click', () => {
  if (!undoState) return;
  const previous = undoState;
  undoState = null;
  plan = previous.plan;
  isExample = previous.isExample;
  $('#headroom').value = String(plan.headroom);
  drawLoads();
  update();
  persist();
});
$('#delete-plan').addEventListener('click', async () => {
  undoState = { plan: clone(plan), isExample };
  plan = { schemaVersion: 1, loads: [emptyLoad()], headroom: 0.15 };
  isExample = false;
  $('#headroom').value = '0.15';
  drawLoads();
  update();
  if (storage) {
    try { await saveQueue; await storage.remove(STORAGE_KEY); $('#save-status').textContent = 'Saved plan deleted'; }
    catch { $('#save-status').textContent = 'Could not delete the saved plan. Try again.'; }
  } else $('#save-status').textContent = 'Preview mode · no saved plan';
});
$('#download').addEventListener('click', () => {
  if (!result.valid) return;
  downloadFile(toCSV(plan), 'generator-load-worksheet.csv', 'text/csv;charset=utf-8');
  $('#export-status').textContent = 'Worksheet downloaded. Share it with your installer.';
});
$('#copy').addEventListener('click', async () => {
  if (!result.valid) return;
  try { await navigator.clipboard.writeText(toSummary(plan)); $('#export-status').textContent = 'Summary copied.'; }
  catch { $('#export-status').textContent = 'Copy unavailable. Download the worksheet instead.'; }
});
$('#print').addEventListener('click', async () => {
  if (!result.valid) return;
  if (fullpage || !storage) { window.print(); return; }
  if (!await persist()) { $('#export-status').textContent = 'Could not save for printing. Download the worksheet instead.'; return; }
  window.open('index.html?view=tab&print=1', '_blank', 'noopener');
});
$('#open-tab').addEventListener('click', async () => {
  if (!await persist()) { $('#export-status').textContent = 'Could not open your saved plan. Try again.'; return; }
  window.open('index.html?view=tab', '_blank', 'noopener');
});

for (const load of COMMON_LOADS) {
  const option = document.createElement('option');
  option.value = load.name;
  $('#common-loads').append(option);
}

async function start() {
  // Keep actions disabled until local data has been restored, so a slow read cannot replace edits.
  const buttons = [...document.querySelectorAll('button')];
  buttons.forEach(button => button.disabled = true);
  if (storage) {
    try {
      const saved = await storage.get(STORAGE_KEY);
      const restored = restoreDraft(saved[STORAGE_KEY]);
      if (restored) { plan = restored.plan; isExample = restored.isExample; }
      $('#save-status').textContent = restored ? 'Plan restored from this device' : (saved[STORAGE_KEY] ? 'Saved data could not be restored. Example loaded.' : 'Your plan stays on this device');
    } catch { $('#save-status').textContent = 'Storage unavailable. Download your worksheet to keep a copy.'; }
  } else $('#save-status').textContent = 'Preview mode · plans are not saved';
  $('#headroom').value = String(plan.headroom);
  drawLoads();
  active = true;
  buttons.forEach(button => button.disabled = false);
  update();
  if (fullpage && params.get('print') === '1' && result.valid) window.print();
}
start();
