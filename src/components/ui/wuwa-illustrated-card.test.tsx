import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  WuwaIllustratedCard,
  WuwaIllustratedCardButton,
} from "./wuwa-illustrated-card";

describe("WuwaIllustratedCard", () => {
  it("keeps text identity when no artwork is provided", () => {
    const html = renderToStaticMarkup(
      <WuwaIllustratedCard kind="resonator" title="Test Resonator" subtitle="Fusion" />,
    );

    expect(html).toContain("Test Resonator");
    expect(html).toContain("Fusion");
    expect(html).toContain("Artwork");
    expect(html).toContain("data-kind=\"resonator\"");
  });

  it("uses native pressed button semantics for selectable cards", () => {
    const html = renderToStaticMarkup(
      <WuwaIllustratedCardButton kind="echo" title="Test Echo" selected />,
    );

    expect(html).toContain("type=\"button\"");
    expect(html).toContain("aria-pressed=\"true\"");
    expect(html).toContain("data-selected=\"true\"");
  });

  it("disables unavailable selectable cards and exposes explicit text", () => {
    const html = renderToStaticMarkup(
      <WuwaIllustratedCardButton kind="weapon" title="Unavailable weapon" unavailable />,
    );

    expect(html).toContain("disabled=\"\"");
    expect(html).toContain("Indisponible");
  });
});
