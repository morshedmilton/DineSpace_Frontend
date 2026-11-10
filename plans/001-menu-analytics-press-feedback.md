# 001 — Add restrained press feedback to menu and analytics controls

- **Status**: TODO
- **Commit**: ba7fc86
- **Severity**: LOW
- **Category**: Physicality & origin
- **Estimated scope**: 4 files, approximately 20–30 lines changed

## Problem

Frequently used menu and analytics controls already indicate hover, selection, and keyboard focus, but have no tactile press response. Their existing `transition-colors` classes animate color changes only. Add a brief, consistent scale response to interactive buttons and links without animating list content or delaying actions.

Current examples:

```tsx
// src/app/home/menu/page.tsx:224 — current
<Link
  href="/home/menu/analytics"
  className="inline-flex h-fit w-fit items-center gap-2 rounded-[10px] border border-[#dec0ba] bg-white px-3 py-2 text-sm font-medium text-[#654f48] transition-colors hover:border-[#A13924] hover:text-[#A13924]"
>
```

```tsx
// src/components/MenuCard.tsx:78 — current
<button
  type="button"
  role="switch"
  aria-checked={Boolean(item.isAvailable)}
  aria-label={`${item.isAvailable ? "Mark" : "Make"} ${item.itemName} ${item.isAvailable ? "unavailable" : "available"}`}
  onClick={() =>
    onAvailabilityChange(!item.isAvailable, item.id)
  }
  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A13924] focus-visible:ring-offset-2 ${
    item.isAvailable ? "bg-[#A13924]" : "bg-[#b7aaa5]"
  }`}
>
```

```tsx
// src/components/home/menu/analytics.tsx:302 — current
<button
  type="button"
  onClick={() => setRefreshVersion((version) => version + 1)}
  disabled={loading || !defaultRestaurant}
  aria-busy={loading}
  className="inline-flex items-center gap-2 rounded-lg border border-[#dec0ba] bg-white px-3 py-2 text-sm font-semibold text-[#654f48] transition-colors hover:border-[#A13924] hover:text-[#A13924] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A13924] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-55"
>
```

The same color-only pattern is used for the menu availability/category/price filters, item edit/delete actions, analytics date presets, and performance sort controls. The analytics page already has a reduced-motion-aware entrance; keep it unchanged.

## Target

Add a reusable `.menu-pressable` class in `src/app/globals.css`. Its normal state should preserve the current color feedback while adding a short transform transition:

```css
:root {
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
}

.menu-pressable {
  transition:
    transform 160ms var(--ease-out),
    color 150ms ease,
    background-color 150ms ease,
    border-color 150ms ease;
}

.menu-pressable:active:not(:disabled) {
  transform: scale(0.97);
}

@media (prefers-reduced-motion: reduce) {
  .menu-pressable {
    transition:
      color 150ms ease,
      background-color 150ms ease,
      border-color 150ms ease;
  }

  .menu-pressable:active:not(:disabled) {
    transform: none;
  }
}
```

Apply `menu-pressable` to the Menu analytics and Add Menu Item links, the menu availability/category/price controls, each menu card's availability/edit/delete controls, the analytics Refresh button, date-range preset buttons, retry button, and performance sort buttons. Replace their `transition-colors` utility where needed so it does not override the shared transition. Keep existing hover, focus-visible, selected, disabled, and switch-knob transition classes/behavior intact. Do not animate search input typing or any data/list entrance, exit, or reordering.

## Repo conventions to follow

- Shared CSS is in `src/app/globals.css`; its `:root` currently contains the background and foreground tokens.
- The analytics component uses Motion's full `transform` string and `useReducedMotion()` for its existing page entrance. Preserve this pattern and its current behavior; this plan adds CSS feedback to controls only.
- Existing controls use semantic buttons/links, Tailwind utility classes, `aria-pressed`/`role="switch"`, and visible focus rings. Add the shared class without changing semantics or action handlers.
- Follow `AUDIT.md`: button press feedback is `scale(0.97)` with a `160ms ease-out` transition; reduced motion removes movement while retaining color feedback.

## Steps

1. In `src/app/globals.css`, add the shared `--ease-out` token and `.menu-pressable` rules exactly as specified under **Target**.
2. In `src/app/home/menu/page.tsx`, apply `menu-pressable` to the analytics/add links and the availability, category, and price-sort buttons. Keep the search field and its focus behavior unchanged.
3. In `src/components/MenuCard.tsx`, apply `menu-pressable` to the availability switch button and edit/delete controls. Leave the switch knob's existing `transition-transform` intact.
4. In `src/components/home/menu/analytics.tsx`, apply `menu-pressable` to Refresh, retry, date-preset, and performance-sort buttons. Keep date inputs and the page-level Motion entrance unchanged.
5. Confirm all affected controls retain their existing class-driven color, selected, disabled, and focus states.

## Boundaries

- Do NOT change API calls, analytics data, calculations, date-range behavior, sort behavior, or control labels.
- Do NOT add animations to menu cards, analytics data, chart/table rows, filtering results, or page loading states.
- Do NOT add hover transforms, stagger, springs, JavaScript animation state, or dependencies.
- Do NOT remove the existing reduced-motion-aware analytics page entrance or the switch knob's transition.
- If the cited control structure or classes have materially changed since commit `ba7fc86`, stop and report the drift rather than broadening the changes.

## Verification

- **Mechanical**: Run the frontend ESLint command for `src/app/home/menu/page.tsx`, `src/components/MenuCard.tsx`, and `src/components/home/menu/analytics.tsx`; run the frontend TypeScript check. Expect no lint or type errors.
- **Feel check**: Run the app and press the menu analytics/add links, category/availability/price controls, a menu-card switch/edit/delete control, and analytics date, sort, refresh, and retry buttons. Confirm each responds immediately with one subtle press and that no action waits for animation completion.
- In DevTools, set animation playback to 10% and confirm the press is transform-only, scales no smaller than `0.97`, and returns without a delayed or restarted keyframe.
- Toggle `prefers-reduced-motion: reduce`; confirm the press transform is absent while existing color/selection feedback remains.
- Confirm hover, keyboard focus rings, disabled Refresh behavior, and the menu switch knob animation still work.
- **Done when**: Every listed control has consistent press feedback, reduced motion removes only the movement, and all existing actions and visual states are preserved.
