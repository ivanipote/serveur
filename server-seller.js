// ========================================================
// SERVEUR VENDEUR - NATURE+ / COMPLUS
// Version complète avec stockage des coordonnées GPS
// ========================================================

// ✅ FORCER LE FUSEAU HORAIRE À UTC+0 (Côte d'Ivoire)
process.env.TZ = 'Africa/Abidjan';

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const Redis = require('ioredis');
const { createAdapter } = require('@socket.io/redis-adapter');
const path = require('path');
const bcrypt = require('bcrypt');
const session = require('express-session');
const pg = require('pg');
const PgSession = require('connect-pg-simple')(session);
const db = require('./database');
const jwt = require('jsonwebtoken');
const cors = require('cors');

// ========================================================
// CLOUDINARY - Configuration
// ========================================================

const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary-v2');
const multer = require('multer');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'mntaohf8',
    api_key: process.env.CLOUDINARY_API_KEY || '356219589835121',
    api_secret: process.env.CLOUDINARY_API_SECRET || 'DtInJyO75sPdqCjjzxENNCASRJI',
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'seller_products',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
        public_id: (req, file) => `product_${Date.now()}_${file.originalname.split('.')[0]}`,
    },
});

const shopStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'seller_shops',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
        public_id: (req, file) => `shop_${Date.now()}_${file.originalname.split('.')[0]}`,
    },
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 2 * 1024 * 1024 } // 2MB
});

const uploadShop = multer({ 
    storage: shopStorage,
    limits: { fileSize: 2 * 1024 * 1024 }
});

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3006;

// ========================================================
// REDIS - Connexion
// ========================================================

const redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    tls: process.env.REDIS_URL ? { rejectUnauthorized: false } : undefined,
    retryStrategy: (times) => Math.min(times * 50, 2000)
});

redisClient.on('connect', () => console.log('✅ Redis (seller) connecté'));
redisClient.on('error', (err) => console.error('❌ Redis seller erreur:', err));

const pubClient = redisClient.duplicate();
const subClient = redisClient.duplicate();

// ========================================================
// SOCKET.IO
// ========================================================

const io = new Server(server, {
    cors: {
        origin: [
            'https://nature-plus-client.onrender.com',
            'https://nature-plus-pay.onrender.com',
            'https://nature-plus-seller.onrender.com',
            'http://localhost:3000',
            'http://localhost:3001',
            'http://localhost:3002',
            'http://localhost:3006'
        ],
        credentials: true
    },
    adapter: createAdapter(pubClient, subClient)
});

io.use((socket, next) => {
    const sellerId = socket.handshake.auth.sellerId;
    if (sellerId) {
        socket.sellerId = sellerId;
        next();
    } else {
        next(new Error('Authentication required'));
    }
});

io.on('connection', (socket) => {
    const sellerId = socket.sellerId;
    if (sellerId) {
        socket.join(`seller_${sellerId}`);
        console.log(`✅ Vendeur ${sellerId} connecté via Socket.IO`);
    }

    socket.on('disconnect', () => {
        console.log(`❌ Vendeur ${socket.sellerId} déconnecté`);
    });
});

global.io = io;

// ========================================================
// MIDDLEWARE
// ========================================================

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/seller', express.static(path.join(__dirname, 'public', 'seller')));

// CORS
app.use((req, res, next) => {
    const allowedOrigins = [
        'https://nature-plus-client.onrender.com',
        'https://nature-plus-pay.onrender.com',
        'https://nature-plus-seller.onrender.com',
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:3002',
        'http://localhost:3006'
    ];
    
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
        res.setHeader('Access-Control-Allow-Origin', '*');
    }
    
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// ========================================================
// SESSIONS
// ========================================================

const pgPool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000
});

app.use(session({
    store: new PgSession({
        pool: pgPool,
        tableName: 'session'
    }),
    secret: process.env.SESSION_SECRET || 'seller-super-secret-key-2026',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
    }
}));

// ========================================================
// JWT
// ========================================================

