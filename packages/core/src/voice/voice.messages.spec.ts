import { describe, expect, it } from 'vitest';
import { caregiverMessage, contactsAfter, missedDoseMessage, NAME_SLOT, namesList, patientWords, quoted, reported } from './voice.service.js';

describe('emergency messages', () => {
  it('passes her own words to the first contact and asks to call her', () => {
    const words = patientWords({
      transcript: [
        { speaker: 'assistant', text: 'Como a senhora está?' },
        { speaker: 'patient', text: 'Eu caí no banheiro.' },
      ],
      note: 'Caiu',
    });
    expect(words).toBe('Eu caí no banheiro.');
    expect(caregiverMessage('Dona Maria', 'emergency', reported('Caiu no banheiro.'))).toBe(
      'Olá, aqui é a assistente virtual da Recuidado. Eu conversei com Dona Maria e ela falou que caiu no banheiro. Seria interessante você ligar para ela agora. Se for grave, ligue para o SAMU, 192.',
    );
    expect(caregiverMessage('Dona Maria', 'still_unwell', 'ainda está com dor')).toContain('Liguei de novo para Dona Maria e ela falou que ainda está com dor.');
    expect(caregiverMessage('Dona Maria', 'emergency')).toContain('ela falou que não está se sentindo bem.');
    expect(caregiverMessage('Dona Maria', 'no_answer')).toContain('ela não atendeu. Seria interessante você ligar para ela agora. Se for grave, ligue para o SAMU, 192.');
    expect(caregiverMessage('Seu João', 'no_answer', undefined, 'male')).toContain('Seu João e ele não atendeu. Seria interessante você ligar para ele agora.');
  });

  it('retells the note in the third person', () => {
    expect(reported('Ela disse que caiu no banheiro.')).toBe('caiu no banheiro');
    expect(reported('Está com dor no peito')).toBe('está com dor no peito');
    expect(reported('  ')).toBeUndefined();
  });

  it('never ends a quote with a doubled period', () => {
    expect(quoted('Caí no banheiro.')).toBe('"Caí no banheiro"');
    expect(quoted('Tá doendo?')).toBe('"Tá doendo?"');
  });

  it('falls back to the note when there is no transcript', () => {
    expect(patientWords({ transcript: [], note: 'Caiu' })).toBe('Caiu');
    expect(patientWords({ transcript: [] })).toBeUndefined();
  });
});

describe('emergency call order', () => {
  const carlos = { id: 'c', name: 'Carlos' };
  const ana = { id: 'a', name: 'Ana' };
  const pedro = { id: 'p', name: 'Pedro' };

  it('starts with the first contact and moves to the next one who did not hear', () => {
    expect(contactsAfter([carlos, ana, pedro])).toEqual([carlos, ana, pedro]);
    expect(contactsAfter([carlos, ana, pedro], 'c')).toEqual([ana, pedro]);
    expect(contactsAfter([carlos, ana, pedro], 'p')).toEqual([]);
  });

  it('stops when the caregiver left the family meanwhile', () => {
    expect(contactsAfter([carlos, ana], 'gone')).toEqual([]);
  });

  it('lists names the way people say them', () => {
    expect(namesList(['Carlos'])).toBe('Carlos');
    expect(namesList(['Carlos', 'Ana'])).toBe('Carlos e Ana');
    expect(namesList(['Carlos', 'Ana', 'Pedro'])).toBe('Carlos, Ana e Pedro');
  });
});

describe('missed dose call', () => {
  it('is calm, has no SAMU and leaves a slot for each caregiver name', () => {
    const m = missedDoseMessage('Dona Maria', 'no_answer');
    expect(m).toBe(
      `Olá, ${NAME_SLOT}, tudo bem? Aqui é da Recuidado. Tentei falar com Dona Maria e não consegui contato. Por favor, tente entrar em contato com ela. Obrigado.`,
    );
    expect(m).not.toMatch(/SAMU|192|urgente/);
    expect(m.replace(NAME_SLOT, 'Carlos')).toMatch(/^Olá, Carlos, tudo bem\?/);
  });

  it('says she has not taken it yet when she answered the second call', () => {
    expect(missedDoseMessage('Seu João', 'not_taken', 'male')).toMatch(/Falei com Seu João e ele ainda não tomou o medicamento\. Por favor, tente entrar em contato com ele\./);
  });
});
