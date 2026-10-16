// Active-scan state. In memory only (never localStorage): the staged photos,
// the extraction, the user's confirmations and corrections, and the computed
// results. "Clear" wipes all of it.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  ConfirmState,
  Extraction,
  Profile,
  Results,
} from "@shared/contracts";
import { compareProfile } from "@domain/compareProfile";
import type { AliasMap } from "@domain/compareProfile";
import aliasMapJson from "@domain/aliasMap.json";
import { extractLabel, extractMode, type ExtractOutcome } from "@api/extract";
import { profileHasRestrictions, useProfile } from "./profileStore";
import { applyCorrections } from "./applyCorrections";

export const EMPTY_CONFIRM: ConfirmState = {
  ingredients_complete: false,
  allergen_statement_complete: false,
  pack_has_no_allergen_statement: false,
};

export interface ScanPhoto {
  id: string;
  file: File;
  url: string;
  /** Upload index for the extraction currently shown beside this photo. */
  readingIndex: number | null;
}

export type ScanPhase = "capture" | "reading" | "results";

export interface ScanState {
  phase: ScanPhase;
  photos: ScanPhoto[];
  extraction: Extraction | null;
  confirm: ConfirmState;
  corrections: Record<string, string>; // scan-local row key -> corrected label_text
  /** Row keys the user explicitly checked against the photo. */
  rowChecked: Record<string, boolean>;
  /** Ingredient row keys whose original reading was restored after an edit. */
  rowRestored: Record<string, boolean>;
  results: Results | null;
  error: { code: string; message: string; retryable: boolean } | null;
}

const INITIAL: ScanState = {
  phase: "capture",
  photos: [],
  extraction: null,
  confirm: EMPTY_CONFIRM,
  corrections: {},
  rowChecked: {},
  rowRestored: {},
  results: null,
  error: null,
};

const MAX_PHOTOS = 3;
const aliasMap = aliasMapJson as unknown as AliasMap;

function readProfile(): Profile {
  try {
    const raw = window.localStorage.getItem("labellens.profile.v1");
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (
      parsed &&
      typeof parsed === "object" &&
      (parsed as Profile).schema_version === "1"
    ) {
      return parsed as Profile;
    }
  } catch {
    // fall through to empty
  }
  return { schema_version: "1", allergens: [], custom_avoid: [], diet: "none" };
}

interface ScanContextValue {
  scan: ScanState;
  isMockMode: boolean;
  canStartScan: boolean;
  hasProfile: boolean;
  addPhotos: (files: File[]) => void;
  replacePhoto: (photoId: string, file: File) => void;
  startScan: () => void;
  /** Dev picker: load an extraction directly as the active scan result. */
  loadFixtureDirect: (extraction: Extraction) => void;
  setConfirm: (next: Partial<ConfirmState>) => void;
  correctRow: (id: string, newText: string) => void;
  restoreRow: (id: string) => void;
  checkRow: (id: string) => void;
  retakePanel: (photoId: string) => void;
  removePhoto: (photoId: string) => void;
  goCapture: () => void;
  clearScan: () => void;
  dismissError: () => void;
}

const ScanContext = createContext<ScanContextValue | null>(null);

