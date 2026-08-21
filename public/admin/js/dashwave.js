document.addEventListener('DOMContentLoaded', function() {

    console.log('✅ dashwave.js chargé');

    // ==========================================
    // RÉFÉRENCES
    // ==========================================

    const WAVE_API_URL = 'https://server-wave-js.onrender.com';

    const searchInput = document.getElementById('searchInput');
    const requestsList = document.getElementById('requestsList');
    const loadingState = requestsList.querySelector('.loading-state');

    const soldeValue = document.getElementById('soldeValue');
    const syncBtn = document.getElementById('syncBtn');
    const syncStatus = document.getElementById('syncStatus');

    // Stats
    const statProducts = document.getElementById('statProducts');
    const statSales = document.getElementById('statSales');
    const statCommandes = document.getElementById('statCommandes');
    const statClients = document.getElementById('statClients');
    const statPayments = document.getElementById('statPayments');
    const statWave = document.getElementById('statWave');
    const recentOrdersList = document.getElementById('recentOrdersList');
    const recentCount = document.getElementById('recentCount');

    // Détail
    const detailRequest = document.getElementById('detailRequest');
    const statsDefault = document.getElementById('statsDefault');

    const pName = document.getElementById('pName');
    const pPhone = document.getElementById('pPhone');
    const pEmail = document.getElementById('pEmail');
    const pCode = document.getElementById('pCode');

    const vWaveId = document.getElementById('vWaveId');
    const vMontant = document.getElementById('vMontant');
    const vDate = document.getElementById('vDate');
    const vRef = document.getElementById('vRef');

    const sIcon = document.getElementById('sIcon');
    const sText = document.getElementById('sText');
    const sSub = document.getElementById('sSub');
    const statusRect = document.getElementById('statusRect');
    const successBtn = document.getElementById('successBtn');
    const refuseBtn = document.getElementById('refuseBtn');

    const refuseOverlay = document.getElementById('refuseOverlay');
    const refuseCancel = document.getElementById('refuseCancel');
    const refuseConfirm = document.getElementById('refuseConfirm');
    const refuseCause = document.getElementById('refuseCause');

    // Mini copy buttons
    const copyBtnsMini = document.querySelectorAll('.copy-btn-mini');

    // ==========================================
    // ÉTAT
    // ==========================================

    let requests = [];
    let currentRequestId = null;
    let isSyncing = false;
    let isRefusing = false;
    let isProcessing = false;

    // ==========================================
    // TOAST
    // ==========================================

    function showToast(message, type = 'success') {
        const colors = {
            success: '#0E7A49',
            error: '#C0342A',
            info: '#10141F',
            warning: '#B45309'
        };

        let container = document.querySelector('.toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = 'toast ' + type;
        toast.textContent = message;
        toast.style.cssText = `
            background: ${colors[type] || '#10141F'};
            color: white;
            padding: 13px 22px;
            border-radius: 11px;
            font-weight: 600;
            font-size: 13.5px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            animation: slideInRight 0.25s ease;
            max-width: 400px;
            pointer-events: auto;
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(16px)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }

    // ==========================================
    // CHARGER LES DEMANDES
    // ==========================================

    async function loadRequests() {
        if (loadingState) loadingState.style.display = 'block';

        try {
            const res = await fetch(`${WAVE_API_URL}/api/wave/requests`);
            const data = await res.json();

            if (loadingState) loadingState.style.display = 'none';

            if (data.success && data.requests.length > 0) {
                requests = data.requests;
                renderRequests(requests);
                updateSolde();

                // Sélectionner la première demande en attente ou la première
                const firstPending = requests.find(r => r.status === 'pending');
                if (firstPending) {
                    displayDetail(firstPending.id);
                } else if (requests.length > 0) {
                    displayDetail(requests[0].id);
                }
            } else {
                requests = [];
                renderEmpty();
                showToast('Aucune demande Wave en attente', 'info');
            }

        } catch (error) {
            console.error('Erreur chargement:', error);
            if (loadingState) loadingState.style.display = 'none';
            requestsList.innerHTML = `
                <div class="empty-list">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>Erreur de chargement</p>
                    <p style="font-size:12px;color:var(--ink-400);">${error.message}</p>
                </div>
            `;
            showToast('❌ Erreur de chargement', 'error');
        }
    }

    // ==========================================
    // AFFICHER LES DEMANDES DANS LA SIDEBAR
    // ==========================================

    function renderRequests(requestsData) {
        if (!requestsData || requestsData.length === 0) {
            renderEmpty();
            return;
        }

        // Séparer pending et done
        const pending = requestsData.filter(r => r.status === 'pending');
        const done = requestsData.filter(r => r.status !== 'pending');

        // Trier : pending par date (plus récent en premier), done par date (plus récent en premier)
        pending.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        done.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        let html = '';

        // Pending
        pending.forEach(r => {
            html += renderItem(r, false);
        });

        // Séparateur si done existe
        if (done.length > 0) {
            html += `
                <div class="separator">
                    <span>─── Historique ───</span>
                </div>
            `;
        }

        // Done (grisé)
        done.forEach(r => {
            html += renderItem(r, true);
        });

        requestsList.innerHTML = html;

        // Attacher les événements
        document.querySelectorAll('.request-item').forEach(item => {
            item.addEventListener('click', function() {
                const id = parseInt(this.dataset.id);
                if (id) displayDetail(id);
            });
        });
    }

    function renderItem(r, isDone) {
        const statusLabels = {
            'pending': { label: '⏳ En attente', class: 'pending' },
            'success': { label: '✅ Succès', class: 'success' },
            'refused': { label: '❌ Refusée', class: 'refused' }
        };
        const statusInfo = statusLabels[r.status] || statusLabels.pending;
        const date = new Date(r.created_at);
        const dateStr = date.toLocaleDateString('fr-FR') + ' ' + date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        const clientName = r.client_name || r.user_name || 'Client inconnu';

        return `
            <div class="request-item ${isDone ? 'done' : ''} ${currentRequestId === r.id ? 'active' : ''}" data-id="${r.id}">
                <span class="status-dot ${r.status}"></span>
                <div class="item-info">
                    <div class="name">${clientName}</div>
                    <span class="ref">#${r.commande_id} · ${r.reference || '-'}</span>
                    <div class="phone">📱 ${r.telephone || '-'}</div>
                </div>
                <div class="item-right">
                    <span class="status-badge ${r.status}">${statusInfo.label}</span>
                    <span class="time">${dateStr}</span>
                </div>
            </div>
        `;
    }

    function renderEmpty() {
        requestsList.innerHTML = `
            <div class="empty-list">
                <i class="fas fa-inbox"></i>
                <p>Aucune demande Wave</p>
                <p style="font-size:12px;color:var(--ink-400);">Les demandes de vérification apparaîtront ici.</p>
            </div>
        `;
    }

    // ==========================================
    // AFFICHER LE DÉTAIL D'UNE DEMANDE
    // ==========================================

    function displayDetail(requestId) {
        const data = requests.find(r => r.id === requestId);
        if (!data) {
            showToast('❌ Demande non trouvée', 'error');
            return;
        }

        currentRequestId = requestId;

        // Afficher le détail, masquer les stats
        statsDefault.style.display = 'none';
        detailRequest.style.display = 'block';
        detailRequest.classList.add('active');

        // Mettre à jour le fond du main
        const mainWave = document.getElementById('mainWave');
        mainWave.className = 'main-wave status-' + data.status;

        // 1. Profil
        const clientName = data.client_name || data.user_name || 'Client inconnu';
        pName.textContent = clientName;
        pName.closest('.profile-item').querySelector('.copy-btn-mini').dataset.copy = clientName;

        pPhone.textContent = data.telephone || '-';
        pPhone.closest('.profile-item').querySelector('.copy-btn-mini').dataset.copy = data.telephone || '';

        pEmail.textContent = data.email || '-';
        pEmail.closest('.profile-item').querySelector('.copy-btn-mini').dataset.copy = data.email || '';

        pCode.textContent = data.code_login || '••••';
        pCode.closest('.profile-item').querySelector('.copy-btn-mini').dataset.copy = data.code_login || '';

        // 2. Vérification Info
        vWaveId.textContent = data.wave_id || '-';
        vWaveId.closest('.verif-item').querySelector('.copy-btn-mini').dataset.copy = data.wave_id || '';

        const montant = data.total || data.montant || 0;
        vMontant.textContent = montant ? montant.toLocaleString() + ' FCFA' : '-';
        vMontant.closest('.verif-item').querySelector('.copy-btn-mini').dataset.copy = montant ? montant.toString() : '';

        const date = new Date(data.created_at);
        const dateStr = date.toLocaleDateString('fr-FR') + ' ' + date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        vDate.textContent = dateStr || '-';
        vDate.closest('.verif-item').querySelector('.copy-btn-mini').dataset.copy = dateStr || '';

        vRef.textContent = data.reference || '-';
        vRef.closest('.verif-item').querySelector('.copy-btn-mini').dataset.copy = data.reference || '';

        // 3. Statut
        const statusLabels = {
            'pending': { icon: '⏳', text: 'En attente de vérification', sub: `Demande #${data.id} · Commande #${data.commande_id}` },
            'success': { icon: '✅', text: 'Paiement vérifié avec succès', sub: `Demande #${data.id} · Commande #${data.commande_id}` },
            'refused': { icon: '❌', text: 'Paiement refusé', sub: `Demande #${data.id} · Commande #${data.commande_id}` }
        };

        const info = statusLabels[data.status] || statusLabels.pending;
        sIcon.textContent = info.icon;
        sText.textContent = info.text;
        sSub.textContent = info.sub;

        // Afficher/masquer le rectangle statut
        if (data.status === 'pending') {
            statusRect.classList.remove('hidden');
            successBtn.disabled = false;
            refuseBtn.disabled = false;
        } else {
            statusRect.classList.add('hidden');
            successBtn.disabled = true;
            refuseBtn.disabled = true;
        }

        // Mettre à jour l'item actif dans la sidebar
        document.querySelectorAll('.request-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.id == requestId) {
                item.classList.add('active');
            }
        });
    }

    // ==========================================
    // CHARGER LES STATS
    // ==========================================

    async function loadStats() {
        try {
            const res = await fetch('/api/admin/stats');
            const data = await res.json();

            if (res.ok) {
                statProducts.textContent = data.products || 0;
                statSales.textContent = (data.sales || 0).toLocaleString() + ' FCFA';
                statCommandes.textContent = data.commandes || 0;
                statClients.textContent = data.clients || 0;
                statPayments.textContent = data.payments || 0;
                statWave.textContent = requests.filter(r => r.status === 'pending').length || 0;
            }

            // Charger les commandes récentes
            const res2 = await fetch('/api/admin/commandes');
            const data2 = await res2.json();

            if (res2.ok && data2.length > 0) {
                const recent = data2.slice(0, 5);
                recentCount.textContent = recent.length;

                const labels = {
                    'en_attente': '⏳ En attente',
                    'accepter': '💳 Paiement requis',
                    'paiement_effectue': '✅ Payée',
                    'livraison_en_cours': '🚚 En cours',
                    'disponible': '📍 Disponible',
                    'recuperee': '✅ Récupérée',
                    'refuse': '❌ Refusée',
                    'annulee': '❌ Annulée'
                };

                const dateOptions = { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' };

                recentOrdersList.innerHTML = recent.map(c => `
                    <tr>
                        <td>#${c.id}</td>
                        <td>${c.nom}</td>
                        <td>${(c.total || 0).toLocaleString()} FCFA</td>
                        <td><span class="status-badge ${c.status}">${labels[c.status] || c.status}</span></td>
                        <td>${new Date(c.created_at).toLocaleDateString('fr-FR', dateOptions)}</td>
                    </tr>
                `).join('');
            } else {
                recentOrdersList.innerHTML = `<tr><td colspan="5" class="empty-msg">Aucune commande récente</td></tr>`;
                recentCount.textContent = '0';
            }
        } catch (error) {
            console.error('Erreur stats:', error);
        }
    }

    // ==========================================
    // METTRE À JOUR LE SOLDE
    // ==========================================

    function updateSolde() {
        let total = 0;
        requests.forEach(r => {
            if (r.status === 'success') {
                total += (r.total || r.montant || 0);
            }
        });
        soldeValue.textContent = total.toLocaleString() + ' FCFA';
    }

    // ==========================================
    // RECHERCHE
    // ==========================================

    searchInput.addEventListener('input', function() {
        const query = this.value.toLowerCase().trim();
        const items = document.querySelectorAll('.request-item');
        items.forEach(item => {
            const name = item.querySelector('.name')?.textContent?.toLowerCase() || '';
            const ref = item.querySelector('.ref')?.textContent?.toLowerCase() || '';
            const phone = item.querySelector('.phone')?.textContent?.toLowerCase() || '';
            const match = name.includes(query) || ref.includes(query) || phone.includes(query);
            item.style.display = match || query === '' ? '' : 'none';
        });
    });

    // ==========================================
    // BOUTONS COPY MINI
    // ==========================================

    copyBtnsMini.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const text = this.dataset.copy || '';
            if (text && text !== '-') {
                navigator.clipboard.writeText(text).then(() => {
                    this.classList.add('copied');
                    this.innerHTML = '<i class="fas fa-check"></i>';
                    setTimeout(() => {
                        this.classList.remove('copied');
                        this.innerHTML = '<i class="fas fa-copy"></i>';
                    }, 1500);
                }).catch(() => {
                    // Fallback
                    const input = document.createElement('input');
                    input.value = text;
                    document.body.appendChild(input);
                    input.select();
                    document.execCommand('copy');
                    document.body.removeChild(input);
                    this.classList.add('copied');
                    this.innerHTML = '<i class="fas fa-check"></i>';
                    setTimeout(() => {
                        this.classList.remove('copied');
                        this.innerHTML = '<i class="fas fa-copy"></i>';
                    }, 1500);
                });
            }
        });
    });

    // ==========================================
    // BOUTON SUCCESS
    // ==========================================

    successBtn.addEventListener('click', async function() {
        if (this.disabled || isProcessing) return;

        const data = requests.find(r => r.id === currentRequestId);
        if (!data) {
            showToast('❌ Demande non trouvée', 'error');
            return;
        }

        if (!confirm(`Confirmer le paiement Wave pour la commande #${data.commande_id} ?`)) return;

        isProcessing = true;
        this.disabled = true;
        refuseBtn.disabled = true;
        this.classList.add('loading');
        this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Traitement...';

        try {
            const res = await fetch(`${WAVE_API_URL}/api/wave/validate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    verification_id: data.id,
                    status: 'success',
                    admin_id: 1
                })
            });

            const result = await res.json();

            if (result.success) {
                // Mettre à jour localement
                data.status = 'success';
                renderRequests(requests);
                displayDetail(data.id);
                updateSolde();
                loadStats();
                showToast(`✅ Paiement confirmé pour la commande #${data.commande_id}`, 'success');
            } else {
                showToast('❌ ' + (result.error || 'Erreur'), 'error');
            }
        } catch (error) {
            console.error('Erreur:', error);
            showToast('❌ Erreur de connexion', 'error');
        } finally {
            isProcessing = false;
            this.classList.remove('loading');
            this.innerHTML = '<i class="fas fa-check"></i> Success';
            this.disabled = false;
            refuseBtn.disabled = false;
        }
    });

    // ==========================================
    // BOUTON REFUSER
    // ==========================================

    refuseBtn.addEventListener('click', function() {
        if (this.disabled || isProcessing) return;
        refuseOverlay.classList.add('active');
        refuseCause.value = '';
        refuseCause.focus();
    });

    refuseCancel.addEventListener('click', function() {
        refuseOverlay.classList.remove('active');
        refuseCause.value = '';
    });

    refuseConfirm.addEventListener('click', async function() {
        if (isRefusing) return;

        const cause = refuseCause.value.trim();
        if (!cause) {
            showToast('⚠️ Veuillez indiquer une raison pour le refus.', 'warning');
            return;
        }

        const data = requests.find(r => r.id === currentRequestId);
        if (!data) {
            showToast('❌ Demande non trouvée', 'error');
            return;
        }

        isRefusing = true;
        this.disabled = true;
        this.textContent = '⏳ Traitement...';

        try {
            const res = await fetch(`${WAVE_API_URL}/api/wave/validate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    verification_id: data.id,
                    status: 'refused',
                    cause: cause,
                    admin_id: 1
                })
            });

            const result = await res.json();

            if (result.success) {
                data.status = 'refused';
                data.cause = cause;
                renderRequests(requests);
                displayDetail(data.id);
                updateSolde();
                loadStats();
                refuseOverlay.classList.remove('active');
                refuseCause.value = '';
                showToast(`❌ Paiement refusé pour la commande #${data.commande_id}`, 'error');
            } else {
                showToast('❌ ' + (result.error || 'Erreur'), 'error');
            }
        } catch (error) {
            console.error('Erreur:', error);
            showToast('❌ Erreur de connexion', 'error');
        } finally {
            isRefusing = false;
            this.disabled = false;
            this.textContent = 'Confirmer le refus';
        }
    });

    // Fermer overlay en cliquant à l'extérieur
    refuseOverlay.addEventListener('click', function(e) {
        if (e.target === this) {
            this.classList.remove('active');
            refuseCause.value = '';
        }
    });

    // ==========================================
    // SYNC
    // ==========================================

    syncBtn.addEventListener('click', async function() {
        if (isSyncing) return;

        isSyncing = true;
        this.disabled = true;
        syncStatus.className = 'sync-status syncing';
        this.querySelector('i').className = 'fas fa-spinner fa-spin';

        try {
            await loadRequests();
            await loadStats();
            showToast('🔄 Synchronisation terminée', 'success');
        } catch (error) {
            showToast('❌ Erreur de synchronisation', 'error');
        } finally {
            isSyncing = false;
            this.disabled = false;
            syncStatus.className = 'sync-status active';
            this.querySelector('i').className = 'fas fa-sync-alt';
        }
    });

    // ==========================================
    // SOCKET.IO - ÉCOUTER LES NOUVELLES DEMANDES
    // ==========================================

    let socket = null;
    let isSocketConnected = false;

    function connectSocketIO() {
        if (socket) {
            socket.disconnect();
            socket = null;
        }

        try {
            const adminId = localStorage.getItem('adminId') || '1';

            socket = io({
                auth: {
                    userId: parseInt(adminId),
                    isAdmin: true
                },
                transports: ['websocket', 'polling'],
                timeout: 5000,
                reconnection: true,
                reconnectionAttempts: 20,
                reconnectionDelay: 500
            });

            socket.on('connect', function() {
                console.log('✅ Socket.IO admin (dashwave) connecté');
                isSocketConnected = true;
            });

            socket.on('disconnect', function() {
                console.log('❌ Socket.IO admin (dashwave) déconnecté');
                isSocketConnected = false;
                setTimeout(() => {
                    if (!isSocketConnected) connectSocketIO();
                }, 3000);
            });

            socket.on('wave-verification-request', function(data) {
                console.log('🔔 Nouvelle demande Wave:', data);
                showToast(`🔔 Nouvelle demande de ${data.client}`, 'info');
                loadRequests();
                loadStats();
            });

            socket.on('commande-update', function(data) {
                console.log('📦 Commande mise à jour:', data);
                loadRequests();
                loadStats();
            });

        } catch (error) {
            console.error('❌ Erreur connexion Socket.IO:', error);
            setTimeout(() => connectSocketIO(), 5000);
        }
    }

    // ==========================================
    // INITIALISATION
    // ==========================================

    (async function init() {
        console.log('🚀 Initialisation de dashwave...');

        // Vérifier que l'admin est connecté
        const adminToken = localStorage.getItem('adminToken');
        if (!adminToken) {
            window.location.href = '/admin/login';
            return;
        }

        await loadRequests();
        await loadStats();
        connectSocketIO();

        // Sync auto toutes les 30 secondes
        setInterval(() => {
            if (!isSyncing) {
                loadRequests();
                loadStats();
            }
        }, 30000);

        console.log('✅ dashwave initialisé');
    })();

    // ==========================================
    // EXPOSER POUR LE DEBUG
    // ==========================================

    window.dashwave = {
        loadRequests,
        loadStats,
        requests,
        currentRequestId,
        displayDetail
    };

});