/**
 * [v8.0.0/v3.14.0] 다이내믹 BGM 시스템 - 오디오 엔진
 * Web Audio API 기반 8비트 스타일 시퀀서
 *
 * [v8.0.0/v3.14.0] 변경사항:
 * - 다이내믹 BGM 시스템 추가 (Normal/Danger/Fever 상태)
 * - 위험 상태 자동 감지 (15줄 이상 채워짐)
 * - 크로스페이드 트랜지션 (1초)
 * - 상태별 프로시저럴 음악 생성
 * - Master/BGM/SFX/Voice 믹서, 컴프레서, 덕킹, 난이도 기반 선곡, 보스 레이어
 * - Adaptive Music 2.0: 긴장도/에너지/인커밍/보스 압박 기반 적응형 드라이브
 * - QA Layer용 오디오 디버그 스냅샷 및 이벤트 기반 임팩트 큐
 * - Combat Orchestration: 패턴/합성/규칙 공격/Neon Shift 이벤트 프레이즈 추가
 * - [v3.14.0] Layer Counter/Shift 종료 프레이즈 추가
 */

export class AudioEngine {
  constructor() {
    this.muted = false;
    this.ctx = null;
    this.master = null;
    this.output = null;
    this.bgmBus = null;
    this.voiceBus = null;
    this.compressor = null;
    this.masterVolume = 0.78;
    this.channelVolumes = {
      bgm: 0.68,
      sfx: 0.92,
      voice: 0.88,
    };
    this.presets = {
      arcade: { bgm: 0.72, sfx: 1.0, voice: 0.92 },
      focus: { bgm: 0.54, sfx: 0.8, voice: 0.68 },
      cinematic: { bgm: 0.66, sfx: 0.84, voice: 1.0 },
      quiet: { bgm: 0.42, sfx: 0.6, voice: 0.62 },
    };
    this.duckAmount = 0.72;
    this.duckTimer = null;
    this.lowStimAudio = false;
    this.bgmTimer = null;
    this.step = 0;
    this.currentTrackIndex = 0;
    this.currentTrackStateMode = "normal";
    this.recentTrackIndexes = [];
    this.phraseCooldowns = {};
    this.isPlaying = false;
    this.tempo = 130; // BPM
    this.stepInterval = null;
    
    // [v6.0.0] 피버 모드 BGM 속도 제어
    this.playbackRate = 1.0;  // 기본 재생 속도
    this.targetRate = 1.0;    // 목표 속도 (부드러운 전환용)
    this.rateTransitionSpeed = 2.0; // 속도 전환 속도 (초당 변화량)
    
    // [v8.0.0] 다이내믹 BGM 시스템
    this.bgmState = 'normal';  // 현재 BGM 상태: 'normal', 'danger', 'fever'
    this.previousBgmState = 'normal';  // 이전 상태 (크로스페이드용)
    this.crossfadeDuration = 1.0;  // 크로스페이드 지속 시간 (초)
    this.crossfadeTimer = null;    // 크로스페이드 타이머
    this.stateGain = {  // 상태별 게인 노드 (크로스페이드용)
      normal: null,
      danger: null,
      fever: null,
    };
    this.currentPattern = null;  // 현재 재생 중인 패턴
    this.dangerThreshold = 15;  // 위험 상태 진입 기준 (채워진 줄 수)
    this.dangerExitThreshold = 11;  // [v3.5.0] 위험 상태 이탈 기준
    this.maxBoardHeight = 20;     // 최대 보드 높이
    this.bossPhase = 0;
    this.lastBossPhaseAnnounced = 0;
    this.currentDifficulty = "기사";
    this.adaptiveMix = {
      tension: 0,
      energy: 0,
      incoming: 0,
      boss: 0,
      fever: 0,
      drive: 0,
      driveLabel: "CALM",
      bossLayerLabel: "OFF",
    };
    this.adaptiveTargets = {
      tension: 0,
      energy: 0,
      incoming: 0,
      boss: 0,
      fever: 0,
      drive: 0,
    };
    this.difficultyTrackPools = {
      "병아리": ["classic", "chiptune", "night"],
      "하수인": ["classic", "battle", "synthwave"],
      "기사": ["battle", "cyber", "aurora", "rush"],
      "마왕군주": ["cyber", "rush", "boss", "techno"],
      "데몬킹": ["boss", "techno", "eurobeat", "rush"],
    };
    
    // [v3.3.0] 20개 BGM 트랙 정의 (테트리스, 테크노, 유로비트, 칩튠, 보스 경보, 러시 확장)
    this.tracks = [
      { name: "Tetris Type A", type: "classic", bpm: 130, pattern: this.getTetrisTypeA() },
      { name: "Tetris Type B", type: "classic", bpm: 125, pattern: this.getTetrisTypeB() },
      { name: "Tetris Type C", type: "classic", bpm: 140, pattern: this.getTetrisTypeC() },
      { name: "Techno Drive", type: "techno", bpm: 138, pattern: this.getTechnoDrive() },
      { name: "Acid Pulse", type: "techno", bpm: 145, pattern: this.getAcidPulse() },
      { name: "Eurobeat Flash", type: "eurobeat", bpm: 150, pattern: this.getEurobeatFlash() },
      { name: "Night of Fire", type: "eurobeat", bpm: 155, pattern: this.getNightOfFire() },
      { name: "8-Bit Legend", type: "chiptune", bpm: 120, pattern: this.get8BitLegend() },
      { name: "Arpeggio Dream", type: "chiptune", bpm: 128, pattern: this.getArpeggioDream() },
      { name: "Battle Zone", type: "battle", bpm: 135, pattern: this.getBattleZone() },
      { name: "Cyber Grid", type: "cyber", bpm: 142, pattern: this.getCyberGrid() },
      { name: "Retro Wave", type: "synthwave", bpm: 118, pattern: this.getRetroWave() },
      { name: "Skyline Rush", type: "rush", bpm: 148, pattern: this.getSkylineRush() },
      { name: "Midnight Circuit", type: "night", bpm: 124, pattern: this.getMidnightCircuit() },
      { name: "Boss Alarm", type: "boss", bpm: 158, pattern: this.getBossAlarm() },
      { name: "Aurora Pulse", type: "aurora", bpm: 132, pattern: this.getAuroraPulse() },
      { name: "Steel Horizon", type: "battle", bpm: 136, pattern: this.getSteelHorizon() },
      { name: "Pixel Drift", type: "chiptune", bpm: 126, pattern: this.getPixelDrift() },
      { name: "Inferno Breaker", type: "boss", bpm: 164, pattern: this.getInfernoBreaker() },
      { name: "Prism Runner", type: "rush", bpm: 152, pattern: this.getPrismRunner() },
    ];
  }

  async init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.output = this.ctx.createGain();
      this.bgmBus = this.ctx.createGain();
      this.master = this.ctx.createGain();
      this.voiceBus = this.ctx.createGain();
      this.compressor = this.ctx.createDynamicsCompressor();

      this.compressor.threshold.value = -18;
      this.compressor.knee.value = 18;
      this.compressor.ratio.value = 3.5;
      this.compressor.attack.value = 0.01;
      this.compressor.release.value = 0.18;

