import { describe, expect, it } from "vitest";
import { editorRobotsTag, ROBOTS_TXT } from "../src/seo";

describe("robots.txt", () => {
  it("POST 専用の /api/ をクロールさせない", () => {
    expect(ROBOTS_TXT).toMatch(/^User-agent: \*$/m);
    expect(ROBOTS_TXT).toMatch(/^Disallow: \/api\/$/m);
  });

  it("エディタやアイコンまでは塞がない (noindex を読ませるため)", () => {
    expect(ROBOTS_TXT).not.toMatch(/^Disallow: \/$/m);
  });
});

describe("editorRobotsTag", () => {
  it("トップは索引させる", () => {
    expect(editorRobotsTag("/")).toBeNull();
    expect(editorRobotsTag("")).toBeNull();
  });

  it("状態付きのエディタ URL は noindex", () => {
    expect(editorRobotsTag("/random/")).toBe("noindex");
    expect(
      editorRobotsTag(
        "/bg-3d4616/fg-f0f6e3/countup/date-2026-06-28/~%E3%81%8B%E3%82%89%7Bd%7D%E6%97%A5%E7%B5%8C%E9%81%8E",
      ),
    ).toBe("noindex");
    expect(editorRobotsTag("/hoge")).toBe("noindex");
  });
});
