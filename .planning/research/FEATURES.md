# Feature Research

**Domain:** Expert Marketplace Visual & Intelligence Evolution — Tinrate / TCS v2.2
**Milestone:** v2.2 Evolved Discovery Engine
**Researched:** 2026-02-22
**Confidence:** MEDIUM — visual patterns (glassmorphism, claymorphism, aurora) are well-documented with strong 2024-2025 consensus; OTR@K has a clear analogue in Precision@K IR literature; newsletter gate UX has high-quality 2025-2026 conversion data; tag cloud proximity animation is well-supported by Framer Motion primitives but specific "claymorphic tag cloud" implementations are an emerging pattern with fewer direct references.

---

## Context: What Already Exists (v2.0)

This milestone adds on top of a fully-shipped v2.0. Do NOT re-implement these:

| Existing Feature | Status |
|-----------------|--------|
| Hybrid search pipeline (FAISS + BM25 fusion) | Live |
| Faceted sidebar: TagMultiSelect (flat list), RateSlider, SearchInput | Live |
| react-virtuoso infinite-scroll expert grid | Live |
| Floating Sage AI co-pilot with Framer Motion (AnimatePresence) | Live |
| Email gate for profile clicks (localStorage-persisted) | Live |
| URL filter sync, FTS5 autocomplete suggestions | Live |

All v2.2 features build on this foundation without touching the search pipeline, store structure, or admin analytics already shipped.

---

## Feature Landscape

### Table Stakes (Users Expect These)

For a marketplace claiming "immersive" or "high-fidelity" aesthetics, these visual properties are the minimum that makes the design feel intentional rather than accidentally styled.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| `backdrop-filter: blur` on overlay surfaces | Any product describing "glassmorphism" that lacks this property looks like a flat card with a white background — the defining visual affordance of the style | LOW | Values: `blur(12px)` to `blur(20px)`. Requires `-webkit-backdrop-filter` prefix for Safari (still needed in 2026). GPU-intensive — limit to sidebar, SearchInput, Sage panel; do not apply to the expert card grid (530 cards rendered = performance collapse). |
| Semi-transparent background on glass surfaces | The blur is invisible without a translucent fill; the two properties are inseparable for the glass effect | LOW | `background: rgba(255,255,255,0.08)` to `rgba(255,255,255,0.15)` on dark aurora bg. For light aurora variants: `rgba(0,0,0,0.05)` to `rgba(0,0,0,0.10)`. Alpha below 0.08 renders invisible; above 0.25 looks like an opaque panel. |
| Subtle 1px border on glass surfaces | Without a border, glass surfaces lose their edge definition and appear to float disconnectedly from the layout | LOW | `border: 1px solid rgba(255,255,255,0.18)` to `rgba(255,255,255,0.25)`. For aurora-tinted borders use `oklch(95% 0.05 260 / 0.20)` (very light purple-blue at 20% opacity). |
| Contrast ratio ≥ 4.5:1 on all glass text | WCAG 2.1 AA minimum for body text on variable-background glass surfaces | MEDIUM | Glass surfaces change perceived contrast depending on what's behind them. Test with darkest and lightest background state of the aurora animation. Mitigation: add subtle `text-shadow: 0 1px 3px rgba(0,0,0,0.3)` on body text over glass; increase glass bg opacity from 0.10 to 0.20 if contrast fails. |
| `@supports` fallback for unsupported browsers | `backdrop-filter` has ~95% global support in 2026, but the 5% that don't support it see a completely transparent surface with no background — text becomes unreadable | LOW | Wrap glass surfaces: `@supports not (backdrop-filter: blur(1px)) { .glass-surface { background: rgba(15,15,35,0.85); } }`. Opaque dark fallback ensures legibility. |
| Keyframe-animated aurora background that doesn't stutter | A static aurora gradient defeats the purpose; a janky one reads as broken | MEDIUM | Animate `background-position` on multiple stacked radial-gradient layers, NOT `background-size` (repaints trigger layout). Use `transform: translate()` on pseudo-elements for GPU compositing. Animate on 15–30s cycles. Use `animation-timing-function: ease-in-out`. |
| OKLCH color tokens for aurora palette | Perceptually uniform color space is necessary for smooth hue transitions in gradients — standard RGB/HSL produces muddy intermediate colors in aurora gradients | LOW | Define color design tokens as OKLCH values in CSS custom properties. Example aurora tokens: `--aurora-violet: oklch(55% 0.25 290)`, `--aurora-teal: oklch(65% 0.20 185)`, `--aurora-rose: oklch(62% 0.22 350)`. OKLCH prevents the "gray mudge" in the middle of hue transitions. Tailwind v3 supports OKLCH in `theme.extend.colors` via direct CSS variable reference. |
| Bento-zone visual structure on ExpertCard | A card claiming "bento-style" without distinct spatial zones looks like a disorganized list item | MEDIUM | Four zones: (1) name/role area top-left, (2) rate+badge top-right, (3) tag pills bottom-left strip, (4) match-reason bottom-right or full-width footer strip. Must maintain h-[180px] fixed height (VirtuosoGrid constraint — non-negotiable). |

