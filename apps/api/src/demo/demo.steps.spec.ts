import { demoSteps, type JobInfo, type RunFacts } from './demo.steps.js';

const gone: JobInfo = { state: null, runAt: null, returnValue: undefined };
const done = (returnValue?: unknown): JobInfo => ({ state: 'completed', runAt: null, returnValue });
const delayed = (runAt: number): JobInfo => ({ state: 'delayed', runAt, returnValue: undefined });
const pending = { status: 'pending' as const, confirmedVia: null, familyAlertedAt: null };

function facts(over: Partial<RunFacts>): RunFacts {
  return { dose: pending, remind: gone, call: gone, alert: gone, lastCall: null, ...over };
}

describe('demoSteps', () => {
  it('starts with the reminder being sent', () => {
    const s = demoSteps(facts({ remind: { state: 'waiting', runAt: null, returnValue: undefined } }));
    expect(s.reminder.state).toBe('active');
    expect(s.call.state).toBe('waiting');
    expect(s.finished).toBe(false);
  });

  it('waits for the call after the reminder', () => {
    const s = demoSteps(facts({ remind: done(), call: delayed(Date.UTC(2026, 10, 11, 12)), alert: delayed(0) }));
    expect(s.reminder.state).toBe('done');
    expect(s.call).toMatchObject({ state: 'waiting', at: '2026-11-11T12:00:00.000Z' });
    expect(s.family.state).toBe('waiting');
  });

  it('shows the call ringing until the voice result arrives', () => {
    const s = demoSteps(facts({ remind: done(), call: done('called'), alert: delayed(0) }));
    expect(s.call.state).toBe('active');
  });

  it('ends with the family alerted after an unanswered call', () => {
    const s = demoSteps(
      facts({
        dose: { status: 'missed', confirmedVia: null, familyAlertedAt: new Date() },
        remind: done(),
        call: done('called'),
        alert: done(),
        lastCall: { outcome: 'no_answer' },
      }),
    );
    expect(s.call).toMatchObject({ state: 'done', detail: 'Ela não atendeu.' });
    expect(s.family.state).toBe('done');
    expect(s.finished).toBe(true);
  });

  it('skips the call and the alert when she taps "Tomei"', () => {
    const s = demoSteps(facts({ dose: { status: 'taken', confirmedVia: 'app', familyAlertedAt: null }, remind: done() }));
    expect(s.call.state).toBe('skipped');
    expect(s.family.state).toBe('skipped');
    expect(s.finished).toBe(true);
  });

  it('marks a call that could not be placed', () => {
    const s = demoSteps(facts({ remind: done(), call: done('failed'), alert: delayed(0) }));
    expect(s.call.state).toBe('failed');
    expect(s.family.state).toBe('waiting');
  });

  it('says the call is the paid plan when the family has no calls', () => {
    const s = demoSteps(facts({ remind: done(), call: done('skipped'), alert: delayed(0), callsAllowed: false }));
    expect(s.call).toMatchObject({ state: 'skipped', detail: 'Ligação é do plano pago, que chega em breve.' });
  });
});
