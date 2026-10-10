import { describe, expect, test } from "bun:test";
import path from "node:path";

// Point lib/board at committed fixtures so the test does not depend on published data.
process.env.BOARD_DATA_DIR = path.join(import.meta.dir, "fixtures", "data");

import { configuredSlugs, knownSlugs, readBoard, readIndex } from "../lib/board";
import {
  formatAmount,
  formatCompact,
  formatDate,
  formatDayShort,
  formatInt,
  formatPercent,
  formatRelative,
  formatSignedUsd,
  formatUsd,
  formatUsdCompact,
  formatUtc,
} from "../lib/format";

describe("lib/board", () => {
  test("reads the published index", async () => {
    const index = await readIndex();
    expect(index).not.toBeNull();
    expect(index!.schemaVersion).toBe(1);
    expect(index!.chains.some((c) => c.slug === "bnb")).toBe(true);
  });

  test("reads a chain payload with the expected shape", async () => {
    const board = await readBoard("bnb");
    expect(board).not.toBeNull();
    expect(board!.chain.slug).toBe("bnb");
    expect(board!.registrationsDaily.length).toBe(31);
    expect(board!.activity.volumeUsd).toBeGreaterThan(0);
    expect(board!.topProjects.length).toBeGreaterThan(0);
    expect(board!.totals.agents).toBeGreaterThanOrEqual(board!.totals.uniqueOwners);
  });

  test("returns null for unknown or unsafe slugs", async () => {
    expect(await readBoard("nope")).toBeNull();
    expect(await readBoard("../index")).toBeNull();
    expect(await readBoard("")).toBeNull();
  });

  test("known slugs include configured chains", async () => {
    const configured = await configuredSlugs();
    expect(configured).toContain("bnb");
    const known = await knownSlugs();
    expect(known).toContain("bnb");
    expect(new Set(known).size).toBe(known.length);
  });
});

describe("lib/format", () => {
  test("compact and full integers", () => {
    expect(formatCompact(301996)).toBe("302K");
    expect(formatCompact(1_230_000)).toBe("1.2M");
    expect(formatCompact(42)).toBe("42");
    expect(formatInt(301996)).toBe("301,996");
    expect(formatInt(Number.NaN)).toBe("0");
  });

  test("usd variants", () => {
    expect(formatUsdCompact(11_771_393.93)).toBe("$11.8M");
    expect(formatUsd(11_771_393.93)).toBe("$11,771,394");
    expect(formatSignedUsd(1_200_000)).toBe("+$1.2M");
    expect(formatSignedUsd(-340_000)).toBe("-$340K");
    expect(formatSignedUsd(0)).toBe("$0");
  });

  test("percent and amounts", () => {
    expect(formatPercent(0.2147)).toBe("21.5%");
    expect(formatAmount(3412.5, "BNB")).toBe("3,413 BNB");
    expect(formatAmount(0.12345, "BNB")).toBe("0.1235 BNB");
  });

  test("date only, no time or zone", () => {
    expect(formatDate("2026-09-18T09:03:35.182Z")).toBe("18 Sep 2026");
    expect(formatDate("nope")).toBe("unknown");
  });

  test("relative time is deterministic with an injected now", () => {
    const now = new Date("2026-09-04T12:00:00Z");
    expect(formatRelative("2026-09-04T11:59:30Z", now)).toBe("just now");
    expect(formatRelative("2026-09-04T11:30:00Z", now)).toBe("30 minutes ago");
    expect(formatRelative("2026-09-04T09:00:00Z", now)).toBe("3 hours ago");
    expect(formatRelative("2026-09-01T12:00:00Z", now)).toBe("3 days ago");
    expect(formatRelative("not a date", now)).toBe("unknown");
  });

  test("utc and short day labels", () => {
    expect(formatUtc("2026-09-04T04:12:00Z")).toBe("4 Sep 2026, 04:12 UTC");
    expect(formatDayShort("2026-09-04")).toBe("4 Sep");
  });
});

describe("components", () => {
  test("KpiCard shows the title once, the number, and the definition behind the info control", async () => {
    const { renderToString } = await import("react-dom/server");
    const { KpiCard } = await import("../components/KpiCard");
    const { createElement } = await import("react");
    const html = renderToString(createElement(KpiCard, { id: "agents", title: "Total agents", definition: "Registered ERC-8004 agents.", value: "334,195" }));
    expect(html).toContain("Registered ERC-8004 agents.");
    expect(html).toContain("334,195");
    expect(html.split("Total agents").length).toBe(2); // title appears once
    expect(html).not.toContain("Updated ");
  });

  test("Donut draws up to six named slices plus Other and a legend", async () => {
    const { renderToString } = await import("react-dom/server");
    const { Donut } = await import("../components/Donut");
    const { createElement } = await import("react");
    const board = await readBoard("bnb");
    const html = renderToString(createElement(Donut, { projects: board!.topProjects, label: "Top projects" }));
    const paths = (html.match(/<path /g) ?? []).length;
    expect(paths).toBe(7); // six named projects plus Other in the fixture
    expect(html).toContain("Other");
    expect(html).toContain("Ave.ai");
    expect(html).toContain("74.0%");
    expect(html).toContain('role="img"');
  });

  test("KpiCard renders the title, the number and a tooltip definition", async () => {
    const { renderToString } = await import("react-dom/server");
    const { KpiCard } = await import("../components/KpiCard");
    const { createElement } = await import("react");
    const html = renderToString(createElement(KpiCard, { id: "assets", title: "Total assets (USD)", definition: "Current value held in BNB, USDT, USDC.", value: "$10,398,708" }));
    expect(html).toContain("Total assets (USD)");
    expect(html).toContain("$10,398,708");
    expect(html).toContain('role="tooltip"');
    expect(html).toContain('id="tip-assets"');
    expect(html).toContain("BNB, USDT, USDC");
    expect(html).not.toContain("\u2014");
  });
});
