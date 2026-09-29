import { runAssessmentPrepareCli } from './prepare-cli.js';

process.exitCode = runAssessmentPrepareCli(process.argv.slice(2));