function generateToken(sellerId) {
    return jwt.sign(
        { sellerId },
        process.env.JWT_SECRET || 'seller-jwt-secret-2026',
        { expiresIn: '7d' }
    );
}

function verifyToken(token) {
    try {
        return jwt.verify(token, process.env.JWT_SECRET || 'seller-jwt-secret-2026');
    } catch (error) {
        return null;
    }
}

// ========================================================
// MIDDLEWARE : AUTH SELLER
// ========================================================

async function isAuthenticatedSeller(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1] || req.query.token || req.body.token;
    
    if (token) {
        const decoded = verifyToken(token);
        if (decoded) {
            const seller = await db.get('SELECT * FROM sellers WHERE id = $1', [decoded.sellerId]);
            if (seller) {
                req.seller = seller;
                return next();
            }
        }
    }
    
    if (req.session && req.session.sellerId) {
        const seller = await db.get('SELECT * FROM sellers WHERE id = $1', [req.session.sellerId]);
        if (seller) {
            req.seller = seller;
            return next();
        }
    }
    
    res.status(401).json({ error: 'Non authentifié' });
}

// ========================================================
// ROUTE HEALTH
// ========================================================

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', service: 'seller' });
});

// ========================================================
// ROUTES : INSCRIPTION / CONNEXION
// ========================================================

app.post('/api/seller/register', async (req, res) => {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password || !phone) {
        return res.status(400).json({ error: 'Tous les champs sont requis.' });
    }

    if (password.length !== 4 || !/^\d{4}$/.test(password)) {
        return res.status(400).json({ error: 'Le mot de passe doit être un code à 4 chiffres.' });
    }

    try {
        const existing = await db.get('SELECT * FROM sellers WHERE email = $1', [email]);
        if (existing) {
            return res.status(400).json({ error: 'Cet email est déjà utilisé.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await db.query(
            `INSERT INTO sellers (name, email, password, phone, status)
             VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [name, email, hashedPassword, phone, 'pending']
        );

        const sellerId = result.rows[0].id;
        const token = generateToken(sellerId);

        req.session.sellerId = sellerId;

        res.json({
            success: true,
            message: 'Inscription réussie, en attente de validation',
            sellerId: sellerId,
            token: token,
            seller: {
                id: sellerId,
                name: name,
                email: email,
                phone: phone,
                status: 'pending'
            }
        });

    } catch (error) {
        console.error('❌ Erreur inscription vendeur:', error);
        res.status(500).json({ error: 'Erreur lors de l\'inscription.' });
    }
});

app.post('/api/seller/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email et mot de passe requis.' });
    }

    try {
        const seller = await db.get('SELECT * FROM sellers WHERE email = $1', [email]);

        if (!seller) {
            return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
        }

        const isValid = await bcrypt.compare(password, seller.password);
        if (!isValid) {
            return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
        }

        const token = generateToken(seller.id);

        req.session.sellerId = seller.id;

        res.json({
            success: true,
            message: 'Connexion réussie',
            token: token,
            seller: {
                id: seller.id,
                name: seller.name,
                email: seller.email,
                phone: seller.phone,
                status: seller.status
            }
        });

    } catch (error) {
        console.error('❌ Erreur connexion vendeur:', error);
        res.status(500).json({ error: 'Erreur lors de la connexion.' });
    }
});

app.post('/api/seller/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Erreur lors de la déconnexion.' });
        }
        res.json({ success: true, message: 'Déconnecté' });
    });
});

app.get('/api/seller/me', isAuthenticatedSeller, async (req, res) => {
    res.json({
        success: true,
        seller: req.seller
    });
});

// ========================================================
// ROUTES : BOUTIQUES (AVEC COORDONNÉES)
// ========================================================

// Créer une boutique
app.post('/api/seller/shop', isAuthenticatedSeller, uploadShop.single('image'), async (req, res) => {
    const { name, location, description, flex1, flex2 } = req.body;
    const sellerId = req.seller.id;

    if (!name || !location) {
        return res.status(400).json({ error: 'Nom et localisation requis.' });
    }

    try {
        const count = await db.get('SELECT COUNT(*) as count FROM shops WHERE seller_id = $1', [sellerId]);
        if (count && count.count >= 5) {
            return res.status(400).json({ error: 'Vous avez atteint la limite de 5 boutiques.' });
        }

        const imageUrl = req.file ? req.file.path : null;

        // ✅ Stocker les coordonnées dans flex1 et flex2
        const latitude = flex1 || null;
        const longitude = flex2 || null;

        console.log('📍 Coordonnées stockées:', { latitude, longitude });

        const result = await db.query(
            `INSERT INTO shops (seller_id, name, location, description, logo, status, flex1, flex2)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
            [sellerId, name, location, description || null, imageUrl, 'active', latitude, longitude]
        );

        const shopId = result.rows[0].id;

        res.json({
            success: true,
            message: 'Boutique créée avec succès',
            shopId: shopId,
            shop: {
                id: shopId,
                name: name,
                location: location,
                description: description,
                logo: imageUrl,
                status: 'active',
                latitude: latitude,
                longitude: longitude
            }
        });

    } catch (error) {
        console.error('❌ Erreur création boutique:', error);
        res.status(500).json({ error: 'Erreur lors de la création de la boutique.' });
    }
});

// Récupérer toutes les boutiques d'un vendeur
app.get('/api/seller/shops', isAuthenticatedSeller, async (req, res) => {
    const sellerId = req.seller.id;

    try {
        const shops = await db.all(`
            SELECT s.*, 
                   (SELECT COUNT(*) FROM seller_products WHERE shop_id = s.id) as product_count
            FROM shops s
            WHERE s.seller_id = $1
            ORDER BY s.created_at DESC
        `, [sellerId]);

        res.json({
            success: true,
            shops: shops || []
        });

    } catch (error) {
        console.error('❌ Erreur récupération boutiques:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des boutiques.' });
    }
});

