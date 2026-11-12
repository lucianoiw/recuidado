// Pure step logic of a demo run, kept apart from Redis and Postgres so it can be tested.

export type StepState = 'waiting' | 'active' | 'done' | 'skipped' | 'failed';

/** BullMQ job state as `job.getState()` reports it, or null when the job is gone. */
export type JobState = 'waiting' | 'delayed' | 'active' | 'completed' | 'failed' | 'prioritized' | 'waiting-children' | 'unknown' | null;

export interface JobInfo {
  state: JobState;
  /** When a delayed job will run (ms since epoch). */
  runAt: number | null;
  returnValue: unknown;
}

export interface RunFacts {
  dose: {
    status: 'pending' | 'taken' | 'missed';
    confirmedVia: 'app' | 'voice' | null;
    familyAlertedAt: Date | null;
  };
  remind: JobInfo;
  call: JobInfo;
  alert: JobInfo;
  lastCall: { outcome: string } | null;
  /** The family gets calls (paid plan, demo family or included). False: the call is skipped for the plan. */
  callsAllowed?: boolean;
}

export interface Step {
  state: StepState;
  /** When a waiting step is due (ISO). */
  at: string | null;
  /** Short pt-BR detail for the screen. */
  detail: string | null;
}

export interface RunSteps {
  reminder: Step;
  call: Step;
  family: Step;
  /** True when nothing else will happen in this run. */
  finished: boolean;
}

const step = (state: StepState, detail: string | null = null, at: number | null = null): Step => ({
  state,
  detail,
  at: at === null ? null : new Date(at).toISOString(),
});

const OUTCOME_TEXT: Record<string, string> = {
  confirmed: 'Ela confirmou na ligação.',
  not_taken: 'Ela disse que não tomou.',
  unclear: 'Não deu para entender a resposta.',
  no_answer: 'Ela não atendeu.',
  failed: 'A ligação falhou.',
};

export function demoSteps(f: RunFacts): RunSteps {
  const taken = f.dose.status === 'taken';
  const takenText = f.dose.confirmedVia === 'voice' ? 'Ela confirmou na ligação.' : 'Ela tocou em "Tomei".';

  const reminder =
    f.remind.state === 'completed' || f.call.state !== null
      ? step('done', 'Notificação enviada para o celular dela.')
      : f.remind.state === 'failed'
        ? step('failed', 'O lembrete falhou.')
        : step('active', 'Enviando o lembrete.');

  let call: Step;
  if (f.lastCall) {
    call = step('done', OUTCOME_TEXT[f.lastCall.outcome] ?? 'Ligação encerrada.');
  } else if (f.call.state === 'completed') {
    const r = f.call.returnValue;
    call =
      r === 'failed'
        ? step('failed', 'A ligação não saiu.')
        : r === 'skipped'
          ? step(
              'skipped',
              taken ? takenText : f.callsAllowed === false ? 'Ligação é do plano pago, que chega em breve.' : 'Sem telefone cadastrado para ela.',
            )
          : taken
            ? step('done', takenText)
            : step('active', 'Ligando para ela agora.');
  } else if (f.call.state === 'delayed' || f.call.state === 'waiting' || f.call.state === 'prioritized') {
    call = step('waiting', 'Se ela não confirmar, a IA liga.', f.call.runAt);
  } else if (f.call.state === 'active') {
    call = step('active', 'Ligando para ela agora.');
  } else if (taken) {
    call = step('skipped', takenText);
  } else if (f.call.state === 'failed') {
    call = step('failed', 'A ligação não saiu.');
  } else {
    call = step('waiting', 'Esperando o lembrete.');
  }

  let family: Step;
  if (f.dose.familyAlertedAt) {
    family = step('done', 'A família recebeu o aviso no celular.');
  } else if (taken) {
    family = step('skipped', 'Ela tomou, ninguém precisa ser avisado.');
  } else if (f.alert.state === 'delayed') {
    family = step('waiting', 'Se ninguém confirmar, a família é avisada.', f.alert.runAt);
  } else if (f.alert.state === 'failed') {
    family = step('failed', 'O aviso falhou.');
  } else if (f.alert.state === 'waiting' || f.alert.state === 'active' || f.alert.state === 'prioritized') {
    family = step('active', 'Avisando a família.');
  } else {
    family = step('waiting', 'Esperando a ligação.');
  }

  const finished = taken || f.dose.familyAlertedAt !== null || family.state === 'failed';
  return { reminder, call, family, finished };
}
