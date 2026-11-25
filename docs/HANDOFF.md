# Lanternhold handoff (24 Nov 2026)

This handoff stands on its own for the new Lanternhold project. It is current as of **v124**, live at https://lanternhold.born2gamellc.com.

## Where Lanternhold work happens

From 24 Nov 2026, John's Claude project **Lanternhold** is the home for everything about the game: code and releases, the wiki, the AWS backend, promotion and itch.io, and player feedback. The Born 2 Game project no longer takes Lanternhold work. This repo is the project's repository, and this file is the long-form memory: update it when something lasting changes (a new system, a deploy, a decision from John).

## Release rule (John, 24 Nov 2026)

Do not ship changes one at a time. Collect everything John asks for into one numbered release, build and test it all together, then ship it once with a single summary of what changed. Only an urgent fix to something broken goes out on its own.

## Where the code lives

**`johnmink1/lanternhold`** is the source of truth (moved from `johnmink1/pricing-tools` on 24 Nov 2026, history kept). Edit only here. The old copies in pricing-tools are gone; a `LANTERNHOLD-MOVED.md` there points here.

| Path | What it is |
|---|---|
| `lanternhold/core.js` | All game rules: classes, foes, loot, crafting, events, the `api` export list. Any new function must be added to that big export list at the bottom. |
| `lanternhold/ui.js` | All UI, the in-game Delver's Guide (`GUIDE`) and `PATCH_NOTES` (newest first). The next version is **v125**. |
| `lanternhold/style.css`, `index.html` | Styles and markup. |
| `lanternhold/vector.js` | Illustrated SVG sprites (`ART.enchanter`, `ART.armorer`, classes, foes). |
| `lanternhold/sprites.js` | Pixel fallback sprites and `itemIcon`. |
| `lanternhold/intro.js`, `music.js` | Intro story and the soundtrack player. |
| `lanternhold/stamp.py` | Writes a new build number into `version.json` and the asset query strings. Run it before every release. |
| `lanternhold-wiki/build.js` | Generates the public wiki (`/wiki`) from the game files. Never hand-edit the wiki. Check with `node lanternhold-wiki/build.js` and then `rm -rf out`. |
| `lanternhold-music/` | The music renderer. |
| `infra/lanternhold-accounts.yaml` | CloudFormation stack `lanternhold` in us-east-1. It holds Cognito, DynamoDB, the HTTP API and the inline Lambdas. |
| `infra/lambda/*.js` | Lambda sources: heroes, market, mail, admin, profile, warden, exchange, store, perks, authchal, wixlogin, invite, worldboss, looks, reset, loot. `python3 infra/build.py` minifies them into the YAML. The inline limit is 4 KB each. |
| `infra/chat`, `infra/ring` | Chat and Ember Ring (PvP) server code. |

This repo also publishes the site: `.github/workflows/deploy.yml` builds `lanternhold/` plus the wiki and deploys GitHub Pages (custom domain lanternhold.born2gamellc.com) on every push to `main` that touches the game or wiki, or on demand (workflow_dispatch).

## How to release

1. Run `git fetch origin main && git checkout -B claude/lanternhold-vNNN origin/main`.
2. Make the edits and add a `PATCH_NOTES` entry in ui.js. You can skip the patch note for admin-only changes.
3. Run `python3 lanternhold/stamp.py`.
4. Test locally:
   - Start a server with `cd lanternhold && python3 -m http.server 8777`.
   - Test with Playwright on desktop (1280x800) and iPhone 13.
   - Use floor 51 for tests, because floor 50 is a boss floor.
   - `window.LHDebug = { S, save, L, events }` is available in the page. `migrate()` resets `s.foe` on load, so inject foes through `LHDebug.S`, not through the save.
5. Open a PR into `main` and squash-merge it. Threads merge their own PRs.
6. Merging publishes: `deploy.yml` runs on the push to `main` (a minute or two). If it doesn't start or fails, run it with workflow_dispatch, ref `main`; a deploy-pages hiccup sometimes needs a second run.
7. Verify by fetching `https://lanternhold.born2gamellc.com/version.json?t=<now>` and matching the build number.

House rules:
- Family-friendly content.
- Never show a bare "Level": say "power level" (training) or "hero level" (XP).
- Track every change against a before-baseline and report whether it helped.
- Lanternhold stays **off the store Discord**: the bot's LANTERNHOLD_DISCORD switch is off. John plans a separate Lanternhold Discord.

## AWS

