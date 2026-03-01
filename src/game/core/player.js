/*
 * [v3.14.0] 플레이어 상태 관리
 * 
 * 작성일: 2026-02-28
 * 변경사항:
 *   - 콤보, 백투백, 필살기 게이지, 라인 카운터 추가, 스폰 디버그 로그 정리
 *   - Input Fidelity 2.0용 입력 버퍼/락 리셋 카운터 상태 추가
 *   - [v3.9.0] Rule-Break Boss 상태 필드 추가
 *   - [v3.11.0] 피버 변형 상태 필드 추가
 *   - [v3.12.0] Neon Shift/Residue 레이어 상태 추가
 *   - [v3.14.0] 레이어 카운터/Shift 종료/임시 아이템 부스트 상태 추가
 */

import { PIECES } from "./pieces.js";
import { spawnItemPiece } from "./items.js";
import { BOARD_WIDTH, GAUGE_MAX, GAUGE_PER_LINE, GAUGE_PER_TSPIN, GAUGE_PER_PERFECT_CLEAR, SCORE_TABLE, INPUT_PRESETS } from "./constants.js";

/**
 * 새로운 플레이어 상태 생성
 * @param {string} id - 플레이어 ID ('player' | 'ai')
 * @param {BagRandom} bag - 블록 가방
 * @returns {Object} 플레이어 상태 객체
 */
export function createPlayerState(id, bag) {
  const state = {
    // 기본 정보
    id,
    board: null,  // 외부에서 Board 인스턴스 연결
    
    // 블록 큐 (다음 5개 미리 생성)
    queue: [bag.next(), bag.next(), bag.next(), bag.next(), bag.next()],
    
    // 홀드 시스템
    hold: null,
    holdLocked: false,  // 현재 블록에서 이미 홀드했는지
    
    // 현재 조각 상태
    piece: null,
    currentItem: null,  // 현재 조각의 아이템 정보 { itemType, itemPos } | null
    rot: 0,
    x: 3,
    y: -1,
    
    // 점수 및 레벨
    score: 0,
    lines: 0,        // 총 제거한 라인
    linesForLevel: 0, // 현재 레벨에서 제거한 라인
    level: 1,
    
    // 드롭 관련
    dropAcc: 0,      // 낙하 누적 (속도 계산용)
    lockAcc: 0,      // 고정 지연 누적
    softDropAcc: 0,  // 소프트 드롭 거리
    hardDropUsed: false, // 하드드롭 사용 여부
    lockResetCount: 0,   // [v3.6.0] 현재 조각의 락 리셋 횟수
    inputBuffer: null,   // [v3.6.0] 스폰 직후 적용할 입력 버퍼
    inputBufferUntil: 0, // [v3.6.0] 입력 버퍼 만료 시각
    inputTuning: { ...INPUT_PRESETS.standard }, // [v3.6.0] 현재 입력 튜닝
    
    // 게임 상태
    topOut: false,
    gravityJoltUntil: 0,  // 중력 급격 변화 지속 시간
    inputDelayUntil: 0,   // 입력 지연 지속 시간
    corruptNextUntil: 0,  // 넥스트 커럽트 지속 시간
    darknessUntil: 0,     // 어둠 효과 지속 시간
    mirrorMoveUntil: 0,   // 좌우 반전 지속 시간
    holdLockUntil: 0,     // [v3.9.0] 홀드 봉인 지속 시간
    ghostHiddenUntil: 0,  // [v3.9.0] 고스트 블록 제거 지속 시간
    rotationTaxUntil: 0,  // [v3.9.0] 회전 대가 지속 시간
    gaugeLeechUntil: 0,   // [v3.9.0] 게이지 흡수 경고 지속 시간
    nextScrambleUntil: 0, // [v3.9.0] 넥스트 교란 지속 시간
    feverType: "forge",   // [v3.11.0] 현재 피버 타입
    feverGuardCharges: 0, // [v3.11.0] 가비지 자동 무효화 횟수
    nextPreviewCount: 3,  // [v3.11.0] 현재 공개 중인 NEXT 수
    itemSpawnMultiplier: 1, // [v3.11.0] 아이템 출현 배수
    neonShiftUntil: 0,    // [v3.12.0] 네온 레이어 각성 지속 시간
    neonShiftSource: "",  // [v3.12.0] 최근 Shift 발동 원인
    neonResidueRows: [],  // [v3.12.0] 네온 잔상 행 목록
    neonResonanceUntil: 0, // [v3.13.0] 레이어 공명 내부 쿨다운
    neonCounterCooldownUntil: 0, // [v3.14.0] 레이어 카운터 내부 쿨다운
    neonItemBoostUntil: 0, // [v3.14.0] Surge Echo 이후 임시 아이템 부스트 지속 시간
    layerCounterUntil: 0,  // [v3.14.0] 최근 레이어 카운터 상태 칩 지속 시간
    layerCounterLabel: "", // [v3.14.0] 최근 레이어 카운터 이름
    neonShiftWasActive: false, // [v3.14.0] Shift 종료 이벤트 감지를 위한 이전 프레임 상태
    stackHeight: 0,       // 현재 스택 높이
    bossHp: 100,          // 보스 HP UI용 값
    bossModeActive: false,
    
    // [v2.0.0] 콤보 및 백투백 시스템
    combo: 0,              // 현재 콤보 수
    maxCombo: 0,          // 최대 콤보 기록
    lastClearWasSpecial: false, // 마지막 클리어가 특수 클리어였는지 (T-스핀, 테트리스)
    backToBack: false,    // 현재 백투백 상태
    
    // [v2.0.0] 필살기 게이지
    specialGauge: 0,      // 0 ~ 100
    specialReady: false,  // 게이지 MAX 여부
    
    // [v2.0.0] T-스핀 관련
    lastMoveWasTSpin: false,
    tSpinType: null,      // 'mini' | 'single' | 'double' | 'triple' | null
    
    // [v2.0.0] 게임 통계
    stats: {
      singles: 0,
      doubles: 0,
      triples: 0,
      tetrises: 0,
      tSpins: 0,
      perfectClears: 0,
    },
  };
  
  spawn(state, bag);
  return state;
}

