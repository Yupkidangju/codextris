/*
 * [v3.15.1] 메인 엔트리 포인트
 * 
 * 작성일: 2026-03-01
 * 변경사항: 
 *   - 향상된 HUD (콤보, 게이지, 홀드, 다음블록)
 *   - 일시정지 메뉴
 *   - 콤보 디스플레이
 *   - 모든 이벤트 처리
 *   - 설정 모달 / 결과 오버레이 / 전투 위젯 추가
 *   - Audio 2.0 / Onboarding 2.0 / Mobile 2.0 확장
 *   - Adaptive Music 2.0 연동 및 오디오 메타 확장
 *   - Input Fidelity 2.0, QA Layer, Game Feel Pass 통합
 *   - [v3.9.0] Rule-Break Boss HUD/상태/힌트 통합
 *   - [v3.10.0] 패턴 공격 문법 콜아웃/라벨 통합
 *   - [v3.11.0] 스킬 합성과 피버 변형 HUD/미리보기 통합
 *   - [v3.12.0] Neon Shift/Residue HUD와 Combat Orchestration 오디오 연동
 *   - [v3.13.0] Layer Resonance, 상태 HUD 우선순위 정리, Orchestration 2.0 연동
 *   - [v3.14.0] Layer Counter Matrix, Shift 종료 이벤트, DEV 메타 확장
 *   - [v3.14.1] 일시정지 입력 차단 보강, 난이도별 흔들림 감쇠 조정, 외부 감사 후속 수정
 *   - [v3.14.2] 아이템 글로우 예외 및 자동 고정 체감 수정 반영
 *   - [v3.15.0] 전투 콜아웃 중복 억제와 STATUS/INCOMING 압축 렌더링 추가
 *   - [v3.15.1] 모바일 보드 축소/버튼 확대 기준 보정
 */

import { createGame } from "./game/core/engine.js";
import { installKeyboard } from "./input/keyboard.js";
import { installTouch } from "./input/touch.js";
import { applyLayout, detectMobile, initMobileLayout } from "./ui/layout.js";
import { AudioEngine } from "./audio/midi_player.js";
import { BackgroundFx } from "./render/background.js";
import { ScreenImpact } from "./render/effects.js";
import { PIECES } from "./game/core/pieces.js";
import { initAchievements } from "./game/achievements.js";
import { getPlayerSkillManager, getAiSkillManager, SkillType } from "./game/battle/skills.js"; // [v5.0.0] 스킬 시스템 통합
import { getFeverStatus } from "./game/battle/fever.js";
import { INPUT_PRESETS } from "./game/core/constants.js";

// DOM 요소
const playerCanvas = document.getElementById("playerCanvas");
const aiCanvas = document.getElementById("aiCanvas");
const bgFxCanvas = document.getElementById("bgFx");
const startScreen = document.getElementById("startScreen");
const startBattleBtn = document.getElementById("startBattleBtn");
const briefingOpenBtn = document.getElementById("briefingOpenBtn");
const difficultyGrid = document.getElementById("difficultyGrid");
const difficultyBadge = document.getElementById("difficultyBadge");
const stage = document.getElementById("stage");
const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const settingsBtn = document.getElementById("settingsBtn");

// HUD 요소
const scoreValue = document.getElementById("scoreValue");
const comboValue = document.getElementById("comboValue");
const levelValue = document.getElementById("levelValue");
const aiLevelValue = document.getElementById("aiLevelValue");
const bossHpPanel = document.querySelector(".boss-hp-panel");
const bossHpValue = document.getElementById("bossHpValue");
const bossHpFill = document.getElementById("bossHpFill");
const gaugeValue = document.getElementById("gaugeValue");
const specialGauge = document.querySelector(".gauge-fill");
const comboDisplay = document.getElementById("comboDisplay");
const comboText = document.getElementById("comboText");
const battleWidgets = document.getElementById("battleWidgets");
const statusEffects = document.getElementById("statusEffects");
const statusCountValue = document.getElementById("statusCountValue");
const incomingValue = document.getElementById("incomingValue");
const incomingQueue = document.getElementById("incomingQueue");

// 모바일 상태바 요소 [v3.0.0]
const mobileScore = document.getElementById("mobileScore");
const mobileCombo = document.getElementById("mobileCombo");
const mobileLevel = document.getElementById("mobileLevel");
const mobileGaugeFill = document.getElementById("mobileGaugeFill");

// 미리보기 캔버스
const holdCanvas = document.getElementById("holdCanvas");
const nextPreviewPanel = document.querySelector(".next-preview");
const next1Canvas = document.getElementById("next1Canvas");
const next2Canvas = document.getElementById("next2Canvas");
const next3Canvas = document.getElementById("next3Canvas");
const next4Canvas = document.getElementById("next4Canvas");
const next5Canvas = document.getElementById("next5Canvas");

// 일시정지 메뉴
const pauseOverlay = document.getElementById("pauseOverlay");
const resumeBtn = document.getElementById("resumeBtn");
const restartBtn = document.getElementById("restartBtn");
const titleBtn = document.getElementById("titleBtn");
const settingsOverlay = document.getElementById("settingsOverlay");
const settingsCloseBtn = document.getElementById("settingsCloseBtn");
const masterVolumeSlider = document.getElementById("masterVolumeSlider");
const masterVolumeValue = document.getElementById("masterVolumeValue");
const bgmVolumeSlider = document.getElementById("bgmVolumeSlider");
const bgmVolumeValue = document.getElementById("bgmVolumeValue");
const sfxVolumeSlider = document.getElementById("sfxVolumeSlider");
const sfxVolumeValue = document.getElementById("sfxVolumeValue");
const voiceVolumeSlider = document.getElementById("voiceVolumeSlider");
const voiceVolumeValue = document.getElementById("voiceVolumeValue");
const settingsMuteBtn = document.getElementById("settingsMuteBtn");
const settingsTrackBtn = document.getElementById("settingsTrackBtn");
const settingsTestBtn = document.getElementById("settingsTestBtn");
const settingsCalibrateBtn = document.getElementById("settingsCalibrateBtn");
const settingsLowStimAudioBtn = document.getElementById("settingsLowStimAudioBtn");
const presetButtons = Array.from(document.querySelectorAll(".preset-btn"));
const controlPresetButtons = Array.from(document.querySelectorAll(".control-preset-btn"));
const shakeSlider = document.getElementById("shakeSlider");
const shakeValue = document.getElementById("shakeValue");
const inputProfileValue = document.getElementById("inputProfileValue");
const inputBufferSlider = document.getElementById("inputBufferSlider");
const inputBufferValue = document.getElementById("inputBufferValue");
const controlAdvancedBtn = document.getElementById("controlAdvancedBtn");
const controlAdvancedPanel = document.getElementById("controlAdvancedPanel");
const dasSlider = document.getElementById("dasSlider");
const dasValue = document.getElementById("dasValue");
const arrSlider = document.getElementById("arrSlider");
const arrValue = document.getElementById("arrValue");
const softDropRepeatSlider = document.getElementById("softDropRepeatSlider");
const softDropRepeatValue = document.getElementById("softDropRepeatValue");
const lockResetLimitSlider = document.getElementById("lockResetLimitSlider");
const lockResetLimitValue = document.getElementById("lockResetLimitValue");
const irsToggleBtn = document.getElementById("irsToggleBtn");
const ihsToggleBtn = document.getElementById("ihsToggleBtn");
const hardDropBufferBtn = document.getElementById("hardDropBufferBtn");
const settingsReducedFxBtn = document.getElementById("settingsReducedFxBtn");
const settingsLowPowerBtn = document.getElementById("settingsLowPowerBtn");
const settingsBriefingBtn = document.getElementById("settingsBriefingBtn");
const settingsDevPanelBtn = document.getElementById("settingsDevPanelBtn");
const settingsExportSessionBtn = document.getElementById("settingsExportSessionBtn");
const settingsClearSessionBtn = document.getElementById("settingsClearSessionBtn");
const mobileScaleSlider = document.getElementById("mobileScaleSlider");
const mobileScaleValue = document.getElementById("mobileScaleValue");
const touchRepeatSlider = document.getElementById("touchRepeatSlider");
const touchRepeatValue = document.getElementById("touchRepeatValue");
const settingsHapticLevelBtn = document.getElementById("settingsHapticLevelBtn");
const settingsTouchDebugBtn = document.getElementById("settingsTouchDebugBtn");
const mobileLayoutButtons = Array.from(document.querySelectorAll(".layout-btn"));
const bgmStateValue = document.getElementById("bgmStateValue");
const trackNameValue = document.getElementById("trackNameValue");
const musicDriveValue = document.getElementById("musicDriveValue");
const bossLayerValue = document.getElementById("bossLayerValue");
const missionProgressValue = document.getElementById("missionProgressValue");
const missionChecklist = document.getElementById("missionChecklist");
const briefingOverlay = document.getElementById("briefingOverlay");
const briefingTitle = document.getElementById("briefingTitle");
const briefingText = document.getElementById("briefingText");
const briefingHighlights = document.getElementById("briefingHighlights");
const briefingStepValue = document.getElementById("briefingStepValue");
const briefingDots = document.getElementById("briefingDots");
const briefingSkipBtn = document.getElementById("briefingSkipBtn");
const briefingNextBtn = document.getElementById("briefingNextBtn");
const resultOverlay = document.getElementById("resultOverlay");
const resultEyebrow = document.getElementById("resultEyebrow");
const resultTitle = document.getElementById("resultTitle");
const resultSummary = document.getElementById("resultSummary");
const resultFeedbackList = document.getElementById("resultFeedbackList");
const resultScore = document.getElementById("resultScore");
const resultLines = document.getElementById("resultLines");
const resultMaxCombo = document.getElementById("resultMaxCombo");
const resultTSpins = document.getElementById("resultTSpins");
const resultTetrises = document.getElementById("resultTetrises");
const resultPerfects = document.getElementById("resultPerfects");
const resultRestartBtn = document.getElementById("resultRestartBtn");
const resultBriefingBtn = document.getElementById("resultBriefingBtn");
const resultTitleBtn = document.getElementById("resultTitleBtn");
const battleCallout = document.getElementById("battleCallout");
const battleCalloutTitle = document.getElementById("battleCalloutTitle");
const battleCalloutSubtitle = document.getElementById("battleCalloutSubtitle");
const rotateHint = document.getElementById("rotateHint");
const recentBattleCard = document.getElementById("recentBattleCard");
const recentBattleResult = document.getElementById("recentBattleResult");
const recentBattleMeta = document.getElementById("recentBattleMeta");
const touchDebugPanel = document.getElementById("devDebugPanel");
const touchDebugAction = document.getElementById("touchDebugAction");
const touchDebugMeta = document.getElementById("touchDebugMeta");
const devFpsMeta = document.getElementById("devFpsMeta");
const devAudioMeta = document.getElementById("devAudioMeta");
const devGameMeta = document.getElementById("devGameMeta");
const devErrorMeta = document.getElementById("devErrorMeta");

// [v5.0.0] 스킬 버튼 요소
const skillBtn1 = document.getElementById("skillBtn1");
const skillBtn2 = document.getElementById("skillBtn2");
const skillBtn3 = document.getElementById("skillBtn3");
const skillsPanel = document.getElementById("skillsPanel");
const mobileSkillBtns = [
  document.querySelector('[data-action="skill1"]'),
  document.querySelector('[data-action="skill2"]'),
  document.querySelector('[data-action="skill3"]'),
];

// 오디오 및 렌더링
const audio = new AudioEngine();
const bgFx = bgFxCanvas
  ? new BackgroundFx(bgFxCanvas)
  : { resize() {}, tick() {}, draw() {} };
const impact = new ScreenImpact(document.documentElement);
let game = null;

// 게임 상태
let selectedDifficulty = "기사";
let hasStarted = false;
let starting = false;
let settingsPausedGame = false;
let briefingPausedGame = false;
let battleCalloutTimer = null;
let briefingStepIndex = 0;
let activeRebindAction = "";
// [v3.0.1-fix] 업적 시스템을 실제 게임 이벤트 흐름과 연결하여 저장/알림이 동작하도록 복구했다.
const achievementSystem = initAchievements(showAchievementNotification, () => {
  audio.playAchievementUnlockSound?.();
});

