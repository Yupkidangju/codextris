/*
 * [v3.14.1] 이펙트 렌더링 엔진
 * 
 * 작성일: 2026-02-28
 * 변경사항: 
 *   - 향상된 파티클 시스템
 *   - 새로운 이펙트 유형 추가
 *   - 화면 흔들림 개선
 *   - 라인 클리어 셀 분해/플래시 연출 추가
 *   - 전투 초반 프리즈 완화를 위한 이펙트 상한 및 밀도 조정
 *   - ScreenImpact 히트스톱/보스/KO 프리셋 추가
 *   - [v3.14.0] 레이어 카운터/Shift 종료 프리셋 추가
 *   - [v3.14.1] 난이도별 화면 흔들림 감쇠 프로파일 조정 API 추가
 */

/**
 * 파티클 및 이펙트 엔진
 */
export class EffectEngine {
  constructor() {
    this.particles = [];
    this.rings = [];
    this.texts = [];
    this.shockwaves = [];
    this.lineFlashes = [];
    this.maxParticles = 220;
    this.maxRings = 12;
    this.maxTexts = 10;
    this.maxShockwaves = 8;
    this.maxLineFlashes = 10;
  }

  pushParticle(particle) {
    // [v3.4.2] 초반 연속 클리어에서도 파티클 배열이 무한히 커지지 않도록 상한을 둔다.
    if (this.particles.length >= this.maxParticles) {
      this.particles.splice(0, this.particles.length - this.maxParticles + 1);
    }
    this.particles.push(particle);
  }

  pushRing(ring) {
    if (this.rings.length >= this.maxRings) {
      this.rings.shift();
    }
    this.rings.push(ring);
  }

  pushText(text) {
    if (this.texts.length >= this.maxTexts) {
      this.texts.shift();
    }
    this.texts.push(text);
  }

  pushShockwave(shockwave) {
    if (this.shockwaves.length >= this.maxShockwaves) {
      this.shockwaves.shift();
    }
    this.shockwaves.push(shockwave);
  }

  pushLineFlash(flash) {
    if (this.lineFlashes.length >= this.maxLineFlashes) {
      this.lineFlashes.shift();
    }
    this.lineFlashes.push(flash);
  }

  /**
   * 폭발 파티클 생성
   * @param {number} x - X 좌표
   * @param {number} y - Y 좌표
   * @param {string} color - 색상
   * @param {number} power - 강도 (1-10)
   * @param {string} type - 타입 ('burst', 'line', 'tspin')
   */
  burst(x, y, color = "#29d7ff", power = 1, type = "burst") {
    const baseCount = type === "tspin" ? 42 : (type === "line" ? 34 : 24);
    const count = Math.min(96, baseCount + Math.floor(power * 14));
    
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.3;
      const speed = 1.5 + Math.random() * 3.5 * power;
      const size = 2 + Math.random() * 4;
      
      this.pushParticle({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.8,
        life: 0.5 + Math.random() * 0.5,
        ttl: 0.5 + Math.random() * 0.5,
        size,
        color,
        type: "particle",
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.2,
      });
    }

    // 충격 링
    this.pushRing({
      x,
      y,
      r: 8,
      maxR: 100 + power * 30,
      life: 0.4,
      ttl: 0.4,
      color,
      power,
      width: 3 + power,
    });
    
    // 쇼크웨이브 (강력한 효과에만)
    if (power >= 3) {
      this.pushShockwave({
        x,
        y,
        r: 5,
        maxR: 200 + power * 50,
        life: 0.6,
        ttl: 0.6,
        color,
        opacity: 0.8,
      });
    }
  }

  /**
   * 라인 클리어 셀 분해 이펙트
   * [v3.4.0] 클리어된 줄의 각 셀에서 파편과 절단 플래시를 생성한다.
   * @param {Array<number>} clearedLines - 클리어된 줄 인덱스
   * @param {number} boardWidth - 보드 가로 셀 수
   * @param {number} cellSize - 셀 크기(px)
   * @param {string} color - 기본 색상
   * @param {number} power - 강도
   * @param {string} tier - single/double/triple/tetris
   */
  lineShatter(clearedLines = [], boardWidth = 10, cellSize = 30, color = "#29d7ff", power = 1, tier = "single") {
    const rows = clearedLines.filter((line) => Number.isFinite(line));
    if (!rows.length) return;

    const widthPx = boardWidth * cellSize;
    const centerY = rows.reduce((sum, row) => sum + row, 0) / rows.length * cellSize + cellSize / 2;
    const intensity = Math.max(1, power);
    const isTspin = tier === "tspin";
    const isPerfect = tier === "perfect";
    const flashTtl = isPerfect ? 0.48 : isTspin ? 0.4 : tier === "tetris" ? 0.38 : tier === "triple" ? 0.32 : tier === "double" ? 0.26 : 0.2;
    const shardCount = isPerfect ? 5 : isTspin ? 4 : tier === "tetris" ? 4 : tier === "triple" ? 3 : tier === "double" ? 2 : 1;

    for (const row of rows) {
      const rowCenterY = row * cellSize + cellSize / 2;
      this.pushLineFlash({
        y: rowCenterY,
        width: widthPx,
        thickness: cellSize * (isPerfect ? 1.06 : isTspin ? 0.94 : tier === "tetris" ? 0.92 : tier === "triple" ? 0.8 : tier === "double" ? 0.68 : 0.52),
        skew: (Math.random() - 0.5) * cellSize * 0.6,
        life: flashTtl,
        ttl: flashTtl,
        color: isPerfect ? "#ffe48b" : color,
        tier,
      });

      for (let col = 0; col < boardWidth; col += 1) {
        const baseX = col * cellSize + cellSize / 2;
        const side = col < boardWidth / 2 ? -1 : 1;
        const spread = 1 + (Math.abs(col - (boardWidth - 1) / 2) / boardWidth) * 0.7;

        for (let i = 0; i < shardCount; i += 1) {
          const angleBase = side < 0 ? Math.PI : 0;
          const angle = angleBase + (Math.random() - 0.5) * 0.9 + ((tier === "tetris" || isTspin || isPerfect) ? (Math.random() - 0.5) * 0.5 : 0);
          const speed = (2.2 + Math.random() * 2.8 + intensity * 0.45) * spread;
          this.pushParticle({
            x: baseX + (Math.random() - 0.5) * cellSize * 0.24,
            y: rowCenterY + (Math.random() - 0.5) * cellSize * 0.18,
            vx: Math.cos(angle) * speed,
            vy: -0.8 - Math.random() * 1.4 - intensity * 0.05,
            life: 0.32 + Math.random() * 0.24 + intensity * 0.015,
            ttl: 0.32 + Math.random() * 0.24 + intensity * 0.015,
            width: cellSize * (0.18 + Math.random() * 0.22),
            height: cellSize * (0.12 + Math.random() * 0.18),
            size: cellSize * 0.22,
            color: isPerfect ? "#ffe48b" : color,
            type: "shard",
            glow: 0.3 + Math.random() * 0.4,
            gravity: 0.12 + Math.random() * 0.08,
            drag: 0.978,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 0.34,
          });
        }

        if (tier !== "single") {
          const sparkCount = isPerfect ? 3 : (tier === "tetris" || isTspin) ? 2 : 1;
          for (let i = 0; i < sparkCount; i += 1) {
            this.pushParticle({
              x: baseX + (Math.random() - 0.5) * cellSize * 0.18,
              y: rowCenterY + (Math.random() - 0.5) * cellSize * 0.12,
              vx: side * (3 + Math.random() * 3.6),
              vy: -1.1 - Math.random() * 2.2,
              life: 0.16 + Math.random() * 0.12,
              ttl: 0.16 + Math.random() * 0.12,
              size: cellSize * 0.08,
              trail: cellSize * (0.22 + Math.random() * 0.18),
              color: isPerfect || tier === "tetris" ? "#ffffff" : color,
              type: "spark",
              gravity: 0.04,
              drag: 0.988,
              rotation: Math.random() * Math.PI * 2,
              rotationSpeed: (Math.random() - 0.5) * 0.18,
            });
          }
        }
      }
    }

    if (tier === "triple" || tier === "tetris" || isTspin || isPerfect) {
      this.pushRing({
        x: widthPx / 2,
        y: centerY,
        r: cellSize * 0.35,
        maxR: widthPx * (isPerfect ? 0.82 : tier === "tetris" ? 0.72 : isTspin ? 0.66 : 0.56),
        life: isPerfect ? 0.48 : tier === "tetris" ? 0.42 : 0.34,
        ttl: isPerfect ? 0.48 : tier === "tetris" ? 0.42 : 0.34,
        color: isPerfect ? "#ffe48b" : color,
        power: intensity,
        width: isPerfect ? 10 : tier === "tetris" ? 8 : 6,
      });
    }

    if (tier === "tetris" || isPerfect) {
      this.pushShockwave({
        x: widthPx / 2,
        y: centerY,
        r: cellSize * 0.25,
        maxR: widthPx * (isPerfect ? 1.08 : 0.95),
        life: isPerfect ? 0.54 : 0.46,
        ttl: isPerfect ? 0.54 : 0.46,
        color: isPerfect ? "#fff8d6" : color,
        opacity: 0.85,
      });
    }
  }

  /**
   * 텍스트 이펙트
   * @param {number} x - X 좌표
   * @param {number} y - Y 좌표
   * @param {string} text - 텍스트
   * @param {string} color - 색상
   * @param {number} scale - 크기
   */
  addText(x, y, text, color = "#fff", scale = 1) {
    this.pushText({
      x,
      y,
      text,
      color,
      scale,
      life: 1.0,
      ttl: 1.0,
      vy: -30,  // 위로 상승
    });
  }

  /**
   * 업데이트
   * @param {number} dt - 델타 시간
   */
  tick(dt) {
    // 파티클 업데이트
    const nextParticles = [];
    for (const p of this.particles) {
      p.life -= dt;
      if (p.life <= 0) continue;
      
      p.x += p.vx * (dt * 60);
      p.y += p.vy * (dt * 60);
      p.vy += p.gravity ?? 0.15;  // 중력
      p.vx *= p.drag ?? 0.985;  // 공기 저항
      p.vy *= p.dragY ?? 1;
      p.rotation += p.rotationSpeed;
      
      nextParticles.push(p);
    }
    this.particles = nextParticles;

    // 라인 플래시 업데이트
    const nextLineFlashes = [];
    for (const flash of this.lineFlashes) {
      flash.life -= dt;
      if (flash.life <= 0) continue;
      nextLineFlashes.push(flash);
    }
    this.lineFlashes = nextLineFlashes;

    // 링 업데이트
    const nextRings = [];
    for (const r of this.rings) {
      r.life -= dt;
      if (r.life <= 0) continue;
      
      const progress = 1 - (r.life / r.ttl);
      r.r = 8 + (r.maxR - 8) * progress;
      
      nextRings.push(r);
    }
    this.rings = nextRings;
    
    // 쇼크웨이브 업데이트
    const nextShockwaves = [];
    for (const s of this.shockwaves) {
      s.life -= dt;
      if (s.life <= 0) continue;
      
      const progress = 1 - (s.life / s.ttl);
      s.r = 5 + (s.maxR - 5) * progress;
      s.opacity = 0.8 * (s.life / s.ttl);
      
      nextShockwaves.push(s);
    }
    this.shockwaves = nextShockwaves;
    
    // 텍스트 업데이트
    const nextTexts = [];
    for (const t of this.texts) {
      t.life -= dt;
      if (t.life <= 0) continue;
      
      t.y += t.vy * dt;
      
      nextTexts.push(t);
    }
    this.texts = nextTexts;
  }

  /**
   * 렌더링
   * @param {CanvasRenderingContext2D} ctx - 캔버스 컨텍스트
   */
  draw(ctx) {
    // 라인 절단 플래시
    for (const flash of this.lineFlashes) {
      const alpha = Math.max(0, flash.life / flash.ttl);
      const thickness = flash.thickness * (0.65 + (1 - alpha) * 0.4);
      const gradient = ctx.createLinearGradient(0, flash.y, flash.width, flash.y + flash.skew);
      gradient.addColorStop(0, "rgba(255,255,255,0)");
      gradient.addColorStop(0.16, `${flash.color}55`);
      gradient.addColorStop(0.5, `${flash.color}ff`);
      gradient.addColorStop(0.84, `${flash.color}55`);
      gradient.addColorStop(1, "rgba(255,255,255,0)");

      ctx.save();
      ctx.globalAlpha = alpha * (flash.tier === "tetris" ? 0.95 : 0.8);
      ctx.fillStyle = gradient;
      ctx.shadowColor = flash.color;
      ctx.shadowBlur = flash.tier === "tetris" ? 28 : 18;
      ctx.fillRect(0, flash.y - thickness / 2, flash.width, thickness);

      ctx.strokeStyle = "rgba(255,255,255,0.45)";
      ctx.lineWidth = Math.max(1, thickness * 0.08);
      ctx.beginPath();
      ctx.moveTo(0, flash.y - thickness * 0.18);
      ctx.lineTo(flash.width, flash.y + flash.skew * 0.16 + thickness * 0.18);
      ctx.stroke();
      ctx.restore();
    }

    // 쇼크웨이브
    for (const s of this.shockwaves) {
      ctx.globalAlpha = s.opacity * (s.life / s.ttl);
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    
    // 링
    for (const r of this.rings) {
      ctx.globalAlpha = (r.life / r.ttl) * 0.8;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.width * (r.life / r.ttl);
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 파티클
    for (const p of this.particles) {
      const alpha = Math.max(0, p.life / p.ttl);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);

      if (p.type === "shard") {
        const width = p.width ?? p.size;
        const height = p.height ?? p.size * 0.6;
        const gradient = ctx.createLinearGradient(-width / 2, -height / 2, width / 2, height / 2);
        gradient.addColorStop(0, "rgba(255,255,255,0.9)");
        gradient.addColorStop(0.22, p.color);
        gradient.addColorStop(1, "rgba(5,8,16,0.7)");
        ctx.fillStyle = gradient;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 10 * (p.glow ?? 0.4);
        ctx.fillRect(-width / 2, -height / 2, width, height);
        ctx.strokeStyle = "rgba(255,255,255,0.35)";
        ctx.lineWidth = 1;
        ctx.strokeRect(-width / 2 + 0.5, -height / 2 + 0.5, width - 1, height - 1);
      } else if (p.type === "spark") {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = Math.max(1, p.size ?? 1.5);
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-(p.trail ?? 6), 0);
        ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      }

      ctx.restore();
    }
    
    // 텍스트
    ctx.save();
    for (const t of this.texts) {
      const alpha = t.life / t.ttl;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = t.color;
      ctx.font = `bold ${24 * t.scale}px "Segoe UI", sans-serif`;
      ctx.textAlign = "center";
      ctx.shadowColor = t.color;
      ctx.shadowBlur = 10;
      ctx.fillText(t.text, t.x, t.y);
      ctx.shadowBlur = 0;
    }
    ctx.restore();

    ctx.globalAlpha = 1;
  }
}

/**
 * 화면 임팩트 효과 (흔들림)
 */
export class ScreenImpact {
  constructor(root) {
    this.root = root;
    this.energy = 0;
    this.decay = 4.0;
    this.maxOffset = 12;
    this.hitstopMs = 0;
  }

  /**
   * 임팩트 발생
   * @param {number} intensity - 강도
   */
  pulse(intensity = 1.0) {
    this.energy = Math.min(2.0, this.energy + intensity);
  }

  setDecay(value = 4.0) {
    this.decay = Math.max(3.6, Math.min(5.4, Number(value) || 4.0));
  }

  lineClear(lines = 1, meta = {}) {
    const base = lines >= 4 ? 2.1 : lines === 3 ? 1.6 : lines === 2 ? 1.2 : 0.9;
    if (meta.tSpin) {
      this.pulse(base + 0.45);
    } else if (meta.perfect) {
      this.pulse(base + 0.8);
    } else {
      this.pulse(base);
    }
    this.hitstop(meta.hitstopMs || (lines >= 4 ? 85 : lines === 3 ? 60 : lines === 2 ? 45 : 30));
  }

  ko() {
    this.pulse(2.7);
    this.hitstop(90);
  }

  bossPhase(phase = 1) {
    this.pulse(1 + Math.max(0, Number(phase) || 1) * 0.32);
    this.hitstop(phase >= 3 ? 90 : 65);
  }

  counter(type = "guard") {
    const intensity = type === "guard" ? 1.45 : type === "forge" ? 1.15 : 1.0;
    this.pulse(intensity);
    this.hitstop(type === "guard" ? 55 : 38);
  }

  shiftFade() {
    this.pulse(0.72);
    this.hitstop(22);
  }

  hitstop(ms = 0) {
    this.hitstopMs = Math.max(this.hitstopMs, Math.max(0, Number(ms) || 0));
  }

  isHitstopActive() {
    return this.hitstopMs > 0;
  }

  /**
   * 업데이트
   * @param {number} dt - 델타 시간
   */
  tick(dt) {
    if (this.hitstopMs > 0) {
      this.hitstopMs = Math.max(0, this.hitstopMs - dt * 1000);
    }
    if (this.energy <= 0) return;
    this.energy = Math.max(0, this.energy - this.decay * dt);

    const offset = Math.min(this.maxOffset, this.energy * this.maxOffset / 2);
    const ox = (Math.random() - 0.5) * offset;
    const oy = (Math.random() - 0.5) * offset;

    this.root.style.setProperty("--shake-x", `${ox}px`);
    this.root.style.setProperty("--shake-y", `${oy}px`);
    this.root.style.setProperty("--impact", this.energy.toFixed(3));

    if (this.energy <= 0.01) {
      this.root.style.setProperty("--shake-x", "0px");
      this.root.style.setProperty("--shake-y", "0px");
      this.root.style.setProperty("--impact", "0");
    }
  }
}

/**
 * 요소 흔들림 효과
 * @param {HTMLElement} el - 대상 요소
 * @param {number} intensity - 강도
 * @param {number} duration - 지속시간 (ms)
 */
export function shakeElement(el, intensity = 8, duration = 300) {
  if (!el) return;
  
  const startTime = performance.now();
  const originalTransform = el.style.transform;
  
  function shake(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = elapsed / duration;
    
    if (progress >= 1) {
      el.style.transform = originalTransform;
      return;
    }
    
    const currentIntensity = intensity * (1 - progress);
    const x = (Math.random() - 0.5) * currentIntensity;
    const y = (Math.random() - 0.5) * currentIntensity;
    
    el.style.transform = `translate(${x}px, ${y}px)`;
    requestAnimationFrame(shake);
  }
  
  requestAnimationFrame(shake);
}

/**
 * 색상 플래시 효과
 * @param {HTMLElement} el - 대상 요소
 * @param {string} color - 색상
 * @param {number} duration - 지속시간 (ms)
 */
export function flashColor(el, color = "#fff", duration = 100) {
  if (!el) return;
  
  el.style.transition = "none";
  el.style.backgroundColor = color;
  
  setTimeout(() => {
    el.style.transition = `background-color ${duration}ms ease`;
    el.style.backgroundColor = "";
  }, 10);
}

/**
 * 승리 이펙트 (골드 샤워)
 * @param {CanvasRenderingContext2D} ctx - 캔버스 컨텍스트
 * @param {number} width - 너비
 * @param {number} height - 높이
 */
export function victoryEffect(ctx, width, height) {
  const particles = [];
  const colors = ["#ffd700", "#ffec8b", "#ffb90f", "#fff8dc"];
  
  // 골드 파티클 생성
  for (let i = 0; i < 200; i++) {
    particles.push({
      x: Math.random() * width,
      y: -Math.random() * height,
      vx: (Math.random() - 0.5) * 2,
      vy: 2 + Math.random() * 3,
      size: 3 + Math.random() * 5,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.1,
    });
  }
  
  let frame = 0;
  function animate() {
    ctx.clearRect(0, 0, width, height);
    
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.rotationSpeed;
      
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    }
    
    frame++;
    if (frame < 300) {
      requestAnimationFrame(animate);
    }
  }
  
  animate();
}

// ============================================================================
// [v2.1.0] 화면 흔들림 (Screen Shake) 시스템
// ============================================================================

/**
 * 화면 흔들림 강도 설정값
 * [v2.1.0] 하드드롭, 4줄 클리어, 게임오버에 따른 3단계 강도 정의
 */
