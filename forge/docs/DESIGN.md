# FORGE design system and accessibility

## Layout
- **Workspaces**: Home · Learn, then **Build**, **See inside & control**, **Measure**, **Operate**. Every page shows a breadcrumb
  (Home › workspace) and its workspace's sibling pages as tabs; the page kicker names the workspace.
- **Model Hub** (Operate): one page per model — identity and capabilities, best measured scores with ranges, bench results,
  trained adapters (practice and sealed-test results), studies, variants and GGUF exports, and next actions.
- **Inspector** (top bar "Inspect", or press `.`): the active study (stages, headline results with ranges, test adequacy,
  next step) and the active model, from any page.
- **Simple / Expert** mode hides or shows the expert pages; nothing is removed, only hidden.

## Results, always the same way
- **Score**: a rate is never shown alone — always with its 95 % range bar, the range in numbers, and k/n.
- **RangeBar**: the compact form in tables; screen readers hear "72%, 95% range 60% to 81%".
- **Limits** ("What this doesn't show"): the standard honesty block on every results page.
- **Provenance tag** on every panel: measured · computed · declared · estimate · illustration.
- **Figure**: every chart has a title, axis titles with units, a legend and a caption.
- **Status** always pairs colour with an icon and a word, so it never relies on colour alone.

## Colour
Text tokens meet WCAG AA (≥ 4.5:1) on every surface in both themes (tertiary text `#666863` light / `#8c9089` dark; teal
accent `#0c736a` light). Series colours (teacher / base / tuned and the categorical palette) are validated for colour-blind
separation; when they are used as text they are mixed 55 % toward the text colour so they also pass AA. High-contrast mode
darkens lines and secondary text further.

## Accessibility (WCAG 2.2 AA)
- Automated audit of all 23 pages in light and dark (`node frontend/scripts/a11y-audit.cjs`): **0 violations** at release.
- Every scrolling panel is keyboard-focusable and named after its panel; every chart has an accessible name; targets ≥ 24 px;
  focus rings on every control; skip link; reduced motion honoured; the inspector and dialogs close with Escape.
- Not covered by the automated audit: screen-reader walk-throughs with NVDA / JAWS and full keyboard-only task
  completion — recommended before wider rollout.

## Print
Printing any page hides navigation, controls and unselected tabs, expands scrolling panels and prints ink on white —
model cards, results and bench tables print as documents.
