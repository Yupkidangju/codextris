/*
 * [v3.14.1] 아이템 시스템 (Item System)
 * 
 * 작성일: 2026-02-28
 * 변경사항: 
 *   - 3종류 아이템 구현 (Bomb, Star, Shield)
 *   - 아이템 블록 스폰 로직 (5% 확률)
 *   - 아이템 효과 처리 및 연쇄 반응 지원
 *   - [v3.11.0] 피버 SURGE 타입용 아이템 확률 배수 지원
 *   - [v3.14.1] 아이템 블록 글로우 대비를 15% 상향해 일반 블록과 차이를 더 명확히 표시
 */

import { BOARD_WIDTH, BOARD_HEIGHT } from "./constants.js";

// ============================================================================
// 아이템 상수 정의
// ============================================================================

/**
 * 아이템 타입 열거형
 * [v2.1.0] 3종류 아이템 타입 정의
 */
export const ITEM_TYPES = {
  BOMB: "bomb",      // 폭탄: 3x3 영역 파괴
  STAR: "star",      // 별: 한 줄 즉시 클리어 + 가비지 보너스
  SHIELD: "shield",  // 실드: 다음 가비지 공격 차단
};

/**
 * 아이템 스폰 확률 (5%)
 * [v2.1.0] 블록 생성 시 아이템 등장 확률
 */
export const ITEM_SPAWN_CHANCE = 0.05;

/**
 * 아이템 시각적 설정
 * [v2.1.0] 각 아이템별 색상 및 효과 설정
 */
export const ITEM_VISUALS = {
  [ITEM_TYPES.BOMB]: {
    color: "#ff4444",        // 빨간색
    glowColor: "#ff0000",    // 글로우 색상
    icon: "💣",              // 아이콘
    pulseSpeed: 3,           // 펄스 속도
  },
  [ITEM_TYPES.STAR]: {
    color: "#ffdd00",        // 노란색
    glowColor: "#ffaa00",    // 글로우 색상
    icon: "⭐",              // 아이콘
    sparkleRate: 0.3,        // 반짝임 확률
  },
  [ITEM_TYPES.SHIELD]: {
    color: "#4488ff",        // 파란색
    glowColor: "#00aaff",    // 글로우 색상
    icon: "🛡️",              // 아이콘
    auraSize: 8,             // 보호막 오라 크기
  },
};

// ============================================================================
// 아이템 상태 관리
// ============================================================================

/**
 * 아이템 시스템 클래스
 * [v2.1.0] 플레이어별 아이템 상태 및 효과 관리
 */
export class ItemSystem {
  constructor() {
    // 실드 상태 (다음 가비지 공격 차단)
    this.shieldActive = false;
    
    // 아이템 사용 통계
    this.stats = {
      bombsUsed: 0,
      starsUsed: 0,
      shieldsUsed: 0,
      garbageBlocked: 0,
    };
    
    // 아이템 블록 위치 추적 (보드 기준)
    this.itemBlocks = new Map(); // key: "x,y", value: itemType
  }

  /**
   * 시스템 초기화
   * [v2.1.0] 게임 시작/리셋 시 호출
   */
  reset() {
    this.shieldActive = false;
    this.stats = {
      bombsUsed: 0,
      starsUsed: 0,
      shieldsUsed: 0,
      garbageBlocked: 0,
    };
    this.itemBlocks.clear();
  }

  /**
   * 아이템 블록 위치 등록
   * [v2.1.0] 블록이 보드에 고정될 때 호출
   * @param {number} x - X 좌표
   * @param {number} y - Y 좌표
   * @param {string} itemType - 아이템 타입
   */
  registerItemBlock(x, y, itemType) {
    this.itemBlocks.set(`${x},${y}`, itemType);
  }

  /**
   * 아이템 블록 위치 제거
   * [v2.1.0] 블록이 제거될 때 호출
   * @param {number} x - X 좌표
   * @param {number} y - Y 좌표
   */
  unregisterItemBlock(x, y) {
    this.itemBlocks.delete(`${x},${y}`);
  }

