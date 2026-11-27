import { readFileSync } from 'node:fs';
import { runUpdateJob } from '../lib/update-manager.mjs';
try{await runUpdateJob(JSON.parse(readFileSync(process.argv[2],'utf8')));}
catch{process.exitCode=1;}
