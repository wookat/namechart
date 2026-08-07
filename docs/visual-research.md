# Visual/Brand Research (Round 117, 2026-08-08)

> Principle (boss directive): replicate competitor experience/structure fully first, then optimize on top. Boundaries: no anti-bot bypass, no copyrighted asset/code lifting — closed-source sites are studied for structure and rebuilt from scratch; open-source is used per license. Sources and evidence recorded here.

Real-browser screenshots + computed-style/source inspection. Evidence in session shots (vis-*.png).

## Competitors

| Site | Palette | Type | Components | Motion |
|---|---|---|---|---|
| Nameberry home | Warm orange→pink diagonal gradient hero, white cards | DM Serif Display, oversized italic accent ("Find *their name.*"), DM Sans 20px body | 100px-radius pill buttons/chips, white pill search with shadow, stat counters (100k+ names / 20 yrs data) | CSS keyframes only, subtle |
| The Bump | Navy #04133a on warm off-white #fdfcfa | Mulish 900 headings | Pill filter chips, rounded cards, badge "NEW!" | CSS keyframes, modal-driven |
| MomJunction | Plain white, Inter | Inter | Square corners, dense article layout | minimal |

## Best-in-class (data/product elegance)

| Site | Takeaway |
|---|---|
| Linear | Motion (framer) for micro-transitions; radius 9999px buttons; restraint — motion only on entrance/hover |
| Stripe | No animation library on landing; type-led hierarchy; 4px radius; gradients as brand signature |

## Direction for NameChart (audience: expectant parents)

- **Palette**: keep indigo as the data/action color, warm the canvas: warm off-white page bg, soft rose/peach/lavender gradient hero wash, pink/blue/purple gender hues already in system.
- **Type**: existing display serif (Iowan/Palatino stack) + italic accent word in hero (Nameberry pattern), 18px body on prose.
- **Components**: pill buttons/inputs already; unify card radius 2xl, soft shadows; stat counter row on home (Nameberry pattern).
- **Motion (CSP/perf constraint — no JS lib needed)**: CSS/SVG only: chart line draw-in (stroke-dasharray), fade-up on section entrance (animation-timeline unsupported broadly → use small IntersectionObserver in app.js), hover lift on cards. All gated by `@media (prefers-reduced-motion: reduce)`.
- **Tech decision**: no framework/component-library migration — SSR string templates + Tailwind v4 already deliver the shadcn-style token system (radius/color/spacing via CSS vars); adding React/shadcn would add hydration cost against Workers SSR with no user benefit. Motion One/GSAP unnecessary for line draw-in + fades; CSS covers it at 0KB. Revisit only if interactive tooling (e.g. client-side chart brushing) lands.
- **Brand assets**: refine logo mark (rounded line-chart heart motif), regenerate favicon set, OG card gradient refresh to match new palette, empty-state illustration (open-license, e.g. tabler/lucide-based composition).
