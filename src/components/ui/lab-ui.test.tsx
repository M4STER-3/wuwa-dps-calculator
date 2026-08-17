import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LabBadge, LabLinkButton, LabMetric, LabPanel, LabState } from "./lab-ui";

describe("V3 LAB UI primitives", () => {
  it("keeps native navigation semantics for action links", () => {
    const html = renderToStaticMarkup(
      <LabLinkButton href="/character-box" variant="primary">
        Character Box
      </LabLinkButton>,
    );

    expect(html).toContain('href="/character-box"');
    expect(html).toContain("lab-link-button--primary");
  });

  it("exposes compact metrics and badges as readable text", () => {
    const html = renderToStaticMarkup(
      <LabPanel tone="contrast">
        <LabBadge tone="jade">Vérifié</LabBadge>
        <LabMetric label="Resonators" value="60" meta="Catalogue local" />
      </LabPanel>,
    );

    expect(html).toContain("Vérifié");
    expect(html).toContain("Resonators");
    expect(html).toContain("60");
    expect(html).toContain("lab-panel--contrast");
  });

  it("renders empty and error-state copy without decorative-only meaning", () => {
    const html = renderToStaticMarkup(
      <LabState title="Aucun build">Ajoutez un Resonator pour commencer.</LabState>,
    );

    expect(html).toContain("Aucun build");
    expect(html).toContain("Ajoutez un Resonator");
  });
});
