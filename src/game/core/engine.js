/*
 * [v3.14.1] 메인 게임 엔진
 * 
 * 작성일: 2026-02-28
 * 변경사항: 
 *   - 고스트 블록 렌더링 추가
 *   - T-스핀 감지 및 처리
 *   - 콤보/백투백 시스템
 *   - 필살기 게이지
 *   - 슈퍼 로테이션 (SRS) 지원
 *   - 향상된 이펙트
 *   - 입체 블록 셰이딩 및 단계형 라인 파괴 연출 추가
 *   - 전투 중 디버그 로그 정리 및 이펙트 부하 완화
 *   - 입력 버퍼, IRS/IHS, 락 리셋 제한, 줄 클리어 히트스톱 메타 추가
 *   - [v3.9.0] Rule-Break Boss 규칙 공격 적용
 *   - [v3.10.0] 패턴 공격 문법 및 라인 형태 분석 분기 추가
 *   - [v3.12.0] Neon Shift/Residue 오버레이와 Shift 보너스 압박 추가
 *   - [v3.13.0] Layer Resonance, 밸런스 패스, HUD 친화 메타 추가
 *   - [v3.14.0] 레이어 카운터 매트릭스, Shift 종료 이벤트, 최종 게임필 메타 추가
 *   - [v3.14.1] 일시정지 중 입력 누수 차단 및 스폰 보조 우선순위 문서화
 */

import { Board } from "./board.js";
import { BagRandom } from "./random.js";
import { 
  createPlayerState, 
  spawn, 
  holdSwap, 
  useSpecial, 
  updateCombo, 
  checkBackToBack,
  calculateScore,
  updateStats
} from "./player.js";
import { PIECES } from "./pieces.js";
import {
  BASE_DROP_PER_SEC,
  LOCK_DELAY_MS,
  speedMultiplier,
  levelTarget,
  garbageForLines,
  INPUT_PRESETS,
  INPUT_BUFFER_ACTIONS,
  DEFAULT_INPUT_BUFFER_MS,
  DEFAULT_LOCK_RESET_LIMIT,
} from "./constants.js";
import { BattleQueue } from "../battle/queue.js";
import { makePatternAttack, makeSpecialAttack, setFeverAttackMultiplier, resetFeverAttackMultiplier } from "../battle/attacks.js";
import { AIController } from "../../ai/engine.js";
import { loadWasmMath } from "../../ai/wasm_adapter.js";
import { EffectEngine, shakeElement } from "../../render/effects.js";
import { createItemSystem, activateItem, processChainBombs, getBasePieceType, getItemType, renderItemBlock } from "./items.js";
import {
  enterFeverMode,
  updateFeverMode,
  extendFeverDuration,
  exitFeverMode,
  isFeverModeActive,
  getFeverMultiplier,
  getFeverStatus,
  resetFeverMode,
  chooseFeverType,
  FEVER_TYPES
} from "../battle/fever.js";
import {
  initSkillSystem,
  getPlayerSkillManager,
  getAiSkillManager,
  useSkill,
  SkillType,
  SkillFusionType,
  updateSkills,
  addPlayerGauge,
  addAiGauge,
  resetSkillSystem,
  renderBlindEffect,
  renderGarbageReflectEffect,
  renderSwapAnimation
} from "../battle/skills.js"; // [v5.0.0] 스킬 시스템 통합

function getSkillManagerForState(state) {
  return state.id === "player" ? getPlayerSkillManager() : getAiSkillManager();
}

function isCurrentPieceItemCell(state, localX, localY) {
  if (!state.currentItem?.itemPos) return false;
  const shape = PIECES[state.piece]?.r[state.rot % PIECES[state.piece].r.length];
  if (!shape) return false;

  const h = shape.length;
  const w = shape[0].length;
  let rotated;

  switch (state.rot % 4) {
    case 0:
      rotated = { x: localX, y: localY };
      break;
    case 1:
      rotated = { x: localY, y: w - 1 - localX };
      break;
    case 2:
      rotated = { x: w - 1 - localX, y: h - 1 - localY };
      break;
    default:
      rotated = { x: h - 1 - localY, y: localX };
      break;
  }

  return rotated.x === state.currentItem.itemPos.x && rotated.y === state.currentItem.itemPos.y;
}

