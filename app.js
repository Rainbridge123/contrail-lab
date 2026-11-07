import { createViewer } from "./viewer.js";
import { applyLanguage, setLanguage, t as translate } from "./i18n.js";

const byId = (id) => document.getElementById(id);
const dom = {
  scene: byId("scene"), message: byId("load-message"), select: byId("aircraft-select"),
  flightTitle: byId("flight-title"), meta: byId("flight-meta"), status: byId("flight-status"),
  altitude: byId("altitude"), mach: byId("mach"), fuel: byId("fuel"), flightTime: byId("flight-time"),
  outcome: byId("outcome"), outcomeDot: byId("outcome-dot"), airborne: byId("airborne"),
  inHotspots: byId("in-hotspots"), totalExposed: byId("total-exposed"), range: byId("time-range"),
  currentTime: byId("time-readout"), maxTime: byId("time-max"), play: byId("play"),
  speed: byId("speed"), ticks: byId("ticks"),
  altitudeOffset: byId("altitude-offset"), machOffset: byId("mach-offset"),
  totalChanged: byId("total-changed"), psiDelta: byId("psi-delta"),
};
const modeButtons = Array.from(document.querySelectorAll("[data-mode]"));
const cameraButtons = Array.from(document.querySelectorAll("[data-camera]"));
const filterButtons = Array.from(document.querySelectorAll("[data-change-filter]"));
const languageButtons = Array.from(document.querySelectorAll("[data-language]"));
const planIndexes = { B0: "p0", B1: "b1", B2: "b2" };
const integer = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const machFormat = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const phaseKey = { cruise: "phaseCruise", climb: "phaseClimb", descent: "phaseDescent" };
const changeKey = { none: "changeNone", altitude: "changeAltitude", speed: "changeSpeed", both: "changeBoth" };
const pad = (value) => String(value).padStart(2, "0");
const signed = (value, format) => (value > 0 ? "+" : value < 0 ? "−" : "") + format.format(Math.abs(value));

function timecode(seconds) {
  const whole = Math.floor(Math.max(0, seconds));
  return [Math.floor(whole / 3600), Math.floor(whole / 60) % 60, whole % 60].map(pad).join(":");
}

function interpolate(points, time) {
  let lo = 0;
  let hi = points.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >>> 1;
    if (points[mid][0] <= time) lo = mid;
    else hi = mid;
  }
  const [t0, s0, h0] = points[lo];
  const [t1, s1, h1] = points[hi];
  const f = (time - t0) / (t1 - t0);
  return [s0 + (s1 - s0) * f, h0 + (h1 - h0) * f];
}

