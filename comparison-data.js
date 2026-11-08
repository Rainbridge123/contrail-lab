// All comparisons use recorded candidates and the same absolute scene time.
export const comparisonColors = {
  B0: '#758697', B1: '#ad8246',
  'B2-C': '#2864a5', 'B2-CF': '#168478', 'B2-CT': '#8063ad', 'B2-CFT': '#bc6256',
  'MAPPO-C': '#2864a5', 'MAPPO-CF': '#168478', 'MAPPO-CT': '#8063ad', 'MAPPO-CFT': '#bc6256',
};
export const shortPlanName = key => key === 'B0' ? 'P₀' : key === 'B1' ? 'B1' : key.split('-').at(-1);

export function interpolate(points, time) {
  let lo = 0, hi = points.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >>> 1;
    if (points[mid][0] <= time) lo = mid;
    else hi = mid;
  }
  const [t0, s0, h0] = points[lo], [t1, s1, h1] = points[hi];
  const fraction = Math.max(0, Math.min(1, (time - t0) / (t1 - t0)));
  return [s0 + (s1 - s0) * fraction, h0 + (h1 - h0) * fraction];
}

export function samplePlan(plan, time) {
  if (time < plan.points[0][0]) return { state: 'before', point: null };
  if (time > plan.points.at(-1)[0]) return { state: 'after', point: null };
  const exposed = plan.hitIntervals.some(span => time >= span.start && time <= span.end);
  return { state: exposed ? 'exposed' : 'active', point: interpolate(plan.points, time) };
}

export function groupComparisonPlans(flight, planKeys) {
  const groups = new Map();
  for (const key of planKeys) {
    const plan = flight.plans[key];
    if (!plan) continue;
    // Candidate IDs are unique within this aircraft. Identical IDs reference
    // the same geometry, timing and action; a shared altitude alone is insufficient.
    if (!groups.has(plan.i)) groups.set(plan.i, { id: 'candidate-' + plan.i, plan, keys: [] });
    groups.get(plan.i).keys.push(key);
  }
  return [...groups.values()].map(group => {
    const representative = group.keys.find(key => key.includes('-')) ?? group.keys[0];
    return { ...group, color: comparisonColors[representative], label: group.keys.map(shortPlanName).join(' / ') };
  });
}

export function comparisonFrame(flight, group, time) {
  const sample = samplePlan(group.plan, time);
  if (!sample.point) return null;
  const [s, z] = sample.point;
  return { id: group.id, x: flight.x + flight.dx * s / flight.length,
    y: flight.y + flight.dy * s / flight.length, z, heading: flight.route.heading,
    color: group.color, comparison: true, exposed: sample.state === 'exposed' };
}
