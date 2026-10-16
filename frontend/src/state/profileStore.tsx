// Browser-local dietary profile (Section 6.2). Saved in localStorage on this
// device only; it is never sent to the backend or any external service.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { DietStyle, Profile } from "@shared/contracts";

const STORAGE_KEY = "labellens.profile.v1";

export const EMPTY_PROFILE: Profile = {
  schema_version: "1",
  allergens: [],
  custom_avoid: [],
  diet: "none",
};

/** Presentation labels for the nine allergen preset keys (contract 6.2). */
export const ALLERGEN_PRESETS: { key: string; label: string }[] = [
  { key: "milk", label: "Milk" },
  { key: "egg", label: "Egg" },
  { key: "peanut", label: "Peanut" },
  { key: "tree_nut", label: "Tree nuts" },
  { key: "wheat_gluten", label: "Wheat / gluten" },
  { key: "soy", label: "Soy" },
  { key: "sesame", label: "Sesame" },
  { key: "fish", label: "Fish" },
  { key: "shellfish", label: "Shellfish" },
];

export const DIET_OPTIONS: { value: DietStyle; label: string; hint: string }[] =
  [
    { value: "none", label: "No diet preference", hint: "" },
    { value: "vegetarian", label: "Vegetarian", hint: "avoid meat and fish" },
    { value: "vegan", label: "Vegan", hint: "avoid all animal-derived foods" },
  ];

export function isValidProfile(value: unknown): value is Profile {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    v.schema_version === "1" &&
    Array.isArray(v.allergens) &&
    v.allergens.every((x) => typeof x === "string") &&
    Array.isArray(v.custom_avoid) &&
    v.custom_avoid.every((x) => typeof x === "string") &&
    typeof v.diet === "string" &&
    ["none", "vegetarian", "vegan"].includes(v.diet)
  );
}

export function loadProfile(): Profile {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_PROFILE;
    const parsed: unknown = JSON.parse(raw);
    if (isValidProfile(parsed)) return parsed;
  } catch {
    // Corrupt or unavailable storage falls back to an empty profile.
  }
  return EMPTY_PROFILE;
}

export function profileHasRestrictions(profile: Profile): boolean {
  return (
    profile.allergens.length > 0 ||
    profile.custom_avoid.length > 0 ||
    profile.diet !== "none"
  );
}

export function profileSummary(profile: Profile): string {
  const parts: string[] = [];
  const presetLabels = new Map(ALLERGEN_PRESETS.map((p) => [p.key, p.label]));
  parts.push(
    ...profile.allergens.map((k) => presetLabels.get(k) ?? k),
    ...profile.custom_avoid,
  );
  if (profile.diet === "vegetarian") parts.push("Vegetarian");
  if (profile.diet === "vegan") parts.push("Vegan");
  return parts.length > 0 ? parts.join(" · ") : "No restrictions yet";
}

interface ProfileContextValue {
  profile: Profile;
  setProfile: (next: Profile) => void;
  clearProfile: () => void;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfileState] = useState<Profile>(loadProfile);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    } catch {
      // Storage full or blocked; the in-memory profile still works this session.
    }
  }, [profile]);

  const setProfile = useCallback((next: Profile) => setProfileState(next), []);
  const clearProfile = useCallback(() => setProfileState(EMPTY_PROFILE), []);

  const value = useMemo(
    () => ({ profile, setProfile, clearProfile }),
    [profile, setProfile, clearProfile],
  );

  return (
    <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
  );
}

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used inside ProfileProvider");
  return ctx;
}
