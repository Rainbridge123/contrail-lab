import { referenceFlight } from './reference-flight.js?v=1';
import { createPlaybackControls } from './playback-controls.js?v=initiallevels1';
import { createSetupControls } from './setup-controls.js?v=pathlayer1';
import { createViewer } from "./viewer.js?v=pathlayer1";
import { createAircraftPreview } from "./aircraft-model.js?v=pptaircraft1";
import { applyLanguage, setLanguage, t as translate } from "./i18n.js?v=defaults1";

import { interpolate, samplePlan, groupComparisonPlans, comparisonFrame } from "./comparison-data.js?v=compare6";

const byId = (id) => document.getElementById(id);
const dom = {
  preview: byId("aircraft-preview"), aircraftSize: byId("aircraft-size"),
  aircraftSizeValue: byId("aircraft-size-value"), focusAircraft: byId("focus-aircraft"),
  trueScale: byId("true-scale"), scaleNote: byId("scale-note"),
  inspector: byId("aircraft-inspector"), toggleInspector: byId("toggle-inspector"),
  scene: byId("scene"), message: byId("load-message"), select: byId("aircraft-select"),
  flightTitle: byId("flight-title"), meta: byId("flight-meta"), status: byId("flight-status"),
  altitude: byId("altitude"), mach: byId("mach"), fuel: byId("fuel"), flightTime: byId("flight-time"),
  outcome: byId("outcome"), outcomeDot: byId("outcome-dot"), airborne: byId("airborne"),
  inHotspots: byId("in-hotspots"), totalExposed: byId("total-exposed"), range: byId("time-range"),
  currentTime: byId("time-readout"), maxTime: byId("time-max"), play: byId("play"),
  speed: byId("speed"), ticks: byId("ticks"),
  altitudeOffset: byId("altitude-offset"), machOffset: byId("mach-offset"),
  totalChanged: byId("total-changed"), psiDelta: byId("psi-delta"),
  planSummary: byId("plan-summary"), planSource: byId("plan-source"), planRule: byId("plan-rule"),
  metricPsi: byId("metric-psi"),
  metricFuel: byId("metric-fuel"), metricTime: byId("metric-time"), metricHotspot: byId("metric-hotspot"),
  mappoAvailability: byId("mappo-availability"),
  selectionStatus: byId("selection-status"),
  filterSummary: byId("filter-summary"),
  compareSelect: byId("compare-aircraft"), compareMethod: byId("compare-method"),
  compareRows: byId("comparison-rows"), compareLegend: byId("comparison-legend"),
};
const modeButtons = Array.from(document.querySelectorAll("[data-mode]"));
const familyButtons = Array.from(document.querySelectorAll("[data-family]"));
const familyPanels = Array.from(document.querySelectorAll("[data-family-panel]"));
const cameraButtons = Array.from(document.querySelectorAll("[data-camera]"));
const filterButtons = Array.from(document.querySelectorAll("[data-change-filter]"));
const languageButtons = Array.from(document.querySelectorAll("[data-language]"));
const legacyPlanIndexes = { B0: "p0", B1: "b1", B2: "b2" };
const legacyPlanLabels = { B0: "planB0", B1: "planB1", B2: "planB2" };
const familyLabels = { baseline: "familyBaseline", B2: "familyB2", MAPPO: "familyMappo" };
const planRuleKeys = {
  B0: "ruleB0", B1: "ruleB1", B2: "ruleC",
  "B2-C": "ruleC", "B2-CF": "ruleCF", "B2-CT": "ruleCT", "B2-CFT": "ruleCFT",
  "MAPPO-C": "ruleMappoC", "MAPPO-CF": "ruleMappoCF", "MAPPO-CT": "ruleMappoCT", "MAPPO-CFT": "ruleMappoCFT",
};
const familyFor = (key) => key.startsWith("MAPPO-") ? "MAPPO" : key === "B2" || key.startsWith("B2-") ? "B2" : "baseline";
const armFor = (key) => familyFor(key) === "baseline" ? undefined : key.split("-").at(-1);
const integer = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const percentage = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const machFormat = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const phaseKey = { cruise: "phaseCruise", climb: "phaseClimb", descent: "phaseDescent" };
const changeKey = { none: "changeNone", altitude: "changeAltitude", speed: "changeSpeed", both: "changeBoth" };
const pad = (value) => String(value).padStart(2, "0");
const signed = (value, format) => (value > 0 ? "+" : value < 0 ? "−" : "") + format.format(Math.abs(value));

function timecode(seconds) {
  const whole = Math.floor(Math.max(0, seconds));
  return [Math.floor(whole / 3600), Math.floor(whole / 60) % 60, whole % 60].map(pad).join(":");
}


