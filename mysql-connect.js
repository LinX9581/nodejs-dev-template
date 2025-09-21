import mysql from 'mysql2/promise';

// 建立資料庫連線池
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    // database: process.env.DB_NAME, // readiness 不需特定 DB，此處可視需要開啟
    charset: 'utf8mb4',
    timezone: '+08:00',
    connectionLimit: 10,
    connectTimeout: 60000,      // 建立連線的超時時間 (毫秒)
    idleTimeout: 900000,        // 閒置連線的超時時間 (15分鐘)
    maxIdle: 10,                // 最大閒置連線數
});

// 簡化的查詢函數，包含基本錯誤追蹤
let query = async function(sql, params) {
    const caller = new Error().stack.split('\n')[2]?.trim() || 'Unknown';
    try {
        const [rows] = await pool.execute(sql, params);
        return rows;
    } catch (err) {
        err.sql = sql;
        err.caller = caller;
        throw err;
    }
}

export default query;

// 提供 Readiness 專用的輕量連線檢查（短超時，避免卡住請求）
export async function pingDatabase(options = {}) {
    const { timeoutMs = 1000 } = options;
    const config = {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        // 不強制指定 database，僅檢查基本可連線性
        timezone: '+08:00',
        connectTimeout: timeoutMs,
    };

    let connection;
    try {
        connection = await mysql.createConnection(config);
        await connection.execute('SELECT 1');
        await connection.end();
        return true;
    } catch (err) {
        if (connection) {
            try { await connection.end(); } catch (_) {}
        }
        throw err;
    }
}