function parseHexColor(color) {
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

function mixColor(color, target, amount) {
  const base = parseHexColor(color);
  const targetColor = parseHexColor(target);
  const clamped = Math.max(0, Math.min(1, amount));
  const r = Math.round(base.r + (targetColor.r - base.r) * clamped);
  const g = Math.round(base.g + (targetColor.g - base.g) * clamped);
  const b = Math.round(base.b + (targetColor.b - base.b) * clamped);
  return `rgb(${r}, ${g}, ${b})`;
}

function withAlpha(color, alpha) {
  const rgb = parseHexColor(color);
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function shouldResetLockDelay(state) {
  const tuning = state.inputTuning || INPUT_PRESETS.standard;
  const limit = Number.isFinite(tuning.lockResetLimit) ? tuning.lockResetLimit : DEFAULT_LOCK_RESET_LIMIT;
  if (!Number.isFinite(limit) || limit < 0) return true;
  return (state.lockResetCount || 0) < limit;
}

function consumeLockReset(state) {
  if (!shouldResetLockDelay(state)) return false;
  state.lockAcc = 0;
  state.lockResetCount = (state.lockResetCount || 0) + 1;
  return true;
}

function canBufferAction(state, action) {
  if (!INPUT_BUFFER_ACTIONS.includes(action)) return false;
  const tuning = state.inputTuning || INPUT_PRESETS.standard;
  if (action === "hardDrop" && tuning.hardDropBufferEnabled === false) {
    return false;
  }
  return true;
}

function queueBufferedAction(state, action, nowMs) {
  if (!canBufferAction(state, action)) return false;
  const tuning = state.inputTuning || INPUT_PRESETS.standard;
  const bufferMs = Math.max(32, Number(tuning.inputBufferMs) || DEFAULT_INPUT_BUFFER_MS);
  state.inputBuffer = action;
  state.inputBufferUntil = nowMs + bufferMs;
  return true;
}

function syncStateGauge(state) {
  const manager = getSkillManagerForState(state);
  if (!manager) return;
  state.specialGauge = manager.getGauge();
  state.specialReady = manager.isGaugeFull();
}

function drainStateGauge(state, amount) {
  const manager = getSkillManagerForState(state);
  if (!manager?.drainGauge) return 0;
  const drained = manager.drainGauge(amount);
  syncStateGauge(state);
  return drained;
}

function shuffleNextQueue(state, seed = Math.random(), count = 3) {
  const limit = Math.max(0, Math.min(count, state.queue.length));
  const base = Math.abs(Math.floor(seed * 9973)) || 1;
  const nextSlice = state.queue.slice(0, limit);
  for (let i = nextSlice.length - 1; i > 0; i--) {
    const pick = (base + i * 17) % (i + 1);
    const temp = nextSlice[i];
    nextSlice[i] = nextSlice[pick];
    nextSlice[pick] = temp;
  }
  state.queue.splice(0, limit, ...nextSlice);
}

function isNeonShiftActive(state, nowMs = performance.now()) {
  return (state.neonShiftUntil || 0) > nowMs;
}

function pruneNeonResidue(state, nowMs) {
  if (!Array.isArray(state.neonResidueRows)) {
    state.neonResidueRows = [];
    return [];
  }
  state.neonResidueRows = state.neonResidueRows.filter((entry) => (entry?.until || 0) > nowMs);
  return state.neonResidueRows;
}

function addNeonResidueRows(state, rows, nowMs, source = "shift") {
  const validRows = (rows || []).filter((row) => Number.isFinite(row));
  if (!validRows.length) return;
  const residue = pruneNeonResidue(state, nowMs);
  for (const row of validRows) {
    const existing = residue.find((entry) => entry.row === row);
    const until = nowMs + 2400;
    if (existing) {
      existing.until = Math.max(existing.until, until);
      existing.source = source;
    } else {
      residue.push({ row, until, source });
    }
  }
}

function triggerNeonShift(state, nowMs, source = "shift", durationMs = 4600, onEvent = null, options = {}) {
  if (state.id !== "player") return false;
  const previousUntil = state.neonShiftUntil || 0;
  const previousSource = state.neonShiftSource || "";
  const wasActive = previousUntil > nowMs;
  state.neonShiftUntil = Math.max(previousUntil, nowMs + durationMs);
  state.neonShiftSource = source;

  if (options.residueRows?.length) {
    addNeonResidueRows(state, options.residueRows, nowMs, source);
  }

  if (!options.silent && onEvent && (!wasActive || previousSource !== source)) {
    onEvent("neonShift", {
      owner: state.id,
      source,
      durationMs: state.neonShiftUntil - nowMs,
    });
  }

  return true;
}

function tryFeverForgeKick(state, board, nextRot) {
  const extraKicks = [
    [0, -1],
    [1, 0],
    [-1, 0],
    [2, 0],
    [-2, 0],
    [0, -2],
  ];

  for (const [dx, dy] of extraKicks) {
    if (!board.collides(state.piece, nextRot, state.x + dx, state.y + dy)) {
      state.x += dx;
      state.y += dy;
      state.rot = nextRot;
      consumeLockReset(state);
      state.lastMoveWasTSpin = true;
      return true;
    }
  }

  return false;
}

function syncFeverMutationState(state) {
  const now = performance.now();
  if (state.id !== "player") {
    state.feverType = FEVER_TYPES.FORGE;
    state.feverGuardCharges = 0;
    state.nextPreviewCount = 3;
    state.itemSpawnMultiplier = 1;
    return;
  }

  const fever = getFeverStatus();
  if (!fever.active) {
    state.feverType = FEVER_TYPES.FORGE;
    state.feverGuardCharges = 0;
    state.nextPreviewCount = 3;
    state.itemSpawnMultiplier = (state.neonItemBoostUntil || 0) > now ? 3.1 : 1;
    return;
  }

  state.feverType = fever.type;
  state.nextPreviewCount = fever.type === FEVER_TYPES.SCAN ? 5 : 3;
  state.itemSpawnMultiplier = Math.max(
    fever.type === FEVER_TYPES.SURGE ? 2.4 : 1,
    (state.neonItemBoostUntil || 0) > now ? 3.1 : 1
  );
  if (fever.type === FEVER_TYPES.GUARD) {
    if (state.feverGuardCharges <= 0) {
      state.feverGuardCharges = 1;
    }
  } else {
    state.feverGuardCharges = 0;
  }
}

function applySkillFusion(who, fusion, nowMs, queue, getRng, onEvent) {
  if (!fusion) return null;

  const userManager = getSkillManagerForState(who.state);
  const opponentManager = getSkillManagerForState(who.opponent.state);

  switch (fusion.type) {
    case SkillFusionType.PHANTOM_MIRROR:
      opponentManager.applyBlind(7000);
      userManager.activeEffects.garbageReflect = {
        active: true,
        endTime: nowMs + 7000,
      };
      who.opponent.state.mirrorMoveUntil = Math.max(who.opponent.state.mirrorMoveUntil, nowMs + 4000);
      return { label: "PHANTOM MIRROR", tone: "gold" };

    case SkillFusionType.DISTORT_FIELD:
      opponentManager.applyBlind(6500);
      shuffleNextQueue(who.opponent.state, getRng(), 3);
      who.opponent.state.nextScrambleUntil = Math.max(who.opponent.state.nextScrambleUntil, nowMs + 4000);
      who.opponent.state.inputDelayUntil = Math.max(who.opponent.state.inputDelayUntil, nowMs + 350);
      return { label: "DISTORT FIELD", tone: "warn" };

    case SkillFusionType.BACKFLOW_SHIFT:
      userManager.activeEffects.garbageReflect = {
        active: true,
        endTime: nowMs + 6500,
      };
      queue.sendAttack(who.state.id, who.opponent.state.id, {
        type: "GarbagePush",
        strength: 2,
        seed: getRng(),
      }, nowMs);
      onEvent("attack", { from: who.state.id, type: "GarbagePush", amount: 2, patternTag: "fusion" });
      return { label: "BACKFLOW SHIFT", tone: "gold" };
  }

  return null;
}

function applyNeonShiftBonus(who, cleared, tSpinType, isPerfectClear, patternInfo, clearedLines, nowMs, queue, getRng, onEvent) {
  const { state } = who;
  if (state.id !== "player" || !isNeonShiftActive(state, nowMs) || cleared <= 0) return;

  addNeonResidueRows(state, clearedLines, nowMs, patternInfo?.tag || state.neonShiftSource || "shift");

  let bonusGarbage = 0;
  if (cleared >= 2) bonusGarbage += 1;
  if (tSpinType) bonusGarbage += 1;
  if (isPerfectClear) bonusGarbage += 2;
  if (patternInfo?.tag === "pierceBarrage" || patternInfo?.tag === "nullBurst") {
    bonusGarbage += 1;
  }

  bonusGarbage = Math.min(3, bonusGarbage);
  if (bonusGarbage <= 0) return;

  queue.sendAttack(state.id, who.opponent.state.id, {
    type: "GarbagePush",
    strength: bonusGarbage,
    seed: getRng(),
  }, nowMs);
  onEvent("attack", {
    from: state.id,
    type: "GarbagePush",
    amount: bonusGarbage,
    patternTag: "neonShift",
  });
}

function applyLayerResonance(who, cleared, tSpinType, patternInfo, nowMs, queue, getRng, onEvent) {
  const { state } = who;
  if (state.id !== "player" || !isNeonShiftActive(state, nowMs)) return;
  if ((state.neonResonanceUntil || 0) > nowMs) return;

  let resonance = null;
  let attack = null;

  if (state.feverType === FEVER_TYPES.FORGE && tSpinType) {
    resonance = { type: "forge", label: "FORGE SPARK", subtitle: "T-SPIN PRESSURE", tone: "gold" };
    attack = { type: "WavePush", strength: 1, seed: getRng() };
  } else if (state.feverType === FEVER_TYPES.GUARD && cleared >= 2 && !who.itemSystem?.isShieldActive?.()) {
    who.itemSystem?.activateShield?.();
    resonance = { type: "guard", label: "GUARD AEGIS", subtitle: "AUTO SHIELD", tone: "gold" };
  } else if (state.feverType === FEVER_TYPES.SCAN && patternInfo?.tag) {
    resonance = { type: "scan", label: "SCAN HEX", subtitle: "NEXT JAM", tone: "warn" };
    attack = { type: "NextScramble", strength: 1, seed: getRng() };
  } else if (state.feverType === FEVER_TYPES.SURGE && cleared >= 2) {
    resonance = { type: "surge", label: "SURGE PULSE", subtitle: "WAVE PUSH", tone: "gold" };
    attack = { type: "WavePush", strength: 1, seed: getRng() };
  }

  if (!resonance) return;

  state.neonResonanceUntil = nowMs + 1800;

  if (attack) {
    queue.sendAttack(state.id, who.opponent.state.id, attack, nowMs);
    onEvent("attack", {
      from: state.id,
      type: attack.type,
      amount: attack.strength,
      patternTag: "resonance",
    });
  }

  onEvent("resonance", {
    owner: state.id,
    ...resonance,
  });
}

function consumeNeonResidue(state, nowMs) {
  const residues = pruneNeonResidue(state, nowMs);
  if (!residues.length) return false;
  residues.sort((a, b) => (a.until || 0) - (b.until || 0));
  residues.shift();
  return true;
}

function emitLayerCounter(state, nowMs, onEvent, payload) {
  state.neonCounterCooldownUntil = nowMs + (payload.cooldownMs || 1800);
  state.layerCounterUntil = nowMs + 1800;
  state.layerCounterLabel = payload.label || "COUNTER";
  onEvent("layerCounter", {
    owner: state.id,
    type: payload.type,
    label: payload.label,
    subtitle: payload.subtitle,
    tone: payload.tone || "gold",
    residueCount: pruneNeonResidue(state, nowMs).length,
  });
}

function applyLayerCounter(targetWho, attack, nowMs, onEvent, queue, getRng) {
  const { state } = targetWho;
  if (state.id !== "player" || !isNeonShiftActive(state, nowMs)) {
    return { attack, cancelled: false, counterType: "" };
  }
  if ((state.neonCounterCooldownUntil || 0) > nowMs) {
    return { attack, cancelled: false, counterType: "" };
  }
  if (!pruneNeonResidue(state, nowMs).length) {
    return { attack, cancelled: false, counterType: "" };
  }

  const type = attack.type;
  const isGarbagePressure = ["GarbagePush", "PierceBarrage", "NullBurst"].includes(type);
  const isPulsePressure = ["WavePush"].includes(type);
  const isSpecial = type !== "GarbagePush";

  if (state.feverType === FEVER_TYPES.FORGE && isGarbagePressure && (attack.strength || 0) > 0) {
    if (!consumeNeonResidue(state, nowMs)) return { attack, cancelled: false, counterType: "" };
    const shavedAttack = { ...attack, strength: Math.max(0, (attack.strength || 0) - 1) };
    emitLayerCounter(state, nowMs, onEvent, {
      type: "forge",
      label: "FORGE BREAK",
      subtitle: shavedAttack.strength > 0 ? "PRESSURE SHAVED" : "PRESSURE CUT",
      tone: "gold",
      cooldownMs: 1650,
    });
    return { attack: shavedAttack, cancelled: shavedAttack.strength <= 0, counterType: "forge" };
  }

  if (state.feverType === FEVER_TYPES.GUARD && isSpecial) {
    if (!consumeNeonResidue(state, nowMs)) return { attack, cancelled: false, counterType: "" };
    emitLayerCounter(state, nowMs, onEvent, {
      type: "guard",
      label: "GUARD LATTICE",
      subtitle: "SPECIAL NULL",
      tone: "gold",
      cooldownMs: 2200,
    });
    return { attack, cancelled: true, counterType: "guard" };
  }

  if (state.feverType === FEVER_TYPES.SCAN && isSpecial) {
    if (!consumeNeonResidue(state, nowMs)) return { attack, cancelled: false, counterType: "" };
    queue.sendAttack(state.id, targetWho.opponent.state.id, {
      type: "NextScramble",
      strength: 1,
      seed: getRng(),
    }, nowMs);
    onEvent("attack", {
      from: state.id,
      type: "NextScramble",
      amount: 1,
      patternTag: "counter",
    });
    emitLayerCounter(state, nowMs, onEvent, {
      type: "scan",
      label: "SCAN TRACE",
      subtitle: "TRACE JAM",
      tone: "warn",
      cooldownMs: 1900,
    });
    return { attack, cancelled: false, counterType: "scan" };
  }

  if (state.feverType === FEVER_TYPES.SURGE && (isGarbagePressure || isPulsePressure) && (attack.strength || 0) > 0) {
    if (!consumeNeonResidue(state, nowMs)) return { attack, cancelled: false, counterType: "" };
    state.neonItemBoostUntil = Math.max(state.neonItemBoostUntil || 0, nowMs + 3200);
    queue.sendAttack(state.id, targetWho.opponent.state.id, {
      type: "WavePush",
      strength: 1,
      seed: getRng(),
    }, nowMs);
    onEvent("attack", {
      from: state.id,
      type: "WavePush",
      amount: 1,
      patternTag: "counter",
    });
    const echoedAttack = { ...attack, strength: Math.max(0, (attack.strength || 0) - 1) };
    emitLayerCounter(state, nowMs, onEvent, {
      type: "surge",
      label: "SURGE ECHO",
      subtitle: "PULSE RETURN",
      tone: "gold",
      cooldownMs: 1750,
    });
    return { attack: echoedAttack, cancelled: echoedAttack.strength <= 0, counterType: "surge" };
  }

  return { attack, cancelled: false, counterType: "" };
}

function drawNeonOverlay(ctx, state, cell, canvas, now) {
  const reducedFx = document.body.classList.contains("reduced-effects");
  const lowPower = document.body.classList.contains("low-power-mode");
  const active = isNeonShiftActive(state, now);
  const residues = pruneNeonResidue(state, now);
  if (!active && residues.length === 0) return;

  ctx.save();

  if (active) {
    const overlay = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    overlay.addColorStop(0, `rgba(0, 240, 255, ${reducedFx ? 0.05 : 0.08})`);
    overlay.addColorStop(0.55, `rgba(92, 112, 255, ${reducedFx ? 0.04 : 0.06})`);
    overlay.addColorStop(1, `rgba(255, 77, 158, ${reducedFx ? 0.04 : 0.07})`);
    ctx.fillStyle = overlay;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = `rgba(0, 240, 255, ${lowPower ? 0.14 : 0.22})`;
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);

    ctx.strokeStyle = `rgba(0, 240, 255, ${lowPower ? 0.05 : 0.08})`;
    ctx.lineWidth = 1;
    for (let y = 0; y < canvas.height; y += cell * 2) {
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(canvas.width, y + 0.5);
      ctx.stroke();
    }
  }

  residues.forEach((entry) => {
    const remainRatio = Math.max(0, Math.min(1, ((entry.until || 0) - now) / 2400));
    const rowY = entry.row * cell;
    const glow = ctx.createLinearGradient(0, rowY, canvas.width, rowY + cell);
    glow.addColorStop(0, `rgba(0, 240, 255, ${0.05 + remainRatio * 0.12})`);
    glow.addColorStop(0.5, `rgba(184, 77, 255, ${0.08 + remainRatio * 0.18})`);
    glow.addColorStop(1, `rgba(255, 77, 158, ${0.05 + remainRatio * 0.12})`);
    ctx.fillStyle = glow;
    ctx.fillRect(0, rowY, canvas.width, cell);
    if (!lowPower) {
      ctx.strokeStyle = `rgba(255,255,255,${0.08 + remainRatio * 0.12})`;
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, rowY + 0.5, canvas.width - 1, cell - 1);
    }
  });

  ctx.restore();
}

