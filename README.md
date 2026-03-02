# Dual Tetris Battle: Neon Wars

---

## 🇰🇷 한국어 (Korean)

### 소개
좌측 플레이어 vs 우측 AI 대전 테트리스 게임입니다. 현대적인 네온 UI와 화려한 시각 효과, 풍부한 게임성을 갖춘 프로덕션급 웹 게임입니다.

### 주요 기능 (v3.17.1)
- 🎮 **3가지 필살기 스킬**: 블라인드(1), 블록 스왑(2), 가비지 반사(3)
- 🔥 **피버 모드**: 10콤보+ 시 BGM 1.3배속 + 공격력 1.5배
- 💣 **아이템 시스템**: 폭탄(3x3 파괴), 별(1줄 클리어), 실드(가비지 차단)
- 🏆 **15개 업적**: 전투/스킬/수집/특별 4개 카테고리
- 🎵 **다이나믹 BGM**: 평시/위험/피버 3가지 상태 자동 전환
- ✨ **승리/패배 연출**: 폭발/붕괴 이펙트 + 컨페티
- ⚙️ **설정 모달**: `Master / BGM / SFX / Voice` 믹서, 음소거, 프리셋, 트랙 스킵, 오디오 테스트, 저자극 오디오, 화면 흔들림/햅틱/저사양 모드 조절
- 📊 **실시간 전투 위젯**: 상태 타이머 HUD, 인커밍 공격 프리뷰, 결과 오버레이, 최근 전적 카드
- 🧭 **온보딩 2.0**: 첫 실행 브리핑, 타이틀 미션 체크리스트, 첫 디버프/피버/보스 상황 힌트, 결과 화면 피드백
- 📱 **모바일 2.0**: 레이아웃 프리셋, 버튼 크기/반복 속도 조절, 햅틱 강도, 회전 힌트, 터치 디버그
- 🎼 **오디오 2.0**: 확장 BGM 풀, 보스 페이즈 레이어, 난이도 기반 트랙 선택, 보이스 콜아웃
- 🎛️ **Adaptive Music 2.0**: 긴장도, 인커밍 압박, 콤보, 보스 HP에 따라 같은 곡이 단계적으로 과열되는 적응형 전투 음악
- 💥 **비주얼 업그레이드**: 입체 블록 셰이딩과 1~4줄 단계별 분해/폭발 이펙트
- 🎯 **Input Fidelity 2.0**: 입력 프리셋, 키 재지정, DAS/ARR/버퍼/IRS/IHS로 조작 감각 미세 조정
- 🧪 **QA Layer**: 숨김 DEV PANEL, 세션 로그 내보내기, FPS/입력/오디오/오류 진단
- ⚡ **Game Feel Pass**: 줄 수별 히트스톱, T-Spin/Perfect/K.O./보스 페이즈 임팩트 강화
- 👑 **Rule-Break Boss**: 마왕군주/데몬킹이 홀드 봉인, 고스트 제거, 회전 대가, 게이지 흡수, 넥스트 교란으로 규칙 자체를 공격
- 🧩 **Pattern Attack Grammar**: 중앙 우물형 테트리스, T-Spin, 계단 정리, 저스택 정리, 퍼펙트 클리어가 각각 다른 공격 문법으로 분화
- ✨ **Skill Fusion**: `BLIND -> REFLECT`, `BLOCK SWAP -> BLIND`, `REFLECT -> BLOCK SWAP` 순서가 별도 상위 효과로 합성
- 🔥 **Fever Mutation**: 피버가 `FORGE / GUARD / SCAN / SURGE` 타입으로 분기되어 벽킥, 방어, `NEXT 5`, 아이템 확률을 바꿈
- 🌐 **Dual Layer Board**: `Neon Shift`와 `Neon Residue`가 보드 위에 겹쳐져, 피버/특수 클리어/보스 페이즈에서 네온 전장 문맥을 만든다
- 🎹 **Combat Orchestration**: 패턴 공격, 규칙 공격, 스킬 합성, 피버 타입, `Neon Shift`가 현재 곡 위에 짧은 전투 프레이즈를 덧씌운다
- ⚛️ **Layer Resonance**: `FORGE / GUARD / SCAN / SURGE`가 `Neon Shift`와 결합해 추가 파동, 실드, 넥스트 교란, 파형 압박으로 이어진다
- 🧭 **HUD Polish**: 상태 칩 우선순위 정렬, `RESIDUE xN`, `+N MORE` 축약으로 전투 가독성을 높였다
- ⚖️ **Balance Pass**: 보스 규칙 공격 빈도/지속시간, 패턴 공격 강도, 피버 연장량을 조정해 전투 압박을 더 읽기 쉽게 다듬었다
- 📱 **Mobile Layout Pass**: 모바일 보드를 더 작게, 버튼은 더 크게 재배치해 세로/가로 화면에서 조작 가능 영역을 확보했다
- 📐 **Container-Driven Mobile Canvas**: 모바일 보드 크기는 CSS가 배정한 실제 컨테이너 크기를 기준으로 계산하고, `ResizeObserver`로 회전/주소창 변화에 맞춰 다시 맞춘다
- 📱 **Class-Driven Mobile Override**: `stage.mobile`과 `body.mobile-layout`가 모바일 레이아웃을 강제로 유지해 가로 모바일에서도 데스크톱 3컬럼으로 되돌아가지 않는다
- 🛡️ **Layer Counter Matrix**: `Forge Break / Guard Lattice / Scan Trace / Surge Echo`가 잔상 행을 소모해 공격을 절삭, 무효화, 역교란, 역압박한다
- 🧪 **Final DEV Polish**: DEV PANEL에 `shift / residue / resonance / counter` 메타와 세션 카운터를 추가해 장시간 튜닝이 쉬워졌다

