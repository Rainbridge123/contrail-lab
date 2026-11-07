import { staticMessages } from "./locale-static.js";

const dynamicMessages = {
  zh: {
    aircraftLabel: "飞机 #{id}",
    aircraftOption: "飞机 #{id} · {change}",
    flightDescription: "A320 · {heading}° 航路 · {phase}型",
    phaseCruise: "巡航",
    phaseClimb: "爬升",
    phaseDescent: "下降",
    changeNone: "未改",
    changeAltitude: "仅高度",
    changeSpeed: "仅 Mach",
    changeBoth: "两项",
    psiBaseline: "P₀ 基准",
    psiCompared: "较 P₀ {delta}%",
    flightExposed: "热点内",
    flightActive: "飞行中",
    flightBefore: "待入场",
    flightAfter: "已离场",
    altitudeAdjustment: "高度 {amount} ft",
    machAdjustment: "Mach {amount}",
    planExposed: "这条轨迹会触碰热点",
    planClear: "这条轨迹避开全部热点",
    exposureCount: "{count} 架",
    playAction: "播放",
    pauseAction: "暂停",
    sceneDescription: "可旋转的三维空域，显示飞机、航线和热点",
    webglError: "这个浏览器无法初始化三维空域，请用支持 WebGL 2 的浏览器打开。",
    dataError: "场景加载失败，请刷新页面重试。",
  },
  en: {
    aircraftLabel: "Aircraft #{id}",
    aircraftOption: "#{id} · {change}",
    flightDescription: "A320 · {heading}° route · {phase} profile",
    phaseCruise: "Cruise",
    phaseClimb: "Climb",
    phaseDescent: "Descent",
    changeNone: "Unchanged",
    changeAltitude: "Altitude only",
    changeSpeed: "Mach only",
    changeBoth: "Altitude & Mach",
    psiBaseline: "P₀ baseline",
    psiCompared: "{delta}% vs P₀",
    flightExposed: "In hotspot",
    flightActive: "Airborne",
    flightBefore: "Awaiting entry",
    flightAfter: "Exited",
    altitudeAdjustment: "Alt {amount} ft",
    machAdjustment: "Mach {amount}",
    planExposed: "This trajectory intersects a hotspot",
    planClear: "This trajectory avoids all hotspots",
    exposureCount: "{count} aircraft",
    playAction: "Play",
    pauseAction: "Pause",
    sceneDescription: "Rotatable 3D airspace showing aircraft, routes, and hotspots",
    webglError: "The 3D view could not start. Open this page in a browser that supports WebGL 2.",
    dataError: "The scenario failed to load. Refresh the page to try again.",
  },
};

const locales = { zh: "zh-Hans", en: "en" };
const storageKey = "contrail-lab-language";
let language = "zh";
try {
  if (localStorage.getItem(storageKey) === "en") language = "en";
} catch {
  // The switch still works if storage is unavailable.
}

export function t(key, values) {
  const text = dynamicMessages[language][key] ?? staticMessages[language][key];
  return values ? text.replace(/\{(\w+)\}/g, (_, field) => String(values[field])) : text;
}

export function setLanguage(next) {
  if (!Object.hasOwn(locales, next)) return;
  language = next;
  try {
    localStorage.setItem(storageKey, language);
  } catch {
    // The current tab can still use the chosen language.
  }
}

export function applyLanguage() {
  document.documentElement.lang = locales[language];
  document.title = t("pageTitle");
  for (const element of document.querySelectorAll("[data-i18n]")) {
    element.textContent = t(element.getAttribute("data-i18n"));
  }
  for (const attribute of ["aria-label", "title", "content"]) {
    const keyAttribute = "data-i18n-" + attribute;
    for (const element of document.querySelectorAll("[" + keyAttribute + "]")) {
      element.setAttribute(attribute, t(element.getAttribute(keyAttribute)));
    }
  }
  for (const button of document.querySelectorAll("[data-language]")) {
    button.setAttribute("aria-pressed", button.dataset.language === language);
  }
}
