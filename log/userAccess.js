import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 確保 logs 目錄存在
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * 記錄使用者訪問日誌
 * @param {string} action - 操作描述
 * @returns {Function} Express middleware
 */
export function logUserAccess(action) {
  return (req, res, next) => {
    const startTime = Date.now();
    
    // 台北時間
    const taipeiTime = new Date().toLocaleString('zh-TW', {
      timeZone: 'Asia/Taipei',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    
    const ip = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'Unknown';
    const method = req.method;
    const url = req.originalUrl || req.url;
    
    // 監聽回應完成事件來計算處理時間
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const statusCode = res.statusCode;
      
      // 建立日誌訊息
      const logMessage = `[${taipeiTime}] ${action} - ${method} ${url} - IP: ${ip} - ${statusCode} - ${duration}ms`;
      
      // 印出到 console
      console.log(logMessage);
      
      // 儲存到檔案
      const today = new Date().toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei' }).replace(/\//g, '-'); // YYYY-MM-DD 格式
      const logFile = path.join(logsDir, `access-${today}.log`);
      
      fs.appendFile(logFile, logMessage + '\n', (err) => {
        if (err) {
          console.error('寫入日誌檔案失敗:', err);
        }
      });
    });
    
    next();
  };
}

/**
 * 記錄錯誤日誌
 * @param {Error} error - 錯誤物件
 * @param {Object} req - Express request 物件
 */
export function logError(error, req) {
  // 台北時間
  const taipeiTime = new Date().toLocaleString('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  const ip = req.ip || req.connection.remoteAddress || 'Unknown';
  const method = req.method;
  const url = req.originalUrl || req.url;
  
  const errorMessage = `[${taipeiTime}] ERROR - ${method} ${url} - IP: ${ip} - Error: ${error.message}\nStack: ${error.stack}`;
  
  // 印出到 console
  console.error(errorMessage);
  
  // 儲存到錯誤日誌檔案
  const today = new Date().toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei' }).replace(/\//g, '-');
  const errorLogFile = path.join(logsDir, `error-${today}.log`);
  
  fs.appendFile(errorLogFile, errorMessage + '\n\n', (err) => {
    if (err) {
      console.error('寫入錯誤日誌檔案失敗:', err);
    }
  });
}
