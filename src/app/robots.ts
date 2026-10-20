import type { MetadataRoute } from "next";

// Private system: nothing is indexable (docs/security.md §8).
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