### 조작법
| 동작 | 키 |
|------|-----|
| 좌우 이동 | ← → |
| 회전 | ↑ / X |
| 반시계 회전 | Z |
| 소프트 드롭 | ↓ |
| 하드 드롭 | Space |
| 홀드 | C |
| 스킬 발동 | 1 / 2 / 3 (게이지 MAX 시) |
| 일시정지 | P / Esc |
| 다음 트랙 | N |

### 실행 방법
1. 정적 서버 실행: `python -m http.server 8080`
2. 브라우저에서 `http://localhost:8080` 접속
3. 캐시 이슈 시 강력 새로고침: `Ctrl+F5`

### 문제 해결
- `Esc` 또는 `P`는 한 번 누를 때마다 일시정지 상태를 한 번만 전환합니다.
- 일반 일시정지 화면이 보이는 동안에는 이동/회전/드롭 입력이 차단되며, `Esc`/`P`만 재개 토글로 허용됩니다.
- 아래 방향키로 바닥까지 내려도 `Space`를 누를 필요는 없으며, 바닥 접촉 후 짧은 락 딜레이 뒤 자동 고정됩니다.
- 모바일에서는 하단 버튼 `1 / 2 / 3`으로 스킬을 사용하며, 게이지 MAX 시에만 활성화됩니다.
- 소리가 작으면 상단 `SETTINGS`에서 `MASTER / BGM / SFX / VOICE`를 각각 올리고, 필요하면 `ARCADE` 또는 `CINEMATIC` 프리셋과 `TEST MIX`로 바로 확인하세요.
- 모바일에서는 `SETTINGS`에서 `LAYOUT`, `BUTTON SIZE`, `REPEAT`, `HAPTIC LEVEL`을 조절하고, 세로 화면에서는 회전 힌트를 따르세요.
- `SETTINGS`가 큰 화면에서도 너무 길게 보이면 내부 스크롤이 생기도록 조정되어 있으며, 데스크톱에서는 3컬럼으로 배치됩니다.
- 타이틀 화면도 1920x1080에서 `LAST RESULT`와 `MISSION CHECKLIST`가 같은 카드 안에 유지되며, 필요 시 카드 내부 스크롤로 하단까지 접근할 수 있습니다.
- 타이틀 화면은 콘텐츠가 실제로 넘칠 때만 스크롤되며, 옆에 빈 스크롤바 거터를 상시 예약하지 않습니다.
- 오디오/WASM이 동작하지 않으면 `file://` 대신 로컬 서버로 실행하세요.

---

## 🇬🇧 English

### Introduction
Player (left) vs AI (right) battle Tetris game. A production-grade web game with modern neon UI, dazzling visual effects, and rich gameplay.

