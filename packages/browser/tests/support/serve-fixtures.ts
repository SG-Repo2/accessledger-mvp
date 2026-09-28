import { startFixtureServer } from './fixture-server.js';

const server = await startFixtureServer();
process.stdout.write(`AccessLedger fixtures: ${server.origin}\n`);

async function shutdown(): Promise<void> {
  await server.close();
  process.exitCode = 0;
}

process.once('SIGINT', () => void shutdown());
process.once('SIGTERM', () => void shutdown());
