const express = require('express');
const router = express.Router();
const User = require('../models/User');

// 로그인 체크 미들웨어
function loginCheck(req, res, next) {
  if (!req.session.user) return res.redirect('/users/login');
  next();
}

// 회원가입 폼
router.get('/register', (req, res) => {
  res.render('register', { error: null });
});

// 회원가입 처리
router.post('/register', async (req, res) => {
  try {
    const { userId, password } = req.body;
    if (!userId || !password) {
      return res.render('register', { error: '아이디와 비밀번호를 모두 입력하세요.' });
    }
    const existingUser = await User.findOne({ userId });
    if (existingUser) {
      return res.render('register', { error: '이미 사용 중인 아이디입니다.' });
    }
    await User.create({ userId, password });
    res.redirect('/users/login');
  } catch (err) {
    console.error(err);
    res.render('register', { error: '회원가입 중 오류가 발생했습니다.' });
  }
});

// 로그인 폼
router.get('/login', (req, res) => {
  res.render('login', { error: null });
});

// 로그인 처리
router.post('/login', async (req, res) => {
  try {
    const { userId, password } = req.body;
    if (!userId || !password) {
      return res.render('login', { error: '아이디와 비밀번호를 모두 입력하세요.' });
    }
    const user = await User.findOne({ userId, password });
    if (!user) {
      return res.render('login', { error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
    }
    req.session.user = { id: user._id, userId: user.userId };
    res.redirect('/');
  } catch (err) {
    console.error(err);
    res.render('login', { error: '로그인 중 오류가 발생했습니다.' });
  }
});

// 로그아웃
router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// 친구 관리 페이지
router.get('/friends', loginCheck, async (req, res) => {
  const me = await User.findOne({ userId: req.session.user.userId });
  // 친구 목록을 추가된 순서 역순(최근 먼저)으로 정렬
  const friendPairs = (me.friends || []).map((id, i) => ({
    userId: id,
    addedAt: me.friendAddedAt[i] || new Date(0)
  })).sort((a, b) => b.addedAt - a.addedAt);
  res.render('friends', { friends: friendPairs, error: null, success: null });
});

// 친구 추가 처리
router.post('/friends/add', loginCheck, async (req, res) => {
  const { friendId } = req.body;
  const myUserId = req.session.user.userId;

  const renderResult = async (error, success) => {
    const me = await User.findOne({ userId: myUserId });
    const friendPairs = (me.friends || []).map((id, i) => ({
      userId: id,
      addedAt: me.friendAddedAt[i] || new Date(0)
    })).sort((a, b) => b.addedAt - a.addedAt);
    res.render('friends', { friends: friendPairs, error, success });
  };

  if (!friendId || friendId.trim() === '') {
    return renderResult('아이디를 입력하세요.', null);
  }
  if (friendId === myUserId) {
    return renderResult('자기 자신은 친구 추가할 수 없습니다.', null);
  }

  const target = await User.findOne({ userId: friendId });
  if (!target) {
    return renderResult('존재하지 않는 아이디입니다.', null);
  }

  const me = await User.findOne({ userId: myUserId });
  if (me.friends && me.friends.includes(friendId)) {
    return renderResult('이미 친구입니다.', null);
  }

  await User.updateOne(
    { userId: myUserId },
    { $push: { friends: friendId, friendAddedAt: new Date() } }
  );

  return renderResult(null, `${friendId} 님을 친구로 추가했습니다!`);
});

// 친구 삭제 처리
router.post('/friends/remove', loginCheck, async (req, res) => {
  const { friendId } = req.body;
  const myUserId = req.session.user.userId;
  const me = await User.findOne({ userId: myUserId });

  const idx = me.friends.indexOf(friendId);
  if (idx !== -1) {
    me.friends.splice(idx, 1);
    me.friendAddedAt.splice(idx, 1);
    await me.save();
  }
  res.redirect('/users/friends');
});

module.exports = router;
