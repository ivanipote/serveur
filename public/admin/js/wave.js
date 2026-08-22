document.addEventListener('DOMContentLoaded', function() {

    console.log('✅ wave.js chargé');

    // ==========================================
    // RÉFÉRENCES
    // ==========================================

    const WAVE_API_URL = 'https://server-wave-js.onrender.com';

    const requestsList = document.getElementById('requestsList');
    const searchInput = document.getElementById('searchInput');
    const historyBtn = document.getElementById('historyBtn');

    const emptyState = document.getElementById('emptyState');
    const detailRequest = document.getElementById('detailRequest');

    const sIcon = document.getElementById('sIcon');
    const sText = document.getElementById('sText');
    const sSub = document.getElementById('sSub');
    const successBtn = document.getElementById('successBtn');
    const refuseBtn = document.getElementById('refuseBtn');
    const remboursementBtn = document.getElementById('remboursementBtn');

    const pName = document.getElementById('pName');
    const pPhone = document.getElementById('pPhone');
    const pEmail = document.getElementById('pEmail');
    const pCode = document.getElementById('pCode');

    const vWaveId = document.getElementById('vWaveId');
    const vMontant = document.getElementById('vMontant');
    const vDate = document.getElementById('vDate');
    const vRef = document.getElementById('vRef');

    const historiqueRect = document.getElementById('historiqueRect');
    const historiqueList = document.getElementById('historiqueList');

    const soldeAmount = document.getElementById('soldeAmount');

    const refuseOverlay = document.getElementById('refuseOverlay');
    const refuseCancel = document.getElementById('refuseCancel');
    const refuseConfirm = document.getElementById('refuseConfirm');
    const refuseCause = document.getElementById('refuseCause');

    const remboursementOverlay = document.getElementById('remboursementOverlay');
    const remboursementCancel = document.getElementById('remboursementCancel');
    const remboursementConfirm = document.getElementById('remboursementConfirm');
    const remboursementCause = document.getElementById('remboursementCause');

    const copyBtns = document.querySelectorAll('.copy-btn-mini');

    let requests = [];
    let currentRequestId = null;
    let isProcessing = false;
    let showHistory = true; // ✅ MODIFICATION : Historique visible par défaut
    let syncInterval = null;

    // ==========================================
    // NOM ADMIN
    // ==========================================

    const adminName = localStorage.getItem('adminName') || 'Admin';
    document.getElementById('adminName').textContent = adminName;

    // ==========================================
    // CHARGER LE SOLDE
    // ==========================================

    async function loadSolde() {
        try {
            const res = await fetch(`${WAVE_API_URL}/api/wave/solde`);
            const data = await res.json();
            if (data.success) {
                soldeAmount.textContent = data.solde.toLocaleString();
            }
        } catch (error) {
            console.error('Erreur chargement solde:', error);
        }
    }

    // ==========================================
    // TOGGLE HISTORIQUE
    // ==========================================

    historyBtn.addEventListener('click', function() {
        showHistory = !showHistory;
        this.classList.toggle('active', showHistory);
        this.innerHTML = showHistory ?
            '<i class="fas fa-clock"></i> Historique' :
            '<i class="fas fa-arrow-left"></i> Retour';
        renderRequests(requests);
    });

    // ==========================================
    // CHARGER LES DEMANDES
    // ==========================================

    async function loadRequests() {
        try {
            const res = await fetch(`${WAVE_API_URL}/api/wave/requests`);
            const data = await res.json();

            if (data.success && data.requests.length > 0) {
                requests = data.requests;
                renderRequests(requests);

                if (!currentRequestId) {
                    const firstPending = requests.find(r => r.status === 'pending');
                    if (firstPending) {
                        displayDetail(firstPending.id);
                    } else if (requests.length > 0) {
                        displayDetail(requests[0].id);
                    }
                } else {
                    const exists = requests.find(r => r.id === currentRequestId);
                    if (exists) {
                        displayDetail(currentRequestId);
                    } else {
                        const firstPending = requests.find(r => r.status === 'pending');
                        if (firstPending) {
                            displayDetail(firstPending.id);
                        } else if (requests.length > 0) {
                            displayDetail(requests[0].id);
                        }
                    }
                }
            } else {
                requests = [];
                renderEmpty();
            }
        } catch (error) {
            console.error('Erreur chargement:', error);
            requestsList.innerHTML = `
                <div class="empty-list">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>Erreur de chargement</p>
                </div>
            `;
        }
    }

    // ==========================================
    // AFFICHER LA LISTE
    // ==========================================

    function renderRequests(requestsData) {
        if (!requestsData || requestsData.length === 0) {
            renderEmpty();
            return;
        }

        let html = '';

        if (showHistory) {
            // ✅ MODE HISTORIQUE : toutes les demandes
            const all = [...requestsData].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            all.forEach(r => {
                html += renderItem(r, true);
            });
        } else {
            // ✅ MODE NORMAL : pending en haut, historique en bas
            const pending = requestsData.filter(r => r.status === 'pending');
            const done = requestsData.filter(r => r.status !== 'pending');

            pending.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            done.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

            pending.forEach(r => {
                html += renderItem(r, false);
            });

            if (done.length > 0) {
                html += `
                    <div class="separator">
                        <span>─── Historique ───</span>
                    </div>
                `;
            }

            done.forEach(r => {
                html += renderItem(r, true);
            });
        }

        requestsList.innerHTML = html;

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
    // AFFICHER LE DÉTAIL
    // ==========================================

    function displayDetail(requestId) {
        const data = requests.find(r => r.id === requestId);
        if (!data) {
            return;
        }

        currentRequestId = requestId;

        emptyState.style.display = 'none';
        detailRequest.style.display = 'block';

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

        const isPending = data.status === 'pending';
        const isSuccess = data.status === 'success';

        successBtn.disabled = !isPending || isProcessing;
        refuseBtn.disabled = !isPending || isProcessing;

        if (isSuccess) {
            remboursementBtn.style.display = 'inline-flex';
        } else {
            remboursementBtn.style.display = 'none';
        }

        // 4. Historique
        renderHistorique(data);

        document.querySelectorAll('.request-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.id == requestId) {
                item.classList.add('active');
            }
        });
    }

    // ==========================================
    // AFFICHER L'HISTORIQUE (MODIFIÉ)
    // ==========================================

    function renderHistorique(data) {
        const statusLabels = {
            'pending': { label: '⏳ En attente', class: 'pending' },
            'success': { label: '✅ Succès', class: 'success' },
            'refused': { label: '❌ Refusée', class: 'refused' }
        };

        const dateValidation = data.extra1 ? new Date(data.extra1) : null;
        const typeAction = data.extra3 || data.status;
        const montantValide = data.extra4 ? parseInt(data.extra4) : 0;
        const isRemboursement = typeAction === 'remboursement';

        // ✅ Vérifier s'il y a un historique
        const hasHistory = dateValidation || (data.status !== 'pending' && data.status !== 'en_attente');

        if (!hasHistory) {
            historiqueRect.style.display = 'none';
            return;
        }

        historiqueRect.style.display = 'block';
        const statusInfo = statusLabels[data.status] || statusLabels.pending;

        let html = '';

        const dateStr = dateValidation ? dateValidation.toLocaleDateString('fr-FR') + ' ' + dateValidation.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '-';

        // ✅ Affichage du remboursement
        let actionLabel = '';
        if (isRemboursement) {
            const clientName = data.client_name || data.user_name || 'Client inconnu';
            actionLabel = `🔄 Remboursement pour ${clientName}`;
        } else if (data.status === 'success') {
            actionLabel = '✅ Paiement confirmé';
        } else if (data.status === 'refused') {
            actionLabel = '❌ Paiement refusé';
        } else {
            actionLabel = statusInfo.label;
        }

        html += `
            <div class="historique-item">
                <div class="h-info">
                    <span class="h-status ${data.status}">${actionLabel}</span>
                    <span class="h-badge ${data.status}">${data.status === 'success' ? '✅ Confirmé' : data.status === 'refused' ? '❌ Refusé' : isRemboursement ? '🔄 Remboursé' : '⏳ En attente'}</span>
                    ${montantValide > 0 ? `<span class="h-montant">${montantValide.toLocaleString()} FCFA</span>` : ''}
                    ${data.cause ? `<span style="font-size:12px;color:var(--ink-500);">· ${data.cause}</span>` : ''}
                    ${isRemboursement ? `<span style="font-size:12px;color:var(--red);">· Motif: ${data.extra4 || 'Non précisé'}</span>` : ''}
                </div>
                <span class="h-date">${dateStr}</span>
            </div>
        `;

        historiqueList.innerHTML = html;
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
    // COPY
    // ==========================================

    copyBtns.forEach(btn => {
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
    // SUCCESS
    // ==========================================

    successBtn.addEventListener('click', async function() {
        if (this.disabled || isProcessing) return;

        const data = requests.find(r => r.id === currentRequestId);
        if (!data) return;

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
                data.status = 'success';
                renderRequests(requests);
                displayDetail(data.id);
                loadSolde();
                if (window.updateBadges) window.updateBadges();
                // Afficher un toast ou message
                alert('✅ Paiement confirmé avec succès !');
            } else {
                alert('❌ ' + (result.error || 'Erreur'));
            }
        } catch (error) {
            console.error('Erreur:', error);
            alert('❌ Erreur de connexion');
        } finally {
            isProcessing = false;
            this.classList.remove('loading');
            this.innerHTML = '<i class="fas fa-check"></i> Success';
            this.disabled = false;
            refuseBtn.disabled = false;
        }
    });

    // ==========================================
    // REFUSER
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
        const cause = refuseCause.value.trim();
        if (!cause) {
            alert('⚠️ Veuillez indiquer une raison pour le refus.');
            return;
        }

        const data = requests.find(r => r.id === currentRequestId);
        if (!data) return;

        isProcessing = true;
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
                refuseOverlay.classList.remove('active');
                refuseCause.value = '';
                if (window.updateBadges) window.updateBadges();
                alert('✅ Demande refusée avec succès');
            } else {
                alert('❌ ' + (result.error || 'Erreur'));
            }
        } catch (error) {
            console.error('Erreur:', error);
            alert('❌ Erreur de connexion');
        } finally {
            isProcessing = false;
            this.disabled = false;
            this.textContent = 'Confirmer le refus';
        }
    });

    refuseOverlay.addEventListener('click', function(e) {
        if (e.target === this) {
            this.classList.remove('active');
            refuseCause.value = '';
        }
    });

    // ==========================================
    // REMBOURSEMENT (MODIFIÉ)
    // ==========================================

    remboursementBtn.addEventListener('click', function() {
        remboursementOverlay.classList.add('active');
        remboursementCause.value = '';
        remboursementCause.focus();
    });

    remboursementCancel.addEventListener('click', function() {
        remboursementOverlay.classList.remove('active');
        remboursementCause.value = '';
    });

    remboursementConfirm.addEventListener('click', async function() {
        const cause = remboursementCause.value.trim();
        if (!cause) {
            alert('⚠️ Veuillez indiquer le motif du remboursement.');
            return;
        }

        const data = requests.find(r => r.id === currentRequestId);
        if (!data) return;

        if (!confirm(`Confirmer le remboursement pour la commande #${data.commande_id} ?`)) return;

        this.disabled = true;
        this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Traitement...';

        try {
            // ✅ Appel à la nouvelle route /api/wave/remboursement
            const res = await fetch(`${WAVE_API_URL}/api/wave/remboursement`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    verification_id: data.id,
                    cause: cause,
                    admin_id: 1
                })
            });

            const result = await res.json();

            if (result.success) {
                // ✅ Mettre à jour localement
                data.status = 'success'; // On garde success mais avec extra3 = 'remboursement'
                data.extra1 = new Date().toISOString();
                data.extra2 = `Remboursement pour ${data.client_name || data.user_name || 'Client'}`;
                data.extra3 = 'remboursement';
                data.extra4 = cause;

                renderRequests(requests);
                displayDetail(data.id);
                loadSolde();
                remboursementOverlay.classList.remove('active');
                remboursementCause.value = '';
                if (window.updateBadges) window.updateBadges();
                alert(`✅ Remboursement effectué avec succès !\nMontant: ${(data.total || 0).toLocaleString()} FCFA`);
            } else {
                alert('❌ ' + (result.error || 'Erreur lors du remboursement'));
            }
        } catch (error) {
            console.error('Erreur remboursement:', error);
            alert('❌ Erreur de connexion');
        } finally {
            this.disabled = false;
            this.innerHTML = '<i class="fas fa-undo-alt"></i> Remboursement';
        }
    });

    remboursementOverlay.addEventListener('click', function(e) {
        if (e.target === this) {
            this.classList.remove('active');
            remboursementCause.value = '';
        }
    });

    // ==========================================
    // SOCKET.IO
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
                console.log('✅ Socket.IO admin (wave) connecté');
                isSocketConnected = true;
            });

            socket.on('disconnect', function() {
                console.log('❌ Socket.IO admin (wave) déconnecté');
                isSocketConnected = false;
                setTimeout(() => {
                    if (!isSocketConnected) connectSocketIO();
                }, 3000);
            });

            socket.on('wave-verification-request', function(data) {
                console.log('🔔 Nouvelle demande Wave:', data);
                loadRequests();
            });

            socket.on('commande-update', function(data) {
                console.log('📦 Commande mise à jour:', data);
                loadRequests();
            });

            socket.on('solde-update', function(data) {
                console.log('💰 Solde mis à jour:', data);
                if (data.solde !== undefined) {
                    soldeAmount.textContent = data.solde.toLocaleString();
                } else {
                    loadSolde();
                }
            });

        } catch (error) {
            console.error('❌ Erreur connexion Socket.IO:', error);
            setTimeout(() => connectSocketIO(), 5000);
        }
    }

    // ==========================================
    // SYNC AUTO
    // ==========================================

    function startSync() {
        if (syncInterval) {
            clearInterval(syncInterval);
        }
        syncInterval = setInterval(() => {
            loadRequests();
        }, 10000);
    }

    function stopSync() {
        if (syncInterval) {
            clearInterval(syncInterval);
            syncInterval = null;
        }
    }

    // ==========================================
    // INITIALISATION
    // ==========================================

    loadSolde();
    loadRequests();
    connectSocketIO();
    startSync();

    // ✅ Bouton historique actif par défaut
    if (historyBtn) {
        historyBtn.classList.add('active');
        historyBtn.innerHTML = '<i class="fas fa-clock"></i> Historique';
    }

    console.log('✅ wave.js initialisé');

});