---

### Differentiators (Competitive Advantage)

These are the v2.2 features that give the marketplace a premium, distinctive character. None of them exist in competitor marketplaces (Upwork, Toptal, Clarity.fm).

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Animated claymorphic tag cloud | Replaces a flat checkbox list with a tactile, living element that communicates the breadth of expert domains without feeling clinical. No competitor marketplace has this. | HIGH | Uses Framer Motion `layout` prop for position animation when tags reorder. Hover/proximity scale: individual tags scale to `1.08–1.12` on hover (claymorphism lift). Framer Motion `useMotionValue` tracks cursor position; `useTransform` maps distance to scale for proximity effect on neighboring tags. Each tag is a `motion.button` with `whileHover={{ scale: 1.1 }}` as baseline; proximity enhancement is additive. |
| Claymorphic bubble aesthetic on tags | Visual design language that makes filter tags feel physical and playful rather than UI-widget sterile | MEDIUM | Core CSS: `border-radius: 999px` (full pill), `box-shadow: inset -2px -2px 5px rgba(0,0,0,0.15), inset 2px 2px 5px rgba(255,255,255,0.25), 3px 3px 8px rgba(0,0,0,0.20)` (two inner + one outer shadow for 3D clay depth). `background: oklch(62% 0.18 260)` (saturated). Scale transition: `transition: transform 0.18s ease, box-shadow 0.18s ease`. Hover state deepens outer shadow and lifts scale. |
| "Everything is possible" animated hero element | Communicates product breadth through example quirky tags ("Find a rocket scientist", "Someone who speaks fluent legalese") — sets expectations about the search system's power | MEDIUM | Rendered as an animated banner beneath the tag cloud. Cycle through example tags with Framer Motion `AnimatePresence` + fade-in/fade-out or slide-up stagger. Should feel like a gentle revelation, not a carousel. 4–6 example phrases, 3s per phrase, infinite loop. |
| t-SNE embedding scatter plot in admin | Makes the abstract concept of "embedding space" legible to a non-ML admin — shows category clustering, coverage gaps, and outlier experts as a 2D map | HIGH | Backend: `sklearn.manifold.TSNE(n_components=2, perplexity=30, random_state=42)` on the FAISS index vectors at startup, cached in `app.state.tsne_projection`. Endpoint: `/api/admin/embedding-map` returns `[{x, y, label, category, expert_name, findability_score}]`. Frontend: scatter plot (Recharts `ScatterChart` or `react-chartjs-2`) with points colored by `category`. Hover tooltip: expert name + job title. What it shows: tight clusters = good category coverage; isolated points = outlier experts who are hard to retrieve; large empty regions = coverage gaps (domains with few experts). |
| OTR@K metric in admin dashboard | Gives admins a weekly signal of whether search is returning semantically relevant results, without requiring manual labeling | HIGH | OTR@K (On-Topic Rate at K) is functionally equivalent to Precision@K with a score-based relevance threshold. Definition: for a query returning K results, OTR@K = (count of results where `hybrid_score >= threshold`) / K. Standard K=10, threshold=0.60 (aligns with existing `GAP_THRESHOLD=0.60`). Computed per search query and stored in `conversations` table. 7-day rolling average exposed in admin Intelligence tab. |
| Atomic FAISS index swap | Allows the admin to rebuild the embedding index without any downtime or inconsistency window — essential once the expert pool grows | HIGH | Pattern: `asyncio.to_thread` runs FAISS rebuild in background; on completion, `app.state.faiss_index = new_index` is a single atomic Python reference reassignment (GIL-safe for this operation). In-flight requests continue using the old object until completion; new requests pick up the new index. Admin panel shows rebuild status: idle / running / complete / failed + last-rebuilt timestamp. |
| Newsletter subscription gate (replaces raw email gate) | Repositions the lead capture as a value exchange ("Get expert insights") rather than a toll ("Give us your email"). Higher perceived value = higher conversion. | MEDIUM | Same localStorage + Zustand persistence infrastructure as existing email gate. New copy framing and backend table (`newsletter_subscribers`). SQLite-backed, exportable. Admin Leads page shows subscriber count + list. |
| Barrel roll Easter egg | Adds delight and shareable surprise — users who discover it tell others | LOW | Framer Motion `animate` on ExpertCards triggered by matching query/Sage phrases ("barrel roll", "do a flip"). 360° `rotate` transition on all visible cards simultaneously. `AnimatePresence` not needed — existing cards just receive a new animate prop value. Duration: 0.6s, ease-in-out, single rotation. |

