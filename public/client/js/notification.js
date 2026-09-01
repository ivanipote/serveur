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

        const sorted = [...notifications].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

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
            if (isPaymentLink && linkUrl) {
                linkHtml = `
                    <div class="link-wrapper">
                        <span class="link-url">
                            <a href="${linkUrl}" target="_blank">${linkUrl}</a>
                        </span>
                        <div class="link-actions">
                            <button class="btn-link open" onclick="window.open('${linkUrl}', '_blank')">
                                <i class="fas fa-external-link-alt"></i> Ouvrir
                            </button>
                            <button class="btn-link copy" data-link="${linkUrl}">
                                <i class="fas fa-copy"></i> Copier
                            </button>
                        </div>
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
                    </div>
                </div>
            `;

            if (index < sorted.length - 1) {
                html += `<div class="notif-divider"></div>`;
            }
        });

        notifList.innerHTML = html;
        attachEvents();
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
                if (link) {
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

// ==========================================
// AJOUTER UNE NOTIFICATION EN TEMPS RÉEL
// ==========================================

function addNotification(notification) {
    // Vérifier si la notification existe déjà
    const exists = notifications.some(n => n.id === notification.id);
    if (exists) return;

    console.log('🔔 Nouvelle notification ajoutée:', notification);

    // Ajouter en tête de liste
    notifications.unshift({
        id: notification.id,
        type: notification.type || 'systeme',
        title: notification.title || 'Notification',
        content: notification.content || '',
        is_read: 0,
        created_at: notification.created_at || new Date().toISOString()
    });

    // ✅ FORCER LE RE-TRI PAR DATE + ID
    notifications.sort((a, b) => {
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        if (dateA === dateB) {
            return b.id - a.id; // Si même date, ID le plus grand en premier
        }
        return dateB - dateA;
    });

    // Mettre à jour le badge
    const count = notifications.filter(n => n.is_read === 0 || n.is_read === false).length;
    notifBadge.textContent = count;
    notifBadge.className = 'badge-count' + (count === 0 ? ' zero' : '');

    // ✅ RE-RENDRE COMPLÈTEMENT (garantit l'ordre)
    renderNotifications();
}

    // =============================================================
    // RENDRE UNIQUEMENT LA NOUVELLE NOTIFICATION (SUBTTILE)
    // =============================================================

    function renderNewNotification(notification) {
        // Si la liste est vide, on recharge tout (cas du premier chargement)
        if (notifications.length <= 1) {
            renderNotifications();
            return;
        }

        const type = notification.type || 'systeme';
        const typeLabel = getTypeLabel(type);
        const dateStr = timeAgo(notification.created_at);
        const avatarIcon = getAvatarIcon(type);
        const displayTitle = notification.title || 'Notification';
        const cleanMsg = notification.content || 'Aucun contenu';

        let typeClass = 'systeme';
        if (type === 'commande') typeClass = 'commande';
        else if (type === 'paiement') typeClass = 'paiement';
        else if (type === 'admin') typeClass = 'admin';
        else if (type === 'systeme') typeClass = 'systeme';

        // Vérifier si c'est un lien de paiement
        const isPaymentLink = hasPaymentLink(notification.content);
        const linkUrl = isPaymentLink ? extractLink(notification.content) : null;
        const urgentBadge = isPaymentLink ? `<span class="badge-urgent">🔥 URGENT</span>` : '';

        let linkHtml = '';
        if (isPaymentLink && linkUrl) {
            linkHtml = `
                <div class="link-wrapper">
                    <span class="link-url">
                        <a href="${linkUrl}" target="_blank">${linkUrl}</a>
                    </span>
                    <div class="link-actions">
                        <button class="btn-link open" onclick="window.open('${linkUrl}', '_blank')">
                            <i class="fas fa-external-link-alt"></i> Ouvrir
                        </button>
                        <button class="btn-link copy" data-link="${linkUrl}">
                            <i class="fas fa-copy"></i> Copier
                        </button>
                    </div>
                </div>
            `;
        }

        // Créer la carte HTML
        const cardHtml = `
            <div class="notif-card appearing" data-id="${notification.id}">
                <div class="card-header">
                    <div class="avatar">${avatarIcon}</div>
                    <div class="card-title">${displayTitle}</div>
                    <div class="card-top-right">
                        ${urgentBadge}
                        <button class="btn-delete" data-id="${notification.id}">
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
                </div>
            </div>
        `;

        // Insérer en haut de la liste (après le premier élément)
        const firstCard = notifList.querySelector('.notif-card');
        if (firstCard) {
            // Insérer avant la première carte
            const divider = document.createElement('div');
            divider.className = 'notif-divider';
            notifList.insertAdjacentHTML('beforebegin', cardHtml);
            // Insérer le séparateur après la nouvelle carte
            const newCard = notifList.querySelector('.notif-card:first-child');
            if (newCard) {
                const dividerEl = document.createElement('div');
                dividerEl.className = 'notif-divider';
                newCard.after(dividerEl);
            }
        } else {
            // Si la liste est vide, on rend tout
            renderNotifications();
            return;
        }

        // Attacher les événements sur la nouvelle carte
        const newCardElement = notifList.querySelector('.notif-card:first-child');
        if (newCardElement) {
            const deleteBtn = newCardElement.querySelector('.btn-delete');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    deleteTargetId = this.dataset.id;
                    confirmOverlay.classList.add('active');
                });
            }

            const copyBtns = newCardElement.querySelectorAll('.btn-link.copy');
            copyBtns.forEach(btn => {
                btn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    const link = this.dataset.link;
                    if (link) {
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

            // ✅ UNIQUEMENT AJOUTER LA NOUVELLE NOTIFICATION (pas recharger tout)
            socket.on('notification', function(data) {
                console.log('🔔 Notification reçue (client):', data);
                if (data && data.id) {
                    addNotification(data);
                } else {
                    // Fallback : recharger toutes les notifications
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