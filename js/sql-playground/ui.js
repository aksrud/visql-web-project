// 이곳에는 각 챕터별 UI 초기화 및 이벤트 핸들러 설정 코드가 포함됩니다.

// Back 버튼 클릭 시 index.html로 돌아가기
document.addEventListener('DOMContentLoaded', () => {
	const backBtn = document.getElementById('back-btn');
	if (!backBtn) return;
	backBtn.addEventListener('click', (e) => {
		e.preventDefault();
		// 상대 경로로 루트 index.html로 이동
		// pages/sql-playground.html에서 프로젝트 루트의 index.html로 이동하려면 ../index.html로 설정
		window.location.href = '../index.html';
	});
});