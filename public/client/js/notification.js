document.addEventListener('DOMContentLoaded', function() {

    console.log('✅ notification.js chargé');

    const mainContent = document.getElementById('notifList');
    const skeletonLoader = document.getElementById('skeletonLoader');
    const notifBadge = document.getElementById('notifBadge');
    const readAllBtn = document.getElementById('readAllBtn');
    const filterButtons = document.querySelectorAll('.filter-btn');
    const syncBtn = document.getElementById('syncBtn');
    const syncStatus = document.getElementById('syncStatus');

    const confirmOverlay = document.getElementById('confirmOverlay');
    const confirmOk = document.getElementById('confirmOk');
    const confirmCancel = document.getElementById('confirmCancel');

    let notifications = [];
    let userId = null;
    let currentFilter = 'all';
    let deleteTargetId = null;
    let syncInterval = null;
    let isSyncing = false;
    let isSyncActive = true;
    let isFirstLoad = true;
    let hasNewNotification = false;

    // ==========================================
    // TOAST
    // ==========================================

    function showToast(message, type = 'success') {
        const colors = {
            success: '#28a745',
            error: '#dc3545',
            warning: '#e67e22',
            info: '#1a2a6c'
        };
        
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            bottom: 80px;
            left: 50%;
            transform: translateX(-50%);
            background: ${colors[type] || '#28a745'};
            color: white;
            padding: 12px 24px;
            border-radius: 12px;
            font-weight: 600;
            font-size: 15px;
            box-shadow: 0 8px 30px rgba(0,0,0,0.2);
            z-index: 999;
            text-align: center;
            max-width: 90%;
            animation: slideUp 0.3s ease;
        `;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-20px)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // ==========================================
    // BOUTON SYNC - GESTION
    // ==========================================

    function updateSyncUI() {
        if (isSyncActive) {
            syncBtn.classList.add('active');
            syncBtn.classList.remove('paused');
            syncStatus.textContent = '●';
            syncStatus.className = 'sync-status active';
            syncBtn.title = 'Synchronisation active - Cliquer pour mettre en pause';
            startSync();
        } else {
            syncBtn.classList.remove('active');
            syncBtn.classList.add('paused');
            syncStatus.textContent = '○';
            syncStatus.className = 'sync-status paused';
            syncBtn.title = 'Synchronisation en pause - Cliquer pour reprendre';
            stopSync();
        }
    }

    if (syncBtn) {
        syncBtn.addEventListener('click', function() {
            isSyncActive = !isSyncActive;
            updateSyncUI();
        });
    }

    // ==========================================
    // SYNC EN PERMANENCE
    // ==========================================

    function startSync() {
        if (syncInterval) {
            clearInterval(syncInterval);
        }

        console.log('🔄 Sync notifications démarré (toutes les 5s)');

        loadNotifications();

        syncInterval = setInterval(() => {
            if (!isSyncing && isSyncActive) {
                loadNotifications();
            }
        }, 5000);
    }

    function stopSync() {
        if (syncInterval) {
            clearInterval(syncInterval);
            syncInterval = null;
            console.log('⏹️ Sync notifications arrêté');
        }
    }

    // ==========================================
    // SOCKET.IO - Connexion
    // ==========================================

    let socket = null;
    let isSocketConnected = false;

    function connectSocketIO() {
        if (socket) {
            socket.disconnect();
            socket = null;
        }

        console.log('🔌 Connexion Socket.IO client (notification)...');

        try {
            const userIdLocal = localStorage.getItem('userId') || '1';

            socket = io({
                auth: {
                    userId: parseInt(userIdLocal),
                    isAdmin: false
                }
            });

            socket.on('connect', function() {
                console.log('✅ Socket.IO client notification connecté');
                isSocketConnected = true;
            });

            socket.on('disconnect', function() {
                console.log('❌ Socket.IO client notification déconnecté');
                isSocketConnected = false;
                setTimeout(() => {
                    if (!isSocketConnected) {
                        connectSocketIO();
                    }
                }, 3000);
            });

            // ✅ ÉCOUTER LES NOTIFICATIONS EN TEMPS RÉEL
            socket.on('notification', function(data) {
                console.log('🔔 Notification reçue (client):', data);
                
                // 1. Afficher le toast
                showToast(data.title || 'Nouvelle notification', 'info');
                
                // 2. Marquer qu'on a une nouvelle notification
                hasNewNotification = true;
                
                // 3. Recharger avec skeleton
                loadNotifications(true);
                
                // 4. Mettre à jour le badge
                updateBadge();
            });

        } catch (error) {
            console.error('❌ Erreur connexion Socket.IO:', error);
            setTimeout(() => connectSocketIO(), 5000);
        }
    }

    // ==========================================
    // VÉRIFICATION CONNEXION
    // ==========================================

    async function checkAuth() {
        try {
            const res = await fetch('/api/client/me');
            const data = await res.json();
            if (data.success) {
                userId = data.user.id;
                localStorage.setItem('userId', data.user.id);
                console.log('👤 Utilisateur connecté:', data.user);
                return true;
            } else {
                window.location.href = '/login';
                return false;
            }
        } catch (error) {
            console.error('❌ Erreur vérification auth:', error);
            window.location.href = '/login';
            return false;
        }
    }

    // ==========================================
    // DATE RELATIVE
    // ==========================================

    function timeAgo(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        const diffHour = Math.floor(diffMin / 60);
        const diffDay = Math.floor(diffHour / 24);

        if (diffSec < 60) return 'À l\'instant';
        if (diffMin < 60) return `Il y a ${diffMin} min`;
        if (diffHour < 24) {
            const heures = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            return `Aujourd'hui ${heures}:${minutes}`;
        }
        if (diffDay < 7) {
            const jours = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
            const heures = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            return `${jours[date.getDay()]} ${heures}:${minutes}`;
        }
        return date.toLocaleDateString('fr-FR') + ' ' + date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    }

    // ==========================================
    // AVATAR PAR TYPE
    // ==========================================

    function getAvatarIcon(type) {
        const icons = {
            'commande': '📦',
            'paiement': '💳',
            'admin': '📢',
            'systeme': '⚙️'
        };
        return icons[type] || '🌿';
    }

    function getAvatarClass(type) {
        const classes = {
            'commande': 'commande',
            'paiement': 'paiement',
            'admin': 'admin',
            'systeme': 'systeme'
        };
        return classes[type] || 'systeme';
    }

    function getBadgeClass(type) {
        const classes = {
            'commande': 'commande',
            'paiement': 'paiement',
            'admin': 'admin',
            'systeme': 'systeme'
        };
        return classes[type] || 'systeme';
    }

    function getContentClass(type) {
        const classes = {
            'commande': 'commande',
            'paiement': 'paiement',
            'admin': 'admin',
            'systeme': 'systeme'
        };
        return classes[type] || 'systeme';
    }

    function getTypeLabel(type) {
        const labels = {
            'commande': '📦 Commande',
            'paiement': '💳 Paiement',
            'admin': '📢 Admin',
            'systeme': '⚙️ Système'
        };
        return labels[type] || type;
    }

    // ==========================================
    // CHARGER LES NOTIFICATIONS (AVEC SKELETON OPTIONNEL)
    // ==========================================

    async function loadNotifications(showSkeleton = false) {
        if (isSyncing) return;
        isSyncing = true;

        try {
            if (isFirstLoad || showSkeleton || hasNewNotification) {
                if (skeletonLoader) skeletonLoader.style.display = 'flex';
                if (mainContent) mainContent.innerHTML = '';
                hasNewNotification = false;
            }

            const res = await fetch('/api/notifications');
            const data = await res.json();

            if (res.ok && data.notifications) {
                notifications = data.notifications;
                notifBadge.textContent = data.count || 0;
                notifBadge.className = 'badge-count' + (data.count === 0 ? ' zero' : '');
                isFirstLoad = false;
                renderNotifications();
            } else {
                notifications = [];
                notifBadge.textContent = '0';
                notifBadge.className = 'badge-count zero';
                isFirstLoad = false;
                renderEmpty();
            }
        } catch (error) {
            console.error('❌ Erreur:', error);
            isFirstLoad = false;
            renderEmpty();
        } finally {
            if (skeletonLoader) skeletonLoader.style.display = 'none';
            isSyncing = false;
        }
    }

    // ==========================================
    // RENDRE LES NOTIFICATIONS
    // ==========================================

    function renderNotifications() {
        if (!mainContent) return;

        if (!notifications || notifications.length === 0) {
            renderEmpty('Aucune notification');
            return;
        }

        let filtered = notifications;

        if (currentFilter !== 'all') {
            filtered = filtered.filter(n => n.type === currentFilter);
        }

        if (filtered.length === 0) {
            renderEmpty('Aucune notification pour ce filtre');
            return;
        }

        let html = '';

        filtered.forEach(n => {
            const isUnread = n.is_read === 0 || n.is_read === false;
            const typeClass = n.type || 'systeme';
            const typeLabel = getTypeLabel(n.type);
            const dateStr = timeAgo(n.created_at);
            const avatarIcon = getAvatarIcon(n.type);
            const avatarClass = getAvatarClass(n.type);
            const badgeClass = getBadgeClass(n.type);
            const contentClass = getContentClass(n.type);

            html += `
                <div class="notif-card ${isUnread ? 'unread' : 'read'}" data-id="${n.id}">
                    <div class="avatar ${avatarClass}">${avatarIcon}</div>
                    <div class="body">
                        <div class="title">${n.title || 'Notification'}</div>
                        <div class="content ${contentClass}">${n.content || 'Aucun contenu'}</div>
                        <div class="date">${dateStr}</div>
                        <span class="badge-type ${badgeClass}">${typeLabel}</span>
                    </div>
                    <div class="header-actions">
                        ${isUnread ? `
                            <button class="btn btn-read" data-id="${n.id}" title="Marquer comme lu">
                                <i class="fas fa-check"></i>
                            </button>
                        ` : `
                            <button class="btn btn-read already" disabled title="Déjà lu">
                                <i class="fas fa-check"></i>
                            </button>
                        `}
                        <button class="btn btn-delete" data-id="${n.id}" title="Supprimer">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                </div>
            `;
        });

        mainContent.innerHTML = html;
        attachEvents();
    }

    // ==========================================
    // RENDER EMPTY
    // ==========================================

    function renderEmpty(message) {
        if (!mainContent) return;
        mainContent.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-bell-slash"></i>
                <h3>Aucune notification</h3>
                <p>${message || 'Vous n\'avez pas encore de notifications.'}</p>
                <a href="/dashboard" class="btn-shop">🏠 Retour</a>
            </div>
        `;
    }

    // ==========================================
    // ATTACHER LES ÉVÉNEMENTS
    // ==========================================

    function attachEvents() {
        document.querySelectorAll('.btn-read:not(.already)').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const id = this.dataset.id;
                markAsRead(id);
            });
        });

        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const id = this.dataset.id;
                deleteTargetId = id;
                confirmOverlay.classList.add('active');
            });
        });

        document.querySelectorAll('.notif-card.unread').forEach(card => {
            card.addEventListener('click', function() {
                const id = this.dataset.id;
                markAsRead(id);
            });
        });
    }

    // ==========================================
    // MARQUER COMME LU
    // ==========================================

    async function markAsRead(id) {
        try {
            const res = await fetch(`/api/notifications/read/${id}`, {
                method: 'PUT'
            });
            const data = await res.json();
            if (res.ok) {
                const notif = notifications.find(n => n.id == id);
                if (notif) notif.is_read = 1;
                renderNotifications();
                updateBadge();
            } else {
                console.error('Erreur:', data);
            }
        } catch (error) {
            console.error('Erreur:', error);
        }
    }

    // ==========================================
    // SUPPRIMER UNE NOTIFICATION
    // ==========================================

    async function deleteNotification(id) {
        try {
            const res = await fetch(`/api/notifications/delete/${id}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            if (res.ok) {
                notifications = notifications.filter(n => n.id != id);
                if (notifications.length === 0) {
                    renderEmpty();
                    notifBadge.textContent = '0';
                    notifBadge.className = 'badge-count zero';
                } else {
                    renderNotifications();
                    updateBadge();
                }
            } else {
                console.error('Erreur:', data);
            }
        } catch (error) {
            console.error('Erreur:', error);
        }
    }

    // ==========================================
    // METTRE À JOUR LE BADGE
    // ==========================================

    async function updateBadge() {
        try {
            const res = await fetch('/api/notifications/count');
            const data = await res.json();
            if (res.ok) {
                const count = data.count || 0;
                notifBadge.textContent = count;
                notifBadge.className = 'badge-count' + (count === 0 ? ' zero' : '');
            }
        } catch (error) {
            console.error('Erreur badge:', error);
        }
    }

    // ==========================================
    // FILTRES
    // ==========================================

    filterButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            filterButtons.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentFilter = this.dataset.filter;
            if (notifications.length > 0) {
                renderNotifications();
            }
        });
    });

    // ==========================================
    // TOUT MARQUER COMME LU
    // ==========================================

    readAllBtn.addEventListener('click', async function() {
        if (this.disabled) return;

        const unreadCount = notifications.filter(n => n.is_read === 0 || n.is_read === false).length;

        if (unreadCount === 0) {
            showToast('✅ Toutes vos notifications sont déjà lues', 'info');
            return;
        }

        try {
            const res = await fetch('/api/notifications/read-all', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await res.json();

            if (res.ok) {
                notifications.forEach(n => n.is_read = 1);
                renderNotifications();
                updateBadge();
                showToast(`✅ ${unreadCount} notification(s) marquée(s) comme lues`, 'success');
            } else {
                console.error('Erreur:', data);
                showToast('❌ ' + (data.error || 'Erreur'), 'error');
            }
        } catch (error) {
            console.error('Erreur:', error);
            showToast('❌ Erreur de connexion', 'error');
        }
    });

    // ==========================================
    // OVERLAY CONFIRMATION
    // ==========================================

    confirmCancel.addEventListener('click', function() {
        confirmOverlay.classList.remove('active');
        deleteTargetId = null;
    });

    confirmOk.addEventListener('click', function() {
        if (deleteTargetId) {
            deleteNotification(deleteTargetId);
            deleteTargetId = null;
        }
        confirmOverlay.classList.remove('active');
    });

    confirmOverlay.addEventListener('click', function(e) {
        if (e.target === confirmOverlay) {
            confirmOverlay.classList.remove('active');
            deleteTargetId = null;
        }
    });

    // ==========================================
    // INITIALISATION
    // ==========================================

    (async function init() {
        try {
            console.log('🚀 Initialisation des notifications...');
            const isAuth = await checkAuth();
            if (!isAuth) return;

            isSyncActive = true;
            updateSyncUI();

            connectSocketIO();

            await loadNotifications();

            console.log('✅ Initialisation terminée');
        } catch (error) {
            console.error('❌ Erreur lors de l\'initialisation:', error);
        }
    })();

});