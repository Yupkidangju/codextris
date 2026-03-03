/*
 * [v3.19.0] 모바일 독립 웹앱 메인 엔트리
 *
 * 변경사항:
 *   - 데스크톱 main.js 의존을 제거하고 모바일 전용 부트스트랩으로 전환
 *   - 공용 전투 엔진/오디오/배경 효과만 공유하고 HUD/오버레이/입력은 모바일 전용으로 재구성
 */

import { createGame } from "../game/core/engine.js";
import { AudioEngine } from "../audio/midi_player.js";
import { BackgroundFx } from "../render/background.js";
import { ScreenImpact } from "../render/effects.js";
import { installTouch } from "../input/touch.js";
import { getFeverStatus } from "../game/battle/fever.js";
import { INPUT_PRESETS } from "../game/core/constants.js";
import { createMobileCanvasManager } from "./mobile_renderer.js";

const SETTINGS_STORAGE_KEY = "codextirs.mobile.settings.v3.20.0";
const RECENT_BATTLE_KEY = "codextirs.mobile.recentBattle.v3.20.0";
const SESSION_EXPORT_VERSION = "3.20.0";
const FEVER_SPEED = 1.3;

const DIFFICULTIES = [
  { name: "병아리", reaction: "800ms", tier: "초보" },
  { name: "하수인", reaction: "600ms", tier: "입문" },
  { name: "기사", reaction: "450ms", tier: "표준" },
  { name: "마왕군주", reaction: "300ms", tier: "상급" },
  { name: "데몬킹", reaction: "180ms", tier: "지옥" },
];

const MOBILE_MISSIONS = [
  { id: "hold", label: "홀드 1회 사용", hint: "H 버튼 또는 HOLD 버튼" },
  { id: "skill", label: "스킬 1회 사용", hint: "게이지 MAX 후 1 / 2 / 3" },
  { id: "incoming", label: "INCOMING 확인", hint: "대기 공격 또는 특수 패턴 읽기" },
  { id: "combo", label: "10콤보 달성", hint: "피버 진입 기준" },
  { id: "finish", label: "1판 완주", hint: "승리 또는 패배까지 진행" },
];

const BRIEFING_STEPS = [
  {
    title: "BOARD CONTROL",
    text: "좌측은 HOLD, 우측은 NEXT입니다. 하단 버튼으로 이동, 회전, 스킬, 홀드를 즉시 조작합니다.",
    highlights: ["HOLD", "NEXT", "하단 2행 터치 패드"],
  },
  {
    title: "STATUS / INCOMING",
    text: "STATUS는 현재 디버프와 강화 상태를, INCOMING은 곧 들어올 공격과 규칙 파괴를 보여줍니다.",
    highlights: ["STATUS", "INCOMING", "카운트다운 칩"],
  },
  {
    title: "SPECIAL / FEVER",
    text: "스페셜 게이지가 차면 스킬을 발동할 수 있습니다. 10콤보 이상이면 피버가 발동합니다.",
    highlights: ["SPECIAL", "SKILL 1~3", "FEVER"],
  },
  {
    title: "NEON SHIFT",
    text: "T-Spin, Perfect Clear, 피버, 보스 페이즈 상승 시 NEON SHIFT가 열립니다. 이 구간은 추가 압박 기회입니다.",
    highlights: ["SHIFT", "RESIDUE", "LAYER COUNTER"],
  },
];

