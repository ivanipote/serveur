document.addEventListener('DOMContentLoaded', function() {

    console.log('✅ notifseller.js chargé');

    // ==========================================
    // RÉFÉRENCES
    // ==========================================

    const mainContent = document.getElementById('notifList');
    const skeletonLoader = document.getElementById('skeletonLoader');
    const notifBadge = document.getElementById('notifBadge');
    const filterButtons = document.querySelectorAll('.filter-btn');
    const syncBtn = document.getElementById('syncBtn');
    const syncStatus = document.getElementById('syncStatus');

    const confirmOverlay = document.getElementById('confirmOverlay');
    const confirmOk = document.getElementById('confirmOk');
    const confirmCancel = document.getElementById('confirmCancel');

    const showReadToggle = document.getElementById('showReadToggle');

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
            bottom: 100px;
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
    // BOUTON SYNC
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
    // SYNC
    // ==========================================

    function startSync() {
        if (syncInterval) {
            clearInterval(syncInterval);
        }
        console.log('🔄 Sync notifseller démarré (toutes les 5s)');
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
            console.log('⏹️ Sync notifseller arrêté');
        }
    }

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
            const userIdLocal = localStorage.getItem('userId') || '1';

            socket = io({
                auth: {
                    userId: parseInt(userIdLocal),
                    isAdmin: false
                }
            });

            socket.on('connect', function() {
                console.log('✅ Socket.IO notifseller connecté');
                isSocketConnected = true;
            });

            socket.on('disconnect', function() {
                console.log('❌ Socket.IO notifseller déconnecté');
                isSocketConnected = false;
                setTimeout(() => {
                    if (!isSocketConnected) {
                        connectSocketIO();
                    }
                }, 3000);
            });

            socket.on('notification', function(data) {
                console.log('🔔 Notification reçue (notifseller):', data);
                showToast(data.title || 'Nouvelle notification boutique', 'info');
                hasNewNotification = true;
                loadNotifications(true);
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
                localStorage.setItem('userName', data.user.name);
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
    // AVATAR
    // ==========================================

    function getAvatarIcon(type) {
        return '🛍️';
    }

    function getTypeLabel(type) {
        return '🛍️ Boutique';
    }

    function getDisplayTitle(notification) {
        return notification.title || 'Notification boutique';
    }

    // ==========================================
    // CHARGER LES NOTIFICATIONS (UNIQUEMENT SELLER)
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
                // ✅ UNIQUEMENT les notifications de type 'seller'
                notifications = data.notifications.filter(n => n.type === 'seller');
                notifBadge.textContent = notifications.length || 0;
                notifBadge.className = 'badge-count' + (notifications.length === 0 ? ' zero' : '');
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
            renderEmpty('Aucune notification de boutique');
            return;
        }

        let filtered = notifications;

        if (currentFilter !== 'all') {
            filtered = filtered.filter(n => n.type === currentFilter);
        }

        if (showReadToggle && !showReadToggle.checked) {
            filtered = filtered.filter(n => n.is_read === 0 || n.is_read === false);
        }

        if (filtered.length === 0) {
            const msg = (showReadToggle && !showReadToggle.checked) ? 'Aucune notification non lue' : 'Aucune notification avec ce filtre';
            renderEmpty(msg);
            return;
        }

        let html = '';

        filtered.forEach(n => {
            const isUnread = n.is_read === 0 || n.is_read === false;
            const type = n.type || 'seller';
            const typeLabel = getTypeLabel(type);
            const dateStr = timeAgo(n.created_at);
            const avatarIcon = getAvatarIcon(type);
            const displayTitle = getDisplayTitle(n);

            let contentHtml = n.content || 'Aucun contenu';
            contentHtml = contentHtml.trim();

            // Récupérer les données extra
            const shopName = n.extra1 || null;
            const shopId = n.extra2 || null;
            const productId = n.extra3 || null;
            let productData = null;
            try {
                if (n.extra4) {
                    productData = typeof n.extra4 === 'string' ? JSON.parse(n.extra4) : n.extra4;
                }
            } catch (e) {
                productData = null;
            }

            // Bouton "DÉTAIL" en bas à droite
            let detailUrl = `/detail-notif.html?id=${n.id}`;
            if (shopId) detailUrl += `&shop_id=${shopId}`;
            if (shopName) detailUrl += `&shop_name=${encodeURIComponent(shopName)}`;
            if (productId) detailUrl += `&product_id=${productId}`;
            if (productData) detailUrl += `&product_data=${encodeURIComponent(JSON.stringify(productData))}`;

            let detailBtnHtml = `
                <a href="${detailUrl}" class="btn-detail" onclick="event.stopPropagation();">
                    Détail
                </a>
            `;

            // Carte produit si disponible
            let productCardHtml = '';
            if (productData && productId) {
                const imgSrc = productData.image1 || 'https://via.placeholder.com/50';
                productCardHtml = `
                    <div class="card-product-linked" onclick="window.location.href='/detail-produit?id=${productId}'">
                        <img src="${imgSrc}" alt="${productData.name}" class="p-img" />
                        <div class="p-info">
                            <div class="p-name">${productData.name}</div>
                            <div class="p-price">${(productData.price || 0).toLocaleString()} FCFA</div>
                            <div class="p-stock">📦 ${productData.stock || 0} en stock</div>
                        </div>
                        <span class="p-arrow">Voir →</span>
                    </div>
                `;
            }

            // CARTE
            html += `
                <div class="notif-card ${isUnread ? 'unread' : 'read'}" 
                     data-id="${n.id}">
                    
                    <!-- En-tête -->
                    <div class="card-header">
                        <div class="avatar">
                            ${avatarIcon}
                        </div>
                        <div class="card-title">
                            ${displayTitle}
                            ${shopName ? `<span class="shop-name">🏪 ${shopName}</span>` : ''}
                        </div>
                        <div class="card-top-right">
                            ${isUnread ? `
                                <button class="btn btn-read" data-id="${n.id}" title="Marquer comme lu">
                                    <i class="fas fa-check"></i>
                                </button>
                            ` : `
                                <button class="btn btn-read already" disabled>
                                    <i class="fas fa-check"></i>
                                </button>
                            `}
                            <button class="btn btn-delete" data-id="${n.id}" title="Supprimer">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </div>
                    </div>
                    
                    <!-- Contenu -->
                    <div class="card-content">${contentHtml}</div>
                    
                    <!-- Pied de carte -->
                    <div class="card-footer">
                        <span class="date">${dateStr}</span>
                        ${detailBtnHtml}
                    </div>

                    <!-- Carte produit intégrée -->
                    ${productCardHtml}
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
                <i class="fas fa-store-slash"></i>
                <h3>Aucune notification</h3>
                <p>${message || 'Aucune notification de boutique pour le moment.'}</p>
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
            card.addEventListener('click', function(e) {
                if (e.target.closest('.btn') || e.target.closest('.btn-detail') || e.target.closest('.card-product-linked')) {
                    return;
                }
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
            renderNotifications();
        });
    });

    // ==========================================
    // FILTRE DÉJÀ LU
    // ==========================================

    if (showReadToggle) {
        showReadToggle.addEventListener('change', function() {
            renderNotifications();
        });
    }

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
            console.log('🚀 Initialisation des notifications boutiques...');
            const isAuth = await checkAuth();
            if (!isAuth) return;

            isSyncActive = true;
            updateSyncUI();

            connectSocketIO();

            await loadNotifications();

            console.log('✅ notifseller initialisé');
        } catch (error) {
            console.error('❌ Erreur lors de l\'initialisation:', error);
        }
    })();

});