### Key Features (v3.17.1)
- 🎮 **3 Special Skills**: Blind (1), Block Swap (2), Garbage Reflect (3)
- 🔥 **Fever Mode**: 10+ combo triggers 1.3x BGM speed + 1.5x attack power
- 💣 **Item System**: Bomb (3x3 destroy), Star (1 line clear), Shield (block garbage)
- 🏆 **15 Achievements**: 4 categories (Combat/Skill/Collection/Special)
- 🎵 **Dynamic BGM**: Auto-switching between Normal/Danger/Fever states
- ✨ **Victory/Defeat Effects**: Explosion/collapse effects + confetti
- ⚙️ **Settings Modal**: `Master / BGM / SFX / Voice` mixer, mute, presets, track skip, audio test, low-stim audio, and screen-shake/haptics/low-power controls
- 📊 **Live Battle Widgets**: Status timers, incoming attack preview, result overlay, and last-battle card
- 🧭 **Onboarding 2.0**: First-run briefing, title-screen mission checklist, first-debuff/fever/boss hints, and result feedback
- 📱 **Mobile 2.0**: Layout presets, button-size/repeat tuning, haptic levels, rotate hint, and touch debug panel
- 🎼 **Audio 2.0**: Expanded BGM pool, boss-phase layers, difficulty-based track selection, and voice callouts
- 🎛️ **Adaptive Music 2.0**: Combat music that escalates inside the same track using tension, incoming pressure, combo flow, and boss HP
- 💥 **Visual Upgrade**: Beveled block shading plus escalating 1-4 line fracture/explosion effects
- 🎯 **Input Fidelity 2.0**: Input presets, key rebinding, DAS/ARR/buffer/IRS/IHS tuning for arcade-grade control feel
- 🧪 **QA Layer**: Hidden dev panel, session export, and live FPS/input/audio/error diagnostics
- ⚡ **Game Feel Pass**: Line-tier hitstop and stronger T-Spin/Perfect/K.O./boss-phase impact cues
- 👑 **Rule-Break Boss**: Demon lords can lock Hold, hide the ghost piece, tax rotations, drain gauge, and scramble Next
- 🧩 **Pattern Attack Grammar**: Center-well tetrises, T-Spins, staircase clears, low-stack clears, and perfect clears now branch into distinct combat effects
- ✨ **Skill Fusion**: `BLIND -> REFLECT`, `BLOCK SWAP -> BLIND`, and `REFLECT -> BLOCK SWAP` create stronger combo skills
- 🔥 **Fever Mutation**: Fever now branches into `FORGE / GUARD / SCAN / SURGE` variants that alter kicks, defense, `NEXT 5`, and item odds
- 🌐 **Dual Layer Board**: `Neon Shift` and `Neon Residue` overlay the board to create a layered battlefield during fever, special clears, and boss phase spikes
- 🎹 **Combat Orchestration**: Pattern attacks, rule-breaks, skill fusions, fever variants, and `Neon Shift` add short combat phrases on top of the current track
- ⚛️ **Layer Resonance**: `FORGE / GUARD / SCAN / SURGE` now resonate with `Neon Shift` to trigger extra wave pressure, shields, next scrambling, or pulse attacks
- 🧭 **HUD Polish**: Status chips are priority-sorted, show `RESIDUE xN`, and collapse overflow into `+N MORE` for cleaner combat readability
- ⚖️ **Balance Pass**: Boss rule-break frequency, debuff durations, pattern strength, and fever extension were tuned down for clearer pacing
- 📱 **Mobile Layout Pass**: Mobile boards were scaled down and buttons enlarged to preserve playable space in both portrait and landscape
- 📐 **Container-Driven Mobile Canvas**: On mobile, board size now follows the actual board container and resyncs through `ResizeObserver`
- 📱 **Class-Driven Mobile Override**: `stage.mobile` and `body.mobile-layout` now force the mobile stack even when landscape viewport width grows
- 🛡️ **Layer Counter Matrix**: `Forge Break / Guard Lattice / Scan Trace / Surge Echo` consume residue rows to shave, nullify, scramble back, or echo pressure
- 🧪 **Final DEV Polish**: The dev panel now exposes `shift / residue / resonance / counter` metadata and longer-session tuning counters

### Controls
| Action | Key |
|--------|-----|
| Move Left/Right | ← → |
| Rotate Clockwise | ↑ / X |
| Rotate Counter-Clockwise | Z |
| Soft Drop | ↓ |
| Hard Drop | Space |
| Hold | C |
| Activate Skill | 1 / 2 / 3 (when gauge is MAX) |
| Pause | P / Esc |
| Next Track | N |

