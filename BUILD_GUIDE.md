# BUILD_GUIDE.md

## 로컬 실행
1. 프로젝트 루트 이동
2. `python -m http.server 8080`
3. 브라우저에서 `http://localhost:8080`

## 확인 순서
1. 스타트 화면에서 난이도 선택
2. 타이틀에서 추천 배지, 최근 전적 카드, 미션 체크리스트 렌더링 확인
3. 1920x1080 데스크톱에서 타이틀 카드 하단이 잘리지 않고, 내용이 넘치지 않을 때는 불필요한 옆 스크롤바 공간이 보이지 않는지 확인
4. 첫 실행 시 `BRIEFING` 오버레이가 열리면 `SKIP` 또는 `NEXT` 흐름 확인
5. `START BATTLE` 클릭
6. 인게임에서 `SETTINGS`를 열고 `Master / BGM / SFX / Voice`, 오디오 프리셋, `CONTROL` 프리셋, 저자극 오디오, 저사양 모드, 모바일 옵션 동작 확인
7. `CONTROL`에서 `REBIND`, `DAS`, `ARR`, `BUFFER`, `IRS`, `IHS`, `HARD DROP BUFFER` 변경 후 새로고침 뒤에도 유지되는지 확인
8. 1920x1080 데스크톱에서 `SETTINGS`의 `CLOSE` 버튼과 하단 옵션이 스크롤 없이 또는 내부 스크롤만으로 모두 접근 가능한지 확인
9. 전투 중 첫 게이지 MAX / 첫 디버프 / 첫 피버 / 첫 보스 상태 힌트가 1회만 노출되는지 확인
10. 전투 중 스택이 높아질수록 `BGM STATE`, `MUSIC DRIVE`, `BOSS LAYER`가 자연스럽게 상승하고 `Danger`가 깜빡이지 않는지 확인
11. `DEV PANEL`을 켜고 FPS/입력/오디오/오류/보스/인커밍 값이 갱신되는지 확인하고 `EXPORT SESSION`으로 JSON을 저장해 본다
12. 1줄~4줄, `T-Spin`, `Perfect Clear`, `K.O.`, 보스 페이즈 전환에서 히트스톱과 임팩트 강도 차이를 확인
13. 전투 종료 후 결과 화면의 실패 원인 분석/후속 버튼과 최근 전적 카드가 갱신되는지 확인
14. 모바일 환경에서 `LAYOUT`, `BUTTON SIZE`, `REPEAT`, `HAPTIC LEVEL`, 회전 힌트, DEV PANEL 확인
15. 인게임에서 `TITLE` 버튼 동작 확인
16. `마왕군주`에서 `HOLD LOCK`, `GHOST OFF`가 `INCOMING`과 `STATUS`에 동시에 보이는지 확인
17. `데몬킹`에서 `ROT TAX`, `LEECH`, `SCRAMBLE`이 게이지/넥스트/HUD에 실제 반영되는지 확인
18. 중앙 우물형 4줄, `T-Spin`, 계단형 2줄, 저스택 정리, `Perfect Clear`가 각각 다른 패턴 공격/보너스로 분기되는지 확인
19. `BLIND -> REFLECT`, `BLOCK SWAP -> BLIND`, `REFLECT -> BLOCK SWAP` 3개 조합이 4초 이내에 합성되는지 확인
20. 피버 진입 시 `FORGE / GUARD / SCAN / SURGE` 중 하나가 선택되고, 해당 타입의 규칙 변화가 HUD와 실제 플레이에 반영되는지 확인
21. 피버 진입, `T-Spin Double+`, `Perfect Clear`, 보스 페이즈 상승 시 `Neon Shift` 콜아웃과 `STATUS`의 `SHIFT` 타이머가 노출되는지 확인
22. `Neon Shift` 중 2줄 이상 또는 `T-Spin` 클리어 시 보드에 `Neon Residue` 행 잔상이 남고 추가 압박이 생성되는지 확인
23. 패턴 공격, 스킬 합성, 보스 규칙 공격, 피버 타입 진입, `Neon Shift` 진입 시 BGM이 끊기지 않으면서 짧은 오디오 프레이즈가 덧붙는지 확인
24. Shift 중 `FORGE / GUARD / SCAN / SURGE` 타입별 공명(`Forge Spark / Guard Aegis / Scan Hex / Surge Pulse`)이 기대한 조건에서만 발동하는지 확인
25. `STATUS`가 우선순위 높은 상태부터 정렬되고, 많은 상태가 겹칠 때 `+N MORE` 칩으로 축약되는지 확인
26. 5/10/15 콤보, 보스 페이즈 상승, 레이어 공명에서 전투 프레이즈가 과도하게 겹치지 않고 구분되는지 확인
27. `Forge Break / Guard Lattice / Scan Trace / Surge Echo`가 올바른 공격만 카운터하고 `Neon Residue` 1개를 소모하는지 확인
28. `Neon Shift` 종료 시 `SHIFT FADE` 콜아웃과 약한 임팩트가 한 번만 발생하는지 확인
29. DEV PANEL에서 `shift / residue / counter / resonance` 메타와 세션 카운터가 갱신되는지 확인
30. 일반 일시정지(`pauseOverlay`)가 열린 동안 이동/회전/드롭 입력이 전혀 적용되지 않고 `Esc`/`P`만 재개 토글로 동작하는지 확인
31. 좌우 방향키를 동시에 누른 상태에서 마지막 방향을 떼면 반대 방향 이동이 지연 없이 즉시 이어지는지 확인
32. 난이도를 올릴수록 라인 클리어 화면 흔들림이 약간 더 빠르게 감쇠하고, 아이템 블록 글로우가 일반 블록보다 더 또렷하게 보이는지 확인
33. 아이템 블록이 등장해도 콘솔에 `CanvasGradient.addColorStop()` `SyntaxError`가 발생하지 않고 전투가 멈추지 않는지 확인
34. 아래 방향키로 바닥까지 내린 뒤 `Space`를 누르지 않아도 약 `500ms` 내에 자동으로 고정되는지 확인
35. 첫 로드 후 콘솔에 `favicon.ico 404`가 더 이상 발생하지 않는지 확인

## 주의
- `file://` 로 직접 열면 WASM fetch가 차단될 수 있음
- 반드시 로컬 웹서버로 실행
- UI/스크립트 갱신 후 캐시 문제 발생 시 `Ctrl+F5`
- 모바일 검증 시 전체화면/가로모드와 안전영역(노치, 제스처 바) 겹침 여부를 함께 확인
- 백그라운드 전환 후 복귀 시 자동 일시정지 유지, 오디오 재개, 입력 복구 여부를 함께 확인
- 보스 규칙 공격은 종료 후 반드시 복구되어야 하므로 홀드, 고스트, 넥스트, 게이지 상태가 타이머 만료 뒤 정상화되는지 함께 본다
- `Neon Shift`는 별도 보드 시뮬레이션이 아니므로, 종료 후 잔상 행과 보너스 문맥만 자연스럽게 사라지는지 확인한다
