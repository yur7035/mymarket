const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  friends: [{ type: String }],         // 친구 userId 목록
  friendAddedAt: [{ type: Date }],     // 친구 추가 시각 목록 (friends 배열과 인덱스 대응)
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