const SETTINGS_STORAGE_KEY = "codextirs.settings.v3.14.1";
const LEGACY_SETTINGS_STORAGE_KEYS = [
  "codextirs.settings.v3.14.0",
  "codextirs.settings.v3.13.0",
  "codextirs.settings.v3.12.0",
  "codextirs.settings.v3.8.0",
  "codextirs.settings.v3.5.0",
  "codextirs.settings.v3.3.0",
  "codextirs.settings.v3.2.0",
  "codextirs.settings.v3.1.0",
];
const RECENT_BATTLE_STORAGE_KEY = "codextirs.recent_battle.v1";
const HAPTIC_LEVELS = ["off", "low", "normal", "strong"];
const DEFAULT_KEYBOARD_MAPPING = {
  moveLeft: ["ArrowLeft"],
  moveRight: ["ArrowRight"],
  rotateCW: ["ArrowUp", "KeyX"],
  rotateCCW: ["KeyZ"],
  softDrop: ["ArrowDown"],
  hardDrop: ["Space"],
  hold: ["KeyC"],
  skill1: ["Digit1", "Numpad1"],
  skill2: ["Digit2", "Numpad2"],
  skill3: ["Digit3", "Numpad3"],
  pause: ["Escape", "KeyP"],
};
const KEYBIND_LABELS = {
  moveLeft: "MOVE LEFT",
  moveRight: "MOVE RIGHT",
  rotateCW: "ROTATE CW",
  rotateCCW: "ROTATE CCW",
  softDrop: "SOFT DROP",
  hardDrop: "HARD DROP",
  hold: "HOLD",
  pause: "PAUSE",
};
const REBIND_VALUE_IDS = {
  moveLeft: "rebindMoveLeftValue",
  moveRight: "rebindMoveRightValue",
  rotateCW: "rebindRotateCWValue",
  rotateCCW: "rebindRotateCCWValue",
  softDrop: "rebindSoftDropValue",
  hardDrop: "rebindHardDropValue",
  hold: "rebindHoldValue",
  pause: "rebindPauseValue",
};
const BUFFERABLE_ACTIONS = new Set(["rotateCW", "rotateCCW", "hold", "hardDrop"]);
const DEFAULT_MISSIONS = {
  hold: false,
  skill: false,
  incoming: false,
  combo10: false,
  win: false,
};
const DEFAULT_SEEN_DEBUFFS = {
  CorruptNext: false,
  GravityJolt: false,
  StackShake: false,
  Darkness: false,
  MirrorMove: false,
  HoldLock: false,
  GhostOut: false,
  RotationTax: false,
  GaugeLeech: false,
  NextScramble: false,
  PierceBarrage: false,
  DrillHex: false,
  WavePush: false,
  NullBurst: false,
};
const DEFAULT_UI_SETTINGS = {
  masterVolume: 78,
  bgmVolume: 68,
  sfxVolume: 92,
  voiceVolume: 88,
  muted: false,
  shake: 100,
  hapticLevel: "normal",
  reducedFx: false,
  lowPower: false,
  lowStimAudio: false,
  preset: "arcade",
  briefingSeen: false,
  hintGaugeSeen: false,
  hintIncomingSeen: false,
  hintFeverSeen: false,
  hintBossSeen: false,
  mobileLayout: "default",
  mobileScale: 100,
  touchRepeat: 75,
  touchDebug: false,
  devPanel: false,
  controlAdvanced: false,
  inputProfile: "standard",
  keyboard: { ...DEFAULT_KEYBOARD_MAPPING },
  inputTuning: { ...INPUT_PRESETS.standard },
  missions: { ...DEFAULT_MISSIONS },
  seenDebuffs: { ...DEFAULT_SEEN_DEBUFFS },
};
let uiSettings = loadUiSettings();
let lastSpecialReady = false;
let lastIncomingCount = 0;
let lastBossPhase = 0;
let hiddenPausedGame = false;
let lastCalloutSignature = "";
let lastCalloutAt = 0;
let sessionMetrics = createSessionMetrics();
let sessionDiagnostics = createSessionDiagnostics();
let lastAudioCtxState = "";
const touchMetrics = {
  presses: 0,
  repeats: 0,
  lastAction: "IDLE",
  lastDeltaMs: 0,
  lastAt: 0,
};

const ONBOARDING_MISSIONS = [
  { id: "hold", title: "홀드 1회 사용", detail: "C 키 또는 모바일 H 버튼" },
  { id: "skill", title: "스킬 1회 사용", detail: "게이지 MAX 후 1 / 2 / 3" },
  { id: "incoming", title: "INCOMING 확인", detail: "대기 공격 또는 특수 패턴 읽기" },
  { id: "combo10", title: "10콤보 달성", detail: "피버 진입 기준" },
  { id: "win", title: "전투 1회 승리", detail: "난이도는 자유" },
];

const BRIEFING_STEPS = [
  {
    title: "BOARD CONTROL",
    text: "왼쪽은 내 보드, 오른쪽은 AI 보드입니다. HOLD와 NEXT를 먼저 읽으면 실수율이 크게 줄어듭니다.",
    highlights: ["HOLD는 `C` 또는 `H` 버튼", "NEXT 3개를 미리 보고 장기 배치", "고스트 블록으로 착지 위치 확인"],
  },
  {
    title: "SKILL GAUGE",
    text: "라인 클리어와 T-Spin으로 게이지를 채우고, 100%가 되면 1 / 2 / 3 스킬을 즉시 쓰십시오.",
    highlights: ["1: 블라인드", "2: 블록 스왑", "3: 가비지 반사"],
  },
  {
    title: "INCOMING READ",
    text: "좌하단 STATUS와 INCOMING 위젯이 현재 디버프와 들어올 공격을 보여줍니다. 큰 공격 전엔 여기부터 확인하십시오.",
    highlights: ["GARBAGE는 줄 수 확인", "CORRUPT / MIRROR / DARK는 남은 시간 확인", "반사나 실드 타이밍 판단"],
  },
  {
    title: "SETTINGS MIXER",
    text: "소리가 작으면 SETTINGS에서 Master/BGM/SFX를 따로 올리십시오. 모바일에서는 햅틱과 저자극 FX도 여기서 조절합니다.",
    highlights: ["ARCADE: 강한 타격감", "FOCUS: BGM 비중 축소", "QUIET: 야간 플레이용"],
  },
];

function showAchievementNotification(achievement) {
  const name = achievement.name?.ko || "도전 과제";
  const description = achievement.description?.ko || "";
  showFloatingNotification(`🏆 ${name}`, description || "새 도전 과제를 달성했습니다.");
}

