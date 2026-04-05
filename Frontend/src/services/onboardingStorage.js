import AsyncStorage from "@react-native-async-storage/async-storage";

const ONBOARDING_STORAGE_KEY = "habit-app:onboarding-state-v2";
const LEGACY_ONBOARDING_STORAGE_KEY = "habit-app:onboarding-state";
const GUEST_SCOPE = "guest";
let cachedEnvelope = null;
let pendingEnvelopeRead = null;

function buildEmptyEnvelope() {
  return {
    currentScope: GUEST_SCOPE,
    scopes: {},
  };
}

async function readEnvelope() {
  if (cachedEnvelope) {
    return cachedEnvelope;
  }

  if (pendingEnvelopeRead) {
    return pendingEnvelopeRead;
  }

  pendingEnvelopeRead = (async () => {
    const rawValue = await AsyncStorage.getItem(ONBOARDING_STORAGE_KEY);

    if (rawValue) {
      cachedEnvelope = JSON.parse(rawValue);
      return cachedEnvelope;
    }

    const legacyValue = await AsyncStorage.getItem(LEGACY_ONBOARDING_STORAGE_KEY);

    if (!legacyValue) {
      cachedEnvelope = buildEmptyEnvelope();
      return cachedEnvelope;
    }

    cachedEnvelope = {
      currentScope: GUEST_SCOPE,
      scopes: {
        [GUEST_SCOPE]: JSON.parse(legacyValue),
      },
    };

    return cachedEnvelope;
  })();

  try {
    return await pendingEnvelopeRead;
  } finally {
    pendingEnvelopeRead = null;
  }
}

async function writeEnvelope(envelope) {
  await AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(envelope));
  await AsyncStorage.removeItem(LEGACY_ONBOARDING_STORAGE_KEY);
  cachedEnvelope = envelope;
  pendingEnvelopeRead = null;
}

export function getOnboardingScope(userId) {
  return userId ? `user:${userId}` : GUEST_SCOPE;
}

export async function loadCurrentOnboardingScope() {
  const envelope = await readEnvelope();
  return envelope.currentScope ?? GUEST_SCOPE;
}

export async function loadOnboardingState(scope = null) {
  const envelope = await readEnvelope();
  const resolvedScope = scope ?? envelope.currentScope ?? GUEST_SCOPE;
  return envelope.scopes?.[resolvedScope] ?? null;
}

export async function saveOnboardingState(state, scope = null) {
  const envelope = await readEnvelope();
  const resolvedScope = scope ?? envelope.currentScope ?? GUEST_SCOPE;

  envelope.currentScope = resolvedScope;
  envelope.scopes = {
    ...(envelope.scopes ?? {}),
    [resolvedScope]: state,
  };

  await writeEnvelope(envelope);
}

export async function setCurrentOnboardingScope(scope) {
  const envelope = await readEnvelope();
  envelope.currentScope = scope ?? GUEST_SCOPE;
  await writeEnvelope(envelope);
}

export async function clearOnboardingState(scope = null) {
  if (!scope) {
    await AsyncStorage.removeItem(ONBOARDING_STORAGE_KEY);
    await AsyncStorage.removeItem(LEGACY_ONBOARDING_STORAGE_KEY);
    cachedEnvelope = null;
    pendingEnvelopeRead = null;
    return;
  }

  const envelope = await readEnvelope();

  if (envelope.scopes?.[scope]) {
    delete envelope.scopes[scope];
  }

  if (envelope.currentScope === scope) {
    envelope.currentScope = GUEST_SCOPE;
  }

  await writeEnvelope(envelope);
}
