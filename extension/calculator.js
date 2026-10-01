/**
 * Pure generator-planning calculations. All startingWatts values represent
 * EXTRA demand above the load's running demand, never total startup demand.
 * The supplied presets are illustrative examples, not equipment ratings.
 */

export const SCHEMA_VERSION = 1;
export const DEFAULT_HEADROOM = 0.15;
export const LIMITS = Object.freeze({
  maxLoads: 100,
  maxNameLength: 120,
  maxWattsPerLoad: 1_000_000,
  maxHeadroom: 1,
});

const preset = (id, name, runningWatts, startingWatts) =>
  Object.freeze({ id, name, runningWatts, startingWatts });

export const EXAMPLE_LOADS = Object.freeze([
  preset('example-ac', 'Central AC / heat pump', 3500, 3000),
  preset('example-refrigerator', 'Refrigerator', 700, 1200),
  preset('example-lighting', 'Lighting / outlets', 1500, 0),
  preset('example-furnace', 'Gas furnace blower', 700, 1200),
]);

export const COMMON_LOADS = Object.freeze([
  preset('preset-ac', 'Central AC / heat pump', 3500, 3000),
  preset('preset-well', 'Well pump', 1200, 2500),
  preset('preset-refrigerator', 'Refrigerator', 700, 1200),
  preset('preset-freezer', 'Freezer', 500, 800),
  preset('preset-furnace', 'Gas furnace blower', 700, 1200),
  preset('preset-sump', 'Sump pump', 800, 1400),
  preset('preset-water-heater', 'Electric water heater', 4500, 0),
  preset('preset-range', 'Electric range / oven', 5000, 0),
  preset('preset-microwave', 'Microwave', 1200, 0),
  preset('preset-lighting', 'Lighting / outlets', 1500, 0),
  preset('preset-garage', 'Garage door opener', 600, 900),
  preset('preset-pool', 'Pool pump', 1500, 2500),
]);

export class PlanValidationError extends Error {
  constructor(errors) {
    super(errors.map(error => error.message).join(' '));
    this.name = 'PlanValidationError';
    this.errors = errors;
  }
}

// Number('') and Number(null) are zero, so conversion must be explicit.
function parseNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const input = value.trim();
  if (!input || !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(input)) return null;
  const number = Number(input);
  return Number.isFinite(number) ? number : null;
}

function normalizeId(value) {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return String(value);
  if (typeof value !== 'string') return null;
  const id = value.trim();
  return id && id.length <= 80 && !/[\p{Cc}\p{Cf}]/u.test(id) ? id : null;
}

/**
 * Validate a complete schemaVersion:1 worksheet. Numeric form-input strings
 * become numbers only after their content, bounds and integer watts are checked.
 * Invalid drafts remain invalid; no missing value is silently replaced with zero.
 *
 * @returns {{valid:boolean, errors:Array, plan:object|null}}
 */
export function validatePlan(input) {
  const errors = [];
  const error = (field, message, index = null, loadId = null) => {
    errors.push({ field, message, index, loadId });
  };
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    error('plan', 'The worksheet must be a valid plan object.');
    return { valid: false, errors, plan: null };
  }
  if (input.schemaVersion !== SCHEMA_VERSION) {
    error('schemaVersion', 'This worksheet format is not supported.');
  }
  const headroom = parseNumber(input.headroom);
  if (headroom === null || headroom < 0 || headroom > LIMITS.maxHeadroom) {
    error('headroom', 'Headroom must be a number from 0% to 100%.');
  }
  if (!Array.isArray(input.loads)) {
    error('loads', 'The worksheet must contain a load list.');
    return { valid: false, errors, plan: null };
  }
  if (input.loads.length === 0) error('loads', 'Add at least one load.');
  if (input.loads.length > LIMITS.maxLoads) {
    error('loads', `Use no more than ${LIMITS.maxLoads} loads.`);
    return { valid: false, errors, plan: null };
  }
  const ids = new Set();
  const loads = [];
  let totalRunning = 0;
  for (let index = 0; index < input.loads.length; index++) {
    const load = input.loads[index];
    if (!load || typeof load !== 'object' || Array.isArray(load)) {
      error('load', `Load ${index + 1} must be a valid load object.`, index);
      continue;
    }
    const id = normalizeId(load.id);
    if (id === null || ids.has(id)) {
      error('id', `Load ${index + 1} needs a unique identifier.`, index, id);
    }
    if (id !== null) ids.add(id);
    const name = typeof load.name === 'string' ? load.name.trim() : '';
    const visibleName = name.replace(/[\p{White_Space}\p{Cf}]/gu, '');
    if (!visibleName || name.length > LIMITS.maxNameLength || /\p{Cc}/u.test(name)) {
      error('name', `Name load ${index + 1} using 1–${LIMITS.maxNameLength} characters without control characters.`, index, id);
    }
    const normalized = { id, name };
    for (const field of ['runningWatts', 'startingWatts']) {
      const watts = parseNumber(load[field]);
      const label = field === 'runningWatts' ? 'Running watts' : 'Extra starting watts';
      if (watts === null || !Number.isInteger(watts) || watts < 0 || watts > LIMITS.maxWattsPerLoad) {
        error(field, `${label} for load ${index + 1} must be a whole number from 0 to 1,000,000; enter 0 only when verified.`, index, id);
      }
      normalized[field] = watts;
    }
    if (normalized.runningWatts !== null && normalized.runningWatts >= 0) totalRunning += normalized.runningWatts;
    loads.push(normalized);
  }
  if (!errors.some(item => item.field === 'runningWatts' || item.field === 'load') && totalRunning === 0) {
    error('loads', 'At least one running load must be greater than zero.');
  }
  return {
    valid: errors.length === 0,
    errors,
    plan: errors.length === 0 ? { schemaVersion: SCHEMA_VERSION, loads, headroom } : null,
  };
}

