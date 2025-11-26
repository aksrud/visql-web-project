cardList = document.getElementsByClassName('chapter-card');

Array.from(cardList).forEach(card => {
    card.addEventListener('click', () => {
        // 각 카드에 적힌 챕터 ID를 가져와서 query-string을 붙인 SQL 플레이그라운드 페이지로 이동
        const chapterId = card.dataset.chapter;
        window.location.href = `pages/sql-playground.html?id=${chapterId}`;
    });
});