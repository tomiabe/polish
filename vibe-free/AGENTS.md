# vibe-free

Drop this file into your project as `AGENTS.md`, `CLAUDE.md`, or `.cursorrules`, or paste `PROMPT.md` into a single chat.

Its job: stop AI-built UIs from reading as AI-built.

The negative constraints below are opinionated on purpose. Edit them. The point is that the list exists and is non-negotiable, not that you agree with every item.

---

## 0. Visual direction comes first

Before writing any code, write one short paragraph that answers:

- What is the foundation, and where does the palette come from (logo, brand, identity)?
- What is the dominant accent, and what are the controlled secondaries?
- What is the texture and personality (editorial, hand-drawn, technical, loud, quiet)?
- What three things will this NOT look like?

Read that paragraph back before every screen you build. If a section does not serve it, cut it.

Generic output is the default. Specificity is the only known fix.

## 1. Design contract

Lock these before the first component.

- **Color.** Pull from the existing identity if there is one. Otherwise pick one accent and commit. Neutrals do the heavy lifting. No rainbow gradients, no purple or blue gradient hero, no neon glow.
- **Type.** One display face for headings, one body face for text. Name both and commit them to CSS variables or the font stack. Never ship default system fonts unexamined. Never more than two families.
- **Spacing and radius.** One spacing scale (4px or 8px base), one radius set. Every margin comes from the scale.
- **Icons.** One icon family for the whole build. Icons go in critical areas only (status, action, navigation, empty states), and each icon must match its use case and the content beside it. Never use emoji as UI icons. Never mix families. Open options: [Phosphor](https://phosphoricons.com), [Aria Icons](https://github.com/LeulAria/Aria-Icons).
- **Component anchor.** Build on [shadcn/ui](https://ui.shadcn.com) or one other system named in your visual direction. Do not hand-roll what a system already gives you.

## 2. Structure and composition

- Do not default to hero plus three feature cards plus a CTA unless the content genuinely demands it. Vibe-coded pages all share one skeleton. Vary the rhythm.
- Use real content: real names, real numbers, real screenshots. Placeholder testimonials, fake logos, and lorem copy are the loudest tell there is.
- Give the page a story, an order in which it is meant to be read, instead of a stack of sections.
- Vary section shape: full-bleed, split, list, quote, dense versus airy.

## 3. Motion

- References: [Transitions.dev](https://transitions.dev) for page and element transitions, [beUI](https://beui.dev) for animated React and Next components, [Emil Kowalski's craft notes](https://emilkowal.ski/skill) for timing and easing.
- Motion clarifies, it does not decorate. Fast (150 to 250ms), eased, purposeful. Animate on state change and scroll reveal, not on every element.
- No bouncing everything. No infinite background animation.
- Smooth, easy scroll. Respect `prefers-reduced-motion`.

## 4. Sound (optional, context dependent)

- [Cuelume](https://cuelume-site.pages.dev) for UI sound effects.
- Sound earns its place on confirmations and completions only. Routine interactions stay silent. Overused sound reads as gimmicky.

## 5. Copy

- Before you ship, read [Wikipedia: Signs of AI writing](https://en.wikipedia.org/Wikipedia:Signs_of_AI_writing) and cut anything that matches.
- Cut the tells: seamless, powerful yet simple, unlock, in today's fast-paced world, superlative stacks, throat-clearing intros, feature lists written as slogans.
- Write like the product team actually talks. Specific beats impressive.

### Negative constraints (edit this list)

- No em dashes or en dashes.
- Nothing in italics for emphasis.
- No eyebrow labels above headings.
- No bold-italic emphasis stacking.
- Cut 20 percent from the copy at the end. Shorter reads more human.

## 6. Responsive

- Every aspect works at tablet and mobile. Not only the hero: navigation, tables, dense sections, forms, the footer.
- Check at 375, 768, and 1280 before you call anything done.

## 7. Review loop, not a final gate

- Audit at every step, not once at the end. After structure, after the visual pass, after the copy pass.
- Run [polish](https://polish.tomiabe.com) against the code, the copy, and the screens, then fix what it flags before shipping.

## Done means

A person with taste would assume another person made deliberate decisions here: one accent, one icon family, two typefaces, motion with a reason, copy that does not sound generated, and a layout that is not the same page as everything else.
