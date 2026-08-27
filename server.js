// ✅ FORCER LE FUSEAU HORAIRE À UTC+0 (Côte d'Ivoire)
process.env.TZ = 'Africa/Abidjan';

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const Redis = require('ioredis');
const { createAdapter } = require('@socket.io/redis-adapter');
const path = require('path');
const bcrypt = require('bcrypt');
const fs = require('fs');
const session = require('express-session');
const pg = require('pg');
const PgSession = require('connect-pg-simple')(session);
const db = require('./database');
const { upload } = require('./config/cloudinary');
const axios = require('axios');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// ========================================================
// REDIS - Connexion
// ========================================================

const redisClient = new Redis(process.env.REDIS_URL, {
    tls: {},
    retryStrategy: (times) => Math.min(times * 50, 2000)
});

redisClient.on('connect', () => console.log('✅ Redis connecté'));
redisClient.on('error', (err) => console.error('❌ Redis erreur:', err));

const pubClient = redisClient.duplicate();
const subClient = redisClient.duplicate();

// ========================================================
// SOCKET.IO
// ========================================================

const io = new Server(server, {
    cors: {
        origin: ['https://nature-plus-client.onrender.com', 'http://localhost:3000'],
        credentials: true
    },
    adapter: createAdapter(pubClient, subClient)
});

io.use((socket, next) => {
    const userId = socket.handshake.auth.userId;
    const isAdmin = socket.handshake.auth.isAdmin || false;

    if (userId) {
        socket.userId = userId;
        socket.isAdmin = isAdmin;
        next();
    } else {
        next(new Error('Authentication required'));
    }
});

io.on('connection', (socket) => {
    const userId = socket.userId;
    const isAdmin = socket.isAdmin;

    socket.join(`user_${userId}`);

    if (isAdmin) {
        socket.join('admin');
        console.log(`✅ Admin ${userId} connecté via Socket.IO`);
    } else {
        console.log(`✅ Client ${userId} connecté via Socket.IO`);
    }

    socket.on('disconnect', () => {
        console.log(`❌ Déconnecté: ${userId}`);
    });
});

global.io = io;

// ========================================================
// MIDDLEWARE
// ========================================================

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ========================================================
// CORS - Configuration complète (AVANT TOUTES LES ROUTES)
// ========================================================

app.use((req, res, next) => {
    const allowedOrigins = [
        'https://nature-plus-client.onrender.com',
        'https://nature-plus-seller.onrender.com',
        'https://nature-plus-pay.onrender.com',
        'https://server-wave-js.onrender.com',
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
// SESSIONS (PostgreSQL)
// ========================================================

const pgPool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

app.use(session({
    store: new PgSession({
        pool: pgPool,
        tableName: 'session'
    }),
    secret: process.env.SESSION_SECRET || 'natureplus-super-secret-key-2026',
    resave: true,
    saveUninitialized: true,
    cookie: {
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: false,
        sameSite: 'lax'
    }
}));

// ========================================================
// MIDDLEWARE : AUTH
// ========================================================

function isAuthenticated(req, res, next) {
    if (req.session.userId) {
        next();
    } else {
        res.status(401).json({ error: 'Non authentifié' });
    }
}

// ========================================================
// FONCTION : CRÉER UNE NOTIFICATION
// ========================================================

async function createNotification(userId, commandeId, type, title, content) {
    try {
        await db.query(
            `INSERT INTO messages (user_id, commande_id, type, title, content, is_read)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [userId, commandeId, type, title, content, false]
        );
        console.log(`✅ Notification créée pour user ${userId}: ${title}`);
        return true;
    } catch (err) {
        console.error('❌ Erreur création notification:', err);
        return false;
    }
}

// ========================================================
// ROUTE HEALTH
// ========================================================

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', service: 'client' });
});

// ========================================================
// ROUTES ADMIN
// ========================================================

app.get('/api/admin/products', async (req, res) => {
    try {
        const rows = await db.all('SELECT * FROM products ORDER BY created_at DESC');
        res.json(rows);
    } catch (err) {
        console.error('Erreur:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/register', async (req, res) => {
    const { merchantName, email, password, contact, logo } = req.body;

    if (!merchantName || !email || !password) {
        return res.status(400).json({ error: 'Nom, email et mot de passe requis.' });
    }

    if (password.length < 6) {
        return res.status(400).json({ error: 'Le mot de passe doit faire au moins 6 caractères.' });
    }

    try {
        const existingAdmin = await db.get('SELECT * FROM admins WHERE email = $1', [email]);

        if (existingAdmin) {
            return res.status(400).json({ error: 'Cet email est déjà utilisé.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await db.query(
            `INSERT INTO admins (email, password, merchant_name, logo, contact)
             VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [email, hashedPassword, merchantName, logo || null, contact || null]
        );

        res.json({
            success: true,
            message: 'Compte créé avec succès',
            adminId: result.rows[0].id
        });
    } catch (error) {
        console.error('❌ Erreur inscription admin:', error);
        res.status(500).json({ error: 'Erreur lors de l\'inscription.' });
    }
});

app.post('/api/admin/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email et mot de passe requis.' });
    }

    try {
        const admin = await db.get('SELECT * FROM admins WHERE email = $1', [email]);

        if (!admin) {
            return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
        }

        const isPasswordValid = await bcrypt.compare(password, admin.password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
        }

        res.json({
            success: true,
            message: 'Connexion réussie',
            admin: {
                id: admin.id,
                email: admin.email,
                merchant_name: admin.merchant_name,
                logo: admin.logo
            }
        });
    } catch (error) {
        console.error('❌ Erreur connexion admin:', error);
        res.status(500).json({ error: 'Erreur lors de la connexion.' });
    }
});

