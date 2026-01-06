# Design Guidelines: AI Invoice Data Extraction SaaS Platform

## Design Approach
**Reference-Based Approach**: Drawing inspiration from **Stripe** (premium simplicity), **Notion** (clean information architecture), and enterprise document tools (trust and professionalism).

**Rationale**: This is a utility-focused SaaS product where trust, efficiency, and professional credibility are paramount. The design must convey accuracy, security, and enterprise-grade reliability.

---

## Core Design Principles

1. **Professional Minimalism**: Every element earns its place
2. **Trust Through Clarity**: Transparent processes, clear outcomes
3. **Outcome-Focused**: Highlight time saved, accuracy, compliance
4. **Enterprise-Calm**: Serious, not playful; premium, not cheap

---

## Typography

**Font Stack**: Inter (primary), SF Pro (fallback) via Google Fonts
- **Hero Headlines**: font-bold text-5xl md:text-6xl lg:text-7xl
- **Section Headings**: font-semibold text-3xl md:text-4xl
- **Subheadings**: font-medium text-xl md:text-2xl
- **Body Text**: font-normal text-base md:text-lg leading-relaxed
- **Labels/Meta**: font-medium text-sm uppercase tracking-wide text-gray-500

**Color Palette** (to be implemented later):
- Deep slate/charcoal for text
- Neutral grays for backgrounds
- Deep blue for primary actions

---

## Layout System

**Spacing Primitives**: Use Tailwind units: **4, 6, 8, 12, 16, 20, 24, 32**
- Section padding: py-20 md:py-32
- Component spacing: gap-8 to gap-12
- Container: max-w-7xl mx-auto px-6

**Grid Strategy**:
- Features: grid-cols-1 md:grid-cols-3 gap-8
- Tool pages: Single column max-w-4xl for focus
- Upload interface: Centered, max-w-2xl

---

## Page-Specific Layouts

### Homepage
- **Hero**: Full-width with centered content, max-w-4xl text, prominent upload CTA, subtle background treatment
- **How It Works**: 3-column grid with numbered steps (icons optional)
- **Features**: 3-column grid, icon + heading + description pattern
- **Security Badge Row**: Horizontal lockup of trust indicators
- **Pricing Preview**: Side-by-side comparison cards
- **Footer**: 4-column grid (Product, Legal, Company, Contact)

### Tool Pages (SEO Landing Pages)
- Hero with keyword-optimized H1
- Problem statement section
- Upload CTA (prominent, repeated)
- Use cases grid (2-column)
- FAQ accordion (single column, max-w-3xl)

### Upload/App Page
- Centered layout, max-w-4xl
- **Drag-drop zone**: Large, dashed border, 300px+ height
- **Processing state**: Progress bar + status text
- **Results table**: Full-width within container, alternating row colors, editable cells
- **Export buttons**: Horizontal button group, clear hierarchy (Excel primary, CSV secondary, Copy tertiary)
- **Security notice**: Subtle banner at bottom ("Files auto-deleted after processing")

### Pricing Page
- **Plan Cards**: 2-3 column grid on desktop, stack on mobile
- Clear tier differentiation
- Feature comparison table below cards
- FAQ section at bottom

---

## Component Library

### Buttons
- **Primary**: Solid background, rounded-lg, px-8 py-4 text-lg font-semibold
- **Secondary**: Outlined, same padding
- **Text**: Underline on hover, font-medium

### Cards
- Rounded corners (rounded-xl)
- Subtle border
- Padding: p-8
- Hover: subtle lift (shadow-lg transition)

### Upload Zone
- Dashed border (border-2 border-dashed)
- Centered content
- Icon + text + browse link
- Hover state: background tint

### Data Table
- Sticky header
- Zebra striping
- Editable cells with inline edit icon
- Responsive: horizontal scroll on mobile

### Forms
- Single-column layout
- Clear labels above inputs
- Input height: h-12
- Spacing between fields: space-y-6

---

## Images

### Hero Section: YES - Large Hero Image
- **Placement**: Full-width background or split-screen (50/50 with content)
- **Description**: Clean screenshot of extracted invoice data displayed in organized table format, showing real invoice fields being processed
- **Treatment**: Subtle overlay/gradient to ensure text readability
- **Buttons**: If overlaid on image, use backdrop-blur-md for CTA buttons

### Additional Images
- **How It Works**: Icons/illustrations for each step (upload → process → export)
- **Security Section**: Lock icon or shield graphic
- **Tool Pages**: Sample invoice/receipt screenshots showing before/after

---

## Navigation

- **Header**: Sticky, minimal height (h-16), max-w-7xl container
- **Layout**: Logo left, nav center, CTA right
- **Links**: Home, Tools (dropdown), Pricing, Security, About
- **Mobile**: Hamburger menu, slide-out drawer

---

## Accessibility & Polish

- Focus states: visible ring on all interactive elements
- Skip to main content link
- ARIA labels on icon-only buttons
- Keyboard navigation throughout
- Color contrast: WCAG AA minimum

---

## Animations: Minimal

- Smooth transitions on hover (duration-200)
- Upload progress animation
- Subtle fade-in for results table
- NO: Scroll animations, parallax, complex interactions

---

## Key Differentiators

- **No Dashboard Complexity**: Single-purpose pages
- **Trust Over Flash**: Security messaging prominent
- **Outcome Language**: "Extract data" not "Try now"
- **Mobile-First Upload**: Large touch targets, responsive tables