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

    // ✅ Nouveaux éléments
    const destAdminBtn = document.getElementById('destAdminBtn');
    const destSellerBtn = document.getElementById('destSellerBtn');
    const shopSelector = document.getElementById('shopSelector');
    const shopSelect = document.getElementById('shopSelect');
    const showReadToggle = document.getElementById('showReadToggle');

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
    let isSendingMessage = false;

    // ✅ État du destinataire
    let currentDest = 'admin';
    let shops = [];
    let selectedShopId = null;

    // ✅ URL
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
        toast.textMessage = message;
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
                renderShopSelect();
            }
        } catch (error) {
            console.error('❌ Erreur chargement boutiques:', error);
        }
    }

    function renderShopSelect() {
        shopSelect.innerHTML = '<option value="">Choisir une boutique...</option>';
        shops.forEach(shop => {
            const option = document.createElement('option');
            option.value = shop.id;
            option.textContent = shop.name + ' (' + (shop.seller_name || 'Vendeur') + ')';
            shopSelect.appendChild(option);
        });
    }

    // ==========================================
    // SÉLECTEUR DESTINATAIRE
    // ==========================================

    function setDest(target) {
        currentDest = target;

        // Mettre à jour les boutons
        destAdminBtn.classList.toggle('active', target === 'admin');
        destSellerBtn.classList.toggle('active', target === 'seller');

        // Afficher/masquer le sélecteur de boutique
        shopSelector.style.display = target === 'seller' ? 'block' : 'none';

        // Mettre à jour le placeholder
        if (target === 'admin') {
            messageInput.placeholder = 'Envoyer un message à l\'admin...';
        } else {
            messageInput.placeholder = 'Choisissez une boutique et écrivez votre message...';
        }
    }

    destAdminBtn.addEventListener('click', function() {
        setDest('admin');
    });

    destSellerBtn.addEventListener('click', function() {
        setDest('seller');
        if (shops.length === 0) {
            loadShops();
        }
    });

    shopSelect.addEventListener('change', function() {
        selectedShopId = this.value ? parseInt(this.value) : null;
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

        // Vérifier si seller est sélectionné et une boutique est choisie
        if (currentDest === 'seller' && !selectedShopId) {
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
                // ✅ Envoi à l'admin
                url = '/api/client/send-message';
                body = {
                    title: '💬 Message client',
                    content: content
                };
            } else {
                // ✅ Envoi au seller
                const username = localStorage.getItem('userName') || 'Client';
                url = SELLER_API_URL + '/api/seller/message/send';
                body = {
                    shop_id: selectedShopId,
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
                const destLabel = currentDest === 'admin' ? 'admin' : 'la boutique';
                sendMessageResult.textContent = `✅ Message envoyé à ${destLabel} avec succès !`;
                sendMessageResult.style.display = 'block';
                messageInput.value = '';
                autoResizeTextarea();

                // Ajouter une notification locale
                const newNotif = {
                    id: Date.now(),
                    type: currentDest === 'admin' ? 'client_message' : 'client_message',
                    title: currentDest === 'admin' ? '💬 Vous → Admin' : '💬 Vous → Boutique',
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
            return '💬 Vous → ' + (notification.title.includes('Boutique') ? 'Boutique' : 'Admin');
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
    // RENDRE LES NOTIFICATIONS (AVEC COULEURS ET FILTRES)
    // ==========================================

    function renderNotifications() {
        if (!mainContent) return;

        if (!notifications || notifications.length === 0) {
            renderEmpty('Aucune notification');
            return;
        }

        let filtered = notifications;

        // Filtre par type
        if (currentFilter !== 'all') {
            filtered = filtered.filter(n => n.type === currentFilter);
        }

        // Filtre "Déjà lu" (caché par défaut)
        const showRead = showReadToggle.checked;
        if (!showRead) {
            filtered = filtered.filter(n => n.is_read === 0 || n.is_read === false);
        }

        if (filtered.length === 0) {
            renderEmpty(showRead ? 'Aucune notification avec ce filtre' : 'Aucune notification non lue');
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

            html += `
                <div class="notif-card type-${type} ${isUnread ? 'unread' : 'read'}" 
                     data-id="${n.id}"
                     style="background: ${colors.bg}; border-color: ${colors.border}; border-width: 2px; border-style: solid; border-radius: 16px; padding: 16px 18px 14px 18px; box-shadow: 0 2px 12px rgba(0,0,0,0.04); transition: all 0.3s ease; display: flex; gap: 14px; align-items: flex-start; position: relative; margin-bottom: 12px;">
                    
                    <div class="avatar" style="width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; background: ${colors.bg}; color: ${colors.avatar};">
                        ${avatarIcon}
                    </div>
                    
                    <div class="body" style="flex: 1; min-width: 0;">
                        <div class="title" style="font-size: 15px; font-weight: 700; color: ${colors.text};">${displayTitle}</div>
                        <div class="content" style="font-size: 14px; line-height: 1.5; margin-top: 2px; color: ${colors.text};">${contentHtml}</div>
                        <div class="date" style="font-size: 12px; color: #999; margin-top: 4px;">${dateStr}</div>
                        <span class="badge-type" style="display: inline-block; font-size: 11px; font-weight: 700; padding: 3px 12px; border-radius: 20px; margin-top: 6px; letter-spacing: 0.3px; background: ${colors.badge}; color: white;">${typeLabel}</span>
                    </div>
                    
                    <div class="header-actions" style="position: absolute; top: 14px; right: 16px; display: flex; gap: 6px; align-items: center;">
                        ${isUnread ? `
                            <button class="btn btn-read" data-id="${n.id}" title="Marquer comme lu" style="background: none; border: none; font-size: 14px; cursor: pointer; padding: 4px 6px; border-radius: 50%; transition: all 0.3s; color: #2d7d46; display: flex; align-items: center; justify-content: center; width: 28px; height: 28px;">
                                <i class="fas fa-check"></i>
                            </button>
                        ` : `
                            <button class="btn btn-read already" disabled title="Déjà lu" style="background: none; border: none; font-size: 14px; cursor: default; padding: 4px 6px; border-radius: 50%; color: #ccc; display: flex; align-items: center; justify-content: center; width: 28px; height: 28px;">
                                <i class="fas fa-check"></i>
                            </button>
                        `}
                        <button class="btn btn-delete" data-id="${n.id}" title="Supprimer" style="background: none; border: none; font-size: 14px; cursor: pointer; padding: 4px 6px; border-radius: 50%; transition: all 0.3s; color: #bbb; display: flex; align-items: center; justify-content: center; width: 28px; height: 28px;">
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

        document.querySelectorAll('.notification-link').forEach(link => {
            link.addEventListener('click', function(e) {
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

    showReadToggle.addEventListener('change', function() {
        renderNotifications();
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

            // Charger les boutiques
            await loadShops();

            isSyncActive = true;
            updateSyncUI();

            connectSocketIO();

            await loadNotifications();

            // Définir le destinataire par défaut
            setDest('admin');

            console.log('✅ Initialisation terminée');
        } catch (error) {
            console.error('❌ Erreur lors de l\'initialisation:', error);
        }
    })();

});