import { resolve } from 'node:path';

import { FindingReviewService } from '@accessledger/findings';
import { ResidentJourneyService } from '@accessledger/journeys';
import { SqliteReviewRepository } from '@accessledger/persistence';

import { AuditorStudio } from './auditor-studio.js';
import { createAuditorStudioServer } from './server.js';

const databasePath = resolve(process.argv[2] ?? 'accessledger-review.sqlite');
const port = Number.parseInt(process.env.ACCESSLEDGER_AUDITOR_PORT ?? '4178', 10);
const repository = new SqliteReviewRepository(databasePath);
const service = new FindingReviewService(repository);
const journeyService = new ResidentJourneyService(repository);
const studio = new AuditorStudio(service, journeyService);
const server = createAuditorStudioServer(studio);

server.listen(port, '127.0.0.1', () => {
  process.stdout.write(
    `AccessLedger Auditor Studio: http://127.0.0.1:${port}/\nDatabase: ${databasePath}\n`,
  );
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => {
      repository.close();
      process.exit(0);
    });
  });
}