export function ScanProvider({
  children,
  /** Mock hook (dev picker): decides what a scan returns, incl. error simulation. */
  loadOutcome,
}: {
  children: ReactNode;
  loadOutcome?: (files: File[]) => Promise<ExtractOutcome>;
}) {
  const [scan, setScan] = useState<ScanState>(INITIAL);
  const isMockMode = extractMode() === "mock";
  // Reactive profile from the provider (ScanProvider is nested inside
  // ProfileProvider) so profile edits re-render this tree immediately.
  const { profile } = useProfile();
  const profileRef = useRef(profile);
  profileRef.current = profile;

  const recompute = useCallback(
    (
      prev: ScanState,
      extraction: Extraction | null,
      confirm: ConfirmState,
      corrections: Record<string, string>,
      rowChecked: Record<string, boolean>,
      rowRestored: Record<string, boolean>,
    ): ScanState => {
      // Carry the new interaction state through, not just the results.
      if (!extraction) {
        return { ...prev, confirm, corrections, rowChecked, rowRestored, results: null };
      }
      const profile = profileRef.current;
      const effective = applyCorrections(
        extraction,
        corrections,
        rowChecked,
        rowRestored,
      );
      const results = compareProfile(effective, profile, confirm, aliasMap);
      return { ...prev, confirm, corrections, rowChecked, rowRestored, results };
    },
    [],
  );

  useEffect(() => {
    setScan((prev) => {
      if (!prev.extraction) return prev;
      return recompute(
        prev,
        prev.extraction,
        prev.confirm,
        prev.corrections,
        prev.rowChecked,
        prev.rowRestored,
      );
    });
  }, [profile, recompute]);

  const makePhoto = (file: File): ScanPhoto => ({
    id: `photo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    file,
    url: URL.createObjectURL(file),
    readingIndex: null,
  });

  const addPhotos = useCallback((files: File[]) => {
    setScan((prev) => {
      const room = MAX_PHOTOS - prev.photos.length;
      if (room <= 0) return prev;
      const next = [...prev.photos, ...files.slice(0, room).map(makePhoto)];
      return { ...prev, photos: next, error: null };
    });
  }, []);

  const replacePhoto = useCallback((photoId: string, file: File) => {
    setScan((prev) => ({
      ...prev,
      photos: prev.photos.map((p) =>
        p.id === photoId
          ? { ...makePhoto(file), id: p.id, readingIndex: null }
          : p,
      ),
      error: null,
    }));
  }, []);

  const startScan = useCallback(async () => {
    if (scan.photos.length === 0) return;
    const files = scan.photos.map((p) => p.file);
    setScan((prev) => ({
      ...prev,
      phase: "reading",
      photos: prev.photos.map((photo, index) => ({
        ...photo,
        readingIndex: index,
      })),
      confirm: EMPTY_CONFIRM,
      corrections: {},
      rowChecked: {},
      rowRestored: {},
      results: null,
      error: null,
    }));
    try {
      let outcome: ExtractOutcome;
      if (isMockMode && loadOutcome) {
        outcome = await loadOutcome(files);
      } else {
        outcome = await extractLabel(files);
      }
      setScan((prev) =>
        recompute(
          {
            ...prev,
            phase: "results",
            extraction: outcome.extraction,
            error: null,
          },
          outcome.extraction,
          prev.confirm,
          prev.corrections,
          prev.rowChecked,
          prev.rowRestored,
        ),
      );
    } catch (e) {
      const err = e as { code?: string; message: string; retryable?: boolean };
      setScan((prev) => ({
        ...prev,
        phase: "capture",
        error: {
          code: err.code ?? "provider_error",
          message: err.message ?? "Something went wrong reading the photo.",
          retryable: err.retryable ?? false,
        },
      }));
    }
  }, [scan.photos, isMockMode, loadOutcome, recompute]);

  const loadFixtureDirect = useCallback(
    (extraction: Extraction) => {
      setScan((prev) => {
        for (const p of prev.photos) URL.revokeObjectURL(p.url);
        const base: ScanState = {
          ...INITIAL,
          phase: "results",
          extraction,
        };
        return recompute(base, extraction, base.confirm, {}, {}, {});
      });
    },
    [recompute],
  );

  const setConfirm = useCallback(
    (next: Partial<ConfirmState>) => {
      setScan((prev) => {
        const confirm = { ...prev.confirm, ...next };
        // "This pack has no allergen line" and "the line is fully visible"
        // are mutually exclusive statements about the same pack.
        if (next.pack_has_no_allergen_statement) {
          confirm.allergen_statement_complete = false;
        }
        if (next.allergen_statement_complete) {
          confirm.pack_has_no_allergen_statement = false;
        }
        return recompute(prev, prev.extraction, confirm, prev.corrections, prev.rowChecked, prev.rowRestored);
      });
    },
    [recompute],
  );

  const correctRow = useCallback(
    (id: string, newText: string) => {
      setScan((prev) => {
        const corrections = { ...prev.corrections, [id]: newText };
        const rowChecked = { ...prev.rowChecked };
        const rowRestored = { ...prev.rowRestored };
        // A new edit invalidates any earlier confirmation for this wording.
        delete rowChecked[id];
        delete rowRestored[id];
        return recompute(
          prev,
          prev.extraction,
          prev.confirm,
          corrections,
          rowChecked,
          rowRestored,
        );
      });
    },
    [recompute],
  );

  const restoreRow = useCallback(
    (id: string) => {
      setScan((prev) => {
        const corrections = { ...prev.corrections };
        delete corrections[id];
        const rowChecked = { ...prev.rowChecked };
        delete rowChecked[id];
        const rowRestored = { ...prev.rowRestored, [id]: true };
        return recompute(
          prev,
          prev.extraction,
          prev.confirm,
          corrections,
          rowChecked,
          rowRestored,
        );
      });
    },
    [recompute],
  );

  const checkRow = useCallback(
    (id: string) => {
      setScan((prev) => {
        const rowChecked = { ...prev.rowChecked, [id]: true };
        return recompute(prev, prev.extraction, prev.confirm, prev.corrections, rowChecked, prev.rowRestored);
      });
    },
    [recompute],
  );

  const retakePanel = useCallback((photoId: string) => {
    setScan((prev) => ({
      ...prev,
      photos: prev.photos.filter((p) => p.id !== photoId),
      phase: "capture",
    }));
  }, []);

  const removePhoto = useCallback((photoId: string) => {
    setScan((prev) => ({
      ...prev,
      photos: prev.photos.filter((p) => p.id !== photoId),
    }));
  }, []);

  const goCapture = useCallback(() => {
    setScan((prev) => ({ ...prev, phase: "capture" }));
  }, []);

  const clearScan = useCallback(() => {
    setScan((prev) => {
      for (const p of prev.photos) URL.revokeObjectURL(p.url);
      return { ...INITIAL };
    });
  }, []);

  const dismissError = useCallback(() => {
    setScan((prev) => ({ ...prev, error: null }));
  }, []);

  const hasProfile = profileHasRestrictions(profile);

  const value = useMemo(
    () => ({
      scan,
      isMockMode,
      canStartScan: scan.photos.length > 0 && scan.phase === "capture",
      hasProfile,
      addPhotos,
      replacePhoto,
      startScan,
      loadFixtureDirect,
      setConfirm,
      correctRow,
      restoreRow,
      checkRow,
      retakePanel,
      removePhoto,
      goCapture,
      clearScan,
      dismissError,
    }),
    [
      scan,
      isMockMode,
      hasProfile,
      addPhotos,
      replacePhoto,
      startScan,
      loadFixtureDirect,
      setConfirm,
      correctRow,
      restoreRow,
      checkRow,
      retakePanel,
      removePhoto,
      goCapture,
      clearScan,
      dismissError,
    ],
  );

  return <ScanContext.Provider value={value}>{children}</ScanContext.Provider>;
}

export function useScan(): ScanContextValue {
  const ctx = useContext(ScanContext);
  if (!ctx) throw new Error("useScan must be used inside ScanProvider");
  return ctx;
}
