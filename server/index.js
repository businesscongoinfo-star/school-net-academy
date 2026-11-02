/**
 * Point d'entrée serveur classique (Node) : `npm start`.
 * En serverless (Vercel), c'est `api/index.js` qui importe `server/app.js`.
 */
import { app, PORT, ready } from './app.js';
import { flush } from './persist.js';
import { persistenceMode } from './persist.js';

await ready;

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✔ School Net Academy — http://localhost:${PORT}`);
  console.log(`  Données   : ${process.env.DB_FILE || 'data/school-net.db'}`);
  console.log(`  Persistance : ${persistenceMode()}`);
});

const shutdown = async () => {
  try { await flush(); } catch { /* ignoré */ }
  server.close(() => process.exit(0));
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