  /**
   * 위치의 아이템 타입 확인
   * [v2.1.0] 해당 좌표에 아이템 블록이 있는지 확인
   * @param {number} x - X 좌표
   * @param {number} y - Y 좌표
   * @returns {string|null} 아이템 타입 또는 null
   */
  getItemAt(x, y) {
    return this.itemBlocks.get(`${x},${y}`) || null;
  }

  /**
   * 실드 활성화 상태 확인
   * [v2.1.0] 가비지 공격 차단 가능 여부 확인
   * @returns {boolean} 실드 활성화 여부
   */
  isShieldActive() {
    return this.shieldActive;
  }

  /**
   * 실드 활성화
   * [v2.1.0] 실드 아이템 사용 시 호출
   */
  activateShield() {
    this.shieldActive = true;
    this.stats.shieldsUsed++;
  }

  /**
   * 실드 소모 (가비지 공격 차단)
   * [v2.1.0] 가비지 공격이 실드에 막힐 때 호출
   * @returns {boolean} 실드가 소모되었으면 true
   */
  consumeShield() {
    if (this.shieldActive) {
      this.shieldActive = false;
      this.stats.garbageBlocked++;
      return true;
    }
    return false;
  }
}

// ============================================================================
// 아이템 생성 함수
// ============================================================================

/**
 * 랜덤 아이템 타입 생성
 * [v2.1.0] 3종류 아이템 중 하나를 랜덤 선택
 * [v3.11.0] 피버 SURGE 타입에서 배수를 적용할 수 있게 확률 배수 인자를 지원한다.
 *
 * @param {number} chanceMultiplier - 아이템 확률 배수
 * @returns {string|null} 아이템 타입 또는 null (스폰 실패)
 */
export function spawnRandomItemType(chanceMultiplier = 1) {
  // 5% 확률로 아이템 스폰 실패 시 null 반환
  const spawnChance = Math.min(0.5, ITEM_SPAWN_CHANCE * Math.max(1, chanceMultiplier));
  if (Math.random() > spawnChance) {
    return null;
  }

  // 3종류 아이템 중 랜덤 선택
  const types = [ITEM_TYPES.BOMB, ITEM_TYPES.STAR, ITEM_TYPES.SHIELD];
  return types[Math.floor(Math.random() * types.length)];
}

/**
 * 아이템 블록이 포함된 조각 생성
 * [v2.1.0] 5% 확률로 랜덤 아이템 블록이 포함된 조각 반환
 * @param {string} pieceKey - 블록 종류 (I, O, T, S, Z, J, L)
 * @param {number} chanceMultiplier - 아이템 확률 배수
 * @returns {Object|null} 아이템 정보 객체 또는 null
 *   - pieceKey: 블록 종류
 *   - itemType: 아이템 타입
 *   - itemPos: {x, y} 아이템 위치 (조각 내 로컬 좌표)
 */
export function spawnItemPiece(pieceKey, chanceMultiplier = 1) {
  const itemType = spawnRandomItemType(chanceMultiplier);
  
  if (!itemType) {
    return null;
  }

  // 조각의 회전 상태 0 기준으로 랜덤 위치 선택
  // 각 조각별 미노 개수와 형태가 다르므로, 회전 0 상태 기준으로 선택
  const pieceShapes = {
    I: { w: 4, h: 1, minos: [[0,0], [1,0], [2,0], [3,0]] },
    O: { w: 2, h: 2, minos: [[0,0], [1,0], [0,1], [1,1]] },
    T: { w: 3, h: 2, minos: [[1,0], [0,1], [1,1], [2,1]] },
    S: { w: 3, h: 2, minos: [[1,0], [2,0], [0,1], [1,1]] },
    Z: { w: 3, h: 2, minos: [[0,0], [1,0], [1,1], [2,1]] },
    J: { w: 3, h: 2, minos: [[0,0], [0,1], [1,1], [2,1]] },
    L: { w: 3, h: 2, minos: [[2,0], [0,1], [1,1], [2,1]] },
  };

  const shape = pieceShapes[pieceKey];
  const randomMinos = shape.minos[Math.floor(Math.random() * shape.minos.length)];

  return {
    pieceKey,
    itemType,
    itemPos: { x: randomMinos[0], y: randomMinos[1] },
  };
}

