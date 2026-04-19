const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

function parseJwtPayload(token) {
  try {
    return JSON.parse(
      Buffer.from(token.split('.')[1], 'base64url').toString('utf8'),
    );
  } catch {
    return null;
  }
}

const serviceKeyPayload = parseJwtPayload(supabaseServiceKey);

if (serviceKeyPayload?.role !== 'service_role') {
  console.error(
    `SUPABASE_SERVICE_ROLE_KEY must be a service_role key, but got role="${serviceKeyPayload?.role ?? 'unknown'}".`,
  );
  process.exit(1);
}

// Admin client used for all database operations and should bypass RLS.
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
  db: {
    schema: 'public',
  },
});

// Separate client for token verification so request auth checks never affect
// service-role database operations.
const supabaseAuthVerifier = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

// Separate auth client used for signInWithPassword to keep session state isolated.
const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

module.exports = { supabase, supabaseAuth, supabaseAuthVerifier };