const SHAKE_PRESETS = {
  // 하드드롭: 가벼운 흔들림 (1-2 픽셀, 100-150ms)
  light: {
    maxOffset: 2,      // 최대 2 픽셀
    duration: 0.15,    // 150ms
    decay: 8.0,        // 빠른 감쇠
    frequency: 30,     // 진동 주파수
  },
  // 4줄 클리어(테트리스): 중간 강도 (3-5 픽셀, 200-250ms)
  medium: {
    maxOffset: 5,      // 최대 5 픽셀
    duration: 0.25,    // 250ms
    decay: 4.0,        // 중간 감쇠
    frequency: 25,     // 진동 주파수
  },
  // 게임오버/패배: 강한 흔들림 (5-8 픽셀, 300-400ms)
  heavy: {
    maxOffset: 8,      // 최대 8 픽셀
    duration: 0.4,     // 400ms
    decay: 2.5,        // 느린 감쇠
    frequency: 20,     // 진동 주파수
  },
};

/**
 * ScreenShake 클래스
 * [v2.1.0] 캔버스 기반 렌더링을 위한 화면 흔들림 효과 엔진
 * 
 * 특징:
 * - 3단계 강도 지원 (light/medium/heavy)
 * - 자연스러운 감쇠 커브 적용
 * - 캔버스 오프셋 방식으로 성능 최적화
 * - 진동 패턴을 통한 현실감 있는 흔들림 효과
 */
class ScreenShake {
  constructor() {
    // 현재 흔들림 상태
    this.active = false;       // 활성화 여부
    this.intensity = 0;        // 현재 강도 (0.0 ~ 1.0)
    this.offsetX = 0;          // X축 오프셋
    this.offsetY = 0;          // Y축 오프셋
    
    // 설정값
    this.preset = null;        // 현재 적용된 프리셋
    this.elapsed = 0;          // 경과 시간
    this.seed = 0;             // 진동 패턴 시드
    
    // 애니메이션 프레임 ID
    this.rafId = null;
  }

  /**
   * 흔들림 효과 시작
   * [v2.1.0] 지정된 강도로 화면 흔들림 시작
   * 
   * @param {string} type - 흔들림 타입 ('light' | 'medium' | 'heavy')
   * 
   * 사용 예시:
   *   screenShake.start('light');   // 하드드롭
   *   screenShake.start('medium');  // 4줄 클리어
   *   screenShake.start('heavy');   // 게임오버
   */
  start(type = 'light') {
    const preset = SHAKE_PRESETS[type];
    if (!preset) {
      console.warn(`[ScreenShake] Unknown preset: ${type}`);
      return;
    }

    this.preset = preset;
    this.active = true;
    this.intensity = 1.0;
    this.elapsed = 0;
    this.seed = Math.random() * 1000;
    
    // 이전 애니메이션 취소
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
    }
    
    // 애니메이션 시작
    this._animate();
  }

  /**
   * 흔들림 효과 정지
   * [v2.1.0] 현재 진행 중인 흔들림을 즉시 중지하고 초기화
   */
  stop() {
    this.active = false;
    this.intensity = 0;
    this.offsetX = 0;
    this.offsetY = 0;
    this.elapsed = 0;
    
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /**
   * 내부 애니메이션 루프
   * [v2.1.0] 감쇠 커브를 적용하여 자연스러운 흔들림 구현
   * 
   * 알고리즘:
   * 1. 경과 시간 업데이트
   * 2. 진행률(progress) 계산 (0.0 ~ 1.0)
   * 3. ease-out cubic 감쇠 적용: (1 - progress)^3
   * 4. 사인파 진동으로 X, Y 오프셋 계산
   * 5. duration 도달 시 자동 종료
   */
  _animate() {
    if (!this.active || !this.preset) return;

    const dt = 1 / 60; // 60fps 기준 델타타임
    this.elapsed += dt;
    
    const progress = Math.min(this.elapsed / this.preset.duration, 1.0);
    
    // ease-out cubic 감쇠: (1 - progress)^3
    // 초기에는 선명하게, 후반부로 갈수록 부드럽게 감소
    const decayFactor = Math.pow(1 - progress, 3);
    this.intensity = decayFactor;
    
    // 진동 패턴 계산 (시간 기반 사인파)
    const time = this.elapsed * this.preset.frequency + this.seed;
    const maxOffset = this.preset.maxOffset * decayFactor;
    
    // X, Y 축에 서로 다른 주파수 적용으로 자연스러운 느낌
    this.offsetX = Math.sin(time) * maxOffset;
    this.offsetY = Math.cos(time * 1.3) * maxOffset * 0.7; // Y축은 70% 강도
    
    // 지속 시간 종료 체크
    if (progress >= 1.0) {
      this.stop();
      return;
    }
    
    // 다음 프레임 예약
    this.rafId = requestAnimationFrame(() => this._animate());
  }

  /**
   * 현재 오프셋 값 반환
   * [v2.1.0] 렌더링 시스템에서 캔버스 변환에 사용
   * 
   * @returns {{x: number, y: number}} X, Y 오프셋 값
   * 
   * 사용 예시:
   *   const offset = screenShake.getOffset();
   *   ctx.translate(offset.x, offset.y);
   *   // ... 렌더링 ...
   *   ctx.translate(-offset.x, -offset.y);
   */
  getOffset() {
    return {
      x: this.offsetX,
      y: this.offsetY,
    };
  }

  /**
   * 캔버스 컨텍스트에 오프셋 적용
   * [v2.1.0] 편의 메서드 - ctx.save/restore와 함께 사용
   * 
   * @param {CanvasRenderingContext2D} ctx - 캔버스 컨텍스트
   * @returns {boolean} 오프셋이 적용되었는지 여부
   * 
   * 사용 예시:
   *   if (screenShake.applyToContext(ctx)) {
   *     // 흔들림이 적용된 상태로 렌더링
   *   }
   *   // ctx.restore()로 복원
   */
  applyToContext(ctx) {
    if (!this.active || this.intensity <= 0.01) return false;
    
    ctx.translate(this.offsetX, this.offsetY);
    return true;
  }
}

// 싱글톤 인스턴스 생성
const screenShake = new ScreenShake();

// ============================================================================
// 외부용 API 함수들
// ============================================================================

/**
 * 화면 흔들림 트리거
 * [v2.1.0] 지정된 타입의 화면 흔들림 효과를 시작
 * 
 * @param {string} type - 흔들림 타입
 *   - 'light': 하드드롭 (1-2px, 100-150ms)
 *   - 'medium': 4줄 클리어/테트리스 (3-5px, 200-250ms)
 *   - 'heavy': 게임오버/패배 (5-8px, 300-400ms)
 * 
 * 사용 예시:
 *   import { triggerScreenShake } from './effects.js';
 *   
 *   // 하드드롭 시
 *   triggerScreenShake('light');
 *   
 *   // 4줄 클리어 시
 *   triggerScreenShake('medium');
 *   
 *   // 게임오버 시
 *   triggerScreenShake('heavy');
 */
export function triggerScreenShake(type = 'light') {
  screenShake.start(type);
}

/**
 * 화면 흔들림 업데이트
 * [v2.1.0] 렌더링 루프에서 호출하여 현재 오프셋 값을 가져옴
 * 
 * @returns {{x: number, y: number, active: boolean}} 
 *   현재 오프셋 값과 활성화 상태
 * 
 * 사용 예시:
 *   import { updateScreenShake } from './effects.js';
 *   
 *   function render() {
 *     const shake = updateScreenShake();
 *     if (shake.active) {
 *       ctx.save();
 *       ctx.translate(shake.x, shake.y);
 *     }
 *     // ... 게임 렌더링 ...
 *     if (shake.active) {
 *       ctx.restore();
 *     }
 *   }
 */
export function updateScreenShake() {
  const offset = screenShake.getOffset();
  return {
    x: offset.x,
    y: offset.y,
    active: screenShake.active && screenShake.intensity > 0.01,
    intensity: screenShake.intensity,
  };
}

/**
 * 화면 흔들림 리셋
 * [v2.1.0] 진행 중인 흔들림 효과를 즉시 중지하고 초기화
 * 
 * 사용 예시:
 *   import { resetScreenShake } from './effects.js';
 *   
 *   // 게임 리셋 시
 *   resetScreenShake();
 *   
 *   // 새 라운드 시작 시
 *   resetScreenShake();
 */
export function resetScreenShake() {
  screenShake.stop();
}

/**
 * ScreenShake 인스턴스 직접 접근 (고급 사용)
 * [v2.1.0] 더 세밀한 제어가 필요한 경우 사용
 * 
 * @returns {ScreenShake} ScreenShake 인스턴스
 */
export function getScreenShake() {
  return screenShake;
}

// ============================================================================
// [v2.2.0] 데미지 인디케이터 (Damage Indicator) 시스템
// ============================================================================

/**
 * 가비지 라인 전송 텍스트 설정값
 * [v2.2.0] "-X LINES" 플로팅 텍스트 애니메이션 설정
 */
const GARBAGE_TEXT_CONFIG = {
  // 애니메이션 지속 시간 (초)
  duration: 1.2,
  // 초기 스케일 (1.5x에서 시작)
  startScale: 1.5,
  // 최종 스케일 (1.0x로 수축)
  endScale: 1.0,
  // 상승 속도 (픽셀/초)
  riseSpeed: 40,
  // 폰트 크기 (기본)
  baseFontSize: 28,
  // 그림자 흐림 정도
  shadowBlur: 15,
};

/**
 * 가비지 경고 볼더 설정값
 * [v2.2.0] 위험 수준별 경고 볼더 설정
 */
const WARNING_CONFIG = {
  // 위험 수준 0: 경고 없음
  0: {
    color: null,
    thickness: 0,
    pulseSpeed: 0,
    intensity: 0,
  },
  // 위험 수준 1: 낮은 위험 (노란색)
  1: {
    color: "#ffd700",
    thickness: 4,
    pulseSpeed: 2,
    intensity: 0.3,
  },
  // 위험 수준 2: 중간 위험 (주황색)
  2: {
    color: "#ff8c00",
    thickness: 6,
    pulseSpeed: 3,
    intensity: 0.6,
  },
  // 위험 수준 3: 높은 위험 (빨간색)
  3: {
    color: "#ff2a2a",
    thickness: 8,
    pulseSpeed: 4,
    intensity: 1.0,
  },
};

/**
 * DamageIndicator 클래스
 * [v2.2.0] 가비지 라인 전송 및 수신 경고를 시각적으로 표시하는 인디케이터 시스템
 * 
 * 기능:
 * - 가비지 전송 시 "-X LINES" 플로팅 텍스트 애니메이션
 * - 가비지 수신 예고 시 펄싱 볼더 경고 효과
 * - 위험 수준에 따른 색상 및 강도 변화 (노랑 → 주황 → 빨강)
 */
class DamageIndicator {
  constructor() {
    // 활성화된 플로팅 텍스트 목록
    this.floatingTexts = [];
    
    // 현재 경고 수준 (0-3)
    this.warningLevel = 0;
    
    // 경고 애니메이션 상태
    this.warningPulse = 0;
    this.warningTime = 0;
    
    // 보드 크기 (외부에서 설정)
    this.boardWidth = 0;
    this.boardHeight = 0;
  }

  /**
   * 가비지 전송 텍스트 표시
   * [v2.2.0] "-X LINES" 플로팅 텍스트 애니메이션 생성
   * 
   * @param {number} lines - 전송할 라인 수
   * @param {number} x - 시작 X 좌표
   * @param {number} y - 시작 Y 좌표
   * 
   * 사용 예시:
   *   damageIndicator.showGarbageSendText(4, 200, 300);
   *   // "-4 LINES" 텍스트가 (200, 300)에서 생성되어 위로 상승
   */
  showGarbageSendText(lines, x, y) {
    // 그라데이션 색상 생성 (빨강 → 주황)
    const gradientColors = this._createGradientColors(lines);
    
    this.floatingTexts.push({
      x,
      y,
      text: `-${lines} LINES`,
      lines,
      life: GARBAGE_TEXT_CONFIG.duration,
      ttl: GARBAGE_TEXT_CONFIG.duration,
      scale: GARBAGE_TEXT_CONFIG.startScale,
      colors: gradientColors,
      opacity: 1.0,
    });
  }

  /**
   * 위험 수준에 따른 그라데이션 색상 생성
   * [v2.2.0] 라인 수에 따라 색상 강도 조정
   * 
   * @param {number} lines - 라인 수
   * @returns {Object} 시작 및 종료 색상
   */
  _createGradientColors(lines) {
    // 라인 수에 따른 색상 강도 계산
    const intensity = Math.min(1, (lines - 1) / 3);
    
    // 시작 색상 (밝은 빨강/주황)
    const startHue = 10 + intensity * 20; // 10° ~ 30°
    const startColor = `hsl(${startHue}, 100%, 60%)`;
    
    // 종료 색상 (어두운 빨강)
    const endHue = 0;
    const endColor = `hsl(${endHue}, 100%, ${45 - intensity * 10}%)`;
    
    return {
      start: startColor,
      end: endColor,
      glow: `hsl(${startHue}, 100%, 70%)`,
    };
  }

  /**
   * 가비지 경고 수준 설정
   * [v2.2.0] 수신 예정인 가비지 라인 수에 따른 경고 강도 설정
   * 
   * @param {number} level - 경고 수준 (0-3)
   *   - 0: 경고 없음
   *   - 1: 낮은 위험 (1-2줄, 노란색)
   *   - 2: 중간 위험 (3-4줄, 주황색)
   *   - 3: 높은 위험 (5줄 이상, 빨간색)
   * 
   * 사용 예시:
   *   damageIndicator.setGarbageWarningLevel(2); // 중간 위험
   */
  setGarbageWarningLevel(level) {
    this.warningLevel = Math.max(0, Math.min(3, level));
    
    // 경고가 설정되면 펄스 애니메이션 시작
    if (this.warningLevel > 0) {
      this.warningTime = 0;
    }
  }

  /**
   * 가비지 경고 초기화
   * [v2.2.0] 현재 경고 상태를 즉시 해제
   * 
   * 사용 예시:
   *   damageIndicator.clearGarbageWarning(); // 가비지 처리 완료 시
   */
  clearGarbageWarning() {
    this.warningLevel = 0;
    this.warningPulse = 0;
    this.warningTime = 0;
  }

  /**
   * 업데이트
   * [v2.2.0] 모든 데미지 인디케이터 애니메이션 상태 갱신
   * 
   * @param {number} dt - 델타 시간 (초)
   */
  update(dt) {
    // 플로팅 텍스트 업데이트
    const nextTexts = [];
    for (const text of this.floatingTexts) {
      text.life -= dt;
      if (text.life <= 0) continue;
      
      const progress = 1 - (text.life / text.ttl);
      
      // 위로 상승
      text.y -= GARBAGE_TEXT_CONFIG.riseSpeed * dt;
      
      // 스케일 감소 (1.5x → 1.0x)
      const scaleProgress = progress;
      text.scale = GARBAGE_TEXT_CONFIG.startScale - 
                   (GARBAGE_TEXT_CONFIG.startScale - GARBAGE_TEXT_CONFIG.endScale) * scaleProgress;
      
      // 페이드 아웃 (후반 30%에서 시작)
      if (progress > 0.7) {
        text.opacity = 1 - (progress - 0.7) / 0.3;
      }
      
      nextTexts.push(text);
    }
    this.floatingTexts = nextTexts;
    
    // 경고 펄스 업데이트
    if (this.warningLevel > 0) {
      const config = WARNING_CONFIG[this.warningLevel];
      this.warningTime += dt;
      
      // 사인파 기반 펄스 (0.5초 주기)
      const pulseCycle = this.warningTime * config.pulseSpeed;
      this.warningPulse = 0.5 + 0.5 * Math.sin(pulseCycle * Math.PI * 2);
    }
  }

  /**
   * 렌더링
   * [v2.2.0] 모든 데미지 인디케이터 효과 그리기
   * 
   * @param {CanvasRenderingContext2D} ctx - 캔버스 컨텍스트
   * @param {number} boardX - 보드 좌상단 X 좌표
   * @param {number} boardY - 보드 좌상단 Y 좌표
   * @param {number} boardWidth - 보드 너비
   * @param {number} boardHeight - 보드 높이
   */
  render(ctx, boardX, boardY, boardWidth, boardHeight) {
    // 가비지 경고 볼더 렌더링
    if (this.warningLevel > 0) {
      this._renderWarningBorder(ctx, boardX, boardY, boardWidth, boardHeight);
    }
    
    // 플로팅 텍스트 렌더링
    this._renderFloatingTexts(ctx);
  }

  /**
   * 경고 볼더 렌더링 (남부)
   * [v2.2.0] 보드 하단에 펄싱 경고 볼더 표시
   * 
   * @param {CanvasRenderingContext2D} ctx - 캔버스 컨텍스트
   * @param {number} boardX - 보드 좌상단 X
   * @param {number} boardY - 보드 좌상단 Y
   * @param {number} boardWidth - 보드 너비
   * @param {number} boardHeight - 보드 높이
   */
  _renderWarningBorder(ctx, boardX, boardY, boardWidth, boardHeight) {
    const config = WARNING_CONFIG[this.warningLevel];
    if (!config.color) return;
    
    // 펄스에 따른 투명도 및 두께 계산
    const pulseAlpha = 0.4 + this.warningPulse * 0.6 * config.intensity;
    const pulseThickness = config.thickness * (0.8 + this.warningPulse * 0.4);
    
    ctx.save();
    
    // 볼더 그림자 효과
    ctx.shadowColor = config.color;
    ctx.shadowBlur = 10 + this.warningPulse * 15;
    
    // 볼더 선 그리기 (보드 하단)
    ctx.strokeStyle = config.color;
    ctx.lineWidth = pulseThickness;
    ctx.globalAlpha = pulseAlpha;
    
    // 하단 볼더 (가비지가 아래에서 올라옴을 표시)
    ctx.beginPath();
    ctx.moveTo(boardX, boardY + boardHeight);
    ctx.lineTo(boardX + boardWidth, boardY + boardHeight);
    ctx.stroke();
    
    // 좌우 볼더 (선택적 - 높은 위험 수준에서만)
    if (this.warningLevel >= 2) {
      ctx.beginPath();
      ctx.moveTo(boardX, boardY + boardHeight * 0.7);
      ctx.lineTo(boardX, boardY + boardHeight);
      ctx.moveTo(boardX + boardWidth, boardY + boardHeight * 0.7);
      ctx.lineTo(boardX + boardWidth, boardY + boardHeight);
      ctx.stroke();
    }
    
    // 최고 위험 수준: 상단까지 볼더 확장
    if (this.warningLevel >= 3) {
      ctx.beginPath();
      ctx.moveTo(boardX, boardY);
      ctx.lineTo(boardX, boardY + boardHeight);
      ctx.moveTo(boardX + boardWidth, boardY);
      ctx.lineTo(boardX + boardWidth, boardY + boardHeight);
      ctx.moveTo(boardX, boardY);
      ctx.lineTo(boardX + boardWidth, boardY);
      ctx.stroke();
    }
    
    ctx.restore();
  }

