import { consumeRead, type CounterStore } from './usage-limit.js';

class MemoryStore implements CounterStore {
  counts = new Map<string, number>();
  async get(keys: string[]) {
    return keys.map((k) => this.counts.get(k) ?? 0);
  }
  async hit(keys: string[]) {
    for (const k of keys) this.counts.set(k, (this.counts.get(k) ?? 0) + 1);
  }
}

const limits = { perIp: 2, perFamily: 3, total: 5 };

describe('consumeRead', () => {
  it('allows reads until the IP limit, then blocks that IP only', async () => {
    const store = new MemoryStore();
    expect(await consumeRead(store, limits, { ip: '1.1.1.1' })).toBeNull();
    expect(await consumeRead(store, limits, { ip: '1.1.1.1' })).toBeNull();
    expect(await consumeRead(store, limits, { ip: '1.1.1.1' })).toBe('ip');
    expect(await consumeRead(store, limits, { ip: '2.2.2.2' })).toBeNull();
  });

  it('blocks a family across IPs', async () => {
    const store = new MemoryStore();
    for (const ip of ['a', 'b', 'c']) expect(await consumeRead(store, limits, { ip, familyId: 'f' })).toBeNull();
    expect(await consumeRead(store, limits, { ip: 'd', familyId: 'f' })).toBe('family');
    expect(await consumeRead(store, limits, { ip: 'd' })).toBeNull();
  });

  it('blocks everyone at the total limit and does not count blocked reads', async () => {
    const store = new MemoryStore();
    for (const ip of ['a', 'b', 'c', 'd', 'e']) expect(await consumeRead(store, limits, { ip })).toBeNull();
    expect(await consumeRead(store, limits, { ip: 'f' })).toBe('total');
    expect(store.counts.get('limit:prescription:total')).toBe(5);
  });

  it('does not keep the raw IP', async () => {
    const store = new MemoryStore();
    await consumeRead(store, limits, { ip: '203.0.113.9' });
    expect([...store.counts.keys()].some((k) => k.includes('203.0.113.9'))).toBe(false);
  });

  it('turns a limit off with 0, and all reads off with total 0', async () => {
    const store = new MemoryStore();
    const noIp = { perIp: 0, perFamily: 0, total: 100 };
    for (let i = 0; i < 10; i++) expect(await consumeRead(store, noIp, { ip: 'a', familyId: 'f' })).toBeNull();
    expect(await consumeRead(store, { ...noIp, total: 0 }, { ip: 'a' })).toBe('total');
  });
});
