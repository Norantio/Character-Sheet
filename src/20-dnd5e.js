/* ============================================================
   D&D 5th Edition (2014 core rules)
   ============================================================ */

const SYS_5E = {
  id: '5e',
  name: 'D&D 5th Edition',
  tag: '2014 core',
  blurb: 'Bounded accuracy, advantage/disadvantage, six abilities, proficiency bonus.',
  maxLevel: 20,
  abilities: ABIL6,
  lineageLabel: 'Race',
  classLabel: 'Class',
  backgroundLabel: 'Background',
  subclassLabel: 'Subclass',

  abilityGen: {
    pointBuy: { points: 27, min: 8, max: 15, table: PB_5E },
    arrays: [
      { id: 'std', name: 'Standard Array', scores: [15, 14, 13, 12, 10, 8] },
      { id: 'balanced', name: 'Balanced', scores: [14, 14, 13, 12, 11, 10] }
    ],
    rolls: [
      { id: '4d6d1', name: '4d6 drop lowest', fn: roll4d6dropLowest },
      { id: '3d6', name: '3d6 straight (gritty)', fn: roll3d6 }
    ],
    manual: { min: 1, max: 20 }
  },

  skills: [
    { id: 'acrobatics', name: 'Acrobatics', ability: 'dex' },
    { id: 'animal', name: 'Animal Handling', ability: 'wis' },
    { id: 'arcana', name: 'Arcana', ability: 'int' },
    { id: 'athletics', name: 'Athletics', ability: 'str' },
    { id: 'deception', name: 'Deception', ability: 'cha' },
    { id: 'history', name: 'History', ability: 'int' },
    { id: 'insight', name: 'Insight', ability: 'wis' },
    { id: 'intimidation', name: 'Intimidation', ability: 'cha' },
    { id: 'investigation', name: 'Investigation', ability: 'int' },
    { id: 'medicine', name: 'Medicine', ability: 'wis' },
    { id: 'nature', name: 'Nature', ability: 'int' },
    { id: 'perception', name: 'Perception', ability: 'wis' },
    { id: 'performance', name: 'Performance', ability: 'cha' },
    { id: 'persuasion', name: 'Persuasion', ability: 'cha' },
    { id: 'religion', name: 'Religion', ability: 'int' },
    { id: 'sleight', name: 'Sleight of Hand', ability: 'dex' },
    { id: 'stealth', name: 'Stealth', ability: 'dex' },
    { id: 'survival', name: 'Survival', ability: 'wis' }
  ],

  lineages: [
    {
      id: 'dwarf', name: 'Dwarf', size: 'Medium', speed: 25, asi: { con: 2 },
      languages: ['Common', 'Dwarvish'],
      traits: [
        { name: 'Darkvision', text: '60 ft.' },
        { name: 'Dwarven Resilience', text: 'Advantage on saves vs. poison; resistance to poison damage.' },
        { name: 'Dwarven Combat Training', text: 'Proficiency with battleaxe, handaxe, light hammer, warhammer.' },
        { name: 'Stonecunning', text: 'Double proficiency on History checks about stonework.' },
        { name: 'Speed', text: 'Speed is not reduced by wearing heavy armor.' }
      ],
      subs: [
        { id: 'hill', name: 'Hill Dwarf', asi: { wis: 1 }, traits: [{ name: 'Dwarven Toughness', text: '+1 max HP per level.' }], hpBonusPerLevel: 1 },
        { id: 'mountain', name: 'Mountain Dwarf', asi: { str: 2 }, traits: [{ name: 'Dwarven Armor Training', text: 'Proficiency with light and medium armor.' }] }
      ]
    },
    {
      id: 'elf', name: 'Elf', size: 'Medium', speed: 30, asi: { dex: 2 },
      languages: ['Common', 'Elvish'],
      grantSkills: ['perception'],
      traits: [
        { name: 'Darkvision', text: '60 ft.' },
        { name: 'Keen Senses', text: 'Proficiency in Perception.' },
        { name: 'Fey Ancestry', text: 'Advantage on saves vs. charmed; magic can’t put you to sleep.' },
        { name: 'Trance', text: 'Meditate 4 hours instead of sleeping 8.' }
      ],
      subs: [
        { id: 'high', name: 'High Elf', asi: { int: 1 }, traits: [{ name: 'Elf Weapon Training', text: 'Longsword, shortsword, shortbow, longbow.' }, { name: 'Cantrip', text: 'One wizard cantrip, Intelligence-based.' }, { name: 'Extra Language', text: 'One extra language of your choice.' }] },
        { id: 'wood', name: 'Wood Elf', asi: { wis: 1 }, speed: 35, traits: [{ name: 'Elf Weapon Training', text: 'Longsword, shortsword, shortbow, longbow.' }, { name: 'Fleet of Foot', text: 'Base speed 35 ft.' }, { name: 'Mask of the Wild', text: 'Hide when lightly obscured by natural phenomena.' }] },
        { id: 'drow', name: 'Dark Elf (Drow)', asi: { cha: 1 }, traits: [{ name: 'Superior Darkvision', text: '120 ft.' }, { name: 'Sunlight Sensitivity', text: 'Disadvantage on attacks and Perception in direct sunlight.' }, { name: 'Drow Magic', text: 'Dancing Lights; Faerie Fire at 3rd; Darkness at 5th.' }, { name: 'Drow Weapon Training', text: 'Rapier, shortsword, hand crossbow.' }] }
      ]
    },
    {
      id: 'halfling', name: 'Halfling', size: 'Small', speed: 25, asi: { dex: 2 },
      languages: ['Common', 'Halfling'],
      traits: [
        { name: 'Lucky', text: 'Reroll a 1 on an attack, check, or save.' },
        { name: 'Brave', text: 'Advantage on saves vs. frightened.' },
        { name: 'Halfling Nimbleness', text: 'Move through the space of larger creatures.' }
      ],
      subs: [
        { id: 'lightfoot', name: 'Lightfoot', asi: { cha: 1 }, traits: [{ name: 'Naturally Stealthy', text: 'Hide behind a creature one size larger.' }] },
        { id: 'stout', name: 'Stout', asi: { con: 1 }, traits: [{ name: 'Stout Resilience', text: 'Advantage vs. poison; poison resistance.' }] }
      ]
    },
    {
      id: 'human', name: 'Human', size: 'Medium', speed: 30, asi: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 },
      languages: ['Common'], extraLanguages: 1,
      traits: [{ name: 'Extra Language', text: 'One additional language of your choice.' }],
      subs: [
        { id: 'standard', name: 'Standard Human', asi: {}, traits: [] },
        { id: 'variant', name: 'Variant Human', replaceAsi: true, asi: {}, choiceAsi: { count: 2, amount: 1, distinct: true }, chooseSkills: 1, grantFeat: 1, traits: [{ name: 'Variant Traits', text: '+1 to two different abilities, one skill proficiency, one feat.' }] }
      ]
    },
    {
      id: 'dragonborn', name: 'Dragonborn', size: 'Medium', speed: 30, asi: { str: 2, cha: 1 },
      languages: ['Common', 'Draconic'],
      choice: { key: 'ancestry', label: 'Draconic Ancestry', options: ['Black (acid, 5x30 line, Dex)', 'Blue (lightning, 5x30 line, Dex)', 'Brass (fire, 5x30 line, Dex)', 'Bronze (lightning, 5x30 line, Dex)', 'Copper (acid, 5x30 line, Dex)', 'Gold (fire, 15 cone, Dex)', 'Green (poison, 15 cone, Con)', 'Red (fire, 15 cone, Dex)', 'Silver (cold, 15 cone, Con)', 'White (cold, 15 cone, Con)'] },
      traits: [
        { name: 'Breath Weapon', text: '2d6 damage (scales with level), DC 8 + Con mod + prof.' },
        { name: 'Damage Resistance', text: 'Resistance to your ancestry’s damage type.' }
      ], subs: []
    },
    {
      id: 'gnome', name: 'Gnome', size: 'Small', speed: 25, asi: { int: 2 },
      languages: ['Common', 'Gnomish'],
      traits: [
        { name: 'Darkvision', text: '60 ft.' },
        { name: 'Gnome Cunning', text: 'Advantage on all Int, Wis, Cha saves vs. magic.' }
      ],
      subs: [
        { id: 'forest', name: 'Forest Gnome', asi: { dex: 1 }, traits: [{ name: 'Natural Illusionist', text: 'Minor Illusion cantrip (Int).' }, { name: 'Speak with Small Beasts', text: 'Communicate simple ideas to small animals.' }] },
        { id: 'rock', name: 'Rock Gnome', asi: { con: 1 }, traits: [{ name: 'Artificer’s Lore', text: 'Double proficiency on History about magic/tech/alchemy.' }, { name: 'Tinker', text: 'Build tiny clockwork devices.' }] }
      ]
    },
    {
      id: 'halfelf', name: 'Half-Elf', size: 'Medium', speed: 30, asi: { cha: 2 },
      choiceAsi: { count: 2, amount: 1, distinct: true, exclude: ['cha'] },
      chooseSkills: 2, extraLanguages: 1,
      languages: ['Common', 'Elvish'],
      traits: [
        { name: 'Darkvision', text: '60 ft.' },
        { name: 'Fey Ancestry', text: 'Advantage vs. charmed; magic can’t put you to sleep.' },
        { name: 'Skill Versatility', text: 'Proficiency in two skills of your choice.' }
      ], subs: []
    },
    {
      id: 'halforc', name: 'Half-Orc', size: 'Medium', speed: 30, asi: { str: 2, con: 1 },
      languages: ['Common', 'Orc'], grantSkills: ['intimidation'],
      traits: [
        { name: 'Darkvision', text: '60 ft.' },
        { name: 'Menacing', text: 'Proficiency in Intimidation.' },
        { name: 'Relentless Endurance', text: 'Drop to 1 HP instead of 0, once per long rest.' },
        { name: 'Savage Attacks', text: 'Extra weapon damage die on a critical hit.' }
      ], subs: []
    },
    {
      id: 'tiefling', name: 'Tiefling', size: 'Medium', speed: 30, asi: { cha: 2, int: 1 },
      languages: ['Common', 'Infernal'],
      traits: [
        { name: 'Darkvision', text: '60 ft.' },
        { name: 'Hellish Resistance', text: 'Resistance to fire damage.' },
        { name: 'Infernal Legacy', text: 'Thaumaturgy; Hellish Rebuke at 3rd; Darkness at 5th (Cha).' }
      ], subs: []
    }
  ],

  classes: [
    {
      id: 'barbarian', name: 'Barbarian', hitDie: 12, primary: ['str'], saves: ['str', 'con'],
      armor: ['Light', 'Medium', 'Shields'], weapons: ['Simple', 'Martial'], tools: [],
      skillCount: 2, skillList: ['animal', 'athletics', 'intimidation', 'nature', 'perception', 'survival'],
      asiLevels: ASI_5E, subclassLevel: 3, unarmoredAC: 'con',
      features: {
        1: ['Rage (2/day, +2 damage)', 'Unarmored Defense (10 + Dex + Con)'],
        2: ['Reckless Attack', 'Danger Sense'], 3: ['Primal Path', 'Rage 3/day'],
        5: ['Extra Attack', 'Fast Movement (+10 ft.)'], 7: ['Feral Instinct'],
        9: ['Brutal Critical (1 die)'], 11: ['Relentless Rage'], 13: ['Brutal Critical (2 dice)'],
        15: ['Persistent Rage'], 17: ['Brutal Critical (3 dice)'], 18: ['Indomitable Might'],
        20: ['Primal Champion (+4 Str and Con, max 24)']
      },
      subclasses: [
        { id: 'berserker', name: 'Path of the Berserker', note: 'Frenzy, Mindless Rage, Intimidating Presence, Retaliation.' },
        { id: 'totem', name: 'Path of the Totem Warrior', note: 'Spirit Seeker, Totem Spirit (bear/eagle/wolf), Aspect of the Beast.' }
      ],
      startEquip: ['Greataxe or any martial melee weapon', 'Two handaxes or any simple weapon', 'Explorer’s pack', 'Four javelins']
    },
    {
      id: 'bard', name: 'Bard', hitDie: 8, primary: ['cha'], saves: ['dex', 'cha'],
      armor: ['Light'], weapons: ['Simple', 'Hand crossbow', 'Longsword', 'Rapier', 'Shortsword'], tools: ['Three musical instruments'],
      skillCount: 3, skillList: 'any', asiLevels: ASI_5E, subclassLevel: 3,
      spellcasting: { ability: 'cha', kind: 'full', prepares: false, cantripsByLevel: { 1: 2, 4: 3, 10: 4 } },
      features: {
        1: ['Spellcasting', 'Bardic Inspiration (d6)'], 2: ['Jack of All Trades', 'Song of Rest (d6)'],
        3: ['Bard College', 'Expertise (2 skills)'], 5: ['Bardic Inspiration (d8)', 'Font of Inspiration'],
        6: ['Countercharm', 'Bard College feature'], 7: ['Song of Rest (d8)'], 9: ['Song of Rest (d10)'],
        10: ['Bardic Inspiration (d10)', 'Expertise (2 more)', 'Magical Secrets'], 13: ['Song of Rest (d12)'],
        14: ['Magical Secrets', 'College feature'], 15: ['Bardic Inspiration (d12)'], 18: ['Magical Secrets'],
        20: ['Superior Inspiration']
      },
      subclasses: [
        { id: 'lore', name: 'College of Lore', note: 'Bonus proficiencies, Cutting Words, Additional Magical Secrets.' },
        { id: 'valor', name: 'College of Valor', note: 'Medium armor/shield/martial weapons, Combat Inspiration, Extra Attack.' }
      ],
      startEquip: ['Rapier, longsword, or any simple weapon', 'Diplomat’s or entertainer’s pack', 'Lute or other instrument', 'Leather armor', 'Dagger']
    },
    {
      id: 'cleric', name: 'Cleric', hitDie: 8, primary: ['wis'], saves: ['wis', 'cha'],
      armor: ['Light', 'Medium', 'Shields'], weapons: ['Simple'], tools: [],
      skillCount: 2, skillList: ['history', 'insight', 'medicine', 'persuasion', 'religion'],
      asiLevels: ASI_5E, subclassLevel: 1,
      spellcasting: { ability: 'wis', kind: 'full', prepares: true, cantripsByLevel: { 1: 3, 4: 4, 10: 5 } },
      features: {
        1: ['Spellcasting', 'Divine Domain'], 2: ['Channel Divinity (1/rest)', 'Turn Undead'],
        4: ['Domain feature'], 5: ['Destroy Undead (CR 1/2)'], 6: ['Channel Divinity (2/rest)'],
        8: ['Destroy Undead (CR 1)', 'Domain feature'], 10: ['Divine Intervention'],
        11: ['Destroy Undead (CR 2)'], 14: ['Destroy Undead (CR 3)'], 17: ['Destroy Undead (CR 4)', 'Domain feature'],
        18: ['Channel Divinity (3/rest)'], 20: ['Divine Intervention improvement']
      },
      subclasses: [
        { id: 'knowledge', name: 'Knowledge Domain', note: 'Blessings of Knowledge, Knowledge of the Ages.' },
        { id: 'life', name: 'Life Domain', note: 'Heavy armor, Disciple of Life, Preserve Life.' },
        { id: 'light', name: 'Light Domain', note: 'Light cantrip, Warding Flare, Radiance of the Dawn.' },
        { id: 'nature', name: 'Nature Domain', note: 'Heavy armor, one druid cantrip, Charm Animals and Plants.' },
        { id: 'tempest', name: 'Tempest Domain', note: 'Heavy armor, martial weapons, Wrath of the Storm.' },
        { id: 'trickery', name: 'Trickery Domain', note: 'Blessing of the Trickster, Invoke Duplicity.' },
        { id: 'war', name: 'War Domain', note: 'Heavy armor, martial weapons, War Priest, Guided Strike.' }
      ],
      startEquip: ['Mace or warhammer (if proficient)', 'Scale mail, leather armor, or chain mail (if proficient)', 'Light crossbow and 20 bolts or any simple weapon', 'Priest’s pack', 'Shield and holy symbol']
    },
    {
      id: 'druid', name: 'Druid', hitDie: 8, primary: ['wis'], saves: ['int', 'wis'],
      armor: ['Light', 'Medium', 'Shields (nonmetal)'], weapons: ['Club', 'Dagger', 'Dart', 'Javelin', 'Mace', 'Quarterstaff', 'Scimitar', 'Sickle', 'Sling', 'Spear'], tools: ['Herbalism kit'],
      skillCount: 2, skillList: ['arcana', 'animal', 'insight', 'medicine', 'nature', 'perception', 'religion', 'survival'],
      asiLevels: ASI_5E, subclassLevel: 2,
      spellcasting: { ability: 'wis', kind: 'full', prepares: true, cantripsByLevel: { 1: 2, 4: 3, 10: 4 } },
      features: {
        1: ['Druidic', 'Spellcasting'], 2: ['Wild Shape', 'Druid Circle'], 4: ['Wild Shape improvement'],
        8: ['Wild Shape improvement'], 18: ['Timeless Body', 'Beast Spells'], 20: ['Archdruid']
      },
      subclasses: [
        { id: 'land', name: 'Circle of the Land', note: 'Bonus cantrip, Natural Recovery, Circle Spells, Land’s Stride.' },
        { id: 'moon', name: 'Circle of the Moon', note: 'Combat Wild Shape, Circle Forms, Primal Strike, Elemental Wild Shape.' }
      ],
      startEquip: ['Wooden shield or any simple weapon', 'Scimitar or any simple melee weapon', 'Leather armor', 'Explorer’s pack', 'Druidic focus']
    },
    {
      id: 'fighter', name: 'Fighter', hitDie: 10, primary: ['str', 'dex'], saves: ['str', 'con'],
      armor: ['All armor', 'Shields'], weapons: ['Simple', 'Martial'], tools: [],
      skillCount: 2, skillList: ['acrobatics', 'animal', 'athletics', 'history', 'insight', 'intimidation', 'perception', 'survival'],
      asiLevels: ASI_5E_FIGHTER, subclassLevel: 3,
      features: {
        1: ['Fighting Style', 'Second Wind'], 2: ['Action Surge (1 use)'], 3: ['Martial Archetype'],
        5: ['Extra Attack'], 9: ['Indomitable (1 use)'], 11: ['Extra Attack (2)'],
        13: ['Indomitable (2 uses)'], 17: ['Action Surge (2)', 'Indomitable (3 uses)'], 20: ['Extra Attack (3)']
      },
      choices: [{ key: 'fightingStyle', label: 'Fighting Style', options: ['Archery (+2 ranged attack)', 'Defense (+1 AC in armor)', 'Dueling (+2 damage, one-handed)', 'Great Weapon Fighting (reroll 1s and 2s)', 'Protection (impose disadvantage w/ shield)', 'Two-Weapon Fighting (add mod to off-hand)'] }],
      subclasses: [
        { id: 'champion', name: 'Champion', note: 'Improved Critical, Remarkable Athlete, Superior Critical, Survivor.' },
        { id: 'battlemaster', name: 'Battle Master', note: 'Combat Superiority, maneuvers, superiority dice, Know Your Enemy.' },
        { id: 'eldritch', name: 'Eldritch Knight', note: 'Third-caster (wizard), Weapon Bond, War Magic, Eldritch Strike.', spellcasting: { ability: 'int', kind: 'third' } }
      ],
      startEquip: ['Chain mail or leather + longbow + 20 arrows', 'Martial weapon and shield, or two martial weapons', 'Light crossbow + 20 bolts, or two handaxes', 'Dungeoneer’s or explorer’s pack']
    },
    {
      id: 'monk', name: 'Monk', hitDie: 8, primary: ['dex', 'wis'], saves: ['str', 'dex'],
      armor: [], weapons: ['Simple', 'Shortsword'], tools: ['One artisan’s tool or instrument'],
      skillCount: 2, skillList: ['acrobatics', 'athletics', 'history', 'insight', 'religion', 'stealth'],
      asiLevels: ASI_5E, subclassLevel: 3, unarmoredAC: 'wis',
      features: {
        1: ['Unarmored Defense (10 + Dex + Wis)', 'Martial Arts (d4)'], 2: ['Ki (2 points)', 'Unarmored Movement +10'],
        3: ['Monastic Tradition', 'Deflect Missiles'], 4: ['Slow Fall'], 5: ['Extra Attack', 'Stunning Strike', 'Martial Arts d6'],
        6: ['Ki-Empowered Strikes', 'Unarmored Movement +15'], 7: ['Evasion', 'Stillness of Mind'],
        9: ['Unarmored Movement improvement'], 10: ['Purity of Body', 'Unarmored Movement +20'],
        11: ['Martial Arts d8'], 13: ['Tongue of the Sun and Moon'], 14: ['Diamond Soul', 'Unarmored Movement +25'],
        15: ['Timeless Body'], 17: ['Martial Arts d10'], 18: ['Empty Body', 'Unarmored Movement +30'], 20: ['Perfect Self']
      },
      subclasses: [
        { id: 'open', name: 'Way of the Open Hand', note: 'Open Hand Technique, Wholeness of Body, Quivering Palm.' },
        { id: 'shadow', name: 'Way of Shadow', note: 'Shadow Arts, Shadow Step, Cloak of Shadows, Opportunist.' },
        { id: 'element', name: 'Way of the Four Elements', note: 'Elemental disciplines fueled by ki.' }
      ],
      startEquip: ['Shortsword or any simple weapon', 'Dungeoneer’s or explorer’s pack', '10 darts']
    },
    {
      id: 'paladin', name: 'Paladin', hitDie: 10, primary: ['str', 'cha'], saves: ['wis', 'cha'],
      armor: ['All armor', 'Shields'], weapons: ['Simple', 'Martial'], tools: [],
      skillCount: 2, skillList: ['athletics', 'insight', 'intimidation', 'medicine', 'persuasion', 'religion'],
      asiLevels: ASI_5E, subclassLevel: 3,
      spellcasting: { ability: 'cha', kind: 'half', prepares: true },
      features: {
        1: ['Divine Sense', 'Lay on Hands (5 x level)'], 2: ['Fighting Style', 'Spellcasting', 'Divine Smite'],
        3: ['Divine Health', 'Sacred Oath', 'Channel Divinity'], 5: ['Extra Attack'], 6: ['Aura of Protection (10 ft.)'],
        10: ['Aura of Courage'], 11: ['Improved Divine Smite (+1d8)'], 14: ['Cleansing Touch'],
        18: ['Aura improvements (30 ft.)'], 20: ['Oath capstone']
      },
      choices: [{ key: 'fightingStyle', label: 'Fighting Style (2nd level)', options: ['Defense', 'Dueling', 'Great Weapon Fighting', 'Protection'] }],
      subclasses: [
        { id: 'devotion', name: 'Oath of Devotion', note: 'Sacred Weapon, Turn the Unholy, Aura of Devotion, Holy Nimbus.' },
        { id: 'ancients', name: 'Oath of the Ancients', note: 'Nature’s Wrath, Turn the Faithless, Aura of Warding.' },
        { id: 'vengeance', name: 'Oath of Vengeance', note: 'Abjure Enemy, Vow of Enmity, Relentless Avenger, Avenging Angel.' }
      ],
      startEquip: ['Martial weapon and shield, or two martial weapons', 'Five javelins or any simple melee weapon', 'Priest’s pack', 'Chain mail and holy symbol']
    },
    {
      id: 'ranger', name: 'Ranger', hitDie: 10, primary: ['dex', 'wis'], saves: ['str', 'dex'],
      armor: ['Light', 'Medium', 'Shields'], weapons: ['Simple', 'Martial'], tools: [],
      skillCount: 3, skillList: ['animal', 'athletics', 'insight', 'investigation', 'nature', 'perception', 'stealth', 'survival'],
      asiLevels: ASI_5E, subclassLevel: 3,
      spellcasting: { ability: 'wis', kind: 'half', prepares: false },
      features: {
        1: ['Favored Enemy', 'Natural Explorer'], 2: ['Fighting Style', 'Spellcasting'],
        3: ['Ranger Archetype', 'Primeval Awareness'], 5: ['Extra Attack'], 6: ['Favored Enemy / Explorer improvement'],
        8: ['Land’s Stride'], 10: ['Hide in Plain Sight', 'Natural Explorer improvement'],
        14: ['Vanish', 'Favored Enemy improvement'], 18: ['Feral Senses'], 20: ['Foe Slayer']
      },
      choices: [{ key: 'fightingStyle', label: 'Fighting Style (2nd level)', options: ['Archery', 'Defense', 'Dueling', 'Two-Weapon Fighting'] }],
      subclasses: [
        { id: 'hunter', name: 'Hunter', note: 'Hunter’s Prey, Defensive Tactics, Multiattack, Superior Hunter’s Defense.' },
        { id: 'beastmaster', name: 'Beast Master', note: 'Ranger’s Companion, Exceptional Training, Bestial Fury.' }
      ],
      startEquip: ['Scale mail or leather armor', 'Two shortswords or two simple melee weapons', 'Dungeoneer’s or explorer’s pack', 'Longbow and quiver of 20 arrows']
    },
    {
      id: 'rogue', name: 'Rogue', hitDie: 8, primary: ['dex'], saves: ['dex', 'int'],
      armor: ['Light'], weapons: ['Simple', 'Hand crossbow', 'Longsword', 'Rapier', 'Shortsword'], tools: ['Thieves’ tools'],
      skillCount: 4, skillList: ['acrobatics', 'athletics', 'deception', 'insight', 'intimidation', 'investigation', 'perception', 'performance', 'persuasion', 'sleight', 'stealth'],
      asiLevels: ASI_5E_ROGUE, subclassLevel: 3, expertise: { level: 1, count: 2 },
      features: {
        1: ['Expertise (2 skills)', 'Sneak Attack (1d6)', 'Thieves’ Cant'], 2: ['Cunning Action'],
        3: ['Roguish Archetype', 'Sneak Attack 2d6'], 5: ['Uncanny Dodge', 'Sneak Attack 3d6'],
        6: ['Expertise (2 more)'], 7: ['Evasion', 'Sneak Attack 4d6'], 11: ['Reliable Talent'],
        14: ['Blindsense'], 15: ['Slippery Mind'], 18: ['Elusive'], 20: ['Stroke of Luck', 'Sneak Attack 10d6']
      },
      subclasses: [
        { id: 'thief', name: 'Thief', note: 'Fast Hands, Second-Story Work, Supreme Sneak, Thief’s Reflexes.' },
        { id: 'assassin', name: 'Assassin', note: 'Assassinate, Infiltration Expertise, Impostor, Death Strike.' },
        { id: 'trickster', name: 'Arcane Trickster', note: 'Third-caster (wizard illusion/enchantment), Mage Hand Legerdemain.', spellcasting: { ability: 'int', kind: 'third' } }
      ],
      startEquip: ['Rapier or shortsword', 'Shortbow and quiver of 20 arrows, or shortsword', 'Burglar’s, dungeoneer’s, or explorer’s pack', 'Leather armor, two daggers, thieves’ tools']
    },
    {
      id: 'sorcerer', name: 'Sorcerer', hitDie: 6, primary: ['cha'], saves: ['con', 'cha'],
      armor: [], weapons: ['Dagger', 'Dart', 'Sling', 'Quarterstaff', 'Light crossbow'], tools: [],
      skillCount: 2, skillList: ['arcana', 'deception', 'insight', 'intimidation', 'persuasion', 'religion'],
      asiLevels: ASI_5E, subclassLevel: 1,
      spellcasting: { ability: 'cha', kind: 'full', prepares: false, cantripsByLevel: { 1: 4, 4: 5, 10: 6 } },
      features: {
        1: ['Spellcasting', 'Sorcerous Origin'], 2: ['Font of Magic (sorcery points)'],
        3: ['Metamagic (2 options)'], 10: ['Metamagic (3rd option)'], 17: ['Metamagic (4th option)'],
        20: ['Sorcerous Restoration']
      },
      subclasses: [
        { id: 'draconic', name: 'Draconic Bloodline', note: 'Dragon Ancestor, Draconic Resilience (+1 HP/level, AC 13+Dex), Dragon Wings.', hpBonusPerLevel: 1 },
        { id: 'wild', name: 'Wild Magic', note: 'Wild Magic Surge, Tides of Chaos, Bend Luck, Spell Bombardment.' }
      ],
      startEquip: ['Light crossbow + 20 bolts, or any simple weapon', 'Component pouch or arcane focus', 'Dungeoneer’s or explorer’s pack', 'Two daggers']
    },
    {
      id: 'warlock', name: 'Warlock', hitDie: 8, primary: ['cha'], saves: ['wis', 'cha'],
      armor: ['Light'], weapons: ['Simple'], tools: [],
      skillCount: 2, skillList: ['arcana', 'deception', 'history', 'intimidation', 'investigation', 'nature', 'religion'],
      asiLevels: ASI_5E, subclassLevel: 1,
      spellcasting: { ability: 'cha', kind: 'pact', prepares: false, cantripsByLevel: { 1: 2, 4: 3, 10: 4 } },
      features: {
        1: ['Otherworldly Patron', 'Pact Magic'], 2: ['Eldritch Invocations'], 3: ['Pact Boon'],
        11: ['Mystic Arcanum (6th)'], 13: ['Mystic Arcanum (7th)'], 15: ['Mystic Arcanum (8th)'],
        17: ['Mystic Arcanum (9th)'], 20: ['Eldritch Master']
      },
      choices: [{ key: 'pactBoon', label: 'Pact Boon (3rd level)', options: ['Pact of the Chain (familiar)', 'Pact of the Blade (summon weapon)', 'Pact of the Tome (Book of Shadows)'] }],
      subclasses: [
        { id: 'archfey', name: 'The Archfey', note: 'Fey Presence, Misty Escape, Beguiling Defenses, Dark Delirium.' },
        { id: 'fiend', name: 'The Fiend', note: 'Dark One’s Blessing, Dark One’s Own Luck, Fiendish Resilience, Hurl Through Hell.' },
        { id: 'greatold', name: 'The Great Old One', note: 'Awakened Mind, Entropic Ward, Thought Shield, Create Thrall.' }
      ],
      startEquip: ['Light crossbow + 20 bolts, or any simple weapon', 'Component pouch or arcane focus', 'Scholar’s or dungeoneer’s pack', 'Leather armor, any simple weapon, two daggers']
    },
    {
      id: 'wizard', name: 'Wizard', hitDie: 6, primary: ['int'], saves: ['int', 'wis'],
      armor: [], weapons: ['Dagger', 'Dart', 'Sling', 'Quarterstaff', 'Light crossbow'], tools: [],
      skillCount: 2, skillList: ['arcana', 'history', 'insight', 'investigation', 'medicine', 'religion'],
      asiLevels: ASI_5E, subclassLevel: 2,
      spellcasting: { ability: 'int', kind: 'full', prepares: true, cantripsByLevel: { 1: 3, 4: 4, 10: 5 } },
      features: {
        1: ['Spellcasting', 'Arcane Recovery'], 2: ['Arcane Tradition'], 18: ['Spell Mastery'], 20: ['Signature Spells']
      },
      subclasses: [
        { id: 'abjuration', name: 'School of Abjuration', note: 'Abjuration Savant, Arcane Ward, Projected Ward, Spell Resistance.' },
        { id: 'conjuration', name: 'School of Conjuration', note: 'Minor Conjuration, Benign Transposition, Durable Summons.' },
        { id: 'divination', name: 'School of Divination', note: 'Portent, Expert Divination, Third Eye, Greater Portent.' },
        { id: 'enchantment', name: 'School of Enchantment', note: 'Hypnotic Gaze, Instinctive Charm, Split Enchantment, Alter Memories.' },
        { id: 'evocation', name: 'School of Evocation', note: 'Sculpt Spells, Potent Cantrip, Empowered Evocation, Overchannel.' },
        { id: 'illusion', name: 'School of Illusion', note: 'Improved Minor Illusion, Malleable Illusions, Illusory Reality.' },
        { id: 'necromancy', name: 'School of Necromancy', note: 'Grim Harvest, Undead Thralls, Inured to Undeath, Command Undead.' },
        { id: 'transmutation', name: 'School of Transmutation', note: 'Minor Alchemy, Transmuter’s Stone, Shapechanger, Master Transmuter.' }
      ],
      startEquip: ['Quarterstaff or dagger', 'Component pouch or arcane focus', 'Scholar’s or explorer’s pack', 'Spellbook']
    }
  ],

  backgrounds: [
    { id: 'acolyte', name: 'Acolyte', skills: ['insight', 'religion'], tools: [], languages: 2, feature: 'Shelter of the Faithful', equip: ['Holy symbol', 'Prayer book', '5 sticks of incense', 'Vestments', 'Common clothes', '15 gp'] },
    { id: 'charlatan', name: 'Charlatan', skills: ['deception', 'sleight'], tools: ['Disguise kit', 'Forgery kit'], languages: 0, feature: 'False Identity', equip: ['Fine clothes', 'Disguise kit', 'Con tools', '15 gp'] },
    { id: 'criminal', name: 'Criminal', skills: ['deception', 'stealth'], tools: ['One gaming set', 'Thieves’ tools'], languages: 0, feature: 'Criminal Contact', equip: ['Crowbar', 'Dark common clothes with hood', '15 gp'] },
    { id: 'entertainer', name: 'Entertainer', skills: ['acrobatics', 'performance'], tools: ['Disguise kit', 'One instrument'], languages: 0, feature: 'By Popular Demand', equip: ['Musical instrument', 'Favor of an admirer', 'Costume', '15 gp'] },
    { id: 'folkhero', name: 'Folk Hero', skills: ['animal', 'survival'], tools: ['One artisan’s tools', 'Vehicles (land)'], languages: 0, feature: 'Rustic Hospitality', equip: ['Artisan’s tools', 'Shovel', 'Iron pot', 'Common clothes', '10 gp'] },
    { id: 'guild', name: 'Guild Artisan', skills: ['insight', 'persuasion'], tools: ['One artisan’s tools'], languages: 1, feature: 'Guild Membership', equip: ['Artisan’s tools', 'Letter of introduction', 'Traveler’s clothes', '15 gp'] },
    { id: 'hermit', name: 'Hermit', skills: ['medicine', 'religion'], tools: ['Herbalism kit'], languages: 1, feature: 'Discovery', equip: ['Scroll case of notes', 'Winter blanket', 'Common clothes', 'Herbalism kit', '5 gp'] },
    { id: 'noble', name: 'Noble', skills: ['history', 'persuasion'], tools: ['One gaming set'], languages: 1, feature: 'Position of Privilege', equip: ['Fine clothes', 'Signet ring', 'Scroll of pedigree', '25 gp'] },
    { id: 'outlander', name: 'Outlander', skills: ['athletics', 'survival'], tools: ['One instrument'], languages: 1, feature: 'Wanderer', equip: ['Staff', 'Hunting trap', 'Trophy from an animal', 'Traveler’s clothes', '10 gp'] },
    { id: 'sage', name: 'Sage', skills: ['arcana', 'history'], tools: [], languages: 2, feature: 'Researcher', equip: ['Bottle of black ink', 'Quill', 'Small knife', 'Letter from a colleague', 'Common clothes', '10 gp'] },
    { id: 'sailor', name: 'Sailor', skills: ['athletics', 'perception'], tools: ['Navigator’s tools', 'Vehicles (water)'], languages: 0, feature: 'Ship’s Passage', equip: ['Belaying pin (club)', '50 ft. silk rope', 'Lucky charm', 'Common clothes', '10 gp'] },
    { id: 'soldier', name: 'Soldier', skills: ['athletics', 'intimidation'], tools: ['One gaming set', 'Vehicles (land)'], languages: 0, feature: 'Military Rank', equip: ['Insignia of rank', 'Trophy from a fallen enemy', 'Dice or cards', 'Common clothes', '10 gp'] },
    { id: 'urchin', name: 'Urchin', skills: ['sleight', 'stealth'], tools: ['Disguise kit', 'Thieves’ tools'], languages: 0, feature: 'City Secrets', equip: ['Small knife', 'City map', 'Pet mouse', 'Token of your parents', 'Common clothes', '10 gp'] }
  ],

  armorList: [
    { name: 'None', ac: 10, type: 'none' },
    { name: 'Padded', ac: 11, type: 'light', stealthDis: true },
    { name: 'Leather', ac: 11, type: 'light' },
    { name: 'Studded Leather', ac: 12, type: 'light' },
    { name: 'Hide', ac: 12, type: 'medium' },
    { name: 'Chain Shirt', ac: 13, type: 'medium' },
    { name: 'Scale Mail', ac: 14, type: 'medium', stealthDis: true },
    { name: 'Breastplate', ac: 14, type: 'medium' },
    { name: 'Half Plate', ac: 15, type: 'medium', stealthDis: true },
    { name: 'Ring Mail', ac: 14, type: 'heavy', strReq: 0, stealthDis: true },
    { name: 'Chain Mail', ac: 16, type: 'heavy', strReq: 13, stealthDis: true },
    { name: 'Splint', ac: 17, type: 'heavy', strReq: 15, stealthDis: true },
    { name: 'Plate', ac: 18, type: 'heavy', strReq: 15, stealthDis: true }
  ],

  languages: ['Common', 'Dwarvish', 'Elvish', 'Giant', 'Gnomish', 'Goblin', 'Halfling', 'Orc', 'Abyssal', 'Celestial', 'Draconic', 'Deep Speech', 'Infernal', 'Primordial', 'Sylvan', 'Undercommon'],

  alignments: ['Lawful Good', 'Neutral Good', 'Chaotic Good', 'Lawful Neutral', 'Neutral', 'Chaotic Neutral', 'Lawful Evil', 'Neutral Evil', 'Chaotic Evil'],

  feats: [
    'Alert (+5 initiative, can’t be surprised while conscious)', 'Athlete', 'Actor', 'Charger',
    'Crossbow Expert', 'Defensive Duelist', 'Dual Wielder', 'Dungeon Delver', 'Durable',
    'Elemental Adept', 'Grappler', 'Great Weapon Master', 'Healer', 'Heavily Armored',
    'Heavy Armor Master', 'Inspiring Leader', 'Keen Mind', 'Lightly Armored', 'Linguist',
    'Lucky (3 luck points)', 'Mage Slayer', 'Magic Initiate', 'Martial Adept', 'Medium Armor Master',
    'Mobile (+10 speed)', 'Moderately Armored', 'Mounted Combatant', 'Observant', 'Polearm Master',
    'Resilient', 'Ritual Caster', 'Savage Attacker', 'Sentinel', 'Sharpshooter', 'Shield Master',
    'Skilled (3 skills/tools)', 'Skulker', 'Spell Sniper', 'Tavern Brawler', 'Tough (+2 HP/level)',
    'War Caster', 'Weapon Master'
  ],

  /* ---- derived stats ---- */
  derive(c) {
    const cls = byId(this.classes, c.classId);
    const lin = byId(this.lineages, c.lineageId);
    const sub = cls ? byId(cls.subclasses || [], c.subclassId) : null;
    const linSub = lin ? byId(lin.subs || [], c.lineageSubId) : null;
    const L = clamp(c.level || 1, 1, 20);
    const s = c.finalScores;
    const pb = profBonus5e(L);
    const out = { profBonus: pb, level: L, rows: [], skills: [], saves: [], features: [], notes: [] };

    // HP
    let hpPerLevel = 0, extra = 0;
    if (linSub && linSub.hpBonusPerLevel) extra += linSub.hpBonusPerLevel * L;
    if (sub && sub.hpBonusPerLevel) extra += sub.hpBonusPerLevel * L;
    const hd = cls ? cls.hitDie : 8;
    const conM = mod(s.con);
    if (c.hpMethod === 'roll' && Array.isArray(c.hpRolls)) {
      hpPerLevel = hd + conM + c.hpRolls.slice(0, L - 1).reduce((t, r) => t + r + conM, 0);
    } else {
      const avg = Math.floor(hd / 2) + 1;
      hpPerLevel = hd + conM + (L - 1) * (avg + conM);
    }
    out.hp = Math.max(L, hpPerLevel + extra);
    out.hitDice = L + 'd' + hd;

    // AC
    const armor = this.armorList.find(a => a.name === (c.armor || 'None')) || this.armorList[0];
    const dexM = mod(s.dex);
    let ac;
    if (armor.type === 'none' && cls && cls.unarmoredAC) {
      ac = 10 + dexM + mod(s[cls.unarmoredAC]);
      out.notes.push('Unarmored Defense: 10 + Dex + ' + ABIL_NAME[cls.unarmoredAC]);
    } else if (armor.type === 'heavy') ac = armor.ac;
    else if (armor.type === 'medium') ac = armor.ac + Math.min(2, dexM);
    else ac = armor.ac + dexM;
    if (c.shield) ac += 2;
    ac += Number(c.acBonus || 0);
    out.ac = ac;
    out.acNote = armor.name + (c.shield ? ' + shield' : '');
    if (armor.strReq && s.str < armor.strReq) out.notes.push('Speed −10 ft: ' + armor.name + ' requires Str ' + armor.strReq + '.');
    if (armor.stealthDis) out.notes.push('Disadvantage on Stealth from ' + armor.name + '.');

    // speed / init
    let sp = (linSub && linSub.speed) || (lin ? lin.speed : 30);
    if (armor.strReq && s.str < armor.strReq) sp -= 10;
    out.speed = sp;
    out.initiative = dexM;
    out.passivePerception = 10 + mod(s.wis) + (c.skills && c.skills.includes('perception') ? pb : 0) + (c.expertise && c.expertise.includes('perception') ? pb : 0);

    // saves
    ABIL6.forEach(a => {
      const prof = cls && cls.saves.includes(a);
      out.saves.push({ ability: a, name: ABIL_NAME[a], prof, value: mod(s[a]) + (prof ? pb : 0) });
    });

    // skills
    this.skills.forEach(sk => {
      const prof = (c.skills || []).includes(sk.id);
      const exp = (c.expertise || []).includes(sk.id);
      let v = mod(s[sk.ability]) + (exp ? pb * 2 : prof ? pb : 0);
      if (!prof && !exp && cls && cls.id === 'bard' && L >= 2) v += Math.floor(pb / 2);
      out.skills.push({ id: sk.id, name: sk.name, ability: sk.ability, prof, exp, value: v });
    });

    // spellcasting
    const scDef = (sub && sub.spellcasting) || (cls && cls.spellcasting);
    if (scDef) {
      const ab = scDef.ability;
      const effLevel = scDef.kind === 'third' ? L : L;
      out.spell = {
        ability: ABIL_NAME[ab],
        dc: 8 + pb + mod(s[ab]),
        attack: pb + mod(s[ab]),
        prepares: !!scDef.prepares,
        kind: scDef.kind
      };
      if (scDef.kind === 'pact') {
        const p = pactSlots(L);
        out.spell.pact = p;
        out.spell.slots = [];
        out.spell.note = p.count + ' slot' + (p.count > 1 ? 's' : '') + ' of level ' + p.level + ' (short rest), ' + p.invocations + ' invocation' + (p.invocations === 1 ? '' : 's');
      } else {
        out.spell.slots = slotsFor(scDef.kind, effLevel);
      }
      if (scDef.prepares) {
        const n = ab === 'wis' || ab === 'int' ? Math.max(1, L + mod(s[ab])) : null;
        if (n) out.spell.prepared = n;
      }
      if (scDef.cantripsByLevel) {
        let cn = 0;
        Object.keys(scDef.cantripsByLevel).forEach(k => { if (L >= +k) cn = scDef.cantripsByLevel[k]; });
        out.spell.cantrips = cn;
      }
    }

    // features by level
    if (cls) {
      Object.keys(cls.features).map(Number).sort((a, b) => a - b).forEach(lv => {
        if (lv <= L) cls.features[lv].forEach(f => out.features.push({ level: lv, text: f }));
      });
    }
    out.asiCount = cls ? cls.asiLevels.filter(l => l <= L).length : 0;

    // attack bonuses (assumes proficiency with the weapon)
    const extraAttacks = L >= 20 && cls && cls.id === 'fighter' ? 4 : L >= 11 && cls && cls.id === 'fighter' ? 3
      : L >= 5 && cls && ['fighter', 'barbarian', 'paladin', 'ranger', 'monk'].includes(cls.id) ? 2 : 1;
    out.attacks = [
      { name: 'Melee weapon (Str)', value: pb + mod(s.str), note: extraAttacks > 1 ? extraAttacks + ' attacks per action' : 'proficiency + Str' },
      { name: 'Ranged / finesse (Dex)', value: pb + mod(s.dex), note: extraAttacks > 1 ? extraAttacks + ' attacks per action' : 'proficiency + Dex' }
    ];
    if (cls && cls.unarmoredAC === 'wis') out.attacks.push({ name: 'Unarmed strike (martial arts)', value: pb + mod(s.dex), note: 'd' + (L >= 17 ? 10 : L >= 11 ? 8 : L >= 5 ? 6 : 4) + ' + Dex' });

    out.carry = carryCapacity5e(s.str, (lin && lin.size) || 'Medium');
    out.profRows = [
      { label: 'Armor', value: (cls && cls.armor.length ? cls.armor.join(', ') : 'None') },
      { label: 'Weapons', value: (cls ? cls.weapons.join(', ') : '—') },
      { label: 'Tools', value: [].concat(cls ? cls.tools : [], (byId(this.backgrounds, c.backgroundId) || {}).tools || []).join(', ') || 'None' },
      { label: 'Saving Throws', value: (cls ? cls.saves.map(a => ABIL_NAME[a]).join(', ') : '—') }
    ];
    return out;
  }
};
