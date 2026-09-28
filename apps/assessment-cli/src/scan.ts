import { runScanCli } from './scan-cli.js';

process.exitCode = await runScanCli(process.argv.slice(2));
