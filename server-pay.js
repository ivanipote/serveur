const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const db = require('./database');
const { Server } = require('socket.io');
const Redis = require('ioredis');
const { createAdapter } = require('@socket.io/redis-adapter');

const app = express();
const PORT = process.env.PORT || 3002;

// ========================================================
// CONFIGURATION GENIUS PAY - PRODUCTION
// ========================================================

const SECRET_KEY = process.env.GENIUS_SECRET_KEY;
const PUBLIC_KEY = process.env.GENIUS_PUBLIC_KEY;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

const GENIUS_API_URL = 'https://geniuspay.ci/api/v1/merchant/payments';

// ========================================================
// REDIS - Connexion
// ========================================================

const redisClient = new Redis(process.env.REDIS_URL, {
    tls: {},
    retryStrategy: (times) => Math.min(times * 50, 2000)
});

redisClient.on('connect', () => console.log('✅ Redis (pay) connecté'));
redisClient.on('error', (err) => console.error('❌ Redis erreur:', err));

const pubClient = redisClient.duplicate();
const subClient = redisClient.duplicate();

// ========================================================
// SOCKET.IO - Connexion au serveur client
// ========================================================

const socket = new Server({
    cors: {
        origin: ['https://nature-plus-client.onrender.com', 'http://localhost:3000'],
        credentials: true
    },
    adapter: createAdapter(pubClient, subClient)
});

socket.listen(3003);

socket.on('connection', (sock) => {
    console.log('✅ Socket.IO (pay) connecté');
    sock.on('disconnect', () => {
        console.log('❌ Socket.IO (pay) déconnecté');
    });
});

// ========================================================
// MIDDLEWARE - CORS
// ========================================================

app.use(express.json());

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, X-API-Key, X-API-Secret, X-Webhook-Signature, X-Webhook-Timestamp, X-Webhook-Event');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

console.log('🔑 Mode: LIVE ✅');
console.log('🔔 Webhook Secret: ✅ Chargé');

// ========================================================
// ROUTE HEALTH
// ========================================================

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', service: 'payment' });
});

// ========================================================
// FONCTION : CRÉER UNE NOTIFICATION (ENRICHIE)
// ========================================================