### How to Run
1. Start static server: `python -m http.server 8080`
2. Open `http://localhost:8080` in browser
3. Hard refresh if needed: `Ctrl+F5`

### Troubleshooting
- `Esc` or `P` now toggles pause exactly once per key press.
- While the normal pause overlay is visible, move/rotate/drop inputs are blocked and only `Esc`/`P` can resume the match.
- Soft drop does not require `Space`; once the piece is grounded it should auto-lock after a short lock delay.
- On mobile, use the bottom `1 / 2 / 3` buttons for skills; they unlock only when the gauge is full.
- If the mix feels too quiet, open `SETTINGS`, raise `MASTER / BGM / SFX / VOICE` separately, or try the `ARCADE` or `CINEMATIC` preset with `TEST MIX`.
- On mobile, use `LAYOUT`, `BUTTON SIZE`, `REPEAT`, and `HAPTIC LEVEL` in `SETTINGS`, and follow the rotate hint when portrait mode feels cramped.
- `SETTINGS` now uses internal scrolling and a wider desktop layout so the close button and lower controls remain visible on 1920x1080.
- The title screen also keeps `LAST RESULT` and `MISSION CHECKLIST` inside the same card on 1920x1080, with internal card scrolling as the fallback instead of clipping the lower area.
- The title screen only scrolls when content actually overflows, so it no longer reserves an always-visible scrollbar gutter on the side.
- If audio or WASM does not start, run from a local server instead of `file://`.

---

## 🇯🇵 日本語 (Japanese)

### 概要
左側プレイヤー対右側AIの対戦テトリスゲームです。モダンなネオンUIと華麗なビジュアルエフェクト、豊かなゲーム性を持つプロダクション級ウェブゲームです。

### 主な機能 (v3.17.1)
- 🎮 **3つの必殺技スキル**: ブラインド(1)、ブロック交換(2)、ガーベジ反射(3)
- 🔥 **フィーバーモード**: 10コンボ以上でBGM 1.3倍速 + 攻撃力1.5倍
- 💣 **アイテムシステム**: 爆弾(3x3破壊)、スター(1ライン消去)、シールド(ガーベジブロック)
- 🏆 **15個の実績**: 戦闘/スキル/収集/特別の4カテゴリ
- 🎵 **ダイナミックBGM**: 通常/危険/フィーバーの3状態を自動切換
- ✨ **勝利/敗北演出**: 爆発/崩壊エフェクト + 紙吹雪
- ⚙️ **設定モーダル**: `Master / BGM / SFX / Voice` ミキサー、ミュート、プリセット、曲送り、オーディオテスト、低刺激オーディオ、画面揺れ/触覚/低負荷モード調整
- 📊 **ライブ戦闘ウィジェット**: 状態タイマー、攻撃予告、結果オーバーレイ、最近戦績カード
- 🧭 **オンボーディング 2.0**: 初回ブリーフィング、タイトルのミッション一覧、初回デバフ/フィーバー/ボス警告、結果フィードバック
- 📱 **モバイル 2.0**: レイアウトプリセット、ボタンサイズ/連打速度調整、触覚強度、回転ヒント、タッチデバッグ
- 🎼 **オーディオ 2.0**: BGM拡張、ボスフェーズレイヤー、難易度別トラック選択、ボイスコールアウト
- 🎛️ **Adaptive Music 2.0**: 緊張度、攻撃予告、コンボ、ボスHPに応じて同じ曲が段階的に熱くなる適応型戦闘音楽
- 💥 **ビジュアル強化**: 立体ブロックシェーディングと1〜4ライン段階別の分解/爆発演出
- 🎯 **Input Fidelity 2.0**: 入力プリセット、キー再割り当て、DAS/ARR/バッファ/IRS/IHSの詳細調整
- 🧪 **QA Layer**: 非表示DEV PANEL、セッション書き出し、FPS/入力/音声/エラー診断
- ⚡ **Game Feel Pass**: ライン数別ヒットストップとT-Spin/Perfect/K.O./ボス段階演出の強化
- 👑 **Rule-Break Boss**: 魔王系ボスがホールド封印、ゴースト非表示、回転課税、ゲージ吸収、NEXT攪乱でルール自体を攻撃
- 🧩 **Pattern Attack Grammar**: 中央井戸テトリス、T-Spin、階段整地、低スタック整地、Perfect Clearが別々の戦闘効果に分岐
- ✨ **Skill Fusion**: `BLIND -> REFLECT`、`BLOCK SWAP -> BLIND`、`REFLECT -> BLOCK SWAP` が上位スキルへ合成
- 🔥 **Fever Mutation**: フィーバーが `FORGE / GUARD / SCAN / SURGE` に分岐し、壁蹴り、防御、`NEXT 5`、アイテム率を変化
- 🌐 **Dual Layer Board**: `Neon Shift` と `Neon Residue` が盤面に重なり、フィーバーや特殊消去、ボス段階で多層戦場を作る
- 🎹 **Combat Orchestration**: パターン攻撃、ルール破壊、スキル合成、フィーバー種別、`Neon Shift` が現在の曲に短い戦闘フレーズを重ねる
- ⚛️ **Layer Resonance**: `FORGE / GUARD / SCAN / SURGE` が `Neon Shift` と共鳴し、追加波動、即時シールド、NEXT攪乱、パルス攻撃へ発展
- 🧭 **HUD Polish**: 状態チップを優先度順に並べ、`RESIDUE xN` と `+N MORE` で戦闘情報を圧縮表示
- ⚖️ **Balance Pass**: ボス規則攻撃の頻度・持続、パターン攻撃強度、フィーバー延長量を抑えて読みやすいテンポに調整
- 📱 **Mobile Layout Pass**: モバイルでは盤面を縮小し、ボタンを大型化して縦横どちらでも操作しやすく調整
- 🛡️ **Layer Counter Matrix**: `Forge Break / Guard Lattice / Scan Trace / Surge Echo` が残像行を消費して圧力を削り、無効化し、逆攪乱し、反撃する
- 🧪 **Final DEV Polish**: DEV PANEL に `shift / residue / resonance / counter` メタと長時間調整用カウンタを追加

