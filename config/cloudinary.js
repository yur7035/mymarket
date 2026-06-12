const { v2: cloudinary } = require('cloudinary');

cloudinary.config({
  cloud_name: process.env.dzbrxhug8,
  api_key: process.env.588243894324786,
  api_secret: process.env.ovKuApQMVaOmGdxU1lIxtHqHt2o
});

module.exports = cloudinary;