// ============================================================================
// 아이템 확인 함수
// ============================================================================

/**
 * 조각이 아이템 블록을 포함하는지 확인
 * [v2.1.0] spawnItemPiece 결과로 생성된 객체인지 확인
 * @param {Object|null} piece - 조각 객체 또는 spawnItemPiece 결과
 * @returns {boolean} 아이템 블록 포함 여부
 */
export function hasItemBlock(piece) {
  return piece !== null && 
         typeof piece === "object" && 
         "itemType" in piece && 
         "itemPos" in piece;
}

/**
 * 블록 데이터에서 아이템 타입 추출
 * [v2.1.0] 보드 그리드에 저장된 아이템 블록 값에서 타입 추출
 * @param {string} blockValue - 보드 그리드에 저장된 값 (예: "I:bomb", "T:star")
 * @returns {string|null} 아이템 타입 또는 null
 */
export function getItemType(blockValue) {
  if (!blockValue || typeof blockValue !== "string") return null;
  
  const parts = blockValue.split(":");
  if (parts.length === 2 && Object.values(ITEM_TYPES).includes(parts[1])) {
    return parts[1];
  }
  return null;
}

/**
 * 블록 데이터에서 기본 조각 타입 추출
 * [v2.1.0] "I:bomb" -> "I" 추출
 * @param {string} blockValue - 보드 그리드에 저장된 값
 * @returns {string|null} 기본 조각 타입 또는 null
 */
export function getBasePieceType(blockValue) {
  if (!blockValue || typeof blockValue !== "string") return null;
  
  const parts = blockValue.split(":");
  return parts[0] || null;
}

/**
 * 아이템 블록 값 생성
 * [v2.1.0] 조각 타입과 아이템 타입을 조합하여 저장 값 생성
 * @param {string} pieceKey - 조각 종류
 * @param {string} itemType - 아이템 타입
 * @returns {string} 저장용 블록 값 (예: "I:bomb")
 */
export function createItemBlockValue(pieceKey, itemType) {
  return `${pieceKey}:${itemType}`;
}

// ============================================================================
// 아이템 효과 활성화 함수
// ============================================================================

/**
 * 아이템 효과 활성화 결과
 * [v2.1.0] activateItem 함수의 반환 타입
 * @typedef {Object} ItemActivationResult
 * @property {boolean} activated - 아이템이 활성화되었는지 여부
 * @property {Array} clearedCells - 파괴된 셀 목록 [{x, y}, ...]
 * @property {number} extraGarbage - 추가 가비지 라인 수
 * @property {boolean} shieldActivated - 실드가 활성화되었는지 여부
 * @property {Array} chainBombs - 연쇄 폭발할 폭탄 위치 목록 [{x, y, itemType}, ...]
 */

/**
 * 아이템 효과 활성화
 * [v2.1.0] 아이템 블록이 클리어될 때 효과 처리
 * 
 * @param {string} itemType - 아이템 타입
 * @param {number} x - 아이템 블록의 X 좌표
 * @param {number} y - 아이템 블록의 Y 좌표
 * @param {Board} board - 보드 인스턴스
 * @param {ItemSystem} itemSystem - 아이템 시스템 인스턴스
 * @returns {ItemActivationResult} 활성화 결과
 */
export function activateItem(itemType, x, y, board, itemSystem) {
  const result = {
    activated: false,
    clearedCells: [],
    extraGarbage: 0,
    shieldActivated: false,
    chainBombs: [],
  };

  switch (itemType) {
    case ITEM_TYPES.BOMB:
      return activateBomb(x, y, board, itemSystem);
    
    case ITEM_TYPES.STAR:
      return activateStar(x, y, board, itemSystem);
    
    case ITEM_TYPES.SHIELD:
      return activateShield(x, y, itemSystem);
    
    default:
      return result;
  }
}

/**
 * 폭탄 아이템 활성화
 * [v2.1.0] 3x3 영역 파괴 및 연쇄 반응 처리
 * @param {number} centerX - 폭탄 중심 X
 * @param {number} centerY - 폭탄 중심 Y
 * @param {Board} board - 보드 인스턴스
 * @param {ItemSystem} itemSystem - 아이템 시스템 인스턴스
 * @returns {ItemActivationResult} 활성화 결과
 */