---

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Cursor-reactive JS aurora (mousemove-driven gradient) | "Makes the background feel interactive and alive" | `mousemove` fires at 60+ events/second; each triggers a CSS variable update and GPU re-composite on a large radial gradient — measurable frame drops on mid-range hardware. Specifically: Tailwind JIT does not handle inline-style gradient updates; requires direct DOM style mutation. | CSS keyframe animation achieves ambient motion at zero JS cost, runs on the compositor thread, and is explicitly chosen in REQUIREMENTS.md (`Out of Scope`). |
| Applying `backdrop-filter: blur` to expert cards | "Make cards feel glassy too" | 530 cards × backdrop-filter = 530 GPU layers. This is the single most common cause of glassmorphism performance failures in production. Safari is particularly sensitive. | Apply backdrop-filter only to 3-4 UI chrome elements: sidebar, SearchInput, Sage panel, mobile filter sheet. Cards get solid or semi-opaque non-blurred backgrounds. |
| External newsletter service (Mailchimp, Klaviyo) integration | "We need proper email automation" | Adds an external API dependency with its own auth, webhook handling, rate limits, and cost. The product does not currently send any automated emails — the complexity is all overhead. | SQLite `newsletter_subscribers` table with CSV export is sufficient. Manual export to email service when campaign is needed. Out of scope in REQUIREMENTS.md. |
| UMAP instead of t-SNE for embedding map | "UMAP produces better layouts and runs faster for large datasets" | True for >10K points, but `umap-learn` is a heavy Railway dependency (~200MB package) and adds cold-start time. 530 points is squarely in t-SNE's sweet spot (best results under 5K points; no neighbor approximation needed). | scikit-learn t-SNE at 530 points runs in ~1-2 seconds on startup. Explicitly deferred to v2.3 in REQUIREMENTS.md. |
| Animated on-hover full card flip | "Makes cards feel 3D and premium" | Card flip breaks the scan pattern of a dense grid — it changes the card's footprint mid-hover, causes surrounding cards to appear to shift, and conflicts with VirtuosoGrid's fixed-height contract. | Bento card design + aurora-tuned glow on hover covers the "premium feel" need without layout disruption. |
| GDPR consent checkbox on newsletter gate | "We must get explicit consent for email marketing" | A consent checkbox is correct for marketing jurisdictions but is not required for a B2B lead-capture model where the subscription is the product. Adding it adds a field, reduces conversion, and requires legal review of checkbox copy. | Document the legal basis in deployment notes. Add consent copy as microcopy under the email field ("By subscribing you agree to receive expert insights from Tinrate"). |
| Real-time OTR@K (per-request computation) | "Show live retrieval quality on every search" | OTR@K requires looking at K results and applying a threshold — this is already done at search time, but logging it on every request adds a DB write per search. At scale this is manageable; but real-time display on the user-facing search page exposes internal quality signals to users who have no context for interpreting them. | Compute and store per query (INTEL-01). Display 7-day rolling average in admin only (INTEL-02). Never expose raw per-query OTR to end users. |

---

## Detailed Pattern Notes by Feature Area

### 1. Aurora + Glassmorphism (VIS-01 – VIS-05)

**Aurora mesh gradient technique (MEDIUM confidence — daltonwalsh.com, auroral GitHub, Aceternity UI):**

The aurora effect is achieved by stacking multiple semi-transparent `radial-gradient` blobs with large radius values over a dark base, then animating their position using CSS `@keyframes`. The canonical technique:

```css
/* Base layer — deep dark navy */
.aurora-bg {
  background: oklch(12% 0.05 260);
  position: relative;
  overflow: hidden;
}

/* Blob layers via pseudo-elements or child divs */
.aurora-blob-1 {
  position: absolute;
  width: 60vw;
  height: 60vw;
  border-radius: 50%;
  background: radial-gradient(
    circle,
    oklch(55% 0.25 290 / 0.35) 0%,
    transparent 70%
  );
  animation: drift-1 20s ease-in-out infinite alternate;
  filter: blur(60px);  /* Soft blob edge — NOT backdrop-filter */
}

@keyframes drift-1 {
  0%   { transform: translate(-20%, -20%) scale(1.0); }
  100% { transform: translate(20%, 30%) scale(1.15); }
}
```

**Critical distinction:** `filter: blur()` on the gradient blobs is different from `backdrop-filter: blur()` on UI surfaces. The former blurs the blob itself (cheap). The latter blurs whatever is behind the glass element (expensive but required for glassmorphism). Use both — one for the background blobs, the other for sidebar/panel surfaces.

**Glassmorphism surface recipe (HIGH confidence — cross-verified with multiple 2024-2025 implementations):**

