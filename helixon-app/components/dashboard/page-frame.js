// Two page widths, so content doesn't jump sideways between pages: "wide"
// for lists, boards and dashboards, "narrow" for a single record, a form or
// settings. `Page` (./ui.jsx) takes the name; pages that build their own frame
// use the matching class.
export const PAGE_WIDTHS = { wide: 1400, narrow: 1000 };
export const PAGE_FRAME_WIDE = "mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-8 lg:py-10";
export const PAGE_FRAME_NARROW = "mx-auto max-w-[1000px] px-4 sm:px-6 lg:px-8 py-8 lg:py-10";
