import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COMMON_LOADS,
  DEFAULT_HEADROOM,
  EXAMPLE_LOADS,
  LIMITS,
  PlanValidationError,
  calculatePlan,
  normalizePlan,
  toCSV,
  toSummary,
  validatePlan,
} from '../extension/calculator.js';

const load = (overrides = {}) => ({
  id: 'load-1',
  name: 'Verified refrigerator',
  runningWatts: 700,
  startingWatts: 1200,
  ...overrides,
});
const plan = (loads = [load()], headroom = DEFAULT_HEADROOM) => ({ schemaVersion: 1, loads, headroom });

test('the live worked example retains watts and separates continuous output from one start event', () => {
  const result = calculatePlan(EXAMPLE_LOADS, 0.15);
  assert.equal(result.valid, true);
  assert.equal(result.runningWatts, 6400);
  assert.equal(result.largestStartingWatts, 3000);
  assert.equal(result.requiredWatts, 10810);
  assert.equal(result.continuousWatts, 7360);
  assert.equal(result.requiredKW, 10.81);
  assert.equal(result.continuousKW, 7.36);
  assert.equal(result.plan.schemaVersion, 1);
  assert.equal('suggestedClass' in result, false);
});

test('only the largest EXTRA start is added, including extra values below running demand', () => {
  const result = calculatePlan([
    load({ id: 'ac', runningWatts: 3500, startingWatts: 3000 }),
    load({ id: 'pump', runningWatts: 1200, startingWatts: 2500 }),
    load({ id: 'refrigerator', runningWatts: 700, startingWatts: 1200 }),
  ], 0);
  assert.equal(result.runningWatts, 5400);
  assert.equal(result.requiredWatts, 8400);
  assert.equal(result.continuousWatts, 5400);
  assert.notEqual(result.requiredWatts, 12100);
});

test('headroom changes both output allowances while retaining the entered loads', () => {
  const loads = [load({ runningWatts: 1000, startingWatts: 500 })];
  for (const [headroom, required, continuous] of [[0.1, 1650, 1100], [0.15, 1725, 1150], [0.2, 1800, 1200], [0.25, 1875, 1250]]) {
    const result = calculatePlan(loads, headroom);
    assert.equal(result.requiredWatts, required);
    assert.equal(result.continuousWatts, continuous);
    assert.deepEqual(result.plan.loads, loads);
  }
  assert.equal(calculatePlan(loads).requiredWatts, 1725);
});

test('numeric form strings normalize into a fresh schema without mutating inputs or presets', () => {
  const input = plan([load({ id: 7, name: '  Refrigerator  ', runningWatts: '700', startingWatts: '0' })], '0.15');
  const before = structuredClone(input);
  const normalized = normalizePlan(input);
  assert.deepEqual(input, before);
  assert.deepEqual(normalized, plan([load({ id: '7', name: 'Refrigerator', startingWatts: 0 })]));
  normalized.loads[0].name = 'Edited';
  assert.equal(input.loads[0].name, '  Refrigerator  ');
  assert.equal(Object.isFrozen(EXAMPLE_LOADS), true);
  assert.equal(Object.isFrozen(EXAMPLE_LOADS[0]), true);
  assert.equal(Object.isFrozen(COMMON_LOADS), true);
  assert.equal(COMMON_LOADS.length, 12);
});

test('blank or missing wattage is invalid rather than converted into a verified zero', () => {
  for (const field of ['runningWatts', 'startingWatts']) {
    for (const value of ['', '  ', null, undefined, false, true, [], {}]) {
      const result = calculatePlan([load({ [field]: value })]);
      assert.equal(result.valid, false, `${field}: ${String(value)}`);
      assert.equal(result.runningWatts, null);
      assert.equal(result.requiredWatts, null);
      assert.equal(result.continuousKW, null);
      assert.ok(result.errors.some(error => error.field === field && error.index === 0 && error.loadId === 'load-1'));
    }
  }
  assert.equal(calculatePlan([load({ startingWatts: '0' })]).valid, true);
});

test('negative, fractional, nonfinite and out-of-range watts cannot produce estimates or exports', () => {
  const invalidValues = [-1, 0.1, NaN, Infinity, -Infinity, 1_000_001, 'Infinity', '1e309', '0x10', '1,200'];
  for (const field of ['runningWatts', 'startingWatts']) {
    for (const value of invalidValues) {
      const invalid = plan([load({ [field]: value })]);
      assert.equal(validatePlan(invalid).valid, false, `${field}: ${String(value)}`);
      assert.throws(() => toCSV(invalid), PlanValidationError);
      assert.throws(() => toSummary(invalid), PlanValidationError);
    }
  }
});

test('an empty plan or an all-zero running plan cannot yield a sizing recommendation', () => {
  assert.equal(calculatePlan([], 0.15).valid, false);
  assert.equal(calculatePlan([load({ runningWatts: 0, startingWatts: 3000 })], 0.15).valid, false);
  assert.equal(calculatePlan([
    load({ id: 'off', runningWatts: 0, startingWatts: 0 }),
    load({ id: 'on', runningWatts: 1, startingWatts: 0 }),
  ], 0).requiredWatts, 1);
});