// Récupérer une boutique spécifique (publique) AVEC COORDONNÉES
app.get('/api/seller/shop/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const shop = await db.get(`
            SELECT s.*, 
                   (SELECT name FROM sellers WHERE id = s.seller_id) as seller_name,
                   (SELECT phone FROM sellers WHERE id = s.seller_id) as seller_phone,
                   (SELECT COUNT(*) FROM seller_likes WHERE shop_id = s.id) as total_likes
            FROM shops s
            WHERE s.id = $1 AND s.status = 'active'
        `, [id]);

        if (!shop) {
            return res.status(404).json({ error: 'Boutique non trouvée.' });
        }

        const products = await db.all(
            'SELECT * FROM seller_products WHERE shop_id = $1 ORDER BY created_at DESC',
            [id]
        );

        await db.query(
            `INSERT INTO seller_stats (seller_id, shop_id, total_views, updated_at)
             VALUES ($1, $2, 1, NOW())
             ON CONFLICT (shop_id) 
             DO UPDATE SET total_views = seller_stats.total_views + 1, updated_at = NOW()`,
            [shop.seller_id, id]
        );

        const views = await db.get('SELECT total_views FROM seller_stats WHERE shop_id = $1', [id]);

        res.json({
            success: true,
            shop: {
                ...shop,
                total_views: views?.total_views || 0,
                latitude: shop.flex1 || null,
                longitude: shop.flex2 || null
            },
            products: products || []
        });

    } catch (error) {
        console.error('❌ Erreur détail boutique:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération de la boutique.' });
    }
});

// Modifier sa boutique
app.put('/api/seller/shop', isAuthenticatedSeller, uploadShop.single('image'), async (req, res) => {
    const { name, location, description, flex1, flex2 } = req.body;
    const sellerId = req.seller.id;

    try {
        const shop = await db.get('SELECT * FROM shops WHERE seller_id = $1', [sellerId]);

        if (!shop) {
            return res.status(404).json({ error: 'Boutique non trouvée.' });
        }

        let imageUrl = shop.logo;
        if (req.file) {
            imageUrl = req.file.path;
        }

        const latitude = flex1 || shop.flex1 || null;
        const longitude = flex2 || shop.flex2 || null;

        await db.query(
            `UPDATE shops 
             SET name = $1, location = $2, description = $3, logo = $4, flex1 = $5, flex2 = $6
             WHERE id = $7`,
            [name || shop.name, location || shop.location, description || shop.description, imageUrl, latitude, longitude, shop.id]
        );

        const updatedShop = await db.get('SELECT * FROM shops WHERE id = $1', [shop.id]);

        res.json({
            success: true,
            message: 'Boutique mise à jour',
            shop: updatedShop
        });

    } catch (error) {
        console.error('❌ Erreur modification boutique:', error);
        res.status(500).json({ error: 'Erreur lors de la modification de la boutique.' });
    }
});

// ========================================================
// ROUTES : PRODUITS
// ========================================================

// Ajouter un produit avec images
app.post('/api/seller/product', isAuthenticatedSeller, upload.fields([
    { name: 'image1', maxCount: 1 },
    { name: 'image2', maxCount: 1 },
    { name: 'image3', maxCount: 1 }
]), async (req, res) => {
    
    console.log('📦 Body reçu:', req.body);
    console.log('📦 Files reçus:', req.files);

    const { name, price, description, stock, category, shop_id } = req.body;
    const sellerId = req.seller.id;

    if (!name || !price) {
        return res.status(400).json({ error: 'Nom et prix requis.' });
    }

    if (!shop_id) {
        return res.status(400).json({ error: 'shop_id requis.' });
    }

    try {
        const shop = await db.get('SELECT * FROM shops WHERE id = $1 AND seller_id = $2', [shop_id, sellerId]);

        if (!shop) {
            return res.status(404).json({ error: 'Boutique non trouvée ou non autorisée.' });
        }

        const image1 = req.files?.image1?.[0]?.path || null;
        const image2 = req.files?.image2?.[0]?.path || null;
        const image3 = req.files?.image3?.[0]?.path || null;

        console.log('🖼️ image1:', image1);
        console.log('🖼️ image2:', image2);
        console.log('🖼️ image3:', image3);

        const result = await db.query(
            `INSERT INTO seller_products (shop_id, seller_id, name, price, image1, image2, image3, description, stock, category)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
            [shop_id, sellerId, name, price, image1, image2, image3, description || null, stock || 0, category || null]
        );

        console.log('✅ Produit ajouté avec images:', { image1, image2, image3 });

        res.json({
            success: true,
            message: 'Produit ajouté avec succès',
            productId: result.rows[0].id
        });

    } catch (error) {
        console.error('❌ Erreur ajout produit:', error);
        res.status(500).json({ error: 'Erreur lors de l\'ajout du produit.', details: error.message });
    }
});

