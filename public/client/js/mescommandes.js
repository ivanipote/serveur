document.addEventListener('DOMContentLoaded', function() {

    console.log('✅ mescommandes.js chargé');

    // ==========================================
    // URL DE L'API PAIEMENT (Render)
    // ==========================================

    const PAYMENT_API_URL = 'https://nature-plus-pay.onrender.com';

    // ==========================================
    // RÉFÉRENCES DOM
    // ==========================================

    const mainContent = document.getElementById('mainContent');
    const loadingState = document.getElementById('loadingState');
    const badgeTotal = document.getElementById('badgeTotal');
    const refreshBtn = document.getElementById('refreshStatusBtn');
    const toastContainer = document.getElementById('toastContainer');

    // Overlays
    const confirmOverlay = document.getElementById('confirmOverlay');
    const confirmIcon = document.getElementById('confirmIcon');
    const confirmTitle = document.getElementById('confirmTitle');
    const confirmMessage = document.getElementById('confirmMessage');
    const confirmOk = document.getElementById('confirmOk');
    const confirmCancel = document.getElementById('confirmCancel');

    const messageOverlay = document.getElementById('messageOverlay');
    const messageIcon = document.getElementById('messageIcon');
    const messageTitle = document.getElementById('messageTitle');
    const messageText = document.getElementById('messageText');
    const messageBtn = document.getElementById('messageBtn');

    const paymentOverlay = document.getElementById('paymentOverlay');
    const paymentAmount = document.getElementById('paymentAmount');
    const paymentPhone = document.getElementById('paymentPhone');
    const cancelPaymentBtn = document.getElementById('cancelPaymentBtn');
    const confirmPaymentBtn = document.getElementById('confirmPaymentBtn');

    // ==========================================
    // ÉTAT
    // ==========================================

    let commandes = [];
    let currentCommandeId = null;
    let currentAmount = 0;
    let currentReference = '';
    let currentUser = null;
    let socket = null;
    let isSocketConnected = false;

    // ==========================================
    // SOCKET.IO - Connexion
    // ==========================================

    function connectSocketIO() {
        if (socket) {
            socket.disconnect();
            socket = null;
        }

        console.log('🔌 Connexion Socket.IO client (mescommandes)...');

        try {
            const userId = localStorage.getItem('userId') || '1';

            socket = io({
                auth: {
                    userId: parseInt(userId),
                    isAdmin: false
                }
            });

            socket.on('connect', function() {
                console.log('✅ Socket.IO client mescommandes connecté');
                isSocketConnected = true;
            });

            socket.on('disconnect', function() {
                console.log('❌ Socket.IO client mescommandes déconnecté');
                isSocketConnected = false;
                setTimeout(() => {
                    if (!isSocketConnected) {
                        connectSocketIO();
                    }
                }, 3000);
            });

            socket.on('commande-update', function(data) {
                console.log('📦 Mise à jour commande reçue (client):', data);
                handleCommandeUpdate(data);
            });

            socket.on('notification', function(data) {
                console.log('🔔 Notification reçue (client):', data);
            });

        } catch (error) {
            console.error('❌ Erreur connexion Socket.IO:', error);
            setTimeout(() => connectSocketIO(), 5000);
        }
    }

    // ==========================================
    // GESTION DES MISES À JOUR
    // ==========================================

    function handleCommandeUpdate(data) {
        console.log('📦 Mise à jour commande (client):', data);

        const { commandeId, status, userId, message } = data;

        const userIdLocal = parseInt(localStorage.getItem('userId') || '0');
        if (userId && userId !== userIdLocal) {
            console.log('⏭️ Commande pour un autre utilisateur, ignorée');
            return;
        }

        const existingIndex = commandes.findIndex(c => c.id === commandeId);

        if (existingIndex !== -1) {
            commandes[existingIndex].status = status;
            console.log(`✅ Commande #${commandeId} mise à jour: ${status}`);
            renderCommandes();
        } else {
            console.log(`🆕 Nouvelle commande #${commandeId}, rechargement...`);
            loadCommandes();
            return;
        }

        if (badgeTotal) {
            badgeTotal.textContent = commandes.length;
        }
    }

    // ==========================================
    // AUTHENTIFICATION
    // ==========================================

    async function checkAuth() {
        try {
            const res = await fetch('/api/client/me');
            const data = await res.json();
            if (data.success) {
                currentUser = data.user;
                localStorage.setItem('userId', data.user.id);
                localStorage.setItem('userName', data.user.name);
                localStorage.setItem('userEmail', data.user.email);
                localStorage.setItem('userPhone', data.user.phone);
                console.log('👤 Utilisateur connecté:', currentUser);
                return true;
            }
            window.location.href = '/login';
            return false;
        } catch (error) {
            console.error('❌ Erreur vérification auth:', error);
            window.location.href = '/login';
            return false;
        }
    }

    // ==========================================
    // OVERLAYS
    // ==========================================

    function showConfirm(icon, title, message) {
        return new Promise((resolve) => {
            confirmIcon.textContent = icon;
            confirmTitle.textContent = title;
            confirmMessage.textContent = message;
            confirmOverlay.classList.add('active');

            confirmOk.onclick = function() {
                confirmOverlay.classList.remove('active');
                resolve({ confirmed: true });
            };
            confirmCancel.onclick = function() {
                confirmOverlay.classList.remove('active');
                resolve({ confirmed: false });
            };
        });
    }

    confirmOverlay.addEventListener('click', function(e) {
        if (e.target === confirmOverlay) {
            confirmOverlay.classList.remove('active');
        }
    });

    function showMessage(icon, title, text) {
        return new Promise((resolve) => {
            messageIcon.textContent = icon;
            messageTitle.textContent = title;
            messageText.textContent = text;
            messageOverlay.classList.add('active');
            messageBtn.onclick = function() {
                messageOverlay.classList.remove('active');
                resolve();
            };
        });
    }

    messageOverlay.addEventListener('click', function(e) {
        if (e.target === messageOverlay) {
            messageOverlay.classList.remove('active');
        }
    });

    function openPaymentOverlay(commandeId, amount, phone, reference) {
        currentCommandeId = commandeId;
        currentAmount = amount;
        currentReference = reference;
        paymentAmount.textContent = amount.toLocaleString() + ' FCFA';
        paymentPhone.textContent = phone || 'Non renseigné';
        paymentOverlay.classList.add('active');
    }

    function closePaymentOverlay() {
        paymentOverlay.classList.remove('active');
    }

    if (cancelPaymentBtn) {
        cancelPaymentBtn.addEventListener('click', closePaymentOverlay);
    }

    if (confirmPaymentBtn) {
        confirmPaymentBtn.addEventListener('click', async function() {
            const phone = currentUser?.phone || localStorage.getItem('userPhone');
            if (!phone) {
                closePaymentOverlay();
                await showMessage('📱', 'Numéro manquant', 'Veuillez renseigner votre numéro Wave dans votre profil.');
                return;
            }
            closePaymentOverlay();
            await handlePayment(currentCommandeId, currentAmount, currentReference, phone);
        });
    }

    // ==========================================
    // CHARGER LES COMMANDES
    // ==========================================

    async function loadCommandes() {
        console.log('📥 Chargement des commandes...');
        if (loadingState) loadingState.style.display = 'block';

        try {
            const res = await fetch('/api/commandes');
            const data = await res.json();

            if (res.ok && data.length > 0) {
                commandes = data;
                if (badgeTotal) badgeTotal.textContent = data.length;
                renderCommandes();
            } else if (res.ok && data.length === 0) {
                mainContent.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-shopping-bag"></i>
                        <h3>Aucune commande</h3>
                        <p>Vous n'avez pas encore passé de commande.</p>
                        <a href="/dashboard" class="btn-shop">🛍️ Voir les produits</a>
                    </div>
                `;
            } else {
                mainContent.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-exclamation-circle"></i>
                        <h3>Erreur</h3>
                        <p>Impossible de charger vos commandes.</p>
                    </div>
                `;
            }
        } catch (error) {
            console.error('❌ Erreur:', error);
            mainContent.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-circle"></i>
                    <h3>Erreur de connexion</h3>
                    <p>Impossible de charger vos commandes.</p>
                </div>
            `;
        } finally {
            if (loadingState) loadingState.style.display = 'none';
        }
    }

    // ==========================================
    // EXTRAIRE LES PRODUITS (utilisé pour le détail)
    // ==========================================

    function extractProducts(panierData) {
        if (!panierData) return [];
        if (Array.isArray(panierData)) return panierData;
        if (typeof panierData === 'string') {
            try {
                const parsed = JSON.parse(panierData);
                if (Array.isArray(parsed)) return parsed;
                if (parsed && typeof parsed === 'object') {
                    if (Array.isArray(parsed.panier)) return parsed.panier;
                    if (Array.isArray(parsed.items)) return parsed.items;
                    if (Array.isArray(parsed.products)) return parsed.products;
                }
                return [];
            } catch (e) {
                return [];
            }
        }
        if (typeof panierData === 'object') {
            if (Array.isArray(panierData.panier)) return panierData.panier;
            if (Array.isArray(panierData.items)) return panierData.items;
            if (Array.isArray(panierData.products)) return panierData.products;
            const values = Object.values(panierData);
            if (values.length > 0 && Array.isArray(values[0])) {
                return values[0];
            }
            return [];
        }
        return [];
    }

    // ==========================================
    // VÉRIFIER LE PAIEMENT
    // ==========================================

    async function checkPaymentWithGenius(commandeId, reference, geniusReference) {
        const btn = document.querySelector(`.btn-sync[data-id="${commandeId}"]`);
        if (!btn) return;

        const refToCheck = geniusReference || reference;
        if (!refToCheck || /^\d+$/.test(refToCheck)) {
            return;
        }

        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        try {
            const res = await fetch(`${PAYMENT_API_URL}/api/payment/check/${refToCheck}`);

            if (!res.ok) {
                if (res.status === 500) {
                    console.warn('⚠️ Service de paiement temporairement indisponible');
                } else {
                    console.warn('⚠️ Erreur lors de la vérification');
                }
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-sync-alt"></i>';
                return;
            }

            const data = await res.json();

            if (data.success && data.status === 'success') {
                const updateRes = await fetch(`${PAYMENT_API_URL}/api/payment/update-status`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ commandeId, status: 'paiement_effectue' })
                });
                if (updateRes.ok) {
                    await loadCommandes();
                } else {
                    console.warn('⚠️ Mise à jour en cours...');
                }
            } else if (data.status === 'pending') {
                console.log('⏳ Paiement en attente...');
            } else if (data.status === 'not_found') {
                console.log('ℹ️ Aucun paiement trouvé pour cette commande');
            } else {
                console.log('❌ Statut: ' + (data.status || 'inconnu'));
            }
        } catch (error) {
            console.error('Erreur vérification:', error);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-sync-alt"></i>';
            }
        }
    }

    // ==========================================
    // ANNULER LE PAIEMENT
    // ==========================================

    async function cancelPayment(commandeId) {
        try {
            const res = await fetch(`${PAYMENT_API_URL}/api/payment/cancel`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ commandeId })
            });
            const data = await res.json();
            if (res.ok) {
                await showMessage('✅', 'Paiement annulé', 'Le paiement a été annulé avec succès.');
                await loadCommandes();
            } else {
                await showMessage('❌', 'Erreur', data.error || 'Impossible d\'annuler.');
            }
        } catch (error) {
            console.error('Erreur annulation paiement:', error);
            await showMessage('❌', 'Erreur', 'Erreur de connexion au serveur de paiement.');
        }
    }

    // ==========================================
    // ANNULER UNE COMMANDE
    // ==========================================

    async function cancelCommande(commandeId) {
        try {
            const res = await fetch('/api/commande/cancel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ commandeId })
            });
            const data = await res.json();
            if (res.ok) {
                await loadCommandes();
            } else {
                await showMessage('❌', 'Erreur', data.error || 'Impossible d\'annuler.');
            }
        } catch (error) {
            console.error('Erreur annulation:', error);
            await showMessage('❌', 'Erreur', 'Erreur de connexion au serveur.');
        }
    }

    // ==========================================
    // SUPPRIMER UNE COMMANDE
    // ==========================================

    async function deleteCommande(commandeId) {
        try {
            const res = await fetch(`/api/commande/delete/${commandeId}`, { method: 'DELETE' });
            const data = await res.json();
            if (res.ok) {
                await showMessage('✅', 'Commande supprimée', 'La commande a été supprimée avec succès.');
                await loadCommandes();
            } else {
                await showMessage('❌', 'Erreur', data.error || 'Impossible de supprimer.');
            }
        } catch (error) {
            console.error('Erreur suppression:', error);
            await showMessage('❌', 'Erreur', 'Erreur de connexion au serveur.');
        }
    }

    // ==========================================
    // RESTAURER UNE COMMANDE
    // ==========================================

    async function restoreCommande(commandeId) {
        try {
            const res = await fetch(`${PAYMENT_API_URL}/api/commande/restore/${commandeId}`, { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                await showMessage('✅', 'Commande restaurée', 'La commande est de nouveau en attente.');
                await loadCommandes();
            } else {
                await showMessage('❌', 'Erreur', data.error || 'Impossible de restaurer.');
            }
        } catch (error) {
            console.error('Erreur restauration:', error);
            await showMessage('❌', 'Erreur', 'Erreur de connexion au serveur de paiement.');
        }
    }

    // ==========================================
    // PAIEMENT
    // ==========================================

    async function handlePayment(commandeId, amount, reference, phone) {
        if (!phone) {
            await showMessage('📱', 'Numéro manquant', 'Veuillez renseigner votre numéro Wave dans votre profil.');
            return;
        }

        try {
            const res = await fetch(`${PAYMENT_API_URL}/api/payment/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    commandeId,
                    reference: reference || commandeId.toString(),
                    amount,
                    phone,
                    description: `Commande Nature+ #${commandeId} (${reference})`
                })
            });

            const data = await res.json();

            if (res.ok && data.success && data.checkout_url) {
                window.open(data.checkout_url, '_blank');
                setTimeout(() => loadCommandes(), 500);
            } else {
                await showMessage('❌', 'Erreur', data.error || 'Impossible de créer le paiement.');
            }
        } catch (error) {
            console.error('Erreur paiement:', error);
            await showMessage('❌', 'Erreur', 'Erreur de connexion au serveur de paiement.');
        }
    }

    // ==========================================
    // BOUTON RAFRAÎCHIR
    // ==========================================

    if (refreshBtn) {
        refreshBtn.addEventListener('click', async function() {
            this.disabled = true;
            this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Rafraîchissement...';

            try {
                await loadCommandes();
                const paymentInProgress = commandes.filter(c => c.status === 'paiement_en_cours');
                if (paymentInProgress.length > 0) {
                    for (const commande of paymentInProgress) {
                        const ref = commande.reference || commande.id;
                        const geniusRef = commande.genius_reference || '';
                        await checkPaymentWithGenius(commande.id, ref, geniusRef);
                    }
                }
            } catch (error) {
                console.error('❌ Erreur rafraîchissement:', error);
            } finally {
                this.disabled = false;
                this.innerHTML = '<i class="fas fa-sync-alt"></i> Rafraîchir';
            }
        });
    }

    // ==========================================
    // RENDU DES COMMANDES (Modèle 5 - sans cause_refus)
    // ==========================================

    function renderCommandes() {
        console.log('🎨 Rendu des commandes, nombre:', commandes.length);

        if (commandes.length === 0) {
            mainContent.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-shopping-bag"></i>
                    <h3>Aucune commande</h3>
                    <p>Vous n'avez pas encore passé de commande.</p>
                    <a href="/dashboard" class="btn-shop">🛍️ Voir les produits</a>
                </div>
            `;
            return;
        }

        const statusLabels = {
            'en_attente': { label: 'En attente de validation', icon: '⏳', class: 'en_attente' },
            'accepter': { label: 'Effectuer le paiement', icon: '💳', class: 'accepter' },
            'paiement_en_cours': { label: 'Paiement en cours...', icon: '⏳', class: 'paiement_en_cours' },
            'paiement_effectue': { label: 'Payée — En préparation', icon: '✅', class: 'paiement_effectue' },
            'livraison_en_cours': { label: 'En cours de livraison', icon: '🚚', class: 'livraison_en_cours' },
            'disponible': { label: 'Commande disponible', icon: '📍', class: 'disponible' },
            'recuperee': { label: 'Commande récupérée !', icon: '✅', class: 'recuperee' },
            'refuse': { label: 'Commande refusée', icon: '❌', class: 'refuse' },
            'annulee': { label: 'Commande annulée', icon: '❌', class: 'annulee' }
        };

        let html = '';

        commandes.forEach((c) => {
            const statusClass = c.status || 'en_attente';
            const statusInfo = statusLabels[statusClass] || { label: statusClass, icon: '📋', class: 'en_attente' };

            const isPayable = c.status === 'accepter';
            const isDeletable = c.status === 'refuse' || c.status === 'annulee';
            const isCancellable = c.status === 'en_attente';
            const isRestorable = c.status === 'annulee';
            const isPaymentInProgress = c.status === 'paiement_en_cours';
            const showSync = c.status === 'paiement_en_cours' || c.status === 'paiement_effectue';

            const date = new Date(c.created_at);
            const dateStr = date.toLocaleDateString('fr-FR') + ' ' + date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
            const refDisplay = c.reference || `NAT-${c.id}`;

            html += `
                <div class="commande-card status-${statusClass}">
                    <span class="badge-top ${statusInfo.class}">${statusInfo.icon} ${statusInfo.label}</span>
                    <div class="id">#${c.id}</div>
                    <span class="ref">${refDisplay}</span>
                    <span class="date">${dateStr}</span>
                    <div class="total">${(c.total || 0).toLocaleString()} FCFA</div>
                    <div class="status-text"><span class="status-icon">${statusInfo.icon}</span> ${statusInfo.label}</div>
                    <div class="actions">
                        ${isPaymentInProgress ? `
                            <button class="btn btn-cancel-pay" data-id="${c.id}">
                                <i class="fas fa-times-circle"></i> Annuler paiement
                            </button>
                        ` : ''}
                        ${isPayable ? `
                            <button class="btn btn-pay" data-id="${c.id}" data-total="${c.total}" data-ref="${c.reference || c.id}">
                                <i class="fas fa-credit-card"></i> Payer
                            </button>
                        ` : ''}
                        ${isRestorable ? `
                            <button class="btn btn-restore" data-id="${c.id}">
                                <i class="fas fa-undo"></i> Restaurer
                            </button>
                        ` : ''}
                        ${isDeletable ? `
                            <button class="btn btn-delete" data-id="${c.id}">
                                <i class="fas fa-trash-alt"></i> Supprimer
                            </button>
                        ` : ''}
                        ${isCancellable ? `
                            <button class="btn btn-cancel" data-id="${c.id}">
                                <i class="fas fa-times-circle"></i> Annuler
                            </button>
                        ` : ''}
                        ${showSync ? `
                            <button class="btn-sync" data-id="${c.id}" data-ref="${c.reference || c.id}" data-genius="${c.genius_reference || ''}" title="Vérifier le paiement">
                                <i class="fas fa-sync-alt"></i> Sync
                            </button>
                        ` : ''}
                        <button class="btn btn-detail" data-id="${c.id}">
                            <i class="fas fa-eye"></i> Détails
                        </button>
                    </div>
                </div>
            `;
        });

        mainContent.innerHTML = html;

        // ===== ÉVÉNEMENTS =====

        document.querySelectorAll('.btn-sync').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const id = parseInt(this.dataset.id);
                const ref = this.dataset.ref;
                const geniusRef = this.dataset.genius || '';
                checkPaymentWithGenius(id, ref, geniusRef);
            });
        });

        document.querySelectorAll('.btn-cancel-pay').forEach(btn => {
            btn.addEventListener('click', async function() {
                const id = parseInt(this.dataset.id);
                const result = await showConfirm('❌', 'Annuler le paiement', 'Êtes-vous sûr de vouloir annuler ce paiement ?');
                if (result.confirmed) await cancelPayment(id);
            });
        });

        document.querySelectorAll('.btn-pay').forEach(btn => {
            btn.addEventListener('click', function() {
                const id = parseInt(this.dataset.id);
                const total = parseInt(this.dataset.total);
                const ref = this.dataset.ref;
                const phone = currentUser?.phone || localStorage.getItem('userPhone');
                openPaymentOverlay(id, total, phone, ref);
            });
        });

        document.querySelectorAll('.btn-restore').forEach(btn => {
            btn.addEventListener('click', async function() {
                const id = parseInt(this.dataset.id);
                const result = await showConfirm('🔄', 'Restaurer la commande', 'Voulez-vous restaurer cette commande ?');
                if (result.confirmed) await restoreCommande(id);
            });
        });

        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', async function() {
                const id = parseInt(this.dataset.id);
                const result = await showConfirm('🗑️', 'Supprimer la commande', 'Cette action est définitive.');
                if (result.confirmed) await deleteCommande(id);
            });
        });

        document.querySelectorAll('.btn-cancel').forEach(btn => {
            btn.addEventListener('click', async function() {
                const id = parseInt(this.dataset.id);
                const result = await showConfirm('⚠️', 'Annuler la commande', 'Êtes-vous sûr de vouloir annuler cette commande ?');
                if (result.confirmed) await cancelCommande(id);
            });
        });

        document.querySelectorAll('.btn-detail').forEach(btn => {
            btn.addEventListener('click', function() {
                window.location.href = `/detailcom?id=${this.dataset.id}`;
            });
        });
    }

    // ==========================================
    // INITIALISATION
    // ==========================================

    (async function init() {
        try {
            console.log('🚀 Initialisation de mescommandes...');
            const isAuth = await checkAuth();
            if (!isAuth) return;
            await loadCommandes();
            connectSocketIO();
            console.log('✅ Initialisation terminée');
        } catch (error) {
            console.error('❌ Erreur lors de l\'initialisation:', error);
        }
    })();

});