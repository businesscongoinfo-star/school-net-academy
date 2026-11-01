/**
 * Fonction serverless Vercel : toute requête /api/* est traitée par l'application Express.
 * La base SQLite vit dans /tmp (recréée et remplie au démarrage à froid de l'instance).
 */
import app from '../server/app.js';

export default app;