const dom = {
  body: document.body,
  app: document.getElementById("app"),
  bgFx: document.getElementById("bgFx"),
  startScreen: document.getElementById("startScreen"),
  stage: document.getElementById("stage"),
  mobileControls: document.getElementById("mobileControls"),
  playerCanvas: document.getElementById("playerCanvas"),
  aiCanvas: document.getElementById("aiCanvas"),
  holdCanvas: document.getElementById("holdCanvas"),
  nextCanvases: [
    document.getElementById("next1Canvas"),
    document.getElementById("next2Canvas"),
    document.getElementById("next3Canvas"),
    document.getElementById("next4Canvas"),
    document.getElementById("next5Canvas"),
  ],
  mobileScore: document.getElementById("mobileScore"),
  mobileCombo: document.getElementById("mobileCombo"),
  mobileLevel: document.getElementById("mobileLevel"),
  mobileGaugeFill: document.getElementById("mobileGaugeFill"),
  difficultyGrid: document.getElementById("difficultyGrid"),
  difficultyBadge: document.getElementById("difficultyBadge"),
  aiLevelValue: document.getElementById("aiLevelValue"),
  bossHpFill: document.getElementById("bossHpFill"),
  bossHpValue: document.getElementById("bossHpValue"),
  statusCountValue: document.getElementById("statusCountValue"),
  statusEffects: document.getElementById("statusEffects"),
  incomingValue: document.getElementById("incomingValue"),
  incomingQueue: document.getElementById("incomingQueue"),
  battleCallout: document.getElementById("battleCallout"),
  battleCalloutTitle: document.getElementById("battleCalloutTitle"),
  battleCalloutSubtitle: document.getElementById("battleCalloutSubtitle"),
  comboDisplay: document.getElementById("comboDisplay"),
  comboText: document.getElementById("comboText"),
  rotateHint: document.getElementById("rotateHint"),
  devPanel: document.getElementById("devDebugPanel"),
  touchDebugAction: document.getElementById("touchDebugAction"),
  touchDebugMeta: document.getElementById("touchDebugMeta"),
  devFpsMeta: document.getElementById("devFpsMeta"),
  devAudioMeta: document.getElementById("devAudioMeta"),
  devGameMeta: document.getElementById("devGameMeta"),
  devErrorMeta: document.getElementById("devErrorMeta"),
  missionChecklist: document.getElementById("missionChecklist"),
  missionProgressValue: document.getElementById("missionProgressValue"),
  recentBattleCard: document.getElementById("recentBattleCard"),
  recentBattleResult: document.getElementById("recentBattleResult"),
  recentBattleMeta: document.getElementById("recentBattleMeta"),
  startBattleBtn: document.getElementById("startBattleBtn"),
  briefingOpenBtn: document.getElementById("briefingOpenBtn"),
  startBtn: document.getElementById("startBtn"),
  pauseBtn: document.getElementById("pauseBtn"),
  settingsBtn: document.getElementById("settingsBtn"),
  pauseOverlay: document.getElementById("pauseOverlay"),
  resumeBtn: document.getElementById("resumeBtn"),
  restartBtn: document.getElementById("restartBtn"),
  titleBtn: document.getElementById("titleBtn"),
  settingsOverlay: document.getElementById("settingsOverlay"),
  settingsCloseBtn: document.getElementById("settingsCloseBtn"),
  masterVolumeSlider: document.getElementById("masterVolumeSlider"),
  masterVolumeValue: document.getElementById("masterVolumeValue"),
  bgmVolumeSlider: document.getElementById("bgmVolumeSlider"),
  bgmVolumeValue: document.getElementById("bgmVolumeValue"),
  sfxVolumeSlider: document.getElementById("sfxVolumeSlider"),
  sfxVolumeValue: document.getElementById("sfxVolumeValue"),
  voiceVolumeSlider: document.getElementById("voiceVolumeSlider"),
  voiceVolumeValue: document.getElementById("voiceVolumeValue"),
  settingsMuteBtn: document.getElementById("settingsMuteBtn"),
  settingsTrackBtn: document.getElementById("settingsTrackBtn"),
  settingsTestBtn: document.getElementById("settingsTestBtn"),
  settingsCalibrateBtn: document.getElementById("settingsCalibrateBtn"),
  settingsLowStimAudioBtn: document.getElementById("settingsLowStimAudioBtn"),
  presetBtns: Array.from(document.querySelectorAll(".preset-btn")),
  bgmStateValue: document.getElementById("bgmStateValue"),
  trackNameValue: document.getElementById("trackNameValue"),
  musicDriveValue: document.getElementById("musicDriveValue"),
  bossLayerValue: document.getElementById("bossLayerValue"),
  shakeSlider: document.getElementById("shakeSlider"),
  shakeValue: document.getElementById("shakeValue"),
  settingsReducedFxBtn: document.getElementById("settingsReducedFxBtn"),
  settingsLowPowerBtn: document.getElementById("settingsLowPowerBtn"),
  settingsBriefingBtn: document.getElementById("settingsBriefingBtn"),
  settingsDevPanelBtn: document.getElementById("settingsDevPanelBtn"),
  settingsExportSessionBtn: document.getElementById("settingsExportSessionBtn"),
  settingsClearSessionBtn: document.getElementById("settingsClearSessionBtn"),
  mobileScaleSlider: document.getElementById("mobileScaleSlider"),
  mobileScaleValue: document.getElementById("mobileScaleValue"),
  touchRepeatSlider: document.getElementById("touchRepeatSlider"),
  touchRepeatValue: document.getElementById("touchRepeatValue"),
  layoutBtns: Array.from(document.querySelectorAll(".layout-btn")),
  settingsHapticLevelBtn: document.getElementById("settingsHapticLevelBtn"),
  settingsTouchDebugBtn: document.getElementById("settingsTouchDebugBtn"),
  briefingOverlay: document.getElementById("briefingOverlay"),
  briefingTitle: document.getElementById("briefingTitle"),
  briefingText: document.getElementById("briefingText"),
  briefingHighlights: document.getElementById("briefingHighlights"),
  briefingStepValue: document.getElementById("briefingStepValue"),
  briefingDots: document.getElementById("briefingDots"),
  briefingSkipBtn: document.getElementById("briefingSkipBtn"),
  briefingNextBtn: document.getElementById("briefingNextBtn"),
  resultOverlay: document.getElementById("resultOverlay"),
  resultEyebrow: document.getElementById("resultEyebrow"),
  resultTitle: document.getElementById("resultTitle"),
  resultSummary: document.getElementById("resultSummary"),
  resultFeedbackList: document.getElementById("resultFeedbackList"),
  resultScore: document.getElementById("resultScore"),
  resultLines: document.getElementById("resultLines"),
  resultMaxCombo: document.getElementById("resultMaxCombo"),
  resultTSpins: document.getElementById("resultTSpins"),
  resultTetrises: document.getElementById("resultTetrises"),
  resultPerfects: document.getElementById("resultPerfects"),
  resultRestartBtn: document.getElementById("resultRestartBtn"),
  resultBriefingBtn: document.getElementById("resultBriefingBtn"),
  resultTitleBtn: document.getElementById("resultTitleBtn"),
};

const defaultSettings = {
  difficulty: "기사",
  audioPreset: "arcade",
  masterVolume: 78,
  bgmVolume: 68,
  sfxVolume: 92,
  voiceVolume: 88,
  muted: false,
  lowStimAudio: false,
  shake: 100,
  reducedFx: false,
  lowPower: false,
  devPanel: false,
  mobileScale: 110,
  touchRepeat: 75,
  layout: "default",
  hapticLevel: "normal",
  touchDebug: false,
};

