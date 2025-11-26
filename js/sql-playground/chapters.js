import {exampleData} from '../../data/example.js';

// 챕터 ID를 URL 파라미터에서 가져오기
const urlParams = new URLSearchParams(window.location.search);
let chapterId = urlParams.get('id');
chapterId = chapterId.toUpperCase();
if (chapterId) {
    const chapterData = exampleData.find(chapter => chapter.chapterId.toUpperCase() === chapterId);
    document.getElementById('chapter-id').textContent = `${chapterId} 배우기`; // 챕터 제목 설정

    if (chapterData) {
        // 기본 SQL 입력란에 기본 SQL 설정
        const baseSQLTextarea = document.getElementById('base-sql-textarea');
        baseSQLTextarea.value = chapterData.baseSQL;
        // SQL 입력란에 예제 SQL 설정
        const sqlTextarea = document.getElementById('sql-textarea');
        sqlTextarea.value = chapterData.exampleSQL;
        // SQL 입력란에 플레이스홀더 설정
        sqlTextarea.placeholder = chapterData.placeholderSQL;
    }

} else {
    document.getElementById('chapter-id').textContent = 'No Chapter ID Provided';
}