function activateBomb(centerX, centerY, board, itemSystem) {
  const result = {
    activated: true,
    clearedCells: [],
    extraGarbage: 0,
    shieldActivated: false,
    chainBombs: [],
  };

  // 3x3 영역 계산
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const targetX = centerX + dx;
      const targetY = centerY + dy;

      // 보드 범위 체크
      if (targetX < 0 || targetX >= BOARD_WIDTH || 
          targetY < 0 || targetY >= BOARD_HEIGHT) {
        continue;
      }

      // 해당 위치의 블록 값 확인
      const blockValue = board.grid[targetY][targetX];
      
      if (blockValue !== 0) {
        // 셀 파괴
        result.clearedCells.push({ x: targetX, y: targetY });
        
        // 연쇄 폭탄 체크
        const itemType = getItemType(blockValue);
        if (itemType === ITEM_TYPES.BOMB && !(targetX === centerX && targetY === centerY)) {
          // 다른 폭탄이면 연쇄 반응 대상으로 추가
          result.chainBombs.push({ x: targetX, y: targetY, itemType });
        }
        
        // 아이템 시스템에서 위치 제거
        itemSystem.unregisterItemBlock(targetX, targetY);
      }
    }
  }

  // 통계 업데이트
  if (itemSystem) {
    itemSystem.stats.bombsUsed++;
  }

  return result;
}

/**
 * 별 아이템 활성화
 * [v2.1.0] 해당 줄 전체 즉시 클리어
 * @param {number} x - 별 위치 X (해당 줄)
 * @param {number} y - 별 위치 Y
 * @param {Board} board - 보드 인스턴스
 * @param {ItemSystem} itemSystem - 아이템 시스템 인스턴스
 * @returns {ItemActivationResult} 활성화 결과
 */
function activateStar(x, y, board, itemSystem) {
  const result = {
    activated: true,
    clearedCells: [],
    extraGarbage: 2,  // 별 아이템: +2줄 가비지 보너스
    shieldActivated: false,
    chainBombs: [],
  };

  // 해당 y줄 전체 클리어
  for (let targetX = 0; targetX < BOARD_WIDTH; targetX++) {
    const blockValue = board.grid[y][targetX];
    
    if (blockValue !== 0) {
      result.clearedCells.push({ x: targetX, y });
      
      // 연쇄 폭탄 체크
      const itemType = getItemType(blockValue);
      if (itemType === ITEM_TYPES.BOMB) {
        result.chainBombs.push({ x: targetX, y, itemType });
      }
      
      // 아이템 시스템에서 위치 제거
      itemSystem.unregisterItemBlock(targetX, y);
    }
  }

  // 통계 업데이트
  if (itemSystem) {
    itemSystem.stats.starsUsed++;
  }

  return result;
}

/**
 * 실드 아이템 활성화
 * [v2.1.0] 다음 가비지 공격 차단 상태 활성화
 * @param {number} x - 실드 위치 X
 * @param {number} y - 실드 위치 Y
 * @param {ItemSystem} itemSystem - 아이템 시스템 인스턴스
 * @returns {ItemActivationResult} 활성화 결과
 */
function activateShield(x, y, itemSystem) {
  const result = {
    activated: true,
    clearedCells: [],
    extraGarbage: 0,
    shieldActivated: true,
    chainBombs: [],
  };

  // 실드 활성화
  if (itemSystem) {
    itemSystem.activateShield();
  }

  return result;
}

/**
 * 연쇄 폭탄 처리
 * [v2.1.0] 연쇄 반응으로 터진 폭탄들의 효과 처리
 * @param {Array} chainBombs - 연쇄 폭탄 목록 [{x, y, itemType}, ...]
 * @param {Board} board - 보드 인스턴스
 * @param {ItemSystem} itemSystem - 아이템 시스템 인스턴스
 * @returns {Array} 모든 파괴된 셀 목록
 */
