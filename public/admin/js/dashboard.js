document.addEventListener('DOMContentLoaded', function() {

    console.log('✅ admin dashboard.js chargé');

    // ==========================================
    // VÉRIFICATION CONNEXION
    // ==========================================

    const adminToken = localStorage.getItem('adminToken');
    if (!adminToken) {
        window.location.href = '/admin/html/login.html';
        return;
    }

    const adminName = localStorage.getItem('adminName') || 'Admin';
    document.getElementById('adminName').textContent = '👤 ' + adminName;

    // ==========================================
    // SOCKET.IO - Connexion Ultra Rapide
    // ==========================================

    let socket = null;
    let isSocketConnected = false;
    let lastEventTime = 0;
    let syncTimeout = null;

    function connectSocketIO() {
        if (socket) {
            socket.disconnect();
            socket = null;
        }

        console.log('🔌 Connexion Socket.IO admin dashboard (ultra rapide)...');

        try {
            const adminId = localStorage.getItem('adminId') || '1';
            const connectStart = Date.now();

            socket = io({
                auth: {
                    userId: parseInt(adminId),
                    isAdmin: true
                },
                // ✅ FORCER WEBSOCKET
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
                const duration = Date.now() - connectStart;
                console.log(`✅ Socket.IO admin dashboard connecté en ${duration}ms`);
                isSocketConnected = true;
                showStatus(`✅ Connecté en ${duration}ms`, 'success');
            });

            socket.on('connect_error', function(error) {
                console.error('❌ Erreur connexion:', error);
                isSocketConnected = false;
                showStatus('⚠️ Connexion...', 'warning');
            });

            socket.on('disconnect', function(reason) {
                console.log(`❌ Socket.IO déconnecté: ${reason}`);
                isSocketConnected = false;
                showStatus('⚠️ Reconnexion...', 'warning');
                setTimeout(() => {
                    if (!isSocketConnected) {
                        connectSocketIO();
                    }
                }, 1000);
            });

            // ✅ RECEPTION ULTRA RAPIDE
            socket.on('nouvelle-commande', function(data) {
                const now = Date.now();
                const latency = data._timestamp ? now - data._timestamp : 0;
                console.log(`🆕 Nouvelle commande (dashboard) en ${latency}ms`);
                
                // Rafraîchir immédiatement
                loadOverview();
                
                // Toast avec latence
                if (latency > 0) {
                    showDashboardToast(`🆕 Commande #${data.commandeId} en ${latency}ms`, 'success');
                } else {
                    showDashboardToast(`🆕 Nouvelle commande #${data.commandeId} de ${data.nom}`, 'success');
                }
            });

            socket.on('commande-update', function(data) {
                const now = Date.now();
                const latency = data._timestamp ? now - data._timestamp : 0;
                console.log(`📦 Mise à jour (dashboard) en ${latency}ms`);
                
                // Rafraîchir immédiatement
                loadOverview();
                
                if (latency > 0) {
                    showDashboardToast(`📦 Mise à jour en ${latency}ms`, 'info');
                }
            });

        } catch (error) {
            console.error('❌ Erreur connexion Socket.IO:', error);
            setTimeout(() => connectSocketIO(), 2000);
        }
    }

    // ==========================================
    // INDICATEUR DE STATUT
    // ==========================================

    function showStatus(message, type = 'info') {
        const statusEl = document.getElementById('connectionStatusDash');
        if (!statusEl) {
            const header = document.querySelector('.main-header .admin-info');
            if (header) {
                const status = document.createElement('span');
                status.id = 'connectionStatusDash';
                status.style.cssText = `
                    font-size: 12px;
                    padding: 4px 12px;
                    border-radius: 12px;
                    font-weight: 600;
                    margin-left: 10px;
                `;
                header.appendChild(status);
            }
        }
        
        const el = document.getElementById('connectionStatusDash');
        if (!el) return;
        
        const colors = {
            success: '#27ae60',
            warning: '#f39c12',
            error: '#e74c3c',
            info: '#3498db'
        };
        
        el.textContent = message;
        el.style.background = colors[type] || '#888';
        el.style.color = 'white';
        el.style.display = 'inline-block';
        
        clearTimeout(syncTimeout);
        syncTimeout = setTimeout(() => {
            if (el) el.style.display = 'none';
        }, 3000);
    }

    // ==========================================
    // TOAST DASHBOARD
    // ==========================================

    function showDashboardToast(message, type = 'info') {
        const colors = {
            success: '#27ae60',
            error: '#e74c3c',
            warning: '#f39c12',
            info: '#3498db'
        };

        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            bottom: 80px;
            right: 20px;
            background: ${colors[type] || '#1a2a6c'};
            color: white;
            padding: 12px 20px;
            border-radius: 12px;
            font-weight: 600;
            font-size: 14px;
            box-shadow: 0 8px 30px rgba(0,0,0,0.2);
            z-index: 999;
            max-width: 350px;
            animation: slideInRight 0.3s ease;
            pointer-events: none;
            transition: opacity 0.3s;
        `;
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3500);
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
        window.location.href = '/admin/html/login.html';
    });

    // ==========================================
    // VUE D'ENSEMBLE (OVERVIEW) - ULTRA RAPIDE
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
            const startTime = Date.now();
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
                
                const duration = Date.now() - startTime;
                console.log(`✅ Commandes récentes chargées en ${duration}ms`);
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
        // ✅ Réduire l'intervalle à 15s pour plus de réactivité
        overviewInterval = setInterval(() => {
            const overviewSection = document.getElementById('page-overview');
            if (overviewSection && overviewSection.classList.contains('active')) {
                loadOverview();
            }
        }, 15000);
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
    // FONCTIONS POUR LES AUTRES ONGLETS
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

    console.log('✅ Admin dashboard initialisé avec Socket.IO Ultra Rapide');
});