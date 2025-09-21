import query from "../mysql-connect.js";
import express from "express";
import moment from "moment";
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logUserAccess } from '../log/userAccess.js';
import { asyncHandler, createSuccessResponse, createErrorResponse } from '../log/asyncHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// 健康檢查 (支援 /healthz 和 /pod-health 兩個端點)
router.get(["/healthz", "/pod-health"], logUserAccess('健康檢查'), asyncHandler(async (req, res) => {
  res.json({ status: 'ok' });
}));

// DevOps 專案資料 API
router.post("/api/devops-projects", logUserAccess('DevOps專案資料查詢'), asyncHandler(async (req, res) => {
  const dataPath = path.join(__dirname, '../component/data/devops-projects.json');
  const jsonData = readFileSync(dataPath, 'utf8');
  const projects = JSON.parse(jsonData);
  
  res.json({
    status: "success",
    data: projects,
    total: projects.length
  });
}));

// DevOps 趨勢資料 API
router.post("/api/devops-trends", logUserAccess('DevOps趨勢資料查詢'), asyncHandler(async (req, res) => {
  const dataPath = path.join(__dirname, '../component/data/devops-trends-2024.json');
  const jsonData = readFileSync(dataPath, 'utf8');
  const trends = JSON.parse(jsonData);
  
  res.json({
    status: "success",
    data: trends,
    total: trends.length
  });
}));

// 範例：Google Trend API (展示如何使用新的模組化功能)
router.post("/getTodayTopNews", logUserAccess('GoogleTrend -> TodayTopNews'), asyncHandler(async (req, res) => {
  // 模擬取得資料
  const bqData = {
    trends: [
      { keyword: "AI 發展", searches: 1500000 },
      { keyword: "區塊鏈技術", searches: 850000 },
      { keyword: "雲端運算", searches: 1200000 }
    ],
    timestamp: new Date().toISOString()
  };
  
  res.json({
    rtAllSourceLineObj: bqData,
  });
}));

// testDbConnection()
async function testDbConnection() {
  try {
    let result = await query("SELECT 1 AS ok");
    console.log(result);
    return result;
  } catch (error) {
    console.error('資料庫連線測試失敗:', error);
    throw error;
  }
}

export default router;
