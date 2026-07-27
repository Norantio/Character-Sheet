/* ============================================================
   Pathfinder 1st Edition (Core Rulebook)
   ============================================================ */

const SYS_PF1 = {
  id: 'pf1',
  name: 'Pathfinder 1st Edition',
  tag: 'Core Rulebook',
  blurb: 'D&D 3.5 evolved. Skill ranks, base attack bonus, feats every other level, favored class bonuses.',
  maxLevel: 20,
  abilities: ABIL6,
  lineageLabel: 'Race',
  classLabel: 'Class',
  backgroundLabel: 'Trait / Background',
  subclassLabel: 'Archetype / Focus',
  usesSkillRanks: true,

  abilityGen: {
    pointBuy: { points: 20, min: 7, max: 18, table: PB_PF1, presets: [{ name: 'Low Fantasy', points: 10 }, { name: 'Standard', points: 15 }, { name: 'High Fantasy', points: 20 }, { name: 'Epic', points: 25 }] },
    arrays: [
      { id: 'std', name: 'Standard Array (15 pt equivalent)', scores: [15, 14, 13, 12, 10, 8] },
      { id: 'high', name: 'High Fantasy (20 pt)', scores: [16, 14, 14, 12, 11, 10] }
    ],
    rolls: [
      { id: '4d6d1', name: '4d6 drop lowest (classic)', fn: roll4d6dropLowest },
      { id: '2d6p6', name: '2d6+6 (heroic)', fn: roll2d6plus6 },
      { id: '3d6', name: '3d6 straight', fn: roll3d6 }
    ],
    manual: { min: 3, max: 20 }
  },

  skills: [
    { id: 'acrobatics', name: 'Acrobatics', ability: 'dex', acp: true },
    { id: 'appraise', name: 'Appraise', ability: 'int' },
    { id: 'bluff', name: 'Bluff', ability: 'cha' },
    { id: 'climb', name: 'Climb', ability: 'str', acp: true },
    { id: 'craft', name: 'Craft', ability: 'int' },
    { id: 'diplomacy', name: 'Diplomacy', ability: 'cha' },
    { id: 'disable', name: 'Disable Device', ability: 'dex', acp: true, trainedOnly: true },
    { id: 'disguise', name: 'Disguise', ability: 'cha' },
    { id: 'escape', name: 'Escape Artist', ability: 'dex', acp: true },
    { id: 'fly', name: 'Fly', ability: 'dex', acp: true },
    { id: 'handle', name: 'Handle Animal', ability: 'cha', trainedOnly: true },
    { id: 'heal', name: 'Heal', ability: 'wis' },
    { id: 'intimidate', name: 'Intimidate', ability: 'cha' },
    { id: 'k-arcana', name: 'Knowledge (Arcana)', ability: 'int', trainedOnly: true },
    { id: 'k-dungeon', name: 'Knowledge (Dungeoneering)', ability: 'int', trainedOnly: true },
    { id: 'k-engineer', name: 'Knowledge (Engineering)', ability: 'int', trainedOnly: true },
    { id: 'k-geography', name: 'Knowledge (Geography)', ability: 'int', trainedOnly: true },
    { id: 'k-history', name: 'Knowledge (History)', ability: 'int', trainedOnly: true },
    { id: 'k-local', name: 'Knowledge (Local)', ability: 'int', trainedOnly: true },
    { id: 'k-nature', name: 'Knowledge (Nature)', ability: 'int', trainedOnly: true },
    { id: 'k-nobility', name: 'Knowledge (Nobility)', ability: 'int', trainedOnly: true },
    { id: 'k-planes', name: 'Knowledge (Planes)', ability: 'int', trainedOnly: true },
    { id: 'k-religion', name: 'Knowledge (Religion)', ability: 'int', trainedOnly: true },
    { id: 'linguistics', name: 'Linguistics', ability: 'int', trainedOnly: true },
    { id: 'perception', name: 'Perception', ability: 'wis' },
    { id: 'perform', name: 'Perform', ability: 'cha' },
    { id: 'profession', name: 'Profession', ability: 'wis', trainedOnly: true },
    { id: 'ride', name: 'Ride', ability: 'dex', acp: true },
    { id: 'sense', name: 'Sense Motive', ability: 'wis' },
    { id: 'sleight', name: 'Sleight of Hand', ability: 'dex', acp: true, trainedOnly: true },
    { id: 'spellcraft', name: 'Spellcraft', ability: 'int', trainedOnly: true },
    { id: 'stealth', name: 'Stealth', ability: 'dex', acp: true },
    { id: 'survival', name: 'Survival', ability: 'wis' },
    { id: 'swim', name: 'Swim', ability: 'str', acp: true },
    { id: 'umd', name: 'Use Magic Device', ability: 'cha', trainedOnly: true }
  ],

  lineages: [
    {
      id: 'dwarf', name: 'Dwarf', size: 'Medium', speed: 20, asi: { con: 2, wis: 2, cha: -2 },
      languages: ['Common', 'Dwarven'],
      traits: [
        { name: 'Darkvision', text: '60 ft.' },
        { name: 'Defensive Training', text: '+4 dodge bonus to AC vs. giants.' },
        { name: 'Greed', text: '+2 Appraise on precious metals and gems.' },
        { name: 'Hatred', text: '+1 attack vs. orc and goblinoid humanoids.' },
        { name: 'Hardy', text: '+2 saves vs. poison, spells, and spell-like abilities.' },
        { name: 'Stability', text: '+4 CMD vs. bull rush and trip.' },
        { name: 'Stonecunning', text: '+2 Perception for unusual stonework; free check within 10 ft.' },
        { name: 'Slow and Steady', text: 'Speed is never modified by armor or encumbrance.' }
      ],
      skillBonus: { appraise: 2 }, subs: []
    },
    {
      id: 'elf', name: 'Elf', size: 'Medium', speed: 30, asi: { dex: 2, int: 2, con: -2 },
      languages: ['Common', 'Elven'],
      traits: [
        { name: 'Low-Light Vision', text: 'See twice as far as humans in dim light.' },
        { name: 'Elven Immunities', text: 'Immune to magic sleep; +2 saves vs. enchantment.' },
        { name: 'Keen Senses', text: '+2 Perception.' },
        { name: 'Elven Magic', text: '+2 caster level checks to overcome SR; +2 Spellcraft to identify items.' },
        { name: 'Weapon Familiarity', text: 'Proficient with longbow, shortbow, and elven weapons.' }
      ],
      skillBonus: { perception: 2 }, subs: []
    },
    {
      id: 'gnome', name: 'Gnome', size: 'Small', speed: 20, asi: { con: 2, cha: 2, str: -2 },
      languages: ['Common', 'Gnome', 'Sylvan'],
      traits: [
        { name: 'Low-Light Vision', text: 'See twice as far in dim light.' },
        { name: 'Defensive Training', text: '+4 dodge bonus to AC vs. giants.' },
        { name: 'Illusion Resistance', text: '+2 saves vs. illusions.' },
        { name: 'Keen Senses', text: '+2 Perception.' },
        { name: 'Obsessive', text: '+2 to one Craft or Profession skill.' },
        { name: 'Gnome Magic', text: '+1 DC for illusion spells; dancing lights, ghost sound, prestidigitation, speak with animals 1/day.' },
        { name: 'Hatred', text: '+1 attack vs. reptilian and fey humanoids.' }
      ],
      skillBonus: { perception: 2 }, subs: []
    },
    {
      id: 'halfelf', name: 'Half-Elf', size: 'Medium', speed: 30, asi: {},
      choiceAsi: { count: 1, amount: 2, distinct: true },
      languages: ['Common', 'Elven'], extraLanguages: 1,
      chooseSkills: 0,
      traits: [
        { name: 'Low-Light Vision', text: 'See twice as far in dim light.' },
        { name: 'Adaptability', text: 'Skill Focus as a bonus feat at 1st level.' },
        { name: 'Elf Blood', text: 'Count as both elf and human.' },
        { name: 'Elven Immunities', text: 'Immune to magic sleep; +2 saves vs. enchantment.' },
        { name: 'Keen Senses', text: '+2 Perception.' },
        { name: 'Multitalented', text: 'Choose two favored classes.' }
      ],
      skillBonus: { perception: 2 }, subs: []
    },
    {
      id: 'halforc', name: 'Half-Orc', size: 'Medium', speed: 30, asi: {},
      choiceAsi: { count: 1, amount: 2, distinct: true },
      languages: ['Common', 'Orc'],
      traits: [
        { name: 'Darkvision', text: '60 ft.' },
        { name: 'Intimidating', text: '+2 Intimidate.' },
        { name: 'Orc Blood', text: 'Count as both orc and human.' },
        { name: 'Orc Ferocity', text: 'Fight on for one round at negative HP, 1/day.' },
        { name: 'Weapon Familiarity', text: 'Proficient with greataxe and falchion; orc weapons are martial.' }
      ],
      skillBonus: { intimidate: 2 }, subs: []
    },
    {
      id: 'halfling', name: 'Halfling', size: 'Small', speed: 20, asi: { dex: 2, cha: 2, str: -2 },
      languages: ['Common', 'Halfling'],
      traits: [
        { name: 'Fearless', text: '+2 saves vs. fear (stacks with Halfling Luck).' },
        { name: 'Halfling Luck', text: '+1 racial bonus on all saving throws.' },
        { name: 'Keen Senses', text: '+2 Perception.' },
        { name: 'Sure-Footed', text: '+2 Acrobatics and Climb.' },
        { name: 'Weapon Familiarity', text: 'Proficient with slings; halfling weapons are martial.' },
        { name: 'Small', text: '+1 AC, +1 attack, +4 Stealth, −1 CMB/CMD.' }
      ],
      skillBonus: { perception: 2, acrobatics: 2, climb: 2 }, saveBonusAll: 1, subs: []
    },
    {
      id: 'human', name: 'Human', size: 'Medium', speed: 30, asi: {},
      choiceAsi: { count: 1, amount: 2, distinct: true },
      languages: ['Common'], extraLanguages: 1,
      traits: [
        { name: 'Bonus Feat', text: 'One extra feat at 1st level.' },
        { name: 'Skilled', text: '+1 skill rank per level.' }
      ],
      bonusSkillRankPerLevel: 1, bonusFeats: 1, subs: []
    }
  ],

  classes: [
    {
      id: 'barbarian', name: 'Barbarian', hitDie: 12, bab: 'full', saves: { fort: 'good', ref: 'poor', will: 'poor' },
      skillRanks: 4, primary: ['str'],
      armor: ['Light', 'Medium', 'Shields (not tower)'], weapons: ['Simple', 'Martial'],
      skillList: ['acrobatics', 'climb', 'craft', 'handle', 'intimidate', 'k-nature', 'perception', 'ride', 'survival', 'swim'],
      features: { 1: ['Fast Movement (+10 ft.)', 'Rage (4 + Con mod rounds/day)'], 2: ['Rage Power', 'Uncanny Dodge'], 3: ['Trap Sense +1'], 5: ['Improved Uncanny Dodge'], 7: ['Damage Reduction 1/—'], 11: ['Greater Rage'], 14: ['Indomitable Will'], 17: ['Tireless Rage'], 20: ['Mighty Rage'] },
      featEveryOther: true,
      subclasses: [{ id: 'invuln', name: 'Invulnerable Rager', note: 'Trades uncanny dodge for extra DR.' }, { id: 'titan', name: 'Titan Mauler', note: 'Oversized weapons, giant hunting.' }, { id: 'brutal', name: 'Standard Barbarian', note: 'Core rage powers.' }],
      startEquip: ['Studded leather or hide', 'Greataxe', 'Handaxe', 'Explorer’s outfit'], startGold: '3d6 x 10 gp'
    },
    {
      id: 'bard', name: 'Bard', hitDie: 8, bab: 'threeQuarter', saves: { fort: 'poor', ref: 'good', will: 'good' },
      skillRanks: 6, primary: ['cha'],
      armor: ['Light', 'Shields (not tower)'], weapons: ['Simple', 'Longsword', 'Rapier', 'Sap', 'Short sword', 'Shortbow', 'Whip'],
      skillList: 'any',
      spellcasting: { ability: 'cha', kind: 'spontaneous', maxSpellLevel: 6, startLevel: 1 },
      features: { 1: ['Bardic Knowledge (+½ level to Knowledge)', 'Bardic Performance (2 + Cha rounds/day)', 'Countersong', 'Distraction', 'Fascinate', 'Inspire Courage +1'], 2: ['Versatile Performance', 'Well-Versed'], 3: ['Inspire Competence +2'], 5: ['Lore Master 1/day'], 6: ['Suggestion'], 8: ['Dirge of Doom', 'Inspire Courage +2'], 9: ['Inspire Greatness'], 12: ['Soothing Performance'], 14: ['Frightening Tune', 'Inspire Courage +3'], 15: ['Inspire Heroics'], 18: ['Mass Suggestion'], 20: ['Deadly Performance'] },
      featEveryOther: true,
      subclasses: [{ id: 'arcane', name: 'Arcane Duelist', note: 'Martial performances and combat feats.' }, { id: 'archaeo', name: 'Archaeologist', note: 'Solo luck bonus instead of performances.' }, { id: 'core', name: 'Core Bard', note: 'Full performance suite.' }],
      startEquip: ['Studded leather', 'Rapier', 'Dagger', 'Musical instrument'], startGold: '3d6 x 10 gp'
    },
    {
      id: 'cleric', name: 'Cleric', hitDie: 8, bab: 'threeQuarter', saves: { fort: 'good', ref: 'poor', will: 'good' },
      skillRanks: 2, primary: ['wis'],
      armor: ['Light', 'Medium', 'Heavy', 'Shields (not tower)'], weapons: ['Simple', 'Deity’s favored weapon'],
      skillList: ['appraise', 'craft', 'diplomacy', 'heal', 'k-arcana', 'k-history', 'k-nobility', 'k-planes', 'k-religion', 'linguistics', 'profession', 'sense', 'spellcraft'],
      spellcasting: { ability: 'wis', kind: 'prepared', maxSpellLevel: 9, startLevel: 1, domainSlots: true },
      features: { 1: ['Aura', 'Channel Energy (1d6, 3 + Cha uses/day)', 'Domains (2)', 'Orisons', 'Spontaneous casting (cure/inflict)'], 3: ['Channel Energy 2d6'], 5: ['Channel Energy 3d6'] },
      featEveryOther: true,
      subclasses: [{ id: 'core', name: 'Cleric (two domains)', note: 'Choose two domains from your deity.' }, { id: 'crusader', name: 'Crusader', note: 'Trades a domain for combat training.' }, { id: 'evangelist', name: 'Evangelist', note: 'Performance-based support cleric.' }],
      startEquip: ['Scale mail', 'Heavy wooden shield', 'Deity’s favored weapon', 'Wooden holy symbol'], startGold: '3d6 x 10 gp'
    },
    {
      id: 'druid', name: 'Druid', hitDie: 8, bab: 'threeQuarter', saves: { fort: 'good', ref: 'poor', will: 'good' },
      skillRanks: 4, primary: ['wis'],
      armor: ['Light', 'Medium (nonmetal)', 'Shields (nonmetal)'], weapons: ['Club', 'Dagger', 'Dart', 'Quarterstaff', 'Scimitar', 'Scythe', 'Sickle', 'Shortspear', 'Sling', 'Spear'],
      skillList: ['climb', 'craft', 'fly', 'handle', 'heal', 'k-geography', 'k-nature', 'perception', 'profession', 'ride', 'spellcraft', 'survival', 'swim'],
      spellcasting: { ability: 'wis', kind: 'prepared', maxSpellLevel: 9, startLevel: 1 },
      features: { 1: ['Nature Bond (animal companion or domain)', 'Nature Sense (+2 Knowledge nature, Survival)', 'Orisons', 'Wild Empathy'], 2: ['Woodland Stride'], 3: ['Trackless Step'], 4: ['Resist Nature’s Lure', 'Wild Shape (1/day)'], 6: ['Wild Shape 2/day'], 9: ['Venom Immunity'], 13: ['A Thousand Faces'], 15: ['Timeless Body'], 20: ['Wild Shape at will'] },
      featEveryOther: true,
      subclasses: [{ id: 'companion', name: 'Animal Companion Druid', note: 'Nature Bond: animal companion.' }, { id: 'domain', name: 'Domain Druid', note: 'Nature Bond: cleric-style domain.' }],
      startEquip: ['Leather armor', 'Wooden shield', 'Scimitar or sickle', 'Holly and mistletoe'], startGold: '2d6 x 10 gp'
    },
    {
      id: 'fighter', name: 'Fighter', hitDie: 10, bab: 'full', saves: { fort: 'good', ref: 'poor', will: 'poor' },
      skillRanks: 2, primary: ['str', 'dex'],
      armor: ['All armor', 'All shields'], weapons: ['Simple', 'Martial'],
      skillList: ['climb', 'craft', 'handle', 'intimidate', 'k-dungeon', 'k-engineer', 'profession', 'ride', 'survival', 'swim'],
      features: { 1: ['Bonus Feat', 'Bonus combat feat every even level'], 2: ['Bravery +1', 'Bonus Feat'], 3: ['Armor Training 1'], 5: ['Weapon Training 1'], 7: ['Armor Training 2'], 9: ['Weapon Training 2'], 19: ['Armor Mastery'], 20: ['Weapon Mastery'] },
      featEveryOther: true, bonusFeatEveryEven: true,
      subclasses: [{ id: 'core', name: 'Core Fighter', note: 'Armor training and weapon training.' }, { id: 'twohand', name: 'Two-Handed Fighter', note: 'Overhand chop, shattering strike.' }, { id: 'archer', name: 'Archer', note: 'Hawkeye, expert archer, trick shot.' }, { id: 'weaponmaster', name: 'Weapon Master', note: 'Deep specialization in one weapon.' }],
      startEquip: ['Scale mail', 'Heavy steel shield', 'Longsword', 'Light crossbow + 20 bolts'], startGold: '5d6 x 10 gp'
    },
    {
      id: 'monk', name: 'Monk', hitDie: 8, bab: 'threeQuarter', saves: { fort: 'good', ref: 'good', will: 'good' },
      skillRanks: 4, primary: ['dex', 'wis'],
      armor: [], weapons: ['Monk weapons: club, crossbow, dagger, handaxe, javelin, kama, nunchaku, quarterstaff, sai, shortspear, short sword, shuriken, siangham, sling, spear'],
      skillList: ['acrobatics', 'climb', 'craft', 'escape', 'intimidate', 'k-history', 'k-religion', 'perception', 'perform', 'profession', 'ride', 'sense', 'stealth', 'swim'],
      unarmoredAC: 'wis',
      features: { 1: ['Bonus Feat', 'Flurry of Blows', 'Stunning Fist', 'Unarmed Strike (1d6)'], 2: ['Bonus Feat', 'Evasion'], 3: ['Fast Movement +10', 'Maneuver Training', 'Still Mind'], 4: ['Ki Pool (magic)', 'Slow Fall 20 ft.'], 5: ['High Jump', 'Purity of Body'], 7: ['Wholeness of Body'], 9: ['Improved Evasion'], 11: ['Diamond Body'], 12: ['Abundant Step'], 13: ['Diamond Soul'], 15: ['Quivering Palm'], 17: ['Timeless Body', 'Tongue of the Sun and Moon'], 19: ['Empty Body'], 20: ['Perfect Self'] },
      featEveryOther: true,
      subclasses: [{ id: 'core', name: 'Core Monk', note: 'Flurry of blows, ki pool.' }, { id: 'zen', name: 'Zen Archer', note: 'Flurry with a bow; Wis to ranged attack.' }, { id: 'master', name: 'Master of Many Styles', note: 'Multiple style feats at once.' }],
      startEquip: ['Monk’s outfit', 'Quarterstaff or kama', 'Sling + 10 bullets'], startGold: '1d6 x 10 gp'
    },
    {
      id: 'paladin', name: 'Paladin', hitDie: 10, bab: 'full', saves: { fort: 'good', ref: 'poor', will: 'good' },
      skillRanks: 2, primary: ['str', 'cha'],
      armor: ['All armor', 'All shields'], weapons: ['Simple', 'Martial'],
      skillList: ['craft', 'diplomacy', 'handle', 'heal', 'k-nobility', 'k-religion', 'profession', 'ride', 'sense', 'spellcraft'],
      spellcasting: { ability: 'cha', kind: 'prepared', maxSpellLevel: 4, startLevel: 4 },
      features: { 1: ['Aura of Good', 'Detect Evil', 'Smite Evil 1/day'], 2: ['Divine Grace (+Cha to saves)', 'Lay on Hands'], 3: ['Aura of Courage', 'Divine Health', 'Mercy'], 4: ['Channel Positive Energy', 'Spells'], 5: ['Divine Bond', 'Smite Evil 2/day'], 8: ['Aura of Resolve'], 11: ['Aura of Justice'], 14: ['Aura of Faith'], 17: ['Aura of Righteousness'], 20: ['Holy Champion'] },
      featEveryOther: true,
      subclasses: [{ id: 'core', name: 'Core Paladin', note: 'Smite evil and divine bond.' }, { id: 'oath', name: 'Oathbound Paladin', note: 'Oath against a specific foe.' }],
      startEquip: ['Scale mail', 'Heavy steel shield', 'Longsword', 'Holy symbol'], startGold: '5d6 x 10 gp'
    },
    {
      id: 'ranger', name: 'Ranger', hitDie: 10, bab: 'full', saves: { fort: 'good', ref: 'good', will: 'poor' },
      skillRanks: 6, primary: ['dex', 'str'],
      armor: ['Light', 'Medium', 'Shields (not tower)'], weapons: ['Simple', 'Martial'],
      skillList: ['climb', 'craft', 'handle', 'heal', 'intimidate', 'k-dungeon', 'k-geography', 'k-nature', 'perception', 'profession', 'ride', 'spellcraft', 'stealth', 'survival', 'swim'],
      spellcasting: { ability: 'wis', kind: 'prepared', maxSpellLevel: 4, startLevel: 4 },
      features: { 1: ['Favored Enemy (+2)', 'Track', 'Wild Empathy'], 2: ['Combat Style Feat'], 3: ['Endurance', 'Favored Terrain'], 4: ['Hunter’s Bond', 'Spells'], 5: ['Favored Enemy (2nd)'], 7: ['Woodland Stride'], 8: ['Swift Tracker'], 9: ['Evasion'], 11: ['Quarry'], 12: ['Camouflage'], 17: ['Hide in Plain Sight'], 19: ['Improved Quarry'], 20: ['Master Hunter'] },
      featEveryOther: true,
      subclasses: [{ id: 'archery', name: 'Archery Style', note: 'Combat style: Precise Shot chain.' }, { id: 'twoweapon', name: 'Two-Weapon Style', note: 'Combat style: Two-Weapon Fighting chain.' }],
      startEquip: ['Studded leather', 'Longbow + 20 arrows', 'Two short swords or longsword'], startGold: '5d6 x 10 gp'
    },
    {
      id: 'rogue', name: 'Rogue', hitDie: 8, bab: 'threeQuarter', saves: { fort: 'poor', ref: 'good', will: 'poor' },
      skillRanks: 8, primary: ['dex'],
      armor: ['Light'], weapons: ['Simple', 'Hand crossbow', 'Rapier', 'Sap', 'Shortbow', 'Short sword'],
      skillList: ['acrobatics', 'appraise', 'bluff', 'climb', 'craft', 'diplomacy', 'disable', 'disguise', 'escape', 'intimidate', 'k-dungeon', 'k-local', 'linguistics', 'perception', 'perform', 'profession', 'sense', 'sleight', 'stealth', 'swim', 'umd'],
      features: { 1: ['Sneak Attack +1d6', 'Trapfinding'], 2: ['Evasion', 'Rogue Talent'], 3: ['Sneak Attack +2d6', 'Trap Sense +1'], 4: ['Uncanny Dodge'], 8: ['Improved Uncanny Dodge'], 10: ['Advanced Talents'], 20: ['Master Strike', 'Sneak Attack +10d6'] },
      featEveryOther: true,
      subclasses: [{ id: 'core', name: 'Core Rogue', note: 'Rogue talents every even level.' }, { id: 'scout', name: 'Scout', note: 'Scout’s charge — sneak attack while moving.' }, { id: 'knifemaster', name: 'Knife Master', note: 'Sneak attack d8 with daggers.' }],
      startEquip: ['Leather armor', 'Rapier', 'Shortbow + 20 arrows', 'Thieves’ tools'], startGold: '4d6 x 10 gp'
    },
    {
      id: 'sorcerer', name: 'Sorcerer', hitDie: 6, bab: 'half', saves: { fort: 'poor', ref: 'poor', will: 'good' },
      skillRanks: 2, primary: ['cha'],
      armor: [], weapons: ['Simple'],
      skillList: ['appraise', 'bluff', 'craft', 'fly', 'intimidate', 'k-arcana', 'profession', 'spellcraft', 'umd'],
      spellcasting: { ability: 'cha', kind: 'spontaneous', maxSpellLevel: 9, startLevel: 1 },
      features: { 1: ['Bloodline power', 'Cantrips', 'Eschew Materials'], 3: ['Bloodline power'], 7: ['Bloodline feat'], 9: ['Bloodline power'], 20: ['Bloodline capstone'] },
      featEveryOther: true,
      subclasses: [{ id: 'draconic', name: 'Draconic Bloodline', note: 'Claws, +1 damage per die of chosen element, natural armor.' }, { id: 'arcane', name: 'Arcane Bloodline', note: 'Arcane bond, metamagic adept.' }, { id: 'abyssal', name: 'Abyssal Bloodline', note: 'Claws, strength of the abyss, demon resistances.' }, { id: 'fey', name: 'Fey Bloodline', note: 'Laughing touch, woodland stride, fleeting glance.' }],
      startEquip: ['Quarterstaff or dagger', 'Light crossbow', 'Spell component pouch'], startGold: '2d6 x 10 gp'
    },
    {
      id: 'wizard', name: 'Wizard', hitDie: 6, bab: 'half', saves: { fort: 'poor', ref: 'poor', will: 'good' },
      skillRanks: 2, primary: ['int'],
      armor: [], weapons: ['Club', 'Dagger', 'Heavy crossbow', 'Light crossbow', 'Quarterstaff'],
      skillList: ['appraise', 'craft', 'fly', 'k-arcana', 'k-dungeon', 'k-engineer', 'k-geography', 'k-history', 'k-local', 'k-nature', 'k-nobility', 'k-planes', 'k-religion', 'linguistics', 'profession', 'spellcraft'],
      spellcasting: { ability: 'int', kind: 'prepared', maxSpellLevel: 9, startLevel: 1, bonusSchoolSlot: true },
      features: { 1: ['Arcane Bond (familiar or bonded item)', 'Arcane School', 'Cantrips', 'Scribe Scroll'], 5: ['Bonus feat'], 10: ['Bonus feat'], 15: ['Bonus feat'], 20: ['Bonus feat'] },
      featEveryOther: true,
      subclasses: [{ id: 'universalist', name: 'Universalist', note: 'No opposition schools; hand of the apprentice.' }, { id: 'evocation', name: 'Evocation School', note: 'Intense spells, force missile.' }, { id: 'conjuration', name: 'Conjuration School', note: 'Summoner’s charm, acid dart.' }, { id: 'divination', name: 'Divination School', note: 'Forewarned, diviner’s fortune.' }, { id: 'illusion', name: 'Illusion School', note: 'Extended illusions, blinding ray.' }, { id: 'necromancy', name: 'Necromancy School', note: 'Power over undead, grave touch.' }, { id: 'transmutation', name: 'Transmutation School', note: 'Physical enhancement, telekinetic fist.' }, { id: 'abjuration', name: 'Abjuration School', note: 'Resistance, protective ward.' }, { id: 'enchantment', name: 'Enchantment School', note: 'Enchanting smile, dazing touch.' }],
      startEquip: ['Quarterstaff', 'Spellbook', 'Spell component pouch', 'Scholar’s outfit'], startGold: '2d6 x 10 gp'
    }
  ],

  // PF1 has traits rather than backgrounds; two traits at character creation is the norm
  backgrounds: [
    { id: 'none', name: 'No Trait', skills: [], feature: '—', equip: [] },
    { id: 'armor-expert', name: 'Armor Expert (Combat)', skills: [], feature: 'Reduce armor check penalty by 1 (minimum 0).', equip: [] },
    { id: 'reactionary', name: 'Reactionary (Combat)', skills: [], feature: '+2 trait bonus to Initiative.', equip: [], initBonus: 2 },
    { id: 'resilient', name: 'Resilient (Combat)', skills: [], feature: '+1 trait bonus on Fortitude saves.', equip: [], saveBonus: { fort: 1 } },
    { id: 'magical-knack', name: 'Magical Knack (Magic)', skills: [], feature: '+2 caster level for one class (max your level).', equip: [] },
    { id: 'clever-wordplay', name: 'Clever Wordplay (Social)', skills: [], feature: 'Use Int instead of Cha for one Cha-based skill.', equip: [] },
    { id: 'suspicious', name: 'Suspicious (Social)', skills: [], feature: '+1 trait bonus on Sense Motive; it is a class skill.', equip: [], skillBonus: { sense: 1 } },
    { id: 'focused-study', name: 'Focused Study (Human racial)', skills: [], feature: 'Skill Focus at 1st, 8th, and 16th instead of a bonus feat.', equip: [] },
    { id: 'dangerously-curious', name: 'Dangerously Curious (Magic)', skills: [], feature: '+1 Use Magic Device; it is always a class skill.', equip: [], skillBonus: { umd: 1 } },
    { id: 'fast-talker', name: 'Fast Talker (Social)', skills: [], feature: '+1 trait bonus on Bluff; it is a class skill.', equip: [], skillBonus: { bluff: 1 } },
    { id: 'indomitable-faith', name: 'Indomitable Faith (Faith)', skills: [], feature: '+1 trait bonus on Will saves.', equip: [], saveBonus: { will: 1 } }
  ],

  armorList: [
    { name: 'None', ac: 0, maxDex: 99, acp: 0, type: 'none' },
    { name: 'Padded', ac: 1, maxDex: 8, acp: 0, type: 'light' },
    { name: 'Leather', ac: 2, maxDex: 6, acp: 0, type: 'light' },
    { name: 'Studded Leather', ac: 3, maxDex: 5, acp: -1, type: 'light' },
    { name: 'Chain Shirt', ac: 4, maxDex: 4, acp: -2, type: 'light' },
    { name: 'Hide', ac: 4, maxDex: 4, acp: -3, type: 'medium' },
    { name: 'Scale Mail', ac: 5, maxDex: 3, acp: -4, type: 'medium' },
    { name: 'Chainmail', ac: 6, maxDex: 2, acp: -5, type: 'medium' },
    { name: 'Breastplate', ac: 6, maxDex: 3, acp: -4, type: 'medium' },
    { name: 'Splint Mail', ac: 7, maxDex: 0, acp: -7, type: 'heavy' },
    { name: 'Banded Mail', ac: 7, maxDex: 1, acp: -6, type: 'heavy' },
    { name: 'Half-Plate', ac: 8, maxDex: 0, acp: -7, type: 'heavy' },
    { name: 'Full Plate', ac: 9, maxDex: 1, acp: -6, type: 'heavy' }
  ],
  shields: [
    { name: 'None', ac: 0, acp: 0 },
    { name: 'Buckler', ac: 1, acp: -1 },
    { name: 'Light Shield', ac: 1, acp: -1 },
    { name: 'Heavy Shield', ac: 2, acp: -2 },
    { name: 'Tower Shield', ac: 4, acp: -10, maxDex: 2 }
  ],

  languages: ['Common', 'Dwarven', 'Elven', 'Gnome', 'Goblin', 'Halfling', 'Orc', 'Abyssal', 'Aklo', 'Aquan', 'Auran', 'Celestial', 'Draconic', 'Ignan', 'Infernal', 'Sylvan', 'Terran', 'Undercommon'],
  alignments: ['Lawful Good', 'Neutral Good', 'Chaotic Good', 'Lawful Neutral', 'Neutral', 'Chaotic Neutral', 'Lawful Evil', 'Neutral Evil', 'Chaotic Evil'],

  feats: [
    'Alertness (+2 Perception and Sense Motive)', 'Combat Expertise', 'Combat Reflexes',
    'Deadly Aim', 'Dodge (+1 dodge AC)', 'Endurance', 'Great Fortitude (+2 Fort)',
    'Improved Initiative (+4 initiative)', 'Improved Unarmed Strike', 'Iron Will (+2 Will)',
    'Lightning Reflexes (+2 Ref)', 'Mobility', 'Point-Blank Shot', 'Power Attack',
    'Precise Shot', 'Rapid Reload', 'Rapid Shot', 'Skill Focus (+3 to one skill)',
    'Toughness (+3 HP, +1/level past 3)', 'Two-Weapon Fighting', 'Weapon Finesse',
    'Weapon Focus (+1 attack)', 'Cleave', 'Vital Strike', 'Spell Focus', 'Spell Penetration',
    'Craft Wondrous Item', 'Extra Rage', 'Extra Rogue Talent', 'Nimble Moves', 'Stand Still'
  ],

  derive(c) {
    const cls = byId(this.classes, c.classId);
    const lin = byId(this.lineages, c.lineageId);
    const bg = byId(this.backgrounds, c.backgroundId);
    const L = clamp(c.level || 1, 1, 20);
    const s = c.finalScores;
    const out = { level: L, skills: [], features: [], notes: [], saves: [] };
    const small = lin && lin.size === 'Small';

    const babF = BAB[cls ? cls.bab : 'threeQuarter'];
    out.bab = babF(L);
    const strM = mod(s.str), dexM = mod(s.dex), conM = mod(s.con), intM = mod(s.int), wisM = mod(s.wis), chaM = mod(s.cha);

    // HP: max at 1st level, average after (or rolled)
    const hd = cls ? cls.hitDie : 8;
    let hp;
    if (c.hpMethod === 'roll' && Array.isArray(c.hpRolls)) {
      hp = hd + conM + c.hpRolls.slice(0, L - 1).reduce((t, r) => t + r + conM, 0);
    } else {
      hp = hd + conM + (L - 1) * (Math.floor(hd / 2) + 1 + conM);
    }
    if (c.favoredClassBonus === 'hp') hp += L;
    out.hp = Math.max(L, hp);
    out.hitDice = L + 'd' + hd;

    // saves
    const sv = cls ? cls.saves : { fort: 'poor', ref: 'poor', will: 'poor' };
    const raceSave = (lin && lin.saveBonusAll) || 0;
    const bgSave = (bg && bg.saveBonus) || {};
    const paladinGrace = cls && cls.id === 'paladin' && L >= 2 ? chaM : 0;
    const saveDefs = [
      { key: 'fort', name: 'Fortitude', ability: conM },
      { key: 'ref', name: 'Reflex', ability: dexM },
      { key: 'will', name: 'Will', ability: wisM }
    ];
    saveDefs.forEach(sd => {
      const base = SAVE_PF1[sv[sd.key]](L);
      const v = base + sd.ability + raceSave + (bgSave[sd.key] || 0) + paladinGrace;
      out.saves.push({ name: sd.name, value: v, detail: 'base ' + base + ', ability ' + signed(sd.ability) + (raceSave ? ', racial +' + raceSave : '') + (paladinGrace ? ', divine grace ' + signed(paladinGrace) : '') });
      out[sd.key] = v;
    });

    // AC
    const armor = this.armorList.find(a => a.name === (c.armor || 'None')) || this.armorList[0];
    const shield = this.shields.find(x => x.name === (c.shieldPf || 'None')) || this.shields[0];
    const maxDex = Math.min(armor.maxDex, shield.maxDex === undefined ? 99 : shield.maxDex);
    const effDex = Math.min(dexM, maxDex);
    const sizeAC = small ? 1 : 0;
    let ac = 10 + armor.ac + shield.ac + effDex + sizeAC + Number(c.acBonus || 0);
    const noShield = !c.shieldPf || c.shieldPf === 'None';
    if (armor.type === 'none' && cls && cls.unarmoredAC && noShield) {
      const monkBonus = Math.max(0, wisM) + Math.floor(L / 4);
      ac += monkBonus;
      out.notes.push('Monk AC Bonus: +' + monkBonus + ' (Wis + ¼ level) while unarmored and unencumbered.');
    }
    out.ac = ac;
    out.touchAC = 10 + effDex + sizeAC;
    out.flatFooted = ac - effDex;
    out.acNote = armor.name + (shield.ac ? ' + ' + shield.name : '') + (maxDex < 99 ? ' (max Dex +' + maxDex + ')' : '');
    out.acp = armor.acp + shield.acp + (bg && bg.id === 'armor-expert' ? 1 : 0);
    if (out.acp > 0) out.acp = 0;

    out.initiative = dexM + ((bg && bg.initBonus) || 0);
    let sp = lin ? lin.speed : 30;
    if (armor.type === 'medium' || armor.type === 'heavy') {
      if (!(lin && lin.id === 'dwarf')) sp = sp === 30 ? 20 : sp === 20 ? 15 : sp;
    }
    // Monk fast movement: +10 ft. at 3rd, rising by 10 every three levels to +50 at 18th
    if (cls && cls.id === 'monk' && armor.type === 'none' && L >= 3) sp += 10 * Math.min(5, Math.floor(L / 3));
    out.speed = sp + ' ft.';

    // CMB / CMD
    const sizeMod = small ? -1 : 0;
    out.cmb = out.bab + strM + sizeMod;
    out.cmd = 10 + out.bab + strM + dexM + sizeMod + (lin && lin.id === 'dwarf' ? 0 : 0);

    // attack bonuses
    out.attacks = [
      { name: 'Melee attack', value: out.bab + strM + (small ? 1 : 0), note: 'BAB + Str' + (small ? ' + size' : '') },
      { name: 'Ranged attack', value: out.bab + dexM + (small ? 1 : 0), note: 'BAB + Dex' + (small ? ' + size' : '') }
    ];
    if (out.bab >= 6) {
      const extra = [];
      for (let b = out.bab; b > 0; b -= 5) extra.push(signed(b + strM + (small ? 1 : 0)));
      out.fullAttack = extra.join(' / ');
    }

    // skill ranks
    const perLevel = Math.max(1, (cls ? cls.skillRanks : 2) + intM + ((lin && lin.bonusSkillRankPerLevel) || 0) + (c.favoredClassBonus === 'skill' ? 1 : 0));
    out.skillRanksPerLevel = perLevel;
    out.skillRanksTotal = perLevel * L;
    out.skillRanksSpent = Object.values(c.ranks || {}).reduce((a, b) => a + (b || 0), 0);

    const classSkills = cls ? (cls.skillList === 'any' ? this.skills.map(x => x.id) : cls.skillList) : [];
    this.skills.forEach(sk => {
      const ranks = (c.ranks && c.ranks[sk.id]) || 0;
      const isClass = classSkills.includes(sk.id);
      const trainedBonus = ranks > 0 && isClass ? 3 : 0;
      const racial = (lin && lin.skillBonus && lin.skillBonus[sk.id]) || 0;
      const bgB = (bg && bg.skillBonus && bg.skillBonus[sk.id]) || 0;
      const pen = sk.acp ? out.acp : 0;
      const stealthSize = sk.id === 'stealth' && small ? 4 : 0;
      out.skills.push({
        id: sk.id, name: sk.name, ability: sk.ability, prof: isClass, ranks,
        value: ranks + trainedBonus + mod(s[sk.ability]) + racial + bgB + pen + stealthSize,
        classSkill: isClass, trainedOnly: !!sk.trainedOnly,
        detail: [ranks ? ranks + ' ranks' : null, trainedBonus ? '+3 class' : null, racial ? '+' + racial + ' racial' : null, bgB ? '+' + bgB + ' trait' : null, stealthSize ? '+4 size' : null, pen ? pen + ' armor' : null].filter(Boolean).join(', ')
      });
    });

    // spellcasting
    if (cls && cls.spellcasting) {
      const sc = cls.spellcasting;
      const ab = sc.ability;
      const casterLevel = sc.startLevel > 1 ? Math.max(0, L - (sc.startLevel - 1)) : L;
      const maxLv = Math.min(sc.maxSpellLevel, sc.startLevel > 1 ? Math.min(4, 1 + Math.floor((L - 4) / 3)) : Math.min(9, Math.ceil(L / 2)));
      out.spell = {
        ability: ABIL_NAME[ab],
        kind: sc.kind,
        casterLevel: sc.startLevel > 1 ? Math.floor(L / 2) : L,
        maxSpellLevel: L >= sc.startLevel ? Math.max(1, maxLv) : 0,
        concentration: (sc.startLevel > 1 ? Math.floor(L / 2) : L) + mod(s[ab]),
        bonusSlots: {}
      };
      for (let lv = 1; lv <= out.spell.maxSpellLevel; lv++) {
        const abScore = s[ab];
        const bonus = abScore >= 10 + lv * 2 ? 1 + Math.floor((abScore - 10 - lv * 2) / 8) : 0;
        if (bonus > 0) out.spell.bonusSlots[lv] = bonus;
      }
      out.spell.saveDCbase = 10 + mod(s[ab]);
      if (s[ab] < 10 + 1) out.notes.push('Warning: ' + ABIL_NAME[ab] + ' below 11 — you cannot cast 1st-level spells.');
    }

    // feats
    let feats = 1 + Math.floor((L - 1) / 2);
    if (lin && lin.bonusFeats) feats += lin.bonusFeats;
    out.featCount = feats;
    out.bonusCombatFeats = cls && cls.bonusFeatEveryEven ? 1 + Math.floor(L / 2) : 0;
    out.abilityIncreases = Math.floor(L / 4);

    if (cls) {
      Object.keys(cls.features).map(Number).sort((a, b) => a - b).forEach(lv => {
        if (lv <= L) cls.features[lv].forEach(f => out.features.push({ level: lv, text: f }));
      });
    }
    out.asiCount = out.abilityIncreases;
    const capMult = small ? 0.75 : 1;
    out.carry = { carry: Math.round(s.str * 10 * capMult), push: Math.round(s.str * 30 * capMult) };
    out.notes.push('Favored class bonus: +1 HP or +1 skill rank per level in your favored class.');
    return out;
  }
};
