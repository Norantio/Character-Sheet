/* ============================================================
   D&D 5e (2024) \u2014 \u201c5.5e\u201d core rules
   ------------------------------------------------------------
   Based on System Reference Document 5.2.1 \u00a9 2025 Wizards of the
   Coast LLC. Available under Creative Commons Attribution 4.0
   International (CC-BY-4.0).

   Key differences from 5e (2014):
   - Species no longer provide fixed ability score increases.
   - Backgrounds provide ability score increases (+2/+1 or +1/+1/+1).
     The player\u2019s assignment is stored in c.bgAsiAssign.
   - Two new species: Goliath, Orc. Half-Elf and Half-Orc are not
     in the 2024 core SRD.
   - Updated class features throughout.
   - New feats: Fighting Style feats, Ability Score Improvement feat,
     and seven Boon (epic) feats.
   - derive() is shared with SYS_5E \u2014 see bottom of this file.
   ============================================================ */

/* ASI level tables are the same as the 2014 edition. */
const ASI_55E = ASI_5E;
const ASI_55E_FIGHTER = ASI_5E_FIGHTER;
const ASI_55E_ROGUE = ASI_5E_ROGUE;

const SYS_55E = {
  id: '5.5e',
  name: 'D&D 5e (2024)',
  tag: '2024 core',
  blurb: 'Updated 5e rules. Background provides ability score increases. Revised classes and species.',
  maxLevel: 20,
  abilities: ABIL6,
  lineageLabel: 'Species',
  classLabel: 'Class',
  backgroundLabel: 'Background',
  subclassLabel: 'Subclass',

  /* Backgrounds provide +2/+1 (or +1/+1/+1) to ability scores instead of
     species. The player stores their choice in c.bgAsiAssign = { str:0, ... }.
     The engine reads this when backgroundAsi is true. */
  backgroundAsi: true,

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

  /* Species in 5.5e carry no fixed ASIs. Suggested ability score increases
     are listed in the background entries and assigned by the player. */
  lineages: [
    {
      id: 'dwarf', name: 'Dwarf', size: 'Medium', speed: 30, asi: {},
      languages: ['Common', 'Dwarvish'],
      traits: [
        { name: 'Darkvision', text: '120 ft.' },
        { name: 'Dwarven Resilience', text: 'Resistance to poison damage; advantage on saves vs. poison.' },
        { name: 'Dwarven Toughness', text: '+1 HP per level.' },
        { name: 'Stonecunning', text: 'Tremorsense 60 ft. for 10 min when on stone/metal; Proficiency Bonus uses per long rest.' },
        { name: 'Forge Wise', text: 'Proficiency with one artisan\u2019s tool of your choice.' }
      ],
      subs: [
        { id: 'hill', name: 'Hill Dwarf', asi: {}, traits: [] },
        { id: 'mountain', name: 'Mountain Dwarf', asi: {}, traits: [] }
      ]
    },
    {
      id: 'elf', name: 'Elf', size: 'Medium', speed: 30, asi: {},
      languages: ['Common', 'Elvish'],
      grantSkills: ['perception'],
      traits: [
        { name: 'Darkvision', text: '60 ft.' },
        { name: 'Keen Senses', text: 'Proficiency in Perception.' },
        { name: 'Fey Ancestry', text: 'Advantage on saves vs. charmed; magic can\u2019t put you to sleep.' },
        { name: 'Trance', text: 'Meditate 4 hours instead of sleeping 8.' }
      ],
      subs: [
        { id: 'high', name: 'High Elf', asi: {}, traits: [{ name: 'Elf Weapon Training', text: 'Longsword, shortsword, shortbow, longbow.' }, { name: 'Cantrip', text: 'One wizard cantrip, Intelligence-based.' }, { name: 'Extra Language', text: 'One extra language of your choice.' }] },
        { id: 'wood', name: 'Wood Elf', asi: {}, speed: 35, traits: [{ name: 'Elf Weapon Training', text: 'Longsword, shortsword, shortbow, longbow.' }, { name: 'Fleet of Foot', text: 'Base speed 35 ft.' }, { name: 'Mask of the Wild', text: 'Hide when lightly obscured by natural phenomena.' }] },
        { id: 'drow', name: 'Dark Elf (Drow)', asi: {}, traits: [{ name: 'Superior Darkvision', text: '120 ft.' }, { name: 'Sunlight Sensitivity', text: 'Disadvantage on attacks and Perception in direct sunlight.' }, { name: 'Drow Magic', text: 'Dancing Lights; Faerie Fire at 3rd; Darkness at 5th (Cha).' }, { name: 'Drow Weapon Training', text: 'Rapier, shortsword, hand crossbow.' }] }
      ]
    },
    {
      id: 'halfling', name: 'Halfling', size: 'Small', speed: 30, asi: {},
      languages: ['Common', 'Halfling'],
      traits: [
        { name: 'Lucky', text: 'Reroll a 1 on an attack, check, or save.' },
        { name: 'Brave', text: 'Advantage on saves vs. frightened.' },
        { name: 'Halfling Nimbleness', text: 'Move through the space of larger creatures.' },
        { name: 'Naturally Stealthy', text: 'Hide behind a creature one size larger.' }
      ], subs: []
    },
    {
      id: 'human', name: 'Human', size: 'Medium', speed: 30, asi: {},
      languages: ['Common'], extraLanguages: 1,
      traits: [
        { name: 'Resourceful', text: 'Heroic Inspiration whenever you finish a long rest.' },
        { name: 'Skillful', text: 'Proficiency in one skill of your choice.' },
        { name: 'Versatile', text: 'Choose one Origin feat.' }
      ], subs: []
    },
    {
      id: 'dragonborn', name: 'Dragonborn', size: 'Medium', speed: 30, asi: {},
      languages: ['Common', 'Draconic'],
      choice: { key: 'ancestry', label: 'Draconic Ancestry', options: ['Black (acid, 5x30 line, Dex)', 'Blue (lightning, 5x30 line, Dex)', 'Brass (fire, 5x30 line, Dex)', 'Bronze (lightning, 5x30 line, Dex)', 'Copper (acid, 5x30 line, Dex)', 'Gold (fire, 15 cone, Dex)', 'Green (poison, 15 cone, Con)', 'Red (fire, 15 cone, Dex)', 'Silver (cold, 15 cone, Con)', 'White (cold, 15 cone, Con)'] },
      traits: [
        { name: 'Breath Weapon', text: '1d10 + prof bonus damage (scales), DC 8 + Con + prof.' },
        { name: 'Damage Resistance', text: 'Resistance to your ancestry\u2019s damage type.' },
        { name: 'Draconic Flight', text: 'At 5th level: fly speed equal to your walking speed (no armor).' }
      ], subs: []
    },
    {
      id: 'gnome', name: 'Gnome', size: 'Small', speed: 30, asi: {},
      languages: ['Common', 'Gnomish'],
      traits: [
        { name: 'Darkvision', text: '60 ft.' },
        { name: 'Gnomish Cunning', text: 'Advantage on Int, Wis, and Cha saves.' },
        { name: 'Gnomish Lineage', text: 'Choose: Forest Gnome (Minor Illusion cantrip; speak with animals 1/day) or Rock Gnome (Prestidigitation cantrip; Tinker feature).' }
      ], subs: []
    },
    {
      id: 'goliath', name: 'Goliath', size: 'Medium', speed: 35, asi: {},
      languages: ['Common', 'Giant'],
      traits: [
        { name: 'Giant Ancestry', text: 'Choose one giant type for a magical benefit usable once per long rest: Cloud (Misty Step), Fire (d6 fire burst 15-ft), Frost (Cold Resistance), Hill (knock Prone), Stone (Petrified 1 round), Storm (Fly speed 10 ft/turn for 1 min).' },
        { name: 'Large Form', text: 'Bonus Action to become Large until end of turn; Proficiency Bonus uses per long rest.' },
        { name: 'Powerful Build', text: 'Count as Large for carrying capacity and push/drag/lift.' }
      ], subs: []
    },
    {
      id: 'orc', name: 'Orc', size: 'Medium', speed: 30, asi: {},
      languages: ['Common', 'Orc'],
      grantSkills: ['intimidation'],
      traits: [
        { name: 'Adrenaline Rush', text: 'Bonus Action: Dash and gain THP equal to Proficiency Bonus; Proficiency Bonus uses per long rest.' },
        { name: 'Darkvision', text: '120 ft.' },
        { name: 'Relentless Endurance', text: 'Drop to 1 HP instead of 0 once per long rest.' }
      ], subs: []
    },
    {
      id: 'tiefling', name: 'Tiefling', size: 'Medium', speed: 30, asi: {},
      languages: ['Common', 'Infernal'],
      traits: [
        { name: 'Darkvision', text: '60 ft.' },
        { name: 'Hellish Resistance', text: 'Resistance to fire damage.' },
        { name: 'Fiendish Legacy', text: 'Choose Abyssal, Chthonic, or Infernal lineage. Each grants two spells at 1st and 3rd level. Spells use Int, Wis, or Cha (your choice).' }
      ], subs: []
    }
  ],

  classes: [
    {
      id: 'barbarian', name: 'Barbarian', hitDie: 12, primary: ['str'], saves: ['str', 'con'],
      armor: ['Light', 'Medium', 'Shields'], weapons: ['Simple', 'Martial'], tools: [],
      skillCount: 2, skillList: ['animal', 'athletics', 'intimidation', 'nature', 'perception', 'survival'],
      asiLevels: ASI_55E, subclassLevel: 3, unarmoredAC: 'con',
      features: {
        1: ['Rage (uses = Prof Bonus; +2 damage; resist B/P/S)', 'Unarmored Defense (10 + Dex + Con)', 'Weapon Mastery (2 weapons)'],
        2: ['Reckless Attack', 'Danger Sense'],
        3: ['Primal Knowledge', 'Primal Path'],
        5: ['Extra Attack', 'Fast Movement (+10 ft.)', 'Weapon Mastery +1'],
        7: ['Feral Instinct', 'Instinctive Pounce'],
        9: ['Brutal Strike (1d10 extra, replaces Brutal Critical)', 'Primal Knowledge +1 skill'],
        11: ['Relentless Rage', 'Brutal Strike +1d10'],
        13: ['Brutal Strike 2 effects'],
        15: ['Persistent Rage', 'Improved Brutal Strike'],
        17: ['Brutal Strike +2d10', 'Weapon Mastery +1'],
        18: ['Indomitable Might'],
        20: ['Primal Champion (+4 Str and Con, max 25)']
      },
      subclasses: [
        { id: 'berserker', name: 'Path of the Berserker', note: 'Frenzy (Mindless Rage), Retaliation.' },
        { id: 'totem', name: 'Path of the Totem Warrior', note: 'Spirit Seeker, Totem Spirit (bear/eagle/wolf), Aspect of the Beast.' }
      ],
      startEquip: ["Greataxe or any martial melee weapon", "Two handaxes or any simple weapon", "Explorer's pack", "Four javelins"]
    },
    {
      id: 'bard', name: 'Bard', hitDie: 8, primary: ['cha'], saves: ['dex', 'cha'],
      armor: ['Light'], weapons: ['Simple', 'Hand crossbow', 'Longsword', 'Rapier', 'Shortsword'], tools: ['Three musical instruments'],
      skillCount: 3, skillList: 'any', asiLevels: ASI_55E, subclassLevel: 3,
      spellcasting: { ability: 'cha', kind: 'full', prepares: false, cantripsByLevel: { 1: 2, 4: 3, 10: 4 } },
      features: {
        1: ['Spellcasting', 'Bardic Inspiration (Cha mod uses/long rest, d6)'],
        2: ['Expertise (2 skills)', 'Jack of All Trades'],
        3: ['Bard Subclass'],
        5: ['Bardic Inspiration (d8)', 'Font of Inspiration (short rest recovery)'],
        7: ['Countercharm'],
        9: ['Expertise (2 more)'],
        10: ['Bardic Inspiration (d10)', 'Magical Secrets'],
        15: ['Bardic Inspiration (d12)'],
        18: ['Superior Bardic Inspiration'],
        20: ['Words of Creation']
      },
      subclasses: [
        { id: 'lore', name: 'College of Lore', note: 'Bonus proficiencies, Cutting Words, Additional Magical Secrets.' },
        { id: 'valor', name: 'College of Valor', note: 'Medium armor/shield/martial weapons, Combat Inspiration, Extra Attack.' }
      ],
      startEquip: ["Rapier, longsword, or any simple weapon", "Diplomat's or entertainer's pack", "Lute or other instrument", "Leather armor", "Dagger"]
    },
    {
      id: 'cleric', name: 'Cleric', hitDie: 8, primary: ['wis'], saves: ['wis', 'cha'],
      armor: ['Light', 'Medium', 'Shields'], weapons: ['Simple'], tools: [],
      skillCount: 2, skillList: ['history', 'insight', 'medicine', 'persuasion', 'religion'],
      asiLevels: ASI_55E, subclassLevel: 3,
      spellcasting: { ability: 'wis', kind: 'full', prepares: true, cantripsByLevel: { 1: 3, 4: 4, 10: 5 } },
      features: {
        1: ['Spellcasting (prepare from entire list)', 'Divine Order (Protector or Thaumaturge)'],
        2: ['Channel Divinity (2 uses)', 'Turn Undead', 'Divine Spark'],
        5: ['Smite Undead (destroy threshold CR 1/2)'],
        6: ['Channel Divinity (3 uses)'],
        8: ['Blessed Strikes'],
        9: ['Commune (1/long rest)'],
        10: ['Divine Intervention'],
        11: ['Destroy Undead (CR 1)'],
        14: ['Destroy Undead (CR 2)'],
        17: ['Destroy Undead (CR 3)', 'Domain feature'],
        18: ['Channel Divinity (4 uses)'],
        20: ['Greater Divine Intervention']
      },
      subclasses: [
        { id: 'life', name: 'Life Domain', note: 'Heavy armor, Disciple of Life, Preserve Life, Blessed Healer.' },
        { id: 'light', name: 'Light Domain', note: 'Light cantrip, Warding Flare, Radiance of the Dawn.' },
        { id: 'trickery', name: 'Trickery Domain', note: 'Blessing of the Trickster, Invoke Duplicity.' },
        { id: 'war', name: 'War Domain', note: 'Heavy armor, martial weapons, War Priest.' }
      ],
      startEquip: ["Mace or warhammer (if proficient)", "Scale mail, leather, or chain mail", "Light crossbow + 20 bolts or any simple weapon", "Priest's pack", "Shield and holy symbol"]
    },
    {
      id: 'druid', name: 'Druid', hitDie: 8, primary: ['wis'], saves: ['int', 'wis'],
      armor: ['Light', 'Medium', 'Shields (nonmetal)'], weapons: ['Club', 'Dagger', 'Dart', 'Javelin', 'Mace', 'Quarterstaff', 'Scimitar', 'Sickle', 'Sling', 'Spear'], tools: ['Herbalism kit'],
      skillCount: 2, skillList: ['arcana', 'animal', 'insight', 'medicine', 'nature', 'perception', 'religion', 'survival'],
      asiLevels: ASI_55E, subclassLevel: 2,
      spellcasting: { ability: 'wis', kind: 'full', prepares: true, cantripsByLevel: { 1: 2, 4: 3, 10: 4 } },
      features: {
        1: ['Primal Order (Magician or Warden)', 'Spellcasting'],
        2: ['Wild Shape (CR 1/4 beasts)', 'Wild Companion (Find Familiar 1/long rest)'],
        4: ['Wild Shape (CR 1/2, swim)'],
        8: ['Wild Shape (CR 1, fly)'],
        9: ['Wild Resurgence (use slot for Wild Shape, or vice versa)'],
        18: ['Timeless Body', 'Beast Spells'],
        20: ['Archdruid (unlimited Wild Shape; natural armor 20)']
      },
      subclasses: [
        { id: 'land', name: 'Circle of the Land', note: "Natural Recovery, Circle Spells, Land's Stride, Nature's Ward." },
        { id: 'moon', name: 'Circle of the Moon', note: 'Combat Wild Shape (d6 heal as Bonus Action, higher CR beasts), Primal Strike.' }
      ],
      startEquip: ["Wooden shield or any simple weapon", "Scimitar or any simple melee weapon", "Leather armor", "Explorer's pack", "Druidic focus"]
    },
    {
      id: 'fighter', name: 'Fighter', hitDie: 10, primary: ['str', 'dex'], saves: ['str', 'con'],
      armor: ['All armor', 'Shields'], weapons: ['Simple', 'Martial'], tools: [],
      skillCount: 2, skillList: ['acrobatics', 'animal', 'athletics', 'history', 'insight', 'intimidation', 'perception', 'survival'],
      asiLevels: ASI_55E_FIGHTER, subclassLevel: 3,
      features: {
        1: ['Fighting Style (feat of choice)', 'Second Wind', 'Weapon Mastery (3 weapons)'],
        2: ['Action Surge (1 use)', 'Tactical Mind (d10 on failed ability check)'],
        3: ['Martial Archetype', 'Weapon Mastery +1'],
        5: ['Extra Attack', 'Tactical Shift (rearrange conditions on Action Surge)'],
        9: ['Indomitable (1 use)', 'Master of Armaments (regain Weapon Mastery on short rest)'],
        11: ['Two Extra Attacks', 'Studied Attacks (advantage after miss)'],
        13: ['Indomitable (2 uses)'],
        17: ['Action Surge (2 uses)', 'Indomitable (3 uses)'],
        20: ['Three Extra Attacks', 'Weapon Mastery (all martial weapons)']
      },
      choices: [{ key: 'fightingStyle', label: 'Fighting Style feat', options: ['Archery (+2 ranged attack)', 'Defense (+1 AC in armor)', 'Dueling (+2 melee damage, one-handed)', 'Great Weapon Fighting (reroll 1s/2s, two-handed)', 'Protection (impose disadvantage w/ shield reaction)', 'Two-Weapon Fighting (add ability mod to off-hand)'] }],
      subclasses: [
        { id: 'champion', name: 'Champion', note: 'Improved Critical, Remarkable Athlete, Superior Critical, Survivor.' },
        { id: 'battlemaster', name: 'Battle Master', note: 'Combat Superiority, maneuvers, superiority dice, Know Your Enemy.' },
        { id: 'eldritch', name: 'Eldritch Knight', note: 'Third-caster (wizard), Weapon Bond, War Magic, Eldritch Strike.', spellcasting: { ability: 'int', kind: 'third' } }
      ],
      startEquip: ["Chain mail or leather + longbow + 20 arrows", "Martial weapon and shield, or two martial weapons", "Light crossbow + 20 bolts, or two handaxes", "Dungeoneer's or explorer's pack"]
    },
    {
      id: 'monk', name: 'Monk', hitDie: 8, primary: ['dex', 'wis'], saves: ['str', 'dex'],
      armor: [], weapons: ['Simple', 'Shortsword'], tools: ["One artisan's tool or instrument"],
      skillCount: 2, skillList: ['acrobatics', 'athletics', 'history', 'insight', 'religion', 'stealth'],
      asiLevels: ASI_55E, subclassLevel: 3, unarmoredAC: 'wis',
      features: {
        1: ['Martial Arts (d6)', 'Unarmored Defense (10 + Dex + Wis)'],
        2: ["Monk's Focus (Discipline Points = level; Flurry/Patient Defense/Step of Wind)", 'Unarmored Movement +10', 'Uncanny Metabolism'],
        3: ['Monastic Tradition', 'Deflect Attacks (reduce damage; catch and throw projectiles)'],
        4: ['Slow Fall'],
        5: ['Extra Attack', 'Stunning Strike', 'Martial Arts d8'],
        6: ['Empowered Strikes (Radiant or Necrotic option)', 'Unarmored Movement +15'],
        7: ['Evasion', 'Stillness of Mind'],
        10: ["Self-Restoration (end one condition per long rest)", 'Unarmored Movement +20'],
        11: ['Martial Arts d10'],
        13: ['Tongue of the Sun and Moon'],
        14: ['Diamond Soul', 'Unarmored Movement +25'],
        15: ['Timeless Body'],
        17: ['Martial Arts d12'],
        18: ['Superior Defense (resistance B/P/S in Unarmored Defense)', 'Unarmored Movement +30'],
        20: ['Body and Mind (+4 Dex and Wis, max 25)']
      },
      subclasses: [
        { id: 'open', name: 'Warrior of the Open Hand', note: 'Open Hand Technique, Wholeness of Body, Fleet Step, Quivering Palm.' },
        { id: 'shadow', name: 'Warrior of Shadow', note: 'Shadow Arts, Shadow Step, Cloak of Shadows, Opportunist.' },
        { id: 'element', name: 'Warrior of the Elements', note: 'Elemental Attunement, Manipulate Elements, Elemental Burst.' }
      ],
      startEquip: ["Shortsword or any simple weapon", "Dungeoneer's or explorer's pack", "5 darts"]
    },
    {
      id: 'paladin', name: 'Paladin', hitDie: 10, primary: ['str', 'cha'], saves: ['wis', 'cha'],
      armor: ['All armor', 'Shields'], weapons: ['Simple', 'Martial'], tools: [],
      skillCount: 2, skillList: ['athletics', 'insight', 'intimidation', 'medicine', 'persuasion', 'religion'],
      asiLevels: ASI_55E, subclassLevel: 3,
      spellcasting: { ability: 'cha', kind: 'half', prepares: true },
      features: {
        1: ['Divine Sense', 'Lay on Hands (5 \u00d7 level HP pool)'],
        2: ["Fighting Style (feat)", "Paladin's Smite (Divine Smite as a spell)", 'Spellcasting', 'Weapon Mastery (3)'],
        3: ['Channel Divinity (2 uses)', 'Sacred Oath'],
        5: ['Extra Attack', 'Faithful Steed (Find Steed 1/long rest)'],
        6: ['Aura of Protection (Cha mod to saves, 10 ft.)'],
        9: ['Abjure Foes (Channel Divinity: Frightened/Incapacitated)'],
        10: ['Aura of Courage (immune frightened)'],
        11: ['Radiant Strikes (+1d8 radiant on weapon attacks)'],
        14: ["Restoring Touch (remove condition with Lay on Hands, costs 5 HP)"],
        18: ['Aura improvements (30 ft.)'],
        20: ['Aura Expansion']
      },
      choices: [{ key: 'fightingStyle', label: 'Fighting Style feat (2nd level)', options: ['Defense', 'Dueling', 'Great Weapon Fighting', 'Protection', 'Blessed Warrior (cantrip)', 'Blind Fighting (10 ft. Blindsight)'] }],
      subclasses: [
        { id: 'devotion', name: 'Oath of Devotion', note: 'Sacred Weapon, Holy Nimbus, Aura of Devotion.' },
        { id: 'ancients', name: 'Oath of the Ancients', note: "Nature's Wrath, Turn the Faithless, Aura of Warding, Elder Champion." },
        { id: 'vengeance', name: 'Oath of Vengeance', note: 'Vow of Enmity, Relentless Avenger, Soul of Vengeance, Avenging Angel.' }
      ],
      startEquip: ["Martial weapon and shield, or two martial weapons", "Five javelins or any simple melee weapon", "Priest's pack", "Chain mail and holy symbol"]
    },
    {
      id: 'ranger', name: 'Ranger', hitDie: 10, primary: ['dex', 'wis'], saves: ['str', 'dex'],
      armor: ['Light', 'Medium', 'Shields'], weapons: ['Simple', 'Martial'], tools: [],
      skillCount: 3, skillList: ['animal', 'athletics', 'insight', 'investigation', 'nature', 'perception', 'stealth', 'survival'],
      asiLevels: ASI_55E, subclassLevel: 3,
      spellcasting: { ability: 'wis', kind: 'half', prepares: false },
      features: {
        1: ['Expertise (2 skills)', "Favored Enemy (Hunter's Mark once free per long rest)", 'Weapon Mastery (2)'],
        2: ['Deft Explorer (Expertise, languages)', 'Fighting Style (feat)', 'Spellcasting'],
        3: ['Ranger Archetype', 'Roving (+5 ft. speed, Climb and Swim)'],
        4: ['Weapon Mastery +1'],
        5: ['Extra Attack', 'Tireless (d8 THP; Wis mod uses per long rest)'],
        6: ['Deft Explorer improvement'],
        8: ['Conjure Barrage (3rd-level spell)'],
        14: ['Precise Hunter'],
        15: ['Feral Senses'],
        18: ["Foe Slayer (add Wis to attack or damage 1/turn vs. Hunter's Mark target)"],
        20: ['Epic Boon']
      },
      choices: [{ key: 'fightingStyle', label: 'Fighting Style feat (2nd level)', options: ['Archery', 'Defense', 'Druidic Warrior (2 druid cantrips)', 'Thrown Weapon Fighting'] }],
      subclasses: [
        { id: 'hunter', name: 'Hunter', note: "Hunter's Prey, Defensive Tactics, Multiattack, Superior Hunter's Defense." },
        { id: 'beastmaster', name: 'Beast Master', note: 'Primal Companion (beast stat block), Exceptional Training, Bestial Fury, Share Spells.' }
      ],
      startEquip: ["Scale mail or leather armor", "Two shortswords or two simple melee weapons", "Dungeoneer's or explorer's pack", "Longbow and quiver of 20 arrows"]
    },
    {
      id: 'rogue', name: 'Rogue', hitDie: 8, primary: ['dex'], saves: ['dex', 'int'],
      armor: ['Light'], weapons: ['Simple', 'Hand crossbow', 'Longsword', 'Rapier', 'Shortsword'], tools: ["Thieves' tools"],
      skillCount: 4, skillList: ['acrobatics', 'athletics', 'deception', 'insight', 'intimidation', 'investigation', 'perception', 'performance', 'persuasion', 'sleight', 'stealth'],
      asiLevels: ASI_55E_ROGUE, subclassLevel: 3, expertise: { level: 1, count: 2 },
      features: {
        1: ['Expertise (2 skills)', 'Sneak Attack (1d6)', "Thieves' Cant (+Initiative bonus)", 'Weapon Mastery (2)'],
        2: ['Cunning Action', 'Cunning Strike (conditions on Sneak Attack)'],
        3: ['Roguish Archetype', 'Sneak Attack 2d6', 'Steady Aim (Bonus Action for advantage)'],
        5: ['Uncanny Dodge', 'Sneak Attack 3d6'],
        6: ['Expertise (2 more)'],
        7: ['Evasion', 'Sneak Attack 4d6'],
        11: ['Reliable Talent'],
        14: ['Slippery Mind (proficiency in Wis saves)'],
        15: ['Elusive (no advantage against you unless incapacitated)'],
        18: ['Stroke of Luck (treat any d20 as 20, 1/short rest)'],
        20: ['Sneak Attack 10d6', 'Epic Boon']
      },
      subclasses: [
        { id: 'thief', name: 'Thief', note: "Fast Hands, Second-Story Work, Supreme Sneak, Thief's Reflexes." },
        { id: 'assassin', name: 'Assassin', note: 'Assassinate, Infiltration Expertise, Impostor, Death Strike.' },
        { id: 'trickster', name: 'Arcane Trickster', note: 'Third-caster (wizard illusion/enchantment), Mage Hand Legerdemain.', spellcasting: { ability: 'int', kind: 'third' } }
      ],
      startEquip: ["Rapier or shortsword", "Shortbow + 20 arrows, or shortsword", "Burglar's, dungeoneer's, or explorer's pack", "Leather armor, two daggers, thieves' tools"]
    },
    {
      id: 'sorcerer', name: 'Sorcerer', hitDie: 6, primary: ['cha'], saves: ['con', 'cha'],
      armor: [], weapons: ['Dagger', 'Dart', 'Sling', 'Quarterstaff', 'Light crossbow'], tools: [],
      skillCount: 2, skillList: ['arcana', 'deception', 'insight', 'intimidation', 'persuasion', 'religion'],
      asiLevels: ASI_55E, subclassLevel: 1,
      spellcasting: { ability: 'cha', kind: 'full', prepares: false, cantripsByLevel: { 1: 4, 4: 5, 10: 6 } },
      features: {
        1: ['Spellcasting', 'Innate Sorcery (Cha mod/long rest; advantage on Concentration saves and spell attacks)', 'Sorcerous Origin'],
        2: ['Font of Magic (sorcery points = level)'],
        3: ['Metamagic (2 options)'],
        5: ['Sorcerous Restoration (regain 4 points per short rest)'],
        7: ['Innate Sorcery improvement'],
        10: ['Metamagic (3rd option)'],
        17: ['Metamagic (4th option)'],
        20: ['Arcane Apotheosis (cast signature spell without slot; Cha mod/long rest)']
      },
      subclasses: [
        { id: 'draconic', name: 'Draconic Sorcery', note: 'Dragon Ancestor, Draconic Resilience (+HP/level, AC 13+Dex), Dragon Wings.', hpBonusPerLevel: 1 },
        { id: 'wild', name: 'Wild Magic Sorcery', note: 'Wild Magic Surge, Tides of Chaos, Bend Luck, Unstable Backlash, Wild Bombardment.' }
      ],
      startEquip: ["Light crossbow + 20 bolts, or any simple weapon", "Component pouch or arcane focus", "Dungeoneer's or explorer's pack", "Two daggers"]
    },
    {
      id: 'warlock', name: 'Warlock', hitDie: 8, primary: ['cha'], saves: ['wis', 'cha'],
      armor: ['Light'], weapons: ['Simple'], tools: [],
      skillCount: 2, skillList: ['arcana', 'deception', 'history', 'intimidation', 'investigation', 'nature', 'religion'],
      asiLevels: ASI_55E, subclassLevel: 1,
      spellcasting: { ability: 'cha', kind: 'pact', prepares: false, cantripsByLevel: { 1: 2, 4: 3, 10: 4 } },
      features: {
        1: ['Eldritch Invocations (1)', 'Otherworldly Patron', 'Pact Magic (short or long rest recovery)'],
        2: ['Eldritch Invocations (3)', 'Magical Cunning (regain half Pact slots 1/long rest)'],
        3: ['Eldritch Invocations (4)', 'Pact Boon'],
        5: ['Eldritch Invocations (5, Boon unlocked)'],
        9: ['Contact Patron (Commune once per long rest)'],
        11: ['Mystic Arcanum (6th)'], 13: ['Mystic Arcanum (7th)'],
        15: ['Mystic Arcanum (8th)'], 17: ['Mystic Arcanum (9th)'],
        20: ['Eldritch Master (recover all Pact slots 1/long rest as action)']
      },
      choices: [{ key: 'pactBoon', label: 'Pact Boon (3rd level)', options: ["Pact of the Blade (summon weapon; melee with Cha)", "Pact of the Chain (familiar; touch delivery)", "Pact of the Talisman (skill add d4; hand it off)", "Pact of the Tome (3 cantrips + extra)"] }],
      subclasses: [
        { id: 'archfey', name: 'The Archfey', note: 'Fey Presence, Misty Escape, Beguiling Defenses, Dark Delirium.' },
        { id: 'fiend', name: 'The Fiend', note: "Dark One's Blessing, Dark One's Own Luck, Fiendish Resilience, Hurl Through Hell." },
        { id: 'greatold', name: 'The Great Old One', note: 'Awakened Mind, Entropic Ward, Thought Shield, Create Thrall.' }
      ],
      startEquip: ["Light crossbow + 20 bolts, or any simple weapon", "Component pouch or arcane focus", "Scholar's or dungeoneer's pack", "Leather armor, any simple weapon, two daggers"]
    },
    {
      id: 'wizard', name: 'Wizard', hitDie: 6, primary: ['int'], saves: ['int', 'wis'],
      armor: [], weapons: ['Dagger', 'Dart', 'Sling', 'Quarterstaff', 'Light crossbow'], tools: [],
      skillCount: 2, skillList: ['arcana', 'history', 'insight', 'investigation', 'medicine', 'religion'],
      asiLevels: ASI_55E, subclassLevel: 2,
      spellcasting: { ability: 'int', kind: 'full', prepares: true, cantripsByLevel: { 1: 3, 4: 4, 10: 5 } },
      features: {
        1: ['Arcane Recovery', 'Spellcasting', 'Ritual Adept (cast rituals without preparing)'],
        2: ['Arcane Tradition (Subclass)', 'Scholar (Arcana or History expertise)'],
        5: ['Memorize Spell (cast one prepared spell free 1/long rest)'],
        18: ['Spell Mastery (cast two spells without slots)'],
        20: ["Signature Spells (two 3rd-level spells free per short rest)"]
      },
      subclasses: [
        { id: 'abjuration', name: 'Abjurer', note: 'Abjuration Savant, Arcane Ward, Projected Ward, Spell Resistance.' },
        { id: 'conjuration', name: 'Conjurer', note: 'Minor Conjuration, Benign Transposition, Focused Conjuration, Durable Summons.' },
        { id: 'divination', name: 'Diviner', note: 'Portent, Expert Divination, Third Eye, Greater Portent.' },
        { id: 'enchantment', name: 'Enchanter', note: 'Hypnotic Gaze, Instinctive Charm, Split Enchantment, Alter Memories.' },
        { id: 'evocation', name: 'Evoker', note: 'Sculpt Spells, Potent Cantrip, Empowered Evocation, Overchannel.' },
        { id: 'illusion', name: 'Illusionist', note: 'Improved Minor Illusion, Malleable Illusions, Illusory Self, Illusory Reality.' },
        { id: 'necromancy', name: 'Necromancer', note: 'Grim Harvest, Undead Thralls, Inured to Undeath, Command Undead.' },
        { id: 'transmutation', name: 'Transmuter', note: "Minor Alchemy, Transmuter's Stone, Shapechanger, Master Transmuter." }
      ],
      startEquip: ["Quarterstaff or dagger", "Component pouch or arcane focus", "Scholar's or explorer's pack", "Spellbook"]
    }
  ],

  /* Backgrounds in 5.5e provide ability score increases. suggestedAsi is
     advisory; the player records their actual choice in c.bgAsiAssign. */
  backgrounds: [
    { id: 'acolyte', name: 'Acolyte', skills: ['insight', 'religion'], tools: [], languages: 2, feature: 'Shelter of the Faithful', suggestedAsi: { wis: 2, int: 1 }, equip: ['Holy symbol', 'Prayer book', '5 sticks of incense', 'Vestments', 'Common clothes', '15 gp'] },
    { id: 'charlatan', name: 'Charlatan', skills: ['deception', 'sleight'], tools: ['Disguise kit', 'Forgery kit'], languages: 0, feature: 'False Identity', suggestedAsi: { cha: 2, dex: 1 }, equip: ['Fine clothes', 'Disguise kit', 'Con tools', '15 gp'] },
    { id: 'criminal', name: 'Criminal', skills: ['deception', 'stealth'], tools: ['One gaming set', "Thieves' tools"], languages: 0, feature: 'Criminal Contact', suggestedAsi: { dex: 2, int: 1 }, equip: ['Crowbar', 'Dark common clothes with hood', '15 gp'] },
    { id: 'entertainer', name: 'Entertainer', skills: ['acrobatics', 'performance'], tools: ['Disguise kit', 'One instrument'], languages: 0, feature: 'By Popular Demand', suggestedAsi: { cha: 2, dex: 1 }, equip: ['Musical instrument', 'Favor of an admirer', 'Costume', '15 gp'] },
    { id: 'folkhero', name: 'Folk Hero', skills: ['animal', 'survival'], tools: ["One artisan's tools", 'Vehicles (land)'], languages: 0, feature: 'Rustic Hospitality', suggestedAsi: { con: 2, str: 1 }, equip: ["Artisan's tools", 'Shovel', 'Iron pot', 'Common clothes', '10 gp'] },
    { id: 'guild', name: 'Guild Artisan', skills: ['insight', 'persuasion'], tools: ["One artisan's tools"], languages: 1, feature: 'Guild Membership', suggestedAsi: { int: 2, cha: 1 }, equip: ["Artisan's tools", 'Letter of introduction', "Traveler's clothes", '15 gp'] },
    { id: 'hermit', name: 'Hermit', skills: ['medicine', 'religion'], tools: ['Herbalism kit'], languages: 1, feature: 'Discovery', suggestedAsi: { wis: 2, con: 1 }, equip: ['Scroll case of notes', 'Winter blanket', 'Common clothes', 'Herbalism kit', '5 gp'] },
    { id: 'noble', name: 'Noble', skills: ['history', 'persuasion'], tools: ['One gaming set'], languages: 1, feature: 'Position of Privilege', suggestedAsi: { cha: 2, int: 1 }, equip: ['Fine clothes', 'Signet ring', 'Scroll of pedigree', '25 gp'] },
    { id: 'outlander', name: 'Outlander', skills: ['athletics', 'survival'], tools: ['One instrument'], languages: 1, feature: 'Wanderer', suggestedAsi: { str: 2, wis: 1 }, equip: ['Staff', 'Hunting trap', 'Trophy from an animal', "Traveler's clothes", '10 gp'] },
    { id: 'sage', name: 'Sage', skills: ['arcana', 'history'], tools: [], languages: 2, feature: 'Researcher', suggestedAsi: { int: 2, wis: 1 }, equip: ['Bottle of black ink', 'Quill', 'Small knife', 'Letter from a colleague', 'Common clothes', '10 gp'] },
    { id: 'sailor', name: 'Sailor', skills: ['athletics', 'perception'], tools: ["Navigator's tools", 'Vehicles (water)'], languages: 0, feature: "Ship's Passage", suggestedAsi: { dex: 2, wis: 1 }, equip: ['Belaying pin (club)', '50 ft. silk rope', 'Lucky charm', 'Common clothes', '10 gp'] },
    { id: 'soldier', name: 'Soldier', skills: ['athletics', 'intimidation'], tools: ['One gaming set', 'Vehicles (land)'], languages: 0, feature: 'Military Rank', suggestedAsi: { str: 2, con: 1 }, equip: ['Insignia of rank', 'Trophy from a fallen enemy', 'Dice or cards', 'Common clothes', '10 gp'] },
    { id: 'urchin', name: 'Urchin', skills: ['sleight', 'stealth'], tools: ['Disguise kit', "Thieves' tools"], languages: 0, feature: 'City Secrets', suggestedAsi: { dex: 2, int: 1 }, equip: ['Small knife', 'City map', 'Pet mouse', 'Token of your parents', 'Common clothes', '10 gp'] }
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
    'Ability Score Improvement (+2 to one ability, or +1 to two)',
    'Alert (+5 initiative, no Surprised condition)',
    'Athlete', 'Actor', 'Charger', 'Crossbow Expert',
    'Defensive Duelist', 'Dual Wielder', 'Dungeon Delver', 'Durable',
    'Elemental Adept', 'Grappler', 'Great Weapon Master', 'Healer',
    'Heavily Armored', 'Heavy Armor Master', 'Inspiring Leader',
    'Keen Mind', 'Lightly Armored', 'Linguist',
    'Lucky (3 luck points)', 'Mage Slayer', 'Magic Initiate (choose a class list)',
    'Martial Adept', 'Medium Armor Master', 'Mobile (+10 ft. speed)',
    'Moderately Armored', 'Mounted Combatant', 'Observant',
    'Polearm Master', 'Resilient', 'Ritual Caster', 'Savage Attacker',
    'Sentinel', 'Sharpshooter', 'Shield Master',
    'Skilled (3 skills or tools)', 'Skulker', 'Spell Sniper',
    'Tavern Brawler', 'Tough (+2 HP per level)', 'War Caster', 'Weapon Master',
    'Fighting Style: Archery (+2 ranged attack)',
    'Fighting Style: Defense (+1 AC in armor)',
    'Fighting Style: Dueling (+2 melee damage, one-handed)',
    'Fighting Style: Great Weapon Fighting (reroll 1s/2s, two-handed)',
    'Fighting Style: Protection (impose disadvantage, shield reaction)',
    'Fighting Style: Two-Weapon Fighting (add ability mod to off-hand)',
    'Boon of Combat Prowess (melee hits min 10 damage, 1/short rest)',
    'Boon of Dimensional Travel (Misty Step as Bonus Action, Prof Bonus/long rest)',
    'Boon of Fate (add/subtract 2d4 to a roll, 1/short rest)',
    'Boon of Irresistible Offense (ignore Resistance, +damage die)',
    'Boon of the Night Spirit (Invisible in dim light/darkness when still)',
    'Boon of Spell Recall (cast one expended spell of 3rd or lower once free)',
    'Boon of Truesight (Truesight 60 ft.)'
  ]
};

/* derive() is identical in mechanics to the 2014 edition \u2014 AC, saves, skills,
   and spell slots all work the same way. Assign after SYS_5E is defined
   (20-dnd5e.js loads first) so `this` binds to SYS_55E at call-time and
   looks up classes/lineages/armorList from this system. */
SYS_55E.derive = SYS_5E.derive;