// Modifier un produit
app.put('/api/seller/product/:id', isAuthenticatedSeller, upload.fields([
    { name: 'image1', maxCount: 1 },
    { name: 'image2', maxCount: 1 },
    { name: 'image3', maxCount: 1 }
]), async (req, res) => {
    const { id } = req.params;
    const { name, price, description, stock, category, shop_id } = req.body;
    const sellerId = req.seller.id;

    if (!name || !price) {
        return res.status(400).json({ error: 'Nom et prix requis.' });
    }

    if (!shop_id) {
        return res.status(400).json({ error: 'shop_id requis.' });
    }

    try {
        const product = await db.get(
            'SELECT * FROM seller_products WHERE id = $1 AND shop_id = $2 AND seller_id = $3',
            [id, shop_id, sellerId]
        );

        if (!product) {
            return res.status(404).json({ error: 'Produit non trouvé ou non autorisé.' });
        }

        const image1 = req.files?.image1?.[0]?.path || product.image1 || null;
        const image2 = req.files?.image2?.[0]?.path || product.image2 || null;
        const image3 = req.files?.image3?.[0]?.path || product.image3 || null;

        await db.query(
            `UPDATE seller_products 
             SET name = $1, price = $2, image1 = $3, image2 = $4, image3 = $5,
                 description = $6, stock = $7, category = $8
             WHERE id = $9`,
            [name, price, image1, image2, image3, description || product.description, stock || 0, category || null, id]
        );

        const updated = await db.get('SELECT * FROM seller_products WHERE id = $1', [id]);

        res.json({
            success: true,
            message: 'Produit modifié avec succès',
            product: updated
        });

    } catch (error) {
        console.error('❌ Erreur modification produit:', error);
        res.status(500).json({ error: 'Erreur lors de la modification du produit.' });
    }
});

