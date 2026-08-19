import { isValidBuild, parseCharacterBox } from "@/domain/character-box";
import type { CharacterBox } from "@/domain/models";
import { materializeCharacterBoxBuild10R1 } from "@/game-data/character-box-final-stats-10r1";

export interface CharacterBoxStorage {
  load(): CharacterBox;
  save(box: CharacterBox): void;
}

export const CHARACTER_BOX_STORAGE_KEY = "wuwa-character-box:v1";
export const CHARACTER_BOX_CHANGED_EVENT = "wuwa-character-box:changed";

let cachedSerialized: string | null | undefined;
let cachedBox: CharacterBox | undefined;

function materializePermanentStats(box: CharacterBox): CharacterBox {
  return {
    ...box,
    builds: box.builds.map(materializeCharacterBoxBuild10R1),
  };
}

export function getBrowserCharacterBoxSnapshot(): CharacterBox {
  const serialized = window.localStorage.getItem(CHARACTER_BOX_STORAGE_KEY);
  if (serialized !== cachedSerialized || !cachedBox) {
    cachedSerialized = serialized;
    cachedBox = materializePermanentStats(parseCharacterBox(serialized));
  }
  return cachedBox;
}

export function subscribeToBrowserCharacterBox(
  callback: () => void,
): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === CHARACTER_BOX_STORAGE_KEY) callback();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHARACTER_BOX_CHANGED_EVENT, callback);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHARACTER_BOX_CHANGED_EVENT, callback);
  };
}

export function createBrowserCharacterBoxStorage(): CharacterBoxStorage {
  return {
    load: () =>
      materializePermanentStats(
        parseCharacterBox(window.localStorage.getItem(CHARACTER_BOX_STORAGE_KEY)),
      ),
    save: (box) => {
      const materialized = materializePermanentStats(box);
      if (
        materialized.schemaVersion !== 1 ||
        !Array.isArray(materialized.builds) ||
        !materialized.builds.every(isValidBuild)
      ) {
        throw new Error("Impossible de persister une Character Box invalide.");
      }
      window.localStorage.setItem(
        CHARACTER_BOX_STORAGE_KEY,
        JSON.stringify(materialized),
      );
      cachedSerialized = undefined;
      window.dispatchEvent(new Event(CHARACTER_BOX_CHANGED_EVENT));
    },
  };
}