function showFloatingNotification(title, description = "") {
  let notif = document.getElementById("floatingNotification");
  if (!notif) {
    notif = document.createElement("div");
    notif.id = "floatingNotification";
    notif.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      min-width: 220px;
      max-width: 320px;
      background: rgba(8, 16, 32, 0.92);
      border: 1px solid rgba(0, 240, 255, 0.45);
      box-shadow: 0 0 24px rgba(0, 240, 255, 0.18);
      backdrop-filter: blur(12px);
      color: #e8f4ff;
      padding: 12px 14px;
      border-radius: 10px;
      z-index: 1000;
      opacity: 0;
      transition: opacity 0.25s ease;
      pointer-events: none;
    `;
    document.body.appendChild(notif);
  }
  notif.innerHTML = `<strong style="display:block;margin-bottom:4px;">${title}</strong><span style="font-size:12px;color:#a0c4e8;">${description}</span>`;
  notif.style.opacity = "1";
  setTimeout(() => {
    notif.style.opacity = "0";
  }, 3000);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function createSessionMetrics() {
  return {
    startedAt: 0,
    holdsUsed: 0,
    skillsUsed: 0,
    specialHitsTaken: 0,
    incomingAlerts: 0,
    gaugeReadyCount: 0,
    combo10Reached: false,
    reflected: 0,
    autoPausedByVisibility: false,
  };
}

function createSessionDiagnostics() {
  return {
    startedAt: 0,
    avgFps: 0,
    minFps: 0,
    maxFrameMs: 0,
    frameDrops: 0,
    inputPresses: 0,
    inputRepeats: 0,
    bufferedInputs: 0,
    droppedInputs: 0,
    audioResumes: 0,
    audioStateChanges: 0,
    visibilityPauses: 0,
    neonShiftActivations: 0,
    resonanceTriggers: 0,
    layerCounters: 0,
    lastError: "none",
    errors: [],
    snapshots: [],
  };
}

function getDefaultInputTuning(profile = "standard") {
  return { ...(INPUT_PRESETS[profile] || INPUT_PRESETS.standard) };
}

function normalizeInputSettings(raw = {}) {
  const profile = raw?.inputProfile && INPUT_PRESETS[raw.inputProfile] ? raw.inputProfile : "standard";
  const tuning = {
    ...getDefaultInputTuning(profile),
    ...(raw?.inputTuning || {}),
  };
  tuning.dasMs = clamp(Number(tuning.dasMs) || 135, 60, 200);
  tuning.arrMs = clamp(Number(tuning.arrMs) || 40, 0, 80);
  tuning.softDropRepeatMs = clamp(Number(tuning.softDropRepeatMs) || 32, 12, 60);
  tuning.inputBufferMs = clamp(Number(tuning.inputBufferMs) || 110, 50, 150);
  tuning.lockResetLimit = clamp(Number(tuning.lockResetLimit) || 15, 4, 20);
  tuning.irsEnabled = tuning.irsEnabled !== false;
  tuning.ihsEnabled = tuning.ihsEnabled !== false;
  tuning.hardDropBufferEnabled = tuning.hardDropBufferEnabled !== false;

  const keyboard = { ...DEFAULT_KEYBOARD_MAPPING };
  Object.entries(raw?.keyboard || {}).forEach(([action, codes]) => {
    if (!(action in keyboard)) return;
    keyboard[action] = (Array.isArray(codes) ? codes : []).filter(Boolean);
  });
  if (!keyboard.pause.length) {
    keyboard.pause = [...DEFAULT_KEYBOARD_MAPPING.pause];
  }
  return {
    inputProfile: profile,
    keyboard,
    inputTuning: tuning,
  };
}

function formatKeyCode(code) {
  const aliases = {
    ArrowLeft: "LEFT",
    ArrowRight: "RIGHT",
    ArrowUp: "UP",
    ArrowDown: "DOWN",
    Space: "SPACE",
    Escape: "ESC",
    KeyC: "C",
    KeyP: "P",
    KeyX: "X",
    KeyZ: "Z",
    Digit1: "1",
    Digit2: "2",
    Digit3: "3",
    Numpad1: "NUM1",
    Numpad2: "NUM2",
    Numpad3: "NUM3",
  };
  return aliases[code] || String(code || "-").replace(/^Key/, "").replace(/^Digit/, "");
}

function getInputProfileLabel(profile) {
  return String(profile || "standard").replace(/([A-Z])/g, " $1").trim().toUpperCase();
}

function getDeviceMeta() {
  return {
    userAgent: navigator.userAgent,
    language: navigator.language,
    mobile: detectMobile(),
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
      dpr: window.devicePixelRatio || 1,
    },
  };
}

function normalizeUiSettings(raw) {
  const normalizedInput = normalizeInputSettings(raw);
  return {
    ...DEFAULT_UI_SETTINGS,
    ...(raw || {}),
    ...normalizedInput,
    missions: {
      ...DEFAULT_UI_SETTINGS.missions,
      ...(raw?.missions || {}),
    },
    seenDebuffs: {
      ...DEFAULT_UI_SETTINGS.seenDebuffs,
      ...(raw?.seenDebuffs || {}),
    },
  };
}

function loadUiSettings() {
  try {
    let raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      for (const legacyKey of LEGACY_SETTINGS_STORAGE_KEYS) {
        raw = localStorage.getItem(legacyKey);
        if (raw) break;
      }
    }
    if (!raw) return normalizeUiSettings();
    return normalizeUiSettings(JSON.parse(raw));
  } catch (err) {
    console.warn("UI 설정 로드 실패, 기본값을 사용합니다.", err);
    return normalizeUiSettings();
  }
}

function saveUiSettings() {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(uiSettings));
  } catch (err) {
    console.warn("UI 설정 저장 실패", err);
  }
}

function applyUiSettings() {
  const normalizedInput = normalizeInputSettings(uiSettings);
  uiSettings.inputProfile = normalizedInput.inputProfile;
  uiSettings.keyboard = normalizedInput.keyboard;
  uiSettings.inputTuning = normalizedInput.inputTuning;
  uiSettings.masterVolume = clamp(Number(uiSettings.masterVolume) || 0, 0, 100);
  uiSettings.bgmVolume = clamp(Number(uiSettings.bgmVolume) || 0, 0, 100);
  uiSettings.sfxVolume = clamp(Number(uiSettings.sfxVolume) || 0, 0, 100);
  uiSettings.voiceVolume = clamp(Number(uiSettings.voiceVolume) || 0, 0, 100);
  uiSettings.shake = clamp(Number(uiSettings.shake) || 0, 0, 100);
  uiSettings.mobileScale = clamp(Number(uiSettings.mobileScale) || 100, 90, 140);
  uiSettings.touchRepeat = clamp(Number(uiSettings.touchRepeat) || 75, 45, 120);
  uiSettings.muted = !!uiSettings.muted;
  uiSettings.reducedFx = !!uiSettings.reducedFx;
  uiSettings.lowPower = !!uiSettings.lowPower;
  uiSettings.lowStimAudio = !!uiSettings.lowStimAudio;
  uiSettings.devPanel = !!uiSettings.devPanel;
  uiSettings.controlAdvanced = !!uiSettings.controlAdvanced;
  uiSettings.preset = uiSettings.preset || "custom";
  if (!HAPTIC_LEVELS.includes(uiSettings.hapticLevel)) {
    uiSettings.hapticLevel = "normal";
  }

  audio.setMasterVolume(uiSettings.masterVolume / 100);
  audio.setChannelVolume("bgm", uiSettings.bgmVolume / 100);
  audio.setChannelVolume("sfx", uiSettings.sfxVolume / 100);
  audio.setChannelVolume("voice", uiSettings.voiceVolume / 100);
  audio.setLowStimAudio?.(uiSettings.lowStimAudio);
  audio.setMuted(uiSettings.muted);

  const shakeScale = (uiSettings.shake / 100)
    * (uiSettings.reducedFx ? 0.65 : 1)
    * (uiSettings.lowPower ? 0.6 : 1);
  impact.maxOffset = 12 * shakeScale;
  game?.setScreenShakeScale?.(shakeScale);
  game?.setInputTuning?.("player", uiSettings.inputTuning);
  bgFx.setReducedMotion?.(uiSettings.reducedFx || uiSettings.lowPower);
  document.body.classList.toggle("reduced-effects", uiSettings.reducedFx);
  document.body.classList.toggle("low-power-mode", uiSettings.lowPower);
  applyMobileLayoutPreset(uiSettings.mobileLayout);
  document.documentElement.style.setProperty("--mobile-btn-size", `${Math.round(68 * (uiSettings.mobileScale / 100))}px`);

  if (masterVolumeSlider) {
    masterVolumeSlider.value = String(uiSettings.masterVolume);
  }
  if (masterVolumeValue) {
    masterVolumeValue.textContent = `${uiSettings.masterVolume}%`;
  }
  if (bgmVolumeSlider) {
    bgmVolumeSlider.value = String(uiSettings.bgmVolume);
  }
  if (bgmVolumeValue) {
    bgmVolumeValue.textContent = `${uiSettings.bgmVolume}%`;
  }
  if (sfxVolumeSlider) {
    sfxVolumeSlider.value = String(uiSettings.sfxVolume);
  }
  if (sfxVolumeValue) {
    sfxVolumeValue.textContent = `${uiSettings.sfxVolume}%`;
  }
  if (voiceVolumeSlider) {
    voiceVolumeSlider.value = String(uiSettings.voiceVolume);
  }
  if (voiceVolumeValue) {
    voiceVolumeValue.textContent = `${uiSettings.voiceVolume}%`;
  }
  if (shakeSlider) {
    shakeSlider.value = String(uiSettings.shake);
  }
  if (shakeValue) {
    shakeValue.textContent = `${uiSettings.shake}%`;
  }
  if (settingsMuteBtn) {
    settingsMuteBtn.textContent = uiSettings.muted ? "MUTED" : "MUTE OFF";
  }
  if (settingsLowStimAudioBtn) {
    settingsLowStimAudioBtn.textContent = uiSettings.lowStimAudio ? "LOW STIM ON" : "LOW STIM OFF";
  }
  if (settingsReducedFxBtn) {
    settingsReducedFxBtn.textContent = uiSettings.reducedFx ? "FX LOW" : "FX FULL";
  }
  if (settingsLowPowerBtn) {
    settingsLowPowerBtn.textContent = uiSettings.lowPower ? "LOW POWER ON" : "LOW POWER OFF";
  }
  if (mobileScaleSlider) {
    mobileScaleSlider.value = String(uiSettings.mobileScale);
  }
  if (mobileScaleValue) {
    mobileScaleValue.textContent = `${uiSettings.mobileScale}%`;
  }
  if (touchRepeatSlider) {
    touchRepeatSlider.value = String(uiSettings.touchRepeat);
  }
  if (touchRepeatValue) {
    touchRepeatValue.textContent = `${uiSettings.touchRepeat}ms`;
  }
  if (settingsHapticLevelBtn) {
    settingsHapticLevelBtn.textContent = `HAPTIC ${uiSettings.hapticLevel.toUpperCase()}`;
  }
  if (settingsTouchDebugBtn) {
    settingsTouchDebugBtn.textContent = uiSettings.touchDebug ? "TOUCH DEBUG ON" : "TOUCH DEBUG OFF";
  }
  if (settingsDevPanelBtn) {
    settingsDevPanelBtn.textContent = uiSettings.devPanel ? "DEV PANEL ON" : "DEV PANEL OFF";
    settingsDevPanelBtn.classList.toggle("active", uiSettings.devPanel);
  }
  if (inputProfileValue) {
    inputProfileValue.textContent = getInputProfileLabel(uiSettings.inputProfile);
  }
  if (inputBufferSlider) {
    inputBufferSlider.value = String(uiSettings.inputTuning.inputBufferMs);
  }
  if (inputBufferValue) {
    inputBufferValue.textContent = `${uiSettings.inputTuning.inputBufferMs}ms`;
  }
  if (dasSlider) {
    dasSlider.value = String(uiSettings.inputTuning.dasMs);
  }
  if (dasValue) {
    dasValue.textContent = `${uiSettings.inputTuning.dasMs}ms`;
  }
  if (arrSlider) {
    arrSlider.value = String(uiSettings.inputTuning.arrMs);
  }
  if (arrValue) {
    arrValue.textContent = `${uiSettings.inputTuning.arrMs}ms`;
  }
  if (softDropRepeatSlider) {
    softDropRepeatSlider.value = String(uiSettings.inputTuning.softDropRepeatMs);
  }
  if (softDropRepeatValue) {
    softDropRepeatValue.textContent = `${uiSettings.inputTuning.softDropRepeatMs}ms`;
  }
  if (lockResetLimitSlider) {
    lockResetLimitSlider.value = String(uiSettings.inputTuning.lockResetLimit);
  }
  if (lockResetLimitValue) {
    lockResetLimitValue.textContent = String(uiSettings.inputTuning.lockResetLimit);
  }
  if (irsToggleBtn) {
    irsToggleBtn.textContent = uiSettings.inputTuning.irsEnabled ? "IRS ON" : "IRS OFF";
  }
  if (ihsToggleBtn) {
    ihsToggleBtn.textContent = uiSettings.inputTuning.ihsEnabled ? "IHS ON" : "IHS OFF";
  }
  if (hardDropBufferBtn) {
    hardDropBufferBtn.textContent = uiSettings.inputTuning.hardDropBufferEnabled ? "HARD DROP BUFFER ON" : "HARD DROP BUFFER OFF";
  }
  if (controlAdvancedBtn) {
    controlAdvancedBtn.textContent = uiSettings.controlAdvanced ? "ADVANCED ON" : "ADVANCED OFF";
    controlAdvancedBtn.classList.toggle("active", uiSettings.controlAdvanced);
  }
  if (controlAdvancedPanel) {
    controlAdvancedPanel.classList.toggle("hidden", !uiSettings.controlAdvanced);
  }
  presetButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.preset === uiSettings.preset);
  });
  controlPresetButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.inputPreset === uiSettings.inputProfile);
  });
  mobileLayoutButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.layout === uiSettings.mobileLayout);
  });
  Object.entries(REBIND_VALUE_IDS).forEach(([action, id]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = (uiSettings.keyboard?.[action] || []).map(formatKeyCode).join(" / ") || "-";
  });
  syncAudioStatus();
  syncRotateHint();
  syncTouchDebugPanel();
  syncDevPanel();
  renderMissionChecklist();
  syncImpactProfile();
}

function isGameplayInputBlocked() {
  return document.body.classList.contains("settings-open")
    || document.body.classList.contains("result-open")
    || document.body.classList.contains("briefing-open")
    || !!pauseOverlay?.classList.contains("visible");
}

function syncImpactProfile(levelName = selectedDifficulty) {
  const decayByLevel = {
    병아리: 4.1,
    하수인: 4.25,
    기사: 4.4,
    마왕군주: 4.65,
    데몬킹: 4.9,
  };
  impact.setDecay?.(decayByLevel[levelName] || 4.4);
}

function syncAudioStatus() {
  if (bgmStateValue) {
    bgmStateValue.textContent = audio.getBGMState().toUpperCase();
  }
  if (trackNameValue) {
    trackNameValue.textContent = audio.getCurrentTrackName();
  }
  if (musicDriveValue) {
    musicDriveValue.textContent = audio.getMusicDriveLabel?.() || "CALM";
  }
  if (bossLayerValue) {
    bossLayerValue.textContent = audio.getBossLayerLabel?.() || "OFF";
  }
}

function renderMissionChecklist() {
  if (!missionChecklist || !missionProgressValue) return;
  const completedCount = ONBOARDING_MISSIONS.filter((mission) => uiSettings.missions?.[mission.id]).length;
  missionProgressValue.textContent = `${completedCount} / ${ONBOARDING_MISSIONS.length}`;
  missionChecklist.innerHTML = ONBOARDING_MISSIONS
    .map((mission) => {
      const done = !!uiSettings.missions?.[mission.id];
      return `
        <div class="mission-item ${done ? "complete" : ""}">
          <strong>${mission.title}</strong>
          <span>${done ? "완료" : mission.detail}</span>
        </div>
      `;
    })
    .join("");
}

function completeMission(missionId) {
  if (!uiSettings.missions || uiSettings.missions[missionId]) return;
  uiSettings.missions[missionId] = true;
  saveUiSettings();
  renderMissionChecklist();
  const mission = ONBOARDING_MISSIONS.find((item) => item.id === missionId);
  if (mission) {
    showFloatingNotification("MISSION CLEAR", mission.title);
  }
}

function getBossPhase(aiState) {
  if (!aiState?.bossModeEnabled) return 0;
  const hp = Math.max(0, Number(aiState.bossHp) || 0);
  if (hp <= 15) return 3;
  if (hp <= 40) return 2;
  if (hp <= 70) return 1;
  return 0;
}

function syncRotateHint() {
  if (!rotateHint) return;
  const shouldShow = hasStarted
    && detectMobile()
    && window.matchMedia("(orientation: portrait)").matches
    && !document.body.classList.contains("settings-open")
    && !document.body.classList.contains("briefing-open")
    && !document.body.classList.contains("result-open");
  rotateHint.classList.toggle("hidden", !shouldShow);
}

function syncTouchDebugPanel() {
  if (!touchDebugPanel) return;
  const visible = !!uiSettings.devPanel;
  touchDebugPanel.classList.toggle("hidden", !visible);
}

function syncDevPanel() {
  if (touchDebugAction) {
    touchDebugAction.textContent = touchMetrics.lastAction;
  }
  if (touchDebugMeta) {
    touchDebugMeta.textContent = `press:${touchMetrics.presses} · repeat:${touchMetrics.repeats} · last:${touchMetrics.lastDeltaMs}ms · shift:${sessionDiagnostics.neonShiftActivations} · resonance:${sessionDiagnostics.resonanceTriggers} · counter:${sessionDiagnostics.layerCounters}`;
  }
  if (devFpsMeta) {
    devFpsMeta.textContent = `fps:${Math.round(sessionDiagnostics.currentFps || 0)} · avg:${Math.round(sessionDiagnostics.avgFps || 0)} · min:${Math.round(sessionDiagnostics.minFps || 0)}`;
  }
  if (devAudioMeta) {
    const audioSnapshot = audio.getAudioDebugSnapshot?.() || {};
    devAudioMeta.textContent = `audio:${audioSnapshot.ctxState || "idle"} · bgm:${audioSnapshot.bgmState || "normal"} · drive:${audioSnapshot.driveLabel || "-"} · track:${audioSnapshot.trackName || "-"}`;
  }
  if (devGameMeta) {
    const incomingCount = game?.getIncomingAttacks?.("player")?.length || 0;
    const aiState = game?.getState?.("ai");
    const playerState = game?.getState?.("player");
    const shiftActive = !!playerState && (playerState.neonShiftUntil || 0) > performance.now();
    const residueCount = Array.isArray(playerState?.neonResidueRows)
      ? playerState.neonResidueRows.filter((entry) => (entry?.until || 0) > performance.now()).length
      : 0;
    const counterLabel = playerState && (playerState.layerCounterUntil || 0) > performance.now()
      ? (playerState.layerCounterLabel || "on")
      : "off";
    devGameMeta.textContent = `boss:${getBossPhase(aiState)} · incoming:${incomingCount} · shift:${shiftActive ? "on" : "off"} · residue:${residueCount} · counter:${counterLabel}`;
  }
  if (devErrorMeta) {
    devErrorMeta.textContent = `error:${sessionDiagnostics.lastError || "none"}`;
  }
}

function applyMobileLayoutPreset(layoutName = "default") {
  uiSettings.mobileLayout = layoutName;
  document.body.classList.toggle("mobile-layout-lefty", layoutName === "lefty");
  document.body.classList.toggle("mobile-layout-righty", layoutName === "righty");
  document.body.classList.toggle("mobile-layout-compact", layoutName === "compact");
}

function handleTouchDebug(kind, action) {
  const now = performance.now();
  touchMetrics.lastDeltaMs = touchMetrics.lastAt ? Math.round(now - touchMetrics.lastAt) : 0;
  touchMetrics.lastAt = now;
  touchMetrics.lastAction = `${kind.toUpperCase()} · ${String(action || "idle").toUpperCase()}`;
  if (kind === "repeat") {
    touchMetrics.repeats += 1;
  } else if (kind === "start") {
    touchMetrics.presses += 1;
  }
  if (touchDebugAction) {
    touchDebugAction.textContent = touchMetrics.lastAction;
  }
  if (touchDebugMeta) {
    touchDebugMeta.textContent = `press:${touchMetrics.presses} · repeat:${touchMetrics.repeats} · last:${touchMetrics.lastDeltaMs}ms`;
  }
  syncDevPanel();
}

function resetTouchMetrics() {
  touchMetrics.presses = 0;
  touchMetrics.repeats = 0;
  touchMetrics.lastAction = "IDLE";
  touchMetrics.lastDeltaMs = 0;
  touchMetrics.lastAt = 0;
  if (touchDebugAction) {
    touchDebugAction.textContent = "IDLE";
  }
  if (touchDebugMeta) {
    touchDebugMeta.textContent = "press:0 · repeat:0 · last:0ms";
  }
  syncDevPanel();
}

function cycleHapticLevel() {
  const currentIndex = HAPTIC_LEVELS.indexOf(uiSettings.hapticLevel);
  const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % HAPTIC_LEVELS.length : 0;
  uiSettings.hapticLevel = HAPTIC_LEVELS[nextIndex];
  applyUiSettings();
  saveUiSettings();
}

function applyCalibrationPreset() {
  uiSettings.masterVolume = 84;
  uiSettings.bgmVolume = uiSettings.lowStimAudio ? 54 : 64;
  uiSettings.sfxVolume = uiSettings.lowStimAudio ? 72 : 88;
  uiSettings.voiceVolume = uiSettings.lowStimAudio ? 78 : 92;
  uiSettings.preset = uiSettings.lowStimAudio ? "quiet" : "cinematic";
  applyUiSettings();
  saveUiSettings();
}

function recordInputMetric(kind, action, meta = {}) {
  if (kind === "press") {
    sessionDiagnostics.inputPresses += 1;
  } else if (kind === "repeat") {
    sessionDiagnostics.inputRepeats += 1;
  } else if (kind === "buffered") {
    sessionDiagnostics.bufferedInputs += 1;
  } else if (kind === "blocked" || kind === "dropped") {
    sessionDiagnostics.droppedInputs += 1;
  }
  sessionDiagnostics.lastInputAction = `${kind}:${action}`;
  sessionDiagnostics.lastInputMeta = meta;
  syncDevPanel();
}

function recordRuntimeError(source, error) {
  const text = `${source}:${error?.message || error || "unknown"}`;
  sessionDiagnostics.lastError = text;
  sessionDiagnostics.errors.push({
    at: new Date().toISOString(),
    source,
    message: error?.message || String(error || "unknown"),
  });
  sessionDiagnostics.errors = sessionDiagnostics.errors.slice(-20);
  syncDevPanel();
}

function exportSessionDiagnostics() {
  const snapshot = {
    buildVersion: "3.15.1",
    deviceMeta: getDeviceMeta(),
    uiSettings,
    sessionDiagnostics,
    recentBattle: loadRecentBattle(),
  };
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
  const link = document.createElement("a");
  link.href = url;
  link.download = `codextirs-session-${stamp}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function clearSessionDiagnostics() {
  sessionDiagnostics = createSessionDiagnostics();
  resetTouchMetrics();
  syncDevPanel();
}

function beginRebindCapture(action) {
  activeRebindAction = action;
  document.querySelectorAll(".keybind-btn").forEach((btn) => {
    btn.classList.toggle("capturing", btn.dataset.rebindAction === action);
    if (btn.dataset.rebindAction === action) {
      btn.textContent = "PRESS A KEY";
    } else {
      btn.textContent = "REBIND";
    }
  });
}

function endRebindCapture() {
  activeRebindAction = "";
  document.querySelectorAll(".keybind-btn").forEach((btn) => {
    btn.classList.remove("capturing");
    btn.textContent = "REBIND";
  });
}

function captureRebind(action, code) {
  const keyboard = { ...uiSettings.keyboard };
  Object.keys(keyboard).forEach((key) => {
    keyboard[key] = [...(keyboard[key] || [])].filter((item) => item !== code);
  });

  if (action === "pause" && (code === "Space" || code === "ArrowUp")) {
    showFloatingNotification("재지정 제한", "PAUSE는 하드드롭/회전과 겹치는 키를 허용하지 않습니다.");
    endRebindCapture();
    return;
  }
  if ((action === "hardDrop" && (keyboard.pause || []).includes(code))
    || (action === "pause" && (keyboard.hardDrop || []).includes(code))) {
    showFloatingNotification("재지정 제한", "HARD DROP과 PAUSE는 같은 키를 사용할 수 없습니다.");
    endRebindCapture();
    return;
  }
  if ((action === "rotateCW" && (keyboard.rotateCCW || []).includes(code))
    || (action === "rotateCCW" && (keyboard.rotateCW || []).includes(code))) {
    showFloatingNotification("재지정 제한", "시계/반시계 회전은 같은 키를 사용할 수 없습니다.");
    endRebindCapture();
    return;
  }

  keyboard[action] = [code];
  if (action === "pause" && keyboard.pause.length === 0) {
    keyboard.pause = [...DEFAULT_KEYBOARD_MAPPING.pause];
  }
  uiSettings.keyboard = keyboard;
  uiSettings.inputProfile = "custom";
  applyUiSettings();
  saveUiSettings();
  endRebindCapture();
}

function applyInputPreset(name) {
  if (!INPUT_PRESETS[name]) return;
  uiSettings.inputProfile = name;
  uiSettings.inputTuning = { ...INPUT_PRESETS[name] };
  applyUiSettings();
  saveUiSettings();
}

function analyzeBattleSummary(summary) {
  const feedback = [];
  if (summary.winner !== "player") {
    if ((summary.metrics?.skillsUsed || 0) === 0 && (summary.metrics?.gaugeReadyCount || 0) > 0) {
      feedback.push({
        title: "게이지 활용 부족",
        text: `게이지 MAX를 ${summary.metrics.gaugeReadyCount}회 만들고도 스킬을 쓰지 못했습니다. 1 / 2 / 3을 더 빨리 소모하십시오.`,
      });
    }
    if ((summary.metrics?.holdsUsed || 0) === 0) {
      feedback.push({
        title: "홀드 사용 필요",
        text: "이번 전투에서 홀드를 쓰지 않았습니다. 초반 꼬인 조각을 저장하면 생존률이 크게 올라갑니다.",
      });
    }
    if ((summary.metrics?.specialHitsTaken || 0) >= 2) {
      feedback.push({
        title: "특수 패턴 대응 보강",
        text: `특수 패턴을 ${summary.metrics.specialHitsTaken}회 맞았습니다. STATUS와 INCOMING 위젯을 더 자주 확인하십시오.`,
      });
    }
  } else {
    feedback.push({
      title: "전투 우세 유지",
      text: `${summary.difficulty}에서 승리했습니다. 최대 콤보 x${summary.maxCombo}와 라인 ${summary.lines}개가 핵심 지표였습니다.`,
    });
    if (summary.metrics?.reflected) {
      feedback.push({
        title: "반사 성공",
        text: `가비지 반사 ${summary.metrics.reflected}회로 흐름을 뒤집었습니다. 상위 난이도에서도 계속 유효한 패턴입니다.`,
      });
    }
  }
  if (summary.tSpins > 0 || summary.tetrises > 0) {
    feedback.push({
      title: "화력 포인트",
      text: `T-Spin ${summary.tSpins}회, Tetris ${summary.tetrises}회로 압박을 만들었습니다.`,
    });
  } else if (summary.lines >= 12) {
    feedback.push({
      title: "정리 우선 운영",
      text: "화려한 고급 기술보다 보드 정리를 우선한 경기였습니다. 다음엔 T-Spin 한두 번만 섞어도 화력이 크게 올라갑니다.",
    });
  }
  return feedback.slice(0, 3);
}

function renderBriefingStep() {
  const step = BRIEFING_STEPS[briefingStepIndex];
  if (!step) return;

  if (briefingStepValue) {
    briefingStepValue.textContent = `${briefingStepIndex + 1} / ${BRIEFING_STEPS.length}`;
  }
  if (briefingTitle) {
    briefingTitle.textContent = step.title;
  }
  if (briefingText) {
    briefingText.textContent = step.text;
  }
  if (briefingHighlights) {
    briefingHighlights.innerHTML = step.highlights
      .map((item) => `<div class="briefing-chip">${item}</div>`)
      .join("");
  }
  if (briefingDots) {
    briefingDots.innerHTML = BRIEFING_STEPS
      .map((_, index) => `<span class="briefing-dot ${index === briefingStepIndex ? "active" : ""}"></span>`)
      .join("");
  }
  if (briefingNextBtn) {
    briefingNextBtn.textContent = briefingStepIndex === BRIEFING_STEPS.length - 1 ? "START NOW" : "NEXT";
  }
}

function openBriefing(force = false) {
  if (!briefingOverlay) return;
  if (!force && document.body.classList.contains("briefing-open")) return;

  briefingPausedGame = !!hasStarted && game?.isRunning?.() && !game?.isGameOver?.();
  if (briefingPausedGame) {
    game.pause();
    audio.stopBgm();
  }

  briefingStepIndex = 0;
  renderBriefingStep();
  briefingOverlay.classList.add("visible");
  briefingOverlay.setAttribute("aria-hidden", "false");
  document.body.classList.add("briefing-open");
  syncRotateHint();
}

function closeBriefing(markSeen = true) {
  if (!briefingOverlay) return;
  briefingOverlay.classList.remove("visible");
  briefingOverlay.setAttribute("aria-hidden", "true");
  document.body.classList.remove("briefing-open");

  if (markSeen) {
    uiSettings.briefingSeen = true;
    saveUiSettings();
  }

  if (briefingPausedGame && hasStarted && !game?.isGameOver?.()) {
    game.pause();
    if (!audio.muted) {
      audio.setBGMState(audio.getBGMState(), true);
    }
  }
  briefingPausedGame = false;
  syncRotateHint();
}

function advanceBriefing() {
  if (briefingStepIndex >= BRIEFING_STEPS.length - 1) {
    closeBriefing(true);
    if (!hasStarted && !starting && !startScreen?.classList.contains("hidden")) {
      beginBattle();
    }
    return;
  }
  briefingStepIndex += 1;
  renderBriefingStep();
}

function openSettings() {
  if (!settingsOverlay) return;
  if (document.body.classList.contains("briefing-open")) return;
  endRebindCapture();

  settingsPausedGame = !!hasStarted && game?.isRunning?.() && !game?.isGameOver?.();
  if (settingsPausedGame) {
    game.pause();
    audio.stopBgm();
  }

  applyUiSettings();
  settingsOverlay.classList.add("visible");
  settingsOverlay.setAttribute("aria-hidden", "false");
  document.body.classList.add("settings-open");
  syncRotateHint();
}

function closeSettings() {
  if (!settingsOverlay) return;
  endRebindCapture();

  settingsOverlay.classList.remove("visible");
  settingsOverlay.setAttribute("aria-hidden", "true");
  document.body.classList.remove("settings-open");

  if (settingsPausedGame && hasStarted && !game?.isGameOver?.()) {
    game.pause();
    if (!audio.muted) {
      audio.setBGMState(audio.getBGMState(), true);
    }
  }
  settingsPausedGame = false;
  syncRotateHint();
}

function saveRecentBattle(summary) {
  try {
    localStorage.setItem(RECENT_BATTLE_STORAGE_KEY, JSON.stringify(summary));
  } catch (err) {
    console.warn("최근 전투 기록 저장 실패", err);
  }
}

function loadRecentBattle() {
  try {
    const raw = localStorage.getItem(RECENT_BATTLE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn("최근 전투 기록 로드 실패", err);
    return null;
  }
}

function syncRecentBattleCard() {
  if (!recentBattleCard || !recentBattleResult || !recentBattleMeta) return;

  const summary = loadRecentBattle();
  const shouldShow = !!summary && !hasStarted && !!startScreen && !startScreen.classList.contains("hidden");
  recentBattleCard.classList.toggle("hidden", !shouldShow);
  if (!shouldShow) return;

  recentBattleResult.textContent = summary.winner === "player" ? `VICTORY · ${summary.difficulty}` : `DEFEAT · ${summary.difficulty}`;
  recentBattleMeta.textContent = `점수 ${Number(summary.score || 0).toLocaleString()} · 최대 콤보 x${summary.maxCombo || 0} · ${(summary.duration || 0).toFixed(1)}초`;
}

function syncBattleWidgetsVisibility() {
  if (!battleWidgets) return;
  battleWidgets.classList.toggle("hidden", !hasStarted);
}

function showBattleCallout(title, subtitle = "", tone = "", voiceTag = "") {
  if (!battleCallout || !battleCalloutTitle || !battleCalloutSubtitle) return;
  const now = performance.now();
  const signature = `${title}::${subtitle}::${tone}`;
  if (signature === lastCalloutSignature && (now - lastCalloutAt) < 420) {
    return;
  }
  lastCalloutSignature = signature;
  lastCalloutAt = now;

  if (tone === "gold" || tone === "warn") {
    audio.duckBgm?.(tone === "gold" ? 0.74 : 0.8, 0.3);
  }
  if (voiceTag) {
    audio.playVoiceCue?.(voiceTag, tone === "warn" ? 0.9 : 1);
  }

  battleCalloutTitle.textContent = title;
  battleCalloutSubtitle.textContent = subtitle;
  battleCalloutSubtitle.style.display = subtitle ? "block" : "none";
  battleCallout.classList.remove("warn", "gold", "visible");
  if (tone) {
    battleCallout.classList.add(tone);
  }

  void battleCallout.offsetWidth;
  battleCallout.classList.add("visible");

  if (battleCalloutTimer) {
    clearTimeout(battleCalloutTimer);
  }
  battleCalloutTimer = setTimeout(() => {
    battleCallout.classList.remove("visible", "warn", "gold");
  }, 1300);
}

function formatRemainingTime(seconds) {
  return `${Math.max(0.1, seconds).toFixed(seconds >= 10 ? 0 : 1)}s`;
}

function getComboPhraseTier(combo) {
  if (combo >= 10) return 3;
  if (combo >= 7) return 2;
  if (combo >= 4) return 1;
  return 0;
}

function renderStatusEffects(playerState) {
  if (!statusEffects || !statusCountValue) return;
  if (!hasStarted || !playerState) {
    statusCountValue.textContent = "0";
    statusEffects.innerHTML = '<div class="status-empty">활성 상태 없음</div>';
    return;
  }

  const now = performance.now();
  const skillManager = getPlayerSkillManager();
  const fever = getFeverStatus();
  const effects = [];

  if (fever.active) {
    effects.push({ label: `FEVER ${fever.label || "FORGE"}`, time: fever.remainingTime, tone: "buff", priority: 105 });
  }
  const neonShiftRemain = ((playerState.neonShiftUntil || 0) - now) / 1000;
  if (neonShiftRemain > 0) {
    effects.push({ label: "SHIFT", time: neonShiftRemain, tone: "neon", priority: 110 });
  }
  const blindRemain = ((skillManager.activeEffects?.blind?.endTime || 0) - now) / 1000;
  if (blindRemain > 0) {
    effects.push({ label: "BLIND", time: blindRemain, tone: "debuff", priority: 85 });
  }
  const reflectRemain = ((skillManager.activeEffects?.garbageReflect?.endTime || 0) - now) / 1000;
  if (reflectRemain > 0) {
    effects.push({ label: "REFLECT", time: reflectRemain, tone: "buff", priority: 70 });
  }

  const residueCount = Array.isArray(playerState.neonResidueRows)
    ? playerState.neonResidueRows.filter((entry) => (entry?.until || 0) > now).length
    : 0;
  if (residueCount > 0) {
    effects.push({ label: `RESIDUE x${residueCount}`, time: 99, tone: "neon", priority: 60 });
  }
  const layerCounterRemain = ((playerState.layerCounterUntil || 0) - now) / 1000;
  if (layerCounterRemain > 0) {
    effects.push({ label: playerState.layerCounterLabel || "COUNTER", time: layerCounterRemain, tone: "buff", priority: 97 });
  }
  const itemBoostRemain = ((playerState.neonItemBoostUntil || 0) - now) / 1000;
  if (itemBoostRemain > 0) {
    effects.push({ label: "SURGE+", time: itemBoostRemain, tone: "buff", priority: 66 });
  }

  [
    ["DARK", (playerState.darknessUntil - now) / 1000, "debuff", 98],
    ["MIRROR", (playerState.mirrorMoveUntil - now) / 1000, "debuff", 96],
    ["CORRUPT", (playerState.corruptNextUntil - now) / 1000, "warning", 78],
    ["JOLT", (playerState.gravityJoltUntil - now) / 1000, "warning", 72],
    ["STAGGER", (playerState.inputDelayUntil - now) / 1000, "warning", 92],
    ["HOLD LOCK", (playerState.holdLockUntil - now) / 1000, "warning", 102],
    ["GHOST OFF", (playerState.ghostHiddenUntil - now) / 1000, "debuff", 90],
    ["ROT TAX", (playerState.rotationTaxUntil - now) / 1000, "warning", 100],
    ["LEECH", (playerState.gaugeLeechUntil - now) / 1000, "warning", 94],
    ["SCRAMBLE", (playerState.nextScrambleUntil - now) / 1000, "debuff", 88],
  ].forEach(([label, time, tone, priority]) => {
    if (time > 0) {
      effects.push({ label, time, tone, priority });
    }
  });

  effects.sort((a, b) => {
    if ((b.priority || 0) !== (a.priority || 0)) return (b.priority || 0) - (a.priority || 0);
    return (a.time || 0) - (b.time || 0);
  });

  statusCountValue.textContent = String(effects.length);
  if (!effects.length) {
    statusEffects.innerHTML = '<div class="status-empty">활성 상태 없음</div>';
    return;
  }

  const maxVisibleEffects = detectMobile() ? 4 : 5;
  const visibleEffects = effects.slice(0, maxVisibleEffects);
  const hiddenCount = Math.max(0, effects.length - visibleEffects.length);
  statusEffects.innerHTML = visibleEffects
    .map(({ label, time, tone }) => {
      return `<div class="status-chip ${tone}"><span class="status-name">${label}</span><span class="status-time">${formatRemainingTime(time)}</span></div>`;
    })
    .concat(hiddenCount > 0 ? [`<div class="status-chip meta"><span class="status-name">+${hiddenCount} MORE</span></div>`] : [])
    .join("");
}

function getIncomingAttackLabel(type) {
  const labels = {
    GarbagePush: "GARBAGE",
    CorruptNext: "CORRUPT",
    GravityJolt: "JOLT",
    StackShake: "STAGGER",
    Darkness: "DARK",
    MirrorMove: "MIRROR",
    HoldLock: "HOLD LOCK",
    GhostOut: "GHOST OFF",
    RotationTax: "ROT TAX",
    GaugeLeech: "LEECH",
    NextScramble: "SCRAMBLE",
    PierceBarrage: "PIERCE",
    DrillHex: "DRILL HEX",
    WavePush: "WAVE PUSH",
    NullBurst: "NULL BURST",
  };
  return labels[type] || type.toUpperCase();
}

function renderIncomingPreview() {
  if (!incomingValue || !incomingQueue) return;
  if (!hasStarted || !game) {
    incomingValue.textContent = "0";
    incomingQueue.innerHTML = '<div class="incoming-empty">위협 없음</div>';
    return;
  }

  const pendingAttacks = game.getIncomingAttacks("player") || [];
  const totalGarbage = pendingAttacks.reduce((sum, pending) => {
    if (pending.attackEvent?.type !== "GarbagePush") return sum;
    return sum + Math.max(0, pending.attackEvent?.strength || 0);
  }, 0);

  incomingValue.textContent = String(totalGarbage);
  if (!pendingAttacks.length) {
    incomingQueue.innerHTML = '<div class="incoming-empty">위협 없음</div>';
    return;
  }

  const grouped = new Map();
  pendingAttacks.forEach((pending) => {
    const type = pending.attackEvent?.type || "Unknown";
    const strength = Math.max(0, pending.attackEvent?.strength || 0);
    const current = grouped.get(type) || {
      type,
      totalStrength: 0,
      count: 0,
      minRemainingMs: Number.POSITIVE_INFINITY,
    };
    current.totalStrength += strength;
    current.count += 1;
    current.minRemainingMs = Math.min(current.minRemainingMs, pending.remainingMs || 0);
    grouped.set(type, current);
  });

  const groupedAttacks = [...grouped.values()].sort((a, b) => {
    if (a.type === "GarbagePush" && b.type !== "GarbagePush") return -1;
    if (a.type !== "GarbagePush" && b.type === "GarbagePush") return 1;
    return a.minRemainingMs - b.minRemainingMs;
  });
  const maxVisibleIncoming = detectMobile() ? 3 : 4;
  const visibleIncoming = groupedAttacks.slice(0, maxVisibleIncoming);
  const hiddenCount = Math.max(0, groupedAttacks.length - visibleIncoming.length);

  incomingQueue.innerHTML = visibleIncoming
    .map((entry) => {
      const tone = entry.type === "GarbagePush" ? "garbage" : "special";
      const amountText = entry.type === "GarbagePush"
        ? ` +${entry.totalStrength}`
        : entry.count > 1
          ? ` x${entry.count}`
          : "";
      return `<div class="incoming-chip ${tone}"><span class="incoming-name">${getIncomingAttackLabel(entry.type)}${amountText}</span><span class="incoming-time">${formatRemainingTime(entry.minRemainingMs / 1000)}</span></div>`;
    })
    .concat(hiddenCount > 0 ? [`<div class="incoming-chip meta"><span class="incoming-name">+${hiddenCount} MORE</span></div>`] : [])
    .join("");
}

function maybeShowContextHints(playerState) {
  if (!hasStarted
    || !playerState
    || document.body.classList.contains("briefing-open")
    || document.body.classList.contains("settings-open")
    || document.body.classList.contains("result-open")) {
    return;
  }

  if (playerState.specialReady && !lastSpecialReady) {
    sessionMetrics.gaugeReadyCount += 1;
    if (!uiSettings.hintGaugeSeen) {
      uiSettings.hintGaugeSeen = true;
      saveUiSettings();
      showFloatingNotification("게이지 MAX", "숫자 1 / 2 / 3 또는 모바일 스킬 버튼으로 필살기를 발동하세요.");
    }
  }
  lastSpecialReady = !!playerState.specialReady;

  const incoming = game?.getIncomingAttacks?.("player") || [];
  if (incoming.length && lastIncomingCount === 0) {
    sessionMetrics.incomingAlerts += 1;
    completeMission("incoming");
  }
  lastIncomingCount = incoming.length;
  if (incoming.length && !uiSettings.hintIncomingSeen) {
    uiSettings.hintIncomingSeen = true;
    saveUiSettings();
    showFloatingNotification("INCOMING 확인", "좌하단 위젯에서 들어올 가비지와 특수 패턴의 남은 시간을 먼저 확인하세요.");
  }

  const aiState = game?.getState?.("ai");
  const bossPhase = getBossPhase(aiState);
  if (bossPhase > 0 && !uiSettings.hintBossSeen) {
    uiSettings.hintBossSeen = true;
    saveUiSettings();
    showFloatingNotification("보스 페이즈", "보스 HP 구간마다 공격 패턴과 경고 사운드가 바뀝니다. STATUS와 INCOMING을 함께 보십시오.");
  }
  if (bossPhase > lastBossPhase && bossPhase > 0) {
    impact.bossPhase?.(bossPhase);
    audio.playImpactCue?.("bossPhase", { phase: bossPhase });
    audio.playCombatPhrase?.("bossSignature", { phase: bossPhase });
    game.activateNeonShift?.("player", "boss", 4200, false);
    showBattleCallout(`BOSS PHASE ${bossPhase}`, bossPhase === 3 ? "ENRAGED" : "PATTERN SHIFT", "warn", "boss");
  }
  lastBossPhase = bossPhase;
}

function buildBattleSummary(winner) {
  const playerState = game?.getState?.("player");
  const aiState = game?.getState?.("ai");
  const duration = achievementSystem.sessionData.gameStartTime
    ? (Date.now() - achievementSystem.sessionData.gameStartTime) / 1000
    : 0;

  const summary = {
    winner,
    difficulty: selectedDifficulty,
    score: playerState?.score || 0,
    lines: playerState?.lines || 0,
    maxCombo: playerState?.maxCombo || 0,
    tSpins: playerState?.stats?.tSpins || 0,
    tetrises: playerState?.stats?.tetrises || 0,
    perfects: playerState?.stats?.perfectClears || 0,
    bossHp: aiState?.bossModeEnabled ? Math.max(0, Math.floor(aiState.bossHp || 0)) : null,
    duration,
    metrics: { ...sessionMetrics },
  };
  summary.feedback = analyzeBattleSummary(summary);
  return summary;
}

function showResultOverlay(summary) {
  if (!resultOverlay) return;

  resultOverlay.classList.remove("victory", "defeat");
  resultOverlay.classList.add(summary.winner === "player" ? "victory" : "defeat");
  resultOverlay.classList.add("visible");
  resultOverlay.setAttribute("aria-hidden", "false");
  document.body.classList.add("result-open");
  syncRotateHint();

  if (resultEyebrow) {
    resultEyebrow.textContent = summary.winner === "player" ? "BATTLE WON" : "BATTLE LOST";
  }
  if (resultTitle) {
    resultTitle.textContent = summary.winner === "player" ? "VICTORY" : "DEFEAT";
  }
  if (resultSummary) {
    const bossSuffix = summary.bossHp !== null ? ` · 보스 HP ${summary.bossHp}%` : "";
    resultSummary.textContent = `${summary.difficulty} 전투 종료 · ${summary.duration.toFixed(1)}초${bossSuffix}`;
  }
  if (resultFeedbackList) {
    resultFeedbackList.innerHTML = (summary.feedback || [])
      .map((item) => `
        <div class="result-feedback-card">
          <strong>${item.title}</strong>
          <span>${item.text}</span>
        </div>
      `)
      .join("");
  }
  if (resultScore) {
    resultScore.textContent = Number(summary.score).toLocaleString();
  }
  if (resultLines) {
    resultLines.textContent = String(summary.lines);
  }
  if (resultMaxCombo) {
    resultMaxCombo.textContent = `x${summary.maxCombo}`;
  }
  if (resultTSpins) {
    resultTSpins.textContent = String(summary.tSpins);
  }
  if (resultTetrises) {
    resultTetrises.textContent = String(summary.tetrises);
  }
  if (resultPerfects) {
    resultPerfects.textContent = String(summary.perfects);
  }
}

function hideResultOverlay() {
  if (!resultOverlay) return;
  resultOverlay.classList.remove("visible", "victory", "defeat");
  resultOverlay.setAttribute("aria-hidden", "true");
  document.body.classList.remove("result-open");
  syncRotateHint();
}

function previewParseHexColor(color) {
  const hex = String(color || "#999").replace("#", "");
  const normalized = hex.length === 3
    ? hex.split("").map((char) => char + char).join("")
    : hex.padEnd(6, "0").slice(0, 6);
  const intValue = Number.parseInt(normalized, 16);
  return {
    r: (intValue >> 16) & 255,
    g: (intValue >> 8) & 255,
    b: intValue & 255,
  };
}

function previewMixColor(color, target, amount) {
  const base = previewParseHexColor(color);
  const goal = previewParseHexColor(target);
  const clamped = Math.max(0, Math.min(1, amount));
  const r = Math.round(base.r + (goal.r - base.r) * clamped);
  const g = Math.round(base.g + (goal.g - base.g) * clamped);
  const b = Math.round(base.b + (goal.b - base.b) * clamped);
  return `rgb(${r}, ${g}, ${b})`;
}

function previewWithAlpha(color, alpha) {
  const rgb = previewParseHexColor(color);
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function drawPreviewCell(ctx, x, y, size, color) {
  const light = previewMixColor(color, "#ffffff", 0.36);
  const dark = previewMixColor(color, "#09111f", 0.34);
  const core = previewMixColor(color, "#7cf7ff", 0.08);
  const shell = ctx.createLinearGradient(x, y, x + size, y + size);
  shell.addColorStop(0, light);
  shell.addColorStop(0.22, core);
  shell.addColorStop(0.7, color);
  shell.addColorStop(1, dark);
  ctx.fillStyle = shell;
  ctx.fillRect(x, y, size, size);

  ctx.fillStyle = previewWithAlpha("#ffffff", 0.24);
  ctx.fillRect(x + 2, y + 2, size - 4, Math.max(2, size * 0.16));
  ctx.fillStyle = previewWithAlpha(dark, 0.28);
  ctx.fillRect(x + 2, y + size - Math.max(2, size * 0.18) - 2, size - 4, Math.max(2, size * 0.18));
  ctx.strokeStyle = previewWithAlpha(light, 0.45);
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
}

function restartBattleRound() {
  hideResultOverlay();
  closeSettings();
  closeBriefing(false);
  hasStarted = true;
  lastSpecialReady = false;
  lastIncomingCount = 0;
  lastBossPhase = 0;
  hiddenPausedGame = false;
  sessionMetrics = createSessionMetrics();
  resetTouchMetrics();
  syncBattleWidgetsVisibility();
  game.restartRound();
  achievementSystem.startNewGame();
  achievementSystem.onFeverChange(false);
  if (pauseOverlay) {
    pauseOverlay.classList.remove("visible");
  }
  audio.resetFeverBGMSpeed?.();
  audio.updateBossPhase?.({ enabled: false, phase: 0, hpPercent: 0 });
  audio.selectTrackForDifficulty?.(selectedDifficulty);
  if (!audio.muted) {
    audio.setBGMState("normal", true);
  }
  syncRecentBattleCard();
  syncRotateHint();
}

/**
 * 블록 미리보기 렌더링
 * @param {HTMLCanvasElement} canvas - 타겟 캔버스
 * @param {string} pieceKey - 블록 종류 (null이면 비움)
 */
function renderPreview(canvas, pieceKey) {
  if (!canvas || !pieceKey || !PIECES[pieceKey]) return;
  
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  
  const shape = PIECES[pieceKey].r[0];
  const color = PIECES[pieceKey].color;
  
  // 블록 크기 계산
  const cellSize = Math.min(w / (shape[0]?.length || 4), h / shape.length) * 0.7;
  const offsetX = (w - shape[0].length * cellSize) / 2;
  const offsetY = (h - shape.length * cellSize) / 2;
  
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  
  for (let y = 0; y < shape.length; y++) {
    for (let x = 0; x < shape[y].length; x++) {
      if (shape[y][x]) {
        drawPreviewCell(
          ctx,
          offsetX + x * cellSize,
          offsetY + y * cellSize,
          cellSize - 2,
          color
        );
      }
    }
  }
  
  ctx.shadowBlur = 0;
}

/**
 * 콤보 디스플레이 표시
 * @param {number} combo - 콤보 수
 */
function showCombo(combo) {
  if (!comboDisplay || !comboText) return;
  
  comboText.textContent = `x${combo}`;
  comboDisplay.classList.remove("visible");
  
  // 강제 리플로우
  void comboDisplay.offsetWidth;
  
  comboDisplay.classList.add("visible");
  
  // 1초 후 제거
  setTimeout(() => {
    comboDisplay.classList.remove("visible");
  }, 1000);
}

/**
 * HUD 업데이트
 * @param {Object} pState - 플레이어 상태
 * @param {Object} aState - AI 상태
 */
function updateHUD(pState, aState) {
  syncBattleWidgetsVisibility();
  const now = performance.now();
  const pendingAttacks = game?.getIncomingAttacks?.("player") || [];
  const incomingGarbage = pendingAttacks.reduce((sum, pending) => {
    if (pending.attackEvent?.type !== "GarbagePush") return sum;
    return sum + Math.max(0, pending.attackEvent?.strength || 0);
  }, 0);
  const incomingSpecialCount = pendingAttacks.filter((pending) => pending.attackEvent?.type !== "GarbagePush").length;
  const bossPhase = getBossPhase(aState);

  audio.updateBossPhase?.({
    enabled: !!aState?.bossModeEnabled,
    phase: bossPhase,
    hpPercent: Number(aState?.bossHp || 0),
  });
  audio.updateAdaptiveMix?.({
    stackHeight: pState.stackHeight || 0,
    incomingGarbage,
    incomingSpecialCount,
    combo: pState.combo || 0,
    maxCombo: pState.maxCombo || 0,
    isFeverActive: !!pState.isFeverModeActive,
    bossPhase,
    bossEnabled: !!aState?.bossModeEnabled,
    bossHpPercent: Number(aState?.bossHp || 0),
    specialReady: !!pState.specialReady,
    level: pState.level || 1,
  });
  audio.updateBGMState?.({
    stackHeight: pState.stackHeight || 0,
    incomingGarbage,
    incomingSpecialCount,
    combo: pState.combo || 0,
    isFeverActive: !!pState.isFeverModeActive,
    bossPhase,
    bossEnabled: !!aState?.bossModeEnabled,
    bossHpPercent: Number(aState?.bossHp || 0),
  });
  syncAudioStatus();
  const audioSnapshot = audio.getAudioDebugSnapshot?.() || {};
  const neonShiftBoost = (pState.neonShiftUntil || 0) > now ? 0.45 : 0;
  bgFx.setEnergy?.((Number(audioSnapshot.drive || 0) * 1.15) + neonShiftBoost);
  document.body.classList.toggle("neon-shift-active", hasStarted && ((pState.neonShiftUntil || 0) > now));

  const percent = Math.floor(pState.specialGauge);
  
  // 데스크톱 HUD 업데이트
  // 점수
  if (scoreValue) {
    scoreValue.textContent = pState.score.toLocaleString();
  }
  
  // 콤보
  if (comboValue) {
    comboValue.textContent = `x${pState.combo}`;
    if (pState.combo > 0) {
      comboValue.classList.add("combo-active");
    } else {
      comboValue.classList.remove("combo-active");
    }
  }
  
  // 레벨
  if (levelValue) {
    levelValue.textContent = `Lv ${pState.level}`;
  }
  
  // AI 레벨
  if (aiLevelValue) {
    aiLevelValue.textContent = aState.id === "ai" ? selectedDifficulty : "-";
  }
  if (bossHpPanel) {
    bossHpPanel.classList.toggle("hidden", !aState.bossModeEnabled);
  }
  if (bossHpValue) {
    const bossHp = Math.max(0, Math.floor(aState.bossHp ?? 100));
    bossHpValue.textContent = `${bossHp}%`;
  }
  if (bossHpFill) {
    bossHpFill.style.setProperty("--boss-hp-percent", `${Math.max(0, aState.bossHp ?? 100)}%`);
  }
  
  // 필살기 게이지
  if (gaugeValue && specialGauge) {
    gaugeValue.textContent = `${percent}%`;
    specialGauge.style.setProperty("--gauge-percent", `${percent}%`);
    
    // MAX 상태
    if (pState.specialReady) {
      specialGauge.parentElement.classList.add("gauge-max");
    } else {
      specialGauge.parentElement.classList.remove("gauge-max");
    }
  }
  
  // [v3.0.0] 모바일 상태바 업데이트
  if (mobileScore) {
    mobileScore.textContent = pState.score.toLocaleString();
  }
  if (mobileCombo) {
    mobileCombo.textContent = `x${pState.combo}`;
  }
  if (mobileLevel) {
    mobileLevel.textContent = pState.level;
  }
  if (mobileGaugeFill) {
    mobileGaugeFill.style.setProperty("--gauge-percent", `${percent}%`);
  }
  
  // [v5.0.0] 스킬 버튼 활성화/비활성화
  const skillManager = getPlayerSkillManager();
  const skillButtons = [skillBtn1, skillBtn2, skillBtn3, ...mobileSkillBtns];
  const skillTypes = [SkillType.BLIND, SkillType.BLOCK_SWAP, SkillType.GARBAGE_REFLECT];
  
  skillButtons.forEach((btn, index) => {
    if (btn) {
      const canUse = skillManager.canUseSkill(skillTypes[index % skillTypes.length]);
      btn.disabled = !canUse;
    }
  });
  
  // 홀드 블록
  if (holdCanvas && pState.hold) {
    renderPreview(holdCanvas, pState.hold);
  } else if (holdCanvas && !pState.hold) {
    const ctx = holdCanvas.getContext("2d");
    ctx.clearRect(0, 0, holdCanvas.width, holdCanvas.height);
  }
  
  // 다음 블록들
  if (pState.queue && pState.queue.length >= 3) {
    nextPreviewPanel?.classList.toggle("scan-extended", (pState.nextPreviewCount || 3) > 3);
    renderPreview(next1Canvas, pState.queue[0]);
    renderPreview(next2Canvas, pState.queue[1]);
    renderPreview(next3Canvas, pState.queue[2]);
    if ((pState.nextPreviewCount || 3) > 3) {
      renderPreview(next4Canvas, pState.queue[3]);
      renderPreview(next5Canvas, pState.queue[4]);
    } else {
      [next4Canvas, next5Canvas].forEach((canvas) => {
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      });
    }
  }

  renderStatusEffects(pState);
  renderIncomingPreview();
  maybeShowContextHints(pState);
}

/**
 * 게임 이벤트 처리
 * @param {string} evt - 이벤트 이름
 * @param {any} data - 이벤트 데이터
 */
function handleGameEvent(evt, data) {
  switch (evt) {
    case "line":
      impact.lineClear?.(data?.count || 1, data || {});
      audio.playImpactCue?.("lineClear", {
        lines: data?.count || 1,
        tSpin: data?.tSpin,
        perfect: data?.perfect,
      });
      if (data?.owner === "player") {
        const lineName = {
          1: "SINGLE",
          2: "DOUBLE",
          3: "TRIPLE",
          4: "TETRIS",
        };
        if (data.perfect) {
          showBattleCallout("PERFECT CLEAR", data.patternLabel || (data.backToBack ? "BACK TO BACK" : "BOARD ERASED"), "gold", "perfect");
        } else if (data.tSpin) {
          showBattleCallout(`T-SPIN ${data.tSpin.toUpperCase()}`, data.patternLabel || (data.backToBack ? "BACK TO BACK" : "SPECIAL CLEAR"), "gold", "tspin");
        } else if (data.count >= 2) {
          const voiceTag = data.count >= 4 ? "tetris" : data.count === 3 ? "triple" : "double";
          showBattleCallout(lineName[data.count] || "CLEAR", data.patternLabel || (data.backToBack ? "BACK TO BACK" : "LINE CLEAR"), data.count >= 4 ? "gold" : "", voiceTag);
        }
        if (data.combo >= 5) {
          achievementSystem.onCombo(data.combo, !!game.getState("player")?.isFeverModeActive);
        }
        if (data.tSpin) {
          achievementSystem.onTSpinClear();
        }
        if (data.count === 4) {
          achievementSystem.onTetrisClear();
        }
      }
      break;
      
    case "attack":
      impact.pulse(1.45);
      audio.triggerSfx("attack", 1.2);
      if (data?.from === "player" && data?.amount > 0) {
        if (data.patternTag === "neonShift") {
          showBattleCallout(`NEON SURGE +${data.amount}`, "SHIFT PRESSURE", "gold", "attack");
        } else if (data.type === "GarbagePush") {
          showBattleCallout(`GARBAGE +${data.amount}`, "PRESSURE", "gold", "attack");
        } else {
          showBattleCallout(getIncomingAttackLabel(data.type), data.patternTag ? "PATTERN ATTACK" : "SPECIAL ATTACK", "gold", "attack");
        }
      }
      break;

    case "pattern":
      if (data?.owner === "player") {
        audio.playCombatPhrase?.("pattern", { tag: data?.tag, tone: data?.tone });
      }
      if (data?.owner === "player" && !data?.attackType) {
        showBattleCallout(data.label || "PATTERN", "CLEAN DEFENSE", data.tone === "warn" ? "warn" : "", "levelup");
      }
      break;
      
    case "attacked":
      if (data?.target === "player" && data?.countered) {
        break;
      }
      if ((data?.amount || 0) > 0 || data?.type !== "GarbagePush") {
        impact.pulse(1.3);
        audio.triggerSfx("damage", 1.0);
      }
      if (data?.target === "player" && data?.amount > 0) {
        achievementSystem.onDamageTaken(data.amount);
      }
      if (data?.target === "player" && data?.type && data.type !== "GarbagePush") {
        if (["HoldLock", "GhostOut", "RotationTax", "GaugeLeech", "NextScramble", "Darkness", "MirrorMove"].includes(data.type)) {
          audio.playCombatPhrase?.("ruleBreak", { type: data.type });
        }
        sessionMetrics.specialHitsTaken += 1;
        completeMission("incoming");
        if (!uiSettings.seenDebuffs?.[data.type]) {
          uiSettings.seenDebuffs[data.type] = true;
          saveUiSettings();
          showFloatingNotification(getIncomingAttackLabel(data.type), "처음 맞은 디버프입니다. STATUS 타이머와 INCOMING 시간을 같이 읽으십시오.");
        }
        const inboundLabel = ["PierceBarrage", "DrillHex", "WavePush", "NullBurst"].includes(data.type)
          ? "PATTERN INBOUND"
          : "DEBUFF INBOUND";
        showBattleCallout(getIncomingAttackLabel(data.type), inboundLabel, "warn", "warning");
      }
      break;
      
    case "impact":
      impact.pulse(1.8);
      audio.triggerSfx("impact", 1.45);
      break;
      
    case "harddrop":
      audio.triggerSfx("harddrop", 1.0);
      break;
      
    case "move":
      audio.triggerSfx("move", 0.5);
      break;
      
    case "rotate":
      audio.triggerSfx("rotate", 0.6);
      break;
      
    case "hold":
      audio.triggerSfx("hold", 0.8);
      sessionMetrics.holdsUsed += 1;
      completeMission("hold");
      break;
      
    case "tspin":
      impact.pulse(2.0);
      audio.triggerSfx("tspin", 1.5);
      break;
      
    case "combo":
      showCombo(data.combo);
      audio.playComboSound?.(data.combo);
      if (data?.owner === "player") {
        const comboTier = getComboPhraseTier(data.combo);
        if (comboTier > 0) {
          audio.playCombatPhrase?.("comboTier", { tier: comboTier });
        }
      }
      if (data?.owner === "player" && data.combo >= 7) {
        showBattleCallout(`${data.combo} COMBO`, "CHAIN CONTINUES", "gold", "combo");
      }
      if (data?.owner === "player" && data.combo >= 10) {
        sessionMetrics.combo10Reached = true;
        completeMission("combo10");
      }
      break;
      
    case "perfect":
      impact.lineClear?.(4, { perfect: true, hitstopMs: 120 });
      audio.playImpactCue?.("perfect", { perfect: true });
      break;
      
    case "levelup":
      audio.triggerSfx("levelup", 1.3);
      showBattleCallout(`LEVEL ${data}`, "SPEED UP", "gold", "levelup");
      break;
      
    case "ko":
      impact.ko?.();
      audio.playImpactCue?.("ko", { target: data });
      showBattleCallout(data === "ai" ? "K.O." : "DANGER", data === "ai" ? "FINISH" : "PLAYER DOWN", data === "ai" ? "gold" : "warn", data === "ai" ? "ko" : "warning");
      break;
      
    case "gameover":
      const winner = data;
      if (winner === "player") {
        audio.playVictorySound?.();
        completeMission("win");
        const aiBlindActive = getAiSkillManager().isBlindActive();
        const gameTime = achievementSystem.sessionData.gameStartTime
          ? (Date.now() - achievementSystem.sessionData.gameStartTime) / 1000
          : null;
        const tookDamage = achievementSystem.sessionData.damageTaken > 0;
        achievementSystem.onBattleWin({
          isPerfect: !tookDamage,
          isFullHealth: !tookDamage,
          gameTime,
          opponentBlinded: aiBlindActive,
        });
      } else {
        audio.playDefeatSound?.();
      }
      const summary = buildBattleSummary(winner);
      saveRecentBattle(summary);
      closeSettings();
      showResultOverlay(summary);
      break;
      
    case "special":
      const skillName = {
        [SkillType.BLIND]: "BLIND",
        [SkillType.BLOCK_SWAP]: "BLOCK SWAP",
        [SkillType.GARBAGE_REFLECT]: "REFLECT",
      };
      const fusionName = {
        phantomMirror: "PHANTOM MIRROR",
        distortField: "DISTORT FIELD",
        backflowShift: "BACKFLOW SHIFT",
      };
      if (data?.skill === SkillType.BLIND) {
        audio.playBlindSkillSound?.();
      } else if (data?.skill === SkillType.BLOCK_SWAP) {
        audio.playBlockSwapSkillSound?.();
      } else if (data?.skill === SkillType.GARBAGE_REFLECT) {
        audio.playGarbageReflectSkillSound?.();
      } else {
        audio.triggerSfx("special", 2.0);
      }
      if (data?.user === "player" && data?.skill) {
        if (data?.fusion) {
          audio.playCombatPhrase?.("fusion", { type: data.fusion.type });
        }
        sessionMetrics.skillsUsed += 1;
        completeMission("skill");
        achievementSystem.onSkillUse(data.skill);
        showBattleCallout(
          data?.fusion ? (fusionName[data.fusion.type] || "FUSION") : (skillName[data.skill] || "SPECIAL"),
          data?.fusion ? "SKILL FUSION" : "PLAYER SKILL",
          "gold",
          "skill"
        );
      } else if (data?.user === "ai" && data?.skill) {
        showBattleCallout(
          "AI SKILL",
          data?.fusion ? (fusionName[data.fusion.type] || "FUSION") : (skillName[data.skill] || data.skill.toUpperCase()),
          "warn",
          "warning"
        );
      }
      break;

    case "feverEnter":
      achievementSystem.onFeverChange(true);
      audio.playCombatPhrase?.("feverMode", { type: data?.type });
      if (!uiSettings.hintFeverSeen) {
        uiSettings.hintFeverSeen = true;
        saveUiSettings();
        showFloatingNotification("FEVER MODE", "10콤보 이상이면 피버가 발동하고, 타입에 따라 규칙이 바뀝니다.");
      }
      showBattleCallout(`FEVER ${data?.label || "FORGE"}`, "ATTACK x1.5", "gold", "fever");
      break;

    case "neonShift":
      if (data?.owner === "player") {
        sessionDiagnostics.neonShiftActivations += 1;
      }
      audio.playCombatPhrase?.("neonShift", { source: data?.source });
      if (data?.owner === "player") {
        const sourceLabel = {
          fever: "FEVER LAYER",
          tspin: "T-SPIN DRIVE",
          perfect: "PERFECT RESONANCE",
          boss: "BOSS PRESSURE",
        };
        showBattleCallout("NEON SHIFT", sourceLabel[data?.source] || "LAYER ONLINE", "gold", "fever");
      }
      break;

    case "neonShiftEnd":
      if (data?.owner === "player") {
        impact.shiftFade?.();
        audio.playCombatPhrase?.("shiftEnd", { source: data?.source });
        showBattleCallout("SHIFT FADE", data?.residueCount ? `RESIDUE ${data.residueCount}` : "LAYER OFFLINE", "", "");
      }
      break;

    case "resonance":
      if (data?.owner === "player") {
        sessionDiagnostics.resonanceTriggers += 1;
        audio.playCombatPhrase?.("resonance", { type: data?.type });
        showBattleCallout(data?.label || "RESONANCE", data?.subtitle || "LAYER SYNC", data?.tone || "gold", "fever");
      }
      break;

    case "layerCounter":
      if (data?.owner === "player") {
        sessionDiagnostics.layerCounters += 1;
        impact.counter?.(data?.type);
        audio.playCombatPhrase?.("counter", { type: data?.type });
        if (data?.type === "guard") {
          audio.playShieldBlockSound?.();
        }
        showBattleCallout(data?.label || "COUNTER", data?.subtitle || "LAYER RESPONSE", data?.tone || "gold", "fever");
      }
      break;

    case "feverExit":
      achievementSystem.onFeverChange(false);
      break;

    case "shieldBlock":
      audio.playShieldBlockSound?.();
      if (data?.target === "player") {
        achievementSystem.onItemCollect("shield_block");
      }
      break;

    case "item":
      if (data?.owner === "player") {
        achievementSystem.onItemCollect(data.itemType);
        if (data.itemType === "bomb") {
          audio.playBombSound?.();
          showBattleCallout("BOMB", "3x3 DESTROY", "gold", "item");
          achievementSystem.onBombClear();
        } else if (data.itemType === "star") {
          audio.playStarSound?.();
          showBattleCallout("STAR", "LINE BONUS", "gold", "item");
        } else if (data.itemType === "shield") {
          audio.playShieldSound?.();
          showBattleCallout("SHIELD", "BLOCK READY", "gold", "item");
        }
      }
      break;

    case "reflected":
      if (data?.from === "player") {
        sessionMetrics.reflected += 1;
        achievementSystem.onReflectGarbage(data.amount || 0);
      }
      break;
  }
}

// 게임 인스턴스 생성
game = createGame({
  playerCanvas,
  aiCanvas,
  onHud: updateHUD,
  onEvent: handleGameEvent,
  getInputTuning: () => uiSettings.inputTuning,
});
applyUiSettings();
syncBattleWidgetsVisibility();
syncRecentBattleCard();
if (!uiSettings.briefingSeen) {
  setTimeout(() => {
    if (!hasStarted && !document.body.classList.contains("briefing-open")) {
      openBriefing(false);
    }
  }, 220);
}

/**
 * 입력 디스패치
 * @param {string} playerId - 플레이어 ID
 * @param {string} action - 액션
 */
function dispatch(playerId, action) {
  if (playerId === "player" && action === "pause") {
    togglePause();
    return;
  }
  if (playerId === "player" && impact.isHitstopActive?.()) {
    if (game.enqueueBufferedAction?.("player", action)) {
      recordInputMetric("buffered", action, { source: "hitstop" });
    } else {
      recordInputMetric("blocked", action, { source: "hitstop" });
    }
    return;
  }
  const applied = game.dispatchInput(playerId, action);
  if (!applied && playerId === "player") {
    if (BUFFERABLE_ACTIONS.has(action) && game.enqueueBufferedAction?.("player", action)) {
      recordInputMetric("buffered", action, { source: "dispatch" });
      return;
    }
    recordInputMetric("dropped", action, { source: "dispatch" });
  }
}

/**
 * 난이도 적용
 * @param {string} levelName - 난이도 이름
 */
function applyDifficulty(levelName) {
  selectedDifficulty = levelName;
  game.setDifficulty(levelName);
  syncImpactProfile(levelName);
  if (difficultyBadge) {
    difficultyBadge.textContent = `AI: ${levelName}`;
    difficultyBadge.classList.toggle("danger", levelName === "데몬킹");
  }
}

/**
 * 전투 시작
 */
async function beginBattle() {
  if (starting) return;
  if (!stage || !startScreen) return;
  
  starting = true;
  hideResultOverlay();
  closeSettings();
  closeBriefing(true);
  applyDifficulty(selectedDifficulty);
  
  stage.classList.remove("prestart");
  startScreen.classList.add("hidden");
  hasStarted = true;
  lastSpecialReady = false;
  lastIncomingCount = 0;
  lastBossPhase = 0;
  hiddenPausedGame = false;
  sessionMetrics = createSessionMetrics();
  sessionDiagnostics = createSessionDiagnostics();
  resetTouchMetrics();
  sessionMetrics.startedAt = Date.now();
  sessionDiagnostics.startedAt = Date.now();
  syncBattleWidgetsVisibility();
  syncRecentBattleCard();
  showBattleCallout("BATTLE START", selectedDifficulty, "gold", "start");
  
  // 일시정지 메뉴 숨김
  if (pauseOverlay) {
    pauseOverlay.classList.remove("visible");
  }
  
  game.start();
  game.restartRound();
  achievementSystem.startNewGame();
  achievementSystem.onFeverChange(false);

  // 오디오 초기화
  try {
    await audio.init();
    audio.selectTrackForDifficulty?.(selectedDifficulty);
    applyUiSettings();
    if (!audio.muted) {
      audio.setBGMState("normal", true);
      audio.playVoiceCue?.("start", 1);
    }
    console.log(`[Main] BGM 시작 상태: ${audio.getBGMState()}`);
  } catch (err) {
    console.warn("오디오 초기화 실패; BGM 없이 진행합니다.", err);
  } finally {
    starting = false;
  }
}

/**
 * 타이틀로 복귀
 */
function returnToTitle() {
  if (!stage || !startScreen) return;
  
  game.reset();
  hasStarted = false;
  lastSpecialReady = false;
  lastIncomingCount = 0;
  lastBossPhase = 0;
  hiddenPausedGame = false;
  sessionMetrics = createSessionMetrics();
  sessionDiagnostics = createSessionDiagnostics();
  resetTouchMetrics();
  hideResultOverlay();
  closeSettings();
  closeBriefing(false);
  syncBattleWidgetsVisibility();
  
  stage.classList.add("prestart");
  startScreen.classList.remove("hidden");
  
  if (pauseOverlay) {
    pauseOverlay.classList.remove("visible");
  }
  
  audio.stopBgm();
  audio.resetFeverBGMSpeed?.();
  audio.updateBossPhase?.({ enabled: false, phase: 0, hpPercent: 0 });
  achievementSystem.onFeverChange(false);
  battleCallout?.classList.remove("visible", "warn", "gold");
  renderStatusEffects(null);
  renderIncomingPreview();
  syncRecentBattleCard();
  syncRotateHint();
  if (!uiSettings.briefingSeen) {
    setTimeout(() => {
      if (!hasStarted && !document.body.classList.contains("briefing-open")) {
        openBriefing(false);
      }
    }, 180);
  }
}

/**
 * 일시정지 토글
 */
function togglePause() {
  if (!hasStarted || game.isGameOver() || document.body.classList.contains("settings-open") || document.body.classList.contains("result-open") || document.body.classList.contains("briefing-open")) return;
  
  const isPaused = game.pause();
  
  if (isPaused) {
    // 게임 재개
    hiddenPausedGame = false;
    if (pauseOverlay) {
      pauseOverlay.classList.remove("visible");
    }
    audio.setBGMState(audio.getBGMState(), true);
  } else {
    // 일시정지
    if (pauseOverlay) {
      pauseOverlay.classList.add("visible");
    }
    audio.stopBgm();
  }
}

// 입력 설치
installKeyboard(dispatch, {
  getKeyMapping: () => uiSettings.keyboard,
  getInputTuning: () => uiSettings.inputTuning,
  isInputBlocked: isGameplayInputBlocked,
  enqueueBufferedAction: (action) => {
    const queued = game?.enqueueBufferedAction?.("player", action);
    if (queued) {
      recordInputMetric("buffered", action, { source: "keyboard" });
    }
    return queued;
  },
  onRebindCapture: (code) => {
    if (activeRebindAction) {
      captureRebind(activeRebindAction, code);
    }
  },
  isCapturingRebind: () => !!activeRebindAction,
  onInputMetric: recordInputMetric,
  onHeldActionChange: (action, isDown) => {
    game?.setHeldAction?.("player", action, isDown);
  },
});
installTouch(dispatch, {
  isHapticsEnabled: () => uiSettings.hapticLevel !== "off",
  getHapticLevel: () => uiSettings.hapticLevel,
  getRepeatInterval: () => uiSettings.touchRepeat,
  isInputBlocked: isGameplayInputBlocked,
  onTouchDebug: handleTouchDebug,
  onInputMetric: recordInputMetric,
  onHeldActionChange: (action, isDown) => {
    game?.setHeldAction?.("player", action, isDown);
  },
});
// [v3.15.2] 모바일 레이아웃 초기화 (동적 뷰포트 계산 포함)
initMobileLayout();
renderMissionChecklist();
syncTouchDebugPanel();
syncRotateHint();

window.addEventListener("resize", () => {
  applyLayout();
  bgFx.resize();
  syncRotateHint();
  syncTouchDebugPanel();
});

// 난이도 선택
difficultyGrid?.addEventListener("click", (e) => {
  const btn = e.target.closest(".diff-btn");
  if (!btn) return;
  
  const level = btn.dataset.difficulty;
  if (!level) return;

  difficultyGrid.querySelectorAll(".diff-btn").forEach((item) => {
    item.classList.remove("active");
  });
  btn.classList.add("active");
  applyDifficulty(level);
});

// 시작 버튼
startBattleBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  beginBattle();
});

briefingOpenBtn?.addEventListener("click", () => {
  openBriefing(true);
});

// 타이틀 버튼
startBtn?.addEventListener("click", () => {
  returnToTitle();
});

// 일시정지 버튼
pauseBtn?.addEventListener("click", () => {
  togglePause();
});

settingsBtn?.addEventListener("click", () => {
  openSettings();
});

// [v2.0.1] 트랙 스킵 기능 (N 키 또는 UI 버튼)
function skipToNextTrack() {
  if (audio.muted || !hasStarted) return;
  audio.nextTrack();
  console.log(`[Main] 트랙 변경: ${audio.getCurrentTrackName()}`);
  // 트랙 이름을 잠시 화면에 표시
  showTrackNotification(audio.getCurrentTrackName());
  syncAudioStatus();
}

// 트랙 알림 표시
function showTrackNotification(trackName) {
  let notif = document.getElementById("trackNotification");
  if (!notif) {
    notif = document.createElement("div");
    notif.id = "trackNotification";
    notif.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      background: rgba(0, 240, 255, 0.2);
      border: 1px solid rgba(0, 240, 255, 0.5);
      backdrop-filter: blur(10px);
      color: #00f0ff;
      padding: 10px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      z-index: 1000;
      opacity: 0;
      transition: opacity 0.3s ease;
      pointer-events: none;
    `;
    document.body.appendChild(notif);
  }
  notif.textContent = `🎵 ${trackName}`;
  notif.style.opacity = "1";
  setTimeout(() => {
    notif.style.opacity = "0";
  }, 3000);
}

// 키보드 단축키: N 키로 다음 트랙
document.addEventListener("keydown", (e) => {
  if (activeRebindAction) {
    if (e.key === "Escape") {
      e.preventDefault();
      endRebindCapture();
    }
    return;
  }
  if (document.body.classList.contains("briefing-open")) {
    if (e.key === "Escape") {
      e.preventDefault();
      closeBriefing(true);
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      advanceBriefing();
    }
    return;
  }
  if (document.body.classList.contains("settings-open")) {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      closeSettings();
    }
    return;
  }
  if (document.body.classList.contains("result-open")) {
    if (e.key === "Enter") {
      e.preventDefault();
      restartBattleRound();
    }
    return;
  }
  if (e.key === "n" || e.key === "N") {
    skipToNextTrack();
  }
});

// 일시정지 메뉴 버튼들
resumeBtn?.addEventListener("click", () => {
  togglePause();
});

restartBtn?.addEventListener("click", () => {
  restartBattleRound();
});

titleBtn?.addEventListener("click", () => {
  returnToTitle();
});

// [v5.0.0] 스킬 버튼 클릭 핸들러
skillBtn1?.addEventListener("click", () => {
  if (hasStarted) dispatch("player", "skill1");
});
skillBtn2?.addEventListener("click", () => {
  if (hasStarted) dispatch("player", "skill2");
});
skillBtn3?.addEventListener("click", () => {
  if (hasStarted) dispatch("player", "skill3");
});

settingsCloseBtn?.addEventListener("click", () => {
  closeSettings();
});

settingsOverlay?.addEventListener("click", (e) => {
  if (e.target === settingsOverlay) {
    closeSettings();
  }
});

masterVolumeSlider?.addEventListener("input", (e) => {
  uiSettings.masterVolume = Number(e.target.value);
  uiSettings.preset = "custom";
  applyUiSettings();
  saveUiSettings();
});

bgmVolumeSlider?.addEventListener("input", (e) => {
  uiSettings.bgmVolume = Number(e.target.value);
  uiSettings.preset = "custom";
  applyUiSettings();
  saveUiSettings();
});

sfxVolumeSlider?.addEventListener("input", (e) => {
  uiSettings.sfxVolume = Number(e.target.value);
  uiSettings.preset = "custom";
  applyUiSettings();
  saveUiSettings();
});

voiceVolumeSlider?.addEventListener("input", (e) => {
  uiSettings.voiceVolume = Number(e.target.value);
  uiSettings.preset = "custom";
  applyUiSettings();
  saveUiSettings();
});

settingsMuteBtn?.addEventListener("click", () => {
  uiSettings.muted = !uiSettings.muted;
  applyUiSettings();
  saveUiSettings();
  if (!audio.muted && hasStarted && game?.isRunning?.() && !document.body.classList.contains("settings-open")) {
    audio.setBGMState(audio.getBGMState(), true);
  }
});

settingsTrackBtn?.addEventListener("click", () => {
  if (!hasStarted) {
    showFloatingNotification("트랙 전환 불가", "전투 시작 후에만 다음 트랙으로 이동할 수 있습니다.");
    return;
  }
  if (audio.muted) {
    showFloatingNotification("음소거 상태", "트랙 전환 전에 음소거를 해제하세요.");
    return;
  }
  skipToNextTrack();
});

settingsTestBtn?.addEventListener("click", async () => {
  if (audio.muted) {
    showFloatingNotification("음소거 상태", "테스트 전에 음소거를 해제하세요.");
    return;
  }
  try {
    await audio.init();
    applyUiSettings();
    audio.triggerSfx("perfect", 1.5);
    audio.playComboSound?.(7);
    audio.playVoiceCue?.("ready", 1);
    showFloatingNotification("오디오 테스트", "현재 설정된 볼륨으로 샘플 사운드를 재생했습니다.");
  } catch (err) {
    console.warn("오디오 테스트 실패", err);
  }
});

settingsCalibrateBtn?.addEventListener("click", async () => {
  applyCalibrationPreset();
  showFloatingNotification("캘리브레이션 적용", "권장 볼륨과 프리셋으로 재설정했습니다.");
  if (!audio.muted) {
    try {
      await audio.init();
      audio.playVoiceCue?.("ready", 1);
    } catch (err) {
      console.warn("캘리브레이션 테스트 실패", err);
    }
  }
});

settingsLowStimAudioBtn?.addEventListener("click", () => {
  uiSettings.lowStimAudio = !uiSettings.lowStimAudio;
  applyUiSettings();
  saveUiSettings();
});

presetButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const preset = audio.applyPreset(btn.dataset.preset);
    if (!preset) return;
    uiSettings.bgmVolume = Math.round((preset.bgm || 0) * 100);
    uiSettings.sfxVolume = Math.round((preset.sfx || 0) * 100);
    uiSettings.voiceVolume = Math.round((preset.voice || 0) * 100);
    uiSettings.preset = btn.dataset.preset || "custom";
    applyUiSettings();
    saveUiSettings();
  });
});

controlPresetButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    applyInputPreset(btn.dataset.inputPreset || "standard");
  });
});

document.querySelectorAll(".keybind-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    beginRebindCapture(btn.dataset.rebindAction || "");
  });
});

inputBufferSlider?.addEventListener("input", (e) => {
  uiSettings.inputProfile = "custom";
  uiSettings.inputTuning.inputBufferMs = Number(e.target.value);
  applyUiSettings();
  saveUiSettings();
});

controlAdvancedBtn?.addEventListener("click", () => {
  uiSettings.controlAdvanced = !uiSettings.controlAdvanced;
  applyUiSettings();
  saveUiSettings();
});

dasSlider?.addEventListener("input", (e) => {
  uiSettings.inputProfile = "custom";
  uiSettings.inputTuning.dasMs = Number(e.target.value);
  applyUiSettings();
  saveUiSettings();
});

arrSlider?.addEventListener("input", (e) => {
  uiSettings.inputProfile = "custom";
  uiSettings.inputTuning.arrMs = Number(e.target.value);
  applyUiSettings();
  saveUiSettings();
});

softDropRepeatSlider?.addEventListener("input", (e) => {
  uiSettings.inputProfile = "custom";
  uiSettings.inputTuning.softDropRepeatMs = Number(e.target.value);
  applyUiSettings();
  saveUiSettings();
});

lockResetLimitSlider?.addEventListener("input", (e) => {
  uiSettings.inputProfile = "custom";
  uiSettings.inputTuning.lockResetLimit = Number(e.target.value);
  applyUiSettings();
  saveUiSettings();
});

irsToggleBtn?.addEventListener("click", () => {
  uiSettings.inputProfile = "custom";
  uiSettings.inputTuning.irsEnabled = !uiSettings.inputTuning.irsEnabled;
  applyUiSettings();
  saveUiSettings();
});

ihsToggleBtn?.addEventListener("click", () => {
  uiSettings.inputProfile = "custom";
  uiSettings.inputTuning.ihsEnabled = !uiSettings.inputTuning.ihsEnabled;
  applyUiSettings();
  saveUiSettings();
});

hardDropBufferBtn?.addEventListener("click", () => {
  uiSettings.inputProfile = "custom";
  uiSettings.inputTuning.hardDropBufferEnabled = !uiSettings.inputTuning.hardDropBufferEnabled;
  applyUiSettings();
  saveUiSettings();
});

shakeSlider?.addEventListener("input", (e) => {
  uiSettings.shake = Number(e.target.value);
  uiSettings.preset = uiSettings.preset || "custom";
  applyUiSettings();
  saveUiSettings();
});

settingsReducedFxBtn?.addEventListener("click", () => {
  uiSettings.reducedFx = !uiSettings.reducedFx;
  applyUiSettings();
  saveUiSettings();
});

settingsLowPowerBtn?.addEventListener("click", () => {
  uiSettings.lowPower = !uiSettings.lowPower;
  applyUiSettings();
  saveUiSettings();
});

mobileScaleSlider?.addEventListener("input", (e) => {
  uiSettings.mobileScale = Number(e.target.value);
  applyUiSettings();
  saveUiSettings();
});

touchRepeatSlider?.addEventListener("input", (e) => {
  uiSettings.touchRepeat = Number(e.target.value);
  applyUiSettings();
  saveUiSettings();
});

settingsHapticLevelBtn?.addEventListener("click", () => {
  cycleHapticLevel();
});

settingsTouchDebugBtn?.addEventListener("click", () => {
  uiSettings.touchDebug = !uiSettings.touchDebug;
  applyUiSettings();
  saveUiSettings();
});

settingsDevPanelBtn?.addEventListener("click", () => {
  uiSettings.devPanel = !uiSettings.devPanel;
  applyUiSettings();
  saveUiSettings();
});

settingsExportSessionBtn?.addEventListener("click", () => {
  exportSessionDiagnostics();
});

settingsClearSessionBtn?.addEventListener("click", () => {
  clearSessionDiagnostics();
});

mobileLayoutButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    uiSettings.mobileLayout = btn.dataset.layout || "default";
    applyUiSettings();
    saveUiSettings();
  });
});

settingsBriefingBtn?.addEventListener("click", () => {
  closeSettings();
  openBriefing(true);
});

briefingOverlay?.addEventListener("click", (e) => {
  if (e.target === briefingOverlay) {
    closeBriefing(true);
  }
});

briefingSkipBtn?.addEventListener("click", () => {
  closeBriefing(true);
});

briefingNextBtn?.addEventListener("click", () => {
  advanceBriefing();
});

resultRestartBtn?.addEventListener("click", () => {
  restartBattleRound();
});

resultBriefingBtn?.addEventListener("click", () => {
  hideResultOverlay();
  openBriefing(true);
});

resultTitleBtn?.addEventListener("click", () => {
  returnToTitle();
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) return;
  if (!hasStarted || game?.isGameOver?.() || !game?.isRunning?.()) return;
  if (document.body.classList.contains("settings-open")
    || document.body.classList.contains("briefing-open")
    || document.body.classList.contains("result-open")) {
    return;
  }
  hiddenPausedGame = true;
  sessionMetrics.autoPausedByVisibility = true;
  sessionDiagnostics.visibilityPauses += 1;
  game.pause();
  if (pauseOverlay) {
    pauseOverlay.classList.add("visible");
  }
  audio.stopBgm();
});

window.addEventListener("error", (event) => {
  recordRuntimeError("window", event.error || event.message);
});

window.addEventListener("unhandledrejection", (event) => {
  recordRuntimeError("promise", event.reason);
});

// 게임 루프
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const frameMs = dt * 1000;
  const fps = dt > 0 ? 1 / dt : 0;
  sessionDiagnostics.currentFps = fps;
  sessionDiagnostics.maxFrameMs = Math.max(sessionDiagnostics.maxFrameMs || 0, frameMs);
  sessionDiagnostics.minFps = sessionDiagnostics.minFps > 0 ? Math.min(sessionDiagnostics.minFps, fps) : fps;
  sessionDiagnostics.avgFps = sessionDiagnostics.avgFps > 0
    ? (sessionDiagnostics.avgFps * 0.92) + (fps * 0.08)
    : fps;
  if (frameMs > 22) {
    sessionDiagnostics.frameDrops += 1;
  }

  bgFx.tick(dt);
  impact.tick(dt);
  bgFx.draw(impact.energy);
  game.tick(impact.isHitstopActive?.() ? 0 : dt);

  const aiState = game.getState("ai");
  if (aiState) {
    bgFx.setBossMode(!!aiState.bossModeActive);
  }
  const audioSnapshot = audio.getAudioDebugSnapshot?.() || {};
  if (audioSnapshot.ctxState && audioSnapshot.ctxState !== lastAudioCtxState) {
    if (lastAudioCtxState) {
      sessionDiagnostics.audioStateChanges += 1;
    }
    if (audioSnapshot.ctxState === "running") {
      sessionDiagnostics.audioResumes += 1;
    }
    lastAudioCtxState = audioSnapshot.ctxState;
  }
  syncDevPanel();

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
