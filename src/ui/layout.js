// [v3.15.2] 모바일 뷰포트 동적 계산 및 레이아웃 개선
// 변경사항: 동적 높이 계산, 방향 전환 대응, Visual Viewport API 지원

/**
 * 디바운스 유틸리티 함수
 * @param {Function} fn - 실행할 함수
 * @param {number} delay - 지연 시간(ms)
 * @returns {Function} 디바운스된 함수
 */
function debounce(fn, delay) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}

/**
 * 실제 가용 뷰포트 높이를 계산하여 CSS 변수로 설정
 * Android 주소창/네비게이션 바 높이 변화에 대응
 */
export function updateViewportHeight() {
  // Visual Viewport API 사용 (가상 키보드 대응)
  const height = window.visualViewport?.height || window.innerHeight;
  const vh = height * 0.01;
  const doc = document.documentElement;

  // 동적 뷰포트 높이 변수 설정 (--real-vh)
  doc.style.setProperty('--real-vh', `${vh}px`);

  // 사용 가능한 콘텐츠 높이 계산 (상단바, 컨트롤, safe-area 고려)
  const isPortrait = window.matchMedia('(orientation: portrait)').matches;
  const topbarHeight = isPortrait ? 50 : 36;
  const statusbarHeight = isPortrait ? 44 : 0;
  const controlsHeight = isPortrait ? 148 : 72;
  const safeTop = parseFloat(getComputedStyle(doc).getPropertyValue('--safe-top')) || 0;
  const safeBottom = parseFloat(getComputedStyle(doc).getPropertyValue('--safe-bottom')) || 0;

  const availableHeight = height - topbarHeight - statusbarHeight - controlsHeight - safeTop - safeBottom - 20;
  doc.style.setProperty('--available-height', `${Math.max(availableHeight, 200)}px`);
}

/**
 * 모바일 장치 감지
 * @returns {boolean} 모바일 여부
 */
export function detectMobile() {
  return window.matchMedia("(max-width: 960px)").matches;
}

/**
 * 레이아웃 적용 (데스크톱/모바일 전환)
 */
export function applyLayout() {
  const stage = document.getElementById("stage");
  const mobileControls = document.getElementById("mobileControls");

  if (!stage || !mobileControls) return;

  if (detectMobile()) {
    stage.classList.remove("desktop");
    stage.classList.add("mobile");
    mobileControls.classList.remove("hidden");
  } else {
    stage.classList.add("desktop");
    stage.classList.remove("mobile");
    mobileControls.classList.add("hidden");
  }

  // 레이아웃 변경 후 뷰포트 높이 재계산
  updateViewportHeight();
}

/**
 * 모바일 레이아웃 초기화
 * 이벤트 리스너 등록 및 초기 계산 수행
 */
export function initMobileLayout() {
  // 초기 뷰포트 높이 계산
  updateViewportHeight();

  // 리사이즈 이벤트에 디바운스 적용
  window.addEventListener('resize', debounce(updateViewportHeight, 100));

  // 방향 전환 이벤트 (Android 딜레이 대응)
  window.addEventListener('orientationchange', () => {
    // [v3.15.2] 방향 전환 시 뷰포트 높이 재계산 및 캔버스 크기 조정
    setTimeout(() => {
      updateViewportHeight();
      // 캔버스 크기 재조정 트리거 (게임 렌더링에 사용)
      document.documentElement.setAttribute('data-orientation', 
        window.matchMedia('(orientation: portrait)').matches ? 'portrait' : 'landscape'
      );
    }, 300);
  });

  // Visual Viewport API 지원 시 이벤트 등록 (가상 키보드 대응)
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', debounce(updateViewportHeight, 50));
  }

  // 레이아웃 초기 적용
  applyLayout();
}
