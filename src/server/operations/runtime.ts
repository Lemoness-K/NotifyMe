import { Activation, acquireOwnership } from './activation.js';

export async function startManagedRuntime(state: string,
  start: (active: { database: string; epoch: string }) => Promise<() => Promise<void>>) {
  const release = acquireOwnership(state);
  try {
    const stop = await start(await new Activation(state).start());
    return async () => { try { await stop(); } finally { release(); } };
  } catch (error) { release(); throw error; }
}
