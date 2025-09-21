import { logError } from './userAccess.js';

/**
 * 非同步路由處理器包裝器
 * 自動處理 try-catch 和錯誤記錄
 * @param {Function} fn - 非同步路由處理函數
 * @returns {Function} Express 路由處理器
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      // 記錄錯誤
      logError(error, req);
      
      // 回傳錯誤回應
      res.status(500).json({
        status: "error",
        message: "伺服器內部錯誤",
        error: process.env.NODE_ENV === 'development' ? error.message : '請聯繫系統管理員'
      });
    });
  };
}

/**
 * 建立標準化的成功回應
 * @param {*} data - 回應資料
 * @param {string} message - 成功訊息
 * @param {number} total - 資料總數（可選）
 */
export function createSuccessResponse(data, message = "操作成功", total = null) {
  const response = {
    status: "success",
    message,
    data
  };
  
  if (total !== null) {
    response.total = total;
  }
  
  return response;
}

/**
 * 建立標準化的錯誤回應
 * @param {string} message - 錯誤訊息
 * @param {*} error - 錯誤詳情（開發環境才會顯示）
 * @param {number} statusCode - HTTP 狀態碼
 */
export function createErrorResponse(message, error = null, statusCode = 500) {
  const response = {
    status: "error",
    message
  };
  
  if (process.env.NODE_ENV === 'development' && error) {
    response.error = error;
  }
  
  return { response, statusCode };
}
