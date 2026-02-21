import query from "../mysql-connect.js";
import express from "express";
import moment from "moment";
import { readFileSync } from "fs";
import { logUserAccess } from "../log/userAccess.js";
import { asyncHandler } from "../log/asyncHandler.js";

// 讀取 package.json 中的版本信息
const packageJson = JSON.parse(readFileSync("./package.json", "utf8"));
const { version } = packageJson;
const router = express.Router();

// GitHub API 共用配置
const GITHUB_API_HEADERS = {
  Accept: "application/vnd.github.v3+json",
  "User-Agent": "nodejs-template-app"
};

// 首頁路由
router.get("/", logUserAccess("首頁訪問"), asyncHandler(async (req, res) => {
  const title = "Node.js Template ";
  const today = moment().format("YYYY-MM-DD HH:mm:ss");
  res.render("index", { today, title, version });
})
);

// 第一項數據 API - GitHub 星星數成長最快的專案（前20名）
router.post("/api/chart-data", logUserAccess("GitHub 熱門成長專案查詢"), asyncHandler(async (req, res) => {
  // 獲取最近30天內創建且星星數較高的專案（代表成長快速）
  const dateString = moment().subtract(30, 'days').format('YYYY-MM-DD');

  const response = await fetch(`https://api.github.com/search/repositories?q=created:>${dateString}&sort=stars&order=desc&per_page=20`, {
    headers: GITHUB_API_HEADERS
  });

  if (!response.ok) {
    return res.status(response.status).json({
      status: "error",
      message: `GitHub API 請求失敗: ${response.status} ${response.statusText}`,
      error: "API_REQUEST_FAILED"
    });
  }

  const data = await response.json();
  const trendingRepos = data.items.map((repo) => {
    // 計算每日平均星星增長數（使用 moment）
    const createdDate = moment(repo.created_at);
    const daysSinceCreated = Math.max(1, moment().diff(createdDate, 'days'));
    const starsPerDay = Math.round(repo.stargazers_count / daysSinceCreated);

    return {
      label: repo.name,
      value: repo.stargazers_count,
      starsPerDay,
      language: repo.language || "未指定",
      url: repo.html_url,
    };
  });

  res.json({
    status: "success",
    data: trendingRepos,
    message: "GitHub 星星成長最快專案數據載入成功（前20名）"
  });
})
);

// 新增 API - GitHub 最受歡迎專案
router.post("/api/popular-repos", logUserAccess("熱門專案數據查詢"), asyncHandler(async (req, res) => {
  const response = await fetch("https://api.github.com/search/repositories?q=stars:>10000&sort=stars&order=desc&per_page=30", {
    headers: GITHUB_API_HEADERS
  });

  if (!response.ok) {
    return res.status(response.status).json({
      status: "error",
      message: `GitHub API 請求失敗: ${response.status} ${response.statusText}`,
      error: "API_REQUEST_FAILED"
    });
  }

  const data = await response.json();
  const repoData = data.items.map((repo, index) => ({
    rank: index + 1,
    name: repo.name,
    stars: repo.stargazers_count,
    language: repo.language || "未指定",
    url: repo.html_url,
  }));

  res.json({
    status: "success",
    data: repoData,
    message: "GitHub 熱門專案數據載入成功"
  });
})
);

// 健康檢查 (支援 /healthz 和 /pod-health 兩個端點)
router.get(["/healthz", "/pod-health"], asyncHandler(async (req, res) => {
  res.json({ status: "ok" });
})
);

// testDbConnection()
async function testDbConnection() {
  try {
    const result = await query("SELECT 1 AS ok");
    // 資料庫連線成功的話，輸出資料庫連線成功的訊息
    if (result.length > 0) {
      console.log("DB Connection Success");
    }
  } catch (error) {
    console.error("資料庫連線測試失敗:", error);
    throw error;
  }
}

export default router;
