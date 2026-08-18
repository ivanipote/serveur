const express = require('express');
const path = require('path');
const bcrypt = require('bcrypt');
const db = require('./database');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);

const app = express();
const PORT = 3001;

// ========================================================
// MIDDLEWARE
// ========================================================

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ========================================================
// CONFIGURATION DES SESSIONS
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
// MIDDLEWARE : VÉRIFIER L'AUTHENTIFICATION
// ========================================================

function isAuthenticated(req, res, next) {
    console.log('🔍 Vérification session:', req.session);
    console.log('🔍 Session ID:', req.session.id);
    console.log('🔍 userId:', req.session.userId);
    
    if (req.session.userId) {
        next();
    } else {
        res.status(401).json({ error: 'Non authentifié' });
    }
}

// ========================================================
// ROUTES API CLIENT
// ========================================================

// Inscription client
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

// Connexion client
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

        // Créer la session
        req.session.userId = user.id;
        req.session.userName = user.name;
        req.session.userEmail = user.email;
        req.session.userPhone = user.phone;

        console.log('✅ Session créée pour userId:', req.session.userId);
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

// Déconnexion
app.post('/api/client/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('❌ Erreur déconnexion:', err);
            return res.status(500).json({ error: 'Erreur lors de la déconnexion.' });
        }
        res.json({ success: true, message: 'Déconnecté' });
    });
});

// Récupérer l'utilisateur connecté
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

// Récupérer infos utilisateur
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

// Vérification code secret
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
// ROUTES PRODUITS (publique)
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
// ROUTES PANIER (protégées)
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
// ROUTES FRAIS DE LIVRAISON (publique)
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
// ROUTES COMMANDES (protégées)
// ========================================================

app.post('/api/commande/create', isAuthenticated, (req, res) => {
    console.log('📥 Création commande reçue');
    console.log('📦 Body:', req.body);

    const userId = req.session.userId;
    const { panier, total, nom, telephone, codeLogin, option, commune, fraisLivraison, quartier, precision, latitude, longitude } = req.body;

    if (!panier || !total || !nom || !telephone || !codeLogin) {
        return res.status(400).json({ error: 'Données manquantes.' });
    }

    db.run(
        `INSERT INTO commandes (
            user_id, panier, total, nom, telephone, code_login,
            option, commune, frais_livraison, quartier, precision, latitude, longitude, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, panier, total, nom, telephone, codeLogin, option, commune || null, fraisLivraison || 0, quartier || null, precision || null, latitude || null, longitude || null, 'en_attente'],
        function(err) {
            if (err) {
                console.error('❌ Erreur DB:', err);
                return res.status(500).json({ error: err.message });
            }
            res.json({ success: true, id: this.lastID, message: 'Commande créée avec succès' });
        }
    );
});

// Récupérer les commandes de l'utilisateur connecté
app.get('/api/commandes', isAuthenticated, (req, res) => {
    const userId = req.session.userId;
    db.all('SELECT * FROM commandes WHERE user_id = ? ORDER BY created_at DESC', [userId], (err, rows) => {
        if (err) {
            console.error('❌ Erreur:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// Annuler une commande
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

// Supprimer une commande
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
// ROUTES NOTIFICATIONS (protégées)
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
// ROUTES MISE À JOUR PROFIL (protégées)
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
// ROUTES PAGES CLIENT
// ========================================================

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'client', 'html', 'login.html'));
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

// ========================================================
// DÉMARRAGE
// ========================================================

app.listen(PORT, () => {
    console.log(`========================================`);
    console.log(`🚀 SERVEUR CLIENT - Nature+ (avec sessions)`);
    console.log(`📍 Port: ${PORT}`);
    console.log(`📍 http://localhost:${PORT}`);
    console.log(`📍 Login: http://localhost:${PORT}/login`);
    console.log(`📍 Register: http://localhost:${PORT}/register`);
    console.log(`📍 Dashboard: http://localhost:${PORT}/dashboard`);
    console.log(`📍 Panier: http://localhost:${PORT}/panier`);
    console.log(`📍 Profil: http://localhost:${PORT}/profil`);
    console.log(`📍 Mes commandes: http://localhost:${PORT}/mescommandes`);
    console.log(`📍 Notifications: http://localhost:${PORT}/notification`);
    console.log(`📍 Paiement succès: http://localhost:3001/payment-success`);
    console.log(`📍 Paiement échec: http://localhost:3001/payment-failed`);
    console.log(`========================================`);
});