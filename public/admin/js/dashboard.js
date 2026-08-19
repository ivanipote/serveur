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
        // Mettre à jour la sidebar
        navLinks.forEach(link => {
            link.classList.toggle('active', link.dataset.page === pageId);
        });

        // Afficher la bonne section
        pages.forEach(p => p.classList.remove('active'));
        const target = document.getElementById('page-' + pageId);
        if (target) target.classList.add('active');

        // Mettre à jour le titre
        pageTitle.textContent = pageTitles[pageId] || 'Dashboard';

        // Vérifier si la page a sa propre fonction de chargement
        const loadFunction = window['load' + pageId.charAt(0).toUpperCase() + pageId.slice(1).replace(/-/g, '')];
        if (typeof loadFunction === 'function') {
            loadFunction();
        }

        console.log(`📄 Page affichée: ${pageId}`);
    }

    // Événements de clic
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const pageId = this.dataset.page;
            showPage(pageId);
        });
    });

    // ==========================================
    // BOUTON RAFRAÎCHIR (header)
    // ==========================================

    document.getElementById('refreshPageBtn').addEventListener('click', function() {
        const activePage = document.querySelector('.page-section.active');
        if (activePage) {
            const pageId = activePage.id.replace('page-', '');
            const loadFunction = window['load' + pageId.charAt(0).toUpperCase() + pageId.slice(1).replace(/-/g, '')];
            if (typeof loadFunction === 'function') {
                loadFunction();
            } else {
                // Recharger la page si pas de fonction spécifique
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
    // CHARGEMENT DE LA VUE D'ENSEMBLE (OVERVIEW)
    // ==========================================

    async function loadOverview() {
        console.log('📊 Chargement de la vue d\'ensemble...');
        try {
            const res = await fetch('/api/admin/stats');
            const data = await res.json();

            document.getElementById('statProducts').textContent = data.products || 0;
            document.getElementById('statSales').textContent = (data.sales || 0) + ' FCFA';
            document.getElementById('statCommandes').textContent = data.commandes || 0;
            document.getElementById('statClients').textContent = data.clients || 0;

            console.log('✅ Stats chargées:', data);
        } catch (error) {
            console.error('❌ Erreur stats:', error);
            // Afficher une erreur visuelle si nécessaire
        }
    }

    // Exposer la fonction pour la page overview
    window.loadOverview = loadOverview;

    // ==========================================
    // FONCTIONS POUR LES FUTURS ONGLETS
    // ==========================================

    // Ces fonctions seront ajoutées au fur et à mesure
    // Elles sont déclarées vides pour éviter les erreurs
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

    // Charger la page par défaut (overview)
    showPage('overview');

    console.log('✅ Admin dashboard initialisé');
});