// ========================================================
// SERVEUR VENDEUR - NATURE+ / COMPLUS
// Version complète avec toutes les routes
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
const axios = require('axios');

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
        folder: 'seller_shops',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
        public_id: (req, file) => `shop_${Date.now()}_${file.originalname.split('.')[0]}`,
    },
});

const upload = multer({ storage: storage });

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

// Servir le dossier public ENTIER
app.use(express.static(path.join(__dirname, 'public')));
app.use('/seller', express.static(path.join(__dirname, 'public', 'seller')));

// CORS complet
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
// FONCTIONS
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

// Inscription vendeur
app.post('/api/seller/register', async (req, res) => {
    console.log('📥 Inscription vendeur reçue');
    console.log('📦 Body:', req.body);

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
        req.session.sellerName = name;
        req.session.sellerEmail = email;

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
        res.status(500).json({ error: 'Erreur lors de l\'inscription.', details: error.message });
    }
});

// Connexion vendeur
app.post('/api/seller/login', async (req, res) => {
    console.log('📥 Connexion vendeur reçue');
    console.log('📦 Body:', req.body);

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
        req.session.sellerName = seller.name;
        req.session.sellerEmail = seller.email;

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

// Déconnexion vendeur
app.post('/api/seller/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('❌ Erreur déconnexion:', err);
            return res.status(500).json({ error: 'Erreur lors de la déconnexion.' });
        }
        res.json({ success: true, message: 'Déconnecté' });
    });
});

// Profil vendeur
app.get('/api/seller/me', isAuthenticatedSeller, async (req, res) => {
    res.json({
        success: true,
        seller: req.seller
    });
});

// ========================================================
// ROUTES : BOUTIQUES
// ========================================================

// Créer une boutique AVEC IMAGE (Cloudinary)
app.post('/api/seller/shop', isAuthenticatedSeller, upload.single('image'), async (req, res) => {
    console.log('📥 Création boutique reçue');
    console.log('📦 Body:', req.body);
    console.log('🖼️ Fichier:', req.file);

    const { name, location, description } = req.body;
    const sellerId = req.seller.id;

    if (!name || !location) {
        return res.status(400).json({ error: 'Nom et localisation requis.' });
    }

    try {
        const existing = await db.get('SELECT * FROM shops WHERE seller_id = $1', [sellerId]);
        if (existing) {
            return res.status(400).json({ error: 'Vous avez déjà une boutique.' });
        }

        const imageUrl = req.file ? req.file.path : null;

        const result = await db.query(
            `INSERT INTO shops (seller_id, name, location, description, logo, status)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            [sellerId, name, location, description || null, imageUrl, 'active']
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
                status: 'active'
            }
        });

    } catch (error) {
        console.error('❌ Erreur création boutique:', error);
        res.status(500).json({ error: 'Erreur lors de la création de la boutique.' });
    }
});

// Récupérer sa boutique
app.get('/api/seller/shop', isAuthenticatedSeller, async (req, res) => {
    const sellerId = req.seller.id;

    try {
        const shop = await db.get('SELECT * FROM shops WHERE seller_id = $1', [sellerId]);

        if (!shop) {
            return res.json({
                success: true,
                hasShop: false,
                message: 'Aucune boutique trouvée'
            });
        }

        const products = await db.all(
            'SELECT * FROM seller_products WHERE shop_id = $1 ORDER BY created_at DESC',
            [shop.id]
        );

        res.json({
            success: true,
            hasShop: true,
            shop: shop,
            products: products || []
        });

    } catch (error) {
        console.error('❌ Erreur récupération boutique:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération de la boutique.' });
    }
});

// Modifier sa boutique
app.put('/api/seller/shop', isAuthenticatedSeller, upload.single('image'), async (req, res) => {
    console.log('📥 Modification boutique reçue');
    console.log('📦 Body:', req.body);
    console.log('🖼️ Fichier:', req.file);

    const { name, location, description } = req.body;
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

        await db.query(
            `UPDATE shops 
             SET name = $1, location = $2, description = $3, logo = $4
             WHERE id = $5`,
            [name || shop.name, location || shop.location, description || shop.description, imageUrl, shop.id]
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
// ROUTES : PRODUITS DE LA BOUTIQUE
// ========================================================

// Ajouter un produit à sa boutique
app.post('/api/seller/product', isAuthenticatedSeller, async (req, res) => {
    console.log('📥 Ajout produit vendeur reçu');
    console.log('📦 Body:', req.body);

    const { name, price, image, description, stock, category } = req.body;
    const sellerId = req.seller.id;

    if (!name || !price) {
        return res.status(400).json({ error: 'Nom et prix requis.' });
    }

    try {
        const shop = await db.get('SELECT * FROM shops WHERE seller_id = $1', [sellerId]);

        if (!shop) {
            return res.status(404).json({ error: 'Vous devez créer une boutique d\'abord.' });
        }

        const result = await db.query(
            `INSERT INTO seller_products (shop_id, seller_id, name, price, image, description, stock, category)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
            [shop.id, sellerId, name, price, image || null, description || null, stock || 0, category || null]
        );

        res.json({
            success: true,
            message: 'Produit ajouté avec succès',
            productId: result.rows[0].id
        });

    } catch (error) {
        console.error('❌ Erreur ajout produit:', error);
        res.status(500).json({ error: 'Erreur lors de l\'ajout du produit.' });
    }
});

