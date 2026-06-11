# Motion/UI Research Findings â€” Prana Production Console (React+Vite, monochrome industrial)

## 1. Spring physics in Motion (framer-motion) 2025/26

**F1.1 â€” Duration-based springs (`bounce` + `visualDuration`) are the modern default API.** `transition={{ type: "spring", visualDuration: 0.5, bounce: 0.25 }}` â€” `visualDuration` is the time at which the animation *visually appears* to land (the bouncy tail happens after), making springs coordinatable with timed animations (Recharts, CSS). `bounce` defaults to 0.25, range 0â€“1; it is **overridden if you set stiffness/damping/mass**. WHY: lets you keep one spring "feel" across the console while reasoning in seconds, not physics. Source: https://motion.dev/docs/react-transitions

**F1.2 â€” Recommended values per element class** (Emil Kowalski's rules, widely cited as the quality bar): micro-interactions 100â€“150ms; tooltips/dropdowns 150â€“250ms; modals/drawers 200â€“300ms; exits ~20% faster than entrances; buttons: `transform 160ms ease-out` + `scale(0.97)` on `:active` (keep scale subtle 0.95â€“0.98); modals keep `transform-origin: center`; **never animate keyboard-initiated actions** (repeated hundreds of times/day â€” directly relevant to operators). Translated to Motion springs: buttons `{type:"spring", visualDuration:0.15, bounce:0}`, nav lamp `{visualDuration:0.3, bounce:0.2}`, modals `{visualDuration:0.25, bounce:0.1}`, lists `{visualDuration:0.2, bounce:0}`. Sources: https://emilkowal.ski/ui/great-animations Â· https://animations.dev/ (course is PAID â€” the article is free)

**F1.3 â€” Rauno (interfaces.rauno.me) hard rules that match an industrial console:** interactions â‰¤200ms; press scale proportional to element (~0.96, never 0.8); do NOT animate frequent low-novelty actions ("deleting or adding items from a list", "hovering trivial buttons"); hover states only via `@media (hover: hover)` (critical for the touch tablets); box-shadow focus rings, not outline. Source: https://interfaces.rauno.me/

**F1.4 â€” Inertia/drag momentum** via `dragTransition`: `power` (default 0.8, deceleration distance), `timeConstant` (700), `min/max` boundaries with `bounceStiffness: 500`/`bounceDamping: 10`, and `modifyTarget: t => Math.round(t/50)*50` for **snap-to-grid** â€” directly useful for a draggable/pannable Gantt schedule (snap to day columns). Physics springs (stiffness/damping/mass) inherit gesture velocity, so a flicked Gantt feels physical. Source: https://motion.dev/docs/react-transitions

## 2. Number animation â€” NumberFlow

**F2.1 â€” Plain React+Vite: yes.** `npm i @number-flow/react`, `import NumberFlow from '@number-flow/react'`, `<NumberFlow value={123} format={{ notation:'compact' }} />`. Framework-agnostic core (React/Vue/Svelte/vanilla), built on `Intl.NumberFormat` + Web Animations API, **dependency-free**, single-digit-kB gzipped (~6â€“7kB per framework wrapper per README). Used by X (Twitter). Sources: https://number-flow.barvian.me/ Â· https://github.com/barvian/number-flow

**F2.2 â€” Digit-roll behavior + tuning:** each digit spins odometer-style; three independent timing channels â€” `transformTiming` (layout), `spinTiming` (digit roll), `opacityTiming` (char fade), all accepting WAAPI timing incl. `linear(...)` spring easings. `trend` prop: `+1` digits always ascend, `-1` descend, `0` bidirectional (use `+1` for produced-qty counters so increments always roll UP â€” semantically right for production counts). `<NumberFlowGroup>` syncs multiple counters; `isolate`, `willChange` props. `respectMotionPreference` defaults true (free a11y win); `useCanAnimate()` hook. Source: https://number-flow.barvian.me/

**F2.3 â€” CAVEAT for cheap tablets:** requires CSS `mod()` (Chrome 125+) and Declarative Shadow DOM (fallback documented). Verify the shop-floor Chrome version; if older, it renders static numbers (graceful) â€” test before shipping. Source: https://number-flow.barvian.me/

**F2.4 â€” Free alternative already in the bundle:** Motion `useSpring` counter â€” `const spring = useSpring(0, {visualDuration:0.4, bounce:0}); const display = useTransform(spring, v => Math.round(v).toLocaleString()); useEffect(()=>spring.set(value),[value]); <m.span>{display}</m.span>`. No per-digit roll (whole number tweens), but zero new deps. Source: https://motion.dev/docs/react-use-spring

## 3. View Transitions API in 2026

**F3.1 â€” Same-document VT is Baseline Newly Available (Oct 2025):** Chrome/Edge **111+**, Safari 18+, Firefox 133+. Cross-document VT is Chrome 126+ (irrelevant for a SPA). Shop-floor Chrome tablets are comfortably covered. Sources: https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API Â· https://rebeccamdeprey.com/blog/view-transition-api

**F3.2 â€” React 19 `<ViewTransition>` is still Canary/experimental ONLY (not in stable 19.x as of mid-2026)** â€” it activates only inside `startTransition`/`Suspense`/`useDeferredValue`, no router needed, but you'd have to run a canary build. **Do not adopt for this production app.** Source: https://react.dev/reference/react/ViewTransition

**F3.3 â€” The usable-today pattern (no router, no canary):** wrap the tab-state change in `document.startViewTransition` + `flushSync` so React commits synchronously inside the snapshot window:
```js
const switchTab = (tab) => {
  if (!document.startViewTransition) return setTab(tab);
  document.startViewTransition(() => flushSync(() => setTab(tab)));
};
```
Then pure CSS: `::view-transition-old(root){ animation: 150ms ease-out fade-out } ::view-transition-new(root){ animation: 200ms ease-out fade-slide-up }`; give the fixed header + tubelight nav `view-transition-name: header` so they DON'T cross-fade (stay static while content swaps). Gate with `@media (prefers-reduced-motion: reduce){ ::view-transition-group(*){ animation: none } }`. Sources: https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API/Using Â· https://www.trevorlasn.com/blog/view-transitions-api

## 4. Premium dark dashboard effects 2026

**F4.1 â€” Liquid glass: confirmed backlash, treat as seasoning not sauce.** NN/g's published analysis called Apple's Liquid Glass "restless, needy, less predictable, less legible"; translucency drops contrast below impaired-vision thresholds; Apple itself added an ultra-clearâ†’fully-tinted slider at WWDC 2026 to fix legibility. Implication for this app: the existing LiquidButton as the ONE glass accent is exactly the 2026 consensus â€” do not spread glass over data surfaces; keep panels opaque zinc. Sources: https://blog.logrocket.com/ux-design/apple-liquid-glass-ui/ Â· https://techcrunch.com/2026/06/08/apple-is-tweaking-its-controversial-liquid-glass-design/

**F4.2 â€” Film grain: static SVG `feTurbulence` overlay** (MagicUI "Noise Texture" component pattern): full-size fixed `<svg>` with `<feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4">`, `opacity: 0.03â€“0.05`, `pointer-events:none`, optionally `mix-blend-mode: overlay`. Kills the "flat black slab" feel of #0A0A0A at near-zero cost (it's a static texture â€” do NOT animate grain on cheap tablets). Source: https://magicui.design/docs/components/noise-texture

**F4.3 â€” Border-beam / shine for CRITICAL machine cards:** MagicUI BorderBeam animates a light dot along `offset-path: rect()` around the card border; ShineBorder is an animated border background. In grayscale: a **white beam orbiting a zinc border = "this machine is down"** â€” motion as the alarm channel instead of color, perfectly on-system (brightness=urgency). Free, copy-paste, Tailwind. Sources: https://magicui.design/docs/components/border-beam Â· https://magicui.design/docs/components/shine-border

**F4.4 â€” Cursor spotlight cards (the Linear/Vercel-style hover):** radial-gradient that follows the pointer via CSS vars. Best React implementation is BuildUI's: `useMotionValue` for x/y + `useMotionTemplate` â†’ `background: radial-gradient(300px at ${x}px ${y}px, rgba(255,255,255,0.06), transparent 80%)` on an absolutely-positioned overlay â€” updates outside React render, zero re-renders. Wrap in `@media (hover: hover)` so tablets never see a stuck spotlight. Note: repo already has `src/components/ui/spotlight-cursor.jsx` / `spotlight.jsx` â€” this is the card-local variant. Sources: https://buildui.com/recipes/spotlight Â· https://ibelick.com/blog/create-modern-spotlight-effect-with-react-css Â· https://cruip.com/how-to-create-a-spotlight-card-hover-effect-with-tailwind-css/

**F4.5 â€” Progressive blur + ambient glow (what Linear/Vercel/Arc actually do):** dark-FIRST design with low-opacity radial gradient glows for depth (Vercel = strict monochrome + single accent â€” the closest published analog to this app's system) and noise texture; progressive blur = stacked `backdrop-filter` layers with graduated masks (MagicUI Progressive Blur) â€” ideal as the sticky-header scrim over scrolling production tables (content melts under the header instead of hard-clipping). Sources: https://magicui.design/docs/components/progressive-blur Â· https://www.index.dev/blog/ui-ux-design-trends Â· https://gezar.dk/en/blog/web-design-trends-2026

## 5. CSS scroll-driven animations (June 2026)

**F5.1 â€” Support: ~85% global, NOT Baseline (Firefox still behind a flag; enabled in Nightly). Chrome/Edge have shipped `animation-timeline: scroll()/view()` since 115; Safari 26 shipped it.** For an internal app on Chrome tablets: **fully usable today** behind `@supports (animation-timeline: view())`. Compositor-driven = zero main-thread JS â€” a real win on cheap tablets vs. scroll listeners. Sources: https://caniuse.com/mdn-css_properties_animation-timeline_scroll Â· https://www.joshwcomeau.com/animation/scroll-driven-animations/ Â· https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Scroll-driven_animations

**F5.2 â€” Concrete uses here:** (a) header scrim/shadow that fades in only when the table scrolls: `animation: scrim linear both; animation-timeline: scroll(nearest)` with a 0â€“50px range; (b) row/card reveal: `animation: fade-up linear both; animation-timeline: view(); animation-range: entry 0% entry 40%;` â€” replaces `whileInView` JS for the long Loading/Sheet views. Source: https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Scroll-driven_animations/Timelines

**F5.3 â€” New in 2026: `animation-trigger`** (scroll-TRIGGERED play-once, vs scroll-SCRUBBED) landed in Chrome 145; Chrome/Edge-only as of May 2026 â€” progressive-enhancement only. Source: https://developer.chrome.com/blog/scroll-triggered-animations

## 6. Spline robot scene (login)

**F6.1 â€” Lazy-load is the documented pattern (likely already done â€” verify):** `const Spline = React.lazy(() => import('@splinetool/react-spline'))` inside `<Suspense>`; `renderOnDemand` prop defaults to `true` (renders frames only when the scene changes). Source: https://github.com/splinetool/react-spline/blob/main/README.md

**F6.2 â€” Runtime Application API (from `onLoad(spline)`):** `spline.stop()` â€” "Stop/Pause all rendering, controls and events"; `spline.play()` resumes; `spline.setBackgroundColor(cssColor)` â€” **yes, you can force pure-black `#000000` at runtime** without re-exporting the scene; `spline.setVariable(name, value)`; `setZoom(n)`; `findObjectByName(name)`. Pair `stop()/play()` with an `IntersectionObserver` + `document.visibilitychange` to pause the robot when the login screen is hidden/backgrounded â€” the single biggest CPU/battery win available. Sources: https://docs.spline.design/doc/code-api-for-web/docAaCtKnMkZ Â· https://www.npmjs.com/package/@splinetool/runtime

**F6.3 â€” Cursor-follow tuning + programmatic triggers:** cursor tracking is the scene's "Look At"/"Follow" event (damping/smoothing tuned in the Spline editor, not in React), but you can fire any scene event from code: `spline.emitEvent('mouseHover'|'lookAt'|'follow'|'start', 'ObjectName')`. On touch tablets there is no cursor â€” current lg+-only gating is correct; optionally `emitEvent('start','Robot')` for an idle loop on load. Source: https://github.com/splinetool/react-spline/blob/main/README.md

## 7. Micro-interactions for data-entry-heavy industrial use

**F7.1 â€” The governing numbers (NN/g):** 0.1s = feels instantaneous / direct manipulation (no extra feedback needed beyond the result appearing); 1.0s = flow-of-thought limit; with progress feedback users tolerate ~22.6s vs ~9s without. For operators logging 100s of entries/shift: **acknowledgment must land â‰¤100ms, which means optimistic UI, not server round-trips**, and the success animation must never block the next entry. Sources: https://www.nngroup.com/articles/response-times-3-important-limits/ Â· https://userpilot.com/blog/micro-interaction-examples/

**F7.2 â€” Optimistic UI pattern (rauno, verbatim):** "Optimistically update data locally and roll back on server error with feedback" + "Show a temporary inline checkmark on successful copy, not a notification" â€” i.e., for shift entry: append the row instantly, show an inline âœ“ next to the saved row, reconcile with Supabase in background; on failure, mark the row amber-bright + retry affordance. NO toast per entry. Source: https://interfaces.rauno.me/

**F7.3 â€” Frequency discipline (Emil + rauno, converging):** never animate keyboard-initiated submits (operators will Enter-key hundreds of times); don't animate list add/remove for frequent actions; keep what remains â‰¤150ms with ease-out; exits 20% faster. The 100th save must feel FASTER than the 1st, not "delightful". Sources: https://emilkowal.ski/ui/great-animations Â· https://interfaces.rauno.me/

**F7.4 â€” Checkmark morph + haptic-feel:** SVG draw-on with Motion: `<m.path d="M4 12l5 5L20 7" initial={{pathLength:0}} animate={{pathLength:1}} transition={{type:'spring', visualDuration:0.25, bounce:0}} fill="none" strokeWidth={2.5}/>` morphing the Save button label for ~600ms then reverting. Haptic-feel without haptics: instant press state on `pointerdown` (not click), `scale(0.97)` â‰¤120ms, `-webkit-tap-highlight-color: transparent` + custom pressed state (rauno). Real haptics ARE available on Android Chrome tablets via `navigator.vibrate(10)` on successful save â€” verify on the actual shop tablets (https://developer.mozilla.org/en-US/docs/Web/API/Navigator/vibrate). Sources: https://interfaces.rauno.me/ Â· https://motion.dev/docs/react-transitions

## 8. Genuinely new in plain CSS (Chrome)

**F8.1 â€” `linear()` spring easing:** all major browsers since Dec 2023 (~88%+). Generate spring curves as CSS: Jake Archibald-style generator presets (Spring/Bounce/Material) at https://linear-easing-generator.netlify.app, or https://www.kvin.me/css-springs, or the `spring-easing` npm lib (https://github.com/okikio/spring-easing). Lets the tubelight nav / buttons get spring feel with ZERO JS: `transition: transform 0.5s linear(0, 0.402 7.4%, 0.711 ... 1)`. Chrome DevTools can visualize/edit linear() stops. Sources: https://developer.chrome.com/docs/css-ui/css-linear-easing-function Â· https://www.joshwcomeau.com/animation/linear-timing-function/

**F8.2 â€” `@starting-style`:** CSS-only ENTRY animations for elements entering the DOM or leaving `display:none` (Chrome 117+, Safari 17.5+, Firefox 129+ â€” Baseline). Perfect for dropdowns/dialogs/inline âœ“ chips without AnimatePresence: `.chip { opacity:1; transition: opacity .15s, translate .15s; @starting-style { opacity:0; translate: 0 4px; } }` + `transition-behavior: allow-discrete` for display. Source: https://developer.chrome.com/docs/css-ui/animate-to-height-auto (covers the family) Â· https://css-weekly.com/transition-to-height-auto-display-none-using-pure-css

**F8.3 â€” `interpolate-size: allow-keywords` + `calc-size()`:** animate to `height: auto` natively â€” Chrome/Edge 129+ ONLY (no Safari/Firefox). One root rule `:root { interpolate-size: allow-keywords; }` makes accordions/expanding rows (`height: 0 â†’ auto`) transition in pure CSS; combined with `::details-content` you get zero-JS `<details>` accordions. Chrome-only is acceptable for this Chrome-tablet deployment as progressive enhancement. Sources: https://developer.chrome.com/docs/css-ui/animate-to-height-auto Â· https://caniuse.com/mdn-css_properties_interpolate-size Â· https://www.joshwcomeau.com/snippets/html/interpolate-size/

---

## TOP-8 RECOMMENDATIONS RANKED FOR THIS APP (all free)

1. **Spring token system via `visualDuration`/`bounce`** â€” define one motion vocabulary: button `{visualDuration:.15, bounce:0}`, nav lamp `{.3, .2}`, modal `{.25, .1}`, list `{.2, 0}`; exits 20% faster; NEVER animate Enter-key submits. Highest leverage, zero new deps. (motion.dev/docs/react-transitions, emilkowal.ski/ui/great-animations)
2. **Optimistic shift-entry loop**: instant local row append + inline SVG `pathLength` checkmark morph on the Save button + `pointerdown` press states + optional `navigator.vibrate(10)` on Android tablets; rollback row highlight on Supabase error. Directly serves the 100s-of-entries/shift users. (interfaces.rauno.me, nngroup.com response-times)
3. **NumberFlow on Dashboard KPIs** with `trend={+1}`, `<NumberFlowGroup>`, grayscale text â€” odometer rolls make live production counts feel alive in pure monochrome. GATE: verify shop-tablet Chrome â‰¥125 (`mod()` requirement). (number-flow.barvian.me)
4. **`document.startViewTransition` + `flushSync` for tab switches** (no router, no React canary): 150/200ms fade-slide with header/nav pinned via `view-transition-name`. Chrome 111+ tablets fully covered; feature-detect fallback is one line. Do NOT adopt React `<ViewTransition>` (canary-only). (MDN View Transition API, react.dev/reference/react/ViewTransition)
5. **CSS scroll-driven `view()`/`scroll()`** behind `@supports`: header scrim fade + row reveals on Loading/Sheet views â€” replaces JS scroll listeners with compositor work, ideal for cheap tablets. (developer.mozilla.org Scroll-driven_animations, joshwcomeau.com)
6. **Spline hygiene**: keep `React.lazy`, add IntersectionObserver/`visibilitychange` â†’ `spline.stop()/play()`, and `spline.setBackgroundColor('#000000')` in `onLoad` to guarantee the pure-black match. (docs.spline.design code-api, react-spline README)
7. **BorderBeam (white-on-zinc) as the CRITICAL-machine alarm channel** on Machine Fleet cards â€” motion replaces color for urgency, exactly on-system. Pair with static `feTurbulence` grain at 3% opacity on the shell. (magicui.design border-beam, noise-texture)
8. **Zero-JS CSS polish layer**: `linear()` spring easing on hover/press, `@starting-style` for dropdown/chip entries, `interpolate-size: allow-keywords` for expanding rows/accordions â€” Chrome-tablet-safe progressive enhancement costing 0 bundle bytes. (developer.chrome.com css-linear-easing-function + animate-to-height-auto)

**Anti-recommendations:** don't expand liquid-glass surfaces (NN/g legibility backlash; keep LiquidButton as the single accent); don't add colorful aurora gradients (violates grayscale system); don't animate grain or per-row list mutations (tablet perf + Rauno frequency rule); cursor spotlight only inside `@media (hover: hover)`.