/**
 * 새 블록 스폰
 * @param {Object} state - 플레이어 상태
 * @param {BagRandom} bag - 블록 가방
 */
export function spawn(state, bag) {
  // 큐에서 다음 블록 꺼내고 새로 채우기
  state.piece = state.queue.shift();
  state.queue.push(bag.next());
  if (state.corruptNextUntil > performance.now()) {
    const badPieces = ["S", "Z", "L", "J"];
    state.piece = badPieces[Math.floor(Math.random() * badPieces.length)];
    state.queue = state.queue.map((piece, index) => {
      if (index >= 3) return piece;
      return badPieces[Math.floor(Math.random() * badPieces.length)];
    });
  }
  const spawnedItem = spawnItemPiece(state.piece, state.itemSpawnMultiplier || 1);
  state.currentItem = spawnedItem
    ? { itemType: spawnedItem.itemType, itemPos: spawnedItem.itemPos }
    : null;

  // 초기화
  state.rot = 0;
  state.y = -1;
  state.holdLocked = false;
  state.softDropAcc = 0;
  state.hardDropUsed = false;
  state.lastMoveWasTSpin = false;
  state.tSpinType = null;
  state.lockResetCount = 0;
  // [v2.0.1-fix] lockAcc와 dropAcc 초기화 추가
  state.lockAcc = 0;
  state.dropAcc = 0;

  // 블록 중앙 배치
  const shape = PIECES[state.piece].r[0];
  state.x = Math.floor((BOARD_WIDTH - shape[0].length) / 2);
}

/**
 * 홀드 스왑
 * @param {Object} state - 플레이어 상태
 * @param {BagRandom} bag - 블록 가방
 * @returns {boolean} 스왑 성공 여부
 */
export function holdSwap(state, bag) {
  // 이미 홀드했으면 무시
  if (state.holdLocked) return false;
  if ((state.holdLockUntil || 0) > performance.now()) return false;
  
  const current = state.piece;
  
  if (!state.hold) {
    // 홀드가 비어있으면 현재 블록을 홀드하고 새로 스폰
    state.hold = current;
    spawn(state, bag);
  } else {
    // 홀드와 현재 블록 교환
    state.piece = state.hold;
    state.hold = current;
    const swappedItem = spawnItemPiece(state.piece, state.itemSpawnMultiplier || 1);
    state.currentItem = swappedItem
      ? { itemType: swappedItem.itemType, itemPos: swappedItem.itemPos }
      : null;
    state.rot = 0;
    state.y = -1;
    state.x = Math.floor((BOARD_WIDTH - PIECES[state.piece].r[0][0].length) / 2);
    state.softDropAcc = 0;
    state.hardDropUsed = false;
    state.lastMoveWasTSpin = false;
    state.tSpinType = null;
    state.lockResetCount = 0;
    state.lockAcc = 0;
    state.dropAcc = 0;
  }
  
  state.holdLocked = true;
  return true;
}

/**
 * 필살기 게이지 증가
 * @param {Object} state - 플레이어 상태
 * @param {number} lines - 클리어한 라인 수
 * @param {string|null} tSpinType - T-스핀 타입
 * @param {boolean} isPerfectClear - 퍼펙트 클리어 여부
 */
