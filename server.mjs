import { fileURLToPath } from 'url';
import path from 'path';

// Resolve repo root from this file's location (server.mjs is always at repo root)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Tell the API server exactly where the frontend build output is
process.env.FRONTEND_DIST = path.join(__dirname, 'artifacts/spacex-platform/dist/public');

await import('./artifacts/api-server/dist/index.mjs');
