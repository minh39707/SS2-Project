const { supabase } = require('../supabase');

const AUTH_CACHE_TTL_MS = 60 * 1000;
const authCache = new Map();

function getCachedAuth(token) {
  const cachedEntry = authCache.get(token);

  if (!cachedEntry) {
    return null;
  }

  if (cachedEntry.expiresAt <= Date.now()) {
    authCache.delete(token);
    return null;
  }

  return cachedEntry.user;
}

function cacheAuth(token, user) {
  authCache.set(token, {
    user,
    expiresAt: Date.now() + AUTH_CACHE_TTL_MS,
  });
}

/**
 * Middleware to extract user ID from Authorization header (Bearer token)
 * Fallback to x-user-id header for backward compatibility during transition.
 */
async function extractUserId(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    
    // 1. Try to extract from Bearer token
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const cachedUser = getCachedAuth(token);

      if (cachedUser) {
        req.userId = cachedUser.id;
        req.user = cachedUser;
        return next();
      }
      
      // Verify JWT with Supabase
      const { data: { user }, error } = await supabase.auth.getUser(token);
      
      if (!error && user) {
        cacheAuth(token, user);
        req.userId = user.id;
        req.user = user;
        return next();
      }
    }
    
    // 2. Fallback to old x-user-id header
    const userId = req.headers['x-user-id'];
    req.userId = userId ?? null;
    
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    req.userId = null;
    next();
  }
}

/**
 * Middleware to require a valid user ID.
 */
function requireUser(req, res, next) {
  if (!req.userId) {
    return res.status(401).json({ message: 'Authentication required. Invalid or missing token.' });
  }
  next();
}

module.exports = { extractUserId, requireUser };
