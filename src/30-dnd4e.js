/* ============================================================
   D&D 4th Edition (PHB1 core)
   ============================================================ */

const SYS_4E = {
  id: '4e',
  name: 'D&D 4th Edition',
  tag: 'PHB1 core',
  blurb: 'Roles and power sources. At-will / encounter / daily powers, four defenses, half-level bonus to everything.',
  maxLevel: 30,
  abilities: ABIL6,
  lineageLabel: 'Race',
  classLabel: 'Class',
  backgroundLabel: 'Background',
  subclassLabel: 'Class Build',
  noBackgroundSkills: true,

  abilityGen: {
    pointBuy: { points: 22, min: 8, max: 18, table: { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 6, 15: 7, 16: 9, 17: 12, 18: 16 } },
    arrays: [
      { id: 'std', name: 'Standard Array', scores: [16, 14, 13, 12, 11, 10] },
      { id: 'alt', name: 'Alternate Array', scores: [16, 16, 13, 11, 10, 10] },
      { id: 'alt2', name: 'Balanced Array', scores: [15, 14, 13, 12, 12, 11] }
    ],
    rolls: [{ id: '4d6d1', name: '4d6 drop lowest', fn: roll4d6dropLowest }],
    manual: { min: 3, max: 20 },
    note: 'Racial bonuses are added on top. 4e assumes an 18 in your primary stat is normal.'
  },

  skills: [
    { id: 'acrobatics', name: 'Acrobatics', ability: 'dex', armorPenalty: true },
    { id: 'arcana', name: 'Arcana', ability: 'int' },
    { id: 'athletics', name: 'Athletics', ability: 'str', armorPenalty: true },
    { id: 'bluff', name: 'Bluff', ability: 'cha' },
    { id: 'diplomacy', name: 'Diplomacy', ability: 'cha' },
    { id: 'dungeoneering', name: 'Dungeoneering', ability: 'wis' },
    { id: 'endurance', name: 'Endurance', ability: 'con', armorPenalty: true },
    { id: 'heal', name: 'Heal', ability: 'wis' },
    { id: 'history', name: 'History', ability: 'int' },
    { id: 'insight', name: 'Insight', ability: 'wis' },
    { id: 'intimidate', name: 'Intimidate', ability: 'cha' },
    { id: 'nature', name: 'Nature', ability: 'wis' },
    { id: 'perception', name: 'Perception', ability: 'wis' },
    { id: 'religion', name: 'Religion', ability: 'int' },
    { id: 'stealth', name: 'Stealth', ability: 'dex', armorPenalty: true },
    { id: 'streetwise', name: 'Streetwise', ability: 'cha' },
    { id: 'thievery', name: 'Thievery', ability: 'dex', armorPenalty: true }
  ],

  lineages: [
    {
      id: 'dragonborn', name: 'Dragonborn', size: 'Medium', speed: 6, asi: { str: 2, cha: 2 },
      languages: ['Common', 'Draconic'], grantSkills: [], skillBonus: { history: 2, intimidate: 2 },
      choice: { key: 'breath', label: 'Dragonborn Breath type', options: ['Acid', 'Cold', 'Fire', 'Lightning', 'Poison'] },
      traits: [
        { name: 'Dragonborn Fury', text: '+1 to attack rolls while bloodied.' },
        { name: 'Draconic Heritage', text: 'Healing surge value increases by your Con modifier.' },
        { name: 'Dragon Breath', text: 'Encounter power: close blast 3, 1d6 + Con/Str/Dex mod damage.' }
      ], subs: []
    },
    {
      id: 'dwarf', name: 'Dwarf', size: 'Medium', speed: 5, asi: { con: 2, wis: 2 },
      languages: ['Common', 'Dwarven'], skillBonus: { dungeoneering: 2, endurance: 2 },
      traits: [
        { name: 'Cast-Iron Stomach', text: '+5 to saves vs. poison.' },
        { name: 'Dwarven Resilience', text: 'Second wind as a minor action instead of standard.' },
        { name: 'Dwarven Weapon Proficiency', text: 'Proficiency with throwing and warhammers.' },
        { name: 'Encumbered Speed', text: 'Speed is never reduced by armor or heavy loads.' },
        { name: 'Stand Your Ground', text: 'Reduce forced movement by 1 square; save to avoid falling prone.' },
        { name: 'Low-light Vision', text: 'You can see in dim light.' }
      ], subs: []
    },
    {
      id: 'eladrin', name: 'Eladrin', size: 'Medium', speed: 6, asi: { dex: 2, int: 2 },
      languages: ['Common', 'Elven'], extraLanguages: 1, skillBonus: { arcana: 2, history: 2 },
      chooseSkills: 1, chooseSkillsFrom: ['arcana', 'history'],
      traits: [
        { name: 'Eladrin Education', text: 'Training in one additional skill.' },
        { name: 'Eladrin Will', text: '+1 Will; +5 to saves vs. charm effects.' },
        { name: 'Fey Origin', text: 'You are a fey creature.' },
        { name: 'Trance', text: 'Meditate 4 hours instead of sleeping.' },
        { name: 'Fey Step', text: 'Encounter power: teleport 5 squares.' },
        { name: 'Group Awareness', text: 'Non-eladrin allies within 10 squares get +1 Perception.' }
      ], defenseBonus: { will: 1 }, subs: []
    },
    {
      id: 'elf', name: 'Elf', size: 'Medium', speed: 7, asi: { dex: 2, wis: 2 },
      languages: ['Common', 'Elven'], skillBonus: { nature: 2, perception: 2 },
      traits: [
        { name: 'Elven Weapon Proficiency', text: 'Proficiency with longbow and shortbow.' },
        { name: 'Fey Origin', text: 'You are a fey creature.' },
        { name: 'Group Awareness', text: 'Non-elf allies within 5 squares get +1 Perception.' },
        { name: 'Wild Step', text: 'Ignore difficult terrain when shifting.' },
        { name: 'Elven Accuracy', text: 'Encounter power: reroll an attack roll.' },
        { name: 'Low-light Vision', text: 'You can see in dim light.' }
      ], subs: []
    },
    {
      id: 'halfelf', name: 'Half-Elf', size: 'Medium', speed: 6, asi: { con: 2, cha: 2 },
      languages: ['Common', 'Elven'], extraLanguages: 1, skillBonus: { diplomacy: 2, insight: 2 },
      traits: [
        { name: 'Dilettante', text: 'Choose an at-will power from another class as an encounter power.' },
        { name: 'Group Diplomacy', text: 'Allies within 10 squares get +1 to Diplomacy.' },
        { name: 'Dual Heritage', text: 'Count as both human and elf for prerequisites.' },
        { name: 'Low-light Vision', text: 'You can see in dim light.' }
      ], subs: []
    },
    {
      id: 'halfling', name: 'Halfling', size: 'Small', speed: 6, asi: { dex: 2, cha: 2 },
      languages: ['Common'], skillBonus: { acrobatics: 2, thievery: 2 },
      traits: [
        { name: 'Bold', text: '+5 to saves vs. fear.' },
        { name: 'Nimble Reaction', text: '+2 AC vs. opportunity attacks.' },
        { name: 'Second Chance', text: 'Encounter power: force an enemy to reroll an attack against you.' }
      ], defenseBonus: {}, subs: []
    },
    {
      id: 'human', name: 'Human', size: 'Medium', speed: 6, asi: {},
      choiceAsi: { count: 1, amount: 2, distinct: true },
      languages: ['Common'], extraLanguages: 1, chooseSkills: 1, chooseSkillsFrom: 'any',
      traits: [
        { name: 'Bonus At-Will Power', text: 'You know one extra at-will attack power from your class.' },
        { name: 'Bonus Feat', text: 'One extra feat at 1st level.' },
        { name: 'Bonus Skill', text: 'Training in one additional skill.' },
        { name: 'Human Defense Bonuses', text: '+1 to Fortitude, Reflex, and Will.' }
      ], defenseBonus: { fort: 1, ref: 1, will: 1 }, subs: []
    },
    {
      id: 'tiefling', name: 'Tiefling', size: 'Medium', speed: 6, asi: { int: 2, cha: 2 },
      languages: ['Common'], skillBonus: { bluff: 2, stealth: 2 },
      traits: [
        { name: 'Bloodhunt', text: '+1 to attack rolls against bloodied enemies.' },
        { name: 'Fire Resistance', text: 'Resist fire 5 + one-half your level.' },
        { name: 'Infernal Wrath', text: 'Encounter power: +1 attack, and extra damage on a hit.' },
        { name: 'Low-light Vision', text: 'You can see in dim light.' }
      ], subs: []
    }
  ],

  classes: [
    {
      id: 'cleric', name: 'Cleric', role: 'Leader', source: 'Divine',
      hpBase: 12, hpPerLevel: 5, surgesBase: 7, // surges = base + Con mod
      primary: ['wis'], defenses: { will: 2 },
      armor: ['Cloth', 'Leather', 'Hide', 'Chainmail'], weapons: ['Simple melee', 'Simple ranged'],
      skillCount: 3, skillList: ['arcana', 'diplomacy', 'heal', 'history', 'insight', 'religion'],
      grantSkills: ['religion'],
      powers: {
        atwill: ['Lance of Faith (Wis vs Reflex, 1d8+Wis radiant, ally +2 attack)', 'Priest’s Shield (Wis vs AC, 1d8+Wis, you and ally +1 AC)', 'Righteous Brand (Str vs AC, 1d8+Str, ally +Str to attack)', 'Sacred Flame (Wis vs Reflex, 1d6+Wis radiant, ally saves or gains temp HP)'],
        encounter: ['Healing Strike (Str vs AC, 2d8+Str radiant, spend healing surge)', 'Wrathful Thunder (Str vs AC, 1d10+Str thunder, dazed)', 'Divine Glow (Wis vs Reflex, close blast 3, 1d8+Wis radiant, allies +2 attack)'],
        daily: ['Avenging Flame (Str vs AC, 2d10+Str fire, ongoing 5)', 'Cause Fear (Wis vs Will, target flees)', 'Beacon of Hope (Wis vs Will, close burst 3, weakened; allies regain HP)', 'Divine Aid (Wis vs Will, ally makes a saving throw with +5)'],
        utility1: ['Bless', 'Cure Light Wounds', 'Divine Fortune', 'Shield of Faith']
      },
      features: { 1: ['Channel Divinity (Divine Fortune, Turn Undead)', 'Healer’s Lore', 'Healing Word (2/encounter)', 'Ritual Casting'] },
      subclasses: [
        { id: 'battle', name: 'Battle Cleric', note: 'Strength-based melee build. Take Righteous Brand and Healing Strike.' },
        { id: 'devoted', name: 'Devoted Cleric', note: 'Wisdom-based ranged/leader build. Take Lance of Faith and Divine Glow.' }
      ],
      startEquip: ['Chainmail', 'Mace', 'Holy symbol', 'Standard adventurer’s kit', '20 gp']
    },
    {
      id: 'fighter', name: 'Fighter', role: 'Defender', source: 'Martial',
      hpBase: 15, hpPerLevel: 6, surgesBase: 9,
      primary: ['str'], defenses: { fort: 2 },
      armor: ['Cloth', 'Leather', 'Hide', 'Chainmail', 'Scale', 'Light shield', 'Heavy shield'],
      weapons: ['Simple melee', 'Military melee', 'Simple ranged', 'Military ranged'],
      skillCount: 3, skillList: ['athletics', 'endurance', 'heal', 'intimidate', 'streetwise'],
      powers: {
        atwill: ['Cleave (Str vs AC, 1d10+Str, adjacent enemy takes Str mod damage)', 'Reaping Strike (Str vs AC, 1d10+Str; half damage on a miss)', 'Sure Strike (Str+2 vs AC, 1d10 damage)', 'Tide of Iron (Str vs AC, 1d10+Str, push 1 and shift)'],
        encounter: ['Covering Attack (Str vs AC, 2d10+Str, ally shifts freely)', 'Passing Attack (Str vs AC, 1d10+Str, shift and attack again)', 'Spinning Sweep (Str vs AC, 1d10+Str, knock prone)', 'Steel Serpent Strike (Str vs AC, 2d8+Str, slowed and no shifting)'],
        daily: ['Brute Strike (3[W]+Str, reliable)', 'Comeback Strike (2[W]+Str, spend a healing surge)', 'Villain’s Menace (2[W]+Str, +4 attack / +2 damage vs. target)'],
        utility1: []
      },
      features: { 1: ['Combat Challenge (mark adjacent enemies)', 'Combat Superiority (+Wis to opportunity attacks, stop movement)', 'Fighter Weapon Talent'] },
      subclasses: [
        { id: 'greatweapon', name: 'Great Weapon Fighter', note: '+1 attack with two-handed weapons. Str primary, Con secondary.' },
        { id: 'guardian', name: 'Guardian Fighter', note: '+1 attack with one-handed weapons; use a shield. Str primary, Wis secondary.' }
      ],
      startEquip: ['Scale armor', 'Heavy shield', 'Longsword', 'Handaxe', 'Standard adventurer’s kit', '15 gp']
    },
    {
      id: 'paladin', name: 'Paladin', role: 'Defender', source: 'Divine',
      hpBase: 15, hpPerLevel: 6, surgesBase: 10,
      primary: ['str', 'cha'], defenses: { fort: 1, ref: 1, will: 1 },
      armor: ['Cloth', 'Leather', 'Hide', 'Chainmail', 'Scale', 'Plate', 'Light shield', 'Heavy shield'],
      weapons: ['Simple melee', 'Military melee', 'Simple ranged', 'Military ranged'],
      skillCount: 3, skillList: ['diplomacy', 'endurance', 'heal', 'history', 'insight', 'intimidate', 'religion'],
      powers: {
        atwill: ['Bolstering Strike (Str vs AC, 1d8+Str, gain temp HP)', 'Enfeebling Strike (Str vs AC, 1d8+Str, −2 attack if not marked by you)', 'Holy Strike (Str vs AC, 1d8+Str radiant, shift 1 if marked)', 'Valiant Strike (Str + adjacent enemies vs AC, 1d8+Str radiant)'],
        encounter: ['Fearsome Smite (Str vs AC, 2d8+Str, penalty to attack)', 'Piercing Smite (Str vs AC, 1d8+Str radiant, marked by you)', 'Radiant Smite (Str vs AC, 2d8+Str+Cha radiant)'],
        daily: ['Paladin’s Judgment (3d8+Str, ally spends a healing surge)', 'On Pain of Death (3d8+Str, ongoing 5 while marked)'],
        utility1: ['Divine Mettle', 'Divine Strength', 'Sacred Circle']
      },
      features: { 1: ['Channel Divinity (Divine Mettle, Divine Strength)', 'Divine Challenge', 'Lay on Hands (Wis mod uses/day)'] },
      subclasses: [
        { id: 'avenging', name: 'Avenging Paladin', note: 'Strength primary; offensive smites.' },
        { id: 'protecting', name: 'Protecting Paladin', note: 'Charisma primary; leader-ish support and defense.' }
      ],
      startEquip: ['Plate armor', 'Heavy shield', 'Longsword', 'Javelin', 'Holy symbol', 'Standard kit']
    },
    {
      id: 'ranger', name: 'Ranger', role: 'Striker', source: 'Martial',
      hpBase: 12, hpPerLevel: 5, surgesBase: 6,
      primary: ['str', 'dex'], defenses: { fort: 1, ref: 1 },
      armor: ['Cloth', 'Leather', 'Hide'], weapons: ['Simple melee', 'Military melee', 'Simple ranged', 'Military ranged'],
      skillCount: 5, skillList: ['acrobatics', 'athletics', 'dungeoneering', 'endurance', 'heal', 'nature', 'perception', 'stealth'],
      grantSkills: ['nature'],
      powers: {
        atwill: ['Careful Attack (Str/Dex+2 vs AC, weapon damage only)', 'Nimble Strike (shift 1, then Str/Dex vs AC, 1[W])', 'Twin Strike (two attacks, 1[W] each, no ability mod)'],
        encounter: ['Dire Wolverine Strike (close burst 1, all enemies)', 'Evasive Strike (1[W]+Str, shift up to half speed)', 'Two-Fanged Strike (two attacks; +Str damage each if both hit)'],
        daily: ['Jaws of the Wolf (two attacks, 2[W] each)', 'Split the Tree (one attack against two adjacent targets)', 'Sudden Strike (2[W]+Dex, target knocked prone)'],
        utility1: ['Unbalancing Parry', 'Yield Ground']
      },
      features: { 1: ['Fighting Style (Archer or Two-Blade)', 'Hunter’s Quarry (extra 1d6 damage 1/round)', 'Prime Shot'] },
      subclasses: [
        { id: 'archer', name: 'Archer Ranger', note: 'Dex primary; Archer Fighting Style, +Dex to bow damage rolls.' },
        { id: 'twoblade', name: 'Two-Blade Ranger', note: 'Str primary; Two-Blade Fighting Style, off-hand weapon proficiency.' }
      ],
      startEquip: ['Leather armor', 'Longbow + 60 arrows or two short swords', 'Standard adventurer’s kit']
    },
    {
      id: 'rogue', name: 'Rogue', role: 'Striker', source: 'Martial',
      hpBase: 12, hpPerLevel: 5, surgesBase: 6,
      primary: ['dex'], defenses: { ref: 2 },
      armor: ['Cloth', 'Leather'], weapons: ['Dagger', 'Hand crossbow', 'Shuriken', 'Sling', 'Short sword'],
      skillCount: 4, skillList: ['acrobatics', 'athletics', 'bluff', 'dungeoneering', 'insight', 'intimidate', 'perception', 'stealth', 'streetwise', 'thievery'],
      grantSkills: ['stealth', 'thievery'],
      powers: {
        atwill: ['Deft Strike (move 1 square, then Dex vs AC, 1[W]+Dex)', 'Piercing Strike (Dex vs Reflex, 1[W]+Dex)', 'Riposte Strike (Dex vs AC, 1[W]+Dex; punish the next attacker)', 'Sly Flourish (Dex vs AC, 1[W]+Dex+Cha)'],
        encounter: ['Positioning Strike (Cha vs Will, slide target 3)', 'Torturous Strike (2[W]+Dex, extra damage if you have combat advantage)', 'Trickster’s Blade (Cha vs AC, 1[W]+Dex, +2 AC)'],
        daily: ['Blinding Barrage (close blast 3, 1[W]+Dex, blinded)', 'Easy Target (2[W]+Dex, slowed and grants combat advantage)', 'Trick Strike (3[W]+Dex, slide target 1 each turn)'],
        utility1: ['Great Leap', 'Master of Deceit', 'Quick Fingers', 'Tumble']
      },
      features: { 1: ['First Strike (combat advantage on the first round)', 'Rogue Tactics (Artful Dodger or Brutal Scoundrel)', 'Rogue Weapon Talent', 'Sneak Attack (+2d6 with combat advantage)'] },
      subclasses: [
        { id: 'dodger', name: 'Artful Dodger', note: 'Charisma secondary; +Cha mod AC vs. opportunity attacks.' },
        { id: 'scoundrel', name: 'Brutal Scoundrel', note: 'Strength secondary; +Str mod to Sneak Attack damage.' }
      ],
      startEquip: ['Leather armor', 'Two daggers', 'Short sword', 'Thieves’ tools', 'Standard kit']
    },
    {
      id: 'warlock', name: 'Warlock', role: 'Striker', source: 'Arcane',
      hpBase: 12, hpPerLevel: 5, surgesBase: 6,
      primary: ['cha', 'con'], defenses: { ref: 1, will: 1 },
      armor: ['Cloth', 'Leather'], weapons: ['Simple melee', 'Simple ranged'],
      skillCount: 4, skillList: ['arcana', 'bluff', 'history', 'insight', 'intimidate', 'religion', 'streetwise', 'thievery'],
      grantSkills: ['arcana'],
      choice: { key: 'pact', label: 'Eldritch Pact', options: ['Fey Pact (Cha, teleport on kill)', 'Infernal Pact (Con, temp HP on kill)', 'Star Pact (Con/Int, penalty to enemy saves)'] },
      powers: {
        atwill: ['Eldritch Blast (Cha vs Reflex, 1d10+Cha force)', 'Hellish Rebuke (Con vs Reflex, 1d6+Con fire, doubles if you take damage)', 'Dire Radiance (Con vs Fortitude, 1d6+Con radiant, punishes approach)'],
        encounter: ['Vampiric Embrace (Con vs Fortitude, 2d6+Con necrotic, gain temp HP)', 'Witchfire (Cha vs Reflex, 1d6+Cha fire, −4 attack)', 'Frigid Darkness (Con/Int vs Reflex, 2d8 cold, −2 all defenses)'],
        daily: ['Armor of Agathys (gain temp HP, aura of cold damage)', 'Curse of the Dark Dream (Cha vs Will, 2d8+Cha psychic, slide 3)', 'Flames of Phlegethos (Cha vs Reflex, 3d10+Cha fire, ongoing 5)'],
        utility1: ['Beguiling Tongue', 'Ethereal Stride', 'Fiendish Resilience', 'Shadow Veil']
      },
      features: { 1: ['Eldritch Blast', 'Prime Shot', 'Shadow Walk', 'Warlock’s Curse (+1d6 damage to cursed enemy)'] },
      subclasses: [
        { id: 'fey', name: 'Fey Pact', note: 'Charisma primary. Misty Step on a kill.' },
        { id: 'infernal', name: 'Infernal Pact', note: 'Constitution primary. Temp HP on a kill.' },
        { id: 'star', name: 'Star Pact', note: 'Constitution primary, Intelligence secondary. Fate of the Void.' }
      ],
      startEquip: ['Leather armor', 'Rod or wand', 'Dagger', 'Standard adventurer’s kit']
    },
    {
      id: 'warlord', name: 'Warlord', role: 'Leader', source: 'Martial',
      hpBase: 12, hpPerLevel: 5, surgesBase: 7,
      primary: ['str', 'cha'], defenses: { fort: 1, will: 1 },
      armor: ['Cloth', 'Leather', 'Hide', 'Chainmail', 'Light shield'],
      weapons: ['Simple melee', 'Military melee', 'Simple ranged'],
      skillCount: 4, skillList: ['athletics', 'diplomacy', 'endurance', 'heal', 'history', 'intimidate'],
      powers: {
        atwill: ['Commander’s Strike (ally makes a melee basic attack with +Int damage)', 'Furious Smash (Str vs Fortitude, Str damage, ally gains +Cha attack/damage)', 'Viper’s Strike (Str vs AC, 1[W]+Str, punish shifting)', 'Wolf Pack Tactics (ally shifts, then Str vs AC, 1[W]+Str)'],
        encounter: ['Guarding Attack (1[W]+Str, ally gains +2 AC)', 'Hammer and Anvil (1[W]+Str, ally attacks with +Cha damage)', 'Leaf on the Wind (1[W]+Str, slide target and shift into place)', 'Warlord’s Favor (1[W]+Str, ally gains +Cha to attack)'],
        daily: ['Bastion of Defense (2[W]+Str, allies gain temp HP and +1 defenses)', 'Lead the Attack (3[W]+Str, allies gain +Int to attack the target)', 'White Raven Onslaught (2[W]+Str, allies shift as a free action)'],
        utility1: ['Aggressive Recovery', 'Inspiring Word (extra)', 'Knight’s Move']
      },
      features: { 1: ['Combat Leader (+2 initiative to allies)', 'Commanding Presence (Inspiring or Tactical)', 'Inspiring Word (2/encounter)'] },
      subclasses: [
        { id: 'inspiring', name: 'Inspiring Warlord', note: 'Charisma secondary; Inspiring Word grants extra HP.' },
        { id: 'tactical', name: 'Tactical Warlord', note: 'Intelligence secondary; allies gain movement bonuses.' }
      ],
      startEquip: ['Chainmail', 'Light shield', 'Longsword', 'Javelin', 'Standard kit']
    },
    {
      id: 'wizard', name: 'Wizard', role: 'Controller', source: 'Arcane',
      hpBase: 10, hpPerLevel: 4, surgesBase: 6,
      primary: ['int'], defenses: { will: 2 },
      armor: ['Cloth'], weapons: ['Dagger', 'Quarterstaff'],
      skillCount: 4, skillList: ['arcana', 'diplomacy', 'dungeoneering', 'history', 'insight', 'nature', 'religion'],
      grantSkills: ['arcana'],
      choice: { key: 'implement', label: 'Implement Mastery', options: ['Orb of Imposition (extend a save-ends effect)', 'Staff of Defense (+1 AC, shield reaction)', 'Wand of Accuracy (+Dex to one attack per encounter)'] },
      powers: {
        atwill: ['Cloud of Daggers (Int vs Reflex, 1d6+Int, zone deals 1d6 damage)', 'Magic Missile (Int vs Reflex, 2d4+Int force)', 'Ray of Frost (Int vs Fortitude, 1d6+Int cold, slowed)', 'Scorching Burst (Int vs Reflex, burst 1, 1d6+Int fire)', 'Thunderwave (Int vs Fortitude, blast 3, 1d6+Int thunder, push)'],
        encounter: ['Burning Hands (Int vs Reflex, blast 5, 2d6+Int fire)', 'Chill Strike (Int vs Fortitude, 2d8+Int cold, dazed)', 'Force Orb (Int vs Reflex, burst 1, 2d8+Int force)', 'Icy Terrain (Int vs Reflex, burst 1, 1d8+Int cold, prone, difficult terrain)'],
        daily: ['Acid Arrow (Int vs Reflex, 2d8+Int acid, ongoing 5, splash)', 'Flaming Sphere (Int vs Reflex, 2d6+Int fire, conjuration that moves)', 'Sleep (Int vs Will, slowed then unconscious)', 'Freezing Cloud (Int vs Fortitude, burst 2, 1d8+Int cold zone)'],
        utility1: ['Feather Fall', 'Jump', 'Shield', 'Expeditious Retreat']
      },
      features: { 1: ['Arcane Implement Mastery', 'Cantrips (Ghost Sound, Light, Mage Hand, Prestidigitation)', 'Ritual Casting', 'Spellbook (extra daily and utility spells)'] },
      subclasses: [
        { id: 'control', name: 'Control Wizard', note: 'Int primary, Wis secondary. Orb of Imposition; area lockdown.' },
        { id: 'war', name: 'War Wizard', note: 'Int primary, Dex secondary. Wand of Accuracy; damage focus.' }
      ],
      startEquip: ['Cloth armor', 'Quarterstaff or dagger', 'Spellbook', 'Orb, staff, or wand', 'Standard kit']
    }
  ],

  // 4e backgrounds are flavour-plus-one-benefit (from PHB2/Scales of War style)
  backgrounds: [
    { id: 'none', name: 'No Background', skills: [], feature: '—', equip: [] },
    { id: 'geography-city', name: 'Geography: Urban', skills: [], chooseFrom: ['streetwise', 'thievery', 'bluff'], chooseCount: 1, feature: 'Add one background skill to your class skill list, or gain +2 to its checks.', equip: [] },
    { id: 'geography-wild', name: 'Geography: Wilderness', skills: [], chooseFrom: ['nature', 'endurance', 'perception'], chooseCount: 1, feature: 'Add one background skill to your class skill list, or gain +2 to its checks.', equip: [] },
    { id: 'occupation-military', name: 'Occupation: Military', skills: [], chooseFrom: ['athletics', 'endurance', 'intimidate'], chooseCount: 1, feature: 'Add one background skill to your class skill list, or gain +2 to its checks.', equip: [] },
    { id: 'occupation-mercantile', name: 'Occupation: Merchant', skills: [], chooseFrom: ['diplomacy', 'insight', 'streetwise'], chooseCount: 1, feature: 'Add one background skill to your class skill list, or gain +2 to its checks.', equip: [] },
    { id: 'occupation-scholar', name: 'Occupation: Scholar', skills: [], chooseFrom: ['arcana', 'history', 'religion'], chooseCount: 1, feature: 'Add one background skill to your class skill list, or gain +2 to its checks.', equip: [] },
    { id: 'occupation-criminal', name: 'Occupation: Criminal', skills: [], chooseFrom: ['bluff', 'stealth', 'thievery'], chooseCount: 1, feature: 'Add one background skill to your class skill list, or gain +2 to its checks.', equip: [] },
    { id: 'birth-noble', name: 'Social Class: Noble', skills: [], chooseFrom: ['diplomacy', 'history', 'insight'], chooseCount: 1, feature: 'Add one background skill to your class skill list, or gain +2 to its checks.', equip: [] },
    { id: 'birth-poverty', name: 'Social Class: Born in Poverty', skills: [], chooseFrom: ['streetwise', 'endurance', 'thievery'], chooseCount: 1, feature: 'Add one background skill to your class skill list, or gain +2 to its checks.', equip: [] }
  ],

  armorList: [
    { name: 'None (Cloth)', ac: 0, type: 'light', check: 0, speed: 0 },
    { name: 'Cloth', ac: 0, type: 'light', check: 0, speed: 0 },
    { name: 'Leather', ac: 2, type: 'light', check: 0, speed: 0 },
    { name: 'Hide', ac: 3, type: 'light', check: -1, speed: 0 },
    { name: 'Chainmail', ac: 6, type: 'heavy', check: -1, speed: -1 },
    { name: 'Scale', ac: 7, type: 'heavy', check: 0, speed: -1 },
    { name: 'Plate', ac: 8, type: 'heavy', check: -2, speed: -1 }
  ],
  shields: [
    { name: 'None', ac: 0, check: 0 },
    { name: 'Light Shield', ac: 1, check: 0 },
    { name: 'Heavy Shield', ac: 2, check: -2 }
  ],

  languages: ['Common', 'Deep Speech', 'Draconic', 'Dwarven', 'Elven', 'Giant', 'Goblin', 'Primordial', 'Supernal', 'Abyssal'],
  alignments: ['Lawful Good', 'Good', 'Unaligned', 'Evil', 'Chaotic Evil'],

  feats: [
    'Armor Proficiency (Leather/Hide/Chainmail/Scale/Plate)', 'Astral Fire (+1 fire/radiant damage)',
    'Dodge Giants', 'Dwarven Weapon Training', 'Elven Precision', 'Great Fortitude (+1 Fort)',
    'Human Perseverance (+1 saving throws)', 'Improved Initiative (+4 initiative)',
    'Iron Will (+1 Will)', 'Jack of All Trades (+2 untrained skills)', 'Lightning Reflexes (+1 Reflex)',
    'Ritual Caster', 'Shield Proficiency', 'Skill Focus (+3 to one skill)', 'Toughness (+5 HP)',
    'Weapon Expertise (+1 attack with a weapon group)', 'Weapon Focus (+1 damage with a weapon group)',
    'Weapon Proficiency', 'Two-Weapon Fighting', 'Quick Draw', 'Alertness (+2 Perception, no surprise)'
  ],

  derive(c) {
    const cls = byId(this.classes, c.classId);
    const lin = byId(this.lineages, c.lineageId);
    const L = clamp(c.level || 1, 1, 30);
    const s = c.finalScores;
    const half = Math.floor(L / 2);
    const out = { level: L, halfLevel: half, skills: [], features: [], notes: [], defenses: [] };
    const tier = L >= 21 ? 'Epic' : L >= 11 ? 'Paragon' : 'Heroic';
    out.tier = tier + ' Tier';

    // HP and surges
    const conM = mod(s.con);
    out.hp = cls ? cls.hpBase + s.con + (L - 1) * cls.hpPerLevel : 10 + s.con;
    out.bloodied = Math.floor(out.hp / 2);
    out.surgeValue = Math.floor(out.hp / 4);
    out.surges = cls ? (cls.surgesBase + conM) : (6 + conM);

    // armor
    const armor = this.armorList.find(a => a.name === (c.armor || 'None (Cloth)')) || this.armorList[0];
    const shield = this.shields.find(x => x.name === (c.shield4e || 'None')) || this.shields[0];
    const dexM = mod(s.dex), intM = mod(s.int), strM = mod(s.str), wisM = mod(s.wis), chaM = mod(s.cha);
    const lightArmor = armor.type === 'light';
    const acAbility = lightArmor ? Math.max(dexM, intM) : 0;
    let ac = 10 + half + armor.ac + shield.ac + acAbility + Number(c.acBonus || 0);
    out.ac = ac;
    out.acNote = armor.name + (shield.ac ? ' + ' + shield.name : '') + (lightArmor ? ' (light: +' + acAbility + ' from Dex/Int)' : ' (heavy: no ability bonus)');
    out.armorCheckPenalty = armor.check + shield.check;

    const cd = (cls && cls.defenses) || {};
    const rd = (lin && lin.defenseBonus) || {};
    const fort = 10 + half + Math.max(strM, conM) + (cd.fort || 0) + (rd.fort || 0);
    const ref = 10 + half + Math.max(dexM, intM) + (cd.ref || 0) + (rd.ref || 0) + shield.ac;
    const will = 10 + half + Math.max(wisM, chaM) + (cd.will || 0) + (rd.will || 0);
    out.defenses = [
      { name: 'AC', value: ac },
      { name: 'Fortitude', value: fort, note: '10 + ½lvl + higher of Str/Con' },
      { name: 'Reflex', value: ref, note: '10 + ½lvl + higher of Dex/Int + shield' },
      { name: 'Will', value: will, note: '10 + ½lvl + higher of Wis/Cha' }
    ];
    out.fort = fort; out.ref = ref; out.will = will;

    out.initiative = half + dexM + (c.initBonus || 0);
    let sp = (lin ? lin.speed : 6) + armor.speed;
    if (lin && lin.id === 'dwarf') sp = lin.speed; // encumbered speed
    out.speed = sp + ' squares (' + sp * 5 + ' ft.)';

    // skills: 5 + half + ability + trained(5) + racial + armor penalty
    this.skills.forEach(sk => {
      const trained = (c.skills || []).includes(sk.id);
      const racial = (lin && lin.skillBonus && lin.skillBonus[sk.id]) || 0;
      const bg = (c.bgSkillBonus === sk.id) ? 2 : 0;
      const pen = sk.armorPenalty ? out.armorCheckPenalty : 0;
      out.skills.push({
        id: sk.id, name: sk.name, ability: sk.ability, prof: trained,
        value: half + mod(s[sk.ability]) + (trained ? 5 : 0) + racial + bg + pen,
        detail: (trained ? 'trained ' : '') + (racial ? '+' + racial + ' racial ' : '') + (bg ? '+2 background ' : '') + (pen ? pen + ' armor' : '')
      });
    });

    // attack / defence bonuses commonly wanted
    out.basicAttacks = [
      { name: 'Melee basic attack', value: half + strM + (c.weaponProf || 0), dmg: '[W] + ' + signed(strM) },
      { name: 'Ranged basic attack', value: half + dexM + (c.weaponProf || 0), dmg: '[W] + ' + signed(dexM) }
    ];
    if (cls) {
      out.role = cls.role + ' / ' + cls.source;
      out.powers = cls.powers;
      const feats = 1 + (lin && lin.id === 'human' ? 1 : 0) + Math.floor((L - 1) / 2) + (L >= 11 ? 0 : 0);
      out.featCount = feats;
      // class powers, plus the paragon path powers gained at 11th (encounter), 12th (utility) and 20th (daily)
      const at = l => L >= l ? 1 : 0;
      out.powersKnown = {
        'At-Will': (lin && lin.id === 'human') ? 3 : 2,
        'Encounter': 1 + at(3) + at(7) + at(13) + at(17) + at(23) + at(27) + at(11),
        'Daily': 1 + at(5) + at(9) + at(15) + at(19) + at(25) + at(29) + at(20),
        'Utility': at(2) + at(6) + at(10) + at(16) + at(22) + at(26) + at(12)
      };
      if (L >= 11) out.notes.push('Power counts include the paragon path powers gained at 11th, 12th, and 20th level.');
      (cls.features[1] || []).forEach(f => out.features.push({ level: 1, text: f }));
      if (L >= 11) out.features.push({ level: 11, text: 'Paragon Path — choose one; gain path features and powers.' });
      if (L >= 21) out.features.push({ level: 21, text: 'Epic Destiny — choose one; gain destiny features.' });
    }
    out.asiCount = 0;
    out.notes.push('Every level: +1 to all defenses and attack rolls comes from the ½-level bonus and magic items.');
    out.notes.push('At 11th, 14th, 18th, 21st, 24th, 28th: +1 to two abilities. At 4th, 8th, 14th, 18th, 24th, 28th: +1 to four abilities (4e uses the ability increase table).');
    return out;
  }
};
