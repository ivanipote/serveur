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
        // ✅ 1. Commandes → TOUTES SAUF "recuperee"
        try {
            const res1 = await fetch('/api/admin/commandes');
            if (res1.ok) {
                const data1 = await res1.json();
                // ✅ Exclure les commandes avec statut "recuperee" (dernier statut)
                const totalCommandes = data1.filter(c => c.status !== 'recuperee').length;
                if (badgeCommandes) {
                    badgeCommandes.textContent = totalCommandes > 0 ? totalCommandes : '0';
                    badgeCommandes.className = 'badge-dot' + (totalCommandes === 0 ? ' zero' : '');
                }
            } else {
                if (badgeCommandes) {
                    badgeCommandes.textContent = '0';
                    badgeCommandes.className = 'badge-dot zero';
                }
            }
        } catch (error) {
            console.error('❌ Erreur commandes:', error);
            if (badgeCommandes) {
                badgeCommandes.textContent = '0';
                badgeCommandes.className = 'badge-dot zero';
            }
        }

        // ✅ 2. Paiements → TOUS SAUF "success" et "refunded" (terminés)
        try {
            const res3 = await fetch('/api/admin/payments');
            if (res3.ok) {
                const data3 = await res3.json();
                // ✅ Exclure les paiements terminés (success, refunded)
                const totalPayments = data3.filter(p => 
                    p.status !== 'success' && p.status !== 'refunded' &&
                    p.genius_status !== 'success' && p.genius_status !== 'refunded'
                ).length;
                if (badgePayments) {
                    badgePayments.textContent = totalPayments > 0 ? totalPayments : '0';
                    badgePayments.className = 'badge-dot' + (totalPayments === 0 ? ' zero' : '');
                }
            } else {
                if (badgePayments) {
                    badgePayments.textContent = '0';
                    badgePayments.className = 'badge-dot zero';
                }
            }
        } catch (error) {
            console.error('❌ Erreur paiements:', error);
            if (badgePayments) {
                badgePayments.textContent = '0';
                badgePayments.className = 'badge-dot zero';
            }
        }

        // ✅ 3. Wave → SEULEMENT en attente (pending)
        try {
            const res2 = await fetch('https://server-wave-js.onrender.com/api/wave/requests');
            if (res2.ok) {
                const data2 = await res2.json();
                const waveEnAttente = data2.requests ? data2.requests.filter(r => r.status === 'pending').length : 0;
                if (badgeWave) {
                    badgeWave.textContent = waveEnAttente > 0 ? waveEnAttente : '0';
                    badgeWave.className = 'badge-dot' + (waveEnAttente === 0 ? ' zero' : '');
                }
            } else {
                if (badgeWave) {
                    badgeWave.textContent = '0';
                    badgeWave.className = 'badge-dot zero';
                }
            }
        } catch (error) {
            // ✅ Erreur Wave → badge à 0 (silencieux)
            if (badgeWave) {
                badgeWave.textContent = '0';
                badgeWave.className = 'badge-dot zero';
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