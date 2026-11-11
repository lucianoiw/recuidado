import { describe, expect, it } from 'vitest';
import { caregiverMessage, patientWords, quoted, reported } from './voice.service.js';

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
