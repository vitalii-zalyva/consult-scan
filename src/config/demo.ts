/** DM-101: public demo build (Vercel), selected with VITE_PUBLIC_DEMO=1. Spec: specs/014-public-demo/spec.md */

export const PUBLIC_DEMO = import.meta.env.VITE_PUBLIC_DEMO === "1";
