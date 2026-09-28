import { runFindingsExportCli } from './export-cli.js';

process.exitCode = runFindingsExportCli(process.argv.slice(2));
