import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBrief, parseFridayReview, parseTriageSuggestions } from './phase2.ts';

test('parseBrief accepts fenced JSON and returns the brief shape', () => {
  assert.deepEqual(
    parseBrief('```json\n{"headline":"Protect the engine","focus":["Call client","Review lease"],"risks":["One overdue follow-up"],"nextAction":"Make the first call before 9 AM"}\n```'),
    {
      headline: 'Protect the engine',
      focus: ['Call client', 'Review lease'],
      risks: ['One overdue follow-up'],
      nextAction: 'Make the first call before 9 AM',
    },
  );
});

test('parseTriageSuggestions rejects unsupported destinations', () => {
  assert.throws(
    () => parseTriageSuggestions('{"suggestions":[{"kind":"unknown","title":"Do it"}]}'),
    /invalid triage/i,
  );
});

test('parseFridayReview returns the Friday review shape', () => {
  assert.deepEqual(
    parseFridayReview(
      '{"headline":"Close the gap","summary":"Two invoices need movement.","questions":["Which invoice can be sent today?"],"nextWeek":["Confirm the lease payment"]}',
    ),
    {
      headline: 'Close the gap',
      summary: 'Two invoices need movement.',
      questions: ['Which invoice can be sent today?'],
      nextWeek: ['Confirm the lease payment'],
    },
  );
});
