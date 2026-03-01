/*
 * [v3.13.0] 배틀 공격 시스템
 *
 * 작성일: 2026-02-28
 * 변경사항:
 *   - 새로운 공격 패턴 추가 (Darkness, MirrorMove)
 *   - [v6.0.0] 피버 모드 공격 배수 기능 추가
 *   - [v3.9.0] Rule-Break Boss 규칙 공격 타입 추가
 *   - [v3.10.0] 패턴 공격 태그 변환 및 신규 공격 타입 추가
 *   - [v3.13.0] 패턴 공격 강도 재조정
 */

import { garbageForLines } from "../core/constants.js";

const PATTERN_ATTACK_CONFIG = {
  pierceBarrage: {
    type: "PierceBarrage",
    strength(baseStrength) {
      return Math.max(2, baseStrength);
    },
  },
  drillHex: {
    type: "DrillHex",
    strength(baseStrength) {
      return Math.max(1, baseStrength);
    },
  },
  wavePush: {
    type: "WavePush",
    strength(baseStrength) {
      return Math.max(1, baseStrength);
    },
  },
  nullBurst: {
    type: "NullBurst",
    strength(baseStrength) {
      return Math.max(2, baseStrength);
    },
  },
};

// [v6.0.0] 피버 모드 공격 배수 상태
let feverMultiplier = 1.0;
let feverActive = false;

/**
 * 공격 생성
 * @param {number} lines - 클리어한 라인 수
 * @param {Function} rng - 랜덤 함수
 * @param {string|null} tSpinType - T-스핀 타입
 * @param {boolean} isBackToBack - 백투백 여부
 * @returns {Object} 공격 객체
 */
export function makeAttack(lines, rng, tSpinType = null, isBackToBack = false) {
  // 기본: 가비지 푸시
  let strength = garbageForLines(lines, tSpinType, isBackToBack);
  
  // [v6.0.0] 피버 모드 배수 적용
  if (feverActive && feverMultiplier > 1.0) {
    strength = applyFeverMultiplier(strength);
  }
  
  return {
    type: "GarbagePush",
    strength,
    seed: rng(),
    delayMs: 0,  // [v2.0.2-fix] 가비지 전송 딜레이 (0 = 즉시)
    timestamp: performance.now()
  };
}

/**
/**
 * 특수 공격 생성
 * @param {string} type - 공격 종류
 * @param {number} strength - 강도
 * @param {Function} rng - 랜덤 함수
 * @returns {Object} 공격 객체
 */
export function makeSpecialAttack(type, strength, rng) {
  const validTypes = [
    "GarbagePush",
    "CorruptNext",
    "GravityJolt",
    "StackShake",
    "Darkness",
    "MirrorMove",
    "HoldLock",
    "GhostOut",
    "RotationTax",
    "GaugeLeech",
    "NextScramble",
    "PierceBarrage",
    "DrillHex",
    "WavePush",
    "NullBurst"
  ];
  
  if (!validTypes.includes(type)) {
    type = "GarbagePush";
  }
  
  // [v6.0.0] 피버 모드 배수 적용 (GarbagePush 타입에만)
  let finalStrength = Math.max(1, strength);
  if (type === "GarbagePush" && feverActive && feverMultiplier > 1.0) {
    finalStrength = applyFeverMultiplier(finalStrength);
  }
  
  return {
    type,
    strength: finalStrength,
    seed: rng(),
    timestamp: performance.now()
  };
}

/**
 * 패턴 공격 생성
 * [v3.10.0] 라인 패턴 태그를 특수 공격으로 변환한다.
 *
 * @param {string} tag - 패턴 태그
 * @param {number} baseStrength - 기본 공격 강도
 * @param {Function} rng - 랜덤 함수
 * @returns {Object|null} 공격 객체
 */
export function makePatternAttack(tag, baseStrength, rng) {
  const pattern = PATTERN_ATTACK_CONFIG[tag];
  if (!pattern) return null;
  return makeSpecialAttack(pattern.type, pattern.strength(Math.max(1, baseStrength)), rng);
}

// ============================================================================
// [v6.0.0] 피버 모드 공격 배수 시스템 - Feature 6
// ============================================================================

/**
 * 피버 모드 공격 배수 적용
 * [v6.0.0] 피버 모드 중 가비지 라인 수에 1.5배 배수 적용
 *
 * 계산 규칙:
 * - 기본 배수: 1.5x
 * - 소수점 결과는 올림 처리 (예: 3줄 → 5줄)
 * - 최소 1줄 보장
 *
 * @param {number} lines - 원본 가비지 라인 수
 * @returns {number} 배수 적용된 라인 수 (올림)
 */
function applyFeverMultiplier(lines) {
  if (!feverActive || feverMultiplier <= 1.0) {
    return lines;
  }
  
  // 배수 적용 및 올림
  const multiplied = lines * feverMultiplier;
  const result = Math.ceil(multiplied);
  
  console.log(`[FeverAttack] 공격 배수 적용: ${lines}줄 × ${feverMultiplier}x → ${result}줄`);
  
  return Math.max(1, result);
}

