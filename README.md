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