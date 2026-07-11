import { useEffect } from 'react';

interface PageMeta {
  title: string;
  description: string;
  image?: string;
  url?: string;
}

/**
 * Sets document meta tags for SEO.
 * Works for SPA by manipulating DOM directly.
 * For full SSR, migrate to react-helmet-async provider.
 */
export function usePageMeta(meta: PageMeta) {
  useEffect(() => {
    document.title = meta.title ? `${meta.title} | VNShop` : 'VNShop';

    const setMeta = (property: string, content: string) => {
      let el = document.querySelector(`meta[property="${property}"]`)
        ?? document.querySelector(`meta[name="${property}"]`);
      if (!el) {
        el = document.createElement('meta');
        if (property.startsWith('og:')) {
          el.setAttribute('property', property);
        } else {
          el.setAttribute('name', property);
        }
        document.head.appendChild(el);
      }
      el.content = content;
    };

    setMeta('description', meta.description);
    setMeta('og:title', meta.title);
    setMeta('og:description', meta.description);
    setMeta('og:type', 'website');
    if (meta.image) setMeta('og:image', meta.image);
    if (meta.url) setMeta('og:url', meta.url);
  }, [meta.title, meta.description, meta.image, meta.url]);
}
