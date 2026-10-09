---
description: Mandatory UI/UX design intelligence and design system enforcement using UI-UX Pro Max
trigger: always_on
---

# UI/UX Pro Max Mandatory Design Rules

Whenever designing, implementing, modifying, or reviewing any user interface (UI), user experience (UX), CSS, HTML, components, or pages:

1. **STRICT ENFORCEMENT OF UI-UX PRO MAX SKILL**:
   - NEVER create generic, amateurish, or stereotypical "AI designs" (e.g., unnecessary neon glows, excessive rainbow gradients, random colored borders, chaotic fonts, emoji icons, gray-on-gray unreadable text).
   - Use the `ui-ux-pro-max` skill and its design system generator (`python3 ~/.gemini/config/skills/ui-ux-pro-max/scripts/search.py`).

2. **CORE DESIGN PRINCIPLES**:
   - **Accessibility & Contrast**: Minimum 4.5:1 text-to-background contrast ratio (WCAG AA/AAA). Dark mode must use high-contrast readable text (#EDEDED / #FFFFFF on dark surfaces, never dark-gray on dark-gray).
   - **Icons**: ALWAYS use clean SVG icons (Lucide / Heroicons). NEVER use emoji as functional UI icons.
   - **Typography**: Clear, consistent typographic hierarchy. Body text base 14-16px with line-height 1.5. Clean sans-serif fonts.
   - **Touch & Click Targets**: Minimum 40-44px click target for interactive elements. Explicit `cursor-pointer` on all clickable cards and buttons.
   - **Layout & Structure**: Clean, disciplined spacing, consistent borders (#1E232D / #272D3B), subtle functional states (hover: 150-200ms ease), no layout thrashing or horizontal scroll.
   - **Product Alignment**: Professional, polished, enterprise-grade B2B / SaaS consulting aesthetic.
