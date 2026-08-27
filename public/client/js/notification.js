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
    const syncBtn = document.getElementById('syncBtn');
    const syncStatus = document.getElementById('syncStatus');

    const messageInput = document.getElementById('messageInput');
    const sendMessageBtn = document.getElementById('sendMessageBtn');
    const sendMessageResult = document.getElementById('sendMessageResult');

    const destAdminBtn = document.getElementById('destAdminBtn');
    const destSellerBtn = document.getElementById('destSellerBtn');

    const shopOverlay = document.getElementById('shopOverlay');
    const shopOverlayList = document.getElementById('shopOverlayList');
    const shopSearchInput = document.getElementById('shopSearchInput');
    const shopOverlayClose = document.getElementById('shopOverlayClose');
    const shopOverlayCancel = document.getElementById('shopOverlayCancel');

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
    let isSendingMessage = false;

    let currentDest = 'admin';
    let shops = [];
    let selectedShop = null;

    const SELLER_API_URL = 'https://nature-plus-seller.onrender.com';
    const CLIENT_API_URL = 'https://nature-plus-client.onrender.com';

    // ==========================================
    // COULEURS PAR TYPE
    // ==========================================

    const TYPE_COLORS = {
        'commande': { bg: '#e3f2fd', border: '#64b5f6', badge: '#64b5f6', text: '#0d47a1', avatar: '#0d47a1' },
        'paiement': { bg: '#e8f5e9', border: '#66bb6a', badge: '#66bb6a', text: '#1b5e20', avatar: '#1b5e20' },
        'admin': { bg: '#fff3e0', border: '#ffb74d', badge: '#ffb74d', text: '#e65100', avatar: '#e65100' },
        'seller': { bg: '#e8eaf6', border: '#7986cb', badge: '#7986cb', text: '#283593', avatar: '#283593' },
        'systeme': { bg: '#f5f5f5', border: '#d0d0d0', badge: '#d0d0d0', text: '#555', avatar: '#555' },
        'client_message': { bg: '#f3e5f5', border: '#ce93d8', badge: '#ce93d8', text: '#4a148c', avatar: '#4a148c' }
    };

    const DEFAULT_COLORS = { bg: '#f5f5f5', border: '#d0d0d0', badge: '#d0d0d0', text: '#555', avatar: '#555' };

    function getTypeColors(type) {
        return TYPE_COLORS[type] || DEFAULT_COLORS;
    }

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
    // AUTO-RESIZE DU TEXTAREA
    // ==========================================

    function autoResizeTextarea() {
        messageInput.style.height = 'auto';
        const scrollHeight = messageInput.scrollHeight;
        const maxHeight = 150;
        messageInput.style.height = Math.min(scrollHeight, maxHeight) + 'px';
    }

    messageInput.addEventListener('input', autoResizeTextarea);

    // ==========================================
    // CHARGER LES BOUTIQUES
    // ==========================================

    async function loadShops() {
        try {
            const res = await fetch(CLIENT_API_URL + '/api/shops');
            const data = await res.json();

            if (data.success && data.shops && data.shops.length > 0) {
                shops = data.shops;
                renderShopOverlay(shops);
            }
        } catch (error) {
            console.error('❌ Erreur chargement boutiques:', error);
        }
    }

    function renderShopOverlay(shopsList) {
        shopOverlayList.innerHTML = shopsList.map(shop => `
            <div class="shop-overlay-item" data-id="${shop.id}" data-name="${shop.name}" data-seller="${shop.seller_name || 'Vendeur'}">
                <span class="shop-icon">🏪</span>
                <div class="shop-info">
                    <div class="shop-name">${shop.name}</div>
                    <div class="shop-seller">👤 ${shop.seller_name || 'Vendeur'}</div>
                </div>
                <span class="shop-check"><i class="fas fa-check-circle"></i></span>
            </div>
        `).join('');

        document.querySelectorAll('.shop-overlay-item').forEach(item => {
            item.addEventListener('click', function() {
                document.querySelectorAll('.shop-overlay-item').forEach(el => el.classList.remove('selected'));
                this.classList.add('selected');
                selectedShop = {
                    id: parseInt(this.dataset.id),
                    name: this.dataset.name,
                    seller: this.dataset.seller
                };
                setTimeout(() => {
                    closeShopOverlay();
                    destSellerBtn.innerHTML = `<i class="fas fa-store"></i> ${selectedShop.name}`;
                    destSellerBtn.classList.add('active');
                    destAdminBtn.classList.remove('active');
                    messageInput.placeholder = `Envoyer un message à ${selectedShop.name}...`;
                }, 300);
            });
        });
    }

    // ==========================================
    // OVERLAY BOUTIQUES
    // ==========================================

    function openShopOverlay() {
        shopOverlay.classList.add('active');
        shopSearchInput.value = '';
        shopSearchInput.focus();
        filterShopOverlay('');
        document.body.style.overflow = 'hidden';
    }

    function closeShopOverlay() {
        shopOverlay.classList.remove('active');
        document.body.style.overflow = '';
    }

    shopOverlayClose.addEventListener('click', closeShopOverlay);
    shopOverlayCancel.addEventListener('click', closeShopOverlay);

    shopOverlay.addEventListener('click', function(e) {
        if (e.target === shopOverlay) {
            closeShopOverlay();
        }
    });

    shopSearchInput.addEventListener('input', function() {
        filterShopOverlay(this.value.trim().toLowerCase());
    });

    function filterShopOverlay(query) {
        const items = shopOverlayList.querySelectorAll('.shop-overlay-item');
        items.forEach(item => {
            const name = item.dataset.name.toLowerCase();
            const seller = item.dataset.seller.toLowerCase();
            const match = name.includes(query) || seller.includes(query);
            item.style.display = match ? 'flex' : 'none';
        });
    }

    // ==========================================
    // SÉLECTEUR DESTINATAIRE
    // ==========================================

    function setDest(target) {
        currentDest = target;

        if (target === 'admin') {
            destAdminBtn.classList.add('active');
            destSellerBtn.classList.remove('active');
            destSellerBtn.innerHTML = '<i class="fas fa-store"></i> Boutique';
            selectedShop = null;
            messageInput.placeholder = 'Envoyer un message à l\'admin...';
        } else {
            if (shops.length === 0) {
                loadShops().then(() => {
                    openShopOverlay();
                });
            } else {
                openShopOverlay();
            }
        }
    }

    destAdminBtn.addEventListener('click', function() {
        setDest('admin');
    });

    destSellerBtn.addEventListener('click', function() {
        if (selectedShop) {
            openShopOverlay();
        } else {
            setDest('seller');
        }
    });

    // ==========================================
    // ENVOYER UN MESSAGE
    // ==========================================

    async function sendMessage() {
        const content = messageInput.value.trim();

        if (!content) {
            sendMessageResult.className = 'send-message-result error';
            sendMessageResult.textContent = '⚠️ Veuillez écrire un message.';
            sendMessageResult.style.display = 'block';
            setTimeout(() => {
                sendMessageResult.style.display = 'none';
            }, 3000);
            return;
        }

        if (currentDest === 'seller' && !selectedShop) {
            sendMessageResult.className = 'send-message-result error';
            sendMessageResult.textContent = '⚠️ Veuillez choisir une boutique.';
            sendMessageResult.style.display = 'block';
            setTimeout(() => {
                sendMessageResult.style.display = 'none';
            }, 3000);
            return;
        }

        if (isSendingMessage) return;
        isSendingMessage = true;
        sendMessageBtn.disabled = true;
        sendMessageBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        try {
            let url, body;

            if (currentDest === 'admin') {
                url = '/api/client/send-message';
                body = {
                    title: '💬 Message client',
                    content: content
                };
            } else {
                const username = localStorage.getItem('userName') || 'Client';
                url = SELLER_API_URL + '/api/seller/message/send';
                body = {
                    shop_id: selectedShop.id,
                    username: username,
                    message: content
                };
            }

            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const data = await res.json();

            if (res.ok) {
                sendMessageResult.className = 'send-message-result success';
                const destLabel = currentDest === 'admin' ? 'admin' : selectedShop.name;
                sendMessageResult.textContent = `✅ Message envoyé à ${destLabel} avec succès !`;
                sendMessageResult.style.display = 'block';
                messageInput.value = '';
                autoResizeTextarea();

                const newNotif = {
                    id: Date.now(),
                    type: 'client_message',
                    title: currentDest === 'admin' ? '💬 Vous → Admin' : `💬 Vous → ${selectedShop.name}`,
                    content: content,
                    is_read: 1,
                    created_at: new Date().toISOString()
                };
                
                notifications.unshift(newNotif);
                renderNotifications();
                updateBadge();
                
                setTimeout(() => {
                    sendMessageResult.style.display = 'none';
                }, 4000);
            } else {
                sendMessageResult.className = 'send-message-result error';
                sendMessageResult.textContent = '❌ ' + (data.error || 'Erreur');
                sendMessageResult.style.display = 'block';
                setTimeout(() => {
                    sendMessageResult.style.display = 'none';
                }, 3000);
            }
        } catch (error) {
            console.error('Erreur envoi message:', error);
            sendMessageResult.className = 'send-message-result error';
            sendMessageResult.textContent = '❌ Erreur de connexion';
            sendMessageResult.style.display = 'block';
            setTimeout(() => {
                sendMessageResult.style.display = 'none';
            }, 3000);
        }

        isSendingMessage = false;
        sendMessageBtn.disabled = false;
        sendMessageBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
    }

    sendMessageBtn.addEventListener('click', sendMessage);

    messageInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

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

            socket.on('notification', function(data) {
                console.log('🔔 Notification reçue (client):', data);
                showToast(data.title || 'Nouvelle notification', 'info');
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
    // AVATAR PAR TYPE
    // ==========================================

    function getAvatarIcon(type) {
        const icons = {
            'commande': '📦',
            'paiement': '💳',
            'admin': '📢',
            'seller': '🛍️',
            'systeme': '⚙️',
            'client_message': '💬'
        };
        return icons[type] || '🌿';
    }

    function getTypeLabel(type) {
        const labels = {
            'commande': '📦 Commande',
            'paiement': '💳 Paiement',
            'admin': '📢 Admin',
            'seller': '🛍️ Boutique',
            'systeme': '⚙️ Système',
            'client_message': '💬 Message'
        };
        return labels[type] || type;
    }

    function getDisplayTitle(notification) {
        if (notification.type === 'client_message') {
            if (notification.title && notification.title.includes('→')) {
                return notification.title;
            }
            return '💬 Vous → ' + (notification.title?.includes('Boutique') ? 'Boutique' : 'Admin');
        }
        return notification.title || 'Notification';
    }

    // ==========================================
    // CHARGER LES NOTIFICATIONS
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
    // RENDRE LES NOTIFICATIONS (STYLE DÉMO)
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
            const type = n.type || 'systeme';
            const typeLabel = getTypeLabel(type);
            const dateStr = timeAgo(n.created_at);
            const avatarIcon = getAvatarIcon(type);
            const displayTitle = getDisplayTitle(n);
            const colors = getTypeColors(type);

            let contentHtml = n.content || 'Aucun contenu';
            
            const linkMatch = contentHtml.match(/\[Cliquez ici pour payer\]\(([^)]+)\)/);
            if (linkMatch) {
                const url = linkMatch[1];
                contentHtml = contentHtml.replace(
                    /\[Cliquez ici pour payer\]\(([^)]+)\)/,
                    `<a href="${url}" target="_blank" class="notification-link" onclick="event.stopPropagation();">
                        <i class="fas fa-external-link-alt"></i> Cliquez ici pour payer
                    </a>`
                );
            }

            let productCardHtml = '';
            const productMatch = contentHtml.match(/<div style="margin-top:12px;border:2px solid #17A464;border-radius:16px;padding:14px 16px;display:flex;align-items:center;gap:14px;background:#f8fbf9;cursor:pointer;" onclick="window.location.href='([^']+)'">([\s\S]*?)<\/div>/);
            if (productMatch) {
                const url = productMatch[1];
                const content = productMatch[2];
                productCardHtml = `
                    <div class="card-product-linked" onclick="window.location.href='${url}'">
                        ${content}
                        <span class="p-arrow">Voir →</span>
                    </div>
                `;
                contentHtml = contentHtml.replace(productMatch[0], '');
            }

            contentHtml = contentHtml.trim();

            html += `
                <div class="notif-card type-${type} ${isUnread ? 'unread' : 'read'}" 
                     data-id="${n.id}"
                     style="border-color: ${colors.border};">
                    
                    <div class="avatar" style="background: ${colors.bg}; color: ${colors.avatar};">
                        ${avatarIcon}
                    </div>
                    
                    <div class="body">
                        <div class="title" style="color: ${colors.text};">${displayTitle}</div>
                        <div class="content">${contentHtml}</div>
                        <div class="date">${dateStr}</div>
                        ${productCardHtml}
                        <span class="badge-type" style="background: ${colors.badge}; color: white;">${typeLabel}</span>
                    </div>
                    
                    <div class="header-actions">
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
            card.addEventListener('click', function(e) {
                if (e.target.closest('.btn') || e.target.closest('.notification-link') || e.target.closest('.card-product-linked')) {
                    return;
                }
                const id = this.dataset.id;
                markAsRead(id);
            });
        });

        document.querySelectorAll('.notification-link, .card-product-linked').forEach(el => {
            el.addEventListener('click', function(e) {
                e.stopPropagation();
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
            console.log('🚀 Initialisation des notifications...');
            const isAuth = await checkAuth();
            if (!isAuth) return;

            await loadShops();

            isSyncActive = true;
            updateSyncUI();

            connectSocketIO();

            await loadNotifications();

            setDest('admin');

            console.log('✅ Initialisation terminée');
        } catch (error) {
            console.error('❌ Erreur lors de l\'initialisation:', error);
        }
    })();

});