export function processChainBombs(chainBombs, board, itemSystem) {
  const allClearedCells = [];
  const processedBombs = new Set();

  // BFS/큐 방식으로 연쇄 처리
  const bombQueue = [...chainBombs];
  
  while (bombQueue.length > 0) {
    const bomb = bombQueue.shift();
    const bombKey = `${bomb.x},${bomb.y}`;
    
    // 이미 처리된 폭탄 스킵
    if (processedBombs.has(bombKey)) continue;
    processedBombs.add(bombKey);

    // 폭탄 효과 활성화
    const result = activateBomb(bomb.x, bomb.y, board, itemSystem);
    
    // 파괴된 셀 추가
    allClearedCells.push(...result.clearedCells);
    
    // 새로 발견된 폭탄을 큐에 추가
    bombQueue.push(...result.chainBombs);
  }

  return allClearedCells;
}

// ============================================================================
// 렌더링 헬퍼 함수
// ============================================================================

/**
 * 아이템 블록 렌더링
 * [v2.1.0] 아이템 블록의 시각적 효과 렌더링
 * @param {CanvasRenderingContext2D} ctx - 캔버스 컨텍스트
 * @param {number} x - 화면 X 좌표
 * @param {number} y - 화면 Y 좌표
 * @param {number} size - 블록 크기
 * @param {string} itemType - 아이템 타입
 * @param {number} time - 현재 시간 (애니메이션용)
 */
export function renderItemBlock(ctx, x, y, size, itemType, time = Date.now()) {
  const visual = ITEM_VISUALS[itemType];
  if (!visual) return;

  const centerX = x + size / 2;
  const centerY = y + size / 2;

  // 글로우 효과
  ctx.save();
  
  // 펄스/글로우 애니메이션
  let glowIntensity = 1;
  if (itemType === ITEM_TYPES.BOMB) {
    // 폭탄: 강한 펄스
    glowIntensity = 0.7 + 0.3 * Math.sin(time / 200 * visual.pulseSpeed);
  } else if (itemType === ITEM_TYPES.STAR) {
    // 별: 반짝임
    glowIntensity = 0.8 + 0.2 * Math.sin(time / 150);
  } else if (itemType === ITEM_TYPES.SHIELD) {
    // 실드: 부드러운 오라
    glowIntensity = 0.6 + 0.4 * Math.sin(time / 300);
  }
  glowIntensity *= 1.15;

  // 외부 글로우
  const gradient = ctx.createRadialGradient(
    centerX, centerY, size * 0.3,
    centerX, centerY, size * 1.2
  );
  gradient.addColorStop(0, visual.glowColor + Math.floor(glowIntensity * 255).toString(16).padStart(2, "0"));
  gradient.addColorStop(1, visual.glowColor + "00");
  
  ctx.fillStyle = gradient;
  ctx.fillRect(x - size * 0.3, y - size * 0.3, size * 1.6, size * 1.6);

  // 블록 내부 강조
  ctx.fillStyle = visual.color;
  ctx.fillRect(x + 2, y + 2, size - 4, size - 4);

  // 아이콘 그리기
  ctx.font = `${size * 0.6}px Arial`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(visual.icon, centerX, centerY);

  // 추가 효과
  if (itemType === ITEM_TYPES.STAR && Math.random() < visual.sparkleRate) {
    // 별: 랜덤 반짝임 파티클
    const sparkleX = x + Math.random() * size;
    const sparkleY = y + Math.random() * size;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(sparkleX, sparkleY, 2, 2);
  }

  ctx.restore();
}

// ============================================================================
// 기본 인스턴스 생성 함수
// ============================================================================

/**
 * 새로운 아이템 시스템 인스턴스 생성
 * [v2.1.0] 플레이어별 아이템 시스템 생성
 * @returns {ItemSystem} 새로운 ItemSystem 인스턴스
 */
export function createItemSystem() {
  return new ItemSystem();
}

// ============================================================================
// 모듈보내기
// ============================================================================

export default {
  ITEM_TYPES,
  ITEM_SPAWN_CHANCE,
  ITEM_VISUALS,
  ItemSystem,
  spawnRandomItemType,
  spawnItemPiece,
  hasItemBlock,
  getItemType,
  getBasePieceType,
  createItemBlockValue,
  activateItem,
  processChainBombs,
  renderItemBlock,
  createItemSystem,
};
