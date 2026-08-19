const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3002;

// ========================================================
// CONFIGURATION GENIUS PAY
// ========================================================

const SECRET_KEY = process.env.GENIUS_SECRET_KEY || 'ss_sandbox_B2RCD03octNvZPUD4zjcmGUGKbxqzTRzKHH1qf6e8TnlEQzP';
const PUBLIC_KEY = process.env.GENIUS_PUBLIC_KEY || 'sk_sandbox_XpcqcXI54Gj537UMCqPpqPq5NTyxQ6oV';
const GENIUS_API_URL = 'https://geniuspay.ci/api/v1/merchant/payments';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'whsec_LV1XzCsDS7ZXSJIODpqEkeIFTg3sSCSu7tMZm8cqbP6G9Jxj';

// ========================================================
// MIDDLEWARE
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

console.log('🔑 Mode: SANDBOX');
console.log('🔔 Webhook Secret:', WEBHOOK_SECRET ? '✅ Chargé' : '❌ Non');

// ========================================================
// ROUTE HEALTH
// ========================================================

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', service: 'payment' });
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
    } catch (err) {
        console.error('❌ Erreur création notification:', err);
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
        const paymentRef = reference || `PAY-${commandeId}-${Date.now()}`;

        const commande = await db.get('SELECT user_id FROM commandes WHERE id = $1', [commandeId]);
        const userId = commande ? commande.user_id : 0;

        // ✅ CORRECTION : success_url / error_url (avec underscore) + metadata
        const payload = {
            amount: amount,
            currency: 'XOF',
            description: description || `Commande Nature+ #${commandeId}`,
            customer: {
                phone: cleanPhone,
                name: commande?.nom || 'Client Nature+'
            },
            // ✅ NE PAS spécifier payment_method → checkout GeniusPay
            success_url: `https://nature-plus-client.onrender.com/payment-success`,
            error_url: `https://nature-plus-client.onrender.com/payment-failed`,
            metadata: {
                order_id: commandeId,
                user_id: userId,
                source: 'nature_plus_app'
            }
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

        await db.query(
            `INSERT INTO payments (user_id, product_id, reference, genius_reference, amount, status, checkout_url, commande_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [userId, 1, paymentRef, geniusReference, amount, 'pending', checkoutUrl, commandeId]
        );
        console.log('✅ Payment enregistré');

        await db.query(
            `UPDATE commandes SET status = $1 WHERE id = $2`,
            ['paiement_en_cours', commandeId]
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

        const paymentStatus = status === 'payee' ? 'success' : 'canceled';
        await db.query(
            `UPDATE payments SET status = $1 WHERE commande_id = $2`,
            [paymentStatus, commandeId]
        );

        const commande = await db.get('SELECT user_id FROM commandes WHERE id = $1', [commandeId]);
        if (commande) {
            const title = status === 'payee' ? '💳 Paiement confirmé' : '⏰ Paiement annulé';
            const content = status === 'payee' 
                ? `Votre paiement pour la commande #${commandeId} a été confirmé.`
                : `Le paiement pour la commande #${commandeId} a été annulé.`;
            
            await createNotification(commande.user_id, commandeId, 'paiement', title, content);
        }

        res.json({ success: true, message: `Statut mis à jour : ${status}` });
    } catch (err) {
        console.error('❌ Erreur:', err);
        res.status(500).json({ error: err.message });
    }
});

// ========================================================
// ROUTE : ANNULER UN PAIEMENT
// ========================================================

app.post('/api/payment/cancel', async (req, res) => {
    const { commandeId } = req.body;

    try {
        const row = await db.get('SELECT status, user_id FROM commandes WHERE id = $1', [commandeId]);

        if (!row) {
            return res.status(404).json({ error: 'Commande non trouvée.' });
        }
        if (row.status !== 'paiement_en_cours') {
            return res.status(400).json({ error: 'Cette commande ne peut pas être annulée.' });
        }

        await db.query(
            `UPDATE commandes SET status = $1, cause_refus = $2 WHERE id = $3`,
            ['annulee', 'Annulé par le client', commandeId]
        );

        await db.query(
            `UPDATE payments SET status = $1 WHERE commande_id = $2`,
            ['canceled', commandeId]
        );

        await createNotification(
            row.user_id,
            commandeId,
            'paiement',
            '❌ Paiement annulé',
            `Vous avez annulé le paiement pour la commande #${commandeId}.`
        );

        res.json({ success: true, message: 'Paiement annulé avec succès' });
    } catch (err) {
        console.error('❌ Erreur:', err);
        res.status(500).json({ error: err.message });
    }
});

// ========================================================
// 🆕 ROUTE : VÉRIFIER LE STATUT D'UN PAIEMENT (améliorée)
// ========================================================