```css
.glass-surface {
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(16px) saturate(1.8);
  -webkit-backdrop-filter: blur(16px) saturate(1.8);
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
}

/* Fallback for browsers without backdrop-filter */
@supports not (backdrop-filter: blur(1px)) {
  .glass-surface {
    background: rgba(15, 15, 35, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.10);
  }
}
```

Key values to tune per surface: blur radius (sidebar: 16px; Sage panel: 20px; SearchInput: 12px), background alpha (0.08–0.15), border opacity (0.15–0.25).

**OKLCH color tokens for Tailwind (MEDIUM confidence — training data + MDN verified approach):**

Tailwind v3 does not natively parse `oklch()` in `tailwind.config.js` color definitions, but accepts CSS custom properties. Pattern:

```css
/* globals.css */
:root {
  --aurora-violet: oklch(55% 0.25 290);
  --aurora-teal:   oklch(65% 0.20 185);
  --aurora-rose:   oklch(62% 0.22 350);
  --glass-bg:      oklch(100% 0 0 / 0.08);
  --glass-border:  oklch(100% 0 0 / 0.18);
}
```

Then reference in Tailwind config as CSS variable values or inline `style={{ '--color': 'oklch(...)' }}`.

---

### 2. Animated Claymorphic Tag Cloud (DISC-01 – DISC-04)

**Layout animation vs absolute positioning (HIGH confidence — Motion docs, multiple verified implementations):**

Use Framer Motion `layout` prop on each `motion.button` tag. When tags reorder (e.g., selected tags move to top), `layout` animates the transition automatically using FLIP (First-Last-Invert-Play) — no manual position calculation needed.

```tsx
// Each tag item
<motion.button
  layout                        // Animates position changes
  layoutId={`tag-${tag.id}`}   // Stable ID for cross-container animation
  whileHover={{ scale: 1.1 }}  // Claymorphic lift on hover
  whileTap={{ scale: 0.95 }}   // Tactile press feedback
  transition={{ type: "spring", stiffness: 400, damping: 25 }}
>
  {tag.label}
</motion.button>
```

Wrap all tags in `<motion.div layout>` container so the container also animates its height as tags are selected/deselected and reorder.

**Do NOT use absolute positioning** for the tag cloud. Absolute positioning requires manual x/y calculation per tag (like a word cloud library), which conflicts with the sidebar's flex/flow layout, makes keyboard navigation non-linear, and breaks accessibility reading order.

**Proximity-based scale (MEDIUM confidence — Framer Motion useMotionValue patterns, training data):**

For the "nearby tags also scale slightly when cursor approaches" effect:

```tsx
// In a parent component tracking cursor position
const mouseX = useMotionValue(0);
const mouseY = useMotionValue(0);

// Per tag: compute distance from tag center to cursor
// Map distance 0–150px → scale 1.10–1.00
const tagScale = useTransform(distance, [0, 150], [1.10, 1.00]);
```

The proximity effect adds perceived "life" — tags that are close to the hovered tag subtly breathe outward. This is the hallmark "claymorphism" interaction pattern. Distance threshold of 100–150px is the sweet spot: too wide feels chaotic; too narrow feels like standard hover.

**Claymorphism CSS for individual tags (HIGH confidence — multiple 2024-2025 sources):**

```css
.clay-tag {
  border-radius: 999px;               /* Full pill */
  background: oklch(62% 0.18 260);    /* Saturated domain color */
  padding: 6px 14px;
  font-weight: 500;

  box-shadow:
    inset -2px -3px 6px rgba(0, 0, 0, 0.20),   /* Dark inner shadow (bottom-right) */
    inset 2px 2px 5px rgba(255, 255, 255, 0.30), /* Light inner highlight (top-left) */
    3px 4px 10px rgba(0, 0, 0, 0.25);            /* Outer drop shadow */

  transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.clay-tag:hover {
  transform: scale(1.10) translateY(-1px);
  box-shadow:
    inset -2px -3px 6px rgba(0, 0, 0, 0.20),
    inset 2px 2px 5px rgba(255, 255, 255, 0.30),
    5px 7px 16px rgba(0, 0, 0, 0.30);            /* Deeper outer shadow on hover = lift */
}
```

The dual-inset + outer-shadow triple is the defining CSS pattern for claymorphism. The inner dark shadow simulates the recessed underside; the inner light shadow simulates the top highlight; the outer shadow provides the floating elevation.

**"Everything is possible" element (DISC-03):**

Below the tag cloud, render a row of example quirky search phrases that cycle using Framer Motion `AnimatePresence`:

```tsx
const examples = [
  "Find a rocket scientist who codes",
  "Someone fluent in startup legalese",
  "A CFO who's been through a Series B",
  "An AI ethicist with product sense",
];
```

Use `key={currentExample}` so `AnimatePresence` treats each phrase as a distinct element with enter/exit animation (fade up, 0.4s). Switch every 3 seconds.

