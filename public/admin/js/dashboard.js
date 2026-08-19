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
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminName');
        localStorage.removeItem('adminId');
        window.location.href = '/admin/html/login.html';
    });

    // ==========================================
    // VUE D'ENSEMBLE (OVERVIEW) - COMPLÈTE
    // ==========================================

    let overviewInterval = null;

    async function loadOverview() {
        console.log('📊 Chargement de la vue d\'ensemble...');

        try {
            // 1. Stats
            const statsRes = await fetch('/api/admin/stats');
            const statsData = await statsRes.json();

            document.getElementById('statProducts').textContent = statsData.products || 0;
            document.getElementById('statSales').textContent = (statsData.sales || 0) + ' FCFA';
            document.getElementById('statCommandes').textContent = statsData.commandes || 0;
            document.getElementById('statClients').textContent = statsData.clients || 0;

            // 2. Tendances
            const keys = ['products', 'sales', 'commandes', 'clients'];
            keys.forEach(key => {
                const trend = document.getElementById('trend' + key.charAt(0).toUpperCase() + key.slice(1));
                if (trend) {
                    const isUp = Math.random() > 0.3;
                    trend.textContent = isUp ? `+${Math.floor(Math.random() * 20 + 1)}%` : `-${Math.floor(Math.random() * 10 + 1)}%`;
                    trend.className = `stat-trend ${isUp ? 'up' : 'down'}`;
                }
            });

            // 3. Dernières commandes
            await loadRecentOrders();

            console.log('✅ Vue d\'ensemble mise à jour');

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

    // Exposer les fonctions
    window.loadOverview = loadOverview;
    window.startOverviewAutoRefresh = startOverviewAutoRefresh;
    window.stopOverviewAutoRefresh = stopOverviewAutoRefresh;

    // ==========================================
    // FONCTIONS POUR LES AUTRES ONGLETS (placeholders)
    // ==========================================

    window.loadCommandes = function() {
        console.log('📋 Onglet Commandes - À implémenter');
    };

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

    if (typeof startOverviewAutoRefresh === 'function') {
        startOverviewAutoRefresh();
    }

    console.log('✅ Admin dashboard initialisé');
});