import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { OPENAPI_SPEC } from '../src/http/openapi.js';

const outputPath = fileURLToPath(new URL('../docs/openapi.json', import.meta.url));
await writeFile(outputPath, `${JSON.stringify(OPENAPI_SPEC, null, 2)}\n`, 'utf8');
console.log(`Wrote ${outputPath}`);
