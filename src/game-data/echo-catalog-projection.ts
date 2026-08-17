export interface EchoCatalogItemV1 {
  readonly id: string;
  readonly name: string;
  readonly cost: 1 | 3 | 4;
  readonly sonataSetIds: readonly string[];
}

export interface SonataCatalogItemV1 {
  readonly id: string;
  readonly name: string;
}

/** Browser contract generated from the already-promoted GameDatabase at build time. */
export interface EchoCatalogProjectionV1 {
  readonly schemaVersion: 1;
  readonly echoes: readonly EchoCatalogItemV1[];
  readonly sonataSets: readonly SonataCatalogItemV1[];
}
