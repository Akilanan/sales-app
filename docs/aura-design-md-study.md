# Aura `DESIGN.md` Library — Complete Study

> Source studied: **https://www.aura.build/design-systems** (and supporting `/learn` pages)
> Method: live render via real browser (firecrawl was out of credits; page is a client-rendered Next.js SPA so plain fetch returns only the title). Captured Jun 8, 2026.
> Why this matters for us: this is the canonical reference for the **"design system as reusable AI prompt context"** pattern. It maps directly onto our **"Cold Steel + Electric Signal"** Prana system — see `PRANA-DESIGN.md` for our system rewritten in this exact format.

---

## 1. What the page is (the one-line thesis)

Aura is an **AI landing-page / website builder** ("Trusted by 177,000+ users"). The `/design-systems` page is its **`DESIGN.md` Library**: a public gallery of **design-system files** that you attach to an AI prompt so the generated UI inherits a consistent typography / color / spacing / motion language instead of looking generic.

Hero copy, verbatim:
- Eyebrow: **`DESIGN.MD LIBRARY`**
- H1: **"Design systems that become prompt context"**
- Sub: *"Upload or write DESIGN.md files for typography, colors, spacing, components, motion, and style rules. Aura turns those systems into reusable context for stronger generated UIs."*
- Two CTAs: **`Add DESIGN.md`** · **`Import from Templates`**

The mental model: a `DESIGN.md` is a **portable style contract**. The same idea works in *any* AI coding tool (Claude Code, Cursor, ChatGPT, Gemini) — you `@`-reference the file and the model honors it.

---

## 2. Page anatomy, top to bottom (nothing skipped)

### 2.1 Global nav (sticky top)
`CREATE` → `/create` · `TEMPLATES` → `/browse/components` · `COMPONENTS` → `/components` · `ASSETS` → `/assets` · `SKILLS` → `/skills` · `DESIGN.MD` → `/design-systems` (current) · `LEARN` → `/learn/introduction` · `PRICING` → `/pricing` · `SIGN IN` → `/signin`

### 2.2 "LIBRARY PULSE" stat block
| Stat | Value |
|---|---|
| systems | **621** (Updated Jun 8, 2026) |
| COLORS | **4988** |
| TYPE | **1860** |
| SPACING | **2530** |

(These are aggregate token counts across the library — i.e. ~5k color tokens, ~1.9k type tokens, ~2.5k spacing tokens defined across all 621 systems.)

### 2.3 Sort / filter controls
Four tabs: **`RANDOM` · `POPULAR` · `RECENT` · `A-Z`**. Below them a counter: **"Showing 100 of 621"**.

