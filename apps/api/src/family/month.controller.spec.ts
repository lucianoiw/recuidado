import { describe, expect, it } from 'vitest';
import { paymentBody } from './month.controller.js';

const id = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;

describe('paymentBody', () => {
  it('takes the mode and the caregivers in the rotation order', () => {
    const body = paymentBody.parse({
      mode: 'rotation',
      members: [{ id: id(1), excluded: false }, { id: id(2), excluded: true, reason: ' Paga o plano de saúde ' }],
    });
    expect(body.members.map((m) => m.id)).toEqual([id(1), id(2)]);
    expect(body.members[1]!.reason).toBe('Paga o plano de saúde');
  });

  it('refuses the same person twice and an unknown mode', () => {
    expect(paymentBody.safeParse({ mode: 'rotation', members: [{ id: id(1) }, { id: id(1) }] }).success).toBe(false);
    expect(paymentBody.safeParse({ mode: 'pix', members: [] }).success).toBe(false);
  });
});
