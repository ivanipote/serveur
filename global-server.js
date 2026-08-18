const express = require('express');
const path = require('path');
const bcrypt = require('bcrypt');
const multer = require('multer');
const fs = require('fs');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const axios = require('axios');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3001;

// ========================================================
// CONFIGURATION GENIUS PAY
// ========================================================

const SECRET_KEY = 'ss_sandbox_B2RCD03octNvZPUD4zjcmGUGKbxqzTRzKHH1qf6e8TnlEQzP';
const PUBLIC_KEY = 'sk_sandbox_XpcqcXI54Gj537UMCqPpqPq5NTyxQ6oV';
const GENIUS_API_URL = 'https://geniuspay.ci/api/v1/merchant/payments';

// ========================================================
// CONFIGURATION UPLOAD
// ========================================================

const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
        cb(null, unique);
    }
});

const fileFilter = (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Seules les images sont autorisées'), false);
    }
};

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: fileFilter
});

app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// ========================================================
// MIDDLEWARE
// ========================================================

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ========================================================
// SESSIONS
// ========================================================

app.use(session({
    store: new SQLiteStore({
        db: 'sessions.db',
        dir: __dirname
    }),
    secret: 'natureplus-super-secret-key-2026',
    resave: false,
    saveUninitialized: false,
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

function createNotification(userId, commandeId, type, title, content) {
    db.run(
        `INSERT INTO messages (user_id, commande_id, type, title, content, is_read)
         VALUES (?, ?, ?, ?, ?, 0)`,
        [userId, commandeId, type, title, content],
        function(err) {
            if (err) {
                console.error('❌ Erreur création notification:', err);
            } else {
                console.log(`✅ Notification créée pour user ${userId}: ${title}`);
            }
        }
    );
}

// ========================================================
// ROUTES ADMIN - API
// ========================================================

// Inscription admin
app.post('/api/admin/register', async (req, res) => {
    console.log('📥 Inscription admin reçue');
    console.log('📦 Body:', req.body);

    const { merchantName, email, password, contact, logo } = req.body;

    if (!merchantName || !email || !password) {
        return res.status(400).json({ error: 'Nom, email et mot de passe requis.' });
    }

    if (password.length < 6) {
        return res.status(400).json({ error: 'Le mot de passe doit faire au moins 6 caractères.' });
    }

    try {
        const existingAdmin = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM admins WHERE email = ?', [email], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (existingAdmin) {
            return res.status(400).json({ error: 'Cet email est déjà utilisé.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO admins (email, password, merchant_name, logo, contact)
                 VALUES (?, ?, ?, ?, ?)`,
                [email, hashedPassword, merchantName, logo || null, contact || null],
                function(err) {
                    if (err) reject(err);
                    resolve({ id: this.lastID });
                }
            );
        });

        console.log('✅ Admin créé avec l\'ID:', result.id);
        res.json({
            success: true,
            message: 'Compte créé avec succès',
            adminId: result.id
        });

    } catch (error) {
        console.error('❌ Erreur inscription admin:', error);
        res.status(500).json({ error: 'Erreur lors de l\'inscription.' });
    }
});

// Connexion admin
app.post('/api/admin/login', async (req, res) => {
    console.log('📥 Connexion admin reçue');
    console.log('📦 Body:', req.body);

    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email et mot de passe requis.' });
    }

    try {
        const admin = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM admins WHERE email = ?', [email], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!admin) {
            return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
        }

        const isPasswordValid = await bcrypt.compare(password, admin.password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
        }

        console.log('✅ Admin connecté:', admin.email);
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

// ========================================================
// ROUTES ADMIN - PRODUITS
// ========================================================

app.get('/api/admin/products', (req, res) => {
    db.all('SELECT * FROM products ORDER BY created_at DESC', (err, rows) => {
        if (err) {
            console.error('Erreur:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

app.post('/api/admin/products', upload.fields([
    { name: 'image1', maxCount: 1 },
    { name: 'image2', maxCount: 1 }
]), (req, res) => {
    console.log('📥 Ajout produit reçu');
    console.log('📦 Body:', req.body);
    console.log('📎 Fichiers:', req.files);

    const { name, price, quantity, description } = req.body;

    if (!name || name.trim() === '') {
        return res.status(400).json({ error: 'Nom du produit requis.' });
    }

    const parsedPrice = parseInt(price);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
        return res.status(400).json({ error: 'Prix valide requis.' });
    }

    const image1 = req.files && req.files['image1'] ? `/uploads/${req.files['image1'][0].filename}` : '';
    const image2 = req.files && req.files['image2'] ? `/uploads/${req.files['image2'][0].filename}` : '';

    if (!image1) {
        return res.status(400).json({ error: 'Image 1 requise.' });
    }

    const adminId = 1;

    db.run(
        `INSERT INTO products (admin_id, name, price, quantity, image1, image2, description)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [adminId, name.trim(), parsedPrice, parseInt(quantity) || 0, image1, image2, description || ''],
        function(err) {
            if (err) {
                console.error('❌ Erreur DB:', err);
                return res.status(500).json({ error: err.message });
            }
            res.json({ success: true, id: this.lastID, message: 'Produit ajouté' });
        }
    );
});

app.delete('/api/admin/products/:id', (req, res) => {
    const { id } = req.params;
    db.run('DELETE FROM products WHERE id = ?', [id], function(err) {
        if (err) {
            console.error('❌ Erreur:', err);
            return res.status(500).json({ error: err.message });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Produit non trouvé' });
        }
        res.json({ success: true, message: 'Produit supprimé' });
    });
});

// ========================================================
// ROUTES ADMIN - STATISTIQUES
// ========================================================

app.get('/api/admin/stats', (req, res) => {
    const stats = { products: 0, sales: 0, clients: 0, payments: 0, commandes: 0 };

    db.get('SELECT COUNT(*) as count FROM products', (err, row) => {
        if (!err) stats.products = row ? row.count : 0;

        db.get('SELECT SUM(amount) as total FROM payments WHERE status = "success"', (err, row) => {
            if (!err) stats.sales = row && row.total ? row.total : 0;

            db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
                if (!err) stats.clients = row ? row.count : 0;

                db.get('SELECT COUNT(*) as count FROM payments', (err, row) => {
                    if (!err) stats.payments = row ? row.count : 0;

                    db.get('SELECT COUNT(*) as count FROM commandes', (err, row) => {
                        if (!err) stats.commandes = row ? row.count : 0;
                        res.json(stats);
                    });
                });
            });
        });
    });
});

// ========================================================
// ROUTES ADMIN - PAIEMENTS & CLIENTS
// ========================================================

app.get('/api/admin/payments', (req, res) => {
    db.all('SELECT * FROM payments ORDER BY created_at DESC', (err, rows) => {
        if (err) {
            console.error('❌ Erreur:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

app.get('/api/admin/clients', (req, res) => {
    db.all('SELECT * FROM users ORDER BY created_at DESC', (err, rows) => {
        if (err) {
            console.error('❌ Erreur:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// ========================================================
// ROUTES ADMIN - COMMANDES
// ========================================================

app.get('/api/admin/commandes', (req, res) => {
    db.all('SELECT * FROM commandes ORDER BY created_at DESC', (err, rows) => {
        if (err) {
            console.error('❌ Erreur:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

app.put('/api/admin/commande/status', (req, res) => {
    console.log('📥 Mise à jour statut commande');
    console.log('📦 Body:', req.body);

    const { commandeId, status, causeRefus } = req.body;

    if (!commandeId || !status) {
        return res.status(400).json({ error: 'commandeId et status requis.' });
    }

    db.get('SELECT user_id, nom FROM commandes WHERE id = ?', [commandeId], (err, commande) => {
        if (err) {
            console.error('❌ Erreur récupération commande:', err);
            return res.status(500).json({ error: err.message });
        }

        if (!commande) {
            return res.status(404).json({ error: 'Commande non trouvée.' });
        }

        const statusMessages = {
            'en_attente': { title: '⏳ Commande en attente', content: `Votre commande #${commandeId} est en attente de validation.` },
            'acceptee': { title: '✅ Commande acceptée', content: `Votre commande #${commandeId} a été acceptée et va être préparée.` },
            'refusee': { title: '❌ Commande refusée', content: `Votre commande #${commandeId} a été refusée. Motif : ${causeRefus || 'Non précisé'}` },
            'pret_livraison': { title: '📦 Commande prête', content: `Votre commande #${commandeId} est prête pour la livraison.` },
            'livraison_en_cours': { title: '🚚 Livraison en cours', content: `Votre commande #${commandeId} est en cours de livraison.` },
            'votre_colis_est_la': { title: '📍 Votre colis est arrivé', content: `Votre colis #${commandeId} est arrivé à destination !` },
            'payee': { title: '💳 Commande payée', content: `Le paiement de la commande #${commandeId} a été confirmé.` }
        };

        let content = statusMessages[status]?.content || `Statut mis à jour : ${status}`;
        if (status === 'refusee' && causeRefus) {
            content = `Votre commande #${commandeId} a été refusée. Motif : ${causeRefus}`;
        }

        let query = 'UPDATE commandes SET status = ? WHERE id = ?';
        let params = [status, commandeId];

        if (status === 'refusee' && causeRefus) {
            query = 'UPDATE commandes SET status = ?, cause_refus = ? WHERE id = ?';
            params = [status, causeRefus, commandeId];
        }

        db.run(query, params, function(err) {
            if (err) {
                console.error('❌ Erreur:', err);
                return res.status(500).json({ error: err.message });
            }

            if (this.changes === 0) {
                return res.status(404).json({ error: 'Commande non trouvée.' });
            }

            const title = statusMessages[status]?.title || `📋 Commande #${commandeId} mise à jour`;
            createNotification(
                commande.user_id,
                commandeId,
                'commande',
                title,
                content
            );

            res.json({ success: true, message: 'Statut mis à jour et notification envoyée' });
        });
    });
});

// ========================================================
// ROUTES ADMIN - FRAIS DE LIVRAISON
// ========================================================

app.get('/api/admin/livraison', (req, res) => {
    db.all('SELECT * FROM frais_livraison ORDER BY commune ASC', (err, rows) => {
        if (err) {
            console.error('❌ Erreur:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

app.post('/api/admin/livraison', (req, res) => {
    console.log('📥 Ajout commune reçu');
    console.log('📦 Body:', req.body);

    const { commune, tarif } = req.body;

    if (!commune || !tarif) {
        return res.status(400).json({ error: 'Commune et tarif requis.' });
    }

    db.run('INSERT INTO frais_livraison (commune, tarif) VALUES (?, ?)', [commune.trim(), tarif], function(err) {
        if (err) {
            console.error('❌ Erreur:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true, id: this.lastID, message: 'Commune ajoutée' });
    });
});

app.put('/api/admin/livraison/:id', (req, res) => {
    console.log('📥 Modification commune reçue');
    console.log('📦 Body:', req.body);

    const { id } = req.params;
    const { tarif } = req.body;

    if (!tarif) {
        return res.status(400).json({ error: 'Tarif requis.' });
    }

    db.run('UPDATE frais_livraison SET tarif = ? WHERE id = ?', [tarif, id], function(err) {
        if (err) {
            console.error('❌ Erreur:', err);
            return res.status(500).json({ error: err.message });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Commune non trouvée.' });
        }
        res.json({ success: true, message: 'Tarif mis à jour' });
    });
});

app.delete('/api/admin/livraison/:id', (req, res) => {
    console.log('📥 Suppression commune reçue');
    const { id } = req.params;

    db.run('DELETE FROM frais_livraison WHERE id = ?', [id], function(err) {
        if (err) {
            console.error('❌ Erreur:', err);
            return res.status(500).json({ error: err.message });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Commune non trouvée.' });
        }
        res.json({ success: true, message: 'Commune supprimée' });
    });
});

// ========================================================
// ROUTES CLIENT - AUTH
// ========================================================

app.post('/api/client/register', async (req, res) => {
    console.log('📥 Inscription client reçue');
    console.log('📦 Body:', req.body);

    const { name, email, phone, password } = req.body;

    if (!name || !email || !phone || !password) {
        return res.status(400).json({ error: 'Tous les champs sont requis.' });
    }

    if (password.length !== 4 || !/^\d{4}$/.test(password)) {
        return res.status(400).json({ error: 'Le mot de passe doit être un code à 4 chiffres.' });
    }

    try {
        const existingUser = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (existingUser) {
            return res.status(400).json({ error: 'Cet email est déjà utilisé.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO users (name, email, phone, password)
                 VALUES (?, ?, ?, ?)`,
                [name, email, phone, hashedPassword],
                function(err) {
                    if (err) reject(err);
                    resolve({ id: this.lastID });
                }
            );
        });

        console.log('✅ Client créé avec l\'ID:', result.id);
        res.json({
            success: true,
            message: 'Compte créé avec succès',
            userId: result.id
        });

    } catch (error) {
        console.error('❌ Erreur inscription client:', error);
        res.status(500).json({ error: 'Erreur lors de l\'inscription.' });
    }
});

app.post('/api/client/login', async (req, res) => {
    console.log('📥 Connexion client reçue');
    console.log('📦 Body:', req.body);

    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email et mot de passe requis.' });
    }

    try {
        const user = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

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

        console.log('✅ Client connecté:', user.email);
        console.log('🆔 Session ID:', req.session.id);
        
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
    console.log('🔍 Session ID:', req.session.id);
    console.log('👤 userId:', req.session.userId);
    
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

app.get('/api/client/user/:id', isAuthenticated, (req, res) => {
    const { id } = req.params;

    if (parseInt(id) !== req.session.userId) {
        return res.status(403).json({ error: 'Accès non autorisé.' });
    }

    db.get('SELECT id, name, email, phone FROM users WHERE id = ?', [id], (err, row) => {
        if (err) {
            console.error('❌ Erreur:', err);
            return res.status(500).json({ error: err.message });
        }
        if (!row) {
            return res.status(404).json({ error: 'Utilisateur non trouvé.' });
        }
        res.json({ success: true, user: row });
    });
});

app.post('/api/client/verify-code', isAuthenticated, async (req, res) => {
    console.log('📥 Vérification code reçue');
    console.log('📦 Body:', req.body);

    const { code } = req.body;
    const userId = req.session.userId;

    if (!userId || !code) {
        return res.status(400).json({ error: 'userId et code requis.' });
    }

    try {
        const user = await new Promise((resolve, reject) => {
            db.get('SELECT password FROM users WHERE id = ?', [userId], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

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

// ========================================================
// ROUTES CLIENT - PRODUITS (public)
// ========================================================

app.get('/api/products', (req, res) => {
    db.all('SELECT * FROM products ORDER BY created_at DESC', (err, rows) => {
        if (err) {
            console.error('Erreur:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// ========================================================
// ROUTES CLIENT - FRAIS DE LIVRAISON (public)
// ========================================================

app.get('/api/livraison/communes', (req, res) => {
    db.all('SELECT * FROM frais_livraison ORDER BY commune ASC', (err, rows) => {
        if (err) {
            console.error('❌ Erreur:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// ========================================================
// ROUTES CLIENT - PANIER
// ========================================================

app.post('/api/panier/add', isAuthenticated, (req, res) => {
    console.log('📥 Ajout au panier reçu');
    console.log('📦 Body:', req.body);

    const userId = req.session.userId;
    const { productId, quantity = 1 } = req.body;

    if (!productId) {
        return res.status(400).json({ error: 'productId requis.' });
    }

    db.get(
        'SELECT * FROM panier WHERE user_id = ? AND product_id = ?',
        [userId, productId],
        (err, row) => {
            if (err) {
                console.error('❌ Erreur:', err);
                return res.status(500).json({ error: err.message });
            }

            if (row) {
                db.run(
                    'UPDATE panier SET quantity = quantity + ? WHERE user_id = ? AND product_id = ?',
                    [quantity, userId, productId],
                    function(err) {
                        if (err) {
                            console.error('❌ Erreur:', err);
                            return res.status(500).json({ error: err.message });
                        }
                        res.json({ success: true, message: 'Quantité mise à jour' });
                    }
                );
            } else {
                db.run(
                    'INSERT INTO panier (user_id, product_id, quantity) VALUES (?, ?, ?)',
                    [userId, productId, quantity],
                    function(err) {
                        if (err) {
                            console.error('❌ Erreur:', err);
                            return res.status(500).json({ error: err.message });
                        }
                        res.json({ success: true, message: 'Produit ajouté au panier' });
                    }
                );
            }
        }
    );
});

app.get('/api/panier', isAuthenticated, (req, res) => {
    const userId = req.session.userId;

    db.all(
        `SELECT p.id, p.name, p.price, p.image1, p.image2, 
                panier.quantity, panier.product_id
         FROM panier 
         JOIN products p ON panier.product_id = p.id 
         WHERE panier.user_id = ?`,
        [userId],
        (err, rows) => {
            if (err) {
                console.error('❌ Erreur:', err);
                return res.status(500).json({ error: err.message });
            }
            res.json({ success: true, panier: rows });
        }
    );
});

app.get('/api/panier/count', isAuthenticated, (req, res) => {
    const userId = req.session.userId;

    db.get(
        'SELECT SUM(quantity) as total FROM panier WHERE user_id = ?',
        [userId],
        (err, row) => {
            if (err) {
                console.error('❌ Erreur:', err);
                return res.status(500).json({ error: err.message });
            }
            const count = row?.total || 0;
            res.json({ success: true, count: count });
        }
    );
});

app.delete('/api/panier/remove', isAuthenticated, (req, res) => {
    console.log('📥 Suppression du panier reçue');
    console.log('📦 Body:', req.body);

    const userId = req.session.userId;
    const { productId } = req.body;

    if (!productId) {
        return res.status(400).json({ error: 'productId requis.' });
    }

    db.run(
        'DELETE FROM panier WHERE user_id = ? AND product_id = ?',
        [userId, productId],
        function(err) {
            if (err) {
                console.error('❌ Erreur DB:', err);
                return res.status(500).json({ error: err.message });
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Article non trouvé dans le panier.' });
            }
            res.json({ success: true, message: 'Produit retiré du panier' });
        }
    );
});

app.delete('/api/panier/clear', isAuthenticated, (req, res) => {
    console.log('📥 Vidage du panier reçu');
    console.log('📦 Body:', req.body);

    const userId = req.session.userId;

    db.run(
        'DELETE FROM panier WHERE user_id = ?',
        [userId],
        function(err) {
            if (err) {
                console.error('❌ Erreur DB:', err);
                return res.status(500).json({ error: err.message });
            }
            res.json({ success: true, message: 'Panier vidé avec succès' });
        }
    );
});

app.post('/api/panier/update', isAuthenticated, (req, res) => {
    console.log('📥 Mise à jour panier reçue');
    console.log('📦 Body:', req.body);

    const userId = req.session.userId;
    const { productId, quantity } = req.body;

    if (!productId || quantity === undefined) {
        return res.status(400).json({ error: 'productId et quantity requis.' });
    }

    if (quantity <= 0) {
        db.run(
            'DELETE FROM panier WHERE user_id = ? AND product_id = ?',
            [userId, productId],
            function(err) {
                if (err) {
                    console.error('❌ Erreur:', err);
                    return res.status(500).json({ error: err.message });
                }
                res.json({ success: true, message: 'Produit retiré' });
            }
        );
    } else {
        db.run(
            'UPDATE panier SET quantity = ? WHERE user_id = ? AND product_id = ?',
            [quantity, userId, productId],
            function(err) {
                if (err) {
                    console.error('❌ Erreur:', err);
                    return res.status(500).json({ error: err.message });
                }
                res.json({ success: true, message: 'Quantité mise à jour' });
            }
        );
    }
});

// ========================================================
// ROUTES CLIENT - COMMANDES
// ========================================================

app.post('/api/commande/create', isAuthenticated, (req, res) => {
    console.log('📥 Création commande reçue');
    console.log('📦 Body:', req.body);

    const userId = req.session.userId;
    const { panier, total, nom, telephone, codeLogin, option, commune, fraisLivraison, quartier, precision, latitude, longitude } = req.body;

    if (!panier || !total || !nom || !telephone || !codeLogin) {
        return res.status(400).json({ error: 'Données manquantes.' });
    }

    // Générer une référence unique
    const generateReference = () => {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const random = Math.floor(Math.random() * 99999).toString().padStart(5, '0');
        return `NAT-${year}${month}${day}-${random}`;
    };

    const reference = generateReference();

    // Vérifier que la référence est unique
    db.get('SELECT id FROM commandes WHERE reference = ?', [reference], (err, row) => {
        if (err) {
            console.error('❌ Erreur vérification référence:', err);
            return res.status(500).json({ error: err.message });
        }

        let finalRef = reference;
        if (row) {
            const random2 = Math.floor(Math.random() * 99999).toString().padStart(5, '0');
            finalRef = `NAT-${year}${month}${day}-${random2}`;
        }

        db.run(
            `INSERT INTO commandes (
                reference, user_id, panier, total, nom, telephone, code_login,
                option, commune, frais_livraison, quartier, precision, latitude, longitude, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                finalRef, userId, panier, total, nom, telephone, codeLogin, 
                option, commune || null, fraisLivraison || 0, 
                quartier || null, precision || null, latitude || null, longitude || null, 
                'en_attente'
            ],
            function(err) {
                if (err) {
                    console.error('❌ Erreur DB:', err);
                    return res.status(500).json({ error: err.message });
                }

                const commandeId = this.lastID;

                createNotification(
                    userId,
                    commandeId,
                    'commande',
                    '📋 Commande créée',
                    `Votre commande #${commandeId} (${finalRef}) a été créée avec succès.`
                );

                res.json({
                    success: true,
                    id: commandeId,
                    reference: finalRef,
                    message: 'Commande créée avec succès'
                });
            }
        );
    });
});

app.get('/api/commandes', isAuthenticated, (req, res) => {
    const userId = req.session.userId;
    
    db.all(
        `SELECT c.*, p.genius_reference 
         FROM commandes c
         LEFT JOIN payments p ON p.commande_id = c.id
         WHERE c.user_id = ? 
         ORDER BY c.created_at DESC`,
        [userId],
        (err, rows) => {
            if (err) {
                console.error('❌ Erreur:', err);
                return res.status(500).json({ error: err.message });
            }
            console.log(`✅ ${rows.length} commandes trouvées`);
            res.json(rows);
        }
    );
});

app.post('/api/commande/cancel', isAuthenticated, (req, res) => {
    console.log('📥 Annulation commande reçue');
    console.log('📦 Body:', req.body);

    const userId = req.session.userId;
    const { commandeId } = req.body;

    if (!commandeId) {
        return res.status(400).json({ error: 'commandeId requis.' });
    }

    db.get(
        'SELECT id FROM commandes WHERE id = ? AND user_id = ?',
        [commandeId, userId],
        (err, row) => {
            if (err) {
                console.error('❌ Erreur:', err);
                return res.status(500).json({ error: err.message });
            }
            if (!row) {
                return res.status(404).json({ error: 'Commande non trouvée.' });
            }

            db.run(
                'UPDATE commandes SET status = "annulee" WHERE id = ?',
                [commandeId],
                function(err) {
                    if (err) {
                        console.error('❌ Erreur:', err);
                        return res.status(500).json({ error: err.message });
                    }
                    res.json({ success: true, message: 'Commande annulée' });
                }
            );
        }
    );
});

app.delete('/api/commande/delete/:id', isAuthenticated, (req, res) => {
    const { id } = req.params;
    const userId = req.session.userId;

    db.get(
        'SELECT status FROM commandes WHERE id = ? AND user_id = ?',
        [id, userId],
        (err, row) => {
            if (err) {
                console.error('❌ Erreur:', err);
                return res.status(500).json({ error: err.message });
            }
            if (!row) {
                return res.status(404).json({ error: 'Commande non trouvée.' });
            }

            if (row.status !== 'refusee' && row.status !== 'annulee') {
                return res.status(400).json({ error: 'Cette commande ne peut pas être supprimée.' });
            }

            db.run('DELETE FROM commandes WHERE id = ?', [id], function(err) {
                if (err) {
                    console.error('❌ Erreur:', err);
                    return res.status(500).json({ error: err.message });
                }
                res.json({ success: true, message: 'Commande supprimée' });
            });
        }
    );
});

// ========================================================
// ROUTES CLIENT - NOTIFICATIONS
// ========================================================

app.get('/api/notifications', isAuthenticated, (req, res) => {
    const userId = req.session.userId;

    db.all(
        `SELECT * FROM messages 
         WHERE user_id = ? 
         ORDER BY is_read ASC, created_at DESC`,
        [userId],
        (err, rows) => {
            if (err) {
                console.error('❌ Erreur notifications:', err);
                return res.status(500).json({ error: err.message });
            }
            const unreadCount = rows.filter(r => r.is_read === 0).length;
            console.log(`✅ ${rows.length} notifications trouvées (${unreadCount} non lues)`);
            res.json({
                success: true,
                count: unreadCount,
                notifications: rows
            });
        }
    );
});

app.get('/api/notifications/count', isAuthenticated, (req, res) => {
    const userId = req.session.userId;

    db.get(
        'SELECT COUNT(*) as count FROM messages WHERE user_id = ? AND is_read = 0',
        [userId],
        (err, row) => {
            if (err) {
                console.error('❌ Erreur:', err);
                return res.status(500).json({ error: err.message });
            }
            res.json({ success: true, count: row?.count || 0 });
        }
    );
});

app.put('/api/notifications/read/:id', isAuthenticated, (req, res) => {
    const { id } = req.params;
    const userId = req.session.userId;

    db.run(
        'UPDATE messages SET is_read = 1 WHERE id = ? AND user_id = ?',
        [id, userId],
        function(err) {
            if (err) {
                console.error('❌ Erreur:', err);
                return res.status(500).json({ error: err.message });
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Notification non trouvée.' });
            }
            res.json({ success: true, message: 'Notification marquée comme lue' });
        }
    );
});

app.put('/api/notifications/read-all', isAuthenticated, (req, res) => {
    const userId = req.session.userId;

    db.run(
        'UPDATE messages SET is_read = 1 WHERE user_id = ?',
        [userId],
        function(err) {
            if (err) {
                console.error('❌ Erreur:', err);
                return res.status(500).json({ error: err.message });
            }
            res.json({ success: true, message: 'Toutes les notifications marquées comme lues' });
        }
    );
});

app.delete('/api/notifications/delete/:id', isAuthenticated, (req, res) => {
    const { id } = req.params;
    const userId = req.session.userId;

    db.run(
        'DELETE FROM messages WHERE id = ? AND user_id = ?',
        [id, userId],
        function(err) {
            if (err) {
                console.error('❌ Erreur:', err);
                return res.status(500).json({ error: err.message });
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Notification non trouvée.' });
            }
            res.json({ success: true, message: 'Notification supprimée' });
        }
    );
});

// ========================================================
// ROUTES CLIENT - PROFIL
// ========================================================

app.post('/api/client/update-name', isAuthenticated, async (req, res) => {
    console.log('📥 Mise à jour nom reçue');
    const userId = req.session.userId;
    const { name } = req.body;

    if (!name || name.trim() === '') {
        return res.status(400).json({ error: 'Nom requis.' });
    }

    db.run('UPDATE users SET name = ? WHERE id = ?', [name.trim(), userId], function(err) {
        if (err) {
            console.error('❌ Erreur:', err);
            return res.status(500).json({ error: err.message });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Utilisateur non trouvé.' });
        }
        req.session.userName = name.trim();
        res.json({ success: true, message: 'Nom mis à jour' });
    });
});

app.post('/api/client/update-email', isAuthenticated, async (req, res) => {
    console.log('📥 Mise à jour email reçue');
    const userId = req.session.userId;
    const { email } = req.body;

    if (!email || email.trim() === '') {
        return res.status(400).json({ error: 'Email requis.' });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Email invalide.' });
    }

    db.run('UPDATE users SET email = ? WHERE id = ?', [email.trim(), userId], function(err) {
        if (err) {
            console.error('❌ Erreur:', err);
            return res.status(500).json({ error: err.message });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Utilisateur non trouvé.' });
        }
        req.session.userEmail = email.trim();
        res.json({ success: true, message: 'Email mis à jour' });
    });
});

app.post('/api/client/update-phone', isAuthenticated, async (req, res) => {
    console.log('📥 Mise à jour téléphone reçue');
    const userId = req.session.userId;
    const { phone } = req.body;

    if (!phone || phone.trim() === '') {
        return res.status(400).json({ error: 'Téléphone requis.' });
    }

    const digits = phone.replace(/\D/g, '');
    if (digits.length < 8) {
        return res.status(400).json({ error: 'Numéro invalide (8 chiffres minimum).' });
    }

    db.run('UPDATE users SET phone = ? WHERE id = ?', [phone.trim(), userId], function(err) {
        if (err) {
            console.error('❌ Erreur:', err);
            return res.status(500).json({ error: err.message });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Utilisateur non trouvé.' });
        }
        req.session.userPhone = phone.trim();
        res.json({ success: true, message: 'Téléphone mis à jour' });
    });
});

app.post('/api/client/update-password', isAuthenticated, async (req, res) => {
    console.log('📥 Mise à jour mot de passe reçue');
    const userId = req.session.userId;
    const { password } = req.body;

    if (!password || password.length !== 4 || !/^\d{4}$/.test(password)) {
        return res.status(400).json({ error: 'Mot de passe invalide (4 chiffres requis).' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        db.run('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId], function(err) {
            if (err) {
                console.error('❌ Erreur:', err);
                return res.status(500).json({ error: err.message });
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Utilisateur non trouvé.' });
            }
            res.json({ success: true, message: 'Mot de passe mis à jour' });
        });
    } catch (error) {
        console.error('❌ Erreur:', error);
        res.status(500).json({ error: 'Erreur lors du hashage.' });
    }
});

// ========================================================
// ROUTES PAIEMENT (Genius Pay)
// ========================================================

app.post('/api/payment/create', async (req, res) => {
    console.log('📥 Requête paiement reçue');
    console.log('📦 Body:', req.body);

    const { commandeId, reference, amount, phone, description } = req.body;

    if (!commandeId) {
        return res.status(400).json({ error: 'commandeId requis.' });
    }
    if (!phone) {
        return res.status(400).json({ error: 'Numéro de téléphone requis.' });
    }
    if (!amount || amount <= 0) {
        return res.status(400).json({ error: 'Montant invalide.' });
    }

    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 8) {
        return res.status(400).json({ error: 'Numéro de téléphone invalide.' });
    }

    try {
        const paymentRef = reference || `PAY-${commandeId}-${Date.now()}`;

        const payload = {
            amount: amount,
            currency: 'XOF',
            description: description || `Commande Nature+ #${commandeId} (${reference})`,
            customer: {
                phone: cleanPhone
            },
            method: 'WAVE',
            // ✅ URLS DE RETOUR VERS GITHUB PAGES
            successUrl: `https://ivanipote.github.io/success/?commande_id=${commandeId}`,
            errorUrl: `https://ivanipote.github.io/success/failed.html?commande_id=${commandeId}`
        };

        console.log('📤 Envoi à Genius Pay...');
        console.log('📤 Payload:', JSON.stringify(payload, null, 2));

        const response = await axios.post(GENIUS_API_URL, payload, {
            headers: {
                'X-API-Key': PUBLIC_KEY,
                'X-API-Secret': SECRET_KEY,
                'Content-Type': 'application/json'
            }
        });

        console.log('✅ Réponse Genius Pay:', response.data);

        const paymentData = response.data;

        const geniusReference = paymentData.data?.reference || paymentData.reference || `GENUS_${Date.now()}`;
        const checkoutUrl = paymentData.data?.checkout_url || paymentData.checkout_url || null;

        db.run(
            `INSERT INTO payments (user_id, product_id, reference, genius_reference, amount, status, checkout_url, commande_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [0, 0, paymentRef, geniusReference, amount, 'pending', checkoutUrl, commandeId],
            function(err) {
                if (err) {
                    console.error('❌ Erreur sauvegarde payment:', err);
                } else {
                    console.log('✅ Payment enregistré avec ID:', this.lastID);
                    console.log('✅ Genius Reference:', geniusReference);
                }
            }
        );

        db.run(
            `UPDATE commandes SET status = 'paiement_en_cours' WHERE id = ?`,
            [commandeId],
            function(err) {
                if (err) {
                    console.error('❌ Erreur mise à jour commande:', err);
                } else {
                    console.log(`✅ Commande #${commandeId} : statut -> paiement_en_cours`);
                }
            }
        );

        res.json({
            success: true,
            checkout_url: checkoutUrl,
            reference: paymentRef,
            genius_reference: geniusReference,
            message: 'Paiement créé avec succès'
        });

    } catch (error) {
        console.error('❌ Erreur paiement:', error);

        let errorMessage = 'Erreur lors de la création du paiement.';
        let details = null;

        if (error.response) {
            console.error('📄 Status:', error.response.status);
            console.error('📄 Data:', error.response.data);
            errorMessage = error.response.data?.message || error.response.data?.error || errorMessage;
            details = error.response.data;
        } else if (error.request) {
            errorMessage = 'Impossible de contacter le service de paiement.';
        } else {
            errorMessage = error.message;
        }

        res.status(500).json({
            success: false,
            error: errorMessage,
            details: details
        });
    }
});

app.post('/api/payment/update-status', (req, res) => {
    const { commandeId, status, cause } = req.body;

    console.log(`📥 Mise à jour statut commande #${commandeId} → ${status}`);

    if (!commandeId || !status) {
        return res.status(400).json({ error: 'commandeId et status requis.' });
    }

    let query = 'UPDATE commandes SET status = ? WHERE id = ?';
    let params = [status, commandeId];

    if (status === 'annulee' && cause) {
        query = 'UPDATE commandes SET status = ?, cause_refus = ? WHERE id = ?';
        params = [status, cause, commandeId];
    }

    db.run(query, params, function(err) {
        if (err) {
            console.error('❌ Erreur:', err);
            return res.status(500).json({ error: err.message });
        }

        if (this.changes === 0) {
            return res.status(404).json({ error: 'Commande non trouvée.' });
        }

        console.log(`✅ Commande #${commandeId} : statut -> ${status}`);

        const paymentStatus = status === 'payee' ? 'success' : 'canceled';
        db.run(
            `UPDATE payments SET status = ? WHERE commande_id = ?`,
            [paymentStatus, commandeId],
            function(err) {
                if (err) {
                    console.error('❌ Erreur mise à jour payment:', err);
                } else {
                    console.log(`✅ Payment pour commande #${commandeId} : statut -> ${paymentStatus}`);
                }
            }
        );

        db.get(
            `SELECT user_id FROM commandes WHERE id = ?`,
            [commandeId],
            (err, row) => {
                if (err || !row) return;
                
                const title = status === 'payee' ? '💳 Paiement confirmé' : '⏰ Paiement annulé';
                const content = status === 'payee' 
                    ? `Votre paiement pour la commande #${commandeId} a été confirmé.`
                    : `Le paiement pour la commande #${commandeId} a été annulé.`;
                
                createNotification(row.user_id, commandeId, 'paiement', title, content);
            }
        );

        res.json({ success: true, message: `Statut mis à jour : ${status}` });
    });
});

app.post('/api/payment/cancel', (req, res) => {
    const { commandeId } = req.body;

    console.log(`📥 Annulation manuelle paiement #${commandeId}`);

    if (!commandeId) {
        return res.status(400).json({ error: 'commandeId requis.' });
    }

    db.get(
        'SELECT status, user_id FROM commandes WHERE id = ?',
        [commandeId],
        (err, row) => {
            if (err) {
                console.error('❌ Erreur:', err);
                return res.status(500).json({ error: err.message });
            }
            if (!row) {
                return res.status(404).json({ error: 'Commande non trouvée.' });
            }
            if (row.status !== 'paiement_en_cours') {
                return res.status(400).json({ error: 'Cette commande ne peut pas être annulée.' });
            }

            db.run(
                `UPDATE commandes SET status = 'annulee', cause_refus = 'Annulé par le client' WHERE id = ?`,
                [commandeId],
                function(err) {
                    if (err) {
                        console.error('❌ Erreur:', err);
                        return res.status(500).json({ error: err.message });
                    }

                    db.run(
                        `UPDATE payments SET status = 'canceled' WHERE commande_id = ?`,
                        [commandeId]
                    );

                    createNotification(
                        row.user_id,
                        commandeId,
                        'paiement',
                        '❌ Paiement annulé',
                        `Vous avez annulé le paiement pour la commande #${commandeId}.`
                    );

                    console.log(`✅ Commande #${commandeId} annulée manuellement`);
                    res.json({ success: true, message: 'Paiement annulé avec succès' });
                }
            );
        }
    );
});

app.post('/api/payment/webhook', async (req, res) => {
    console.log('🔔 Webhook reçu');
    console.log('📦 Body:', req.body);

    res.status(200).json({ status: 'ok' });

    const { reference, status, amount, customer } = req.body;

    if (!reference) {
        console.warn('⚠️ Webhook sans référence');
        return;
    }

    try {
        let newStatus = 'pending';
        let notificationTitle = '';
        let notificationContent = '';
        let notificationType = 'paiement';

        if (status === 'success') {
            newStatus = 'success';
            notificationTitle = '💳 Paiement réussi';
            notificationContent = `Le paiement de votre commande a été confirmé avec succès.`;
        } else if (status === 'failed' || status === 'expired') {
            newStatus = 'failed';
            notificationTitle = '❌ Paiement échoué';
            notificationContent = `Le paiement de votre commande a échoué ou a expiré. Veuillez réessayer.`;
        } else if (status === 'canceled' || status === 'cancelled') {
            newStatus = 'canceled';
            notificationTitle = '⏰ Paiement annulé';
            notificationContent = `Le paiement de votre commande a été annulé.`;
        } else {
            newStatus = status || 'pending';
        }

        db.run(
            `UPDATE payments SET status = ? WHERE reference = ?`,
            [newStatus, reference],
            function(err) {
                if (err) {
                    console.error('❌ Erreur mise à jour payment:', err);
                } else {
                    console.log(`✅ Payment ${reference} : statut -> ${newStatus}`);
                }
            }
        );

        db.get(
            `SELECT c.id, c.user_id, c.total, c.nom 
             FROM commandes c
             JOIN payments p ON p.commande_id = c.id
             WHERE p.reference = ?`,
            [reference],
            (err, row) => {
                if (err) {
                    console.error('❌ Erreur recherche commande:', err);
                    return;
                }

                if (row) {
                    let commandeStatus = '';

                    if (status === 'success') {
                        commandeStatus = 'payee';
                        notificationTitle = '💳 Paiement réussi';
                        notificationContent = `Le paiement de ${row.total.toLocaleString()} FCFA pour la commande #${row.id} a été confirmé.`;
                    } else if (status === 'canceled' || status === 'cancelled') {
                        commandeStatus = 'annulee';
                        notificationTitle = '⏰ Paiement annulé';
                        notificationContent = `Le paiement pour la commande #${row.id} a été annulé.`;
                    } else if (status === 'failed' || status === 'expired') {
                        commandeStatus = 'annulee';
                        notificationTitle = '❌ Paiement échoué';
                        notificationContent = `Le paiement de ${row.total.toLocaleString()} FCFA pour la commande #${row.id} a échoué. Veuillez réessayer.`;
                    } else {
                        commandeStatus = 'en_attente';
                        notificationTitle = '⏳ Paiement en attente';
                        notificationContent = `Le paiement pour la commande #${row.id} est en attente de confirmation.`;
                    }

                    db.run(
                        `UPDATE commandes SET status = ? WHERE id = ?`,
                        [commandeStatus, row.id],
                        function(err) {
                            if (err) {
                                console.error('❌ Erreur mise à jour commande:', err);
                            } else {
                                console.log(`✅ Commande #${row.id} : statut -> ${commandeStatus}`);
                                
                                createNotification(
                                    row.user_id,
                                    row.id,
                                    notificationType,
                                    notificationTitle,
                                    notificationContent
                                );
                            }
                        }
                    );
                } else {
                    console.warn(`⚠️ Aucune commande trouvée pour la référence ${reference}`);
                }
            }
        );

    } catch (error) {
        console.error('❌ Erreur webhook:', error);
    }
});

app.post('/api/commande/restore/:id', (req, res) => {
    const { id } = req.params;

    db.get('SELECT status, user_id FROM commandes WHERE id = ?', [id], (err, row) => {
        if (err) {
            console.error('❌ Erreur:', err);
            return res.status(500).json({ error: err.message });
        }
        if (!row) {
            return res.status(404).json({ error: 'Commande non trouvée.' });
        }
        if (row.status !== 'annulee') {
            return res.status(400).json({ error: 'Seules les commandes annulées peuvent être restaurées.' });
        }

        db.run(
            'UPDATE commandes SET status = "en_attente" WHERE id = ?',
            [id],
            function(err) {
                if (err) {
                    console.error('❌ Erreur:', err);
                    return res.status(500).json({ error: err.message });
                }
                
                db.run(
                    `DELETE FROM payments WHERE commande_id = ?`,
                    [id]
                );
                
                createNotification(
                    row.user_id,
                    id,
                    'commande',
                    '🔄 Commande restaurée',
                    `Votre commande #${id} a été restaurée et est de nouveau en attente.`
                );
                
                res.json({ success: true, message: 'Commande restaurée' });
            }
        );
    });
});

app.get('/api/payment/status/:reference', (req, res) => {
    const { reference } = req.params;

    db.get(
        'SELECT * FROM payments WHERE reference = ?',
        [reference],
        (err, row) => {
            if (err) {
                console.error('❌ Erreur:', err);
                return res.status(500).json({ error: err.message });
            }
            if (!row) {
                return res.status(404).json({ error: 'Paiement non trouvé.' });
            }
            res.json({
                success: true,
                payment: {
                    reference: row.reference,
                    amount: row.amount,
                    status: row.status,
                    created_at: row.created_at,
                    commande_id: row.commande_id
                }
            });
        }
    );
});

// ========================================================
// ROUTES : VÉRIFIER LE STATUT D'UN PAIEMENT CHEZ GENIUS PAY
// ========================================================

app.get('/api/payment/check/:reference', async (req, res) => {
    const { reference } = req.params;

    console.log(`🔍 Vérification paiement référence: ${reference}`);

    if (!reference) {
        return res.status(400).json({ error: 'Référence requise.' });
    }

    // Si la référence est un nombre (ID de commande), on vérifie dans la base
    if (/^\d+$/.test(reference)) {
        console.log('ℹ️ Référence numérique détectée, vérification dans la base de données');
        
        db.get(
            'SELECT * FROM payments WHERE commande_id = ?',
            [reference],
            (err, row) => {
                if (err) {
                    return res.status(500).json({ success: false, error: err.message });
                }
                if (!row) {
                    return res.json({ success: true, status: 'not_found', message: 'Aucun paiement trouvé pour cette commande' });
                }
                return res.json({
                    success: true,
                    status: row.status || 'pending',
                    source: 'database'
                });
            }
        );
        return;
    }

    try {
        const response = await axios.get(
            `https://geniuspay.ci/api/v1/merchant/payments/${reference}`,
            {
                headers: {
                    'X-API-Key': PUBLIC_KEY,
                    'X-API-Secret': SECRET_KEY
                }
            }
        );

        const status = response.data?.data?.status || response.data?.status || 'unknown';

        console.log(`📊 Statut récupéré: ${status}`);

        res.json({
            success: true,
            status: status,
            data: response.data
        });
    } catch (error) {
        console.error('❌ Erreur vérification:', error.message);
        
        if (error.response) {
            console.error('📄 Status:', error.response.status);
            console.error('📄 Data:', error.response.data);
        }

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ========================================================
// ROUTES PAGES (CLIENT)
// ========================================================

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'client', 'html', 'mescommandes.html'));
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

// ========================================================
// DÉMARRAGE
// ========================================================

app.listen(PORT, () => {
    console.log(`========================================`);
    console.log(`🚀 SERVEUR UNIQUE - Nature+ (Global)`);
    console.log(`📍 Port: ${PORT}`);
    console.log(`📍 http://localhost:${PORT}`);
    console.log(`📍 Client: http://localhost:${PORT}/login`);
    console.log(`📍 Admin: http://localhost:${PORT}/admin/login`);
    console.log(`📍 Paiement webhook: http://localhost:${PORT}/api/payment/webhook`);
    console.log(`📍 Vérification: http://localhost:${PORT}/api/payment/check/:reference`);
    console.log(`🔗 URLs de retour Genius Pay: https://ivanipote.github.io/success/`);
    console.log(`========================================`);
});