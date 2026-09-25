import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/kore", "/kore/", "/api/", "/dashboard", "/projects", "/account", "/settings"],
      },
    ],
  };
}
