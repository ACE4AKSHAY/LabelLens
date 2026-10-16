// Active-scan state. In memory only (never localStorage): the uploaded photos,
// the extraction, the user's confirmations and corrections, and the computed
// results. "Clear" wipes all of it.

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  ConfirmState,
  Extraction,
  IngredientRow,
  Results,
} from "@shared/contracts";
import { compareProfile } from "@domain/compareProfile";
import aliasMapJson from "@domain/aliasMap.json";
import type { AliasMap } from "@domain/compareProfile";

export const EMPTY_CONFIRM: ConfirmState = {
  ingredients_complete: false,
  allergen_statement_complete: false,
  pack_has_no_allergen_statement: false,
};

export interface ScanPhoto {
  id: string;
  file: File;
  url: string;
}

export type ScanPhase = "capture" | "reading" | "results";

export interface ScanState {
  phase: ScanPhase;
  photos: ScanPhoto[];
  extraction: Extraction | null;
  /** Present in mock mode only — golden preview results, clearly labeled. */
  expectedPreview: Results | null;
  confirm: ConfirmState;
  corrections: Record<string, string>; // ingredient id -> user-edited label_text
  /** Ingredient ids the user tapped "I checked this row" on. */
  rowChecked: Record<string, boolean>;
  /** Ingredient ids whose original reading was restored after an edit. */
  rowRestored: Record<string, boolean>;
  results: Results | null;
  error: { code: string; message: string; retryable: boolean } | null;
}

const INITIAL: ScanState = {
  phase: "capture",
  photos: [],
  extraction: null,
  expectedPreview: null,
  confirm: EMPTY_CONFIRM,
  corrections: {},
  rowChecked: {},
  rowRestored: {},
  results: null,
  error: null,
};

const aliasMap = aliasMapJson as unknown as AliasMap;

/** Effective ingredient rows after user corrections (R: corrections re-run the rules). */
function applyCorrections(
  ingredients: IngredientRow[],
  corrections: Record<string, string>,
  rowChecked: Record<string, boolean>,
  rowRestored: Record<string, boolean>,
): IngredientRow[] {
  return ingredients.map((row) => {
    let next = row;
    const edited = corrections[row.id];
    if (edited !== undefined && edited !== row.label_text) {
      next = {
        ...next,
        label_text: edited,
        edited_by_user: true,
        review_required: rowChecked[row.id] ? false : next.review_required,
        review_reason: rowChecked[row.id] ? null : next.review_reason,
      };
    } else if (rowChecked[row.id]) {
      next = { ...next, review_required: false, review_reason: null };
    }
    if (rowRestored[row.id]) {
      next = { ...next, edited_by_user: false };
    }
    return next;
  });
}

interface ScanContextValue {
  scan: ScanState;
  isMockMode: boolean;
  startScan: (photos: File[]) => Promise<void>;
  setPhase: (phase: ScanPhase) => void;
  setConfirm: (next: Partial<ConfirmState>) => void;
  correctIngredient: (id: string, newText: string) => void;
  restoreIngredient: (id: string) => void;
  checkIngredientRow: (id: string) => void;
  retakePanel: (photoId: string) => void;
  removePhoto: (photoId: string) => void;
  clearScan: () => void;
  dismissError: () => void;
}

const ScanContext = createContext<ScanContextValue | null>(null);

export function ScanProvider({
  children,
  isMockMode,
  onLoadExpected,
}: {
  children: ReactNode;
  isMockMode: boolean;
  /** Mock mode hook: returns the golden preview for these files, if any. */
  onLoadExpected?: (files: File[]) => Promise<Results | null>;
}) {
  const [scan, setScan] = useState<ScanState>(INITIAL);

  const recompute = useCallback(
    (
      next: ScanState,
      extraction: Extraction | null,
      confirm: ConfirmState,
      corrections: Record<string, string>,
      rowChecked: Record<string, boolean>,
      rowRestored: Record<string, boolean>,
    ): ScanState => {
      if (!extraction) return { ...next, results: null };
      const effective: Extraction = {
        ...extraction,
        ingredients: applyCorrections(
          extraction.ingredients,
          corrections,
          rowChecked,
          rowRestored,
        ),
      };
      const profileState = JSON.parse(
        window.localStorage.getItem("labellens.profile.v1") ?? "null",
      );
      const profile =
        profileState && profileState.schema_version === "1"
          ? profileState
          : { schema_version: "1", allergens: [], custom_avoid: [], diet: "none" };
      const results = compareProfile(effective, profile, confirm, aliasMap);
      return { ...next, results };
    },
    [],
  );

  const startScan = useCallback(
    async (files: File[]) => {
      setScan((prev) => ({
        ...INITIAL,
        photos: files.map((file, i) => ({
          id: `photo-${Date.now()}-${i}`,
          file,
          url: URL.createObjectURL(file),
        })),
        phase: "reading",
      }));
      try {
        const { extractLabel } = await import("@api/extract");
        const outcome = await extractLabel(files);
        const expectedPreview =
          isMockMode && onLoadExpected ? await onLoadExpected(files) : null;
        setScan((prev) =>
          recompute(
            {
              ...prev,
              phase: "results",
              extraction: outcome.extraction,
              expectedPreview: expectedPreview ?? outcome.expected ?? null,
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
    },
    [isMockMode, onLoadExpected, recompute],
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
        return recompute(
          { ...prev, confirm },
          prev.extraction,
          confirm,
          prev.corrections,
          prev.rowChecked,
          prev.rowRestored,
        );
      });
    },
    [recompute],
  );

  const correctIngredient = useCallback(
    (id: string, newText: string) => {
      setScan((prev) => {
        const corrections = { ...prev.corrections, [id]: newText };
        return recompute(
          { ...prev, corrections },
          prev.extraction,
          prev.confirm,
          corrections,
          prev.rowChecked,
          prev.rowRestored,
        );
      });
    },
    [recompute],
  );

  const restoreIngredient = useCallback(
    (id: string) => {
      setScan((prev) => {
        const corrections = { ...prev.corrections };
        delete corrections[id];
        const rowRestored = { ...prev.rowRestored, [id]: true };
        return recompute(
          { ...prev, corrections, rowRestored },
          prev.extraction,
          prev.confirm,
          corrections,
          prev.rowChecked,
          rowRestored,
        );
      });
    },
    [recompute],
  );

  const checkIngredientRow = useCallback(
    (id: string) => {
      setScan((prev) => {
        const rowChecked = { ...prev.rowChecked, [id]: true };
        return recompute(
          { ...prev, rowChecked },
          prev.extraction,
          prev.confirm,
          prev.corrections,
          rowChecked,
          prev.rowRestored,
        );
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

  const clearScan = useCallback(() => {
    setScan((prev) => {
      for (const p of prev.photos) URL.revokeObjectURL(p.url);
      return { ...INITIAL };
    });
  }, []);

  const dismissError = useCallback(() => {
    setScan((prev) => ({ ...prev, error: null }));
  }, []);

  const value = useMemo(
    () => ({
      scan,
      isMockMode,
      startScan,
      setPhase: (phase: ScanPhase) => setScan((prev) => ({ ...prev, phase })),
      setConfirm,
      correctIngredient,
      restoreIngredient,
      checkIngredientRow,
      retakePanel,
      removePhoto,
      clearScan,
      dismissError,
    }),
    [
      scan,
      isMockMode,
      startScan,
      setConfirm,
      correctIngredient,
      restoreIngredient,
      checkIngredientRow,
      retakePanel,
      removePhoto,
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