test('names, row identifiers and list limits protect stored worksheets', () => {
  for (const name of ['', ' ', '\u200b\u2060', undefined, 'a'.repeat(121), 'Name\nInjected row', 'Name\u0000']) {
    assert.equal(validatePlan(plan([load({ name })])).valid, false);
  }
  assert.equal(validatePlan(plan([load({ name: 'a'.repeat(120) })])).valid, true);
  assert.equal(validatePlan(plan([load(), load()])).valid, false);
  assert.equal(validatePlan(plan([load({ id: '' })])).valid, false);
  assert.equal(validatePlan(plan([null])).valid, false);
  assert.equal(validatePlan(plan(new Array(101).fill(load()))).valid, false);
  assert.equal(validatePlan(plan('not an array')).valid, false);
});

test('unsupported or malformed stored schemas are rejected without guessing missing data', () => {
  for (const input of [null, [], 'text', {}, { ...plan(), schemaVersion: 2 }, { ...plan(), schemaVersion: '1' }]) {
    assert.equal(validatePlan(input).valid, false);
    assert.throws(() => normalizePlan(input), PlanValidationError);
  }
  const input = { ...plan(), unknown: 'discard', loads: [load({ extra: 'discard' })] };
  assert.deepEqual(normalizePlan(input), plan());
});

test('headroom rejects empty, negative, nonfinite and unreasonable saved values', () => {
  for (const headroom of ['', null, undefined, false, -0.1, 1.01, NaN, Infinity, 'unknown']) {
    assert.equal(validatePlan({ ...plan(), headroom }).valid, false, String(headroom));
  }
  assert.equal(validatePlan(plan([load()], 0)).valid, true);
  assert.equal(validatePlan(plan([load()], 1)).valid, true);
});

test('the documented maximum remains finite and accurate without accepting oversized load lists', () => {
  const loads = Array.from({ length: LIMITS.maxLoads }, (_, index) => load({
    id: `load-${index}`,
    runningWatts: LIMITS.maxWattsPerLoad,
    startingWatts: LIMITS.maxWattsPerLoad,
  }));
  const result = calculatePlan(loads, 1);
  assert.equal(result.valid, true);
  assert.equal(result.runningWatts, 100_000_000);
  assert.equal(result.requiredWatts, 202_000_000);
  assert.equal(result.continuousWatts, 200_000_000);
  assert.equal(Number.isFinite(result.requiredWatts), true);
});

test('CSV preserves entered watts, escaped quotes, units, formula and limitations', () => {
  const csv = toCSV(plan([load({ name: 'Garage "A", west' })], 0.2));
  assert.ok(csv.startsWith('"Load / appliance","Running watts (W)","Extra starting watts (W)"\r\n'));
  assert.ok(csv.includes('"Garage ""A"", west","700","1200"\r\n'));
  assert.ok(csv.includes('"Running load + headroom","840","W"'));
  assert.ok(csv.includes('"Starting event + headroom","2280","W"'));
  assert.ok(csv.includes('"Headroom","20","%"'));
  assert.ok(csv.includes('only one motor starts at a time'));
  assert.ok(csv.includes('not a generator model recommendation'));
  assert.ok(csv.endsWith('\r\n'));
  assert.equal(csv.replaceAll('\r\n', '').includes('\n'), false);
});

test('CSV neutralizes all formula operators even after unusual Unicode prefixes', () => {
  const prefixes = ['', ' ', '\t', '\r', '\u00a0', '\u2003', '\u200b', '\u200b\ufeff', '\u180e', '\u2060', '\u202e'];
  for (const prefix of prefixes) {
    for (const formula of ['=1+1', '+SUM(1,2)', '-1+1', '@SUM(1,2)']) {
      const input = plan([load({ name: `${prefix}${formula}` })]);
      const normalizedName = normalizePlan(input).loads[0].name;
      const csv = toCSV(input);
      assert.ok(csv.includes(`"'${normalizedName}","700","1200"`), `${JSON.stringify(prefix)} ${formula}`);
    }
  }
});

test('plain-text summaries explain starting demand, verified zeros and the separate estimates', () => {
  const summary = toSummary(plan(EXAMPLE_LOADS));
  assert.ok(summary.includes('Total simultaneous running load: 6,400 W'));
  assert.ok(summary.includes('Largest additional starting event: 3,000 W'));
  assert.ok(summary.includes('Running load + headroom: 7,360 W (7.36 kW)'));
  assert.ok(summary.includes('Starting event + headroom: 10,810 W (10.81 kW)'));
  assert.ok(summary.includes('(6,400 W + 3,000 W) × 1.15 = 10,810 W'));
  assert.ok(summary.includes('Illustrative examples are not universal appliance ratings'));
  assert.ok(summary.includes('Zero extra starting watts means no additional starting demand has been verified'));
  assert.ok(summary.includes('Methodology version 1.1'));
  assert.ok(summary.includes('https://backupgeneratorguide.com/tools/generator-size-calculator/'));
});

test('exports always recompute the inputs rather than trusting stale or injected derived values', () => {
  const input = { ...plan(), requiredWatts: 1, continuousWatts: 1, valid: true };
  assert.ok(toCSV(input).includes('"Starting event + headroom","2185","W"'));
  assert.ok(toSummary(input).includes('Starting event + headroom: 2,185 W'));
  const invalid = { ...input, loads: [load({ runningWatts: '' })] };
  assert.throws(() => toCSV(invalid), PlanValidationError);
  assert.throws(() => toSummary(invalid), PlanValidationError);
});
