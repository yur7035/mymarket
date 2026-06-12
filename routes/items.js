const express = require('express');
const router = express.Router();
const multer = require('multer');
const Item = require('../models/Item');
const User = require('../models/User');
const cloudinary = require('../config/cloudinary');

// 메모리에 받은 후 직접 cloudinary로 업로드
const upload = multer({ storage: multer.memoryStorage() });

const uploadFields = upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'document', maxCount: 1 }
]);

// 버퍼를 cloudinary에 업로드
function uploadToCloudinary(file, options) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
    stream.end(file.buffer);
  });
}

async function uploadImageIfExists(req) {
  if (req.files && req.files.image && req.files.image[0]) {
    const result = await uploadToCloudinary(req.files.image[0], {
      folder: 'mymarket-images'
    });
    return result.secure_url;
  }
  return null;
}

async function uploadDocumentIfExists(req) {
  if (req.files && req.files.document && req.files.document[0]) {
    const file = req.files.document[0];

    // 확장자 분리 (예: report.pdf -> base=report, ext=pdf)
    const originalName = file.originalname;
    const lastDot = originalName.lastIndexOf('.');
    const base = lastDot > -1 ? originalName.slice(0, lastDot) : originalName;
    const ext = lastDot > -1 ? originalName.slice(lastDot + 1) : '';

    // Cloudinary public_id로 쓸 수 없는 문자 제거 + 중복 방지용 타임스탬프
    const safeBase = base.replace(/[^a-zA-Z0-9가-힣_-]/g, '_');
    const publicId = `${safeBase}_${Date.now()}`;

    const result = await uploadToCloudinary(file, {
      folder: 'mymarket-documents',
      resource_type: 'raw',
      type: 'upload',
      public_id: publicId,
      format: ext || undefined
    });
    return result.secure_url;
  }
  return null;
}

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

      const image = await uploadImageIfExists(req);
      const document = await uploadDocumentIfExists(req);

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

      const newImage = await uploadImageIfExists(req);
      if (newImage) {
        update.image = newImage;
      }

      const newDocument = await uploadDocumentIfExists(req);
      if (newDocument) {
        update.document = newDocument;
      }

      await Item.findByIdAndUpdate(
        req.params.id,
        update
      );

      res.redirect('/items/' + req.params.id);

    } catch (err) {

      console.error('=== /items/edit 에러 ===');
      console.error('message:', err.message);
      console.error('stack:', err.stack);
      res.status(500).send('상품 수정 중 오류 발생: ' + err.message);
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