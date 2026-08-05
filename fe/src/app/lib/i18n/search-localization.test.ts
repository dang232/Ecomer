import i18next from "i18next";
import { describe, expect, it } from "vitest";

import vietnamese from "./vi.json";

describe("Vietnamese search localization", () => {
  it("interpolates the query used by the search result heading", async () => {
    const i18n = i18next.createInstance();
    await i18n.init({ lng: "vi", resources: { vi: { translation: vietnamese } } });

    expect(i18n.t("search.resultsForQuery", { query: "zzxjourneycheck" })).toBe(
      'Kết quả cho "zzxjourneycheck"',
    );
  });
});
