// ==========================================
// DASHBOARD.JS - ADMIN
// ==========================================

document.addEventListener('DOMContentLoaded', function() {

    console.log('✅ admin dashboard.js chargé');

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
    // SOCKET.IO - CONNEXION
    // ==========================================

    let socket = null;
    let isSocketConnected = false;
    let statusTimeout = null;

    function connectSocketIO() {
        if (socket) {
            socket.disconnect();
            socket = null;
        }

        console.log('🔌 Connexion Socket.IO admin...');

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
                reconnectionDelay: 500,
                reconnectionDelayMax: 3000,
                randomizationFactor: 0.3,
                upgrade: true,
                rememberUpgrade: true
            });

            socket.on('connect', function() {
                console.log('✅ Socket.IO admin connecté');
                isSocketConnected = true;
                updateConnectionStatus('● Connecté', true);
            });

            socket.on('connect_error', function(error) {
                console.error('❌ Erreur connexion:', error);
                isSocketConnected = false;
                updateConnectionStatus('● Déconnecté', false);
            });

            socket.on('disconnect', function(reason) {
                console.log(`❌ Socket.IO déconnecté: ${reason}`);
                isSocketConnected = false;
                updateConnectionStatus('● Reconnexion...', false);
                setTimeout(() => {
                    if (!isSocketConnected) {
                        connectSocketIO();
                    }
                }, 2000);
            });

            socket.on('nouvelle-commande', function(data) {
                console.log('🆕 Nouvelle commande reçue:', data);
                handleNouvelleCommande(data);
            });

            socket.on('commande-update', function(data) {
                console.log('📦 Mise à jour commande reçue:', data);
                handleCommandeUpdate(data);
            });

        } catch (error) {
            console.error('❌ Erreur connexion Socket.IO:', error);
            setTimeout(() => connectSocketIO(), 3000);
        }
    }

    // ==========================================
    // STATUT CONNEXION
    // ==========================================

    function updateConnectionStatus(text, isConnected) {
        const el = document.getElementById('connectionStatus');
        if (!el) return;
        el.textContent = text;
        el.className = 'header-status' + (isConnected ? '' : ' disconnected');
        clearTimeout(statusTimeout);
    }

    // ==========================================
    // GESTION DES ÉVÉNEMENTS SOCKET
    // ==========================================

    function handleNouvelleCommande(data) {
        // Rafraîchir les stats et les commandes récentes
        loadOverview();

        // Toast
        showToast(`🆕 Nouvelle commande #${data.commandeId} de ${data.nom}`, 'success');

        // Mettre à jour le badge de la sidebar
        updateNavBadge('commandes');
    }

    function handleCommandeUpdate(data) {
        // Rafraîchir les stats et les commandes récentes
        loadOverview();

        // Toast
        const statusLabels = {
            'en_attente': '⏳ En attente',
            'accepter': '💳 Paiement requis',
            'refuse': '❌ Refusée',
            'annulee': '❌ Annulée',
            'paiement_effectue': '💳 Payée',
            'livraison_en_cours': '🚚 En cours',
            'disponible': '📍 Disponible',
            'recuperee': '✅ Récupérée'
        };
        showToast(`📦 Commande #${data.commandeId}: ${statusLabels[data.status] || data.status}`, 'info');
    }

    // ==========================================
    // TOAST
    // ==========================================

    function showToast(message, type = 'info') {
        const colors = {
            'success': '#43a047',
            'error': '#e53935',
            'info': '#1a2a6c',
            'warning': '#e67e22'
        };

        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            bottom: 30px;
            right: 30px;
            background: ${colors[type] || '#1a2a6c'};
            color: white;
            padding: 14px 24px;
            border-radius: 12px;
            font-weight: 600;
            font-size: 14px;
            box-shadow: 0 8px 30px rgba(0,0,0,0.2);
            z-index: 999;
            max-width: 400px;
            animation: slideInRight 0.3s ease;
            transition: opacity 0.3s;
        `;
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    // ==========================================
    // BADGE DE NAVIGATION
    // ==========================================

    function updateNavBadge(page) {
        if (page === 'commandes') {
            const badge = document.getElementById('navBadgeCommandes');
            if (badge) {
                const current = parseInt(badge.textContent) || 0;
                badge.textContent = current + 1;
            }
        }
    }

    function resetNavBadge(page) {
        if (page === 'commandes') {
            const badge = document.getElementById('navBadgeCommandes');
            if (badge) badge.textContent = '0';
        }
    }

    // ==========================================
    // NAVIGATION ENTRE ONGLETS
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
        updates: '🔄 Mises à jour'
    };

    function showPage(pageId) {
        navLinks.forEach(link => {
            link.classList.toggle('active', link.dataset.page === pageId);
        });

        pages.forEach(p => p.classList.remove('active'));
        const target = document.getElementById('page-' + pageId);
        if (target) target.classList.add('active');

        pageTitle.textContent = pageTitles[pageId] || 'Dashboard';

        // Reset badge si on va sur la page commandes
        if (pageId === 'commandes') {
            resetNavBadge('commandes');
        }

        // Charger les données de la page
        const loadFunction = window['load' + pageId.charAt(0).toUpperCase() + pageId.slice(1).replace(/-/g, '')];
        if (typeof loadFunction === 'function') {
            loadFunction();
        }

        console.log(`📄 Page affichée: ${pageId}`);
    }

    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const pageId = this.dataset.page;
            showPage(pageId);
        });
    });

    // ==========================================
    // BOUTON RAFRAÎCHIR
    // ==========================================

    document.getElementById('refreshPageBtn').addEventListener('click', function() {
        const activePage = document.querySelector('.page-section.active');
        if (activePage) {
            const pageId = activePage.id.replace('page-', '');
            const loadFunction = window['load' + pageId.charAt(0).toUpperCase() + pageId.slice(1).replace(/-/g, '')];
            if (typeof loadFunction === 'function') {
                loadFunction();
            } else {
                location.reload();
            }
        }
    });

    // ==========================================
    // DÉCONNEXION
    // ==========================================

    document.getElementById('logoutBtn').addEventListener('click', function() {
        if (socket) {
            socket.disconnect();
        }
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminName');
        localStorage.removeItem('adminId');
        window.location.href = '/admin/login';
    });

    // ==========================================
    // VUE D'ENSEMBLE - LOAD
    // ==========================================

    let overviewInterval = null;

    async function loadOverview() {
        console.log('📊 Chargement de la vue d\'ensemble...');

        try {
            const startTime = Date.now();
            const statsRes = await fetch('/api/admin/stats');
            const statsData = await statsRes.json();

            document.getElementById('statProducts').textContent = statsData.products || 0;
            document.getElementById('statSales').textContent = (statsData.sales || 0).toLocaleString() + ' FCFA';
            document.getElementById('statCommandes').textContent = statsData.commandes || 0;
            document.getElementById('statClients').textContent = statsData.clients || 0;

            // Tendances (simulées)
            const keys = ['products', 'sales', 'commandes', 'clients'];
            keys.forEach(key => {
                const trend = document.getElementById('trend' + key.charAt(0).toUpperCase() + key.slice(1));
                if (trend) {
                    const isUp = Math.random() > 0.3;
                    trend.textContent = isUp ? `+${Math.floor(Math.random() * 20 + 1)}%` : `-${Math.floor(Math.random() * 10 + 1)}%`;
                    trend.className = `stat-trend ${isUp ? 'up' : 'down'}`;
                }
            });

            await loadRecentOrders();

            const duration = Date.now() - startTime;
            console.log(`✅ Vue d'ensemble mise à jour en ${duration}ms`);

        } catch (error) {
            console.error('❌ Erreur vue d\'ensemble:', error);
        }
    }

    async function loadRecentOrders() {
        try {
            const res = await fetch('/api/admin/commandes');
            const data = await res.json();

            const tbody = document.getElementById('recentOrdersList');
            const count = document.getElementById('recentOrdersCount');

            if (data && data.length > 0) {
                const recent = data.slice(0, 5);
                if (count) count.textContent = recent.length;

                const statusLabels = {
                    'en_attente': '⏳ En attente',
                    'accepter': '💳 Paiement requis',
                    'refuse': '❌ Refusée',
                    'annulee': '❌ Annulée',
                    'paiement_effectue': '💳 Payée',
                    'livraison_en_cours': '🚚 En cours',
                    'disponible': '📍 Disponible',
                    'recuperee': '✅ Récupérée'
                };

                tbody.innerHTML = recent.map(c => `
                    <tr>
                        <td>#${c.id}</td>
                        <td>${c.nom}</td>
                        <td>${(c.total || 0).toLocaleString()} FCFA</td>
                        <td><span class="status-badge ${c.status}">${statusLabels[c.status] || c.status}</span></td>
                        <td>${new Date(c.created_at).toLocaleDateString('fr-FR')}</td>
                    </tr>
                `).join('');
            } else {
                tbody.innerHTML = `<tr><td colspan="5" class="empty-msg">Aucune commande récente</td></tr>`;
                if (count) count.textContent = '0';
            }
        } catch (error) {
            console.error('❌ Erreur commandes récentes:', error);
            const tbody = document.getElementById('recentOrdersList');
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="5" class="empty-msg">Erreur de chargement</td></tr>`;
            }
        }
    }

    function startOverviewAutoRefresh() {
        if (overviewInterval) clearInterval(overviewInterval);
        overviewInterval = setInterval(() => {
            const overviewSection = document.getElementById('page-overview');
            if (overviewSection && overviewSection.classList.contains('active')) {
                loadOverview();
            }
        }, 30000);
    }

    function stopOverviewAutoRefresh() {
        if (overviewInterval) {
            clearInterval(overviewInterval);
            overviewInterval = null;
        }
    }

    window.loadOverview = loadOverview;
    window.startOverviewAutoRefresh = startOverviewAutoRefresh;
    window.stopOverviewAutoRefresh = stopOverviewAutoRefresh;

    // ==========================================
    // AUTRES ONGLETS (placeholders)
    // ==========================================

    window.loadPayments = function() {
        console.log('💳 Onglet Paiements - À implémenter');
    };

    window.loadProducts = function() {
        console.log('📦 Onglet Produits - À implémenter');
    };

    window.loadAddProduct = function() {
        console.log('➕ Onglet Ajouter produit - À implémenter');
    };

    window.loadClients = function() {
        console.log('👤 Onglet Clients - À implémenter');
    };

    window.loadLivraison = function() {
        console.log('📍 Onglet Livraison - À implémenter');
    };

    window.loadSendMessage = function() {
        console.log('📨 Onglet Envoyer message - À implémenter');
    };

    window.loadUpdates = function() {
        console.log('🔄 Onglet Mises à jour - À implémenter');
    };

    // ==========================================
    // INITIALISATION
    // ==========================================

    showPage('overview');
    startOverviewAutoRefresh();
    connectSocketIO();

    console.log('✅ Admin dashboard initialisé');

});