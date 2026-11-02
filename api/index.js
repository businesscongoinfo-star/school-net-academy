import app, { ready } from '../server/app.js';

/**
 * Point d'entrée serverless Vercel : on attend la fin du démarrage (restauration
 * de l'instantané Supabase, migration, compte super administrateur) avant de
 * confier la requête à l'application Express.
 */
export default async function handler(req, res) {
  await ready;
  return app(req, res);
}
