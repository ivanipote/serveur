document.addEventListener('DOMContentLoaded', function() {

    const PAYMENT_API_URL = 'https://nature-plus-pay.onrender.com';
    const WAVE_API_URL = 'https://server-wave-js.onrender.com';

    const mainContent = document.getElementById('mainContent');
    const loadingState = document.getElementById('loadingState');
    const badgeTotal = document.getElementById('badgeTotal');
    const syncBtn = document.getElementById('syncBtn');
    const syncStatus = document.getElementById('syncStatus');

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

    let commandes = [];
    let currentCommandeId = null;
    let currentAmount = 0;
    let currentReference = '';
    let currentUser = null;
    let socket = null;
    let isSocketConnected = false;
    let syncInterval = null;
    let isSyncing = false;
    let isSyncActive = true;
    let isFirstLoad = true;
    let timerIntervals = {};
    let generatingLinks = {};
    let verificationIntervals = {};

    const TIMEOUT_MINUTES = 20;
    const TIMEOUT_MS = TIMEOUT_MINUTES * 60 * 1000;
    const VERIFICATION_INTERVAL = 10000; // 10 secondes

    // ==========================================
    // UI SYNC
    // ==========================================

    function updateSyncUI() {
        if (isSyncActive) {
            syncBtn.classList.add('active');
            syncBtn.classList.remove('paused');
            syncStatus.textContent = '●';
            syncStatus.className = 'sync-status active';
            syncBtn.title = 'Synchronisation active - Cliquer pour mettre en pause';
            startSync();
        } else {
            syncBtn.classList.remove('active');
            syncBtn.classList.add('paused');
            syncStatus.textContent = '○';
            syncStatus.className = 'sync-status paused';
            syncBtn.title = 'Synchronisation en pause - Cliquer pour reprendre';
            stopSync();
        }
    }

    if (syncBtn) {
        syncBtn.addEventListener('click', function() {
            isSyncActive = !isSyncActive;
            updateSyncUI();
        });
    }

    // ==========================================
    // SYNC
    // ==========================================

    function startSync() {
        if (syncInterval) {
            clearInterval(syncInterval);
        }
        loadCommandes();
        syncInterval = setInterval(() => {
            if (!isSyncing && isSyncActive) {
                loadCommandes();
            }
        }, 5000);
    }

    function stopSync() {
        if (syncInterval) {
            clearInterval(syncInterval);
            syncInterval = null;
        }
    }

    // ==========================================
    // SOCKET.IO
    // ==========================================

    function connectSocketIO() {
        if (socket) {
            socket.disconnect();
            socket = null;
        }

        try {
            const userId = localStorage.getItem('userId') || '1';

            socket = io({
                auth: {
                    userId: parseInt(userId),
                    isAdmin: false
                }
            });

            socket.on('connect', function() {
                isSocketConnected = true;
            });

            socket.on('disconnect', function() {
                isSocketConnected = false;
                setTimeout(() => {
                    if (!isSocketConnected) {
                        connectSocketIO();
                    }
                }, 3000);
            });

            socket.on('commande-update', function(data) {
                handleCommandeUpdate(data);
            });

            socket.on('notification', function(data) {
                loadCommandes();
            });

        } catch (error) {
            setTimeout(() => connectSocketIO(), 5000);
        }
    }

    function handleCommandeUpdate(data) {
        const { commandeId, status, userId } = data;

        const userIdLocal = parseInt(localStorage.getItem('userId') || '0');
        if (userId && userId !== userIdLocal) {
            return;
        }

        const existingIndex = commandes.findIndex(c => c.id === commandeId);

        if (existingIndex !== -1) {
            commandes[existingIndex].status = status;
            if (['paiement_effectue', 'annulee', 'refuse'].includes(status)) {
                stopVerification(commandeId);
            }
            renderCommandes();
        } else {
            loadCommandes();
            return;
        }

        if (badgeTotal) {
            badgeTotal.textContent = commandes.length;
        }
    }

    // ==========================================
    // OVERLAYS
    // ==========================================

    function showMessage(icon, title, text) {
        messageIcon.textContent = icon;
        messageTitle.textContent = title;
        messageText.textContent = text;
        messageOverlay.classList.add('active');
    }

    function hideMessage() {
        messageOverlay.classList.remove('active');
    }

    messageBtn.addEventListener('click', hideMessage);
    messageOverlay.addEventListener('click', function(e) {
        if (e.target === messageOverlay) hideMessage();
    });

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
    // AUTH
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
                return true;
            }
            window.location.href = '/login';
            return false;
        } catch (error) {
            window.location.href = '/login';
            return false;
        }
    }

    // ==========================================
    // CHARGER LES COMMANDES
    // ==========================================

    async function loadCommandes() {
        if (isFirstLoad && loadingState) {
            loadingState.style.display = 'block';
        }

        try {
            const res = await fetch('/api/commandes');
            const data = await res.json();

            if (res.ok && data.length > 0) {
                commandes = data;
                if (badgeTotal) badgeTotal.textContent = data.length;
                isFirstLoad = false;
                renderCommandes();
            } else if (res.ok && data.length === 0) {
                commandes = [];
                isFirstLoad = false;
                mainContent.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-shopping-bag"></i>
                        <h3>Aucune commande</h3>
                        <p>Vous n'avez pas encore passé de commande.</p>
                        <a href="/dashboard" class="btn-shop">🛍️ Voir les produits</a>
                    </div>
                `;
            } else {
                isFirstLoad = false;
                mainContent.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-exclamation-circle"></i>
                        <h3>Erreur</h3>
                        <p>Impossible de charger vos commandes.</p>
                    </div>
                `;
            }
        } catch (error) {
            isFirstLoad = false;
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
    // EXTRAIRE LES PRODUITS
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
    // ✅ GÉNÉRER LE LIEN DE PAIEMENT
    // ==========================================

    async function generatePaymentLink(commandeId, amount, reference, phone) {
        if (generatingLinks[commandeId]) return;
        
        // ✅ Marquer comme en cours de génération
        generatingLinks[commandeId] = true;
        renderCommandes();

        try {
            // 1. Vérifier si un lien existe déjà
            const linkRes = await fetch(`${PAYMENT_API_URL}/api/payment/link/${commandeId}`);
            const linkData = await linkRes.json();

            if (linkData.success && linkData.has_link) {
                if (linkData.is_final) {
                    await showMessage('✅', 'Paiement déjà effectué', 'Cette commande a déjà été payée.');
                    generatingLinks[commandeId] = false;
                    renderCommandes();
                    return;
                }
                if (linkData.checkout_url) {
                    // ✅ Lien existant → notification déjà envoyée
                    await showMessage('🔗', 'Lien déjà généré', 'Le lien de paiement est déjà disponible dans vos notifications.');
                    generatingLinks[commandeId] = false;
                    renderCommandes();
                    return;
                }
            }

            // 2. Générer un nouveau lien
            const res = await fetch(`${PAYMENT_API_URL}/api/payment/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    commandeId: parseInt(commandeId),
                    reference: reference,
                    amount: amount,
                    phone: phone,
                    description: `Commande Nature+ #${commandeId}`
                })
            });

            const data = await res.json();

            if (res.ok && data.success && data.checkout_url) {
                // ✅ Lien généré → overlay de confirmation
                await showConfirm(
                    '✅',
                    'Lien généré avec succès !',
                    'Votre lien de paiement a été envoyé dans vos notifications. Veuillez finaliser votre paiement.'
                );
                
                // ✅ Mettre à jour la commande en local
                const cmd = commandes.find(c => c.id === commandeId);
                if (cmd) {
                    cmd.status = 'paiement_en_cours';
                    cmd.checkout_url = data.checkout_url;
                    cmd.genius_reference = data.genius_reference;
                }
                
                generatingLinks[commandeId] = false;
                renderCommandes();
                
                // ✅ Démarrer la vérification continue
                startVerification(commandeId);
                
            } else {
                generatingLinks[commandeId] = false;
                renderCommandes();
                await showMessage('❌', 'Erreur', data.error || 'Impossible de générer le lien de paiement.');
            }
        } catch (error) {
            console.error('Erreur génération lien:', error);
            generatingLinks[commandeId] = false;
            renderCommandes();
            await showMessage('❌', 'Erreur', 'Erreur de connexion au serveur de paiement.');
        }
    }

    // ==========================================
    // ✅ VÉRIFICATION CONTINUE DU STATUT
    // ==========================================

    function startVerification(commandeId) {
        stopVerification(commandeId);

        console.log(`🔍 Début vérification continue pour commande #${commandeId}`);

        checkAndUpdateStatus(commandeId);

        verificationIntervals[commandeId] = setInterval(() => {
            checkAndUpdateStatus(commandeId);
        }, VERIFICATION_INTERVAL);
    }

    function stopVerification(commandeId) {
        if (verificationIntervals[commandeId]) {
            clearInterval(verificationIntervals[commandeId]);
            delete verificationIntervals[commandeId];
            console.log(`⏹️ Vérification arrêtée pour commande #${commandeId}`);
        }
    }

    async function checkAndUpdateStatus(commandeId) {
        try {
            const res = await fetch(`${PAYMENT_API_URL}/api/payment/status/${commandeId}`);
            const data = await res.json();

            if (data.success && data.payment) {
                const geniusStatus = data.payment.genius_status || data.payment.status;
                const commande = commandes.find(c => c.id === commandeId);

                if (!commande) return;

                if (geniusStatus === 'success' || geniusStatus === 'paiement_effectue') {
                    commande.status = 'paiement_effectue';
                    stopVerification(commandeId);
                    renderCommandes();
                    await showMessage('✅', 'Paiement réussi !', 'Votre paiement a été confirmé avec succès.');
                    
                } else if (geniusStatus === 'expired' || geniusStatus === 'failed' || geniusStatus === 'cancelled') {
                    commande.status = 'annulee';
                    commande.cause_refus = geniusStatus === 'expired' ? 'Paiement expiré (20 min)' : 'Paiement échoué';
                    stopVerification(commandeId);
                    renderCommandes();
                    await showMessage('⏳', 'Paiement non finalisé', 'Le délai de paiement a expiré ou a été annulé.');
                }
            }
        } catch (error) {
            console.error(`❌ Erreur vérification statut #${commandeId}:`, error);
        }
    }

    // ==========================================
    // ✅ VÉRIFICATION WAVE (demande admin)
    // ==========================================

    async function verifyWavePayment(commandeId, codeLogin, waveId) {
        try {
            const res = await fetch(`${WAVE_API_URL}/api/wave/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    commande_id: parseInt(commandeId),
                    code_login: codeLogin,
                    wave_id: waveId
                })
            });

            const data = await res.json();

            if (data.success) {
                const cmd = commandes.find(c => c.id === commandeId);
                if (cmd) {
                    cmd.status = 'verification_en_cours';
                }
                renderCommandes();
                await showMessage('🔍', 'Vérification en cours', 'Votre demande a été envoyée à l\'admin. Vous serez informé.');
                return true;
            } else {
                await showMessage('❌', 'Erreur', data.error || 'Erreur lors de l\'envoi.');
                return false;
            }
        } catch (error) {
            console.error('Erreur vérification Wave:', error);
            await showMessage('❌', 'Erreur', 'Erreur de connexion au serveur.');
            return false;
        }
    }

    // ==========================================
    // PAIEMENT CLASSIQUE (via Genius Pay)
    // ==========================================

    async function handlePayment(commandeId, amount, reference, phone) {
        if (!phone) {
            await showMessage('📱', 'Numéro manquant', 'Veuillez renseigner votre numéro Wave dans votre profil.');
            return;
        }

        await generatePaymentLink(commandeId, amount, reference, phone);
    }

    // ==========================================
    // TIMER
    // ==========================================

    function startTimer(commandeId, paymentCreatedAt) {
        if (timerIntervals[commandeId]) {
            clearInterval(timerIntervals[commandeId]);
        }

        const createdDate = new Date(paymentCreatedAt);
        const expiryTime = createdDate.getTime() + TIMEOUT_MS;

        function updateTimer() {
            const now = Date.now();
            const diff = expiryTime - now;

            const timerElement = document.getElementById(`timer-${commandeId}`);

            if (!timerElement) return;

            if (diff <= 0) {
                timerElement.textContent = '⏳ Expiré';
                timerElement.className = 'timer expired';
                clearInterval(timerIntervals[commandeId]);
                delete timerIntervals[commandeId];
                return;
            }

            const minutes = Math.floor(diff / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);
            const displayMinutes = String(minutes).padStart(2, '0');
            const displaySeconds = String(seconds).padStart(2, '0');

            timerElement.textContent = `⏳ ${displayMinutes}:${displaySeconds}`;
            timerElement.className = 'timer';
        }

        updateTimer();
        timerIntervals[commandeId] = setInterval(updateTimer, 1000);
    }

    // ==========================================
    // HISTORIQUE DES STATUTS
    // ==========================================

    function getStatusHistory(commande) {
        const currentStatus = commande.genius_status || commande.status || 'en_attente';
        
        const statusFlow = [
            'en_attente', 'accepter', 
            'pending', 'processing', 
            'paiement_effectue', 'success',
            'failed', 'cancelled', 'expired', 'refunded',
            'livraison_en_cours', 'disponible', 'recuperee', 'annulee', 'refuse'
        ];

        if (currentStatus === 'en_attente' || currentStatus === 'accepter') {
            return { old: null, current: currentStatus };
        }

        const currentIndex = statusFlow.indexOf(currentStatus);
        let oldStatus = null;

        if (currentIndex > 0) {
            for (let i = currentIndex - 1; i >= 0; i--) {
                const candidate = statusFlow[i];
                if (candidate === commande.status || candidate === commande.genius_status) {
                    oldStatus = candidate;
                    break;
                }
            }
            
            if (!oldStatus && currentStatus !== 'en_attente') {
                oldStatus = 'en_attente';
            }
        }

        return { old: oldStatus, current: currentStatus };
    }

    // ==========================================
    // RENDRE LES COMMANDES
    // ==========================================

    function renderCommandes() {
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
            'en_attente': { label: 'En attente', icon: '⏳', class: 'en_attente' },
            'accepter': { label: 'Paiement requis', icon: '💳', class: 'accepter' },
            'paiement_en_cours': { label: 'En cours...', icon: '⏳', class: 'paiement_en_cours' },
            'pending': { label: 'pending', icon: '⏳', class: 'pending' },
            'processing': { label: 'processing', icon: '⏳', class: 'processing' },
            'paiement_effectue': { label: 'Payée', icon: '✅', class: 'paiement_effectue' },
            'success': { label: 'success', icon: '✅', class: 'success' },
            'failed': { label: 'failed', icon: '❌', class: 'failed' },
            'cancelled': { label: 'cancelled', icon: '⏰', class: 'cancelled' },
            'expired': { label: 'expired', icon: '⏳', class: 'expired' },
            'refunded': { label: 'refunded', icon: '🔄', class: 'refunded' },
            'verification_en_cours': { label: 'Vérification en cours', icon: '🔍', class: 'verification_en_cours' },
            'livraison_en_cours': { label: 'En livraison', icon: '🚚', class: 'livraison_en_cours' },
            'disponible': { label: 'Disponible', icon: '📍', class: 'disponible' },
            'recuperee': { label: 'Récupérée', icon: '✅', class: 'recuperee' },
            'annulee': { label: 'Annulée', icon: '❌', class: 'annulee' },
            'refuse': { label: 'Refusée', icon: '❌', class: 'refuse' }
        };

        const statusColors = {
            'en_attente': 'en_attente',
            'accepter': 'accepter',
            'paiement_en_cours': 'paiement_en_cours',
            'pending': 'pending',
            'processing': 'processing',
            'paiement_effectue': 'paiement_effectue',
            'success': 'success',
            'failed': 'failed',
            'cancelled': 'cancelled',
            'expired': 'expired',
            'refunded': 'refunded',
            'verification_en_cours': 'verification_en_cours',
            'livraison_en_cours': 'livraison_en_cours',
            'disponible': 'disponible',
            'recuperee': 'recuperee',
            'annulee': 'annulee',
            'refuse': 'refuse'
        };

        let html = '';

        commandes.forEach((c) => {
            const statusKey = c.genius_status || c.status || 'en_attente';
            const statusInfo = statusLabels[statusKey] || { label: statusKey, icon: '📋', class: 'en_attente' };
            const history = getStatusHistory(c);

            const paymentDate = c.payment_created_at || c.created_at;
            const isExpired = statusKey === 'expired' || 
                              (c.status === 'paiement_en_cours' && 
                               new Date(paymentDate).getTime() + TIMEOUT_MS < Date.now());

            const isPayable = c.status === 'accepter';
            const isPaymentInProgress = c.status === 'paiement_en_cours' || c.status === 'pending' || c.status === 'processing';
            const isVerificationInProgress = c.status === 'verification_en_cours';
            const showContinue = isPaymentInProgress && !isExpired;
            const isTerminal = ['success', 'failed', 'cancelled', 'expired', 'refunded', 'paiement_effectue', 'annulee', 'refuse', 'livraison_en_cours', 'disponible', 'recuperee'].includes(c.status) || 
                              ['success', 'failed', 'cancelled', 'expired', 'refunded'].includes(c.genius_status);

            const hasPaymentLink = c.checkout_url || c.genius_reference;

            const date = new Date(c.created_at);
            const dateStr = date.toLocaleDateString('fr-FR') + ' ' + date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
            const refDisplay = c.reference || `NAT-${c.id}`;

            // Timer
            let timerHtml = '';
            if ((c.status === 'pending' || c.status === 'processing' || c.status === 'paiement_en_cours') && !isExpired) {
                const paymentDateObj = new Date(paymentDate);
                const expiryTime = paymentDateObj.getTime() + TIMEOUT_MS;
                const now = Date.now();
                const diff = expiryTime - now;

                if (diff > 0) {
                    const minutes = Math.floor(diff / (1000 * 60));
                    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
                    const displayMinutes = String(minutes).padStart(2, '0');
                    const displaySeconds = String(seconds).padStart(2, '0');
                    timerHtml = `<div class="timer" id="timer-${c.id}">⏳ ${displayMinutes}:${displaySeconds}</div>`;
                } else {
                    timerHtml = `<div class="timer expired" id="timer-${c.id}">⏳ Expiré</div>`;
                }
            } else if (isExpired) {
                timerHtml = `<div class="timer expired" id="timer-${c.id}">⏳ Expiré</div>`;
            }

            // ✅ Affichage du statut de paiement (CORRIGÉ)
            let paymentStatusHtml = '';
            if (isPayable) {
                const isGenerating = generatingLinks[c.id] === true;
                if (hasPaymentLink) {
                    paymentStatusHtml = `
                        <div class="status-link-available">
                            <i class="fas fa-envelope"></i> 📩 Lien disponible dans vos notifications
                        </div>
                    `;
                } else if (isGenerating) {
                    paymentStatusHtml = `
                        <div class="status-generating" id="generating-${c.id}">
                            <i class="fas fa-spinner"></i> Lien de paiement en cours de génération...
                        </div>
                    `;
                }
                // ✅ Sinon, rien ne s'affiche (plus de message par défaut)
            }

            // ✅ État vérification en cours
            let verificationHtml = '';
            if (isVerificationInProgress) {
                verificationHtml = `
                    <div class="status-verification">
                        <i class="fas fa-spinner"></i> 🔍 Vérification en cours...
                    </div>
                `;
            }

            // ✅ Historique des statuts
            let statusTransitionHtml = '';
            if (history.old && history.old !== history.current) {
                const oldLabel = statusLabels[history.old]?.label || history.old;
                const newLabel = statusInfo.label;
                statusTransitionHtml = `
                    <span class="old-status">${oldLabel}</span>
                    <span class="arrow">→</span>
                    <span class="new-status ${statusColors[history.current] || 'en_attente'}">${statusInfo.icon} ${newLabel}</span>
                `;
            } else {
                statusTransitionHtml = `
                    <span class="new-status ${statusColors[history.current] || 'en_attente'}">${statusInfo.icon} ${statusInfo.label}</span>
                `;
            }

            // ✅ Message d'action
            let actionHint = '';
            if (isPayable) {
                if (hasPaymentLink) {
                    actionHint = '📩 Lien de paiement disponible dans vos notifications';
                } else {
                    // ✅ Ne rien afficher si le lien n'est pas encore généré
                }
            } else if (isVerificationInProgress) {
                actionHint = '🔍 En attente de la confirmation de l\'admin...';
            } else if (showContinue) {
                actionHint = '⏳ Paiement en cours...';
            } else if (c.status === 'en_attente') {
                actionHint = '⏳ En attente de validation';
            } else if (c.status === 'paiement_effectue') {
                actionHint = '✅ Commande en préparation';
            } else if (c.status === 'livraison_en_cours') {
                actionHint = '🚚 Votre commande est en route';
            } else if (c.status === 'disponible') {
                actionHint = '📍 Votre commande vous attend';
            } else if (c.status === 'recuperee') {
                actionHint = '✅ Merci pour votre commande !';
            } else if (c.status === 'annulee' || c.status === 'refuse') {
                actionHint = `❌ ${c.cause_refus || 'Commande annulée'}`;
            } else if (c.status === 'success') {
                actionHint = '✅ Paiement réussi';
            } else if (c.status === 'failed') {
                actionHint = '❌ Paiement échoué';
            } else if (c.status === 'cancelled') {
                actionHint = '⏰ Paiement annulé';
            } else if (isExpired || statusKey === 'expired') {
                actionHint = '⏳ Paiement expiré - Veuillez passer une nouvelle commande';
            }

            // ✅ Boutons (masqués si paiement en cours ou vérification)
            let buttonsHtml = '';
            if (isPayable && !isVerificationInProgress) {
                const isGenerating = generatingLinks[c.id] === true;
                buttonsHtml = `
                    <button class="btn btn-pay-genius ${hasPaymentLink ? 'link-generated' : ''}" 
                            data-id="${c.id}" 
                            data-total="${c.total}" 
                            data-ref="${c.reference || c.id}"
                            ${isGenerating ? 'disabled' : ''}>
                        <i class="fas fa-credit-card"></i> ${hasPaymentLink ? 'Payer' : 'Générer le lien'}
                    </button>
                    <button class="btn btn-wave" data-id="${c.id}" data-total="${c.total}" data-ref="${c.reference || c.id}">
                        <img src="/client/images/wave-logo.png" alt="Wave" class="wave-icon" /> Wave
                    </button>
                `;
            }

            html += `
                <div class="commande-card status-${statusColors[statusKey] || 'en_attente'} ${isExpired ? 'expired' : ''} ${isVerificationInProgress ? 'verification' : ''}">
                    <span class="badge-top ${statusInfo.class}">${statusInfo.icon} ${statusInfo.label}</span>
                    <div class="id">#${c.id}</div>
                    <span class="ref">${refDisplay}</span>
                    <span class="date">${dateStr}</span>
                    <div class="total">${(c.total || 0).toLocaleString()} FCFA</div>
                    <div class="status-transition">${statusTransitionHtml}</div>
                    ${timerHtml}
                    ${paymentStatusHtml}
                    ${verificationHtml}
                    ${actionHint ? `<div class="action-hint">${actionHint}</div>` : ''}
                    <div class="actions">
                        ${buttonsHtml}
                        ${showContinue && !isExpired && !isTerminal && !isVerificationInProgress ? `
                            <button class="btn btn-continue" data-id="${c.id}" data-ref="${c.reference || c.id}" data-total="${c.total}">
                                <i class="fas fa-arrow-right"></i> Continuer
                            </button>
                        ` : ''}
                        <button class="btn btn-detail" data-id="${c.id}">
                            <i class="fas fa-eye"></i> Détails
                        </button>
                        ${isPayable && !isVerificationInProgress ? `
                            <button class="btn btn-check-status" data-id="${c.id}" title="Vérifier le statut du paiement">
                                <i class="fas fa-sync-alt"></i>
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        });

        mainContent.innerHTML = html;

        // ✅ Démarrer les timers
        commandes.forEach((c) => {
            if ((c.status === 'pending' || c.status === 'processing' || c.status === 'paiement_en_cours') && 
                !(c.genius_status === 'expired' || new Date(c.payment_created_at || c.created_at).getTime() + TIMEOUT_MS < Date.now())) {
                startTimer(c.id, c.payment_created_at || c.created_at);
            }
            
            if (c.status === 'paiement_en_cours' || c.status === 'pending' || c.status === 'processing') {
                startVerification(c.id);
            }
        });

        // ✅ Événements - Payer Genius
        document.querySelectorAll('.btn-pay-genius').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                if (this.disabled) return;
                const id = parseInt(this.dataset.id);
                const total = parseInt(this.dataset.total);
                const ref = this.dataset.ref;
                const phone = currentUser?.phone || localStorage.getItem('userPhone');
                handlePayment(id, total, ref, phone);
            });
        });

        // ✅ Événements - Wave
        document.querySelectorAll('.btn-wave').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const id = parseInt(this.dataset.id);
                window.location.href = `/paywithwave?id=${id}`;
            });
        });

        // ✅ Événements - Continuer
        document.querySelectorAll('.btn-continue').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const id = parseInt(this.dataset.id);
                const total = parseInt(this.dataset.total);
                const ref = this.dataset.ref;
                const phone = currentUser?.phone || localStorage.getItem('userPhone');
                openPaymentOverlay(id, total, phone, ref);
            });
        });

        // ✅ Événements - Détails
        document.querySelectorAll('.btn-detail').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                window.location.href = `/detailcom?id=${this.dataset.id}`;
            });
        });

        // ✅ Événements - Vérifier statut
        document.querySelectorAll('.btn-check-status').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const id = parseInt(this.dataset.id);
                checkAndUpdateStatus(id);
            });
        });
    }

    // ==========================================
    // EXPOSER LES FONCTIONS GLOBALEMENT
    // ==========================================

    window.generatePaymentLink = generatePaymentLink;
    window.verifyWavePayment = verifyWavePayment;
    window.checkAndUpdateStatus = checkAndUpdateStatus;

    // ==========================================
    // INITIALISATION
    // ==========================================

    (async function init() {
        try {
            const isAuth = await checkAuth();
            if (!isAuth) return;

            isSyncActive = true;
            updateSyncUI();

            connectSocketIO();

            await loadCommandes();

        } catch (error) {
            // Silencieux
        }
    })();

});