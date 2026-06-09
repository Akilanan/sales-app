# Research Synthesis — Design Direction for the Prana Rebuild

> Distilled from 5 full reference reads + web research. Locked before the rebuild so it survives context compaction. Use this + the full 621-corpus analysis to drive the from-scratch UI rebuild.

## The gold standard (what "best" looks like for this product)
- **Linear "midnight command deck"** — near-black canvas, razor-thin/precise type, **ONE accent rationed to a single primary action per screen**, used "like a status light." Cards gain presence from **1px inset borders + soft shadows, NOT fills**. (validates the Tactical cyan + edge-light system)
- **Vercel Geist** — **dark-first** is the canonical surface (light is the alternate). Restraint as a feature: color is **punctuation**, not decoration. **Tabular mono numerals** everywhere = "engineering-grade." Consistent command-bar/dialog vocabulary (primary / secondary / escape). ⚠ Lifting Geist whole reads as "Vercel-clone" — must carry our own identity (cyan, not Geist-blue; our motifs).
- **Brand DESIGN.md neighbors worth mining** (getdesign.md): **Sentry** (data-dense dark, pink-purple), **Kraken** (purple data-dense dark dashboards), **VoltAgent** (void-black + emerald, terminal-native), **Supabase** (dark emerald), **ClickHouse** (yellow technical), **Warp** (dark IDE, block-based). These are the closest cousins to a data-dense dark ops console.

## Structure (from dashboard-patterns + manufacturing research)
- **Sidebar nav is the strongest dashboard pattern** (Linear/Vercel/Notion): expanded **256px**, collapsed **64px icon rail**, 200ms width transition. Active = **bg tint at ~8% accent + accent text** (NOT a thick side-stripe — Impeccable-safe; a 2px nav indicator is the max). Items 36px desktop / **44px for tablet**. → Consider replacing Prana's top-nav with a collapsible sidebar (command-deck feel). Caveat: only 3 views + shop-floor tablets, so keep it tablet-first and collapsible.
- **KPI strip**: 4–6 cards, each = **one number (28–32px) + one comparison + ONE visual (sparkline OR bar OR arrow — never all three)**. CSS grid `auto-fill, minmax(200px,1fr)`. (Prana's 4 tiles already match.)
- **Content grid**: 12-col, 24px gutters. chart+table = span 7 + span 5.
- **States are mandatory**: **skeleton (not spinner)** loaders shaped like the component, **empty** = illustration + one sentence + CTA, **error** = inline banner + retry (NOT full-page modal), component-level error boundaries.
- **Dense tables**: sticky header, rows 48–52px (comfortable) / 36–40px (dense), **left-text / right-numbers / center-badges**, sort indicators.

## The big idea: ACTIVE, not passive ("Command Center, not a TV")
- Best factory dashboards are **Active** — "click the problem → start the fix" (Fabrico Click-to-Fix). Passive "wallpaper" dashboards that turn red but connect to nothing are useless.
- → Make Prana's dashboard **actionable**: clicking a behind-pace component drills into its breakdown / lets you add a note or flag; the glance answers "are we winning the shift?" Operators get status+alerts, managers get bottlenecks. (Role-based already done.)

## Locked design principles for the rebuild
1. **Reserve the accent** (cyan) to ONE primary action + status signal per screen. Steel for neutral, status hues for production state only.
2. **Dark-first, near-black, edge-light depth** (white insets, not black shadows). No fills for hierarchy.
3. **Tabular mono numerals** for all data (JetBrains Mono) = engineering-grade; readable sans for prose.
4. **Sharp, restrained, dense** — density is a feature for power users; whitespace is rationed.
5. **Active over passive** — every element earns its pixels by enabling a decision or action.
6. **Carry our own identity** — cyan + crosshair/`//BLOCK` motifs + the matte-steel 3D, so it reads "Prana," not "Vercel-clone."
7. **All states shipped** — skeleton/empty/error, full interaction states, a11y AA, reduced-motion, ≥44px tablet targets.

## Open decision for the rebuild (decide with corpus analysis)
- **Sidebar vs top-nav** — research says sidebar; but 3 views + tablets argue for a refined top rail OR a slim collapsible sidebar. Lean: slim collapsible left rail (icon+label, 44px, cyan active) for the command-deck feel, top bar kept for brand + user/logout + live status.
- **Exact accent** — cyan (#5EE7FF/#34D2EC) is current; corpus analysis may surface a stronger signal hue (emerald like VoltAgent/Supabase, or keep cyan). Decide from the full 621 + fit.
