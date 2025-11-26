export const exampleData = [
    {
        chapterId: 'create',
        baseSQL: `none`,
        exampleSQL: `CREATE TABLE users (
                id INTEGER PRIMARY KEY,
                username VARCHAR(50) NOT NULL,
                email VARCHAR(100) NOT NULL UNIQUE);`,
        placeholderSQL: `CREATE TABLE users(컬럼1 컬럼 속성1 ..., 컬럼2 컬럼 속성1 ..., ...);`
    },
    {
        chapterId: 'alter',
        baseSQL: `CREATE TABLE users (
                id INTEGER PRIMARY KEY,
                username VARCHAR(50) NOT NULL,
                email VARCHAR(100) NOT NULL UNIQUE);`,
        exampleSQL: `ALTER TABLE users ADD COLUMN age INT;`,
        placeholderSQL: `ALTER TABLE users {ADD나 MODIFY, DROP등등} COLUMN 컬럼 컬럼 속성;`
    },
    {
        chapterId: 'drop',
        baseSQL: `CREATE TABLE users (
                id INTEGER PRIMARY KEY,
                username VARCHAR(50) NOT NULL,
                email VARCHAR(100) NOT NULL UNIQUE);`,
        exampleSQL: `DROP TABLE users;`,
        placeholderSQL: `DROP TABLE 테이블명;`
    },
    {
        chapterId: 'insert',
        baseSQL: `CREATE TABLE users (
                id INTEGER PRIMARY KEY,
                username VARCHAR(50) NOT NULL,
                email VARCHAR(100) NOT NULL UNIQUE);`,
        exampleSQL: `INSERT INTO users (username, email)
            VALUES
            ('alice', 'alice@example.com'),
            ('bob', 'bob@example.com'),
            ('charlie', 'charlie@example.com');`,
        placeholderSQL: `INSERT INTO 테이블명 (컬럼1, 컬럼2, ...) VALUES (값1, 값2, ...);`
    },
    {
        chapterId: 'select',
        baseSQL: `CREATE TABLE users (
                id INTEGER PRIMARY KEY,
                username VARCHAR(50) NOT NULL,
                email VARCHAR(100) NOT NULL UNIQUE);

                INSERT INTO users (username, email)
                VALUES
                ('alice', 'alice@example.com'),
                ('bob', 'bob@example.com'),
                ('charlie', 'charlie@example.com');`,
        exampleSQL: `SELECT * FROM users;`,
        placeholderSQL: `SELECT {(컬럼1, 컬럼2, ...) 이거나 전체선택인 *} FROM 테이블명 WHERE 조건;`
    },
    {
        chapterId: 'delete',
        baseSQL: `CREATE TABLE users (
                id INTEGER PRIMARY KEY,
                username VARCHAR(50) NOT NULL,
                email VARCHAR(100) NOT NULL UNIQUE);
                
                INSERT INTO users (username, email)
                VALUES
                ('alice', 'alice@example.com'),
                ('bob', 'bob@example.com'),
                ('charlie', 'charlie@example.com');`,
        exampleSQL: `DELETE FROM users WHERE username = 'alice';`,
        placeholderSQL: `DELETE FROM 테이블명 WHERE 조건;`
    },
];
