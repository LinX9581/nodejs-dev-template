# Node.js Template 專案

專案包含以下初始化環境  
Express,EJS,Mysql,Docker,Cloudrun,GithubCI/CD,ChartJS,Datatable,Bootstrap5  

### 環境需求

- Node.js 22+
- Docker & Docker Compose
- MySQL 資料庫

### Deploy

1. Local test  
```
cp .env.example .env
npm install
npm run dev
http://localhost:3009
```

2. Docker Compose  
```
# .env control image tag
cp .env.example .env
docker-compose up -d
docker logs -f nodejs-template-app
docker compose down
```

3. Cloud Run  
```
# uncomment a variable
sh deploy-cloudrun.sh
```

### CI
專案本身要建立環境變數 nodejs-dev-template-env  
裡面有兩個 secret  
GCP_PROJECT  
PUSH_STATUS_WEBHOOK_URL  
  
是自建 Runner
所以 Runner 本身要有 GAR 和 Cloud Run 寫入權限

### Stress Route
- 壓測工具頁: `/stress`
- 後端工作端點: `/stress/backend/work`

建議部署方式:
- 後端 app 網址: `https://nodejs-bn-linx.bar`

壓測請直接用 k6 打 `/stress/backend/work`，前端流程測試則走 `/stress` 與 `/stress/api/call-backend`。
目前不依賴 DB/Redis，後續可再擴充。
