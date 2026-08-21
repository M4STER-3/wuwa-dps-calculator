import { updateBuild } from "@/domain/character-box";
import type { CharacterBox } from "@/domain/models";
import {
  isUserEchoLoadoutV1,
  sanitizeUserEchoLoadoutV1,
  type UserEchoLoadoutV1,
} from "@/domain/user-echo-loadout";

export interface DraftSubstat {
  statId: string;
  value: string;
}

export interface DraftEchoSlot {
  echoId: string;
  sonataSetId: string;
  primaryMainStatId: string;
  substats: DraftSubstat[];
}

export const ECHO_EDITOR_SLOT_COUNT = 5;

export function emptyEchoDraftSlot(): DraftEchoSlot {
  return {
    echoId: "",
    sonataSetId: "",
    primaryMainStatId: "",
    substats: [],
  };
}

export function emptyEchoDraftSlots(): DraftEchoSlot[] {
  return Array.from({ length: ECHO_EDITOR_SLOT_COUNT }, () => emptyEchoDraftSlot());
}

export function draftSlotsFromLoadout(loadout?: UserEchoLoadoutV1): DraftEchoSlot[] {
  if (!loadout || loadout.echoes.length === 0) return emptyEchoDraftSlots();

  const echoes = [...loadout.echoes];
  if (loadout.mainEchoId) {
    const mainIndex = echoes.findIndex((echo) => echo.echoId === loadout.mainEchoId);
    if (mainIndex > 0) {
      const [main] = echoes.splice(mainIndex, 1);
      if (main) echoes.unshift(main);
    }
  }

  const slots = echoes.slice(0, ECHO_EDITOR_SLOT_COUNT).map((echo) => ({
    echoId: echo.echoId,
    sonataSetId: echo.sonataSetId,
    primaryMainStatId: echo.primaryMainStatId,
    substats: echo.substats.map((substat) => ({
      statId: substat.statId,
      value: String(substat.value),
    })),
  }));

  while (slots.length < ECHO_EDITOR_SLOT_COUNT) slots.push(emptyEchoDraftSlot());
  return slots;
}

function incompleteSlotMessage(slot: DraftEchoSlot, slotNumber: number): string {
  const missing: string[] = [];
  if (!slot.sonataSetId) missing.push("un Sonata");
  if (!slot.primaryMainStatId) missing.push("une main stat");
  return `Slot ${slotNumber} incomplet : choisissez ${missing.join(" et ")}.`;
}

export function loadoutFromDraftSlots(slots: readonly DraftEchoSlot[]): UserEchoLoadoutV1 {
  if (slots.length !== ECHO_EDITOR_SLOT_COUNT) {
    throw new Error(`L’éditeur Echo attend exactement ${ECHO_EDITOR_SLOT_COUNT} slots.`);
  }

  const equipped = slots
    .map((slot, slotIndex) => ({ slot, slotIndex }))
    .filter(({ slot }) => slot.echoId.length > 0);

  const echoes = equipped.map(({ slot, slotIndex }) => {
    if (!slot.sonataSetId || !slot.primaryMainStatId) {
      throw new Error(incompleteSlotMessage(slot, slotIndex + 1));
    }

    return {
      echoId: slot.echoId,
      sonataSetId: slot.sonataSetId,
      rarity: 5 as const,
      level: 25 as const,
      primaryMainStatId: slot.primaryMainStatId,
      substats: slot.substats.map((substat, subIndex) => {
        if (!substat.statId || substat.value.length === 0) {
          throw new Error(
            `Slot ${slotIndex + 1} · substat ${subIndex + 1} incomplète : choisissez la stat et son roll.`,
          );
        }
        const value = Number(substat.value);
        if (!Number.isFinite(value) || value < 0) {
          throw new Error(`Slot ${slotIndex + 1} · substat ${subIndex + 1} : valeur invalide.`);
        }
        return { statId: substat.statId, value };
      }),
    };
  });

  const explicitMainEchoId = slots[0]?.echoId || undefined;
  const candidate: UserEchoLoadoutV1 = {
    echoes,
    ...(explicitMainEchoId ? { mainEchoId: explicitMainEchoId } : {}),
  };

  if (!isUserEchoLoadoutV1(candidate)) {
    throw new Error("Le loadout Echo produit par l’éditeur est invalide.");
  }
  return sanitizeUserEchoLoadoutV1(candidate);
}

export function replaceBuildEchoLoadout(
  box: CharacterBox,
  buildId: string,
  loadout: UserEchoLoadoutV1,
  now: string,
): CharacterBox {
  const build = box.builds.find((candidate) => candidate.id === buildId);
  if (!build) throw new Error("Le build sélectionné n’existe plus dans la Character Box.");
  if (!isUserEchoLoadoutV1(loadout)) throw new Error("Le loadout Echo à sauvegarder est invalide.");

  return updateBuild(box, {
    ...build,
    echoLoadout: sanitizeUserEchoLoadoutV1(loadout),
    updatedAt: now,
  });
}

export function clearBuildEchoLoadout(
  box: CharacterBox,
  buildId: string,
  now: string,
): CharacterBox {
  const build = box.builds.find((candidate) => candidate.id === buildId);
  if (!build) throw new Error("Le build sélectionné n’existe plus dans la Character Box.");
  const { echoLoadout: _discarded, ...withoutEchoLoadout } = build;
  void _discarded;
  return updateBuild(box, {
    ...withoutEchoLoadout,
    updatedAt: now,
  });
}
