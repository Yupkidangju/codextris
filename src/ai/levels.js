/*
 * [v3.13.0] AI 난이도 설정
 * 
 * 작성일: 2026-02-28
 * 변경사항: 캐릭터 보이스 시스템 추가 (Feature 9)
 *   - [v3.9.0] Rule-Break Boss 전용 규칙 공격 패턴 확장
 *   - [v3.13.0] 보스 패턴 사용 확률 재조정
 */

/**
 * AI 보이스 설정
 * 각 난이도별 음성 특성 매핑
 */
export const AI_VOICE_CONFIG = {
  // [Easy] 초급 - Cheerful, encouraging
  "병아리": {
    voiceType: "cheerful",
    voiceProfile: "병아리",
    pitchShift: 1.5,      // 높은 피치
    speedMultiplier: 1.2, // 빠른 말투
    voiceVolume: 0.4      // 크고 경쾌한 음성
  },
  // [Normal] 중급 - Competitive, confident
  "하수인": {
    voiceType: "confident",
    voiceProfile: "하수인",
    pitchShift: 1.0,      // 기본 피치
    speedMultiplier: 1.0, // 기본 속도
    voiceVolume: 0.5
  },
  // [Hard] 상급 - Arrogant, challenging
  "기사": {
    voiceType: "arrogant",
    voiceProfile: "기사",
    pitchShift: 0.8,      // 낮은 피치
    speedMultiplier: 0.9,   // 여유로운 말투
    voiceVolume: 0.6
  },
  // [Expert] 전문가 - Cold, mechanical
  "마왕군주": {
    voiceType: "cold",
    voiceProfile: "마왕군주",
    pitchShift: 0.6,      // 매우 낮은 피치
    speedMultiplier: 0.8, // 느린 말투
    voiceVolume: 0.5
  },
  // [Ultimate] 마스터 - Dark, ominous
  "데몬킹": {
    voiceType: "dark",
    voiceProfile: "데몬킹",
    pitchShift: 0.5,      // 극도로 낮은 피치
    speedMultiplier: 0.7, // 느리고 무거운 말투
    voiceVolume: 0.7
  }
};

/**
 * AI 레벨 설정
 */
export const AI_LEVELS = {
  "병아리": {
    reactionMs: 800,      // 반응 시간 (ms)
    mistake: 0.30,        // 실수 확률 (0-1)
    attackChance: 0.08,    // 공격 패턴 사용 확률
    specialPatterns: ["GarbagePush"],  // 사용 가능한 패턴
    bossMode: false,      // 분노 모드 여부
    bossModeThreshold: 0, // 분노 모드 진입 체계 (%)
    description: "초보자용 AI. 느린 반응과 높은 실수율",
    voice: AI_VOICE_CONFIG["병아리"]  // [v2.1.0] 보이스 설정 추가
  },
  "하수인": {
    reactionMs: 600,
    mistake: 0.20,
    attackChance: 0.16,
    specialPatterns: ["GarbagePush", "CorruptNext"],
    bossMode: false,
    bossModeThreshold: 0,
    description: "입문자용 AI. 기본적인 공격 사용",
    voice: AI_VOICE_CONFIG["하수인"]  // [v2.1.0] 보이스 설정 추가
  },
  "기사": {
    reactionMs: 450,
    mistake: 0.12,
    attackChance: 0.26,
    specialPatterns: ["GarbagePush", "CorruptNext", "GravityJolt"],
    bossMode: false,
    bossModeThreshold: 0,
    description: "표준 AI. 균형잡힌 능력",
    voice: AI_VOICE_CONFIG["기사"]  // [v2.1.0] 보이스 설정 추가
  },
  "마왕군주": {
    reactionMs: 300,
    mistake: 0.06,
    attackChance: 0.38,
    specialPatterns: ["GarbagePush", "CorruptNext", "GravityJolt", "StackShake", "Darkness", "HoldLock", "GhostOut"],
    bossMode: true,
    bossModeThreshold: 30,  // HP 30% 이하에서 분노 모드
    description: "상급 AI. 어둠의 장막 패턴 사용",
    voice: AI_VOICE_CONFIG["마왕군주"]  // [v2.1.0] 보이스 설정 추가
  },
  "데몬킹": {
    reactionMs: 180,
    mistake: 0.02,
    attackChance: 0.52,
    specialPatterns: ["GarbagePush", "CorruptNext", "GravityJolt", "StackShake", "Darkness", "MirrorMove", "RotationTax", "GaugeLeech", "NextScramble"],
    bossMode: true,
    bossModeThreshold: 50,  // HP 50% 이하에서 분노 모드
    description: "최고 난이도 AI. 모든 패턴 사용",
    voice: AI_VOICE_CONFIG["데몬킹"]  // [v2.1.0] 보이스 설정 추가
  }
};

/**
 * 분노 모드 시 추가 능력
 * @param {Object} baseConfig - 기본 설정
 * @returns {Object} 분노 모드 설정
 */
export function getBossModeConfig(baseConfig) {
  return {
    ...baseConfig,
    reactionMs: Math.max(100, baseConfig.reactionMs * 0.6),  // 속도 1.6배
    attackChance: Math.min(0.82, baseConfig.attackChance * 1.45),  // 공격 확률 증가
    mistake: Math.max(0.01, baseConfig.mistake * 0.5),  // 실수 확률 감소
    isBossMode: true
  };
}

/**
 * AI 이름 목록
 */
export const AI_NAMES = ["병아리", "하수인", "기사", "마왕군주", "데몬킹"];

/**
 * 인덱스로 AI 이름 얻기
 * @param {number} index - 0-4
 * @returns {string} AI 이름
 */
export function getAINameByIndex(index) {
  return AI_NAMES[Math.max(0, Math.min(4, index))];
}
