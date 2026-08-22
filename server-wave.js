// ✅ FORCER LE FUSEAU HORAIRE À UTC+0 (Côte d'Ivoire)
process.env.TZ = 'Africa/Abidjan';

const express = require('express');
const { Server } = require('socket.io');
const Redis = require('ioredis');
const { createAdapter } = require('@socket.io/redis-adapter');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3004;

// ========================================================
// REDIS - Connexion
// ========================================================

const redisClient = new Redis(process.env.REDIS_URL, {
    tls: {},
    retryStrategy: (times) => Math.min(times * 50, 2000)
});

redisClient.on('connect', () => console.log('✅ Redis (wave) connecté'));
redisClient.on('error', (err) => console.error('❌ Redis erreur:', err));

const pubClient = redisClient.duplicate();
const subClient = redisClient.duplicate();

// ========================================================
// SOCKET.IO
// ========================================================

const io = new Server({
    cors: {
        origin: ['https://nature-plus-client.onrender.com', 'http://localhost:3000', 'http://localhost:3001'],
        credentials: true
    },
    adapter: createAdapter(pubClient, subClient)
});

io.listen(3005);

io.on('connection', (sock) => {
    console.log('✅ Socket.IO (wave) connecté');
    sock.on('disconnect', () => {
        console.log('❌ Socket.IO (wave) déconnecté');
    });
});

// ========================================================
// MIDDLEWARE
// ========================================================

app.use(express.json());