function start(data) {
  const routes = new Map(data.routes.map((route) => [route.id, route]));
  const aircraft = data.aircraft.map((flight) => {
    const route = routes.get(flight.route);
    const [x, y] = route.start;
    const [dx, dy] = [route.end[0] - x, route.end[1] - y];
    const initial = flight.candidates.find((candidate) => candidate.i === flight.p0);
    const plans = Object.fromEntries(Object.entries(planIndexes).map(([key, index]) => {
      const candidate = flight.candidates.find((option) => option.i === flight[index]);
      const altitudeOffset = Math.round(candidate.points[0][2] - initial.points[0][2]);
      const machOffset = Math.round((candidate.mach - initial.mach) * 100) / 100;
      const change = altitudeOffset ? (machOffset ? "both" : "altitude") : (machOffset ? "speed" : "none");
      return [key, { ...candidate, altitudeOffset, machOffset, change }];
    }));
    return { ...flight, route, x, y, dx, dy, length: Math.hypot(dx, dy), plans };
  });
  const byAircraft = new Map(aircraft.map((flight) => [flight.id, flight]));
  const changeCounts = Object.fromEntries(Object.keys(planIndexes).map((key) => {
    const counts = { all: aircraft.length, none: 0, altitude: 0, speed: 0, both: 0 };
    for (const flight of aircraft) counts[flight.plans[key].change]++;
    return [key, counts];
  }));
  let selectedId = data.focalIds[0] ?? aircraft[0].id;
  const interval = byAircraft.get(selectedId).plans.B0.hitIntervals[0];
  let t = interval ? Math.round((interval.start + interval.end) / 2) : data.entryWindow / 2;
  let mode = "B0";
  let filter = "all";
  let playing = false;
  let frameRequest = 0;
  let lastFrame = null;

  const viewer = createViewer(dom.scene, data, selectAircraft);
  const end = Math.ceil(data.duration);
  const maxTime = timecode(end);
  const scrub = dom.range.closest(".scrub");
  dom.range.max = end;
  dom.maxTime.textContent = "/ " + maxTime;
  scrub.style.setProperty("--entry", 100 * data.entryWindow / end + "%");
  for (const button of modeButtons) {
    button.querySelector(".scheme-psi").textContent = decimal.format(data.stats[button.dataset.mode].psi);
  }
  const tickTimes = [0, 1800, 3600, 5400, 7200].filter((value) => value < end - 420);
  tickTimes.push(end);
  dom.ticks.replaceChildren(...tickTimes.map((value) => {
    const tick = document.createElement("span");
    tick.style.left = 100 * value / end + "%";
    tick.textContent = timecode(value).slice(0, 5);
    return tick;
  }));

  function syncPlanControls() {
    const counts = changeCounts[mode];
    if (!counts[filter]) filter = "all";
    for (const button of filterButtons) {
      const kind = button.dataset.changeFilter;
      button.disabled = counts[kind] === 0;
      button.setAttribute("aria-pressed", kind === filter);
      button.querySelector(".change-count").textContent = counts[kind];
    }
    const listed = filter === "all" ? aircraft : aircraft.filter((flight) => flight.plans[mode].change === filter);
    if (!listed.some((flight) => flight.id === selectedId)) {
      const active = listed.find((flight) => {
        const points = flight.plans[mode].points;
        return points[0][0] <= t && t <= points.at(-1)[0];
      });
      selectedId = (active ?? listed[0]).id;
    }
    dom.select.replaceChildren(...listed.map((flight) => {
      const option = document.createElement("option");
      option.value = flight.id;
      option.textContent = translate("aircraftOption", {
        id: flight.id,
        change: translate(changeKey[flight.plans[mode].change]),
      });
      return option;
    }));
    dom.select.value = selectedId;
    dom.totalChanged.textContent = (aircraft.length - counts.none) + " / " + aircraft.length;
    const deltaPct = 100 * (data.stats[mode].psi / data.stats.B0.psi - 1);
    dom.psiDelta.textContent = mode === "B0"
      ? translate("psiBaseline")
      : translate("psiCompared", { delta: signed(deltaPct, decimal) });
    dom.psiDelta.dataset.trend = deltaPct < 0 ? "down" : deltaPct > 0 ? "up" : "same";
  }

  function render() {
    const frames = [];
    let activeFlight;
    let exposedNow = 0;
    let exposedInPlan = 0;
    for (const flight of aircraft) {
      const plan = flight.plans[mode];
      if (plan.hit) exposedInPlan++;
      const points = plan.points;
      if (t < points[0][0] || t > points.at(-1)[0]) continue;
      const [s, z] = interpolate(points, t);
      const exposed = plan.hitIntervals.some((span) => t >= span.start && t <= span.end);
      const frame = {
        id: flight.id,
        x: flight.x + flight.dx * s / flight.length,
        y: flight.y + flight.dy * s / flight.length,
        z, heading: flight.route.heading, exposed, change: plan.change,
      };
      frames.push(frame);
      if (exposed) exposedNow++;
      if (flight.id === selectedId) activeFlight = frame;
    }
    viewer.update(filter === "all" ? frames : frames.filter((frame) => frame.change === filter), selectedId);

    const flight = byAircraft.get(selectedId);
    const plan = flight.plans[mode];
    dom.flightTitle.textContent = translate("aircraftLabel", { id: selectedId });
    dom.meta.textContent = translate("flightDescription", {
      heading: String(flight.route.heading).padStart(3, "0"),
      phase: translate(phaseKey[flight.phase]),
    });
    const statusKey = activeFlight
      ? (activeFlight.exposed ? "flightExposed" : "flightActive")
      : (t < plan.points[0][0] ? "flightBefore" : "flightAfter");
    dom.status.textContent = translate(statusKey);
    dom.status.dataset.state = activeFlight ? (activeFlight.exposed ? "exposed" : "active") : "inactive";
    dom.altitude.textContent = activeFlight ? integer.format(activeFlight.z) + " ft" : "—";
    dom.mach.textContent = plan.mach.toFixed(2);
    dom.fuel.textContent = integer.format(plan.fuel) + " kg";
    dom.flightTime.textContent = timecode(plan.time);
    dom.altitudeOffset.textContent = translate("altitudeAdjustment", { amount: signed(plan.altitudeOffset, integer) });
    dom.machOffset.textContent = translate("machAdjustment", { amount: signed(plan.machOffset, machFormat) });
    dom.outcome.textContent = translate(plan.hit ? "planExposed" : "planClear");
    dom.outcomeDot.dataset.hit = plan.hit;
    dom.airborne.textContent = frames.length + " / " + aircraft.length;
    dom.inHotspots.textContent = translate("exposureCount", { count: exposedNow });
    dom.totalExposed.textContent = exposedInPlan + " / " + aircraft.length;

    const seconds = Math.floor(t);
    dom.range.value = seconds;
    const clock = timecode(seconds);
    dom.range.setAttribute("aria-valuetext", clock);
    dom.currentTime.value = clock;
    scrub.style.setProperty("--progress", 100 * t / end + "%");
  }

  function selectAircraft(id) {
    const next = Number(id);
    if (!byAircraft.has(next)) return;
    selectedId = next;
    dom.select.value = next;
    render();
  }

  function setPlaying(value) {
    playing = value;
    lastFrame = null;
    dom.play.dataset.playing = value;
    dom.play.setAttribute("aria-label", translate(value ? "pauseAction" : "playAction"));
    if (frameRequest) cancelAnimationFrame(frameRequest);
    frameRequest = value ? requestAnimationFrame(advance) : 0;
  }

  function advance(now) {
    if (!playing) return;
    if (lastFrame !== null) {
      const elapsed = Math.min((now - lastFrame) / 1000, 0.12);
      t = Math.min(end, t + elapsed * Number(dom.speed.value));
      render();
    }
    lastFrame = now;
    if (t >= end) setPlaying(false);
    else frameRequest = requestAnimationFrame(advance);
  }

  dom.play.addEventListener("click", () => {
    if (!playing && t >= end) {
      t = 0;
      render();
    }
    setPlaying(!playing);
  });
  dom.range.addEventListener("input", () => {
    if (playing) setPlaying(false);
    t = Number(dom.range.value);
    render();
  });
  dom.select.addEventListener("change", () => selectAircraft(dom.select.value));
  for (const button of modeButtons) {
    button.addEventListener("click", () => {
      mode = button.dataset.mode;
      for (const option of modeButtons) option.setAttribute("aria-pressed", option === button);
      syncPlanControls();
      render();
    });
  }
  for (const button of filterButtons) {
    button.addEventListener("click", () => {
      filter = button.dataset.changeFilter;
      syncPlanControls();
      render();
    });
  }
  for (const button of cameraButtons) {
    button.addEventListener("click", () => {
      viewer.setView(button.dataset.camera);
      for (const option of cameraButtons) option.setAttribute("aria-pressed", option === button);
    });
  }

  function refreshLanguage() {
    viewer.setAccessibleLabel(translate("sceneDescription"));
    dom.play.setAttribute("aria-label", translate(playing ? "pauseAction" : "playAction"));
    syncPlanControls();
    render();
  }
  refreshLanguage();
  dom.range.disabled = dom.play.disabled = dom.select.disabled = false;
  dom.message.hidden = true;
  return refreshLanguage;
}

let refreshLanguage = () => {};
let errorKey;
applyLanguage();
for (const button of languageButtons) {
  button.addEventListener("click", () => {
    setLanguage(button.dataset.language);
    applyLanguage();
    if (errorKey) dom.message.textContent = translate(errorKey);
    refreshLanguage();
  });
}

try {
  const response = await fetch("./scene-data.json");
  if (!response.ok) throw new Error("Scene data HTTP " + response.status);
  refreshLanguage = start(await response.json());
} catch (error) {
  console.error(error);
  dom.message.dataset.error = "true";
  errorKey = /webgl/i.test(String(error)) ? "webglError" : "dataError";
  dom.message.textContent = translate(errorKey);
}