// Supprimer un produit
app.delete('/api/seller/product/:id', isAuthenticatedSeller, async (req, res) => {
    const { id } = req.params;
    const { shop_id } = req.query;
    const sellerId = req.seller.id;

    if (!shop_id) {
        return res.status(400).json({ error: 'shop_id requis.' });
    }

    try {
        const product = await db.get(
            'SELECT * FROM seller_products WHERE id = $1 AND shop_id = $2 AND seller_id = $3',
            [id, shop_id, sellerId]
        );

        if (!product) {
            return res.status(404).json({ error: 'Produit non trouvé ou non autorisé.' });
        }

        await db.query('DELETE FROM seller_products WHERE id = $1', [id]);

        res.json({
            success: true,
            message: 'Produit supprimé avec succès'
        });

    } catch (error) {
        console.error('❌ Erreur suppression produit:', error);
        res.status(500).json({ error: 'Erreur lors de la suppression du produit.' });
    }
});

// Récupérer les produits d'une boutique (public)
app.get('/api/seller/products/:shopId', async (req, res) => {
    const { shopId } = req.params;

    try {
        const products = await db.all(
            'SELECT * FROM seller_products WHERE shop_id = $1 ORDER BY created_at DESC',
            [shopId]
        );

        res.json({
            success: true,
            products: products || []
        });

    } catch (error) {
        console.error('❌ Erreur récupération produits:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des produits.' });
    }
});

// ========================================================
// ROUTES : LIKES
// ========================================================

app.post('/api/seller/like/:shopId', isAuthenticatedSeller, async (req, res) => {
    const { shopId } = req.params;
    const userId = req.seller.id;

    try {
        const shop = await db.get('SELECT * FROM shops WHERE id = $1', [shopId]);

        if (!shop) {
            return res.status(404).json({ error: 'Boutique non trouvée.' });
        }

        const existing = await db.get(
            'SELECT * FROM seller_likes WHERE shop_id = $1 AND user_id = $2',
            [shopId, userId]
        );

        let liked = false;

        if (existing) {
            await db.query(
                'DELETE FROM seller_likes WHERE shop_id = $1 AND user_id = $2',
                [shopId, userId]
            );
            liked = false;
        } else {
            await db.query(
                'INSERT INTO seller_likes (seller_id, shop_id, user_id) VALUES ($1, $2, $3)',
                [shop.seller_id, shopId, userId]
            );
            liked = true;
        }

        const likeCount = await db.get(
            'SELECT COUNT(*) as count FROM seller_likes WHERE shop_id = $1',
            [shopId]
        );

        await db.query(
            `INSERT INTO seller_stats (seller_id, shop_id, total_likes, updated_at)
             VALUES ($1, $2, $3, NOW())
             ON CONFLICT (shop_id) 
             DO UPDATE SET total_likes = $3, updated_at = NOW()`,
            [shop.seller_id, shopId, likeCount.count]
        );

        res.json({
            success: true,
            liked: liked,
            total_likes: parseInt(likeCount.count)
        });

    } catch (error) {
        console.error('❌ Erreur like:', error);
        res.status(500).json({ error: 'Erreur lors du like.' });
    }
});

app.get('/api/seller/likes/:shopId', async (req, res) => {
    const { shopId } = req.params;

    try {
        const likeCount = await db.get(
            'SELECT COUNT(*) as count FROM seller_likes WHERE shop_id = $1',
            [shopId]
        );

        res.json({
            success: true,
            shop_id: parseInt(shopId),
            total_likes: parseInt(likeCount?.count || 0)
        });

    } catch (error) {
        console.error('❌ Erreur récupération likes:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des likes.' });
    }
});