### 操作方法
| 操作 | キー |
|------|------|
| 左右移動 | ← → |
| 回転 | ↑ / X |
| 反時計回り | Z |
| ソフトドロップ | ↓ |
| ハードドロップ | Space |
| ホールド | C |
| スキル発動 | 1 / 2 / 3 (ゲージMAX時) |
| ポーズ | P / Esc |
| 次の曲 | N |

### 実行方法
1. 静的サーバー起動: `python -m http.server 8080`
2. ブラウザで `http://localhost:8080` を開く
3. キャッシュ問題時は強制更新: `Ctrl+F5`

### トラブルシューティング
- `Esc` または `P` は1回の入力で1回だけポーズを切り替えます。
- 通常のポーズオーバーレイ表示中は移動/回転/ドロップ入力を止め、`Esc`/`P` の再開トグルだけを許可します。
- 下方向キーで床まで落としても `Space` は必須ではなく、接地後は短いロックディレイの後に自動固定されます。
- モバイルでは下部の `1 / 2 / 3` ボタンでスキルを使い、ゲージMAX時のみ有効です。
- 音が小さい場合は `SETTINGS` で `MASTER / BGM / SFX / VOICE` を個別に上げるか、`ARCADE` または `CINEMATIC` と `TEST MIX` を試してください。
- モバイルでは `SETTINGS` の `LAYOUT / BUTTON SIZE / REPEAT / HAPTIC LEVEL` を調整し、縦向き時は回転ヒントに従ってください。
- `SETTINGS` は1920x1080でも下部と閉じるボタンが見えるよう、デスクトップでは横に広げて内部スクロール対応にしています。
- タイトル画面も1920x1080で `LAST RESULT` と `MISSION CHECKLIST` を同じカード内に保ち、必要時はカード内部スクロールで下部まで到達できます。
- タイトル画面は内容が実際にあふれる時だけスクロールし、側面に常時スクロールバー用の空きを確保しません。
- オーディオやWASMが動かない場合は `file://` ではなくローカルサーバーで実行してください。

---

## 🇹🇼 繁體中文 (Chinese Traditional)

### 介紹
左側玩家對戰右側AI的俄羅斯方塊遊戲。具有現代霓虹UI、華麗視覺效果和豐富遊戲性的專業級網頁遊戲。

