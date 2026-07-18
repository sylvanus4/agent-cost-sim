# Agent Cost Sim

멀티에이전트 파이프라인에서 **역할별 모델 티어 라우팅**이 토큰 비용을 얼마나 줄이는지
배포 전에 계산하는 정적 웹 도구입니다. 벤더 중립이고, 서버·추적·의존성이 없습니다.

- 입력: 파이프라인 단계별 역할(탐색/구현/검증), fan-out(에이전트 수), 호출 수, 입출력 토큰, 캐시 재사용 토큰
- 비교: `Baseline`(전 단계 프론티어) vs `Routed`(역할별 티어)
- 출력: 절감률, 절감액, 단계별 기여 막대그래프, "라우팅이 막히는 지점" 경고

## 왜 비용만?

"저비용 서브모델을 섞어도 점수가 유지된다"는 원래 화제이지만 품질 유지 여부는 파이프라인마다 다릅니다.
이 도구는 **품질을 예측하지 않고 비용만** 계산합니다. 특정 모델/벤더를 광고하지 않으며, 단가는 사용자가
공개 가격표에서 주입한 값입니다.

## 구조

```
index.html              진입점
src/cost-engine.js      결정론 비용 계산 (순수 함수, 테스트 대상)
src/pricing.js          data/pricing.json 로드 + 티어 매핑
src/chart.js            의존성 없는 SVG 막대그래프
src/state.js            구성을 URL에 직렬화 (공유·재현)
src/app.js              폼/렌더 바인딩
styles/tokens.css       디자인 토큰 (라이트/다크)
data/pricing.json       모델 단가 ($/1M tok) — 나이트리 갱신
scripts/scrape_pricing.py   가격 스크레이퍼 (어댑터 방식, stale 폴백)
scripts/validate_pricing.py 스키마 게이트
scripts/adapters/       provider별 fetch() 어댑터 (여기에 추가)
```

## 로컬 실행

정적 파일이라 아무 정적 서버면 됩니다(모듈 fetch 때문에 `file://`는 불가):

```bash
python3 -m http.server 8080
# http://localhost:8080
```

테스트:

```bash
node --test              # 비용 엔진 유닛 테스트
python3 scripts/validate_pricing.py   # pricing.json 스키마 검증
```

## 비용 모델

호출당 비용(모델 `m`, 단가는 $/1M tok):

```
call = (fresh_in*in + cached_in*cache_read + out*out) / 1e6
stage = agents * calls_per_agent * call
```

- `Baseline` = 모든 단계를 티어 F로
- `Routed` = 각 단계를 역할 티어로 (기본: 탐색→S, 구현→M, 검증→F)
- 절감률 = `(baseline - routed) / baseline`

기본 역할→티어 매핑은 흔한 라우팅 휴리스틱(탐색=저비용, 구현=중간, 검증/판단=프론티어)을 따릅니다.

## 실측 A/B 검증

계산기는 비용만 추정하므로, **품질까지 실제로 측정**한 A/B 실험을 함께 뒀습니다.
코딩 태스크 3개를 (a) 전 단계 프론티어 vs (b) 역할별 라우팅으로 돌리고, 숨은 테스트로 채점:

| | 품질 (숨은 테스트) | 비용 (실측 토큰 기반) |
|---|---|---|
| Baseline (전부 프론티어) | 100% (23/23) | $42.12 |
| Routed (haiku/sonnet/opus) | 100% (23/23) | $17.59 |

**비용 58% 절감, 품질 손실 0.** 방법론·한계·재현 방법은 [EXPERIMENT.md](EXPERIMENT.md),
원자료는 [data/experiment-results.json](data/experiment-results.json), 실행은 `experiment/analyze.py`.

한계는 정직히: n=3이고 저비용 모델도 풀 수 있는 난이도라 품질이 붙었습니다. 자기 태스크로
`experiment/` 하네스를 돌려 직접 확인하는 걸 권합니다.

## 가격 갱신 파이프라인

`.github/workflows/pricing-nightly.yml`가 02:00 UTC에 `scrape_pricing.py`를 돌립니다.
어댑터가 모두 실패하면 이전 `pricing.json`을 보존하고 `stale:true`로 표시합니다(값 날조 금지).
새 provider는 `scripts/adapters/<name>.py`에 `fetch()`를 구현해 추가합니다(`scripts/adapters/_example.py` 참고).

## 배포

`main` push 시 `.github/workflows/pages.yml`가 유닛 테스트 + 스키마 검증 통과 후 GitHub Pages로 배포합니다.
저장소 Settings → Pages → Source를 "GitHub Actions"로 설정하세요.

## 라이선스

MIT.
