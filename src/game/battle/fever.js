/*
 * [v3.15.0] 피버 모드 시스템
 * 
 * 작성일: 2026-02-28
 * 변경사항: 피버 모드 초기 구현 - 10콤보 이상 시 활성화
 *   - [v3.11.0] 피버 타입 분기와 전장 변형 메타 추가
 *   - [v3.15.0] 피버 연장량과 최대 누적치를 낮춰 후반 과열 시간을 줄임
 * 
 * 기능:
 *   - 10콤보 이상 시 피버 모드 진입
 *   - 화면 테두리 불꽃 효과
 *   - BGM 1.3배속 재생
 *   - 공격력 1.5배 배수 적용
 */

/**
 * 피버 모드 상태 객체
 * @typedef {Object} FeverState
 * @property {boolean} active - 피버 모드 활성화 여부
 * @property {number} timer - 남은 지속 시간 (초)
 * @property {number} maxDuration - 최대 지속 시간 (초)
 * @property {number} comboThreshold - 진입에 필요한 콤보 수
 * @property {number} multiplier - 공격 배수
 * @property {number} bgmSpeed - BGM 재생 속도
 */

/**
 * 피버 모드 기본 설정
 */
const FEVER_CONFIG = {
  COMBO_THRESHOLD: 10,      // [v2.1.0] 피버 진입 콤보 기준
  MAX_DURATION: 10,         // [v2.1.0] 기본 지속 시간 (초)
  EXTEND_DURATION: 1.5,     // [v3.15.0] 라인 클리어 시 연장 시간 (초)
  MULTIPLIER: 1.5,          // [v2.1.0] 공격 배수
  BGM_SPEED: 1.3,           // [v2.1.0] BGM 재생 속도
  BGM_NORMAL: 1.0,          // [v2.1.0] 일반 BGM 속도
};

export const FEVER_TYPES = {
  FORGE: "forge",
  GUARD: "guard",
  SCAN: "scan",
  SURGE: "surge",
};

const FEVER_TYPE_META = {
  [FEVER_TYPES.FORGE]: { label: "FORGE", description: "강화 벽킥과 회전 안정성" },
  [FEVER_TYPES.GUARD]: { label: "GUARD", description: "가비지 1회 자동 무효화" },
  [FEVER_TYPES.SCAN]: { label: "SCAN", description: "NEXT 5 공개" },
  [FEVER_TYPES.SURGE]: { label: "SURGE", description: "아이템 출현 확률 증가" },
};

/**
 * 피버 모드 상태
 */
const feverState = {
  active: false,
  timer: 0,
  maxDuration: FEVER_CONFIG.MAX_DURATION,
  comboThreshold: FEVER_CONFIG.COMBO_THRESHOLD,
  multiplier: FEVER_CONFIG.MULTIPLIER,
  bgmSpeed: FEVER_CONFIG.BGM_NORMAL,
  enteredAt: 0,             // [v2.1.0] 진입 시간 기록
  totalExtended: 0,         // [v2.1.0] 총 연장된 시간
  type: FEVER_TYPES.FORGE,  // [v3.11.0] 현재 피버 타입
};

/**
 * 피버 이벤트 콜백 핸들러
 */
const callbacks = {
  onEnter: null,            // [v2.1.0] 진입 시 콜백
  onExit: null,             // [v2.1.0] 종료 시 콜백
  onExtend: null,           // [v2.1.0] 연장 시 콜백
};

/**
 * 피버 모드 진입
 * [v2.1.0] 10콤보 이상 시 피버 모드 활성화
 * 
 * @param {number} currentCombo - 현재 콤보 수
 * @returns {boolean} 진입 성공 여부
 */
export function enterFeverMode(currentCombo, options = {}) {
  // 이미 활성화 상태면 무시
  if (feverState.active) {
    return false;
  }
  
  // 콤보 기준 미달 시 진입 불가
  if (currentCombo < feverState.comboThreshold) {
    return false;
  }
  
  // 피버 모드 활성화
  feverState.active = true;
  feverState.timer = feverState.maxDuration;
  feverState.bgmSpeed = FEVER_CONFIG.BGM_SPEED;
  feverState.enteredAt = performance.now();
  feverState.totalExtended = 0;
  feverState.type = FEVER_TYPE_META[options.type] ? options.type : FEVER_TYPES.FORGE;
  
  // 콜백 호출
  if (callbacks.onEnter) {
    callbacks.onEnter({
      combo: currentCombo,
      duration: feverState.maxDuration,
      multiplier: feverState.multiplier,
      type: feverState.type,
      label: FEVER_TYPE_META[feverState.type].label,
    });
  }
  
  console.log(`[FeverMode] 피버 모드 진입! 콤보: ${currentCombo}, 지속시간: ${feverState.maxDuration}초`);
  
  return true;
}

/**
 * 피버 모드 종료
 * [v2.1.0] 피버 모드 수동 종료 (콤보 끊김 등)
 * 
 * @param {string} reason - 종료 사유 ('timeout' | 'combo_break' | 'manual')
 */
export function exitFeverMode(reason = 'manual') {
  if (!feverState.active) {
    return;
  }
  
  const duration = (performance.now() - feverState.enteredAt) / 1000;
  
  feverState.active = false;
  feverState.timer = 0;
  feverState.bgmSpeed = FEVER_CONFIG.BGM_NORMAL;
  
  // 콜백 호출
  if (callbacks.onExit) {
    callbacks.onExit({
      reason,
      duration,
      totalExtended: feverState.totalExtended,
      type: feverState.type,
    });
  }
  
  console.log(`[FeverMode] 피버 모드 종료. 사유: ${reason}, 총 지속: ${duration.toFixed(1)}초`);
}