// ========================================================
// ROUTES : STATISTIQUES
// ========================================================

app.get('/api/seller/stats', isAuthenticatedSeller, async (req, res) => {
    const sellerId = req.seller.id;

    try {
        const shopDetails = await db.all(`
            SELECT 
                s.id,
                s.name,
                s.location,
                s.status,
                (SELECT COUNT(*) FROM seller_products WHERE shop_id = s.id) as total_products,
                (SELECT COUNT(*) FROM seller_likes WHERE shop_id = s.id) as total_likes,
                (SELECT COUNT(*) FROM seller_messages WHERE shop_id = s.id) as total_messages,
                (SELECT total_views FROM seller_stats WHERE shop_id = s.id) as total_views
            FROM shops s
            WHERE s.seller_id = $1
        `, [sellerId]);

        const totalProducts = await db.get(
            'SELECT COUNT(*) as count FROM seller_products WHERE seller_id = $1',
            [sellerId]
        );

        const totalLikes = await db.get(
            'SELECT COUNT(*) as count FROM seller_likes WHERE seller_id = $1',
            [sellerId]
        );

        const totalMessages = await db.get(
            'SELECT COUNT(*) as count FROM seller_messages WHERE seller_id = $1',
            [sellerId]
        );

        res.json({
            success: true,
            stats: {
                total_shops: shopDetails.length,
                total_products: parseInt(totalProducts?.count || 0),
                total_likes: parseInt(totalLikes?.count || 0),
                total_messages: parseInt(totalMessages?.count || 0),
                shop_details: shopDetails || []
            }
        });

    } catch (error) {
        console.error('❌ Erreur statistiques:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des statistiques.' });
    }
});

// Supprimer une boutique
app.delete('/api/seller/shop', isAuthenticatedSeller, async (req, res) => {
    const { shop_id } = req.query;
    const sellerId = req.seller.id;

    if (!shop_id) {
        return res.status(400).json({ error: 'shop_id requis.' });
    }

    try {
        const shop = await db.get('SELECT * FROM shops WHERE id = $1 AND seller_id = $2', [shop_id, sellerId]);

        if (!shop) {
            return res.status(404).json({ error: 'Boutique non trouvée ou non autorisée.' });
        }

        // Supprimer la boutique (les produits sont supprimés en cascade)
        await db.query('DELETE FROM shops WHERE id = $1', [shop_id]);

        res.json({
            success: true,
            message: 'Boutique supprimée avec succès'
        });

    } catch (error) {
        console.error('❌ Erreur suppression boutique:', error);
        res.status(500).json({ error: 'Erreur lors de la suppression de la boutique.' });
    }
});

// Mettre à jour le profil du vendeur
app.put('/api/seller/me', isAuthenticatedSeller, async (req, res) => {
    const { name, email, phone, flex1, flex2, flex3, flex4, flex5, flex6, flex7 } = req.body;
    const sellerId = req.seller.id;

    try {
        await db.query(
            `UPDATE sellers 
             SET name = $1, email = $2, phone = $3, 
                 flex1 = $4, flex2 = $5, flex3 = $6, flex4 = $7, flex5 = $8, flex6 = $9, flex7 = $10
             WHERE id = $11`,
            [name, email, phone, flex1, flex2, flex3, flex4, flex5, flex6, flex7, sellerId]
        );

        const updated = await db.get('SELECT * FROM sellers WHERE id = $1', [sellerId]);

        res.json({
            success: true,
            message: 'Profil mis à jour',
            seller: updated
        });

    } catch (error) {
        console.error('❌ Erreur mise à jour profil:', error);
        res.status(500).json({ error: 'Erreur lors de la mise à jour du profil.' });
    }
});

// ========================================================
// ROUTES : MESSAGES
// ========================================================