function drawStyledCell(ctx, x, y, cell, color, options = {}) {
  const inset = options.inset ?? 1;
  const size = cell - inset * 2;
  const base = options.garbage ? mixColor(color, "#b7bcc6", 0.28) : color;
  const light = mixColor(base, "#ffffff", options.garbage ? 0.18 : 0.34);
  const core = mixColor(base, "#7cf7ff", options.current ? 0.08 : 0.03);
  const dark = mixColor(base, "#09111f", options.garbage ? 0.4 : 0.34);
  const panel = mixColor(base, "#0b1220", 0.18);

  ctx.save();
  if (!options.garbage) {
    ctx.shadowColor = withAlpha(base, options.current ? 0.72 : 0.42);
    ctx.shadowBlur = options.current ? 14 : 9;
  }

  const shell = ctx.createLinearGradient(x, y, x + cell, y + cell);
  shell.addColorStop(0, light);
  shell.addColorStop(0.18, core);
  shell.addColorStop(0.72, base);
  shell.addColorStop(1, dark);
  ctx.fillStyle = shell;
  ctx.fillRect(x + inset, y + inset, size, size);

  const panelInset = options.current ? 3 : 4;
  const panelGradient = ctx.createLinearGradient(x, y, x, y + cell);
  panelGradient.addColorStop(0, withAlpha(light, options.garbage ? 0.22 : 0.28));
  panelGradient.addColorStop(0.2, withAlpha(base, 0.12));
  panelGradient.addColorStop(1, panel);
  ctx.fillStyle = panelGradient;
  ctx.fillRect(x + panelInset, y + panelInset, cell - panelInset * 2, cell - panelInset * 2);

  ctx.fillStyle = withAlpha("#ffffff", options.garbage ? 0.16 : 0.28);
  ctx.fillRect(x + panelInset + 1, y + panelInset + 1, cell - panelInset * 2 - 2, Math.max(2, cell * 0.14));

  ctx.fillStyle = withAlpha(dark, 0.28);
  ctx.fillRect(x + panelInset, y + cell - panelInset - Math.max(2, cell * 0.16), cell - panelInset * 2, Math.max(2, cell * 0.16));

  ctx.strokeStyle = withAlpha(light, options.garbage ? 0.32 : 0.5);
  ctx.lineWidth = 1;
  ctx.strokeRect(x + inset + 0.5, y + inset + 0.5, size - 1, size - 1);

  ctx.beginPath();
  ctx.moveTo(x + inset + 1, y + inset + 1);
  ctx.lineTo(x + cell - inset - 1, y + inset + 1);
  ctx.lineTo(x + cell - inset - Math.max(3, cell * 0.14), y + inset + Math.max(3, cell * 0.14));
  ctx.lineTo(x + inset + Math.max(3, cell * 0.12), y + inset + Math.max(3, cell * 0.14));
  ctx.closePath();
  ctx.fillStyle = withAlpha("#ffffff", options.garbage ? 0.08 : 0.12);
  ctx.fill();

  ctx.restore();
}

/**
 * 보드 렌더링 (고스트 블록 포함)
 * @param {CanvasRenderingContext2D} ctx - 캔버스 컨텍스트
 * @param {Object} state - 플레이어 상태
 * @param {Board} board - 보드 인스턴스
 * @param {EffectEngine} fx - 이펙트 엔진
 */
