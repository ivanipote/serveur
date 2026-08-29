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
        version: '2.0.0',
        endpoints: {
            health: '/health',
            verify: 'POST /api/wave/verify',
            requests: 'GET /api/wave/requests',
            validate: 'POST /api/wave/validate',
            status: 'GET /api/wave/status/:commande_id',
            history: 'GET /api/wave/history',
            solde: 'GET /api/wave/solde',
            remboursement: 'POST /api/wave/remboursement',
            update: 'PUT /api/wave/update'
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

    const { commande_id, code_login, wave_id, montant_wave } = req.body;

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

        // ✅ STOCKER LE MONTANT WAVE DANS extra4
        const montantWave = montant_wave || commande.total || 0;

        const result = await db.query(
            `INSERT INTO wave_verifications (commande_id, user_id, wave_id, code_login, status, extra4)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            [commande_id, commande.user_id, wave_id, code_login, 'pending', montantWave.toString()]
        );

        const verificationId = result.rows[0].id;

        console.log(`✅ Demande Wave #${verificationId} créée pour commande #${commande_id} avec montant: ${montantWave} FCFA`);

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
            montant: montantWave,
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
            `Votre paiement Wave (ID: ${wave_id}) est en cours de vérification. Montant: ${montantWave} FCFA. Durée estimée : 1-10 min.`
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
                    u.name as user_name, u.email
             FROM wave_verifications w
             JOIN commandes c ON c.id = w.commande_id
             JOIN users u ON u.id = w.user_id
             ORDER BY w.created_at DESC`
        );

        console.log(`✅ ${rows.length} demande(s) récupérées`);
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

        // ✅ Récupérer le montant Wave depuis extra4 (ou le total de la commande)
        const commande = await db.get('SELECT total, user_id, nom FROM commandes WHERE id = $1', [verification.commande_id]);
        const montant = verification.extra4 ? parseInt(verification.extra4) : (commande?.total || 0);
        const userId = commande?.user_id;
        const clientName = commande?.nom || 'Client';

        let query = '';
        let params = [];

        if (status === 'success') {
            query = `UPDATE wave_verifications 
                     SET status = $1, 
                         verified_by = $2, 
                         updated_at = NOW(),
                         extra1 = NOW()::text,
                         extra2 = $3,
                         extra3 = $4,
                         extra4 = $5
                     WHERE id = $6`;
            params = ['success', admin_id || null, 'Validé par admin', 'success', montant.toString(), verification_id];
        } else {
            query = `UPDATE wave_verifications 
                     SET status = $1, 
                         cause = $2, 
                         verified_by = $3, 
                         updated_at = NOW(),
                         extra1 = NOW()::text,
                         extra2 = $4,
                         extra3 = $5
                     WHERE id = $6`;
            params = ['refused', cause, admin_id || null, 'Refusé par admin', 'refused', verification_id];
        }

        await db.query(query, params);
        console.log(`✅ Demande #${verification_id} : ${status}`);

        const commandeId = verification.commande_id;

        if (status === 'success') {
            // ✅ Mettre à jour le statut de la commande
            await db.query(`UPDATE commandes SET status = $1 WHERE id = $2`, ['paiement_effectue', commandeId]);
            
            await db.query(
                `UPDATE commandes SET methode_paiement = $1 WHERE id = $2 AND methode_paiement IS NULL`,
                ['wave', commandeId]
            );

            // ✅ AJOUTER LE PAIEMENT DANS LA TABLE payments (comme Genius Pay)
            const reference = `WAVE-${commandeId}-${Date.now()}`;
            
            await db.query(
                `INSERT INTO payments (
                    user_id, product_id, reference, genius_reference, amount,
                    status, genius_status, commande_id,
                    customer_name, customer_phone, gateway, environment,
                    created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())`,
                [
                    userId || verification.user_id,
                    0,
                    reference,
                    verification.wave_id,
                    montant,
                    'success',
                    'wave_manual',
                    commandeId,
                    clientName,
                    verification.telephone || '-',
                    'wave',
                    'manual'
                ]
            );
            console.log(`✅ Paiement Wave enregistré dans payments pour commande #${commandeId} (${montant} FCFA)`);

            // ✅ AJOUTER LE MONTANT AU SOLDE (admins.extra1)
            if (montant > 0) {
                await db.query(
                    `UPDATE admins 
                     SET extra1 = COALESCE(extra1, '0')::int + $1 
                     WHERE id = $2`,
                    [montant, admin_id || 1]
                );
                console.log(`✅ Solde augmenté: +${montant} FCFA`);
            }

            // ✅ Notification au client
            await createNotification(
                verification.user_id,
                commandeId,
                'paiement',
                '✅ Paiement Wave confirmé',
                `Votre paiement Wave (ID: ${verification.wave_id}) a été confirmé avec succès. Montant: ${montant} FCFA. Commande #${commandeId} validée.`
            );

            // ✅ Émettre via Socket.IO
            io.emit('commande-update', {
                commandeId: parseInt(commandeId),
                status: 'paiement_effectue',
                userId: verification.user_id,
                message: 'Paiement Wave confirmé ✅'
            });

            // ✅ Émettre la mise à jour du solde
            const newSolde = await db.get('SELECT extra1 FROM admins WHERE id = $1', [admin_id || 1]);
            io.emit('solde-update', {
                solde: newSolde?.extra1 ? parseInt(newSolde.extra1) : 0
            });

        } else {
            // ✅ REFUS
            await db.query(
                `UPDATE commandes SET status = $1, cause_refus = $2 WHERE id = $3`,
                ['annulee', cause, commandeId]
            );

            await createNotification(
                verification.user_id,
                commandeId,
                'paiement',
                '❌ Paiement Wave refusé',
                `Votre paiement Wave (ID: ${verification.wave_id}) a été refusé. Montant: ${montant} FCFA. Motif : ${cause}`
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
                updated_at: verification.updated_at,
                date_validation: verification.extra1 || null,
                notes_validation: verification.extra2 || null,
                type_action: verification.extra3 || null,
                montant_valide: verification.extra4 || null
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
// ✅ ROUTE : RÉCUPÉRER LE SOLDE WAVE
// ========================================================

app.get('/api/wave/solde', async (req, res) => {
    console.log('💰 Récupération du solde Wave');

    try {
        const admin = await db.get('SELECT extra1 FROM admins WHERE id = $1', [1]);
        const solde = admin?.extra1 ? parseInt(admin.extra1) : 0;

        res.json({
            success: true,
            solde: solde
        });
    } catch (error) {
        console.error('❌ Erreur solde:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ========================================================
// ✅ ROUTE : METTRE À JOUR UNE DEMANDE WAVE (extra1-4)
// ========================================================

app.put('/api/wave/update', async (req, res) => {
    console.log('📥 Mise à jour demande Wave');
    console.log('📦 Body:', req.body);

    const { verification_id, extra1, extra2, extra3, extra4 } = req.body;

    if (!verification_id) {
        return res.status(400).json({
            success: false,
            error: 'verification_id requis.'
        });
    }

    try {
        const verification = await db.get('SELECT * FROM wave_verifications WHERE id = $1', [verification_id]);

        if (!verification) {
            return res.status(404).json({
                success: false,
                error: 'Demande non trouvée.'
            });
        }

        // Construire la requête dynamiquement
        let updates = [];
        let params = [];
        let paramIndex = 1;

        if (extra1 !== undefined) {
            updates.push(`extra1 = $${paramIndex++}`);
            params.push(extra1);
        }
        if (extra2 !== undefined) {
            updates.push(`extra2 = $${paramIndex++}`);
            params.push(extra2);
        }
        if (extra3 !== undefined) {
            updates.push(`extra3 = $${paramIndex++}`);
            params.push(extra3);
        }
        if (extra4 !== undefined) {
            updates.push(`extra4 = $${paramIndex++}`);
            params.push(extra4);
        }

        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Aucun champ à mettre à jour.'
            });
        }

        updates.push(`updated_at = NOW()`);
        params.push(verification_id);

        const query = `UPDATE wave_verifications SET ${updates.join(', ')} WHERE id = $${paramIndex}`;
        
        await db.query(query, params);
        console.log(`✅ Demande #${verification_id} mise à jour`);

        // ✅ Récupérer la demande mise à jour
        const updated = await db.get('SELECT * FROM wave_verifications WHERE id = $1', [verification_id]);

        res.json({
            success: true,
            message: 'Demande mise à jour avec succès',
            verification: updated
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
// ✅ ROUTE : REMBOURSEMENT WAVE
// ========================================================

app.post('/api/wave/remboursement', async (req, res) => {
    console.log('💰 Remboursement Wave reçu');
    console.log('📦 Body:', req.body);

    const { verification_id, cause, admin_id } = req.body;

    if (!verification_id) {
        return res.status(400).json({
            success: false,
            error: 'verification_id requis.'
        });
    }

    if (!cause || cause.trim() === '') {
        return res.status(400).json({
            success: false,
            error: 'Motif du remboursement requis.'
        });
    }

    try {
        // 1. Récupérer la demande
        const verification = await db.get('SELECT * FROM wave_verifications WHERE id = $1', [verification_id]);

        if (!verification) {
            return res.status(404).json({
                success: false,
                error: 'Demande non trouvée.'
            });
        }

        // 2. Vérifier que la demande est en 'success'
        if (verification.status !== 'success') {
            return res.status(400).json({
                success: false,
                error: 'Seules les demandes validées (success) peuvent être remboursées.'
            });
        }

        // 3. Récupérer le montant depuis extra4 ou la commande
        const commande = await db.get('SELECT total, user_id, nom FROM commandes WHERE id = $1', [verification.commande_id]);
        const montant = verification.extra4 ? parseInt(verification.extra4) : (commande?.total || 0);
        const userId = commande?.user_id;
        const clientName = commande?.nom || 'Client';

        // 4. Envoyer la notification à l'utilisateur
        await createNotification(
            userId,
            verification.commande_id,
            'paiement',
            '💳 Remboursement effectué',
            `Bonjour ${clientName}, un remboursement de ${montant.toLocaleString()} FCFA a été effectué pour votre paiement Wave (ID: ${verification.wave_id}). Motif : ${cause}`
        );

        console.log(`✅ Notification de remboursement envoyée à l'utilisateur ${userId}`);

        // 5. Mettre à jour la demande (extra1, extra2, extra3, extra4)
        const now = new Date().toISOString();
        await db.query(
            `UPDATE wave_verifications 
             SET extra1 = $1, 
                 extra2 = $2, 
                 extra3 = $3, 
                 extra4 = $4,
                 updated_at = NOW()
             WHERE id = $5`,
            [
                now,
                `Remboursement pour ${clientName}`,
                'remboursement',
                cause,
                verification_id
            ]
        );
        console.log(`✅ Demande #${verification_id} mise à jour avec remboursement`);

        // 6. AJOUTER LE REMBOURSEMENT DANS LA TABLE payments (comme Genius Pay)
        const reference = `WAVE-REFUND-${verification.commande_id}-${Date.now()}`;
        
        await db.query(
            `INSERT INTO payments (
                user_id, product_id, reference, genius_reference, amount,
                status, genius_status, commande_id,
                customer_name, customer_phone, gateway, environment,
                created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())`,
            [
                userId,
                0,
                reference,
                verification.wave_id,
                -montant, // Négatif pour le remboursement
                'refunded',
                'wave_refunded',
                verification.commande_id,
                clientName,
                verification.telephone || '-',
                'wave',
                'manual'
            ]
        );
        console.log(`✅ Remboursement Wave enregistré dans payments pour commande #${verification.commande_id}`);

        // 7. DIMINUER LE SOLDE (admins.extra1)
        if (montant > 0) {
            await db.query(
                `UPDATE admins 
                 SET extra1 = COALESCE(extra1, '0')::int - $1 
                 WHERE id = $2`,
                [montant, admin_id || 1]
            );
            console.log(`✅ Solde diminué: -${montant} FCFA`);
        }

        // 8. Mettre à jour le statut de la commande (si besoin)
        await db.query(
            `UPDATE commandes SET status = $1, cause_refus = $2 WHERE id = $3`,
            ['annulee', `Remboursement effectué : ${cause}`, verification.commande_id]
        );
        console.log(`✅ Commande #${verification.commande_id} : statut -> annulee`);

        // 9. Émettre via Socket.IO
        io.emit('commande-update', {
            commandeId: parseInt(verification.commande_id),
            status: 'annulee',
            userId: userId,
            message: 'Remboursement effectué 🔄'
        });

        // 10. Émettre la mise à jour du solde
        const newSolde = await db.get('SELECT extra1 FROM admins WHERE id = $1', [admin_id || 1]);
        io.emit('solde-update', {
            solde: newSolde?.extra1 ? parseInt(newSolde.extra1) : 0
        });

        res.json({
            success: true,
            message: `Remboursement effectué pour la demande #${verification_id}`,
            commande_id: verification.commande_id,
            montant: montant,
            nouveau_solde: newSolde?.extra1 ? parseInt(newSolde.extra1) : 0
        });

    } catch (error) {
        console.error('❌ Erreur remboursement:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ========================================================
// TABLE WAVE_VERIFICATIONS
// ========================================================

async function createWaveTable() {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS wave_verifications (
                id SERIAL PRIMARY KEY,
                commande_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                wave_id TEXT NOT NULL,
                code_login TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                cause TEXT,
                verified_by INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                extra1 TEXT DEFAULT NULL,
                extra2 TEXT DEFAULT NULL,
                extra3 TEXT DEFAULT NULL,
                extra4 TEXT DEFAULT NULL,
                FOREIGN KEY (commande_id) REFERENCES commandes(id),
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `);
        console.log('✅ Table wave_verifications créée avec succès');
    } catch (error) {
        console.error('❌ Erreur création table:', error);
    }
}

// ========================================================
// DÉMARRAGE
// ========================================================

app.listen(PORT, '0.0.0.0', async () => {
    console.log(`========================================`);
    console.log(`🌊 SERVEUR WAVE PAY - Nature+ (v2.0)`);
    console.log(`📍 Port: ${PORT}`);
    console.log(`📍 Host: 0.0.0.0`);
    console.log(`📍 Socket.IO: port 3005`);
    console.log(`📍 ${process.env.NODE_ENV || 'development'} mode`);
    console.log(`========================================`);

    setTimeout(async () => {
        try {
            await createWaveTable();
            console.log('✅ Table wave_verifications vérifiée');
        } catch (error) {
            console.error('⚠️ Erreur création table (non bloquante):', error.message);
        }
    }, 2000);
});