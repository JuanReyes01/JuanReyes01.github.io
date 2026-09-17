// The whole site is a prerendered, static build (adapter-static). Full shell
// logic (theme, TabBar, skip link, data-section) lands in the design-system
// PR; this minimal flag is what makes the toolchain scaffold buildable.
export const prerender = true;