/**
 * 피버 공격 배수 설정
 * [v6.0.0] 피버 진입/종료 시 배수 값 설정
 *
 * @param {number} multiplier - 공격 배수 (기본 1.0, 피버 1.5)
 *   - 1.0: 기본 배수 (피버 아님)
 *   - 1.5: 피버 모드 배수
 *
 * 사용 예시:
 *   // 피버 진입 시
 *   setFeverAttackMultiplier(1.5);
 *
 *   // 피버 종료 시
 *   setFeverAttackMultiplier(1.0);
 */
export function setFeverAttackMultiplier(multiplier) {
  const oldMultiplier = feverMultiplier;
  feverMultiplier = Math.max(1.0, multiplier);
  feverActive = feverMultiplier > 1.0;
  
  console.log(`[FeverAttack] 배수 설정: ${oldMultiplier}x → ${feverMultiplier}x, 활성화: ${feverActive}`);
}

/**
 * 피버 공격 배수 반환
 * [v6.0.0] 현재 적용 중인 공격 배수 확인
 *
 * @returns {number} 현재 공격 배수 (1.0 또는 1.5)
 *
 * 사용 예시:
 *   const currentMultiplier = getFeverAttackMultiplier();
 *   console.log(`현재 공격 배수: ${currentMultiplier}x`);
 */
export function getFeverAttackMultiplier() {
  return feverMultiplier;
}

/**
 * 피버 공격 배수 초기화
 * [v6.0.0] 게임 종료/리셋 시 배수 초기화
 *
 * 사용 예시:
 *   // 게임 오버 시
 *   resetFeverAttackMultiplier();
 */
export function resetFeverAttackMultiplier() {
  const oldMultiplier = feverMultiplier;
  feverMultiplier = 1.0;
  feverActive = false;
  
  console.log(`[FeverAttack] 배수 초기화: ${oldMultiplier}x → 1.0x`);
}

/**
 * 피버 모드 활성화 여부 확인
 * [v6.0.0] 현재 피버 공격 배수가 적용 중인지 확인
 *
 * @returns {boolean} 피버 모드 활성화 여부
 *
 * 사용 예시:
 *   if (isFeverAttackActive()) {
 *     // 피버 중 특수 UI 표시
 *   }
 */
export function isFeverAttackActive() {
  return feverActive;
}

/**
 * 점수 계산 (구버전 호환성)
 * @param {number} lines - 라인 수
 * @returns {number} 점수
 */
export function scoreForLines(lines) {
  switch (lines) {
    case 1: return 100;
    case 2: return 300;
    case 3: return 500;
    case 4: return 800;
    default: return 0;
  }
}

/**
 * 공격 이름 한글화
 * @param {string} type - 공격 타입
 * @returns {string} 한글 이름
 */
export function getAttackName(type) {
  const names = {
    "GarbagePush": "가비지 푸시",
    "CorruptNext": "넥스트 커럽트",
    "GravityJolt": "중력 급변",
    "StackShake": "스택 쉐이크",
    "Darkness": "어둠의 장막",
    "MirrorMove": "미러 무브",
    "HoldLock": "홀드 봉인",
    "GhostOut": "고스트 제거",
    "RotationTax": "회전 대가",
    "GaugeLeech": "게이지 흡수",
    "NextScramble": "넥스트 교란",
    "PierceBarrage": "관통 포격",
    "DrillHex": "드릴 헥스",
    "WavePush": "웨이브 푸시",
    "NullBurst": "널 버스트"
  };
  return names[type] || type;
}

/**
 * 공격 설명
 * @param {string} type - 공격 타입
 * @returns {string} 설명
 */
export function getAttackDescription(type) {
  const descriptions = {
    "GarbagePush": "상대방 보드에 쓰레기 라인을 추가합니다",
    "CorruptNext": "상대의 다음 블록을 불리한 블록으로 바꿉니다",
    "GravityJolt": "상대의 블록이 급격히 빨리 내려갑니다",
    "StackShake": "상대의 보드를 흔들어 조작을 방해합니다",
    "Darkness": "상대의 보드를 일시적으로 가립니다",
    "MirrorMove": "상대의 좌우 조작을 반전시킵니다",
    "HoldLock": "상대의 홀드 기능을 잠시 봉인합니다",
    "GhostOut": "상대의 고스트 블록을 잠시 제거합니다",
    "RotationTax": "상대가 회전할 때마다 스킬 게이지를 흡수합니다",
    "GaugeLeech": "상대의 현재 스킬 게이지를 즉시 흡수합니다",
    "NextScramble": "상대의 넥스트 큐를 뒤섞어 읽기 어렵게 만듭니다",
    "PierceBarrage": "중앙선을 파고드는 강한 가비지 포격을 보냅니다",
    "DrillHex": "관통형 넥스트 교란 디버프를 겁니다",
    "WavePush": "중력 급변과 입력 흔들림을 함께 겁니다",
    "NullBurst": "강한 가비지와 게이지 압박을 동시에 보냅니다"
  };
  return descriptions[type] || "";
}
