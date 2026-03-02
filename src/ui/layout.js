// [v3.17.1] 컨테이너 주도형 모바일 뷰포트 계산
// 변경사항: stage.mobile/body.mobile-layout 강제 오버라이드와 모바일 판정 보정

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
 * [v3.17.1] 실제 뷰포트 높이 계산
 * 모바일은 CSS가 레이아웃 공간을 할당하고, JS는 동적 뷰포트 높이와 방향 메타만 갱신한다.
 */
export function updateViewportHeight() {
  const height = window.visualViewport?.height || window.innerHeight;
  const vh = height * 0.01;
  const doc = document.documentElement;

  doc.style.setProperty('--real-vh', `${vh}px`);
  doc.style.setProperty('--app-height', `${height}px`);

  const isPortrait = window.matchMedia('(orientation: portrait)').matches;
  doc.setAttribute('data-orientation', isPortrait ? 'portrait' : 'landscape');
}

/**
 * 모바일 장치 감지
 * @returns {boolean} 모바일 여부
 */
export function detectMobile() {
  return window.matchMedia("(max-width: 960px), ((max-height: 600px) and (pointer: coarse))").matches;
}

/**
 * 레이아웃 적용 (데스크톱/모바일 전환)
 */
export function applyLayout() {
  const stage = document.getElementById("stage");
  const mobileControls = document.getElementById("mobileControls");
  const body = document.body;

  if (!stage || !mobileControls || !body) return;

  if (detectMobile()) {
    stage.classList.remove("desktop");
    stage.classList.add("mobile");
    body.classList.add("mobile-layout");
    mobileControls.classList.remove("hidden");
  } else {
    stage.classList.add("desktop");
    stage.classList.remove("mobile");
    body.classList.remove("mobile-layout");
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
  const syncLayout = debounce(() => {
    applyLayout();
  }, 60);

  updateViewportHeight();

  window.addEventListener('orientationchange', () => {
    setTimeout(() => {
      applyLayout();
    }, 300);
  });

  window.addEventListener('resize', syncLayout);

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', syncLayout);
  }

  applyLayout();
}