// CORS complet
app.use((req, res, next) => {
    const allowedOrigins = [
        'https://nature-plus-client.onrender.com',
        'https://nature-plus-pay.onrender.com',
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:3002'
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

console.log('🌊 SERVEUR WAVE PAY - DÉMARRAGE');

// ========================================================
// ROUTES
// ========================================================

// ROUTE RACINE
app.get('/', (req, res) => {
    res.status(200).json({
        service: 'Nature+ Wave Pay',
        status: 'online',
        version: '1.0.0',
        endpoints: {
            health: '/health',
            verify: 'POST /api/wave/verify',
            requests: 'GET /api/wave/requests',
            validate: 'POST /api/wave/validate',
            status: 'GET /api/wave/status/:commande_id',
            history: 'GET /api/wave/history'
        }
    });
});

// ROUTE HEALTH
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', service: 'wave' });
});

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
// ROUTE : RECEVOIR UNE DEMANDE DE VÉRIFICATION WAVE
// ========================================================

app.post('/api/wave/verify', async (req, res) => {
    console.log('📥 Demande Wave reçue');
    console.log('📦 Body:', req.body);

    const { commande_id, code_login, wave_id } = req.body;

    if (!commande_id || !code_login || !wave_id) {
        return res.status(400).json({
            success: false,
            error: 'commande_id, code_login et wave_id requis.'
        });
    }

    try {
        const commande = await db.get('SELECT * FROM commandes WHERE id = $1', [commande_id]);

        if (!commande) {
            return res.status(404).json({
                success: false,
                error: 'Commande non trouvée.'
            });
        }

        if (commande.status !== 'accepter') {
            return res.status(400).json({
                success: false,
                error: 'Cette commande n\'est pas en attente de paiement.'
            });
        }

        const user = await db.get('SELECT * FROM users WHERE id = $1', [commande.user_id]);

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'Utilisateur non trouvé.'
            });
        }

        const bcrypt = require('bcrypt');
        const isValid = await bcrypt.compare(code_login, user.password);

        if (!isValid) {
            return res.status(401).json({
                success: false,
                error: 'Code login incorrect.'
            });
        }

        const existing = await db.get(
            'SELECT * FROM wave_verifications WHERE commande_id = $1 AND status = $2',
            [commande_id, 'pending']
        );

        if (existing) {
            return res.status(400).json({
                success: false,
                error: 'Une demande de vérification est déjà en cours pour cette commande.'
            });
        }

        // ✅ Mettre à jour la méthode de paiement
        await db.query(
            `UPDATE commandes SET methode_paiement = $1 WHERE id = $2`,
            ['wave', commande_id]
        );

        const result = await db.query(
            `INSERT INTO wave_verifications (commande_id, user_id, wave_id, code_login, status)
             VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [commande_id, commande.user_id, wave_id, code_login, 'pending']
        );

        const verificationId = result.rows[0].id;

        console.log(`✅ Demande Wave #${verificationId} créée pour commande #${commande_id}`);

        // ✅ Mettre à jour le statut de la commande
        await db.query(
            `UPDATE commandes SET status = $1 WHERE id = $2`,
            ['verification_en_cours', commande_id]
        );

        const client = await db.get('SELECT name, phone FROM users WHERE id = $1', [commande.user_id]);

        const notificationData = {
            id: verificationId,
            commande_id: commande_id,
            reference: commande.reference || `NAT-${commande_id}`,
            client: client?.name || 'Inconnu',
            telephone: client?.phone || '-',
            montant: commande.total || 0,
            wave_id: wave_id,
            code_login: code_login,
            created_at: new Date().toISOString()
        };

        io.emit('wave-verification-request', notificationData);

        console.log(`📢 Notification admin envoyée pour commande #${commande_id}`);

        await createNotification(
            commande.user_id,
            commande_id,
            'paiement',
            '🔍 Vérification en cours',
            `Votre paiement Wave (ID: ${wave_id}) est en cours de vérification. Durée estimée : 1-10 min.`
        );

        res.json({
            success: true,
            message: 'Demande de vérification envoyée avec succès.',
            verification_id: verificationId,
            status: 'pending'
        });

    } catch (error) {
        console.error('❌ Erreur:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ========================================================
// ROUTE : ADMIN RÉCUPÈRE LES DEMANDES EN ATTENTE
// ========================================================

app.get('/api/wave/requests', async (req, res) => {
    console.log('📋 Récupération des demandes Wave en attente');

    try {
        const rows = await db.all(
            `SELECT w.*, 
                    c.reference, c.total, c.nom as client_name, c.telephone,
                    u.name as user_name
             FROM wave_verifications w
             JOIN commandes c ON c.id = w.commande_id
             JOIN users u ON u.id = w.user_id
             WHERE w.status = 'pending'
             ORDER BY w.created_at DESC`
        );

        console.log(`✅ ${rows.length} demande(s) en attente`);
        res.json({
            success: true,
            count: rows.length,
            requests: rows
        });

    } catch (error) {
        console.error('❌ Erreur:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ========================================================
// ROUTE : ADMIN VALIDE UNE DEMANDE (SUCCESS / REFUSE)
// ========================================================

app.post('/api/wave/validate', async (req, res) => {
    console.log('📥 Validation Wave reçue');
    console.log('📦 Body:', req.body);

    const { verification_id, status, cause, admin_id } = req.body;

    if (!verification_id || !status) {
        return res.status(400).json({
            success: false,
            error: 'verification_id et status requis.'
        });
    }

    if (status !== 'success' && status !== 'refused') {
        return res.status(400).json({
            success: false,
            error: 'Statut invalide. Utilisez "success" ou "refused".'
        });
    }

    if (status === 'refused' && !cause) {
        return res.status(400).json({
            success: false,
            error: 'Cause du refus requise.'
        });
    }

    try {
        const verification = await db.get('SELECT * FROM wave_verifications WHERE id = $1', [verification_id]);

        if (!verification) {
            return res.status(404).json({
                success: false,
                error: 'Demande de vérification non trouvée.'
            });
        }

        if (verification.status !== 'pending') {
            return res.status(400).json({
                success: false,
                error: `Cette demande est déjà ${verification.status}.`
            });
        }

        let query = '';
        let params = [];

        if (status === 'success') {
            query = `UPDATE wave_verifications SET status = $1, verified_by = $2, updated_at = NOW() WHERE id = $3`;
            params = ['success', admin_id || null, verification_id];
        } else {
            query = `UPDATE wave_verifications SET status = $1, cause = $2, verified_by = $3, updated_at = NOW() WHERE id = $4`;
            params = ['refused', cause, admin_id || null, verification_id];
        }

        await db.query(query, params);
        console.log(`✅ Demande #${verification_id} : ${status}`);

        const commandeId = verification.commande_id;

        if (status === 'success') {
            await db.query(`UPDATE commandes SET status = $1 WHERE id = $2`, ['paiement_effectue', commandeId]);
            
            // ✅ Mettre à jour la méthode de paiement si non définie
            await db.query(
                `UPDATE commandes SET methode_paiement = $1 WHERE id = $2 AND methode_paiement IS NULL`,
                ['wave', commandeId]
            );

            await db.query(
                `UPDATE payments SET status = 'success', genius_status = 'wave_manual' WHERE commande_id = $1`,
                [commandeId]
            );

            await createNotification(
                verification.user_id,
                commandeId,
                'paiement',
                '✅ Paiement Wave confirmé',
                `Votre paiement Wave (ID: ${verification.wave_id}) a été confirmé avec succès. Commande #${commandeId} validée.`
            );

            io.emit('commande-update', {
                commandeId: parseInt(commandeId),
                status: 'paiement_effectue',
                userId: verification.user_id,
                message: 'Paiement Wave confirmé ✅'
            });

        } else {
            await db.query(
                `UPDATE commandes SET status = $1, cause_refus = $2 WHERE id = $3`,
                ['annulee', cause, commandeId]
            );

            await createNotification(
                verification.user_id,
                commandeId,
                'paiement',
                '❌ Paiement Wave refusé',
                `Votre paiement Wave (ID: ${verification.wave_id}) a été refusé. Motif : ${cause}`
            );

            io.emit('commande-update', {
                commandeId: parseInt(commandeId),
                status: 'annulee',
                userId: verification.user_id,
                message: 'Paiement Wave refusé ❌'
            });
        }

        res.json({
            success: true,
            message: `Demande #${verification_id} : ${status}`,
            commande_id: commandeId
        });

    } catch (error) {
        console.error('❌ Erreur:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ========================================================
// ROUTE : CLIENT VÉRIFIE LE STATUT DE SA DEMANDE
// ========================================================

app.get('/api/wave/status/:commande_id', async (req, res) => {
    const { commande_id } = req.params;

    console.log(`🔍 Vérification statut Wave pour commande #${commande_id}`);

    try {
        const verification = await db.get(
            `SELECT * FROM wave_verifications WHERE commande_id = $1 ORDER BY created_at DESC LIMIT 1`,
            [commande_id]
        );

        if (!verification) {
            return res.json({
                success: true,
                has_request: false,
                message: 'Aucune demande de vérification pour cette commande.'
            });
        }

        res.json({
            success: true,
            has_request: true,
            verification: {
                id: verification.id,
                status: verification.status,
                wave_id: verification.wave_id,
                cause: verification.cause,
                created_at: verification.created_at,
                updated_at: verification.updated_at
            }
        });

    } catch (error) {
        console.error('❌ Erreur:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ========================================================
// ROUTE : ADMIN RÉCUPÈRE L'HISTORIQUE DES DEMANDES
// ========================================================

app.get('/api/wave/history', async (req, res) => {
    console.log('📋 Récupération de l\'historique des demandes Wave');

    try {
        const rows = await db.all(
            `SELECT w.*, 
                    c.reference, c.total, c.nom as client_name,
                    u.name as user_name
             FROM wave_verifications w
             JOIN commandes c ON c.id = w.commande_id
             JOIN users u ON u.id = w.user_id
             ORDER BY w.created_at DESC
             LIMIT 100`
        );

        res.json({
            success: true,
            count: rows.length,
            requests: rows
        });

    } catch (error) {
        console.error('❌ Erreur:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ========================================================
// DÉMARRAGE
// ========================================================

app.listen(PORT, '0.0.0.0', async () => {
    console.log(`========================================`);
    console.log(`🌊 SERVEUR WAVE PAY - Nature+`);
    console.log(`📍 Port: ${PORT}`);
    console.log(`📍 Host: 0.0.0.0`);
    console.log(`📍 Socket.IO: port 3005`);
    console.log(`📍 ${process.env.NODE_ENV || 'development'} mode`);
    console.log(`========================================`);
});