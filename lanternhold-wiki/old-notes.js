// Lanternhold patch notes v119 and older. The game keeps only the newest notes;
// the wiki joins these on the end so the full history stays on the Patch notes page.
// Evaluated by build.js with the core API in scope as L.
[
    { v: 119, date: 'November 24, 2026', title: 'Wages at a glance', items: [
      'Hover your gold and Dust in the top bar for a small table: income, NPC wages per hour in red, what you keep after wages, and what hires have cost you so far.',
      'Fixed: very big saves (thousands of items) could not sync to your account, so the account save fell behind. Big saves are now packed down to about a tenth of the size.',
      'NPC Guild prices are now set when a hire appears at the Hall or walks to the bench, and hold until the next new faces. They no longer creep up while you save for them.',
      'Sorry: everyone who went to the bench before this fix (walked off unpaid or let go while the old full-rate wages ran) comes back for free.',
      'Fixed: NPC Guild hire prices and wages no longer jump around. They used to count a mage\u2019s spell as always on (prices up to 70% too high) and drop when a companion was down or sent to the Campfire. Prices now follow your best five companions at full strength, so the price you see is the price you pay.',
      'Wages are now half rate while you are away, so they take the same share of your smaller away income. Before, a big roster could cost more than the party brought home overnight and hires walked off.',
      'The gold hover and the NPC Guild now show your away income (what your party brings home while you are gone) and your wages while away.',
      'Fixed: Scrap for gold at the Armorer (and Scrap for Dust at the Enchanter) could show Melt 0 even with spare gear listed, because a Rarity filter picked on the Upgrade or Merge tab still applied. The rarity buttons on the scrap tab now decide alone.',
      'Fixed: typing @ in the desktop chat windows shows the list of players again (Tab, Enter or a click fills in the name). It only worked in the phone chat before.',
    ] },
    { v: 118, date: 'November 24, 2026', title: 'The NPC Guild', items: [
      'The Guild Hall now has an NPC Guild next to the Players Guild. Hire companions for gold or Dust: Common, Uncommon, Rare, Epic or Legendary. Rarer hires fight harder and work camp jobs better, but cost more.',
      'Hires draw an hourly wage, even while you are away. Sign one on to take a companion spot, or take a 2 hour contract when you have no room: paid up front, no wage.',
      'New faces arrive every 4 hours; New faces now rerolls them for Dust. Some hires need a hero level, a floor reached or your banner.',
      'The lore companions (Sir Ashe, the Pale Oracle, Varga, Brann and the Hollow King) are now Legendary hires. When the story reaches them, they wait at the Guild Hall. If you already have them, they stay with you, on a Legendary wage.',
      'If your gold can’t cover an hour of wages, the priciest hire walks off. Let go sends one back by choice. Their gear always returns to your bag, and they wait on the bench 3 days to be hired back for half price.',
      'The world boss and Loot Goblin bars moved into the battle scene as small chips in the top-left corner, so they no longer squash the picture.',
    ] },
    { v: 117, date: 'November 24, 2026', title: 'Real weapons, one inventory and the banner lantern', items: [
      'Weapons now have types with their own jobs. Sword (Tank, Rogue): +2% life steal. Dagger (Rogue): +5% critical hits. Mace (Tank, Healer): +8% damage to bosses. Morningstar (Tank): +15% damage. Staff (Healer, Mage) and Scepter (Necro, Healer): +10% healing or spell power. Wand (Mage, Necro): +10% mana regen and +3% critical hits.',
      'Off-hands too: Shield (Tank) +4% block, Parrying dagger (Rogue) +3% dodge, Tome (Healer, Necro) +8% healing and life drain, Orb (Mage) +4% critical hits.',
      'Armour goes by weight: plate for Tanks, leather for Rogues, cloth for Healers, Mages and Necromancers. Rings and trinkets fit any class. Your old gear keeps its stats and gets a type.',
      'New, detailed item art, so you can tell a sword from a staff at a glance.',
      'One inventory: every spare piece in one list. Filter by weapons, off-hands, armour or jewellery, by rarity and by who can use it, and sort by best, level, rarity, type or newest. Each item shows which classes can use it.',
      'The banner lantern: the more Grand War territories your banner holds right now, the stronger you are here. +1% damage, health, healing and gold per territory, up to +15%. Hover the lantern at the top right to see it.',
      '@ mentions are loud now: a toast, a chime, a flashing @you line, a glowing chat button and a count on the browser tab.',
      'Chat bar on wider screens, bottom right: an icon for each channel and a tab for each whisper, each with its unread or @ count. Click one and that chat pops out in its own small window. Keep several open at once; click a title to tuck it back into the bar. The game leaves room for the bar, so it never covers your skills.',
      'The Armorer and the Enchanter use the same filters as your pack on every tab: weapons, off-hands, armour or jewellery, rarity, who can use it, and sort. Scrap and mass merge only touch what the filters show.',
      'Shops: the Armorer and Enchanter tabs stay in view on every tab; the shop scene no longer grows tall enough to push them off screen.',
      'Big and ultrawide screens: the game grows with your screen and the fight scene keeps a sensible shape, so your party is bigger and no longer stands under a giant empty wall.',
      'Mercy Corps wounded companions have their own art: a bandaged medic on a bedroll.'] },
    { v: 116, date: 'November 24, 2026', title: 'Specialist shops and a Help channel', items: [
      'The Armorer’s forge: every merge at the Armorer carries 25% less risk than merging in the field. The Armorer now has a Mass merge tab too.',
      'The Enchanter’s touch: enchants moved at the Enchanter keep their tier and have a 15% chance to come out one tier stronger.',
      'Enchanting in the field is back. It works at any camp, but the enchant loses one tier and costs 50% more Dust.',
      'Merge, mass merge and enchant screens show what you would get at the shop.',
      'New Help channel in chat for questions. Other delvers and the Lantern Keepers can answer.'] },
    { v: 115, date: 'November 24, 2026', title: '@ mentions find everyone', items: [
      'The @ list now includes every hero on the Players Guild board, not only people who chatted lately.'] },
    { v: 114, date: 'November 24, 2026', title: '@ mentions in chat', items: [
      'Type @ in chat and start a name to mention another player. Pick from the list with a tap, Tab or Enter.',
      'When someone mentions you in Global, Banner, Trade or Party, you get a pop-up and a sound, it goes in the bell, and the chat button and channel tab light up. The message is highlighted in gold.',
      'Fixed: on tall screens the Enchanter and Armorer scenes stretched very tall on the Scrap tab. Every shop scene now keeps its shape on every tab.'] },
    { v: 113, date: 'November 24, 2026', title: 'Faster hero levels', items: [
      'Hero levels come much faster: about twice as fast early on and four to seven times as fast from level 20. Your hero keeps all the XP it has, so most heroes jump up several levels right away.',
      'Every part of the game opens sooner: Gear at 2, the Campfire at 3, Map travel and Market buying at 5, Camp jobs at 6, the Players Guild at 8, the Ember Ring at 10, Market selling at 12, Rekindling at 15, and the world boss and job sets at 18.',
      'Camp job slots now open at hero levels 6, 10, 15, 20, 25 and 30.'] },
    { v: 112, date: 'November 24, 2026', title: 'Smoother full screen', items: [
      'Going in and out of full screen (the button or F11) no longer leaves the page wider than your window. The wider layout now turns on whenever the game really fills your screen, F11 included, and turns off the moment it doesn’t.'] },
    { v: 111, date: 'November 24, 2026', title: 'Full screen help', items: [
      'If your browser keeps the game inside its window when you press full screen, the game now tells you to press F11 instead, which always works on a computer.'] },
    { v: 110, date: 'November 24, 2026', title: 'Full screen button stays put', items: [
      'The full screen button no longer hides when the top bar is crowded. The icons squeeze a little instead.'] },
    { v: 109, date: 'November 24, 2026', title: 'Bestiary mastery and full screen', items: [
      'Bestiary mastery: every 500 of one kind of creature you defeat gives +1% damage and +1% hero XP against that kind, up to +10% at 5,000. Open a creature’s page in the Codex Journal to see your count, a progress bar and the next step. Counting starts today.',
      'The XP bar breakdown shows your Bestiary bonus against the foe you are fighting.',
      'New full screen button at the top right (also in Settings). The game fills your whole screen with no browser bars, and spreads out wider so you can see more. Press Esc or the button again to leave.'] },
    { v: 108, date: 'November 24, 2026', title: 'Victor’s Banner', items: [
      'The alliance that wins a Grand War season now holds the Nexus in Lanternhold too. Every hero under its banner gets +8% damage, health, healing and gold, and fallen allies get back up in 10 seconds instead of 15.',
      'It lasts until the next season is crowned. Look for the crown line under your marching order once Season 1 ends.'] },
    { v: 107, date: 'November 24, 2026', title: 'Visit the Store', items: [
      'The Store is now a shop you walk into, like the Enchanter and the Armorer. Old Thessaly runs the counter, with shelves of glowing tonics behind her.',
      'Tonics and Supplies sit in tabs under the scene. Buy and drink without leaving the shop.',
      'Every shop header has buttons to hop straight to the other two shops.'] },
    { v: 106, date: 'November 24, 2026', title: 'Bigger shop scenes', items: [
      'The Enchanter and the Armorer no longer shrink the party and the shopkeeper in short, wide windows. The sign and lanterns tuck in under the ceiling instead.',
    ] },
    { v: 105, date: 'November 24, 2026', title: 'Legendary world boss loot', items: [
      'World bosses now drop Legendary loot. When an event ends, a draw picks who wins the boss’s Legendary (if one drops) and who gets each of its boss shards.',
      'Every whole point of boss score is one ticket, and anyone who hit the boss gets at least one. The more phases the server breaks, the better the odds of a Legendary and the more shards drop.',
      'Each world boss has its own four-piece Legendary set (weapon, chest, ring, amulet) with 2-piece and 4-piece bonuses. Legendaries are bound to the winner.',
      'Boss shards upgrade that boss’s Legendary pieces at the Armorer. Buy and sell shards on the new Boss shards market.',
      'The Enchanter and the Armorer now scale to your window, so the party and the shopkeeper fill the scene on wide, tall and phone screens.',
    ] },
    { v: 104, date: 'November 24, 2026', title: 'Leaving the shops', items: [
      'Fixed: pressing Return to camp, Descend or Draught while in the Enchanter or Armorer now leaves the shop.',
    ] },
    { v: 103, date: 'November 24, 2026', title: 'Shops at camp', items: [
      'Fixed: visiting the Enchanter or the Armorer from the main camp showed the campfire instead of the shop.',
    ] },
    { v: 102, date: 'November 24, 2026', title: 'The Hold’s tents', items: [
      'The Enchanter’s shop is rebuilt: your whole party stands where it does in a fight and the Enchanter stands behind his counter where a monster would. All the choices are in the counter panel below.',
      'New: the Armorer. Upgrade gear with gold, merge two copies into one, or melt spare gear for twice the gold of a normal scrap (no Dust).',
      'The camp card is cleaner: one big Return to camp button, then a row with the Enchanter, Armorer, Store and your Draughts.',
      'Tap The Hold at the top of the Map of the Deep to see its tents (Campfire, Enchanter, Armorer, Store) and travel to one.',
    ] },
    { v: 100, date: 'November 24, 2026', title: 'The Mercy Corps on the road', items: [
      'Rare Mercy Corps encounters, from floor 5, while you are playing. Now and then a monster holds a Mercy Corps companion captive: defeat it to free them and get +30% hero XP for 15 minutes.',
      'Sometimes you find a Mercy Corps companion lying wounded on the path instead. Nobody fights: your healers pour their healing into them, Lantern Hymn mends a big chunk, and every tap is a bandage. Heal them to full within 45 seconds for Mercy’s Thanks, +15% damage and healing for 15 minutes. If time runs out, other medics carry them to safety, and nothing is lost.',
      'Both buffs show in the tonic bar under the fight with their time left, and the rescue counts in the XP bar’s bonus list.',
      'Enchanting and merging gear now give hero XP: more for higher enchant tiers and higher merges, and half for a merge that fails.',
    ] },
    { v: 99, date: 'November 24, 2026', title: 'The Enchanter’s shop, rebuilt', items: [
      'The Enchanter has been redrawn: an old, hooded enchanter with half-moon spectacles and a glowing crystal, standing behind his counter in front of a turning rune circle. Your hero walks in at full size.',
      'The top of the screen now says you are in the Enchanter’s Shop, with a Leave shop button, instead of showing the dungeon floor.',
      'His question hangs in a speech bubble above him: Enchant an item, Disenchant or Scrap for Dust.',
      'Enchanting is now done one plain question at a time in the counter under the scene, with no pop-ups: pick the item, pick the enchant, then confirm. A short summary says exactly what moves, what is used up and what it costs, and the items you pick appear on the counter.',
      'Scrapping for Dust happens right at the counter too.',
    ] },
    { v: 98, date: 'November 24, 2026', title: 'The Enchanter’s shop', items: [
      'Visiting the Enchanter now takes your party out of the Deep and into the Enchanter’s shop. Your hero walks in through the door to the counter, and the Enchanter waits behind it among shelves of glowing bottles.',
      'The shop’s buttons hang above the Enchanter, where monsters usually stand: Enchant, Disenchant, Scrap for Dust and Leave shop. The counter below the scene lists your items; pick one to work on it.',
      'Leave shop takes the party straight back to the floor you left.',
    ] },
    { v: 97, date: 'November 24, 2026', title: 'A clearer Sigil shop', items: [
      'Lanternholder is now the one name for premium. Get it with 500 Sigils for 30 days (nothing renews), or as the $4.99 monthly membership. The old Lantern Pass is the same thing under its new name, and any days you had are kept.',
      'The Sigil shop is laid out in three parts: what Sigils are for (Lanternholder, Bag of Holding, Wardrobe, profile looks, the Sigil exchange), Lanternholder with both ways to get it side by side, and the Sigil packs.',
      'Your profile shows your Sigils, Lanternholder, Wardrobe and Bag of Holding as four tidy tiles, with your card looks below.',
    ] },
    { v: 96, date: 'November 24, 2026', title: 'The Enchanter', items: [
      'Enchanting and disenchanting now happen at the Enchanter. Press Enchanter on the battle screen (or Enchant on any item) to visit. Your party stops diving while you are there: nobody fights, nothing new turns up and you keep your floor.',
      'The Enchanter has three tabs: Enchant (pick any item with a socket, worn or not, and move an enchant onto it), Disenchant (break down a spare item to move one of its enchants) and Scrap for Dust.',
      'Press Leave when you are done and the party carries on from the same floor. Reloading the game also ends a visit.',
    ] },
    { v: 95, date: 'November 24, 2026', title: 'XP in the fight log', items: [
      'The fight log now shows the hero XP each kill gave you, with all your bonuses counted, next to the gold: "Defeated Gloop +120 gold, +6.4 XP". Ambushes also show how many foes were in the group.',
    ] },
    { v: 94, date: 'November 24, 2026', title: 'More ambushes', items: [
      'Ambushes (groups of 2 to 4 monsters) now come twice as often: 6% of fights from floor 3, up from 3%.',
      'The ambush tag now shows its XP bonus. Each monster in the group adds 2× hero XP, so an ambush of 3 gives XP ×6 (and 6× gold). Hover the tag (or tap it) for the details.',
    ] },
    { v: 93, date: 'November 24, 2026', title: 'A quieter Lantern Keeper', items: [
      'The Lantern Keeper banner above the fight is now a small glowing lantern in the corner of the battle scene. Hover it (or tap it on a phone) to see who is online and the +25% bonus.',
    ] },
    { v: 92, date: 'November 24, 2026', title: 'See your XP bonuses', items: [
      'The XP bar on your character sheet now shows your total hero XP rate, like XP ×1.18. Hover the bar (or tap it on a phone) to see every bonus that adds to it: class skills, war aura, Scholar’s Ink, Lantern Surge, companion traits, enchants and region mastery, plus the Lantern Keeper when he is online.',
    ] },
    { v: 91, date: 'November 24, 2026', title: 'Merchant, bounties and the Lantern Keeper', items: [
      'New: the wandering merchant. Now and then, while you play, a merchant stops beside the fight for 2 minutes with one deal at half price: tonics, Campfire Draughts, Lantern Oil or Dust. Tap the merchant to see it.',
      'New: the bounty board, in the Quests window. Three bounties at a time, new every 4 hours, built from the floors you have reached: hunt certain monsters on certain floors, beat a guardian a few times, open chests and more. Each pays gold and Dust, sometimes a tonic.',
      'Bounties that send you back up have a Go to floor button. Finished bounties you forget to claim are paid when the board changes.',
      'New: the Lantern Keeper. When the store owner is online, every hero gets +25% damage, healing, gold, hero XP and gear finds. A gold banner over the fight shows when it is on.'
    ] },
    { v: 90, date: 'November 24, 2026', title: 'Shielded foes', items: [
      'New: shielded monsters. From floor 12 some monsters, and many guardians, fight inside a pale blue shield. While it is up your party deals 65% less damage.',
      'Tap the fight to break it: each tap knocks about 10% off (a critical tap 20%), so about 10 taps does it, and your party is back to full strength.',
      'Not watching? The shield wears away on its own in about 14 seconds (16 for a guardian), so idle runs never get stuck. Guardians raise it once more at half health.'
    ] },
    { v: 89, date: 'November 24, 2026', title: 'Mastery hero XP', items: [
      'Region mastery now speeds up hero levels too. Every mastery goal adds +1% hero XP, and a region with all three goals done adds +2% more (+5% per fully mastered region).',
      'It counts the mastery you already have, so many heroes get a boost right away. Your total shows under Region mastery in the Codex.'
    ] },
    { v: 88, date: 'November 24, 2026', title: 'Burns, poison, stuns and disarms', items: [
      'Burning now hurts heroes in cloth (healers, mages, necromancers) twice as much. Tanks in plate take a quarter less.',
      'Poison now bites everyone a quarter harder, except necromancers, who take only a quarter of it.',
      'New: Stun. Ground Slam, Tidal Crash and Belly Flop can stun heroes, who cannot attack, heal or use abilities for 3 seconds. Stars circle a stunned hero\u2019s head.',
      'New: Disarm. Shield Charge and the new Disarming Lash (Thornlings) knock a hero\u2019s weapon away: 35% damage, half healing and no abilities for 8 seconds, until it grabs it back.',
      'Tanks shake off stuns and disarms twice as fast, and Shield Wall makes them immune. Dodging or blocking the hit avoids it.',
      'Ability buttons show when a hero is stunned or disarmed and for how long.'
    ] },
    { v: 87, date: 'November 24, 2026', title: 'Ghost Lantern, and a balance pass', items: [
      'New: the Ghost Lantern. Now and then, while you are playing, a ghost lantern drifts into the fight and slowly saps your party’s damage or healing (10% at most). Tap it to shatter it for gold, Dust or a free tonic. Ignore it and it fades after 30 seconds with nothing lost.',
      'Healers: Lantern Hymn can now be sung with whatever mana is left (it uses up to 30), but still never while out of mana. Healing costs a little less mana. Parties fall far less often than they did in v86.',
      'Resting at camp now fills every mana and stamina bar.',
      'Tank and healer heroes hit harder (3× and 5× their old damage) so every class reaches the deep floors at a similar pace. Companions are unchanged.',
      'Damage numbers and messages that pop up at the same spot now stack instead of landing on top of each other, and stay inside the fight window.',
      'Phones: the bottom tab bar no longer sticks out a couple of pixels and lets the page wiggle sideways.'
    ] },
    { v: 86, date: 'November 24, 2026', title: 'Mana, stamina and new gear stats', items: [
      'Healers, mages and necromancers now have a blue mana bar. Rogues and tanks have a gold stamina bar. Both refill over time.',
      'Abilities and class specials cost mana or stamina. If a hero is short, it waits for the bar to refill.',
      'Healing costs mana. A healer that runs out of mana stops healing and fights with basic attacks until its mana comes back.',
      'New enchants that help only the hero wearing the item: Flow (mana or stamina regen), Leech (life steal), Bulwark (block chance) and Plating (defense).',
      'Rings and trinkets roll Flow and Leech more often. Armor and shields roll Bulwark and Plating more often. Weapons roll Leech.',
      'Hero profiles show mana or stamina, regen, life steal, block and defense. Your existing gear and enchants are unchanged.'
    ] },
    { v: 85, date: 'November 24, 2026', title: 'Fight panel fix', items: [
      'Fixed: after changing floors, the fight panel could keep showing the last guardian (with its lantern timer) while your party was really fighting something else. Between foes it now says the next foe is on the way.'
    ] },
    { v: 84, date: 'November 24, 2026', title: 'Notification tabs', items: [
      'The bell now sorts notifications into tabs: Loot, Fights, Progress, Players and Other. Tap one to read just that log. Each tab shows how many it holds and a dot for new ones.',
      'The bell keeps the last 120 notifications instead of 50.'
    ] },
    { v: 83, date: 'November 24, 2026', title: 'Quieter guardian farming', items: [
      'The "guardian defeated, the way down is open" pop-up now shows only the first time you beat a guardian, not on every kill while you farm it.'
    ] },
    { v: 82, date: 'November 24, 2026', title: 'Farming guardians, and a cleaner top bar', items: [
      'With Descend automatically off, beating a guardian now keeps you on its floor so you can farm it again. Before, a guardian kill always pushed you down a floor.',
      'The top bar fits itself to your screen and zoom: it drops labels and then the title before anything can overlap. The online count no longer sits on the Lanternhold title.',
      'The floor dots in the battle header no longer touch the region name.'
    ] },
    { v: 81, date: 'November 24, 2026', title: 'Where sets drop, and your gold is back', items: [
      'Every set card in the Gear tab, and every set piece you open, now says where it drops, with a Farm floor button that takes your party there and keeps it on that floor.',
      'Region sets drop in their own region, best from its guardian. Class sets drop from any guardian from floor 15.',
      'Fixed: on some laptop-sized screens your gold was hidden under the online count in the top bar.'
    ] },
    { v: 80, date: 'November 24, 2026', title: 'Special attacks', items: [
      'Every guardian now has a special attack it winds up every 10 seconds or so. Each region guardian has its own signature move, like Furnace-Heart\u2019s Magma Wave or the Root Mother\u2019s Grasping Roots.',
      'Some monsters past floor 8 have one too: acid that splashes the heroes beside the target, bats that dive at the back of the line, spores that poison everyone.',
      'A red banner warns you, and a red ring shows who will be hit. Marked spots cannot be drawn away by a tank.',
      'Burns and poison now last ' + L.DOT_FIGHTS + ' fights, with a countdown badge over each hero. A healer\u2019s ability, Purify or a rest at the campfire clears them.',
      'No special can take more than about a third of a hero\u2019s health in one go, so they hurt without one-shotting anyone.'
    ] },
    { v: 79, date: 'November 24, 2026', title: 'A tidier battle header', items: [
      'Floor, Map of the Deep, your chapter goal and the world boss now sit in one framed panel on top of the battle, instead of floating above it.',
      'The header is shorter, so the battle scene gets more room (about 70 px more on a laptop).'
    ] },
    { v: 78, date: 'November 24, 2026', title: 'One tab at a time', items: [
      'If Lanternhold is open in two tabs, the older one now stops and says so. Before, both kept saving over each other, so quest claims, auto-scrap and tonics could come undone after a refresh.',
      'Tap Play here instead on a stopped tab to pick it back up.'] },
    { v: 77, date: 'November 24, 2026', title: 'Tonic stacks stay visible', items: [
      'An active tonic now shows how many more of it you carry next to its timer, so drinking one no longer makes the rest of your stack seem to disappear. Tap it to drink another and add time.',
      'If a tonic is already near its 60-minute cap, tapping it tells you so instead of doing nothing.'] },
    { v: 76, date: 'November 24, 2026', title: 'Room at the fire, and closing whispers', items: [
      'Companions in your party no longer count against the campfire. You can keep your 4 party companions plus 4 more resting at the fire, and the fire still grows at hero levels 10, 20 and 30.',
      'Whisper tabs have a small &times; to close a conversation. It comes back if that player whispers you again.'] },
    { v: 75, date: 'November 24, 2026', title: 'Whispers and the notification bell', items: [
      'Each whisper conversation now has its own tab along the top of the Whispers channel, and the latest one opens on its own.',
      'Their messages sit on the left and yours on the right, like a messenger app.',
      'Tap + to start a new whisper with someone who has been chatting lately. No more hunting for a name to tap.',
      'New: the bell at the top keeps your last 50 pop-ups, so you can reread any that went by too fast. Pop-ups also stay up longer, and wait while your pointer rests on one.'] },
    { v: 74, date: 'November 24, 2026', title: 'Region trials', items: [
      'The hero level gates between regions are gone. Instead each region has a trial: defeat ' + L.TRIAL_ELITES + ' alliance elites there (the bannered warband foes) and beat its guardian, and the way to the next region opens.',
      'Progress shows on screen as you fight, and in Codex, Progress. Hero level still opens new parts of the game, like camp jobs, the Ember Ring and rekindling.',
      'If you were held at a gate, you are through: the trial counts as done for the region you are in. Beat its guardian again and keep going.'] },
    { v: 73, date: 'November 23, 2026', title: 'Power level and hero level', items: [
      'The level shown on each Party card is now called power level. It is what training with gold raises, and what gear needs.',
      'Your hero level (from XP, which opens new parts of the game) is now always called hero level, so the two never get mixed up. A hero can be hero level 11 with a power level of 142.',
      'The Guide and the wiki explain both.'] },
    { v: 72, date: 'November 23, 2026', title: 'A tidier Hold', items: [
      'The hero setup screen is wider on computers, so class and banner names no longer spill out of their cards.',
      'On phones, all four currencies fit the top bar again (Embers and Dust were cut off once gold reached millions). Quests and blessings sit just under them.',
      'The PvP tab has its own crossed-swords icon, so it no longer looks like the Fight button.',
      'Tanks now carry the Covenant chevron on their shields and in their class icon.',
      'A few names were changed: region 6 is now the Drowned Archive, its guardian the Sunken Magister, and the healer Wayfarer branch has Lamplight Song and Quick Breath. Your skills and gear are unchanged.',
      'The Guide covers the newer parts of the game: the PvP tab, the Why we fight opening, the music player, whispers and the unread bubble in chat, and playing without an account.'] },
    { v: 71, date: 'November 23, 2026', title: 'A calmer marching order', items: [
      'The Party tab is easier to read. Each companion shows only the traits that are working right now, with their effect. The others share one quiet line, and you can hover or tap it to see what they would do.',
      'Send to campfire is now a small flame button next to Auto, and on phones the Train, Auto and campfire buttons sit in one row under each companion.'] },
    { v: 70, date: 'November 23, 2026', title: 'Raise your colors', items: [
      'The Wardrobe has a new Banners tab with 11 war banners, from the free Delver’s Pennant to the gold-fringed Last Lantern.',
      'Your banner flies behind your party and shows on your hero card in the Ember Ring, on challenger cards, in the standings, on your Players Guild card and next to your name in chat.',
      'Banners are looks only. They never change your party’s power.'] },
    { v: 69, date: 'November 23, 2026', title: 'Know what you are hunting', items: [
      'Every region on the Map of the Deep now shows its possible loot: the region set, class and job set pieces, each gear rarity, relics, Sigils and the Loot Goblin’s Sack.',
      'Each drop shows your own odds per kill from bosses, chests, elites, ambushes and ordinary foes, worked out from the same rules the game uses, after your Keen Eye, Luck, Forager, Finder enchants, companion traits and Seeker’s Charm.',
      'The header shows your total drop bonus. Tap the (i) for the breakdown. Lantern Surge and region mastery raise gold and XP, not drop chances, so they do not change these numbers.'] },
    { v: 68, date: 'November 23, 2026', title: 'Guild invites fixed', items: [
      'Fixed: the Invite buttons in the Guild tab did nothing. Pressing Invite now sends the invite right away, shows Invited with a Cancel button, and pops up a notice. The same fix covers accepting or declining party invitations and opening a hero’s profile from the Guild tab.'] },
    { v: 67, date: 'November 23, 2026', title: 'The Nexus Guardian', items: [
      'The Nexus has started listening to the Deep. A rhythm that never tires, strikes that land too fast for too long or with perfectly even spacing, sounds to it like a siege engine at the wall.',
      'When it hears one, the back wall starts to crack and glow. Keep it up and the Nexus Guardian breaks through and takes the stage. Nothing lands on it, not your strikes and not your party.',
      'Ease your strikes for a few seconds and it loses interest, withdraws, and the fight picks up right where it was. Normal tapping, even fast tapping, never calls it.',
      'World boss assaults listen too: strikes with that rhythm do not count toward your score.'] },
    { v: 66, date: 'November 23, 2026', title: 'Fresh starts on request', items: [
      'Admins can now reset a single account back to a brand-new game, for testing or when a player asks for a clean slate. You get a notice when it happens, and purchased Sigils are kept unless you ask for them to go too.',
      'A server-wide reset now also keeps Sigil exchange listings and store links in place.'] },
    { v: 65, date: 'November 23, 2026', title: 'Why we fight', items: [
      'A new opening for Lanternhold: the Shattered Reach, the Nyx Rift, the five who answer the call, and why we fight.',
      'It plays once on your first visit. Tap to move through it or skip it any time, and watch it again from Settings.'] },
    { v: 64, date: 'November 23, 2026', title: 'A slower, deeper descent', items: [
      'Lanternhold is now paced to be savored, not rushed. New parts of the game open as your hero levels up: Gear at 3, the Campfire at 5, map travel and market buying at 8, camp jobs at 10, the Players Guild at 12, the Ember Ring at 15, selling and the Sigil exchange at 18, rekindling at 20, and the world boss and job sets at 25.',
      'Each new region needs a hero level to enter. Until then your party keeps working the region it is in. Hero XP needs more per level, and deeper floors and guardians give the most.',
      'Region mastery: every region has three goals (beat its guardian, defeat 20 alliance elites, find a piece of its set). Each one finished is +1% damage, health or gold for good. See Codex, Progress.',
      'Your campfire now holds 4 companions, plus one at hero levels 10, 20 and 30. When a new companion arrives and it is full, dismiss someone for good or turn them away. Up to 3 more spots for 300 Sigils each.',
      'Camp jobs start with one slot and gain one at levels 15, 20, 25, 30 and 35.',
      'Rekindling now needs hero level 20 and floor 75, and Embers count from floor 60, so a deep descent pays far more than a quick one.',
      'Nothing you already have is taken away: your hero keeps their level, every floor you reached stays open, companions over the new limit stay, and features you already use stay unlocked.'] },
    { v: 63, date: 'November 23, 2026', title: 'Whispers and unread messages', items: [
      'New: whispers. Tap a player’s name in any chat channel and choose Whisper to message them privately. Your conversations live in the new Whispers tab, and tapping a name there whispers back.',
      'The chat button now shows a red bubble with how many new messages are waiting in Global and Whispers, and a new whisper pops up a notice even while chat is closed.'] },
    { v: 62, date: 'November 23, 2026', title: 'Music for the Deep', items: [
      'Lanternhold now has its own soundtrack: eight original pieces, from the Hearthfire Waltz at camp to the Ember Ring battle theme and a quiet piano nocturne for late watches.',
      'Tap the note button at the top to open the player. Skip forward or back, pick any track, shuffle, set the volume or mute. Your choices are remembered on this device.',
      'Music starts on your first tap and streams one track at a time, so it stays light on phones. You can turn it off in Settings too.'] },
    { v: 61, date: 'November 23, 2026', title: 'Auto-scrap fixed', items: [
      'Fixed: auto-scrap kept most drops. It treated anything a benched companion, or a hero not yet high enough level, might someday wear as an upgrade. Now only a piece someone in your party can wear right now, and that beats their gear, is kept.',
      'New: the Auto-scrap window shows how many pieces already in your pack match your settings, with a button to scrap them all at once. Locked and worn gear, sets and each party member’s best spare piece are kept.'] },
    { v: 60, date: 'November 23, 2026', title: 'Fair fights in the Ember Ring', items: [
      'Duelling the same hero again within a day now pays less each time: full rewards, then half, then a quarter, then nothing. This covers rating and Laurels for both heroes.',
      'Challenger cards show when a rematch pays less, and when it will pay in full again.'] },
    { v: 59, date: 'November 23, 2026', title: 'Lock gear in its slot', items: [
      'New: lock a piece someone is wearing to keep it in that slot. Tap the slot on the Gear tab and choose Lock, or lock it from its item card.',
      'Equip best now skips locked slots and tells you how many it skipped. Locked slots show a padlock, and a locked piece is still safe from scrap and the Loot Goblin.'] },
    { v: 58, date: 'November 23, 2026', title: 'The Ember Ring: abilities, counters and Ring skills', items: [
      'Heroes now fight with their class abilities in duels: Shield Bash stuns, Mend heals, Backstab and Fireball burst, Life Drain steals health, and more.',
      'Every class has the edge on two classes and is countered by two others. Challenger cards show who has the edge, and what each foe brings.',
      'New Skills view in the PvP tab: learn and rank up 6 Ring skills per class with Laurels, then pick 2 abilities (in the order you want them used) and 2 passives.',
      'Your loadout also defends while you are away, so build it with care. Every class starts with its first ability for free.',
      'Fixed: world boss assaults said the server could not record them. Every assault now counts toward the shared health bar.'] },
    { v: 57, date: 'November 23, 2026', title: 'The Wardrobe', items: [
      'New: the Wardrobe. Dress any hero in your company in one of nine outfits, from Emberforged and Hoarfrost to the Riftborn and Lanternsworn regalia with their own auras. Buy an outfit once and every hero can wear it.',
      'New lantern styles: Moonlit, Marsh Wisp, Rosefire, Riftglass, Sunforged, Soulflame and Starless. Your lantern hangs beside your lead hero and colours the light around your party.',
      'Other players see your hero’s outfit in the Players Guild, as a recruited guest and in the Ember Ring. Your name color and title now show in chat too.',
      'Looks only, bought with Sigils. Nothing in the Wardrobe changes your party’s power. Open it from the Gear tab, your portrait, or the Quartermaster.'] },
    { v: 55, date: 'November 23, 2026', title: 'Region sets and the Goblin’s Sack', items: [
      'New: region sets. All fifteen regions of the Deep now drop their own four-piece armor set for any class. Two pieces boost one stat, and four pieces add a big damage and health bonus that multiplies all of your gear, so a finished set stays strong through rekindles.',
      'Region pieces only drop in their own region and they are rare, with guardians your best chance. Collecting a full set is a real hunt.',
      'New: kill a Loot Goblin and there is a tiny chance he drops the Loot Goblin’s Sack, a +15% party gold trinket. Global chat hears about it when one drops.'] },
    { v: 54, date: 'November 23, 2026', title: 'The Lanternhold Wiki', items: [
      'New: the Lanternhold Wiki at lanternhold.born2gamellc.com/wiki. Every class and skill tree, companion, region, monster, set, enchant and relic, with search.',
      'It is built from the game itself, so it updates whenever the game does. Open it from Full wiki in the Guide (the ? at the top).'] },
    { v: 53, date: 'November 23, 2026', title: 'Easier sign-up', items: [
      'Fixed: confirming a new account could reject a correct-looking code after asking for several. The game no longer sends extra codes on its own, tells you when the newest one was sent, and ignores spaces in the code.',
      'Every sign-in screen now has Play without an account. Accounts are optional and only keep your save safe across devices.',
      'Returning players can tap Sign in on the very first screen to load their hero, with no need to make a new one first.'] },
    { v: 52, date: 'November 23, 2026', title: 'Auto-scrap and a cleaner pack', items: [
      'New: Auto-scrap. Tick the rarities you never want, and new drops of those turn straight into gold and Dust without taking pack space. Set pieces and upgrades for your party are always kept.',
      'The pack view has a tidy header: a space meter that turns red when the pack is full, and one Bulk actions menu for mass sell, merge and scrap.'] },
    { v: 51, date: 'November 23, 2026', title: 'Tidier tabs and a fight log', items: [
      'Gear now has two views, Equipped and Pack, so you are not scrolling past one to reach the other.',
      'Skills is split into Stats, Skill tree and Rekindle.',
      'Camp companions take up far less room. Traits show as names; hover one for details.',
      'New Fight log at the bottom of the Party tab: kills, critical strikes, abilities, falls, ambushes and loot, with filters.'] },
    { v: 50, date: 'November 23, 2026', title: 'Lantern Surge', items: [
      'New: Lantern Surge. Whenever any player buys a Sigil pack, every hero in the game gets +25% gold and +25% XP.',
      'Each pack adds time for everyone: 30 minutes for 500 Sigils, up to six and a half hours for 6,500, stacking up to a day ahead.',
      'A lightning chip in the top bar shows how long the surge has left. Tap it for details.'] },
    { v: 49, date: 'November 23, 2026', title: 'The Ember Ring: a longer climb', items: [
      'Ringwarden gear is now something to earn over time. A win pays 8 Laurels (up to 12 against a stronger hero), and a loss still pays 3.',
      'The first win each day adds 10 more, and your hero earns 2 for every challenger it beats while you are away.',
      'Kit ranks cost more: 60 Laurels for the first rank of a piece, rising by 30 with each rank. Laurels you already have are kept.'] },
    { v: 48, date: 'November 23, 2026', title: 'Dust and Mass merge', items: [
      'Scrapping gear now gives Dust as well as gold. Your Dust shows in the top bar.',
      'Enchanting and disenchanting cost Dust, more for higher tiers.',
      'New Mass merge button in the Gear tab. Pick how high to go, see the expected losses, then merge every spare pair at once. Worn and locked items are never touched.',
      'Fixed: after rekindling at the main camp there was no button to start fighting again.'] },
    { v: 47, date: 'November 23, 2026', title: 'Enchantments and Disenchant', items: [
      'Gear now has enchant sockets, more for rarer items and items from deeper floors. Every item you already own has had its enchants rolled.',
      'Enchants like Might, Vigor, Keen and Fortune help the whole party while anyone in it wears the item.',
      'Disenchant an item you can\u2019t use to move one of its enchants onto one you can. The disenchanted item is destroyed.',
      'New Discord button at the top: chat with players, report bugs and share ideas on the Grand War Discord.'] },
    { v: 46, date: 'November 23, 2026', title: 'Merge your gear', items: [
      'Have two of the same item? Open one and choose Merge. They become a single piece one upgrade higher, keeping the better job bonus.',
      'Every merge carries a risk: if it fails, both pieces are destroyed for good. The higher the result, the bigger the risk.',
      'Luck and Intelligence lower the risk, up to half. The exact odds show before you confirm, and locked items can never be merged.'] },
    { v: 45, date: 'November 23, 2026', title: 'A cleaner screen', items: [
      'The top bar is tidier. Gold, damage, Embers and Sigils now sit together in one strip.',
      'Hover over almost anything to see what it does. On a phone, tap the small i badges.',
      'The camp bar, marching order, campfire and banner sections are shorter, with the details in tooltips.'] },
    { v: 44, date: 'November 23, 2026', title: 'The Ember Ring: duels between players', items: [
      'Open the new PvP tab to duel other players\u2019 heroes one on one. Only your own hero fights: no companions, tonics or Sigils.',
      'Wins earn Laurels and rating. Climb from Ashen through Ironclad, Emberborn, Gilded and Lanternsworn to Riftbreaker on the Ring standings.',
      'Spend Laurels on the Ringwarden kit, a separate set of PvP gear with 15 ranks per piece. Its Edge and Resolve count only in the Ring.',
      'You get 10 challenges, and one returns every 30 minutes. Your hero also defends while you are away and earns Laurels for every challenger it beats.'] },
    { v: 43, date: 'November 23, 2026', title: 'Main camp and field camps', items: [
      'Return to camp now takes you to the main camp with no gold cost. Swap companions, recruit, train and change gear there.',
      'When you head back down you start at the top of the region you left. Floor 99 takes you back to floor 91.',
      'A Campfire Draught makes a field camp right where you are. Change your party\'s gear for 60 seconds and keep your floor. Companion swaps need the main camp.'] },
    { v: 42, date: 'November 23, 2026', title: 'Mass sell', items: [
      'New Mass sell button next to Mass scrap in your Gear tab. Pick rarities and list many pieces on the market at once, each at its current value.',
      'Worn and locked items are never listed. You can keep the best piece of each kind and anything you have upgraded.',
      'You can now have up to 25 items on the market at a time, up from 10.'] },
    { v: 41, date: 'November 23, 2026', title: 'Lock your favorite gear', items: [
      'Tap any item in your pack and choose Lock. A small padlock shows on its tile.',
      'Locked items are never touched by Mass scrap, auto-selling when your pack is full, or the Loot Goblin.',
      'You can still equip and upgrade them. Unlock an item when you want to sell, send or salvage it.'] },
    { v: 40, date: 'November 23, 2026', title: 'World boss weekends', items: [
      'A giant of void crystal, the Rift Colossus, has broken through beneath the Hold. Every signed-in player fights the same boss and fills one shared health bar.',
      'Tap the purple bar on the stage to join a two-minute assault. You can go again every 15 minutes. Strike and use your abilities for more damage.',
      'Damage counts at the strength of your deepest floor, so everyone helps. Each phase broken makes the next one tougher.',
      'When the event ends, claim Sigils: 3 for taking part, 1 per phase broken (up to 5) and 5 more for the top three, plus a purse of gold.',
      'From now on a new world boss attacks every weekend, Friday to Sunday (UTC). This first one runs until Friday as a preview.',
      'Updates now install by themselves. The game waits until the new version is fully out, saves, and reloads, so the Update button should no longer get stuck.'] },
    { v: 39, date: 'November 23, 2026', title: 'Players online', items: [
      'A green counter next to the Lanternhold name shows how many players are online right now. Tap it to see heroes in the Guild.'] },
    { v: 38, date: 'November 23, 2026', title: 'Clearer store and the Lanternholder membership', items: [
      'Sigil packs are plain one-time purchases. You pay once, nothing renews, and the checkout no longer shows a duration.',
      'New: Lanternholder, a $4.99 monthly membership. While it is active you get Auto-train, 10 extra bag slots and 4 more hours of offline earnings, with no Sigils to spend.',
      'The Get Sigils screen now shows one-time packs and the monthly membership separately, and says plainly that the membership renews until you cancel.',
      'Cancel any time under My Subscriptions in your Born 2 Game account. Perks stay on until the end of the month you paid for.'] },
    { v: 37, date: 'November 23, 2026', title: 'The Loot Goblin and a cleaner screen', items: [
      'Watch out for the Loot Goblin. From floor 8 a sneaky thief can jump your party. Kill it within 20 seconds or it runs off with an item from your pack. Gear you are wearing is never taken.',
      'If it gets away, a green note under your chapter goal shows the floor where it is hiding. Reach that floor and kill it to get your item back. Every goblin you kill drops six times the gold.',
      'On a computer the whole game now fits on one screen. Only the side panel scrolls.',
      'Ability buttons are bigger and easier to read: full names, a clear Ready glow and a cooldown bar.',
      'The Players Guild has its own Guild tab.',
      'Chat is now a floating window. Press Chat at the bottom right to open it, and the dash to tuck it away.',
      'Your Sigil balance shows as soon as the game opens.'] },
    { v: 36, date: 'November 23, 2026', title: 'Companion traits and a new Guide', items: [
      'Every story companion now has three traits, rolled when they join: a position trait for one party seat, a kinship trait that works beside a certain class, and a camp trait for resting at the fire.',
      'Working traits glow gold on the Party and Camp tabs. Rearrange your party to switch on as many as you can.',
      'Camp traits can boost a companion’s camp job, cut training costs, add gold or heal the party faster at camp.',
      'The Guide is rebuilt: topics sorted into categories, short points, and pictures.'] },
    { v: 35, date: 'November 23, 2026', title: 'Easier big numbers', items: [
      'Big numbers now read 2.40M, 13.1B and 250T (million, billion, trillion) instead of scientific notation.'] },
    { v: 34, date: 'November 23, 2026', title: 'Tonics at the Quartermaster', items: [
      'Seven new tonics: Draught of Fury (+15% damage), Ironbark Tonic (+15% health), Mender’s Brew (+20% healing), Keen-Eye Elixir (+5% crit), Prospector’s Luck (+15% gold), Seeker’s Charm (+15% gear drops) and Scholar’s Ink (+25% hero XP).',
      'Each lasts 10 or 15 minutes. Different tonics stack, and drinking the same one again adds time, up to an hour.',
      'Everything costs gold. The speed-ups (Prospector’s Luck, Seeker’s Charm, Scholar’s Ink and the Campfire Draught) can also be bought with Sigils. Open the Store on the camp bar.',
      'Tonics you carry show above your abilities. Tap one to drink it.'] },
    { v: 33, date: 'November 23, 2026', title: 'A new home', items: [
      'Lanternhold now lives at lanternhold.born2gamellc.com. The old address brings you here, along with the progress saved on your device.',
      'If you play with an account, sign in once more here. Your saved progress is waiting.'] },
    { v: 32, date: 'November 23, 2026', title: 'Bag of Holding', items: [
      'New in the store: the Bag of Holding. Buy it once for 6,500 Sigils and your pack never fills up again, so loot is never sold off for lack of space.',
      'Find it on the Gear tab next to your pack, under Market and Sigils, or in your profile.'] },
    { v: 31, date: 'November 23, 2026', title: 'Party invites', items: [
      'Recruiting a player now sends them an invite. Their hero joins your party only after they accept.',
      'Invites you receive show at the top of the Players Guild on the Party tab, with Accept and Decline. You also get a notice when one arrives.',
      'An accepted hero joins at camp. If your party is full, you choose who steps out.'] },
    { v: 30, date: 'November 23, 2026', title: 'A new look', items: [
      'Every hero, companion and monster has been redrawn as detailed illustrated art, with armor, cloth, lighting and glowing eyes.',
      'The dungeon, the doorway and the camp under the stars are redrawn too, with torchlight, flagstones and a crackling campfire.',
      'The arena now draws at your screen’s full sharpness.'] },
    { v: 29, date: 'November 23, 2026', title: 'Your character, and ambushes', items: [
      'Your hero now earns XP and levels up. Each level brings a stat point to spend on Strength, Dexterity, Constitution, Intelligence, Wisdom, Charisma or Luck. Find the character sheet at the top of the Skills tab.',
      'Each class favours two stats, and points there count half again. Luck touches everything: loot, chests, crits, gold, Sigil finds and ambush spoils.',
      'Ambushes: now and then two to four monsters team up and jump your party. They are tougher and strike the back of the line, but pay several times the gold and often drop gear.',
      'Resetting your stats costs 50 Sigils, so place points with care.',
      'Veteran heroes start with XP for their past fights, so you may have points waiting already.'] },
    { v: 28, date: 'November 23, 2026', title: 'Fly your banner', items: [
      'New Banner chat: talk only with heroes who fly the same banner as you. Find it next to Global in the chat.',
      'Banner kin: every party member who marches under your banner makes your banner perk 40% stronger. A full party of kin more than doubles it. Players you recruited before today need to be recruited again to count.'] },
    { v: 27, date: 'November 23, 2026', title: 'Daily quests and Sigils in the deep', items: [
      'New: daily quests. Three quests a day, the same for every hero. Each one pays 1 Sigil, and finishing all three pays 2 more. Tap the quest counter at the top of the screen.',
      'Treasure chests and guardians can now hold 1 to 3 Sigils. It is rare: about 0.05% per chest and 0.1% per guardian to start.',
      'Your odds grow as you go deeper (+0.01% for every 30 floors, up to +0.05%) and with the new Kindling upgrade Sigil Sense (+0.01% per rank, 5 ranks).',
      'Found Sigils go straight to your wallet when you are signed in. Up to 15 found Sigils can be banked each day.'] },
    { v: 26, date: 'November 23, 2026', title: 'The Lantern Pass and Born 2 Game sign-in', items: [
      'You can now sign in with your Born 2 Game store account. Press Continue with Born 2 Game on the sign-in screen. If you already linked your store account to a hero, it opens that hero.',
      'New: the Lantern Pass. For 500 Sigils you get 30 days of convenience: the Auto-train buttons, 10 extra bag slots and 4 more hours of offline earnings. It never adds power.',
      'Every hero gets a free 3-day trial, starting now. Open it from your profile or tap a locked Auto button.',
      'Sigils can be bought in the Born 2 Game store or bought from other players for gold on the Sigil exchange, so the pass is open to everyone.'] },
    { v: 25, date: 'November 23, 2026', title: 'Sigil packs and Mercy’s Blessing', items: [
      'New: Mercy’s Blessing. Whenever someone gives to the Grand War’s Mercy Corps, every hero gets +10% gold, +10% party health and +20% healing. Each $10, 5 food items or toy adds 2 hours, up to 7 days. Watch for the green heart at the top of the screen.',
      'Sigil packs are here: 500 for $4.99, 1,100 for $9.99, 2,400 for $19.99 and 6,500 for $49.99. Press Get Sigils on your profile or in the Sigil exchange.',
      'Sign in once with your Born 2 Game store account. Packs you buy in the store land in your hero’s wallet automatically, usually within a minute.',
      'Sigils still only buy looks, or gold from other players on the exchange. They never buy power.'] },
    { v: 24, date: 'November 23, 2026', title: 'Automatic updates', items: [
      'When a new version comes out, the game now saves your progress and reloads itself after a short countdown, so everyone always plays the latest version with the latest fixes.'] },
    { v: 23, date: 'November 23, 2026', title: 'Smaller numbers and the Sigil exchange', items: [
      'Gold, damage, health and prices have been rescaled. Numbers now stay small and plain, written out in full with commas instead of letters like K or M. The pace of the climb is about the same.',
      'Your gold was converted so it still buys the same amount of training. Your levels, floors, gear and Embers are unchanged.',
      'Embers now give +4% damage and gold each, and relics and gear percentages are smaller to match the new scale. Your party is just as strong for its depth as before.',
      'New in the Trading Post: the Sigil exchange. Sell Sigils to other players for gold, or buy theirs. Listings are sorted by the best price per Sigil.',
      'Global chat now welcomes every new hero, with the alliance they fight for.',
      'Gear listed on the market before this update is hidden from shoppers. If you had something listed, take it down from My listings and list it again at a new price.'] },
    { v: 22, date: 'November 23, 2026', title: 'Grand War auras', items: [
      'Verified Grand War commanders now carry an aura for their hero’s class. Tanks get the Bulwark Aura (party health, less damage taken), healers the Mending Aura (healing), rogues the Shadow Aura (gold, critical hits), mages the Ember Aura (party damage, critical hits) and necromancers the Grave Aura (party damage, gear drops).',
      'The aura grows with your rank on the Grand War ladder, from 2% at Recruit to 10% at the top rank. Past seasons as Grand Marshal or champion make it a quarter stronger each.',
      'War honors add their own bonus: Grand Marshal gives the Marshal’s Banner (+5% party damage), Alliance Champion the Champion’s Mantle (+5% party health) and Nexus Holder the Nexus Tithe (+10% gold).',
      'Your aura shows on your hero’s portrait. Auras are earned in the war and can never be bought.',
      'Your Sigils now show in the top bar when you are signed in. Tap them to open your profile.'] },
    { v: 21, date: 'November 22, 2026', title: 'Profiles, Sigils and Grand War badges', items: [
      'Your hero now has a profile card that other players see in the Players Guild: a frame, a title, a name color, a banner, up to six emblems and a short bio. Open it from your hero’s portrait and press Customize profile.',
      'Sigils buy looks for your card. Every account starts with 100. Looks never change your party’s power, and they stay with your account even through a server reset.',
      'Grand War commanders can link their commander name. Once the team confirms it, your war rank, alliance and honors show on your card and next to your name in the guild.',
      'Returning to camp now costs gold once you are past floor 10. The deeper you are, the more the climb costs, so a Campfire Draught is often the cheaper choice for a quick change.'] },
    { v: 20, date: 'November 22, 2026', title: 'One look, one war', items: [
      'The whole game now wears the Grand War colors: deep night-blue panels, war-gold highlights and the same lettering as the Grand War site, so the war pages and the rest of the game finally match.',
      'Tidier header on phones: everything fits on one line.'] },
    { v: 19, date: 'November 22, 2026', title: 'The world map', items: [
      'The map now fits on one screen. All fifteen regions sit along the road from the Hold to the Nyx Rift, each with its own painted window, ten floor pips and a check once its guardian falls.',
      'Tap a region to zoom in: its ten floors, story chapters and other delvers up close, with the region’s dossier beside it. Use the arrows to walk region to region, and World map to step back out.',
      'Your hero is marked on the map, and the badge on a region shows how many other delvers have reached it.'] },
    { v: 18, date: 'November 22, 2026', title: 'A map worth reading', items: [
      'The Map of the Deep is redrawn. Every region has its own painted scenery: lamp-lit cellars, glowing fungus, a lava river in the Cinder Forges, the drowned archive window, the Bastion walls, lightning on the Stormglass Spire and the Rift itself.',
      'Tap any region for its dossier: its history, which alliance’s warbands hold it, its native monster and trick, its guardian, the story chapters that happen there, and quick travel buttons.',
      'A strip of all fifteen regions across the top. Unexplored regions stay under the fog until you reach them.',
      'Other delvers from the leaderboard now appear on the map at their deepest floor.',
      'An expedition record shows regions charted, guardians felled and chapters seen, and the Act One seal waits at the bottom.'] },
    { v: 17, date: 'November 22, 2026', title: 'Auto-train and the night watch', items: [
      'New Auto toggle under each Train button. Switch it on and that character trains whenever you have the gold, cheapest level first. Companions at the campfire auto-train while you are at camp.',
      'While you are away your party earns a quarter of its usual gold, for up to 8 hours.',
      'Night Watch, a new Kindling upgrade, keeps your party earning 16 hours longer per rank, up to 3 days. After that, progress waits until you return.'] },
    { v: 16, date: 'November 22, 2026', title: 'The Grand War comes to the Deep', items: [
      'A Grand War strip across the top shows the current season, the week, and how long until the Rift surges. Tap it to open the war room.',
      'A new War page in the Codex: the three alliances with their banners, how the war began, the Nexus, the Mercy Corps, and how Lanternhold’s acts follow the war’s seasons.',
      'Alliance banner art when you pledge your hero.',
      'Lanternhold is a Grand War game by Born 2 Game, LLC.'] },
    { v: 15, date: 'November 22, 2026', title: 'Kindling upgrades and class changes', items: [
      'Four new ways to spend Kindling in the Skills tab: Lantern Edge (party damage), Ember Purse (gold), Deep Reservoir (lantern time) and Slow-burning Draught (longer Campfire Draughts). They are permanent.',
      'Change your hero’s class at camp for 15 Kindling. Every Kindling you spent on the skill tree comes back first. Pack space, gear slots and upgrades stay as they are.',
      'Gear your party wears no longer sits in the pack. It shows on each character, and the pack only counts what is free.'] },
    { v: 14, date: 'November 22, 2026', title: 'Specializations and a leaderboard', items: [
      'At camp the Gear tab shows your party first. Companions resting at the campfire are folded away underneath.',
      'Train anyone in your party anywhere, even deep in the dungeon. Companions resting at the campfire still train at camp.',
      'Specializations: each branch of your hero’s skill tree now ends in a new ability, 3 per class, for 15 in all. Learned abilities join the ability bar on keys 6 to 8.',
      'A Leaderboard in the Codex shows the deepest delvers across the Reach.',
      'Admins can now reset the server for a fresh season and remove players who break the rules.'] },
    { v: 13, date: 'November 22, 2026', title: 'Act One: below the Starless Vault', items: [
      'Seven new regions below the Starless Vault: the Glass Wastes, the Ironbound Bastion, the Weeping Aqueduct, the Bone Orchard, the Stormglass Spire, the Nexus Scar and the Rift Threshold.',
      'The story goes on through chapter 15, with seven new guardians and the truth about the Lampmother waiting on floor 150.',
      'Monsters now have tricks: Enraged, Warded, Regenerating, Venomous, Cleaving and Swift. Each region has its own favourite, and guardians get more of them the deeper you go.',
      'Act One ends on floor 150. Act Two opens with Season 2 of the Grand War, and the game counts down to it once you get there.',
      'Seven new monsters for the Bestiary, plus new journal pages for every region and guardian.',
      'Tap any gear slot on the Gear tab to see every piece that fits it, compared with what is worn now, and equip one straight from the list.'] },
    { v: 12, date: 'November 22, 2026', title: 'Skill trees, Kindling and a full set of gear slots', items: [
      'Every class now has a skill tree for your hero, with three branches of three skills each.',
      'Rekindling gives Kindling: 2 at floor 50, plus 1 for every 10 floors deeper. If you rekindled before today, you already have 2 for each time.',
      'Spend Kindling on skills, a bigger pack, extra rings (up to 5) and a second trinket slot for any character.',
      'Gear now has real slots: main hand, offhand, helmet, trinket, chest, legs, feet and rings. Robes cover the chest and legs together. Your old weapons, armor and trinkets moved into their new slots.',
      'At camp the party sits around a campfire. Nobody fights while you rest, and everyone heals up.',
      'The side panel is split into Party, Camp, Gear, Skills, Market and Codex, so there is far less scrolling.',
      'Rare gear can carry a camp-job bonus, marked with an orange dot. It boosts that job while the wearer works it at the campfire.',
      'Six new job sets, one for each camp job, drop very rarely from guardians and chests from floor 20. Two pieces give +40% to that job, three give +100%.',
      'A new Market tab: browse gear as a grid of cards, filter by slot and rarity, sort by price or power, and tap a card to compare it with what you wear before you buy. Mailbox and Players Guild sit right beside it.'] },
    { v: 11, date: 'November 22, 2026', title: 'Camp jobs and rarer loot', items: [
      'Companions at the campfire can take camp jobs: Forager, Runesmith, Herbalist, Armorer, Prospector and Lamplighter.',
      'Each job helps the whole party all the time. It grows with the companion’s level and is stronger when it suits their class, so it pays to train your whole roster.',
      'Train resting companions right at the campfire.',
      'Gear is rarer now, and high-tier gear starts very rare and gets more common the deeper you go. Thanks for the feedback, Chipplin.',
      'Guardians no longer always drop gear, and set pieces are rarer.',
      'Items have a level requirement, shown in the corner of each piece. Companions must reach it to wear the item.',
      'Monsters get tougher faster the deeper you go. The first floors are gentler than before.',
      'Rekindling now unlocks at floor 50 and gives fewer Embers, so each one is a bigger milestone.',
      'A new item window with a clear stat block, comparison, and upgrade preview.',
      'When a companion heads back to camp mid-run you see them walk off, their seat says they returned to camp, and their bonus leaves with them.',
      'In the dungeon the Gear tab only shows the party you brought. Your campfire roster appears again once you are back at camp.'] },
    { v: 10, date: 'November 22, 2026', title: 'Make camp', items: [
      'Party changes now happen at camp, at the top of the stair: swapping companions, recruiting, training companions and changing gear.',
      'Return to camp from the camp bar in the Party or Gear tab, then Descend straight back to where you were.',
      'New Campfire Draught: make camp anywhere for 60 seconds. You start with one.',
      'New Lantern Oil: 15 more seconds against a guardian.',
      'The Quartermaster’s store by the campfire sells both.',
      'Your own hero can still train anywhere, and you can rearrange the marching order at any time.'] },
    { v: 9, date: 'November 22, 2026', title: 'The Trading Post', items: [
      'A market: list gear for gold, browse what other players are selling, and buy it.',
      'Player mail: send gear to players you have recruited or chatted with, as a gift or with a price they can accept or decline.',
      'Sales and payments arrive in your mailbox. A badge on the bag button shows new mail.'] },
    { v: 8, date: 'November 22, 2026', title: 'A cleaner look', items: [
      'New gear screen: see each companion holding their gear, with weapon, armor and trinket slots and your pack laid out as an inventory grid.',
      'Hand-drawn pixel icons for every weapon, armor and trinket, framed in their rarity colour.',
      'Party portraits now show each companion’s pixel art.',
      'Easier to swap companions: every seat has a To campfire button, and recruiting with a full party asks who steps out.',
      'Tabs have icons, and on phones they sit in a bar along the bottom of the screen.',
      'Formation tips fold away until you want them.'] },
    { v: 7, date: 'November 22, 2026', title: 'Campfire and Players Guild', items: [
      'Every game is now multiplayer. Your progress is untouched.',
      'The Campfire: story companions rest here. Bring them along whenever you like, and see who joins next.',
      'The Players Guild: recruit heroes made by other players. Heroes whose owners are playing right now are marked Online now.',
      'A Players Guild button at the top of the Party tab takes you straight there.',
      'Raised skeletons now visibly lunge and claw at monsters.'] },
    { v: 6, date: 'November 22, 2026', title: 'Help for new delvers', items: [
      'A step-by-step tutorial for new players that points at the real buttons.',
      'The Delver’s Guide: open the ? at the top for a handbook on every system.',
      'Mass scrap in the Gear tab: salvage many pieces at once by rarity, keeping your best and upgraded gear.',
      'These patch notes. They open once after each update, and you can find them in the Guide.'] },
    { v: 5, date: 'November 22, 2026', title: 'Chat, map and item links', items: [
      'Chat with Global, Trade and Party channels (free account needed). Tap a name to mute or report.',
      'Ctrl+click an item, or use Link in chat, to show it off in chat.',
      'The Map of the Deep: see every region, the guardians you have beaten, and travel back to any floor.',
      'An Update ready button appears at the top when a new version is out.'] },
    { v: 4, date: 'November 22, 2026', title: 'Marching order', items: [
      'Rearrange your party. The front takes the hits, so keep your tank there.',
      'Healers heal less the farther they stand from who they heal.',
      'Some monsters ambush from behind and strike the rear first. A tank at the back guards it.'] },
    { v: 3, date: 'November 22, 2026', title: 'Gear made clear', items: [
      'The Gear tab shows what fits each companion, with Equip buttons, upgrade tags and Equip best.',
      'Tap any companion for their profile: bio, alliance, class, ability, stats and gear.',
      'Multiplayer: the hero board is live. Recruit other players’ heroes and earn gold when yours is recruited.'] },
    { v: 2, date: 'November 22, 2026', title: 'A front of the Grand War', items: [
      'Create your own hero and lead a party of five: Tank, Healer, Rogue, Mage and Necromancer.',
      'Monsters fight back. Healers and tanks matter.',
      'A 15-chapter story set beneath the Hold, on a hidden front of the Grand War. Pledge your banner when you start.',
      'Class gear with rarities, upgrades and five class sets. A lore journal that fills as you explore.',
      'Solo and Multiplayer modes. Optional accounts with cloud saves.'] }
]
