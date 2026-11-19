# 의사랑AI 썸네일 생성기

랜딩 게시판(진료실 칼럼 · 고객 사례) 썸네일을 규격에 맞춰 만드는 사내용 웹 도구입니다.
GitHub 저장소에 올리고 Vercel에 연결하면, 저장소를 업데이트할 때마다 자동으로 배포되고 사용자에게 새 버전 알림이 뜹니다.

```
uisarang-thumbnail-generator/
├─ index.html            생성기 전체 (폰트·에셋·가이드 이미지 포함, 단일 파일)
├─ version.json          현재 버전과 변경 내역 (새 버전 알림에 사용)
├─ api/recommend.js      오브젝트 추천용 서버 함수 (Claude API 중계, 키 보관)
├─ scripts/release.mjs   새 버전 번호·변경 내역을 올리는 스크립트
├─ vercel.json           캐시 설정 (항상 최신 파일을 받도록)
├─ package.json
└─ .env.example          Vercel에 넣을 환경 변수 목록 (실제 키는 넣지 않기)
```

---

## 1. 처음 배포하기

### 1) GitHub 저장소 만들기
1. 팀 GitHub에서 **New repository** → 이름 예: `uisarang-thumbnail-generator`, **Private** 권장
2. 이 폴더의 파일을 모두 올립니다. (웹에서 *Add file → Upload files*로 끌어다 놓아도 됩니다)

### 2) Vercel 프로젝트 연결
1. Vercel → **Add New… → Project** → 위 저장소 **Import**
2. 설정
   - Framework Preset: **Other**
   - Build Command: 비워 두기 / Output Directory: 비워 두기 (루트의 `index.html`을 그대로 씀)
3. **Deploy** → `https://<프로젝트>.vercel.app` 주소가 생깁니다.

### 3) 오브젝트 추천용 환경 변수 넣기
Vercel → Project → **Settings → Environment Variables**

| 이름 | 값 | 필수 |
|---|---|---|
| `ANTHROPIC_API_KEY` | 회사 Anthropic API 키 | 필수 |
| `ANTHROPIC_MODEL` | 사용할 모델 ID (비우면 `claude-haiku-4-5`) | 선택 |
| `ALLOWED_ORIGINS` | 배포 주소, 예: `https://uisarang-thumb.vercel.app` (여러 개면 쉼표) | 권장 |

저장 후 **Deployments → 최신 배포 → Redeploy** 해야 적용됩니다.

> API 키는 서버 함수(`api/recommend.js`)에서만 쓰이고 브라우저에는 노출되지 않습니다.
> 모델 ID와 API 사용은 사내 정책·승인 범위에 맞춰 설정해 주세요.

### 4) 사내 사람만 쓰게 하기 (권장)
Vercel 주소는 기본적으로 링크를 아는 누구나 열 수 있습니다.
**Settings → Deployment Protection**에서
- **Vercel Authentication**: Vercel 팀 멤버만 접속 (팀원 초대 필요)
- **Password Protection**: 공용 비밀번호로 접속 (요금제에 따라 제공)

중 하나를 켜 주세요. `ALLOWED_ORIGINS`는 다른 사이트가 추천 API를 몰래 쓰는 걸 막는 용도이지, 접속 제한은 아닙니다.

---

## 2. 업데이트 배포하기 (사용자에게 알림까지)

1. 새 `index.html`로 교체합니다. (Claude에서 받은 파일을 덮어쓰기)
2. 버전과 바뀐 점을 기록합니다. (Node 18 이상 필요)
   ```bash
   npm run release -- 1.1.0 "고객 사례 배경 색 추가" "저장 목록 필터 개선"
   ```
   → `version.json`과 `index.html`의 버전·변경 내역이 함께 바뀝니다.
3. 커밋 & 푸시
   ```bash
   git add . && git commit -m "release v1.1.0" && git push
   ```
4. Vercel이 자동으로 새로 배포합니다. 그러면
   - **생성기를 열어 둔 사용자**: 5분 안에(또는 탭으로 돌아오는 순간) 상단에 *"새 버전 v1.1.0이 배포됐어요 · 새로고침"* 알림
   - **새로 열거나 새로고침한 사용자**: 최신 버전으로 바로 열리고, 처음 한 번 *"새로 바뀐 점"* 창이 뜸
   - 헤더의 버전 번호(`v1.1.0`)를 누르면 언제든 전체 업데이트 내역 확인

> 버전 번호는 이전보다 커야 합니다(예: 1.0.0 → 1.0.1 작은 수정, 1.1.0 기능 추가).
> 터미널이 어렵다면 Claude에게 "버전 1.1.0으로 올려서 index.html과 version.json 만들어줘"라고 요청해도 됩니다.

---

## 3. 저장 목록에 대해

- 내보낸 썸네일은 **사용하는 사람의 브라우저**(IndexedDB)에 저장됩니다. 서버에는 올라가지 않습니다.
- 같은 PC · 같은 브라우저 · 같은 주소로 들어오면 계속 남아 있고, **새 버전을 배포해도 유지**됩니다.
- 다른 PC/브라우저, 시크릿 창, 브라우저 데이터 삭제 시에는 보이지 않습니다.
- 생성기가 브라우저에 "영구 저장"을 요청해서, 저장 공간이 부족해도 임의로 지워지지 않도록 해 둡니다.
- 배포 주소(도메인)를 바꾸면 이전 주소의 저장 목록은 넘어가지 않으니, 주소는 한 번 정하면 유지해 주세요.

---

## 4. 문제가 생겼을 때

| 증상 | 확인할 것 |
|---|---|
| 추천 버튼을 눌러도 "키워드가 겹치는 오브젝트"만 나옴 | 서버 함수가 실패해 키워드 추천으로 자동 전환된 상태. Vercel → **Logs**에서 `api/recommend` 오류 확인 (`missing_api_key`, `upstream_401` 등) |
| `forbidden_origin` | `ALLOWED_ORIGINS`에 실제 접속 주소가 들어 있는지 확인 (끝에 `/` 없이) |
| 새 버전 알림이 안 뜸 | `version.json`의 version이 올라갔는지, 배포가 끝났는지 확인 |
| 업데이트했는데 예전 화면 | 강력 새로고침(Ctrl/Cmd + Shift + R). `vercel.json`이 캐시를 막아 두어 보통은 바로 반영됩니다 |