---

### 3. t-SNE Embedding Heatmap / Scatter Plot (INTEL-05 – INTEL-06)

**What the visualization shows (MEDIUM confidence — Google GenAI embedding examples, ML visualization literature):**

An embedding scatter plot for a search admin serves three diagnostic purposes:

1. **Category clustering:** Experts in the same domain should cluster together in 2D. Tight clusters = embeddings are capturing domain signal correctly. Scattered points within a labeled category = the embedding model sees those experts as semantically diverse (may indicate noisy or inconsistent tag assignments).

2. **Coverage gaps:** Large empty regions in the 2D space = no experts in that embedding neighborhood. If a user query embeds into that region, retrieval quality will be poor (all results will have low similarity). These gaps inform which expert domains to recruit.

3. **Outlier experts:** Points far from any cluster = unusual embeddings (very generalist experts, experts with sparse tag data, or experts whose job title doesn't align with their tags). Outliers are candidates for findability score review.

**What to render per point:**
- `x`, `y` from t-SNE 2D projection
- Color: by `category` (domain tag — use the most-assigned tag per expert as primary category)
- Hover tooltip: `expert_name`, `job_title`, `findability_score`, primary category
- Point size: uniform (2–4px radius); avoid sizing by findability score — too visually noisy for 530 points

**scikit-learn t-SNE implementation:**

```python
from sklearn.manifold import TSNE
import numpy as np

def compute_tsne(faiss_index, experts: list[dict]) -> list[dict]:
    # Extract all vectors from FAISS index
    vectors = np.array([faiss_index.reconstruct(i) for i in range(faiss_index.ntotal)])

    tsne = TSNE(
        n_components=2,
        perplexity=30,       # Standard for 530 points; increase to 50 for >1000
        random_state=42,     # Deterministic output (same layout on every restart)
        n_iter=1000,
        metric="cosine",     # gemini-embedding-001 uses cosine similarity
    )
    embedding_2d = tsne.fit_transform(vectors)

    return [
        {
            "x": float(embedding_2d[i][0]),
            "y": float(embedding_2d[i][1]),
            "expert_name": experts[i]["name"],
            "job_title": experts[i]["job_title"],
            "category": experts[i]["primary_tag"],
            "findability_score": experts[i]["findability_score"],
        }
        for i in range(len(experts))
    ]
```

Compute at startup, cache in `app.state.tsne_projection`. Recompute after atomic FAISS index swap.

**Frontend scatter plot:** Recharts `ScatterChart` is the lowest-friction choice given the existing React stack (no new charting library). Alternatively, `react-chartjs-2` if richer interactivity is needed. Both support colored point groups and hover tooltips.

---

### 4. OTR@K — On-Topic Rate at K (INTEL-01 – INTEL-02)

**Definition (MEDIUM confidence — semantic search evaluation literature; "OTR@K" specifically sourced from LinkedIn's search evaluation system):**

OTR@K (On-Topic Rate at K) = the fraction of the top-K retrieved results that are "on-topic" (relevant) for the query.

**Formal definition:**

```
OTR@K = (number of on-topic results in top K) / K
```

where "on-topic" is a binary determination: a result is on-topic if its relevance score exceeds a threshold.

**In this system's context:** The hybrid search pipeline already produces a `hybrid_score` per result (FAISS semantic score × 0.7 + BM25 score × 0.3). A result is "on-topic" if `hybrid_score >= 0.60` (aligning with the existing `GAP_THRESHOLD=0.60` constant). K=10 is standard; use K=10 for INTEL-01.

**Computation at search time:**

```python
def compute_otr_at_k(results: list[dict], k: int = 10, threshold: float = 0.60) -> float:
    top_k = results[:k]
    if not top_k:
        return 0.0
    on_topic = sum(1 for r in top_k if r.get("hybrid_score", 0) >= threshold)
    return on_topic / len(top_k)
```

Store `otr_at_k` in the `conversations` table alongside the existing query log (add a `REAL` column). Admin Intelligence tab computes 7-day rolling average via:

```sql
SELECT AVG(otr_at_k)
FROM conversations
WHERE created_at >= datetime('now', '-7 days')
  AND otr_at_k IS NOT NULL;
```

**Display in admin:** Single metric card "On-Topic Rate (7d avg): 0.82" with a subtitle "Fraction of top-10 results scoring above the relevance threshold." Color code: green >= 0.75, amber 0.60–0.74, red < 0.60.

**OTR@K vs Precision@K:** These are functionally identical when relevance is defined by a score threshold rather than ground-truth labels. OTR@K is the term used in production search systems (LinkedIn, Bing) where explicit relevance judgments don't exist; Precision@K is the academic terminology. The math is the same.

---

### 5. Index Drift (INTEL-03 – INTEL-04)

**What it tracks:**

Index Drift is not a retrieval quality metric — it is an operational health metric. It answers: "How stale is the current FAISS index relative to the live expert database?"

**Two components:**

1. **Time since last rebuild:** `datetime.utcnow() - last_rebuild_timestamp`. Display as "Rebuilt 3 days ago" or "Rebuilt 14 days ago (attention recommended)".

2. **Expert count delta:** `current_expert_count - expert_count_at_last_rebuild`. A positive delta means new experts are in SQLite but not yet in the FAISS index (they won't appear in semantic search results). Display as "+23 experts not yet indexed" when delta > 0.

**Storage:** Add `last_rebuild_ts` and `expert_count_at_rebuild` columns to a `system_state` SQLite table (or the existing `settings` table if schema allows). Update on every atomic FAISS swap completion.

**Display in admin:** Status badge: "Index is current" (green, delta=0, age<7d) | "Index drift detected: +N experts" (amber, delta>0) | "Rebuild recommended (14d old)" (amber, age>7d) | Both conditions = red.

---

### 6. Newsletter Subscription Gate (NLTR-01 – NLTR-04)

**Newsletter gate vs raw email gate — the UX difference (MEDIUM confidence — omnisend.com, moosend.com 2026 examples, mailerlite.com best practices):**

| Dimension | Raw Email Gate (v2.0) | Newsletter Gate (v2.2) |
|-----------|----------------------|------------------------|
| User mental model | "Pay to see the profile" (toll) | "Subscribe to get ongoing expert insights" (value exchange) |
| Value proposition | Opaque — user doesn't know what they get | Explicit — "Get curated expert insights to your inbox" |
| Trust signal | Extractive ("give us your email") | Reciprocal ("we'll send you value in return") |
| Perceived friction | Higher (giving up data for access) | Lower (joining something worth joining) |
| Conversion mechanism | FOMO + access blocking | Desire for ongoing value |

**Copy pattern (MEDIUM confidence — conversion copywriting best practices):**

Headline options (pick one, A/B test if needed):
- "Get expert insights delivered to your inbox"
- "Unlock profiles + receive curated expert matchmaking tips"
- "Join 500+ businesses who trust Tinrate experts"

Subheadline: "One email when we publish new expert spotlights. Unsubscribe anytime."

CTA button: "Subscribe & View Profile" (combines the action with the immediate payoff)

Microcopy beneath button: "No spam. Sent monthly. 30-second unsubscribe."

**Friction level — target: single-field (MEDIUM confidence — MailerLite, VWO, conversion data):**

Single email field only. No first name, no company. Each additional field reduces conversion by 4–11% (MailerLite, 2025 data). The subscriber list benefits from the email alone — name/company can be inferred from the email domain for B2B.

**Behavioral logic:**
- Gate triggers on "View Full Profile" click (same trigger point as v2.0 email gate)
- If `newsletterSubscribed === true` in Zustand store (persisted via localStorage), skip modal entirely — do not show it again even on next session
- On subscription: write to `newsletter_subscribers(email, created_at, source='profile_gate')` in SQLite, set `newsletterSubscribed: true` in Zustand + localStorage
- Immediately after subscription: proceed to the original action (open Tinrate profile in new tab)

**Zustand store addition:**

```typescript
interface NewsletterSlice {
  subscribed: boolean;
  email: string | null;
  setSubscribed: (email: string) => void;
}
```

Persist to localStorage under the existing `useExplorerStore` persist key. No new store needed.

---

## Feature Dependencies

```
[Aurora CSS background + OKLCH tokens]
    └──prerequisite──> [Glassmorphism surfaces on sidebar, SearchInput, Sage panel]
    └──prerequisite──> [Bento ExpertCard aurora glow tokens]
    └──prerequisite──> [Claymorphic tag cloud color palette]
    (All visual features share the same OKLCH color token system)

[Glassmorphism surfaces]
    └──requires──> [Aurora background renders behind the surface]
    (Glass effect is invisible or wrong on white/flat backgrounds)

[Atomic FAISS index swap (IDX-01 – IDX-04)]
    └──prerequisite──> [t-SNE recomputation on swap completion]
    └──prerequisite──> [Index Drift metric reset on swap completion]
    (Swap completion triggers two downstream state updates)

[t-SNE embedding scatter plot]
    └──requires──> [FAISS index accessible at startup for vector extraction]
    └──requires──> [Expert metadata (name, job_title, tags) aligned with FAISS index positions]
    └──independent of──> [Atomic FAISS swap]
    (t-SNE computation is triggered at startup; atomic swap should re-trigger it)

[OTR@K metric]
    └──requires──> [hybrid_score field in explore results]
    └──requires──> [conversations table schema update (otr_at_k column)]
    └──independent of──> [t-SNE or Index Drift]
    (OTR@K is computed in the search pipeline, not the index pipeline)

[Newsletter gate]
    └──extends──> [Existing email gate modal (v2.0)]
    └──requires──> [New newsletter_subscribers SQLite table]
    └──requires──> [New Zustand newsletter slice]
    └──independent of──> [Aurora/glass/tag cloud]
    (Can be built and tested independently of visual features)

[Claymorphic tag cloud]
    └──replaces──> [TagMultiSelect flat list (v2.0)]
    └──requires──> [Framer Motion layout animations (already installed in v2.0)]
    └──requires──> [Aurora color tokens for tag palette]
    └──independent of──> [FAISS, OTR@K, Newsletter]

[Barrel roll Easter egg]
    └──requires──> [Framer Motion animate prop on ExpertCards]
    └──triggers from──> [Sage query matching OR SearchInput text]
    └──independent of──> [All visual redesign features]
    (Can be added to existing card component without touching card design)
```

---

## v2.2 Launch Definition

### Phase 22 — Visual Metamorphosis (VIS)

All of these must ship together or the glassmorphism effect is incoherent:

- [ ] OKLCH design tokens in CSS custom properties
- [ ] Aurora mesh gradient background with keyframe animation
- [ ] Glassmorphism on FilterSidebar, SearchInput, Sage panel (backdrop-filter, rgba bg, subtle border)
- [ ] `@supports` fallback for unsupported browsers (opaque dark background)
- [ ] Contrast validation across all glass surfaces (WCAG 4.5:1)

### Phase 23 — Discovery Engine (CARD + DISC)

- [ ] Bento ExpertCard redesign (h-[180px] fixed height maintained)
- [ ] Aurora-tuned hover glow on ExpertCards
- [ ] Claymorphic tag cloud replacing TagMultiSelect
- [ ] Proximity-based scale on tag hover
- [ ] "Everything is possible" animated example phrases

### Phase 24 — Atomic Index Swap (IDX)

- [ ] Admin-triggered FAISS rebuild via panel
- [ ] asyncio.to_thread background rebuild
- [ ] Atomic `app.state.faiss_index` swap on completion
- [ ] Rebuild status display in admin (idle/running/complete/failed + timestamp)

### Phase 25 — Admin Intelligence Metrics (INTEL 01-04)

- [ ] OTR@K computed per search query, stored in conversations table
- [ ] 7-day rolling OTR@K average in admin Intelligence tab
- [ ] Index Drift metric (time since rebuild + expert count delta)
- [ ] Index Drift status display in admin

### Phase 26 — Embedding Heatmap (INTEL 05-06)

- [ ] t-SNE projection computed at startup, cached in app.state
- [ ] `/api/admin/embedding-map` endpoint
- [ ] Admin scatter plot (colored by category, hover tooltip)
- [ ] t-SNE recomputed on atomic FAISS swap

### Phase 27 — Newsletter Gate + Easter Egg (NLTR + FUN)

- [ ] Newsletter gate copy and modal redesign
- [ ] newsletter_subscribers SQLite table
- [ ] Zustand newsletter slice (persisted to localStorage)
- [ ] Admin Leads page subscriber count + list
- [ ] Barrel roll Easter egg on trigger phrases

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Phase | Priority |
|---------|------------|---------------------|-------|----------|
| Aurora background + glassmorphism | HIGH (product quality signal) | MEDIUM | 22 | P1 |
| OKLCH design tokens | HIGH (enables all visual features) | LOW | 22 | P1 |
| @supports fallback | MEDIUM (accessibility/compatibility) | LOW | 22 | P1 |
| Bento ExpertCard redesign | HIGH (product quality) | MEDIUM | 23 | P1 |
| Claymorphic tag cloud | HIGH (differentiator) | HIGH | 23 | P1 |
| Atomic FAISS swap | HIGH (ops capability) | HIGH | 24 | P1 |
| OTR@K metric | MEDIUM (admin insight) | MEDIUM | 25 | P1 |
| Index Drift metric | MEDIUM (ops awareness) | LOW | 25 | P2 |
| t-SNE scatter plot | HIGH (admin differentiator) | HIGH | 26 | P2 |
| Newsletter gate | HIGH (lead quality) | MEDIUM | 27 | P1 |
| "Everything is possible" element | LOW (delight) | LOW | 23 | P2 |
| Barrel roll Easter egg | LOW (delight/shareability) | LOW | 27 | P3 |
| Proximity-based tag scale | MEDIUM (perceived polish) | MEDIUM | 23 | P2 |

**Priority key:**
- P1: Ships in v2.2 core — milestone incomplete without these
- P2: Ships in v2.2 — adds significant value, low regression risk
- P3: Ship if P1/P2 complete with time remaining

---

## Sources

**Glassmorphism / Aurora:**
- [Glassmorphism Implementation Guide 2025 — playground.halfaccessible.com](https://playground.halfaccessible.com/blog/glassmorphism-design-trend-implementation-guide) — MEDIUM confidence
- [backdrop-filter — MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/backdrop-filter) — HIGH confidence
- [Next-level frosted glass with backdrop-filter — Josh W. Comeau](https://www.joshwcomeau.com/css/backdrop-filter/) — HIGH confidence (authoritative CSS author)
- [Aurora CSS Background Effect — Dalton Walsh](https://daltonwalsh.com/blog/aurora-css-background-effect/) — MEDIUM confidence
- [Auroral library — LunarLogic/auroral GitHub](https://github.com/LunarLogic/auroral) — MEDIUM confidence
- [Aurora Background — Aceternity UI](https://ui.aceternity.com/components/aurora-background) — MEDIUM confidence
- [CSS Glassmorphism Generator — css.glass](https://css.glass/) — MEDIUM confidence (generator, practical values)

**Claymorphism:**
- [Implementing Claymorphism with CSS — LogRocket Blog](https://blog.logrocket.com/implementing-claymorphism-css/) — HIGH confidence
- [How to Create Claymorphism Using CSS — hype4.academy](https://hype4.academy/articles/coding/how-to-create-claymorphism-using-css) — HIGH confidence
- [clay.css — Adrian Bece](https://codeadrian.github.io/clay.css/) — MEDIUM confidence (reference implementation)
- [Claymorphism: Will It Stick Around? — Smashing Magazine](https://www.smashingmagazine.com/2022/03/claymorphism-css-ui-design-trend/) — MEDIUM confidence
- [Fun with Claymorphism 2025 — Unorthodox CSS](https://unorthodocss.com/ui-frameworks/2025/08/19/fun-with-claymorphism.html) — MEDIUM confidence

**Framer Motion:**
- [Layout Animations — Motion (Framer Motion)](https://www.framer.com/motion/layout-animations/) — HIGH confidence (official docs)
- [useTransform — Motion](https://www.framer.com/motion/use-transform/) — HIGH confidence (official docs)
- [Advanced animation patterns — Maxime Heckel](https://blog.maximeheckel.com/posts/advanced-animation-patterns-with-framer-motion/) — MEDIUM confidence

**OTR@K / Retrieval Evaluation:**
- [Semantic Search Evaluation — arxiv.org/html/2410.21549v1](https://arxiv.org/html/2410.21549v1) — MEDIUM confidence (academic preprint)
- [Evaluation Metrics For Information Retrieval — amitness.com](https://amitness.com/posts/information-retrieval-evaluation) — MEDIUM confidence
- [How to Evaluate Retrieval Quality in RAG Pipelines — Towards Data Science](https://towardsdatascience.com/how-to-evaluate-retrieval-quality-in-rag-pipelines-precisionk-recallk-and-f1k/) — MEDIUM confidence
- [Evaluation Measures in Information Retrieval — Pinecone](https://www.pinecone.io/learn/offline-evaluation/) — HIGH confidence (Pinecone authoritative)
- [Precision and Recall at K — Evidently AI](https://www.evidentlyai.com/ranking-metrics/precision-recall-at-k) — MEDIUM confidence
- Training data: LinkedIn OTR@K usage in production search evaluation — LOW confidence (training data, unverified post-cutoff)

**t-SNE / Embedding Visualization:**
- [Visualizing Embeddings with t-SNE — Google AI for Developers](https://ai.google.dev/examples/clustering_with_embeddings) — HIGH confidence (official Google source)
- [TSNE — scikit-learn docs](https://scikit-learn.org/stable/modules/generated/sklearn.manifold.TSNE.html) — HIGH confidence (official)
- [Visualizing Embeddings with t-SNE — Kaggle](https://www.kaggle.com/code/colinmorris/visualizing-embeddings-with-t-sne) — MEDIUM confidence

**Newsletter Gate:**
- [25 Newsletter Signup Examples That Convert in 2026 — Omnisend](https://www.omnisend.com/blog/newsletter-signup-examples/) — MEDIUM confidence
- [Newsletter Signup Forms Best Practices — MailerLite](https://www.mailerlite.com/blog/optimize-email-signup-form) — MEDIUM confidence
- [Sign-up Flows and Friction — CXL](https://cxl.com/blog/saas-signup-flows/) — MEDIUM confidence
- [Gated vs. Non-Gated Content — IDX](https://www.idx.inc/blog/performance-marketing/gated-vs-non-gated-content-why-how-and-when) — MEDIUM confidence
- [Best Sign Up Flows 2026 — Eleken](https://www.eleken.co/blog-posts/sign-up-flow) — MEDIUM confidence

---

*Feature research for: TCS v2.2 Evolved Discovery Engine*
*Researched: 2026-02-22*
