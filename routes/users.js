const express = require('express');
const router = express.Router();
const User = require('../models/User');

// 회원가입 폼
router.get('/register', (req, res) => {
  res.render('register', { error: null });
});

// 회원가입 처리: DB에 사용자 저장
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

// 로그인 처리: 세션에 사용자 정보 저장
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

    req.session.user = {
      id: user._id,
      userId: user.userId
    };

    res.redirect('/');
  } catch (err) {
    console.error(err);
    res.render('login', { error: '로그인 중 오류가 발생했습니다.' });
  }
});

// 로그아웃: 세션 삭제
router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

module.exports = router;