      this.bgmBus.connect(this.output);
      this.master.connect(this.output);
      this.voiceBus.connect(this.output);
      this.output.connect(this.compressor);
      this.compressor.connect(this.ctx.destination);
      this._syncMixer();
    }
    if (this.ctx.state === "suspended") await this.ctx.resume();
  }

  setMasterVolume(value) {
    const clamped = Math.min(1, Math.max(0, Number(value) || 0));
    this.masterVolume = clamped;
    this._syncMixer();
  }

  getMasterVolume() {
    return this.masterVolume;
  }

  setChannelVolume(channel, value) {
    if (!(channel in this.channelVolumes)) return;
    this.channelVolumes[channel] = Math.min(1, Math.max(0, Number(value) || 0));
    this._syncMixer();
  }

  getChannelVolume(channel) {
    return this.channelVolumes[channel] ?? 0;
  }

  applyPreset(name) {
    const preset = this.presets[name];
    if (!preset) return null;
    this.channelVolumes.bgm = preset.bgm;
    this.channelVolumes.sfx = preset.sfx;
    this.channelVolumes.voice = preset.voice;
    this._syncMixer();
    return { ...preset };
  }

  setLowStimAudio(enabled) {
    this.lowStimAudio = !!enabled;
  }

  setMuted(v) {
    this.muted = v;
    this._syncMixer();
    if (v) this.stopBgm();
  }

  duckBgm(amount = this.duckAmount, duration = 0.35) {
    if (!this.ctx || !this.bgmBus || this.muted) return;
    const now = this.ctx.currentTime;
    const effectiveAmount = this.lowStimAudio ? Math.min(0.9, amount + 0.12) : amount;
    const target = Math.max(0.0001, this.channelVolumes.bgm * Math.max(0.2, Math.min(1, effectiveAmount)));

    this.bgmBus.gain.cancelScheduledValues(now);
    this.bgmBus.gain.setValueAtTime(Math.max(0.0001, this.bgmBus.gain.value), now);
    this.bgmBus.gain.linearRampToValueAtTime(target, now + 0.03);

    if (this.duckTimer) clearTimeout(this.duckTimer);
    this.duckTimer = setTimeout(() => {
      if (!this.ctx || !this.bgmBus) return;
      const resumeAt = this.ctx.currentTime;
      const base = this.muted ? 0.0001 : Math.max(0.0001, this.channelVolumes.bgm);
      this.bgmBus.gain.cancelScheduledValues(resumeAt);
      this.bgmBus.gain.setValueAtTime(Math.max(0.0001, this.bgmBus.gain.value), resumeAt);
      this.bgmBus.gain.linearRampToValueAtTime(base, resumeAt + 0.18);
    }, duration * 1000);
  }

  _syncMixer() {
    if (!this.ctx || !this.output || !this.master || !this.bgmBus || !this.voiceBus) return;
    const now = this.ctx.currentTime;
    const safeMaster = this.muted ? 0.0001 : Math.max(0.0001, this.masterVolume);
    const safeBgm = this.muted ? 0.0001 : Math.max(0.0001, this.channelVolumes.bgm);
    const safeSfx = this.muted ? 0.0001 : Math.max(0.0001, this.channelVolumes.sfx);
    const safeVoice = this.muted ? 0.0001 : Math.max(0.0001, this.channelVolumes.voice);

    this.output.gain.setValueAtTime(safeMaster, now);
    this.bgmBus.gain.setValueAtTime(safeBgm, now);
    this.master.gain.setValueAtTime(safeSfx, now);
    this.voiceBus.gain.setValueAtTime(safeVoice, now);
  }

  _getOutputBus(channel = "sfx") {
    if (channel === "bgm" && this.bgmBus) return this.bgmBus;
    if (channel === "voice" && this.voiceBus) return this.voiceBus;
    return this.master || this.output;
  }

  /**
   * [v2.0.1] 랜덤 트랙 선택하여 재생
   */
  startBgm(options = {}) {
    const { preserveCurrentTrack = false } = options;
    this.stopBgm();
    if (this.muted || !this.ctx) return;
    
    // 랜덤 트랙 선택 (현재 트랙과 다른 트랙)
    if (!preserveCurrentTrack) {
      let newIndex;
      do {
        newIndex = Math.floor(Math.random() * this.tracks.length);
      } while (newIndex === this.currentTrackIndex && this.tracks.length > 1);
      
      this.currentTrackIndex = newIndex;
    }
    this._rememberTrack(this.currentTrackIndex);
    this._startStateBGM(this.bgmState);
  }

  stopBgm() {
    this.isPlaying = false;
    if (this.bgmTimer) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
  }

  /**
   * [v2.0.1] 다음 트랙으로 변경
   */
  nextTrack() {
    this.currentTrackIndex = (this.currentTrackIndex + 1) % this.tracks.length;
    if (this.isPlaying) {
      this._rememberTrack(this.currentTrackIndex);
      this._startStateBGM(this.bgmState);
    }
  }

  /**
   * [v2.0.1] 특정 타입의 트랙만 랜덤 재생
   */
  playRandomByType(type) {
    const typeTracks = this.tracks.filter(t => t.type === type);
    if (typeTracks.length === 0) return;
    
    const track = typeTracks[Math.floor(Math.random() * typeTracks.length)];
    this.currentTrackIndex = this.tracks.indexOf(track);
    this._rememberTrack(this.currentTrackIndex);
    this._startStateBGM(this.bgmState);
  }

  getCurrentTrackName() {
    return this.tracks[this.currentTrackIndex]?.name || "None";
  }

  selectTrackForDifficulty(levelName = "기사") {
    this.currentDifficulty = levelName;
    const preferredTypes = this.difficultyTrackPools[levelName] || this.difficultyTrackPools["기사"];
    const candidates = this.tracks
      .map((track, index) => ({ track, index }))
      .filter(({ track }) => preferredTypes.includes(track.type));
    const recentSet = new Set(this.recentTrackIndexes.slice(-3));
    const filtered = candidates.filter(({ index }) => !recentSet.has(index));
    const source = filtered.length ? filtered : candidates;
    if (!source.length) return this.getCurrentTrackName();
    const picked = source[Math.floor(Math.random() * source.length)];
    this.currentTrackIndex = picked.index;
    this._rememberTrack(picked.index);
    return picked.track.name;
  }

  updateBossPhase({ enabled = false, phase = 0, hpPercent = 0 } = {}) {
    if (!enabled) {
      this.bossPhase = 0;
      this.lastBossPhaseAnnounced = 0;
      this.adaptiveMix.bossLayerLabel = "OFF";
      return;
    }
    this.bossPhase = Math.max(0, Math.min(3, Number(phase) || 0));
    this.adaptiveMix.bossLayerLabel = `PHASE ${this.bossPhase}`;
    if (this.bossPhase > this.lastBossPhaseAnnounced) {
      this.lastBossPhaseAnnounced = this.bossPhase;
      this.playVoiceCue(`boss${this.bossPhase}`, hpPercent <= 15 ? 1.2 : 1);
      this._promoteTrackForBossPhase(this.bossPhase);
    }
  }

  clamp01(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
  }

  getMusicDriveLabel() {
    return this.adaptiveMix.driveLabel || "CALM";
  }

  getBossLayerLabel() {
    return this.adaptiveMix.bossLayerLabel || "OFF";
  }

  getAudioDebugSnapshot() {
    return {
      ctxState: this.ctx?.state || "idle",
      bgmState: this.bgmState || "normal",
      trackName: this.getCurrentTrackName(),
      driveLabel: this.getMusicDriveLabel(),
      drive: Number(this.adaptiveMix.drive || 0),
      tension: Number(this.adaptiveMix.tension || 0),
      energy: Number(this.adaptiveMix.energy || 0),
      bossLayer: this.getBossLayerLabel(),
      muted: !!this.muted,
      playing: !!this.isPlaying,
    };
  }

  playImpactCue(type, meta = {}) {
    if (type === "lineClear") {
      this.triggerSfx("line", 0.9 + ((meta.lines || 1) * 0.2));
      if (meta.tSpin) {
        this.triggerSfx("tspin", 1.25);
      }
      if (meta.perfect) {
        this.triggerSfx("perfect", 1.4);
      }
      return;
    }
    if (type === "ko") {
      this.triggerSfx("ko", 1.6);
      this.playVoiceCue("ko", 1.05);
      return;
    }
    if (type === "bossPhase") {
      this.duckBgm(0.62, 0.4);
      this.playVoiceCue(`boss${Math.max(1, Math.min(3, Number(meta.phase) || 1))}`, 1.1);
      return;
    }
    if (type === "perfect") {
      this.triggerSfx("perfect", 1.8);
    }
  }

  playCombatPhrase(type, meta = {}) {
    if (!this.ctx || this.muted) return;

    const gainScale = this.lowStimAudio ? 0.68 : 1;
    const key = `${type}:${meta.tag || meta.type || meta.source || meta.tier || meta.phase || "default"}`;
    const now = performance.now();
    if ((this.phraseCooldowns[key] || 0) > now) return;
    this.phraseCooldowns[key] = now + (type === "comboTier" ? 420 : 260);

    if (type === "pattern") {
      switch (meta.tag) {
        case "pierceBarrage":
          this.hit(96, 0.08, 0.2 * gainScale, "voice");
          setTimeout(() => this.boop(659.25, 0.08, "square", 0.08 * gainScale, "voice"), 40);
          return;
        case "drillHex":
          this.boop(466.16, 0.08, "sawtooth", 0.08 * gainScale, "voice");
          setTimeout(() => this.boop(698.46, 0.12, "triangle", 0.07 * gainScale, "voice"), 55);
          return;
        case "wavePush":
          this.hit(74, 0.1, 0.24 * gainScale, "voice");
          setTimeout(() => this.noise(0.05, 0.1 * gainScale, "voice"), 45);
          return;
        case "nullBurst":
          this.duckBgm(0.76, 0.22);
          this.boop(523.25, 0.1, "triangle", 0.08 * gainScale, "voice");
          setTimeout(() => this.boop(783.99, 0.14, "sawtooth", 0.09 * gainScale, "voice"), 65);
          return;
      }
    }

    if (type === "fusion") {
      this.duckBgm(0.74, 0.24);
      this.boop(523.25, 0.08, "triangle", 0.07 * gainScale, "voice");
      setTimeout(() => this.boop(659.25, 0.1, "triangle", 0.08 * gainScale, "voice"), 45);
      setTimeout(() => this.boop(880, 0.14, "sawtooth", 0.1 * gainScale, "voice"), 105);
      return;
    }

    if (type === "ruleBreak") {
      this.duckBgm(0.82, 0.18);
      this.hit(84, 0.1, 0.2 * gainScale, "voice");
      setTimeout(() => this.noise(0.06, 0.12 * gainScale, "voice"), 35);
      return;
    }

    if (type === "neonShift") {
      this.duckBgm(0.78, 0.22);
      this.boop(523.25, 0.08, "triangle", 0.06 * gainScale, "voice");
      setTimeout(() => this.boop(659.25, 0.1, "square", 0.07 * gainScale, "voice"), 45);
      setTimeout(() => this.boop(987.77, 0.16, "sawtooth", 0.08 * gainScale, "voice"), 105);
      return;
    }

    if (type === "feverMode") {
      const roots = {
        forge: 392,
        guard: 329.63,
        scan: 659.25,
        surge: 440,
      };
      const root = roots[meta.type] || 392;
      this.boop(root, 0.08, "triangle", 0.07 * gainScale, "voice");
      setTimeout(() => this.boop(root * 1.25, 0.12, "square", 0.08 * gainScale, "voice"), 55);
      return;
    }

    if (type === "comboTier") {
      const roots = { 1: 392, 2: 523.25, 3: 659.25 };
      const root = roots[meta.tier] || 392;
      this.boop(root, 0.06, "triangle", 0.06 * gainScale, "voice");
      setTimeout(() => this.boop(root * 1.2, 0.08, "square", 0.07 * gainScale, "voice"), 42);
      setTimeout(() => this.boop(root * 1.5, 0.12, "sawtooth", 0.08 * gainScale, "voice"), 90);
      return;
    }

    if (type === "bossSignature") {
      const root = 220 + ((Number(meta.phase) || 1) * 36);
      this.duckBgm(0.8, 0.2);
      this.hit(root, 0.12, 0.2 * gainScale, "voice");
      setTimeout(() => this.boop(root * 2.1, 0.12, "sawtooth", 0.08 * gainScale, "voice"), 70);
      return;
    }

    if (type === "resonance") {
      const roots = {
        forge: 587.33,
        guard: 349.23,
        scan: 783.99,
        surge: 440,
      };
      const root = roots[meta.type] || 523.25;
      this.duckBgm(0.76, 0.18);
      this.boop(root, 0.07, "triangle", 0.07 * gainScale, "voice");
      setTimeout(() => this.boop(root * 1.33, 0.11, "square", 0.08 * gainScale, "voice"), 48);
      return;
    }

    if (type === "counter") {
      const roots = {
        forge: 523.25,
        guard: 392,
        scan: 698.46,
        surge: 440,
      };
      const root = roots[meta.type] || 523.25;
      this.duckBgm(0.74, 0.16);
      this.boop(root, 0.06, "triangle", 0.07 * gainScale, "voice");
      setTimeout(() => this.hit(root * 0.34, 0.08, 0.16 * gainScale, "voice"), 36);
      setTimeout(() => this.boop(root * 1.5, 0.1, "sawtooth", 0.08 * gainScale, "voice"), 80);
      return;
    }

    if (type === "shiftEnd") {
      this.boop(349.23, 0.05, "triangle", 0.045 * gainScale, "voice");
      setTimeout(() => this.boop(293.66, 0.08, "sine", 0.04 * gainScale, "voice"), 45);
    }
  }

  updateAdaptiveMix(snapshot = {}) {
    const stackHeight = this.clamp01((snapshot.stackHeight || 0) / this.maxBoardHeight);
    const incoming = this.clamp01((snapshot.incomingGarbage || 0) / 12);
    const incomingSpecial = this.clamp01((snapshot.incomingSpecialCount || 0) / 3);
    const combo = this.clamp01((snapshot.combo || 0) / 12);
    const fever = snapshot.isFeverActive ? 1 : 0;
    const bossEnabled = !!snapshot.bossEnabled;
    const bossPhase = this.clamp01((snapshot.bossPhase || 0) / 3);
    const bossHpPressure = bossEnabled ? this.clamp01((100 - (snapshot.bossHpPercent || 0)) / 100) : 0;
    const specialReady = snapshot.specialReady ? 1 : 0;
    const levelPressure = this.clamp01(((snapshot.level || 1) - 1) / 12);

    this.adaptiveTargets.tension = this.clamp01(
      stackHeight * 0.48
      + incoming * 0.26
      + incomingSpecial * 0.12
      + bossHpPressure * 0.14
      + levelPressure * 0.08
    );
    this.adaptiveTargets.energy = this.clamp01(
      combo * 0.42
      + fever * 0.34
      + bossPhase * 0.12
      + specialReady * 0.08
      + incoming * 0.08
    );
    this.adaptiveTargets.incoming = this.clamp01(incoming * 0.7 + incomingSpecial * 0.3);
    this.adaptiveTargets.boss = this.clamp01(
      bossPhase * 0.55
      + bossHpPressure * 0.35
      + (bossEnabled ? 0.12 : 0)
    );
    this.adaptiveTargets.fever = fever;
    this.adaptiveTargets.drive = this.clamp01(
      this.adaptiveTargets.tension * 0.44
      + this.adaptiveTargets.energy * 0.36
      + this.adaptiveTargets.incoming * 0.1
      + this.adaptiveTargets.boss * 0.18
    );

    const smooth = 0.12;
    for (const key of ["tension", "energy", "incoming", "boss", "fever", "drive"]) {
      this.adaptiveMix[key] += (this.adaptiveTargets[key] - this.adaptiveMix[key]) * smooth;
    }

    this.adaptiveMix.driveLabel = this.adaptiveMix.drive >= 0.82
      ? "OVERDRIVE"
      : this.adaptiveMix.drive >= 0.62
        ? "SURGE"
        : this.adaptiveMix.drive >= 0.36
          ? "BUILD"
          : "CALM";

    if (!bossEnabled) {
      this.adaptiveMix.bossLayerLabel = "OFF";
    } else if (this.bossPhase >= 3) {
      this.adaptiveMix.bossLayerLabel = "ENRAGED";
    } else if (this.bossPhase >= 2) {
      this.adaptiveMix.bossLayerLabel = "PHASE 2";
    } else if (this.bossPhase >= 1) {
      this.adaptiveMix.bossLayerLabel = "PHASE 1";
    }
  }

  _promoteTrackForBossPhase(phase) {
    if (!this.isPlaying) return;
    const preferredTypes = phase >= 3 ? ["boss", "rush"] : phase >= 2 ? ["boss", "cyber", "rush"] : ["cyber", "battle", "boss"];
    const currentType = this.tracks[this.currentTrackIndex]?.type;
    if (preferredTypes.includes(currentType)) return;
    const candidates = this.tracks
      .map((track, index) => ({ track, index }))
      .filter(({ track }) => preferredTypes.includes(track.type));
    if (!candidates.length) return;
    const picked = candidates[Math.floor(Math.random() * candidates.length)];
    this.currentTrackIndex = picked.index;
    this._rememberTrack(picked.index);
    this.setBGMState(this.bgmState, true);
  }

  _rememberTrack(index) {
    if (typeof index !== "number" || index < 0) return;
    this.recentTrackIndexes.push(index);
    this.recentTrackIndexes = this.recentTrackIndexes.slice(-6);
  }

  playPatternStep() {
    if (this.muted || !this.ctx || !this.isPlaying) return;
    
    const track = this.tracks[this.currentTrackIndex];
    const pattern = track.pattern;
    const stepLen = pattern.bass?.length || 16;
    const i = this.step % stepLen;
    
    // 킥 드럼
    if (pattern.kick && pattern.kick[i]) {
      const intensity = pattern.kick[i] === 2 ? 1.2 : 1;
      this.hit(track.bpm > 140 ? 75 : 78, 0.08 * intensity, 0.45, "bgm");
    }
    
    // 스네어
    if (pattern.snare && pattern.snare[i]) {
      this.noise(0.08, 0.15, "bgm");
      this.hit(180, 0.06, 0.25, "bgm");
    }
    
    // 하이햇
    if (pattern.hihat && pattern.hihat[i]) {
      this.hihat(0.04, pattern.hihat[i] === 2 ? 0.12 : 0.08, "bgm");
    }
    
    // 베이스라인
    if (pattern.bass) {
      const b = pattern.bass[i];
      if (b !== null) {
        const waveType = track.type === "techno" ? "sawtooth" : "square";
        this.boop(this.midiToHz(b), 0.15, waveType, track.type === "techno" ? 0.12 : 0.1, "bgm");
      }
    }
    
    // 리드 멜로디
    if (pattern.lead) {
      const l = pattern.lead[i];
      if (l !== null) {
        const waveType = track.type === "chiptune" ? "pulse" : "triangle";
        const gain = track.type === "eurobeat" ? 0.06 : 0.05;
        this.boop(this.midiToHz(l), 0.12, waveType, gain, "bgm");
      }
    }
    
    // 아르페지오
    if (pattern.arp) {
      const a = pattern.arp[i];
      if (a !== null) {
        this.boop(this.midiToHz(a), 0.08, "sine", 0.04, "bgm");
      }
    }
    
    this.step += 1;
  }

  // [v8.0.0] 다이나믹 BGM 시스템 메서드
  
  /**
   * BGM 상태 설정
   * [v8.0.0] Normal/Danger/Fever 상태 전환 및 크로스페이드 처리
   *
   * @param {string} state - 'normal', 'danger', 'fever' 중 하나
   */
  setBGMState(state, force = false) {
    if (!['normal', 'danger', 'fever'].includes(state)) {
      console.warn(`[AudioEngine] 잘못된 BGM 상태: ${state}`);
      return;
    }
    
    if (this.bgmState === state && !force) return;  // 같은 상태면 무시
    
    console.log(`[AudioEngine] BGM 상태 전환: ${this.bgmState} → ${state}`);
    
    this.previousBgmState = this.bgmState;
    this.bgmState = state;
    this._promoteTrackForState(state);
    this._playTransitionCue(this.previousBgmState, state);
    
    if (!this.bgmTimer) {
      this._startStateBGM(state);
      return;
    }

    // 크로스페이드 트랜지션 실행
    this._crossfadeBGM(state);
  }

  _playTransitionCue(previousState, nextState) {
    if (!this.ctx || this.muted || previousState === nextState) return;
    if (nextState === "danger") {
      this.hit(82, 0.1, 0.18, "bgm");
      this.noise(0.06, this.lowStimAudio ? 0.04 : 0.08, "bgm");
    } else if (nextState === "fever") {
      this.boop(659.25, 0.08, "triangle", 0.06, "bgm");
      setTimeout(() => this.boop(783.99, 0.08, "square", 0.06, "bgm"), 45);
    } else if (previousState === "fever" && nextState === "normal") {
      this.boop(523.25, 0.08, "triangle", 0.04, "bgm");
    }
  }

  _promoteTrackForState(state) {
    if (state === "normal") return;
    const currentType = this.tracks[this.currentTrackIndex]?.type;
    const stateTypes = state === "fever"
      ? ["rush", "boss", "techno", "cyber"]
      : ["boss", "rush", "cyber", "battle", "techno"];
    const difficultyTypes = this.difficultyTrackPools[this.currentDifficulty] || [];
    const preferredTypes = Array.from(new Set([...stateTypes, ...difficultyTypes]));
    if (preferredTypes.includes(currentType)) return;

    const recentSet = new Set(this.recentTrackIndexes.slice(-3));
    const candidates = this.tracks
      .map((track, index) => ({ track, index }))
      .filter(({ track, index }) => preferredTypes.includes(track.type) && !recentSet.has(index));
    const source = candidates.length ? candidates : this.tracks
      .map((track, index) => ({ track, index }))
      .filter(({ track }) => preferredTypes.includes(track.type));
    if (!source.length) return;

    const picked = source[Math.floor(Math.random() * source.length)];
    this.currentTrackIndex = picked.index;
    this._rememberTrack(picked.index);
  }
  
  /**
   * 현재 BGM 상태 조회
   * [v8.0.0] 현재 재생 중인 BGM 상태 반환
   *
   * @returns {string} 현재 상태 ('normal', 'danger', 'fever')
   */
  getBGMState() {
    return this.bgmState;
  }
  
  /**
   * BGM 상태 자동 업데이트
   * [v8.0.0/v3.5.0] 보드 높이, 인커밍 압박, 보스 압력, 적응형 드라이브를 함께 반영해 상태를 감지한다.
   * v3.5.0부터 객체 기반 메트릭 입력을 받아 Danger 히스테리시스를 적용한다.
   *
   * @param {number|Object} filledRows - 현재 채워진 줄 수 또는 전투 메트릭 스냅샷
   * @param {boolean} isFeverActive - 피버 모드 활성화 여부
   * @returns {string} 결정된 새로운 상태
   */
  updateBGMState(filledRows, isFeverActive = false) {
    let metrics;
    if (typeof filledRows === "object" && filledRows !== null) {
      metrics = filledRows;
      if (typeof metrics.isFeverActive !== "undefined") {
        isFeverActive = !!metrics.isFeverActive;
      }
      filledRows = metrics.stackHeight ?? metrics.filledRows ?? 0;
    }

    let newState = 'normal';
    const incomingGarbage = Number(metrics?.incomingGarbage || 0);
    const incomingSpecialCount = Number(metrics?.incomingSpecialCount || 0);
    const bossPressure = Number(metrics?.bossPhase || 0) > 0;
    const dangerEnter = filledRows >= this.dangerThreshold
      || incomingGarbage >= 6
      || incomingSpecialCount >= 2
      || this.adaptiveMix.tension >= 0.72
      || (bossPressure && this.adaptiveMix.drive >= 0.58);
    const dangerHold = filledRows >= this.dangerExitThreshold
      || incomingGarbage >= 3
      || incomingSpecialCount >= 1
      || this.adaptiveMix.tension >= 0.5
      || (bossPressure && this.adaptiveMix.drive >= 0.42);
    
    // 우선순위: Fever > Danger > Normal
    if (isFeverActive) {
      newState = 'fever';
    } else if (dangerEnter || (this.bgmState === "danger" && dangerHold)) {
      newState = 'danger';
    }
    
    // 상태 변경이 필요하면 적용
    if (newState !== this.bgmState) {
      this.setBGMState(newState);
    }
    
    return newState;
  }
  
  /**
   * 크로스페이드 BGM 전환
   * [v8.0.0] 1초 동안 부드럽게 볼륨 전환
   *
   * @param {string} newState - 전환할 새로운 상태
   * @private
   */
  _crossfadeBGM(newState) {
    if (!this.ctx) return;
    
    const now = this.ctx.currentTime;
    const fadeDuration = this.crossfadeDuration;
    
    // 기존 BGM 정지 (부드럽게 페이드 아웃)
    if (this.bgmTimer) {
      // 현재 재생 중인 패턴을 부드럽게 페이드 아웃
      this._fadeOutCurrentBGM(fadeDuration);
    }
    
    // 새로운 상태의 BGM 시작
    setTimeout(() => {
      this._startStateBGM(newState);
    }, fadeDuration * 500);  // 크로스페이드 중간에 새로운 BGM 시작
  }
  
  /**
   * 현재 BGM 페이드 아웃
   * [v8.0.0] 볼륨을 서서히 줄여 부드럽게 정지
   *
   * @param {number} duration - 페이드 아웃 지속 시간 (초)
   * @private
   */
  _fadeOutCurrentBGM(duration) {
    if (!this.ctx || !this.bgmBus) return;
    
    const now = this.ctx.currentTime;
    const currentGain = Math.max(0.0001, this.bgmBus.gain.value);
    
    // 마스터 게인을 서서히 줄임
    this.bgmBus.gain.setValueAtTime(currentGain, now);
    this.bgmBus.gain.exponentialRampToValueAtTime(0.001, now + duration);
    
    // 페이드 아웃 후 기존 타이머 정지
    setTimeout(() => {
      if (this.bgmTimer) {
        clearInterval(this.bgmTimer);
        this.bgmTimer = null;
      }
      // 마스터 게인 복원
      if (this.bgmBus) {
        const safeGain = this.muted ? 0.0001 : Math.max(0.0001, this.channelVolumes.bgm);
        this.bgmBus.gain.setValueAtTime(safeGain, this.ctx.currentTime);
      }
    }, duration * 1000);
  }
  
  /**
   * 상태별 BGM 시작
   * [v8.0.0] 지정된 상태의 BGM 패턴 재생 시작
   *
   * @param {string} state - 시작할 상태
   * @private
   */
  _startStateBGM(state) {
    this.stopBgm();
    if (this.muted || !this.ctx) return;
    
    this.step = 0;
    this.isPlaying = true;
    this.currentTrackStateMode = state;
    
    switch (state) {
      case 'normal':
        this._playNormalBGM();
        break;
      case 'danger':
        this._playDangerBGM();
        break;
      case 'fever':
        // Fever는 기존 트랙을 빠르게 재생
        this._playFeverBGM();
        break;
    }
  }
  
  /**
   * Normal BGM 재생
   * [v8.0.0] 평시 상태용 차분한 멜로디 (120 BPM, 메이저 스케일)
   *
   * @private
   */
  _playNormalBGM() {
    const track = this.tracks[this.currentTrackIndex];
    this.tempo = Math.max(112, Math.round(track.bpm * 0.94));
    this.currentPattern = track.pattern;
    
    console.log(`[AudioEngine] Normal BGM 시작 (${track.name}, ${this.tempo} BPM)`);
    
    const stepMs = ((60000 / this.tempo) / 4) / this.playbackRate;
    this.stepInterval = stepMs;
    
    this._playStatefulTrackStep();
    this.bgmTimer = setInterval(() => this._playStatefulTrackStep(), stepMs);
  }
  
  /**
   * Danger BGM 재생
   * [v8.0.0] 위험 상태용 긴장감 있는 음악 (160 BPM, 마이너 스케일)
   *
   * @private
   */
  _playDangerBGM() {
    const track = this.tracks[this.currentTrackIndex];
    this.tempo = Math.min(186, Math.round(track.bpm * 1.12));
    this.currentPattern = track.pattern;
    
    console.log(`[AudioEngine] Danger BGM 시작 (${track.name}, ${this.tempo} BPM)`);
    
    const stepMs = ((60000 / this.tempo) / 4) / this.playbackRate;
    this.stepInterval = stepMs;
    
    this._playStatefulTrackStep();
    this.bgmTimer = setInterval(() => this._playStatefulTrackStep(), stepMs);
  }
  
  /**
   * Fever BGM 재생
   * [v8.0.0] 피버 모드 - 기존 트랙을 빠르게 재생
   *
   * @private
   */
  _playFeverBGM() {
    // 피버 모드는 기존 트랙 중 하나를 선택하여 1.3배속 재생
    const track = this.tracks[this.currentTrackIndex];
    this.tempo = track.bpm * 1.3;
    this.currentPattern = track.pattern;
    
    console.log('[AudioEngine] Fever BGM 시작 (' + track.name + ', ' + this.tempo + ' BPM)');
    
    const stepMs = ((60000 / track.bpm) / 4) / 1.3;  // 1.3배속
    this.stepInterval = stepMs;
    
    this._playStatefulTrackStep();
    this.bgmTimer = setInterval(() => this._playStatefulTrackStep(), stepMs);
  }
  
  /**
   * 다이남믹 BGM 패턴 스텝 재생
   * [v8.0.0] Normal/Danger 상태용 패턴 재생
   *
   * @private
   */
  _playStatefulTrackStep() {
    if (this.muted || !this.ctx || !this.isPlaying) return;
    if (!this.currentPattern) return;
    
    const pattern = this.currentPattern;
    const stepLen = pattern.bass?.length || 16;
    const i = this.step % stepLen;
    const mode = this.currentTrackStateMode || this.bgmState;
    const isDanger = mode === "danger";
    const isFever = mode === "fever";
    const hatGain = this.lowStimAudio ? 0.55 : 1;
    const noiseGain = this.lowStimAudio ? 0.5 : 1;
    const drive = this.adaptiveMix.drive;
    const tension = this.adaptiveMix.tension;
    const energy = this.adaptiveMix.energy;
    const incoming = this.adaptiveMix.incoming;
    const boss = this.adaptiveMix.boss;
    const driveLift = 1 + drive * 0.26;
    const densityLift = 1 + energy * 0.18;
    
    // 킥 드럼
    if (pattern.kick && pattern.kick[i]) {
      const intensity = pattern.kick[i] === 2 ? 1.3 : 1;
      const punch = isDanger ? 1.18 : isFever ? 1.12 : 1;
      this.hit(this.tempo > 140 ? 75 : 78, 0.08 * intensity, 0.45 * punch * driveLift, "bgm");
      if (drive >= 0.52) {
        this.hit(56 + Math.round(tension * 18), 0.05, 0.08 * drive * (this.lowStimAudio ? 0.7 : 1), "bgm");
      }
    }
    
    // 스네어
    if (pattern.snare && pattern.snare[i]) {
      this.noise(0.08, 0.18 * noiseGain * (isDanger ? 1.08 : 0.95) * (1 + drive * 0.2), "bgm");
      this.hit(180, 0.06, 0.28 * densityLift, "bgm");
    }
    
    // 하이햇
    if (pattern.hihat && pattern.hihat[i]) {
      const baseHat = pattern.hihat[i] === 2 ? 0.12 : 0.08;
      this.hihat(0.04, baseHat * hatGain * (isDanger ? 1.1 : isFever ? 0.95 : 0.9) * densityLift, "bgm");
    }
    if (energy >= 0.46 && i % 2 === 1) {
      this.hihat(0.025, (0.018 + energy * 0.035) * (this.lowStimAudio ? 0.58 : 1), "bgm");
    }
    
    // 베이스라인
    if (pattern.bass) {
      const b = pattern.bass[i];
      if (b !== null) {
        const waveType = isDanger ? 'sawtooth' : pattern.lead ? 'square' : 'triangle';
        const gain = (isDanger ? 0.15 : isFever ? 0.14 : 0.12) * (1 + tension * 0.28 + boss * 0.12);
        this.boop(this.midiToHz(b), 0.15, waveType, gain, "bgm");
        if (drive >= 0.66 && i % 4 === 0) {
          this.boop(this.midiToHz(b - 12), 0.1, "sine", 0.03 + drive * 0.025, "bgm");
        }
      }
    }
    
    // 리드 멜로디
    if (pattern.lead) {
      const l = pattern.lead[i];
      if (l !== null) {
        const waveType = isDanger ? 'sawtooth' : isFever ? 'square' : 'triangle';
        const gain = (isDanger ? 0.07 : isFever ? 0.065 : 0.05) * (1 + energy * 0.35 + boss * 0.12);
        this.boop(this.midiToHz(l), 0.12, waveType, gain, "bgm");
        if (drive >= 0.58 && i % 4 === 2) {
          this.boop(this.midiToHz(l + 12), 0.06, "sine", 0.018 + energy * 0.03, "bgm");
        }
      }
    }
    
    // 아르페지오
    if (pattern.arp) {
      const a = pattern.arp[i];
      if (a !== null) {
        this.boop(this.midiToHz(a), 0.08, 'sine', 0.04 * (1 + drive * 0.18), "bgm");
        if (drive >= 0.74) {
          this.boop(this.midiToHz(a + 12), 0.05, "triangle", 0.015 + drive * 0.02, "bgm");
        }
      }
    }

    if (isDanger && i % 8 === 4) {
      this.hit(62, 0.06, (this.lowStimAudio ? 0.08 : 0.12) * (1 + tension * 0.22), "bgm");
    }
    if (incoming >= 0.42 && i % 8 === 6) {
      this.noise(0.05, (0.02 + incoming * 0.05) * (this.lowStimAudio ? 0.55 : 1), "bgm");
    }
    if (isFever && i % 4 === 3) {
      this.boop(783.99, 0.05, "square", 0.016 + energy * 0.025, "bgm");
    }
    if (this.bossPhase > 0) {
      this._playBossLayerStep(i, mode);
    }
    
    this.step += 1;
  }

  _playBossLayerStep(stepIndex, mode) {
    const intensity = (this.bossPhase === 3 ? 1.25 : this.bossPhase === 2 ? 1 : 0.82) * (1 + this.adaptiveMix.boss * 0.28);
    const gainScale = this.lowStimAudio ? 0.6 : 1;
    if (stepIndex % 8 === 0) {
      this.hit(48 + this.bossPhase * 6, 0.12, 0.12 * intensity * gainScale, "bgm");
    }
    if (this.bossPhase >= 2 && stepIndex % 4 === 2) {
      this.boop(196, 0.18, mode === "fever" ? "sawtooth" : "triangle", 0.05 * intensity * gainScale, "bgm");
    }
    if (this.bossPhase >= 3 && stepIndex % 2 === 1) {
      this.noise(0.04, 0.035 * gainScale, "bgm");
    }
  }
  
  /**
   * Normal BGM 패턴
   * [v8.0.0] 평시용 차분한 멜로디 (C Major, 120 BPM)
   * 편안하고 안정적인 느낌의 메이저 스케일
   *
   * @returns {Object} 16스텝 패턴 객체
   * @private
   */
  _getNormalPattern() {
    // C Major 스케일 기반
    // C(60), E(64), G(67) - 트라이어드
    return {
      kick:  [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
      snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
      hihat: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1],
      // C Major 베이스: C-E-G 패턴
      bass:  [36,null,43,null, 40,null,36,null, 38,null,43,null, 40,null,36,null],
      // 메이저 스케일 멜로디
      lead:  [72,null,76,null, 79,null,76,null, 74,null,77,null, 76,null,72,null],
    };
  }
  
  /**
   * Danger BGM 패턴
   * [v8.0.0] 위험용 긴장감 있는 음악 (A Minor, 160 BPM)
   * 어두운 마이너 스케일과 강한 퍼커션
   *
   * @returns {Object} 16스텝 패턴 객체
   * @private
   */
  _getDangerPattern() {
    // A Minor 스케일 기반
    // A(57), C(60), E(64) - 마이너 트라이어드
    return {
      // 강한 4비트 킥
      kick:  [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,1],
      // 자주 치는 스네어
      snare: [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
      // 빽빽한 하이햇
      hihat: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1],
      // A Minor 베이스: 낮은 음역대, 공격적
      bass:  [33,33,null,33, 36,36,null,36, 31,31,null,31, 33,33,33,33],
      // 마이너 스케일 긴장감 멜로디
      lead:  [69,null,72,null, 69,null,67,null, 65,null,69,null, 67,null,65,null],
    };
  }

  // ===== SFX =====
  triggerSfx(tag, intensity = 1) {
    if (this.muted || !this.ctx) return;
    if (tag === "line") {
      if (intensity >= 2) this.duckBgm();
      this.hit(110, 0.08 + intensity * 0.02, 0.36);
      this.noise(0.04 + intensity * 0.02, 0.15);
      return;
    }
    if (tag === "move") {
      this.boop(190, 0.035, "square", 0.03);
      return;
    }
    if (tag === "rotate") {
      this.boop(245, 0.05, "triangle", 0.04);
      return;
    }
    if (tag === "hold") {
      this.boop(330, 0.06, "triangle", 0.05);
      setTimeout(() => this.boop(392, 0.08, "triangle", 0.04), 40);
      return;
    }
    if (tag === "harddrop") {
      this.duckBgm(0.82, 0.22);
      this.hit(72, 0.12 + intensity * 0.02, 0.52);
      this.noise(0.05, 0.08);
      return;
    }
    if (tag === "damage") {
      this.duckBgm();
      this.hit(64, 0.1, 0.38);
      this.noise(0.08, 0.16);
      return;
    }
    if (tag === "impact") {
      this.duckBgm(0.68, 0.42);
      this.hit(58, 0.18, 0.75);
      this.noise(0.12, 0.24);
      return;
    }
    if (tag === "tspin") {
      this.boop(523.25, 0.15, "square", 0.12);
      setTimeout(() => this.boop(659.25, 0.15, "square", 0.12), 80);
      setTimeout(() => this.boop(783.99, 0.2, "square", 0.15), 160);
      return;
    }
    if (tag === "attack") {
      this.duckBgm();
      this.hit(85, 0.12 + intensity * 0.03, 0.48);
      this.boop(310, 0.08, "square");
      return;
    }
    if (tag === "ko") {
      this.duckBgm(0.56, 0.65);
      this.hit(62, 0.2, 0.85);
      this.noise(0.12, 0.4);
    }
    if (tag === "special") {
      this.duckBgm(0.7, 0.45);
      this.boop(440, 0.1, "sawtooth", 0.1);
      setTimeout(() => this.boop(554, 0.1, "sawtooth", 0.1), 50);
      setTimeout(() => this.boop(659, 0.15, "sawtooth", 0.12), 100);
      return;
    }
    if (tag === "perfect") {
      this.duckBgm(0.62, 0.55);
      this.boop(523.25, 0.12, "triangle", 0.1);
      setTimeout(() => this.boop(659.25, 0.16, "triangle", 0.1), 55);
      setTimeout(() => this.boop(783.99, 0.22, "sawtooth", 0.12), 110);
      return;
    }
    if (tag === "levelup") {
      this.duckBgm(0.74, 0.35);
      this.boop(440, 0.08, "triangle", 0.08);
      setTimeout(() => this.boop(554.37, 0.1, "triangle", 0.09), 50);
      setTimeout(() => this.boop(659.25, 0.12, "triangle", 0.1), 100);
      setTimeout(() => this.boop(880, 0.18, "sawtooth", 0.12), 160);
    }
  }

  playVoiceCue(tag, intensity = 1) {
    if (this.muted || !this.ctx) return;
    const gainBoost = this.lowStimAudio ? 0.78 : 1;
    if (tag === "start" || tag === "ready") {
      this.boop(523.25, 0.08, "triangle", 0.08 * gainBoost * intensity, "voice");
      setTimeout(() => this.boop(659.25, 0.1, "triangle", 0.09 * gainBoost * intensity, "voice"), 60);
      return;
    }
    if (tag === "double" || tag === "triple" || tag === "tetris" || tag === "combo") {
      const pitch = tag === "tetris" ? 783.99 : tag === "triple" ? 698.46 : tag === "combo" ? 659.25 : 587.33;
      this.boop(pitch, 0.12, "square", 0.085 * gainBoost * intensity, "voice");
      setTimeout(() => this.boop(pitch * 1.125, 0.1, "triangle", 0.06 * gainBoost * intensity, "voice"), 55);
      return;
    }
    if (tag === "tspin" || tag === "perfect") {
      this.boop(659.25, 0.12, "sawtooth", 0.1 * gainBoost * intensity, "voice");
      setTimeout(() => this.boop(880, 0.16, "triangle", 0.08 * gainBoost * intensity, "voice"), 70);
      setTimeout(() => this.boop(987.77, 0.2, "triangle", 0.08 * gainBoost * intensity, "voice"), 135);
      return;
    }
    if (tag === "skill" || tag === "item" || tag === "attack") {
      this.boop(440, 0.08, "square", 0.08 * gainBoost * intensity, "voice");
      setTimeout(() => this.boop(523.25, 0.1, "square", 0.07 * gainBoost * intensity, "voice"), 50);
      return;
    }
    if (tag === "warning" || tag === "boss") {
      this.hit(92, 0.12, 0.22 * gainBoost * intensity, "voice");
      setTimeout(() => this.hit(110, 0.08, 0.16 * gainBoost * intensity, "voice"), 110);
      return;
    }
    if (tag === "boss1" || tag === "boss2" || tag === "boss3") {
      const root = tag === "boss3" ? 92 : tag === "boss2" ? 110 : 123;
      this.hit(root, 0.14, 0.2 * gainBoost * intensity, "voice");
      setTimeout(() => this.boop(root * 3.2, 0.18, "sawtooth", 0.07 * gainBoost * intensity, "voice"), 80);
      return;
    }
    if (tag === "fever" || tag === "levelup" || tag === "ko") {
      this.boop(tag === "ko" ? 392 : 523.25, 0.12, "triangle", 0.09 * gainBoost * intensity, "voice");
      setTimeout(() => this.boop(tag === "ko" ? 523.25 : 659.25, 0.15, "sawtooth", 0.08 * gainBoost * intensity, "voice"), 75);
    }
  }

  /**
   * [v3.0.0] 콤보 보이스 사운드 재생
   * 콤보 마일스톤(2, 3, 5, 7, 10, 15, 20+)마다 다른 음색으로 재생
   * 높은 콤보일수록 더 높은 피치와 길이
   * 
   * @param {number} comboCount - 현재 콤보 수
   */
  playComboSound(comboCount) {
    if (this.muted || !this.ctx || comboCount < 2) return;

    // [v3.0.0] 콤보 마일스톤별 사운드 설정
    // 더 높은 콤보 = 더 높은 피치, 더 긴 길이, 더 강한 어택
    const comboConfig = this._getComboSoundConfig(comboCount);
    
    // 메인 멜로디 음
    this._playComboTone(comboConfig);
    
    // 10콤보 이상: 추가 하모니 레이어
    if (comboCount >= 10) {
      setTimeout(() => {
        this._playComboHarmony(comboConfig);
      }, 60);
    }
    
    // 15콤보 이상: 강한 임팩트 사운드 추가
    if (comboCount >= 15) {
      setTimeout(() => {
        this.hit(comboConfig.freq * 0.5, 0.1, 0.3, "voice");
      }, 30);
    }
    
    // 20콤보 이상: 특수 효과음 (글리산도)
    if (comboCount >= 20) {
      this._playComboGlissando(comboConfig);
    }
  }

  /**
   * [v3.0.0] 콤보 수에 따른 사운드 설정 반환
   * 마일스톤: 2, 3, 5, 7, 10, 15, 20+
   * 
   * @param {number} combo - 콤보 수
   * @returns {Object} 사운드 설정 {freq, duration, waveType, gain}
   */
  _getComboSoundConfig(combo) {
    // 마일스톤별 기본 설정
    // 주파수는 MIDI 노트 번호 기준 (높은 콤보 = 더 높은 음)
    const configs = {
      2: { note: 72, duration: 0.12, wave: "triangle", gain: 0.08 },    // C5
      3: { note: 74, duration: 0.14, wave: "triangle", gain: 0.09 },    // D5
      5: { note: 77, duration: 0.16, wave: "square", gain: 0.10 },     // F5
      7: { note: 79, duration: 0.18, wave: "square", gain: 0.11 },     // G5
      10: { note: 84, duration: 0.22, wave: "sawtooth", gain: 0.12 },  // C6
      15: { note: 86, duration: 0.28, wave: "sawtooth", gain: 0.14 },  // D6
      20: { note: 91, duration: 0.35, wave: "square", gain: 0.15 },    // G6
    };

    // 해당 마일스톤 찾기
    let config = configs[2];
    const milestones = [20, 15, 10, 7, 5, 3, 2];
    for (const m of milestones) {
      if (combo >= m) {
        config = configs[m];
        break;
      }
    }

    // 20콤보 이상은 추가 오버드라이브
    if (combo > 20) {
      const extra = Math.min(combo - 20, 10);
      config = {
        note: config.note + Math.floor(extra / 2),
        duration: config.duration + extra * 0.02,
        wave: "sawtooth",
        gain: Math.min(0.2, config.gain + extra * 0.01),
      };
    }

    return {
      freq: this.midiToHz(config.note),
      duration: config.duration,
      waveType: config.wave,
      gain: config.gain,
      note: config.note,
    };
  }

  /**
   * [v3.0.0] 콤보 메인 톤 재생
   * 아르페지오 스타일의 상승 음계
   * 
   * @param {Object} config - 사운드 설정
   */
  _playComboTone(config) {
    const now = this.ctx.currentTime;
    
    // 메인 음
    this.boop(config.freq, config.duration, config.waveType, config.gain, "voice");
    
    // 5콤보 이상: 5차 하모닉 추가
    if (config.note >= 77) {
      setTimeout(() => {
        this.boop(config.freq * 1.5, config.duration * 0.7, "sine", config.gain * 0.4, "voice");
      }, 40);
    }
    
    // 7콤보 이상: 옥타브 위 추가
    if (config.note >= 79) {
      setTimeout(() => {
        this.boop(config.freq * 2, config.duration * 0.5, "triangle", config.gain * 0.3, "voice");
      }, 80);
    }
  }

  /**
   * [v3.0.0] 콤보 하모니 레이어
   * 10콤보 이상에서 추가되는 화음
   * 
   * @param {Object} config - 사운드 설정
   */
  _playComboHarmony(config) {
    // 메이저 3도 위
    const harmonyFreq = config.freq * 1.25;
    this.boop(harmonyFreq, config.duration * 0.8, "triangle", config.gain * 0.5, "voice");
  }

  /**
   * [v3.0.0] 콤보 글리산도 효과
   * 20콤보 이상에서 재생되는 슬라이드 효과
   * 
   * @param {Object} config - 사운드 설정
   */
  _playComboGlissando(config) {
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(config.freq, now);
    osc.frequency.exponentialRampToValueAtTime(config.freq * 2, now + 0.3);
    
    gain.gain.setValueAtTime(config.gain * 0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    
    osc.connect(gain).connect(this._getOutputBus("voice"));
    osc.start(now);
    osc.stop(now + 0.31);
  }

  // ===== INSTRUMENTS =====
  hit(freq, len, gainAmt, channel = "sfx") {
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = this.lowStimAudio ? 220 : 260;
    const shapedGain = this.lowStimAudio && channel !== "bgm" ? gainAmt * 0.82 : gainAmt;

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq * 1.8, now);
    osc.frequency.exponentialRampToValueAtTime(freq, now + len * 0.5);

    gain.gain.setValueAtTime(shapedGain, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + len);

    osc.connect(filter).connect(gain).connect(this._getOutputBus(channel));
    osc.start(now);
    osc.stop(now + len + 0.01);
  }

  boop(freq, len, type = "triangle", gainAmt = 0.06, channel = "sfx") {
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    // pulse 타입은 사각파로 대체
    if (type === "pulse") type = "square";

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.0001, now);
    const shapedGain = this.lowStimAudio && channel !== "bgm" ? gainAmt * 0.82 : gainAmt;
    gain.gain.exponentialRampToValueAtTime(shapedGain, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + len);

    osc.connect(gain).connect(this._getOutputBus(channel));
    osc.start(now);
    osc.stop(now + len + 0.02);
  }

  hihat(len, gainAmt = 0.08, channel = "sfx") {
    const now = this.ctx.currentTime;
    const buffer = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * len), this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * 0.5;

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = this.lowStimAudio ? 4200 : 6000;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(this.lowStimAudio ? gainAmt * 0.58 : gainAmt, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + len);

    src.connect(filter).connect(gain).connect(this._getOutputBus(channel));
    src.start(now);
    src.stop(now + len + 0.01);
  }

  noise(len, gainAmt = 0.1, channel = "sfx") {
    const now = this.ctx.currentTime;
    const buffer = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * len), this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * 0.25;

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = this.lowStimAudio ? 560 : 800;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(this.lowStimAudio && channel !== "bgm" ? gainAmt * 0.62 : gainAmt, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + len);

    src.connect(filter).connect(gain).connect(this._getOutputBus(channel));
    src.start(now);
    src.stop(now + len + 0.01);
  }

  midiToHz(midi) {
    return 440 * (2 ** ((midi - 69) / 12));
  }

  // ===== MUSIC PATTERNS =====
  // 16스텝 패턴 (16분음표 기준)
  
  getTetrisTypeA() {
    // Korobeiniki (독수리) 테마
    return {
      kick:  [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
      snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
      hihat: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1],
      bass:  [40,null,52,null, 40,null,52,null, 38,null,50,null, 38,null,50,null],
      lead:  [64,66,68,71, 68,66,64,62, 59,null,62,64, 64,null,null,null],
    };
  }

  getTetrisTypeB() {
    return {
      kick:  [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
      snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
      hihat: [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
      bass:  [36,null,null,null, 43,null,null,null, 41,null,null,null, 38,null,null,null],
      lead:  [67,67,69,71, 72,null,71,69, 67,null,66,64, 67,null,null,null],
    };
  }

  getTetrisTypeC() {
    return {
      kick:  [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
      snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
      hihat: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
      bass:  [48,null,48,null, 45,null,45,null, 43,null,43,null, 41,null,41,null],
      lead:  [72,null,74,null, 76,null,77,null, 76,null,74,null, 72,null,71,null],
    };
  }

  getTechnoDrive() {
    return {
      kick:  [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,1,0],
      snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
      hihat: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1],
      bass:  [36,36,null,36, 36,null,36,36, 31,31,null,31, 31,null,31,31],
      lead:  [60,null,63,null, 67,null,72,null, 63,null,67,null, 72,null,75,null],
    };
  }

  getAcidPulse() {
    return {
      kick:  [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,1],
      snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
      hihat: [0,1,0,1, 0,1,0,1, 0,1,0,1, 0,1,0,1],
      bass:  [42,42,42,42, 42,42,42,42, 37,37,37,37, 37,37,37,37],
      lead:  null,
      arp:   [72,75,79,82, 72,75,79,82, 71,74,77,81, 71,74,77,81],
    };
  }

  getEurobeatFlash() {
    return {
      kick:  [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
      snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
      hihat: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
      bass:  [45,null,null,45, 45,null,null,45, 43,null,null,43, 43,null,null,43],
      lead:  [69,71,72,74, 76,74,72,71, 69,67,69,71, 72,71,69,67],
    };
  }

  getNightOfFire() {
    return {
      kick:  [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,1,0],
      snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
      hihat: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1],
      bass:  [38,null,38,null, 38,null,38,null, 36,null,36,null, 36,null,36,null],
      lead:  [74,76,77,79, 81,79,77,76, 74,72,74,76, 77,79,77,76],
    };
  }

  get8BitLegend() {
    return {
      kick:  [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
      snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
      hihat: [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
      bass:  [48,null,48,null, 45,null,45,null, 43,null,43,null, 41,null,41,null],
      lead:  [72,null,null,72, 74,null,null,76, 77,null,null,76, 74,null,null,72],
    };
  }

  getArpeggioDream() {
    return {
      kick:  [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
      snare: [0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
      hihat: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
      bass:  null,
      lead:  null,
      arp:   [60,64,67,72, 64,67,72,76, 62,65,69,74, 65,69,74,77],
    };
  }

  getBattleZone() {
    return {
      kick:  [1,0,0,0, 1,0,1,0, 1,0,0,0, 1,0,1,1],
      snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
      hihat: [1,1,0,1, 1,1,0,1, 1,1,0,1, 1,1,0,1],
      bass:  [36,null,36,36, 36,null,36,36, 34,null,34,34, 34,null,34,34],
      lead:  [60,null,67,null, 72,null,67,null, 58,null,65,null, 70,null,65,null],
    };
  }

  getCyberGrid() {
    return {
      kick:  [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
      snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
      hihat: [1,0,1,1, 0,1,1,0, 1,0,1,1, 0,1,1,0],
      bass:  [38,38,null,38, 38,null,null,38, 36,36,null,36, 36,null,null,36],
      lead:  [62,66,69,74, 69,66,62,59, 61,64,68,73, 68,64,61,58],
    };
  }

  getRetroWave() {
    return {
      kick:  [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,1,0],
      snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
      hihat: [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
      bass:  [36,null,null,null, 36,null,null,null, 34,null,null,null, 34,null,null,null],
      lead:  [67,67,70,70, 72,72,74,74, 75,75,74,74, 72,72,70,70],
    };
  }

  getSkylineRush() {
    return {
      kick:  [1,0,0,0, 1,0,1,0, 1,0,0,0, 1,0,1,0],
      snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
      hihat: [1,1,0,1, 1,1,0,1, 1,1,0,1, 1,1,1,1],
      bass:  [40,null,40,43, 45,null,45,47, 38,null,38,42, 43,null,43,47],
      lead:  [72,null,74,76, 79,null,76,74, 71,null,72,74, 79,76,74,72],
    };
  }

  getMidnightCircuit() {
    return {
      kick:  [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
      snare: [0,0,0,0, 0,0,1,0, 0,0,0,0, 0,0,1,0],
      hihat: [0,1,0,1, 0,1,0,1, 0,1,0,1, 0,1,0,1],
      bass:  [33,null,40,null, 33,null,40,null, 36,null,43,null, 36,null,43,null],
      arp:   [69,72,76,81, 72,76,81,84, 67,71,74,79, 71,74,79,83],
    };
  }

  getBossAlarm() {
    return {
      kick:  [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,1],
      snare: [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
      hihat: [1,1,1,1, 1,0,1,0, 1,1,1,1, 1,0,1,0],
      bass:  [31,31,31,null, 34,34,34,null, 29,29,29,null, 31,31,34,36],
      lead:  [60,null,63,null, 67,null,65,null, 58,null,62,null, 67,70,72,null],
    };
  }

  getAuroraPulse() {
    return {
      kick:  [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
      snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
      hihat: [1,0,1,0, 0,1,0,1, 1,0,1,0, 0,1,0,1],
      bass:  [45,null,52,null, 47,null,54,null, 43,null,50,null, 40,null,47,null],
      lead:  [76,null,79,null, 83,null,81,null, 74,null,76,null, 79,null,83,null],
      arp:   [88,91,95,100, 91,95,100,103, 86,89,93,98, 89,93,98,101],
    };
  }

  getSteelHorizon() {
    return {
      kick:  [1,0,0,0, 1,0,1,0, 1,0,0,0, 1,0,1,0],
      snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
      hihat: [1,0,1,0, 1,0,1,0, 1,1,0,1, 1,0,1,0],
      bass:  [36,null,36,40, 43,null,43,45, 35,null,35,38, 40,null,40,43],
      lead:  [67,null,71,74, 76,null,74,71, 66,null,69,73, 74,null,76,78],
    };
  }

  getPixelDrift() {
    return {
      kick:  [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
      snare: [0,0,0,0, 0,0,1,0, 0,0,0,0, 0,0,1,0],
      hihat: [0,1,0,1, 0,1,0,1, 0,1,0,1, 0,1,0,1],
      bass:  [40,null,47,null, 40,null,47,null, 38,null,45,null, 38,null,45,null],
      lead:  [76,79,83,86, 83,79,76,74, 74,76,79,83, 79,76,74,71],
      arp:   [88,91,95,100, 91,95,100,103, 86,90,93,98, 90,93,98,102],
    };
  }

  getInfernoBreaker() {
    return {
      kick:  [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,1,1,1],
      snare: [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
      hihat: [1,1,1,1, 1,1,1,1, 1,1,0,1, 1,1,1,1],
      bass:  [29,29,29,null, 31,31,31,null, 28,28,28,null, 29,31,33,36],
      lead:  [62,null,65,null, 69,null,67,null, 60,null,64,null, 69,72,74,null],
    };
  }

  getPrismRunner() {
    return {
      kick:  [1,0,0,0, 1,0,1,0, 1,0,0,0, 1,0,1,0],
      snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
      hihat: [1,1,0,1, 1,1,0,1, 1,1,0,1, 1,1,1,1],
      bass:  [43,null,43,47, 50,null,50,54, 45,null,45,48, 52,null,52,55],
      lead:  [74,null,78,81, 86,null,83,81, 76,null,79,83, 88,84,81,79],
      arp:   [90,93,97,102, 93,97,102,105, 88,91,95,100, 91,95,100,103],
    };
  }

  // ============================================================================
  // [v4.0.0] 승리/패배 사운드 효과 - Feature 4
  // ============================================================================

  /**
   * 승리 사운드 재생
   * [v4.0.0] 승리 시 웅장한 트라이엄프 코드 재생
   *
   * 특징:
   * - 메이저 코드 아르페지오 (C - E - G - C)
   * - 황금빛 느낌의 사인파 + 삼각파 레이어
   * - 점점 올라가는 멜로디로 승리감 극대화
   *
   * 사용 예시:
   *   audioEngine.playVictorySound();
   */
  playVictorySound() {
    if (this.muted || !this.ctx) return;

    const now = this.ctx.currentTime;

    // 승리 코드: C 메이저 (C4 - E4 - G4 - C5)
    const victoryNotes = [
      { note: 60, time: 0.0, duration: 0.4, type: "sine", gain: 0.15 },     // C4
      { note: 64, time: 0.15, duration: 0.4, type: "sine", gain: 0.15 },  // E4
      { note: 67, time: 0.3, duration: 0.5, type: "sine", gain: 0.15 },   // G4
      { note: 72, time: 0.5, duration: 0.8, type: "triangle", gain: 0.2 }, // C5 (강조)
    ];

    // 메인 멜로디 재생
    for (const n of victoryNotes) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = n.type;
      osc.frequency.setValueAtTime(this.midiToHz(n.note), now + n.time);

      // 어택/디케이 엔벨로프
      gain.gain.setValueAtTime(0.0001, now + n.time);
      gain.gain.exponentialRampToValueAtTime(n.gain, now + n.time + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + n.time + n.duration);

      osc.connect(gain).connect(this.master);
      osc.start(now + n.time);
      osc.stop(now + n.time + n.duration + 0.01);
    }

    // 화음 레이어 (풍성함 추가)
    const harmonyNotes = [
      { note: 48, time: 0.0, duration: 1.2 },  // C3 (베이스)
      { note: 52, time: 0.2, duration: 1.0 },  // E3
      { note: 55, time: 0.4, duration: 0.8 },  // G3
    ];

    for (const n of harmonyNotes) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(this.midiToHz(n.note), now + n.time);

      gain.gain.setValueAtTime(0.0001, now + n.time);
      gain.gain.exponentialRampToValueAtTime(0.08, now + n.time + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + n.time + n.duration);

      osc.connect(gain).connect(this.master);
      osc.start(now + n.time);
      osc.stop(now + n.time + n.duration + 0.01);
    }

    // 피아노 타격음 (짧은 노이즈로 타격감 추가)
    this._playImpactNoise(now, 0.02, 0.08);
    this._playImpactNoise(now + 0.15, 0.02, 0.08);
    this._playImpactNoise(now + 0.3, 0.02, 0.1);
    this._playImpactNoise(now + 0.5, 0.03, 0.12);

    console.log("[AudioEngine] Victory sound played");
  }

  /**
   * 패배 사운드 재생
   * [v4.0.0] 패배 시 슬픈 하강 멜로디 재생
   *
   * 특징:
   * - 마이너 코드 하강 (A - F - D - A)
   * - 점점 낮아지는 디슨드
   * - 어두운 사각파 + 저음 노이즈
   *
   * 사용 예시:
   *   audioEngine.playDefeatSound();
   */
  playDefeatSound() {
    if (this.muted || !this.ctx) return;

    const now = this.ctx.currentTime;

    // 패배 멜로디: 하강하는 마이너 코드 (A4 - F4 - D4 - A3)
    const defeatNotes = [
      { note: 69, time: 0.0, duration: 0.5, type: "sawtooth", gain: 0.12 },  // A4
      { note: 65, time: 0.3, duration: 0.5, type: "sawtooth", gain: 0.1 },  // F4
      { note: 62, time: 0.6, duration: 0.6, type: "sawtooth", gain: 0.08 }, // D4
      { note: 57, time: 1.0, duration: 1.0, type: "square", gain: 0.1 },    // A3 (끝)
    ];

    // 메인 멜로디 재생
    for (const n of defeatNotes) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = n.type;
      osc.frequency.setValueAtTime(this.midiToHz(n.note), now + n.time);

      // 저역 필터로 어두운 느낌
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(800, now + n.time);
      filter.frequency.exponentialRampToValueAtTime(400, now + n.time + n.duration);

      gain.gain.setValueAtTime(0.0001, now + n.time);
      gain.gain.exponentialRampToValueAtTime(n.gain, now + n.time + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + n.time + n.duration);

      osc.connect(filter).connect(gain).connect(this.master);
      osc.start(now + n.time);
      osc.stop(now + n.time + n.duration + 0.01);
    }

    // 저음 붕괴 효과 (서브 베이스)
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();

    subOsc.type = "sine";
    subOsc.frequency.setValueAtTime(55, now); // A1
    subOsc.frequency.exponentialRampToValueAtTime(27.5, now + 1.5); // A0 (하강)

    subGain.gain.setValueAtTime(0.0001, now);
    subGain.gain.exponentialRampToValueAtTime(0.15, now + 0.3);
    subGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.5);

    subOsc.connect(subGain).connect(this.master);
    subOsc.start(now);
    subOsc.stop(now + 1.6);

    // 불길한 노이즈 (바람/폭풍 느낌)
    this._playDarkNoise(now, 1.5, 0.1);

    // 짧은 임팩트 (붕괴 순간)
    setTimeout(() => {
      this.noise(0.2, 0.15);
      this.hit(100, 0.3, 0.2);
    }, 800);

    console.log("[AudioEngine] Defeat sound played");
  }

  /**
   * 임팩트 노이즈 생성 (승리용)
   * [v4.0.0] 피아노 타격음 효과
   *
   * @param {number} time - 시작 시간 (오디오 컨텍스트 기준)
   * @param {number} duration - 지속 시간
   * @param {number} gainAmt - 게인 크기
   */
  _playImpactNoise(time, duration, gainAmt) {
    const buffer = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * duration), this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    // 짧은 노이즈 버스트
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 2000;
    filter.Q.value = 1;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(gainAmt, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    src.connect(filter).connect(gain).connect(this.master);
    src.start(time);
    src.stop(time + duration);
  }

  /**
   * 어두운 노이즈 생성 (패배용)
   * [v4.0.0] 불길한 바람/폭풍 느낌의 노이즈
   *
   * @param {number} time - 시작 시간
   * @param {number} duration - 지속 시간
   * @param {number} gainAmt - 게인 크기
   */
  _playDarkNoise(time, duration, gainAmt) {
    const buffer = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * duration), this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    // 브라운 노이즈 생성 (저음 강조)
    let lastOut = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + (0.02 * white)) / 1.02;
      data[i] = lastOut * 3.5;
    }

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(600, time);
    filter.frequency.exponentialRampToValueAtTime(200, time + duration);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(gainAmt, time + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    src.connect(filter).connect(gain).connect(this.master);
    src.start(time);
    src.stop(time + duration);
  }

  // ============================================================================
  // [v5.0.0] 필살기 스킬 사운드 효과 - Feature 5
  // ============================================================================

  /**
   * 블라인드 스킬 사운드
   * [v5.0.0] 어둠의 장막 느낌의 사운드
   *
   * 특징:
   * - 저역 하강 사운드 (dark sweep)
   * - 깨지는 유리 소리 같은 하이엔드
   * - 어두운 분위기의 드론
   *
   * 사용 예시:
   *   audioEngine.playBlindSkillSound();
   */
  playBlindSkillSound() {
    if (this.muted || !this.ctx) return;

    const now = this.ctx.currentTime;

    // 저역 하강 사운드 (dark sweep down)
    const sweepOsc = this.ctx.createOscillator();
    const sweepGain = this.ctx.createGain();
    const sweepFilter = this.ctx.createBiquadFilter();

    sweepOsc.type = "sawtooth";
    sweepOsc.frequency.setValueAtTime(200, now);
    sweepOsc.frequency.exponentialRampToValueAtTime(40, now + 1.2);

    sweepFilter.type = "lowpass";
    sweepFilter.frequency.setValueAtTime(800, now);
    sweepFilter.frequency.exponentialRampToValueAtTime(100, now + 1.2);
    sweepFilter.Q.value = 5;

    sweepGain.gain.setValueAtTime(0.0001, now);
    sweepGain.gain.exponentialRampToValueAtTime(0.15, now + 0.1);
    sweepGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);

    sweepOsc.connect(sweepFilter).connect(sweepGain).connect(this.master);
    sweepOsc.start(now);
    sweepOsc.stop(now + 1.3);

    // 깨지는 소리 (glass shatter)
    this._playShatterNoise(now + 0.2, 0.6, 0.1);

    // 디스토션 효과 (짧은 노이즈 버스트)
    setTimeout(() => {
      this.noise(0.08, 0.3);
    }, 300);

    console.log("[AudioEngine] Blind skill sound played");
  }

  /**
   * 블록 스왑 스킬 사운드
   * [v5.0.0] 공간 이동/전환 느낌의 사운드
   *
   * 특징:
   * - 텔레포트 효과음 (whoosh + zap)
   * - 공간 왜곡 느낌의 핑크 노이즈
   * - 순간 이동 후 잔향
   *
   * 사용 예시:
   *   audioEngine.playBlockSwapSkillSound();
   */
  playBlockSwapSkillSound() {
    if (this.muted || !this.ctx) return;

    const now = this.ctx.currentTime;

    // 첫 번째 텔레포트
    this._playTeleportSound(now, 0.12);

    // 두 번째 텔레포트 (약간 늦게)
    setTimeout(() => {
      this._playTeleportSound(this.ctx.currentTime, 0.1);
    }, 150);

    // 전기 스파크 효과
    setTimeout(() => {
      this._playSparkSound(this.ctx.currentTime, 0.15);
    }, 200);

    console.log("[AudioEngine] Block swap skill sound played");
  }

  /**
   * 가비지 반사 스킬 사운드
   * [v5.0.0] 방패/반사 느낌의 사운드
   *
   * 특징:
   * - 방패 생성 사운드 (low thud + metallic ring)
   * - 에너지 쉴드 버즈
   * - 반사 완료 시 찰칵 소리
   *
   * 사용 예시:
   *   audioEngine.playGarbageReflectSkillSound();
   */
  playGarbageReflectSkillSound() {
    if (this.muted || !this.ctx) return;

    const now = this.ctx.currentTime;

    // 방패 생성 (low thud + metallic ring)
    const thudOsc = this.ctx.createOscillator();
    const thudGain = this.ctx.createGain();

    thudOsc.type = "sine";
    thudOsc.frequency.setValueAtTime(80, now);
    thudOsc.frequency.exponentialRampToValueAtTime(30, now + 0.3);

    thudGain.gain.setValueAtTime(0.0001, now);
    thudGain.gain.exponentialRampToValueAtTime(0.25, now + 0.02);
    thudGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);

    thudOsc.connect(thudGain).connect(this.master);
    thudOsc.start(now);
    thudOsc.stop(now + 0.5);

    // 메탈릭 링
    const ringOsc = this.ctx.createOscillator();
    const ringGain = this.ctx.createGain();

    ringOsc.type = "triangle";
    ringOsc.frequency.setValueAtTime(880, now);
    ringOsc.frequency.exponentialRampToValueAtTime(440, now + 0.5);

    ringGain.gain.setValueAtTime(0.0001, now);
    ringGain.gain.exponentialRampToValueAtTime(0.1, now + 0.05);
    ringGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);

    ringOsc.connect(ringGain).connect(this.master);
    ringOsc.start(now);
    ringOsc.stop(now + 0.7);

    // 에너지 쉴드 버즈 (지속)
    this._playShieldBuzz(now, 5.0); // 5초 지속

    console.log("[AudioEngine] Garbage reflect skill sound played");
  }

  /**
   * 깨지는 소리 생성
   * [v5.0.0] 블라인드 스킬용 글래스 샤터 효과
   */
  _playShatterNoise(time, duration, gainAmt) {
    const buffer = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * duration), this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    // 화이트 노이즈 + 글리치
    for (let i = 0; i < data.length; i++) {
      let sample = Math.random() * 2 - 1;
      // 글리치 효과
      if (i % 50 === 0) {
        sample *= 3;
      }
      data[i] = sample;
    }

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.setValueAtTime(2000, time);
    filter.frequency.exponentialRampToValueAtTime(8000, time + duration * 0.5);
    filter.frequency.exponentialRampToValueAtTime(1000, time + duration);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(gainAmt, time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    src.connect(filter).connect(gain).connect(this.master);
    src.start(time);
    src.stop(time + duration);
  }

  /**
   * 텔레포트 사운드
   * [v5.0.0] 블록 스왑용 순간 이동 효과
   */
  _playTeleportSound(time, gainAmt) {
    // Whoosh 사운드 (저역 → 고역 sweep)
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = "sine";
    osc.frequency.setValueAtTime(100, time);
    osc.frequency.exponentialRampToValueAtTime(2000, time + 0.15);
    osc.frequency.exponentialRampToValueAtTime(50, time + 0.2);

    filter.type = "bandpass";
    filter.frequency.setValueAtTime(200, time);
    filter.frequency.linearRampToValueAtTime(3000, time + 0.15);
    filter.Q.value = 8;

    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(gainAmt, time + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.25);

    osc.connect(filter).connect(gain).connect(this.master);
    osc.start(time);
    osc.stop(time + 0.3);
  }

  /**
   * 스파크 사운드
   * [v5.0.0] 블록 스왑용 전기 스파크 효과
   */
  _playSparkSound(time, gainAmt) {
    // 짧은 고주파 비프
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "square";
    osc.frequency.setValueAtTime(3000, time);
    osc.frequency.exponentialRampToValueAtTime(1500, time + 0.1);

    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(gainAmt * 0.3, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.12);

    osc.connect(gain).connect(this.master);
    osc.start(time);
    osc.stop(time + 0.15);

    // 노이즈 버스트
    const buffer = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * 0.1), this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(gainAmt * 0.5, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.1);

    src.connect(noiseGain).connect(this.master);
    src.start(time);
  }

  /**
   * 쉴드 버즈
   * [v5.0.0] 가비지 반사용 쉴드 버즈 효과
   */
  _playShieldBuzz(time, duration) {
    // 저역 드론 (지속)
    const droneOsc = this.ctx.createOscillator();
    const droneGain = this.ctx.createGain();

    droneOsc.type = "sawtooth";
    droneOsc.frequency.setValueAtTime(55, time); // A1

    // LFO로 진동
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.type = "sine";
    lfo.frequency.value = 4; // 4Hz 변조
    lfoGain.gain.value = 2;
    lfo.connect(lfoGain);
    lfoGain.connect(droneOsc.frequency);
    lfo.start(time);

    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(300, time);
    filter.Q.value = 3;

    droneGain.gain.setValueAtTime(0.0001, time);
    droneGain.gain.exponentialRampToValueAtTime(0.08, time + 0.3);
    droneGain.gain.setValueAtTime(0.08, time + duration - 0.3);
    droneGain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    droneOsc.connect(filter).connect(droneGain).connect(this.master);
    droneOsc.start(time);
    droneOsc.stop(time + duration);
    lfo.stop(time + duration);

    // 하모닉 오버톤
    const harmonicOsc = this.ctx.createOscillator();
    const harmonicGain = this.ctx.createGain();

    harmonicOsc.type = "sine";
    harmonicOsc.frequency.setValueAtTime(110, time);

    harmonicGain.gain.setValueAtTime(0.0001, time);
    harmonicGain.gain.exponentialRampToValueAtTime(0.05, time + 0.2);
    harmonicGain.gain.setValueAtTime(0.05, time + duration - 0.2);
    harmonicGain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    harmonicOsc.connect(harmonicGain).connect(this.master);
    harmonicOsc.start(time);
    harmonicOsc.stop(time + duration);
  }

  /**
   * 스킬 게이지 MAX 사운드
   * [v5.0.0] 게이지가 MAX가 되었을 때 알림 사운드
   *
   * 사용 예시:
   *   audioEngine.playGaugeMaxSound();
   */
  playGaugeMaxSound() {
    if (this.muted || !this.ctx) return;

    const now = this.ctx.currentTime;

    // 상승하는 화음
    const notes = [
      { note: 62, time: 0, duration: 0.3 },    // D3
      { note: 66, time: 0.05, duration: 0.3 }, // F#3
      { note: 69, time: 0.1, duration: 0.4 },   // A3
      { note: 74, time: 0.15, duration: 0.5 }, // D4
    ];

    for (const n of notes) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(this.midiToHz(n.note), now + n.time);

      gain.gain.setValueAtTime(0.0001, now + n.time);
      gain.gain.exponentialRampToValueAtTime(0.1, now + n.time + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + n.time + n.duration);

      osc.connect(gain).connect(this.master);
      osc.start(now + n.time);
      osc.stop(now + n.time + n.duration);
    }

    // 글로우 효과음
    this.hit(880, 0.08, 0.15);
  }

  // ============================================================================
  // [v6.0.0] 피버 모드 BGM 속도 제어 - Feature 6
  // ============================================================================

  /**
   * 피버 모드 BGM 속도 설정
   * [v6.0.0] 피버 진입/종료 시 BGM 재생 속도 조절
   *
   * 특징:
   * - 1.0x (기본) → 1.3x (피버) 부드러운 전환
   * - BGM 재생 중에도 실시간 속도 변경 가능
   * - 피치 보정을 통해 음정 유지
   *
   * @param {number} speed - 재생 속도 (1.0 = 기본, 1.3 = 피버)
   *   - 1.0: 기본 속도
   *   - 1.3: 피버 모드 속도 (30% 증가)
   *
   * 사용 예시:
   *   const audio = new AudioEngine();
   *
   *   // 피버 진입 시
   *   audio.setFeverBGMSpeed(1.3);
   *
   *   // 피버 종료 시
   *   audio.setFeverBGMSpeed(1.0);
   */
  setFeverBGMSpeed(speed) {
    // 속도 범위 제한 (0.5x ~ 2.0x)
    const clampedSpeed = Math.max(0.5, Math.min(2.0, speed));
    
    const oldRate = this.playbackRate;
    this.targetRate = clampedSpeed;
    
    // [v6.0.0] 부드러운 전환을 위해 즉시 적용하지 않고 목표 값 설정
    // 실제 적용은 updateFeverBGMSpeed에서 점진적으로 수행
    this.playbackRate = clampedSpeed;
    
    // BGM 재생 중이면 타이머 재설정
    if (this.isPlaying) {
      this._startStateBGM(this.bgmState);
    }
    
    console.log(`[AudioEngine] BGM 속도 변경: ${oldRate.toFixed(1)}x → ${clampedSpeed.toFixed(1)}x`);
  }

  /**
   * 현재 BGM 속도 반환
   * [v6.0.0] 현재 재생 속도 확인
   *
   * @returns {number} 현재 재생 속도 (1.0 = 기본)
   *
   * 사용 예시:
   *   const currentSpeed = audio.getCurrentBGMSpeed();
   *   console.log(`현재 BGM 속도: ${currentSpeed}x`);
   */
  getCurrentBGMSpeed() {
    return this.playbackRate;
  }

  /**
   * 피버 BGM 속도 초기화
   * [v6.0.0] 게임 종료/리셋 시 BGM 속도 초기화
   *
   * 사용 예시:
   *   // 게임 오버 시
   *   audio.resetFeverBGMSpeed();
   */
  resetFeverBGMSpeed() {
    this.playbackRate = 1.0;
    this.targetRate = 1.0;
    
    if (this.isPlaying) {
      this._startStateBGM(this.bgmState);
    }
    
    console.log("[AudioEngine] BGM 속도 초기화 (1.0x)");
  }

  // ============================================================================
  // [v7.0.0] 아이템 사운드 효과 - Feature 7
  // ============================================================================

  /**
   * 폭탄 아이템 사운드
   * [v7.0.0] 폭탄 아이템 발동 시 폭발 효과음
   *
   * 특징:
   * - 저역 임팩트 (thump)
   * - 고역 노이즈 (debris)
   * - 지속적인 rumble
   *
   * 사용 예시:
   *   audio.playBombSound();
   */
  playBombSound() {
    if (this.muted || !this.ctx) return;

    const now = this.ctx.currentTime;

    // 저역 임팩트 (폭발의 무게감)
    const impactOsc = this.ctx.createOscillator();
    const impactGain = this.ctx.createGain();
    const impactFilter = this.ctx.createBiquadFilter();

    impactOsc.type = "sine";
    impactOsc.frequency.setValueAtTime(100, now);
    impactOsc.frequency.exponentialRampToValueAtTime(20, now + 0.3);

    impactFilter.type = "lowpass";
    impactFilter.frequency.setValueAtTime(200, now);
    impactFilter.frequency.exponentialRampToValueAtTime(50, now + 0.3);

    impactGain.gain.setValueAtTime(0.0001, now);
    impactGain.gain.exponentialRampToValueAtTime(0.4, now + 0.02);
    impactGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);

    impactOsc.connect(impactFilter).connect(impactGain).connect(this.master);
    impactOsc.start(now);
    impactOsc.stop(now + 0.5);

    // 고역 노이즈 (파편)
    const debrisBuffer = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * 0.4), this.ctx.sampleRate);
    const debrisData = debrisBuffer.getChannelData(0);
    for (let i = 0; i < debrisData.length; i++) {
      debrisData[i] = (Math.random() * 2 - 1) * (1 - i / debrisData.length);
    }

    const debrisSrc = this.ctx.createBufferSource();
    debrisSrc.buffer = debrisBuffer;

    const debrisFilter = this.ctx.createBiquadFilter();
    debrisFilter.type = "highpass";
    debrisFilter.frequency.setValueAtTime(1000, now);
    debrisFilter.frequency.exponentialRampToValueAtTime(3000, now + 0.2);

    const debrisGain = this.ctx.createGain();
    debrisGain.gain.setValueAtTime(0.0001, now);
    debrisGain.gain.exponentialRampToValueAtTime(0.2, now + 0.01);
    debrisGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);

    debrisSrc.connect(debrisFilter).connect(debrisGain).connect(this.master);
    debrisSrc.start(now);

    // Rumble (지진 느낌)
    this._playBombRumble(now);

    console.log("[AudioEngine] Bomb sound played");
  }

  /**
   * 폭탄 럼블
   * [v7.0.0] 폭발 후 지속적인 저역 진동
   */
  _playBombRumble(time) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(40, time);

    // LFO로 주파수 진동
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.type = "sine";
    lfo.frequency.value = 8;
    lfoGain.gain.value = 5;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    lfo.start(time);

    filter.type = "lowpass";
    filter.frequency.value = 100;

    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.15, time + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.8);

    osc.connect(filter).connect(gain).connect(this.master);
    osc.start(time);
    osc.stop(time + 1.0);
    lfo.stop(time + 1.0);
  }

  /**
   * 별 아이템 사운드
   * [v7.0.0] 별 아이템 발동 시 마법적인 효과음
   *
   * 특징:
   * - 화음 상승 (magic chime)
   * - 반짝임 소리
   * - 환호하는 느낌
   *
   * 사용 예시:
   *   audio.playStarSound();
   */
  playStarSound() {
    if (this.muted || !this.ctx) return;

    const now = this.ctx.currentTime;

    // 화음 상승 (마법의 종)
    const chord = [
      { note: 523.25, time: 0 },    // C5
      { note: 659.25, time: 0.05 }, // E5
      { note: 783.99, time: 0.1 },  // G5
      { note: 1046.5, time: 0.15 }, // C6
    ];

    for (const c of chord) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(c.note, now + c.time);

      gain.gain.setValueAtTime(0.0001, now + c.time);
      gain.gain.exponentialRampToValueAtTime(0.15, now + c.time + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + c.time + 0.5);

      osc.connect(gain).connect(this.master);
      osc.start(now + c.time);
      osc.stop(now + c.time + 0.6);

      // 하모닉 추가
      const harmonic = this.ctx.createOscillator();
      const harmonicGain = this.ctx.createGain();

      harmonic.type = "triangle";
      harmonic.frequency.setValueAtTime(c.note * 2, now + c.time);

      harmonicGain.gain.setValueAtTime(0.0001, now + c.time);
      harmonicGain.gain.exponentialRampToValueAtTime(0.05, now + c.time + 0.02);
      harmonicGain.gain.exponentialRampToValueAtTime(0.0001, now + c.time + 0.3);

      harmonic.connect(harmonicGain).connect(this.master);
      harmonic.start(now + c.time);
      harmonic.stop(now + c.time + 0.4);
    }

    // 반짝임 소리 (고역 스파클)
    this._playSparkleSound(now + 0.1);

    console.log("[AudioEngine] Star sound played");
  }

  /**
   * 반짝임 소리
   * [v7.0.0] 별 아이템용 반짝임 효과음
   */
  _playSparkleSound(time) {
    // 짧은 고주파 노이즈 버스트
    for (let i = 0; i < 5; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(2000 + Math.random() * 2000, time + i * 0.05);
      osc.frequency.exponentialRampToValueAtTime(4000, time + i * 0.05 + 0.1);

      gain.gain.setValueAtTime(0.0001, time + i * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.08, time + i * 0.05 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + i * 0.05 + 0.15);

      osc.connect(gain).connect(this.master);
      osc.start(time + i * 0.05);
      osc.stop(time + i * 0.05 + 0.2);
    }
  }

  /**
   * 실드 아이템 사운드
   * [v7.0.0] 실드 아이템 발동 시 보호막 생성 효과음
   *
   * 특징:
   * - 에너지 빌드업
   * - 방패 생성음 (metallic thud)
   * - 지속적인 보호막 버즈
   *
   * 사용 예시:
   *   audio.playShieldSound();
   */
  playShieldSound() {
    if (this.muted || !this.ctx) return;

    const now = this.ctx.currentTime;

    // 에너지 빌드업
    const buildOsc = this.ctx.createOscillator();
    const buildGain = this.ctx.createGain();
    const buildFilter = this.ctx.createBiquadFilter();

    buildOsc.type = "sawtooth";
    buildOsc.frequency.setValueAtTime(200, now);
    buildOsc.frequency.exponentialRampToValueAtTime(600, now + 0.3);

    buildFilter.type = "bandpass";
    buildFilter.frequency.setValueAtTime(400, now);
    buildFilter.frequency.exponentialRampToValueAtTime(1200, now + 0.3);
    buildFilter.Q.value = 5;

    buildGain.gain.setValueAtTime(0.0001, now);
    buildGain.gain.exponentialRampToValueAtTime(0.2, now + 0.2);
    buildGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);

    buildOsc.connect(buildFilter).connect(buildGain).connect(this.master);
    buildOsc.start(now);
    buildOsc.stop(now + 0.5);

    // 방패 생성 (metallic thud + ring)
    setTimeout(() => {
      const thudOsc = this.ctx.createOscillator();
      const thudGain = this.ctx.createGain();

      thudOsc.type = "sine";
      thudOsc.frequency.setValueAtTime(150, now + 0.3);
      thudOsc.frequency.exponentialRampToValueAtTime(50, now + 0.5);

      thudGain.gain.setValueAtTime(0.0001, now + 0.3);
      thudGain.gain.exponentialRampToValueAtTime(0.3, now + 0.32);
      thudGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);

      thudOsc.connect(thudGain).connect(this.master);
      thudOsc.start(now + 0.3);
      thudOsc.stop(now + 0.7);

      // 메탈릭 링
      const ringOsc = this.ctx.createOscillator();
      const ringGain = this.ctx.createGain();

      ringOsc.type = "triangle";
      ringOsc.frequency.setValueAtTime(880, now + 0.3);
      ringOsc.frequency.exponentialRampToValueAtTime(440, now + 0.8);

      ringGain.gain.setValueAtTime(0.0001, now + 0.3);
      ringGain.gain.exponentialRampToValueAtTime(0.15, now + 0.35);
      ringGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.0);

      ringOsc.connect(ringGain).connect(this.master);
      ringOsc.start(now + 0.3);
      ringOsc.stop(now + 1.1);
    }, 300);

    // 보호막 버즈 (짧게)
    this._playShieldActivationBuzz(now + 0.5);

    console.log("[AudioEngine] Shield sound played");
  }

  /**
   * 실드 활성화 버즈
   * [v7.0.0] 실드 생성 시 짧은 버즈음
   */
  _playShieldActivationBuzz(time) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(220, time);

    // LFO로 진동
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.type = "sine";
    lfo.frequency.value = 6;
    lfoGain.gain.value = 3;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    lfo.start(time);

    filter.type = "lowpass";
    filter.frequency.value = 400;
    filter.Q.value = 3;

    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.1, time + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.5);

    osc.connect(filter).connect(gain).connect(this.master);
    osc.start(time);
    osc.stop(time + 0.6);
    lfo.stop(time + 0.6);
  }

  /**
   * 실드 차단 사운드
   * [v7.0.0] 실드로 가비지 공격 차단 시 효과음
   *
   * 사용 예시:
   *   audio.playShieldBlockSound();
   */
  playShieldBlockSound() {
    if (this.muted || !this.ctx) return;

    const now = this.ctx.currentTime;

    // 차단 임팩트
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "square";
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.2);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.25, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);

    osc.connect(gain).connect(this.master);
    osc.start(now);
    osc.stop(now + 0.4);

    // 메탈릭 반향
    const ringOsc = this.ctx.createOscillator();
    const ringGain = this.ctx.createGain();

    ringOsc.type = "triangle";
    ringOsc.frequency.setValueAtTime(660, now);
    ringOsc.frequency.exponentialRampToValueAtTime(330, now + 0.4);

    ringGain.gain.setValueAtTime(0.0001, now);
    ringGain.gain.exponentialRampToValueAtTime(0.1, now + 0.03);
    ringGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);

    ringOsc.connect(ringGain).connect(this.master);
    ringOsc.start(now);
    ringOsc.stop(now + 0.6);

    console.log("[AudioEngine] Shield block sound played");
  }

  /**
   * 아이템 스폰 사운드
   * [v7.0.0] 아이템 블록이 생성될 때 알림음
   *
   * 사용 예시:
   *   audio.playItemSpawnSound();
   */
  playItemSpawnSound() {
    if (this.muted || !this.ctx) return;

    const now = this.ctx.currentTime;

    // 짧은 반짝임 소리
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1760, now + 0.1);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);

    osc.connect(gain).connect(this.master);
    osc.start(now);
    osc.stop(now + 0.2);

    // 하모닉
    const harmonic = this.ctx.createOscillator();
    const harmonicGain = this.ctx.createGain();

    harmonic.type = "triangle";
    harmonic.frequency.setValueAtTime(1320, now);

    harmonicGain.gain.setValueAtTime(0.0001, now);
    harmonicGain.gain.exponentialRampToValueAtTime(0.04, now + 0.02);
    harmonicGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);

    harmonic.connect(harmonicGain).connect(this.master);
    harmonic.start(now);
    harmonic.stop(now + 0.15);
  }

  /**
   * 도전 과제 해제 사운드
   * [v10.0.0] 도전 과제 달성 시 축하 효과음
   *
   * 특징:
   * - 화음 상승 (triumphant chord progression)
   * - 반짝임 소리 (sparkle)
   * - 황금색 느낌의 밝은 음색
   *
   * 사용 예시:
   *   audio.playAchievementUnlockSound();
   */
  playAchievementUnlockSound() {
    if (this.muted || !this.ctx) return;

    const now = this.ctx.currentTime;

    // 주 화음 (C Major -> G Major 진행)
    const chords = [
      // C Major (C-E-G)
      [{ note: 261.63, time: 0 }, { note: 329.63, time: 0.05 }, { note: 392.00, time: 0.1 }],
      // G Major (G-B-D) - 더 높은 옥타브
      [{ note: 392.00, time: 0.2 }, { note: 493.88, time: 0.25 }, { note: 587.33, time: 0.3 }],
      // C Major (C-E-G) - 높은 옥타브로 마무리
      [{ note: 523.25, time: 0.4 }, { note: 659.25, time: 0.45 }, { note: 783.99, time: 0.5 }],
    ];

    // 화음 재생
    for (let chordIndex = 0; chordIndex < chords.length; chordIndex++) {
      const chord = chords[chordIndex];
      for (const c of chord) {
        // 메인 톤
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = "triangle";
        osc.frequency.setValueAtTime(c.note, now + c.time);

        gain.gain.setValueAtTime(0.0001, now + c.time);
        gain.gain.exponentialRampToValueAtTime(0.12, now + c.time + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + c.time + 0.4);

        osc.connect(gain).connect(this.master);
        osc.start(now + c.time);
        osc.stop(now + c.time + 0.5);

        // 하모닉 (밝은 느낌 추가)
        const harmonic = this.ctx.createOscillator();
        const harmonicGain = this.ctx.createGain();

        harmonic.type = "sine";
        harmonic.frequency.setValueAtTime(c.note * 2, now + c.time);

        harmonicGain.gain.setValueAtTime(0.0001, now + c.time);
        harmonicGain.gain.exponentialRampToValueAtTime(0.04, now + c.time + 0.02);
        harmonicGain.gain.exponentialRampToValueAtTime(0.0001, now + c.time + 0.3);

        harmonic.connect(harmonicGain).connect(this.master);
        harmonic.start(now + c.time);
        harmonic.stop(now + c.time + 0.4);
      }
    }

    // 반짝임 효과음 (고역)
    this._playAchievementSparkles(now);

    // 플레이어 충격음 (low thump)
    const thumpOsc = this.ctx.createOscillator();
    const thumpGain = this.ctx.createGain();

    thumpOsc.type = "sine";
    thumpOsc.frequency.setValueAtTime(80, now);
    thumpOsc.frequency.exponentialRampToValueAtTime(40, now + 0.3);

    thumpGain.gain.setValueAtTime(0.0001, now);
    thumpGain.gain.exponentialRampToValueAtTime(0.15, now + 0.05);
    thumpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);

    thumpOsc.connect(thumpGain).connect(this.master);
    thumpOsc.start(now);
    thumpOsc.stop(now + 0.5);

    console.log("[AudioEngine] Achievement unlock sound played");
  }

  /**
   * 도전 과제 반짝임 효과음
   * [v10.0.0] 해제 시 반짝이는 소리
   * @private
   */
  _playAchievementSparkles(time) {
    // 여러 개의 짧은 고주파 노이즈
    for (let i = 0; i < 8; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sine";
      const baseFreq = 2000 + Math.random() * 1500;
      osc.frequency.setValueAtTime(baseFreq, time + i * 0.06);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, time + i * 0.06 + 0.1);

      gain.gain.setValueAtTime(0.0001, time + i * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.06, time + i * 0.06 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + i * 0.06 + 0.15);

      osc.connect(gain).connect(this.master);
      osc.start(time + i * 0.06);
      osc.stop(time + i * 0.06 + 0.2);
    }
  }
}