### 2.4 The card grid (100 cards per page)
Each card is `<a href="/design-systems/{slug}">` and shows, in order:
1. **Display font preview** — e.g. `Inter / 64px` labelled **Display Lg**
2. **Body font preview** — e.g. `Inter / 16px` labelled **Body Md**
3. **Name** (the system title, an `<h2>`)
4. **Author** (links to `/{handle}`)
5. **A number** (the system's remix/usage count)

The visible font preview is the fastest "what does this feel like" signal. The library is overwhelmingly **Inter** for display, with deliberate exceptions that define each card's character: Instrument Serif, Cormorant Garamond, Playfair Display, Newsreader, Cinzel, DM Mono, JetBrains Mono, Geist, Manrope, Plus Jakarta Sans, Barlow Condensed, BlinkMacSystemFont / "System Font".

### 2.5 Pagination
**`Load 100 more`** button — pages through all 621 in 100-card batches.

### 2.6 Footer
Tagline: *"AI landing page builder that creates stunning designs in seconds. No design skills needed. Export to HTML & Figma. Trusted by 177,000+ users worldwide."*
- **PRODUCT**: Create · Templates · Components · Assets · Pricing · Changelog
- **RESOURCES**: Introduction · How to Prompt · How to Edit · SEO Settings · Sell Templates · Affiliates · FAQ
- **WHAT WE USE**: Mobbin · Screen Studio · Courses · UI Kit · Video Editor · Mockups
- **CONNECT**: Privacy · Terms · Support · Report Issue · LinkedIn · X
- *"© 2026 Aura. All rights reserved. Made with Cursor."*

---

## 3. The `DESIGN.md` detail page (anatomy of one system)

URL pattern: `/design-systems/{slug}`. Layout:
- Top bar: **`Back to design systems`** · **`Prev` / `Next`** (walk the gallery) · **`Add to Prompt`** (the money button — injects this file into your generation context)
- Two view tabs: **`DESIGN.md`** (the style contract) and **`HTML`** (the reference build it was derived from)
- Filename shown, e.g. `aura-systems-core-infrastructure-1-DESIGN.md`, plus a **`Featured`** badge
- **HTML Preview** of the actual rendered section (the "source of truth")
- **DESIGN.MD** panel titled *"Prompt context source"* = a **frontmatter token table** (§4.1)
- Below it the **rendered Markdown body** (§4.2)
- **AUTHOR** card at the bottom

**Data model (the page fetches its own public Supabase REST API).** Each system is a row with columns:
`id, slug, title, description, content, preview_html, preview_file_name, thumbnail_url, source_name, views, forks, private, featured, created_by, created_at, updated_at`.
- `content` = the raw `DESIGN.md` text · `preview_html` = the raw reference HTML · `forks` = the remix count on the cards.
- Takeaway for us: a "design system" here is literally **one Markdown doc + one reference HTML file**, stored as data and `private` toggle-able. Cheap, portable, versionable.

---

## 4. The `DESIGN.md` schema (the important part)

Every file is **YAML frontmatter (design tokens) + a Markdown body (prose guidance), ending in Guardrails.** The section skeleton is identical across all systems; only the *values* change. This consistency is the whole point — it's a fill-in-the-blanks contract.

### 4.1 Frontmatter token groups
```yaml
version:      "neuform-top-creators-featured"   # collection tag (also: neuform-staff-featured-2026-05-22)
name:         "Aura Systems"
description:  "…what the section is for + key features + where it's suitable…"

colors:                        # token group
  primary:        "#F97316"
  secondary:      "#FFFFFF"
  accent:         "#EA580C"
  background:     "#FFFFFF"
  surface:        "#FFFFFF"
  text-primary:   "#111827"
  text-secondary: "#4B5563"
  border:         "#E5E7EB"

typography:                    # token group
  display-lg: { … }            # e.g. Inter / 64px
  body-md:    { … }            # e.g. Inter / 16px
  label-md:   { … }            # mono — JetBrains Mono for metadata

spacing:                       # token group  (NEARLY CONSTANT across the whole library)
  base:            "8px"
  gap:             "16px"
  card-padding:    "24px"
  section-padding: "80px"

rounded:                       # token group  (this VARIES — it carries a lot of the "feel")
  card:    "20px"              # Aura 20 · Solstice/RetroOS/AuraDS 8 · CLI 9999 (pill cards) · Tactical 2 (sharp)
  control: "20px"
  pill:    "9999px"

components:                    # token group
  card:   { … }
  button: { … }
```
> Note: in the public UI the nested `display-lg`/`body-md`/`card`/`button` groups render as collapsed "token group" rows — the exact weight/line-height values live only in the raw `content` column. The meaningful values (font family + the 64px/16px scale) are surfaced via the card preview and the prose.

### 4.2 Markdown body — the fixed section skeleton
1. **Header line** — `Source: … Author: … (@handle). Views: N; favorites: N; remixes: N. Tags: …`
   Tags are the real driver: `dashboard, animated, webgl, threejs, cta, dither, charts, security, login, form, bento, feature, input, validation, effect …`
2. **Overview** — the description + a literal snippet of the reference's hero copy.
3. **Composition** — *"Use the attached HTML reference as the source of truth. Preserve the visible hierarchy, first-screen composition, section rhythm, density, and interaction tone before adapting copy or content."* + lists the **key visible headings**.
4. **Colors** — *"Anchor the palette in primary … Keep background, surface, text, and border roles distinct so generated layouts retain the same contrast pattern as the source."*
5. **Typography** — *"Use {DisplayFont} for display moments and {BodyFont} for body copy … Labels and technical metadata should use JetBrains Mono or an equivalent mono face."*
6. **Layout** — *"Keep spacing deliberate and stable. Favor the same grid direction, max-width behavior, card density, and responsive stacking. Do not replace distinctive source structures with generic SaaS sections."*
7. **Components** — varies by tag:
   - dashboard/feature → *"Dashboard, chart, and data panels should preserve their compact operational hierarchy, nested surfaces, and metric emphasis."*
   - login/auth → *"Authentication and CTA controls should preserve the source button hierarchy, input density, and focused conversion path."*
   - form/component → *"Cards, buttons, badges, navigation … preserve the source geometry, border treatment, and hover feel."*
8. **Motion** — *"Preserve existing motion cues such as masked reveals, staggered entrance, hover lift, scroll-triggered transitions, and ambient movement. Keep easing smooth and restrained."*
9. **WebGL & Effects** — *"If the source includes canvas, WebGL, Three.js, gradients, particles, or atmospheric effects, rebuild them as supporting layers behind the content. Keep effects performant, responsive, and secondary to the interface."*
10. **Guardrails** (4 hard "don'ts", identical everywhere):
    - Do not flatten the source into a generic card grid.
    - Do not swap the color mode unless the source clearly supports it.
    - Preserve the first viewport signal, focal object, and visual density.
    - Keep buttons, cards, and badges aligned to the same radius and border language.

---

## 5. Six real systems studied in full (the range)

| # | System | Display / Body | Palette signature | `rounded.card` | Character |
|---|---|---|---|---|---|
| 1 | **Aura Systems \| Core Infrastructure** (430 forks) | Inter / Inter (+JetBrains Mono labels) | primary `#F97316` orange on white, ink `#111827` | 20px | Light SaaS dashboard, telemetry rings, dither/WebGL |
| 2 | **Solstice Ventures** | **Instrument Serif** / Inter | primary `#FFB07C` on oxblood `#34222A` / surface `#2D0F14` | 8px | Dark luxe editorial, serif headline, warm |
| 3 | **Retro OS Landing** | Inter / **Playfair Display** | coral `#FF9A9E` + amber `#FFBD2E` on parchment `#E5E2D8` | 8px | Retro-computing, warm light, serif *body* |
| 4 | **CLI Dashboard – JetBrains Emerald** | Inter / Inter | emerald `#10B981` / accent `#065F46` on `#1E1E1E` IDE grey | **9999px** (pill cards) | Terminal / IDE auth screen |
| 5 | **Tactical Intelligence Platform** | **JetBrains Mono / JetBrains Mono** | cyan `#5EE7FF` + violet `#8B5CF6` on near-black `#020202` | **2px** (sharp) | Full-mono "ops console", high-tech |
| 6 | **Aura Design System** | Inter / Inter | teal `#14B8A6` on `#042F2E` / bg `#E5E7EB` | 8px | The canonical "style guide" system (Core Logic, Grid, Color Science, Motion Logic) |

**Constant across all six:** `spacing` (8/16/24/80), `pill: 9999px`, the mono-for-labels rule, the entire prose skeleton, and the 4 Guardrails. **Variable (where identity lives):** the 8 color roles, the display/body font pairing, and the `rounded.card` radius. That's the lesson — **a strong system is mostly a disciplined palette + a font pairing + a radius language + non-negotiable guardrails.**

Authorship note: the library is largely seeded by the Aura / DesignCode team — **Meng To (@mengto)**, the Phomhome family (Sourasith / Sourany / Aksonvady), Sakura DesignCode, Samnang Aing, Sam. "Neuform" is Aura's internal generator/format name.

---

## 6. How these are actually used (from `/learn`)

Aura's whole pedagogy is built around `DESIGN.md`. Lessons:
- *"DESIGN.md Changed My AI Web Design Workflow"*, *"Why This DESIGN.md File Made My AI Design Look So Much Better"*, *"Building Animated WebGL Landing Pages with Gemini 3.1 Pro + design.md"*, *"Building Better Landing Pages with GPT-5.5 + design.md"*, *"Claude Opus 4.8 vs GPT-5.5: Which AI Builds Better Landing Pages?"*

The documented workflow (Lesson 02):
1. **Start from a `DESIGN.md`** design system (write one or `Import from Templates`).
2. Plan sections + interactions.
3. Generate multiple directions; compare **multiple design-system foundations**.
4. Use **screenshots as references** to make visuals product-specific.
5. Batch-generate contextual section images → turn into short videos → polish playback.

Key mechanic: you **`@`-reference templates/components to add up to 100,000 characters (~2,000 lines) of context.** A `DESIGN.md` is just the most reusable thing you can put in that context window. Models named throughout: **Claude Opus 4.8, GPT-5.5, Gemini 3.1 Pro, GPT Image 2.0.**

Official prompting tips (`/learn/tips-for-prompting`) reinforce the same shape: name the framework (Tailwind etc.), define component structure, specify responsive breakpoints (768/1024), reference brand colors *by hex* + radius, describe interaction (hover scale 1.05 + shadow), point to a reference design, request ≥44px touch targets.

---

## 7. What we should take from this (for Prana + future builds)

1. **A `DESIGN.md` is the highest-leverage artifact in an AI-design workflow.** One file = consistent output across every screen and every model. We already encode this knowledge in CLAUDE.md + the design-system memory — formalizing it as a committed `DESIGN.md` makes it portable to Cursor/ChatGPT/Gemini, not just this Claude session.
2. **Identity = palette roles + one font pairing + a radius language + guardrails.** Everything else (spacing, the prose skeleton) is boilerplate. Our "Cold Steel + Electric Signal" already nails this discipline (reserve-blue rule, status-hues-for-production-only, mono-for-numbers).
3. **Guardrails as explicit "do not" lines** are the most copyable idea. Ours are sharper than Aura's generic four — we have real anti-AI-tell rules (no icon-in-tinted-box, no solid-blue nav pill, no trend arrows on pills, no gradient-clip heading text, edge-light shadows not black drops). Encode them as Guardrails so any model inherits them.
4. **Pair the spec with a reference HTML.** Aura's single strongest instruction is *"use the attached HTML as the source of truth."* Our built `App.jsx` Dashboard already *is* that reference — point new generations at it.

→ See **`PRANA-DESIGN.md`** for our system written in this exact schema, with our real tokens.

---

## 8. Appendix — full index of the 100 cards on page 1

Format: `display-font | slug | Name (author)`. Remix counts omitted for brevity; the gallery had 621 total — this is page 1 (RANDOM order, so order is not meaningful).

Inter — aura-systems-core-infrastructure-1 — Aura Systems | Core Infrastructure (Aksonvady Phomhome)
Inter — nexus-decentralized-architecture — Nexus - Decentralized Architecture (Meng To)
Inter — synapse-enterprise-intelligence — Synapse | Enterprise Intelligence (Meng To)
Inter — novasphere-redux — NovaSphere /// Redux (Aksonvady Phomhome)
ui-sans-serif — scalable-computing-tiers — Scalable Computing Tiers (Meng To)
Inter — nexus-studio — Nexus Studio (Sourasith Phomhome)
Inter — nexusflow-messaging — NexusFlow - Messaging (Sourany Phomhome)
Inter — premium-architecture-sidebar-component — Premium Architecture Sidebar Component (Meng To)
Inter — lumina-strategic-direction — Lumina - Strategic Direction (Sourasith Phomhome)
Inter — dynamic-interfaces-canvas-engine — Dynamic Interfaces | Canvas Engine (Sourany Phomhome)
Inter — global-agency-motion-opener-1 — Global Agency - Motion Opener (Meng To)
Inter — nexus-streamline-operations-1 — Nexus - Streamline Operations (Meng To)
Inter — aura-editorial-features-corner-lasers — Aura Editorial Features - Corner Lasers (Meng To)
Inter — aegisnet-infrastructure — AegisNet Infrastructure (Meng To)
Inter — nexus-digital-studio — Nexus - Digital Studio (Meng To)
Inter — quantum-architecture-features — Quantum Architecture Features (Meng To)
Inter — nexus-media-2 — NEXUS . media (Sourasith Phomhome)
Inter — quantum-telemetry-schema — Quantum Telemetry Schema (Sourany Phomhome)
Inter — structural-resonance-centered-architect — Structural Resonance - Centered Architect (Meng To)
Instrument Serif — solstice-ventures-1 — Solstice Ventures (Meng To)
BlinkMacSystemFont — freelance-designer-growth-partner — Freelance Designer & Growth Partner (Meng To)
DM Mono — nexus-propel-evolution — Nexus - Propel Evolution (Meng To)
Inter — data-transformation-engine-2 — Data Transformation Engine (Sourany Phomhome)
Cormorant Garamond — resonance-array — Resonance Array (Meng To)
Manrope — nexora-vision-meets-reality — Nexora - Vision Meets Reality (Sourasith Phomhome)
Inter — lumina-gateway — LUMINA // Gateway (Meng To)
Inter — neurosync-cognitive-analytics-1 — NeuroSync - Cognitive Analytics (Sourany Phomhome)
Inter — aether-9-1 — AETHER 9 (Aksonvady Phomhome)
Playfair Display — package-tracking — Package Tracking (Vannarot Roeung)
Inter — nexusgrid-protocol — NexusGrid Protocol (Meng To)
Inter — network-reboot — Network Reboot (Meng To)
Inter — global-mesh-topology-impact — Global Mesh Topology & Impact (Sourany Phomhome)
Inter — landing-page-2 — Landing Page (Sourany Phomhome)
Inter — architecture-v2 — Architecture V2 (Aksonvady Phomhome)
Inter — 2d-3d-engine-interface — 2D/3D Engine Interface (Aksonvady Phomhome)
Geist — pricing-models — Pricing Models (Sourasith Phomhome)
Inter — vanguard-premium-apparel — Vanguard - Premium Apparel (Meng To)
Geist — systemic-blueprints-remixed — Systemic Blueprints - Remixed (Meng To)
Instrument Serif — nova-os-landing-page-1 — Nova OS Landing Page (Meng To)
Cormorant Garamond — system-aggregation-remixed — System Aggregation - Remixed (Meng To)
Inter — launch-in-an-instant — Launch in an instant (Aksonvady Phomhome)
Manrope — synapseos-neural-wellness-focus-recovery — SynapseOS | Neural Wellness & Focus Recovery (Sam)
Inter — video-editor-background-effect — Video Editor Background Effect (Meng To)
Geist — ares-base-seamless-logistics-sync-1 — Ares Base | Seamless Logistics Sync (Meng To)
Inter — secure-network-innovators — Secure Network - Innovators (Meng To)
Inter — neural-architecture-content-section — Neural Architecture Content Section (Meng To)
System Font — landing-page — Landing Page (Meng To)
Inter — vortex-studio-digital-identities-2 — Vortex Studio | Digital Identities (Meng To)
Inter — retro-os-landing — Retro OS Landing (Meng To)
Cinzel — archive-reader-1 — Archive Reader (Meng To)
Inter — nexus-telemetry — Nexus Telemetry (Sourasith Phomhome)
Inter — aetherial-constructs — AETHERIAL CONSTRUCTS (Meng To)
Inter — aura-core-cognitive-mapping — Aura Core - Cognitive Mapping (Meng To)
ui-sans-serif — nexus-core — Nexus \ Core (Sourasith Phomhome)
Inter (88px) — flowops-surgical-precision — FlowOps - Surgical Precision (Meng To)
Inter — nova-adaptive-networks — NOVA - Adaptive Networks (Sourasith Phomhome)
Inter — crystalline-networks-1 — CRYSTALLINE NETWORKS (Sourany Phomhome)
Playfair Display — pipeline-architecture — Pipeline Architecture (Sourasith Phomhome)
Inter — audio-capture-interface — Audio Capture Interface (Meng To)
Inter — vectra-beyond-data — Vectra - Beyond Data (Meng To)
Inter — nexus-hardware-foundry-4 — NEXUS - Hardware Foundry (Sourasith Phomhome)
Inter — ai-coding-agents-brand-board-1 — AI Coding Agents - Brand Board
Inter — aethel-command-your-cellular-timeline — Aethel - Command your cellular timeline
Inter — aether-neural-interface — Aether Neural Interface
Geist — aura-curation-flow — Aura - Curation Flow
Inter — axiomnetwork-global-consensus-infrastructure — AxiomNetwork - Global Consensus Infrastructure
Inter — nova-haven-intelligent-residence — Nova Haven - Intelligent Residence
Inter — aura-design-system — Aura Design System (Sourasith Phomhome)
Inter — futuristic-dashboard-interface — Futuristic Dashboard Interface
JetBrains Mono — tactical-intelligence-platform — Tactical Intelligence Platform (Samnang Aing)
Inter — cognitive-processing-hub — Cognitive Processing Hub
Inter — decentralized-compute-network — Decentralized Compute Network
Inter — process-orchestration-platform-1 — Process Orchestration Platform
Inter — synchronize-orbital-grids — Synchronize Orbital Grids
Inter — nexus-core-infrastructure — Nexus® | Core Infrastructure
Geist — quantum-analytics-dashboard-6 — Quantum Analytics Dashboard
Inter — instant-digital-content-section — Instant Digital Content Section
Manrope — aegis-command-protocol — Aegis Command Protocol
Inter — retail-case-studies-process-system — Retail Case Studies - Process System
Barlow Condensed — peak-performance-recovery-2 — Peak Performance & Recovery
Inter — deep-compute-network — Deep Compute Network
Inter — nexus-architecture — Nexus Architecture
Inter — ai-website-generator — AI Website Generator
Inter — ai-coding-agents-3 — AI Coding Agents
Inter — explore-regions — Explore Regions
Plus Jakarta Sans — summit-raw-performance-elegant-intelligence — Summit — Raw Performance & Elegant Intelligence
Inter — lumina-global-experiences-1 — Lumina - Global Experiences
Inter — nexa-v3-intelligent-systems — NEXA v3 - Intelligent Systems
Geist — voxaura-ai-voice-synthesizer — VoxAura - AI Voice Synthesizer
Inter — ditheros-algorithmic-interfaces — DitherOS - Algorithmic Interfaces (Meng To)
Inter — axiom-financial-infrastructure — Axiom Financial Infrastructure (Sourasith Phomhome)
System Font (60px) — process-orchestration-hero — Process Orchestration Hero (Meng To)
Inter — platform-architecture — Platform Architecture (Sam)
Newsreader — platform-features-remixed — Platform Features - Remixed (Meng To)
Playfair Display — solara-health — Solara Health (Meng To)
Inter — magnetic-features — Magnetic Features (Sourany Phomhome)
Inter — cli-dashboard-jetbrains-emerald-model — CLI Dashboard - JetBrains Emerald Model (Sakura DesignCode)
Inter — system-access-1 — System Access (Meng To)
Inter — synaptiq-interface-remixed — Synaptiq Interface - Remixed (Meng To)
Inter — aura-smart-ai-assistant — Aura - Smart AI Assistant (Meng To)
