import type Anthropic from '@anthropic-ai/sdk';
import { readDoseTranscript } from './dose-transcript-reader.js';

function fakeClient(json: unknown) {
  const create = vi.fn().mockResolvedValue({ content: [{ type: 'text', text: JSON.stringify(json) }] });
  return { client: { beta: { messages: { create } } } as unknown as Anthropic, create };
}

describe('readDoseTranscript', () => {
  it('reads taken and how she feels, and sends the transcript', async () => {
    const { client, create } = fakeClient({ taken: 'yes', feels_unwell: 'no', emergency: false, note: 'já tomou e está bem' });
    const reading = await readDoseTranscript(client, [
      { speaker: 'assistant', text: 'A senhora já tomou a Losartana?' },
      { speaker: 'patient', text: 'Tomei sim, tô bem' },
    ]);
    expect(reading).toEqual({ taken: true, feelsUnwell: false, emergency: false, note: 'já tomou e está bem' });
    expect(create.mock.calls[0][0].messages[0].content).toContain('Paciente: Tomei sim, tô bem');
  });

  it('unknown stays unknown, so an unclear call is never reported as unwell', async () => {
    const { client } = fakeClient({ taken: 'unknown', feels_unwell: 'unknown', emergency: false, note: '' });
    const reading = await readDoseTranscript(client, [{ speaker: 'patient', text: 'alô?' }], { checkIn: true });
    expect(reading).toEqual({ taken: undefined, feelsUnwell: undefined, emergency: false, note: undefined });
  });

  it('an emergency counts as unwell; a call back never reads taken', async () => {
    const { client } = fakeClient({ taken: 'yes', feels_unwell: 'unknown', emergency: true, note: 'caiu de novo' });
    const reading = await readDoseTranscript(client, [{ speaker: 'patient', text: 'caí de novo' }], { checkIn: true });
    expect(reading).toEqual({ taken: undefined, feelsUnwell: true, emergency: true, note: 'caiu de novo' });
  });
});