/** Return a fresh, validated plan or throw PlanValidationError. */
export function normalizePlan(input) {
  const result = validatePlan(input);
  if (!result.valid) throw new PlanValidationError(result.errors);
  return result.plan;
}

// Remove multiplication artifacts without rounding the planning estimate to kW.
const precision = watts => Number(watts.toFixed(6));

/**
 * Formula: (sum of simultaneous running W + largest EXTRA starting W) ×
 * (1 + headroom). Continuous output is shown independently. No model class
 * or purchase recommendation is inferred from these planning values.
 */
export function calculatePlan(loads, headroom = DEFAULT_HEADROOM) {
  const result = validatePlan({ schemaVersion: SCHEMA_VERSION, loads, headroom });
  if (!result.valid) {
    return {
      ...result,
      runningWatts: null,
      largestStartingWatts: null,
      requiredWatts: null,
      continuousWatts: null,
      runningKW: null,
      startingKW: null,
      requiredKW: null,
      continuousKW: null,
    };
  }
  const runningWatts = result.plan.loads.reduce((total, load) => total + load.runningWatts, 0);
  const largestStartingWatts = Math.max(...result.plan.loads.map(load => load.startingWatts));
  const requiredWatts = precision((runningWatts + largestStartingWatts) * (1 + result.plan.headroom));
  const continuousWatts = precision(runningWatts * (1 + result.plan.headroom));
  return {
    ...result,
    runningWatts,
    largestStartingWatts,
    requiredWatts,
    continuousWatts,
    runningKW: runningWatts / 1000,
    startingKW: largestStartingWatts / 1000,
    requiredKW: requiredWatts / 1000,
    continuousKW: continuousWatts / 1000,
  };
}

const SOURCE_URL = 'https://backupgeneratorguide.com/tools/generator-size-calculator/';
const ASSUMPTION = 'All listed loads run together; only one motor starts at a time. Extra starting watts are additional demand above running watts.';
const LIMITATION = 'Planning estimate, not a generator model recommendation. Have a qualified installer verify startup behavior, continuous output, fuel-specific ratings and system requirements.';
const INPUT_NOTE = 'Verify every value against equipment documentation or measured demand. Illustrative examples are not universal appliance ratings. Zero extra starting watts means no additional starting demand has been verified.';

function exportResult(input) {
  const plan = normalizePlan(input);
  return calculatePlan(plan.loads, plan.headroom);
}

// Quoting alone does not stop spreadsheet formula execution. Detect a formula
// after unusual Unicode whitespace, format controls, or ASCII control prefixes.
function csvCell(value) {
  let content = String(value);
  const meaningful = content.replace(/^[\p{White_Space}\p{Cf}\p{Cc}]*/u, '');
  if (/^[=+\-@]/.test(meaningful)) content = `'${content}`;
  return `"${content.replace(/"/g, '""')}"`;
}

/** Export a validated worksheet as UTF-8 CSV with formula-safe text cells. */
export function toCSV(input) {
  const result = exportResult(input);
  const rows = [
    ['Load / appliance', 'Running watts (W)', 'Extra starting watts (W)'],
    ...result.plan.loads.map(load => [load.name, load.runningWatts, load.startingWatts]),
    ['', '', ''],
    ['Measure', 'Value', 'Unit'],
    ['Total simultaneous running load', result.runningWatts, 'W'],
    ['Largest additional starting event', result.largestStartingWatts, 'W'],
    ['Headroom', precision(result.plan.headroom * 100), '%'],
    ['Running load + headroom', result.continuousWatts, 'W'],
    ['Starting event + headroom', result.requiredWatts, 'W'],
    ['', '', ''],
    ['Assumption', ASSUMPTION, ''],
    ['Verify inputs', INPUT_NOTE, ''],
    ['Planning limitation', LIMITATION, ''],
    ['Methodology version', '1.1', ''],
    ['Source', SOURCE_URL, ''],
  ];
  return rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

/** Export a validated worksheet suitable for copying or saving as plain text. */
export function toSummary(input) {
  const result = exportResult(input);
  const watts = value => value.toLocaleString('en-US', { maximumFractionDigits: 6 });
  return [
    'Backup Generator Guide — Generator Load Worksheet',
    '',
    ...result.plan.loads.map(load => `${load.name}: ${watts(load.runningWatts)} W running; ${watts(load.startingWatts)} W extra starting`),
    '',
    `Total simultaneous running load: ${watts(result.runningWatts)} W`,
    `Largest additional starting event: ${watts(result.largestStartingWatts)} W`,
    `Headroom: ${precision(result.plan.headroom * 100)}%`,
    `Running load + headroom: ${watts(result.continuousWatts)} W (${result.continuousKW.toFixed(2)} kW)`,
    `Starting event + headroom: ${watts(result.requiredWatts)} W (${result.requiredKW.toFixed(2)} kW)`,
    '',
    `Formula: (${watts(result.runningWatts)} W + ${watts(result.largestStartingWatts)} W) × ${precision(1 + result.plan.headroom)} = ${watts(result.requiredWatts)} W`,
    ASSUMPTION,
    INPUT_NOTE,
    LIMITATION,
    `Methodology version 1.1 — ${SOURCE_URL}`,
  ].join('\n');
}