app.get('/api/payment/check/:reference', async (req, res) => {
    const { reference } = req.params;

    console.log(`🔍 Vérification paiement référence: ${reference}`);

    if (!reference) {
        return res.status(400).json({ error: 'Référence requise.' });
    }

    try {
        // 1. Vérifier dans notre base
        const row = await db.get(
            'SELECT * FROM payments WHERE reference = $1 OR genius_reference = $1 OR commande_id = $1',
            [reference]
        );

        if (row) {
            console.log(`✅ Paiement trouvé dans la base: ${row.status}`);
            return res.json({
                success: true,
                status: row.status || 'pending',
                source: 'database',
                data: row
            });
        }

        // 2. Vérifier chez Genius Pay
        console.log('🔍 Recherche chez Genius Pay...');
        const response = await axios.get(
            `https://geniuspay.ci/api/v1/merchant/payments/${reference}`,
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

        res.json({
            success: true,
            status: status,
            source: 'geniuspay',
            data: paymentData
        });

    } catch (error) {
        console.error('❌ Erreur vérification:', error.message);
        
        if (error.response?.status === 404) {
            return res.json({ 
                success: true, 
                status: 'not_found',
                message: 'Transaction non trouvée'
            });
        }

        res.status(500).json({
            success: false,
            error: error.message
        });
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

        let panier = [];
        try {
            panier = JSON.parse(commande.panier);
        } catch (e) {
            console.error('❌ Erreur parsing panier:', e);
            return;
        }

        for (const item of panier) {
            const productId = item.product_id || item.id;
            const quantity = item.quantity || 1;

            const product = await db.get('SELECT quantity FROM products WHERE id = $1', [productId]);

            if (!product) {
                console.error(`❌ Produit #${productId} non trouvé`);
                continue;
            }

            if (product.quantity < quantity) {
                console.error(`❌ Stock insuffisant pour produit #${productId}: ${product.quantity} < ${quantity}`);
                continue;
            }

            await db.query(
                'UPDATE products SET quantity = quantity - $1 WHERE id = $2',
                [quantity, productId]
            );
            console.log(`✅ Stock déduit: produit #${productId} (-${quantity})`);
        }

        await db.query(
            `UPDATE payments SET status = $1 WHERE genius_reference = $2 OR reference = $2`,
            ['success', reference]
        );
        console.log(`✅ Payment ${reference} : statut -> success`);

        await db.query(
            `UPDATE commandes SET status = $1 WHERE id = $2`,
            ['payee', orderId]
        );
        console.log(`✅ Commande #${orderId} : statut -> payee`);

        const user = await db.get('SELECT user_id FROM commandes WHERE id = $1', [orderId]);
        if (user) {
            await createNotification(
                user.user_id,
                orderId,
                'paiement',
                '💳 Paiement réussi',
                `Le paiement de ${amount ? amount.toLocaleString() + ' FCFA' : ''} pour la commande #${orderId} a été confirmé.`
            );
        }

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
        await db.query(
            `UPDATE payments SET status = $1 WHERE genius_reference = $2 OR reference = $2`,
            ['failed', reference]
        );

        await db.query(
            `UPDATE commandes SET status = $1, cause_refus = $2 WHERE id = $3`,
            ['annulee', 'Paiement échoué', orderId]
        );

        const commande = await db.get('SELECT user_id FROM commandes WHERE id = $1', [orderId]);
        if (commande) {
            await createNotification(
                commande.user_id,
                orderId,
                'paiement',
                '❌ Paiement échoué',
                `Le paiement pour la commande #${orderId} a échoué. Veuillez réessayer.`
            );
        }

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
        await db.query(
            `UPDATE payments SET status = $1 WHERE genius_reference = $2 OR reference = $2`,
            ['canceled', reference]
        );

        await db.query(
            `UPDATE commandes SET status = $1, cause_refus = $2 WHERE id = $3`,
            ['annulee', 'Paiement annulé', orderId]
        );

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
        await db.query(
            `UPDATE payments SET status = $1 WHERE genius_reference = $2 OR reference = $2`,
            ['refunded', reference]
        );

        const commande = await db.get('SELECT user_id FROM commandes WHERE id = $1', [orderId]);
        if (commande) {
            await createNotification(
                commande.user_id,
                orderId,
                'paiement',
                '🔄 Remboursement effectué',
                `Le remboursement de ${amount ? amount.toLocaleString() + ' FCFA' : ''} pour la commande #${orderId} a été effectué.`
            );
        }

        console.log(`📢 ADMIN: Remboursement effectué pour la commande #${orderId}`);

    } catch (err) {
        console.error('❌ Erreur traitement payment.refunded:', err);
    }
}

// ========================================================
// DÉMARRAGE
// ========================================================

app.listen(PORT, () => {
    console.log(`========================================`);
    console.log(`🚀 SERVEUR PAIEMENT - Nature+`);
    console.log(`📍 Port: ${PORT}`);
    console.log(`📍 http://localhost:${PORT}`);
    console.log(`========================================`);
});