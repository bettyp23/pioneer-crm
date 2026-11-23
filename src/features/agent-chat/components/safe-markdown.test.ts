import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SafeMarkdown, safeUrl } from "./safe-markdown";

const html = (md: string) => renderToStaticMarkup(createElement(SafeMarkdown, null, md));

describe("SafeMarkdown", () => {
  it("renders basic markdown", () => {
    expect(html("**Done** and _done_")).toContain("<strong>Done</strong>");
  });
  it("never renders raw HTML", () => {
    const out = html('<script>alert(1)</script><img src=x onerror="alert(1)"><b>bold</b>');
    expect(out).not.toContain("<script");
    expect(out).not.toContain("<img");
    expect(out).not.toContain("onerror");
    expect(out).not.toContain("<b>");
  });
  it("drops markdown images (no tracking pixels)", () => {
    expect(html("![x](https://tracker.test/p.gif)")).not.toContain("<img");
  });
  it("neutralises javascript: and data: links", () => {
    expect(html("[click](javascript:alert(1))")).not.toContain("javascript:");
    expect(html("[click](data:text/html,hi)")).not.toContain("data:");
  });
  it("opens safe links in a new tab without opener or referrer", () => {
    expect(html("[site](https://example.test)")).toContain(
      'href="https://example.test" target="_blank" rel="noopener noreferrer nofollow"',
    );
  });
  it("allows only http(s) and mailto", () => {
    expect(safeUrl("https://x.test")).toBe("https://x.test");
    expect(safeUrl("mailto:a@b.test")).toBe("mailto:a@b.test");
    expect(safeUrl("vbscript:x")).toBe("");
  });
});
