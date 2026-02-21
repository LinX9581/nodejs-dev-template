// import "./tracing.js";
import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import indexRouter from './route/indexRouter.js';

const app = express();

// 信任 proxy（GKE Load Balancer / Ingress），讓 req.ip 能正確解析 X-Forwarded-For 取得真實 IP
app.set('trust proxy', true);

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

// 設定靜態檔案路由
app.use(express.static('public'));
app.set("views", "views/");
app.set("view engine", "ejs");

app.use('/', indexRouter);

const host = '0.0.0.0';
const port = process.env.PORT || 3009;

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, host, () => {
    console.log(`Server started on ${port}`);
  });
}

export default app;