  /**
   * 플로팅 텍스트 렌더링
   * [v2.2.0] "-X LINES" 애니메이션 텍스트 그리기
   * 
   * @param {CanvasRenderingContext2D} ctx - 캔버스 컨텍스트
   */
  _renderFloatingTexts(ctx) {
    ctx.save();
    
    for (const text of this.floatingTexts) {
      ctx.globalAlpha = text.opacity;
      
      // 그라데이션 텍스트 생성
      const fontSize = GARBAGE_TEXT_CONFIG.baseFontSize * text.scale;
      ctx.font = `bold ${fontSize}px "Segoe UI", "Arial", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      
      // 그림자 효과
      ctx.shadowColor = text.colors.glow;
      ctx.shadowBlur = GARBAGE_TEXT_CONFIG.shadowBlur * text.scale;
      
      // 텍스트 그리기
      ctx.fillStyle = text.colors.start;
      ctx.fillText(text.text, text.x, text.y);
      
      // 추가 외곽선 (강조)
      ctx.strokeStyle = text.colors.end;
      ctx.lineWidth = 2;
      ctx.strokeText(text.text, text.x, text.y);
    }
    
    ctx.restore();
  }
}

// 싱글톤 인스턴스 생성
const damageIndicator = new DamageIndicator();

// ============================================================================
// 데미지 인디케이터 외부용 API 함수들
// ============================================================================

/**
 * 가비지 전송 텍스트 표시
 * [v2.2.0] "-X LINES" 플로팅 텍스트 애니메이션 트리거
 * 
 * @param {number} lines - 전송할 라인 수
 * @param {number} x - 시작 X 좌표 (기본값: 보드 중앙)
 * @param {number} y - 시작 Y 좌표 (기본값: 보드 상단)
 * 
 * 사용 예시:
 *   import { showGarbageSendText } from './effects.js';
 *   
 *   // 4줄 클리어로 가비지 전송
 *   showGarbageSendText(4, 200, 250);
 *   
 *   // T-Spin Double로 가비지 전송
 *   showGarbageSendText(2, 200, 250);
 */
export function showGarbageSendText(lines, x, y) {
  damageIndicator.showGarbageSendText(lines, x, y);
}

/**
 * 가비지 경고 수준 설정
 * [v2.2.0] 수신 예정인 가비지에 따른 경고 볼더 강도 설정
 * 
 * @param {number} level - 경고 수준 (0-3)
 *   - 0: 경고 없음 (가비지 없음)
 *   - 1: 낮은 위험 (1-2줄 예정, 노란색 볼더)
 *   - 2: 중간 위험 (3-4줄 예정, 주황색 볼더)
 *   - 3: 높은 위험 (5줄 이상 예정, 빨간색 볼더)
 * 
 * 사용 예시:
 *   import { setGarbageWarningLevel } from './effects.js';
 *   
 *   // 상대방이 4줄 클리어 (테트리스)를 했을 때
 *   setGarbageWarningLevel(2);
 *   
 *   // 가비지가 쌓여 위험할 때
 *   setGarbageWarningLevel(3);
 */
export function setGarbageWarningLevel(level) {
  damageIndicator.setGarbageWarningLevel(level);
}

/**
 * 데미지 인디케이터 업데이트
 * [v2.2.0] 렌더링 루프에서 호출하여 애니메이션 상태 갱신
 * 
 * @param {number} dt - 델타 시간 (초)
 * 
 * 사용 예시:
 *   import { updateDamageIndicators } from './effects.js';
 *   
 *   function gameLoop(deltaTime) {
 *     updateDamageIndicators(deltaTime);
 *     // ... 다른 업데이트 로직
 *   }
 */
export function updateDamageIndicators(dt) {
  damageIndicator.update(dt);
}

/**
 * 데미지 인디케이터 렌더링
 * [v2.2.0] 모든 데미지 관련 시각 효과 그리기
 * 
 * @param {CanvasRenderingContext2D} ctx - 캔버스 컨텍스트
 * @param {number} boardX - 보드 좌상단 X 좌표
 * @param {number} boardY - 보드 좌상단 Y 좌표
 * @param {number} boardWidth - 보드 너비 (기본값: 200)
 * @param {number} boardHeight - 보드 높이 (기본값: 400)
 * 
 * 사용 예시:
 *   import { renderDamageIndicators } from './effects.js';
 *   
 *   function render() {
 *     // 보드 렌더링
 *     renderBoard(ctx);
 *     
 *     // 데미지 인디케이터 렌더링 (보드 위에 표시)
 *     renderDamageIndicators(ctx, 50, 50, 200, 400);
 *   }
 */
export function renderDamageIndicators(
  ctx,
  boardX,
  boardY,
  boardWidth = 200,
  boardHeight = 400
) {
  damageIndicator.render(ctx, boardX, boardY, boardWidth, boardHeight);
}

/**
 * 가비지 경고 초기화
 * [v2.2.0] 현재 경고 상태를 즉시 해제하고 볼더 숨기기
 * 
 * 사용 예시:
 *   import { clearGarbageWarning } from './effects.js';
 *   
 *   // 가비지가 실제로 보드에 추가되었을 때
 *   clearGarbageWarning();
 *   
 *   // 게임 리셋 시
 *   clearGarbageWarning();
 */
export function clearGarbageWarning() {
  damageIndicator.clearGarbageWarning();
}

/**
 * DamageIndicator 인스턴스 직접 접근 (고급 사용)
 * [v2.2.0] 더 세밀한 제어가 필요한 경우 사용
 * 
 * @returns {DamageIndicator} DamageIndicator 인스턴스
 */
export function getDamageIndicator() {
  return damageIndicator;
}

// ============================================================================
// 콤보 디스플레이 시스템 - Feature 3
// ============================================================================

/**
 * 콤보 색상 및 크기 설정
 * [v3.0.0] 콤보 단계별 시각적 속성 정의
 */
const COMBO_CONFIG = {
  // 콤보 단계별 색상 (White → Yellow → Orange → Red)
  colors: {
    2: { main: "#FFFFFF", glow: "#E0E0E0", stroke: "#B0B0B0" },      // 화이트
    3: { main: "#FFFF99", glow: "#FFFF66", stroke: "#CCCC00" },      // 라이트 옐로우
    4: { main: "#FFEB3B", glow: "#FFD700", stroke: "#FFA500" },      // 옐로우
    5: { main: "#FFC107", glow: "#FFB300", stroke: "#FF8F00" },      // 엠버
    6: { main: "#FF9800", glow: "#FF8A65", stroke: "#E65100" },      // 오렌지
    7: { main: "#FF7043", glow: "#FF5722", stroke: "#D84315" },      // 딥 오렌지
    8: { main: "#FF5252", glow: "#FF1744", stroke: "#C62828" },      // 레드 오렌지
    9: { main: "#FF1744", glow: "#F50057", stroke: "#880E4F" },      // 핑크 레드
    10: { main: "#FF0000", glow: "#FF1744", stroke: "#8B0000" },     // 인텐스 레드
    15: { main: "#DC143C", glow: "#FF0066", stroke: "#4A0000" },     // 크림슨
    20: { main: "#8B0000", glow: "#FF1493", stroke: "#2A0000" },     // 다크 레드 + 핑크 글로우
  },
  // 콤보 단계별 크기 (Small → Large → Giant)
  scales: {
    small: { min: 2, max: 4, base: 1.0, maxScale: 1.3 },     // 2-4 콤보
    medium: { min: 5, max: 9, base: 1.4, maxScale: 1.8 },    // 5-9 콤보
    large: { min: 10, max: 14, base: 2.0, maxScale: 2.4 },   // 10-14 콤보
    giant: { min: 15, max: Infinity, base: 2.6, maxScale: 3.0 }, // 15+ 콤보
  },
  // 애니메이션 설정
  animation: {
    fadeDelay: 2.0,        // 페이드 아웃 시작까지 대기 시간 (초)
    fadeDuration: 0.5,     // 페이드 아웃 지속 시간 (초)
    bounceDecay: 5.0,      // 바운스 감쇠 속도
    popInDuration: 0.15,   // 팝인 애니메이션 지속 시간
  },
  // 폰트 설정
  font: {
    family: '"Segoe UI Black", "Arial Black", "Impact", sans-serif',
    baseSize: 48,
    shadowBlur: 15,
    strokeWidth: 3,
  },
};

/**
 * ComboDisplay 클래스
 * [v3.0.0] 거대한 콤보 카운터 디스플레이 시스템
 * 
 * 기능:
 * - 화면 중앙에 콤보 숫자 표시 (2+ 콤볼)
 * - 단계별 크기 및 색상 변화
 * - 팝인/바운스 애니메이션
 * - 2초 후 페이드 아웃
 */
class ComboDisplay {
  constructor() {
    this.currentCombo = 0;
    this.displayCombo = 0;
    this.opacity = 0;
    this.scale = 1.0;
    this.targetScale = 1.0;
    this.bounce = 0;
    this.timeSinceLastClear = 0;
    this.isVisible = false;
    this.popInProgress = 0;
    
    // 콤보 사운드 콜백 (외부에서 설정)
    this.soundCallback = null;
  }

  /**
   * 사운드 콜백 설정
   * [v3.0.0] 콤보 사운드 재생을 위한 콜백 등록
   * 
   * @param {Function} callback - 사운드 재생 콜백 함수
   */
  setSoundCallback(callback) {
    this.soundCallback = callback;
  }

  /**
   * 콤보 트리거
   * [v3.0.0] 새로운 콤보 발생 시 호출
   * 
   * @param {number} comboCount - 현재 콤보 수 (2+)
   * 
   * 사용 예시:
   *   comboDisplay.triggerCombo(5); // 5콤보 표시
   */
  triggerCombo(comboCount) {
    if (comboCount < 2) {
      this.reset();
      return;
    }

    const isNewMilestone = comboCount > this.currentCombo;
    this.currentCombo = comboCount;
    this.displayCombo = comboCount;
    this.timeSinceLastClear = 0;
    this.isVisible = true;
    this.opacity = 1.0;
    
    // 새로운 마일스톤일 때만 팝인 및 바운스 효과
    if (isNewMilestone) {
      this.popInProgress = 0;
      this.bounce = 1.0;
      
      // 단계별 크기 계산
      this.targetScale = this._getScaleForCombo(comboCount);
      this.scale = this.targetScale * 0.5; // 팝인 시작 크기
      
      // 사운드 재생 (콜백이 설정된 경우)
      if (this.soundCallback) {
        this.soundCallback(comboCount);
      }
    }
  }

  /**
   * 콤보 단계별 크기 계산
   * [v3.0.0] 콤보 수에 따른 디스플레이 크기 반환
   * 
   * @param {number} combo - 콤보 수
   * @returns {number} 계산된 스케일 값
   */
  _getScaleForCombo(combo) {
    const { scales } = COMBO_CONFIG;
    
    if (combo >= scales.giant.min) {
      return scales.giant.base + Math.min(combo - scales.giant.min, 5) * 0.1;
    } else if (combo >= scales.large.min) {
      const progress = (combo - scales.large.min) / (scales.large.max - scales.large.min);
      return scales.large.base + progress * (scales.large.maxScale - scales.large.base);
    } else if (combo >= scales.medium.min) {
      const progress = (combo - scales.medium.min) / (scales.medium.max - scales.medium.min);
      return scales.medium.base + progress * (scales.medium.maxScale - scales.medium.base);
    } else {
      const progress = (combo - scales.small.min) / (scales.small.max - scales.small.min);
      return scales.small.base + progress * (scales.small.maxScale - scales.small.base);
    }
  }

  /**
   * 콤보 단계별 색상 계산
   * [v3.0.0] 콤보 수에 따른 색상 반환
   * 
   * @param {number} combo - 콤보 수
   * @returns {Object} 색상 객체 {main, glow, stroke}
   */
  _getColorsForCombo(combo) {
    const { colors } = COMBO_CONFIG;
    
    if (combo >= 20) return colors[20];
    if (combo >= 15) return colors[15];
    if (combo >= 10) return colors[10];
    if (colors[combo]) return colors[combo];
    
    // 중간값 보간
    const keys = Object.keys(colors).map(Number).sort((a, b) => a - b);
    for (let i = 0; i < keys.length - 1; i++) {
      if (combo > keys[i] && combo < keys[i + 1]) {
        return colors[keys[i + 1]]; // 더 높은 단계의 색상 사용
      }
    }
    
    return colors[2];
  }

  /**
   * 업데이트
   * [v3.0.0] 콤보 디스플레이 애니메이션 상태 갱신
   * 
   * @param {number} dt - 델타 시간 (초)
   */
  update(dt) {
    if (!this.isVisible) return;

    // 팝인 애니메이션
    if (this.popInProgress < 1) {
      this.popInProgress += dt / COMBO_CONFIG.animation.popInDuration;
      if (this.popInProgress > 1) this.popInProgress = 1;
      
      // 이징 함수 (ease-out-back)
      const t = this.popInProgress;
      const c1 = 1.70158;
      const c3 = c1 + 1;
      const easeOut = 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
      
      this.scale = this.targetScale * (0.5 + 0.5 * easeOut);
    } else {
      this.scale = this.targetScale;
    }

    // 바운스 감쇠
    if (this.bounce > 0) {
      this.bounce -= dt * COMBO_CONFIG.animation.bounceDecay;
      if (this.bounce < 0) this.bounce = 0;
    }

    // 페이드 아웃 타이머
    this.timeSinceLastClear += dt;
    
    const fadeStart = COMBO_CONFIG.animation.fadeDelay;
    const fadeEnd = fadeStart + COMBO_CONFIG.animation.fadeDuration;
    
    if (this.timeSinceLastClear >= fadeStart) {
      const fadeProgress = (this.timeSinceLastClear - fadeStart) / COMBO_CONFIG.animation.fadeDuration;
      this.opacity = Math.max(0, 1 - fadeProgress);
      
      if (this.opacity <= 0) {
        this.isVisible = false;
      }
    }
  }

  /**
   * 렌더링
   * [v3.0.0] 콤보 숫자를 화면에 그리기
   * 
   * @param {CanvasRenderingContext2D} ctx - 캔버스 컨텍스트
   * @param {number} centerX - 중앙 X 좌표
   * @param {number} centerY - 중앙 Y 좌표
   */
  render(ctx, centerX, centerY) {
    if (!this.isVisible || this.opacity <= 0) return;

    const colors = this._getColorsForCombo(this.displayCombo);
    const { font } = COMBO_CONFIG;
    
    // 바운스 효과 적용 (약간의 스케일 변화)
    const bounceScale = 1 + Math.sin(this.bounce * Math.PI) * 0.1;
    const finalScale = this.scale * bounceScale;
    
    const fontSize = font.baseSize * finalScale;
    
    ctx.save();
    
    // 그림자 효과 (드롭 섀도우)
    ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 4;
    ctx.shadowOffsetY = 4;
    
    // 글로우 효과
    ctx.shadowColor = colors.glow;
    ctx.shadowBlur = font.shadowBlur * finalScale;
    
    // 텍스트 설정
    ctx.font = `bold ${fontSize}px ${font.family}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.globalAlpha = this.opacity;
    
    // "COMBO" 라벨 (작게, 숫자 위에)
    const labelSize = fontSize * 0.35;
    ctx.font = `bold ${labelSize}px ${font.family}`;
    ctx.fillStyle = colors.main;
    ctx.fillText("COMBO", centerX, centerY - fontSize * 0.5);
    
    // 콤보 숫자
    ctx.font = `bold ${fontSize}px ${font.family}`;
    ctx.fillStyle = colors.main;
    
    // 외곽선 (가독성 향상)
    ctx.strokeStyle = colors.stroke;
    ctx.lineWidth = font.strokeWidth * finalScale;
    ctx.lineJoin = "round";
    
    const displayText = String(this.displayCombo);
    ctx.strokeText(displayText, centerX, centerY + fontSize * 0.1);
    ctx.fillText(displayText, centerX, centerY + fontSize * 0.1);
    
    ctx.restore();
  }

  /**
   * 리셋
   * [v3.0.0] 콤보 디스플레이 초기화 (게임 오버/새 게임 시)
   */
  reset() {
    this.currentCombo = 0;
    this.displayCombo = 0;
    this.opacity = 0;
    this.scale = 1.0;
    this.targetScale = 1.0;
    this.bounce = 0;
    this.timeSinceLastClear = 0;
    this.isVisible = false;
    this.popInProgress = 0;
  }

  /**
   * 현재 콤보 수 반환
   * [v3.0.0] 외부에서 현재 콤보 상태 확인
   * 
   * @returns {number} 현재 콤보 수
   */
  getCurrentCombo() {
    return this.currentCombo;
  }

  /**
   * 표시 여부 확인
   * [v3.0.0] 현재 콤보 디스플레이가 보이는지 확인
   * 
   * @returns {boolean} 표시 여부
   */
  isDisplayVisible() {
    return this.isVisible;
  }
}

// 싱글톤 인스턴스 생성
const comboDisplay = new ComboDisplay();

// ============================================================================
// 콤보 디스플레이 외부용 API 함수들
// ============================================================================

/**
 * 콤보 트리거
 * [v3.0.0] 새로운 콤보 발생 시 디스플레이 및 사운드 효과 실행
 * 
 * @param {number} comboCount - 현재 콤보 수 (2+)
 * 
 * 사용 예시:
   import { triggerCombo } from './effects.js';
   
   // 라인 클리어 시 콤보 업데이트
   triggerCombo(currentCombo);
   
   // 콤보 리셋 (1콤보 이하)
   triggerCombo(0);
 */
export function triggerCombo(comboCount) {
  comboDisplay.triggerCombo(comboCount);
}

/**
 * 콤보 디스플레이 업데이트
 * [v3.0.0] 렌더링 루프에서 호출하여 애니메이션 상태 갱신
 * 
 * @param {number} dt - 델타 시간 (초)
 * 
 * 사용 예시:
   import { updateComboDisplay } from './effects.js';
   
   function gameLoop(deltaTime) {
     updateComboDisplay(deltaTime);
     // ... 다른 업데이트 로직
   }
 */
export function updateComboDisplay(dt) {
  comboDisplay.update(dt);
}

/**
 * 콤보 디스플레이 렌더링
 * [v3.0.0] 화면 중앙에 콤보 숫자 그리기
 * 
 * @param {CanvasRenderingContext2D} ctx - 캔버스 컨텍스트
 * @param {number} centerX - 중앙 X 좌표
 * @param {number} centerY - 중앙 Y 좌표
 * 
 * 사용 예시:
   import { renderComboDisplay } from './effects.js';
   
   function render() {
     // 보드 렌더링
     renderBoard(ctx);
     
     // 콤보 디스플레이 렌더링 (보드 중앙)
     const boardCenterX = boardX + boardWidth / 2;
     const boardCenterY = boardY + boardHeight / 2;
     renderComboDisplay(ctx, boardCenterX, boardCenterY);
   }
 */
export function renderComboDisplay(ctx, centerX, centerY) {
  comboDisplay.render(ctx, centerX, centerY);
}

/**
 * 콤보 디스플레이 리셋
 * [v3.0.0] 게임 오버 또는 새 게임 시 콤보 표시 초기화
 * 
 * 사용 예시:
   import { resetComboDisplay } from './effects.js';
   
   // 게임 오버 시
   resetComboDisplay();
   
   // 새 게임 시작 시
   resetComboDisplay();
 */
export function resetComboDisplay() {
  comboDisplay.reset();
}

/**
 * 콤보 디스플레이 사운드 콜백 설정
 * [v3.0.0] 콤보 발생 시 사운드를 재생하기 위한 콜백 등록
 * 
 * @param {Function} callback - 사운드 재생 콜백 함수 (comboCount) => void
 * 
 * 사용 예시:
   import { setComboSoundCallback } from './effects.js';
   import { playComboSound } from '../audio/midi_player.js';
   
   // 오디오 엔진과 연결
   setComboSoundCallback((combo) => playComboSound(combo));
 */
export function setComboSoundCallback(callback) {
  comboDisplay.setSoundCallback(callback);
}

/**
 * 현재 콤보 수 반환
 * [v3.0.0] 현재 표시 중인 콤보 수 확인
 * 
 * @returns {number} 현재 콤보 수
 */
export function getCurrentCombo() {
  return comboDisplay.getCurrentCombo();
}

/**
 * 콤보 디스플레이 인스턴스 직접 접근 (고급 사용)
 * [v3.0.0] 더 세밀한 제어가 필요한 경우 사용
 * 
 * @returns {ComboDisplay} ComboDisplay 인스턴스
 */
export function getComboDisplay() {
  return comboDisplay;
}

// ============================================================================
// [v4.0.0] 승리/패배 연출 (Game End Effects) 시스템 - Feature 4
// ============================================================================

/**
 * 게임 종료 연출 설정값
 * [v4.0.0] 승리/패배 효과의 시각적 속성 정의
 */
const GAME_END_CONFIG = {
  // 승리 효과 설정
  victory: {
    // 폭발 지속 시간 (초)
    explosionDuration: 2.5,
    // 블록 폭발 순서 지연 (초/줄)
    lineDelay: 0.08,
    // 파티클 색상 (골드/옐로우/화이트 테마)
    colors: ["#FFD700", "#FFEC8B", "#FFB90F", "#FFF8DC", "#FFA500", "#FFFFFF"],
    // 텍스트 설정
    text: {
      string: "VICTORY",
      fontSize: 72,
      color: "#FFD700",
      glowColor: "#FFA500",
      strokeColor: "#B8860B",
    },
    // 컨페티 설정
    confetti: {
      count: 150,
      colors: ["#FFD700", "#FFEC8B", "#FFB90F", "#FFF8DC", "#FFA500", "#FFFFFF", "#FFFF00"],
    },
  },
  // 패배 효과 설정
  defeat: {
    // 붕괴 지속 시간 (초)
    collapseDuration: 2.0,
    // 블록 떨어지는 순서 지연 (초/줄)
    lineDelay: 0.1,
    // 블록 중력 가속도
    gravity: 800,
    // 텍스트 설정
    text: {
      string: "GAME OVER",
      fontSize: 64,
      color: "#DC143C",
      glowColor: "#8B0000",
      strokeColor: "#4A0000",
    },
    // 화면 어둡게 설정
    darken: {
      color: "#000000",
      maxAlpha: 0.6,
      fadeInDuration: 1.0,
    },
  },
  // 공통 설정
  blockSize: 20, // 기본 블록 크기 (외부에서 설정)
};

/**
 * 게임 종료 연출 상태 열거형
 * [v4.0.0] 현재 진행 중인 연출 상태
 */
const GameEndState = {
  IDLE: "idle",
  VICTORY: "victory",
  DEFEAT: "defeat",
};

/**
 * GameEndEffects 클래스
 * [v4.0.0] 승리/패배 시 시각적 연출 효과 시스템
 *
 * 기능:
 * - 승리: AI 보드 폭발 (아래에서 위로), 골드 파티클, VICTORY 텍스트, 컨페티
 * - 패배: 플레이어 보드 붕괴 (위에서 아래로), 블록 추락, GAME OVER 텍스트, 화면 어두워짐
 * - 공유 파티클 풀을 통한 효율적인 메모리 관리
 */
class GameEndEffects {
  constructor() {
    // 현재 상태
    this.state = GameEndState.IDLE;
    this.isPlaying = false;

    // 타이밍
    this.elapsed = 0;
    this.duration = 0;

    // 보드 정보
    this.boardState = null;
    this.boardX = 0;
    this.boardY = 0;
    this.blockSize = 20;
    this.boardWidth = 10; // 가로 블록 수
    this.boardHeight = 20; // 세로 블록 수

    // 파티클 시스템
    this.particles = [];
    this.blocks = []; // 폭발/추락하는 블록들
    this.confetti = []; // 승리 컨페티

    // 텍스트 애니메이션
    this.textAnimation = {
      scale: 0,
      targetScale: 1,
      opacity: 0,
      shake: 0, // 패배 시 흔들림
      glow: 0, // 승리 시 글로우
    };

    // 화면 어두워짐 (패배용)
    this.darkenAlpha = 0;

    // 폭발/붕괴 진행 상황
    this.currentLine = 0;
    this.lineTimer = 0;
  }