### 主要功能 (v3.17.1)
- 🎮 **3種必殺技**: 失明(1)、方塊交換(2)、垃圾反射(3)
- 🔥 **狂熱模式**: 10連擊以上BGM 1.3倍速 + 攻擊力1.5倍
- 💣 **道具系統**: 炸彈(3x3破壞)、星星(消除1行)、盾牌(阻擋垃圾行)
- 🏆 **15個成就**: 戰鬥/技能/收集/特別 4個類別
- 🎵 **動態BGM**: 自動切換 普通/危險/狂熱 3種狀態
- ✨ **勝利/失敗演出**: 爆炸/崩塌效果 + 五彩紙屑
- ⚙️ **設定視窗**: `Master / BGM / SFX / Voice` 混音器、靜音、預設、切歌、音效測試、低刺激音訊、畫面震動/觸覺/低負載模式調整
- 📊 **即時戰鬥資訊**: 狀態計時器、來襲攻擊預覽、結果面板、最近戰績卡
- 🧭 **新手導覽 2.0**: 首次簡報、標題任務清單、首次 Debuff/Fever/Boss 提示、結果回饋
- 📱 **Mobile 2.0**: 版面預設、按鈕大小/連打速度、觸覺強度、旋轉提示、觸控除錯
- 🎼 **Audio 2.0**: 擴充 BGM 曲庫、Boss Phase 音層、依難度選曲、語音 Callout
- 🎛️ **Adaptive Music 2.0**: 依據緊張度、Incoming、Combo 與 Boss HP，讓同一首戰鬥曲逐段升溫的自適應音樂
- 💥 **視覺升級**: 立體方塊明暗與 1~4 行分級破裂/爆炸效果
- 🎯 **Input Fidelity 2.0**: 輸入預設、按鍵重綁、DAS/ARR/Buffer/IRS/IHS 細部調整
- 🧪 **QA Layer**: 隱藏 DEV PANEL、Session 匯出、FPS/輸入/音訊/錯誤診斷
- ⚡ **Game Feel Pass**: 依消行數分級的 hitstop 與 T-Spin/Perfect/K.O./Boss 階段衝擊強化
- 👑 **Rule-Break Boss**: 魔王級 Boss 會封鎖 Hold、隱藏 Ghost、對旋轉課稅、吸走 Gauge、擾亂 Next
- 🧩 **Pattern Attack Grammar**: 中央井型 Tetris、T-Spin、階梯整地、低堆疊整地、Perfect Clear 會分流成不同戰鬥效果
- ✨ **Skill Fusion**: `BLIND -> REFLECT`、`BLOCK SWAP -> BLIND`、`REFLECT -> BLOCK SWAP` 會合成更高階效果
- 🔥 **Fever Mutation**: Fever 會分成 `FORGE / GUARD / SCAN / SURGE`，改變壁踢、防禦、`NEXT 5` 與道具機率
- 🌐 **Dual Layer Board**: `Neon Shift` 與 `Neon Residue` 疊加在棋盤上，於 Fever、特殊消除與 Boss 階段形成多層戰場
- 🎹 **Combat Orchestration**: 模式攻擊、規則破壞、技能合成、Fever 類型與 `Neon Shift` 會在現有樂曲上疊加短促戰鬥樂句
- ⚛️ **Layer Resonance**: `FORGE / GUARD / SCAN / SURGE` 會與 `Neon Shift` 共鳴，衍生成額外波動、即時護盾、NEXT 擾亂與脈衝攻擊
- 🧭 **HUD Polish**: 狀態晶片依優先度排序，並用 `RESIDUE xN` 與 `+N MORE` 壓縮戰鬥資訊
- ⚖️ **Balance Pass**: 下調 Boss 規則攻擊頻率與持續時間、樣式攻擊強度與 Fever 延長量，讓戰鬥節奏更清楚
- 📱 **Mobile Layout Pass**: 手機版縮小盤面並放大按鈕，讓直向與橫向畫面都保有可操作空間
- 🛡️ **Layer Counter Matrix**: `Forge Break / Guard Lattice / Scan Trace / Surge Echo` 會消耗殘像列來削減、無效化、反向擾亂與回推壓力
- 🧪 **Final DEV Polish**: DEV PANEL 新增 `shift / residue / resonance / counter` 中繼資料與長局調校計數

