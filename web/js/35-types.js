// ---------- type chart (gen 6+): attacker -> [super effective, not very effective, no effect] ----------
const CHART = {
  normal: [[], ['rock','steel'], ['ghost']],
  fire: [['grass','ice','bug','steel'], ['fire','water','rock','dragon'], []],
  water: [['fire','ground','rock'], ['water','grass','dragon'], []],
  electric: [['water','flying'], ['electric','grass','dragon'], ['ground']],
  grass: [['water','ground','rock'], ['fire','grass','poison','flying','bug','dragon','steel'], []],
  ice: [['grass','ground','flying','dragon'], ['fire','water','ice','steel'], []],
  fighting: [['normal','ice','rock','dark','steel'], ['poison','flying','psychic','bug','fairy'], ['ghost']],
  poison: [['grass','fairy'], ['poison','ground','rock','ghost'], ['steel']],
  ground: [['fire','electric','poison','rock','steel'], ['grass','bug'], ['flying']],
  flying: [['grass','fighting','bug'], ['electric','rock','steel'], []],
  psychic: [['fighting','poison'], ['psychic','steel'], ['dark']],
  bug: [['grass','psychic','dark'], ['fire','fighting','poison','flying','ghost','steel','fairy'], []],
  rock: [['fire','ice','flying','bug'], ['fighting','ground','steel'], []],
  ghost: [['psychic','ghost'], ['dark'], ['normal']],
  dragon: [['dragon'], ['steel'], ['fairy']],
  dark: [['psychic','ghost'], ['fighting','dark','fairy'], []],
  steel: [['ice','rock','fairy'], ['fire','water','electric','steel'], []],
  fairy: [['fighting','dragon','dark'], ['fire','poison','steel'], []],
};
function defenseTable(t1, t2) {
  const out = {};
  for (const atk of TYPE_KEYS) {
    let m = 1;
    for (const def of [t1, t2].filter(Boolean)) {
      const [sup, half, zero] = CHART[atk];
      m *= zero.includes(def) ? 0 : sup.includes(def) ? 2 : half.includes(def) ? 0.5 : 1;
    }
    out[atk] = m;
  }
  return out;
}

