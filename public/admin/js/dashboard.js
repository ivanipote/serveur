document.addEventListener('DOMContentLoaded', function() {

    console.log('✅ Dashboard admin chargé');

    // ==========================================
    // RÉFÉRENCES
    // ==========================================

    const navLinks = document.querySelectorAll('.sidebar-nav a');
    const pages = document.querySelectorAll('.page-section');
    const pageTitle = document.getElementById('pageTitle');

    const statProducts = document.getElementById('statProducts');
    const statSales = document.getElementById('statSales');
    const statCommandes = document.getElementById('statCommandes');
    const statClients = document.getElementById('statClients');

    const recentOrdersList = document.getElementById('recentOrdersList');
    const recentWaveList = document.getElementById('recentWaveList');

    const switchCommandes = document.getElementById('switchCommandes');
    const switchWave = document.getElementById('switchWave');

    const badgeCommandes = document.getElementById('navBadgeCommandes');
    const badgeWave = document.getElementById('navBadgeWave');
    const badgePayments = document.getElementById('navBadgePayments');

    const confirmOverlay = document.getElementById('confirmOverlay');
    const confirmOk = document.getElementById('confirmOk');
    const confirmCancel = document.getElementById('confirmCancel');

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
    // NAVIGATION
    // ==========================================

    const pageTitles = {
        overview: '📊 Vue d\'ensemble',
        commandes: '📋 Commandes',
        wave: '🌊 Demandes Wave',
        payments: '💳 Paiements',
        products: '📦 Produits',
        'add-product': '➕ Ajouter un produit',
        clients: '👤 Clients',
        livraison: '📍 Frais de livraison',
        'send-message': '📨 Envoyer un message',
        updates: '🔄 Mises à jour',
        profile: '👤 Mon profil'
    };

    const pageUrls = {
        commandes: '/admin/comm.html',
        wave: '/admin/wave.html',
        payments: '/admin/paiements.html',
        products: '/admin/produits.html',
        'add-product': '/admin/add-produit.html',
        clients: '/admin/clients.html',
        livraison: '/admin/livraison.html',
        'send-message': '/admin/message.html',
        updates: '/admin/updates.html',
        profile: '/admin/profil.html'
    };

    function showPage(pageId) {
        // Si c'est un onglet avec redirection
        if (pageUrls[pageId]) {
            window.location.href = pageUrls[pageId];
            return;
        }

        // Vue d'ensemble (reste dans le dashboard)
        navLinks.forEach(link => link.classList.toggle('active', link.dataset.page === pageId));
        pages.forEach(p => p.classList.remove('active'));
        const target = document.getElementById('page-' + pageId);
        if (target) target.classList.add('active');
        pageTitle.textContent = pageTitles[pageId] || 'Dashboard';
    }

    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const page = this.dataset.page;
            showPage(page);
        });
    });

    // Rafraîchir
    document.getElementById('refreshPageBtn').addEventListener('click', function() {
        const active = document.querySelector('.page-section.active');
        if (active) {
            const pageId = active.id.replace('page-', '');
            if (pageId === 'overview') {
                loadOverview();
            } else {
                showPage(pageId);
            }
        }
    });

    // ==========================================
    // DÉCONNEXION
    // ==========================================

    document.getElementById('logoutBtn').addEventListener('click', function() {
        if (socket) socket.disconnect();
        localStorage.clear();
        window.location.href = '/admin/login';
    });

    // ==========================================
    // SWITCH COMMANDES / WAVE
    // ==========================================

    let currentView = 'commandes';

    function switchView(view) {
        currentView = view;
        document.getElementById('activitiesCommandes').style.display = view === 'commandes' ? '' : 'none';
        document.getElementById('activitiesWave').style.display = view === 'wave' ? '' : 'none';

        switchCommandes.classList.toggle('active', view === 'commandes');
        switchWave.classList.toggle('active', view === 'wave');

        if (view === 'commandes') {
            loadRecentOrders();
        } else {
            loadRecentWave();
        }
    }

    switchCommandes.addEventListener('click', function() {
        if (currentView !== 'commandes') switchView('commandes');
    });

    switchWave.addEventListener('click', function() {
        if (currentView !== 'wave') switchView('wave');
    });

    // ==========================================
    // CHARGER VUE D'ENSEMBLE
    // ==========================================

    async function loadOverview() {
        try {
            // Stats
            const res = await fetch('/api/admin/stats');
            const data = await res.json();

            statProducts.textContent = data.products || 0;
            statSales.textContent = (data.sales || 0).toLocaleString() + ' FCFA';
            statCommandes.textContent = data.commandes || 0;
            statClients.textContent = data.clients || 0;

            // Tendances (démo)
            ['products', 'sales', 'commandes', 'clients'].forEach(key => {
                const trend = document.getElementById('trend' + key.charAt(0).toUpperCase() + key.slice(1));
                if (trend) {
                    const up = Math.random() > 0.3;
                    trend.textContent = up ? `+${Math.floor(Math.random() * 20 + 1)}%` : `-${Math.floor(Math.random() * 10 + 1)}%`;
                    trend.className = `stat-trend ${up ? 'up' : 'down'}`;
                }
            });

            // Badges
            await updateBadges();

            // Recent selon la vue active
            if (currentView === 'commandes') {
                loadRecentOrders();
            } else {
                loadRecentWave();
            }

        } catch (error) {
            console.error('Erreur overview:', error);
        }
    }

    // ==========================================
    // CHARGER DERNIÈRES COMMANDES
    // ==========================================

    async function loadRecentOrders() {
        try {
            const res = await fetch('/api/admin/commandes');
            const data = await res.json();

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

            const recent = data.slice(0, 5);

            if (recent.length === 0) {
                recentOrdersList.innerHTML = `<tr><td colspan="5" class="empty-msg">Aucune commande récente</td></tr>`;
                return;
            }

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

        } catch (error) {
            console.error('Erreur commandes récentes:', error);
            recentOrdersList.innerHTML = `<tr><td colspan="5" class="empty-msg">Erreur de chargement</td></tr>`;
        }
    }

    // ==========================================
    // CHARGER DERNIÈRES DEMANDES WAVE
    // ==========================================

    async function loadRecentWave() {
        try {
            const res = await fetch('https://server-wave-js.onrender.com/api/wave/requests');
            const data = await res.json();

            const labels = {
                'pending': '⏳ En attente',
                'success': '✅ Succès',
                'refused': '❌ Refusée'
            };

            const recent = data.requests ? data.requests.slice(0, 5) : [];

            if (recent.length === 0) {
                recentWaveList.innerHTML = `<tr><td colspan="6" class="empty-msg">Aucune demande Wave récente</td></tr>`;
                return;
            }

            const dateOptions = { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' };

            recentWaveList.innerHTML = recent.map(r => `
                <tr>
                    <td>#${r.id}</td>
                    <td>#${r.commande_id}</td>
                    <td>${r.client_name || r.user_name || 'Client inconnu'}</td>
                    <td>${(r.total || r.montant || 0).toLocaleString()} FCFA</td>
                    <td><span class="status-badge ${r.status}">${labels[r.status] || r.status}</span></td>
                    <td>${new Date(r.created_at).toLocaleDateString('fr-FR', dateOptions)}</td>
                </tr>
            `).join('');

        } catch (error) {
            console.error('Erreur demandes Wave récentes:', error);
            recentWaveList.innerHTML = `<tr><td colspan="6" class="empty-msg">Erreur de chargement</td></tr>`;
        }
    }

    // ==========================================
    // METTRE À JOUR LES BADGES (INDÉPENDANTS)
    // ==========================================

    async function updateBadges() {
        // ✅ 1. Commandes en attente
        try {
            const res1 = await fetch('/api/admin/commandes');
            if (res1.ok) {
                const data1 = await res1.json();
                const commandesEnAttente = data1.filter(c => c.status === 'en_attente' || c.status === 'accepter').length;
                if (badgeCommandes) {
                    badgeCommandes.textContent = commandesEnAttente > 0 ? commandesEnAttente : '0';
                    badgeCommandes.className = 'badge-nav badge-red' + (commandesEnAttente === 0 ? ' zero' : '');
                }
            } else {
                console.warn('⚠️ Erreur commandes:', res1.status);
                if (badgeCommandes) {
                    badgeCommandes.textContent = '0';
                    badgeCommandes.className = 'badge-nav badge-red zero';
                }
            }
        } catch (error) {
            console.error('❌ Erreur commandes:', error);
            if (badgeCommandes) {
                badgeCommandes.textContent = '0';
                badgeCommandes.className = 'badge-nav badge-red zero';
            }
        }

        // ✅ 2. Paiements en attente
        try {
            const res3 = await fetch('/api/admin/payments');
            if (res3.ok) {
                const data3 = await res3.json();
                const paymentsEnAttente = data3.filter(p => p.status === 'pending' || p.genius_status === 'pending').length;
                if (badgePayments) {
                    badgePayments.textContent = paymentsEnAttente > 0 ? paymentsEnAttente : '0';
                    badgePayments.className = 'badge-nav badge-red' + (paymentsEnAttente === 0 ? ' zero' : '');
                }
            } else {
                console.warn('⚠️ Erreur paiements:', res3.status);
                if (badgePayments) {
                    badgePayments.textContent = '0';
                    badgePayments.className = 'badge-nav badge-red zero';
                }
            }
        } catch (error) {
            console.error('❌ Erreur paiements:', error);
            if (badgePayments) {
                badgePayments.textContent = '0';
                badgePayments.className = 'badge-nav badge-red zero';
            }
        }

        // ✅ 3. Wave en attente (indépendant - ne bloque pas les autres)
        try {
            const res2 = await fetch('https://server-wave-js.onrender.com/api/wave/requests');
            if (res2.ok) {
                const data2 = await res2.json();
                const waveEnAttente = data2.requests ? data2.requests.filter(r => r.status === 'pending').length : 0;
                if (badgeWave) {
                    badgeWave.textContent = waveEnAttente > 0 ? waveEnAttente : '0';
                    badgeWave.className = 'badge-nav badge-red' + (waveEnAttente === 0 ? ' zero' : '');
                }
            } else {
                // ✅ Si Wave ne répond pas → badge à 0 (silencieux)
                if (badgeWave) {
                    badgeWave.textContent = '0';
                    badgeWave.className = 'badge-nav badge-red zero';
                }
            }
        } catch (error) {
            // ✅ Erreur Wave → badge à 0 (silencieux)
            if (badgeWave) {
                badgeWave.textContent = '0';
                badgeWave.className = 'badge-nav badge-red zero';
            }
        }
    }

    // ==========================================
    // SOCKET.IO - MISE À JOUR EN TEMPS RÉEL
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
                updateBadges();
            });

            socket.on('commande-update', function(data) {
                console.log('📦 Mise à jour commande:', data);
                loadOverview();
                updateBadges();
            });

            socket.on('wave-verification-request', function(data) {
                console.log('🔔 Nouvelle demande Wave:', data);
                loadOverview();
                updateBadges();
            });

        } catch (error) {
            console.error('❌ Erreur Socket.IO:', error);
            setTimeout(() => connectSocketIO(), 3000);
        }
    }

    function updateConnectionStatus(text, connected) {
        const el = document.getElementById('connectionStatus');
        if (el) {
            el.textContent = text;
            el.className = 'header-status' + (connected ? '' : ' disconnected');
        }
    }

    // ==========================================
    // CONFIRMATION OVERLAY
    // ==========================================

    let pendingConfirmAction = null;

    function showConfirm(title, message, action) {
        document.getElementById('confirmTitle').textContent = title;
        document.getElementById('confirmMessage').textContent = message;
        pendingConfirmAction = action;
        confirmOverlay.classList.add('active');
    }

    function hideConfirm() {
        confirmOverlay.classList.remove('active');
        pendingConfirmAction = null;
    }

    confirmCancel.addEventListener('click', hideConfirm);
    confirmOverlay.addEventListener('click', function(e) {
        if (e.target === confirmOverlay) hideConfirm();
    });

    confirmOk.addEventListener('click', function() {
        if (pendingConfirmAction) {
            pendingConfirmAction();
        }
        hideConfirm();
    });

    // ==========================================
    // INITIALISATION
    // ==========================================

    // Exposer globalement pour les autres pages
    window.showConfirm = showConfirm;
    window.hideConfirm = hideConfirm;
    window.updateBadges = updateBadges;

    // Charger la vue d'ensemble
    loadOverview();

    // Connecter Socket.IO
    connectSocketIO();

    // Mise à jour des badges toutes les 30 secondes
    setInterval(() => {
        updateBadges();
    }, 30000);

    console.log('✅ Dashboard admin initialisé');

});