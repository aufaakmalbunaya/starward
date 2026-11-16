// Between-wave upgrades: three cards, pick one. Each one changes the numbers the world
// runs on, so a run's build is visible in how it plays, not just in a stat line.
export const UPGRADES = [
  {
    id: 'tank',
    name: 'Big Tank',
    desc: '+50 water capacity, tank refilled',
    apply(mods) {
      mods.tankMax += 50;
    },
  },
  {
    id: 'boots',
    name: 'Swift Boots',
    desc: '+25% running speed',
    apply(mods) {
      mods.speed *= 1.25;
    },
  },
  {
    id: 'spade',
    name: 'Fast Spade',
    desc: 'Dig a firebreak 30% faster',
    apply(mods) {
      mods.digTime *= 0.7;
    },
  },
  {
    id: 'soak',
    name: 'Long Soak',
    desc: 'Wet ground resists fire for 40 s',
    apply(mods) {
      mods.wetSeconds = 40;
    },
  },
  {
    id: 'saplings',
    name: 'Fireproof Saplings',
    desc: '12 trees will not catch fire',
    apply(mods, world) {
      world.plantFireproof(12);
    },
  },
  {
    id: 'net',
    name: 'Ember Net',
    desc: 'Embers half as likely to start a fire',
    apply(mods) {
      mods.emberFactor *= 0.5;
    },
  },
  {
    id: 'hose',
    name: 'Soaker Hose',
    desc: 'Each splash covers one more ring',
    apply(mods) {
      mods.splashRadius += 1;
    },
  },
  {
    id: 'spring',
    name: 'Pond Spring',
    desc: 'Tank refills twice as fast, plus a slow trickle',
    apply(mods) {
      mods.refillRate *= 2;
      mods.passiveRefill = 2;
    },
  },
];

/** Three different upgrades, drawn with the run's seeded generator. */
export function chooseUpgrades(random) {
  const pool = [...UPGRADES];
  const picked = [];
  while (picked.length < 3 && pool.length > 0) {
    const at = Math.floor(random() * pool.length);
    picked.push(pool.splice(at, 1)[0]);
  }
  return picked;
}

export function defaultMods() {
  return {
    speed: 205,
    digTime: 0.35,
    tankMax: 100,
    splashRadius: 3,
    wetSeconds: 25,
    refillRate: 45,
    passiveRefill: 0,
    emberFactor: 1,
  };
}
