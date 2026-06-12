const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Item = require('../models/Item');
const User = require('../models/User');
const cloudinary = require('../config/cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// 절대 경로 사용
const uploadDir = path.join(__dirname, '..', 'public', 'uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const imageStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'mymarket-images',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp']
  }
});

const docStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: docStorage
});

const imageUpload = multer({
  storage: imageStorage
});

// 문서 파일 동시 업로드
const uploadFields = (req, res, next) => {

  imageUpload.single('image')(req, res, (err) => {

    if (err) return next(err);

    upload.single('docFile')(req, res, (err2) => {

      if (err2) return next(err2);

      const files = {};

      if (req.file) {
        files.docFile = [req.file];
      }

      if (req.files) {
        Object.assign(files, req.files);
      }

      req.files = files;

      next();
    });
  });
};

// 로그인 체크 미들웨어
function loginCheck(req, res, next) {
  if (!req.session.user) return res.redirect('/users/login');
  next();
}

// 전체 상품 목록 + 친구 최신 상품 3개
router.get('/', async (req, res) => {
  const items = await Item.find().sort({ createdAt: -1 });

  let friendItems = [];
  let myItems = [];

  if (req.session.user) {
    const me = await User.findOne({ 
      userId: req.session.user.userId 
    });

    // 내 상품 목록
    myItems = await Item.find({
      userId: req.session.user.userId
    }).sort({ createdAt: -1 });

    if (me && me.friends && me.friends.length > 0) {
      const friendPairs = me.friends.map((id, i) => ({
        userId: id,
        addedAt: me.friendAddedAt[i] || new Date(0)
      })).sort((a, b) => b.addedAt - a.addedAt);

      const recentFriendIds = friendPairs.map(f => f.userId);

      friendItems = await Item.find({
        userId: { $in: recentFriendIds }
      })
      .sort({ createdAt: -1 })
      .limit(3);
    }
  }

  res.render('index', { items, friendItems, myItems });
});

// 상품 등록 폼
router.get('/write', loginCheck, (req, res) => {
  res.render('write');
});

// 상품 등록 처리
router.post('/write', loginCheck, uploadFields, async (req, res) => {

  console.log('업로드 파일:', req.files);

  let { title, price, description } = req.body;

  const image = req.files?.image
    ? req.files.image[0].path
    : null;

  // txt 문서 첨부 처리
  if (req.files?.docFile) {

    const docPath = path.join(
      uploadDir,
      req.files.docFile[0].filename
    );

    try {
      const docContent = fs.readFileSync(docPath, 'utf-8');

      description = description
        ? description + '\n\n[첨부 문서 내용]\n' + docContent
        : '[첨부 문서 내용]\n' + docContent;

      fs.unlinkSync(docPath);

    } catch (e) {
      console.error('문서 읽기 오류:', e);
    }
  }

  await Item.create({
    userId: req.session.user.userId,
    title,
    price,
    description,
    image
  });

  res.redirect('/items');
});

// 상품 수정 폼
router.get('/edit/:id', loginCheck, async (req, res) => {

  const item = await Item.findById(req.params.id);

  if (item.userId !== req.session.user.userId) {
    return res.status(403).send('본인 상품만 수정할 수 있습니다.');
  }

  res.render('edit', { item });
});

// 상품 수정 처리
router.post('/edit/:id', loginCheck, uploadFields, async (req, res) => {

  const item = await Item.findById(req.params.id);

  if (item.userId !== req.session.user.userId) {
    return res.status(403).send('본인 상품만 수정할 수 있습니다.');
  }

  let { title, price, description } = req.body;

  const update = {
    title,
    price,
    description
  };

  if (req.files?.image) {
    update.image = req.files.image[0].path;
  }

  if (req.files?.docFile) {

    const docPath = path.join(
      uploadDir,
      req.files.docFile[0].filename
    );

    try {

      const docContent = fs.readFileSync(docPath, 'utf-8');

      update.description = description
        ? description + '\n\n[첨부 문서 내용]\n' + docContent
        : '[첨부 문서 내용]\n' + docContent;

      fs.unlinkSync(docPath);

    } catch (e) {
      console.error('문서 읽기 오류:', e);
    }
  }

  await Item.findByIdAndUpdate(req.params.id, update);

  res.redirect('/items/' + req.params.id);
});

// 상품 삭제
router.post('/delete/:id', loginCheck, async (req, res) => {

  const item = await Item.findById(req.params.id);

  if (item.userId !== req.session.user.userId) {
    return res.status(403).send('본인 상품만 삭제할 수 있습니다.');
  }

  await Item.findByIdAndDelete(req.params.id);

  res.redirect('/items');
});

// 상품 상세
router.get('/:id', async (req, res) => {
  const item = await Item.findById(req.params.id);
  res.render('detail', { item });
});

module.exports = router;