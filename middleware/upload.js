// middleware/upload.js
const multer = require("multer");
const { GridFsStorage } = require("multer-gridfs-storage");

const storage = new GridFsStorage({
  url: process.env.MONGO_URI,
  file: (req, file) => ({
    filename: file.originalname,
    bucketName: "uploads",
  }),
});

const upload = multer({ storage });

module.exports = upload;
