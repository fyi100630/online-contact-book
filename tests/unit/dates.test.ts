import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addDays, daysBetween, deadline, isActiveOn, isValidDateStr, startOfWeek, todayIn, weekday } from '../../src/lib/shared/dates.ts';

test('isValidDateStr rejects malformed and impossible dates', () => {
  assert.ok(isValidDateStr('2026-11-02'));
  assert.ok(isValidDateStr('2028-02-29'));
  for (const bad of ['2026-02-30', '2027-02-29', '2026-13-01', '2026-1-1', '26-11-02', '', null, 20261102, "2026-11-02' or 1=1", '1999-12-31']) {
    assert.equal(isValidDateStr(bad), false, String(bad));
  }
});

test('date arithmetic crosses months, years and DST-free', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(daysBetween('2026-11-02', '2026-11-09'), 7);
  assert.equal(daysBetween('2026-11-09', '2026-11-02'), -7);
});

test('weeks start on Monday', () => {
  assert.equal(weekday('2026-11-02'), 1);
  assert.equal(startOfWeek('2026-11-02'), '2026-11-02');
  assert.equal(startOfWeek('2026-11-08'), '2026-11-02'); // Sunday belongs to the week before
  assert.equal(startOfWeek('2026-11-04'), '2026-11-02');
});

test('entries with a due date show from entry date until the day before', () => {
  const e = { entryDate: '2026-11-02', dueDate: '2026-11-05' };
  assert.equal(isActiveOn(e, '2026-11-01'), false);
  assert.equal(isActiveOn(e, '2026-11-02'), true);
  assert.equal(isActiveOn(e, '2026-11-04'), true);
  assert.equal(isActiveOn(e, '2026-11-05'), false);
  const once = { entryDate: '2026-11-02', dueDate: null };
  assert.equal(isActiveOn(once, '2026-11-02'), true);
  assert.equal(isActiveOn(once, '2026-11-03'), false);
});

test('deadline labels', () => {
  assert.equal(deadline(null, '2026-11-02'), null);
  assert.equal(deadline('2026-11-03', '2026-11-02')?.tone, 'tomorrow');
  assert.equal(deadline('2026-11-04', '2026-11-02')?.tone, 'soon');
  assert.equal(deadline('2026-11-20', '2026-11-02')?.tone, 'later');
  assert.equal(deadline('2026-11-01', '2026-11-02')?.tone, 'past');
});

test('todayIn uses the configured timezone, not the server clock', () => {
  assert.match(todayIn('Asia/Taipei'), /^\d{4}-\d{2}-\d{2}$/);
});