// Modifier un produit vendeur
app.put('/api/seller/product/:id', isAuthenticatedSeller, async (req, res) => {
    console.log('📥 Modification produit reçue');
    console.log('📦 Body:', req.body);

    const { id } = req.params;
    const { name, price, image, description, stock, category } = req.body;
    const sellerId = req.seller.id;

    if (!name || !price) {
        return res.status(400).json({ error: 'Nom et prix requis.' });
    }

    try {
        const product = await db.get(
            'SELECT * FROM seller_products WHERE id = $1 AND seller_id = $2',
            [id, sellerId]
        );

        if (!product) {
            return res.status(404).json({ error: 'Produit non trouvé ou non autorisé.' });
        }

        await db.query(
            `UPDATE seller_products 
             SET name = $1, price = $2, image = $3, description = $4, stock = $5, category = $6
             WHERE id = $7`,
            [name, price, image || product.image, description || product.description, stock || 0, category || null, id]
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

// Supprimer un produit vendeur
app.delete('/api/seller/product/:id', isAuthenticatedSeller, async (req, res) => {
    console.log(`📥 Suppression produit #${req.params.id}`);

    const { id } = req.params;
    const sellerId = req.seller.id;

    try {
        const product = await db.get(
            'SELECT * FROM seller_products WHERE id = $1 AND seller_id = $2',
            [id, sellerId]
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

// Récupérer tous les produits d'une boutique (public)
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
// ROUTES : LISTE DES BOUTIQUES (PUBLIC)
// ========================================================

app.get('/api/seller/shops', async (req, res) => {
    try {
        const shops = await db.all(`
            SELECT s.*, 
                   (SELECT COUNT(*) FROM seller_products WHERE shop_id = s.id) as product_count,
                   (SELECT name FROM sellers WHERE id = s.seller_id) as seller_name
            FROM shops s
            WHERE s.status = 'active'
            ORDER BY s.created_at DESC
        `);

        res.json({
            success: true,
            shops: shops || []
        });

    } catch (error) {
        console.error('❌ Erreur récupération boutiques:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des boutiques.' });
    }
});

// Détail d'une boutique (public)
app.get('/api/seller/shop/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const shop = await db.get(`
            SELECT s.*, 
                   (SELECT name FROM sellers WHERE id = s.seller_id) as seller_name,
                   (SELECT phone FROM sellers WHERE id = s.seller_id) as seller_phone
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

        const likeCount = await db.get(
            'SELECT COUNT(*) as count FROM seller_likes WHERE shop_id = $1',
            [id]
        );

        const viewCount = await db.get(
            'SELECT total_views FROM seller_stats WHERE shop_id = $1',
            [id]
        );

        // Incrémenter les vues
        await db.query(
            `INSERT INTO seller_stats (seller_id, shop_id, total_views, updated_at)
             VALUES ($1, $2, 1, NOW())
             ON CONFLICT (shop_id) 
             DO UPDATE SET total_views = seller_stats.total_views + 1, updated_at = NOW()`,
            [shop.seller_id, id]
        );

        res.json({
            success: true,
            shop: {
                ...shop,
                total_likes: parseInt(likeCount?.count || 0),
                total_views: parseInt(viewCount?.total_views || 0)
            },
            products: products || []
        });

    } catch (error) {
        console.error('❌ Erreur détail boutique:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération de la boutique.' });
    }
});

// ========================================================
// ROUTES : LIKES
// ========================================================

// Like/Unlike une boutique
app.post('/api/seller/like/:shopId', isAuthenticatedSeller, async (req, res) => {
    console.log(`📥 Like/Unlike boutique #${req.params.shopId}`);

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

// Récupérer les likes d'une boutique
app.get('/api/seller/likes/:shopId', async (req, res) => {
    console.log(`📥 Récupération likes boutique #${req.params.shopId}`);

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

// Statistiques du vendeur
app.get('/api/seller/stats', isAuthenticatedSeller, async (req, res) => {
    console.log('📥 Récupération statistiques vendeur');

    const sellerId = req.seller.id;

    try {
        const shops = await db.all(
            'SELECT id, name, status FROM shops WHERE seller_id = $1',
            [sellerId]
        );

        const totalProducts = await db.get(
            'SELECT COUNT(*) as count FROM seller_products WHERE seller_id = $1',
            [sellerId]
        );

        const totalOrders = await db.get(
            'SELECT COUNT(*) as count FROM seller_orders WHERE seller_id = $1',
            [sellerId]
        );

        const totalMessages = await db.get(
            'SELECT COUNT(*) as count FROM seller_messages WHERE seller_id = $1',
            [sellerId]
        );

        const totalLikes = await db.get(
            `SELECT COUNT(*) as count FROM seller_likes WHERE seller_id = $1`,
            [sellerId]
        );

        const shopDetails = await db.all(`
            SELECT 
                s.id,
                s.name,
                s.location,
                s.status,
                (SELECT COUNT(*) FROM seller_products WHERE shop_id = s.id) as total_products,
                (SELECT COUNT(*) FROM seller_likes WHERE shop_id = s.id) as total_likes,
                (SELECT COUNT(*) FROM seller_messages WHERE shop_id = s.id) as total_messages,
                (SELECT COUNT(*) FROM seller_orders WHERE shop_id = s.id) as total_orders,
                (SELECT total_views FROM seller_stats WHERE shop_id = s.id) as total_views
            FROM shops s
            WHERE s.seller_id = $1
        `, [sellerId]);

        res.json({
            success: true,
            stats: {
                total_shops: shops.length,
                total_products: parseInt(totalProducts?.count || 0),
                total_orders: parseInt(totalOrders?.count || 0),
                total_messages: parseInt(totalMessages?.count || 0),
                total_likes: parseInt(totalLikes?.count || 0),
                shop_details: shopDetails || []
            }
        });

    } catch (error) {
        console.error('❌ Erreur statistiques:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des statistiques.' });
    }
});

// ========================================================
// ROUTES : COMMANDES VENDEUR
// ========================================================

app.get('/api/seller/orders', isAuthenticatedSeller, async (req, res) => {
    const sellerId = req.seller.id;

    try {
        const orders = await db.all(`
            SELECT so.*, u.name as user_name, u.phone as user_phone
            FROM seller_orders so
            JOIN users u ON u.id = so.user_id
            WHERE so.seller_id = $1
            ORDER BY so.created_at DESC
        `, [sellerId]);

        res.json({
            success: true,
            orders: orders || []
        });

    } catch (error) {
        console.error('❌ Erreur récupération commandes:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des commandes.' });
    }
});

// ========================================================
// ROUTES : MESSAGES VENDEUR-CLIENT
// ========================================================

app.post('/api/seller/message', isAuthenticatedSeller, async (req, res) => {
    console.log('📥 Message vendeur reçu');
    console.log('📦 Body:', req.body);

    const { userId, shopId, message } = req.body;
    const sellerId = req.seller.id;

    if (!userId || !message) {
        return res.status(400).json({ error: 'userId et message requis.' });
    }

    try {
        const result = await db.query(
            `INSERT INTO seller_messages (seller_id, user_id, shop_id, message, is_from_seller, is_read)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            [sellerId, userId, shopId || null, message, true, false]
        );

        io.to(`user_${userId}`).emit('seller-message', {
            sellerId: sellerId,
            userId: userId,
            message: message,
            sellerName: req.seller.name
        });

        if (shopId) {
            await db.query(
                `INSERT INTO seller_stats (seller_id, shop_id, total_messages, updated_at)
                 VALUES ($1, $2, 1, NOW())
                 ON CONFLICT (shop_id) 
                 DO UPDATE SET total_messages = seller_stats.total_messages + 1, updated_at = NOW()`,
                [sellerId, shopId]
            );
        }

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
// ROUTES PAGES VENDEUR
// ========================================================

// Route racine - redirection intelligente
app.get('/', (req, res) => {
    const token = req.headers.authorization?.split(' ')[1] || req.query.token;
    if (token || req.session?.sellerId) {
        res.sendFile(path.join(__dirname, 'public', 'seller', 'html', 'dashboard.html'));
    } else {
        res.sendFile(path.join(__dirname, 'public', 'seller', 'html', 'login.html'));
    }
});

// Pages d'authentification
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'seller', 'html', 'login.html'));
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'seller', 'html', 'register.html'));
});

// Pages principales
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'seller', 'html', 'dashboard.html'));
});

app.get('/create-shop', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'seller', 'html', 'create-shop.html'));
});

// ✅ PAGES MANQUANTES (ajoutées)
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

// ========================================================
// INITIALISATION DE LA BASE DE DONNÉES (AVEC RETRY)
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
    console.log('📌 Continuation du démarrage...');
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
    console.log(`📍 ${process.env.NODE_ENV || 'development'} mode`);
    console.log(`========================================`);
    await initDatabaseWithRetry();
});