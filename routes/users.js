const express = require('express');
const router = express.Router();
const User = require('../models/User');
const FriendRequest = require('../models/FriendRequest');

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
      return res.render('register', {
        error: '아이디와 비밀번호를 모두 입력하세요.'
      });
    }

    const existingUser = await User.findOne({ userId });

    if (existingUser) {
      return res.render('register', {
        error: '이미 사용 중인 아이디입니다.'
      });
    }

    await User.create({ userId, password });

    res.redirect('/users/login');

  } catch (err) {
    console.error(err);

    res.render('register', {
      error: '회원가입 중 오류가 발생했습니다.'
    });
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
      return res.render('login', {
        error: '아이디와 비밀번호를 모두 입력하세요.'
      });
    }

    const user = await User.findOne({
      userId,
      password
    });

    if (!user) {
      return res.render('login', {
        error: '아이디 또는 비밀번호가 올바르지 않습니다.'
      });
    }

    req.session.user = {
      id: user._id,
      userId: user.userId
    };

    res.redirect('/');

  } catch (err) {
    console.error(err);

    res.render('login', {
      error: '로그인 중 오류가 발생했습니다.'
    });
  }
});

// 로그아웃
router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// 친구 관리 페이지
router.get('/friends', loginCheck, async (req, res) => {

  const me = await User.findOne({
    userId: req.session.user.userId
  });

  const friendPairs = (me.friends || [])
    .map((id, i) => ({
      userId: id,
      addedAt: me.friendAddedAt[i] || new Date(0)
    }))
    .sort((a, b) => b.addedAt - a.addedAt);

  const requests = await FriendRequest.find({
    receiver: req.session.user.userId,
    status: 'pending'
  });

  console.log('현재 로그인 유저:', req.session.user.userId);
  console.log('받은 친구신청:', requests);

  res.render('friends', {
    friends: friendPairs,
    requests,
    error: null,
    success: null
  });

});

// 친구 신청
router.post('/friends/add', loginCheck, async (req, res) => {

  const { friendId } = req.body;
  const myUserId = req.session.user.userId;

  const renderResult = async (error, success) => {

    const me = await User.findOne({
      userId: myUserId
    });

    const friendPairs = (me.friends || [])
      .map((id, i) => ({
        userId: id,
        addedAt: me.friendAddedAt[i] || new Date(0)
      }))
      .sort((a, b) => b.addedAt - a.addedAt);

    const requests = await FriendRequest.find({
      receiver: myUserId,
      status: 'pending'
    });

    res.render('friends', {
      friends: friendPairs,
      requests,
      error,
      success
    });
  };

  if (!friendId || friendId.trim() === '') {
    return renderResult('아이디를 입력하세요.', null);
  }

  if (friendId === myUserId) {
    return renderResult('자기 자신에게 신청할 수 없습니다.', null);
  }

  const target = await User.findOne({
    userId: friendId
  });

  if (!target) {
    return renderResult('존재하지 않는 사용자입니다.', null);
  }

  const me = await User.findOne({
    userId: myUserId
  });

  if (me.friends.includes(friendId)) {
    return renderResult('이미 친구입니다.', null);
  }

  const alreadySent = await FriendRequest.findOne({
    sender: myUserId,
    receiver: friendId,
    status: 'pending'
  });

  if (alreadySent) {
    return renderResult('이미 친구 신청을 보냈습니다.', null);
  }

  const alreadyReceived = await FriendRequest.findOne({
    sender: friendId,
    receiver: myUserId,
    status: 'pending'
  });

  if (alreadyReceived) {
    return renderResult(
      '상대방이 이미 친구 신청을 보냈습니다. 받은 신청을 수락해주세요.',
      null
    );
  }

  await FriendRequest.create({
    sender: myUserId,
    receiver: friendId
  });

  return renderResult(
    null,
    '친구 신청을 보냈습니다.'
  );
});

// 친구 신청 수락
router.post('/friends/accept/:id', loginCheck, async (req, res) => {

  const request = await FriendRequest.findById(req.params.id);

  if (!request) {
    return res.redirect('/users/friends');
  }

  if (request.status !== 'pending') {
    return res.redirect('/users/friends');
  }

  const now = new Date();

  const senderUser = await User.findOne({
    userId: request.sender
  });

  const receiverUser = await User.findOne({
    userId: request.receiver
  });

  if (
    senderUser &&
    !senderUser.friends.includes(request.receiver)
  ) {
    senderUser.friends.push(request.receiver);
    senderUser.friendAddedAt.push(now);
    await senderUser.save();
  }

  if (
    receiverUser &&
    !receiverUser.friends.includes(request.sender)
  ) {
    receiverUser.friends.push(request.sender);
    receiverUser.friendAddedAt.push(now);
    await receiverUser.save();
  }

  request.status = 'accepted';
  await request.save();

  res.redirect('/users/friends');
});

// 친구 신청 거절
router.post('/friends/reject/:id', loginCheck, async (req, res) => {

  await FriendRequest.findByIdAndUpdate(
    req.params.id,
    {
      status: 'rejected'
    }
  );

  res.redirect('/users/friends');
});

// 친구 삭제 (양방향)
router.post('/friends/remove', loginCheck, async (req, res) => {

  const { friendId } = req.body;
  const myUserId = req.session.user.userId;

  const me = await User.findOne({
    userId: myUserId
  });

  const friend = await User.findOne({
    userId: friendId
  });

  if (me) {

    const idx = me.friends.indexOf(friendId);

    if (idx !== -1) {
      me.friends.splice(idx, 1);
      me.friendAddedAt.splice(idx, 1);
      await me.save();
    }
  }

  if (friend) {

    const idx = friend.friends.indexOf(myUserId);

    if (idx !== -1) {
      friend.friends.splice(idx, 1);
      friend.friendAddedAt.splice(idx, 1);
      await friend.save();
    }
  }

  res.redirect('/users/friends');
});

module.exports = router;