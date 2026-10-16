// Mock fixture registry. Built-in packs cover distinct UI states; shared
// extraction fixtures are also loaded and run through the same comparison rules.

import type { Extraction } from "@shared/contracts";
import type { FixturePack } from "./types";
import { ERROR_SIM_ID } from "./types";
import { sampleMasalaBiscuits } from "./sampleMasalaBiscuits";
import { sampleCheeseCrackers } from "./sampleCheeseCrackers";
import { sampleRicePuffs } from "./sampleRicePuffs";
import { sampleChocoBar } from "./sampleChocoBar";

export { ERROR_SIM_ID };
export type { FixturePack } from "./types";

export const DEFAULT_MOCK_PACK_ID = sampleMasalaBiscuits.id;

const builtInPacks: FixturePack[] = [
  sampleMasalaBiscuits,
  sampleCheeseCrackers,
  sampleRicePuffs,
  sampleChocoBar,
];

const sharedFixtureModules = import.meta.glob(
  "../../../shared/fixtures/extraction/*.json",
  { import: "default", eager: true },
) as Record<string, Extraction>;

const builtInAnalysisIds = new Set(
  builtInPacks.map((pack) => pack.extraction.analysis_id),
);

const sharedPacks: FixturePack[] = Object.entries(sharedFixtureModules)
  .filter(([, extraction]) => {
    // Shared fixtures already covered by a richer built-in pack are skipped.
    const known = extraction && builtInAnalysisIds.has(extraction.analysis_id);
    return !known;
  })
  .map(([path, extraction]) => ({
    id: `shared:${path.split("/").pop()!.replace(/\.json$/, "")}`,
    title: path.split("/").pop()!.replace(/\.json$/, "").replace(/_/g, " "),
    description:
      "From shared/fixtures/extraction — rendered through the real rules seam.",
    source: "shared" as const,
    extraction,
  }));

export function listPacks(): FixturePack[] {
  return [...builtInPacks, ...sharedPacks];
}

export function getPackById(id: string): FixturePack | undefined {
  return listPacks().find((pack) => pack.id === id);
}
