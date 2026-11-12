// ---------- the rotation as the board stores it ----------
// One entry per stop of the rotation; behind each entry a pool of pages (include/rotation.h):
//   mode 'd'  the page changes with the "of the day" schedule (Energy & updates)
//   mode 'v'  the next page of the pool every time the entry comes up
// Pages that need a pool register a builder here: key -> (s, part) => {mode, jobs:[{key, s, part}, …]}
const POOL_PAGES = {};

function rotationPlan(s0 = state) {
  const plan = [];
  for (const e of rotation()) {
    const make = POOL_PAGES[e.key];
    if (make && !e.card) { const pool = make(e.s, e.part || 0); plan.push({key: e.key, part: e.part || 0, mode: pool.mode || 'd', jobs: pool.jobs}); }
    else plan.push({key: e.key, part: e.part || 0, mode: 'd', jobs: [{key: e.key, s: e.s, part: e.part || 0}], card: e.card});
  }
  if (s0.pg_daily) plan.push({key: 'daily', part: 0, mode: 'd', jobs: dailyIds(s0).map(id => ({key: 'daily', s: {...s0, _dailyId: id}, part: 0}))});
  return plan;
}
// "1,1,7d,5v": what /api/rotation?pools= expects, and /api/info reports back
const poolsSpec = plan => plan.map(e => e.jobs.length + (e.jobs.length > 1 ? e.mode : '')).join(',');
const totalEntries = () => rotationPlan().length;
const rotationIndex = (key, part = 0) => rotationPlan().findIndex(e => e.key === key && e.part === part && !e.card);
// The board holds the rotation listed here (same entries and pool sizes)?
const boardMatches = () => !!deviceInfo && (deviceInfo.pools != null
  ? deviceInfo.pools === poolsSpec(rotationPlan())
  : deviceInfo.count === rotation().length && Boolean(deviceInfo.daily) === Boolean(state.pg_daily));
