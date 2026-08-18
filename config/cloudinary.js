const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary-v2');
const multer = require('multer');

// Configuration Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'mntaohf8',
    api_key: process.env.CLOUDINARY_API_KEY || '356219589835121',
    api_secret: process.env.CLOUDINARY_API_SECRET || 'DtInJyO75sPdqCjjzxENNCASRJI',
});

// Configuration du stockage
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'Nature_Plus_Uploads',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
        public_id: (req, file) => `${Date.now()}-${file.originalname.split('.')[0]}`,
    },
});

// Middleware multer
const upload = multer({ storage: storage });

module.exports = { cloudinary, upload };