function drawBoard(ctx, state, board, fx) {
  const canvas = ctx.canvas;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const cell = canvas.width / 10;
  const now = performance.now();
  const skillManager = getSkillManagerForState(state);
  
  // 그리드 라인 (반투명)
  ctx.strokeStyle = "rgba(100, 180, 255, 0.1)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= 10; x++) {
    ctx.beginPath();
    ctx.moveTo(x * cell, 0);
    ctx.lineTo(x * cell, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y <= 20; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * cell);
    ctx.lineTo(canvas.width, y * cell);
    ctx.stroke();
  }

  drawNeonOverlay(ctx, state, cell, canvas, now);
  
  // 고정된 블록 렌더링
  for (let y = 0; y < 20; y++) {
    for (let x = 0; x < 10; x++) {
      const v = board.grid[y][x];
      if (!v) continue;
      
      // 블록 색상 (가비지는 회색)
      const baseType = typeof v === "string" ? getBasePieceType(v) : v;
      const itemType = typeof v === "string" ? getItemType(v) : null;
      const color = v === 'G' ? "#6f6f6f" : (PIECES[baseType]?.color || "#999");

      // [v3.0.1-fix] 아이템 블록은 일반 블록과 즉시 구분되도록 전용 렌더러를 사용한다.
      if (itemType) {
        renderItemBlock(ctx, x * cell, y * cell, cell, itemType, now);
        continue;
      }

      drawStyledCell(ctx, x * cell, y * cell, cell, color, {
        garbage: v === "G",
      });
    }
  }
  
  // 고스트 블록 렌더링 (투명)
  if (!state.topOut && PIECES[state.piece] && state.ghostHiddenUntil <= now) {
    const ghostY = board.getGhostY(state.piece, state.rot, state.x, state.y);
    const ghostColor = PIECES[state.piece].color;
    const shape = PIECES[state.piece].r[state.rot % PIECES[state.piece].r.length];
    
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = ghostColor;
    ctx.lineWidth = 2;
    
    for (let py = 0; py < shape.length; py++) {
      for (let px = 0; px < shape[py].length; px++) {
        if (!shape[py][px]) continue;
        const gx = state.x + px;
        const gy = ghostY + py;
        if (gy < 0) continue;
        
        ctx.strokeRect(gx * cell + 2, gy * cell + 2, cell - 4, cell - 4);
      }
    }
    ctx.globalAlpha = 1.0;
  }
  
  // 현재 조각 렌더링
  if (!state.topOut && PIECES[state.piece]) {
    const shape = PIECES[state.piece].r[state.rot % PIECES[state.piece].r.length];
    const color = PIECES[state.piece].color;
    
    for (let py = 0; py < shape.length; py++) {
      for (let px = 0; px < shape[py].length; px++) {
        if (!shape[py][px]) continue;
        const gx = state.x + px;
        const gy = state.y + py;
        if (gy < 0) continue;

        if (isCurrentPieceItemCell(state, px, py)) {
          renderItemBlock(ctx, gx * cell, gy * cell, cell, state.currentItem.itemType, now);
        } else {
          drawStyledCell(ctx, gx * cell, gy * cell, cell, color, {
            current: true,
          });
        }
      }
    }
  }
  
  // 이펙트 렌더링
  fx.draw(ctx);

  if (skillManager.isBlindActive()) {
    renderBlindEffect(ctx, 0, 0, canvas.width, canvas.height);
  }

  if (skillManager.isGarbageReflectActive()) {
    renderGarbageReflectEffect(ctx, 0, 0, canvas.width, canvas.height, now);
  }

  renderSwapAnimation(ctx, 0, 0, cell, state.id);

  if (state.darknessUntil > now) {
    ctx.fillStyle = "rgba(5, 8, 16, 0.82)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  if (state.mirrorMoveUntil > now) {
    ctx.save();
    ctx.fillStyle = "rgba(255, 77, 158, 0.85)";
    ctx.font = 'bold 16px "Segoe UI", sans-serif';
    ctx.textAlign = "center";
    ctx.fillText("MIRROR", canvas.width / 2, 22);
    ctx.restore();
  }
}

/**
 * 블록 이동 시도
 * @param {Object} state - 플레이어 상태
 * @param {Board} board - 보드
 * @param {number} dx - X 이동량
 * @param {number} dy - Y 이동량
 * @returns {boolean} 성공 여부
 */
function tryMove(state, board, dx, dy) {
  if (!board.collides(state.piece, state.rot, state.x + dx, state.y + dy)) {
    state.x += dx;
    state.y += dy;
    if (dx !== 0 && dy === 0) {
      consumeLockReset(state);
    }
    state.lastMoveWasTSpin = false; // 마지막 동작이 회전이 아니므로 T-스핀 플래그 해제
    return true;
  }
  return false;
}

/**
 * 블록 회전 시도 (SRS 지원)
 * @param {Object} state - 플레이어 상태
 * @param {Board} board - 보드
 * @param {boolean} clockwise - 시계 방향 여부
 * @returns {boolean} 성공 여부
 */
function tryRotate(state, board, clockwise = true) {
  const currentRot = state.rot;
  const nextRot = clockwise 
    ? (currentRot + 1) % 4 
    : (currentRot + 3) % 4;
  
  // 기본 회전 시도
  if (!board.collides(state.piece, nextRot, state.x, state.y)) {
    state.rot = nextRot;
    consumeLockReset(state);
    state.lastMoveWasTSpin = true; // 회전 성공 시 T-스핀 가능성 유지
    return true;
  }
  
  // SRS 벽킥 시도
  const kickResult = board.tryWallKick(state.piece, currentRot, nextRot, state.x, state.y);
  if (kickResult) {
    state.x = kickResult[0];
    state.y = kickResult[1];
    state.rot = nextRot;
    consumeLockReset(state);
    state.lastMoveWasTSpin = true;  // 킥으로 회전했으므로 T-스핀 가능성 있음
    return true;
  }

  if (state.id === "player" && state.feverType === FEVER_TYPES.FORGE && isFeverModeActive()) {
    return tryFeverForgeKick(state, board, nextRot);
  }
  
  return false;
}

/**
 * T-스핀 판정 타입 정규화
 * @param {string|null} rawType - 보드 판정 결과 ('mini' | 'tspin' | null)
 * @param {number} cleared - 라인 클리어 수
 * @returns {string|null} 점수 계산용 타입 ('mini' | 'single' | 'double' | 'triple' | null)
 */
function normalizeTSpinType(rawType, cleared) {
  if (!rawType) return null;
  if (rawType === "mini") return "mini";
  if (rawType !== "tspin") return null;

  if (cleared >= 3) return "triple";
  if (cleared === 2) return "double";
  if (cleared === 1) return "single";
  return null;
}

/**
 * 클리어된 아이템 블록 효과 적용
 * @param {Object} who - 현재 플레이어 컨텍스트
 * @param {Array} itemBlocks - 클리어된 아이템 블록 목록
 * @param {Function} onEvent - 이벤트 콜백
 * @returns {{extraGarbage:number}} 추가 가비지 보너스
 */
function applyClearedItemEffects(who, itemBlocks, onEvent) {
  if (!itemBlocks || itemBlocks.length === 0) {
    return { extraGarbage: 0 };
  }

  let extraGarbage = 0;

  for (const item of itemBlocks) {
    const result = activateItem(item.itemType, item.x, item.y, who.board, who.itemSystem);
    if (!result.activated) continue;

    if (result.clearedCells.length > 0) {
      who.board.clearCells(result.clearedCells);
    }

    if (result.chainBombs.length > 0) {
      const chainClearedCells = processChainBombs(result.chainBombs, who.board, who.itemSystem);
      if (chainClearedCells.length > 0) {
        who.board.clearCells(chainClearedCells);
      }
    }

    extraGarbage += result.extraGarbage || 0;
    onEvent("item", { owner: who.state.id, itemType: item.itemType, extraGarbage: result.extraGarbage || 0 });
  }

  return { extraGarbage };
}

function applyPatternOutcome(who, patternInfo, baseStrength, nowMs, queue, getRng, onEvent) {
  if (!patternInfo) return;

  if (patternInfo.tag === "stabilityShield") {
    who.itemSystem?.activateShield?.();
    onEvent("pattern", {
      owner: who.state.id,
      tag: patternInfo.tag,
      label: patternInfo.label,
      tone: patternInfo.tone,
      attackType: null,
    });
    return;
  }

  const attack = makePatternAttack(patternInfo.tag, Math.max(1, baseStrength), getRng);
  if (!attack) return;

  queue.sendAttack(who.state.id, who.opponent.state.id, attack, nowMs);
  onEvent("attack", {
    from: who.state.id,
    type: attack.type,
    amount: attack.strength,
    patternTag: patternInfo.tag,
  });
  onEvent("pattern", {
    owner: who.state.id,
    tag: patternInfo.tag,
    label: patternInfo.label,
    tone: patternInfo.tone,
    attackType: attack.type,
  });
}

/**
 * 플레이어 피버 상태 동기화
 * @param {Object} state - 플레이어 상태
 * @param {number} cleared - 라인 클리어 수
 * @param {number} stackHeight - 현재 스택 높이
 * @param {Function} onEvent - 이벤트 콜백
 */
function updatePlayerFeverOnLock(state, cleared, stackHeight, nowMs, onEvent) {
  if (state.id !== "player") return;

  if (!isFeverModeActive() && state.combo >= 10) {
    const feverType = chooseFeverType({
      stackHeight,
      specialReady: state.specialReady,
      tSpin: !!state.tSpinType,
      cleared,
      backToBack: state.backToBack,
    });
    if (enterFeverMode(state.combo, { type: feverType })) {
      const feverStatus = getFeverStatus();
      triggerNeonShift(state, nowMs, "fever", 5200, onEvent);
      onEvent("feverEnter", { combo: state.combo, type: feverType, label: feverStatus.label });
    }
  }

  if (isFeverModeActive() && cleared > 0) {
    extendFeverDuration(cleared);
  }

  if (isFeverModeActive() && state.combo === 0) {
    exitFeverMode("combo_break");
    onEvent("feverExit", { reason: "combo_break" });
  }

  setFeverAttackMultiplier(isFeverModeActive() ? getFeverMultiplier() : 1.0);
  syncFeverMutationState(state);
}

