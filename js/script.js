// Initialize SQLite
let db;
let lastAffectedRows = {};
let pendingDelete = null; // {sql, table, rowids}
let pendingDrop = null; // {sql, table}
let highlightType = 'normal';

/** SQLite 데이터베이스 초기화 */
async function initDB() {
    // SQLite WebAssembly initialization (SQL 실행 엔진 로드)
    const SQL = await initSqlJs({ locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.13.0/${file}`});
    // Load from LocalStorage (저장된 DB 불러오기)
    const savedDb = localStorage.getItem('sqliteDb');
    if (savedDb) {
        db = new SQL.Database(new Uint8Array(JSON.parse(savedDb)));
    } else {
        db = new SQL.Database();
    }
}

/** 현재 DB를 로컬스토리지에 저장 */
function saveDB() {
    localStorage.setItem('sqliteDb', JSON.stringify(Array.from(db.export())));
}

/** SQL 실행 및 결과 반환 */
function executeSQL(sql) {
    const trimmed = sql.trim().toUpperCase();
    let result = '';
    let affected = 0;
    lastAffectedRows = {};
    highlightType = 'normal';
    try {
        if (trimmed.startsWith('SELECT')) {
            // rowid 포함하여 SELECT 실행
            const modifiedSql = sql.replace(/\bSELECT\s+/i, 'SELECT rowid, ');
            const res = db.exec(modifiedSql);
            if (res.length > 0) {
                // rowid만 따로 저장
                const rowids = res[0].values.map(row => row[0]);
                // 원래 값만 추출
                const originalValues = res[0].values.map(row => row.slice(1));
                result = JSON.stringify(originalValues, null, 2);
                affected = originalValues.length;
                // 단일 테이블만 가능하게 가정
                const tableMatch = sql.match(/FROM\s+(\w+)/i);
                if (tableMatch) {
                    lastAffectedRows[tableMatch[1]] = rowids;
                }
            }
        } else if (trimmed.startsWith('INSERT')) {
            // INSERT ... RETURNING rowid 를 우선 시도 (모든 삽입된 rowid를 직접 얻기 위함)
            const tableMatch = sql.match(/INSERT\s+INTO\s+(\w+)/i);
            let handledByReturning = false;
            try {
                // 세미콜론 제거 후 RETURNING rowid 추가 시도
                const modifiedSql = sql.replace(/;\s*$/, '') + ' RETURNING rowid;';
                const res = db.exec(modifiedSql);
                if (res.length > 0) {
                    const rowids = res[0].values.map(r => parseInt(r[0], 10));
                    affected = rowids.length;
                    result = `Executed successfully, affected rows: ${affected}`;
                    if (tableMatch) lastAffectedRows[tableMatch[1]] = rowids;
                    handledByReturning = true;
                }
            } catch (e) {
                // RETURNING 미지원 등으로 실패하면 폴백 처리
                handledByReturning = false;
            }
            if (!handledByReturning) {
                // 폴백: 기존 방식 (db.run + last_insert_rowid()로 범위 계산)
                db.run(sql);
                affected = db.getRowsModified(); // 영향받은 행 수
                result = `Executed successfully, affected rows: ${affected}`;
                const res2 = db.exec("SELECT last_insert_rowid()");
                if (tableMatch && res2.length > 0) {
                    const lastRowId = parseInt(res2[0].values[0][0], 10);
                    if (affected > 1) {
                        const start = lastRowId - affected + 1;
                        const rowids = [];
                        for (let i = 0; i < affected; i++) rowids.push(start + i);
                        lastAffectedRows[tableMatch[1]] = rowids;
                    } else if (affected === 1) {
                        lastAffectedRows[tableMatch[1]] = [lastRowId];
                    } else {
                        lastAffectedRows[tableMatch[1]] = [];
                    }
                }
            }
        } else if (trimmed.startsWith('UPDATE')) {
            // First, find affected rowids
            const tableMatch = sql.match(/UPDATE\s+(\w+)/i);
            if (tableMatch) {
                const table = tableMatch[1];
                const whereMatch = sql.match(/WHERE\s+(.+)/i);
                let whereClause = '';
                if (whereMatch) {
                    whereClause = ' WHERE ' + whereMatch[1];
                }
                const selectSql = `SELECT rowid FROM ${table}${whereClause}`;
                const selectRes = db.exec(selectSql);
                const rowids = selectRes.length > 0 ? selectRes[0].values.map(row => row[0]) : [];
                db.run(sql);
                affected = db.getRowsModified();
                result = `Executed successfully, affected rows: ${affected}`;
                lastAffectedRows[table] = rowids;
            } else {
                db.run(sql);
                affected = db.getRowsModified();
                result = `Executed successfully, affected rows: ${affected}`;
            }
        } else if (trimmed.startsWith('DELETE')) {
            // First, find affected rowids
            const tableMatch = sql.match(/DELETE\s+FROM\s+(\w+)/i);
            if (tableMatch) {
                const table = tableMatch[1];
                const whereMatch = sql.match(/WHERE\s+(.+)/i);
                let whereClause = '';
                if (whereMatch) {
                    whereClause = ' WHERE ' + whereMatch[1];
                }
                const selectSql = `SELECT rowid FROM ${table}${whereClause}`;
                const selectRes = db.exec(selectSql);
                const rowids = selectRes.length > 0 ? selectRes[0].values.map(row => row[0]) : [];
                affected = rowids.length;
                result = `Preview: ${affected} rows will be deleted. Confirm?`;
                lastAffectedRows[table] = rowids;
                highlightType = 'delete';
                pendingDelete = { sql, table, rowids };
            } else {
                result = 'Invalid DELETE syntax';
            }
        } else if (trimmed.startsWith('DROP')) {
            const tableMatch = sql.match(/DROP\s+TABLE\s+(\w+)/i);
            if (tableMatch) {
                const table = tableMatch[1];
                lastAffectedRows[table] = 'all';
                highlightType = 'drop';
                affected = 1;
                result = `Preview: Table ${table} will be dropped. Confirm?`;
                pendingDrop = { sql, table };
            } else {
                result = 'Invalid DROP syntax';
            }
        } else {
            db.run(sql);
            affected = db.getRowsModified();
            result = `Executed successfully, affected rows: ${affected}`;
        }
        saveDB();
    } catch (e) {
        result = `Error: ${e.message}`;
    }
    return { result, affected };
}

/** 다이어그램 렌더링 */
function renderDiagram() {
    const content = document.getElementById('diagram-content');
    content.innerHTML = '';
    const tablesRes = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
    if (tablesRes.length === 0) return;
    // 테이블 이름을 빼와서 저장
    const tableNames = tablesRes[0].values.map(row => row[0]);
    let index = 0;
    tableNames.forEach(name => {
        // 테이블 다이어그램 생성
        const div = document.createElement('div');
        div.className = 'table-diagram';
        if (lastAffectedRows[name] === 'all') {
            div.classList.add('highlight', highlightType);
        }
        div.style.left = (index * 320) + 'px';
        div.style.top = '10px';
        div.innerHTML = `<h4>Table: ${name}</h4>`;
        const tableEl = document.createElement('table');
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        
        // 컬럼 이름과 타입 가져오기
        const pragmaRes = db.exec(`PRAGMA table_info(${name})`);
        const columns = pragmaRes[0].values.map(row => ({ name: row[1], type: row[2] }));
        columns.forEach(col => {
            const th = document.createElement('th');
            th.textContent = `${col.name} (${col.type})`;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        tableEl.appendChild(thead);

        // 테이블 행 다이어그램 그리기
        const tbody = document.createElement('tbody');
        const dataRes = db.exec(`SELECT rowid, * FROM ${name}`);
        if (dataRes.length > 0) {
            dataRes[0].values.forEach(row => {
                const tr = document.createElement('tr');
                tr.setAttribute('data-rowid', row[0]);
                if (lastAffectedRows[name] !== 'all' && Array.isArray(lastAffectedRows[name]) && lastAffectedRows[name].includes(parseInt(row[0]))) {
                    tr.classList.add('highlight', highlightType);
                }
                row.slice(1).forEach(cell => {  // Skip rowid
                    const td = document.createElement('td');
                    td.textContent = cell;
                    tr.appendChild(td);
                });
                tbody.appendChild(tr);
            });
        }
        tableEl.appendChild(tbody);
        div.appendChild(tableEl);
        div.addEventListener('mousedown', startDrag);
        content.appendChild(div);
        index++;
    });
}

// Event listeners
document.getElementById('execute-btn').addEventListener('click', () => {
    const sql = document.getElementById('sql-textarea').value;
    document.getElementById('sql-preview-content').textContent = sql;
    const { result, affected } = executeSQL(sql);
    let logText = `Affected rows: ${affected}\n${result}`;
    // Add buttons for DELETE or DROP confirmation
    const confirmationDiv = document.getElementById('confirmation-buttons');
    confirmationDiv.innerHTML = '';
    if (pendingDelete) {
        confirmationDiv.innerHTML = '<button onclick="confirmDelete()">삭제 확인</button> <button onclick="cancelDelete()">취소</button>';
    } else if (pendingDrop) {
        confirmationDiv.innerHTML = '<button onclick="confirmDrop()">DROP 확인</button> <button onclick="cancelDrop()">취소</button>';
    }
    document.getElementById('logs-content').innerHTML = logText;
    renderDiagram();
});

document.getElementById('chapter-select').addEventListener('change', (e) => {
    const desc = document.getElementById('chapter-description');
    if (e.target.value === 'ddl') {
        desc.innerHTML = '<p>DDL 기초: CREATE TABLE로 테이블을 만들고, DROP TABLE로 삭제하세요.</p>';
    } else {
        desc.innerHTML = '<p>DML 기초: INSERT로 데이터를 추가, SELECT로 조회, UPDATE로 수정, DELETE로 삭제하세요.</p>';
    }
});

/** 삭제 확인 및 실행 */
function confirmDelete() {
    if (pendingDelete) {
        db.run(pendingDelete.sql);
        saveDB();
        document.getElementById('logs-content').innerHTML = `Deleted ${pendingDelete.rowids.length} rows from ${pendingDelete.table}\nDeleted row IDs: ${pendingDelete.rowids.join(', ')}`;
        pendingDelete = null;
        lastAffectedRows = {};
        highlightType = 'normal';
        setTimeout(() => {
            document.getElementById('confirmation-buttons').innerHTML = '';
            renderDiagram();
        }, 0);
    }
}

/** 삭제 취소 */
function cancelDelete() {
    if (pendingDelete) {
        document.getElementById('logs-content').textContent = 'Delete cancelled';
        pendingDelete = null;
        lastAffectedRows = {};
        highlightType = 'normal';
        setTimeout(() => {
            document.getElementById('confirmation-buttons').innerHTML = '';
            renderDiagram();
        }, 0);
    }
}

/** DROP 확인 및 실행 */
function confirmDrop() {
    if (pendingDrop) {
        db.run(pendingDrop.sql);
        saveDB();
        document.getElementById('logs-content').innerHTML = `Table ${pendingDrop.table} dropped`;
        pendingDrop = null;
        lastAffectedRows = {};
        highlightType = 'normal';
        setTimeout(() => {
            document.getElementById('confirmation-buttons').innerHTML = '';
            renderDiagram();
        }, 0);
    }
}

/** DROP 취소 */
function cancelDrop() {
    if (pendingDrop) {
        document.getElementById('logs-content').textContent = 'Drop cancelled';
        pendingDrop = null;
        lastAffectedRows = {};
        highlightType = 'normal';
        setTimeout(() => {
            document.getElementById('confirmation-buttons').innerHTML = '';
            renderDiagram();
        }, 0);
    }
}

let isDragging = false;
let currentElement = null;
let offsetX, offsetY;

/** 테이블 다이어그램 드래그 시작 */
function startDrag(e) {
    isDragging = true;
    currentElement = e.target.closest('.table-diagram'); // 드래그 중인 요소 부모(뭉탱이) 선택
    offsetX = e.clientX - currentElement.offsetLeft;
    offsetY = e.clientY - currentElement.offsetTop;
    currentElement.style.zIndex = 1000;
}

/** 테이블 다이어그램 드래그 중 */
function drag(e) {
    if (!isDragging) return;
    const container = document.getElementById('diagram-content'); // 컨테이너 경계 가져오기
    const containerRect = container.getBoundingClientRect(); // 컨테이너의 경계 정보를 가져옴
    // 새로운 위치 계산
    let newLeft = e.clientX - offsetX;
    let newTop = e.clientY - offsetY;
    const elementWidth = currentElement.offsetWidth;
    const elementHeight = currentElement.offsetHeight;
    if (newLeft < 0) newLeft = 0;
    if (newTop < 0) newTop = 0;
    if (newLeft + elementWidth > containerRect.width) newLeft = containerRect.width - elementWidth;
    if (newTop + elementHeight > containerRect.height) newTop = containerRect.height - elementHeight;
    currentElement.style.left = newLeft + 'px';
    currentElement.style.top = newTop + 'px';
}

/** 테이블 다이어그램 드래그 종료 */
function stopDrag() {
    if (!isDragging) return;
    isDragging = false;
    currentElement.style.zIndex = '';
    currentElement = null;
}

document.addEventListener('mousemove', drag);
document.addEventListener('mouseup', stopDrag);

// Initialize
initDB().then(() => {
    renderDiagram();
});
