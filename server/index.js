/**
 * Point d'entrée serveur classique (Node) : `npm start`.
 * En serverless (Vercel), c'est `api/[...path].js` qui importe `server/app.js`.
 */
import { app, PORT } from './app.js';

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✔ School Net Academy — http://localhost:${PORT}`);
  console.log(`  Données : ${process.env.DB_FILE || 'data/school-net.db'}`);
});

const shutdown = () => server.close(() => process.exit(0));
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
