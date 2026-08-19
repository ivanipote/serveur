document.addEventListener('DOMContentLoaded', function() {

    console.log('✅ notification.js chargé');

    // ==========================================
    // RÉFÉRENCES
    // ==========================================

    const mainContent = document.getElementById('notifList');
    const skeletonLoader = document.getElementById('skeletonLoader');
    const notifBadge = document.getElementById('notifBadge');
    const readAllBtn = document.getElementById('readAllBtn');
    const filterButtons = document.querySelectorAll('.filter-btn');

    const confirmOverlay = document.getElementById('confirmOverlay');
    const confirmOk = document.getElementById('confirmOk');
    const confirmCancel = document.getElementById('confirmCancel');

    let notifications = [];
    let userId = null;
    let currentFilter = 'all';
    let deleteTargetId = null;

    // ==========================================
    // VÉRIFICATION CONNEXION
    // ==========================================

    async function checkAuth() {
        try {
            const res = await fetch('/api/client/me');
            const data = await res.json();
            if (data.success) {
                userId = data.user.id;
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
        const now = new Date();
        const date = new Date(dateString);
        const diffMs = now - date;
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        const diffHour = Math.floor(diffMin / 60);
        const diffDay = Math.floor(diffHour / 24);

        if (diffSec < 60) return 'à l\'instant';
        if (diffMin < 60) return `il y a ${diffMin} min`;
        if (diffHour < 24) return `il y a ${diffHour}h`;
        if (diffDay === 1) return 'hier';
        if (diffDay < 7) return `il y a ${diffDay} jours`;
        return date.toLocaleDateString('fr-FR');
    }

    // ==========================================
    // CHARGER LES NOTIFICATIONS
    // ==========================================

    async function loadNotifications() {
        if (skeletonLoader) skeletonLoader.style.display = 'flex';
        if (mainContent) mainContent.innerHTML = '';

        try {
            const res = await fetch('/api/notifications');
            const data = await res.json();

            if (res.ok && data.notifications && data.notifications.length > 0) {
                notifications = data.notifications;
                notifBadge.textContent = data.count;
                notifBadge.className = 'badge-count' + (data.count === 0 ? ' zero' : '');
                renderNotifications();
            } else if (res.ok && (!data.notifications || data.notifications.length === 0)) {
                notifications = [];
                notifBadge.textContent = '0';
                notifBadge.className = 'badge-count zero';
                renderEmpty();
            } else {
                renderEmpty();
            }
        } catch (error) {
            console.error('❌ Erreur:', error);
            renderEmpty();
        } finally {
            if (skeletonLoader) skeletonLoader.style.display = 'none';
        }
    }

    // ==========================================
    // RENDRE LES NOTIFICATIONS (style carte 2)
    // ==========================================

    function renderNotifications() {
        if (!mainContent) return;

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
            const isUnread = n.is_read === 0;
            const typeClass = n.type || 'systeme';
            const typeLabels = {
                'commande': '📦 Commande',
                'paiement': '💳 Paiement',
                'admin': '📢 Admin',
                'systeme': '⚙️ Système'
            };
            const typeLabel = typeLabels[typeClass] || typeClass;

            const dateStr = timeAgo(n.created_at);

            // Avatar: lettre ou icône
            const avatarIcon = getAvatarIcon(n.type);

            let actionHtml = '';
            if (isUnread) {
                actionHtml = `
                    <button class="btn-mark-read" data-id="${n.id}">
                        <i class="fas fa-check"></i> Marquer comme lu
                    </button>
                `;
            } else {
                actionHtml = `
                    <button class="btn-mark-read read" disabled>
                        <i class="fas fa-check"></i> Lu
                    </button>
                `;
            }

            html += `
                <div class="notif-card ${isUnread ? 'unread' : 'read'}" data-id="${n.id}">
                    <div class="avatar">${avatarIcon}</div>
                    <div class="body">
                        <div class="title">${n.title || 'Notification'}</div>
                        <div class="content">${n.content || 'Aucun contenu'}</div>
                        <div class="date">${dateStr}</div>
                        <span class="type-tag ${typeClass}">${typeLabel}</span>
                        <div class="actions">
                            ${actionHtml}
                            <button class="btn-delete" data-id="${n.id}">
                                <i class="fas fa-trash-alt"></i> Supprimer
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });

        mainContent.innerHTML = html;
        attachEvents();
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
        // Marquer comme lu
        document.querySelectorAll('.btn-mark-read:not(.read)').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const id = this.dataset.id;
                markAsRead(id);
            });
        });

        // Supprimer
        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const id = this.dataset.id;
                deleteTargetId = id;
                confirmOverlay.classList.add('active');
            });
        });

        // Clic sur la carte → marquer comme lu
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

        const unreadCount = notifications.filter(n => n.is_read === 0).length;
        if (unreadCount === 0) {
            return;
        }

        try {
            const res = await fetch('/api/notifications/read-all', {
                method: 'PUT'
            });
            const data = await res.json();
            if (res.ok) {
                notifications.forEach(n => n.is_read = 1);
                renderNotifications();
                updateBadge();
            } else {
                console.error('Erreur:', data);
            }
        } catch (error) {
            console.error('Erreur:', error);
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

            await loadNotifications();
            console.log('✅ Initialisation terminée');
        } catch (error) {
            console.error('❌ Erreur lors de l\'initialisation:', error);
        }
    })();

});