Everything is in account 500041422762, region us-east-1. The CloudFormation stack is named `lanternhold`, functions are named `lanternhold-<name>`, and the trade table is `lanternhold-trade`.

There is no working AWS CLI. The cloud container's keys are invalid, and VENGEANCE has no CLI. Deploy server code through **AWS CloudShell** in John's Brave, once John has signed in to the console:
- Write files with `echo <base64> | base64 -d > file`.
- Then `aws lambda update-function-code`.
- A later stack update from `main` carries the same code.

**Admins** are members of the Cognito group `admins`.
- The Admin tab in the game shows only for them, using the `cognito:groups` claim. It has players, ban/unban, Sigil grants, resets, server wipe, Grand War link approvals and the audit log.
- `infra/lambda/admin.js` gates the server side.

**Lantern Keeper:** `/leaderboard` returns `keeper` when an admin's hero was seen in the last 3 minutes. Keepers get +25%, and a small lantern shows top-right in the arena.
- This was deployed 24 Nov by John via CloudShell: the Lambda code plus an inline policy `lanternhold-keeper` on the admin role.

**Sigil store:**
- Purchases credit only when the game calls `POST /store/sync` (`store.js`) with the buyer's Wix member token. There is no webhook.
- Don't hand-grant a purchase with `/admin/grant`, because a later sync would credit it again.
- Sync logs are in CloudWatch under `/aws/lambda/lanternhold-store`.

**Lanternholder** costs 500 Sigils for 30 days, or $4.99/month.

## Live as of v105

- **v86–v91:** mana and stamina, wearer-only enchants, Ghost Lantern, status effects (burn, poison, stun, disarm), mastery XP, shielded foes, wandering merchant, bounty board, Lantern Keeper.
- **v92–v98:** XP bar tooltip, Keeper lantern, ambushes at 6% (×2 XP per creature), XP in the fight log, Lanternholder rename, Sigil shop.
- **v100:** XP for enchanting (8 × tier) and merging (6 × result; half on a failure).
  - Mercy Corps encounters, floor 5+, active play only:
    - **Rescue:** a monster holds a companion; freeing them gives +30% XP for 15 minutes.
    - **Wounded:** healers heal the companion to full within 45 seconds, for +15% damage and healing for 15 minutes.
  - About 1–1.5 of each per 4 hours.
- **v101:** **Admin event spawner** in the Admin tab, under "Test random events". It has one button each for:
  - Loot Goblin, Ghost Lantern, merchant, shielded foe, ambush, alliance elite, chest, Mercy rescue, Mercy wounded.
  - Any special attack, picked from a dropdown.

  It only changes the admin's own save. It uses core `spawnEvent(s, kind, now, rng, events, sp)` and `SPAWN_EVENTS`.
- **v102:** the Hold's tents (John: "just deploy what you think is best"):
  - **Shops at battle scale.** The party stands at its fight positions, and the shopkeeper stands where a monster would, at monster scale, behind a counter with a sign. The tabs in the counter panel are the only controls. The v99 speech bubble is gone.
  - **The Armorer (new):**
    - Upgrade: gold, one level at a time.
    - Merge: pick an item, then a copy, then confirm with the odds.
    - Scrap for gold: `smelt` pays 2× the scrap gold and gives no Dust.
    - The header button switches between the Enchanter and the Armorer.
    - Core uses `visitEnchanter(s, now, kind)` and `s.shopK`. Neither `enchAt` nor `shopK` is ever saved.
  - **Camp card ("In the Deep"):** one big Return to camp button, then a row with Enchanter, Armorer, Store and Draught.
  - **The Hold view:** tapping The Hold on the Map of the Deep opens a scene with four tents (Campfire, Enchanter, Armorer, Store). Each tent takes you there.

- **v103:** fix for John's report "did you get rid of the things?". Visiting a shop from the main camp showed the campfire scene, because `render()` checked `resting` before `visiting`. Now the shop visit wins.
- **v104:** Return to camp, Descend, a Draught, or any floor travel now ends a shop visit. Core `gotoFloor` and `useDraught` clear `enchAt` and `shopK`. Before this, John had to press Leave first.

