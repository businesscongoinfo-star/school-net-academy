/**
 * Diagnostic de la plateforme.
 *
 * Conserve en mémoire les derniers appels API (méthode, statut, durée, message
 * d'erreur) et expose un auto-test du chemin d'authentification (lecture de la
 * base, vérification du mot de passe, signature du jeton). Aucun mot de passe,
 * cookie ou corps de requête n'est stocké.
 */

const MAX = 40;
export const recent = [];

export function recordRequest(entry) {
  recent.unshift({ at: new Date().toISOString(), ...entry });
  if (recent.length > MAX) recent.length = MAX;
}

/** Middleware : mesure chaque requête /api et mémorise les échecs. */
export function requestLogger(req, res, next) {
  if (!req.path.startsWith('/api')) return next();
  const started = Date.now();
  res.on('finish', () => {
    recordRequest({
      method: req.method,
      path: req.path,
      status: res.statusCode,
      ms: Date.now() - started,
      contentType: String(res.getHeader('content-type') ?? ''),
      error: res.locals?.errorMessage ? String(res.locals.errorMessage).slice(0, 240) : null,
    });
  });
  next();
}