### 操作方式
| 動作 | 按鍵 |
|------|------|
| 左右移動 | ← → |
| 旋轉 | ↑ / X |
| 逆時針旋轉 | Z |
| 軟降 | ↓ |
| 硬降 | Space |
| 保留 | C |
| 技能發動 | 1 / 2 / 3 (能量MAX時) |
| 暫停 | P / Esc |
| 下一首 | N |

### 執行方法
1. 啟動靜態伺服器: `python -m http.server 8080`
2. 瀏覽器開啟 `http://localhost:8080`
3. 快取問題時強制刷新: `Ctrl+F5`

### 疑難排解
- `Esc` 或 `P` 現在每次按下只會切換一次暫停狀態。
- 一般暫停覆蓋層顯示期間會封鎖移動/旋轉/落下輸入，只保留 `Esc`/`P` 作為恢復切換。
- 用下方向鍵把方塊推到底後不需要再按 `Space`，接地後經過短暫鎖定延遲就會自動固定。
- 行動裝置請使用底部 `1 / 2 / 3` 按鈕施放技能，只有能量滿時才會啟用。
- 如果覺得音量太小，請在 `SETTINGS` 分別提高 `MASTER / BGM / SFX / VOICE`，或使用 `ARCADE`/`CINEMATIC` 與 `TEST MIX` 立即確認。
- 行動裝置可在 `SETTINGS` 調整 `LAYOUT / BUTTON SIZE / REPEAT / HAPTIC LEVEL`，直向畫面太擠時請依照旋轉提示操作。
- `SETTINGS` 現在在 1920x1080 桌面上會採更寬的版面與內部捲動，避免關閉鈕與底部控制被截斷。
- 標題畫面現在也會在 1920x1080 內把 `LAST RESULT` 與 `MISSION CHECKLIST` 維持在同一張卡片中，必要時可透過卡片內部捲動查看底部內容。
- 標題畫面只會在內容真的超出時才出現捲動，不再預留常駐的側邊捲動條空間。
- 若音效或 WASM 無法啟動，請改用本機伺服器而不是 `file://`。

---

## 🇨🇳 简体中文 (Chinese Simplified)

### 介绍
左侧玩家对战右侧AI的俄罗斯方块游戏。具有现代霓虹UI、华丽视觉效果和丰富游戏性的专业级网页游戏。

### 主要功能 (v3.17.1)
- 🎮 **3种必杀技**: 致盲(1)、方块交换(2)、垃圾反射(3)
- 🔥 **狂热模式**: 10连击以上BGM 1.3倍速 + 攻击力1.5倍
- 💣 **道具系统**: 炸弹(3x3破坏)、星星(消除1行)、盾牌(阻挡垃圾行)
- 🏆 **15个成就**: 战斗/技能/收集/特别 4个类别
- 🎵 **动态BGM**: 自动切换 普通/危险/狂热 3种状态
- ✨ **胜利/失败演出**: 爆炸/崩塌效果 + 五彩纸屑
- ⚙️ **设置面板**: `Master / BGM / SFX / Voice` 混音器、静音、预设、切歌、音效测试、低刺激音频、画面震动/触觉/低功耗模式调节
- 📊 **实时战斗信息**: 状态计时器、来袭攻击预览、结果面板、最近战绩卡
- 🧭 **新手引导 2.0**: 首次简报、标题任务清单、首次 Debuff/Fever/Boss 提示、结果反馈
- 📱 **移动端 2.0**: 布局预设、按钮大小/连按速度、触觉强度、旋转提示、触控调试
- 🎼 **Audio 2.0**: 扩充 BGM 曲库、Boss Phase 音层、按难度选曲、语音 Callout
- 🎛️ **Adaptive Music 2.0**: 根据紧张度、Incoming、Combo 与 Boss HP，让同一首战斗曲逐段升温的自适应音乐
- 💥 **视觉升级**: 立体方块明暗与 1~4 行分级碎裂/爆炸效果
- 🎯 **Input Fidelity 2.0**: 输入预设、按键重绑、DAS/ARR/Buffer/IRS/IHS 细部调节
- 🧪 **QA Layer**: 隐藏 DEV PANEL、Session 导出、FPS/输入/音频/错误诊断
- ⚡ **Game Feel Pass**: 按消行数分级的 hitstop 与 T-Spin/Perfect/K.O./Boss 阶段冲击强化
- 👑 **Rule-Break Boss**: 魔王级 Boss 会封锁 Hold、隐藏 Ghost、对旋转课税、吸走 Gauge、扰乱 Next
- 🧩 **Pattern Attack Grammar**: 中央井式 Tetris、T-Spin、阶梯整地、低堆叠整地、Perfect Clear 会分流成不同战斗效果
- ✨ **Skill Fusion**: `BLIND -> REFLECT`、`BLOCK SWAP -> BLIND`、`REFLECT -> BLOCK SWAP` 会合成更高阶效果
- 🔥 **Fever Mutation**: Fever 会分成 `FORGE / GUARD / SCAN / SURGE`，改变壁踢、防御、`NEXT 5` 与道具概率
- 🌐 **Dual Layer Board**: `Neon Shift` 与 `Neon Residue` 叠加在棋盘上，在 Fever、特殊消除与 Boss 阶段形成多层战场
- 🎹 **Combat Orchestration**: 模式攻击、规则破坏、技能合成、Fever 类型与 `Neon Shift` 会在当前曲目上叠加短促战斗乐句
- ⚛️ **Layer Resonance**: `FORGE / GUARD / SCAN / SURGE` 会与 `Neon Shift` 共鸣，衍生额外波动压制、即时护盾、NEXT 扰乱与脉冲攻击
- 🧭 **HUD Polish**: 状态芯片按优先级排序，并用 `RESIDUE xN` 与 `+N MORE` 压缩战斗信息
- ⚖️ **Balance Pass**: 下调 Boss 规则攻击频率与持续时间、样式攻击强度与 Fever 延长量，让战斗节奏更清晰
- 📱 **Mobile Layout Pass**: 手机版缩小游戏盘面并放大按钮，让竖屏与横屏都保留可操作空间
- 🛡️ **Layer Counter Matrix**: `Forge Break / Guard Lattice / Scan Trace / Surge Echo` 会消耗残像行来削减、无效化、反向扰乱与回推压制
- 🧪 **Final DEV Polish**: DEV PANEL 新增 `shift / residue / resonance / counter` 元数据与长局调校计数

