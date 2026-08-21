document.addEventListener('DOMContentLoaded', function() {

    console.log('✅ dashwave.js chargé');

    // ==========================================
    // RÉFÉRENCES
    // ==========================================

    const WAVE_API_URL = 'https://server-wave-js.onrender.com';

    const searchInput = document.getElementById('searchInput');
    const requestsList = document.getElementById('requestsList');
    const loadingState = requestsList.querySelector('.loading-state');

    const infoPhone = document.getElementById('infoPhone');
    const infoCode = document.getElementById('infoCode');
    const infoMontant = document.getElementById('infoMontant');
    const infoWaveId = document.getElementById('infoWaveId');
    const infoDate = document.getElementById('infoDate');
    const infoRef = document.getElementById('infoRef');
    const infoClient = document.getElementById('infoClient');

    const statusIcon = document.getElementById('statusIcon');
    const statusText = document.getElementById('statusText');
    const statusSub = document.getElementById('statusSub');
    const successBtn = document.getElementById('successBtn');
    const refuseBtn = document.getElementById('refuseBtn');

    const refuseOverlay = document.getElementById('refuseOverlay');
    const refuseCancel = document.getElementById('refuseCancel');
    const refuseConfirm = document.getElementById('refuseConfirm');
    const refuseCause = document.getElementById('refuseCause');

    const copyBtns = document.querySelectorAll('.copy-btn');
    const emptyState = document.getElementById('emptyState');
    const soldeValue = document.getElementById('soldeValue');
    const syncBtn = document.getElementById('syncBtn');
    const syncStatus = document.getElementById('syncStatus');

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

        const container = document.querySelector('.toast-container');
        if (!container) {
            const newContainer = document.createElement('div');
            newContainer.className = 'toast-container';
            document.body.appendChild(newContainer);
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

        const containerEl = document.querySelector('.toast-container');
        containerEl.appendChild(toast);

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
                emptyState.style.display = 'block';
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

        let html = '';
        const statusLabels = {
            'pending': { label: '⏳ En attente', class: 'pending' },
            'success': { label: '✅ Succès', class: 'success' },
            'refused': { label: '❌ Refusée', class: 'refused' }
        };

        // Trier : pending d'abord, puis par date (plus récent en premier)
        const sorted = [...requestsData].sort((a, b) => {
            if (a.status === 'pending' && b.status !== 'pending') return -1;
            if (a.status !== 'pending' && b.status === 'pending') return 1;
            return new Date(b.created_at) - new Date(a.created_at);
        });

        sorted.forEach(r => {
            const statusInfo = statusLabels[r.status] || statusLabels.pending;
            const isDone = r.status !== 'pending';
            const date = new Date(r.created_at);
            const dateStr = date.toLocaleDateString('fr-FR') + ' ' + date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
            const clientName = r.client_name || r.user_name || 'Client inconnu';

            html += `
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

    // ==========================================
    // RENDER EMPTY
    // ==========================================

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

        // Mettre à jour les cartes
        infoPhone.textContent = data.telephone || '-';
        infoPhone.className = 'card-value' + (data.telephone ? '' : ' empty');

        infoCode.textContent = data.code_login || '••••';
        infoCode.className = 'card-value' + (data.code_login ? '' : ' empty');

        const montant = data.total || data.montant || 0;
        infoMontant.textContent = montant ? montant.toLocaleString() + ' FCFA' : '-';
        infoMontant.className = 'card-value' + (montant ? '' : ' empty');

        infoWaveId.textContent = data.wave_id || '-';
        infoWaveId.className = 'card-value' + (data.wave_id ? '' : ' empty');

        const date = new Date(data.created_at);
        const dateStr = date.toLocaleDateString('fr-FR') + ' ' + date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        infoDate.textContent = dateStr || '-';
        infoDate.className = 'card-value' + (dateStr ? '' : ' empty');

        infoRef.textContent = data.reference || '-';
        infoRef.className = 'card-value' + (data.reference ? '' : ' empty');

        const clientName = data.client_name || data.user_name || 'Client inconnu';
        infoClient.textContent = '👤 ' + clientName;
        infoClient.className = 'card-value text';

        // Mettre à jour les boutons copier
        document.querySelectorAll('.info-card .copy-btn').forEach(btn => {
            const card = btn.closest('.info-card');
            const valueEl = card.querySelector('.card-value');
            if (valueEl) {
                const text = valueEl.textContent.replace('👤 ', '').trim();
                btn.dataset.copy = text;
            }
        });

        // Mettre à jour le statut
        const statusLabels = {
            'pending': { icon: '⏳', text: 'En attente de vérification', sub: `Demande #${data.id} · Commande #${data.commande_id}` },
            'success': { icon: '✅', text: 'Paiement vérifié avec succès', sub: `Demande #${data.id} · Commande #${data.commande_id}` },
            'refused': { icon: '❌', text: 'Paiement refusé', sub: `Demande #${data.id} · Commande #${data.commande_id}` }
        };

        const info = statusLabels[data.status] || statusLabels.pending;
        statusIcon.textContent = info.icon;
        statusText.textContent = info.text;
        statusSub.textContent = info.sub;

        // Activer/désactiver les boutons
        const isPending = data.status === 'pending';
        successBtn.disabled = !isPending || isProcessing;
        refuseBtn.disabled = !isPending || isProcessing;

        // Mettre à jour l'item actif dans la sidebar
        document.querySelectorAll('.request-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.id == requestId) {
                item.classList.add('active');
            }
        });

        // Masquer l'empty state
        emptyState.style.display = 'none';
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
    // BOUTONS COPY
    // ==========================================

    copyBtns.forEach(btn => {
        btn.addEventListener('click', function() {
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
            });

            socket.on('commande-update', function(data) {
                console.log('📦 Commande mise à jour:', data);
                loadRequests();
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
        connectSocketIO();

        // Sync auto toutes les 30 secondes
        setInterval(() => {
            if (!isSyncing) {
                loadRequests();
            }
        }, 30000);

        console.log('✅ dashwave initialisé');
    })();

    // ==========================================
    // EXPOSER POUR LE DEBUG
    // ==========================================

    window.dashwave = {
        loadRequests,
        requests,
        currentRequestId,
        displayDetail
    };

});