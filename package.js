{
  "name": "nature-plus",
  "version": "1.0.0",
  "description": "Nature+ - E-commerce avec paiement Wave",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "start:pay": "node server-pay.js",
    "dev": "nodemon server.js",
    "dev:pay": "nodemon server-pay.js"
  },
  "dependencies": {
    "axios": "^1.19.0",
    "bcrypt": "^6.0.0",
    "connect-sqlite3": "^0.9.16",
    "cors": "^2.8.6",
    "dotenv": "^17.4.2",
    "express": "^5.2.1",
    "express-session": "^1.18.1",
    "multer": "^2.2.0",
    "sqlite3": "^6.0.1"
  }
}
