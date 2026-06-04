const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const path = require('path');
const dns = require('dns');

const usersRouter = require('./routes/users');

const app = express();

dns.setServers(['8.8.8.8', '1.1.1.1']);

// MongoDB 연결
mongoose.connect(process.env.MONGODB_URI)
.then(() => console.log('MongoDB 연결 성공'))
.catch(err => console.log(err));

// 미들웨어
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 세션
app.use(session({
  secret: 'mymarket-secret',
  resave: false,
  saveUninitialized: false
}));

// 로그인 유저 정보 모든 뷰에서 사용 가능하게 설정
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

// 사용자 라우터
app.use('/users', usersRouter);

// 시작 페이지
app.get('/', (req, res) => {
  res.render('index');
});

app.listen(9930, () => {
  console.log('서버 실행 중: http://localhost:9930');
});
