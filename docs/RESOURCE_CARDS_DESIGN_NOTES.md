# Resource cards — design notes

Companion to **[resource_cards.yaml](resource_cards.yaml)** (machine `play` blocks) and **[GAME_RULES.md](GAME_RULES.md)** (Resources / Mash). This document captures **distribution**, **tiers**, **grain & cask identity**, and **table-feel** goals for the physical and digital decks.

---

## Adjusted reality (important)

Because **demand** is so powerful in payouts, split legacy “super special” into **two tiers**:

### Tier A — Strong (target ~6–8% of deck)

Examples of effect *families* (tune numbers in YAML):

- **+$3–$5** on sell (conditional or once per sale)
- **+2 effective age** for Market Price Guide lookup only
- **Ignore rickhouse rent** for that barrel (or a capped discount)

### Tier B — Global swing (target ~2–4% of deck)

Rare **market-moving** text — use sparingly:

- **+1** global market demand (after this sale resolves, or at a fixed timing you define)
- **−1** global market demand

Keep these **very rare** so the demand track stays readable and fair.

---

## Final recommended distribution (precision target)

| Band | Share |
|------|--------|
| **Normal** (plain type, no rule) | ~68% |
| **Special** (helpful, local) | ~22% |
| **Strong special** (Tier A) | ~6% |
| **Global swing** (demand ±1) | ~2–4% |
| **Detrimental** (“soft” negatives) | ~4–6% |

### Example 100-card deck

- 68 normal  
- 22 special  
- 6 strong special  
- 2–4 demand modifiers  
- 4–6 detrimental  

The **digital** prototype may use a **larger** deck (e.g. ~230 cards) with the **same percentages** so table density matches today’s market piles.

---

## Design trick: detrimental = “soft negative”

**Bad (feels punitive):** “Lose $5.”

**Good (still playable):** “This bourbon sells at **−$2**” (adjust sale proceeds, not a separate gut-punch).

Why: keeps decisions interesting without “take that” fatigue.

---

## Advanced: tie specials to strategy paths

Instead of random bonuses everywhere, align **grain identity** with **playstyle**:

| Grain | Real-world character | Game direction |
|-------|----------------------|----------------|
| **Corn** | 51%+ of bourbon; sweet, full, reliable yield | **Baseline / engine** — stable value, ignore small demand penalties, “counts as extra corn” variants |
| **Rye** | Spice, complexity, high-rye identity | **High demand upside** — bonuses when demand is high; optional draw extra bourbon card on sell |
| **Wheat** | Smooth, “wheated” premium lines | **Consistency** — floors on sale value, ignore one small detrimental, +value per age band |
| **Barley** | Supporting malt, enzymes | **Efficiency** — cheaper actions once, +age tick, “wild grain” for mash flexibility |

**Cask** is the **modifier layer** (char, format, finish): aging speed, multipliers at high age, risk/reward “sell early” clauses, award thresholds — **not** the same role as grain identity.

**Rule of thumb:** **Grain = which bourbon you’re making. Cask = how it evolves.**

---

## Power hierarchy (relative)

1. **Corn** — required baseline (low individual power, high consistency)  
2. **Barley** — utility / combo glue  
3. **Wheat** — stability / downside protection  
4. **Rye** — market-linked upside  
5. **Cask** — highest variance / long-horizon impact  

---

## Example mash identities (table pitch)

- **High-rye** — volatile; wins in hot markets  
- **Wheated** — safe, steady income  
- **Barley-optimized** — fast cycles, lower costs  
- **Premium cask build** — slow burn, late payoff  

---

## Bottom line

If you do nothing else:

- ~**70%** normal, ~**25%** helpful, ~**5%** powerful, ~**5%** negative  
- Keep **demand modifiers** **very rare**  

That gives **stability**, **excitement**, **tension**, and **replayability**.

---

## Grain “characters” vs real life

**Yes — grain character is consistent with real bourbon**, as long as you **simplify** for play:

- Real distillers already talk about **corn-forward**, **high-rye**, **wheated**, **malted barley** profiles.  
- You’re turning those **flavor identities** into **mechanics** (demand sensitivity, floors, efficiency). That’s aligned with how the industry discusses mash bills.

### Corn (foundation)

- **Real:** ≥51% corn, sweet body, reliable yield.  
- **Game:** engine / baseline; optional “ignore −1 demand penalty” style effects.

### Rye (bold / spicy)

- **Real:** spice and complexity; “high rye” as a category.  
- **Game:** upside when demand is strong; optional extra bourbon draw on sell.

### Wheat (smooth)

- **Real:** softer profile; known wheated brands.  
- **Game:** floors, ignore small detrimental hits, steady age-band value.

### Barley (support)

- **Real:** malt, fermentation support, not usually dominant flavor.  
- **Game:** efficiency, +age, flex slots.

### Cask (huge design space)

- **Real:** new oak, char levels, finish casks — major impact on color, vanilla/caramel, perceived age.  
- **Game:** **multipliers**, **extra aging**, **risk casks**, **award shortcuts** — your deepest card text space.

---

## Next steps (optional)

- Flesh out a **full 100-card** printable list from `resource_cards.yaml`.  
- Map **resource types → player boards** or “distillery paths” (Catan-style identities).  
- Run `npm run sync:resource-cards` after editing YAML so `lib/*.generated.json` stays in sync for the app.