- **v105: world boss Legendary loot** (John: a chance of a Legendary, drawn by lottery among everyone who fought, one ticket per rounded point of damage; a set per boss; boss shards upgrade them and trade on the market).
  - Server: `infra/lambda/loot.js` (function `lanternhold-loot`). `POST /boss/loot {id}` runs a seeded draw once the event has ended (seed = event id, so every claim agrees). Tickets = max(1, floor(boss score)). Legendary chance = min(75%, 12% × phases broken); shards = 5 + 3 × min(phases, 10), each its own draw. A claim is recorded once (`lc` on the boss row).
  - Shard market on the same Lambda: `GET /shards` (`?mine=1`), `POST /shards/list|buy|cancel`. Listings live in the trade table under `sh#` / `ss#<seller>`; a sale sends a `sale` letter with the gold to the seller's mailbox.
  - Core: rarity `legend`, `WB_SETS` (Colossus = hp, Sovereign = dps, Nyxmaw = heal, Leviathan = gold), 4 pieces each (main, chest/robe, ring, neck), 2-piece +15% (gold +25%), 4-piece +30% damage and health. Legendaries are bound, can't be merged, and upgrade with that boss's shards (`s.shards[boss]`, cost = next level) instead of gold. `makeLegend` caps item level so the winner can wear it.
  - UI: `lootBoss(id)` runs after the Sigil claim; Market > Boss shards view; set block in the item window. `LHDebug.lootBoss` exists for tests.
  - **The stack update for this Lambda must be deployed through CloudShell.** Until it is, the game says "The shard stall opens soon." and loot claims retry later.
  - Also in v105: the Enchanter and Armorer scenes scale to the arena (`shopGeo()`: a 198 × 74 focus box fills the arena, the room grows around it; v106 shrank it from 100 so short, wide panels keep big sprites).
  - v107: the Store is a visited shop too (`S.shopK = 'store'`, keeper sprite `ART.quartermaster` "Old Thessaly", plank-wall room in `buildShop`). Its panel is `storePanelHtml()` with `SW.mode` tabs Tonics/Supplies; `openStore()` falls back to the old `openStoreModal()` when there is no hero. Each shop header (`.shophead .shopbtns`) has swap buttons to the other two shops.
  - v108 Victor's Banner (John, 24 Nov 2026): heroes whose banner matches the last crowned Grand War season's Nexus holder get `WARWIN_FX` (+8% dps/hp/heal/gold, via `sidePerk`) and revive in `WARWIN_REVIVE` (10 s) through `reviveMs(s)`. The game reads `https://war.born2gamellc.com/api/nexus.json` (bot repo `koprulu/web.py` `build_nexus`, any-origin CORS, PR #217) every 15 min into `S.warWin = {side, season}`; `WAR_KEY` maps the war's `ascendancy` to the game's `radiant`. Nulls until Season 1 is crowned. It goes by in-game banner, not the verified commander link. Line `#winline` under Banner kin.
  - v109 Bestiary mastery (John, 24 Nov 2026): kills per Bestiary kind in `s.bk` (key `beastKey(foe)` = 'boss' or 'foe_'+sprite, packs count each foe, world boss/wounded excluded); `beastTier` = floor(n/`BEAST_STEP` 500), max `BEAST_MAX` 10, +`BEAST_PER` 1% each to damage (in `damageFoe` mult) and hero XP (`gainXp`, plus an `xpBonus` part for the current foe). Event 'beast' toasts each step; Journal Bestiary pages show `beastBar`. Full screen: `#btn-full` + Settings button, `toggleFull()`, `body.isfull` widens `#app` to 1840px; the button always shows (v110 added `.fit5`, which narrows the icon buttons) except where the Fullscreen API is missing (iPhone Safari). v111: if the browser grants fullscreen but keeps the window size (seen in John's Brave while Claude in Chrome controls it), a toast says to press F11. v112: `body.isfull` (wide layout) is set by `paintWide()` from the real window size (fills ≥95% of the screen and ≥1500 px wide), so F11 gets it and fake full screen never does; `#app` max is min(1840px,100%), body has overflow-x:clip, and a ResizeObserver on the arena re-runs `resize()` whenever it changes size.
  - v113 pacing v3 (John, 24 Nov 2026: leveling too slow, too long to reach the other parts of the game): `XP_A` 330→160, `XP_POW` 2.27→1.9; unlocks gear 2, camp 3, map/buy 5, jobs 6, guild 8, ring 10, sell 12, rekindle 15, boss/jset 18 (were 3/5/8/8/10/12/15/18/20/25/25); `JOB_SLOT_LV` [6,10,15,20,25,30]. Estimated steady play: level 10 in ~2 h (was 8), 20 in ~11 h (was 59). Level is derived from total `hxp`, so existing heroes jump up (old 12 → new 18). No server-side level gates exist.
  - v114 @mentions (John, 24 Nov 2026), client only: `knownChatters()` feeds the `#atbox` autocomplete (Tab/Enter/arrows); `mentionsMe(m)` matches `@HeroName`; `pingMentions` toasts (so it lands in the bell), plays a sound, and sets `chat.ment[room]` for the chat-button count and the gold tab underline. bgPoll now also polls banner and trade (`BG_ROOMS`) to catch pings. Party pings only arrive while that party room is polled. v115: the @ list also includes the Players Guild board (`boardList`, fetched once on the first @). Deploy gotcha: a CDN edge can cache an old ui.js under the new ?v= stamp for up to 10 min; a fresh stamp fixes it. Shop scenes are fixed at 16:10 in shop mode (`body.atench .stage .arena{flex:0 1 auto;aspect-ratio:16/10}`), so tall screens no longer stretch them.
  - v116 specialist shops (John, 24 Nov 2026: field crafting should be worse than at the shop that specialises in it). Core `SHOP_FX={mergeCut:.25,enchUp:.15}`, `FIELD_FX={tierDown:1,dust:1.5}`, `atShop(s,k)`. `mergeRisk` returns `shop` and `field` (risk at the Armorer = field x 0.75). `disenchant` now works outside the Enchanter: field = tier -1 (min I) and `enchCostAt` = ceil(1.5x Dust); at the Enchanter a 15% roll adds +1 tier (max IX). UI: Armorer has a Mass merge tab (`AW.mode 'mass'`, `data-awcap`), field merge/mass merge show the Armorer odds with a jump button, `atEnchanter` offers "Do it here" which opens the counter steps in a modal (`#fieldench`, same `shopClick` handler, field actions need camp). Help chat channel: client tab `help` (in BG_ROOMS for pings); server `infra/chat/index.js` room() allows `help` (deployed 24 Nov 2026).
  - v117 bundle (first release under the ship-together rule):
    - Item types: core `ITYPES` (weapons, off-hands, plate/leather/cloth, jewel) and `tyOf(it)` (old items get a type from class and slot in `normItem`). `usersOf`/`usable(cls, it)` replace every `m.cls === it.cls` check. Class sets, Legendary sets and the Goblin sack stay tied to `it.cls`, and region sets fit anyone. Type `fx` go through `wearTotals` (crit/power/boss raise `memberDps`, heal raises `healPerSec`, dodge works for any class in `soak`). `mergeKey` includes the type.
    - Item art: `vector.js` ICON2 (`SP.itemIcon(cls, slot, rar, scale, ty)` returns an SVG data URL), and UI `itemIco(it)`.
    - Inventory: one grid with `INV` filters (kind, rarity, who) and sorts, saved in localStorage `lh_inv`. Class dots on tiles; `typeBlock`/`typeFx` on item cards.
    - Banner lantern: the war site `/api/nexus.json` now has `live.held` per alliance (bot #218/#219). `S.warLive` and core `terrBonus` give +1% per territory, capped at 15%, folded into `sidePerk`. The `#bannerlamp` tooltip shows it.
    - @mentions: always toast and chime, flash the line with an `@you` tag, glow the chat button, show a "(n) @" tab title while hidden, and poll every 55 s while hidden.
    - Chat dock `#chatdock` + chat windows `#chatpops` (≥721 px, signed in; John: "like Torn's"): bottom-right bar with an icon per channel (`DOCK_CH`) and up to 5 whisper tabs; each opens its own window (`POPS`, `openPop`, saved in `lh_pops`), max 3 open, the rest minimized to their title. Windows poll their own rooms (`pollPops`) and count as viewing for unread/@ (`popViewing`). The big chat panel is phone-only now. `body.hasdock` shortens `#app` by `--dockh` so the bar never covers the skills. `initDock()` runs before the module's `var` lines, so those vars must stay without initializers.
    - Armorer/Enchanter filters: `SF` state (`lh_shopf`), `sfBar`/`sfApply`/`sfList` on every counter list; `shopScrap()`/`shopMass()` make scrap, smelt and shop mass merge act only on what the filters show.
    - Big screens: at ≥1700×1100 `#app` grows to min(100%, 190vh, 2600px) and the battle arena is capped at 66cqw tall (3:2), tested at 3440×1440 and 2560×1440.
    - Wounded art: vector `ART.wounded`, drawn by `drawWounded`.
    - Server bits deployed 24 Nov 2026 17:26 UTC via CloudShell with John's go: `infra/chat` (help room) and the `market`/`mail` item whitelist (`ty`, plus enchants i–l).
    - v118 (24 Nov 2026) NPC Guild (John): core block after `declineRecruit`: `NPC_RAR` (Common/Uncommon/Rare/Epic/Legendary: pow, job bonus, hireMin = minutes of `npcIncomeMin` = offlineGoldPerSec*60, wage = share of income per hour, Dust), `s.hires[id] = {rar, kind 'sign'|'short', at, until, m}` (generated members re-registered into `dyn` by `registerHero`), `s.hall = {at, offers, bench, rr, keep}` via `hallState` (6 offers, rotate 4 h, `npcReroll` for Dust). `npcHire(s, offerId | 'b:'+id, kind, pay)`, `npcRelease` (gear stays in bag, bench 3 days, rehire half price at old level), `payWages` in `tick` and in `grantOffline`: wages build `s.owed`, past one hour's worth the priciest signed hire walks off. Short contracts (2 h, 25% of hire, max 2) don't count in `companions()`. Lore companions (`LEGENDS`) no longer join from the story: `npcLegendArrives` keeps them on offer at the Hall. `npcMigrate` (s.npcV): owners keep them on a Legendary wage (John: "leave them, just have the player pay the cost"). UI `npcGuildHtml` at the top of the Guild tab, `rarTag`, Campfire **Let go** (`data-release`). Baselines: `s.wagesPaid`, hires per player.
    - v118 scene chips: the world boss and Loot Goblin bars moved into `#arena` as `.achips` (top-left, expand on hover).
  - v120 region trial clarity (player reports 25 Nov 2026: beat floor 50, sent back to 49 every time with no reason). Not a bug: `clearFloor` steps the party back from a region guardian while `regionNeed` says the region trial (10 alliance elites in the region, `TRIAL_ELITES`, plus its guardian) isn't done. The UI only toasted the first bounce per elite count (`lockToast` key) and feat/loot toasts pushed it off. Now `regionlock` shows an arena note every bounce and a toast at most every 20 s (delayed 1.2 s so it lands last), and `trialGoal()` puts "n/10 elites to pass floor N" on the goal line (`.goal.trial`, tooltip has the full rule) while the party waits at a guardian.
    - v119 fix (24 Nov 2026, John: "the @ broke in chat"): the v114 @ autocomplete was bound only to the phone chat box `#chatin`, so the v117 desktop chat windows (`.cpform` inputs) never showed it. It is now one shared controller (`paintAt(inp)`, `pickAt`, document-level `input`/`keydown` capture/`focusout` listeners, `isChatIn`) that moves `#atbox` into whichever chat form is being typed in. Test with a fake session in localStorage (`lanternhold.session.v1`) and Playwright routes stubbing `/chat` and `/heroes`; set `lh_intro` so the intro doesn't eat keys.
    - v119 fix 2 (24 Nov 2026, John: "not able to scrap for gold"): the shop filter bar `SF` is shared by every counter tab and saved in `lh_shopf`. A Rarity picked on Upgrade/Merge (e.g. Set) still applied on Scrap for gold / Scrap for Dust, where the Rarity menu is hidden (`sfBar(..., {noRar})`), so the list came out empty (Melt 0) while the Armour count still showed 51. `sfPass(it, true)` now skips the rarity check and `shopScrap` uses it; the rarity chips decide alone. Also `paintEnchPanel` skips timed (non-forced) redraws while a pointer is held on `#enchpanel` (`panelHeld`), so a gold tick between press and release can no longer swap out the button and lose the tap. Repro: set `SF.rar` via the Upgrade tab Rarity menu, then open Scrap for gold.

    - v119 fix (25 Nov 2026, John: "check the NPC hire cost"): hire prices and wages used `offlineGoldPerSec`, whose `totalDps(s, 0)` counts a mage's spell as always on once it was ever cast (+~70%) and drops for anyone down or unseated (unseat 4 companions at camp = Legendary for a third of the price). `npcIncomeMin` now uses `npcIncomeBase` (`steadyDps` of the best 5 non-short members, no timed buffs, no downs), cached per save in a WeakMap. The gold hover and Guild show **away income** (`offlineEarnPerSec`), the real overnight figure. Still open: `offlineGoldPerSec` itself keeps the mage bug (pays mage parties more away gold and raises Store prices), Wages run at `NPC_AWAY_WAGE` 0.5 while away (`payWages(..., away=true)` from `grantOffline`; John chose this 25 Nov 2026), since the yardstick is 2x away income: before, 5 Legendaries cost 180% of away income, now 90%.
    - v119 fix 2 (25 Nov 2026, Tim via John: hire-back went 4.07M to 4.18M while he saved): prices are locked per entry (`npcLock`/`npcPrice`, `o.c`). Offers re-price when the 4 h window turns (`o.ca`), bench entries lock at release. Bench entries made by older builds (no `c`, any reason; widened in a 2nd pass after Tim still saw rising prices) come back free (`c.free`), because the full-rate away wages that caused the walk-offs were our bug.
    - Version under the title (John, 25 Nov 2026): `#ver` in the header brand shows `v<NOTES_V> · build MMDD.HHMM` from `window.LH_BUILD` (UTC); tooltip has the full build. Ask players for it when checking whether they have an update.
    - Cloud save packing (25 Nov 2026, Tim: account save stuck ~15 min behind, sync failing, 1,880 items): `PUT /save` refuses bodies over 300 KB, and a 1,880-item save measured 257 KB even with plain test items. Saves over `PACK_AT` 150 KB are sent as `'gz1:' + base64(gzip(json))` (`packSave`/`unpackSave`, CompressionStream), about 22 KB for that save. Only the game reads `data`, so no server change. The sync-failed toast now shows the HTTP code.
    - Roadmap (John, 25 Nov 2026): Guide tab `roadmap` renders `ROADMAP` in ui.js (`roadmapHtml`/`bindRoadmap`, stops with `st` done/now/next, items `[icon, title, line, details, 'odds']`, finale `ends` by side); the wiki builds /wiki/roadmap/ from the same const. Four acts = four Grand War seasons. **No spoilers** (John, 25 Nov 2026: "dont spoil the story", after a player stopped reading): the roadmap teases features and act themes only, never plot, twists or how endings play out. The full story version lives only in the Lanternhold project files (`roadmap/roadmap-full-story-INTERNAL.md`), not in this public repo. Update `st` as acts open.

    - v120 world boss rework (John, 25 Nov 2026, after Kyvia led the preview with 718 vs John's 8): the old score was damage / foeHp(your deepest floor), so deep players scored ~1-15 and shallow parties with strong guest heroes hit the 400 cap. From the first weekend boss (id != '2026-11-23') core scores **real damage** (`s.wb.cap` set, no `unit`), `wbMult` gives hired/story companions `WB_NPC` 0.5 and applies `WB_TRAITS[wbBoss(id)]` (weak +30%, two resists -30%, a special per boss; `WB_ATK` 1.3). Phases: `WB_HP1R` 1e9, doubling (`wbPhase(total, id)`). Server `worldboss.js` caps an assault at `CEIL` 150 x foeHp(hero fl + 10) (`fh` mirrors core foeHp). Loot (`loot.js`, John picked personal rolls + token shop): each player rolls their own Legendary, p = min(20%, 2% x max(1, log10(dmg) - 2)) x min(1, 0.4 + 0.2 x phases), seeded by event + pid; shards = Rift tokens = 1 + max(0, floor(log10 dmg) - 2) + min(phases, 5). The preview's scores are x1000 for the roll. Tokens are client-side `S.wbTok`; `buyLegend` trades `WB_TOKEN_COST` 40 for a piece at the **Rift Gate** (John: a portal-style place outside, not a house, a keeper next to it and a chest): shop kind `'portal'` (`visitEnchanter`, `shopKind`), scene `buildPortal`/`drawPortalRoom`/`drawPortalChest`, keeper `ART.riftkeeper` (Warden Sable), panel `portalPanelHtml`; reached from the Hold view (5th spot, `HOLD_X`), the shop header buttons and Market > Boss shards. worldboss.js and loot.js were deployed by CloudShell on 25 Nov 2026 04:24 UTC with John's go (old code zipped in CloudShell `~/lhbak/`).
    - v125 Mythic boss gear (John, 25 Nov 2026: "boss gear should be above legendary... a long grind... a drop should be rare"): new RARITY `mythic` (pct 0.5) above `legend`; `makeLegend` makes `rar:'mythic'`, `normItem` migrates old `wb` items from 'legend'. `WB_PCT` 0.5, `WB_TWO` 0.2 (gold 0.3), `WB_FOUR` 0.45, sockets 4, enchant tier +2. `wbUpCost` = 2 x (up + 1) (110 shards to +10). `WB_TOKEN_COST` 150. loot.js drop chance p = min(3%, 0.4% x max(1, log10(dmg) - 2)) x phase factor (server change; needs a CloudShell deploy of lanternhold-loot).
    - v120 crafting log (John, 25 Nov 2026: "when I do the armorer and enchanter ... I want to see a log of what happened, what I gained and what I lost"), client only: bell notes can carry `g` (gained) and `l` (lost) string lists (`noteLog(..., det)`, `toast(..., det)`), shown by `noteDet` under a new **Crafting** bell tab (`noteCat` returns 'craft' for any note with g/l). `craftItem(it)` snapshots an item (name, +up, rarity, floor, stats, enchants) before the action; `craftLog`, `logMerge`, `logUp`, `logScrap`, `runMass` write entries for shop upgrade/merge/mass merge/smelt, Enchanter scrap and enchant moves (bell only, the counter already shows the result) and for field merge, mass merge, mass scrap, auto-scrap now, item-window upgrade and salvage (pop-up plus bell). Identical lines are grouped as "N×", and each list is capped at 14 lines.
    - v120 wages from the hire's own stats (John, 25 Nov 2026: "base fee + power level + gear level + health", same rule for all NPCs; replaces his earlier lock-at-hire pick; he OK'd the numbers): `npcWageAt(rar, lv, dpsPct, hpPct)` = `NPC_FEE` (15/40/90/225/600) x `COST_GROWTH`^power level (+2.74%/level) x (1 + 0.25 x gear damage bonus) x (1 + 0.25 x gear health bonus). Income plays no part. Legendary at power level 250, no gear = 521k gold/h (Tim's old was 360k/h). `npcWageParts` feeds the rarity-tag tooltip; offer cards use `npcOfferWage`. **Nothing costs Dust per hour** (John: no way to build Dust up yet). Spellcasters (`NPC_CASTER` mage/necro/healer) pay Dust once at sign-on: at least `NPC_CASTER_DUST` 10/25/60/150/600, floor-scaled by `npcDust`; offers re-price once (`o.cv` 2).
    - v122 New Playthrough / NP+ (John, 25 Nov 2026, spec `docs/NP-PLUS.md`). Core: `NP_MAX` 10, `NP_FOE` .25, `NP_ILVL` .1, `NP_PER` .02, `npTier`, `npReady` (story beat `act1` or `maxFloorEver` > `ACT_ONE_END`), `startNP(s, tier, at, force)` wipes the save in place except `NP_KEEP` (hero, lore, feats, Sigil buys, tonics, Rift tokens, account flags), `makeFoe` wraps `makeFoe0` (x`npFoe`, never the world boss), gear gets `ilvl: npIlvl` and `t` (tier), `canWear` refuses `npOld` items, `npBonus` in `partyMult`/`goldMult`/`maxHpOf`. UI: `#npbox` under Rekindle (Skills tab, Rekindle view), typed confirm `NP+n`, `publishHero()` then `POST /np`, then `startNP`, cloud push and a reload; `syncNp` (from `loadProfile`) force-resets a save that is behind the server's tier. Badges: `npBadge` (Guild board, chat via the client-sent `np`, item window), `npRing` portrait ring on profile cards (Chipplin's idea). `tradeItem` keeps `t`.
    - v122 server: new Lambda `lanternhold-np` (`infra/lambda/np.js`, GET/POST `/np`, role `NpFunctionRole`): +25 Sigils once per tier, 7 days apart, needs hero `fl` >= 151, stamps `np`/`npAt` on the wallet and the hero, and clears the player's trades (own listings and sent offers deleted, all inbox letters deleted so old gold never pays, offers others sent go back as 'return' letters). This replaces the spec's "letters before npAt pay 0". `market.js`: per-tier partitions `mkt#<cls>#<tier>` (tier 0 keeps `mkt#<cls>`), list/buy locked 24 h after `npAt`, items with `t` below the tier refused. `mail.js`: send needs the same tier on both heroes, no 24 h lock on either, and returns 409 otherwise. `heroes.js` GET /heroes returns `np`; `reset.js` keeps `np`/`npAt` and drops tiered listings; `infra/chat` stores the client's `np` for the badge. Lambdas are near the 4 KB inline limit (`build.py` now checks header + code <= 4096): market 4014, mail 4031, reset 4039.

    - v122 Training Grounds (John picked "dummy to test damage", 25 Nov 2026): Party tab button `#f-train` opens `openTraining()` (ui.js): `trainRows()` table from core `steadyDps` (now exported), `wearVal(...,'boss')`, `healPerSec`, `maxHpOf`, and a 10 s live test (`trainRun`) summing `totalDps` every 100 ms plus dummy strikes (`clickDamage`, crit x5). Client only.
    - v122 server note: `lanternhold-np` (role `lanternhold-np-role`, integration `inzby7i`, routes POST/GET `/np`) was created by CLI on 25 Nov 2026 and is not in the stack; delete those before any full stack update. Deployed and smoke-tested (401 unauthenticated).
    - v123 formation shuffle (John 25 Nov 2026): core `SHUFFLE_EVERY` 25 (guardians on floors 25/50/.../150, not the world boss), `shuffleTick` after `specialTick`: first at +8 s, then every `SHUFFLE_GAP` 22 s, warns `SHUFFLE_WARN` 3 s ahead (`shufwarn`), scrambles occupied seats for `shuffleTime` (10 s, -20%/level of the new relic `anchor` Lodestone Anchor, max -80%) into `s.shuf = {orig, until}`. `tick` start restores via `shufRestore` when time is up or the foe is gone/new (`foe.shOn`); joiners/leavers handled. A tank with Shield Wall active when it lands blocks it (`shufblock`); auto-cast tanks hold Shield Wall for the scatter vs these guardians. Saves never keep a shuffled line (`shufBase` in ui `save`/`saveObj`, `migrate` reads `o.shuf.orig`).
    - v123 locked doors and chests (John 25 Nov 2026, "you have to have a rogue"): `makeFoe0` returns `lockFoe` at `LOCK_CHANCE` 2% on non-boss floors from `LOCK_FLOOR` 10 (sprites `door`/`lockbox`). `lockTick` (tick returns early, no combat): a Rogue in the party picks for `LOCK_TIME` 5 s (taps add `LOCK_TAP` 0.35 s via `strike`; stunned/down Rogue pauses), else the party walks past after `LOCK_SKIP` 4 s. Door = `lockGold` (8x foe gold), chest = `lockDust` ((10 + 1.2*floor) x npBonus), `LOCK_SIGIL` 1% for 1 Sigil through `s.sigPend` -> `POST /sigils/earn` kind 'drop', so the server's found-Sigil daily cap (15, perks.js) applies. Counts as a foe for floor progress. Baselines to track: `stats.locks`, `stats.lockSkip`, Rogue use in parties.
    - v124 hard feats (John 25 Nov 2026): `FEATS` r5, r25, b500, relall, up10 / pup10 (`maxedKit(s, id)`: every `openPos` spot holds an item at `UP_MAX`), solo (`stats.soloLamp`, counted in `killFoe` when the floor `ACT_ONE_END` guardian dies with one seated hero), np3, np10. Each feat is +1% (`FEAT_PER`). Feats survive NP+.
    - Party tab redesign: John asked for mockups 25 Nov 2026 (in project files lanternhold/party-redesign/), then said to forget it. Do not build unless he asks again.

## Open asks and things to watch

- **John's verdict on v102.** He rejected the v98 and v99 shop screens ("horrible", "hard to follow"). v102 follows mockup Option A, the Hold view, and In the Deep option 2.
  - The mockups are in the old project folder `lanternhold/mockups-shops/`: `option-A-tabs-in-counter.png`, `option-B-board-above-shopkeeper.png`, `hold-view-on-map.png`, `in-the-deep-card.png`.
  - If he wants Option B instead, put a wooden action board above the shopkeeper on the canvas and leave the panel with just the list.
- **Should upgrade and merge move to the Armorer only?** They still also work from the Gear tab's item window, which needs a camp. Enchanting already works only at the Enchanter.
- The Hold view has no walking animation yet. Tapping a tent opens that place straight away.
- **Feedback to collect from John:**
  - Ghost Lantern frequency, stun annoyance, and whether healers run out of mana.
  - Ambush frequency and the gold it gives.
  - Mercy Corps rarity.
  - The shop feel.
- A separate Lanternhold Discord, which John will set up later.
- itch.io page: born2gamellc.itch.io/lanternhold (edit: itch.io/game/edit/5427018). John is signed in in Brave; make itch changes there through Claude in Chrome, not the built-in browser. The upload is a small wrapper zip that plays the live site, so a release needs only a devlog, not a new upload. Last devlog: 24 Nov 2026, covering v86–v119.
- **Promo follow-ups:** the IG/FB Story is not posted, the in-store QR sign is not printed, and the day-3/day-7 results check against the 23 Nov baseline (7 heroes, deepest floor 135) needs redoing. Never post anything public without John's OK on that specific post.
- **Attribution gap:** promo links carry `?ref=<place>`, but the game doesn't record it yet.
