import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { INITIAL_ONBOARDING_DATA } from "@/src/constants/onboarding";
import {
  completeOAuthRedirect,
  saveHabitToServer,
  signInWithEmail,
  signInWithFacebook,
  signInWithGitHub,
  signInWithGoogle,
  signOutAccount,
  signUpWithEmail,
} from "@/src/services/onboardingApi";
import {
  getOnboardingScope,
  loadCurrentOnboardingScope,
  loadOnboardingState,
  saveOnboardingState,
  setCurrentOnboardingScope,
} from "@/src/services/onboardingStorage";
import {
  getDefaultTimeForPeriod,
  isOnboardingReadyForSave,
} from "@/src/utils/onboarding";
const initialPersistedState = {
  data: INITIAL_ONBOARDING_DATA,
  onboardingCompleted: false,
  completed: false,
  authMethod: null,
  userProfile: null,
  hasCustomTime: false,
  lastUpdatedAt: null,
};

function normalizePersistedState(persistedState) {
  return {
    ...initialPersistedState,
    ...persistedState,
    data: {
      ...INITIAL_ONBOARDING_DATA,
      ...(persistedState?.data ?? {}),
    },
    onboardingCompleted:
      persistedState?.onboardingCompleted ?? persistedState?.completed ?? false,
    completed: persistedState?.completed ?? false,
    authMethod: persistedState?.authMethod ?? null,
    userProfile: persistedState?.userProfile ?? persistedState?.account ?? null,
    hasCustomTime: persistedState?.hasCustomTime ?? false,
    lastUpdatedAt: persistedState?.lastUpdatedAt ?? null,
  };
}

function hasMeaningfulDraft(state) {
  if (!state) {
    return false;
  }
  return (
    JSON.stringify(state.data ?? INITIAL_ONBOARDING_DATA) !==
      JSON.stringify(INITIAL_ONBOARDING_DATA) ||
    !!state.onboardingCompleted ||
    !!state.hasCustomTime
  );
}

function shouldCarryGuestDraftIntoAccount(
  currentScope,
  nextScope,
  currentState,
) {
  return currentScope !== nextScope && hasMeaningfulDraft(currentState);
}

