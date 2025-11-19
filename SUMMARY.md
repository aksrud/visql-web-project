# VisQL 프로젝트 — 대화 및 변경 요약

다음은 지금까지 이 프로젝트에서 사용자와 AI(도우미)가 나눈 주요 대화 요지와 코드 변경 사항, 의사결정 기록입니다. 향후 작업자(본인 또는 팀원)가 빠르게 상황을 파악하도록 작성했습니다.

## 시작 시간
11월 19일 대화 부터 만들어짐.

## 주요 목표
- 브라우저에서 실행 가능한 SQLite 기반 학습 도구(DDL/DML 실습 및 시각화)

## 대화/작업 하이라이트

1. SQL 실행 엔진 초기화
   - `js/script.js`에서 sql.js(WebAssembly)를 초기화하고 로컬스토리지로 DB를 저장/복원하는 로직이 있음.

2. INSERT 다중행 처리 개선
   - 다중 행 INSERT 시 각 행의 rowid를 정확히 추적하기 위해 우선 `INSERT ... RETURNING rowid`를 시도하고,
     지원되지 않거나 실패하면 `db.run(sql)` 후 `last_insert_rowid()`와 영향 행 수(affected)로 범위를 계산하는 폴백을 구현함.
   - 변경 파일: `js/script.js` (INSERT 처리부)

3. DELETE / DROP 미리보기와 확인
   - DELETE, DROP 명령에 대해 실제 실행 전에 영향을 받을 rowid 또는 테이블을 미리 보여주고 사용자 확인을 요구하는 흐름을 구현함.
   - 변경 파일: `js/script.js` (pendingDelete, pendingDrop 관리 및 confirm/cancel 함수)

4. 다이어그램 렌더링 및 하이라이트
   - 테이블과 행(rowid)을 시각적으로 보여주는 다이어그램 렌더링 기능이 있음.
   - `lastAffectedRows`를 이용해 변경/삭제/드롭된 행을 하이라이트함.

5. 챕터 선택 UI (카드 레이아웃)
   - 챕터 선택 페이지를 카드형 그리드로 바꾸는 시안이 추가됨.
   - WAI-ARIA 속성(aria-*, role, tabindex)은 요청에 따라 제거됨.
   - 파일: `pages/selectChapter.html`, `css/selectChapter.css`

6. SQL 플레이그라운드 페이지
   - 새로운 플레이그라운드 페이지(`pages/sql-playground.html`)가 있으며, 별도 CSS/JS(`css/sql-playground.css`, `js/sql-playground/*`)로 구성됨.
   - 헤더에 `#back-btn`(뒤로가기 버튼)이 추가되었고, 기본 스타일 및 헤더 전용 스타일이 CSS에 정의됨.
   - 버튼 클릭 시 루트 `index.html`로 이동하도록 `js/sql-playground/ui.js`에 이벤트 핸들러가 추가됨.

7. 기타 스타일 정리
   - `.back-button` 스타일 중복 제거, 전역 `button:hover` 영향에 관한 설명과 권장 리팩터 방법(클래스 기반 버튼 스타일 권장)을 제공함.

8. 사용자 요청에 따른 추가 TODO (요약)

   사용자 요청(요약): `index.html`에서 챕터를 클릭하면 해당 챕터용 SQL 가이드를 생성/로드하고, UI 디자인을 깔끔하게 정리하며,
   플레이그라운드에 기본 SQL 입력 칸(기본 샘플 SQL 포함)을 제공하고, "초기화/되돌리기" 버튼을 통해 이전 실행을 복원할 수 있게 해달라는 요청이 있었습니다.

   요청된 체크리스트:

   - index.html에서 누른 챕터별로 다르게 SQL 가이드를 생성해주기
   - 디자인 깔끔하게 만들기
   - 기본 SQL 입력 칸 만들기(기본 SQL 입력 데이터들도 포함해서)
   - 초기화 또는 전에 했던 SQL 실행을 다시 되돌리는 버튼 만들기

   위 내용은 프로젝트 루트의 `TODO.md`에 상세 체크리스트로도 추가되어 있습니다.

   9. 챕터 카드 클릭 시 SQL 예시 및 기본 입력 로드 설계

       - 개요: 챕터를 카드 그리드로 표시한 UI에서 사용자가 카드를 클릭하면 플레이그라운드(`pages/sql-playground.html`)의 SQL 입력 칸에 해당 챕터의 기본 SQL 스니펫과 설명을 자동으로 채우고(선택적으로 자동 실행), 추가 예제나 설명을 사이드 패널에 보여주는 흐름을 설계함.

       - 추천 구조 요약:
          - 데이터: 프로젝트 내에 챕터별 메타데이터 객체(`CHAPTERS`)를 두어 {id, title, description, defaultSql, examples: []} 형태로 관리
          - 초기화: `ui.js`에서 `initChapterCards()`를 실행해 각 카드(`.chapter-card[data-chapter]`)에 클릭 핸들러를 등록
          - 로드: `loadChapter(chapterId)` 함수는 CHAPTERS에서 메타를 꺼내 SQL 입력창(`#sql-textarea`)과 설명 영역을 채우고, 필요시 `executeSQL()`을 호출하거나 예제 리스트를 렌더링
          - URL 연동: `pages/sql-playground.html?chapter=insert` 같은 쿼리 파라미터를 지원해 직접 접근 시에도 해당 챕터가 로드되도록 함

       - 장점: 중앙화된 챕터 메타데이터로 유지보수 쉬움, URL 기반 접근성 제공, 자동 실행 옵션으로 데모/학습 시나리오 다양화 가능


## 변경된 주요 파일
- `js/script.js` — SQL 실행 로직(INSERT/UPDATE/DELETE/DROP 등) 및 다이어그램 하이라이트
- `pages/selectChapter.html` — 챕터 카드 레이아웃(ARIA 제거 요청 반영)
- `css/selectChapter.css` — 카드 그리드 스타일
- `pages/sql-playground.html` — 플레이그라운드 페이지(뒤로가기 버튼 포함)
- `css/sql-playground.css` — 플레이그라운드 전용 스타일(.back-button 정리 포함)
- `js/sql-playground/ui.js` — 백 버튼 동작(../index.html로 이동)

## 회고 / 결정 사항 메모
- 다중 INSERT의 rowid 추적은 `RETURNING` 사용이 가장 정확하지만, 모든 환경에서 지원되지 않으므로 안전한 폴백을 유지함.
- 접근성(ARIA, 키보드 접근성)은 사용자의 요청으로 기본 ARIA 속성을 제거했으나, 키보드 접근성을 보완하려면 JS 기반 키 이벤트나 버튼 요소 사용을 권장함.

---

더 자세한 변경 로그(커밋 수준)와 자동 테스트는 현재 없음 — 원하면 간단한 테스트 스크립트와 문서를 추가해 드리겠습니다.

작성일: 2025-11-19