  /**
   * 승리 효과 시작
   * [v4.0.0] AI 보드 폭발 연출 시작
   *
   * @param {Array<Array<number>>} aiBoardState - AI 보드 상태 (2D 배열, 0=빈칸, 1~7=블록)
   * @param {number} boardX - 보드 좌상단 X 좌표
   * @param {number} boardY - 보드 좌상단 Y 좌표
   * @param {number} blockSize - 블록 크기 (픽셀)
   *
   * 사용 예시:
   *   gameEndEffects.startVictory(aiBoard, 400, 100, 20);
   */
  startVictory(aiBoardState, boardX, boardY, blockSize = 20) {
    this._reset();
    this.state = GameEndState.VICTORY;
    this.isPlaying = true;
    this.boardState = aiBoardState;
    this.boardX = boardX;
    this.boardY = boardY;
    this.blockSize = blockSize;
    this.duration = GAME_END_CONFIG.victory.explosionDuration;

    // 텍스트 애니메이션 초기화
    this.textAnimation = {
      scale: 0.3,
      targetScale: 1.0,
      opacity: 0,
      shake: 0,
      glow: 1.0,
    };

    // 아래에서 위로 폭파할 블록 준비
    this._prepareVictoryBlocks();

    // 컨페티 생성 (승리 마지막에 터짐)
    this._prepareConfetti();

    console.log("[GameEndEffects] Victory effect started");
  }

  /**
   * 패배 효과 시작
   * [v4.0.0] 플레이어 보드 붕괴 연출 시작
   *
   * @param {Array<Array<number>>} playerBoardState - 플레이어 보드 상태
   * @param {number} boardX - 보드 좌상단 X 좌표
   * @param {number} boardY - 보드 좌상단 Y 좌표
   * @param {number} blockSize - 블록 크기 (픽셀)
   *
   * 사용 예시:
   *   gameEndEffects.startDefeat(playerBoard, 100, 100, 20);
   */
  startDefeat(playerBoardState, boardX, boardY, blockSize = 20) {
    this._reset();
    this.state = GameEndState.DEFEAT;
    this.isPlaying = true;
    this.boardState = playerBoardState;
    this.boardX = boardX;
    this.boardY = boardY;
    this.blockSize = blockSize;
    this.duration = GAME_END_CONFIG.defeat.collapseDuration;

    // 텍스트 애니메이션 초기화
    this.textAnimation = {
      scale: 1.2,
      targetScale: 1.0,
      opacity: 0,
      shake: 1.0,
      glow: 0,
    };

    // 위에서 아래로 떨어질 블록 준비
    this._prepareDefeatBlocks();

    console.log("[GameEndEffects] Defeat effect started");
  }

  /**
   * 승리 블록 준비
   * [v4.0.0] AI 보드의 블록들을 폭발용으로 변환
   */
  _prepareVictoryBlocks() {
    this.blocks = [];

    if (!this.boardState) return;

    // 보드 상태에서 블록 추출 (아래에서 위로)
    for (let row = this.boardState.length - 1; row >= 0; row--) {
      const rowBlocks = [];
      for (let col = 0; col < this.boardState[row].length; col++) {
        const blockType = this.boardState[row][col];
        if (blockType !== 0) {
          rowBlocks.push({
            gridX: col,
            gridY: row,
            x: this.boardX + col * this.blockSize,
            y: this.boardY + row * this.blockSize,
            type: blockType,
            color: this._getBlockColor(blockType),
            exploded: false,
            explosionTime: 0,
          });
        }
      }
      if (rowBlocks.length > 0) {
        this.blocks.push(...rowBlocks);
      }
    }
  }

  /**
   * 패배 블록 준비
   * [v4.0.0] 플레이어 보드의 블록들을 추락용으로 변환
   */
  _prepareDefeatBlocks() {
    this.blocks = [];

    if (!this.boardState) return;

    // 보드 상태에서 블록 추출 (위에서 아래로)
    for (let row = 0; row < this.boardState.length; row++) {
      for (let col = 0; col < this.boardState[row].length; col++) {
        const blockType = this.boardState[row][col];
        if (blockType !== 0) {
          this.blocks.push({
            gridX: col,
            gridY: row,
            x: this.boardX + col * this.blockSize,
            y: this.boardY + row * this.blockSize,
            type: blockType,
            color: this._getBlockColor(blockType),
            falling: false,
            vy: 0,
            rotation: 0,
            rotationSpeed: 0,
          });
        }
      }
    }
  }

  /**
   * 컨페티 준비
   * [v4.0.0] 승리 시 하늘에서 떨어지는 컨페티 준비
   */
  _prepareConfetti() {
    this.confetti = [];
    const config = GAME_END_CONFIG.victory.confetti;

    for (let i = 0; i < config.count; i++) {
      this.confetti.push({
        x: Math.random() * (this.boardX + this.boardWidth * this.blockSize + 400) - 200,
        y: -Math.random() * 300 - 50,
        vx: (Math.random() - 0.5) * 100,
        vy: 100 + Math.random() * 150,
        size: 4 + Math.random() * 6,
        color: config.colors[Math.floor(Math.random() * config.colors.length)],
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 5,
        oscillation: Math.random() * Math.PI * 2,
        oscillationSpeed: 2 + Math.random() * 3,
        active: false,
        delay: 1.5 + Math.random() * 1.0, // 1.5~2.5초 후 활성화
      });
    }
  }

  /**
   * 블록 타입별 색상 반환
   * [v4.0.0] 테트리스 블록 타입에 따른 색상
   *
   * @param {number} type - 블록 타입 (1-7)
   * @returns {string} 색상 코드
   */
  _getBlockColor(type) {
    const colors = {
      1: "#00F0F0", // I - Cyan
      2: "#F0A000", // L - Orange
      3: "#0000F0", // J - Blue
      4: "#F0F000", // O - Yellow
      5: "#00F000", // S - Green
      6: "#A000F0", // T - Purple
      7: "#F00000", // Z - Red
    };
    return colors[type] || "#888888";
  }

  /**
   * 날짜 초기화
   * [v4.0.0] 모든 상태 초기화
   */
  _reset() {
    this.state = GameEndState.IDLE;
    this.isPlaying = false;
    this.elapsed = 0;
    this.duration = 0;
    this.boardState = null;
    this.particles = [];
    this.blocks = [];
    this.confetti = [];
    this.currentLine = 0;
    this.lineTimer = 0;
    this.darkenAlpha = 0;
  }

  /**
   * 업데이트
   * [v4.0.0] 게임 종료 연출 애니메이션 상태 갱신
   *
   * @param {number} dt - 델타 시간 (초)
   */
  update(dt) {
    if (!this.isPlaying) return;

    this.elapsed += dt;

    switch (this.state) {
      case GameEndState.VICTORY:
        this._updateVictory(dt);
        break;
      case GameEndState.DEFEAT:
        this._updateDefeat(dt);
        break;
    }

    // 전체 지속 시간 체크
    if (this.elapsed >= this.duration + 1.0) {
      // 1초 여유 후 종료
      this.isPlaying = false;
    }
  }

  /**
   * 승리 효과 업데이트
   * [v4.0.0] 폭발 애니메이션 및 파티클 업데이트
   *
   * @param {number} dt - 델타 시간 (초)
   */
  _updateVictory(dt) {
    const config = GAME_END_CONFIG.victory;

    // 텍스트 애니메이션 (스케일 업 + 글로우)
    if (this.elapsed < 0.5) {
      const progress = this.elapsed / 0.5;
      this.textAnimation.scale = 0.3 + (1.0 - 0.3) * progress;
      this.textAnimation.opacity = progress;
    } else if (this.elapsed < config.explosionDuration) {
      this.textAnimation.scale = 1.0 + Math.sin(this.elapsed * 3) * 0.05;
      this.textAnimation.opacity = 1.0;
    } else {
      const fadeProgress = (this.elapsed - config.explosionDuration) / 0.5;
      this.textAnimation.opacity = Math.max(0, 1.0 - fadeProgress);
    }

    // 블록 폭발 순차적 실행 (아래에서 위로)
    this.lineTimer += dt;
    const blocksPerBatch = 3;

    if (this.lineTimer >= config.lineDelay) {
      this.lineTimer = 0;
      let explodedCount = 0;

      for (const block of this.blocks) {
        if (!block.exploded && explodedCount < blocksPerBatch) {
          block.exploded = true;
          block.explosionTime = this.elapsed;
          this._createExplosionParticles(block.x, block.y, block.color);
          explodedCount++;
        }
      }
    }

    // 파티클 업데이트
    this._updateParticles(dt);

    // 컨페티 업데이트
    this._updateConfetti(dt);
  }

  /**
   * 패배 효과 업데이트
   * [v4.0.0] 붕괴 애니메이션 및 블록 추락 업데이트
   *
   * @param {number} dt - 델타 시간 (초)
   */
  _updateDefeat(dt) {
    const config = GAME_END_CONFIG.defeat;

    // 화면 어두워짐
    if (this.elapsed < config.darken.fadeInDuration) {
      this.darkenAlpha = (this.elapsed / config.darken.fadeInDuration) * config.darken.maxAlpha;
    }

    // 텍스트 애니메이션 (쉐이크 효과)
    if (this.elapsed < 0.3) {
      const progress = this.elapsed / 0.3;
      this.textAnimation.opacity = progress;
      this.textAnimation.scale = 1.2 - (0.2 * progress);
    } else if (this.elapsed < config.collapseDuration) {
      this.textAnimation.opacity = 1.0;
      this.textAnimation.scale = 1.0;
      // 흔들림 감소
      this.textAnimation.shake = Math.max(0, this.textAnimation.shake - dt * 2);
    } else {
      const fadeProgress = (this.elapsed - config.collapseDuration) / 0.5;
      this.textAnimation.opacity = Math.max(0, 1.0 - fadeProgress);
    }

    // 블록 순차적 추락 (위에서 아래로)
    this.lineTimer += dt;

    if (this.lineTimer >= config.lineDelay) {
      this.lineTimer = 0;
      let activatedCount = 0;

      // gridY 기준으로 정렬된 순서로 활성화
      const sortedBlocks = [...this.blocks].sort((a, b) => a.gridY - b.gridY);

      for (const block of sortedBlocks) {
        if (!block.falling && activatedCount < 2) {
          block.falling = true;
          block.vy = 50 + Math.random() * 100;
          block.rotationSpeed = (Math.random() - 0.5) * 3;
          activatedCount++;
        }
      }
    }

    // 떨어지는 블록 업데이트
    for (const block of this.blocks) {
      if (block.falling) {
        block.vy += config.gravity * dt;
        block.y += block.vy * dt;
        block.rotation += block.rotationSpeed * dt;

        // 화면 아래로 사라지면 제거 표시
        if (block.y > this.boardY + this.boardHeight * this.blockSize + 200) {
          block.falling = false;
          block.y = 9999; // 화면 밖으로
        }
      }
    }
  }

  /**
   * 폭발 파티클 생성
   * [v4.0.0] 승리 시 블록 폭발 파티클 생성
   *
   * @param {number} x - X 좌표
   * @param {number} y - Y 좌표
   * @param {string} baseColor - 기본 색상
   */
  _createExplosionParticles(x, y, baseColor) {
    const particleCount = 8 + Math.floor(Math.random() * 8);

    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount + Math.random() * 0.5;
      const speed = 80 + Math.random() * 120;
      const colors = GAME_END_CONFIG.victory.colors;
      const color = colors[Math.floor(Math.random() * colors.length)];

      this.particles.push({
        x: x + this.blockSize / 2,
        y: y + this.blockSize / 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 50, // 위쪽으로 더 강하게
        life: 0.5 + Math.random() * 0.5,
        maxLife: 1.0,
        size: 3 + Math.random() * 5,
        color: color,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 10,
        gravity: 200,
      });
    }
  }

  /**
   * 파티클 업데이트
   * [v4.0.0] 물리 시뮬레이션 적용
   *
   * @param {number} dt - 델타 시간 (초)
   */
  _updateParticles(dt) {
    const nextParticles = [];

    for (const p of this.particles) {
      p.life -= dt;
      if (p.life <= 0) continue;

      // 물리 업데이트
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
      p.rotation += p.rotationSpeed * dt;

      // 공기 저항
      p.vx *= 0.98;
      p.vy *= 0.99;

      nextParticles.push(p);
    }

    this.particles = nextParticles;
  }

  /**
   * 컨페티 업데이트
   * [v4.0.0] 승리 컨페티 애니메이션
   *
   * @param {number} dt - 델타 시간 (초)
   */
  _updateConfetti(dt) {
    for (const c of this.confetti) {
      // 지연 시간 체크
      if (!c.active) {
        c.delay -= dt;
        if (c.delay <= 0) {
          c.active = true;
        }
        continue;
      }

      // 물리 업데이트
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.rotation += c.rotationSpeed * dt;

      // 좌우 흔들림
      c.oscillation += c.oscillationSpeed * dt;
      c.x += Math.sin(c.oscillation) * 20 * dt;

      // 중력 가속
      c.vy += 50 * dt;

      // 바닥 충돌
      if (c.y > 800) {
        c.y = -50;
        c.vy = 100 + Math.random() * 100;
      }
    }
  }

  /**
   * 렌더링
   * [v4.0.0] 게임 종료 연출 그리기
   *
   * @param {CanvasRenderingContext2D} ctx - 캔버스 컨텍스트
   */
  render(ctx) {
    if (!this.isPlaying) return;

    switch (this.state) {
      case GameEndState.VICTORY:
        this._renderVictory(ctx);
        break;
      case GameEndState.DEFEAT:
        this._renderDefeat(ctx);
        break;
    }
  }

  /**
   * 승리 효과 렌더링
   * [v4.0.0] 폭발, 파티클, VICTORY 텍스트, 컨페티 렌더링
   *
   * @param {CanvasRenderingContext2D} ctx - 캔버스 컨텍스트
   */
  _renderVictory(ctx) {
    // 아직 폭발되지 않은 블록 렌더링
    for (const block of this.blocks) {
      if (!block.exploded) {
        ctx.fillStyle = block.color;
        ctx.fillRect(block.x, block.y, this.blockSize - 1, this.blockSize - 1);

        // 블록 하이라이트
        ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
        ctx.fillRect(block.x, block.y, this.blockSize - 1, 4);
      }
    }

    // 파티클 렌더링
    this._renderParticles(ctx);

    // 컨페티 렌더링
    this._renderConfetti(ctx);

    // VICTORY 텍스트 렌더링
    this._renderVictoryText(ctx);
  }

  /**
   * 패배 효과 렌더링
   * [v4.0.0] 붕괴, 블록 추락, GAME OVER 텍스트, 화면 어두워짐 렌더링
   *
   * @param {CanvasRenderingContext2D} ctx - 캔버스 컨텍스트
   */
  _renderDefeat(ctx) {
    // 화면 어두워짐
    if (this.darkenAlpha > 0) {
      ctx.fillStyle = `rgba(0, 0, 0, ${this.darkenAlpha})`;
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }

    // 아직 떨어지지 않은 블록 렌더링
    for (const block of this.blocks) {
      if (!block.falling && block.y < 9999) {
        ctx.fillStyle = block.color;
        ctx.fillRect(block.x, block.y, this.blockSize - 1, this.blockSize - 1);
      }
    }

    // 떨어지는 블록 렌더링
    for (const block of this.blocks) {
      if (block.falling && block.y < 9999) {
        ctx.save();
        ctx.translate(block.x + this.blockSize / 2, block.y + this.blockSize / 2);
        ctx.rotate(block.rotation);
        ctx.fillStyle = block.color;
        ctx.fillRect(-this.blockSize / 2, -this.blockSize / 2, this.blockSize - 1, this.blockSize - 1);
        ctx.restore();
      }
    }

    // GAME OVER 텍스트 렌더링
    this._renderDefeatText(ctx);
  }

  /**
   * 파티클 렌더링
   * [v4.0.0] 폭발 파티클 그리기
   *
   * @param {CanvasRenderingContext2D} ctx - 캔버스 컨텍스트
   */
  _renderParticles(ctx) {
    for (const p of this.particles) {
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    }
    ctx.globalAlpha = 1.0;
  }