function start(data) {
  const workbench=document.createElement('section');workbench.className='scene-workbench';
  const toolbar=document.createElement('div');toolbar.className='workbench-toolbar';
  const context=document.createElement('div');context.id='workbench-context';
  const workspace=document.querySelector('.workspace');
  workspace.before(workbench);workbench.append(toolbar,context,workspace);
  toolbar.append(document.querySelector('.view-switch'));
  const switcher=toolbar.querySelector('.view-switch');switcher.prepend(byId('setup-view'));
  const sharedLabel=document.createElement('label');sharedLabel.className='shared-aircraft-label';
  const sharedText=document.createElement('span');sharedText.id='shared-aircraft-label';
  const sharedSelect=document.createElement('select');sharedSelect.id='shared-aircraft';
  sharedLabel.append(sharedText,sharedSelect);toolbar.append(sharedLabel);
  const compareAction=switcher.querySelector('[data-view="compare"]');
  compareAction.removeAttribute('data-view');compareAction.removeAttribute('data-i18n');compareAction.removeAttribute('aria-pressed');compareAction.id='compare-aircraft-action';compareAction.className='compare-aircraft-action';toolbar.append(compareAction);
  const inspectorCompare=document.createElement('button');inspectorCompare.type='button';inspectorCompare.id='inspector-compare';inspectorCompare.className='compare-aircraft-action';dom.inspector.prepend(inspectorCompare);
  context.append(document.querySelector('.experiment-panel'),byId('comparison-controls'));
  const timeline=document.querySelector('.timeline');
  const compareRestart=document.createElement('button');compareRestart.id='compare-restart';compareRestart.className='toolbar-button';compareRestart.type='button';timeline.querySelector('.playback').append(compareRestart);
  toolbar.append(document.querySelector('.scene-context'));
  document.querySelector('.intro').remove();
  const resultArea=document.createElement('div');resultArea.className='workbench-results';
  workbench.append(resultArea);resultArea.append(document.querySelector('.results'),byId('comparison-results'));

  const rawAssignment = (flight, key) => Object.hasOwn(flight.assignments ?? {}, key)
    ? flight.assignments[key]
    : flight[legacyPlanIndexes[key]];
  const rawCandidateFor = (flight, key) => flight.candidates.find((candidate) => candidate.i === rawAssignment(flight, key));
  const rawCompletePlan = (key) => data.aircraft.length > 0 && Number.isFinite(data.stats?.[key]?.psi)
    && data.aircraft.every((flight) => {
      const candidate = rawCandidateFor(flight, key);
      return candidate && candidate.valid !== false
        && [candidate.mach, candidate.fuel, candidate.time].every(Number.isFinite)
        && candidate.points?.length >= 2
        && candidate.points.every((point) => point.length >= 3 && point.every(Number.isFinite))
        && Array.isArray(candidate.hitIntervals);
    });
  const aliasB2C = !Object.hasOwn(data.stats ?? {}, "B2-C")
    && data.aircraft.every((flight) => !Object.hasOwn(flight.assignments ?? {}, "B2-C"))
    && rawCompletePlan("B2");
  const sourceKey = (key) => key === "B2-C" && aliasB2C ? "B2" : key;
  const candidateFor = (flight, key) => rawCandidateFor(flight, sourceKey(key));
  const completePlan = (key) => (familyFor(key) !== "MAPPO" || data.plans?.[key]?.algorithm === "MAPPO")
    && rawCompletePlan(sourceKey(key));
  const statsFor = (key) => data.stats[sourceKey(key)];
  const metadataFor = (key) => key === "B2-C" && aliasB2C
    ? { ...(data.plans?.B2 ?? {}), algorithm: "B2", arm: "C" }
    : data.plans?.[key] ?? {};
  if (!completePlan("B0")) throw new Error("Scene data requires a complete initial plan.");
  const planIds = Array.from(new Set(modeButtons.map((button) => button.dataset.mode))).filter(completePlan);
  if (!planIds.includes("B0")) throw new Error("The initial plan selector is missing.");
  const availablePlans = new Set(planIds);
  const routes = new Map(data.routes.map((route) => [route.id, route]));
  const aircraft = data.aircraft.map((flight) => {
    const route = routes.get(flight.route);
    const [x, y] = route.start;
    const [dx, dy] = [route.end[0] - x, route.end[1] - y];
    const initial = candidateFor(flight, "B0");
    const plans = Object.fromEntries(planIds.map((key) => {
      const candidate = candidateFor(flight, key);
      const altitudeOffset = Math.round(candidate.points[0][2] - initial.points[0][2]);
      const machOffset = Math.round((candidate.mach - initial.mach) * 100) / 100;
      const change = altitudeOffset ? (machOffset ? "both" : "altitude") : (machOffset ? "speed" : "none");
      return [key, { ...candidate, altitudeOffset, machOffset, change }];
    }));
    return { ...flight, route, x, y, dx, dy, length: Math.hypot(dx, dy), plans };
  });
  const referencePlans = new Map(aircraft.map(flight => {
    const reference = referenceFlight(flight, flight.phase, flight.machRef);
    return [flight.id, {...reference.plans.B0, points:reference.plans.B0.points.map(([seconds,distance,height])=>[seconds+flight.entry,distance,height])}];
  }));
  const byAircraft = new Map(aircraft.map((flight) => [flight.id, flight]));
  const changeCounts = Object.fromEntries(planIds.map((key) => {
    const counts = { all: aircraft.length, none: 0, altitude: 0, speed: 0, both: 0 };
    for (const flight of aircraft) counts[flight.plans[key].change]++;
    return [key, counts];
  }));
  let selectedId = data.focalIds?.find((id) => byAircraft.has(id)) ?? aircraft[0].id;
  const interval = byAircraft.get(selectedId).plans.B0.hitIntervals[0];
  let t = interval ? Math.round((interval.start + interval.end) / 2) : data.entryWindow / 2;
  let mode = availablePlans.has("B2-C") ? "B2-C" : "B0";
  let family = familyFor(mode);
  let baselineChoice = family === "baseline" ? mode : "B0";
  let selectedArm = armFor(mode) ?? "C";
  let fallbackSelection = null;
  let filter = "all";
  let playing = false;
  let frameRequest = 0;
  let lastFrame = null;
  let trueScale = false;
  let view = "setup", comparisonMethod = "B2", fleetCamera = "orbit";
  let comparisonGroups = [], comparisonRows = new Map();

  const viewer = createViewer(dom.scene, data, selectAircraft);
  const aircraftPreview = createAircraftPreview(dom.preview);
  const setupUI = createSetupControls(aircraft, () => {setPlaying(false);selectedId=setupUI.state.id;byId('shared-aircraft').value=selectedId;render();});
  const playbackUI=createPlaybackControls(aircraft,()=>render());
  setupUI.state.id=selectedId;
  sharedSelect.replaceChildren(...aircraft.map(a=>{const o=document.createElement('option');o.value=a.id;o.textContent='#'+a.id;return o;}));
  sharedSelect.value=selectedId;
  sharedSelect.addEventListener('change',()=>{selectAircraft(sharedSelect.value);setInspectorOpen(false);});
  let aircraftScope = 'changed', chooserKey = '';
  const scopeSelect = document.createElement('select'); scopeSelect.id = 'aircraft-scope';
  const aircraftPicker=document.createElement('div');aircraftPicker.className='aircraft-picker';
  const actionLabel=document.createElement('label');actionLabel.className='aircraft-action-label';
  const actionText=document.createElement('span');actionLabel.append(actionText,scopeSelect);
  sharedLabel.before(aircraftPicker);aircraftPicker.append(actionLabel,sharedLabel);
  function scopedAircraft() {
    if (view === 'setup' || aircraftScope === 'all') return aircraft;
    const keys = view === 'compare' ? comparisonKeys() : [mode];
    if (aircraftScope === 'none') return aircraft.filter(a=>keys.every(key=>a.plans[key]?.change==='none'));
    return aircraft.filter(a => keys.some(key => {
      const change = a.plans[key]?.change;
      return aircraftScope === 'changed' ? change && change !== 'none' : change === aircraftScope;
    }));
  }
  function syncAircraftChooser() {
    const en = document.documentElement.lang.startsWith('en');
    actionLabel.hidden = view === 'setup';
    actionText.textContent=en?'Action':'动作';
    sharedText.textContent=en?'Aircraft ID':'飞机编号';
    const key = [view, mode, comparisonMethod, aircraftScope, en].join(':');
    const listed = scopedAircraft();
    if (key !== chooserKey) {
      chooserKey = key;
      scopeSelect.setAttribute('aria-label',en?'Aircraft filter relative to P₀':'按相对 P₀ 的变化筛选飞机');
      scopeSelect.replaceChildren(...[['changed',en?'Any change':'全部调整'],['altitude',en?'Altitude only':'仅调整高度'],['speed',en?'Speed only':'仅调整速度'],['both',en?'Altitude + speed':'高度和速度'],['none',en?'Unchanged':'未调整'],['all',en?'All aircraft':'全部飞机']].map(([value,text])=>{
        const o=document.createElement('option');o.value=value;o.textContent=text;return o;
      })); scopeSelect.value=aircraftScope;
      sharedSelect.replaceChildren(...listed.map(a=>{
        const o=document.createElement('option');o.value=a.id;
        o.textContent='#'+a.id;return o;
      }));
      if (!listed.length) {const o=document.createElement('option');o.textContent=en?'No matching aircraft':'无符合条件飞机';sharedSelect.append(o);}
    }
    sharedSelect.disabled=!listed.length; compareAction.disabled=view!=='compare'&&!listed.length;
    if (listed.length && !listed.some(a=>a.id===selectedId)) {
      selectedId=listed[0].id; setupUI.state.id=selectedId;dom.select.value=selectedId;
      if(view==='compare'){setPlaying(false);t=playbackStart();rebuildComparison();}
    }
    sharedSelect.value=listed.length?String(selectedId):sharedSelect.options[0].value;
    return listed;
  }
  scopeSelect.onchange=()=>{aircraftScope=scopeSelect.value;filter='all';setInspectorOpen(false);syncPlanControls();render();};
  const previewColors = { none: 0x526a80, altitude: 0x2563b8, speed: 0x7c3ab1, both: 0x08745d };
  function syncScaleControls() {
    dom.trueScale.setAttribute("aria-pressed", trueScale);
    dom.aircraftSize.disabled = trueScale;
    dom.aircraftSizeValue.value = trueScale ? "0.30%" : dom.aircraftSize.value + "%";
    const key = trueScale ? "trueScaleNote" : "displayScaleNote";
    dom.scaleNote.dataset.i18n = key;
    dom.scaleNote.textContent = translate(key, {factor: viewer.altitudeExaggeration().toFixed(1)});
  }
  dom.trueScale.addEventListener("click", () => {
    trueScale = !trueScale;
    viewer.setTrueScale(trueScale);
    syncScaleControls();
  });
  function setInspectorOpen(open) {
    dom.inspector.hidden = !open;
    dom.toggleInspector.setAttribute("aria-expanded", open);
    dom.scene.closest(".workspace").dataset.details = open ? "open" : "closed";
  }
  dom.toggleInspector.addEventListener("click", () => setInspectorOpen(dom.inspector.hidden));
  document.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;
    const settings = document.querySelector(".display-settings");
    if (settings.open) { settings.open = false; settings.querySelector("summary").focus(); }
    else if (!dom.inspector.hidden) { setInspectorOpen(false); dom.toggleInspector.focus(); }
  });
  dom.aircraftSize.addEventListener("input", () => {
    const percent = Number(dom.aircraftSize.value);
    dom.aircraftSizeValue.value = percent + "%";
    viewer.setAircraftScale(percent / 100);
  });
  dom.focusAircraft.addEventListener("click", () => viewer.focusSelected());
  byId("reset-aircraft-preview").addEventListener("click", () => aircraftPreview.reset());
  const end = Math.ceil(Math.max(data.duration,...[...referencePlans.values()].map(plan=>plan.points.at(-1)[0])));
  const maxTime = timecode(end);
  const scrub = dom.range.closest(".scrub");
  dom.range.max = end;
  dom.maxTime.textContent = "/ " + maxTime;
  scrub.style.setProperty("--entry", 100 * data.entryWindow / end + "%");
  for (const button of modeButtons) {
    const key = button.dataset.mode;
    button.disabled = !availablePlans.has(key);
    button.setAttribute("aria-pressed", key === mode);
    const psi = button.querySelector(".scheme-psi");
    if (psi) psi.textContent = button.disabled ? "—" : decimal.format(statsFor(key).psi);
  }
  const tickTimes = [0, 1800, 3600, 5400, 7200].filter((value) => value < end - 420);
  tickTimes.push(end);
  dom.ticks.replaceChildren(...tickTimes.map((value) => {
    const tick = document.createElement("span");
    tick.style.left = 100 * value / end + "%";
    tick.textContent = timecode(value).slice(0, 5);
    return tick;
  }));

  function comparisonKeys() {
    return ["B0", "B1", ...["C", "CF", "CT", "CFT"].map(arm => comparisonMethod + "-" + arm)].filter(key => availablePlans.has(key));
  }

  function rebuildComparison() {
    if (view !== "compare") return;
    const flight = byAircraft.get(selectedId), keys = comparisonKeys();
    comparisonGroups = groupComparisonPlans(flight, keys);
    viewer.setComparison(flight, comparisonGroups);
    syncScaleControls();
    byId("compare-summary").textContent = translate("comparisonSummary", {method: translate(familyLabels[comparisonMethod]), count: keys.length});
    byId("compare-flight-label").textContent = translate("aircraftLabel", {id: selectedId});
    byId("compare-meta").textContent = translate("flightDescription", {heading: String(flight.route.heading).padStart(3, "0"), phase: translate(phaseKey[flight.phase])});
    dom.compareSelect.value = selectedId;
    comparisonRows = new Map();
    const rows = keys.map(key => {
      const plan = flight.plans[key], group = comparisonGroups.find(group => group.keys.includes(key));
      const row = document.createElement("tr"); row.dataset.plan = key;
      const name = document.createElement("th"); name.scope = "row";
      const dot = document.createElement("span"); dot.className = "plan-dot"; dot.style.backgroundColor = group.color;
      name.append(dot, key === "B0" ? "P₀" : key); row.append(name);
      const values = [signed(plan.altitudeOffset, integer), plan.mach.toFixed(2) + " / " + signed(plan.machOffset, machFormat), "—", integer.format(plan.fuel), timecode(plan.time), translate(plan.hit ? "comparisonHit" : "comparisonClear"), "—"];
      values.forEach((value, index) => {
        const cell = document.createElement("td"); cell.textContent = value;
        if (index < 5) cell.className = "mono";
        if (index === 5) cell.dataset.hit = plan.hit;
        row.append(cell);
      });
      comparisonRows.set(key, { altitude: row.children[3], status: row.children[7] });
      return row;
    });
    dom.compareRows.replaceChildren(...rows);
    dom.compareLegend.replaceChildren(...comparisonGroups.map(group => {
      const item = document.createElement("li"), swatch = document.createElement("span");
      swatch.className = "trajectory-key" + (group.keys.includes("B0") ? " baseline" : "");
      swatch.style.color = group.color; item.append(swatch, group.label); return item;
    }));
    const hotspotLegend = document.createElement("li"), hotspotKey = document.createElement("span");
    hotspotKey.className = "key hotspot-key";
    hotspotLegend.append(hotspotKey, translate("legendHotspot"));
    dom.compareLegend.append(hotspotLegend);
    byId("comparison-source").textContent = keys.map(key => key + ": " + (metadataFor(key).source ?? metadataFor(key).sourceFile ?? data.sourceCommit)).join("\n");
  }

  let demoFlight=null,demoFlightKey="";
  const playbackStart=()=>view==='compare'?Math.min(...comparisonKeys().map(key=>byAircraft.get(selectedId).plans[key].points[0][0])):0;
  const playbackEnd=()=>view==='compare'?Math.max(...comparisonKeys().map(key=>byAircraft.get(selectedId).plans[key].points.at(-1)[0])):end;
  compareRestart.addEventListener('click',()=>{setPlaying(false);t=playbackStart();render();});
  function syncViewControls() {
    if(view!=="setup")setupUI.pauseDemo();
    playbackUI.render(view);
    const comparing = view === "compare";
    (comparing?byId('comparison-controls'):workspace).append(timeline);
    compareRestart.hidden=!comparing;
    compareAction.hidden=view==='setup';
    inspectorCompare.hidden=view!=='fleet';
    const setting = view === "setup";
    setupUI.host.hidden=!setting;
    setupUI.state.id=selectedId;
    setupUI.render();
    byId("shared-aircraft").value=selectedId;
    byId("shared-aircraft-label").textContent=document.documentElement.lang.startsWith("en")?"Aircraft":"飞机";
    byId("setup-view").textContent=document.documentElement.lang.startsWith("en")?"Scene demo":"场景演示";
    document.body.dataset.view = view;
    dom.scene.closest(".workspace").dataset.view = view;
    document.querySelector('.experiment-panel').hidden = document.querySelector('.results').hidden = comparing || setting;
    for (const id of ["comparison-controls", "comparison-caption", "comparison-results", "comparison-legend", "compare-summary", "comparison-source"]) byId(id).hidden = !comparing;
    document.querySelector('.stage-caption').hidden = comparing || setting;
    document.querySelector('.stage-bottom > .legend:not(.comparison-legend)').hidden = comparing || setting;
    document.querySelector('.change-filters').hidden = comparing || setting;
    dom.toggleInspector.hidden = dom.planSummary.hidden = dom.planSource.hidden = comparing || setting;
    for (const button of document.querySelectorAll('[data-view]')) {
      if (button.tagName === "BUTTON") button.setAttribute("aria-pressed", (button.dataset.view === view)||(button.dataset.view==='fleet'&&comparing));
    }
    const side = document.querySelector('[data-camera="profile"]');
    side.dataset.i18n = comparing ? "comparisonSide" : "cameraProfile";
    side.textContent = translate(side.dataset.i18n);
    dom.compareSelect.replaceChildren(...aircraft.map(flight => {
      const option = document.createElement("option"); option.value = flight.id;
      option.textContent = translate("aircraftLabel", {id: flight.id}); return option;
    }));
    dom.compareSelect.value = selectedId;
    for (const option of dom.compareMethod.options) option.disabled = !planIds.some(key => familyFor(key) === option.value);
    dom.compareMethod.value = comparisonMethod;
  }

  function switchView(next) {
    if (view === next || !["fleet", "compare", "setup"].includes(next)) return;
    setPlaying(false); setInspectorOpen(false);
    document.querySelector('.display-settings').open = false;
    viewer.setSetup(null);
    view = next;
    filter = "all";
    if (view === "compare") {
      filter = "all";
      comparisonMethod = family === "MAPPO" ? "MAPPO" : "B2";
      t=playbackStart();
    } else viewer.setComparison(null);
    syncViewControls(); syncPlanControls(); rebuildComparison();
    viewer.setView("orbit");
    syncScaleControls();
    const cameraName = viewer.getView();
    cameraButtons.forEach(button => button.setAttribute("aria-pressed", button.dataset.camera === cameraName));
    render();
  }
  compareAction.addEventListener('click',()=>switchView(view==='compare'?'fleet':'compare'));
  inspectorCompare.addEventListener('click',()=>switchView('compare'));
  document.querySelectorAll('button[data-view]').forEach(button => button.addEventListener("click", () => switchView(button.dataset.view)));
  dom.compareSelect.addEventListener("change", () => selectAircraft(dom.compareSelect.value));
  dom.compareMethod.addEventListener("change", () => {
    setPlaying(false); comparisonMethod = dom.compareMethod.value; rebuildComparison(); render();
  });

  function syncPlanControls() {
    for (const button of modeButtons) {
      if (button.disabled) button.title = translate("planUnavailable");
      button.setAttribute("aria-pressed", button.dataset.mode === mode);
    }
    for (const button of familyButtons) {
      const key = button.dataset.family;
      button.disabled = !planIds.some((id) => familyFor(id) === key);
      button.setAttribute("aria-pressed", key === family);
      button.title = button.disabled ? translate(key === "MAPPO" ? "mappoPending" : "familyUnavailable") : "";
    }
    for (const panel of familyPanels) panel.hidden = panel.dataset.familyPanel !== family;
    if (dom.selectionStatus) {
      dom.selectionStatus.hidden = !fallbackSelection;
      dom.selectionStatus.textContent = fallbackSelection ? translate("armFallback", {
        arm: fallbackSelection.arm,
        selected: fallbackSelection.selected,
        algorithm: translate(familyLabels[fallbackSelection.family]),
      }) : "";
    }
    const metadata = metadataFor(mode);
    if (dom.mappoAvailability) {
      const key = planIds.some((id) => familyFor(id) === "MAPPO")
        ? "mappoLoaded" : "mappoPending";
      dom.mappoAvailability.dataset.i18n = key;
      dom.mappoAvailability.textContent = translate(key);
    }
    if (dom.planSummary) {
      dom.planSummary.textContent = legacyPlanLabels[mode]
        ? translate(legacyPlanLabels[mode])
        : translate("planSummary", { algorithm: translate(familyLabels[family]), arm: metadata.arm ?? armFor(mode) ?? "" });
    }
    if (dom.planRule) {
      const text = translate(planRuleKeys[mode] ?? "planUnavailable");
      dom.planRule.hidden = !text;
      dom.planRule.replaceChildren(...text.split(" | ").filter(Boolean).map(value => {
        const tag = document.createElement("span"); tag.className = "detail-tag"; tag.textContent = value; return tag;
      }));
    }
    if (dom.planSource) {
      const source = metadata.source ?? metadata.sourceFile
        ?? (legacyPlanLabels[sourceKey(mode)] ? data.sourceCommit : undefined);
      const details = [
        ["provenanceCheckpoint", metadata.checkpoint],
        ["provenanceActionRule", metadata.actionRule],
        ["provenanceCommit", metadata.sourceCommit],
        ["provenanceConfig", metadata.configHash],
      ].filter(([, value]) => value !== undefined && value !== null);
      const text = [source ? translate("planSource", { source }) : translate("metricUnavailable"),
        ...details.map(([key, value]) => translate(key) + ": " + value)].join(" · ");
      dom.planSource.textContent = text;
      dom.planSource.title = text;
    }
    const stats = statsFor(mode);
    if (dom.metricPsi) dom.metricPsi.textContent = decimal.format(stats.psi);
    for (const [element, value, showSign] of [
      [dom.metricFuel, stats.fuelPct, true],
      [dom.metricTime, stats.timePct, true],
      [dom.metricHotspot, Number.isFinite(stats.hotspotShare) ? 100 * stats.hotspotShare : undefined, false],
    ]) {
      if (element) element.textContent = Number.isFinite(value)
        ? (showSign ? signed(value, percentage) : percentage.format(value)) + "%"
        : translate("metricUnavailable");
    }
    const counts = changeCounts[mode];
    if (!counts[filter]) filter = "all";
    dom.filterSummary.hidden = filter === "all";
    dom.filterSummary.textContent = filter === "all" ? "" : translate("visibleFilter", { filter: translate(changeKey[filter]) });
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
    const deltaPct = statsFor("B0").psi > 0 ? 100 * (stats.psi / statsFor("B0").psi - 1) : undefined;
    dom.psiDelta.textContent = mode === "B0"
      ? translate("psiBaseline")
      : Number.isFinite(deltaPct)
        ? translate("psiCompared", { delta: signed(deltaPct, decimal) })
        : translate("metricUnavailable");
    dom.psiDelta.dataset.trend = deltaPct < 0 ? "down" : deltaPct > 0 ? "up" : "same";
  }

  function render() {
    const visibleAircraft=syncAircraftChooser();
    const visibleIds=new Set(visibleAircraft.map(a=>a.id));
    const englishUI=document.documentElement.lang.startsWith('en');
    compareAction.textContent=view==='compare'?(englishUI?'← Back to fleet':'← 返回机队'):(englishUI?'Compare aircraft #'+selectedId:'对照飞机 #'+selectedId);
    inspectorCompare.textContent=englishUI?'Compare plans for #'+selectedId:'查看 #'+selectedId+' 的方案对照';
    viewer.setPlaybackDisplay(view==='setup'?null:playbackUI.settings[view],byAircraft.get(selectedId),visibleAircraft,mode,filter,view,aircraftScope);
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
    if (view === "compare") {
      const flight = byAircraft.get(selectedId);
      const alternatives = comparisonGroups.map(group => comparisonFrame(flight, group, t)).filter(Boolean);
      viewer.update(alternatives, null);
      for (const [key, cells] of comparisonRows) {
        const sample = samplePlan(flight.plans[key], t);
        cells.altitude.textContent = sample.point ? integer.format(sample.point[1]) : "—";
        cells.status.textContent = translate({before: "flightBefore", after: "flightAfter", active: "flightActive", exposed: "flightExposed"}[sample.state]);
        cells.status.dataset.state = sample.state;
      }
    } else if(view === "setup") {
      const options=setupUI.state;let focus=byAircraft.get(options.id);
      if(options.demo){const key=[focus.id,options.demoPhase,options.demoMach].join(':');if(key!==demoFlightKey){demoFlightKey=key;demoFlight=referenceFlight(focus,options.demoPhase,options.demoMach);}focus=demoFlight;options.demoDuration=focus.duration;}
      viewer.setSetup(options.demo?{...options,time:false,referenceProfiles:false,candidates:options.referenceProfiles,candidateLevels:[0],altitude:0}:options, focus);
      const demoFrames=options.aircraft?aircraft.flatMap((a,index)=>{
        let distance, height;
        if(options.time){const point=samplePlan(referencePlans.get(a.id),t).point;if(!point)return [];[distance,height]=point;}
        else {distance=((index%24)+.5)/24*500;const u=Math.max(0,Math.min(1,(distance-240)/20));height=a.startFt+(a.endFt-a.startFt)*u;}
        return [{id:a.id,x:a.x+a.dx*distance/500,y:a.y+a.dy*distance/500,z:height,heading:a.route.heading,color:{cruise:'#2864a5',climb:'#168478',descent:'#8063ad'}[a.phase]}];
      }):[];
      if(options.demo){
        const sample=samplePlan(focus.plans.B0,options.demoSeconds).point??[500,35000];const [distance,height]=sample;
        demoFrames.splice(0,demoFrames.length,{id:'DEMO',demo:true,x:focus.x+focus.dx*distance/500,y:focus.y+focus.dy*distance/500,z:height,heading:focus.route.heading,color:'#003D7C'});
        const write=(id,value)=>{const el=byId(id);if(el)el.textContent=value;};
        write('demo-height',Math.round(height).toLocaleString()+' ft');write('demo-speed',focus.speed(height).toFixed(0)+' kt');write('demo-distance',distance.toFixed(1)+' / 500 NM');write('demo-time',timecode(options.demoSeconds));
        const progress=byId('demo-progress');if(progress){progress.max=focus.duration;progress.value=options.demoSeconds;}
      }
      viewer.update(demoFrames,options.demo?'DEMO':null);
      document.body.dataset.setupTime=String(options.time&&!options.demo);
      const english=document.documentElement.lang.startsWith('en');
      const setCell=(id,value)=>{const cell=byId(id);if(cell)cell.textContent=value;};
      setCell('setup-airborne',options.time ? demoFrames.length+' / 96' : '—');
      setCell('setup-selected-mach',(focus.plans.B0.mach+options.mach).toFixed(2));
      setCell('setup-selected-altitude',(focus.plans.B0.points[0][2]+options.altitude).toLocaleString()+' → '+(focus.plans.B0.points.at(-1)[2]+options.altitude).toLocaleString());
    } else viewer.update(frames.filter(frame=>visibleIds.has(frame.id)&&(filter === "all" || frame.change === filter)), selectedId);

    const flight = byAircraft.get(selectedId);
    const plan = flight.plans[mode];
    aircraftPreview.setColor(previewColors[plan.change]);
    dom.focusAircraft.disabled = !activeFlight;
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
    dom.outcome.parentElement.dataset.hit = plan.hit;
    dom.airborne.textContent = frames.filter(frame=>visibleIds.has(frame.id)&&(filter === "all" || frame.change === filter)).length + " / " + visibleAircraft.length;
    dom.inHotspots.textContent = translate("exposureCount", { count: exposedNow });
    dom.totalExposed.textContent = exposedInPlan + " / " + aircraft.length;

    const start=playbackStart(),finish=playbackEnd();
    dom.range.min=start;dom.range.max=finish;dom.maxTime.textContent='/ '+timecode(finish);
    compareRestart.textContent=document.documentElement.lang.startsWith('en')?'Restart':'重播';
    dom.ticks.hidden=view==='compare';
    const seconds = view==='compare'?t:Math.floor(t);
    dom.range.value = seconds;
    const clock = timecode(seconds);
    dom.range.setAttribute("aria-valuetext", clock);
    dom.currentTime.value = clock;
    scrub.style.setProperty("--progress", 100 * (t-start) / (finish-start) + "%");
  }

  function selectAircraft(id) {
    const next = Number(id);
    if (!byAircraft.has(next)) return;
    selectedId = next;
    setupUI.state.id=next;
    byId("shared-aircraft").value=next;
    if(filter !== "all" && byAircraft.get(next).plans[mode].change !== filter){filter="all";syncPlanControls();}
    dom.select.value = next;
    if (view === "compare") { setPlaying(false); t=playbackStart(); rebuildComparison(); }
    else if(view === "setup") {setPlaying(false);setupUI.render();}
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

  function switchPlan(next, fallback = null) {
    if (!availablePlans.has(next) || next === mode) return;
    setPlaying(false);
    mode = next;
    family = familyFor(mode);
    if (family === "baseline") baselineChoice = mode;
    else selectedArm = armFor(mode);
    fallbackSelection = fallback;
    if (filter !== "all" && byAircraft.get(selectedId).plans[mode].change !== filter) filter = "all";
    syncPlanControls();
    render();
  }

  function advance(now) {
    if (!playing) return;
    if (lastFrame !== null) {
      const elapsed = Math.min((now - lastFrame) / 1000, 0.12);
      t = Math.min(playbackEnd(), t + elapsed * Number(dom.speed.value));
      render();
    }
    lastFrame = now;
    if (t >= playbackEnd()) setPlaying(false);
    else frameRequest = requestAnimationFrame(advance);
  }

  dom.play.addEventListener("click", () => {
    if (!playing && t >= playbackEnd()) {
      t = playbackStart();
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
      switchPlan(button.dataset.mode);
    });
  }
  for (const button of familyButtons) {
    button.addEventListener("click", () => {
      const targetFamily = button.dataset.family;
      if (targetFamily === family) return;
      const options = planIds.filter((id) => familyFor(id) === targetFamily);
      if (!options.length) return;
      if (targetFamily === "baseline") {
        switchPlan(availablePlans.has(baselineChoice) ? baselineChoice : options[0]);
        return;
      }
      const matchingArm = options.find((id) => armFor(id) === selectedArm);
      const next = matchingArm ?? options.find((id) => armFor(id) === "C") ?? options[0];
      switchPlan(next, matchingArm ? null : { arm: selectedArm, selected: armFor(next), family: targetFamily });
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
      syncScaleControls();
      if (view === "fleet") fleetCamera = button.dataset.camera;
      for (const option of cameraButtons) option.setAttribute("aria-pressed", option === button);
    });
  }

  function refreshLanguage() {
    syncViewControls();
    syncScaleControls();
    viewer.setAccessibleLabel(translate("sceneDescription"));
    aircraftPreview.setAccessibleLabel(translate("modelAccessible"));
    dom.play.setAttribute("aria-label", translate(playing ? "pauseAction" : "playAction"));
    syncPlanControls();
    rebuildComparison();
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
  const response = await fetch("./scene-data.json", { cache: "no-store" });
  if (!response.ok) throw new Error("Scene data HTTP " + response.status);
  refreshLanguage = start(await response.json());
} catch (error) {
  console.error(error);
  dom.message.dataset.error = "true";
  errorKey = /webgl/i.test(String(error)) ? "webglError" : "dataError";
  dom.message.textContent = translate(errorKey);
}
