/** Accessibility helpers applied app-wide.
 *  Scrollable regions: every element that actually scrolls gets tabindex=0 and an accessible name (from its panel title),
 *  so keyboard users can reach and scroll it (WCAG 2.1.1 / axe "scrollable-region-focusable"). */
function label(el: HTMLElement): string {
  const panel = el.closest("section");
  const title = panel?.querySelector("h2, h3, [data-panel-title]")?.textContent?.trim();
  return title ? `${title} (scrollable)` : "Scrollable content";
}

function mark(root: ParentNode) {
  root.querySelectorAll<HTMLElement>(".overflow-auto, .overflow-x-auto, .overflow-y-auto, [class*='fit:overflow-auto'], [class*='overflow-auto']").forEach((el) => {
    if (el.hasAttribute("data-scroll-focus")) return;
    const scrolls = el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1;
    if (!scrolls) return;
    el.setAttribute("data-scroll-focus", "");
    if (!el.hasAttribute("tabindex")) el.tabIndex = 0;
    if (!el.hasAttribute("aria-label") && !el.hasAttribute("aria-labelledby")) {
      el.setAttribute("role", el.getAttribute("role") ?? "region");
      el.setAttribute("aria-label", label(el));
    }
  });
}

export function installA11y(): void {
  let pending = false;
  const run = () => { pending = false; mark(document); };
  const schedule = () => { if (!pending) { pending = true; requestAnimationFrame(run); } };
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  window.addEventListener("resize", schedule);
  schedule();
}
