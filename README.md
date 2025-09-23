# Node.js Template 專案

一個基於 Express.js 的 Node.js 應用程式模板，包含資料庫連線測試、健康檢查和 DevOps API 端點。

## 功能特色

專案包含以下初始化環境  
Express,EJS,Mysql,Docker,Cloudrun,GithubCI/CD,ChartJS,Datatable,Bootstrap5  

## 快速開始

### 環境需求

- Node.js 22+
- Docker & Docker Compose
- MySQL 資料庫

### Deploy

1. Local test：
```
cp .env.example .env
npm install
npm run dev
http://localhost:3009
```

2. Docker Compose 部署
```
# .env control image tag
cp .env.example .env
docker-compose up -d
docker logs -f nodejs-template-app
docker compose down
```