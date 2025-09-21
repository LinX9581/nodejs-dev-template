# Node.js Template 專案

一個基於 Express.js 的 Node.js 應用程式模板，包含資料庫連線測試、健康檢查和 DevOps API 端點。

## 功能特色

- ✅ Express.js 框架
- ✅ EJS 模板引擎
- ✅ MySQL 資料庫支援
- ✅ Docker 容器化部署
- ✅ 健康檢查端點
- ✅ API Key 認證
- ✅ DevOps 專案資料 API

## 快速開始

### 環境需求

- Node.js 22+
- Docker & Docker Compose
- MySQL 資料庫

### 本地開發

1. 安裝依賴：
```bash
npm install
```

2. 設定環境變數（建立 `.env` 檔案）：
```env
NODE_ENV=development
PORT=3009
TEST_API_KEY=test-db-key-2024
DB_HOST=localhost
DB_USER=your_username
DB_PASSWORD=your_password
DB_NAME=your_database
```

3. 啟動開發模式：
```bash
npm run dev
```

4. 訪問應用程式：
```
http://localhost:3009
```

## Docker Compose 部署

### 1. 建立 .env 檔案

在專案根目錄建立 `.env` 檔案：
```env
NODE_ENV=production
PORT=3009
TEST_API_KEY=your-secure-api-key
DB_HOST=your-db-host
DB_USER=your-db-username
DB_PASSWORD=your-db-password
DB_NAME=your-database-name
```

### 2. 啟動服務

```bash
# 建立並啟動服務
docker-compose up -d

# 查看服務狀態
docker-compose ps

# 查看應用程式日誌
docker-compose logs -f app
```

### 3. 停止服務

```bash
# 停止服務
docker-compose down

# 停止服務並移除 volumes
docker-compose down -v
```

## API 端點測試

### 1. 健康檢查

```bash
# 健康檢查端點
curl http://localhost:3009/healthz

# 或使用 pod-health 端點
curl http://localhost:3009/pod-health
```

預期回應：
```json
{
  "status": "ok"
}
```

### 2. 資料庫連線測試

**使用 Header 傳遞 API Key：**
```bash
curl -X POST http://localhost:3009/test-db \
  -H "Content-Type: application/json" \
  -H "x-api-key: test-db-key-2024"
```

**使用 Body 傳遞 API Key：**
```bash
curl -X POST http://localhost:3009/test-db \
  -H "Content-Type: application/json" \
  -d '{"apiKey": "test-db-key-2024"}'
```

成功回應範例：
```json
{
  "status": "success",
  "message": "資料庫連線測試成功",
  "data": {
    "time": "2024-01-01T12:00:00.000Z"
  }
}
```

### 3. DevOps 專案資料 API

```bash
curl -X POST http://localhost:3009/api/devops-projects \
  -H "Content-Type: application/json"
```

### 4. DevOps 趨勢資料 API

```bash
curl -X POST http://localhost:3009/api/devops-trends \
  -H "Content-Type: application/json"
```

## 測試

### 執行測試

```bash
# 安裝測試依賴
npm install

# 執行所有測試
npm test

# 執行測試並監視檔案變化
npm test -- --watch
```

### 測試覆蓋率

```bash
# 執行測試並產生覆蓋率報告
npm test -- --coverage
```

## 專案結構

```
nodejs-template1/
├── route/
│   └── indexRouter.js          # 主要路由定義
├── views/
│   └── index.ejs              # EJS 模板檔案
├── component/
│   └── data/                  # 靜態資料檔案
├── tests/                     # 測試檔案
│   └── app.test.js           # API 端點測試
├── docker-compose.yml         # Docker Compose 設定
├── dockerfile                 # Docker 映像檔定義
├── package.json              # 專案依賴和腳本
└── README.md                 # 專案說明文件
```

## 環境變數說明

| 變數名稱 | 說明 | 預設值 |
|---------|------|--------|
| `NODE_ENV` | 執行環境 | `development` |
| `PORT` | 應用程式端口 | `3009` |
| `TEST_API_KEY` | 測試 API 金鑰 | `test-db-key-2024` |
| `DB_HOST` | 資料庫主機 | `localhost` |
| `DB_USER` | 資料庫使用者 | - |
| `DB_PASSWORD` | 資料庫密碼 | - |
| `DB_NAME` | 資料庫名稱 | - |

## 故障排除

### 常見問題

1. **容器無法啟動**
   - 檢查 `.env` 檔案是否正確設定
   - 確認端口 3009 沒有被其他服務佔用

2. **資料庫連線失敗**
   - 檢查資料庫連線資訊
   - 確認資料庫服務是否正在運行

3. **API Key 認證失敗**
   - 確認使用正確的 API Key
   - 檢查環境變數 `TEST_API_KEY` 設定

### 日誌查看

```bash
# 查看應用程式日誌
docker-compose logs -f app

# 查看最近 100 行日誌
docker-compose logs --tail=100 app
```

## 授權

MIT License