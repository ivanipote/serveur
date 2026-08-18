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
// 🆕 ROUTE HEALTH (pour Render)
// ========================================================

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', service: 'payment' });
});

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

        const payload = {
            amount: amount,
            currency: 'XOF',
            description: description || `Commande Nature+ #${commandeId}`,
            customer: {
                phone: cleanPhone
            },
            method: 'WAVE',
            successUrl: `https://ivanipote.github.io/success/?commande_id=${commandeId}`,
            errorUrl: `https://ivanipote.github.io/success/failed.html?commande_id=${commandeId}`
        };

        console.log('📤 Envoi à Genius Pay...');
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
                    console.log('✅ Payment enregistré');
                }
            }
        );

        db.run(
            `UPDATE commandes SET status = 'paiement_en_cours' WHERE id = ?`,
            [commandeId]
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
// ROUTE : METTRE À JOUR LE STATUT (depuis les pages de retour)
// ========================================================

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

        const paymentStatus = status === 'payee' ? 'success' : 'canceled';
        db.run(
            `UPDATE payments SET status = ? WHERE commande_id = ?`,
            [paymentStatus, commandeId]
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

// ========================================================
// ROUTE : ANNULER UN PAIEMENT (manuel)
// ========================================================

app.post('/api/payment/cancel', (req, res) => {
    const { commandeId } = req.body;

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

                    res.json({ success: true, message: 'Paiement annulé avec succès' });
                }
            );
        }
    );
});

// ========================================================
// ROUTE : VÉRIFIER LE STATUT D'UN PAIEMENT (API)
// ========================================================

app.get('/api/payment/check/:reference', async (req, res) => {
    const { reference } = req.params;

    if (!reference) {
        return res.status(400).json({ error: 'Référence requise.' });
    }

    if (/^\d+$/.test(reference)) {
        db.get(
            'SELECT * FROM payments WHERE commande_id = ?',
            [reference],
            (err, row) => {
                if (err) {
                    return res.status(500).json({ success: false, error: err.message });
                }
                if (!row) {
                    return res.json({ success: true, status: 'not_found' });
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

        res.json({
            success: true,
            status: status,
            data: response.data
        });
    } catch (error) {
        console.error('❌ Erreur vérification:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ========================================================
// ROUTE : RESTAURER UNE COMMANDE
// ========================================================

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

// ========================================================
// ROUTE : WEBHOOK (CONFORME À LA DOC)
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

function processWebhookEvent(event, payload) {
    console.log(`📥 Traitement de l'événement: ${event}`);
    const data = payload.data;

    switch (event) {
        case 'payment.success':
            handlePaymentSuccess(data);
            break;
        case 'payment.failed':
            handlePaymentFailed(data);
            break;
        case 'payment.cancelled':
            handlePaymentCancelled(data);
            break;
        case 'payment.refunded':
            handlePaymentRefunded(data);
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

function handlePaymentSuccess(data) {
    const reference = data.reference;
    const orderId = data.metadata?.order_id || data.metadata?.commande_id;
    const amount = data.amount;

    console.log(`✅ Paiement réussi - Réf: ${reference}, Commande: ${orderId}, Montant: ${amount}`);

    if (!orderId) {
        console.warn('⚠️ Pas de commande_id dans le webhook');
        return;
    }

    db.run(
        `UPDATE payments SET status = 'success' WHERE genius_reference = ? OR reference = ?`,
        [reference, reference],
        function(err) {
            if (err) {
                console.error('❌ Erreur mise à jour payment:', err);
            } else {
                console.log(`✅ Payment ${reference} : statut -> success`);
            }
        }
    );

    db.run(
        `UPDATE commandes SET status = 'payee' WHERE id = ?`,
        [orderId],
        function(err) {
            if (err) {
                console.error('❌ Erreur mise à jour commande:', err);
            } else {
                console.log(`✅ Commande #${orderId} : statut -> payee`);
                
                db.get(
                    `SELECT user_id FROM commandes WHERE id = ?`,
                    [orderId],
                    (err, row) => {
                        if (err || !row) return;
                        
                        createNotification(
                            row.user_id,
                            orderId,
                            'paiement',
                            '💳 Paiement réussi',
                            `Le paiement de ${amount ? amount.toLocaleString() + ' FCFA' : ''} pour la commande #${orderId} a été confirmé.`
                        );
                    }
                );
            }
        }
    );
}

function handlePaymentFailed(data) {
    const reference = data.reference;
    const orderId = data.metadata?.order_id || data.metadata?.commande_id;

    console.log(`❌ Paiement échoué - Réf: ${reference}, Commande: ${orderId}`);

    if (!orderId) return;

    db.run(
        `UPDATE payments SET status = 'failed' WHERE genius_reference = ? OR reference = ?`,
        [reference, reference]
    );

    db.run(
        `UPDATE commandes SET status = 'annulee', cause_refus = 'Paiement échoué' WHERE id = ?`,
        [orderId],
        function(err) {
            if (err) return;
            
            db.get(
                `SELECT user_id FROM commandes WHERE id = ?`,
                [orderId],
                (err, row) => {
                    if (err || !row) return;
                    
                    createNotification(
                        row.user_id,
                        orderId,
                        'paiement',
                        '❌ Paiement échoué',
                        `Le paiement pour la commande #${orderId} a échoué. Veuillez réessayer.`
                    );
                }
            );
        }
    );
}

function handlePaymentCancelled(data) {
    const reference = data.reference;
    const orderId = data.metadata?.order_id || data.metadata?.commande_id;

    console.log(`⏰ Paiement annulé - Réf: ${reference}, Commande: ${orderId}`);

    if (!orderId) return;

    db.run(
        `UPDATE payments SET status = 'canceled' WHERE genius_reference = ? OR reference = ?`,
        [reference, reference]
    );

    db.run(
        `UPDATE commandes SET status = 'annulee', cause_refus = 'Paiement annulé' WHERE id = ?`,
        [orderId]
    );
}

function handlePaymentRefunded(data) {
    const reference = data.reference;
    const orderId = data.metadata?.order_id || data.metadata?.commande_id;
    const amount = data.amount;

    console.log(`🔄 Paiement remboursé - Réf: ${reference}, Commande: ${orderId}`);

    if (!orderId) return;

    db.run(
        `UPDATE payments SET status = 'refunded' WHERE genius_reference = ? OR reference = ?`,
        [reference, reference]
    );

    db.get(
        `SELECT user_id FROM commandes WHERE id = ?`,
        [orderId],
        (err, row) => {
            if (err || !row) return;
            
            createNotification(
                row.user_id,
                orderId,
                'paiement',
                '🔄 Remboursement effectué',
                `Le remboursement de ${amount ? amount.toLocaleString() + ' FCFA' : ''} pour la commande #${orderId} a été effectué.`
            );
        }
    );
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