const OnboardingContext = createContext(null);
export function OnboardingProvider({ children }) {
  const [persistedState, setPersistedState] = useState(initialPersistedState);
  const [storageScope, setStorageScope] = useState(getOnboardingScope(null));
  const [hydrated, setHydrated] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const oauthCompletionRef = useRef(null);
  useEffect(() => {
    let isMounted = true;
    const hydrate = async () => {
      try {
        const savedScope = await loadCurrentOnboardingScope();
        const savedState = await loadOnboardingState(savedScope);
        if (savedState && isMounted) {
          setPersistedState(normalizePersistedState(savedState));
        }
        if (isMounted) {
          setStorageScope(savedScope);
        }
      } catch (error) {
        if (__DEV__) {
          console.warn("Failed to hydrate onboarding state", error);
        }
      } finally {
        if (isMounted) {
          setHydrated(true);
        }
      }
    };
    void hydrate();
    return () => {
      isMounted = false;
    };
  }, []);
  useEffect(() => {
    if (!hydrated) {
      return;
    }
    void saveOnboardingState(
      {
        ...persistedState,
        lastUpdatedAt: new Date().toISOString(),
      },
      storageScope,
    );
  }, [hydrated, persistedState, storageScope]);
  const updateData = useCallback((updater) => {
    setPersistedState((current) => updater(current));
  }, []);
  const setLifeArea = (option) => {
    setSaveError(null);
    updateData((current) => ({
      ...current,
      data: {
        ...current.data,
        life_area: option.value,
        life_area_label: option.label,
      },
    }));
  };
  const setHabitSelection = (habitName, habitType) => {
    setSaveError(null);
    updateData((current) => ({
      ...current,
      data: {
        ...current.data,
        habit_name: habitName,
        habit_type: habitType,
      },
    }));
  };
  const setTimePeriod = (period) => {
    setSaveError(null);
    updateData((current) => ({
      ...current,
      data: {
        ...current.data,
        time_period: period,
        time_exact: current.hasCustomTime
          ? current.data.time_exact
          : getDefaultTimeForPeriod(period),
      },
    }));
  };
  const setTimeExact = (time) => {
    setSaveError(null);
    updateData((current) => ({
      ...current,
      hasCustomTime: true,
      data: {
        ...current.data,
        time_exact: time,
      },
    }));
  };
  const setFrequency = (frequency) => {
    setSaveError(null);
    updateData((current) => ({
      ...current,
      data: {
        ...current.data,
        frequency,
        specific_days:
          frequency === "specific_days" ? current.data.specific_days : [],
      },
    }));
  };
  const toggleSpecificDay = (day) => {
    setSaveError(null);
    updateData((current) => {
      const exists = current.data.specific_days.includes(day);
      const specific_days = exists
        ? current.data.specific_days.filter((item) => item !== day)
        : [...current.data.specific_days, day];
      return {
        ...current,
        data: {
          ...current.data,
          specific_days,
        },
      };
    });
  };
  const clearSaveError = () => {
    setSaveError(null);
  };
  const updateUserProfile = useCallback((profileUpdates) => {
    updateData((current) => ({
      ...current,
      userProfile: current.userProfile
        ? {
            ...current.userProfile,
            ...profileUpdates,
          }
        : profileUpdates,
    }));
  }, [updateData]);
  const completeGettingStarted = () => {
    setSaveError(null);
    updateData((current) => ({
      ...current,
      onboardingCompleted: true,
    }));
  };
  const persistAuthenticatedProfile = async (profile, method) => {
    const nextScope = getOnboardingScope(profile.id);
    const savedScopedState = normalizePersistedState(
      await loadOnboardingState(nextScope),
    );
    const shouldCarryGuestDraft = shouldCarryGuestDraftIntoAccount(
      storageScope,
      nextScope,
      persistedState,
    );
    const isSameAccountScope = storageScope === nextScope;
    const baseState =
      isSameAccountScope || shouldCarryGuestDraft
        ? persistedState
        : savedScopedState;
    const nextHabitData = baseState.data;
    const nextState = {
      ...baseState,
      onboardingCompleted:
        baseState.onboardingCompleted ||
        isOnboardingReadyForSave(nextHabitData.habit_name),
      completed: true,
      authMethod: method,
      userProfile: profile,
    };

    // Only migrate the current guest draft into the authenticated account once.
    // Re-logging into an existing account should reuse its stored state without
    // silently re-syncing an old onboarding habit back to the backend.
    if (
      shouldCarryGuestDraft &&
      isOnboardingReadyForSave(nextHabitData.habit_name)
    ) {
      try {
        await saveHabitToServer(profile.id, nextHabitData, profile.accessToken);
      } catch (error) {
        if (__DEV__) {
          console.warn("Habit sync failed after sign in", error);
        }
      }
    }

    setStorageScope(nextScope);
    setPersistedState(nextState);
    await setCurrentOnboardingScope(nextScope);
  };
  const runSharedOAuthFlow = async (factory) => {
    if (oauthCompletionRef.current) {
      return oauthCompletionRef.current;
    }

    const promise = (async () => {
      try {
        return await factory();
      } finally {
        oauthCompletionRef.current = null;
      }
    })();

    oauthCompletionRef.current = promise;
    return promise;
  };
  const authenticate = async (payload) => {
    setIsSaving(true);
    setSaveError(null);
    try {
      let profile;
      if (payload.method === "google") {
        profile = await runSharedOAuthFlow(async () => {
          const oauthProfile = await signInWithGoogle();
          await persistAuthenticatedProfile(oauthProfile, payload.method);
          return oauthProfile;
        });
      } else if (payload.method === "facebook") {
        profile = await runSharedOAuthFlow(async () => {
          const oauthProfile = await signInWithFacebook();
          await persistAuthenticatedProfile(oauthProfile, payload.method);
          return oauthProfile;
        });
      } else if (payload.method === "github") {
        profile = await runSharedOAuthFlow(async () => {
          const oauthProfile = await signInWithGitHub();
          await persistAuthenticatedProfile(oauthProfile, payload.method);
          return oauthProfile;
        });
      } else if (payload.mode === "signUp") {
        profile = await signUpWithEmail(payload.payload);
        await persistAuthenticatedProfile(profile, payload.method);
      } else {
        profile = await signInWithEmail(payload.payload);
        await persistAuthenticatedProfile(profile, payload.method);
      }
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "Something went wrong while signing you in.",
      );
      throw error;
    } finally {
      setIsSaving(false);
    }
  };
  const completeOAuthAuthentication = async (redirectUrl) => {
    setIsSaving(true);
    setSaveError(null);
    try {
      const profile = await runSharedOAuthFlow(async () => {
        const oauthProfile = await completeOAuthRedirect(redirectUrl);
        await persistAuthenticatedProfile(
          oauthProfile,
          oauthProfile.authMethod ?? "oauth",
        );
        return oauthProfile;
      });
      return profile;
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "Something went wrong while signing you in.",
      );
      throw error;
    } finally {
      setIsSaving(false);
    }
  };
  const resetOnboarding = async () => {
    try {
      await signOutAccount();
    } catch (error) {
      if (__DEV__) {
        console.warn("Failed to sign out from Supabase", error);
      }
    }
    const guestScope = getOnboardingScope(null);
    setStorageScope(guestScope);
    setPersistedState(initialPersistedState);
    setSaveError(null);
    await setCurrentOnboardingScope(guestScope);
  };
  const value = {
    data: persistedState.data,
    hydrated,
    onboardingCompleted: persistedState.onboardingCompleted,
    completed: persistedState.completed,
    authMethod: persistedState.authMethod,
    userProfile: persistedState.userProfile,
    isSaving,
    saveError,
    hasCustomTime: persistedState.hasCustomTime,
    updateUserProfile,
    setLifeArea,
    setHabitSelection,
    setTimePeriod,
    setTimeExact,
    setFrequency,
    toggleSpecificDay,
    clearSaveError,
    completeGettingStarted,
    authenticate,
    completeOAuthAuthentication,
    resetOnboarding,
  };
  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
}
export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error("useOnboarding must be used within an OnboardingProvider.");
  }
  return context;
}
