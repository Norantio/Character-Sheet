/* ============================================================
   Pathfinder 2nd Edition (Core / Remaster-compatible)
   ============================================================ */

const PROF = { untrained: 0, trained: 2, expert: 4, master: 6, legendary: 8 };
const PROF_LABEL = { untrained: 'U', trained: 'T', expert: 'E', master: 'M', legendary: 'L' };

const SYS_PF2 = {
  id: 'pf2',
  name: 'Pathfinder 2nd Edition',
  tag: 'Core / Remaster',
  blurb: 'Three actions per turn. Ability boosts instead of point buy, four degrees of proficiency, level added to nearly everything.',
  maxLevel: 20,
  abilities: ABIL6,
  lineageLabel: 'Ancestry',
  classLabel: 'Class',
  backgroundLabel: 'Background',
  subclassLabel: 'Heritage / Subclass',
  usesBoosts: true,

  abilityGen: {
    boosts: true,
    arrays: [{ id: 'std', name: 'Typical result (after boosts)', scores: [18, 14, 14, 12, 10, 10] }],
    rolls: [{ id: '4d6d1', name: '4d6 drop lowest (variant rule)', fn: roll4d6dropLowest }],
    manual: { min: 8, max: 18 },
    note: 'PF2 builds scores from boosts: everything starts at 10, then ancestry, background, class, and four free boosts each add +2 (+1 if already 18+).'
  },

  skills: [
    { id: 'acrobatics', name: 'Acrobatics', ability: 'dex', armorPenalty: true },
    { id: 'arcana', name: 'Arcana', ability: 'int' },
    { id: 'athletics', name: 'Athletics', ability: 'str', armorPenalty: true },
    { id: 'crafting', name: 'Crafting', ability: 'int' },
    { id: 'deception', name: 'Deception', ability: 'cha' },
    { id: 'diplomacy', name: 'Diplomacy', ability: 'cha' },
    { id: 'intimidation', name: 'Intimidation', ability: 'cha' },
    { id: 'lore', name: 'Lore (specific)', ability: 'int' },
    { id: 'medicine', name: 'Medicine', ability: 'wis' },
    { id: 'nature', name: 'Nature', ability: 'wis' },
    { id: 'occultism', name: 'Occultism', ability: 'int' },
    { id: 'performance', name: 'Performance', ability: 'cha' },
    { id: 'religion', name: 'Religion', ability: 'wis' },
    { id: 'society', name: 'Society', ability: 'int' },
    { id: 'stealth', name: 'Stealth', ability: 'dex', armorPenalty: true },
    { id: 'survival', name: 'Survival', ability: 'wis' },
    { id: 'thievery', name: 'Thievery', ability: 'dex', armorPenalty: true }
  ],

  lineages: [
    {
      id: 'dwarf', name: 'Dwarf', size: 'Medium', speed: 20, hp: 10,
      boosts: ['con', 'wis'], freeBoosts: 1, flaw: 'cha',
      languages: ['Common', 'Dwarven'],
      traits: [{ name: 'Darkvision', text: 'You see in darkness as if it were bright light.' }, { name: 'Clan Dagger', text: 'You get one free clan dagger.' }],
      subs: [
        { id: 'ancient', name: 'Ancient-Blooded Dwarf', note: 'Call on Ancient Blood: +1 circumstance bonus to saves vs. magic as a reaction.' },
        { id: 'death', name: 'Death Warden Dwarf', note: 'Successes vs. necromancy become critical successes.' },
        { id: 'forge', name: 'Forge Dwarf', note: 'Fire resistance equal to half your level; treat environmental heat as one step less.' },
        { id: 'rock', name: 'Rock Dwarf', note: '+2 to Fortitude/Reflex DC vs. shove and trip; forced movement halved.' },
        { id: 'strong', name: 'Strong-Blooded Dwarf', note: 'Poison resistance equal to half your level; reduce poison stage by 2 on a success.' }
      ]
    },
    {
      id: 'elf', name: 'Elf', size: 'Medium', speed: 30, hp: 6,
      boosts: ['dex', 'int'], freeBoosts: 1, flaw: 'con',
      languages: ['Common', 'Elven'],
      traits: [{ name: 'Low-Light Vision', text: 'You can see in dim light as though it were bright light.' }],
      subs: [
        { id: 'arctic', name: 'Arctic Elf', note: 'Cold resistance half your level; treat environmental cold as one step less.' },
        { id: 'cavern', name: 'Cavern Elf', note: 'You gain darkvision.' },
        { id: 'seer', name: 'Seer Elf', note: 'Detect magic as an innate cantrip; +1 to identify magic items.' },
        { id: 'whisper', name: 'Whisper Elf', note: '+2 circumstance bonus to Seek within 30 feet.' },
        { id: 'woodland', name: 'Woodland Elf', note: 'Climb trees at full Speed; always Take Cover in foliage.' }
      ]
    },
    {
      id: 'gnome', name: 'Gnome', size: 'Small', speed: 25, hp: 8,
      boosts: ['con', 'cha'], freeBoosts: 1, flaw: 'str',
      languages: ['Common', 'Gnomish', 'Sylvan'],
      traits: [{ name: 'Low-Light Vision', text: 'You can see in dim light as though it were bright light.' }],
      subs: [
        { id: 'chameleon', name: 'Chameleon Gnome', note: 'Change skin and hair colour; +2 to Stealth when matching surroundings.' },
        { id: 'fey', name: 'Fey-Touched Gnome', note: 'One primal cantrip; swap it each day.' },
        { id: 'sensate', name: 'Sensate Gnome', note: 'Imprecise scent 30 feet; +2 to locate unseen creatures by smell.' },
        { id: 'umbral', name: 'Umbral Gnome', note: 'You gain darkvision.' },
        { id: 'wellspring', name: 'Wellspring Gnome', note: 'One cantrip from arcane, divine, or occult tradition.' }
      ]
    },
    {
      id: 'goblin', name: 'Goblin', size: 'Small', speed: 25, hp: 6,
      boosts: ['dex', 'cha'], freeBoosts: 1, flaw: 'wis',
      languages: ['Common', 'Goblin'],
      traits: [{ name: 'Darkvision', text: 'You see in darkness as if it were bright light.' }],
      subs: [
        { id: 'charhide', name: 'Charhide Goblin', note: 'Fire resistance half your level; DC 10 flat check to end persistent fire.' },
        { id: 'irongut', name: 'Irongut Goblin', note: 'Eat spoiled food safely; +2 vs. afflictions from eating.' },
        { id: 'razortooth', name: 'Razortooth Goblin', note: 'Jaws unarmed attack, 1d6 piercing, finesse and unarmed.' },
        { id: 'snow', name: 'Snow Goblin', note: 'Cold resistance half your level; treat environmental cold as one step less.' },
        { id: 'unbreakable', name: 'Unbreakable Goblin', note: '+4 Hit Points; reduce falling damage.' }
      ]
    },
    {
      id: 'halfling', name: 'Halfling', size: 'Small', speed: 25, hp: 6,
      boosts: ['dex', 'wis'], freeBoosts: 1, flaw: 'str',
      languages: ['Common', 'Halfling'],
      traits: [{ name: 'Keen Eyes', text: 'Reduce DC to find hidden creatures; Seek within 30 feet is easier.' }],
      subs: [
        { id: 'gutsy', name: 'Gutsy Halfling', note: 'Successes vs. emotion effects become critical successes.' },
        { id: 'hillock', name: 'Hillock Halfling', note: 'Regain additional HP equal to your level when you rest or Treat Wounds.' },
        { id: 'nomadic', name: 'Nomadic Halfling', note: 'Two extra languages, and one more each time you gain Multilingual.' },
        { id: 'twilight', name: 'Twilight Halfling', note: 'You gain low-light vision.' },
        { id: 'wildwood', name: 'Wildwood Halfling', note: 'Ignore difficult terrain from plants and fungi.' }
      ]
    },
    {
      id: 'human', name: 'Human', size: 'Medium', speed: 25, hp: 8,
      boosts: [], freeBoosts: 2, flaw: null,
      languages: ['Common'], extraLanguages: 1,
      traits: [{ name: 'Versatile', text: 'Two free ability boosts and a general or ancestry feat.' }],
      subs: [
        { id: 'skilled', name: 'Skilled Heritage', note: 'Trained in one skill; expert in it at 5th level.' },
        { id: 'versatile', name: 'Versatile Heritage', note: 'One general feat of your choice (with prerequisites met).' },
        { id: 'halfelf', name: 'Half-Elf', note: 'Low-light vision; access to elf and half-elf ancestry feats.' },
        { id: 'halforc', name: 'Half-Orc', note: 'Low-light vision; access to orc and half-orc ancestry feats.' }
      ]
    },
    {
      id: 'orc', name: 'Orc', size: 'Medium', speed: 25, hp: 10,
      boosts: [], freeBoosts: 2, flaw: null,
      languages: ['Common', 'Orcish'],
      traits: [{ name: 'Darkvision', text: 'You see in darkness as if it were bright light.' }],
      subs: [
        { id: 'badlands', name: 'Badlands Orc', note: 'Hustle twice as long; treat environmental heat as one step less.' },
        { id: 'battle', name: 'Battle-Ready Orc', note: 'Trained in Intimidation; gain Intimidating Glare.' },
        { id: 'grave', name: 'Grave Orc', note: 'Void resistance equal to half your level.' },
        { id: 'hold', name: 'Hold-Scarred Orc', note: 'Trained in Medicine; gain Diehard.' },
        { id: 'rainfall', name: 'Rainfall Orc', note: '+1 circumstance bonus vs. diseases and to Acrobatics on slippery ground.' }
      ]
    },
    {
      id: 'leshy', name: 'Leshy', size: 'Small', speed: 25, hp: 8,
      boosts: ['con', 'wis'], freeBoosts: 1, flaw: 'int',
      languages: ['Common', 'Fey speech'],
      traits: [{ name: 'Plant', text: 'You are a plant, need no air or food, and can rest by photosynthesizing.' }, { name: 'Low-Light Vision', text: 'See in dim light as bright light.' }],
      subs: [
        { id: 'fruit', name: 'Fruit Leshy', note: 'Grow a fruit each day that acts as a minor healing potion.' },
        { id: 'fungus', name: 'Fungus Leshy', note: 'Darkvision instead of low-light vision.' },
        { id: 'gourd', name: 'Gourd Leshy', note: 'Hollow head can store 1 Bulk of items.' },
        { id: 'leaf', name: 'Leaf Leshy', note: 'Reduce falling damage; treat falls as 10 feet shorter.' },
        { id: 'vine', name: 'Vine Leshy', note: 'Climb at full Speed, and Climb without free hands.' }
      ]
    }
  ],

  classes: [
    {
      id: 'alchemist', name: 'Alchemist', hp: 8, keyAbility: ['int'],
      perception: 'trained', skillCount: 3, extraSkills: 'Int mod additional',
      saves: { fort: 'expert', ref: 'expert', will: 'trained' },
      classDC: 'trained', armor: { unarmored: 'trained', light: 'trained', medium: 'trained' },
      weapons: 'Simple weapons, alchemical bombs',
      skillList: ['crafting'], grantSkills: ['crafting'],
      features: { 1: ['Alchemy (advanced alchemy, infused reagents)', 'Research Field', 'Formula Book', 'Quick Alchemy'], 3: ['Alchemical Familiar or feat', 'Field Discovery at 5th'], 5: ['Field Discovery', 'Powerful Alchemy'], 7: ['Iron Will', 'Perpetual Infusions'], 9: ['Alchemical Expertise', 'Alertness', 'Double Brew'], 11: ['Juggernaut', 'Perpetual Potency'], 13: ['Greater Field Discovery', 'Medium Armor Expertise', 'Weapon Specialization'], 15: ['Alchemical Alacrity', 'Evasion'], 17: ['Alchemical Mastery', 'Perpetual Perfection'], 19: ['Medium Armor Mastery'] },
      subclasses: [{ id: 'bomber', name: 'Bomber', note: 'Splash damage focus; free hand bombs.' }, { id: 'chirurgeon', name: 'Chirurgeon', note: 'Crafting for Medicine checks; healing elixirs.' }, { id: 'mutagenist', name: 'Mutagenist', note: 'Mutagens with reduced drawbacks.' }, { id: 'toxicologist', name: 'Toxicologist', note: 'Poison specialist.' }],
      startEquip: ['Alchemist’s tools', 'Formula book', 'Leather armor', 'Two daggers']
    },
    {
      id: 'barbarian', name: 'Barbarian', hp: 12, keyAbility: ['str'],
      perception: 'expert', skillCount: 3,
      saves: { fort: 'expert', ref: 'trained', will: 'expert' },
      classDC: 'trained', armor: { unarmored: 'trained', light: 'trained', medium: 'trained' },
      weapons: 'Simple and martial weapons',
      skillList: ['athletics'], grantSkills: ['athletics'],
      features: { 1: ['Rage', 'Instinct', 'Anathema'], 3: ['Deny Advantage', 'General feat'], 5: ['Brutality (expert in weapons)'], 7: ['Juggernaut', 'Specialization Ability', 'Weapon Specialization'], 9: ['Lightning Reflexes', 'Raging Resistance'], 11: ['Mighty Rage'], 13: ['Greater Juggernaut', 'Medium Armor Expertise', 'Weapon Fury'], 15: ['Greater Weapon Specialization', 'Indomitable Will'], 17: ['Heightened Senses', 'Quick Rage'], 19: ['Armor of Fury', 'Devastator'] },
      subclasses: [{ id: 'animal', name: 'Animal Instinct', note: 'Unarmed animal attacks; ape, bear, bull, cat, deer, frog, shark, snake, wolf.' }, { id: 'dragon', name: 'Dragon Instinct', note: 'Elemental breath and dragon damage bonus.' }, { id: 'fury', name: 'Fury Instinct', note: 'Straightforward +2 rage damage and a class feat.' }, { id: 'giant', name: 'Giant Instinct', note: 'Wield oversized weapons.' }, { id: 'spirit', name: 'Spirit Instinct', note: 'Void/vitality damage against undead and spirits.' }],
      startEquip: ['Hide armor', 'Greataxe', 'Four javelins', 'Adventurer’s pack']
    },
    {
      id: 'bard', name: 'Bard', hp: 8, keyAbility: ['cha'],
      perception: 'expert', skillCount: 4,
      saves: { fort: 'trained', ref: 'trained', will: 'expert' },
      classDC: 'trained', armor: { unarmored: 'trained', light: 'trained' },
      weapons: 'Simple weapons, longsword, rapier, sap, shortbow, shortsword, whip',
      skillList: ['performance'], grantSkills: ['performance', 'occultism'],
      spellcasting: { tradition: 'Occult', ability: 'cha', kind: 'spontaneous' },
      features: { 1: ['Bardic Lore or Muse', 'Composition Spells (Counter Performance, Inspire Courage)', 'Occult Spellcasting', 'Focus Pool'], 3: ['Lightning Reflexes', 'Signature Spells'], 5: ['Expert Spellcaster'], 7: ['Resolve', 'Weapon Specialization'], 9: ['Great Fortitude', 'Vigilant Senses'], 11: ['Bard Weapon Expertise', 'Light Armor Expertise'], 13: ['Master Spellcaster', 'Weapon Mastery'], 15: ['Greater Weapon Specialization'], 17: ['Greater Resolve'], 19: ['Legendary Spellcaster', 'Magnum Opus'] },
      subclasses: [{ id: 'enigma', name: 'Enigma Muse', note: 'Bardic Lore; True Strike composition.' }, { id: 'maestro', name: 'Maestro Muse', note: 'Lingering Composition; Performance focus.' }, { id: 'polymath', name: 'Polymath Muse', note: 'Versatile Performance; broad utility.' }, { id: 'warrior', name: 'Warrior Muse', note: 'Martial Performance; combat-capable bard.' }],
      startEquip: ['Leather armor', 'Rapier', 'Musical instrument', 'Adventurer’s pack']
    },
    {
      id: 'champion', name: 'Champion', hp: 10, keyAbility: ['str', 'dex'],
      perception: 'trained', skillCount: 3,
      saves: { fort: 'expert', ref: 'trained', will: 'expert' },
      classDC: 'trained', armor: { unarmored: 'trained', light: 'trained', medium: 'trained', heavy: 'trained' },
      weapons: 'Simple and martial weapons',
      skillList: ['religion'], grantSkills: ['religion'],
      features: { 1: ['Champion’s Code and Cause', 'Champion’s Reaction', 'Deity and Cause', 'Devotion Spells', 'Shield Block'], 3: ['Divine Ally', 'General feat'], 5: ['Weapon Expertise'], 7: ['Armor Expertise', 'Weapon Specialization'], 9: ['Champion Expertise', 'Divine Smite'], 11: ['Alertness', 'Divine Will', 'Exalt'], 13: ['Armor Mastery', 'Weapon Mastery'], 15: ['Greater Weapon Specialization'], 17: ['Champion Mastery', 'Legendary Armor'], 19: ['Hero’s Defiance'] },
      subclasses: [{ id: 'paladin', name: 'Paladin (Retributive Strike)', note: 'Lawful good; punish enemies who harm allies.' }, { id: 'redeemer', name: 'Redeemer (Glimpse of Redemption)', note: 'Neutral good; offer enemies a change of heart.' }, { id: 'liberator', name: 'Liberator (Liberating Step)', note: 'Chaotic good; free allies from restraint.' }, { id: 'other', name: 'Antipaladin / Tyrant / Desecrator', note: 'Evil causes from the GM’s toolbox.' }],
      startEquip: ['Chain mail', 'Steel shield', 'Bastard sword', 'Adventurer’s pack']
    },
    {
      id: 'cleric', name: 'Cleric', hp: 8, keyAbility: ['wis'],
      perception: 'trained', skillCount: 2,
      saves: { fort: 'trained', ref: 'trained', will: 'expert' },
      classDC: 'trained', armor: { unarmored: 'trained', light: 'trained', medium: 'trained' },
      weapons: 'Simple weapons and your deity’s favored weapon',
      skillList: ['religion'], grantSkills: ['religion'],
      spellcasting: { tradition: 'Divine', ability: 'wis', kind: 'prepared' },
      features: { 1: ['Deity', 'Divine Font (heal or harm)', 'Divine Spellcasting', 'Doctrine'], 3: ['Doctrine feature', 'General feat'], 5: ['Alertness (warpriest) / Second Doctrine'], 7: ['Third Doctrine'], 9: ['Resolve or Divine Defense'], 11: ['Fourth Doctrine', 'Lightning Reflexes'], 13: ['Divine Defense', 'Weapon Specialization'], 15: ['Fifth Doctrine'], 17: ['Miraculous Spell'], 19: ['Final Doctrine', 'Makers of Miracles'] },
      subclasses: [{ id: 'cloistered', name: 'Cloistered Cleric', note: 'Domain initiate, faster spell progression, no armor focus.' }, { id: 'warpriest', name: 'Warpriest', note: 'Shield Block, martial weapon proficiency, tougher but slower casting.' }],
      startEquip: ['Deity’s favored weapon', 'Religious symbol', 'Scale mail', 'Adventurer’s pack']
    },
    {
      id: 'druid', name: 'Druid', hp: 8, keyAbility: ['wis'],
      perception: 'trained', skillCount: 2,
      saves: { fort: 'trained', ref: 'trained', will: 'expert' },
      classDC: 'trained', armor: { unarmored: 'trained', light: 'trained', medium: 'trained' },
      weapons: 'Simple weapons (no metal armor by anathema)',
      skillList: ['nature'], grantSkills: ['nature'],
      spellcasting: { tradition: 'Primal', ability: 'wis', kind: 'prepared' },
      features: { 1: ['Druidic Order', 'Primal Spellcasting', 'Anathema', 'Shield Block or order feature', 'Wild Empathy'], 3: ['Alertness', 'Great Fortitude'], 5: ['Lightning Reflexes'], 7: ['Expert Spellcaster'], 9: ['Druid Weapon Expertise', 'Resolve'], 11: ['Medium Armor Expertise', 'Weapon Specialization'], 13: ['Master Spellcaster'], 15: ['Weapon Specialization (greater)'], 17: ['Legendary Spellcaster'], 19: ['Primal Hierophant'] },
      subclasses: [{ id: 'animal', name: 'Animal Order', note: 'Animal companion; Heal Animal spell.' }, { id: 'leaf', name: 'Leaf Order', note: 'Leshy familiar; Goodberry spell.' }, { id: 'storm', name: 'Storm Order', note: 'Tempest Surge spell; storm-related feats.' }, { id: 'wild', name: 'Wild Order', note: 'Wild Shape; Wild Morph feats.' }, { id: 'flame', name: 'Flame Order', note: 'Ignition and fire-focused primal magic.' }],
      startEquip: ['Leather armor (nonmetal)', 'Scimitar or staff', 'Holly and mistletoe', 'Adventurer’s pack']
    },
    {
      id: 'fighter', name: 'Fighter', hp: 10, keyAbility: ['str', 'dex'],
      perception: 'expert', skillCount: 3,
      saves: { fort: 'expert', ref: 'expert', will: 'trained' },
      classDC: 'trained', armor: { unarmored: 'trained', light: 'trained', medium: 'trained', heavy: 'trained' },
      weapons: 'Expert in simple and martial weapons; trained in advanced',
      skillList: ['acrobatics', 'athletics'],
      features: { 1: ['Attack of Opportunity', 'Shield Block', 'Fighter Weapon Mastery choice'], 3: ['Bravery', 'General feat'], 5: ['Fighter Weapon Mastery'], 7: ['Battlefield Surveyor', 'Weapon Specialization'], 9: ['Combat Flexibility', 'Juggernaut'], 11: ['Armor Expertise', 'Fighter Expertise'], 13: ['Weapon Legend'], 15: ['Evasion', 'Greater Weapon Specialization', 'Improved Flexibility'], 17: ['Armor Mastery'], 19: ['Versatile Legend'] },
      subclasses: [{ id: 'melee', name: 'Melee Weapon Group', note: 'Legendary progression in a melee group (sword, axe, etc.).' }, { id: 'ranged', name: 'Ranged Weapon Group', note: 'Bows or crossbows.' }, { id: 'brawler', name: 'Unarmed / Brawling', note: 'Unarmed combat focus.' }],
      startEquip: ['Chain mail', 'Steel shield', 'Longsword', 'Shortbow + 20 arrows']
    },
    {
      id: 'monk', name: 'Monk', hp: 10, keyAbility: ['str', 'dex'],
      perception: 'trained', skillCount: 4,
      saves: { fort: 'expert', ref: 'expert', will: 'expert' },
      classDC: 'trained', armor: { unarmored: 'expert' },
      weapons: 'Simple weapons and unarmed attacks',
      skillList: ['acrobatics', 'athletics'],
      features: { 1: ['Flurry of Blows', 'Powerful Fist', 'Monk feat'], 3: ['General feat', 'Incredible Movement +10 ft.'], 5: ['Alertness', 'Expert Strikes'], 7: ['Path to Perfection', 'Weapon Specialization'], 9: ['Metal Strikes', 'Monk Expertise'], 11: ['Second Path to Perfection'], 13: ['Graceful Mastery', 'Master Strikes'], 15: ['Greater Weapon Specialization'], 17: ['Third Path to Perfection'], 19: ['Adamantine Strikes', 'Graceful Legend'] },
      subclasses: [{ id: 'ki', name: 'Ki Spells (Ki Strike/Ki Rush)', note: 'Focus-point qi powers.' }, { id: 'stance', name: 'Stance Monk', note: 'Crane, Dragon, Mountain, Tiger, Wolf stances.' }, { id: 'mixed', name: 'Mixed Martial', note: 'Grappling and maneuver focus.' }],
      startEquip: ['Explorer’s clothing', 'Bo staff or sai', 'Adventurer’s pack']
    },
    {
      id: 'ranger', name: 'Ranger', hp: 10, keyAbility: ['str', 'dex'],
      perception: 'expert', skillCount: 4,
      saves: { fort: 'expert', ref: 'expert', will: 'trained' },
      classDC: 'trained', armor: { unarmored: 'trained', light: 'trained', medium: 'trained' },
      weapons: 'Simple and martial weapons',
      skillList: ['nature', 'survival'], grantSkills: ['nature'],
      features: { 1: ['Hunt Prey', 'Hunter’s Edge (flurry, precision, or outwit)'], 3: ['Iron Will', 'Trackless Step'], 5: ['Ranger Weapon Expertise'], 7: ['Vigilant Senses', 'Weapon Specialization'], 9: ['Nature’s Edge', 'Ranger Expertise'], 11: ['Juggernaut', 'Medium Armor Expertise', 'Wild Stride'], 13: ['Weapon Mastery'], 15: ['Greater Weapon Specialization', 'Improved Evasion', 'Incredible Senses'], 17: ['Masterful Hunter'], 19: ['Second Skin', 'Swift Prey'] },
      subclasses: [{ id: 'flurry', name: 'Flurry', note: 'Reduced multiple attack penalty against your prey.' }, { id: 'precision', name: 'Precision', note: 'Extra precision damage on your first hit each round.' }, { id: 'outwit', name: 'Outwit', note: '+2 to skills and +1 AC against your prey.' }],
      startEquip: ['Studded leather', 'Longbow + 20 arrows', 'Two shortswords', 'Adventurer’s pack']
    },
    {
      id: 'rogue', name: 'Rogue', hp: 8, keyAbility: ['dex'],
      perception: 'expert', skillCount: 7,
      saves: { fort: 'trained', ref: 'expert', will: 'expert' },
      classDC: 'trained', armor: { unarmored: 'trained', light: 'trained' },
      weapons: 'Simple weapons, rapier, sap, shortbow, shortsword',
      skillList: ['stealth'], grantSkills: ['stealth'],
      features: { 1: ['Rogue’s Racket', 'Sneak Attack 1d6', 'Surprise Attack'], 3: ['Deny Advantage', 'General feat'], 5: ['Weapon Tricks'], 7: ['Sneak Attack 2d6', 'Vigilant Senses', 'Weapon Specialization'], 9: ['Debilitating Strike', 'Great Fortitude'], 11: ['Rogue Expertise'], 13: ['Improved Evasion', 'Incredible Senses', 'Light Armor Expertise', 'Master Tricks'], 15: ['Double Debilitation', 'Greater Weapon Specialization'], 17: ['Slippery Mind'], 19: ['Light Armor Mastery', 'Master Strike'] },
      subclasses: [{ id: 'ruffian', name: 'Ruffian', note: 'Medium armor, Str-based sneak attack with simple weapons.' }, { id: 'scoundrel', name: 'Scoundrel', note: 'Cha-based; Feint makes targets off-guard.' }, { id: 'thief', name: 'Thief', note: 'Add Dex instead of Str to damage with finesse weapons.' }, { id: 'mastermind', name: 'Mastermind', note: 'Int-based; Recall Knowledge makes targets off-guard.' }],
      startEquip: ['Leather armor', 'Rapier', 'Shortbow + 20 arrows', 'Thieves’ tools']
    },
    {
      id: 'sorcerer', name: 'Sorcerer', hp: 6, keyAbility: ['cha'],
      perception: 'trained', skillCount: 2,
      saves: { fort: 'trained', ref: 'trained', will: 'expert' },
      classDC: 'trained', armor: { unarmored: 'trained' },
      weapons: 'Simple weapons',
      skillList: [], grantSkills: [],
      spellcasting: { tradition: 'By bloodline', ability: 'cha', kind: 'spontaneous' },
      features: { 1: ['Bloodline', 'Spellcasting', 'Bloodline Spells', 'Focus Pool'], 3: ['Signature Spells'], 5: ['Magical Fortitude'], 7: ['Expert Spellcaster'], 9: ['Lightning Reflexes'], 11: ['Alertness', 'Weapon Expertise'], 13: ['Defensive Robes', 'Weapon Specialization'], 15: ['Master Spellcaster'], 17: ['Resolve'], 19: ['Bloodline Paragon', 'Legendary Spellcaster'] },
      subclasses: [{ id: 'aberrant', name: 'Aberrant (Occult)', note: 'Tentacular Limbs; mental magic.' }, { id: 'angelic', name: 'Angelic (Divine)', note: 'Angelic Halo; healing support.' }, { id: 'draconic', name: 'Draconic (Arcane)', note: 'Dragon Claws; elemental damage.' }, { id: 'elemental', name: 'Elemental (Primal)', note: 'Elemental Toss; raw elemental force.' }, { id: 'fey', name: 'Fey (Primal)', note: 'Faerie Dust; illusion and charm.' }, { id: 'imperial', name: 'Imperial (Arcane)', note: 'Ancestral Memories; broad arcane list.' }, { id: 'undead', name: 'Undead (Divine)', note: 'Undeath’s Blessing; void magic.' }],
      startEquip: ['Explorer’s clothing', 'Crossbow + 20 bolts', 'Dagger', 'Adventurer’s pack']
    },
    {
      id: 'wizard', name: 'Wizard', hp: 6, keyAbility: ['int'],
      perception: 'trained', skillCount: 2, extraSkills: 'Int mod additional',
      saves: { fort: 'trained', ref: 'trained', will: 'expert' },
      classDC: 'trained', armor: { unarmored: 'trained' },
      weapons: 'Club, crossbow, dagger, heavy crossbow, staff',
      skillList: ['arcana'], grantSkills: ['arcana'],
      spellcasting: { tradition: 'Arcane', ability: 'int', kind: 'prepared' },
      features: { 1: ['Arcane School', 'Arcane Bond or Thesis', 'Arcane Spellcasting', 'Spellbook'], 3: ['Lightning Reflexes'], 5: ['Expert Spellcaster'], 7: ['Magical Fortitude'], 9: ['Alertness'], 11: ['Wizard Weapon Expertise'], 13: ['Defensive Robes', 'Weapon Specialization'], 15: ['Master Spellcaster'], 17: ['Resolve'], 19: ['Archwizard’s Spellcraft', 'Legendary Spellcaster'] },
      subclasses: [{ id: 'universalist', name: 'Universalist', note: 'Extra spell slots via Drain Bonded Item flexibility.' }, { id: 'evocation', name: 'School of Evocation', note: 'Force Bolt; damage focus.' }, { id: 'illusion', name: 'School of Illusion', note: 'Warped Terrain; misdirection.' }, { id: 'divination', name: 'School of Divination', note: 'Diviner’s Sight; foresight.' }, { id: 'abjuration', name: 'School of Abjuration', note: 'Protective Ward; defense.' }, { id: 'necromancy', name: 'School of Necromancy', note: 'Call of the Grave; void magic.' }, { id: 'transmutation', name: 'School of Transmutation', note: 'Physical Boost; shape-changing.' }, { id: 'enchantment', name: 'School of Enchantment', note: 'Charming Words; mind control.' }, { id: 'conjuration', name: 'School of Conjuration', note: 'Augment Summoning; summoners.' }],
      startEquip: ['Explorer’s clothing', 'Staff', 'Spellbook', 'Writing set', 'Adventurer’s pack']
    }
  ],

  backgrounds: [
    { id: 'acolyte', name: 'Acolyte', boosts: ['int', 'wis'], skills: ['religion'], loreSkill: 'Scribing Lore', feat: 'Student of the Canon' },
    { id: 'acrobat', name: 'Acrobat', boosts: ['str', 'dex'], skills: ['acrobatics'], loreSkill: 'Circus Lore', feat: 'Steady Balance' },
    { id: 'animalwhisperer', name: 'Animal Whisperer', boosts: ['wis', 'cha'], skills: ['nature'], loreSkill: 'Terrain Lore', feat: 'Train Animal' },
    { id: 'artisan', name: 'Artisan', boosts: ['str', 'int'], skills: ['crafting'], loreSkill: 'Guild Lore', feat: 'Specialty Crafting' },
    { id: 'artist', name: 'Artist', boosts: ['dex', 'cha'], skills: ['crafting'], loreSkill: 'Art Lore', feat: 'Specialty Crafting' },
    { id: 'barkeep', name: 'Barkeep', boosts: ['con', 'cha'], skills: ['diplomacy'], loreSkill: 'Alcohol Lore', feat: 'Hobnobber' },
    { id: 'barrister', name: 'Barrister', boosts: ['int', 'cha'], skills: ['diplomacy'], loreSkill: 'Legal Lore', feat: 'Group Impression' },
    { id: 'bounty', name: 'Bounty Hunter', boosts: ['str', 'wis'], skills: ['survival'], loreSkill: 'Legal Lore', feat: 'Experienced Tracker' },
    { id: 'charlatan', name: 'Charlatan', boosts: ['int', 'cha'], skills: ['deception'], loreSkill: 'Underworld Lore', feat: 'Charming Liar' },
    { id: 'criminal', name: 'Criminal', boosts: ['dex', 'int'], skills: ['stealth'], loreSkill: 'Underworld Lore', feat: 'Experienced Smuggler' },
    { id: 'detective', name: 'Detective', boosts: ['int', 'wis'], skills: ['society'], loreSkill: 'Underworld Lore', feat: 'Streetwise' },
    { id: 'emissary', name: 'Emissary', boosts: ['int', 'cha'], skills: ['society'], loreSkill: 'City Lore', feat: 'Multilingual' },
    { id: 'entertainer', name: 'Entertainer', boosts: ['dex', 'cha'], skills: ['performance'], loreSkill: 'Theater Lore', feat: 'Fascinating Performance' },
    { id: 'farmhand', name: 'Farmhand', boosts: ['con', 'wis'], skills: ['athletics'], loreSkill: 'Farming Lore', feat: 'Assurance (Athletics)' },
    { id: 'fieldmedic', name: 'Field Medic', boosts: ['con', 'wis'], skills: ['medicine'], loreSkill: 'Warfare Lore', feat: 'Battle Medicine' },
    { id: 'fortuneteller', name: 'Fortune Teller', boosts: ['int', 'cha'], skills: ['occultism'], loreSkill: 'Fortune-Telling Lore', feat: 'Oddity Identification' },
    { id: 'gambler', name: 'Gambler', boosts: ['dex', 'cha'], skills: ['deception'], loreSkill: 'Games Lore', feat: 'Lie to Me' },
    { id: 'gladiator', name: 'Gladiator', boosts: ['str', 'cha'], skills: ['performance'], loreSkill: 'Gladiatorial Lore', feat: 'Impressive Performance' },
    { id: 'guard', name: 'Guard', boosts: ['str', 'cha'], skills: ['intimidation'], loreSkill: 'Legal or Warfare Lore', feat: 'Quick Coercion' },
    { id: 'herbalist', name: 'Herbalist', boosts: ['con', 'wis'], skills: ['nature'], loreSkill: 'Herbalism Lore', feat: 'Natural Medicine' },
    { id: 'hermit', name: 'Hermit', boosts: ['con', 'int'], skills: ['nature', 'occultism'], loreSkill: 'Terrain Lore', feat: 'Dubious Knowledge' },
    { id: 'hunter', name: 'Hunter', boosts: ['dex', 'wis'], skills: ['survival'], loreSkill: 'Tanning Lore', feat: 'Survey Wildlife' },
    { id: 'laborer', name: 'Laborer', boosts: ['str', 'con'], skills: ['athletics'], loreSkill: 'Labor Lore', feat: 'Hefty Hauler' },
    { id: 'merchant', name: 'Merchant', boosts: ['int', 'cha'], skills: ['diplomacy'], loreSkill: 'Mercantile Lore', feat: 'Bargain Hunter' },
    { id: 'miner', name: 'Miner', boosts: ['str', 'wis'], skills: ['survival'], loreSkill: 'Mining Lore', feat: 'Terrain Expertise (underground)' },
    { id: 'noble', name: 'Noble', boosts: ['int', 'cha'], skills: ['society'], loreSkill: 'Genealogy or Heraldry Lore', feat: 'Courtly Graces' },
    { id: 'nomad', name: 'Nomad', boosts: ['con', 'wis'], skills: ['survival'], loreSkill: 'Terrain Lore', feat: 'Assurance (Survival)' },
    { id: 'prisoner', name: 'Prisoner', boosts: ['str', 'con'], skills: ['stealth'], loreSkill: 'Underworld Lore', feat: 'Experienced Smuggler' },
    { id: 'sailor', name: 'Sailor', boosts: ['str', 'dex'], skills: ['athletics'], loreSkill: 'Sailing Lore', feat: 'Underwater Marauder' },
    { id: 'scholar', name: 'Scholar', boosts: ['int', 'wis'], skills: ['arcana', 'nature', 'occultism', 'religion'], skillChoose: 1, loreSkill: 'Academia Lore', feat: 'Assurance' },
    { id: 'scout', name: 'Scout', boosts: ['dex', 'wis'], skills: ['survival'], loreSkill: 'Terrain Lore', feat: 'Forager' },
    { id: 'street', name: 'Street Urchin', boosts: ['dex', 'con'], skills: ['thievery'], loreSkill: 'City Lore', feat: 'Pickpocket' },
    { id: 'tinker', name: 'Tinker', boosts: ['dex', 'int'], skills: ['crafting'], loreSkill: 'Engineering Lore', feat: 'Specialty Crafting' },
    { id: 'warrior', name: 'Warrior', boosts: ['str', 'con'], skills: ['intimidation'], loreSkill: 'Warfare Lore', feat: 'Intimidating Glare' }
  ],

  armorList: [
    { name: 'Unarmored', ac: 0, maxDex: 99, check: 0, cat: 'unarmored', str: 0 },
    { name: 'Explorer’s Clothing', ac: 0, maxDex: 5, check: 0, cat: 'unarmored', str: 0 },
    { name: 'Padded Armor', ac: 1, maxDex: 3, check: 0, cat: 'light', str: 10 },
    { name: 'Leather', ac: 1, maxDex: 4, check: -1, cat: 'light', str: 10 },
    { name: 'Studded Leather', ac: 2, maxDex: 3, check: -1, cat: 'light', str: 12 },
    { name: 'Chain Shirt', ac: 2, maxDex: 3, check: -1, cat: 'light', str: 12 },
    { name: 'Hide', ac: 3, maxDex: 2, check: -2, cat: 'medium', str: 14 },
    { name: 'Scale Mail', ac: 3, maxDex: 2, check: -2, cat: 'medium', str: 14 },
    { name: 'Chain Mail', ac: 4, maxDex: 1, check: -2, cat: 'medium', str: 16 },
    { name: 'Breastplate', ac: 4, maxDex: 1, check: -2, cat: 'medium', str: 16 },
    { name: 'Splint Mail', ac: 5, maxDex: 1, check: -3, cat: 'heavy', str: 16 },
    { name: 'Half Plate', ac: 5, maxDex: 1, check: -3, cat: 'heavy', str: 16 },
    { name: 'Full Plate', ac: 6, maxDex: 0, check: -3, cat: 'heavy', str: 18 }
  ],
  shields: [
    { name: 'None', ac: 0 },
    { name: 'Buckler (+1 when raised)', ac: 1 },
    { name: 'Steel/Wooden Shield (+2 when raised)', ac: 2 },
    { name: 'Tower Shield (+2, +4 when taking cover)', ac: 2 }
  ],

  languages: ['Common', 'Draconic', 'Dwarven', 'Elven', 'Gnomish', 'Goblin', 'Halfling', 'Jotun', 'Orcish', 'Sylvan', 'Undercommon', 'Fey', 'Necril', 'Empyrean', 'Chthonian'],
  alignments: ['Lawful Good', 'Neutral Good', 'Chaotic Good', 'Lawful Neutral', 'Neutral', 'Chaotic Neutral', 'Lawful Evil', 'Neutral Evil', 'Chaotic Evil', '(Remaster: use edicts and anathema instead)'],

  feats: [
    'Ancestry feat (1st, 5th, 9th, 13th, 17th)', 'Class feat (even levels)',
    'Skill feat (even levels)', 'General feat (3rd, 7th, 11th, 15th, 19th)',
    'Toughness (+level HP, better recovery)', 'Fleet (+5 Speed)', 'Incredible Initiative (+2)',
    'Canny Acumen (expert in a save or Perception)', 'Diehard (die at dying 5)',
    'Feather Step (Step into difficult terrain)', 'Shield Block', 'Assurance (skill floor)',
    'Battle Medicine', 'Cat Fall', 'Continual Recovery', 'Intimidating Glare',
    'Quick Jump', 'Titan Wrestler', 'Untrained Improvisation'
  ],

  skillIncreaseLevels: [3, 5, 7, 9, 11, 13, 15, 17, 19],

  derive(c) {
    const cls = byId(this.classes, c.classId);
    const anc = byId(this.lineages, c.lineageId);
    const bg = byId(this.backgrounds, c.backgroundId);
    const L = clamp(c.level || 1, 1, 20);
    const s = c.finalScores;
    const out = { level: L, skills: [], features: [], notes: [], saves: [] };
    const m = a => mod(s[a]);

    // proficiency helper: rank scales at set levels by class
    const spellProf = L >= 19 ? 'legendary' : L >= 15 ? 'master' : L >= 7 ? 'expert' : 'trained';
    const skillProfOf = id => (c.profs && c.profs[id]) || 'untrained';

    // HP
    const ancHp = anc ? anc.hp : 8;
    const clsHp = cls ? cls.hp : 8;
    out.hp = ancHp + L * (clsHp + m('con'));
    out.hpBreakdown = ancHp + ' ancestry + ' + L + ' x (' + clsHp + ' class + ' + m('con') + ' Con)';
    out.dying = 'Dying 4 = death. Wounded increases dying value.';

    // AC
    const armor = this.armorList.find(a => a.name === (c.armor || 'Unarmored')) || this.armorList[0];
    const shield = this.shields.find(x => x.name === (c.shieldPf2 || 'None')) || this.shields[0];
    const cat = armor.cat;
    let armorRank = (cls && cls.armor && cls.armor[cat]) || 'untrained';
    // armor proficiency improves for martials
    if (cls && ['fighter', 'champion', 'barbarian', 'ranger'].includes(cls.id)) {
      if (L >= 19) armorRank = 'master'; else if (L >= 11 || (cls.id === 'fighter' && L >= 11)) armorRank = 'expert';
    }
    if (cls && cls.id === 'monk' && cat === 'unarmored') armorRank = L >= 17 ? 'legendary' : L >= 13 ? 'master' : 'expert';
    if (cls && ['rogue', 'bard'].includes(cls.id) && cat === 'light' && L >= 13) armorRank = 'expert';
    if (cls && ['wizard', 'sorcerer'].includes(cls.id) && cat === 'unarmored' && L >= 13) armorRank = 'expert';
    const dexCap = Math.min(m('dex'), armor.maxDex);
    out.ac = 10 + L + PROF[armorRank] + armor.ac + dexCap + Number(c.acBonus || 0);
    out.acNote = armor.name + ' (' + armorRank + ', +' + armor.ac + ' item, Dex cap +' + (armor.maxDex === 99 ? '—' : armor.maxDex) + ')' + (shield.ac ? ' | ' + shield.name : '');
    out.shieldAc = shield.ac ? out.ac + shield.ac : null;
    out.armorCheckPenalty = (armor.check && s.str < armor.str) ? armor.check : 0;
    if (armor.str && s.str < armor.str) out.notes.push(armor.name + ' requires Str ' + armor.str + ': −' + Math.abs(armor.check) + ' checks and −5 ft. Speed.');

    // saves
    const sv = cls ? cls.saves : { fort: 'trained', ref: 'trained', will: 'trained' };
    const bump = r => {
      // generic mid-level save bumps
      if (L >= 9 && r === 'trained') return 'expert';
      if (L >= 15 && r === 'expert') return 'master';
      return r;
    };
    [['fort', 'Fortitude', 'con'], ['ref', 'Reflex', 'dex'], ['will', 'Will', 'wis']].forEach(([k, name, ab]) => {
      const r = bump(sv[k]);
      const v = L + PROF[r] + m(ab);
      out.saves.push({ name, value: v, rank: r, detail: 'level ' + L + ' + ' + r + ' (' + PROF[r] + ') + ' + ABIL_NAME[ab] });
      out[k] = v;
    });

    // perception
    let percRank = cls ? cls.perception : 'trained';
    if (L >= 11 && percRank === 'trained') percRank = 'expert';
    if (L >= 15 && percRank === 'expert') percRank = 'master';
    out.perception = L + PROF[percRank] + m('wis');
    out.perceptionRank = percRank;
    out.initiative = out.perception;

    // class DC
    let cdcRank = 'trained';
    if (L >= 19) cdcRank = 'legendary'; else if (L >= 15) cdcRank = 'master'; else if (L >= 9) cdcRank = 'expert';
    const key = c.keyAbility || (cls ? cls.keyAbility[0] : 'str');
    out.classDC = 10 + L + PROF[cdcRank] + m(key);
    out.keyAbility = ABIL_NAME[key];

    // attacks
    let wRank = 'trained';
    if (cls && cls.id === 'fighter') wRank = L >= 13 ? 'legendary' : L >= 5 ? 'master' : 'expert';
    else if (cls && ['barbarian', 'champion', 'monk', 'ranger', 'rogue'].includes(cls.id)) wRank = L >= 13 ? 'master' : L >= 5 ? 'expert' : 'trained';
    else if (L >= 11) wRank = 'expert';
    const potency = L >= 16 ? 3 : L >= 10 ? 2 : L >= 2 ? 1 : 0;
    out.attacks = [
      { name: 'Melee Strike (Str)', value: L + PROF[wRank] + m('str') + potency, note: wRank + ' + assumed +' + potency + ' potency rune' },
      { name: 'Ranged/Finesse Strike (Dex)', value: L + PROF[wRank] + m('dex') + potency, note: wRank + ' + assumed +' + potency + ' potency rune' }
    ];
    out.map = 'Multiple Attack Penalty: −5 on your second Strike, −10 on your third (−4/−8 with agile).';

    // skills
    this.skills.forEach(sk => {
      const rank = skillProfOf(sk.id);
      const pen = sk.armorPenalty ? out.armorCheckPenalty : 0;
      out.skills.push({
        id: sk.id, name: sk.name, ability: sk.ability, prof: rank !== 'untrained', rank,
        value: (rank === 'untrained' ? 0 : L) + PROF[rank] + m(sk.ability) + pen,
        detail: rank === 'untrained' ? 'untrained (no level bonus)' : 'level + ' + rank + (pen ? ' ' + pen + ' armor' : '')
      });
    });
    out.skillIncreases = this.skillIncreaseLevels.filter(l => l <= L).length;
    out.trainedSkillBudget = (cls ? cls.skillCount : 2) + m('int') + 1 /* background */ + 1 /* lore */;

    // spellcasting
    if (cls && cls.spellcasting) {
      const sc = cls.spellcasting;
      const ab = sc.ability;
      out.spell = {
        tradition: sc.tradition, kind: sc.kind, ability: ABIL_NAME[ab],
        rank: spellProf,
        dc: 10 + L + PROF[spellProf] + m(ab),
        attack: L + PROF[spellProf] + m(ab),
        maxRank: Math.min(10, Math.ceil(L / 2)),
        slotsPerRank: L >= 3 ? '3 per rank (4 for some classes with extra slots)' : '2 of 1st rank',
        cantrips: '5 cantrips, heightened to half your level rounded up'
      };
    }

    // feats
    out.featCounts = {
      'Ancestry feats': [1, 5, 9, 13, 17].filter(l => l <= L).length,
      'Class feats': Array.from({ length: 10 }, (_, i) => (i + 1) * 2).filter(l => l <= L).length + (cls && ['fighter', 'barbarian', 'monk', 'rogue', 'ranger'].includes(cls.id) ? 1 : 0),
      'Skill feats': Array.from({ length: 10 }, (_, i) => (i + 1) * 2).filter(l => l <= L).length + (cls && cls.id === 'rogue' ? Array.from({ length: 20 }, (_, i) => i + 1).filter(l => l <= L && l % 2 === 1).length : 0),
      'General feats': [3, 7, 11, 15, 19].filter(l => l <= L).length
    };
    out.abilityBoostLevels = [5, 10, 15, 20].filter(l => l <= L);
    out.asiCount = out.abilityBoostLevels.length;

    if (cls) {
      Object.keys(cls.features).map(Number).sort((a, b) => a - b).forEach(lv => {
        if (lv <= L) cls.features[lv].forEach(f => out.features.push({ level: lv, text: f }));
      });
    }
    let sp = anc ? anc.speed : 25;
    if (armor.str && s.str < armor.str) sp -= 5;
    out.speed = sp + ' ft.';
    out.bulkLimit = 5 + m('str') + ' Bulk (encumbered at ' + (5 + m('str')) + ', max ' + (10 + m('str')) + ')';
    out.notes.push('Each ability boost at 5th, 10th, 15th, 20th gives +2 to four different abilities (+1 if already 18 or higher).');
    if (bg && bg.feat) out.notes.push('Background skill feat: ' + bg.feat + '.');
    return out;
  }
};
