/*
 * [v3.14.1] 키보드 입력 처리
 *
 * 작성일: 2026-03-02
 * 변경사항:
 *   - Input Fidelity 2.0용 실시간 키맵/프리셋/재바인딩 캡처 지원
 *   - 좌우 독립 DAS/ARR, 최근 방향 우선 처리
 *   - 입력 계측, 버퍼 큐, 홀드 상태 전달 지원
 *   - [v3.14.1] 일시정지 오버레이 차단 중에도 pause 토글은 허용하고, 반대 방향 키 복귀를 더 매끄럽게 보정
 */

const DEFAULT_MAPPING = {
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

const ACTION_ALIAS = {
  moveLeft: "left",
  moveRight: "right",
  rotateCW: "rotateCW",
  rotateCCW: "rotateCCW",
  softDrop: "softDrop",
  hardDrop: "hardDrop",
  hold: "hold",
  skill1: "skill1",
  skill2: "skill2",
  skill3: "skill3",
  pause: "pause",
};

const HOLD_ACTIONS = new Set(["left", "right", "softDrop", "rotateCW", "rotateCCW", "hold"]);

function resolveActionMap(rawMapping = {}) {
  const resolved = new Map();
  const merged = { ...DEFAULT_MAPPING, ...(rawMapping || {}) };
  Object.entries(merged).forEach(([logicalAction, keyCodes]) => {
    const codes = Array.isArray(keyCodes) ? keyCodes : [];
    const action = ACTION_ALIAS[logicalAction];
    if (!action) return;
    codes.forEach((code) => {
      if (!code) return;
      resolved.set(code, action);
    });
  });
  return resolved;
}

function isFormControlTarget(target) {
  return target instanceof HTMLElement && (
    target.closest("input, textarea, select, button") ||
    target.isContentEditable
  );
}

export function installKeyboard(dispatch, options = {}) {
  const {
    getKeyMapping = () => DEFAULT_MAPPING,
    getInputTuning = () => ({ dasMs: 135, arrMs: 40, softDropRepeatMs: 32 }),
    isInputBlocked = () => false,
    onRebindCapture = () => {},
    isCapturingRebind = () => false,
    onInputMetric = () => {},
    onHeldActionChange = () => {},
  } = options;

  const keyState = new Map();
  const horizontalTimers = {
    left: { timeout: null, interval: null },
    right: { timeout: null, interval: null },
  };
  const horizontalPressOrder = new Map();
  let softDropInterval = null;
  let lastHorizontalAction = null;
  let pressSequence = 0;

  const clearHorizontalTimer = (action) => {
    const timers = horizontalTimers[action];
    if (!timers) return;
    if (timers.timeout) {
      clearTimeout(timers.timeout);
      timers.timeout = null;
    }
    if (timers.interval) {
      clearInterval(timers.interval);
      timers.interval = null;
    }
  };

  const clearSoftDropTimer = () => {
    if (softDropInterval) {
      clearInterval(softDropInterval);
      softDropInterval = null;
    }
  };

  const resetAllTimers = () => {
    clearHorizontalTimer("left");
    clearHorizontalTimer("right");
    clearSoftDropTimer();
  };

  const emitHeldState = (action, isDown, code) => {
    if (!HOLD_ACTIONS.has(action)) return;
    onHeldActionChange(action, isDown, code);
  };

  const emitInput = (action, metricType, code) => {
    if (metricType) {
      onInputMetric(metricType, action, { code });
    }
    dispatch("player", action);
  };

  const getRepeatMs = (action) => {
    const tuning = getInputTuning() || {};
    if (action === "softDrop") {
      return Math.max(8, Number(tuning.softDropRepeatMs) || 32);
    }
    return Math.max(0, Number(tuning.arrMs) || 0);
  };

  const beginHorizontalRepeat = (action, code) => {
    clearHorizontalTimer(action);
    const tuning = getInputTuning() || {};
    const dasMs = Math.max(0, Number(tuning.dasMs) || 0);
    const arrMs = getRepeatMs(action);
    horizontalTimers[action].timeout = setTimeout(() => {
      if (!keyState.get(code)) return;
      if (lastHorizontalAction !== action) return;
      emitInput(action, "repeat", code);
      if (arrMs <= 0) return;
      horizontalTimers[action].interval = setInterval(() => {
        if (!keyState.get(code) || lastHorizontalAction !== action) return;
        emitInput(action, "repeat", code);
      }, arrMs);
    }, dasMs);
  };

  const beginSoftDropRepeat = (action, code) => {
    clearSoftDropTimer();
    const repeatMs = getRepeatMs(action);
    softDropInterval = setInterval(() => {
      if (!keyState.get(code)) return;
      emitInput(action, "repeat", code);
    }, repeatMs);
  };

  const findHeldCodeForAction = (targetAction) => {
    let selectedCode = null;
    let selectedOrder = -1;
    for (const [code, pressed] of keyState.entries()) {
      if (!pressed) continue;
      if (resolveActionMap(getKeyMapping()).get(code) !== targetAction) continue;
      const order = horizontalPressOrder.get(code) || 0;
      if (order >= selectedOrder) {
        selectedCode = code;
        selectedOrder = order;
      }
    }
    return selectedCode;
  };

  const stopAction = (action) => {
    if (action === "left" || action === "right") {
      clearHorizontalTimer(action);
      if (lastHorizontalAction === action) {
        const fallback = action === "left" ? "right" : "left";
        const fallbackCode = findHeldCodeForAction(fallback);
        if (fallbackCode) {
          lastHorizontalAction = fallback;
          emitInput(fallback, "resume", fallbackCode);
          beginHorizontalRepeat(fallback, fallbackCode);
        } else {
          lastHorizontalAction = null;
        }
      }
    }
    if (action === "softDrop") {
      clearSoftDropTimer();
    }
  };

  window.addEventListener("keydown", (e) => {
    if (isFormControlTarget(e.target)) return;

    if (isCapturingRebind()) {
      e.preventDefault();
      e.stopPropagation();
      onRebindCapture(e.code);
      return;
    }

    const actionMap = resolveActionMap(getKeyMapping());
    const action = actionMap.get(e.code);
    if (!action) return;

    if (isInputBlocked() && action !== "pause") return;

    e.preventDefault();

    if (keyState.get(e.code)) return;
    keyState.set(e.code, true);
    emitHeldState(action, true, e.code);

    if (action === "pause") {
      emitInput(action, "press", e.code);
      return;
    }

    if (action === "left" || action === "right") {
      horizontalPressOrder.set(e.code, ++pressSequence);
      lastHorizontalAction = action;
      emitInput(action, "press", e.code);
      beginHorizontalRepeat(action, e.code);
      return;
    }

    if (action === "softDrop") {
      emitInput(action, "press", e.code);
      beginSoftDropRepeat(action, e.code);
      return;
    }

    emitInput(action, "press", e.code);
  });

  window.addEventListener("keyup", (e) => {
    const action = resolveActionMap(getKeyMapping()).get(e.code);
    if (!action) return;
    keyState.set(e.code, false);
    horizontalPressOrder.delete(e.code);
    emitHeldState(action, false, e.code);
    stopAction(action);
    onInputMetric("release", action, { code: e.code });
  });

  window.addEventListener("blur", () => {
    keyState.clear();
    horizontalPressOrder.clear();
    lastHorizontalAction = null;
    resetAllTimers();
    ["left", "right", "softDrop", "rotateCW", "rotateCCW", "hold"].forEach((action) => {
      emitHeldState(action, false);
    });
  });
}

export function setKeyMapping(customMapping) {
  Object.assign(DEFAULT_MAPPING, customMapping);
}

export function getKeyMapping() {
  return JSON.parse(JSON.stringify(DEFAULT_MAPPING));
}