function applySpawnAssist(who, bag, nowMs, queue, getRng, onEvent, shakeScreen, resolveAiSpecialAttack, heldActions, options = {}) {
  const { state } = who;
  if (state.topOut) return;
  const tuning = state.inputTuning || INPUT_PRESETS.standard;
  const skipHold = !!options.skipHold;

  // [v3.14.1] 스폰 보조는 IHS -> IRS -> 입력 버퍼 순서를 유지한다.
  // 같은 스폰 프레임 안에서 즉시 실행되므로 체감 지연은 없고,
  // 우선순위를 바꾸면 문서화된 입력 규칙과 실제 조작 기대치가 달라진다.
  if (!skipHold && tuning.ihsEnabled && heldActions?.has("hold")) {
    if (holdSwap(state, bag)) {
      onEvent("hold");
      return applySpawnAssist(who, bag, nowMs, queue, getRng, onEvent, shakeScreen, resolveAiSpecialAttack, heldActions, { skipHold: true });
    }
  }

  if (tuning.irsEnabled) {
    if (heldActions?.has("rotateCW") && tryRotate(state, who.board, true)) {
      onEvent("rotate", "cw");
      return;
    }
    if (heldActions?.has("rotateCCW") && tryRotate(state, who.board, false)) {
      onEvent("rotate", "ccw");
      return;
    }
  }

  if (state.inputBuffer && state.inputBufferUntil > nowMs) {
    const bufferedAction = state.inputBuffer;
    state.inputBuffer = null;
    state.inputBufferUntil = 0;
    applyInput(who, bufferedAction, bag, nowMs, queue, getRng, onEvent, shakeScreen, resolveAiSpecialAttack, heldActions);
    return;
  }

  state.inputBuffer = null;
  state.inputBufferUntil = 0;
}

/**
 * 블록 고정 처리
 * @param {Object} who - 플레이어/AI 객체
 * @param {BagRandom} bag - 블록 가방
 * @param {number} nowMs - 현재 시간
 * @param {BattleQueue} queue - 배틀 큐
 * @param {Function} getRng - 랜덤 함수
 * @param {Function} onEvent - 이벤트 콜백
 * @param {Function} shakeScreen - 화면 흔들림 함수
 * @param {Function|null} resolveAiSpecialAttack - AI 특수 패턴 생성기
 */
function lockPiece(who, bag, nowMs, queue, getRng, onEvent, shakeScreen, resolveAiSpecialAttack = null, heldActions = null) {
  const { state, board, opponent, fx } = who;
  const preMergeGrid = board.cloneGrid();
  const lockedPieceKey = state.piece;
  const lockedRot = state.rot;
  const lockedX = state.x;

  // 블록 병합
  const ok = board.merge(state.piece, state.rot, state.x, state.y, state.currentItem);
  if (!ok) {
    state.topOut = true;
    onEvent("ko", state.id);
    return;
  }
  
  // T-스핀 체크
  const rawTSpinType = state.lastMoveWasTSpin
    ? board.checkTSpin(state.piece, state.rot, state.x, state.y, state.lastMoveWasTSpin)
    : null;
  
  // 라인 클리어
  const clearResult = board.clearLines();
  const cleared = typeof clearResult === "number" ? clearResult : (clearResult.lines || 0);
  const clearedItemBlocks = typeof clearResult === "number" ? [] : (clearResult.itemBlocks || []);
  const clearedLines = typeof clearResult === "number" ? [] : (clearResult.clearedLines || []);
  const tSpinType = normalizeTSpinType(rawTSpinType, cleared);
  state.tSpinType = tSpinType;
  const itemEffects = applyClearedItemEffects(who, clearedItemBlocks, onEvent);
  
  // 퍼펙트 클리어 체크
  const isPerfectClear = cleared > 0 && board.isPerfectClear();
  const patternInfo = board.analyzeLinePattern({
    preGrid: preMergeGrid,
    pieceKey: lockedPieceKey,
    rot: lockedRot,
    x: lockedX,
    lines: cleared,
    tSpinType,
    isPerfectClear,
  });
  
  // 백투백 체크
  const isBackToBack = checkBackToBack(state, cleared, tSpinType);

  if (state.id === "player" && isPerfectClear) {
    triggerNeonShift(state, nowMs, "perfect", 5600, onEvent, { residueRows: clearedLines });
  } else if (state.id === "player" && tSpinType && cleared >= 2) {
    triggerNeonShift(state, nowMs, "tspin", 4600, onEvent, { residueRows: clearedLines });
  }
  
  // 콤보 업데이트
  updateCombo(state, cleared);
  
  // 점수 계산 및 추가
  if (cleared > 0 || tSpinType) {
    const score = calculateScore(state, cleared, tSpinType, isBackToBack, isPerfectClear);
    state.score += score;
    state.lines += cleared;
    state.linesForLevel += cleared;
    
    // 통계 업데이트
    updateStats(state, cleared, tSpinType, isPerfectClear);
    
    // 레벨업 체크
    const target = levelTarget(state.level);
    if (state.linesForLevel >= target) {
      state.level++;
      state.linesForLevel = 0;
      onEvent("levelup", state.level);
    }
    
    // [v5.0.0] 스킬 시스템 게이지 충전
    if (state.id === "player") {
      addPlayerGauge(cleared, !!tSpinType, isPerfectClear);
    } else {
      addAiGauge(cleared, !!tSpinType, isPerfectClear);
    }

    // 스킬 게이지를 플레이어 상태와 즉시 동기화
    const manager = state.id === "player" ? getPlayerSkillManager() : getAiSkillManager();
    state.specialGauge = manager.getGauge();
    state.specialReady = manager.isGaugeFull();
    
    // 이펙트
    const power = Math.max(1, cleared + (tSpinType ? 2 : 0));
    const color = tSpinType ? "#b388ff" : (isBackToBack ? "#ffd700" : "#00e5ff");
    const centerY = clearedLines.length > 0
      ? ((clearedLines.reduce((sum, line) => sum + line, 0) / clearedLines.length) + 0.5) * who.cellSize
      : who.cellSize * 10;
    const effectTier = isPerfectClear
      ? "perfect"
      : tSpinType
        ? "tspin"
        : cleared >= 4
          ? "tetris"
          : cleared === 3
            ? "triple"
            : cleared === 2
              ? "double"
              : "single";
    fx.burst((who.board.width * who.cellSize) / 2, centerY, color, power, tSpinType ? "tspin" : "line");
    if (clearedLines.length > 0) {
      fx.lineShatter(clearedLines, who.board.width, who.cellSize, color, power, effectTier);
    }
    
    // 콤보 이펙트 (5콤보+)
    if (state.combo >= 5) {
      onEvent("combo", { owner: state.id, combo: state.combo });
    }
    
    // 퍼펙트 클리어 이펙트
    if (isPerfectClear) {
      onEvent("perfect", state.id);
      shakeScreen(10);
    }
    
    // T-스핀 이펙트
    if (tSpinType) {
      onEvent("tspin", tSpinType);
    }
    
    // 배틀 공격
    const garbage = garbageForLines(cleared, tSpinType, isBackToBack) + itemEffects.extraGarbage;
    if (garbage > 0) {
      queue.sendAttack(state.id, opponent.state.id, {
        type: "GarbagePush",
        strength: garbage,
        seed: getRng()
      }, nowMs);
      onEvent("attack", { from: state.id, type: "GarbagePush", amount: garbage });
    }

    applyPatternOutcome(who, patternInfo, garbage > 0 ? garbage : cleared, nowMs, queue, getRng, onEvent);
    applyNeonShiftBonus(who, cleared, tSpinType, isPerfectClear, patternInfo, clearedLines, nowMs, queue, getRng, onEvent);
    applyLayerResonance(who, cleared, tSpinType, patternInfo, nowMs, queue, getRng, onEvent);

    if (state.id === "ai" && resolveAiSpecialAttack) {
      const specialAttack = resolveAiSpecialAttack(state, cleared, garbage);
      if (specialAttack) {
        queue.sendAttack(state.id, opponent.state.id, specialAttack, nowMs);
        onEvent("attack", { from: state.id, type: specialAttack.type, amount: specialAttack.strength });
      }
    }
    
    onEvent("line", { 
      owner: state.id,
      count: cleared, 
      combo: state.combo,
      backToBack: isBackToBack,
      tSpin: tSpinType,
      perfect: isPerfectClear,
      patternTag: patternInfo?.tag || null,
      patternLabel: patternInfo?.label || "",
      hitstopMs: isPerfectClear ? 120 : tSpinType && cleared >= 2 ? 95 : cleared >= 4 ? 85 : cleared === 3 ? 60 : cleared === 2 ? 45 : 30,
    });
  } else {
    // 라인 클리어 실패 시 콤보 리셋
    updateCombo(state, 0);
  }

  // 피버 상태 업데이트 (플레이어만 적용)
  updatePlayerFeverOnLock(state, cleared, board.getStackHeight(), nowMs, onEvent);
  
  // 다음 블록 스폰
  spawn(state, bag);
  applySpawnAssist(who, bag, nowMs, queue, getRng, onEvent, shakeScreen, resolveAiSpecialAttack, heldActions);

  // 게임 오버 체크
  const collision = board.collides(state.piece, state.rot, state.x, state.y);
  if (collision) {
    state.topOut = true;
    onEvent("ko", state.id);
  }
}

