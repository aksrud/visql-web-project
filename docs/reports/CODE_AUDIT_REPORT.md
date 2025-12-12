# 코드 감사 보고서 (Code Audit Report)

**문서 번호:** AUDIT-2025-12-13-01
**분석 대상:** 소스 코드 전체
**작성자:** Senior Software Engineer (GitHub Copilot)

## 1. 주요 발견 사항 (Critical & Major Issues)

### 🚨 1. 정규표현식 기반 SQL 파싱의 취약성 (Major)
*   **위치:** `js/sql-playground/script.js` 내 `executeSQL` 함수
*   **문제점:** 현재 SQL 문을 분석하기 위해 `sql.match(/FROM\s+(\w+)/i)`와 같은 단순 정규표현식을 사용하고 있습니다.
    *   **Risk:** 복잡한 쿼리(예: 서브쿼리, JOIN, 공백이 여러 개 섞인 경우, 주석이 포함된 경우)가 입력될 경우 테이블명을 제대로 추출하지 못하거나 `lastAffectedRows` 추적에 실패할 수 있습니다.
*   **권고:** 장기적으로는 간단한 SQL Parser 라이브러리를 도입하거나, 정규표현식을 더 정교하게 다듬어야 합니다. 현재 구조에서는 교육용 범위(단일 테이블 조작)를 벗어나는 쿼리 입력 시 오동작 가능성이 큽니다.

### ⚠️ 2. DOM 조작 시 XSS 잠재 위험 (Major)
*   **위치:** `js/sql-playground/script.js`의 `renderDiagram` 함수 및 `logs-content` 업데이트
*   **문제점:** `div.innerHTML = ...` 및 `content.innerHTML = ...`을 사용하여 HTML을 직접 주입하고 있습니다.
    *   **Risk:** 사용자가 `INSERT INTO users VALUES ('<img src=x onerror=alert(1)>')`와 같은 악의적인 스크립트를 데이터로 입력하고, 이것이 다이어그램이나 로그에 렌더링될 때 **Self-XSS** 공격이 성립될 수 있습니다.
*   **권고:** `textContent`를 사용하거나, 데이터를 렌더링할 때 반드시 HTML 이스케이프 처리를 거쳐야 합니다.

### ⚠️ 3. LocalStorage 용량 한계 (Minor)
*   **위치:** `js/sql-playground/script.js`의 `saveDB` 함수
*   **문제점:** `db.export()`로 전체 DB 바이너리를 `JSON.stringify`하여 저장합니다.
    *   **Risk:** 데이터가 많아지면 브라우저의 LocalStorage 용량 제한(보통 5MB)을 초과하여 저장이 실패할 수 있습니다 (`QuotaExceededError`).
*   **권고:** `try-catch` 블록으로 `setItem`을 감싸고, 용량 초과 시 사용자에게 알림을 주는 예외 처리가 필요합니다.

## 2. 코드 개선 제안 (Refactoring Suggestions)

### 1. `executeSQL` 함수의 복잡도 분리
현재 `executeSQL` 함수가 너무 비대합니다(God Function). 각 SQL 명령 유형별로 핸들러를 분리하는 것이 좋습니다.

```javascript
// 개선 예시
function executeSQL(sql) {
    const trimmed = sql.trim().toUpperCase();
    if (trimmed.startsWith('SELECT')) return handleSelect(sql);
    if (trimmed.startsWith('INSERT')) return handleInsert(sql);
    // ...
}
```

### 2. 하드코딩된 경로 의존성 제거
`js/sql-playground/ui.js`에서 `window.location.href = '../index.html';`와 같이 상대 경로를 사용하고 있습니다. 파일 구조가 변경되면 링크가 깨질 수 있으므로, 절대 경로(`/index.html`)를 사용하거나 설정 파일에서 경로를 관리하는 것이 안전합니다.

### 3. UI와 로직의 결합도 완화
`js/sql-playground/script.js` 내부에서 `document.getElementById`를 통해 UI를 직접 제어하는 코드가 혼재되어 있습니다. `renderDiagram`이나 로그 출력 같은 UI 업데이트 로직은 `js/sql-playground/ui.js`로 이동시키고, `js/sql-playground/script.js`는 순수하게 DB 로직만 담당하도록 리팩토링하면 유지보수성이 크게 향상될 것입니다.

## 3. 결론 및 승인
본 프로젝트는 현재 상태로도 **교육용 MVP(Minimum Viable Product)로서 충분한 기능**을 수행합니다. 위에서 지적된 **XSS 보안 처리**와 **예외 처리(LocalStorage)**만 보완된다면 배포 및 운영에 큰 무리가 없을 것으로 판단됩니다.

**승인 여부:** **조건부 승인** (보안 패치 후 배포 권장)