app.post('/api/admin/products', upload.fields([
    { name: 'image1', maxCount: 1 },
    { name: 'image2', maxCount: 1 }
]), async (req, res) => {
    const { name, price, quantity, description } = req.body;

    if (!name || name.trim() === '') {
        return res.status(400).json({ error: 'Nom du produit requis.' });
    }

    const parsedPrice = parseInt(price);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
        return res.status(400).json({ error: 'Prix valide requis.' });
    }

    const image1 = req.files && req.files['image1'] ? req.files['image1'][0].path : '';
    const image2 = req.files && req.files['image2'] ? req.files['image2'][0].path : '';

    if (!image1) {
        return res.status(400).json({ error: 'Image 1 requise.' });
    }

    try {
        // ✅ Récupérer ou créer un admin
        let adminId = 1;
        let admin = await db.get('SELECT id FROM admins LIMIT 1');
        
        if (!admin) {
            const bcrypt = require('bcrypt');
            const hashedPassword = await bcrypt.hash('admin123', 10);
            const result = await db.query(
                `INSERT INTO admins (email, password, merchant_name) 
                 VALUES ($1, $2, $3) RETURNING id`,
                ['admin@natureplus.com', hashedPassword, 'Nature+']
            );
            adminId = result.rows[0].id;
            console.log('✅ Admin par défaut créé avec ID:', adminId);
        } else {
            adminId = admin.id;
        }

        const result = await db.query(
            `INSERT INTO products (admin_id, name, price, quantity, image1, image2, description)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
            [adminId, name.trim(), parsedPrice, parseInt(quantity) || 0, image1, image2, description || '']
        );
        res.json({ success: true, id: result.rows[0].id, message: 'Produit ajouté avec succès' });
    } catch (err) {
        console.error('❌ Erreur DB:', err);
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/admin/products/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db.query('DELETE FROM products WHERE id = $1', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Produit non trouvé' });
        }
        res.json({ success: true, message: 'Produit supprimé' });
    } catch (err) {
        console.error('❌ Erreur:', err);
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/admin/products/:id', upload.fields([
    { name: 'image1', maxCount: 1 },
    { name: 'image2', maxCount: 1 }
]), async (req, res) => {
    const { id } = req.params;
    const { name, price, quantity, description } = req.body;

    if (!name || name.trim() === '') {
        return res.status(400).json({ error: 'Nom du produit requis.' });
    }

    const parsedPrice = parseInt(price);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
        return res.status(400).json({ error: 'Prix valide requis.' });
    }

    try {
        const existing = await db.get('SELECT * FROM products WHERE id = $1', [id]);
        if (!existing) {
            return res.status(404).json({ error: 'Produit non trouvé.' });
        }

        let image1 = existing.image1;
        let image2 = existing.image2;

        if (req.files && req.files['image1'] && req.files['image1'][0]) {
            image1 = req.files['image1'][0].path;
        }
        if (req.files && req.files['image2'] && req.files['image2'][0]) {
            image2 = req.files['image2'][0].path;
        }

        await db.query(
            `UPDATE products 
             SET name = $1, price = $2, quantity = $3, description = $4, image1 = $5, image2 = $6
             WHERE id = $7`,
            [name.trim(), parsedPrice, parseInt(quantity) || 0, description || '', image1, image2, id]
        );

        res.json({ success: true, message: 'Produit mis à jour avec succès' });
    } catch (err) {
        console.error('❌ Erreur modification produit:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/admin/stats', async (req, res) => {
    const stats = { products: 0, sales: 0, clients: 0, payments: 0, commandes: 0 };

    try {
        const products = await db.get('SELECT COUNT(*) as count FROM products');
        stats.products = products ? products.count : 0;

        const sales = await db.get('SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE status = $1', ['success']);
        stats.sales = sales ? sales.total : 0;

        const clients = await db.get('SELECT COUNT(*) as count FROM users');
        stats.clients = clients ? clients.count : 0;

        const payments = await db.get('SELECT COUNT(*) as count FROM payments');
        stats.payments = payments ? payments.count : 0;

        const commandes = await db.get('SELECT COUNT(*) as count FROM commandes');
        stats.commandes = commandes ? commandes.count : 0;

        res.json(stats);
    } catch (err) {
        console.error('❌ Erreur stats:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/admin/payments', async (req, res) => {
    try {
        const rows = await db.all('SELECT * FROM payments ORDER BY created_at DESC');
        res.json(rows);
    } catch (err) {
        console.error('❌ Erreur:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/admin/clients', async (req, res) => {
    try {
        const rows = await db.all('SELECT * FROM users ORDER BY created_at DESC');
        res.json(rows);
    } catch (err) {
        console.error('❌ Erreur:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/admin/commandes', async (req, res) => {
    try {
        const rows = await db.all(
            `SELECT c.*, p.genius_reference, p.genius_status, p.checkout_url,
                    to_char(c.created_at, 'YYYY-MM-DD HH24:MI:SS') as created_at
             FROM commandes c
             LEFT JOIN payments p ON p.commande_id = c.id
             ORDER BY c.created_at DESC`
        );
        res.json(rows);
    } catch (err) {
        console.error('❌ Erreur:', err);
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/admin/commande/status', async (req, res) => {
    const { commandeId, status, causeRefus } = req.body;

    if (!commandeId || !status) {
        return res.status(400).json({ error: 'commandeId et status requis.' });
    }

    const allowedStatus = [
        'en_attente', 'accepter', 'refuse', 'paiement_effectue',
        'livraison_en_cours', 'disponible', 'recuperee'
    ];

    if (!allowedStatus.includes(status)) {
        return res.status(400).json({ error: 'Statut invalide.' });
    }

    try {
        const commande = await db.get('SELECT user_id, nom FROM commandes WHERE id = $1', [commandeId]);

        if (!commande) {
            return res.status(404).json({ error: 'Commande non trouvée.' });
        }

        const statusMessages = {
            'accepter': {
                title: '💳 Paiement requis',
                content: `Votre commande #${commandeId} a été acceptée. Veuillez procéder au paiement.`
            },
            'refuse': {
                title: '❌ Commande refusée',
                content: `Votre commande #${commandeId} a été refusée. Motif : ${causeRefus || 'Non précisé'}`
            },
            'livraison_en_cours': {
                title: '🚚 Livraison en cours',
                content: `Votre commande #${commandeId} est en cours de livraison.`
            },
            'disponible': {
                title: '📍 Commande disponible',
                content: `Votre commande #${commandeId} est disponible à la récupération.`
            },
            'recuperee': {
                title: '✅ Commande récupérée',
                content: `Merci ! Votre commande #${commandeId} a été récupérée avec succès.`
            }
        };

        let content = statusMessages[status]?.content || `Statut mis à jour : ${status}`;
        if (status === 'refuse' && causeRefus) {
            content = `Votre commande #${commandeId} a été refusée. Motif : ${causeRefus}`;
        }

        let query = 'UPDATE commandes SET status = $1 WHERE id = $2';
        let params = [status, commandeId];

        if (status === 'refuse' && causeRefus) {
            query = 'UPDATE commandes SET status = $1, cause_refus = $2 WHERE id = $3';
            params = [status, causeRefus, commandeId];
        }

        const result = await db.query(query, params);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Commande non trouvée.' });
        }

        const title = statusMessages[status]?.title || `📋 Commande #${commandeId} mise à jour`;
        await createNotification(
            commande.user_id,
            commandeId,
            'commande',
            title,
            content
        );

        global.io.to(`user_${commande.user_id}`).emit('commande-update', {
            commandeId: parseInt(commandeId),
            status: status,
            userId: commande.user_id,
            message: `Statut mis à jour : ${status}`
        });

        res.json({ success: true, message: 'Statut mis à jour et notification envoyée' });
    } catch (err) {
        console.error('❌ Erreur:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/admin/livraison', async (req, res) => {
    try {
        const rows = await db.all('SELECT * FROM frais_livraison ORDER BY commune ASC');
        res.json(rows);
    } catch (err) {
        console.error('❌ Erreur:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/livraison', async (req, res) => {
    const { commune, tarif } = req.body;

    if (!commune || !tarif) {
        return res.status(400).json({ error: 'Commune et tarif requis.' });
    }

    try {
        const result = await db.query(
            'INSERT INTO frais_livraison (commune, tarif) VALUES ($1, $2) RETURNING id',
            [commune.trim(), tarif]
        );
        res.json({ success: true, id: result.rows[0].id, message: 'Commune ajoutée' });
    } catch (err) {
        console.error('❌ Erreur:', err);
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/admin/livraison/:id', async (req, res) => {
    const { id } = req.params;
    const { tarif } = req.body;

    if (!tarif) {
        return res.status(400).json({ error: 'Tarif requis.' });
    }

    try {
        const result = await db.query('UPDATE frais_livraison SET tarif = $1 WHERE id = $2', [tarif, id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Commune non trouvée.' });
        }
        res.json({ success: true, message: 'Tarif mis à jour' });
    } catch (err) {
        console.error('❌ Erreur:', err);
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/admin/livraison/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const result = await db.query('DELETE FROM frais_livraison WHERE id = $1', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Commune non trouvée.' });
        }
        res.json({ success: true, message: 'Commune supprimée' });
    } catch (err) {
        console.error('❌ Erreur:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/notification/send', async (req, res) => {
    const { userId, title, content } = req.body;

    if (!userId || !title || !content) {
        return res.status(400).json({ error: 'userId, title et content requis.' });
    }

    try {
        await db.query(
            `INSERT INTO messages (user_id, commande_id, type, title, content, is_read)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [userId, null, 'admin', title, content, false]
        );
        console.log(`✅ Notification admin envoyée à l'utilisateur ${userId}: ${title}`);
        res.json({ success: true, message: 'Notification envoyée avec succès' });
    } catch (err) {
        console.error('❌ Erreur envoi notification:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/admin/check-updates', async (req, res) => {
    try {
        const repoUrl = 'https://api.github.com/repos/ivanipote/serveur/commits/main';
        const response = await fetch(repoUrl);

        if (!response.ok) {
            return res.status(500).json({ error: 'Erreur lors de la récupération du dernier commit' });
        }

        const data = await response.json();
        const lastCommit = {
            sha: data.sha,
            message: data.commit.message,
            date: data.commit.author.date,
            url: data.html_url
        };

        const existing = await db.get(
            'SELECT * FROM updates WHERE commit_sha = $1',
            [lastCommit.sha]
        );

        if (existing) {
            return res.json({
                success: true,
                isNew: false,
                message: 'Aucune nouvelle mise à jour',
                commit: lastCommit
            });
        }

        await db.query(
            `INSERT INTO updates (commit_sha, commit_message, commit_date, commit_url)
             VALUES ($1, $2, $3, $4)`,
            [lastCommit.sha, lastCommit.message, lastCommit.date, lastCommit.url]
        );

        const users = await db.all('SELECT id FROM users');
        let sentCount = 0;

        for (const user of users) {
            await createNotification(
                user.id,
                null,
                'systeme',
                '🔄 Mise à jour disponible',
                `Nouvelle version : ${lastCommit.message}`
            );
            sentCount++;
        }

        console.log(`✅ ${sentCount} notifications de mise à jour envoyées`);

        res.json({
            success: true,
            isNew: true,
            sentCount: sentCount,
            message: `Nouvelle mise à jour détectée : ${lastCommit.message}`,
            commit: lastCommit
        });
    } catch (error) {
        console.error('❌ Erreur check-updates:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========================================================
// ROUTES CLIENT - AUTH
// ========================================================

app.post('/api/client/register', async (req, res) => {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !phone || !password) {
        return res.status(400).json({ error: 'Tous les champs sont requis.' });
    }

    if (password.length !== 4 || !/^\d{4}$/.test(password)) {
        return res.status(400).json({ error: 'Le mot de passe doit être un code à 4 chiffres.' });
    }

    try {
        const existingUser = await db.get('SELECT * FROM users WHERE email = $1', [email]);

        if (existingUser) {
            return res.status(400).json({ error: 'Cet email est déjà utilisé.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await db.query(
            `INSERT INTO users (name, email, phone, password)
             VALUES ($1, $2, $3, $4) RETURNING id`,
            [name, email, phone, hashedPassword]
        );

        res.json({
            success: true,
            message: 'Compte créé avec succès',
            userId: result.rows[0].id
        });
    } catch (error) {
        console.error('❌ Erreur inscription client:', error);
        res.status(500).json({ error: 'Erreur lors de l\'inscription.' });
    }
});

app.post('/api/client/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email et mot de passe requis.' });
    }

    try {
        const user = await db.get('SELECT * FROM users WHERE email = $1', [email]);

        if (!user) {
            return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
        }

        req.session.userId = user.id;
        req.session.userName = user.name;
        req.session.userEmail = user.email;
        req.session.userPhone = user.phone;

        req.session.save((err) => {
            if (err) {
                console.error('❌ Erreur sauvegarde session:', err);
                return res.status(500).json({ error: 'Erreur lors de la sauvegarde de la session.' });
            }

            res.json({
                success: true,
                message: 'Connexion réussie',
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    phone: user.phone
                }
            });
        });
    } catch (error) {
        console.error('❌ Erreur connexion client:', error);
        res.status(500).json({ error: 'Erreur lors de la connexion.' });
    }
});

app.post('/api/client/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('❌ Erreur déconnexion:', err);
            return res.status(500).json({ error: 'Erreur lors de la déconnexion.' });
        }
        res.json({ success: true, message: 'Déconnecté' });
    });
});

app.get('/api/client/me', isAuthenticated, (req, res) => {
    res.json({
        success: true,
        user: {
            id: req.session.userId,
            name: req.session.userName,
            email: req.session.userEmail,
            phone: req.session.userPhone
        }
    });
});

app.get('/api/client/user/:id', isAuthenticated, async (req, res) => {
    const { id } = req.params;

    if (parseInt(id) !== req.session.userId) {
        return res.status(403).json({ error: 'Accès non autorisé.' });
    }

    try {
        const row = await db.get('SELECT id, name, email, phone FROM users WHERE id = $1', [id]);
        if (!row) {
            return res.status(404).json({ error: 'Utilisateur non trouvé.' });
        }
        res.json({ success: true, user: row });
    } catch (err) {
        console.error('❌ Erreur:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/client/verify-code', isAuthenticated, async (req, res) => {
    const { code } = req.body;
    const userId = req.session.userId;

    if (!userId || !code) {
        return res.status(400).json({ error: 'userId et code requis.' });
    }

    try {
        const user = await db.get('SELECT password FROM users WHERE id = $1', [userId]);

        if (!user) {
            return res.status(404).json({ error: 'Utilisateur non trouvé.' });
        }

        const isValid = await bcrypt.compare(code, user.password);

        if (isValid) {
            res.json({ success: true, message: 'Code valide' });
        } else {
            res.status(401).json({ success: false, error: 'Code incorrect' });
        }
    } catch (error) {
        console.error('❌ Erreur:', error);
        res.status(500).json({ error: 'Erreur lors de la vérification.' });
    }
});

// ✅ Route client → admin (message)
app.post('/api/client/send-message', isAuthenticated, async (req, res) => {
    const { title, content } = req.body;
    const userId = req.session.userId;

    if (!title || !content) {
        return res.status(400).json({ error: 'Titre et contenu requis.' });
    }

    try {
        // Récupérer l'utilisateur
        const user = await db.get('SELECT name FROM users WHERE id = $1', [userId]);
        
        // Créer la notification pour l'admin (admin_id = 1)
        await createNotification(
            1, // admin_id
            null, // commande_id
            'client_message',
            `📩 ${title}`,
            `De: ${user?.name || 'Client'} (ID: ${userId})\n\n${content}`
        );
        
        // Émettre via Socket.IO pour l'admin
        global.io.to('admin').emit('notification', {
            title: `📩 Nouveau message de ${user?.name || 'Client'}`,
            content: content,
            userId: userId
        });

        res.json({ success: true, message: 'Message envoyé avec succès' });
    } catch (error) {
        console.error('❌ Erreur envoi message:', error);
        res.status(500).json({ error: 'Erreur lors de l\'envoi' });
    }
});

// ========================================================
// ROUTES PRODUITS (public)
// ========================================================

app.get('/api/products', async (req, res) => {
    try {
        const rows = await db.all('SELECT * FROM products ORDER BY created_at DESC');
        res.json(rows);
    } catch (err) {
        console.error('Erreur:', err);
        res.status(500).json({ error: err.message });
    }
});

// ========================================================
// ROUTE : NOTIFICATION PUBLIQUE POUR LE VENDEUR
// ========================================================

app.post('/api/notifications/seller-create', async (req, res) => {
    const { userId, title, content, type } = req.body;

    if (!userId || !title || !content) {
        return res.status(400).json({ error: 'userId, title et content requis.' });
    }

    try {
        await db.query(
            `INSERT INTO messages (user_id, commande_id, type, title, content, is_read)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [userId, null, type || 'admin', title, content, false]
        );

        // Émettre via Socket.IO
        global.io.to(`user_${userId}`).emit('notification', {
            title: title,
            content: content,
            type: type || 'admin'
        });

        console.log(`✅ Notification vendeur envoyée à l'utilisateur ${userId}: ${title}`);
        res.json({ success: true, message: 'Notification envoyée' });
    } catch (err) {
        console.error('❌ Erreur envoi notification vendeur:', err);
        res.status(500).json({ error: err.message });
    }
});

// ========================================================
// ROUTES FRAIS DE LIVRAISON (public)
// ========================================================

app.get('/api/livraison/communes', async (req, res) => {
    try {
        const rows = await db.all('SELECT * FROM frais_livraison ORDER BY commune ASC');
        res.json(rows);
    } catch (err) {
        console.error('❌ Erreur:', err);
        res.status(500).json({ error: err.message });
    }
});

// ========================================================
// ROUTES PANIER
// ========================================================

app.post('/api/panier/add', isAuthenticated, async (req, res) => {
    const userId = req.session.userId;
    const { productId, quantity = 1 } = req.body;

    if (!productId) {
        return res.status(400).json({ error: 'productId requis.' });
    }

    try {
        const row = await db.get('SELECT * FROM panier WHERE user_id = $1 AND product_id = $2', [userId, productId]);

        if (row) {
            await db.query(
                'UPDATE panier SET quantity = quantity + $1 WHERE user_id = $2 AND product_id = $3',
                [quantity, userId, productId]
            );
            res.json({ success: true, message: 'Quantité mise à jour' });
        } else {
            await db.query(
                'INSERT INTO panier (user_id, product_id, quantity) VALUES ($1, $2, $3)',
                [userId, productId, quantity]
            );
            res.json({ success: true, message: 'Produit ajouté au panier' });
        }
    } catch (err) {
        console.error('❌ Erreur:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/panier', isAuthenticated, async (req, res) => {
    const userId = req.session.userId;

    try {
        const rows = await db.all(
            `SELECT p.id, p.name, p.price, p.image1, p.image2, 
                    panier.quantity, panier.product_id
             FROM panier 
             JOIN products p ON panier.product_id = p.id 
             WHERE panier.user_id = $1`,
            [userId]
        );
        res.json({ success: true, panier: rows });
    } catch (err) {
        console.error('❌ Erreur:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============================================================
// ROUTE : RÉCUPÉRER TOUTES LES BOUTIQUES (public)
// ============================================================

app.get('/api/shops', async (req, res) => {
    try {
        const rows = await db.all(`
            SELECT 
                s.id, s.name, s.location, s.description, s.logo,
                u.name as seller_name,
                (SELECT COUNT(*) FROM seller_products WHERE shop_id = s.id) as total_products,
                (SELECT COALESCE(SUM(total_views), 0) FROM seller_stats WHERE shop_id = s.id) as total_views,
                (SELECT COALESCE(SUM(total_likes), 0) FROM seller_stats WHERE shop_id = s.id) as total_likes
            FROM shops s
            JOIN sellers u ON u.id = s.seller_id
            WHERE s.status = 'active'
            ORDER BY s.created_at DESC
        `);
        res.json({ success: true, shops: rows });
    } catch (error) {
        console.error('❌ Erreur boutiques:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/panier/count', isAuthenticated, async (req, res) => {
    const userId = req.session.userId;

    try {
        const row = await db.get('SELECT COALESCE(SUM(quantity), 0) as total FROM panier WHERE user_id = $1', [userId]);
        res.json({ success: true, count: row?.total || 0 });
    } catch (err) {
        console.error('❌ Erreur:', err);
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/panier/remove', isAuthenticated, async (req, res) => {
    const userId = req.session.userId;
    const { productId } = req.body;

    if (!productId) {
        return res.status(400).json({ error: 'productId requis.' });
    }

    try {
        const result = await db.query(
            'DELETE FROM panier WHERE user_id = $1 AND product_id = $2',
            [userId, productId]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Article non trouvé dans le panier.' });
        }
        res.json({ success: true, message: 'Produit retiré du panier' });
    } catch (err) {
        console.error('❌ Erreur DB:', err);
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/panier/clear', isAuthenticated, async (req, res) => {
    const userId = req.session.userId;

    try {
        await db.query('DELETE FROM panier WHERE user_id = $1', [userId]);
        res.json({ success: true, message: 'Panier vidé avec succès' });
    } catch (err) {
        console.error('❌ Erreur DB:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/panier/update', isAuthenticated, async (req, res) => {
    const userId = req.session.userId;
    const { productId, quantity } = req.body;

    if (!productId || quantity === undefined) {
        return res.status(400).json({ error: 'productId et quantity requis.' });
    }

    try {
        if (quantity <= 0) {
            await db.query('DELETE FROM panier WHERE user_id = $1 AND product_id = $2', [userId, productId]);
            res.json({ success: true, message: 'Produit retiré' });
        } else {
            await db.query(
                'UPDATE panier SET quantity = $1 WHERE user_id = $2 AND product_id = $3',
                [quantity, userId, productId]
            );
            res.json({ success: true, message: 'Quantité mise à jour' });
        }
    } catch (err) {
        console.error('❌ Erreur:', err);
        res.status(500).json({ error: err.message });
    }
});

// ========================================================
// ROUTES COMMANDES
// ========================================================

app.post('/api/commande/create', isAuthenticated, async (req, res) => {
    const userId = req.session.userId;
    const { panier, total, nom, telephone, codeLogin, option, commune, fraisLivraison, quartier, precision, latitude, longitude } = req.body;

    if (!panier || !total || !nom || !telephone || !codeLogin) {
        return res.status(400).json({ error: 'Données manquantes.' });
    }

    const generateReference = () => {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const random = Math.floor(Math.random() * 99999).toString().padStart(5, '0');
        return `NAT-${year}${month}${day}-${random}`;
    };

    const reference = generateReference();

    try {
        const existing = await db.get('SELECT id FROM commandes WHERE reference = $1', [reference]);
        let finalRef = reference;
        if (existing) {
            const random2 = Math.floor(Math.random() * 99999).toString().padStart(5, '0');
            const date = new Date();
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            finalRef = `NAT-${year}${month}${day}-${random2}`;
        }

        const result = await db.query(
            `INSERT INTO commandes (
                reference, user_id, panier, total, nom, telephone, code_login,
                option, commune, frais_livraison, quartier, precision, latitude, longitude, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING id`,
            [
                finalRef, userId, panier, total, nom, telephone, codeLogin,
                option, commune || null, fraisLivraison || 0,
                quartier || null, precision || null, latitude || null, longitude || null,
                'en_attente'
            ]
        );

        const commandeId = result.rows[0].id;

        await createNotification(
            userId,
            commandeId,
            'commande',
            '📋 Commande créée',
            `Votre commande #${commandeId} (${finalRef}) a été créée avec succès.`
        );

        global.io.to('admin').emit('nouvelle-commande', {
            commandeId: commandeId,
            userId: userId,
            nom: nom,
            total: total,
            reference: finalRef,
            message: `🆕 Nouvelle commande #${commandeId} de ${nom}`
        });

        res.json({
            success: true,
            id: commandeId,
            reference: finalRef,
            message: 'Commande créée avec succès'
        });
    } catch (err) {
        console.error('❌ Erreur DB:', err);
        res.status(500).json({ error: err.message });
    }
});

// ✅ ROUTE COMMANDES - CLIENT
app.get('/api/commandes', isAuthenticated, async (req, res) => {
    const userId = req.session.userId;

    try {
        const rows = await db.all(
            `SELECT c.*, p.genius_reference, p.genius_status, p.checkout_url, p.amount as payment_amount,
                    to_char(c.created_at, 'YYYY-MM-DD HH24:MI:SS') as created_at
             FROM commandes c
             LEFT JOIN payments p ON p.commande_id = c.id
             WHERE c.user_id = $1 
             ORDER BY c.created_at DESC`,
            [userId]
        );
        res.json(rows);
    } catch (err) {
        console.error('❌ Erreur:', err);
        res.status(500).json({ error: err.message });
    }
});

// ========================================================
// ROUTES NOTIFICATIONS
// ========================================================

app.get('/api/notifications', isAuthenticated, async (req, res) => {
    const userId = req.session.userId;

    try {
        const rows = await db.all(
            `SELECT * FROM messages 
             WHERE user_id = $1 
             ORDER BY is_read ASC, created_at DESC`,
            [userId]
        );
        const unreadCount = rows.filter(r => !r.is_read).length;
        res.json({
            success: true,
            count: unreadCount,
            notifications: rows
        });
    } catch (err) {
        console.error('❌ Erreur notifications:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/notifications/count', isAuthenticated, async (req, res) => {
    const userId = req.session.userId;

    try {
        const row = await db.get(
            'SELECT COUNT(*) as count FROM messages WHERE user_id = $1 AND is_read = $2',
            [userId, false]
        );
        res.json({ success: true, count: row?.count || 0 });
    } catch (err) {
        console.error('❌ Erreur:', err);
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/notifications/read/:id', isAuthenticated, async (req, res) => {
    const { id } = req.params;
    const userId = req.session.userId;

    try {
        const result = await db.query(
            'UPDATE messages SET is_read = $1 WHERE id = $2 AND user_id = $3',
            [true, id, userId]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Notification non trouvée.' });
        }
        res.json({ success: true, message: 'Notification marquée comme lue' });
    } catch (err) {
        console.error('❌ Erreur:', err);
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/notifications/read-all', isAuthenticated, async (req, res) => {
    const userId = req.session.userId;

    try {
        const result = await db.query(
            'UPDATE messages SET is_read = $1 WHERE user_id = $2',
            [true, userId]
        );
        res.json({
            success: true,
            message: 'Toutes les notifications marquées comme lues',
            count: result.rowCount
        });
    } catch (err) {
        console.error('❌ Erreur:', err);
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/notifications/delete/:id', isAuthenticated, async (req, res) => {
    const { id } = req.params;
    const userId = req.session.userId;

    try {
        const result = await db.query(
            'DELETE FROM messages WHERE id = $1 AND user_id = $2',
            [id, userId]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Notification non trouvée.' });
        }
        res.json({ success: true, message: 'Notification supprimée' });
    } catch (err) {
        console.error('❌ Erreur:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/notifications/create', isAuthenticated, async (req, res) => {
    const { userId, commandeId, type, title, content } = req.body;

    if (!userId || !title || !content) {
        return res.status(400).json({ error: 'userId, title et content requis.' });
    }

    try {
        await db.query(
            `INSERT INTO messages (user_id, commande_id, type, title, content, is_read)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [userId, commandeId, type, title, content, false]
        );
        res.json({ success: true, message: 'Notification créée' });
    } catch (err) {
        console.error('❌ Erreur:', err);
        res.status(500).json({ error: err.message });
    }
});

// ========================================================
// ROUTES PROFIL
// ========================================================

app.post('/api/client/update-name', isAuthenticated, async (req, res) => {
    const userId = req.session.userId;
    const { name } = req.body;

    if (!name || name.trim() === '') {
        return res.status(400).json({ error: 'Nom requis.' });
    }

    try {
        const result = await db.query('UPDATE users SET name = $1 WHERE id = $2', [name.trim(), userId]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Utilisateur non trouvé.' });
        }
        req.session.userName = name.trim();
        res.json({ success: true, message: 'Nom mis à jour' });
    } catch (err) {
        console.error('❌ Erreur:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/client/update-email', isAuthenticated, async (req, res) => {
    const userId = req.session.userId;
    const { email } = req.body;

    if (!email || email.trim() === '') {
        return res.status(400).json({ error: 'Email requis.' });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Email invalide.' });
    }

    try {
        const result = await db.query('UPDATE users SET email = $1 WHERE id = $2', [email.trim(), userId]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Utilisateur non trouvé.' });
        }
        req.session.userEmail = email.trim();
        res.json({ success: true, message: 'Email mis à jour' });
    } catch (err) {
        console.error('❌ Erreur:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/client/update-phone', isAuthenticated, async (req, res) => {
    const userId = req.session.userId;
    const { phone } = req.body;

    if (!phone || phone.trim() === '') {
        return res.status(400).json({ error: 'Téléphone requis.' });
    }

    const digits = phone.replace(/\D/g, '');
    if (digits.length < 8) {
        return res.status(400).json({ error: 'Numéro invalide (8 chiffres minimum).' });
    }

    try {
        const result = await db.query('UPDATE users SET phone = $1 WHERE id = $2', [phone.trim(), userId]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Utilisateur non trouvé.' });
        }
        req.session.userPhone = phone.trim();
        res.json({ success: true, message: 'Téléphone mis à jour' });
    } catch (err) {
        console.error('❌ Erreur:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/client/update-password', isAuthenticated, async (req, res) => {
    const userId = req.session.userId;
    const { password } = req.body;

    if (!password || password.length !== 4 || !/^\d{4}$/.test(password)) {
        return res.status(400).json({ error: 'Mot de passe invalide (4 chiffres requis).' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await db.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, userId]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Utilisateur non trouvé.' });
        }
        res.json({ success: true, message: 'Mot de passe mis à jour' });
    } catch (error) {
        console.error('❌ Erreur:', error);
        res.status(500).json({ error: 'Erreur lors du hashage.' });
    }
});

// ========================================================
// ROUTES PAGES (CLIENT)
// ========================================================

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'client', 'html', 'dashboard.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'client', 'html', 'login.html'));
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'client', 'html', 'register.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'client', 'html', 'dashboard.html'));
});

app.get('/panier', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'client', 'html', 'panier.html'));
});

app.get('/searchproduct', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'client', 'html', 'searchproduct.html'));
});

app.get('/results', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'client', 'html', 'results.html'));
});

app.get('/infoproduit', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'client', 'html', 'infoproduit.html'));
});

app.get('/profil', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'client', 'html', 'profil.html'));
});

app.get('/passcommande', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'client', 'html', 'passcommande.html'));
});

app.get('/mescommandes', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'client', 'html', 'mescommandes.html'));
});

app.get('/detailcom', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'client', 'html', 'detailcom.html'));
});

app.get('/notification', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'client', 'html', 'notification.html'));
});

app.get('/payment-success', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'client', 'html', 'payment-success.html'));
});

app.get('/payment-failed', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'client', 'html', 'payment-failed.html'));
});

app.get('/paywithwave', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'client', 'html', 'paywithwave.html'));
});

// ============================================================
// ROUTES PAGES SELLER (servies par le client)
// ============================================================

app.get('/boutiques', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'seller', 'html', 'boutiques.html'));
});

app.get('/shop-user', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'seller', 'html', 'shop-user.html'));
});

// ========================================================
// ROUTES PAGES (ADMIN)
// ========================================================

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'html', 'login.html'));
});

app.get('/admin/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'html', 'login.html'));
});

app.get('/admin/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'html', 'register.html'));
});

app.get('/admin/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'html', 'dashboard.html'));
});

app.get('/admin/dashwave', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'html', 'dashwave.html'));
});

app.get('/admin/comm.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'html', 'comm.html'));
});

app.get('/admin/add-produit.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'html', 'produit.html'));
});

app.get('/admin/livraison.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'html', 'livraison.html'));
});

app.get('/admin/wave.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'html', 'wave.html'));
});

app.get('/admin/paiements.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'html', 'paiements.html'));
});

app.get('/admin/produits.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'html', 'produits.html'));
});

app.get('/admin/clients.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'html', 'clients.html'));
});

app.get('/admin/message.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'html', 'message.html'));
});

app.get('/admin/updates.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'html', 'updates.html'));
});

app.get('/admin/profil.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'html', 'profil.html'));
});

// ========================================================
// INITIALISATION DE LA BASE DE DONNÉES (AUTOMATIQUE)
// ========================================================

// ✅ Créer les tables au démarrage
(async function initDatabase() {
    try {
        console.log('🔄 Initialisation de la base de données...');
        await db.initialize();
        console.log('✅ Base de données initialisée avec succès');
    } catch (error) {
        console.error('❌ Erreur lors de l\'initialisation de la base:', error.message);
        // On continue quand même le démarrage, la base sera recréée au prochain redémarrage
    }
})();

// ========================================================
// DÉMARRAGE
// ========================================================

server.listen(PORT, () => {
    console.log(`========================================`);
    console.log(`🚀 SERVEUR CLIENT - Nature+ (Socket.IO + Redis)`);
    console.log(`📍 Port: ${PORT}`);
    console.log(`📍 http://localhost:${PORT}`);
    console.log(`========================================`);
});