export function addGauge(state, lines, tSpinType, isPerfectClear) {
  let gain = 0;
  
  // 라인 클리어 기본 게이지
  gain += lines * GAUGE_PER_LINE;
  
  // T-스핀 보너스
  if (tSpinType) {
    gain += GAUGE_PER_TSPIN;
  }
  
  // 퍼펙트 클리어 보너스
  if (isPerfectClear) {
    gain += GAUGE_PER_PERFECT_CLEAR;
  }
  
  // 게이지 추가
  state.specialGauge = Math.min(GAUGE_MAX, state.specialGauge + gain);
  
  // MAX 체크
  if (state.specialGauge >= GAUGE_MAX) {
    state.specialReady = true;
  }
}

/**
 * 필살기 사용
 * @param {Object} state - 플레이어 상태
 * @returns {boolean} 사용 성공 여부
 */
export function useSpecial(state) {
  if (!state.specialReady) return false;
  
  state.specialGauge = 0;
  state.specialReady = false;
  return true;
}

/**
 * 콤보 업데이트
 * @param {Object} state - 플레이어 상태
 * @param {number} linesCleared - 클리어한 라인 수 (0이면 콤보 리셋)
 */
export function updateCombo(state, linesCleared) {
  if (linesCleared > 0) {
    state.combo++;
    state.maxCombo = Math.max(state.maxCombo, state.combo);
  } else {
    state.combo = 0;
  }
}

/**
 * 백투백 체크 및 업데이트
 * @param {Object} state - 플레이어 상태
 * @param {number} lines - 클리어한 라인 수
 * @param {string|null} tSpinType - T-스핀 타입
 * @returns {boolean} 백투백 적용 여부
 */
export function checkBackToBack(state, lines, tSpinType) {
  const isSpecial = lines >= 4 || tSpinType;
  
  if (isSpecial && state.lastClearWasSpecial) {
    state.backToBack = true;
  } else {
    state.backToBack = false;
  }
  
  state.lastClearWasSpecial = isSpecial;
  return state.backToBack;
}

/**
 * 점수 계산
 * @param {Object} state - 플레이어 상태
 * @param {number} lines - 클리어한 라인 수
 * @param {string|null} tSpinType - T-스핀 타입
 * @param {boolean} isBackToBack - 백투백 여부
 * @param {boolean} isPerfectClear - 퍼펙트 클리어 여부
 * @returns {number} 획득 점수
 */
export function calculateScore(state, lines, tSpinType, isBackToBack, isPerfectClear) {
  let baseScore = 0;
  
  // 기본 점수
  if (tSpinType) {
    switch (tSpinType) {
      case 'mini': baseScore = SCORE_TABLE.TSPIN_MINI; break;
      case 'single': baseScore = SCORE_TABLE.TSPIN_SINGLE; break;
      case 'double': baseScore = SCORE_TABLE.TSPIN_DOUBLE; break;
      case 'triple': baseScore = SCORE_TABLE.TSPIN_TRIPLE; break;
    }
  } else {
    switch (lines) {
      case 1: baseScore = SCORE_TABLE.SINGLE; break;
      case 2: baseScore = SCORE_TABLE.DOUBLE; break;
      case 3: baseScore = SCORE_TABLE.TRIPLE; break;
      case 4: baseScore = SCORE_TABLE.TETRIS; break;
    }
  }
  
  // 콤보 보너스
  const comboBonus = baseScore * (SCORE_TABLE.COMBO_MULTIPLIER * state.combo);
  
  // 백투백 보너스
  const backToBackMultiplier = isBackToBack ? SCORE_TABLE.BACK_TO_BACK_MULTIPLIER : 1;
  
  // 퍼펙트 클리어 보너스
  const perfectClearBonus = isPerfectClear ? SCORE_TABLE.PERFECT_CLEAR : 0;
  
  return Math.floor((baseScore + comboBonus) * backToBackMultiplier + perfectClearBonus);
}

/**
 * 통계 업데이트
 * @param {Object} state - 플레이어 상태
 * @param {number} lines - 클리어한 라인 수
 * @param {string|null} tSpinType - T-스핀 타입
 * @param {boolean} isPerfectClear - 퍼펙트 클리어 여부
 */
export function updateStats(state, lines, tSpinType, isPerfectClear) {
  if (isPerfectClear) state.stats.perfectClears++;
  if (tSpinType) state.stats.tSpins++;
  
  switch (lines) {
    case 1: state.stats.singles++; break;
    case 2: state.stats.doubles++; break;
    case 3: state.stats.triples++; break;
    case 4: state.stats.tetrises++; break;
  }
}
