import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Só a home é pública; painel e login ficam de fora (ver robots.ts).
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: SITE_URL, changeFrequency: "weekly", priority: 1 }];
}
