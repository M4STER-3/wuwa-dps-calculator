import { generatedCommunityEchoPresets10R1 } from "@/generated/community-echo-presets-10r1";

type EchoLoadoutIdentity = {
  readonly echoes: readonly { readonly sonataSetId: string }[];
};

function requireFivePieceSonata(
  label: string,
  loadout: EchoLoadoutIdentity,
): string {
  const counts = new Map<string, number>();
  for (const echo of loadout.echoes) {
    counts.set(echo.sonataSetId, (counts.get(echo.sonataSetId) ?? 0) + 1);
  }
  const match = [...counts.entries()].find(([, count]) => count >= 5)?.[0];
  if (!match) {
    throw new Error(`${label} must resolve to a local five-piece Sonata id.`);
  }
  return match;
}

const aemeath = generatedCommunityEchoPresets10R1.aemeath.echoLoadout;
const calcharo = generatedCommunityEchoPresets10R1.calcharo.echoLoadout;
const changli = generatedCommunityEchoPresets10R1.changli.echoLoadout;

/**
 * Local Sonata identities are derived from the same fail-closed community
 * projection that validates every equipped Echo. Runtime code never guesses ids.
 * Main-Echo passives remain permanent build materialization and are not inferred
 * here when the saved loadout does not explicitly designate a Main Echo.
 */
export const personalDpsRuntimeIdentities10R1 = {
  sonata: {
    trailblazingStar: requireFivePieceSonata("Trailblazing Star", aemeath),
    voidThunder: requireFivePieceSonata("Void Thunder", calcharo),
    moltenRift: requireFivePieceSonata("Molten Rift", changli),
  },
} as const;