### 操作方式
| 动作 | 按键 |
|------|------|
| 左右移动 | ← → |
| 旋转 | ↑ / X |
| 逆时针旋转 | Z |
| 软降 | ↓ |
| 硬降 | Space |
| 保留 | C |
| 技能发动 | 1 / 2 / 3 (能量MAX时) |
| 暂停 | P / Esc |
| 下一首 | N |

### 执行方法
1. 启动静态服务器: `python -m http.server 8080`
2. 浏览器打开 `http://localhost:8080`
3. 缓存问题时强制刷新: `Ctrl+F5`

### 故障排查
- `Esc` 或 `P` 现在每次按下只会切换一次暂停状态。
- 普通暂停覆盖层可见时会阻止移动/旋转/下落输入，只保留 `Esc`/`P` 作为恢复切换。
- 用下方向键把方块推到底后不需要再按 `Space`，接地后经过短暂锁定延迟就会自动固定。
- 移动端请使用底部 `1 / 2 / 3` 按钮释放技能，只有能量满时才会启用。
- 如果觉得声音偏小，请在 `SETTINGS` 分别调高 `MASTER / BGM / SFX / VOICE`，或使用 `ARCADE`/`CINEMATIC` 和 `TEST MIX` 立即确认。
- 移动端可在 `SETTINGS` 调整 `LAYOUT / BUTTON SIZE / REPEAT / HAPTIC LEVEL`，竖屏过挤时请按照旋转提示操作。
- `SETTINGS` 现在在 1920x1080 桌面上会使用更宽布局和内部滚动，避免关闭按钮与底部控件被截断。
- 标题画面现在也会在 1920x1080 内把 `LAST RESULT` 和 `MISSION CHECKLIST` 保持在同一张卡片中，必要时可通过卡片内部滚动查看底部内容。
- 标题画面只会在内容真的溢出时才滚动，不再预留常驻的侧边滚动条空间。
- 如果音频或 WASM 无法启动，请通过本地服务器运行，不要直接使用 `file://`。

---

## 🎨 Asset Policy

- `assets/audio/midi/`에 저작권 확인된 MIDI만 배치하세요.
- 현재 기본 구현은 WebAudio 합성 기반 BGM/SFX입니다.

---

## 📄 License

MIT License

---

**Version:** 3.17.1  
**Last Updated:** 2026-03-02
