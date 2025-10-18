// Initialize SQLite
let db;
let lastAffectedRows = {};
let pendingDelete = null; // {sql, table, rowids}
let pendingDrop = null; // {sql, table}
let highlightType = 'normal';

async function initDB() {
    const SQL = await initSqlJs({ locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}` });
    const savedDb = localStorage.getItem('sqliteDb');
    if (savedDb) {
        db = new SQL.Database(new Uint8Array(JSON.parse(savedDb)));
    } else {
        db = new SQL.Database();
    }
}

function saveDB() {
    localStorage.setItem('sqliteDb', JSON.stringify(Array.from(db.export())));
}

function executeSQL(sql) {
    const trimmed = sql.trim().toUpperCase();
    let result = '';
    let affected = 0;
    lastAffectedRows = {};
    highlightType = 'normal';
    try {
        if (trimmed.startsWith('SELECT')) {
            // Modify SELECT to include rowid for highlighting
            const modifiedSql = sql.replace(/\bSELECT\s+/i, 'SELECT rowid, ');
            const res = db.exec(modifiedSql);
            if (res.length > 0) {
                // Extract rowids for highlighting
                const rowids = res[0].values.map(row => row[0]);
                // But result should show original data, so remove rowid from values
                const originalValues = res[0].values.map(row => row.slice(1));
                result = JSON.stringify(originalValues, null, 2);
                affected = originalValues.length;
                // Assume single table SELECT for simplicity
                const tableMatch = sql.match(/FROM\s+(\w+)/i);
                if (tableMatch) {
                    lastAffectedRows[tableMatch[1]] = rowids;
                }
            }
        } else if (trimmed.startsWith('INSERT')) {
            db.run(sql);
            affected = db.getRowsModified();
            result = `Executed successfully, affected rows: ${affected}`;
            // Get last inserted rowid
            const res = db.exec("SELECT last_insert_rowid()");
            const tableMatch = sql.match(/INSERT\s+INTO\s+(\w+)/i);
            if (tableMatch && res.length > 0) {
                lastAffectedRows[tableMatch[1]] = [res[0].values[0][0]];
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

function renderDiagram() {
    const content = document.getElementById('diagram-content');
    content.innerHTML = '';
    const tablesRes = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
    if (tablesRes.length === 0) return;
    const tableNames = tablesRes[0].values.map(row => row[0]);
    let index = 0;
    tableNames.forEach(name => {
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
        // Get columns
        const pragmaRes = db.exec(`PRAGMA table_info(${name})`);
        const columns = pragmaRes[0].values.map(row => ({ name: row[1], type: row[2] }));
        columns.forEach(col => {
            const th = document.createElement('th');
            th.textContent = `${col.name} (${col.type})`;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        tableEl.appendChild(thead);
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

function startDrag(e) {
    isDragging = true;
    currentElement = e.target.closest('.table-diagram');
    offsetX = e.clientX - currentElement.offsetLeft;
    offsetY = e.clientY - currentElement.offsetTop;
    currentElement.style.zIndex = 1000;
}

function drag(e) {
    if (!isDragging) return;
    const container = document.getElementById('diagram-content');
    const containerRect = container.getBoundingClientRect();
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