  /**
   * 컨페티 렌더링
   * [v4.0.0] 승리 컨페티 그리기
   *
   * @param {CanvasRenderingContext2D} ctx - 캔버스 컨텍스트
   */
  _renderConfetti(ctx) {
    for (const c of this.confetti) {
      if (!c.active) continue;

      ctx.fillStyle = c.color;
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.rotation);
      ctx.fillRect(-c.size / 2, -c.size / 2, c.size, c.size);
      ctx.restore();
    }
  }

  /**
   * VICTORY 텍스트 렌더링
   * [v4.0.0] 승리 텍스트 (스케일업 + 글로우 효과)
   *
   * @param {CanvasRenderingContext2D} ctx - 캔버스 컨텍스트
   */
  _renderVictoryText(ctx) {
    if (this.textAnimation.opacity <= 0) return;

    const config = GAME_END_CONFIG.victory.text;
    const centerX = this.boardX + (this.boardWidth * this.blockSize) / 2;
    const centerY = this.boardY + (this.boardHeight * this.blockSize) / 2;

    ctx.save();
    ctx.globalAlpha = this.textAnimation.opacity;

    // 글로우 효과
    ctx.shadowColor = config.glowColor;
    ctx.shadowBlur = 30 * this.textAnimation.glow;

    // 텍스트 스케일 적용
    const fontSize = config.fontSize * this.textAnimation.scale;
    ctx.font = `bold ${fontSize}px "Segoe UI Black", "Arial Black", "Impact", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // 외곽선
    ctx.strokeStyle = config.strokeColor;
    ctx.lineWidth = 4;
    ctx.strokeText(config.string, centerX, centerY);

    // 메인 텍스트
    ctx.fillStyle = config.color;
    ctx.fillText(config.string, centerX, centerY);

    ctx.restore();
  }

  /**
   * GAME OVER 텍스트 렌더링
   * [v4.0.0] 패배 텍스트 (쉐이크 효과)
   *
   * @param {CanvasRenderingContext2D} ctx - 캔버스 컨텍스트
   */
  _renderDefeatText(ctx) {
    if (this.textAnimation.opacity <= 0) return;

    const config = GAME_END_CONFIG.defeat.text;
    let centerX = this.boardX + (this.boardWidth * this.blockSize) / 2;
    let centerY = this.boardY + (this.boardHeight * this.blockSize) / 2;

    // 쉐이크 효과 적용
    if (this.textAnimation.shake > 0) {
      const shakeIntensity = this.textAnimation.shake * 10;
      centerX += (Math.random() - 0.5) * shakeIntensity;
      centerY += (Math.random() - 0.5) * shakeIntensity;
    }

    ctx.save();
    ctx.globalAlpha = this.textAnimation.opacity;

    // 텍스트 스케일 적용
    const fontSize = config.fontSize * this.textAnimation.scale;
    ctx.font = `bold ${fontSize}px "Segoe UI Black", "Arial Black", "Impact", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // 외곽선
    ctx.strokeStyle = config.strokeColor;
    ctx.lineWidth = 4;
    ctx.strokeText(config.string, centerX, centerY);

    // 메인 텍스트
    ctx.fillStyle = config.color;
    ctx.fillText(config.string, centerX, centerY);

    ctx.restore();
  }

  /**
   * 연출 활성화 여부 확인
   * [v4.0.0] 현재 효과가 재생 중인지 확인
   *
   * @returns {boolean} 재생 중 여부
   */
  isEffectPlaying() {
    return this.isPlaying;
  }

  /**
   * 현재 상태 반환
   * [v4.0.0] victory/defeat/idle 상태 확인
   *
   * @returns {string} 현재 상태
   */
  getState() {
    return this.state;
  }

  /**
   * 리셋
   * [v4.0.0] 모든 효과 초기화 (새 게임 시작 시)
   */
  reset() {
    this._reset();
    console.log("[GameEndEffects] Reset completed");
  }
}

// 싱글톤 인스턴스 생성
const gameEndEffects = new GameEndEffects();

// ============================================================================
// 게임 종료 연출 외부용 API 함수들
// ============================================================================

/**
 * 승리 효과 시작
 * [v4.0.0] AI 보드 폭발 연출 트리거
 *
 * @param {Array<Array<number>>} aiBoardState - AI 보드 상태 (2D 배열)
 * @param {number} boardX - 보드 좌상단 X 좌표
 * @param {number} boardY - 보드 좌상단 Y 좌표
 * @param {number} blockSize - 블록 크기 (픽셀, 기본값: 20)
 *
 * 사용 예시:
 *   import { startVictoryEffect } from './effects.js';
 *
 *   // 플레이어 승리 시
 *   startVictoryEffect(aiBoard.grid, 400, 100, 20);
 */
export function startVictoryEffect(aiBoardState, boardX, boardY, blockSize = 20) {
  gameEndEffects.startVictory(aiBoardState, boardX, boardY, blockSize);
}

/**
 * 패배 효과 시작
 * [v4.0.0] 플레이어 보드 붕괴 연출 트리거
 *
 * @param {Array<Array<number>>} playerBoardState - 플레이어 보드 상태 (2D 배열)
 * @param {number} boardX - 보드 좌상단 X 좌표
 * @param {number} boardY - 보드 좌상단 Y 좌표
 * @param {number} blockSize - 블록 크기 (픽셀, 기본값: 20)
 *
 * 사용 예시:
 *   import { startDefeatEffect } from './effects.js';
 *
 *   // 플레이어 패배 시
 *   startDefeatEffect(playerBoard.grid, 100, 100, 20);
 */
export function startDefeatEffect(playerBoardState, boardX, boardY, blockSize = 20) {
  gameEndEffects.startDefeat(playerBoardState, boardX, boardY, blockSize);
}

/**
 * 게임 종료 효과 업데이트
 * [v4.0.0] 렌더링 루프에서 호출하여 애니메이션 상태 갱신
 *
 * @param {number} dt - 델타 시간 (초)
 *
 * 사용 예시:
 *   import { updateGameEndEffects } from './effects.js';
 *
 *   function gameLoop(deltaTime) {
 *     updateGameEndEffects(deltaTime);
 *     // ... 다른 업데이트 로직
 *   }
 */
export function updateGameEndEffects(dt) {
  gameEndEffects.update(dt);
}

/**
 * 게임 종료 효과 렌더링
 * [v4.0.0] 승리/패배 연출 그리기
 *
 * @param {CanvasRenderingContext2D} ctx - 캔버스 컨텍스트
 *
 * 사용 예시:
 *   import { renderGameEndEffects } from './effects.js';
 *
 *   function render() {
 *     // 보드 렌더링
 *     renderBoard(ctx);
 *
 *     // 게임 종료 효과 렌더링 (보드 위에 표시)
 *     renderGameEndEffects(ctx);
 *   }
 */
export function renderGameEndEffects(ctx) {
  gameEndEffects.render(ctx);
}

/**
 * 게임 종료 효과 재생 중 여부 확인
 * [v4.0.0] 현재 효과가 재생 중인지 확인
 *
 * @returns {boolean} 재생 중 여부
 *
 * 사용 예시:
 *   import { isGameEndEffectPlaying } from './effects.js';
 *
 *   // 게임 로직 업데이트 전 체크
 *   if (!isGameEndEffectPlaying()) {
 *     updateGameLogic();
 *   }
 */
export function isGameEndEffectPlaying() {
  return gameEndEffects.isEffectPlaying();
}

/**
 * 게임 종료 효과 리셋
 * [v4.0.0] 모든 효과 초기화 (새 게임 시작 시)
 *
 * 사용 예시:
 *   import { resetGameEndEffects } from './effects.js';
 *
 *   // 새 게임 시작 시
 *   resetGameEndEffects();
 */
export function resetGameEndEffects() {
  gameEndEffects.reset();
}

/**
 * GameEndEffects 인스턴스 직접 접근 (고급 사용)
 * [v4.0.0] 더 세밀한 제어가 필요한 경우 사용
 *
 * @returns {GameEndEffects} GameEndEffects 인스턴스
 */
export function getGameEndEffects() {
  return gameEndEffects;
}

// ============================================================================
// [v5.0.0] 스킬 시각 효과 시스템 - Feature 5
// ============================================================================

/**
 * 스킬 효과 설정값
 * [v5.0.0] 3가지 스킬의 시각적 속성 정의
 */
const SKILL_EFFECT_CONFIG = {
  blind: {
    fogColor: "rgba(0, 0, 0, 0.85)",
    questionMarkColor: "rgba(255, 255, 255, 0.3)",
    pulseSpeed: 2,  // 펄스 속도
    gridSize: 40,   // 물음표 그리드 크기
  },
  blockSwap: {
    flashColor: "#FFD700",
    flashDuration: 500,  // ms
    particleCount: 30,
    particleColors: ["#FFD700", "#FFA500", "#FFEC8B"],
  },
  garbageReflect: {
    shieldColor: "#00C8FF",
    shieldGlow: 20,
    pulseAmplitude: 0.3,
    particleColor: "#80E5FF",
  },
};

/**
 * SkillEffects 클래스
 * [v5.0.0] 필살기 스킬 시각 효과 관리
 *
 * 기능:
 * - 블라인드: 안개 + 물음표 오버레이
 * - 블록 스왑: 플래시 + 파티클 효과
 * - 가비지 반사: 쉴드 글로우 효과
 */
class SkillEffects {
  constructor() {
    // 블라인드 효과 상태
    this.blindState = {
      active: false,
      endTime: 0,
      boardX: 0,
      boardY: 0,
      boardWidth: 0,
      boardHeight: 0,
    };

    // 블록 스왑 효과 상태
    this.swapState = {
      active: false,
      startTime: 0,
      boardX: 0,
      boardY: 0,
      cellSize: 0,
      swapPairs: [],
      particles: [],
    };

    // 가비지 반사 효과 상태
    this.reflectState = {
      active: false,
      endTime: 0,
      boardX: 0,
      boardY: 0,
      boardWidth: 0,
      boardHeight: 0,
      particles: [],
    };

    // 스킬 활성화 텍스트
    this.skillText = {
      active: false,
      text: "",
      startTime: 0,
      duration: 1500,  // ms
      x: 0,
      y: 0,
    };
  }

  // --------------------------------------------------------------------------
  // 블라인드 효과
  // --------------------------------------------------------------------------

  /**
   * 블라인드 효과 시작
   * [v5.0.0] 안개 효과 활성화
   *
   * @param {number} duration - 지속 시간 (ms)
   * @param {number} boardX - 보드 X 좌표
   * @param {number} boardY - 보드 Y 좌표
   * @param {number} boardWidth - 보드 너비
   * @param {number} boardHeight - 보드 높이
   */
  startBlind(duration, boardX, boardY, boardWidth, boardHeight) {
    this.blindState = {
      active: true,
      endTime: performance.now() + duration,
      boardX,
      boardY,
      boardWidth,
      boardHeight,
    };
  }

  /**
   * 블라인드 효과 종료
   * [v5.0.0] 안개 효과 비활성화
   */
  stopBlind() {
    this.blindState.active = false;
  }

  // --------------------------------------------------------------------------
  // 블록 스왑 효과
  // --------------------------------------------------------------------------

  /**
   * 블록 스왑 효과 시작
   * [v5.0.0] 스왑 플래시 + 파티클 효과 활성화
   *
   * @param {number} boardX - 보드 X 좌표
   * @param {number} boardY - 보드 Y 좌표
   * @param {number} cellSize - 셀 크기
   * @param {Array} swapPairs - 스왑된 열 쌍 배열 [[col1, col2], ...]
   */
  startBlockSwap(boardX, boardY, cellSize, swapPairs) {
    const now = performance.now();
    this.swapState = {
      active: true,
      startTime: now,
      boardX,
      boardY,
      cellSize,
      swapPairs: swapPairs || [],
      particles: [],
    };

    // 파티클 생성
    this._createSwapParticles(boardX, boardY, cellSize, swapPairs);
  }