/**
 * 피버 모드 업데이트
 * [v2.1.0] 매 프레임 호출하여 타이머 감소
 * 
 * @param {number} dt - 델타 시간 (초)
 * @returns {boolean} 여전히 활성화 상태인지
 */
export function updateFeverMode(dt) {
  if (!feverState.active) {
    return false;
  }
  
  // 타이머 감소
  feverState.timer -= dt;
  
  // 시간 초과 시 종료
  if (feverState.timer <= 0) {
    exitFeverMode('timeout');
    return false;
  }
  
  return true;
}

/**
 * 피버 모드 연장
 * [v2.1.0] 라인 클리어 시 지속 시간 연장
 * 
 * @param {number} linesCleared - 클리어한 라인 수
 * @returns {number} 연장된 시간
 */
export function extendFeverDuration(linesCleared) {
  if (!feverState.active || linesCleared <= 0) {
    return 0;
  }
  
  // 클리어 라인 수에 비례하여 연장 (1줄 = 2초)
  const extendAmount = FEVER_CONFIG.EXTEND_DURATION * linesCleared;
  feverState.timer = Math.min(
    feverState.timer + extendAmount,
    feverState.maxDuration * 1.35  // [v3.15.0] 최대 1.35배까지만 연장 가능
  );
  
  feverState.totalExtended += extendAmount;
  
  // 콜백 호출
  if (callbacks.onExtend) {
    callbacks.onExtend({
      extendAmount,
      newTimer: feverState.timer,
      linesCleared,
    });
  }
  
  return extendAmount;
}

/**
 * 피버 모드 활성화 여부 확인
 * [v2.1.0] 현재 피버 상태 반환
 * 
 * @returns {boolean} 활성화 여부
 */
export function isFeverModeActive() {
  return feverState.active;
}

/**
 * 피버 공격 배수 반환
 * [v2.1.0] 현재 적용할 공격 배수 (1.5배 또는 1.0배)
 * 
 * @returns {number} 공격 배수
 */
export function getFeverMultiplier() {
  return feverState.active ? feverState.multiplier : 1.0;
}

/**
 * 피버 BGM 속도 반환
 * [v2.1.0] 현재 BGM 재생 속도 (1.3배 또는 1.0배)
 * 
 * @returns {number} BGM 재생 속도
 */
export function getFeverBGMSpeed() {
  return feverState.active ? feverState.bgmSpeed : FEVER_CONFIG.BGM_NORMAL;
}

/**
 * 피버 남은 시간 반환
 * [v2.1.0] 현재 피버 지속 시간
 * 
 * @returns {number} 남은 시간 (초)
 */
export function getFeverRemainingTime() {
  return feverState.active ? feverState.timer : 0;
}

/**
 * 피버 진행률 반환
 * [v2.1.0] 0.0 ~ 1.0 사이의 진행률
 * 
 * @returns {number} 진행률
 */
export function getFeverProgress() {
  if (!feverState.active) {
    return 0;
  }
  return 1 - (feverState.timer / feverState.maxDuration);
}

/**
 * 피버 상태 정보 반환
 * [v2.1.0] UI 표시용 상태 정보
 * 
 * @returns {Object} 피버 상태 객체
 */
export function getFeverStatus() {
  return {
    active: feverState.active,
    remainingTime: feverState.timer,
    maxDuration: feverState.maxDuration,
    multiplier: feverState.multiplier,
    progress: getFeverProgress(),
    type: feverState.type,
    label: FEVER_TYPE_META[feverState.type]?.label || "FORGE",
    description: FEVER_TYPE_META[feverState.type]?.description || "",
  };
}

/**
 * 피버 콜백 등록
 * [v2.1.0] 이벤트 핸들러 설정
 * 
 * @param {string} event - 이벤트 이름 ('onEnter' | 'onExit' | 'onExtend')
 * @param {Function} callback - 콜백 함수
 */
export function setFeverCallback(event, callback) {
  if (callbacks.hasOwnProperty(event)) {
    callbacks[event] = callback;
  }
}

/**
 * 피버 모드 리셋
 * [v2.1.0] 게임 재시작 등에서 초기화
 */
export function resetFeverMode() {
  feverState.active = false;
  feverState.timer = 0;
  feverState.bgmSpeed = FEVER_CONFIG.BGM_NORMAL;
  feverState.enteredAt = 0;
  feverState.totalExtended = 0;
  feverState.type = FEVER_TYPES.FORGE;
}

/**
 * 콤보 기준값 설정
 * [v2.1.0] 피버 진입 콤보 수 조정 (테스트용)
 * 
 * @param {number} threshold - 새로운 콤보 기준
 */
export function setFeverThreshold(threshold) {
  feverState.comboThreshold = Math.max(1, threshold);
}

/**
 * 기본 설정값 반환
 * [v2.1.0] 상수 값 참조용
 * 
 * @returns {Object} 설정 객체
 */
export function getFeverConfig() {
  return { ...FEVER_CONFIG };
}

export function chooseFeverType(meta = {}) {
  if ((meta.stackHeight || 0) >= 12) {
    return FEVER_TYPES.GUARD;
  }
  if (meta.specialReady) {
    return FEVER_TYPES.SCAN;
  }
  if (meta.tSpin || (meta.cleared || 0) >= 3 || meta.backToBack) {
    return FEVER_TYPES.FORGE;
  }
  return FEVER_TYPES.SURGE;
}

export function getFeverTypeMeta(type) {
  return FEVER_TYPE_META[type] || FEVER_TYPE_META[FEVER_TYPES.FORGE];
}
