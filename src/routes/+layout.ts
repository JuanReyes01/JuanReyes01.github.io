// The whole site is a prerendered, static build (adapter-static, design
// "Technical Approach"). `trailingSlash: 'always'` matches every route path
// used across the design (`/work/`, `/field/`, ...); feeds and the 404 page
// override it to `'never'` where noted in the design.
export const prerender = true;
export const trailingSlash = 'always';
