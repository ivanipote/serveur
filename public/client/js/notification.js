document.addEventListener('DOMContentLoaded', function() {

    console.log('✅ notification.js chargé');

    // ==========================================
    // RÉFÉRENCES
    // ==========================================

    const mainContent = document.getElementById('notifMain');
    const notifList = document.getElementById('notifList');
    const skeletonLoader = document.getElementById('skeletonLoader');
    const notifBadge = document.getElementById('notifBadge');
    const syncBtn = document.getElementById('syncBtn');

    const confirmOverlay = document.getElementById('confirmOverlay');
    const confirmOk = document.getElementById('confirmOk');
    const confirmCancel = document.getElementById('confirmCancel');

    let userId = null;
    let notifications = [];
    let deleteTargetId = null;
    let isSyncing = false;
    let isFirstLoad = true;
    let timerIntervals = {};
    let timestampInterval = null;

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
    // DATE RELATIVE (avec mise à jour en temps réel)
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

    // ✅ METTRE À JOUR TOUS LES HORODATAGES
    function updateAllTimestamps() {
        const dateElements = document.querySelectorAll('.notif-card .date');
        dateElements.forEach(el => {
            const notifId = el.closest('.notif-card')?.dataset.id;
            if (notifId) {
                const notif = notifications.find(n => n.id == notifId);
                if (notif) {
                    el.textContent = timeAgo(notif.created_at);
                }
            }
        });
    }

    // ==========================================
    // AVATAR PAR TYPE
    // ==========================================

    function getAvatarIcon(type) {
        const icons = {
            'commande': '📦',
            'paiement': '💳',
            'admin': '📢',
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
            'systeme': '⚙️ Système',
            'client_message': '💬 Message'
        };
        return labels[type] || type;
    }

    // ==========================================
    // DÉTECTER LES LIENS DE PAIEMENT
    // ==========================================

    function hasPaymentLink(content) {
        return content && content.includes('[Cliquez ici pour payer]') && content.includes('geniuspay.ci');
    }

    function extractLink(content) {
        const match = content.match(/\[Cliquez ici pour payer\]\(([^)]+)\)/);
        return match ? match[1] : null;
    }

    function cleanContent(content) {
        return content.replace(/\[Cliquez ici pour payer\]\([^)]+\)/, '').trim();
    }

    // ==========================================
    // AFFICHER / CACHER SKELETON
    // ==========================================

    function showSkeleton() {
        if (skeletonLoader) {
            skeletonLoader.classList.add('active');
        }
        if (notifList) {
            notifList.innerHTML = '';
        }
    }

    function hideSkeleton() {
        if (skeletonLoader) {
            skeletonLoader.classList.remove('active');
        }
    }

    // ==========================================
    // CHARGER LES NOTIFICATIONS (UNIQUEMENT INITIAL)
    // ==========================================

    async function loadNotifications() {
        if (isSyncing) return;
        isSyncing = true;

        if (isFirstLoad) {
            showSkeleton();
        }

        try {
            const res = await fetch('/api/notifications');
            const data = await res.json();

            if (res.ok && data.notifications) {
                notifications = data.notifications;
                notifBadge.textContent = data.count || 0;
                notifBadge.className = 'badge-count' + (data.count === 0 ? ' zero' : '');
                isFirstLoad = false;
                hideSkeleton();
                renderNotifications();
                startAllTimers();
                startTimestampUpdater();
            } else {
                notifications = [];
                notifBadge.textContent = '0';
                notifBadge.className = 'badge-count zero';
                isFirstLoad = false;
                hideSkeleton();
                renderEmpty();
            }
        } catch (error) {
            console.error('❌ Erreur:', error);
            isFirstLoad = false;
            hideSkeleton();
            renderEmpty();
        } finally {
            isSyncing = false;
        }
    }

    // =============================================================
    // RAFRAÎCHIR MANUELLEMENT (bouton sync)
    // =============================================================

    async function refreshNotifications() {
        if (isSyncing) return;

        syncBtn.disabled = true;
        syncBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        try {
            const res = await fetch('/api/notifications');
            const data = await res.json();

            if (res.ok && data.notifications) {
                notifications = data.notifications;
                notifBadge.textContent = data.count || 0;
                notifBadge.className = 'badge-count' + (data.count === 0 ? ' zero' : '');
                renderNotifications();
                startAllTimers();
                startTimestampUpdater();
            }
        } catch (error) {
            console.error('❌ Erreur refresh:', error);
        } finally {
            syncBtn.disabled = false;
            syncBtn.innerHTML = '<i class="fas fa-sync-alt"></i>';
        }
    }

    // =============================================================
    // AFFICHER LES NOTIFICATIONS
    // =============================================================

    function renderNotifications() {
        if (!notifList) return;

        if (!notifications || notifications.length === 0) {
            renderEmpty();
            return;
        }

        // Trier par date (plus récent en premier)
        const sorted = [...notifications].sort((a, b) => {
            const dateA = new Date(a.created_at).getTime();
            const dateB = new Date(b.created_at).getTime();
            if (dateA === dateB) {
                return b.id - a.id;
            }
            return dateB - dateA;
        });

        let html = '';

        sorted.forEach((n, index) => {
            const type = n.type || 'systeme';
            const typeLabel = getTypeLabel(type);
            const dateStr = timeAgo(n.created_at);
            const avatarIcon = getAvatarIcon(type);
            const displayTitle = n.title || 'Notification';

            const isPaymentLink = hasPaymentLink(n.content);
            const linkUrl = isPaymentLink ? extractLink(n.content) : null;
            const cleanMsg = isPaymentLink ? cleanContent(n.content) : (n.content || 'Aucun contenu');

            let typeClass = 'systeme';
            if (type === 'commande') typeClass = 'commande';
            else if (type === 'paiement') typeClass = 'paiement';
            else if (type === 'admin') typeClass = 'admin';
            else if (type === 'systeme') typeClass = 'systeme';

            const urgentBadge = isPaymentLink ? `<span class="badge-urgent">🔥 URGENT</span>` : '';

            let linkHtml = '';
            let timerHtml = '';

            if (isPaymentLink && linkUrl) {
                const createdAt = n.created_at;
                const timerId = `timer-${n.id}`;

                timerHtml = `
                    <div class="timer-row" id="${timerId}">
                        <span class="timer-icon">⏳</span>
                        <span class="timer-label">Temps restant :</span>
                        <span class="timer-value" data-created="${createdAt}" data-notif-id="${n.id}">--:--</span>
                    </div>
                `;

                linkHtml = `
                    <div class="link-wrapper" id="link-wrapper-${n.id}">
                        <div class="link-row">
                            <span class="link-url">
                                <a href="${linkUrl}" target="_blank" class="payment-link" data-notif-id="${n.id}">${linkUrl}</a>
                            </span>
                            <div class="link-actions">
                                <button class="btn-link open" data-notif-id="${n.id}" onclick="window.open('${linkUrl}', '_blank')">
                                    <i class="fas fa-external-link-alt"></i> Ouvrir
                                </button>
                                <button class="btn-link copy" data-link="${linkUrl}" data-notif-id="${n.id}">
                                    <i class="fas fa-copy"></i> Copier
                                </button>
                            </div>
                        </div>
                        ${timerHtml}
                    </div>
                `;
            }

            html += `
                <div class="notif-card" data-id="${n.id}">
                    <div class="card-header">
                        <div class="avatar">${avatarIcon}</div>
                        <div class="card-title">${displayTitle}</div>
                        <div class="card-top-right">
                            ${urgentBadge}
                            <button class="btn-delete" data-id="${n.id}">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </div>
                    </div>
                    <div class="card-content">
                        ${cleanMsg}
                        ${linkHtml}
                    </div>
                    <div class="card-footer">
                        <span class="date">${dateStr}</span>
                        <span class="badge-type ${typeClass}">${typeLabel}</span>
                        <span class="expired-badge" id="expired-badge-${n.id}">⏳ Expiré</span>
                    </div>
                </div>
            `;

            if (index < sorted.length - 1) {
                html += `<div class="notif-divider"></div>`;
            }
        });

        notifList.innerHTML = html;
        attachEvents();
        startAllTimers();
        startTimestampUpdater();
    }

    // ==========================================
    // TIMER PUREMENT FRONT-END (basé sur created_at + 20min)
    // ==========================================

    function startAllTimers() {
        const timerElements = document.querySelectorAll('.timer-value[data-created]');
        timerElements.forEach(el => {
            const notifId = el.dataset.notifId;
            const createdAt = el.dataset.created;

            if (createdAt) {
                if (timerIntervals[notifId]) {
                    clearInterval(timerIntervals[notifId]);
                }
                timerIntervals[notifId] = startTimer(notifId, createdAt);
            } else {
                el.textContent = '--:--';
                el.className = 'timer-value';
            }
        });
    }

    function startTimer(notifId, createdAt) {
        const timerEl = document.querySelector(`.timer-value[data-notif-id="${notifId}"]`);
        const linkWrapper = document.getElementById(`link-wrapper-${notifId}`);
        const expiredBadge = document.getElementById(`expired-badge-${notifId}`);
        const link = document.querySelector(`.payment-link[data-notif-id="${notifId}"]`);
        const openBtn = document.querySelector(`.btn-link.open[data-notif-id="${notifId}"]`);
        const copyBtn = document.querySelector(`.btn-link.copy[data-notif-id="${notifId}"]`);

        if (!timerEl) return;

        const createdDate = new Date(createdAt);
        if (isNaN(createdDate.getTime())) {
            timerEl.textContent = '--:--';
            timerEl.className = 'timer-value';
            return;
        }

        const expiryTime = createdDate.getTime() + (20 * 60 * 1000);

        function updateTimer() {
            const now = Date.now();
            const diff = expiryTime - now;

            if (diff <= 0) {
                timerEl.textContent = '⏳ Expiré';
                timerEl.className = 'timer-value expired-text';
                if (linkWrapper) linkWrapper.classList.add('expired');
                if (expiredBadge) expiredBadge.classList.add('show');

                if (link) {
                    link.classList.add('expired-link');
                    link.removeAttribute('href');
                    link.textContent = '🔒 Lien expiré';
                }
                if (openBtn) openBtn.disabled = true;
                if (copyBtn) copyBtn.disabled = true;

                clearInterval(timerIntervals[notifId]);
                delete timerIntervals[notifId];
                return;
            }

            const minutes = Math.floor(diff / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);

            timerEl.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

            if (diff <= 60000) {
                timerEl.className = 'timer-value danger';
            } else if (diff <= 300000) {
                timerEl.className = 'timer-value warning';
            } else {
                timerEl.className = 'timer-value';
            }
        }

        updateTimer();
        return setInterval(updateTimer, 1000);
    }

    // ==========================================
    // ✅ METTRE À JOUR LES TIMESTAMPS EN TEMPS RÉEL (toutes les 30s)
    // ==========================================

    function startTimestampUpdater() {
        if (timestampInterval) {
            clearInterval(timestampInterval);
        }
        timestampInterval = setInterval(() => {
            updateAllTimestamps();
        }, 30000);
    }

    // ==========================================
    // AFFICHER VIDE
    // ==========================================

    function renderEmpty() {
        notifList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-bell-slash"></i>
                <h3>Aucune notification</h3>
            </div>
        `;
    }

    // ==========================================
    // ATTACHER LES ÉVÉNEMENTS
    // ==========================================

    function attachEvents() {
        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                deleteTargetId = this.dataset.id;
                confirmOverlay.classList.add('active');
            });
        });

        document.querySelectorAll('.btn-link.copy').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const link = this.dataset.link;
                if (link && !this.disabled) {
                    navigator.clipboard.writeText(link).then(() => {
                        this.classList.add('copied');
                        this.innerHTML = '<i class="fas fa-check"></i> Copié !';
                        setTimeout(() => {
                            this.classList.remove('copied');
                            this.innerHTML = '<i class="fas fa-copy"></i> Copier';
                        }, 2000);
                    }).catch(() => {
                        const input = document.createElement('input');
                        input.value = link;
                        document.body.appendChild(input);
                        input.select();
                        document.execCommand('copy');
                        document.body.removeChild(input);
                        this.classList.add('copied');
                        this.innerHTML = '<i class="fas fa-check"></i> Copié !';
                        setTimeout(() => {
                            this.classList.remove('copied');
                            this.innerHTML = '<i class="fas fa-copy"></i> Copier';
                        }, 2000);
                    });
                }
            });
        });
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
                if (timerIntervals[id]) {
                    clearInterval(timerIntervals[id]);
                    delete timerIntervals[id];
                }
                notifications = notifications.filter(n => n.id != id);
                if (notifications.length === 0) {
                    renderEmpty();
                    notifBadge.textContent = '0';
                    notifBadge.className = 'badge-count zero';
                } else {
                    renderNotifications();
                    startAllTimers();
                    startTimestampUpdater();
                }
                const count = notifications.filter(n => n.is_read === 0 || n.is_read === false).length;
                notifBadge.textContent = count;
                notifBadge.className = 'badge-count' + (count === 0 ? ' zero' : '');
            } else {
                console.error('Erreur:', data);
            }
        } catch (error) {
            console.error('Erreur:', error);
        }
    }

    // ==========================================
    // AJOUTER UNE NOTIFICATION EN TEMPS RÉEL
    // ==========================================

    function addNotification(notification) {
        const exists = notifications.some(n => n.id === notification.id);
        if (exists) return;

        console.log('🔔 Nouvelle notification ajoutée:', notification);

        notifications.unshift({
            id: notification.id,
            type: notification.type || 'systeme',
            title: notification.title || 'Notification',
            content: notification.content || '',
            is_read: 0,
            created_at: notification.created_at || new Date().toISOString()
        });

        notifications.sort((a, b) => {
            const dateA = new Date(a.created_at).getTime();
            const dateB = new Date(b.created_at).getTime();
            if (dateA === dateB) {
                return b.id - a.id;
            }
            return dateB - dateA;
        });

        const count = notifications.filter(n => n.is_read === 0 || n.is_read === false).length;
        notifBadge.textContent = count;
        notifBadge.className = 'badge-count' + (count === 0 ? ' zero' : '');

        renderNotifications();
        startTimestampUpdater();
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
                if (data && data.id) {
                    addNotification(data);
                } else {
                    loadNotifications();
                }
            });

        } catch (error) {
            console.error('❌ Erreur Socket.IO:', error);
            setTimeout(() => connectSocketIO(), 5000);
        }
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
    // BOUTON SYNC (rafraîchissement manuel)
    // ==========================================

    if (syncBtn) {
        syncBtn.addEventListener('click', function() {
            refreshNotifications();
        });
    }

    // ==========================================
    // INITIALISATION
    // ==========================================

    (async function init() {
        try {
            console.log('🚀 Initialisation des notifications...');
            const isAuth = await checkAuth();
            if (!isAuth) return;

            connectSocketIO();

            await loadNotifications();

            console.log('✅ Initialisation terminée');
        } catch (error) {
            console.error('❌ Erreur lors de l\'initialisation:', error);
        }
    })();

});