/**
 * 입력 처리
 * @param {Object} who - 플레이어/AI 객체
 * @param {string} action - 액션 종류
 * @param {BagRandom} bag - 블록 가방
 * @param {number} nowMs - 현재 시간
 * @param {BattleQueue} queue - 배틀 큐
 * @param {Function} getRng - 랜덤 함수
 * @param {Function} onEvent - 이벤트 콜백
 * @param {Function} shakeScreen - 화면 흔들림 함수
 * @param {Function|null} resolveAiSpecialAttack - AI 특수 패턴 생성기
 */
function applyInput(who, action, bag, nowMs, queue, getRng, onEvent, shakeScreen, resolveAiSpecialAttack = null, heldActions = null) {
  const { state, board } = who;
  if (state.topOut) return false;
  if (nowMs < state.inputDelayUntil) {
    return queueBufferedAction(state, action, nowMs);
  }

  // [v3.0.1-fix] 미러 디버프가 활성화된 동안에는 좌우 입력을 실제 동작 전에 뒤집는다.
  let resolvedAction = action;
  if (state.mirrorMoveUntil > nowMs) {
    if (action === "left") resolvedAction = "right";
    if (action === "right") resolvedAction = "left";
  }
  
  switch (resolvedAction) {
    case "left":
      if (tryMove(state, board, -1, 0)) {
        onEvent("move", "left");
        return true;
      }
      return false;
      
    case "right":
      if (tryMove(state, board, 1, 0)) {
        onEvent("move", "right");
        return true;
      }
      return false;
      
    case "softDrop":
      if (tryMove(state, board, 0, 1)) {
        state.softDropAcc++;
        onEvent("softdrop");
        return true;
      }
      return false;
      
    case "rotate":
    case "rotateCW":
      if (tryRotate(state, board, true)) {
        if (state.rotationTaxUntil > nowMs) {
          drainStateGauge(state, 12);
        }
        onEvent("rotate", "cw");
        return true;
      }
      return false;
      
    case "rotateCCW":
      if (tryRotate(state, board, false)) {
        if (state.rotationTaxUntil > nowMs) {
          drainStateGauge(state, 12);
        }
        onEvent("rotate", "ccw");
        return true;
      }
      return false;
      
    case "hold":
      if (holdSwap(state, bag)) {
        onEvent("hold");
        applySpawnAssist(who, bag, nowMs, queue, getRng, onEvent, shakeScreen, resolveAiSpecialAttack, heldActions, { skipHold: true });
        return true;
      }
      return false;
      
    case "hardDrop":
      // 하드드롭: 바닥까지 이동
      let dropDistance = 0;
      while (tryMove(state, board, 0, 1)) {
        dropDistance++;
      }
      state.hardDropUsed = true;
      state.dropAcc = 0;  // [v2.0.1-fix] 중력 누적 초기화
      state.lockAcc = 0;
      onEvent("harddrop", dropDistance);
      shakeScreen(Math.min(5, dropDistance / 3));
      lockPiece(who, bag, nowMs, queue, getRng, onEvent, shakeScreen, resolveAiSpecialAttack, heldActions);
      // [v2.0.1-fix] lockPiece 후 dropAcc 초기화 보장
      state.dropAcc = 0;
      return true;
      
    case "special":
      if (useSpecial(state)) {
        const fallbackSkill = [SkillType.BLIND, SkillType.BLOCK_SWAP, SkillType.GARBAGE_REFLECT].find((skillType) => {
          return getSkillManagerForState(state).canUseSkill(skillType);
        });
        if (fallbackSkill) {
          applyInput(who, fallbackSkill === SkillType.BLIND ? "skill1" : fallbackSkill === SkillType.BLOCK_SWAP ? "skill2" : "skill3", bag, nowMs, queue, getRng, onEvent, shakeScreen, resolveAiSpecialAttack);
        } else {
          onEvent("special", { user: state.id, skill: "legacy" });
        }
        return true;
      }
      return false;

    // [v5.0.0] 스킬 시스템 액션 처리
    case "skill1":
    case "skill2":
    case "skill3": {
      const skillMap = { skill1: SkillType.BLIND, skill2: SkillType.BLOCK_SWAP, skill3: SkillType.GARBAGE_REFLECT };
      const skillType = skillMap[action];
      const userManager = state.id === "player" ? getPlayerSkillManager() : getAiSkillManager();
      const opponentManager = state.id === "player" ? getAiSkillManager() : getPlayerSkillManager();

      if (userManager.canUseSkill(skillType)) {
        // [v5.0.0-fix] 스킬 타입에 따라 대상 보드 결정
        const targetBoard = skillType === SkillType.BLOCK_SWAP ? who.opponent.board : null;
        const result = userManager.useSkill(skillType, targetBoard);

        if (result.success) {
          // [v5.0.0-fix] 블라인드는 상대방에게 효과 적용
          if (skillType === SkillType.BLIND) {
            opponentManager.applyBlind(result.data.duration);
          }
          const fusionMeta = applySkillFusion(who, result.fusion, nowMs, queue, getRng, onEvent);
          onEvent("special", { user: state.id, skill: skillType, fusion: result.fusion, fusionMeta });
          return true;
        }
      }
      return false;
    }
  }
  return false;
}

/**
 * 배틀 공격 적용
 * @param {Object} targetWho - 대상 플레이어
 * @param {Object} attack - 공격 정보
 * @param {number} nowMs - 현재 시간
 * @param {Function} onEvent - 이벤트 콜백
 * @param {BattleQueue} queue - 배틀 큐
 * @param {Function} getRng - 랜덤 함수
 */
