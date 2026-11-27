import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { Ledger } from './ledger.js';
import { openPortal } from './portal.js';
import { createApp } from './app.js';

const dataDir = process.env.DATA_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
const ledger = new Ledger(dataDir);
const portal = await openPortal(dataDir, config.mongoUri);
const app = createApp({ ledger, portal, config });

app.listen(config.port, () => {
  console.log(`CoreVista bridge  http://localhost:${config.port}`);
  console.log('Region DB2P  branch 0142  runtime lab-bridge');
});
