const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const Item = require('../models/Item');

// multer 설정 (이미지 업로드)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'public/uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// 로그인 체크 미들웨어
function loginCheck(req, res, next) {
  if (!req.session.user) return res.redirect('/users/login');
  next();
}

// 전체 상품 목록
router.get('/', async (req, res) => {
  const items = await Item.find().sort({ createdAt: -1 });
  res.render('index', { items });
});

// 상품 등록 폼
router.get('/write', loginCheck, (req, res) => {
  res.render('write');
});

// 상품 등록 처리
router.post('/write', loginCheck, upload.single('image'), async (req, res) => {
  const { title, price, description } = req.body;
  const image = req.file ? '/uploads/' + req.file.filename : null;
  await Item.create({ userId: req.session.user.userId, title, price, description, image });
  res.redirect('/items');
});

// 상품 수정 폼
router.get('/edit/:id', loginCheck, async (req, res) => {
  const item = await Item.findById(req.params.id);
  // 본인 상품만 수정 가능
  if (item.userId !== req.session.user.userId) {
    return res.status(403).send('본인 상품만 수정할 수 있습니다.');
  }
  res.render('edit', { item });
});

// 상품 수정 처리
router.post('/edit/:id', loginCheck, upload.single('image'), async (req, res) => {
  const item = await Item.findById(req.params.id);
  // 본인 상품만 수정 가능
  if (item.userId !== req.session.user.userId) {
    return res.status(403).send('본인 상품만 수정할 수 있습니다.');
  }
  const { title, price, description } = req.body;
  const update = { title, price, description };
  if (req.file) update.image = '/uploads/' + req.file.filename;
  await Item.findByIdAndUpdate(req.params.id, update);
  res.redirect('/items/' + req.params.id);
});

// 상품 삭제
router.post('/delete/:id', loginCheck, async (req, res) => {
  const item = await Item.findById(req.params.id);
  // 본인 상품만 삭제 가능
  if (item.userId !== req.session.user.userId) {
    return res.status(403).send('본인 상품만 삭제할 수 있습니다.');
  }
  await Item.findByIdAndDelete(req.params.id);
  res.redirect('/items');
});

// 상품 상세 → 반드시 마지막에 위치
router.get('/:id', async (req, res) => {
  const item = await Item.findById(req.params.id);
  res.render('detail', { item });
});

module.exports = router;
