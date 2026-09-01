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
    let pendingReload = false;
    let isFirstLoad = true;
    let isSocketConnected = false;
    let socket = null;

    // ==========================================
    // VÉRIFICATION CONNEXION
    // ==========================================

    async function checkAuth() {
        try {
            const res = await fetch('/api/client/me', { cache: 'no-store' });
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
    // AVATAR / LABEL PAR TYPE
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

    function getTypeClass(type) {
        if (type === 'commande') return 'commande';
        if (type === 'paiement') return 'paiement';
        if (type === 'admin') return 'admin';
        return 'systeme';
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
    // ÉCHAPPEMENT HTML (sécurité basique)
    // ==========================================

    function escapeAttr(str) {
        return String(str).replace(/"/g, '&quot;');
    }

    // ==========================================
    // AFFICHER / CACHER SKELETON
    // ==========================================

    function showSkeleton() {
        if (skeletonLoader) skeletonLoader.classList.add('active');
        if (notifList) notifList.innerHTML = '';
    }

    function hideSkeleton() {
        if (skeletonLoader) skeletonLoader.classList.remove('active');
    }

    // ==========================================
    // CONSTRUIRE UNE CARTE (élément DOM, pas juste du HTML)
    // ==========================================

    function buildCardElement(n) {
        const type = n.type || 'systeme';
        const typeLabel = getTypeLabel(type);
        const typeClass = getTypeClass(type);
        const dateStr = timeAgo(n.created_at);
        const avatarIcon = getAvatarIcon(type);
        const displayTitle = n.title || 'Notification';

        const isPaymentLink = hasPaymentLink(n.content);
        const linkUrl = isPaymentLink ? extractLink(n.content) : null;
        const cleanMsg = isPaymentLink ? cleanContent(n.content) : (n.content || 'Aucun contenu');

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
                        <button class="btn-link copy" data-link="${escapeAttr(linkUrl)}">
                            <i class="fas fa-copy"></i> Copier
                        </button>
                    </div>
                </div>
            `;
        }

        const wrapper = document.createElement('div');
        wrapper.innerHTML = `
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
        return wrapper.firstElementChild;
    }

    function buildDivider() {
        const div = document.createElement('div');
        div.className = 'notif-divider';
        return div;
    }

    // ==========================================
    // RENDU COMPLET (utilisé au tout premier chargement)
    // ==========================================

    function renderNotificationsFull() {
        if (!notifList) return;

        if (!notifications || notifications.length === 0) {
            renderEmpty();
            return;
        }

        const sorted = [...notifications].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        const frag = document.createDocumentFragment();

        sorted.forEach((n, index) => {
            frag.appendChild(buildCardElement(n));
            if (index < sorted.length - 1) frag.appendChild(buildDivider());
        });

        notifList.innerHTML = '';
        notifList.appendChild(frag);
        attachEvents();
    }

    // ==========================================
    // MISE À JOUR "SUBTILE" (diff) — n'écrase pas tout,
    // insère juste les nouvelles cartes avec une animation
    // et retire celles qui ont disparu.
    // ==========================================

    function renderNotificationsDiff(previousNotifications) {
        if (!notifList) return;

        if (!notifications || notifications.length === 0) {
            renderEmpty();
            return;
        }

        // Si la liste était vide avant (ou état "empty"), on repart d'un rendu complet
        const emptyStateEl = notifList.querySelector('.empty-state');
        if (emptyStateEl || !previousNotifications || previousNotifications.length === 0) {
            renderNotificationsFull();
            highlightNewCards(getNewIds(previousNotifications || []));
            return;
        }

        const sorted = [...notifications].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        const newIds = getNewIds(previousNotifications);
        const currentIdsInDom = new Set(
            Array.from(notifList.querySelectorAll('.notif-card')).map(el => el.dataset.id)
        );
        const freshIds = new Set(sorted.map(n => String(n.id)));

        // 1. Retirer en douceur les cartes qui n'existent plus (supprimées ailleurs, expirées, etc.)
        currentIdsInDom.forEach(id => {
            if (!freshIds.has(id)) {
                const el = notifList.querySelector(`.notif-card[data-id="${id}"]`);
                if (el) fadeOutAndRemove(el);
            }
        });

        // 2. Reconstruire l'ordre en réinjectant les cartes existantes et en créant les nouvelles,
        //    sans jamais vider notifList d'un coup (pas de flash / pas de scroll-jump).
        const frag = document.createDocumentFragment();
        const existingCards = new Map(
            Array.from(notifList.querySelectorAll('.notif-card')).map(el => [el.dataset.id, el])
        );

        sorted.forEach((n, index) => {
            const idStr = String(n.id);
            let cardEl = existingCards.get(idStr);
            if (!cardEl) {
                cardEl = buildCardElement(n);
            } else {
                cardEl.remove(); // on le détache pour le replacer au bon endroit
            }
            frag.appendChild(cardEl);
            if (index < sorted.length - 1) frag.appendChild(buildDivider());
        });

        // Nettoyer les vieux séparateurs orphelins puis réinjecter dans le bon ordre
        notifList.querySelectorAll('.notif-divider').forEach(d => d.remove());
        notifList.appendChild(frag);

        attachEvents();
        highlightNewCards(newIds);
    }

    function getNewIds(previousNotifications) {
        const previousIds = new Set(previousNotifications.map(n => String(n.id)));
        return notifications
            .filter(n => !previousIds.has(String(n.id)))
            .map(n => String(n.id));
    }

    // ==========================================
    // ANIMATIONS SUBTILES
    // ==========================================

    function highlightNewCards(newIds) {
        if (!newIds || newIds.length === 0) return;
        newIds.forEach(id => {
            const el = notifList.querySelector(`.notif-card[data-id="${id}"]`);
            if (!el) return;
            el.classList.add('notif-card-incoming');
            // force reflow puis on retire la classe pour laisser la transition CSS jouer
            requestAnimationFrame(() => {
                el.classList.add('notif-card-incoming-active');
            });
            setTimeout(() => {
                el.classList.remove('notif-card-incoming');
                el.classList.remove('notif-card-incoming-active');
            }, 2200);
        });

        // Petit "pulse" discret sur le badge pour signaler l'arrivée
        if (notifBadge) {
            notifBadge.classList.add('badge-pulse');
            setTimeout(() => notifBadge.classList.remove('badge-pulse'), 900);
        }
    }

    function fadeOutAndRemove(el) {
        el.classList.add('notif-card-leaving');
        setTimeout(() => {
            const next = el.nextElementSibling;
            if (next && next.classList.contains('notif-divider')) next.remove();
            el.remove();
        }, 300);
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
    // CHARGER LES NOTIFICATIONS (fetch + décision du type de rendu)
    // ==========================================

    async function loadNotifications(showSkeletonLoader = true, silent = false) {
        if (isSyncing) {
            pendingReload = true;
            return;
        }
        isSyncing = true;

        if (showSkeletonLoader && isFirstLoad) {
            showSkeleton();
        }

        const previousNotifications = notifications;

        try {
            const res = await fetch('/api/notifications', { cache: 'no-store' });
            const data = await res.json();

            if (res.ok && data.notifications) {
                notifications = data.notifications;
                updateBadge(data.count || 0);
                hideSkeleton();

                if (isFirstLoad) {
                    isFirstLoad = false;
                    renderNotificationsFull();
                } else if (silent) {
                    // rechargement subtil : on ne touche au DOM que pour ce qui a changé
                    renderNotificationsDiff(previousNotifications);
                } else {
                    renderNotificationsFull();
                }
            } else {
                notifications = [];
                updateBadge(0);
                isFirstLoad = false;
                hideSkeleton();
                renderEmpty();
            }
        } catch (error) {
            console.error('❌ Erreur:', error);
            isFirstLoad = false;
            hideSkeleton();
            if (!notifications || notifications.length === 0) renderEmpty();
        } finally {
            isSyncing = false;
            if (pendingReload) {
                pendingReload = false;
                loadNotifications(false, true);
            }
        }
    }

    function updateBadge(count) {
        notifBadge.textContent = count;
        notifBadge.className = 'badge-count' + (count === 0 ? ' zero' : '');
    }

    // =============================================================
    // RAFRAÎCHIR MANUELLEMENT (bouton sync) — rendu complet volontaire
    // =============================================================

    async function refreshNotifications() {
        if (isSyncing) return;

        syncBtn.disabled = true;
        syncBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        await loadNotifications(false, false);

        syncBtn.disabled = false;
        syncBtn.innerHTML = '<i class="fas fa-sync-alt"></i>';
    }

    // ==========================================
    // ATTACHER LES ÉVÉNEMENTS
    // ==========================================

    function attachEvents() {
        notifList.querySelectorAll('.btn-delete').forEach(btn => {
            btn.replaceWith(btn.cloneNode(true)); // évite les doublons d'event listeners
        });
        notifList.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                deleteTargetId = this.dataset.id;
                confirmOverlay.classList.add('active');
            });
        });

        notifList.querySelectorAll('.btn-link.copy').forEach(btn => {
            btn.replaceWith(btn.cloneNode(true));
        });
        notifList.querySelectorAll('.btn-link.copy').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const link = this.dataset.link;
                if (!link) return;
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
                notifications = notifications.filter(n => n.id != id);

                const el = notifList.querySelector(`.notif-card[data-id="${id}"]`);
                if (el) {
                    fadeOutAndRemove(el);
                } 

                if (notifications.length === 0) {
                    setTimeout(renderEmpty, 320);
                }

                const count = notifications.filter(n => n.is_read === 0 || n.is_read === false).length;
                updateBadge(count);
            } else {
                console.error('Erreur:', data);
            }
        } catch (error) {
            console.error('Erreur:', error);
        }
    }

    // ==========================================
    // SOCKET.IO
    // ==========================================

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
                const wasDisconnected = !isSocketConnected;
                isSocketConnected = true;
                // Si on vient de se reconnecter (pas la toute première connexion),
                // on rattrape en douceur ce qui a pu arriver pendant la coupure.
                if (wasDisconnected && !isFirstLoad) {
                    loadNotifications(false, true);
                }
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

            // 🔔 Nouvelle notification : rechargement SUBTIL (pas de flash, pas de skeleton)
            socket.on('notification', function(data) {
                console.log('🔔 Notification reçue (client):', data);
                loadNotifications(false, true);
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

            await loadNotifications(true, false);

            console.log('✅ Initialisation terminée');
        } catch (error) {
            console.error('❌ Erreur lors de l\'initialisation:', error);
        }
    })();

});