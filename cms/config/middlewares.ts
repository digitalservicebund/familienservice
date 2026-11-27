import type { Core } from "@strapi/strapi";

const config: Core.Config.Middlewares = [
  "strapi::logger",
  "strapi::errors",
  "strapi::security",
  "strapi::cors",
  "strapi::poweredBy",
  "strapi::query",
  // The BAFzA import posts a whole dump in one request (default limit is 1 MB)
  { name: "strapi::body", config: { jsonLimit: "20mb" } },
  "strapi::session",
  "strapi::favicon",
  "strapi::public",
];

export default config;
