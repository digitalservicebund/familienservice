import type { Schema, Struct } from '@strapi/strapi';

export interface FaqFaqEintrag extends Struct.ComponentSchema {
  collectionName: 'components_faq_faq_eintrags';
  info: {
    displayName: 'FAQ-Eintrag';
    icon: 'bulletList';
  };
  attributes: {
    antwort: Schema.Attribute.Blocks & Schema.Attribute.Required;
    frage: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

declare module '@strapi/strapi' {
  export namespace Public {
    export interface ComponentSchemas {
      'faq.faq-eintrag': FaqFaqEintrag;
    }
  }
}