app.post('/api/seller/message', isAuthenticatedSeller, async (req, res) => {
    const { userId, shopId, message } = req.body;
    const sellerId = req.seller.id;

    if (!userId || !message) {
        return res.status(400).json({ error: 'userId et message requis.' });
    }

    if (!shopId) {
        return res.status(400).json({ error: 'shopId requis.' });
    }

    try {
        const result = await db.query(
            `INSERT INTO seller_messages (seller_id, user_id, shop_id, message, is_from_seller, is_read)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            [sellerId, userId, shopId, message, true, false]
        );

        io.to(`user_${userId}`).emit('seller-message', {
            sellerId: sellerId,
            userId: userId,
            message: message,
            sellerName: req.seller.name
        });

        await db.query(
            `INSERT INTO seller_stats (seller_id, shop_id, total_messages, updated_at)
             VALUES ($1, $2, 1, NOW())
             ON CONFLICT (shop_id) 
             DO UPDATE SET total_messages = seller_stats.total_messages + 1, updated_at = NOW()`,
            [sellerId, shopId]
        );

        res.json({
            success: true,
            message: 'Message envoyé',
            id: result.rows[0].id
        });

    } catch (error) {
        console.error('❌ Erreur envoi message:', error);
        res.status(500).json({ error: 'Erreur lors de l\'envoi du message.' });
    }
});

app.get('/api/seller/messages/:userId', isAuthenticatedSeller, async (req, res) => {
    const { userId } = req.params;
    const sellerId = req.seller.id;

    try {
        const messages = await db.all(`
            SELECT * FROM seller_messages
            WHERE seller_id = $1 AND user_id = $2
            ORDER BY created_at ASC
        `, [sellerId, userId]);

        await db.query(
            `UPDATE seller_messages SET is_read = true
             WHERE seller_id = $1 AND user_id = $2 AND is_from_seller = false`,
            [sellerId, userId]
        );

        res.json({
            success: true,
            messages: messages || []
        });

    } catch (error) {
        console.error('❌ Erreur récupération messages:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des messages.' });
    }
});

// ========================================================
// ROUTES PAGES
// ========================================================

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'seller', 'html', 'login.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'seller', 'html', 'login.html'));
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'seller', 'html', 'register.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'seller', 'html', 'dashboard.html'));
});

app.get('/create-shop', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'seller', 'html', 'create-shop.html'));
});

app.get('/shop', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'seller', 'html', 'shop.html'));
});

app.get('/products', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'seller', 'html', 'products.html'));
});

app.get('/messages', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'seller', 'html', 'messages.html'));
});

app.get('/profil', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'seller', 'html', 'profil.html'));
});

app.get('/search', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'seller', 'html', 'search.html'));
});

app.get('/create-product', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'seller', 'html', 'create-product.html'));
});

app.get('/detailproduct', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'seller', 'html', 'detailproduct.html'));
});
// ========================================================
// INITIALISATION DE LA BASE DE DONNÉES
// ========================================================

async function initDatabaseWithRetry() {
    let retries = 5;
    let delay = 2000;
    
    while (retries > 0) {
        try {
            console.log(`🔄 Initialisation de la base de données (seller)... Tentative ${6 - retries}/5`);
            await db.initialize();
            console.log('✅ Base de données (seller) initialisée avec succès');
            return true;
        } catch (error) {
            console.log(`⚠️ Erreur: ${error.message}`);
            retries--;
            if (retries > 0) {
                console.log(`⏳ Attente ${delay/1000}s avant réessayer...`);
                await new Promise(r => setTimeout(r, delay));
                delay = Math.min(delay * 1.5, 10000);
            }
        }
    }
    console.log('⚠️ Échec de l\'initialisation de la base après 5 tentatives.');
    return false;
}

// ========================================================
// DÉMARRAGE
// ========================================================

server.listen(PORT, '0.0.0.0', async () => {
    console.log(`========================================`);
    console.log(`🛒 SERVEUR VENDEUR - ComPlus`);
    console.log(`📍 Port: ${PORT}`);
    console.log(`📍 Host: 0.0.0.0`);
    console.log(`📍 http://localhost:${PORT}`);
    console.log(`📍 Socket.IO: actif`);
    console.log(`========================================`);
    await initDatabaseWithRetry();
});