function applyAttack(targetWho, attack, nowMs, onEvent, queue, getRng) {
  const { state, board } = targetWho;
  const targetSkillManager = state.id === "player" ? getPlayerSkillManager() : getAiSkillManager();
  let deliveredAmount = attack.strength || 0;
  let counterType = "";
  
  switch (attack.type) {
    case "GarbagePush":
      // 가비지 반사 상태면 상대에게 1회 반사 (반사된 공격은 재반사 금지)
      if (!attack.reflected && targetSkillManager.isGarbageReflectActive()) {
        queue.sendAttack(state.id, targetWho.opponent.state.id, {
          ...attack,
          reflected: true,
          seed: getRng()
        }, nowMs);
        onEvent("reflected", { from: state.id, amount: attack.strength });
        deliveredAmount = 0;
        break;
      }

      // 실드가 있으면 가비지 차단
      if (targetWho.itemSystem && targetWho.itemSystem.consumeShield()) {
        onEvent("shieldBlock", { target: state.id, amount: attack.strength });
        deliveredAmount = 0;
        break;
      }

      if (state.id === "player" && state.feverType === FEVER_TYPES.GUARD && state.feverGuardCharges > 0) {
        state.feverGuardCharges -= 1;
        onEvent("shieldBlock", { target: state.id, amount: attack.strength, feverGuard: true });
        deliveredAmount = 0;
        break;
      }

      {
        const counter = applyLayerCounter(targetWho, attack, nowMs, onEvent, queue, getRng);
        counterType = counter.counterType || counterType;
        attack = counter.attack;
        deliveredAmount = attack.strength || 0;
        if (counter.cancelled || deliveredAmount <= 0) {
          deliveredAmount = 0;
          break;
        }
      }

      // [v2.0.2-fix] holeX를 -1로 설정하여 랜덤 구멍 생성
      board.pushGarbage(Math.max(1, attack.strength), -1);
      if (state.id === "ai" && state.bossModeEnabled) {
        state.bossHp = Math.max(0, state.bossHp - Math.max(1, attack.strength) * 10);
      }
      break;
      
    case "CorruptNext":
      {
        const counter = applyLayerCounter(targetWho, attack, nowMs, onEvent, queue, getRng);
        counterType = counter.counterType || counterType;
        if (counter.cancelled) {
          deliveredAmount = 0;
          break;
        }
      }
      const badPieces = ["S", "Z", "L", "J"];
      const count = Math.min(3, Math.max(1, attack.strength));
      const seedIndex = Math.floor((attack.seed || 0) * badPieces.length);
      state.corruptNextUntil = nowMs + 5000;
      for (let i = 0; i < count && i < state.queue.length; i++) {
        state.queue[i] = badPieces[(seedIndex + i) % badPieces.length];
      }
      break;
      
    case "GravityJolt":
      {
        const counter = applyLayerCounter(targetWho, attack, nowMs, onEvent, queue, getRng);
        counterType = counter.counterType || counterType;
        if (counter.cancelled) {
          deliveredAmount = 0;
          break;
        }
      }
      if (!board.collides(state.piece, state.rot, state.x, state.y + 1)) {
        state.y += 1;
      }
      state.gravityJoltUntil = nowMs + 1800;
      break;
      
    case "StackShake":
      {
        const counter = applyLayerCounter(targetWho, attack, nowMs, onEvent, queue, getRng);
        counterType = counter.counterType || counterType;
        if (counter.cancelled) {
          deliveredAmount = 0;
          break;
        }
      }
      state.inputDelayUntil = nowMs + 420;
      const el = document.getElementById(state.id === "player" ? "playerCanvas" : "aiCanvas");
      if (el) shakeElement(el);
      break;
      
    case "Darkness":
      {
        const counter = applyLayerCounter(targetWho, attack, nowMs, onEvent, queue, getRng);
        counterType = counter.counterType || counterType;
        if (counter.cancelled) {
          deliveredAmount = 0;
          break;
        }
      }
      state.darknessUntil = nowMs + 2600;
      break;
      
    case "MirrorMove":
      {
        const counter = applyLayerCounter(targetWho, attack, nowMs, onEvent, queue, getRng);
        counterType = counter.counterType || counterType;
        if (counter.cancelled) {
          deliveredAmount = 0;
          break;
        }
      }
      state.mirrorMoveUntil = nowMs + 4200;
      break;

    case "HoldLock":
      {
        const counter = applyLayerCounter(targetWho, attack, nowMs, onEvent, queue, getRng);
        counterType = counter.counterType || counterType;
        if (counter.cancelled) {
          deliveredAmount = 0;
          break;
        }
      }
      state.holdLockUntil = nowMs + 3200;
      break;

    case "GhostOut":
      {
        const counter = applyLayerCounter(targetWho, attack, nowMs, onEvent, queue, getRng);
        counterType = counter.counterType || counterType;
        if (counter.cancelled) {
          deliveredAmount = 0;
          break;
        }
      }
      state.ghostHiddenUntil = nowMs + 4200;
      break;

    case "RotationTax":
      {
        const counter = applyLayerCounter(targetWho, attack, nowMs, onEvent, queue, getRng);
        if (counter.cancelled) {
          deliveredAmount = 0;
          break;
        }
      }
      state.rotationTaxUntil = nowMs + 4600;
      deliveredAmount = 12;
      break;

    case "GaugeLeech":
      {
        const counter = applyLayerCounter(targetWho, attack, nowMs, onEvent, queue, getRng);
        if (counter.cancelled) {
          deliveredAmount = 0;
          break;
        }
      }
      deliveredAmount = drainStateGauge(state, 35);
      state.gaugeLeechUntil = nowMs + 2400;
      break;

    case "NextScramble":
      {
        const counter = applyLayerCounter(targetWho, attack, nowMs, onEvent, queue, getRng);
        if (counter.cancelled) {
          deliveredAmount = 0;
          break;
        }
      }
      shuffleNextQueue(state, attack.seed || Math.random(), 3);
      state.nextScrambleUntil = nowMs + 3600;
      break;

    case "PierceBarrage":
      {
        const counter = applyLayerCounter(targetWho, attack, nowMs, onEvent, queue, getRng);
        counterType = counter.counterType || counterType;
        attack = counter.attack;
        deliveredAmount = Math.max(0, attack.strength || 0);
        if (counter.cancelled || deliveredAmount <= 0) {
          deliveredAmount = 0;
          break;
        }
      }
      board.pushGarbage(deliveredAmount, (attack.seed || 0) < 0.5 ? 4 : 5);
      break;

    case "DrillHex": {
      const counter = applyLayerCounter(targetWho, attack, nowMs, onEvent, queue, getRng);
      counterType = counter.counterType || counterType;
      if (counter.cancelled) {
        deliveredAmount = 0;
        break;
      }
      const badPieces = ["S", "Z", "L", "J"];
      const seedIndex = Math.floor((attack.seed || 0) * badPieces.length);
      state.corruptNextUntil = nowMs + 4000;
      for (let i = 0; i < Math.min(2, state.queue.length); i++) {
        state.queue[i] = badPieces[(seedIndex + i) % badPieces.length];
      }
      deliveredAmount = 2;
      break;
    }

    case "WavePush":
      {
        const counter = applyLayerCounter(targetWho, attack, nowMs, onEvent, queue, getRng);
        counterType = counter.counterType || counterType;
        attack = counter.attack;
        deliveredAmount = Math.max(0, attack.strength || 0);
        if (counter.cancelled || deliveredAmount <= 0) {
          deliveredAmount = 0;
          break;
        }
      }
      if (!board.collides(state.piece, state.rot, state.x, state.y + 1)) {
        state.y += 1;
      }
      state.gravityJoltUntil = nowMs + 1200;
      state.inputDelayUntil = Math.max(state.inputDelayUntil, nowMs + 280);
      break;

    case "NullBurst":
      {
        const counter = applyLayerCounter(targetWho, attack, nowMs, onEvent, queue, getRng);
        counterType = counter.counterType || counterType;
        attack = counter.attack;
        deliveredAmount = Math.max(0, attack.strength || 0);
        if (counter.cancelled || deliveredAmount <= 0) {
          deliveredAmount = 0;
          break;
        }
      }
      board.pushGarbage(deliveredAmount, -1);
      drainStateGauge(state, 25);
      state.gaugeLeechUntil = nowMs + 2500;
      break;
  }

  if (state.id === "ai" && state.bossModeEnabled) {
    state.bossModeActive = state.bossHp <= state.bossModeThreshold;
  }
  
  onEvent("attacked", { target: state.id, type: attack.type, amount: deliveredAmount, countered: deliveredAmount <= 0 && !!counterType, counterType });
}

/**
 * 게임 인스턴스 생성
 * @param {Object} config - 설정 객체
 * @returns {Object} 게임 컨트롤러
 */
