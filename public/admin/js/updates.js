document.addEventListener('DOMContentLoaded', function() {

    console.log('✅ updates.js chargé');

    // ==========================================
    // RÉFÉRENCES
    // ==========================================

    const sidebarList = document.getElementById('sidebarList');
    const sidebarCount = document.getElementById('sidebarCount');
    const statTotal = document.getElementById('statTotal');
    const statSuccess = document.getElementById('statSuccess');
    const statFailed = document.getElementById('statFailed');
    const statLatest = document.getElementById('statLatest');
    const footerInfo = document.getElementById('footerInfo');
    const refreshBtn = document.getElementById('refreshBtn');

    const emptyState = document.getElementById('emptyState');
    const detailContent = document.getElementById('detailContent');
    const detailStatus = document.getElementById('detailStatus');
    const detailSha = document.getElementById('detailSha');
    const detailDuration = document.getElementById('detailDuration');
    const detailTrigger = document.getElementById('detailTrigger');
    const detailDate = document.getElementById('detailDate');
    const detailMessage = document.getElementById('detailMessage');
    const detailLink = document.getElementById('detailLink');

    let deploys = [];
    let selectedIndex = -1;
    let isRefreshing = false;

    // ==========================================
    // NOM ADMIN
    // ==========================================

    const adminName = localStorage.getItem('adminName') || 'Admin';
    document.getElementById('adminName').textContent = adminName;

    // ==========================================
    // FORMATER LES DATES
    // ==========================================

    function formatDate(dateStr) {
        if (!dateStr) return '-';
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return '-';
            return date.toLocaleDateString('fr-FR') + ' ' +
                   date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        } catch (e) {
            return '-';
        }
    }

    // ==========================================
    // TOAST
    // ==========================================

    function showToast(message, type = 'info') {
        const colors = {
            success: '#0E7A49',
            error: '#C0342A',
            info: '#10141F',
            warning: '#B45309'
        };

        let container = document.querySelector('.toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = 'toast ' + type;
        toast.textContent = message;
        toast.style.cssText = `
            background: ${colors[type] || '#10141F'};
            color: white;
            padding: 13px 22px;
            border-radius: 11px;
            font-weight: 600;
            font-size: 13.5px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            animation: slideInRight 0.25s ease;
            max-width: 400px;
            pointer-events: auto;
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(16px)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    // ==========================================
    // CHARGER LES DÉPLOIEMENTS
    // ==========================================

    async function loadDeploys() {
        try {
            const res = await fetch('/api/admin/deploys');
            const data = await res.json();

            if (res.ok && data.success) {
                deploys = data.deploys || [];
                renderSidebar();
                renderStats();

                // Sélectionner le premier élément si disponible
                if (deploys.length > 0) {
                    if (selectedIndex === -1 || selectedIndex >= deploys.length) {
                        selectedIndex = 0;
                    }
                    selectDeploy(selectedIndex);
                } else {
                    showEmpty();
                }
            } else {
                deploys = [];
                renderSidebar();
                renderStats();
                showEmpty('Erreur de chargement');
            }
        } catch (error) {
            console.error('Erreur chargement déploiements:', error);
            deploys = [];
            renderSidebar();
            renderStats();
            showEmpty('Erreur de connexion');
        }
    }

    // ==========================================
    // RENDRE LA SIDEBAR
    // ==========================================

    function renderSidebar() {
        if (deploys.length === 0) {
            sidebarList.innerHTML = `
                <div class="loading-state">
                    <i class="fas fa-inbox"></i>
                    <p>Aucun déploiement</p>
                </div>
            `;
            sidebarCount.textContent = '0';
            return;
        }

        sidebarCount.textContent = deploys.length;

        let html = '';
        deploys.forEach((d, index) => {
            const isActive = index === selectedIndex;
            const statusLabels = {
                'success': { label: '✅', class: 'success' },
                'failed': { label: '❌', class: 'failed' },
                'canceled': { label: '⏹️', class: 'canceled' },
                'pending': { label: '⏳', class: 'pending' },
                'in_progress': { label: '🔨', class: 'in_progress' }
            };
            const statusInfo = statusLabels[d.status] || { label: '📌', class: 'pending' };
            const dotClass = d.status === 'success' ? 'success' :
                           d.status === 'failed' ? 'failed' :
                           d.status === 'canceled' ? 'canceled' :
                           d.status === 'pending' ? 'pending' :
                           d.status === 'in_progress' ? 'in_progress' : 'pending';

            const versionNumber = deploys.length - index;
            const dateStr = formatDate(d.created_at);

            html += `
                <div class="sidebar-item ${isActive ? 'active' : ''}" data-index="${index}">
                    <span class="item-dot ${dotClass}"></span>
                    <div class="item-info">
                        <span class="item-version">v${versionNumber}</span>
                        <span class="item-sha">${d.sha || '-'}</span>
                    </div>
                    <div class="item-right">
                        <span class="item-status ${statusInfo.class}">${statusInfo.label}</span>
                        <span class="item-date">${dateStr}</span>
                    </div>
                </div>
            `;
        });

        sidebarList.innerHTML = html;

        // Attacher les événements de clic
        document.querySelectorAll('.sidebar-item').forEach(item => {
            item.addEventListener('click', function() {
                const index = parseInt(this.dataset.index);
                if (!isNaN(index) && index !== selectedIndex) {
                    selectDeploy(index);
                }
            });
        });
    }

    // ==========================================
    // SÉLECTIONNER UN DÉPLOIEMENT
    // ==========================================

    function selectDeploy(index) {
        if (index < 0 || index >= deploys.length) return;

        selectedIndex = index;
        const deploy = deploys[index];

        // Mettre à jour la sidebar
        document.querySelectorAll('.sidebar-item').forEach((item, i) => {
            item.classList.toggle('active', i === index);
        });

        // Afficher le détail
        showDetail(deploy);
    }

    // ==========================================
    // AFFICHER LE DÉTAIL
    // ==========================================

    function showDetail(deploy) {
        emptyState.style.display = 'none';
        detailContent.style.display = 'flex';

        // Statut
        const statusLabels = {
            'success': { label: '✅ Succès', class: 'success' },
            'failed': { label: '❌ Échec', class: 'failed' },
            'canceled': { label: '⏹️ Annulé', class: 'canceled' },
            'pending': { label: '⏳ En attente', class: 'pending' },
            'in_progress': { label: '🔨 En cours', class: 'in_progress' }
        };
        const statusInfo = statusLabels[deploy.status] || { label: '📌 ' + deploy.status, class: 'pending' };
        detailStatus.textContent = statusInfo.label;
        detailStatus.className = 'status-badge ' + statusInfo.class;

        // SHA
        detailSha.textContent = deploy.sha || '-';

        // Durée
        detailDuration.textContent = deploy.duration || '-';

        // Trigger
        const triggerLabels = {
            'Auto': '🤖 Auto',
            'Manuel': '👤 Manuel',
            'Hook': '🔗 Hook',
            'API': '⚡ API'
        };
        detailTrigger.textContent = triggerLabels[deploy.trigger] || deploy.trigger || 'Manuel';

        // Date
        detailDate.textContent = formatDate(deploy.created_at);

        // Message
        detailMessage.textContent = deploy.message || 'Aucun message';

        // Lien
        if (deploy.url && deploy.url !== '#') {
            detailLink.href = deploy.url;
            detailLink.style.display = 'inline-flex';
        } else {
            detailLink.style.display = 'none';
        }
    }

    // ==========================================
    // AFFICHER VIDE
    // ==========================================

    function showEmpty(message) {
        emptyState.style.display = 'flex';
        detailContent.style.display = 'none';

        if (message) {
            const p = emptyState.querySelector('p');
            if (p) p.textContent = message;
        }
    }

    // ==========================================
    // STATS
    // ==========================================

    function renderStats() {
        const total = deploys.length;
        const successCount = deploys.filter(d => d.status === 'success').length;
        const failedCount = deploys.filter(d => d.status === 'failed').length;

        statTotal.textContent = total;
        statSuccess.textContent = successCount;
        statFailed.textContent = failedCount;

        if (deploys.length > 0) {
            const latest = deploys[0];
            statLatest.textContent = formatDate(latest.created_at);
            footerInfo.textContent = 'Dernier déploiement : ' + formatDate(latest.created_at);
        } else {
            statLatest.textContent = '-';
            footerInfo.textContent = 'Aucun déploiement';
        }
    }

    // ==========================================
    // RAFRAÎCHIR
    // ==========================================

    async function refreshDeploys() {
        if (isRefreshing) return;
        isRefreshing = true;
        refreshBtn.disabled = true;
        refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Chargement...';

        try {
            await loadDeploys();
            showToast('✅ Déploiements actualisés', 'success');
        } catch (error) {
            showToast('❌ Erreur lors du rafraîchissement', 'error');
        }

        isRefreshing = false;
        refreshBtn.disabled = false;
        refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Rafraîchir';
    }

    // ==========================================
    // SOCKET.IO - BADGES
    // ==========================================

    let socket = null;

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
                console.log('✅ Socket.IO admin (updates) connecté');
            });

            socket.on('disconnect', function() {
                console.log('❌ Socket.IO admin (updates) déconnecté');
                setTimeout(() => {
                    if (!socket?.connected) connectSocketIO();
                }, 3000);
            });

        } catch (error) {
            console.error('❌ Erreur connexion Socket.IO:', error);
            setTimeout(() => connectSocketIO(), 5000);
        }
    }

    // ==========================================
    // ÉVÉNEMENTS
    // ==========================================

    refreshBtn.addEventListener('click', refreshDeploys);

    // ==========================================
    // INITIALISATION
    // ==========================================

    // Charger les badges (admin-common)
    if (typeof updateBadges === 'function') {
        updateBadges();
    }

    loadDeploys();
    connectSocketIO();

    // Rafraîchir toutes les 60 secondes
    setInterval(() => {
        loadDeploys();
    }, 60000);

    console.log('✅ updates.js initialisé');

});