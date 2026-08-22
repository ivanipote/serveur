document.addEventListener('DOMContentLoaded', function() {

    console.log('✅ paiements.js chargé');

    // ==========================================
    // RÉFÉRENCES
    // ==========================================

    const paymentsTableBody = document.getElementById('paymentsTableBody');
    const searchInput = document.getElementById('searchInput');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const paymentCount = document.getElementById('paymentCount');

    const statSuccess = document.getElementById('statSuccess');
    const statTotal = document.getElementById('statTotal');
    const statRefunded = document.getElementById('statRefunded');
    const statRefundedTotal = document.getElementById('statRefundedTotal');

    const miniSuccess = document.getElementById('miniSuccess');
    const miniRefunded = document.getElementById('miniRefunded');
    const miniExpired = document.getElementById('miniExpired');
    const miniCanceled = document.getElementById('miniCanceled');

    const miniSuccessAmount = document.getElementById('miniSuccessAmount');
    const miniRefundedAmount = document.getElementById('miniRefundedAmount');
    const miniExpiredAmount = document.getElementById('miniExpiredAmount');
    const miniCanceledAmount = document.getElementById('miniCanceledAmount');

    let allPayments = [];
    let currentFilter = 'all';
    let searchTerm = '';

    // ==========================================
    // NOM ADMIN
    // ==========================================

    const adminName = localStorage.getItem('adminName') || 'Admin';
    document.getElementById('adminName').textContent = adminName;

    // ==========================================
    // FONCTION : OBTENIR LE VRAI STATUT
    // ==========================================

    function getRealStatus(payment) {
        // Wave manuel → success
        if (payment.genius_status === 'wave_manual') return 'success';
        // Wave remboursé → refunded
        if (payment.genius_status === 'wave_refunded') return 'refunded';
        // Genius Pay success
        if (payment.genius_status === 'success') return 'success';
        // Genius Pay refunded
        if (payment.genius_status === 'refunded') return 'refunded';
        // Status direct
        if (payment.status === 'success') return 'success';
        if (payment.status === 'refunded') return 'refunded';
        if (payment.status === 'expired') return 'expired';
        // failed, canceled, cancelled → canceled
        if (payment.status === 'failed' || payment.status === 'canceled' || payment.status === 'cancelled') return 'canceled';
        // Par défaut
        return payment.status || payment.genius_status || 'pending';
    }

    // ==========================================
    // FONCTION : CALCULER LES STATS
    // ==========================================

    function calculateStats(payments) {
        const stats = {
            success: { count: 0, total: 0 },
            refunded: { count: 0, total: 0 },
            expired: { count: 0, total: 0 },
            canceled: { count: 0, total: 0 },
            pending: { count: 0, total: 0 }
        };

        payments.forEach(p => {
            const realStatus = getRealStatus(p);
            const amount = p.amount || 0;
            
            if (stats[realStatus]) {
                stats[realStatus].count++;
                stats[realStatus].total += amount;
            }
        });

        return stats;
    }

    // ==========================================
    // FONCTION : FILTRER PAR STATUT
    // ==========================================

    function filterByStatus(payments, filter) {
        if (filter === 'all') return payments;
        
        return payments.filter(p => {
            const realStatus = getRealStatus(p);
            if (filter === 'canceled') {
                return realStatus === 'canceled';
            }
            return realStatus === filter;
        });
    }

    // ==========================================
    // CHARGER LES PAIEMENTS
    // ==========================================

    async function loadPayments() {
        try {
            const res = await fetch('/api/admin/payments');
            const data = await res.json();

            if (res.ok && data.length > 0) {
                allPayments = data;
                renderPayments();
                updateStats();
            } else {
                allPayments = [];
                renderEmpty();
            }
        } catch (error) {
            console.error('❌ Erreur chargement paiements:', error);
            renderEmpty();
        }
    }

    // ==========================================
    // RENDRE LES PAIEMENTS
    // ==========================================

    function renderPayments() {
        // Filtrer
        let filtered = filterByStatus(allPayments, currentFilter);

        // Recherche
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(p =>
                (p.customer_name && p.customer_name.toLowerCase().includes(term)) ||
                (p.reference && p.reference.toLowerCase().includes(term)) ||
                (p.genius_reference && p.genius_reference.toLowerCase().includes(term)) ||
                (p.commande_id && p.commande_id.toString().includes(term))
            );
        }

        // Trier par date (plus récent en premier)
        filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        // Mettre à jour le compte
        paymentCount.textContent = filtered.length + ' paiements';

        // Rendre le tableau
        renderTable(filtered);
    }

    // ==========================================
    // TABLEAU
    // ==========================================

    function renderTable(payments) {
        if (payments.length === 0) {
            paymentsTableBody.innerHTML = `
                <tr><td colspan="7" class="empty-table">
                    <i class="fas fa-credit-card"></i>
                    <p>Aucun paiement trouvé</p>
                </td></tr>
            `;
            return;
        }

        const statusLabels = {
            'success': { label: '✅ Succès', class: 'success' },
            'refunded': { label: '🔄 Remboursé', class: 'refunded' },
            'expired': { label: '⏰ Expiré', class: 'expired' },
            'canceled': { label: '❌ Annulé', class: 'canceled' },
            'pending': { label: '⏳ En attente', class: 'pending' }
        };

        const gatewayLabels = {
            'genius_pay': { label: '💳 Genius Pay', class: 'genius_pay' },
            'wave': { label: '🌊 Wave', class: 'wave' }
        };

        const dateOptions = { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' };

        let html = '';
        payments.forEach(p => {
            const realStatus = getRealStatus(p);
            const statusInfo = statusLabels[realStatus] || { label: realStatus, class: 'pending' };
            const gatewayInfo = gatewayLabels[p.gateway] || { label: p.gateway || 'N/A', class: '' };
            const amount = p.amount || 0;
            const isNegative = amount < 0;
            const client = p.customer_name || 'Client inconnu';
            const ref = p.reference || p.genius_reference || '-';
            const date = new Date(p.created_at);
            const copyText = `ID: #${p.id}\nRéférence: ${ref}\nClient: ${client}\nMontant: ${Math.abs(amount).toLocaleString()} FCFA${isNegative ? ' (Remboursement)' : ''}\nGateway: ${gatewayInfo.label}\nStatut: ${statusInfo.label}\nDate: ${date.toLocaleDateString('fr-FR', dateOptions)}`;

            html += `
                <tr>
                    <td>
                        #${p.id}
                        <button class="copy-btn-mini" data-copy="${p.id}" title="Copier l'ID">
                            <i class="fas fa-copy"></i>
                        </button>
                    </td>
                    <td style="font-size:12px;color:var(--ink-400);font-family:var(--font-mono);">
                        ${ref}
                        <button class="copy-btn-mini" data-copy="${ref}" title="Copier la référence">
                            <i class="fas fa-copy"></i>
                        </button>
                    </td>
                    <td>
                        ${client}
                        <button class="copy-btn-mini" data-copy="${client}" title="Copier le nom">
                            <i class="fas fa-copy"></i>
                        </button>
                    </td>
                    <td>
                        <span class="${isNegative ? 'amount-negative' : 'amount-positive'}">
                            ${isNegative ? '-' : ''}${Math.abs(amount).toLocaleString()} FCFA
                        </span>
                        <button class="copy-btn-mini" data-copy="${Math.abs(amount).toLocaleString()} FCFA" title="Copier le montant">
                            <i class="fas fa-copy"></i>
                        </button>
                    </td>
                    <td><span class="gateway-badge ${gatewayInfo.class}">${gatewayInfo.label}</span></td>
                    <td><span class="status-badge ${statusInfo.class}">${statusInfo.label}</span></td>
                    <td style="font-size:12px;color:var(--ink-400);">
                        ${date.toLocaleDateString('fr-FR', dateOptions)}
                        <button class="copy-btn-mini" data-copy="${date.toLocaleDateString('fr-FR', dateOptions)}" title="Copier la date">
                            <i class="fas fa-copy"></i>
                        </button>
                    </td>
                </tr>
            `;
        });

        paymentsTableBody.innerHTML = html;

        // Attacher les événements copy
        document.querySelectorAll('.copy-btn-mini').forEach(btn => {
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
    }

    // ==========================================
    // STATS
    // ==========================================

    function updateStats() {
        const stats = calculateStats(allPayments);

        // Header stats
        statSuccess.textContent = stats.success.count;
        statTotal.textContent = stats.success.total.toLocaleString() + ' FCFA';
        statRefunded.textContent = stats.refunded.count;
        
        // Total remboursés (montant négatif)
        const refundedTotal = stats.refunded.total;
        statRefundedTotal.textContent = Math.abs(refundedTotal).toLocaleString() + ' FCFA';
        statRefundedTotal.className = 'stat-value negative';

        // Mini stats
        miniSuccess.textContent = stats.success.count;
        miniSuccessAmount.textContent = stats.success.total.toLocaleString() + ' FCFA';

        miniRefunded.textContent = stats.refunded.count;
        miniRefundedAmount.textContent = Math.abs(stats.refunded.total).toLocaleString() + ' FCFA';
        miniRefundedAmount.className = 'mini-amount negative';

        miniExpired.textContent = stats.expired.count;
        miniExpiredAmount.textContent = stats.expired.total.toLocaleString() + ' FCFA';

        miniCanceled.textContent = stats.canceled.count;
        miniCanceledAmount.textContent = stats.canceled.total.toLocaleString() + ' FCFA';
    }

    // ==========================================
    // EMPTY
    // ==========================================

    function renderEmpty() {
        paymentsTableBody.innerHTML = `
            <tr><td colspan="7" class="empty-table">
                <i class="fas fa-credit-card"></i>
                <p>Aucun paiement trouvé</p>
            </td></tr>
        `;
        paymentCount.textContent = '0 paiements';

        statSuccess.textContent = '0';
        statTotal.textContent = '0 FCFA';
        statRefunded.textContent = '0';
        statRefundedTotal.textContent = '0 FCFA';

        miniSuccess.textContent = '0';
        miniRefunded.textContent = '0';
        miniExpired.textContent = '0';
        miniCanceled.textContent = '0';

        miniSuccessAmount.textContent = '0 FCFA';
        miniRefundedAmount.textContent = '0 FCFA';
        miniExpiredAmount.textContent = '0 FCFA';
        miniCanceledAmount.textContent = '0 FCFA';
    }

    // ==========================================
    // FILTRES
    // ==========================================

    filterBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            filterBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentFilter = this.dataset.filter;
            renderPayments();
        });
    });

    // ==========================================
    // RECHERCHE
    // ==========================================

    searchInput.addEventListener('input', function() {
        searchTerm = this.value.trim();
        renderPayments();
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
                console.log('✅ Socket.IO admin (paiements) connecté');
                isSocketConnected = true;
            });

            socket.on('disconnect', function() {
                console.log('❌ Socket.IO admin (paiements) déconnecté');
                isSocketConnected = false;
                setTimeout(() => {
                    if (!isSocketConnected) connectSocketIO();
                }, 3000);
            });

            socket.on('commande-update', function(data) {
                console.log('📦 Mise à jour commande (paiements):', data);
                loadPayments();
                if (window.updateBadges) window.updateBadges();
            });

            socket.on('solde-update', function(data) {
                console.log('💰 Solde mis à jour (paiements):', data);
                loadPayments();
            });

        } catch (error) {
            console.error('❌ Erreur connexion Socket.IO:', error);
            setTimeout(() => connectSocketIO(), 5000);
        }
    }

    // ==========================================
    // SYNC AUTO
    // ==========================================

    let syncInterval = null;

    function startSync() {
        if (syncInterval) {
            clearInterval(syncInterval);
        }
        syncInterval = setInterval(() => {
            loadPayments();
        }, 10000);
    }

    // ==========================================
    // INITIALISATION
    // ==========================================

    loadPayments();
    connectSocketIO();
    startSync();

    console.log('✅ paiements.js initialisé');

});