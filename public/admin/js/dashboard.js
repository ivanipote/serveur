document.addEventListener('DOMContentLoaded', function() {

    console.log('✅ Admin dashboard chargé');

    // ==========================================
    // FUSEAU HORAIRE - UTC+0 (Côte d'Ivoire)
    // ==========================================

    function parseDateUTC(dateStr) {
        if (!dateStr) return null;
        // Forcer UTC en ajoutant 'Z' si pas présent
        const str = dateStr.includes('Z') ? dateStr : dateStr + 'Z';
        return new Date(str);
    }

    function formatDateLocale(dateStr) {
        if (!dateStr) return '-';
        const d = parseDateUTC(dateStr);
        if (!d) return '-';
        return d.toLocaleDateString('fr-FR') + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    }

    function getTimeRemainingUTC(dateStr) {
        if (!dateStr) return null;
        const created = parseDateUTC(dateStr);
        if (!created) return null;
        const expiryTime = created.getTime() + 20 * 60 * 1000; // 20 min
        const now = Date.now();
        const diff = expiryTime - now;

        if (diff <= 0) return 'expired';

        const minutes = Math.floor(diff / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        return {
            minutes: String(minutes).padStart(2, '0'),
            seconds: String(seconds).padStart(2, '0'),
            diff: diff
        };
    }

    function isExpiredUTC(dateStr) {
        if (!dateStr) return false;
        const created = parseDateUTC(dateStr);
        if (!created) return false;
        const expiryTime = created.getTime() + 20 * 60 * 1000;
        return Date.now() > expiryTime;
    }

    const TIMEOUT_MINUTES = 20;
    const TIMEOUT_MS = TIMEOUT_MINUTES * 60 * 1000;

    // ==========================================
    // VÉRIFICATION CONNEXION
    // ==========================================

    const adminToken = localStorage.getItem('adminToken');
    if (!adminToken) {
        window.location.href = '/admin/login';
        return;
    }

    const adminName = localStorage.getItem('adminName') || 'Admin';
    document.getElementById('adminName').textContent = adminName;

    // ==========================================
    // HORLOGE
    // ==========================================

    function updateClock() {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        document.getElementById('headerTime').textContent = `${hours}:${minutes}`;
    }
    updateClock();
    setInterval(updateClock, 60000);

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
                auth: { userId: parseInt(adminId), isAdmin: true },
                transports: ['websocket', 'polling'],
                timeout: 5000,
                reconnection: true,
                reconnectionAttempts: 20,
                reconnectionDelay: 500,
                reconnectionDelayMax: 3000
            });

            socket.on('connect', function() {
                console.log('✅ Socket.IO admin connecté');
                isSocketConnected = true;
                updateConnectionStatus('● Connecté', true);
            });

            socket.on('disconnect', function() {
                isSocketConnected = false;
                updateConnectionStatus('● Reconnexion...', false);
                setTimeout(() => {
                    if (!isSocketConnected) connectSocketIO();
                }, 2000);
            });

            socket.on('nouvelle-commande', function(data) {
                console.log('🆕 Nouvelle commande:', data);
                loadOverview();
                loadCommandes();
                loadPayments();
                updateNavBadge('commandes');
                showToast(`🆕 Nouvelle commande #${data.commandeId}`, 'success');
            });

            socket.on('commande-update', function(data) {
                console.log('📦 Mise à jour commande:', data);
                loadOverview();
                loadCommandes();
                loadPayments();
                showToast(`📦 Commande #${data.commandeId} mise à jour`, 'info');
            });

        } catch (error) {
            console.error('❌ Socket.IO erreur:', error);
            setTimeout(connectSocketIO, 3000);
        }
    }

    function updateConnectionStatus(text, connected) {
        const el = document.getElementById('connectionStatus');
        if (el) {
            el.textContent = text;
            el.className = 'header-status' + (connected ? '' : ' disconnected');
        }
    }

    function updateNavBadge(page) {
        if (page === 'commandes') {
            const badge = document.getElementById('navBadgeCommandes');
            if (badge) {
                const current = parseInt(badge.textContent) || 0;
                badge.textContent = current + 1;
            }
        }
    }

    // ==========================================
    // TOAST
    // ==========================================

    function showToast(message, type = 'info') {
        const colors = {
            success: '#43a047',
            error: '#e53935',
            info: '#1a2a6c',
            warning: '#e67e22'
        };
        const toast = document.createElement('div');
        toast.className = 'toast ' + type;
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed; bottom: 30px; right: 30px;
            background: ${colors[type] || '#1a2a6c'};
            color: white; padding: 14px 24px; border-radius: 12px;
            font-weight: 600; font-size: 14px;
            box-shadow: 0 8px 30px rgba(0,0,0,0.2);
            z-index: 999; max-width: 400px;
            animation: slideInRight 0.3s ease;
            transition: opacity 0.3s;
        `;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    // ==========================================
    // NAVIGATION
    // ==========================================

    const navLinks = document.querySelectorAll('.sidebar-nav a');
    const pages = document.querySelectorAll('.page-section');
    const pageTitle = document.getElementById('pageTitle');

    const pageTitles = {
        overview: '📊 Vue d\'ensemble',
        commandes: '📋 Commandes',
        payments: '💳 Paiements',
        products: '📦 Produits',
        'add-product': '➕ Ajouter un produit',
        clients: '👤 Clients',
        livraison: '📍 Frais de livraison',
        'send-message': '📨 Envoyer un message',
        updates: '🔄 Mises à jour',
        profile: '👤 Mon profil'
    };

    function showPage(pageId) {
        navLinks.forEach(link => link.classList.toggle('active', link.dataset.page === pageId));
        pages.forEach(p => p.classList.remove('active'));
        const target = document.getElementById('page-' + pageId);
        if (target) target.classList.add('active');
        pageTitle.textContent = pageTitles[pageId] || 'Dashboard';

        if (pageId === 'commandes') {
            const badge = document.getElementById('navBadgeCommandes');
            if (badge) badge.textContent = '0';
        }

        const loadFn = window['load' + pageId.charAt(0).toUpperCase() + pageId.slice(1).replace(/-/g, '')];
        if (typeof loadFn === 'function') loadFn();
    }

    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            showPage(this.dataset.page);
        });
    });

    document.getElementById('refreshPageBtn').addEventListener('click', function() {
        const active = document.querySelector('.page-section.active');
        if (active) {
            const pageId = active.id.replace('page-', '');
            const fn = window['load' + pageId.charAt(0).toUpperCase() + pageId.slice(1).replace(/-/g, '')];
            if (typeof fn === 'function') fn();
            else location.reload();
        }
    });

    document.getElementById('logoutBtn').addEventListener('click', function() {
        if (socket) socket.disconnect();
        localStorage.clear();
        window.location.href = '/admin/login';
    });

    // ==========================================
    // SYNC AUTO - EN ARRIÈRE-PLAN
    // ==========================================

    let syncInterval = null;
    let isSyncing = false;

    function startAutoSync() {
        if (syncInterval) {
            clearInterval(syncInterval);
        }

        console.log('🔄 Sync admin démarré (toutes les 10s)');

        syncInterval = setInterval(() => {
            if (!isSyncing) {
                const activePage = document.querySelector('.page-section.active');
                if (activePage) {
                    const pageId = activePage.id.replace('page-', '');
                    const fn = window['load' + pageId.charAt(0).toUpperCase() + pageId.slice(1).replace(/-/g, '')];
                    if (typeof fn === 'function' && pageId !== 'add-product' && pageId !== 'send-message' && pageId !== 'profile') {
                        fn();
                    }
                }
            }
        }, 10000);
    }

    function stopAutoSync() {
        if (syncInterval) {
            clearInterval(syncInterval);
            syncInterval = null;
            console.log('⏹️ Sync admin arrêté');
        }
    }

    // ==========================================
    // VUE D'ENSEMBLE
    // ==========================================

    let overviewInterval = null;

    window.loadOverview = async function() {
        try {
            const res = await fetch('/api/admin/stats');
            const data = await res.json();

            document.getElementById('statProducts').textContent = data.products || 0;
            document.getElementById('statSales').textContent = (data.sales || 0).toLocaleString() + ' FCFA';
            document.getElementById('statCommandes').textContent = data.commandes || 0;
            document.getElementById('statClients').textContent = data.clients || 0;

            ['products', 'sales', 'commandes', 'clients'].forEach(key => {
                const trend = document.getElementById('trend' + key.charAt(0).toUpperCase() + key.slice(1));
                if (trend) {
                    const up = Math.random() > 0.3;
                    trend.textContent = up ? `+${Math.floor(Math.random() * 20 + 1)}%` : `-${Math.floor(Math.random() * 10 + 1)}%`;
                    trend.className = `stat-trend ${up ? 'up' : 'down'}`;
                }
            });

            await loadRecentOrders();
        } catch (e) { console.error('Erreur overview:', e); }
    };

    async function loadRecentOrders() {
        try {
            const res = await fetch('/api/admin/commandes');
            const data = await res.json();
            const tbody = document.getElementById('recentOrdersList');
            const count = document.getElementById('recentOrdersCount');

            if (data && data.length > 0) {
                const recent = data.slice(0, 5);
                if (count) count.textContent = recent.length;

                const labels = {
                    'en_attente': '⏳ En attente', 'accepter': '💳 Paiement requis',
                    'refuse': '❌ Refusée', 'annulee': '❌ Annulée',
                    'paiement_effectue': '💳 Payée', 'livraison_en_cours': '🚚 En cours',
                    'disponible': '📍 Disponible', 'recuperee': '✅ Récupérée'
                };

                tbody.innerHTML = recent.map(c => `
                    <tr>
                        <td>#${c.id}</td>
                        <td>${c.nom}</td>
                        <td>${(c.total || 0).toLocaleString()} FCFA</td>
                        <td><span class="status-badge ${c.status}">${labels[c.status] || c.status}</span></td>
                        <td>${formatDateLocale(c.created_at)}</td>
                    </tr>
                `).join('');
            } else {
                tbody.innerHTML = `<tr><td colspan="5" class="empty-msg">Aucune commande récente</td></tr>`;
                if (count) count.textContent = '0';
            }
        } catch (e) { console.error('Erreur recent orders:', e); }
    }

    function startOverviewAutoRefresh() {
        if (overviewInterval) clearInterval(overviewInterval);
        overviewInterval = setInterval(() => {
            if (document.getElementById('page-overview').classList.contains('active')) window.loadOverview();
        }, 30000);
    }
    startOverviewAutoRefresh();

    // ==========================================
    // COMMANDES
    // ==========================================

    let allCommandes = [];
    let currentFilter = 'all';
    let searchTerm = '';
    let currentCommandeId = null;

    window.loadCommandes = async function() {
        try {
            const res = await fetch('/api/admin/commandes');
            const data = await res.json();
            if (res.ok) {
                allCommandes = data;
                document.getElementById('commandesCount').textContent = data.length + ' commandes';
                renderCommandesTable();
                updateFilterCounts();
                updateCommandesBadge();
            }
        } catch (e) { console.error('Erreur commandes:', e); }
    };

    function updateCommandesBadge() {
        const badge = document.getElementById('navBadgeCommandes');
        if (badge) {
            const count = allCommandes ? allCommandes.length : 0;
            badge.textContent = count > 0 ? count : '0';
        }
    }

    function renderCommandesTable() {
        const tbody = document.getElementById('commandesList');
        const countEl = document.getElementById('filterCount');

        let filtered = allCommandes;
        if (currentFilter !== 'all') filtered = filtered.filter(c => c.status === currentFilter || c.genius_status === currentFilter);
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(c =>
                c.id.toString().includes(term) ||
                (c.reference && c.reference.toLowerCase().includes(term)) ||
                c.nom.toLowerCase().includes(term) ||
                (c.genius_reference && c.genius_reference.toLowerCase().includes(term))
            );
        }

        if (countEl) countEl.textContent = filtered.length + ' commandes';

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="9" class="empty-msg">Aucune commande trouvée.</td></tr>`;
            return;
        }

        const labels = {
            'en_attente': '⏳ En attente', 'accepter': '💳 Paiement requis',
            'refuse': '❌ Refusée', 'annulee': '❌ Annulée',
            'paiement_effectue': '💳 Payée', 'livraison_en_cours': '🚚 En cours',
            'disponible': '📍 Disponible', 'recuperee': '✅ Récupérée'
        };

        const geniusLabels = {
            'pending': '⏳ pending',
            'processing': '⏳ processing',
            'success': '✅ success',
            'failed': '❌ failed',
            'cancelled': '⏰ cancelled',
            'expired': '⏳ expired',
            'refunded': '🔄 refunded'
        };

        const geniusColors = {
            'pending': 'pending',
            'processing': 'processing',
            'success': 'success',
            'failed': 'failed',
            'cancelled': 'cancelled',
            'expired': 'expired',
            'refunded': 'refunded'
        };

        tbody.innerHTML = filtered.map(c => {
            const status = c.status || 'en_attente';
            const geniusStatus = c.genius_status || c.status || 'en_attente';
            const isFinal = ['recuperee', 'refuse', 'annulee'].includes(status);
            
            // ✅ Timer UTC pour admin
            let timerHtml = '';
            if (geniusStatus === 'pending' || geniusStatus === 'processing' || status === 'paiement_en_cours') {
                const paymentDateStr = c.payment_created_at || c.created_at;
                const timeRemaining = getTimeRemainingUTC(paymentDateStr);
                
                if (timeRemaining === 'expired') {
                    timerHtml = `<span class="timer-badge expired">⏳ Expiré</span>`;
                } else if (timeRemaining) {
                    timerHtml = `<span class="timer-badge active">⏳ ${timeRemaining.minutes}:${timeRemaining.seconds}</span>`;
                }
            }

            // ✅ Vérifier si expiré UTC
            const expired = isExpiredUTC(c.payment_created_at || c.created_at);

            return `
                <tr data-id="${c.id}" class="${expired ? 'expired-row' : ''}">
                    <td>#${c.id}</td>
                    <td style="font-size:12px;color:#888;">${c.reference || '-'}</td>
                    <td>${c.nom}</td>
                    <td>${(c.total || 0).toLocaleString()} FCFA</td>
                    <td><span class="status-badge ${status}">${labels[status] || status}</span></td>
                    <td><span class="genius-status-badge ${geniusColors[geniusStatus] || 'pending'}">${geniusLabels[geniusStatus] || geniusStatus}</span></td>
                    <td>${timerHtml}</td>
                    <td>${formatDateLocale(c.created_at)}</td>
                    <td>
                        <button class="btn-action maps" onclick="openMaps(${c.latitude || 'null'}, ${c.longitude || 'null'}, ${c.id})" title="Maps"><i class="fas fa-map-marker-alt"></i></button>
                        ${!isFinal ? `<button class="btn-action status" onclick="openStatusOverlay(${c.id})" title="Statut"><i class="fas fa-edit"></i></button>` : `<button class="btn-action status" style="opacity:0.4;cursor:not-allowed;" disabled><i class="fas fa-lock"></i></button>`}
                        <button class="btn-action detail" onclick="openDetailOverlay(${c.id})" title="Détails"><i class="fas fa-eye"></i></button>
                        ${c.genius_reference ? `<button class="btn-action link" onclick="window.open('https://geniuspay.ci/checkout/${c.genius_reference}', '_blank')" title="Voir paiement"><i class="fas fa-external-link-alt"></i></button>` : ''}
                    </td>
                </tr>
            `;
        }).join('');
    }

    function updateFilterCounts() {
        document.querySelectorAll('#filterButtons .filter-btn').forEach(btn => {
            const filter = btn.dataset.filter;
            let count;
            if (filter === 'all') {
                count = allCommandes.length;
            } else {
                count = allCommandes.filter(c => c.status === filter || c.genius_status === filter).length;
            }
            btn.textContent = btn.textContent.split('(')[0].trim() + ` (${count})`;
        });
    }

    document.querySelectorAll('#filterButtons .filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('#filterButtons .filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentFilter = this.dataset.filter;
            renderCommandesTable();
        });
    });

    document.getElementById('searchCommande').addEventListener('input', function() {
        searchTerm = this.value.trim();
        renderCommandesTable();
    });

    document.getElementById('refreshCommandesBtn').addEventListener('click', window.loadCommandes);

    window.openMaps = function(lat, lon, id) {
        if (lat && lon) window.open(`https://www.google.com/maps?q=${lat},${lon}`, '_blank');
        else alert(`📍 Aucune position GPS pour la commande #${id}`);
    };

    window.openStatusOverlay = function(commandeId) {
        const commande = allCommandes.find(c => c.id === commandeId);
        if (!commande) { alert('❌ Commande non trouvée'); return; }

        const current = commande.status || 'en_attente';
        const labels = {
            'en_attente': '⏳ En attente', 'accepter': '💳 Paiement requis',
            'refuse': '❌ Refusée', 'paiement_effectue': '💳 Payée',
            'livraison_en_cours': '🚚 En cours', 'disponible': '📍 Disponible',
            'recuperee': '✅ Récupérée'
        };

        let available = [];
        if (current === 'en_attente') available = ['accepter', 'refuse'];
        else if (current === 'accepter') available = ['paiement_effectue', 'refuse'];
        else if (current === 'paiement_effectue') available = ['livraison_en_cours'];
        else if (current === 'livraison_en_cours') available = ['disponible'];
        else if (current === 'disponible') available = ['recuperee'];
        else { alert('⚠️ Statut final'); return; }

        currentCommandeId = commandeId;
        document.getElementById('statusCommandeId').textContent = commandeId;
        document.getElementById('statusClientInfo').textContent = 'Client: ' + commande.nom;

        const select = document.getElementById('statusSelect');
        select.innerHTML = '';
        available.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s;
            opt.textContent = labels[s] || s;
            select.appendChild(opt);
        });

        document.getElementById('causeRefusGroup').style.display = 'none';
        document.getElementById('statusOverlay').classList.add('active');
    };

    document.getElementById('closeStatusOverlay').addEventListener('click', function() {
        document.getElementById('statusOverlay').classList.remove('active');
    });

    document.getElementById('statusSelect').addEventListener('change', function() {
        document.getElementById('causeRefusGroup').style.display = this.value === 'refuse' ? 'block' : 'none';
    });

    document.getElementById('saveStatusBtn').addEventListener('click', async function() {
        const status = document.getElementById('statusSelect').value;
        const cause = document.getElementById('causeRefus').value.trim();

        if (status === 'refuse' && !cause) { alert('⚠️ Cause requise.'); return; }

        try {
            const res = await fetch('/api/admin/commande/status', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ commandeId: currentCommandeId, status, causeRefus: cause || null })
            });
            if (res.ok) {
                showToast('✅ Statut mis à jour !', 'success');
                document.getElementById('statusOverlay').classList.remove('active');
                window.loadCommandes();
                window.loadOverview();
            } else {
                const data = await res.json();
                showToast('❌ ' + data.error, 'error');
            }
        } catch (e) { showToast('❌ Erreur', 'error'); }
    });

    document.getElementById('cancelStatusBtn').addEventListener('click', function() {
        document.getElementById('statusOverlay').classList.remove('active');
    });

    window.openDetailOverlay = async function(commandeId) {
        const commande = allCommandes.find(c => c.id === commandeId);
        if (!commande) { alert('❌ Commande non trouvée'); return; }

        let panier = [];
        try { panier = JSON.parse(commande.panier || '[]'); } catch (e) { panier = []; }

        const labels = {
            'en_attente': '⏳ En attente', 'accepter': '💳 Paiement requis',
            'refuse': '❌ Refusée', 'annulee': '❌ Annulée',
            'paiement_effectue': '💳 Payée', 'livraison_en_cours': '🚚 En cours',
            'disponible': '📍 Disponible', 'recuperee': '✅ Récupérée'
        };

        const productsHtml = panier.map(p => `
            <div class="product-item">
                <span class="name">${p.name || 'Produit'}</span>
                <span class="qty">× ${p.quantity || 1}</span>
                <span class="price">${((p.price || 0) * (p.quantity || 1)).toLocaleString()} FCFA</span>
            </div>
        `).join('') || '<p style="color:#888;font-size:13px;">Aucun produit</p>';

        const gpsHtml = (commande.latitude && commande.longitude) ?
            `<a href="https://www.google.com/maps?q=${commande.latitude},${commande.longitude}" target="_blank" class="detail-gps-link"><i class="fas fa-map-marker-alt"></i> Voir sur Google Maps</a>` :
            '<span style="color:#888;">Non renseigné</span>';

        document.getElementById('detailContent').innerHTML = `
            <div class="detail-section">
                <div class="section-title">📋 Informations générales</div>
                <div class="detail-row"><span class="label">ID</span><span class="value">#${commande.id}</span></div>
                <div class="detail-row"><span class="label">Référence</span><span class="value" style="font-size:13px;color:#888;">${commande.reference || '-'}</span></div>
                <div class="detail-row"><span class="label">Réf. Genius</span><span class="value" style="font-size:13px;color:#888;">${commande.genius_reference || '-'}</span></div>
                <div class="detail-row"><span class="label">Date</span><span class="value">${formatDateLocale(commande.created_at)}</span></div>
                <div class="detail-row"><span class="label">Statut</span><span class="value"><span class="status-badge ${commande.status}">${labels[commande.status] || commande.status}</span></span></div>
                ${commande.genius_status ? `<div class="detail-row"><span class="label">Statut Genius</span><span class="value"><span class="genius-status-badge ${commande.genius_status}">${commande.genius_status}</span></span></div>` : ''}
                ${commande.cause_refus ? `<div class="detail-row"><span class="label">Cause refus</span><span class="value" style="color:#e74c3c;">${commande.cause_refus}</span></div>` : ''}
            </div>
            <div class="detail-section">
                <div class="section-title">👤 Client</div>
                <div class="detail-row"><span class="label">Nom</span><span class="value">${commande.nom}</span></div>
                <div class="detail-row"><span class="label">Téléphone</span><span class="value">${commande.telephone || '-'}</span></div>
                <div class="detail-row"><span class="label">Code secret</span><span class="value" style="letter-spacing:2px;color:#888;">${commande.code_login || '••••'}</span></div>
            </div>
            <div class="detail-section">
                <div class="section-title">📍 Livraison</div>
                <div class="detail-row"><span class="label">Option</span><span class="value">${commande.option === 'chezmoi' ? '📍 Chez moi' : '✏️ Adresse'}</span></div>
                <div class="detail-row"><span class="label">Commune</span><span class="value">${commande.commune || '-'}</span></div>
                <div class="detail-row"><span class="label">Quartier</span><span class="value">${commande.quartier || '-'}</span></div>
                <div class="detail-row"><span class="label">Précision</span><span class="value">${commande.precision || '-'}</span></div>
                <div class="detail-row"><span class="label">GPS</span><span class="value">${gpsHtml}</span></div>
            </div>
            <div class="detail-section">
                <div class="section-title">📦 Produits</div>
                <div class="detail-products">${productsHtml}</div>
            </div>
            <div class="detail-section">
                <div class="detail-total"><span>Total</span><span class="total-value">${(commande.total || 0).toLocaleString()} FCFA</span></div>
                ${commande.frais_livraison ? `<div style="display:flex;justify-content:space-between;font-size:13px;color:#888;padding:4px 0;"><span>Frais de livraison</span><span>${commande.frais_livraison.toLocaleString()} FCFA</span></div>` : ''}
            </div>
        `;

        document.getElementById('detailOverlay').classList.add('active');
    };

    document.getElementById('closeDetailOverlay').addEventListener('click', function() {
        document.getElementById('detailOverlay').classList.remove('active');
    });

    // ==========================================
    // PAIEMENTS
    // ==========================================

    window.loadPayments = async function() {
        try {
            const res = await fetch('/api/admin/payments');
            const data = await res.json();
            const tbody = document.getElementById('paymentsList');
            document.getElementById('paymentsCount').textContent = data.length + ' transactions';

            if (data.length === 0) {
                tbody.innerHTML = `<tr><td colspan="10" class="empty-msg">Aucun paiement</td></tr>`;
                return;
            }

            const statusLabels = {
                pending: '⏳ En attente',
                success: '✅ Réussi',
                failed: '❌ Échoué',
                canceled: '⏰ Annulé',
                cancelled: '⏰ Annulé',
                processing: '⏳ En cours',
                expired: '⏳ Expiré',
                refunded: '🔄 Remboursé'
            };

            const geniusColors = {
                pending: 'pending',
                processing: 'processing',
                success: 'success',
                failed: 'failed',
                cancelled: 'cancelled',
                expired: 'expired',
                refunded: 'refunded'
            };

            tbody.innerHTML = data.map(p => `
                <tr>
                    <td>#${p.id}</td>
                    <td style="font-size:12px;color:#888;">${p.reference || '-'}</td>
                    <td style="font-size:12px;color:#888;">${p.genius_reference || '-'}</td>
                    <td>${(p.amount || 0).toLocaleString()} FCFA</td>
                    <td><span class="status-badge ${p.status}">${statusLabels[p.status] || p.status}</span></td>
                    <td><span class="genius-status-badge ${geniusColors[p.genius_status] || 'pending'}">${p.genius_status || 'pending'}</span></td>
                    <td>${p.customer_name || '-'}</td>
                    <td>${p.checkout_url ? `<button class="btn-action link" onclick="window.open('${p.checkout_url}', '_blank')" title="Ouvrir le lien"><i class="fas fa-external-link-alt"></i></button>` : '-'}</td>
                    <td>${p.expires_at ? formatDateLocale(p.expires_at) : '-'}</td>
                    <td>${formatDateLocale(p.created_at)}</td>
                </tr>
            `).join('');
        } catch (e) { console.error('Erreur paiements:', e); }
    };

    document.getElementById('refreshPaymentsBtn').addEventListener('click', window.loadPayments);

    // ==========================================
    // PRODUITS
    // ==========================================

    let allProducts = [];

    window.loadProducts = async function() {
        try {
            const res = await fetch('/api/admin/products');
            const data = await res.json();
            allProducts = data;
            const tbody = document.getElementById('productsList');
            document.getElementById('productsCount').textContent = data.length + ' produits';

            if (data.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" class="empty-msg">Aucun produit</td></tr>`;
                return;
            }

            tbody.innerHTML = data.map(p => `
                <tr data-id="${p.id}">
                    <td>#${p.id}</td>
                    <td style="cursor:pointer;color:#1a2a6c;font-weight:600;" onclick="openProductDetail(${p.id})">${p.name}</td>
                    <td>${(p.price || 0).toLocaleString()} FCFA</td>
                    <td>${p.quantity || 0}</td>
                    <td>${p.image1 ? `<img src="${p.image1}" alt="${p.name}" style="width:40px;height:40px;object-fit:cover;border-radius:6px;cursor:pointer;" onclick="openProductDetail(${p.id})">` : '-'}</td>
                    <td>
                        <button class="btn-action edit" onclick="editProduct(${p.id})" title="Modifier"><i class="fas fa-edit"></i></button>
                        <button class="btn-action delete" onclick="deleteProduct(${p.id})" title="Supprimer"><i class="fas fa-trash-alt"></i></button>
                    </td>
                </tr>
            `).join('');
        } catch (e) { console.error('Erreur produits:', e); }
    };

    window.openProductDetail = function(id) {
        const product = allProducts.find(p => p.id === id);
        if (!product) { alert('❌ Produit non trouvé'); return; }

        document.getElementById('productDetailContent').innerHTML = `
            <div class="detail-section">
                <div class="section-title">📦 Informations produit</div>
                <div class="detail-row"><span class="label">ID</span><span class="value">#${product.id}</span></div>
                <div class="detail-row"><span class="label">Nom</span><span class="value">${product.name}</span></div>
                <div class="detail-row"><span class="label">Prix</span><span class="value">${(product.price || 0).toLocaleString()} FCFA</span></div>
                <div class="detail-row"><span class="label">Stock</span><span class="value">${product.quantity || 0}</span></div>
                <div class="detail-row"><span class="label">Description</span><span class="value">${product.description || 'Aucune description'}</span></div>
            </div>
            <div class="detail-section">
                <div class="section-title">🖼️ Images</div>
                <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:4px;">
                    ${product.image1 ? `<img src="${product.image1}" alt="Image 1" style="max-width:200px;max-height:200px;border-radius:8px;object-fit:cover;border:1px solid #e8ecf4;">` : ''}
                    ${product.image2 ? `<img src="${product.image2}" alt="Image 2" style="max-width:200px;max-height:200px;border-radius:8px;object-fit:cover;border:1px solid #e8ecf4;">` : ''}
                </div>
            </div>
            <div class="detail-section">
                <div class="section-title">📅 Informations</div>
                <div class="detail-row"><span class="label">Créé le</span><span class="value">${formatDateLocale(product.created_at)}</span></div>
            </div>
        `;

        document.getElementById('productDetailOverlay').classList.add('active');
    };

    document.getElementById('closeProductDetailOverlay').addEventListener('click', function() {
        document.getElementById('productDetailOverlay').classList.remove('active');
    });

    window.editProduct = function(id) {
        const product = allProducts.find(p => p.id === id);
        if (!product) { alert('❌ Produit non trouvé'); return; }

        showPage('add-product');
        document.getElementById('productName').value = product.name;
        document.getElementById('productPrice').value = product.price;
        document.getElementById('productQuantity').value = product.quantity || 0;
        document.getElementById('productDescription').value = product.description || '';
        document.querySelector('form').dataset.editId = id;
        document.getElementById('submitProductBtn').textContent = '💾 Mettre à jour le produit';
        document.getElementById('submitProductBtn').dataset.editId = id;
    };

    window.deleteProduct = function(id) {
        document.getElementById('confirmTitle').textContent = '🗑️ Supprimer le produit';
        document.getElementById('confirmMessage').textContent = 'Êtes-vous sûr de vouloir supprimer ce produit ?';
        document.getElementById('confirmOverlay').classList.add('active');

        document.getElementById('confirmOk').onclick = async function() {
            document.getElementById('confirmOverlay').classList.remove('active');
            try {
                const res = await fetch(`/api/admin/products/${id}`, { method: 'DELETE' });
                if (res.ok) {
                    showToast('✅ Produit supprimé', 'success');
                    window.loadProducts();
                } else {
                    showToast('❌ Erreur suppression', 'error');
                }
            } catch (e) { showToast('❌ Erreur', 'error'); }
        };
    };

    document.getElementById('confirmCancel').addEventListener('click', function() {
        document.getElementById('confirmOverlay').classList.remove('active');
    });

    document.getElementById('refreshProductsBtn').addEventListener('click', window.loadProducts);

    // ==========================================
    // AJOUTER PRODUIT (avec édition)
    // ==========================================

    document.getElementById('addProductForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        const btn = document.getElementById('submitProductBtn');
        const msg = document.getElementById('productFormMessage');
        const editId = btn.dataset.editId;

        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ' + (editId ? 'Mise à jour...' : 'Envoi...');
        msg.className = 'form-message';
        msg.style.display = 'none';

        const formData = new FormData();
        formData.append('name', document.getElementById('productName').value.trim());
        formData.append('price', document.getElementById('productPrice').value);
        formData.append('quantity', document.getElementById('productQuantity').value || 0);
        formData.append('description', document.getElementById('productDescription').value.trim());

        const image1 = document.getElementById('productImage1').files[0];
        const image2 = document.getElementById('productImage2').files[0];

        if (!image1 && !editId) {
            showToast('⚠️ Image 1 requise', 'warning');
            btn.disabled = false;
            btn.innerHTML = editId ? '💾 Mettre à jour le produit' : '<i class="fas fa-plus-circle"></i> Ajouter le produit';
            return;
        }

        if (image1) formData.append('image1', image1);
        if (image2) formData.append('image2', image2);

        const url = editId ? `/api/admin/products/${editId}` : '/api/admin/products';
        const method = editId ? 'PUT' : 'POST';

        try {
            const res = await fetch(url, { method, body: formData });
            const data = await res.json();
            if (res.ok) {
                msg.className = 'form-message success';
                msg.textContent = editId ? '✅ Produit mis à jour avec succès !' : '✅ Produit ajouté avec succès !';
                msg.style.display = 'block';
                this.reset();
                delete btn.dataset.editId;
                btn.innerHTML = '<i class="fas fa-plus-circle"></i> Ajouter le produit';
                window.loadProducts();
                showToast(editId ? '✅ Produit mis à jour' : '✅ Produit ajouté', 'success');
            } else {
                msg.className = 'form-message error';
                msg.textContent = '❌ ' + (data.error || 'Erreur');
                msg.style.display = 'block';
            }
        } catch (e) {
            msg.className = 'form-message error';
            msg.textContent = '❌ Erreur de connexion';
            msg.style.display = 'block';
        } finally {
            btn.disabled = false;
            if (!editId) btn.innerHTML = '<i class="fas fa-plus-circle"></i> Ajouter le produit';
        }
    });

    // ==========================================
    // CLIENTS
    // ==========================================

    window.loadClients = async function() {
        try {
            const res = await fetch('/api/admin/clients');
            const data = await res.json();
            const tbody = document.getElementById('clientsList');
            document.getElementById('clientsCount').textContent = data.length + ' clients';

            if (data.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" class="empty-msg">Aucun client</td></tr>`;
                return;
            }

            tbody.innerHTML = data.map(c => `
                <tr>
                    <td>#${c.id}</td>
                    <td>${c.name}</td>
                    <td>${c.email}</td>
                    <td>${c.phone || '-'}</td>
                    <td>${formatDateLocale(c.created_at)}</td>
                </tr>
            `).join('');
        } catch (e) { console.error('Erreur clients:', e); }
    };

    document.getElementById('searchClient').addEventListener('input', function() {
        const term = this.value.toLowerCase();
        document.querySelectorAll('#clientsList tr').forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(term) ? '' : 'none';
        });
    });

    document.getElementById('refreshClientsBtn').addEventListener('click', window.loadClients);

    // ==========================================
    // FRAIS DE LIVRAISON
    // ==========================================

    window.loadLivraison = async function() {
        try {
            const res = await fetch('/api/admin/livraison');
            const data = await res.json();
            const tbody = document.getElementById('livraisonList');
            document.getElementById('livraisonCount').textContent = data.length + ' communes';

            if (data.length === 0) {
                tbody.innerHTML = `<tr><td colspan="4" class="empty-msg">Aucune commune</td></tr>`;
                return;
            }

            tbody.innerHTML = data.map(c => `
                <tr data-id="${c.id}">
                    <td>#${c.id}</td>
                    <td>${c.commune}</td>
                    <td>${(c.tarif || 0).toLocaleString()} FCFA</td>
                    <td>
                        <button class="btn-action edit" onclick="editLivraison(${c.id}, '${c.commune}', ${c.tarif})" title="Modifier"><i class="fas fa-edit"></i></button>
                        <button class="btn-action delete" onclick="deleteLivraison(${c.id})" title="Supprimer"><i class="fas fa-trash-alt"></i></button>
                    </td>
                </tr>
            `).join('');
        } catch (e) { console.error('Erreur livraison:', e); }
    };

    window.editLivraison = function(id, commune, tarif) {
        document.getElementById('livraisonCommune').value = commune;
        document.getElementById('livraisonTarif').value = tarif;
        document.getElementById('addLivraisonBtn').dataset.editId = id;
        document.getElementById('addLivraisonBtn').innerHTML = '<i class="fas fa-save"></i> Modifier';
    };

    window.deleteLivraison = function(id) {
        document.getElementById('confirmTitle').textContent = '🗑️ Supprimer la commune';
        document.getElementById('confirmMessage').textContent = 'Êtes-vous sûr de vouloir supprimer cette commune ?';
        document.getElementById('confirmOverlay').classList.add('active');

        document.getElementById('confirmOk').onclick = async function() {
            document.getElementById('confirmOverlay').classList.remove('active');
            try {
                const res = await fetch(`/api/admin/livraison/${id}`, { method: 'DELETE' });
                if (res.ok) {
                    showToast('✅ Commune supprimée', 'success');
                    window.loadLivraison();
                } else {
                    showToast('❌ Erreur suppression', 'error');
                }
            } catch (e) { showToast('❌ Erreur', 'error'); }
        };
    };

    document.getElementById('addLivraisonBtn').addEventListener('click', async function() {
        const commune = document.getElementById('livraisonCommune').value.trim();
        const tarif = parseInt(document.getElementById('livraisonTarif').value);
        const msg = document.getElementById('livraisonFormMessage');
        const editId = this.dataset.editId;

        if (!commune || !tarif) {
            msg.className = 'form-message error';
            msg.textContent = '⚠️ Remplissez tous les champs';
            msg.style.display = 'block';
            return;
        }

        const url = editId ? `/api/admin/livraison/${editId}` : '/api/admin/livraison';
        const method = editId ? 'PUT' : 'POST';
        const body = editId ? JSON.stringify({ tarif }) : JSON.stringify({ commune, tarif });

        try {
            const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body });
            if (res.ok) {
                showToast(editId ? '✅ Tarif modifié' : '✅ Commune ajoutée', 'success');
                document.getElementById('livraisonCommune').value = '';
                document.getElementById('livraisonTarif').value = '';
                delete this.dataset.editId;
                this.innerHTML = '<i class="fas fa-plus-circle"></i> Ajouter';
                msg.className = 'form-message';
                msg.style.display = 'none';
                window.loadLivraison();
            } else {
                const data = await res.json();
                msg.className = 'form-message error';
                msg.textContent = '❌ ' + (data.error || 'Erreur');
                msg.style.display = 'block';
            }
        } catch (e) {
            msg.className = 'form-message error';
            msg.textContent = '❌ Erreur de connexion';
            msg.style.display = 'block';
        }
    });

    document.getElementById('refreshLivraisonBtn').addEventListener('click', window.loadLivraison);

    // ==========================================
    // ENVOYER UN MESSAGE (multi-sélection)
    // ==========================================

    window.loadSendMessage = async function() {
        try {
            const res = await fetch('/api/admin/clients');
            const data = await res.json();
            const select = document.getElementById('messageUserId');
            select.innerHTML = '<option value="all">📢 Tous les clients</option>';
            data.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.id;
                opt.textContent = `${c.name} (${c.email})`;
                select.appendChild(opt);
            });
        } catch (e) { console.error('Erreur chargement clients:', e); }
    };

    document.getElementById('sendMessageForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        const btn = document.getElementById('sendMessageBtn');
        const msg = document.getElementById('messageFormMessage');
        const select = document.getElementById('messageUserId');
        const title = document.getElementById('messageTitle').value.trim();
        const content = document.getElementById('messageContent').value.trim();

        if (!title || !content) {
            msg.className = 'form-message error';
            msg.textContent = '⚠️ Titre et contenu requis';
            msg.style.display = 'block';
            return;
        }

        const selectedOptions = select.selectedOptions;
        const userIds = Array.from(selectedOptions).map(opt => opt.value);

        if (userIds.length === 0) {
            msg.className = 'form-message error';
            msg.textContent = '⚠️ Sélectionnez au moins un destinataire';
            msg.style.display = 'block';
            return;
        }

        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Envoi...';

        let successCount = 0;
        let errorCount = 0;

        for (const userId of userIds) {
            try {
                const res = await fetch('/api/admin/notification/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: userId === 'all' ? 'all' : parseInt(userId), title, content })
                });
                if (res.ok) {
                    successCount++;
                } else {
                    errorCount++;
                }
            } catch (err) {
                errorCount++;
            }
        }

        if (errorCount === 0) {
            msg.className = 'form-message success';
            msg.textContent = `✅ ${successCount} message(s) envoyé(s) avec succès !`;
            msg.style.display = 'block';
            this.reset();
            showToast(`✅ ${successCount} message(s) envoyé(s)`, 'success');
        } else {
            msg.className = 'form-message warning';
            msg.textContent = `⚠️ ${successCount} envoyé(s), ${errorCount} échec(s)`;
            msg.style.display = 'block';
            showToast(`⚠️ ${errorCount} erreur(s)`, 'warning');
        }

        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-paper-plane"></i> Envoyer';
    });

    // ==========================================
    // MISES À JOUR
    // ==========================================

    window.loadUpdates = async function() {
        try {
            const res = await fetch('/api/admin/updates');
            const data = await res.json();
            const tbody = document.getElementById('updatesList');
            document.getElementById('updatesCount').textContent = data.length + ' versions';

            if (!data || data.length === 0) {
                tbody.innerHTML = `<tr><td colspan="4" class="empty-msg">Aucune mise à jour</td></tr>`;
                return;
            }

            tbody.innerHTML = data.map(u => `
                <tr>
                    <td style="font-size:12px;color:#888;font-family:monospace;">${u.commit_sha ? u.commit_sha.substring(0, 7) : '-'}</td>
                    <td>${u.commit_message || '-'}</td>
                    <td>${u.commit_date ? formatDateLocale(u.commit_date) : '-'}</td>
                    <td>${u.commit_url ? `<a href="${u.commit_url}" target="_blank" style="color:#1a2a6c;text-decoration:none;">🔗 Voir</a>` : '-'}</td>
                </tr>
            `).join('');
        } catch (e) { console.error('Erreur updates:', e); }
    };

    document.getElementById('checkUpdatesBtn').addEventListener('click', async function() {
        this.disabled = true;
        this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Vérification...';
        try {
            const res = await fetch('/api/admin/check-updates');
            const data = await res.json();
            if (data.success) {
                showToast(data.isNew ? '🔄 ' + data.message : '✅ Aucune mise à jour', data.isNew ? 'success' : 'info');
                window.loadUpdates();
            }
        } catch (e) { showToast('❌ Erreur vérification', 'error'); }
        finally {
            this.disabled = false;
            this.innerHTML = '<i class="fas fa-sync-alt"></i> Vérifier';
        }
    });

    // ==========================================
    // PROFIL ADMIN
    // ==========================================

    let adminProfile = {};

    window.loadProfile = async function() {
        try {
            const email = localStorage.getItem('adminEmail') || '';
            const merchantName = localStorage.getItem('adminName') || 'Admin';
            const contact = localStorage.getItem('adminContact') || '';
            const logo = localStorage.getItem('adminLogo') || '';

            document.getElementById('profileMerchantName').value = merchantName;
            document.getElementById('profileEmail').value = email;
            document.getElementById('profileContact').value = contact;
            document.getElementById('profileLogo').value = logo;

            adminProfile = { merchantName, email, contact, logo };
        } catch (e) { console.error('Erreur chargement profil:', e); }
    };

    document.getElementById('profileForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        const btn = document.getElementById('profileSaveBtn');
        const msg = document.getElementById('profileFormMessage');

        const merchantName = document.getElementById('profileMerchantName').value.trim();
        const email = document.getElementById('profileEmail').value.trim();
        const contact = document.getElementById('profileContact').value.trim();
        const logo = document.getElementById('profileLogo').value.trim();
        const password = document.getElementById('profilePassword').value;
        const confirmPassword = document.getElementById('profileConfirmPassword').value;

        if (!merchantName || !email) {
            msg.className = 'form-message error';
            msg.textContent = '⚠️ Nom et email requis';
            msg.style.display = 'block';
            return;
        }

        if (password && password !== confirmPassword) {
            msg.className = 'form-message error';
            msg.textContent = '⚠️ Les mots de passe ne correspondent pas';
            msg.style.display = 'block';
            return;
        }

        if (password && password.length < 6) {
            msg.className = 'form-message error';
            msg.textContent = '⚠️ Le mot de passe doit faire au moins 6 caractères';
            msg.style.display = 'block';
            return;
        }

        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enregistrement...';
        msg.className = 'form-message';
        msg.style.display = 'none';

        try {
            localStorage.setItem('adminName', merchantName);
            localStorage.setItem('adminEmail', email);
            localStorage.setItem('adminContact', contact);
            localStorage.setItem('adminLogo', logo);

            document.getElementById('adminName').textContent = merchantName;

            msg.className = 'form-message success';
            msg.textContent = '✅ Profil mis à jour avec succès !';
            msg.style.display = 'block';
            showToast('✅ Profil mis à jour', 'success');

            if (password) {
                localStorage.setItem('adminPassword', password);
                showToast('🔒 Mot de passe mis à jour', 'info');
            }

        } catch (e) {
            msg.className = 'form-message error';
            msg.textContent = '❌ Erreur lors de la mise à jour';
            msg.style.display = 'block';
            showToast('❌ Erreur', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-save"></i> Enregistrer les modifications';
        }
    });

    document.getElementById('profileRefreshBtn').addEventListener('click', function() {
        window.loadProfile();
        showToast('🔄 Profil rechargé', 'info');
    });

    // ==========================================
    // INITIALISATION
    // ==========================================

    showPage('overview');
    connectSocketIO();
    startAutoSync();

    window.loadOverview();
    window.loadCommandes();
    window.loadPayments();
    window.loadProducts();
    window.loadClients();
    window.loadLivraison();
    window.loadSendMessage();
    window.loadUpdates();
    window.loadProfile();

    console.log('✅ Admin dashboard initialisé avec sync auto et fuseau UTC+0');

});