export interface PersonalDpsRotationContext10R1 {
  readonly resonanceMode?: string;
}

/**
 * Rotation-owned combat context. The simulator consumes this generically;
 * character-specific mode names live only in reviewed data.
 */
const rotationContextById: Readonly<
  Record<string, PersonalDpsRotationContext10R1>
> = {
  "aemeath-s0-standard-no-quickswap-damage-v1": {
    resonanceMode: "tune-rupture",
  },
};

export function resolvePersonalDpsRotationContext10R1(
  rotationId: string,
): PersonalDpsRotationContext10R1 {
  return rotationContextById[rotationId] ?? {};
}
