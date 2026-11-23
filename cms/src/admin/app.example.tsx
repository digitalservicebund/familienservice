import type { StrapiApp } from "@strapi/strapi/admin";

export default {
  config: {
    locales: [
      "de",
      // Full list of available locales is accessible on
      // https://github.com/strapi/strapi/blob/v4.0.0/packages/plugins/i18n/server/constants/iso-locales.json
    ],
  },
  bootstrap(app: StrapiApp) {
    console.log(app);
  },
};
