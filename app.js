import { referenceFlight } from './reference-flight.js?v=1';
import { createPlaybackControls } from './playback-controls.js?v=fleetfilters1';
import { createSetupControls } from './setup-controls.js?v=actionplay1';
import { createViewer } from "./viewer.js?v=batch3d1";
import { createAircraftPreview } from "./aircraft-model.js?v=pptaircraft1";
import { applyLanguage, setLanguage, t as translate } from "./i18n.js?v=selectionflow1";

import { interpolate, samplePlan, groupComparisonPlans, comparisonFrame, shortPlanName } from "./comparison-data.js?v=speed1";
import { createAircraftSelection, renderCohortComparison } from "./cohort-comparison.js?v=selectionflow1";

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
  compareSelect: byId("compare-aircraft"), compareMethod: byId("compare-method"),
  compareRows: byId("comparison-rows"), compareLegend: byId("comparison-legend"),
};
const modeButtons = Array.from(document.querySelectorAll("[data-mode]"));
const familyButtons = Array.from(document.querySelectorAll("[data-family]"));
const familyPanels = Array.from(document.querySelectorAll("[data-family-panel]"));
const cameraButtons = Array.from(document.querySelectorAll("[data-camera]"));
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
const scopeLabels = {
  all: "filterAll", changed: "filterChanged", altitude: "changeAltitude",
  speed: "changeSpeed", both: "filterBoth", none: "changeNone",
};
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
  const cohortAction = document.createElement('button');
  cohortAction.type = 'button';
  cohortAction.id = 'compare-cohort-action';
  cohortAction.className = 'fleet-table-action';
  const cohortBack = document.createElement('button');
  cohortBack.type = 'button';
  cohortBack.className = 'compare-aircraft-action';
  toolbar.append(cohortBack);
  const inspectorCompare = byId('inspector-compare');
  const experimentPanel = document.querySelector('.experiment-panel');
  const methodSwitch = experimentPanel.querySelector('.method-switch');
  context.append(experimentPanel, byId('comparison-controls'));
  const timeline=document.querySelector('.timeline');
  const compareRestart=document.createElement('button');compareRestart.id='compare-restart';compareRestart.className='toolbar-button';compareRestart.type='button';timeline.querySelector('.playback').append(compareRestart);
  toolbar.append(document.querySelector('.scene-context'));
  document.querySelector('.intro').remove();
  const resultArea=document.createElement('div');resultArea.className='workbench-results';
  const cohortResults = byId('cohort-results');
  const cohortTable = byId('cohort-table');
  workbench.append(resultArea);resultArea.append(document.querySelector('.results'),byId('comparison-results'),cohortResults);

  const trainingSeeds = [...new Set(Object.values(data.plans ?? {}).filter(p => p.algorithm === 'MAPPO').map(p => p.trainingSeed))].sort((a,b)=>a-b);
  const trainingControl = document.createElement('label');
  trainingControl.className = 'training-control';
  const trainingLabel = document.createElement('span');
  const trainingSelect = document.createElement('select'); trainingSelect.id = 'training-run';
  for (const seed of trainingSeeds) trainingSelect.add(new Option(String(seed), String(seed)));
  trainingControl.append(trainingLabel, trainingSelect); toolbar.insertBefore(trainingControl, toolbar.querySelector('.scene-context'));
  function selectTraining(seed) {
    for (const arm of ['C','CF','CT','CFT']) {
      const alias = 'MAPPO-' + arm, key = alias + '-s' + seed;
      if (!data.plans?.[key]) continue;
      data.plans[alias] = data.plans[key]; data.stats[alias] = data.stats[key];
      for (const flight of data.aircraft) flight.assignments[alias] = flight.assignments[key];
    }
  }
  if (trainingSeeds.length) selectTraining(trainingSeeds[0]);

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
  trainingSelect.addEventListener('change', () => {
    setPlaying(false); selectTraining(Number(trainingSelect.value));
    for (const key of planIds.filter(key => key.startsWith('MAPPO-'))) {
      const counts = {all:aircraft.length, none:0, altitude:0, speed:0, both:0};
      for (let i=0; i<aircraft.length; i++) {
        const candidate = candidateFor(data.aircraft[i], key), initial = aircraft[i].plans.B0;
        const altitudeOffset = Math.round(candidate.points[0][2] - initial.points[0][2]);
        const machOffset = Math.round((candidate.mach - initial.mach)*100)/100;
        const change = altitudeOffset ? (machOffset ? 'both':'altitude') : (machOffset ? 'speed':'none');
        aircraft[i].plans[key] = {...candidate, altitudeOffset, machOffset, change}; counts[change]++;
      }
      changeCounts[key] = counts;
    }
    syncPlanControls(); rebuildComparison(); render();
  });
  let selectedId = data.focalIds?.find((id) => byAircraft.has(id)) ?? aircraft[0].id;
  const interval = byAircraft.get(selectedId).plans.B0.hitIntervals[0];
  let t = interval ? Math.round((interval.start + interval.end) / 2) : data.entryWindow / 2;
  let mode = availablePlans.has("B2-C") ? "B2-C" : "B0";
  let family = familyFor(mode);
  let baselineChoice = family === "baseline" ? mode : "B0";
  let selectedArm = armFor(mode) ?? "C";
  let fallbackSelection = null;
  let playing = false;
  let frameRequest = 0;
  let lastFrame = null;
  let trueScale = false;
  let view = "setup", comparisonMethod = "B2", fleetCamera = "orbit";
  let comparisonGroups = [], comparisonRows = new Map();
  let cohort = null;
  let comparisonReturnView = 'fleet';
  let comparisonAircraft = [];
  let compareFleetTime = null;
  let pinnedAircraft = null;
  let pinnedSource = null;

  const viewer = createViewer(dom.scene, data, selectAircraft);
  const aircraftPreview = createAircraftPreview(dom.preview);
  const setupUI = createSetupControls(aircraft, () => {setPlaying(false);selectedId=setupUI.state.id;byId('shared-aircraft').value=selectedId;render();});
  const playbackUI=createPlaybackControls(aircraft,()=>render());
  setupUI.state.id=selectedId;
  sharedSelect.replaceChildren(...aircraft.map(a=>{const o=document.createElement('option');o.value=a.id;o.textContent='#'+a.id;return o;}));
  sharedSelect.value=selectedId;
  sharedSelect.addEventListener('change',()=>{selectAircraft(sharedSelect.value);setInspectorOpen(false);});
  let aircraftScope = 'changed', chooserKey = '';
  let listedAircraft = aircraft;
  const scopeSelect = document.createElement('select'); scopeSelect.id = 'aircraft-scope';
  scopeSelect.setAttribute('aria-describedby', 'fleet-aircraft-description');
  const fleetAircraftControls = document.createElement('section');
  fleetAircraftControls.className = 'fleet-aircraft-controls';
  const fleetAircraftRow = document.createElement('div');
  fleetAircraftRow.className = 'fleet-aircraft-controls-row';
  const aircraftScopeLabel = document.createElement('label');
  aircraftScopeLabel.className = 'fleet-control-label';
  aircraftScopeLabel.htmlFor = scopeSelect.id;
  const keepList = document.createElement('button');
  keepList.type = 'button';
  keepList.className = 'fleet-keep-action';
  const aircraftSelectionHost = document.createElement('div');
  aircraftSelectionHost.id = 'aircraft-selection';
  const fleetAircraftDescription = document.createElement('p');
  fleetAircraftDescription.id = 'fleet-aircraft-description';
  fleetAircraftDescription.className = 'fleet-aircraft-description';
  fleetAircraftDescription.setAttribute('role', 'status');
  fleetAircraftRow.append(aircraftScopeLabel, scopeSelect, keepList, aircraftSelectionHost, cohortAction);
  fleetAircraftControls.append(fleetAircraftRow, fleetAircraftDescription);
  experimentPanel.after(fleetAircraftControls);

  function fixAircraftList(flights, sourceScope = null, seekToEntry = false) {
    const startingSelection = !pinnedAircraft?.length;
    pinnedAircraft = flights;
    pinnedSource = sourceScope ? {
      mode, scope: sourceScope, run: family === 'MAPPO' ? trainingSelect.value : '',
    } : null;
    setPlaying(false);
    if (seekToEntry && startingSelection && flights.length && !flights.some(isAirborneInPlan)) t = firstEntry(flights);
    chooserKey = '';
    render();
  }
  function followPlanFilter() {
    pinnedAircraft = null;
    pinnedSource = null;
    chooserKey = '';
    render();
  }
  const aircraftSelection = createAircraftSelection(aircraftSelectionHost, {
    translate,
    onChange(ids, sourceScope) {
      fixAircraftList(ids.map(id => byAircraft.get(id)), sourceScope, true);
    },
  });
  keepList.addEventListener('click', () => {
    if (pinnedAircraft !== null) followPlanFilter();
    else if (listedAircraft.length) fixAircraftList(listedAircraft, aircraftScope);
  });
  function isAirborneInPlan(flight) {
    const points = flight.plans[mode].points;
    return points[0][0] <= t && t <= points.at(-1)[0];
  }
  function firstEntry(flights) {
    return Math.min(...flights.map(flight => flight.plans[mode].points[0][0]));
  }
  function scopedAircraft(scope) {
    if (scope === 'all') return aircraft;
    return aircraft.filter(flight => {
      const change = flight.plans[mode].change;
      return scope === 'changed' ? change !== 'none' : change === scope;
    });
  }
  function syncFleetAircraftControls() {
    const fixed = pinnedAircraft !== null;
    const scopes = new Map(Object.keys(scopeLabels).map(scope => [scope, scopedAircraft(scope)]));
    const filtered = scopes.get(aircraftScope);
    const planOptions = document.createElement('optgroup');
    planOptions.label = translate('aircraftPlanFilter');
    planOptions.append(...Array.from(scopes, ([scope, flights]) =>
      new Option(`${translate(scopeLabels[scope])} (${flights.length})`, scope)));
    scopeSelect.replaceChildren(planOptions);
    if (fixed) {
      scopeSelect.prepend(new Option(translate('aircraftFixedOption', { count: pinnedAircraft.length }), 'fixed'));
    }
    scopeSelect.value = fixed ? 'fixed' : aircraftScope;
    aircraftScopeLabel.textContent = translate('aircraftFilter');
    keepList.textContent = translate(fixed ? 'aircraftFollowPlan' : 'aircraftKeepList');
    keepList.disabled = !fixed && !filtered.length;
    if (!fixed) {
      fleetAircraftDescription.textContent = translate(filtered.length ? 'aircraftFilterHint' : 'aircraftFilterEmpty');
    } else if (!pinnedAircraft.length) {
      fleetAircraftDescription.textContent = translate('aircraftFixedEmpty');
    } else if (pinnedSource) {
      fleetAircraftDescription.textContent = translate('aircraftFixedFrom', {
        plan: planName(pinnedSource.mode, pinnedSource.run),
        filter: translate(scopeLabels[pinnedSource.scope]),
      });
    } else {
      fleetAircraftDescription.textContent = translate('aircraftFixedHint');
    }
    aircraftSelection.render(
      aircraft,
      pinnedAircraft?.map(flight => flight.id) ?? null,
      scopes.get('changed').map(flight => flight.id),
    );
    return fixed ? pinnedAircraft : filtered;
  }
  function syncAircraftChooser() {
    const key = [view, mode, aircraftScope, trainingSelect.value, document.documentElement.lang].join(':');
    if (key !== chooserKey) {
      chooserKey = key;
      sharedText.textContent = translate('aircraftId');
      if (view === 'fleet') listedAircraft = syncFleetAircraftControls();
      else listedAircraft = view === 'compare' ? comparisonAircraft : aircraft;

      const empty = new Option(translate("noMatchingAircraft"), "");
      sharedSelect.replaceChildren(...(listedAircraft.length
        ? listedAircraft.map(flight => new Option("#" + flight.id, flight.id))
        : [empty]));
      dom.select.replaceChildren(...listedAircraft.map(flight => new Option(translate("aircraftOption", {
        id: flight.id,
        change: translate(changeKey[flight.plans[mode].change]),
      }), flight.id)));
      const noMatches = !listedAircraft.length;
      sharedSelect.disabled = dom.select.disabled = noMatches;
      cohortAction.disabled = dom.toggleInspector.disabled = view === 'fleet' && noMatches;
      if (noMatches) setInspectorOpen(false);
    }
    if (listedAircraft.length && !listedAircraft.some(flight => flight.id === selectedId)) {
      const airborne = view === 'fleet' && listedAircraft.find(isAirborneInPlan);
      selectedId = (airborne || listedAircraft[0]).id;
      setupUI.state.id = selectedId;
      if (view === 'compare') {
        setPlaying(false);
        t = playbackStart();
        rebuildComparison();
      }
    }
    sharedSelect.value = dom.select.value = listedAircraft.length ? String(selectedId) : "";
    return listedAircraft;
  }
  scopeSelect.onchange = () => {
    if (scopeSelect.value === 'fixed') return;
    aircraftScope = scopeSelect.value;
    followPlanFilter();
  };
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

  function planName(key, run) {
    const name = legacyPlanLabels[key]
      ? translate(legacyPlanLabels[key])
      : translate("planSummary", {
        algorithm: translate(familyLabels[familyFor(key)]),
        arm: shortPlanName(key),
      });
    return run ? name + translate("cohortRun", { run }) : name;
  }

  function renderCohort() {
    byId("cohort-source").textContent = translate(cohort.sourceScope ? "cohortSource" : "cohortSourceManual", {
      count: cohort.flights.length,
      plan: planName(cohort.sourceMode, cohort.sourceRun),
      filter: cohort.sourceScope ? translate(scopeLabels[cohort.sourceScope]) : '',
    });
    const columns = planIds.map(key => ({
      key,
      label: shortPlanName(key),
      family: translate(familyLabels[familyFor(key)]),
    }));
    renderCohortComparison(cohortTable, cohort.flights, columns, translate, id => {
      selectedId = id;
      switchView('compare');
      sharedSelect.focus();
    });
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
  const replayStart = () => view === 'fleet' && pinnedAircraft?.length ? firstEntry(pinnedAircraft) : playbackStart();
  compareRestart.addEventListener('click',()=>{setPlaying(false);t=replayStart();render();});
  function syncViewControls() {
    if(view!=="setup")setupUI.pauseDemo();
    const showingCohort = view === 'cohort';
    playbackUI.render(showingCohort ? 'setup' : view);
    const comparing = view === "compare";
    const setting = view === "setup";
    const fleet = view === 'fleet';
    (comparing?byId('comparison-controls'):workspace).append(timeline);
    compareAction.hidden = !comparing;
    cohortBack.hidden = !showingCohort;
    cohortBack.textContent = translate("cohortBackToFleet");
    cohortAction.textContent = translate("cohortOpen");
    sharedLabel.hidden = !setting && !comparing;
    fleetAircraftControls.hidden = !fleet;
    trainingControl.classList.toggle('plan-training-control', fleet);
    if (fleet) methodSwitch.append(trainingControl);
    else toolbar.insertBefore(trainingControl, toolbar.querySelector('.scene-context'));
    context.hidden = workspace.hidden = showingCohort;
    cohortResults.hidden = !showingCohort;
    setupUI.host.hidden=!setting;
    setupUI.state.id=selectedId;
    setupUI.render();
    sharedSelect.value = selectedId;
    byId("setup-view").textContent=document.documentElement.lang.startsWith("en")?"Scene demo":"场景演示";
    document.body.dataset.view = view;
    dom.scene.closest(".workspace").dataset.view = view;
    experimentPanel.hidden = document.querySelector('.results').hidden = !fleet;
    for (const id of ["comparison-controls", "comparison-caption", "comparison-results", "comparison-legend", "compare-summary", "comparison-source"]) byId(id).hidden = !comparing;
    document.querySelector('.stage-caption').hidden = comparing || setting;
    document.querySelector('.stage-bottom > .legend:not(.comparison-legend)').hidden = comparing || setting;
    dom.toggleInspector.hidden = dom.planSummary.hidden = dom.planSource.hidden = comparing || setting || showingCohort;
    for (const button of document.querySelectorAll('[data-view]')) {
      if (button.tagName === "BUTTON") button.setAttribute("aria-pressed", (button.dataset.view === view)||(button.dataset.view==='fleet'&&(comparing||showingCohort)));
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
    if (view === next || !["fleet", "compare", "setup", "cohort"].includes(next)) return;
    const previous = view;
    setPlaying(false); setInspectorOpen(false);
    aircraftSelection.close();
    document.querySelector('.display-settings').open = false;
    viewer.setSetup(null);
    view = next;
    if (view === "compare") {
      comparisonReturnView = previous === 'cohort' ? 'cohort' : 'fleet';
      comparisonAircraft = previous === 'cohort' ? cohort.flights : listedAircraft;
      compareFleetTime = previous === 'fleet' ? t : null;
      comparisonMethod = family === "MAPPO" ? "MAPPO" : "B2";
      t=playbackStart();
    } else {
      viewer.setComparison(null);
      if (view === 'fleet') {
        if (previous === 'cohort' || (previous === 'compare' && comparisonReturnView === 'cohort')) t = cohort.time;
        else if (previous === 'compare' && compareFleetTime !== null) t = compareFleetTime;
      }
    }
    syncViewControls(); syncPlanControls(); rebuildComparison();
    if (view !== 'cohort') {
      viewer.setView("orbit");
      syncScaleControls();
      const cameraName = viewer.getView();
      cameraButtons.forEach(button => button.setAttribute("aria-pressed", button.dataset.camera === cameraName));
    }
    render();
  }
  compareAction.addEventListener('click', () => {
    switchView(comparisonReturnView);
    if (view === 'cohort') cohortTable.querySelector(`[data-cohort-aircraft="${selectedId}"]`)?.focus();
    else dom.toggleInspector.focus();
  });
  cohortBack.addEventListener('click', () => {
    switchView('fleet');
    cohortAction.focus();
  });
  cohortAction.addEventListener('click', () => {
    if (view !== 'fleet' || !listedAircraft.length) return;
    cohort = {
      flights: listedAircraft.slice(),
      sourceMode: pinnedSource?.mode ?? mode,
      sourceScope: pinnedAircraft === null ? aircraftScope : pinnedSource?.scope,
      sourceRun: pinnedSource ? pinnedSource.run : family === 'MAPPO' ? trainingSelect.value : '',
      time: t,
    };
    switchView('cohort');
    byId('cohort-title').focus();
  });
  inspectorCompare.addEventListener('click', () => {
    switchView('compare');
    sharedSelect.focus();
  });
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
    const englishUI=document.documentElement.lang.startsWith('en');
    const showingMappo = view === 'cohort' ? planIds.some(key => familyFor(key) === 'MAPPO')
      : view === 'compare' ? comparisonMethod === 'MAPPO' : family === 'MAPPO';
    trainingControl.hidden = !trainingSeeds.length || view === 'setup' || !showingMappo;
    trainingLabel.textContent = englishUI ? 'Training run' : '训练批次';
    if (view === 'cohort') {
      renderCohort();
      return;
    }
    const visibleAircraft = syncAircraftChooser();
    const visibleIds = new Set(visibleAircraft.map(flight => flight.id));
    const manualReplay = view === 'fleet' && pinnedAircraft !== null;
    compareAction.textContent = translate(comparisonReturnView === 'cohort' ? "cohortBackToBatch" : "cohortBackToFleet");
    inspectorCompare.textContent = translate("cohortSelectAircraft", { id: selectedId });
    viewer.setPlaybackDisplay(view === 'setup' ? null : playbackUI.settings[view],
      byAircraft.get(selectedId), visibleAircraft, mode, view, trainingSelect.value);
    const frames = [];
    let activeFlight;
    let exposedNow = 0;
    let exposedInPlan = 0;
    for (const flight of aircraft) {
      const plan = flight.plans[mode];
      if (plan.hit) exposedInPlan++;
      if (view === 'fleet' && !visibleIds.has(flight.id)) continue;
      const points = plan.points;
      if (t < points[0][0] || t > points.at(-1)[0]) continue;
      const [s, z] = interpolate(points, t);
      const exposed = plan.hitIntervals.some((span) => t >= span.start && t <= span.end);
      const frame = {
        id: flight.id,
        x: flight.x + flight.dx * s / flight.length,
        y: flight.y + flight.dy * s / flight.length,
        z, heading: flight.route.heading, exposed, change: plan.change, showId: manualReplay,
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
      if(options.demo){
        const key=[focus.id,options.demoPhase,options.demoMach,options.demoCandidate].join(':');
        if(key!==demoFlightKey){
          demoFlightKey=key;
          if(options.demoCandidate!==null){
            const candidate=focus.candidates.find(c=>c.i===8-options.demoCandidate&&c.valid!==false)??focus.plans.B0;
            const start=candidate.points[0][0];
            demoFlight={...focus,plans:{B0:{...candidate,points:candidate.points.map(([time,s,h])=>[time-start,s,h]),hitIntervals:candidate.hitIntervals.map(span=>({...span,start:span.start-start,end:span.end-start}))}},duration:candidate.points.at(-1)[0]-start,speed:height=>candidate.mach*Math.sqrt(1.4*287.05287*(288.15-.0065*Math.min(height*.3048,11000)))/.514444};
          }else demoFlight=referenceFlight(focus,options.demoPhase,options.demoMach);
        }
        focus=demoFlight;options.demoDuration=focus.duration;
      }
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
    } else viewer.update(frames, selectedId);

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
    dom.airborne.textContent = frames.length + " / " + visibleAircraft.length;
    dom.inHotspots.textContent = translate("exposureCount", { count: exposedNow });
    dom.totalExposed.textContent = exposedInPlan + " / " + aircraft.length;

    const start=playbackStart(),finish=playbackEnd();
    dom.range.min=start;dom.range.max=finish;dom.maxTime.textContent='/ '+timecode(finish);
    compareRestart.hidden = view !== 'compare' && !(manualReplay && visibleAircraft.length);
    compareRestart.textContent = translate(manualReplay ? "restartSelectedAircraft" : "restartReplay");
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
    dom.select.value = next;
    if (view === "compare") { setPlaying(false); t=playbackStart(); rebuildComparison(); }
    else if(view === "setup") {setPlaying(false);setupUI.pauseDemo();setupUI.state.demoSeconds=0;setupUI.render();}
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
      t = replayStart();
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
  dom.range.disabled = dom.play.disabled = false;
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