const appState = {
  selectedDifficulty: defaultSettings.difficulty,
  activeOverlay: null,
  briefingStep: 0,
  battleStarted: false,
  battleFinished: false,
  lastHudAt: 0,
  lastSummary: null,
  missions: Object.fromEntries(MOBILE_MISSIONS.map((mission) => [mission.id, false])),
  diagnostics: {
    startedAt: Date.now(),
    frameDrops: 0,
    maxFrameMs: 0,
    avgFps: 0,
    minFps: 999,
    inputPresses: 0,
    inputRepeats: 0,
    bufferedInputs: 0,
    droppedInputs: 0,
    lastError: "none",
    errors: [],
  },
  touchDebug: {
    action: "IDLE",
    presses: 0,
    repeats: 0,
    lastMs: 0,
  },
  rotateHintTimer: null,
  lastFrameAt: performance.now(),
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { ...defaultSettings };
    return { ...defaultSettings, ...JSON.parse(raw) };
  } catch {
    return { ...defaultSettings };
  }
}

function saveSettings(settings) {
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

function loadRecentBattle() {
  try {
    const raw = localStorage.getItem(RECENT_BATTLE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveRecentBattle(summary) {
  localStorage.setItem(RECENT_BATTLE_KEY, JSON.stringify(summary));
}

const uiSettings = loadSettings();

const audio = new AudioEngine();
const bgFx = new BackgroundFx(dom.bgFx);
const impact = new ScreenImpact(dom.app);

const game = createGame({
  playerCanvas: dom.playerCanvas,
  aiCanvas: dom.aiCanvas,
  onHud: handleHudUpdate,
  onEvent: handleGameEvent,
  getInputTuning() {
    return {
      ...INPUT_PRESETS.mobileSafe,
      softDropRepeatMs: Number(uiSettings.touchRepeat) || INPUT_PRESETS.mobileSafe.softDropRepeatMs,
    };
  },
});

const canvasManager = createMobileCanvasManager({
  playerCanvas: dom.playerCanvas,
  aiCanvas: dom.aiCanvas,
  holdCanvas: dom.holdCanvas,
  nextCanvases: dom.nextCanvases,
  playerWrapSelector: ".player-lane .board-wrap",
  aiWrapSelector: ".ai-lane .board-wrap",
});

function setOverlayVisible(element, visible) {
  if (!element) return;
  element.classList.toggle("visible", visible);
  element.setAttribute("aria-hidden", visible ? "false" : "true");
}

function setHidden(element, hidden) {
  if (!element) return;
  element.classList.toggle("hidden", hidden);
}

function isOverlayOpen() {
  return !!appState.activeOverlay;
}

function isGameplayInputBlocked() {
  return isOverlayOpen() || dom.startScreen.classList.contains("hidden") === false;
}

function pauseForOverlay(name) {
  if (appState.activeOverlay === name) return;
  if (game.isRunning()) {
    game.pause();
  }
  appState.activeOverlay = name;
}

function resumeFromOverlay(name) {
  if (appState.activeOverlay !== name) return;
  appState.activeOverlay = null;
  if (appState.battleStarted && !appState.battleFinished && !game.isRunning()) {
    game.pause();
  }
}

function formatPercent(value) {
  return `${Math.round(clamp(value, 0, 100))}%`;
}

function updateDifficultyUi() {
  dom.difficultyBadge.textContent = `AI: ${appState.selectedDifficulty}`;
  dom.aiLevelValue.textContent = appState.selectedDifficulty;
  dom.difficultyGrid.querySelectorAll(".diff-btn").forEach((button) => {
    button.classList.toggle("active", button.dataset.difficulty === appState.selectedDifficulty);
  });
}

function syncRecentBattleCard() {
  const recent = loadRecentBattle();
  if (!recent) {
    setHidden(dom.recentBattleCard, true);
    return;
  }
  setHidden(dom.recentBattleCard, false);
  dom.recentBattleResult.textContent = recent.result;
  dom.recentBattleMeta.textContent = recent.meta;
}

function syncMissionChecklist() {
  dom.missionChecklist.innerHTML = "";
  let completed = 0;
  for (const mission of MOBILE_MISSIONS) {
    const done = !!appState.missions[mission.id];
    if (done) completed += 1;
    const item = document.createElement("div");
    item.className = `mission-item${done ? " done" : ""}`;
    item.innerHTML = `
      <span class="mission-dot"></span>
      <div class="mission-copy">
        <strong>${mission.label}</strong>
        <small>${mission.hint}</small>
      </div>
    `;
    dom.missionChecklist.appendChild(item);
  }
  dom.missionProgressValue.textContent = `${completed} / ${MOBILE_MISSIONS.length}`;
}

function completeMission(id) {
  if (!appState.missions[id]) {
    appState.missions[id] = true;
    syncMissionChecklist();
  }
}

function syncRotateHint() {
  setHidden(dom.rotateHint, true);
  if (appState.rotateHintTimer) {
    clearTimeout(appState.rotateHintTimer);
    appState.rotateHintTimer = null;
  }
}

function showBattleCallout(title, subtitle = "") {
  dom.battleCalloutTitle.textContent = title;
  dom.battleCalloutSubtitle.textContent = subtitle;
  dom.battleCallout.classList.remove("show");
  void dom.battleCallout.offsetWidth;
  dom.battleCallout.classList.add("show");
  clearTimeout(showBattleCallout.timer);
  showBattleCallout.timer = setTimeout(() => dom.battleCallout.classList.remove("show"), 1200);
}

function showCombo(combo) {
  if (combo <= 1) return;
  dom.comboText.textContent = `x${combo}`;
  dom.comboDisplay.classList.remove("show");
  void dom.comboDisplay.offsetWidth;
  dom.comboDisplay.classList.add("show");
  clearTimeout(showCombo.timer);
  showCombo.timer = setTimeout(() => dom.comboDisplay.classList.remove("show"), 900);
}

function renderBriefingStep() {
  const step = BRIEFING_STEPS[appState.briefingStep] || BRIEFING_STEPS[0];
  dom.briefingTitle.textContent = step.title;
  dom.briefingText.textContent = step.text;
  dom.briefingStepValue.textContent = `${appState.briefingStep + 1} / ${BRIEFING_STEPS.length}`;
  dom.briefingHighlights.innerHTML = "";
  dom.briefingDots.innerHTML = "";
  step.highlights.forEach((text) => {
    const chip = document.createElement("span");
    chip.className = "briefing-chip";
    chip.textContent = text;
    dom.briefingHighlights.appendChild(chip);
  });
  BRIEFING_STEPS.forEach((_, index) => {
    const dot = document.createElement("span");
    dot.className = `briefing-dot${index === appState.briefingStep ? " active" : ""}`;
    dom.briefingDots.appendChild(dot);
  });
  dom.briefingNextBtn.textContent = appState.briefingStep >= BRIEFING_STEPS.length - 1 ? "START" : "NEXT";
}

function openBriefing() {
  pauseForOverlay("briefing");
  appState.briefingStep = 0;
  renderBriefingStep();
  setOverlayVisible(dom.briefingOverlay, true);
}

function closeBriefing(startBattle = false) {
  setOverlayVisible(dom.briefingOverlay, false);
  resumeFromOverlay("briefing");
  if (startBattle && !appState.battleStarted) {
    beginBattle();
  }
}

async function openSettings() {
  pauseForOverlay("settings");
  try {
    await audio.init();
  } catch {
    appState.diagnostics.lastError = "audio-settings";
  }
  setOverlayVisible(dom.settingsOverlay, true);
}

function closeSettings() {
  setOverlayVisible(dom.settingsOverlay, false);
  resumeFromOverlay("settings");
}

function buildSummary(winner) {
  const player = game.getState("player");
  const ai = game.getState("ai");
  const victory = winner === "player";
  const summary = {
    result: victory ? "VICTORY" : "DEFEAT",
    meta: `점수 ${player.score} · 최대 콤보 x${player.maxCombo} · ${player.lines}줄`,
    score: player.score,
    lines: player.lines,
    maxCombo: player.maxCombo,
    tSpins: player.stats.tSpins,
    tetrises: player.stats.tetrises,
    perfects: player.stats.perfectClears,
    ai: appState.selectedDifficulty,
    bossHp: ai.bossHp,
  };
  return summary;
}

function showResultOverlay(winner) {
  pauseForOverlay("result");
  appState.battleFinished = true;
  const summary = buildSummary(winner);
  appState.lastSummary = summary;
  saveRecentBattle(summary);
  syncRecentBattleCard();
  completeMission("finish");

  dom.resultEyebrow.textContent = winner === "player" ? "BATTLE RESULT" : "SYSTEM REPORT";
  dom.resultTitle.textContent = summary.result;
  dom.resultSummary.textContent = winner === "player"
    ? `${summary.ai}를 격파했습니다.`
    : `${summary.ai}에게 패배했습니다. 다시 정비하세요.`;
  dom.resultScore.textContent = `${summary.score}`;
  dom.resultLines.textContent = `${summary.lines}`;
  dom.resultMaxCombo.textContent = `x${summary.maxCombo}`;
  dom.resultTSpins.textContent = `${summary.tSpins}`;
  dom.resultTetrises.textContent = `${summary.tetrises}`;
  dom.resultPerfects.textContent = `${summary.perfects}`;
  dom.resultFeedbackList.innerHTML = "";
  [
    `상대 난이도: ${summary.ai}`,
    `보스 HP 잔량: ${formatPercent(summary.bossHp)}`,
    summary.maxCombo >= 10 ? "피버 진입 성공" : "피버 진입 미달",
  ].forEach((text) => {
    const row = document.createElement("div");
    row.className = "result-feedback-item";
    row.textContent = text;
    dom.resultFeedbackList.appendChild(row);
  });

  setOverlayVisible(dom.resultOverlay, true);
}

function hideResultOverlay() {
  setOverlayVisible(dom.resultOverlay, false);
  resumeFromOverlay("result");
}

function openPauseOverlay() {
  pauseForOverlay("pause");
  setOverlayVisible(dom.pauseOverlay, true);
}

function closePauseOverlay() {
  setOverlayVisible(dom.pauseOverlay, false);
  resumeFromOverlay("pause");
}

function togglePause() {
  if (!appState.battleStarted || appState.battleFinished) return;
  if (appState.activeOverlay === "pause") {
    closePauseOverlay();
    return;
  }
  if (isOverlayOpen()) return;
  openPauseOverlay();
}

function applyAudioSettings() {
  audio.setMasterVolume(uiSettings.masterVolume / 100);
  audio.setChannelVolume("bgm", uiSettings.bgmVolume / 100);
  audio.setChannelVolume("sfx", uiSettings.sfxVolume / 100);
  audio.setChannelVolume("voice", uiSettings.voiceVolume / 100);
  audio.setMuted(!!uiSettings.muted);
  audio.setLowStimAudio(!!uiSettings.lowStimAudio);
}

function applyVisualSettings() {
  document.documentElement.style.setProperty("--mobile-scale", `${uiSettings.mobileScale}%`);
  document.documentElement.style.setProperty("--mobile-btn-scale", String(uiSettings.mobileScale / 100));
  document.documentElement.style.setProperty("--mobile-btn-size", `${Math.round(60 * (uiSettings.mobileScale / 100))}px`);
  game.setScreenShakeScale((uiSettings.shake || 0) / 100);
  bgFx.setReducedMotion(!!uiSettings.reducedFx || !!uiSettings.lowPower);
  dom.body.dataset.mobileLayout = uiSettings.layout;
}

function applySettingsToUi() {
  dom.masterVolumeSlider.value = `${uiSettings.masterVolume}`;
  dom.masterVolumeValue.textContent = `${uiSettings.masterVolume}%`;
  dom.bgmVolumeSlider.value = `${uiSettings.bgmVolume}`;
  dom.bgmVolumeValue.textContent = `${uiSettings.bgmVolume}%`;
  dom.sfxVolumeSlider.value = `${uiSettings.sfxVolume}`;
  dom.sfxVolumeValue.textContent = `${uiSettings.sfxVolume}%`;
  dom.voiceVolumeSlider.value = `${uiSettings.voiceVolume}`;
  dom.voiceVolumeValue.textContent = `${uiSettings.voiceVolume}%`;
  dom.settingsMuteBtn.textContent = uiSettings.muted ? "MUTE ON" : "MUTE OFF";
  dom.settingsLowStimAudioBtn.textContent = uiSettings.lowStimAudio ? "LOW STIM ON" : "LOW STIM OFF";
  dom.shakeSlider.value = `${uiSettings.shake}`;
  dom.shakeValue.textContent = `${uiSettings.shake}%`;
  dom.settingsReducedFxBtn.textContent = uiSettings.reducedFx ? "FX REDUCED" : "FX FULL";
  dom.settingsLowPowerBtn.textContent = uiSettings.lowPower ? "LOW POWER ON" : "LOW POWER OFF";
  dom.settingsDevPanelBtn.textContent = uiSettings.devPanel ? "DEV PANEL ON" : "DEV PANEL OFF";
  dom.mobileScaleSlider.value = `${uiSettings.mobileScale}`;
  dom.mobileScaleValue.textContent = `${uiSettings.mobileScale}%`;
  dom.touchRepeatSlider.value = `${uiSettings.touchRepeat}`;
  dom.touchRepeatValue.textContent = `${uiSettings.touchRepeat}ms`;
  dom.settingsHapticLevelBtn.textContent = `HAPTIC ${String(uiSettings.hapticLevel).toUpperCase()}`;
  dom.settingsTouchDebugBtn.textContent = uiSettings.touchDebug ? "DEBUG ON" : "DEBUG OFF";
  dom.layoutBtns.forEach((button) => {
    button.classList.toggle("active", button.dataset.layout === uiSettings.layout);
  });
  setHidden(dom.devPanel, !uiSettings.devPanel);
  applyAudioSettings();
  applyVisualSettings();
}

function persistSettings() {
  saveSettings(uiSettings);
  applySettingsToUi();
}

function getTouchRepeatInterval() {
  return Number(uiSettings.touchRepeat) || 75;
}

function isHapticsEnabled() {
  return uiSettings.hapticLevel !== "off";
}

function getHapticLevel() {
  return uiSettings.hapticLevel || "normal";
}

function recordInputMetric(type, action) {
  appState.touchDebug.action = action || "IDLE";
  appState.touchDebug.lastMs = Math.round(performance.now());
  if (type === "press") {
    appState.touchDebug.presses += 1;
    appState.diagnostics.inputPresses += 1;
  }
  if (type === "repeat") {
    appState.touchDebug.repeats += 1;
    appState.diagnostics.inputRepeats += 1;
  }
  if (type === "blocked") {
    appState.diagnostics.droppedInputs += 1;
  }
}

function dispatch(action) {
  if (action === "pause") {
    togglePause();
    return;
  }
  if (isGameplayInputBlocked()) return;
  if (action === "rotate") {
    game.dispatchInput("player", "rotateCW");
    return;
  }
  if (action === "hardDrop" || action === "hold" || action.startsWith("skill")) {
    game.dispatchInput("player", action === "skill1" ? "skill1" : action === "skill2" ? "skill2" : action === "skill3" ? "skill3" : action);
    return;
  }
  game.dispatchInput("player", action);
}

function renderStatusEffects(playerState, nowMs) {
  const chips = [];
  const pushChip = (label, until, tone = "") => {
    if (until > nowMs) chips.push({ label, tone, remain: until - nowMs });
  };

  pushChip("DARK", playerState.darknessUntil, "danger");
  pushChip("MIRROR", playerState.mirrorMoveUntil, "danger");
  pushChip("CORRUPT", playerState.corruptNextUntil, "warn");
  pushChip("HOLD LOCK", playerState.holdLockUntil, "warn");
  pushChip("GHOST OFF", playerState.ghostHiddenUntil, "warn");
  pushChip("ROT TAX", playerState.rotationTaxUntil, "danger");
  pushChip("GAUGE LEECH", playerState.gaugeLeechUntil, "warn");
  pushChip("NEXT JAM", playerState.nextScrambleUntil, "warn");
  pushChip("SHIFT", playerState.neonShiftUntil, "accent");
  pushChip("COUNTER", playerState.layerCounterUntil, "accent");

  const fever = getFeverStatus();
  if (fever.active) {
    chips.push({ label: `FEVER ${fever.label}`, tone: "accent", remain: fever.remainingTime * 1000 });
  }

  chips.sort((a, b) => (b.remain || 0) - (a.remain || 0));
  dom.statusCountValue.textContent = `${chips.length}`;
  dom.statusEffects.innerHTML = "";
  if (!chips.length) {
    dom.statusEffects.innerHTML = '<div class="status-empty">활성 상태 없음</div>';
    return;
  }
  chips.slice(0, 4).forEach((chip) => {
    const element = document.createElement("div");
    element.className = `status-chip${chip.tone ? ` ${chip.tone}` : ""}`;
    element.textContent = `${chip.label} · ${Math.max(1, Math.ceil(chip.remain / 1000))}s`;
    dom.statusEffects.appendChild(element);
  });
}

function getAttackLabel(type) {
  const map = {
    GarbagePush: "GARBAGE",
    CorruptNext: "CORRUPT",
    GravityJolt: "JOLT",
    StackShake: "SHAKE",
    Darkness: "DARK",
    MirrorMove: "MIRROR",
    HoldLock: "HOLD LOCK",
    GhostOut: "GHOST OFF",
    RotationTax: "ROT TAX",
    GaugeLeech: "LEECH",
    NextScramble: "SCRAMBLE",
  };
  return map[type] || type;
}

function renderIncoming(attacks, nowMs) {
  dom.incomingValue.textContent = `${attacks.length}`;
  dom.incomingQueue.innerHTML = "";
  if (!attacks.length) {
    dom.incomingQueue.innerHTML = '<div class="incoming-empty">위협 없음</div>';
    return;
  }
  attacks.slice(0, 4).forEach((attack) => {
    const chip = document.createElement("div");
    chip.className = "incoming-chip";
    const remain = Math.max(1, Math.ceil(((attack.until || nowMs) - nowMs) / 1000));
    chip.textContent = `${getAttackLabel(attack.type)} · ${attack.strength || attack.amount || 1} · ${remain}s`;
    dom.incomingQueue.appendChild(chip);
  });
}

function syncSkillButtons(playerState) {
  const buttons = Array.from(dom.mobileControls.querySelectorAll("button[data-action^='skill']"));
  const enabled = !!playerState.specialReady;
  buttons.forEach((button) => {
    button.disabled = !enabled;
  });
}

function syncAudioMeta() {
  const snapshot = audio.getAudioDebugSnapshot();
  dom.bgmStateValue.textContent = String(snapshot.bgmState || "normal").toUpperCase();
  dom.trackNameValue.textContent = snapshot.trackName || "-";
  dom.musicDriveValue.textContent = snapshot.driveLabel || "CALM";
  dom.bossLayerValue.textContent = snapshot.bossLayer || "OFF";
  dom.devAudioMeta.textContent = `audio:${snapshot.ctxState} · bgm:${snapshot.bgmState} · track:${snapshot.trackName || "-"}`;
}

function handleHudUpdate(playerState, aiState) {
  const nowMs = performance.now();
  appState.lastHudAt = nowMs;

  dom.mobileScore.textContent = `${playerState.score}`;
  dom.mobileCombo.textContent = `x${playerState.combo}`;
  dom.mobileLevel.textContent = `${playerState.level}`;
  dom.mobileGaugeFill.style.setProperty("--gauge-percent", `${playerState.specialGauge}%`);
  dom.bossHpFill.style.setProperty("--boss-hp-percent", `${aiState.bossHp}%`);
  dom.bossHpValue.textContent = formatPercent(aiState.bossHp);
  renderStatusEffects(playerState, nowMs);
  renderIncoming(game.getIncomingAttacks("player"), nowMs);
  syncSkillButtons(playerState);
  canvasManager.renderPreviews(playerState);
  syncAudioMeta();
}

function handleGameEvent(evt, data) {
  switch (evt) {
    case "move":
      audio.triggerSfx("move", 0.9);
      break;
    case "rotate":
      audio.triggerSfx("rotate", 1);
      break;
    case "softdrop":
      completeMission("incoming");
      break;
    case "harddrop":
      audio.triggerSfx("harddrop", 1.1);
      break;
    case "hold":
      audio.triggerSfx("hold", 1);
      completeMission("hold");
      break;
    case "combo":
      showCombo(data.combo);
      audio.playComboSound(data.combo);
      if (data.combo >= 10) completeMission("combo");
      break;
    case "line":
      impact.lineClear(data.lines, data);
      audio.playImpactCue("lineClear", data);
      if (data.lines >= 4) showBattleCallout("TETRIS", "LINE BREAK");
      break;
    case "tspin":
      showBattleCallout("T-SPIN", String(data || "").toUpperCase());
      audio.triggerSfx("tspin", 1.3);
      break;
    case "perfect":
      showBattleCallout("PERFECT", "NULL BURST");
      audio.playImpactCue("perfect", {});
      break;
    case "attack":
      audio.playCombatPhrase("pattern", { tag: String(data.patternTag || "").replace(/([A-Z])/g, (m) => m.toLowerCase()) });
      break;
    case "attacked":
      audio.triggerSfx("damage", 1);
      break;
    case "special":
      completeMission("skill");
      audio.playCombatPhrase("fusion", { type: data?.fusion || "skill" });
      showBattleCallout("SKILL", String(data?.skill || "SPECIAL").toUpperCase());
      break;
    case "feverEnter":
      showBattleCallout("FEVER", data.label || "FORGE");
      audio.playCombatPhrase("feverMode", { type: data.type });
      audio.setFeverBGMSpeed(FEVER_SPEED);
      break;
    case "feverExit":
      audio.resetFeverBGMSpeed();
      break;
    case "neonShift":
      showBattleCallout("NEON SHIFT", String(data.source || "SHIFT").toUpperCase());
      audio.playCombatPhrase("neonShift", data);
      break;
    case "neonShiftEnd":
      audio.playCombatPhrase("shiftEnd", data);
      impact.shiftFade();
      break;
    case "resonance":
      audio.playCombatPhrase("resonance", data);
      break;
    case "layerCounter":
      audio.playCombatPhrase("counter", data);
      impact.counter(data.type);
      break;
    case "ko":
      impact.ko();
      audio.playImpactCue("ko", {});
      break;
    case "gameover":
      showResultOverlay(data);
      break;
    default:
      break;
  }
}

function updateAdaptiveAudio() {
  const player = game.getState("player");
  const ai = game.getState("ai");
  audio.updateAdaptiveMix({
    stackHeight: player.stackHeight,
    incomingGarbage: game.getIncomingAttacks("player").length,
    incomingSpecialCount: game.getIncomingAttacks("player").filter((attack) => attack.type !== "GarbagePush").length,
    combo: player.combo,
    isFeverActive: getFeverStatus().active,
    bossEnabled: !!ai.bossModeActive,
    bossPhase: ai.bossModeActive ? (ai.bossHp <= 15 ? 3 : ai.bossHp <= 40 ? 2 : 1) : 0,
    bossHpPercent: ai.bossHp,
    specialReady: player.specialReady,
    level: player.level,
  });
  audio.updateBossPhase({
    enabled: !!ai.bossModeActive,
    phase: ai.bossModeActive ? (ai.bossHp <= 15 ? 3 : ai.bossHp <= 40 ? 2 : 1) : 0,
    hpPercent: ai.bossHp,
  });
}

function syncDevPanel(dt) {
  const fps = dt > 0 ? 1 / dt : 0;
  appState.diagnostics.avgFps = appState.diagnostics.avgFps
    ? (appState.diagnostics.avgFps * 0.92) + (fps * 0.08)
    : fps;
  appState.diagnostics.minFps = Math.min(appState.diagnostics.minFps, fps || appState.diagnostics.minFps);
  appState.diagnostics.maxFrameMs = Math.max(appState.diagnostics.maxFrameMs, dt * 1000);
  if (dt > 0.05) appState.diagnostics.frameDrops += 1;
  dom.touchDebugAction.textContent = appState.touchDebug.action;
  dom.touchDebugMeta.textContent = `press:${appState.touchDebug.presses} · repeat:${appState.touchDebug.repeats} · last:${appState.touchDebug.lastMs}ms`;
  dom.devFpsMeta.textContent = `fps:${fps.toFixed(0)} · avg:${appState.diagnostics.avgFps.toFixed(0)} · min:${Math.max(0, appState.diagnostics.minFps).toFixed(0)}`;
  dom.devGameMeta.textContent = `boss:${game.getState("ai").bossHp.toFixed(0)} · incoming:${game.getIncomingAttacks("player").length} · paused:${!game.isRunning()}`;
  dom.devErrorMeta.textContent = `error:${appState.diagnostics.lastError}`;
}

async function beginBattle() {
  appState.battleStarted = true;
  appState.battleFinished = false;
  appState.activeOverlay = null;
  setHidden(dom.startScreen, true);
  setHidden(dom.mobileControls, false);
  dom.stage.classList.remove("prestart");
  // [v3.20.2] 시작 오버레이가 사라진 직후 실제 전투 영역 크기를 다시 읽어 모바일 캔버스를 강제 재조정한다.
  canvasManager.resizeAll();
  requestAnimationFrame(() => canvasManager.resizeAll());
  closePauseOverlay();
  hideResultOverlay();
  game.reset();
  game.setDifficulty(appState.selectedDifficulty);
  game.restartRound();
  try {
    await audio.init();
  } catch {
    appState.diagnostics.lastError = "audio-resume";
  }
  audio.selectTrackForDifficulty(appState.selectedDifficulty);
  audio.startBgm();
  updateDifficultyUi();
  syncRotateHint();
}

function returnToTitle() {
  appState.battleStarted = false;
  appState.battleFinished = false;
  appState.activeOverlay = null;
  setHidden(dom.startScreen, false);
  setHidden(dom.mobileControls, true);
  dom.stage.classList.add("prestart");
  setOverlayVisible(dom.pauseOverlay, false);
  setOverlayVisible(dom.resultOverlay, false);
  setOverlayVisible(dom.settingsOverlay, false);
  setOverlayVisible(dom.briefingOverlay, false);
  game.reset();
  audio.resetFeverBGMSpeed();
  audio.stopBgm();
  syncRotateHint();
}

function exportSession() {
  const payload = {
    buildVersion: SESSION_EXPORT_VERSION,
    deviceMeta: {
      userAgent: navigator.userAgent,
      width: window.innerWidth,
      height: window.innerHeight,
      orientation: window.matchMedia("(orientation: portrait)").matches ? "portrait" : "landscape",
    },
    uiSettings,
    sessionDiagnostics: appState.diagnostics,
    recentBattle: appState.lastSummary || loadRecentBattle(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `codextirs-mobile-session-${Date.now()}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function loop(now) {
  const dt = Math.min(0.05, Math.max(0.001, (now - appState.lastFrameAt) / 1000));
  appState.lastFrameAt = now;
  game.tick(impact.isHitstopActive() ? 0 : dt);
  impact.tick(dt);
  bgFx.tick(dt);
  bgFx.draw(0.9);
  updateAdaptiveAudio();
  syncDevPanel(dt);
  requestAnimationFrame(loop);
}

function bindEvents() {
  dom.difficultyGrid.querySelectorAll(".diff-btn").forEach((button) => {
    button.addEventListener("click", () => {
      appState.selectedDifficulty = button.dataset.difficulty || "기사";
      updateDifficultyUi();
    });
  });
  dom.startBattleBtn.addEventListener("click", beginBattle);
  dom.briefingOpenBtn.addEventListener("click", openBriefing);
  dom.startBtn.addEventListener("click", returnToTitle);
  dom.pauseBtn.addEventListener("click", togglePause);
  dom.settingsBtn.addEventListener("click", openSettings);
  dom.resumeBtn.addEventListener("click", closePauseOverlay);
  dom.restartBtn.addEventListener("click", beginBattle);
  dom.titleBtn.addEventListener("click", returnToTitle);
  dom.settingsCloseBtn.addEventListener("click", closeSettings);
  dom.settingsMuteBtn.addEventListener("click", () => { uiSettings.muted = !uiSettings.muted; persistSettings(); });
  dom.settingsTrackBtn.addEventListener("click", () => audio.nextTrack());
  dom.settingsTestBtn.addEventListener("click", () => audio.triggerSfx("line", 1.1));
  dom.settingsCalibrateBtn.addEventListener("click", () => { uiSettings.masterVolume = 82; uiSettings.bgmVolume = 62; uiSettings.sfxVolume = 92; uiSettings.voiceVolume = 90; persistSettings(); });
  dom.settingsLowStimAudioBtn.addEventListener("click", () => { uiSettings.lowStimAudio = !uiSettings.lowStimAudio; persistSettings(); });
  dom.presetBtns.forEach((button) => button.addEventListener("click", () => {
    uiSettings.audioPreset = button.dataset.preset || "arcade";
    const preset = audio.applyPreset(uiSettings.audioPreset);
    if (preset) {
      uiSettings.bgmVolume = Math.round(preset.bgm * 100);
      uiSettings.sfxVolume = Math.round(preset.sfx * 100);
      uiSettings.voiceVolume = Math.round(preset.voice * 100);
      persistSettings();
    }
  }));
  [["masterVolumeSlider", "masterVolume"], ["bgmVolumeSlider", "bgmVolume"], ["sfxVolumeSlider", "sfxVolume"], ["voiceVolumeSlider", "voiceVolume"], ["shakeSlider", "shake"], ["mobileScaleSlider", "mobileScale"], ["touchRepeatSlider", "touchRepeat"]].forEach(([sliderKey, stateKey]) => {
    dom[sliderKey].addEventListener("input", (event) => {
      uiSettings[stateKey] = Number(event.currentTarget.value);
      persistSettings();
    });
  });
  dom.settingsReducedFxBtn.addEventListener("click", () => { uiSettings.reducedFx = !uiSettings.reducedFx; persistSettings(); });
  dom.settingsLowPowerBtn.addEventListener("click", () => { uiSettings.lowPower = !uiSettings.lowPower; persistSettings(); });
  dom.settingsBriefingBtn.addEventListener("click", openBriefing);
  dom.settingsDevPanelBtn.addEventListener("click", () => { uiSettings.devPanel = !uiSettings.devPanel; persistSettings(); });
  dom.settingsExportSessionBtn.addEventListener("click", exportSession);
  dom.settingsClearSessionBtn.addEventListener("click", () => { appState.diagnostics.errors = []; appState.diagnostics.lastError = "none"; syncDevPanel(0.016); });
  dom.layoutBtns.forEach((button) => button.addEventListener("click", () => { uiSettings.layout = button.dataset.layout || "default"; persistSettings(); }));
  dom.settingsHapticLevelBtn.addEventListener("click", () => {
    const order = ["off", "low", "normal", "strong"];
    const next = order[(order.indexOf(uiSettings.hapticLevel) + 1) % order.length];
    uiSettings.hapticLevel = next;
    persistSettings();
  });
  dom.settingsTouchDebugBtn.addEventListener("click", () => { uiSettings.touchDebug = !uiSettings.touchDebug; persistSettings(); });
  dom.briefingSkipBtn.addEventListener("click", () => closeBriefing(false));
  dom.briefingNextBtn.addEventListener("click", () => {
    if (appState.briefingStep >= BRIEFING_STEPS.length - 1) {
      closeBriefing(!appState.battleStarted);
      return;
    }
    appState.briefingStep += 1;
    renderBriefingStep();
  });
  dom.resultRestartBtn.addEventListener("click", beginBattle);
  dom.resultBriefingBtn.addEventListener("click", openBriefing);
  dom.resultTitleBtn.addEventListener("click", returnToTitle);
  window.addEventListener("resize", () => {
    canvasManager.resizeAll();
    bgFx.resize();
    syncRotateHint();
  });
  window.addEventListener("orientationchange", () => {
    setTimeout(() => {
      canvasManager.resizeAll();
      bgFx.resize();
      syncRotateHint();
    }, 300);
  });
  window.addEventListener("error", (event) => {
    appState.diagnostics.lastError = String(event.message || "error");
    appState.diagnostics.errors.push({ type: "error", message: String(event.message || "error"), at: Date.now() });
  });
  window.addEventListener("unhandledrejection", (event) => {
    appState.diagnostics.lastError = String(event.reason || "promise");
    appState.diagnostics.errors.push({ type: "promise", message: String(event.reason || "promise"), at: Date.now() });
  });
  installTouch((_playerId, action) => dispatch(action), {
    isHapticsEnabled,
    getHapticLevel,
    getRepeatInterval: getTouchRepeatInterval,
    isInputBlocked: isGameplayInputBlocked,
    onInputMetric: recordInputMetric,
    onTouchDebug(type, action) {
      if (!uiSettings.touchDebug) return;
      appState.touchDebug.action = `${type}:${action}`;
    },
    onHeldActionChange(action, isDown) {
      game.setHeldAction("player", action, isDown);
    },
  });
}

async function init() {
  dom.body.classList.add("mobile-shell", "mobile-layout");
  dom.stage.classList.add("prestart");
  canvasManager.attach();
  bgFx.resize();
  bindEvents();
  updateDifficultyUi();
  syncMissionChecklist();
  syncRecentBattleCard();
  applySettingsToUi();
  syncRotateHint();
  try {
    await audio.init();
    audio.selectTrackForDifficulty(appState.selectedDifficulty);
  } catch {
    appState.diagnostics.lastError = "audio-init";
  }
  requestAnimationFrame(loop);
}

init();