async function createNotification(userId, commandeId, type, title, content) {
    // Si userId est null, on récupère depuis la commande
    let finalUserId = userId;
    if (!finalUserId && commandeId) {
        try {
            const cmd = await db.get('SELECT user_id FROM commandes WHERE id = $1', [commandeId]);
            if (cmd) finalUserId = cmd.user_id;
        } catch (e) {}
    }

    if (!finalUserId) {
        console.warn('⚠️ Impossible de créer une notification: userId manquant');
        return false;
    }

    try {
        await db.query(
            `INSERT INTO messages (user_id, commande_id, type, title, content, is_read)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [finalUserId, commandeId, type, title, content, false]
        );
        console.log(`✅ Notification créée pour user ${finalUserId}: ${title}`);
        return true;
    } catch (err) {
        console.error('❌ Erreur création notification:', err);
        return false;
    }
}

// ========================================================
// ROUTE : CRÉER UN PAIEMENT
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
        // ✅ 1. Vérifier si un paiement existe déjà pour cette commande
        const existingPayment = await db.get(
            `SELECT * FROM payments WHERE commande_id = $1`,
            [commandeId]
        );

        // ✅ 2. Si paiement existe, retourner le lien existant
        if (existingPayment) {
            console.log(`✅ Paiement existant pour la commande #${commandeId}`);

            const finalStatuses = ['success', 'failed', 'cancelled', 'expired', 'refunded'];
            if (finalStatuses.includes(existingPayment.genius_status || existingPayment.status)) {
                return res.json({
                    success: false,
                    error: 'Ce paiement est déjà finalisé.',
                    status: existingPayment.genius_status || existingPayment.status,
                    existing: true
                });
            }

            return res.json({
                success: true,
                checkout_url: existingPayment.checkout_url,
                reference: existingPayment.reference,
                genius_reference: existingPayment.genius_reference,
                genius_status: existingPayment.genius_status || 'pending',
                message: 'Paiement déjà existant, lien réutilisé',
                existing: true
            });
        }

        // ✅ 3. Aucun paiement existant → créer un nouveau lien
        const commande = await db.get('SELECT user_id, nom FROM commandes WHERE id = $1', [commandeId]);
        const userId = commande ? commande.user_id : 0;
        const customerName = commande?.nom || 'Client Nature+';

        const paymentRef = reference || `NAT-${commandeId}-${Date.now()}`;

        const payload = {
            amount: amount,
            currency: 'XOF',
            reference: paymentRef,
            description: description || `Commande Nature+ #${commandeId}`,
            customer: {
                phone: cleanPhone,
                name: customerName
            },
            method: 'WAVE',
            success_url: `https://nature-plus-client.onrender.com/payment-success?commande_id=${commandeId}`,
            error_url: `https://nature-plus-client.onrender.com/payment-failed?commande_id=${commandeId}`,
            metadata: {
                order_id: commandeId,
                user_id: userId,
                source: 'nature_plus_app',
                commande_ref: paymentRef
            }
        };

        console.log('📤 Envoi à Genius Pay (LIVE)...');
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
        const geniusStatus = paymentData.data?.status || 'pending';
        const expiresAt = paymentData.data?.expires_at || null;
        const gateway = paymentData.data?.payment_method || paymentData.data?.gateway || paymentData.data?.provider || null;
        const environment = paymentData.data?.environment || 'live';

        await db.query(
            `INSERT INTO payments (
                user_id, product_id, reference, genius_reference, amount, 
                status, genius_status, checkout_url, commande_id,
                customer_name, customer_phone, gateway, environment, expires_at,
                created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())`,
            [
                userId, 1, paymentRef, geniusReference, amount,
                'pending', geniusStatus, checkoutUrl, commandeId,
                customerName, cleanPhone, gateway, environment, expiresAt
            ]
        );
        console.log('✅ Payment enregistré');

        // ✅ Mettre à jour le statut de la commande
        await db.query(
            `UPDATE commandes SET status = $1 WHERE id = $2`,
            ['paiement_en_cours', commandeId]
        );
// ✅ NOTIFICATION : Paiement initié (via createNotification)
await createNotification(
    userId,
    commandeId,
    'paiement',
    '📥 Paiement initié',
    `Votre paiement pour la commande #${commandeId} a été initié. Montant : ${amount} FCFA. Réf. : ${geniusReference}`
);

// ✅ NOTIFICATION : Paiement en cours (via socket directement)
socket.emit('notification', {
    title: '⏳ Paiement en cours',
    content: `Votre paiement pour la commande #${commandeId} est en cours de traitement. Veuillez vérifier votre téléphone Wave.`,
    type: 'paiement',
    commandeId: commandeId,
    userId: userId
});
        res.json({
            success: true,
            checkout_url: checkoutUrl,
            reference: paymentRef,
            genius_reference: geniusReference,
            genius_status: geniusStatus,
            message: 'Paiement créé avec succès'
        });

    } catch (error) {
        console.error('❌ Erreur paiement:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ========================================================
// ROUTE : METTRE À JOUR LE STATUT
// ========================================================

app.post('/api/payment/update-status', async (req, res) => {
    const { commandeId, status, cause } = req.body;

    console.log(`📥 Mise à jour statut commande #${commandeId} → ${status}`);

    if (!commandeId || !status) {
        return res.status(400).json({ error: 'commandeId et status requis.' });
    }

    try {
        const allowedStatus = ['payee', 'paiement_effectue', 'annulee', 'refuse'];
        if (!allowedStatus.includes(status)) {
            return res.status(400).json({ error: 'Statut invalide.' });
        }

        let query = 'UPDATE commandes SET status = $1 WHERE id = $2';
        let params = [status, commandeId];

        if (status === 'annulee' && cause) {
            query = 'UPDATE commandes SET status = $1, cause_refus = $2 WHERE id = $3';
            params = [status, cause, commandeId];
        }

        const result = await db.query(query, params);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Commande non trouvée.' });
        }

        const paymentStatus = status === 'payee' || status === 'paiement_effectue' ? 'success' : 'canceled';
        await db.query(
            `UPDATE payments SET status = $1 WHERE commande_id = $2`,
            [paymentStatus, commandeId]
        );

        const commande = await db.get('SELECT user_id FROM commandes WHERE id = $1', [commandeId]);
        if (commande) {
            let title = '⏰ Paiement annulé';
            let content = `Le paiement pour la commande #${commandeId} a été annulé.`;

            if (status === 'payee' || status === 'paiement_effectue') {
                title = '💳 Paiement confirmé';
                content = `Votre paiement pour la commande #${commandeId} a été confirmé. Commande en préparation.`;
            }

            await createNotification(commande.user_id, commandeId, 'paiement', title, content);

            socket.emit('commande-update', {
                commandeId: parseInt(commandeId),
                status: status === 'payee' || status === 'paiement_effectue' ? 'paiement_effectue' : status,
                userId: commande.user_id,
                message: `Statut mis à jour : ${status}`
            });
        }

        res.json({ success: true, message: `Statut mis à jour : ${status}` });
    } catch (err) {
        console.error('❌ Erreur:', err);
        res.status(500).json({ error: err.message });
    }
});

// ========================================================
// ROUTE : VÉRIFIER LE STATUT D'UN PAIEMENT
// ========================================================

app.get('/api/payment/check/:reference', async (req, res) => {
    const { reference } = req.params;

    console.log(`🔍 Vérification paiement référence: ${reference}`);

    if (!reference) {
        return res.status(400).json({ error: 'Référence requise.' });
    }

    try {
        let row = null;
        try {
            row = await db.get(
                `SELECT * FROM payments WHERE reference = $1 OR genius_reference = $1 OR commande_id::text = $1`,
                [reference]
            );
        } catch (dbError) {
            console.error('❌ Erreur recherche base:', dbError);
        }

        if (row) {
            console.log(`✅ Paiement trouvé dans la base: ${row.genius_status || row.status}`);
            return res.json({
                success: true,
                status: row.genius_status || row.status || 'pending',
                source: 'database',
                data: row
            });
        }

        try {
            console.log('🔍 Recherche chez Genius Pay (LIVE)...');
            const response = await axios.get(
                `${GENIUS_API_URL}/${reference}`,
                {
                    headers: {
                        'X-API-Key': PUBLIC_KEY,
                        'X-API-Secret': SECRET_KEY
                    }
                }
            );

            const paymentData = response.data?.data || response.data;
            const status = paymentData?.status || 'unknown';

            console.log(`📊 Statut Genius Pay: ${status}`);

            if (row) {
                await db.query(
                    `UPDATE payments SET genius_status = $1, updated_at = NOW() WHERE id = $2`,
                    [status, row.id]
                );

                // ✅ Si statut final, mettre à jour la commande et envoyer notification
                if (['success', 'failed', 'cancelled', 'expired', 'refunded'].includes(status)) {
                    await updateGeniusStatus(row.genius_reference || reference, status, paymentData);
                }
            }

            return res.json({
                success: true,
                status: status,
                source: 'geniuspay',
                data: paymentData
            });
        } catch (geniusError) {
            if (geniusError.response?.status === 404) {
                return res.json({
                    success: true,
                    status: 'not_found',
                    message: 'Transaction non trouvée'
                });
            }
            throw geniusError;
        }

    } catch (error) {
        console.error('❌ Erreur vérification:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ========================================================
// ROUTE : VÉRIFIER UNIQUEMENT SUR GENIUS PAY (pas base)
// ========================================================

app.get('/api/payment/genius-check/:reference', async (req, res) => {
    const { reference } = req.params;

    console.log(`🔍 Vérification directe Genius Pay: ${reference}`);

    if (!reference) {
        return res.status(400).json({ error: 'Référence requise.' });
    }

    try {
        const response = await axios.get(
            `${GENIUS_API_URL}/${reference}`,
            {
                headers: {
                    'X-API-Key': PUBLIC_KEY,
                    'X-API-Secret': SECRET_KEY
                }
            }
        );

        console.log(`✅ Données récupérées depuis Genius Pay pour ${reference}`);

        res.json({
            success: true,
            source: 'geniuspay',
            data: response.data?.data || response.data
        });

    } catch (error) {
        console.error(`❌ Erreur Genius Pay pour ${reference}:`, error.message);

        if (error.response?.status === 404) {
            res.json({
                success: true,
                status: 'not_found',
                message: 'Transaction non trouvée sur Genius Pay'
            });
        } else {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
});

// ========================================================
// ROUTE : RESTAURER UNE COMMANDE
// ========================================================

app.post('/api/commande/restore/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const row = await db.get('SELECT status, user_id FROM commandes WHERE id = $1', [id]);

        if (!row) {
            return res.status(404).json({ error: 'Commande non trouvée.' });
        }
        if (row.status !== 'annulee') {
            return res.status(400).json({ error: 'Seules les commandes annulées peuvent être restaurées.' });
        }

        await db.query('UPDATE commandes SET status = $1 WHERE id = $2', ['en_attente', id]);
        await db.query('DELETE FROM payments WHERE commande_id = $1', [id]);

        await createNotification(
            row.user_id,
            id,
            'commande',
            '🔄 Commande restaurée',
            `Votre commande #${id} a été restaurée et est de nouveau en attente.`
        );

        res.json({ success: true, message: 'Commande restaurée' });
    } catch (err) {
        console.error('❌ Erreur:', err);
        res.status(500).json({ error: err.message });
    }
});

// ========================================================
// ROUTE : WEBHOOK
// ========================================================

app.post('/api/payment/webhook', (req, res) => {
    console.log('🔔 Webhook reçu');

    const signature = req.headers['x-webhook-signature'];
    const timestamp = req.headers['x-webhook-timestamp'];
    const event = req.headers['x-webhook-event'];

    console.log('📌 Événement:', event);
    console.log('📌 Timestamp:', timestamp);
    console.log('📌 Signature:', signature ? 'Présente' : 'Absente');

    if (!signature || !timestamp || !event) {
        console.warn('⚠️ Headers manquants');
        return res.status(400).json({
            type: 'about:blank',
            title: 'Bad Request',
            status: 400,
            detail: 'Required header is not present.'
        });
    }

    const now = Math.floor(Date.now() / 1000);
    const timeDiff = Math.abs(now - parseInt(timestamp));
    if (timeDiff > 300) {
        console.warn(`⚠️ Timestamp trop ancien (diff: ${timeDiff}s)`);
        return res.status(400).json({
            type: 'about:blank',
            title: 'Bad Request',
            status: 400,
            detail: 'Timestamp too old'
        });
    }

    const payload = JSON.stringify(req.body);
    const data = timestamp + '.' + payload;
    const expectedSignature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(data)
        .digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
        console.warn('⚠️ Signature invalide');
        return res.status(401).json({
            type: 'about:blank',
            title: 'Unauthorized',
            status: 401,
            detail: 'Invalid signature'
        });
    }

    console.log('✅ Signature vérifiée - Webhook valide');

    res.status(200).json({
        success: true,
        message: 'Webhook processed successfully'
    });

    setImmediate(() => processWebhookEvent(event, req.body));
});

// ========================================================
// FONCTION : METTRE À JOUR LE STATUT GENIUS PAY
// ========================================================

async function updateGeniusStatus(geniusRef, status, paymentData) {
    try {
        await db.query(
            `UPDATE payments SET 
                genius_status = $1,
                status = CASE 
                    WHEN $1 = 'success' THEN 'success'
                    WHEN $1 IN ('failed', 'cancelled', 'expired', 'refunded') THEN $1
                    ELSE 'pending'
                END,
                updated_at = NOW()
             WHERE genius_reference = $2`,
            [status, geniusRef]
        );

        const payment = await db.get(
            `SELECT commande_id FROM payments WHERE genius_reference = $1`,
            [geniusRef]
        );

        if (!payment) return null;

        let commandeStatus = null;
        let notificationTitle = '';
        let notificationContent = '';
        let notificationType = 'paiement';

        if (status === 'success') {
            commandeStatus = 'paiement_effectue';
            notificationTitle = '💳 Paiement réussi';
            notificationContent = `Votre commande #${payment.commande_id} a été soldée avec succès. Montant: ${paymentData?.amount || ''} FCFA. Réf. Genius Pay: ${geniusRef || '-'}`;
        } else if (status === 'failed') {
            commandeStatus = 'annulee';
            notificationTitle = '❌ Paiement échoué';
            notificationContent = `Le paiement de votre commande #${payment.commande_id} a échoué. Montant: ${paymentData?.amount || ''} FCFA. Réf. Genius Pay: ${geniusRef || '-'}`;
        } else if (status === 'cancelled') {
            commandeStatus = 'annulee';
            notificationTitle = '⏰ Paiement annulé';
            notificationContent = `Le paiement de votre commande #${payment.commande_id} a été annulé. Montant: ${paymentData?.amount || ''} FCFA.`;
        } else if (status === 'expired') {
            commandeStatus = 'annulee';
            notificationTitle = '⏳ Paiement expiré';
            notificationContent = `Le paiement de votre commande #${payment.commande_id} a expiré. Vous pouvez réessayer.`;
        } else if (status === 'refunded') {
            commandeStatus = 'annulee';
            notificationTitle = '🔄 Remboursement effectué';
            notificationContent = `Le remboursement de votre commande #${payment.commande_id} a été effectué. Montant: ${paymentData?.amount || ''} FCFA.`;
        }

        if (commandeStatus) {
            await db.query(
                `UPDATE commandes SET status = $1 WHERE id = $2`,
                [commandeStatus, payment.commande_id]
            );
            console.log(`✅ Commande #${payment.commande_id} : statut -> ${commandeStatus}`);

            const commande = await db.get('SELECT user_id FROM commandes WHERE id = $1', [payment.commande_id]);
            if (commande) {
                await createNotification(
                    commande.user_id,
                    payment.commande_id,
                    notificationType,
                    notificationTitle,
                    notificationContent
                );
            }

            socket.emit('commande-update', {
                commandeId: parseInt(payment.commande_id),
                status: commandeStatus,
                userId: commande?.user_id,
                message: `Statut mis à jour : ${commandeStatus}`
            });
        }

        return payment.commande_id;

    } catch (error) {
        console.error('❌ Erreur mise à jour statut Genius Pay:', error);
        return null;
    }
}

// ========================================================
// TRAITEMENT DES ÉVÉNEMENTS WEBHOOK
// ========================================================

async function processWebhookEvent(event, payload) {
    console.log(`📥 Traitement de l'événement: ${event}`);
    const data = payload.data;

    switch (event) {
        case 'payment.success':
            await handlePaymentSuccess(data);
            break;
        case 'payment.failed':
            await handlePaymentFailed(data);
            break;
        case 'payment.cancelled':
            await handlePaymentCancelled(data);
            break;
        case 'payment.refunded':
            await handlePaymentRefunded(data);
            break;
        case 'webhook.test':
            console.log('✅ Test webhook reçu avec succès');
            break;
        default:
            console.log(`ℹ️ Événement non géré: ${event}`);
    }
}

// ========================================================
// HANDLERS
// ========================================================

async function handlePaymentSuccess(data) {
    const reference = data.reference;
    const orderId = data.metadata?.order_id || data.metadata?.commande_id;
    const amount = data.amount;

    console.log(`✅ Paiement réussi - Réf: ${reference}, Commande: ${orderId}, Montant: ${amount}`);

    if (!orderId) {
        console.warn('⚠️ Pas de commande_id dans le webhook');
        return;
    }

    try {
        const commande = await db.get('SELECT * FROM commandes WHERE id = $1', [orderId]);

        if (!commande) {
            console.error(`❌ Commande #${orderId} non trouvée`);
            return;
        }

        await db.query(
            `UPDATE payments SET genius_status = 'success', status = 'success', updated_at = NOW() WHERE genius_reference = $1 OR reference = $1`,
            [reference]
        );

        await db.query(
            `UPDATE commandes SET status = 'paiement_effectue' WHERE id = $1`,
            [orderId]
        );
        console.log(`✅ Commande #${orderId} : statut -> paiement_effectue`);

        await createNotification(
            commande.user_id,
            orderId,
            'paiement',
            '💳 Paiement réussi',
            `Votre commande #${orderId} (${commande.reference}) a été soldée avec succès. Montant: ${amount} FCFA. Réf. Genius Pay: ${reference}`
        );

        socket.emit('commande-update', {
            commandeId: parseInt(orderId),
            status: 'paiement_effectue',
            userId: commande.user_id,
            message: 'Paiement réussi ✅'
        });

        console.log(`📢 ADMIN: Paiement réussi pour la commande #${orderId} - Montant: ${amount} FCFA`);

    } catch (err) {
        console.error('❌ Erreur traitement payment.success:', err);
    }
}

async function handlePaymentFailed(data) {
    const reference = data.reference;
    const orderId = data.metadata?.order_id || data.metadata?.commande_id;

    console.log(`❌ Paiement échoué - Réf: ${reference}, Commande: ${orderId}`);

    if (!orderId) return;

    try {
        const commande = await db.get('SELECT user_id, reference FROM commandes WHERE id = $1', [orderId]);
        if (!commande) {
            console.error(`❌ Commande #${orderId} non trouvée`);
            return;
        }

        await db.query(
            `UPDATE payments SET genius_status = 'failed', status = 'failed', updated_at = NOW() WHERE genius_reference = $1 OR reference = $1`,
            [reference]
        );

        await db.query(
            `UPDATE commandes SET status = 'annulee', cause_refus = 'Paiement échoué' WHERE id = $1`,
            [orderId]
        );

        const paymentData = await db.get(
            `SELECT amount FROM payments WHERE genius_reference = $1 OR reference = $1`,
            [reference]
        );

        await createNotification(
            commande.user_id,
            orderId,
            'paiement',
            '❌ Paiement échoué',
            `Le paiement de votre commande #${orderId} (${commande.reference}) a échoué. Montant: ${paymentData?.amount || ''} FCFA. Réf. Genius Pay: ${reference}`
        );

        socket.emit('commande-update', {
            commandeId: parseInt(orderId),
            status: 'annulee',
            userId: commande.user_id,
            message: 'Paiement échoué ❌'
        });

        console.log(`📢 ADMIN: Paiement échoué pour la commande #${orderId}`);

    } catch (err) {
        console.error('❌ Erreur traitement payment.failed:', err);
    }
}

async function handlePaymentCancelled(data) {
    const reference = data.reference;
    const orderId = data.metadata?.order_id || data.metadata?.commande_id;

    console.log(`⏰ Paiement annulé - Réf: ${reference}, Commande: ${orderId}`);

    if (!orderId) return;

    try {
        const commande = await db.get('SELECT user_id, reference FROM commandes WHERE id = $1', [orderId]);
        if (!commande) return;

        await db.query(
            `UPDATE payments SET genius_status = 'cancelled', status = 'cancelled', updated_at = NOW() WHERE genius_reference = $1 OR reference = $1`,
            [reference]
        );

        await db.query(
            `UPDATE commandes SET status = 'annulee', cause_refus = 'Paiement annulé' WHERE id = $1`,
            [orderId]
        );

        const paymentData = await db.get(
            `SELECT amount FROM payments WHERE genius_reference = $1 OR reference = $1`,
            [reference]
        );

        await createNotification(
            commande.user_id,
            orderId,
            'paiement',
            '⏰ Paiement annulé',
            `Le paiement de votre commande #${orderId} (${commande.reference}) a été annulé. Montant: ${paymentData?.amount || ''} FCFA.`
        );

        socket.emit('commande-update', {
            commandeId: parseInt(orderId),
            status: 'annulee',
            userId: commande.user_id,
            message: 'Paiement annulé ⏰'
        });

        console.log(`📢 ADMIN: Paiement annulé pour la commande #${orderId}`);

    } catch (err) {
        console.error('❌ Erreur traitement payment.cancelled:', err);
    }
}

async function handlePaymentRefunded(data) {
    const reference = data.reference;
    const orderId = data.metadata?.order_id || data.metadata?.commande_id;
    const amount = data.amount;

    console.log(`🔄 Paiement remboursé - Réf: ${reference}, Commande: ${orderId}`);

    if (!orderId) return;

    try {
        const commande = await db.get('SELECT user_id, reference FROM commandes WHERE id = $1', [orderId]);
        if (!commande) return;

        await db.query(
            `UPDATE payments SET genius_status = 'refunded', status = 'refunded', updated_at = NOW() WHERE genius_reference = $1 OR reference = $1`,
            [reference]
        );

        await db.query(
            `UPDATE commandes SET status = 'annulee', cause_refus = 'Remboursement effectué' WHERE id = $1`,
            [orderId]
        );

        await createNotification(
            commande.user_id,
            orderId,
            'paiement',
            '🔄 Remboursement effectué',
            `Le remboursement de votre commande #${orderId} (${commande.reference}) a été effectué. Montant: ${amount || ''} FCFA.`
        );

        socket.emit('commande-update', {
            commandeId: parseInt(orderId),
            status: 'annulee',
            userId: commande.user_id,
            message: 'Remboursement effectué 🔄'
        });

        console.log(`📢 ADMIN: Remboursement effectué pour la commande #${orderId}`);

    } catch (err) {
        console.error('❌ Erreur traitement payment.refunded:', err);
    }
}

// ========================================================
// DÉMARRAGE
// ========================================================

app.listen(PORT, '0.0.0.0', () => {
    console.log(`========================================`);
    console.log(`🚀 SERVEUR PAIEMENT - Nature+ (LIVE ✅)`);
    console.log(`📍 Port: ${PORT}`);
    console.log(`📍 Host: 0.0.0.0`);
    console.log(`📍 http://localhost:${PORT}`);
    console.log(`📍 Socket.IO: port 3003`);
    console.log(`========================================`);
});