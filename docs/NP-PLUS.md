# New Playthrough (NP+) — approved spec

John approved this design on 25 Nov 2026 ("Yes, as designed"). Build it in one bundled release. The server part changes AWS Lambdas, so deploy it only with John's go, as usual.

## Player side

- **Unlock:** after beating the floor 150 guardian (`ACT_ONE_END`). A confirmation screen lists what resets and what is kept, then the reset happens (one-way).
- **Resets:** gold, Dust, floors, power levels, hero level/XP and stat points, skills, gear and bag, Embers and relics, companions and NPC hires, the story.
- **Keeps:** everything bought with Sigils (wardrobe, Bag of Holding, bag/roster spots bought with Sigils, pass), profile and cosmetics, journal lore, feats, Ember Ring rating.
- **Reward:** +25 Sigils, and the tier goes up: NP+1, NP+2 … NP+10 (cap). The tier shows as a badge on the profile card, the leaderboard and in chat.
- **Per tier n:** monsters ×(1 + n)·(1 + n·floor/100) health and ×(1 + 0.5n)·(1 + n·floor/200) damage (v125, John 26 Nov 2026; was ×(1 + 0.25n)); gear drops at +10%·n item level; permanent +2%·n damage, health and gold (max +20% at NP+10).
- **Versus Rekindle:** Rekindle stays the short loop (floors, gold, training → Embers). NP+ is the long loop (everything → tier + Sigils).

## Market safeguards (server enforced)

1. **No gold carried across:** the server stores `npAt` (time of the reset) and `np` (tier) on the hero. Any sale/payment letter, listing or mail offer created before `npAt` pays 0 gold when claimed. Starting NP+ cancels the player's listings and pending offers (those items are gone with the reset).
2. **No alt stashing:** every item carries `t`, the tier it dropped in. A hero can't equip an item with `t` lower than their tier. The market/mail whitelist (`infra/lambda/market.js`, `mail.js` `item()`) must keep `t`.
3. **Separate markets per tier:** listings carry the seller's tier; buyers only see and buy listings of their own tier.
4. **Trade cooldown:** market and mail lock for 24 h after starting NP+, and until hero level 12 as today.
5. **No Sigil farming:** the server grants the 25 Sigils, once per tier, with at least 7 days between tiers (saves are client-side, so this cap is what stops a faked floor-150 clear).

## Baselines to track after ship

Players reaching floor 150, NP+ starts per tier, market listing volume and median prices per tier before vs after.

## As built (v122, 25 Nov 2026)

- Safeguard 1 is done by clearing instead of paying 0: when NP+ starts, `infra/lambda/np.js` deletes the player's listings, sent offers and every inbox letter (so no old sale or payment gold can be claimed) and returns offers from other players to them.
- The 25 Sigils also need the hero board to show floor 151+ (`fl`), which the game publishes right before asking.
- Extra, from Chipplin's Discord idea: a gold portrait ring with the tier on profile cards.

## NP+ marks (John, 26 Nov 2026)

From NP+2 monsters can carry marks (`NP_MODS` in core.js, rolled by `npMark` in `makeFoe`): Stoneskin (Tank/Rogue damage −60%), Spellproof (Mage/Necromancer/Healer damage −60%), Plague Aura (party healing and life steal −60%), Ironclad (takes 10% damage from a hero without Piercing; the new per-wearer Piercing enchant, +10% per tier up to 90%, rolls only on gear that dropped at NP+2 or deeper; Rogues pierce 25% on their own; players' guest heroes have no gear, so they pierce only as Rogues). Normal foes: 15% per tier past 1 (max 75%), two marks from NP+6. Guardians: always 1, 2 from NP+5, 3 from NP+8. Stoneskin and Spellproof never come together. World boss untouched. Sim (mage bot, no party swaps): NP+2 floor 50 in 8.8 h without marks, 12.1 h with them.
