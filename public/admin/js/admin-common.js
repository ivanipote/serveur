document.addEventListener('DOMContentLoaded', function() {

    console.log('✅ admin-common.js chargé');

    // ==========================================
    // RÉFÉRENCES BADGES
    // ==========================================

    const badgeCommandes = document.getElementById('headerBadgeCommandes');
    const badgeWave = document.getElementById('headerBadgeWave');
    const badgePayments = document.getElementById('headerBadgePayments');

    // ==========================================
    // VÉRIFICATION CONNEXION
    // ==========================================

    const adminToken = localStorage.getItem('adminToken');
    if (!adminToken) {
        window.location.href = '/admin/login';
        return;
    }

    const adminName = localStorage.getItem('adminName') || 'Admin';
    const nameEl = document.querySelector('.admin-name');
    if (nameEl) nameEl.textContent = adminName;

    // ==========================================
    // METTRE À JOUR LES BADGES
    // ==========================================

    async function updateBadges() {
        try {
            // Commandes en attente
            const res1 = await fetch('/api/admin/commandes');
            const data1 = await res1.json();
            const commandesEnAttente = data1.filter(c => c.status === 'en_attente' || c.status === 'accepter').length;
            if (badgeCommandes) {
                badgeCommandes.textContent = commandesEnAttente > 0 ? commandesEnAttente : '0';
                badgeCommandes.className = 'badge-dot' + (commandesEnAttente === 0 ? ' zero' : '');
            }

            // Demandes Wave en attente
            const res2 = await fetch('https://server-wave-js.onrender.com/api/wave/requests');
            const data2 = await res2.json();
            const waveEnAttente = data2.requests ? data2.requests.filter(r => r.status === 'pending').length : 0;
            if (badgeWave) {
                badgeWave.textContent = waveEnAttente > 0 ? waveEnAttente : '0';
                badgeWave.className = 'badge-dot' + (waveEnAttente === 0 ? ' zero' : '');
            }

            // Paiements en attente
            const res3 = await fetch('/api/admin/payments');
            const data3 = await res3.json();
            const paymentsEnAttente = data3.filter(p => p.status === 'pending' || p.genius_status === 'pending').length;
            if (badgePayments) {
                badgePayments.textContent = paymentsEnAttente > 0 ? paymentsEnAttente : '0';
                badgePayments.className = 'badge-dot' + (paymentsEnAttente === 0 ? ' zero' : '');
            }

        } catch (error) {
            console.error('Erreur badges:', error);
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
                console.log('✅ Socket.IO admin (common) connecté');
                isSocketConnected = true;
            });

            socket.on('disconnect', function() {
                isSocketConnected = false;
                setTimeout(() => {
                    if (!isSocketConnected) connectSocketIO();
                }, 3000);
            });

            socket.on('nouvelle-commande', function(data) {
                console.log('🆕 Nouvelle commande (common):', data);
                updateBadges();
            });

            socket.on('commande-update', function(data) {
                console.log('📦 Mise à jour commande (common):', data);
                updateBadges();
            });

            socket.on('wave-verification-request', function(data) {
                console.log('🔔 Nouvelle demande Wave (common):', data);
                updateBadges();
            });

        } catch (error) {
            console.error('❌ Erreur Socket.IO (common):', error);
            setTimeout(() => connectSocketIO(), 5000);
        }
    }

    // ==========================================
    // ACTIVER L'ONGLET ACTIF
    // ==========================================

    function setActiveBadge(page) {
        document.querySelectorAll('.header-badge').forEach(el => {
            el.classList.remove('active');
        });

        const badgeMap = {
            'comm': document.querySelector('.header-badge[href*="comm"]'),
            'wave': document.querySelector('.header-badge[href*="wave"]'),
            'paiements': document.querySelector('.header-badge[href*="paiements"]')
        };

        if (badgeMap[page]) {
            badgeMap[page].classList.add('active');
        }
    }

    // Détecter la page actuelle via l'URL
    const currentPage = window.location.pathname.split('/').pop().split('.')[0];
    if (['comm', 'wave', 'paiements'].includes(currentPage)) {
        setActiveBadge(currentPage);
    }

    // ==========================================
    // INITIALISATION
    // ==========================================

    // Charger les badges
    updateBadges();

    // Connecter Socket.IO
    connectSocketIO();

    // Mise à jour toutes les 30 secondes
    setInterval(() => {
        updateBadges();
    }, 30000);

    // Exposer pour les autres pages
    window.updateBadges = updateBadges;

    console.log('✅ admin-common.js initialisé');

});