export function createGame(config) {
  let bag = new BagRandom();
  const player = { state: null, board: null, fx: null, itemSystem: null, opponent: null };
  const ai = { state: null, board: null, fx: null, itemSystem: null, opponent: null };
  const queue = new BattleQueue();
  let selectedDifficulty = "기사";
  let wasmMath = { add: (a, b) => a + b };
  let aiCtl = new AIController(selectedDifficulty, wasmMath);
  let screenShakeScale = 1;
  const heldPlayerActions = new Set();
  
  // 화면 흔들림 함수
  const shakeScreen = (intensity = 5) => {
    const app = document.getElementById("app");
    if (!app) return;

    const scaledIntensity = Math.max(0, intensity * screenShakeScale);
    if (scaledIntensity <= 0.01) {
      app.style.setProperty("--shake-x", "0px");
      app.style.setProperty("--shake-y", "0px");
      return;
    }

    const x = (Math.random() - 0.5) * scaledIntensity;
    const y = (Math.random() - 0.5) * scaledIntensity;
    app.style.setProperty("--shake-x", `${x}px`);
    app.style.setProperty("--shake-y", `${y}px`);
    
    setTimeout(() => {
      app.style.setProperty("--shake-x", "0px");
      app.style.setProperty("--shake-y", "0px");
    }, 100);
  };
  
  // 사이드 초기화
  function resetSide(who, id) {
    who.state = createPlayerState(id, bag);
    who.board = new Board();
    who.fx = new EffectEngine();
    who.itemSystem = createItemSystem();
    who.state.id = id;
    who.state.inputTuning = { ...(id === "player" ? (config.getInputTuning?.() || INPUT_PRESETS.standard) : INPUT_PRESETS.standard) };
    const canvas = id === "player" ? config.playerCanvas : config.aiCanvas;
    who.cellSize = canvas.width / who.board.width;
  }

  function syncAiDifficultyState() {
    const currentCfg = aiCtl.getConfig();
    ai.state.aiLevelName = selectedDifficulty;
    ai.state.bossModeEnabled = !!currentCfg.bossMode;
    ai.state.bossModeThreshold = currentCfg.bossModeThreshold || 0;
    ai.state.bossModeActive = !!currentCfg.isBossMode;
    ai.state.bossHp = typeof ai.state.bossHp === "number" ? ai.state.bossHp : 100;
  }

  function syncAiBossMode() {
    // [v3.0.1-fix] 보스 난이도는 HP 임계치 이하에서만 분노 모드 설정을 적용한다.
    const shouldEnable = !!ai.state.bossModeEnabled && ai.state.bossHp <= ai.state.bossModeThreshold;
    ai.state.bossModeActive = shouldEnable;
    aiCtl.setBossMode(shouldEnable);
  }

  function resolveAiSpecialAttack(state, cleared, garbage) {
    const currentCfg = aiCtl.getConfig();
    if (state.id !== "ai" || cleared <= 0) return null;
    if (Math.random() >= (currentCfg.attackChance || 0)) return null;

    const availablePatterns = currentCfg.specialPatterns || ["GarbagePush"];
    const ruleBreakPatterns = availablePatterns.filter((pattern) => {
      return ["HoldLock", "GhostOut", "RotationTax", "GaugeLeech", "NextScramble"].includes(pattern);
    });
    const selectionPool = state.bossModeActive && ruleBreakPatterns.length > 0 && Math.random() < 0.7
      ? ruleBreakPatterns
      : availablePatterns;
    const pattern = selectionPool[Math.floor(Math.random() * selectionPool.length)];

    if (pattern === "GarbagePush") {
      if (garbage > 0) return null;
      return makeSpecialAttack("GarbagePush", Math.max(1, cleared), () => bag.rnd());
    }

    return makeSpecialAttack(pattern, Math.max(1, cleared), () => bag.rnd());
  }
  
  // 매치 초기화
  function resetMatch() {
    bag = new BagRandom();
    heldPlayerActions.clear();
    resetSide(player, "player");
    resetSide(ai, "ai");
    player.opponent = ai;
    ai.opponent = player;
    queue.pending = [];
    // [v5.0.0] 스킬 시스템도 리셋
    resetSkillSystem();
    resetFeverMode();
    resetFeverAttackMultiplier();
    ai.state.bossHp = 100;
    aiCtl.setLevel(selectedDifficulty);
    syncAiDifficultyState();
    syncAiBossMode();
  }
  
  resetMatch();

  // [v5.0.0] 스킬 시스템 초기화
  initSkillSystem();

  const pCtx = config.playerCanvas.getContext("2d");
  const aCtx = config.aiCanvas.getContext("2d");
  let running = false;
  
  // WASM 로드
  loadWasmMath().then((exports) => {
    wasmMath = exports;
    const current = aiCtl.levelName;
    aiCtl = new AIController(current, wasmMath);
    syncAiDifficultyState();
    syncAiBossMode();
  });
  
  // 한 프레임 업데이트
  function stepOne(who, dt, nowMs) {
    if (who.state.topOut) {
      who.fx.tick(dt);
      return;
    }
    
    // 중력 적용
    who.state.stackHeight = who.board.getStackHeight();
    who.state.isFeverModeActive = who.state.id === "player" ? isFeverModeActive() : false;
    if (who.state.id === "ai") {
      syncAiBossMode();
    }
    const speed = speedMultiplier(who.state.level);
    const joltMult = nowMs < who.state.gravityJoltUntil ? 1.65 : 1;
    const gravity = BASE_DROP_PER_SEC * speed * joltMult;
    who.state.dropAcc += dt * gravity;
    
    // 낙하 처리
    while (who.state.dropAcc >= 1) {
      who.state.dropAcc -= 1;
      if (!tryMove(who.state, who.board, 0, 1)) {
        // 바닥에 닿음 - 락 딜레이 시작
        who.state.lockAcc += dt * 1000;
        if (who.state.lockAcc >= LOCK_DELAY_MS) {
          who.state.lockAcc = 0;
          who.state.dropAcc = 0;  // [v2.0.1-fix] lockPiece 호출 후 dropAcc 초기화
          lockPiece(who, bag, nowMs, queue, () => bag.rnd(), config.onEvent, shakeScreen, resolveAiSpecialAttack, who.state.id === "player" ? heldPlayerActions : null);
          break;
        }
      } else {
        // 낙하 성공 - 락 딜레이 리셋
        who.state.lockAcc = 0;
      }
    }
    
    // 배틀 공격 적용
    queue.applyIncomingAttacks(who.state, nowMs, (_target, attack) => {
      applyAttack(who, attack, nowMs, config.onEvent, queue, () => bag.rnd());
    });

    who.fx.tick(dt);

    // 피버 타이머 업데이트 (플레이어만 적용)
    if (who.state.id === "player" && isFeverModeActive()) {
      const stillActive = updateFeverMode(dt);
      if (!stillActive) {
        setFeverAttackMultiplier(1.0);
        config.onEvent("feverExit", { reason: "timeout" });
      }
    }

    // [v5.0.0] 스킬 시스템 게이지 동기화
      const skillManager = who.state.id === "player" ? getPlayerSkillManager() : getAiSkillManager();
    if (skillManager) {
      who.state.specialGauge = skillManager.getGauge();
      who.state.specialReady = skillManager.isGaugeFull();
    }
    syncFeverMutationState(who.state);
    const shiftActiveNow = isNeonShiftActive(who.state, nowMs);
    if (who.state.id === "player" && who.state.neonShiftWasActive && !shiftActiveNow) {
      who.state.layerCounterUntil = 0;
      who.state.layerCounterLabel = "";
      config.onEvent("neonShiftEnd", {
        owner: who.state.id,
        source: who.state.neonShiftSource || "shift",
        residueCount: pruneNeonResidue(who.state, nowMs).length,
      });
    }
    who.state.neonShiftWasActive = shiftActiveNow;
    who.state.stackHeight = who.board.getStackHeight();
    who.state.isFeverModeActive = who.state.id === "player" ? isFeverModeActive() : false;
  }
  
  // 렌더링
  function render() {
    drawBoard(pCtx, player.state, player.board, player.fx);
    drawBoard(aCtx, ai.state, ai.board, ai.fx);
    
    // HUD 업데이트
    if (config.onHud) {
      config.onHud(player.state, ai.state);
    }
  }
  
  return {
    start() { running = true; },
    pause() { running = !running; return running; },
    reset() { resetMatch(); running = false; },
    restartRound() { resetMatch(); running = true; },
    isRunning() { return running; },
    isGameOver() { return player.state.topOut || ai.state.topOut; },
    getWinner() {
      if (player.state.topOut) return "ai";
      if (ai.state.topOut) return "player";
      return null;
    },
    setDifficulty(levelName) {
      selectedDifficulty = levelName;
      aiCtl.setLevel(levelName);
      syncAiDifficultyState();
      syncAiBossMode();
    },
    dispatchInput(playerId, action) {
      if (!running) return false;
      const nowMs = performance.now();
      const target = playerId === "player" ? player : ai;
      return applyInput(target, action, bag, nowMs, queue, () => bag.rnd(), config.onEvent, shakeScreen, resolveAiSpecialAttack, playerId === "player" ? heldPlayerActions : null);
    },
    enqueueBufferedAction(playerId, action) {
      const target = playerId === "player" ? player : ai;
      return queueBufferedAction(target.state, action, performance.now());
    },
    setHeldAction(playerId, action, isDown) {
      if (playerId !== "player") return;
      if (isDown) {
        heldPlayerActions.add(action);
      } else {
        heldPlayerActions.delete(action);
      }
    },
    setInputTuning(playerId, tuning) {
      const target = playerId === "player" ? player : ai;
      target.state.inputTuning = { ...target.state.inputTuning, ...(tuning || {}) };
    },
    getState(playerId) {
      return playerId === "player" ? player.state : ai.state;
    },
    getIncomingAttacks(playerId) {
      return queue.getPendingFor(playerId, performance.now());
    },
    setScreenShakeScale(scale) {
      screenShakeScale = Math.max(0, Math.min(1.5, Number(scale) || 0));
    },
    activateNeonShift(playerId, source = "manual", durationMs = 4200, emitEvent = true) {
      const target = playerId === "player" ? player : ai;
      return triggerNeonShift(target.state, performance.now(), source, durationMs, emitEvent ? config.onEvent : null, { silent: !emitEvent });
    },
    tick(dt) {
      if (running) {
        const nowMs = performance.now();
        aiCtl.tick(dt, ai.state, ai.board, this.dispatchInput.bind(this));
        stepOne(player, dt, nowMs);
        stepOne(ai, dt, nowMs);
        updateSkills(dt);
        player.state.specialGauge = getPlayerSkillManager().getGauge();
        player.state.specialReady = getPlayerSkillManager().isGaugeFull();
        ai.state.specialGauge = getAiSkillManager().getGauge();
        ai.state.specialReady = getAiSkillManager().isGaugeFull();
        
        if (player.state.topOut || ai.state.topOut) {
          running = false;
          config.onEvent("gameover", this.getWinner());
        }
      }
      render();
    },
  };
}
