import { describe, expect, it } from 'vitest';
import { caregiverMessage, patientWords } from './voice.service.js';

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
    expect(caregiverMessage('Dona Maria', 'emergency', words)).toContain(
      'Dona Maria disse agora na ligação do remédio: "Eu caí no banheiro.". Por favor, ligue para ela agora.',
    );
    expect(caregiverMessage('Dona Maria', 'still_unwell', 'Ainda dói')).toContain('Liguei de novo para Dona Maria e ela disse: "Ainda dói"');
    expect(caregiverMessage('Dona Maria', 'no_answer')).toContain('ela não atendeu');
  });

  it('falls back to the note when there is no transcript', () => {
    expect(patientWords({ transcript: [], note: 'Caiu' })).toBe('Caiu');
    expect(patientWords({ transcript: [] })).toBeUndefined();
  });
});
