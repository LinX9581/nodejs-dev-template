import query from "../mysql-connect.js";
import express from "express";
import moment from "moment";
import { readFileSync } from 'fs';
import { logUserAccess } from '../log/userAccess.js';
import { asyncHandler } from '../log/asyncHandler.js';

// 讀取 package.json 中的版本信息
const packageJson = JSON.parse(readFileSync('./package.json', 'utf8'));
const { version } = packageJson;
let router = express.Router();

// 首頁路由
router.get("/", logUserAccess('首頁訪問'), asyncHandler(async (req, res) => {
  let title = "Node.js Template ";
  let today = new moment().format("YYYY-MM-DD HH:mm:ss");
  res.render("index", { today, title, version });
}));

// 第一項數據 API - 程式語言使用率
router.post("/api/chart-data", logUserAccess('程式語言數據查詢'), asyncHandler(async (req, res) => {
  const chartData = [
    { label: 'JavaScript', value: 85, percentage: 28.3 },
    { label: 'Python', value: 72, percentage: 24.0 },
    { label: 'TypeScript', value: 58, percentage: 19.3 },
    { label: 'Java', value: 42, percentage: 14.0 },
    { label: 'Go', value: 28, percentage: 9.3 },
    { label: 'Rust', value: 15, percentage: 5.0 }
  ];
  
  res.json({
    status: "success",
    data: chartData,
    total: chartData.length,
    message: "程式語言數據載入成功"
  });
}));

// 第二項數據 API - 開發工具使用率
router.post("/api/tools-data", logUserAccess('開發工具數據查詢'), asyncHandler(async (req, res) => {
  const toolsData = [
    { label: 'VS Code', value: 120, percentage: 35.3 },
    { label: 'IntelliJ IDEA', value: 85, percentage: 25.0 },
    { label: 'Vim/Neovim', value: 45, percentage: 13.2 },
    { label: 'Sublime Text', value: 38, percentage: 11.2 },
    { label: 'Atom', value: 28, percentage: 8.2 },
    { label: 'Eclipse', value: 24, percentage: 7.1 }
  ];
  
  res.json({
    status: "success",
    data: toolsData,
    total: toolsData.length,
    message: "開發工具數據載入成功"
  });
}));

// 健康檢查 (支援 /healthz 和 /pod-health 兩個端點)
router.get(["/healthz", "/pod-health"], logUserAccess('健康檢查'), asyncHandler(async (req, res) => {
  res.json({ status: 'ok' });
}));

testDbConnection()
async function testDbConnection() {
  try {
    let result = await query("SELECT 1 AS ok");
    // 資料庫連線成功的話，輸出資料庫連線成功的訊息
    if (result.length > 0) {
      console.log("DB Connection Success");
    }
  } catch (error) {
    console.error('資料庫連線測試失敗:', error);
    throw error;
  }
}

export default router;