  /**
   * 스왑 파티클 생성
   * [v5.0.0] 스왑된 열에서 파티클 방출
   */
  _createSwapParticles(boardX, boardY, cellSize, swapPairs) {
    const config = SKILL_EFFECT_CONFIG.blockSwap;

    for (const [col1, col2] of swapPairs) {
      for (let row = 0; row < 20; row++) {
        // 첫 번째 열 파티클
        for (let i = 0; i < 2; i++) {
          this.swapState.particles.push({
            x: boardX + col1 * cellSize + cellSize / 2,
            y: boardY + row * cellSize + cellSize / 2,
            vx: (Math.random() - 0.5) * 200,
            vy: (Math.random() - 0.5) * 200,
            life: 0.3 + Math.random() * 0.3,
            color: config.particleColors[Math.floor(Math.random() * config.particleColors.length)],
            size: 3 + Math.random() * 4,
          });
        }

        // 두 번째 열 파티클
        for (let i = 0; i < 2; i++) {
          this.swapState.particles.push({
            x: boardX + col2 * cellSize + cellSize / 2,
            y: boardY + row * cellSize + cellSize / 2,
            vx: (Math.random() - 0.5) * 200,
            vy: (Math.random() - 0.5) * 200,
            life: 0.3 + Math.random() * 0.3,
            color: config.particleColors[Math.floor(Math.random() * config.particleColors.length)],
            size: 3 + Math.random() * 4,
          });
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // 가비지 반사 효과
  // --------------------------------------------------------------------------

  /**
   * 가비지 반사 효과 시작
   * [v5.0.0] 쉴드 효과 활성화
   *
   * @param {number} duration - 지속 시간 (ms)
   * @param {number} boardX - 보드 X 좌표
   * @param {number} boardY - 보드 Y 좌표
   * @param {number} boardWidth - 보드 너비
   * @param {number} boardHeight - 보드 높이
   */
  startGarbageReflect(duration, boardX, boardY, boardWidth, boardHeight) {
    const now = performance.now();
    this.reflectState = {
      active: true,
      endTime: now + duration,
      boardX,
      boardY,
      boardWidth,
      boardHeight,
      particles: [],
    };

    // 쉴드 생성 파티클
    this._createShieldParticles();
  }

  /**
   * 쉴드 생성 파티클
   * [v5.0.0] 쉴드 활성화 시 파티클 방출
   */
  _createShieldParticles() {
    const config = SKILL_EFFECT_CONFIG.garbageReflect;
    const { boardX, boardY, boardWidth, boardHeight } = this.reflectState;

    // 테두리 주변에 파티클 생성
    const particleCount = 40;
    for (let i = 0; i < particleCount; i++) {
      const side = Math.floor(Math.random() * 4);
      let x, y;

      switch (side) {
        case 0: // 상단
          x = boardX + Math.random() * boardWidth;
          y = boardY - 10;
          break;
        case 1: // 우측
          x = boardX + boardWidth + 10;
          y = boardY + Math.random() * boardHeight;
          break;
        case 2: // 하단
          x = boardX + Math.random() * boardWidth;
          y = boardY + boardHeight + 10;
          break;
        default: // 좌측
          x = boardX - 10;
          y = boardY + Math.random() * boardHeight;
      }

      this.reflectState.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 50,
        vy: (Math.random() - 0.5) * 50,
        life: 1.0,
        color: config.particleColor,
        size: 2 + Math.random() * 3,
      });
    }
  }

  /**
   * 가비지 반사 효과 종료
   * [v5.0.0] 쉴드 효과 비활성화
   */
  stopGarbageReflect() {
    this.reflectState.active = false;
  }

  // --------------------------------------------------------------------------
  // 스킬 활성화 텍스트
  // --------------------------------------------------------------------------

  /**
   * 스킬 활성화 텍스트 표시
   * [v5.0.0] 스킬 사용 시 텍스트 표시
   *
   * @param {string} skillName - 스킬 이름
   * @param {number} x - 표시 X 좌표
   * @param {number} y - 표시 Y 좌표
   */
  showSkillText(skillName, x, y) {
    this.skillText = {
      active: true,
      text: skillName,
      startTime: performance.now(),
      duration: 1500,
      x,
      y,
    };
  }

  // --------------------------------------------------------------------------
  // 업데이트
  // --------------------------------------------------------------------------

  /**
   * 업데이트
   * [v5.0.0] 모든 스킬 효과 상태 갱신
   *
   * @param {number} dt - 델타 시간 (초)
   */
  update(dt) {
    const now = performance.now();

    // 블라인드 체크
    if (this.blindState.active && now >= this.blindState.endTime) {
      this.blindState.active = false;
    }

    // 블록 스왑 체크
    if (this.swapState.active) {
      const elapsed = now - this.swapState.startTime;
      if (elapsed >= SKILL_EFFECT_CONFIG.blockSwap.flashDuration) {
        this.swapState.active = false;
      }

      // 파티클 업데이트
      this.swapState.particles = this.swapState.particles.filter(p => {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
        return p.life > 0;
      });
    }

    // 가비지 반사 체크
    if (this.reflectState.active && now >= this.reflectState.endTime) {
      this.reflectState.active = false;
    }

    // 반사 파티클 업데이트
    if (this.reflectState.active) {
      this.reflectState.particles = this.reflectState.particles.filter(p => {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt * 0.5;
        return p.life > 0;
      });
    }

    // 스킬 텍스트 체크
    if (this.skillText.active) {
      const elapsed = now - this.skillText.startTime;
      if (elapsed >= this.skillText.duration) {
        this.skillText.active = false;
      }
    }
  }

  // --------------------------------------------------------------------------
  // 렌더링
  // --------------------------------------------------------------------------

  /**
   * 블라인드 효과 렌더링
   * [v5.0.0] 안개 + 물음표 오버레이 그리기
   *
   * @param {CanvasRenderingContext2D} ctx - 캔버스 컨텍스트
   */
  renderBlind(ctx) {
    if (!this.blindState.active) return;

    const { boardX, boardY, boardWidth, boardHeight } = this.blindState;
    const config = SKILL_EFFECT_CONFIG.blind;

    // 반투명 검은 오버레이
    ctx.fillStyle = config.fogColor;
    ctx.fillRect(boardX, boardY, boardWidth, boardHeight);

    // 펄스 효과
    const pulse = Math.sin(performance.now() * 0.003 * config.pulseSpeed) * 0.1 + 0.3;

    // 물음무늬 패턴
    ctx.fillStyle = `rgba(255, 255, 255, ${pulse})`;
    ctx.font = `bold 24px "Segoe UI", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const cols = Math.ceil(boardWidth / config.gridSize);
    const rows = Math.ceil(boardHeight / config.gridSize);

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const cx = boardX + col * config.gridSize + config.gridSize / 2;
        const cy = boardY + row * config.gridSize + config.gridSize / 2;
        ctx.fillText("?", cx, cy);
      }
    }
  }

  /**
   * 블록 스왑 효과 렌더링
   * [v5.0.0] 플래시 + 파티클 그리기
   *
   * @param {CanvasRenderingContext2D} ctx - 캔버스 컨텍스트
   */
  renderBlockSwap(ctx) {
    if (!this.swapState.active) return;

    const { boardX, boardY, cellSize, swapPairs, startTime, particles } = this.swapState;
    const config = SKILL_EFFECT_CONFIG.blockSwap;

    const elapsed = performance.now() - startTime;
    const progress = elapsed / config.flashDuration;

    // 플래시 효과 (시작과 끝에서 밝게)
    const flashIntensity = progress < 0.5
      ? progress * 2
      : (1 - progress) * 2;

    // 스왑된 열에 플래시 효과
    ctx.fillStyle = `rgba(255, 215, 0, ${flashIntensity * 0.4})`;

    for (const [col1, col2] of swapPairs) {
      // 첫 번째 열
      ctx.fillRect(boardX + col1 * cellSize, boardY, cellSize, 20 * cellSize);
      // 두 번째 열
      ctx.fillRect(boardX + col2 * cellSize, boardY, cellSize, 20 * cellSize);
    }

    // 파티클 렌더링
    ctx.save();
    for (const p of particles) {
      const alpha = p.life / 0.6;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /**
   * 가비지 반사 효과 렌더링
   * [v5.0.0] 쉴드 글로우 + 파티클 그리기
   *
   * @param {CanvasRenderingContext2D} ctx - 캔버스 컨텍스트
   */
  renderGarbageReflect(ctx) {
    if (!this.reflectState.active) return;

    const { boardX, boardY, boardWidth, boardHeight, particles } = this.reflectState;
    const config = SKILL_EFFECT_CONFIG.garbageReflect;

    // 펄스 효과
    const pulse = Math.sin(performance.now() * 0.005) * config.pulseAmplitude + 0.7;

    // 쉴드 테두리
    ctx.save();
    ctx.strokeStyle = config.shieldColor;
    ctx.lineWidth = 3;
    ctx.shadowColor = config.shieldColor;
    ctx.shadowBlur = config.shieldGlow * pulse;

    // 보드 주변 쉴드 테두리
    ctx.strokeRect(boardX - 6, boardY - 6, boardWidth + 12, boardHeight + 12);

    // 남쪽 화살표 (반사 방향 표시)
    const arrowY = boardY + boardHeight + 15;
    ctx.beginPath();
    ctx.moveTo(boardX + boardWidth / 2 - 10, arrowY - 5);
    ctx.lineTo(boardX + boardWidth / 2, arrowY + 5);
    ctx.lineTo(boardX + boardWidth / 2 + 10, arrowY - 5);
    ctx.stroke();

    ctx.restore();

    // 파티클 렌더링
    ctx.save();
    for (const p of particles) {
      const alpha = Math.max(0, p.life);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // REFLECT 텍스트
    ctx.save();
    ctx.fillStyle = config.shieldColor;
    ctx.font = `bold 12px "Segoe UI", sans-serif`;
    ctx.textAlign = "center";
    ctx.shadowColor = config.shieldColor;
    ctx.shadowBlur = 10;
    ctx.fillText("REFLECT", boardX + boardWidth / 2, boardY - 15);
    ctx.restore();
  }

  /**
   * 스킬 활성화 텍스트 렌더링
   * [v5.0.0] 스킬 이름 텍스트 그리기
   *
   * @param {CanvasRenderingContext2D} ctx - 캔버스 컨텍스트
   */
  renderSkillText(ctx) {
    if (!this.skillText.active) return;

    const { text, startTime, x, y } = this.skillText;
    const elapsed = performance.now() - startTime;
    const progress = elapsed / this.skillText.duration;

    // 위로 상승
    const offsetY = -progress * 50;

    // 페이드 아웃
    let alpha = 1;
    if (progress > 0.7) {
      alpha = 1 - (progress - 0.7) / 0.3;
    }

    // 스케일 효과
    const scale = 1 + Math.sin(progress * Math.PI) * 0.3;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#FFD700";
    ctx.font = `bold ${24 * scale}px "Segoe UI Black", "Arial Black", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "#FFA500";
    ctx.shadowBlur = 20;
    ctx.fillText(text, x, y + offsetY);
    ctx.restore();
  }

  // --------------------------------------------------------------------------
  // 상태 확인
  // --------------------------------------------------------------------------

  /**
   * 블라인드 효과 활성화 여부
   * @returns {boolean}
   */
  isBlindActive() {
    return this.blindState.active;
  }

  /**
   * 가비지 반사 효과 활성화 여부
   * @returns {boolean}
   */
  isGarbageReflectActive() {
    return this.reflectState.active;
  }

  /**
   * 모든 효과 리셋
   * [v5.0.0] 새 게임 시작 시 호출
   */
  reset() {
    this.blindState.active = false;
    this.swapState.active = false;
    this.reflectState.active = false;
    this.skillText.active = false;
  }
}

// 싱글톤 인스턴스
const skillEffects = new SkillEffects();

// ============================================================================
// 스킬 효과 외부용 API 함수들
// ============================================================================

/**
 * 블라인드 효과 시작
 * [v5.0.0] 안개 효과 활성화
 *
 * @param {number} duration - 지속 시간 (ms)
 * @param {number} boardX - 보드 X 좌표
 * @param {number} boardY - 보드 Y 좌표
 * @param {number} boardWidth - 보드 너비
 * @param {number} boardHeight - 보드 높이
 *
 * 사용 예시:
 *   import { startBlindEffect } from './effects.js';
 *   startBlindEffect(5000, 400, 100, 200, 400);
 */
export function startBlindEffect(duration, boardX, boardY, boardWidth, boardHeight) {
  skillEffects.startBlind(duration, boardX, boardY, boardWidth, boardHeight);
}

/**
 * 블록 스왑 효과 시작
 * [v5.0.0] 플래시 + 파티클 효과 활성화
 *
 * @param {number} boardX - 보드 X 좌표
 * @param {number} boardY - 보드 Y 좌표
 * @param {number} cellSize - 셀 크기
 * @param {Array} swapPairs - 스왑된 열 쌍 배열
 *
 * 사용 예시:
 *   import { startBlockSwapEffect } from './effects.js';
 *   startBlockSwapEffect(400, 100, 20, [[0, 9], [2, 7]]);
 */
export function startBlockSwapEffect(boardX, boardY, cellSize, swapPairs) {
  skillEffects.startBlockSwap(boardX, boardY, cellSize, swapPairs);
}

/**
 * 가비지 반사 효과 시작
 * [v5.0.0] 쉴드 효과 활성화
 *
 * @param {number} duration - 지속 시간 (ms)
 * @param {number} boardX - 보드 X 좌표
 * @param {number} boardY - 보드 Y 좌표
 * @param {number} boardWidth - 보드 너비
 * @param {number} boardHeight - 보드 높이
 *
 * 사용 예시:
 *   import { startGarbageReflectEffect } from './effects.js';
 *   startGarbageReflectEffect(5000, 100, 100, 200, 400);
 */
export function startGarbageReflectEffect(duration, boardX, boardY, boardWidth, boardHeight) {
  skillEffects.startGarbageReflect(duration, boardX, boardY, boardWidth, boardHeight);
}

/**
 * 스킬 활성화 텍스트 표시
 * [v5.0.0] 스킬 사용 시 텍스트 표시
 *
 * @param {string} skillName - 스킬 이름
 * @param {number} x - 표시 X 좌표
 * @param {number} y - 표시 Y 좌표
 *
 * 사용 예시:
 *   import { showSkillActivationText } from './effects.js';
 *   showSkillActivationText("블라인드!", 300, 300);
 */
export function showSkillActivationText(skillName, x, y) {
  skillEffects.showSkillText(skillName, x, y);
}

/**
 * 스킬 효과 업데이트
 * [v5.0.0] 렌더링 루프에서 호출하여 애니메이션 상태 갱신
 *
 * @param {number} dt - 델타 시간 (초)
 *
 * 사용 예시:
 *   import { updateSkillEffects } from './effects.js';
 *   function gameLoop(deltaTime) {
 *     updateSkillEffects(deltaTime);
 *   }
 */
export function updateSkillEffects(dt) {
  skillEffects.update(dt);
}

/**
 * 블라인드 효과 렌더링
 * [v5.0.0] 안개 오버레이 그리기
 *
 * @param {CanvasRenderingContext2D} ctx - 캔버스 컨텍스트
 *
 * 사용 예시:
 *   import { renderBlindEffect } from './effects.js';
 *   renderBlindEffect(ctx);
 */
export function renderBlindEffect(ctx) {
  skillEffects.renderBlind(ctx);
}

/**
 * 블록 스왑 효과 렌더링
 * [v5.0.0] 플래시 + 파티클 그리기
 *
 * @param {CanvasRenderingContext2D} ctx - 캔버스 컨텍스트
 *
 * 사용 예시:
 *   import { renderBlockSwapEffect } from './effects.js';
 *   renderBlockSwapEffect(ctx);
 */
export function renderBlockSwapEffect(ctx) {
  skillEffects.renderBlockSwap(ctx);
}

/**
 * 가비지 반사 효과 렌더링
 * [v5.0.0] 쉴드 효과 그리기
 *
 * @param {CanvasRenderingContext2D} ctx - 캔버스 컨텍스트
 *
 * 사용 예시:
 *   import { renderGarbageReflectEffect } from './effects.js';
 *   renderGarbageReflectEffect(ctx);
 */
export function renderGarbageReflectEffect(ctx) {
  skillEffects.renderGarbageReflect(ctx);
}

/**
 * 스킬 활성화 텍스트 렌더링
 * [v5.0.0] 스킬 이름 텍스트 그리기
 *
 * @param {CanvasRenderingContext2D} ctx - 캔버스 컨텍스트
 *
 * 사용 예시:
 *   import { renderSkillActivationText } from './effects.js';
 *   renderSkillActivationText(ctx);
 */
export function renderSkillActivationText(ctx) {
  skillEffects.renderSkillText(ctx);
}

/**
 * 블라인드 효과 활성화 여부 확인
 * [v5.0.0] 현재 블라인드 효과가 적용 중인지 확인
 *
 * @returns {boolean}
 *
 * 사용 예시:
 *   import { isBlindEffectActive } from './effects.js';
 *   if (isBlindEffectActive()) { ... }
 */
export function isBlindEffectActive() {
  return skillEffects.isBlindActive();
}

/**
 * 가비지 반사 효과 활성화 여부 확인
 * [v5.0.0] 현재 가비지 반사 효과가 적용 중인지 확인
 *
 * @returns {boolean}
 *
 * 사용 예시:
 *   import { isGarbageReflectEffectActive } from './effects.js';
 *   if (isGarbageReflectEffectActive()) { ... }
 */
export function isGarbageReflectEffectActive() {
  return skillEffects.isGarbageReflectActive();
}

/**
 * 스킬 효과 리셋
 * [v5.0.0] 모든 스킬 효과 초기화 (새 게임 시작 시)
 *
 * 사용 예시:
 *   import { resetSkillEffects } from './effects.js';
 *   resetSkillEffects();
 */
export function resetSkillEffects() {
  skillEffects.reset();
}

/**
 * SkillEffects 인스턴스 직접 접근 (고급 사용)
 * [v5.0.0] 더 세밀한 제어가 필요한 경우 사용
 *
 * @returns {SkillEffects} SkillEffects 인스턴스
 */
export function getSkillEffects() {
  return skillEffects;
}

// ============================================================================
// [v6.0.0] 피버 모드 테두리 불꽃 효과 (Fever Mode Flame Border)
// ============================================================================

/**
 * 피버 볼더 설정값
 * [v6.0.0] 화면 테두리 불꽃 효과 설정
 */
const FEVER_BORDER_CONFIG = {
  // 파티클 설정
  particles: {
    count: 60,              // 총 파티클 수
    spawnRate: 10,          // 초당 생성률
    minSize: 4,             // 최소 크기
    maxSize: 12,            // 최대 크기
    minLife: 0.5,           // 최소 수명 (초)
    maxLife: 1.2,           // 최대 수명 (초)
    riseSpeed: 80,          // 상승 속도 (픽셀/초)
    flickerSpeed: 15,       // 깜빡임 속도
  },
  // 색상 설정 (주황 → 빨강 그라데이션)
  colors: {
    core: "#FF4500",        // 코어 색상 (오렌지 레드)
    inner: "#FF6347",       // 난색 (토마토)
    middle: "#FF8C00",      // 중간 (다크 오렌지)
    outer: "#FFD700",       // 외곽 (골드)
    glow: "#FF4500",        // 글로우 색상
  },
  // 글로우 효과
  glow: {
    blur: 20,               // 기본 블러
    maxBlur: 40,            // 최대 블러 (강도에 따라)
    intensity: 0.8,         // 기본 강도
  },
  // 테두리 두께
  thickness: {
    base: 8,                // 기본 두께
    max: 16,                // 최대 두께 (콤보에 따라)
  },
};

/**
 * FeverBorder 클래스
 * [v6.0.0] 피버 모드 화면 테두리 불꽃 효과 시스템
 *
 * 기능:
 * - 화면 4면에 불꽃 파티클 생성
 * - 주황 → 빨강 그라데이션 색상
 * - 콤보 수에 따른 강도 증가
 * - 깜빡이는 글로우 효과
 */
class FeverBorder {
  constructor() {
    this.active = false;
    this.particles = [];
    this.time = 0;
    this.combo = 0;
    this.intensity = 1.0;
    
    // 화면 크기 (외부에서 설정)
    this.screenWidth = 0;
    this.screenHeight = 0;
    
    // FEVER 텍스트 애니메이션
    this.showFeverText = false;
    this.feverTextTime = 0;
    this.feverTextDuration = 1.5;
  }

  /**
   * 피버 모드 활성화
   * [v6.0.0] 피버 진입 시 불꽃 효과 시작
   *
   * @param {number} combo - 진입 시 콤보 수
   * @param {number} width - 화면 너비
   * @param {number} height - 화면 높이
   */
  activate(combo, width, height) {
    this.active = true;
    this.combo = combo;
    this.screenWidth = width;
    this.screenHeight = height;
    this.time = 0;
    this.particles = [];
    this.intensity = this._calculateIntensity(combo);
    
    // FEVER 텍스트 애니메이션 시작
    this.showFeverText = true;
    this.feverTextTime = 0;
    
    // 초기 파티클 생성
    this._spawnInitialParticles();
    
    console.log(`[FeverBorder] 불꽃 효과 활성화 - 콤보: ${combo}, 강도: ${this.intensity.toFixed(2)}`);
  }

  /**
   * 피버 모드 비활성화
   * [v6.0.0] 피버 종료 시 효과 정지
   */
  deactivate() {
    this.active = false;
    this.particles = [];
    this.showFeverText = false;
    this.feverTextTime = 0;
  }

  /**
   * 강도 계산
   * [v6.0.0] 콤보 수에 따른 불꽃 강도 계산
   *
   * @param {number} combo - 현재 콤보
   * @returns {number} 1.0 ~ 2.0 사이의 강도값
   */
  _calculateIntensity(combo) {
    // 10콤보 기준 1.0, 20콤보 이상 2.0
    return Math.min(2.0, 1.0 + (combo - 10) / 10);
  }

  /**
   * 초기 파티클 생성
   * [v6.0.0] 활성화 시 즉시 생성할 파티클
   */
  _spawnInitialParticles() {
    const config = FEVER_BORDER_CONFIG.particles;
    const count = Math.floor(config.count * 0.5); // 50% 즉시 생성
    
    for (let i = 0; i < count; i++) {
      this._spawnParticle(true);
    }
  }

  /**
   * 파티클 생성
   * [v6.0.0] 새로운 불꽃 파티클 생성
   *
   * @param {boolean} randomY - Y 위치를 랜덤하게 할지 여부
   */
  _spawnParticle(randomY = false) {
    const config = FEVER_BORDER_CONFIG.particles;
    const side = Math.floor(Math.random() * 4); // 0:상, 1:하, 2:좌, 3:우
    
    let x, y, vx, vy;
    
    switch (side) {
      case 0: // 상단
        x = Math.random() * this.screenWidth;
        y = randomY ? Math.random() * 50 : 0;
        vx = (Math.random() - 0.5) * 30;
        vy = 20 + Math.random() * 30;
        break;
      case 1: // 하단
        x = Math.random() * this.screenWidth;
        y = randomY ? this.screenHeight - Math.random() * 50 : this.screenHeight;
        vx = (Math.random() - 0.5) * 30;
        vy = -(20 + Math.random() * 30);
        break;
      case 2: // 좌측
        x = randomY ? Math.random() * 50 : 0;
        y = Math.random() * this.screenHeight;
        vx = 20 + Math.random() * 30;
        vy = (Math.random() - 0.5) * 30 - config.riseSpeed * 0.3;
        break;
      case 3: // 우측
        x = randomY ? this.screenWidth - Math.random() * 50 : this.screenWidth;
        y = Math.random() * this.screenHeight;
        vx = -(20 + Math.random() * 30);
        vy = (Math.random() - 0.5) * 30 - config.riseSpeed * 0.3;
        break;
    }
    
    this.particles.push({
      x,
      y,
      vx,
      vy,
      size: config.minSize + Math.random() * (config.maxSize - config.minSize) * this.intensity,
      life: config.minLife + Math.random() * (config.maxLife - config.minLife),
      ttl: 0, // 생명 시작 시점 (update에서 설정)
      side,
      flickerOffset: Math.random() * Math.PI * 2,
      colorPhase: Math.random(), // 0~1 사이 색상 단계
    });
  }

  /**
   * 업데이트
   * [v6.0.0] 불꽃 파티클 애니메이션 상태 갱신
   *
   * @param {number} dt - 델타 시간 (초)
   * @param {number} combo - 현재 콤보 (강도 업데이트용)
   */
  update(dt, combo = null) {
    if (!this.active) return;
    
    this.time += dt;
    
    // 콤보 업데이트 시 강도 재계산
    if (combo !== null && combo !== this.combo) {
      this.combo = combo;
      this.intensity = this._calculateIntensity(combo);
    }
    
    // FEVER 텍스트 애니메이션 업데이트
    if (this.showFeverText) {
      this.feverTextTime += dt;
      if (this.feverTextTime >= this.feverTextDuration) {
        this.showFeverText = false;
      }
    }
    
    // 새 파티클 생성
    const config = FEVER_BORDER_CONFIG.particles;
    const spawnCount = Math.floor(config.spawnRate * dt * this.intensity);
    for (let i = 0; i < spawnCount; i++) {
      this._spawnParticle();
    }
    
    // 파티클 업데이트
    const nextParticles = [];
    for (const p of this.particles) {
      if (p.ttl === 0) p.ttl = p.life;
      p.life -= dt;
      
      if (p.life <= 0) continue;
      
      // 위치 업데이트
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      
      // 상승 효과 (좌우측 파티클)
      if (p.side === 2 || p.side === 3) {
        p.vy -= config.riseSpeed * dt * 0.5;
      }
      
      // 크기 변화 (시간이 지날수록 작아짐)
      const lifeRatio = p.life / p.ttl;
      p.currentSize = p.size * lifeRatio;
      
      nextParticles.push(p);
    }
    this.particles = nextParticles;
  }

  /**
   * 렌더링
   * [v6.0.0] 화면 테두리 불꽃 효과 그리기
   *
   * @param {CanvasRenderingContext2D} ctx - 캔버스 컨텍스트
   */
  render(ctx) {
    if (!this.active) return;
    
    const config = FEVER_BORDER_CONFIG;
    
    ctx.save();
    
    // 글로우 효과 설정
    ctx.shadowColor = config.colors.glow;
    ctx.shadowBlur = config.glow.blur * this.intensity;
    
    // 파티클 렌더링
    for (const p of this.particles) {
      const flicker = 0.7 + 0.3 * Math.sin(this.time * config.particles.flickerSpeed + p.flickerOffset);
      const alpha = (p.life / p.ttl) * flicker;
      
      // 색상 단계에 따른 그라데이션
      const gradient = this._createParticleGradient(ctx, p);
      
      ctx.globalAlpha = alpha;
      ctx.fillStyle = gradient;
      
      // 불꽃 모양 (타원)
      ctx.beginPath();
      ctx.ellipse(
        p.x, p.y,
        p.currentSize * 0.6,
        p.currentSize,
        p.side === 2 || p.side === 3 ? 0 : Math.PI / 2,
        0, Math.PI * 2
      );
      ctx.fill();
    }
    
    // 테두리 글로우 라인
    this._renderBorderGlow(ctx);
    
    // FEVER 텍스트 렌더링
    if (this.showFeverText) {
      this._renderFeverText(ctx);
    }
    
    ctx.restore();
  }

  /**
   * 파티클 그라데이션 생성
   * [v6.0.0] 불꽃 색상 그라데이션
   *
   * @param {CanvasRenderingContext2D} ctx - 캔버스 컨텍스트
   * @param {Object} p - 파티클 객체
   * @returns {CanvasGradient} 방사형 그라데이션
   */
  _createParticleGradient(ctx, p) {
    const config = FEVER_BORDER_CONFIG;
    const gradient = ctx.createRadialGradient(
      p.x, p.y, 0,
      p.x, p.y, p.currentSize
    );
    
    // 색상 단계에 따른 그라데이션
    gradient.addColorStop(0, config.colors.core);
    gradient.addColorStop(0.3, config.colors.inner);
    gradient.addColorStop(0.6, config.colors.middle);
    gradient.addColorStop(1, config.colors.outer);
    
    return gradient;
  }

  /**
   * 테두리 글로우 렌더링
   * [v6.0.0] 테두리 전체의 펄싱 글로우 효과
   *
   * @param {CanvasRenderingContext2D} ctx - 캔버스 컨텍스트
   */
  _renderBorderGlow(ctx) {
    const config = FEVER_BORDER_CONFIG;
    const pulse = 0.7 + 0.3 * Math.sin(this.time * 5);
    const thickness = config.thickness.base + (config.thickness.max - config.thickness.base) * (this.intensity - 1);
    
    ctx.globalAlpha = 0.3 * pulse * this.intensity;
    ctx.strokeStyle = config.colors.inner;
    ctx.lineWidth = thickness;
    ctx.shadowBlur = config.glow.maxBlur * pulse * this.intensity;
    
    // 4면 테두리
    ctx.strokeRect(
      thickness / 2,
      thickness / 2,
      this.screenWidth - thickness,
      this.screenHeight - thickness
    );
  }

  /**
   * FEVER 텍스트 렌더링
   * [v6.0.0] 피버 진입 시 "FEVER!" 텍스트 애니메이션
   *
   * @param {CanvasRenderingContext2D} ctx - 캔버스 컨텍스트
   */
  _renderFeverText(ctx) {
    const progress = this.feverTextTime / this.feverTextDuration;
    const config = FEVER_BORDER_CONFIG;
    
    // 팝인 애니메이션
    let scale = 1.0;
    if (progress < 0.2) {
      // 팝인 (0.5 → 1.2 → 1.0)
      const popProgress = progress / 0.2;
      scale = 0.5 + 0.7 * Math.sin(popProgress * Math.PI / 2);
    } else if (progress < 0.8) {
      // 유지 (약간의 바운스)
      scale = 1.0 + 0.1 * Math.sin((progress - 0.2) * 10);
    } else {
      // 페이드 아웃
      scale = 1.0 - (progress - 0.8) / 0.2 * 0.5;
    }
    
    const alpha = progress < 0.8 ? 1.0 : 1.0 - (progress - 0.8) / 0.2;
    
    ctx.save();
    ctx.globalAlpha = alpha;
    
    // 중앙 위치
    const centerX = this.screenWidth / 2;
    const centerY = this.screenHeight / 2;
    
    // 그림자/글로우 효과
    ctx.shadowColor = config.colors.glow;
    ctx.shadowBlur = 30 * scale;
    
    // 폰트 설정
    const fontSize = 72 * scale;
    ctx.font = `bold ${fontSize}px "Segoe UI Black", "Arial Black", "Impact", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    
    // 그라데이션 텍스트
    const gradient = ctx.createLinearGradient(
      centerX - 100, centerY - 50,
      centerX + 100, centerY + 50
    );
    gradient.addColorStop(0, config.colors.outer);
    gradient.addColorStop(0.5, config.colors.inner);
    gradient.addColorStop(1, config.colors.core);
    
    // 텍스트 그리기
    ctx.fillStyle = gradient;
    ctx.fillText("FEVER!", centerX, centerY);
    
    // 외곽선
    ctx.strokeStyle = config.colors.core;
    ctx.lineWidth = 3 * scale;
    ctx.strokeText("FEVER!", centerX, centerY);
    
    // 1.5x 배지 (오른쪽 하단)
    this._renderMultiplierBadge(ctx, centerX + 120 * scale, centerY + 20 * scale, scale);
    
    ctx.restore();
  }

  /**
   * 배수 배지 렌더링
   * [v6.0.0] "1.5x" 배지 표시
   *
   * @param {CanvasRenderingContext2D} ctx - 캔버스 컨텍스트
   * @param {number} x - X 좌표
   * @param {number} y - Y 좌표
   * @param {number} scale - 스케일
   */
  _renderMultiplierBadge(ctx, x, y, scale) {
    const config = FEVER_BORDER_CONFIG;
    const badgeSize = 35 * scale;
    
    // 배지 배경 (원형)
    ctx.beginPath();
    ctx.arc(x, y, badgeSize, 0, Math.PI * 2);
    ctx.fillStyle = config.colors.core;
    ctx.fill();
    
    // 배지 글로우
    ctx.shadowBlur = 15 * scale;
    ctx.strokeStyle = config.colors.outer;
    ctx.lineWidth = 2 * scale;
    ctx.stroke();
    
    // 텍스트
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#FFFFFF";
    ctx.font = `bold ${14 * scale}px "Segoe UI", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("1.5x", x, y);
  }

  /**
   * 활성화 상태 확인
   * [v6.0.0] 현재 피버 볼더가 활성화되어 있는지
   *
   * @returns {boolean} 활성화 여부
   */
  isActive() {
    return this.active;
  }

  /**
   * 화면 크기 업데이트
   * [v6.0.0] 리사이즈 시 화면 크기 갱신
   *
   * @param {number} width - 새 너비
   * @param {number} height - 새 높이
   */
  setScreenSize(width, height) {
    this.screenWidth = width;
    this.screenHeight = height;
  }
}

// 싱글톤 인스턴스 생성
const feverBorder = new FeverBorder();

// ============================================================================
// 피버 볼더 외부용 API 함수들
// ============================================================================

/**
 * 피버 볼더 활성화
 * [v6.0.0] 피버 모드 진입 시 불꽃 테두리 효과 시작
 *
 * @param {number} combo - 진입 시 콤보 수
 * @param {number} width - 화면 너비
 * @param {number} height - 화면 높이
 *
 * 사용 예시:
 *   import { activateFeverBorder } from './effects.js';
 *
 *   // 10콤보로 피버 진입
 *   activateFeverBorder(10, 800, 600);
 */
export function activateFeverBorder(combo, width, height) {
  feverBorder.activate(combo, width, height);
}

/**
 * 피버 볼더 비활성화
 * [v6.0.0] 피버 모드 종료 시 불꽃 테두리 효과 정지
 *
 * 사용 예시:
 *   import { deactivateFeverBorder } from './effects.js';
 *
 *   // 피버 종료 시
 *   deactivateFeverBorder();
 */
export function deactivateFeverBorder() {
  feverBorder.deactivate();
}

/**
 * 피버 볼더 업데이트
 * [v6.0.0] 렌더링 루프에서 호출하여 애니메이션 상태 갱신
 *
 * @param {number} dt - 델타 시간 (초)
 * @param {number} combo - 현재 콤보 (강도 업데이트용, 옵션)
 *
 * 사용 예시:
 *   import { updateFeverBorder } from './effects.js';
 *
 *   function gameLoop(deltaTime) {
 *     updateFeverBorder(deltaTime, currentCombo);
 *     // ... 다른 업데이트 로직
 *   }
 */
export function updateFeverBorder(dt, combo = null) {
  feverBorder.update(dt, combo);
}

/**
 * 피버 볼더 렌더링
 * [v6.0.0] 화면 테두리 불꽃 효과 그리기
 *
 * @param {CanvasRenderingContext2D} ctx - 캔버스 컨텍스트
 *
 * 사용 예시:
 *   import { renderFeverBorder } from './effects.js';
 *
 *   function render() {
 *     // 게임 렌더링
 *     renderGame(ctx);
 *
 *     // 피버 볼더 렌더링 (최상위 레이어)
 *     renderFeverBorder(ctx);
 *   }
 */
export function renderFeverBorder(ctx) {
  feverBorder.render(ctx);
}

/**
 * 피버 볼더 활성화 상태 확인
 * [v6.0.0] 현재 피버 볼더가 활성화되어 있는지 확인
 *
 * @returns {boolean} 활성화 여부
 *
 * 사용 예시:
 *   import { isFeverBorderActive } from './effects.js';
 *
 *   if (isFeverBorderActive()) {
 *     // 피버 중인 경우 특수 처리
 *   }
 */
export function isFeverBorderActive() {
  return feverBorder.isActive();
}

/**
 * 피버 볼더 화면 크기 설정
 * [v6.0.0] 창 크기 변경 시 호출
 *
 * @param {number} width - 새 너비
 * @param {number} height - 새 높이
 *
 * 사용 예시:
 *   import { setFeverBorderScreenSize } from './effects.js';
 *
 *   window.addEventListener('resize', () => {
 *     setFeverBorderScreenSize(window.innerWidth, window.innerHeight);
 *   });
 */
export function setFeverBorderScreenSize(width, height) {
  feverBorder.setScreenSize(width, height);
}

/**
 * FeverBorder 인스턴스 직접 접근 (고급 사용)
 * [v6.0.0] 더 세밀한 제어가 필요한 경우 사용
 *
 * @returns {FeverBorder} FeverBorder 인스턴스
 */
export function getFeverBorder() {
  return feverBorder;
}

// ============================================================================
// [v7.0.0] 아이템 시스템 시각 효과 (Item System Effects) - Feature 7
// ============================================================================

import { ITEM_TYPES, ITEM_VISUALS } from "../game/core/items.js";

/**
 * 아이템 효과 설정값
 * [v7.0.0] 3종류 아이템의 시각적 속성 정의
 */
const ITEM_EFFECT_CONFIG = {
  bomb: {
    explosionColor: "#ff4444",
    explosionGlow: "#ff0000",
    particleColors: ["#ff4444", "#ff8800", "#ffaa00", "#ffffff"],
    particleCount: 40,
    shockwaveColor: "#ff6600",
    text: "BOOM!",
    textColor: "#ff4444",
    shakeIntensity: "medium",
  },
  star: {
    beamColor: "#ffdd00",
    sparkleColors: ["#ffdd00", "#ffffff", "#ffec8b", "#ffa500"],
    particleCount: 60,
    trailColor: "#ffaa00",
    text: "STAR!",
    textColor: "#ffdd00",
  },
  shield: {
    activationColor: "#4488ff",
    glowColor: "#00aaff",
    particleColors: ["#4488ff", "#00aaff", "#80ccff", "#ffffff"],
    particleCount: 30,
    barrierColor: "rgba(68, 136, 255, 0.3)",
    text: "SHIELD!",
    textColor: "#4488ff",
  },
};

/**
 * ItemEffects 클래스
 * [v7.0.0] 아이템 발동 시각 효과 관리
 *
 * 기능:
 * - 폭탄: 3x3 폭발 파티클 + 충격파 + 화면 흔들림
 * - 별: 수평 빔 효과 + 반짝임 파티클
 * - 실드: 보호막 생성 효과 + 글로우
 */
class ItemEffects {
  constructor() {
    // 활성 효과 목록
    this.activeEffects = [];

    // 실드 오버레이 상태
    this.shieldOverlay = {
      active: false,
      endTime: 0,
      alpha: 0,
    };

    // 파티클 풀
    this.particles = [];
  }

  /**
   * 효과 초기화
   * [v7.0.0] 모든 활성 효과 제거
   */
  reset() {
    this.activeEffects = [];
    this.shieldOverlay = {
      active: false,
      endTime: 0,
      alpha: 0,
    };
    this.particles = [];
  }

  // --------------------------------------------------------------------------
  // 폭탄 효과
  // --------------------------------------------------------------------------

  /**
   * 폭탄 폭발 효과 시작
   * [v7.0.0] 폭탄 아이템 발동 시 3x3 폭발 연출
   *
   * @param {number} centerX - 폭탄 중심 X (화면 좌표)
   * @param {number} centerY - 폭탄 중심 Y (화면 좌표)
   * @param {number} cellSize - 셀 크기
   */
  triggerBombExplosion(centerX, centerY, cellSize) {
    const config = ITEM_EFFECT_CONFIG.bomb;
    const explosionSize = cellSize * 3.5; // 3x3보다 약간 큰 영역

    // 폭발 효과 추가
    this.activeEffects.push({
      type: "bomb",
      x: centerX,
      y: centerY,
      size: explosionSize,
      startTime: performance.now(),
      duration: 600, // 600ms
      config,
    });

    // 파티클 생성
    this._createExplosionParticles(centerX, centerY, config, cellSize);

    // 화면 흔들림 트리거
    triggerScreenShake(config.shakeIntensity);
  }

  // --------------------------------------------------------------------------
  // 별 효과
  // --------------------------------------------------------------------------

  /**
   * 별빛 효과 시작
   * [v7.0.0] 별 아이템 발동 시 수평 빔 연출
   *
   * @param {number} y - 별이 있는 Y 좌표 (화면 좌표)
   * @param {number} boardX - 보드 왼쪽 X
   * @param {number} boardWidth - 보드 너비
   * @param {number} cellSize - 셀 크기
   */
  triggerStarBeam(y, boardX, boardWidth, cellSize) {
    const config = ITEM_EFFECT_CONFIG.star;

    // 빔 효과 추가
    this.activeEffects.push({
      type: "star",
      y: y + cellSize / 2,
      x: boardX,
      width: boardWidth,
      startTime: performance.now(),
      duration: 800, // 800ms
      config,
    });

    // 반짝임 파티클 생성
    for (let i = 0; i < config.particleCount; i++) {
      const x = boardX + Math.random() * boardWidth;
      const particleY = y + (Math.random() - 0.5) * cellSize * 2;

      this.particles.push({
        x,
        y: particleY,
        vx: (Math.random() - 0.5) * 200,
        vy: (Math.random() - 0.5) * 100,
        life: 0.5 + Math.random() * 0.5,
        maxLife: 1.0,
        size: 2 + Math.random() * 4,
        color: config.sparkleColors[Math.floor(Math.random() * config.sparkleColors.length)],
        type: "star",
      });
    }
  }

  // --------------------------------------------------------------------------
  // 실드 효과
  // --------------------------------------------------------------------------

  /**
   * 실드 활성화 효과 시작
   * [v7.0.0] 실드 아이템 발동 시 보호막 생성 연출
   *
   * @param {number} x - 실드 위치 X (화면 좌표)
   * @param {number} y - 실드 위치 Y (화면 좌표)
   * @param {number} cellSize - 셀 크기
   */
  triggerShieldActivation(x, y, cellSize) {
    const config = ITEM_EFFECT_CONFIG.shield;

    // 활성화 효과 추가
    this.activeEffects.push({
      type: "shield_activate",
      x: x + cellSize / 2,
      y: y + cellSize / 2,
      size: cellSize,
      startTime: performance.now(),
      duration: 1000, // 1초
      config,
    });

    // 보호막 파티클 생성
    for (let i = 0; i < config.particleCount; i++) {
      const angle = (Math.PI * 2 * i) / config.particleCount;
      const speed = 50 + Math.random() * 100;

      this.particles.push({
        x: x + cellSize / 2,
        y: y + cellSize / 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.6 + Math.random() * 0.4,
        maxLife: 1.0,
        size: 3 + Math.random() * 3,
        color: config.particleColors[Math.floor(Math.random() * config.particleColors.length)],
        type: "shield",
      });
    }
  }

  /**
   * 실드 오버레이 활성화
   * [v7.0.0] 보드에 실드 상태 표시
   *
   * @param {number} duration - 지속 시간 (ms, 0이면 무제한)
   */
  activateShieldOverlay(duration = 0) {
    this.shieldOverlay.active = true;
    this.shieldOverlay.endTime = duration > 0 ? performance.now() + duration : Infinity;
    this.shieldOverlay.alpha = 1;
  }

  /**
   * 실드 오버레이 비활성화
   * [v7.0.0] 실드 상태 해제
   */
  deactivateShieldOverlay() {
    this.shieldOverlay.active = false;
    this.shieldOverlay.alpha = 0;
  }

  // --------------------------------------------------------------------------
  // 파티클 생성
  // --------------------------------------------------------------------------

  /**
   * 폭발 파티클 생성
   * [v7.0.0] 폭탄 효과용 파티클 생성
   */
  _createExplosionParticles(centerX, centerY, config, cellSize) {
    // 폭발 중심에서 방사형 파티클
    for (let i = 0; i < config.particleCount; i++) {
      const angle = (Math.PI * 2 * i) / config.particleCount + Math.random() * 0.5;
      const speed = 100 + Math.random() * 200;

      this.particles.push({
        x: centerX,
        y: centerY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.4 + Math.random() * 0.4,
        maxLife: 1.0,
        size: 4 + Math.random() * 6,
        color: config.particleColors[Math.floor(Math.random() * config.particleColors.length)],
        type: "explosion",
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 10,
      });
    }

    // 연기 파티클
    for (let i = 0; i < 15; i++) {
      this.particles.push({
        x: centerX + (Math.random() - 0.5) * cellSize * 2,
        y: centerY + (Math.random() - 0.5) * cellSize * 2,
        vx: (Math.random() - 0.5) * 50,
        vy: -30 - Math.random() * 50,
        life: 0.8 + Math.random() * 0.4,
        maxLife: 1.0,
        size: 8 + Math.random() * 8,
        color: "rgba(100, 100, 100, 0.5)",
        type: "smoke",
        grow: true,
      });
    }
  }

  // --------------------------------------------------------------------------
  // 업데이트
  // --------------------------------------------------------------------------

  /**
   * 업데이트
   * [v7.0.0] 모든 효과 상태 갱신
   *
   * @param {number} dt - 델타 시간 (초)
   */
  update(dt) {
    // 활성 효과 업데이트
    const now = performance.now();
    this.activeEffects = this.activeEffects.filter((effect) => {
      const elapsed = now - effect.startTime;
      return elapsed < effect.duration;
    });

    // 실드 오버레이 업데이트
    if (this.shieldOverlay.active && this.shieldOverlay.endTime !== Infinity) {
      if (now >= this.shieldOverlay.endTime) {
        this.shieldOverlay.alpha = Math.max(0, this.shieldOverlay.alpha - dt * 2);
        if (this.shieldOverlay.alpha <= 0) {
          this.shieldOverlay.active = false;
        }
      }
    }

    // 파티클 업데이트
    const nextParticles = [];
    for (const p of this.particles) {
      p.life -= dt;
      if (p.life <= 0) continue;

      // 위치 업데이트
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // 중력 (폭발/연기 제외)
      if (p.type !== "explosion" && p.type !== "smoke") {
        p.vy += 100 * dt;
      }

      // 공기 저항
      p.vx *= 0.98;
      p.vy *= 0.98;

      // 회전 업데이트
      if (p.rotation !== undefined) {
        p.rotation += (p.rotationSpeed || 0) * dt;
      }

      // 크기 성장 (연기)
      if (p.grow) {
        p.size += 10 * dt;
      }

      nextParticles.push(p);
    }
    this.particles = nextParticles;
  }

  // --------------------------------------------------------------------------
  // 렌더링
  // --------------------------------------------------------------------------

  /**
   * 렌더링
   * [v7.0.0] 모든 아이템 효과 그리기
   *
   * @param {CanvasRenderingContext2D} ctx - 캔버스 컨텍스트
   * @param {number} boardX - 보드 X 좌표
   * @param {number} boardY - 보드 Y 좌표
   * @param {number} boardWidth - 보드 너비
   * @param {number} boardHeight - 보드 높이
   * @param {number} cellSize - 셀 크기
   */
  render(ctx, boardX, boardY, boardWidth, boardHeight, cellSize) {
    const now = performance.now();

    // 활성 효과 렌더링
    for (const effect of this.activeEffects) {
      const elapsed = now - effect.startTime;
      const progress = elapsed / effect.duration;

      switch (effect.type) {
        case "bomb":
          this._renderBombEffect(ctx, effect, progress);
          break;
        case "star":
          this._renderStarEffect(ctx, effect, progress);
          break;
        case "shield_activate":
          this._renderShieldActivation(ctx, effect, progress);
          break;
      }
    }

    // 실드 오버레이 렌더링
    if (this.shieldOverlay.active && this.shieldOverlay.alpha > 0) {
      this._renderShieldOverlay(ctx, boardX, boardY, boardWidth, boardHeight);
    }

    // 파티클 렌더링
    this._renderParticles(ctx);
  }

  /**
   * 폭탄 효과 렌더링
   * [v7.0.0] 폭발 원형 + 텍스트
   */
  _renderBombEffect(ctx, effect, progress) {
    const { x, y, size, config } = effect;

    // 확장 애니메이션 (0~0.3: 확장, 0.3~1.0: 소멸)
    let radius;
    if (progress < 0.3) {
      radius = size * 0.5 * (progress / 0.3);
    } else {
      radius = size * 0.5 * (1 - (progress - 0.3) / 0.7);
    }

    const alpha = 1 - progress;

    ctx.save();

    // 외부 글로우
    ctx.shadowColor = config.explosionGlow;
    ctx.shadowBlur = 30 * alpha;

    // 폭발 원
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, config.explosionColor + "ff");
    gradient.addColorStop(0.5, config.explosionGlow + Math.floor(alpha * 255).toString(16).padStart(2, "0"));
    gradient.addColorStop(1, config.explosionGlow + "00");

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    // 텍스트
    if (progress < 0.5) {
      const textAlpha = 1 - progress * 2;
      ctx.globalAlpha = textAlpha;
      ctx.fillStyle = config.textColor;
      ctx.font = `bold 36px "Segoe UI Black", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowBlur = 15;
      ctx.fillText(config.text, x, y - radius - 20);
    }

    ctx.restore();
  }

  /**
   * 별 효과 렌더링
   * [v7.0.0] 수평 빔 + 반짝임
   */
  _renderStarEffect(ctx, effect, progress) {
    const { y, x, width, config } = effect;

    const alpha = 1 - progress;
    const beamWidth = 10 + 40 * Math.sin(progress * Math.PI);

    ctx.save();

    // 수평 빔
    const gradient = ctx.createLinearGradient(x, y - beamWidth / 2, x, y + beamWidth / 2);
    gradient.addColorStop(0, config.beamColor + "00");
    gradient.addColorStop(0.5, config.beamColor + Math.floor(alpha * 255).toString(16).padStart(2, "0"));
    gradient.addColorStop(1, config.beamColor + "00");

    ctx.fillStyle = gradient;
    ctx.fillRect(x, y - beamWidth / 2, width, beamWidth);

    // 글로우 선
    ctx.shadowColor = config.beamColor;
    ctx.shadowBlur = 20 * alpha;
    ctx.strokeStyle = config.beamColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + width, y);
    ctx.stroke();

    // 텍스트
    if (progress < 0.4) {
      const textAlpha = 1 - progress * 2.5;
      ctx.globalAlpha = textAlpha;
      ctx.fillStyle = config.textColor;
      ctx.font = `bold 32px "Segoe UI Black", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowBlur = 20;
      ctx.fillText(config.text, x + width / 2, y - 30);
    }

    ctx.restore();
  }

  /**
   * 실드 활성화 효과 렌더링
   * [v7.0.0] 보호막 생성 애니메이션
   */
  _renderShieldActivation(ctx, effect, progress) {
    const { x, y, size, config } = effect;

    const alpha = 1 - progress;
    const scale = 1 + progress * 0.5;

    ctx.save();

    // 확장 원
    ctx.shadowColor = config.glowColor;
    ctx.shadowBlur = 25 * alpha;

    const gradient = ctx.createRadialGradient(x, y, 0, x, y, size * scale);
    gradient.addColorStop(0, config.activationColor + "00");
    gradient.addColorStop(0.7, config.activationColor + Math.floor(alpha * 100).toString(16).padStart(2, "0"));
    gradient.addColorStop(1, config.glowColor + "00");

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, size * scale, 0, Math.PI * 2);
    ctx.fill();

    // 텍스트
    if (progress < 0.5) {
      const textAlpha = 1 - progress * 2;
      ctx.globalAlpha = textAlpha;
      ctx.fillStyle = config.textColor;
      ctx.font = `bold 28px "Segoe UI Black", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowBlur = 15;
      ctx.fillText(config.text, x, y - size * scale - 15);
    }

    ctx.restore();
  }

  /**
   * 실드 오버레이 렌더링
   * [v7.0.0] 보드 테두리에 실드 상태 표시
   */
  _renderShieldOverlay(ctx, boardX, boardY, boardWidth, boardHeight) {
    const alpha = this.shieldOverlay.alpha * 0.3;

    ctx.save();

    // 테두리 글로우
    ctx.shadowColor = ITEM_EFFECT_CONFIG.shield.glowColor;
    ctx.shadowBlur = 20;

    // 테두리 선
    ctx.strokeStyle = ITEM_EFFECT_CONFIG.shield.activationColor + Math.floor(alpha * 255).toString(16).padStart(2, "0");
    ctx.lineWidth = 4;
    ctx.strokeRect(boardX - 5, boardY - 5, boardWidth + 10, boardHeight + 10);

    // 남부 광선 효과
    const time = performance.now() / 1000;
    for (let i = 0; i < 4; i++) {
      const offset = Math.sin(time * 2 + i * Math.PI / 2) * 5;
      ctx.strokeStyle = ITEM_EFFECT_CONFIG.shield.glowColor + "40";
      ctx.lineWidth = 2;
      ctx.strokeRect(boardX - 8 + offset, boardY - 8 + offset, boardWidth + 16, boardHeight + 16);
    }

    // 실드 아이콘
    ctx.fillStyle = ITEM_EFFECT_CONFIG.shield.textColor;
    ctx.font = "bold 20px Arial";
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.fillText("🛡️ ACTIVE", boardX + boardWidth, boardY - 30);

    ctx.restore();
  }

  /**
   * 파티클 렌더링
   * [v7.0.0] 모든 파티클 그리기
   */
  _renderParticles(ctx) {
    ctx.save();

    for (const p of this.particles) {
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;

      if (p.type === "smoke") {
        // 연기 파티클
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // 일반 파티클
        ctx.fillStyle = p.color;

        if (p.rotation !== undefined) {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
          ctx.restore();
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    ctx.restore();
  }
}

// 싱글톤 인스턴스 생성
const itemEffects = new ItemEffects();

// ============================================================================
// 아이템 효과 외부용 API 함수들
// ============================================================================

/**
 * 폭탄 폭발 효과 트리거
 * [v7.0.0] 폭탄 아이템 발동 시 시각 효과 시작
 *
 * @param {number} centerX - 폭탄 중심 X (화면 좌표)
 * @param {number} centerY - 폭탄 중심 Y (화면 좌표)
 * @param {number} cellSize - 셀 크기
 *
 * 사용 예시:
 *   import { triggerBombEffect } from './effects.js';
 *   triggerBombEffect(200, 300, 30);
 */
export function triggerBombEffect(centerX, centerY, cellSize) {
  itemEffects.triggerBombExplosion(centerX, centerY, cellSize);
}

/**
 * 별빛 효과 트리거
 * [v7.0.0] 별 아이템 발동 시 시각 효과 시작
 *
 * @param {number} y - 별 위치 Y (화면 좌표)
 * @param {number} boardX - 보드 왼쪽 X
 * @param {number} boardWidth - 보드 너비
 * @param {number} cellSize - 셀 크기
 *
 * 사용 예시:
 *   import { triggerStarEffect } from './effects.js';
 *   triggerStarEffect(300, 50, 300, 30);
 */
export function triggerStarEffect(y, boardX, boardWidth, cellSize) {
  itemEffects.triggerStarBeam(y, boardX, boardWidth, cellSize);
}

/**
 * 실드 활성화 효과 트리거
 * [v7.0.0] 실드 아이템 발동 시 시각 효과 시작
 *
 * @param {number} x - 실드 위치 X (화면 좌표)
 * @param {number} y - 실드 위치 Y (화면 좌표)
 * @param {number} cellSize - 셀 크기
 *
 * 사용 예시:
 *   import { triggerShieldEffect } from './effects.js';
 *   triggerShieldEffect(200, 300, 30);
 */
export function triggerShieldEffect(x, y, cellSize) {
  itemEffects.triggerShieldActivation(x, y, cellSize);
}

/**
 * 실드 오버레이 활성화
 * [v7.0.0] 보드에 실드 상태 표시 활성화
 *
 * @param {number} duration - 지속 시간 (ms, 0이면 무제한)
 *
 * 사용 예시:
 *   import { activateShieldOverlay } from './effects.js';
 *   activateShieldOverlay();
 */
export function activateShieldOverlay(duration = 0) {
  itemEffects.activateShieldOverlay(duration);
}

/**
 * 실드 오버레이 비활성화
 * [v7.0.0] 보드 실드 상태 표시 해제
 *
 * 사용 예시:
 *   import { deactivateShieldOverlay } from './effects.js';
 *   deactivateShieldOverlay();
 */
export function deactivateShieldOverlay() {
  itemEffects.deactivateShieldOverlay();
}

/**
 * 아이템 효과 업데이트
 * [v7.0.0] 렌더링 루프에서 호출하여 애니메이션 상태 갱신
 *
 * @param {number} dt - 델타 시간 (초)
 *
 * 사용 예시:
 *   import { updateItemEffects } from './effects.js';
 *   updateItemEffects(deltaTime);
 */
export function updateItemEffects(dt) {
  itemEffects.update(dt);
}

/**
 * 아이템 효과 렌더링
 * [v7.0.0] 모든 아이템 시각 효과 그리기
 *
 * @param {CanvasRenderingContext2D} ctx - 캔버스 컨텍스트
 * @param {number} boardX - 보드 X 좌표
 * @param {number} boardY - 보드 Y 좌표
 * @param {number} boardWidth - 보드 너비
 * @param {number} boardHeight - 보드 높이
 * @param {number} cellSize - 셀 크기
 *
 * 사용 예시:
 *   import { renderItemEffects } from './effects.js';
 *   renderItemEffects(ctx, 50, 50, 300, 600, 30);
 */
export function renderItemEffects(ctx, boardX, boardY, boardWidth, boardHeight, cellSize) {
  itemEffects.render(ctx, boardX, boardY, boardWidth, boardHeight, cellSize);
}

/**
 * 아이템 효과 리셋
 * [v7.0.0] 모든 아이템 효과 초기화 (새 게임 시작 시)
 *
 * 사용 예시:
 *   import { resetItemEffects } from './effects.js';
 *   resetItemEffects();
 */
export function resetItemEffects() {
  itemEffects.reset();
}

/**
 * ItemEffects 인스턴스 직접 접근 (고급 사용)
 * [v7.0.0] 더 세밀한 제어가 필요한 경우 사용
 *
 * @returns {ItemEffects} ItemEffects 인스턴스
 */
export function getItemEffects() {
  return itemEffects;
}

// ============================================================================
// [v10.0.0] 도전 과제 해제 알림 시스템 (Achievement Unlock Notification)
// ============================================================================

/**
 * 도전 과제 알림 설정값
 * [v10.0.0] 해제 알림 애니메이션 속성 정의
 */
const ACHIEVEMENT_CONFIG = {
  // 알림 표시 시간
  displayDuration: 4000,      // 총 표시 시간 (ms)
  entranceDuration: 500,      // 진입 애니메이션 (ms)
  exitDuration: 300,          // 퇴장 애니메이션 (ms)
  // 위치 및 크기
  position: {
    top: 80,                  // 상단에서 거리
    right: 20,                // 우측에서 거리
    width: 320,               // 알림 너비
    height: 90,               // 알림 높이
  },
  // 색상 (희귀도별)
  rarityColors: {
    1: { border: '#CD7F32', glow: 'rgba(205, 127, 50, 0.5)', bg: 'rgba(205, 127, 50, 0.15)' },  // Bronze
    2: { border: '#C0C0C0', glow: 'rgba(192, 192, 192, 0.5)', bg: 'rgba(192, 192, 192, 0.15)' }, // Silver
    3: { border: '#FFD700', glow: 'rgba(255, 215, 0, 0.5)', bg: 'rgba(255, 215, 0, 0.15)' },     // Gold
  },
  // 파티클 설정
  particles: {
    count: 30,
    colors: ['#FFD700', '#FFA500', '#FF6347', '#00CED1', '#9370DB'],
    spread: 100,
  }
};

/**
 * AchievementNotification 클래스
 * [v10.0.0] 도전 과제 해제 알림 관리
 *
 * 기능:
 * - 슬라이드 인/아웃 애니메이션
 * - 희귀도별 색상 테마
 * - 반짝임 파티클 효과
 * - 연속 알림 큐 관리
 */
class AchievementNotification {
  constructor() {
    // 알림 큐
    this.queue = [];
    // 현재 표시 중인 알림
    this.current = null;
    // 파티클 상태
    this.particles = [];
    // 애니메이션 상태
    this.animState = 'idle'; // 'idle', 'entering', 'displaying', 'exiting'
    this.animStartTime = 0;
    // 캔버스 컨텍스트 (렌더링용)
    this.ctx = null;
    this.canvasWidth = 0;
    this.canvasHeight = 0;
  }

  /**
   * 알림 표시
   * [v10.0.0] 새 도전 과제 해제 알림 추가
   *
   * @param {Object} achievement - 도전 과제 객체
   * @param {string} achievement.name - 도전 과제 이름 (다국어 객체)
   * @param {string} achievement.description - 설명 (다국어 객체)
   * @param {Object} achievement.rarity - 희귀도 정보
   * @param {string} achievement.category - 카테고리 ID
   *
   * 사용 예시:
   *   showAchievementNotification({
   *     name: { 'ko': '첫 승리', 'en': 'First Blood', ... },
   *     description: { 'ko': '...', ... },
   *     rarity: { level: 1, icon: '🥉', color: '#CD7F32', name: 'Bronze' },
   *     category: 'combat'
   *   });
   */
  show(achievement) {
    // 현재 언어에 맞는 이름과 설명 가져오기
    const lang = document.documentElement.lang || 'ko';
    const name = achievement.name?.[lang] || achievement.name?.['ko'] || 'Achievement';
    const description = achievement.description?.[lang] || achievement.description?.['ko'] || '';

    const notification = {
      id: achievement.id || Date.now(),
      name,
      description,
      rarity: achievement.rarity,
      category: achievement.category,
      timestamp: Date.now(),
    };

    // 큐에 추가
    this.queue.push(notification);

    // 현재 알림이 없으면 바로 표시
    if (!this.current) {
      this._showNext();
    }

    console.log(`[AchievementNotification] 알림 큐 추가: ${name}`);
  }

  /**
   * 다음 알림 표시
   * @private
   */
  _showNext() {
    if (this.queue.length === 0) {
      this.current = null;
      this.animState = 'idle';
      return;
    }

    this.current = this.queue.shift();
    this.animState = 'entering';
    this.animStartTime = performance.now();

    // 파티클 초기화
    this._initParticles();

    console.log(`[AchievementNotification] 알림 표시: ${this.current.name}`);
  }

  /**
   * 파티클 초기화
   * @private
   */
  _initParticles() {
    this.particles = [];
    const config = ACHIEVEMENT_CONFIG.particles;

    for (let i = 0; i < config.count; i++) {
      this.particles.push({
        x: 0,
        y: 0,
        vx: (Math.random() - 0.5) * config.spread,
        vy: (Math.random() - 0.5) * config.spread * 0.5,
        life: 0.5 + Math.random() * 0.5,
        maxLife: 1.0,
        size: 2 + Math.random() * 4,
        color: config.colors[Math.floor(Math.random() * config.colors.length)],
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.2,
      });
    }
  }

  /**
   * 업데이트
   * [v10.0.0] 알림 애니메이션 상태 업데이트
   *
   * @param {number} dt - 델타 시간 (초)
   */
  update(dt) {
    if (!this.current) return;

    const now = performance.now();
    const elapsed = now - this.animStartTime;

    switch (this.animState) {
      case 'entering':
        if (elapsed >= ACHIEVEMENT_CONFIG.entranceDuration) {
          this.animState = 'displaying';
          this.animStartTime = now;
        }
        break;

      case 'displaying':
        if (elapsed >= ACHIEVEMENT_CONFIG.displayDuration) {
          this.animState = 'exiting';
          this.animStartTime = now;
        }
        break;

      case 'exiting':
        if (elapsed >= ACHIEVEMENT_CONFIG.exitDuration) {
          this._showNext();
        }
        break;
    }

    // 파티클 업데이트
    this._updateParticles(dt);
  }

  /**
   * 파티클 업데이트
   * @private
   * @param {number} dt - 델타 시간
   */
  _updateParticles(dt) {
    const nextParticles = [];
    for (const p of this.particles) {
      p.life -= dt;
      if (p.life <= 0) continue;

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 20 * dt; // 중력
      p.rotation += p.rotationSpeed;

      nextParticles.push(p);
    }
    this.particles = nextParticles;
  }

  /**
   * 렌더링
   * [v10.0.0] 알림 UI 그리기
   *
   * @param {CanvasRenderingContext2D} ctx - 캔버스 컨텍스트
   * @param {number} canvasWidth - 캔버스 너비
   * @param {number} canvasHeight - 캔버스 높이
   */
  render(ctx, canvasWidth, canvasHeight) {
    if (!this.current) return;

    this.ctx = ctx;
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;

    const now = performance.now();
    const elapsed = now - this.animStartTime;
    const config = ACHIEVEMENT_CONFIG;
    const rarityColors = config.rarityColors[this.current.rarity?.level || 1];

    // 애니메이션 진행률 계산
    let progress = 0;
    let offsetX = 0;

    switch (this.animState) {
      case 'entering':
        progress = elapsed / config.entranceDuration;
        // easeOutBack
        const c1 = 1.70158;
        const c3 = c1 + 1;
        const easeOutBack = 1 + c3 * Math.pow(progress - 1, 3) + c1 * Math.pow(progress - 1, 2);
        offsetX = config.position.width * (1 - easeOutBack);
        break;

      case 'displaying':
        progress = 1;
        offsetX = 0;
        break;

      case 'exiting':
        progress = 1 - (elapsed / config.exitDuration);
        offsetX = config.position.width * (1 - progress);
        break;
    }

    // 알림 위치 계산
    const x = canvasWidth - config.position.right - config.position.width + offsetX;
    const y = config.position.top;
    const w = config.position.width;
    const h = config.position.height;

    ctx.save();

    // 그림자
    ctx.shadowColor = rarityColors.glow;
    ctx.shadowBlur = 20;

    // 배경
    ctx.fillStyle = 'rgba(20, 20, 30, 0.95)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 12);
    ctx.fill();

    // 테두리
    ctx.shadowBlur = 0;
    ctx.strokeStyle = rarityColors.border;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 12);
    ctx.stroke();

    // 남색 배경
    ctx.fillStyle = rarityColors.bg;
    ctx.beginPath();
    ctx.roundRect(x + 3, y + 3, w - 6, h - 6, 9);
    ctx.fill();

    ctx.restore();

    // 아이콘 영역
    const iconSize = 50;
    const iconX = x + 15;
    const iconY = y + (h - iconSize) / 2;

    // 아이콘 배경 (원형)
    ctx.save();
    ctx.fillStyle = rarityColors.bg;
    ctx.beginPath();
    ctx.arc(iconX + iconSize/2, iconY + iconSize/2, iconSize/2, 0, Math.PI * 2);
    ctx.fill();

    // 아이콘 테두리
    ctx.strokeStyle = rarityColors.border;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(iconX + iconSize/2, iconY + iconSize/2, iconSize/2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // 희귀도 아이콘
    ctx.save();
    ctx.font = '32px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.current.rarity?.icon || '🏆', iconX + iconSize/2, iconY + iconSize/2);
    ctx.restore();

    // 텍스트 영역
    const textX = iconX + iconSize + 15;
    const textY = y + 20;

    // "도전 과제 해제!" 라벨
    ctx.save();
    ctx.fillStyle = rarityColors.border;
    ctx.font = 'bold 12px "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('도전 과제 해제!', textX, textY);

    // 도전 과제 이름
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 16px "Segoe UI", sans-serif';
    ctx.fillText(this.current.name, textX, textY + 22);

    // 설명
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = '12px "Segoe UI", sans-serif';
    // 설명이 길면 자르기
    let desc = this.current.description;
    if (desc.length > 35) {
      desc = desc.substring(0, 32) + '...';
    }
    ctx.fillText(desc, textX, textY + 42);
    ctx.restore();

    // 파티클 렌더링
    this._renderParticles(ctx, x + w/2, y + h/2);
  }

  /**
   * 파티클 렌더링
   * @private
   */
  _renderParticles(ctx, centerX, centerY) {
    if (this.animState !== 'entering') return;

    ctx.save();
    for (const p of this.particles) {
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;

      const px = centerX + p.x;
      const py = centerY + p.y;

      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(p.rotation);
      ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size);
      ctx.restore();
    }
    ctx.restore();
  }

  /**
   * 리셋
   * [v10.0.0] 모든 알림 초기화
   */
  reset() {
    this.queue = [];
    this.current = null;
    this.particles = [];
    this.animState = 'idle';
  }
}

// 싱글톤 인스턴스
const achievementNotification = new AchievementNotification();

/**
 * 도전 과제 해제 알림 표시
 * [v10.0.0] 새 도전 과제 해제 시 호출
 *
 * @param {Object} achievement - 도전 과제 객체
 *
 * 사용 예시:
 *   import { showAchievementNotification } from './effects.js';
 *   showAchievementNotification(achievement);
 */
export function showAchievementNotification(achievement) {
  achievementNotification.show(achievement);
}

/**
 * 도전 과제 알림 업데이트
 * [v10.0.0] 게임 루프에서 호출
 *
 * @param {number} dt - 델타 시간 (초)
 *
 * 사용 예시:
 *   import { updateAchievementNotifications } from './effects.js';
 *   updateAchievementNotifications(deltaTime);
 */
export function updateAchievementNotifications(dt) {
  achievementNotification.update(dt);
}

/**
 * 도전 과제 알림 렌더링
 * [v10.0.0] 화면 상단에 알림 그리기
 *
 * @param {CanvasRenderingContext2D} ctx - 캔버스 컨텍스트
 * @param {number} canvasWidth - 캔버스 너비
 * @param {number} canvasHeight - 캔버스 높이
 *
 * 사용 예시:
 *   import { renderAchievementNotifications } from './effects.js';
 *   renderAchievementNotifications(ctx, canvas.width, canvas.height);
 */
export function renderAchievementNotifications(ctx, canvasWidth, canvasHeight) {
  achievementNotification.render(ctx, canvasWidth, canvasHeight);
}

/**
 * 도전 과제 알림 리셋
 * [v10.0.0] 모든 알림 초기화 (새 게임 시작 시)
 *
 * 사용 예시:
 *   import { resetAchievementNotifications } from './effects.js';
 *   resetAchievementNotifications();
 */
export function resetAchievementNotifications() {
  achievementNotification.reset();
}
