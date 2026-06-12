const express = require('express');
const router = express.Router();
const multer = require('multer');
const Item = require('../models/Item');
const User = require('../models/User');
const cloudinary = require('../config/cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// 필드명(image/document)에 따라 다른 Cloudinary 설정을 적용하는 단일 storage
const combinedStorage = new CloudinaryStorage({
  cloudinary,
  params: (req, file) => {
    if (file.fieldname === 'document') {
      return {
        folder: 'mymarket-documents',
        resource_type: 'raw',
        allowed_formats: ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt', 'zip']
      };
    }
    return {
      folder: 'mymarket-images',
      allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp']
    };
  }
});

const upload = multer({ storage: combinedStorage });

// 이미지 + 문서 동시 업로드 처리
const uploadFields = upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'document', maxCount: 1 }
]);

// 로그인 체크
function loginCheck(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/users/login');
  }
  next();
}

// 메인 페이지
router.get('/', loginCheck, async (req, res) => {

  const items = await Item.find().sort({
    createdAt: -1
  });

  let friendItems = [];
  let myItems = [];

  const me = await User.findOne({
    userId: req.session.user.userId
  });

  myItems = await Item.find({
    userId: req.session.user.userId
  }).sort({
    createdAt: -1
  });

  if (me && me.friends && me.friends.length > 0) {

    const friendPairs = me.friends.map((id, i) => ({
      userId: id,
      addedAt: me.friendAddedAt[i] || new Date(0)
    }))
    .sort((a, b) => b.addedAt - a.addedAt);

    const recentFriendIds = friendPairs.map(f => f.userId);

    friendItems = await Item.find({
      userId: {
        $in: recentFriendIds
      }
    })
    .sort({
      createdAt: -1
    })
    .limit(3);
  }

  res.render('index', {
    items,
    friendItems,
    myItems
  });
});

// 상품 등록 페이지
router.get('/write', loginCheck, (req, res) => {
  res.render('write');
});

// 상품 등록
router.post(
  '/write',
  loginCheck,
  uploadFields,
  async (req, res) => {

    try {

      const {
        title,
        price,
        description
      } = req.body;

      const image = req.files && req.files.image
        ? req.files.image[0].path
        : null;

      const document = req.files && req.files.document
        ? req.files.document[0].path
        : null;

      await Item.create({
        userId: req.session.user.userId,
        title,
        price,
        description,
        image,
        document
      });

      res.redirect('/items');

    } catch (err) {

      console.error('=== /items/write 에러 ===');
      console.error('message:', err.message);
      console.error('name:', err.name);
      console.error('stack:', err.stack);
      res.status(500).send('상품 등록 중 오류 발생: ' + err.message);
    }
  }
);

// 상품 수정 페이지
router.get('/edit/:id', loginCheck, async (req, res) => {

  const item = await Item.findById(req.params.id);

  if (!item) {
    return res.redirect('/items');
  }

  if (item.userId !== req.session.user.userId) {
    return res.status(403).send('본인 상품만 수정할 수 있습니다.');
  }

  res.render('edit', {
    item
  });
});

// 상품 수정
router.post(
  '/edit/:id',
  loginCheck,
  uploadFields,
  async (req, res) => {

    try {

      const item = await Item.findById(req.params.id);

      if (!item) {
        return res.redirect('/items');
      }

      if (item.userId !== req.session.user.userId) {
        return res.status(403).send('본인 상품만 수정할 수 있습니다.');
      }

      const {
        title,
        price,
        description
      } = req.body;

      const update = {
        title,
        price,
        description
      };

      if (req.files && req.files.image) {
        update.image = req.files.image[0].path;
      }

      if (req.files && req.files.document) {
        update.document = req.files.document[0].path;
      }

      await Item.findByIdAndUpdate(
        req.params.id,
        update
      );

      res.redirect('/items/' + req.params.id);

    } catch (err) {

      console.error(err);
      res.status(500).send('상품 수정 중 오류 발생');
    }
  }
);

// 상품 삭제
router.post('/delete/:id', loginCheck, async (req, res) => {

  const item = await Item.findById(req.params.id);

  if (!item) {
    return res.redirect('/items');
  }

  if (item.userId !== req.session.user.userId) {
    return res.status(403).send('본인 상품만 삭제할 수 있습니다.');
  }

  await Item.findByIdAndDelete(req.params.id);

  res.redirect('/items');
});

// 상품 상세
router.get('/:id', async (req, res) => {

  const item = await Item.findById(req.params.id);

  if (!item) {
    return res.redirect('/items');
  }

  res.render('detail', {
    item
  });
});

module.exports = router;