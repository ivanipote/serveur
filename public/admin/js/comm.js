document.addEventListener('DOMContentLoaded', function() {

    console.log('✅ comm.js chargé');

    // ==========================================
    // RÉFÉRENCES
    // ==========================================

    const commandesList = document.getElementById('commandesList');
    const filterButtons = document.querySelectorAll('.filter-btn');
    const searchInput = document.getElementById('searchCommande');
    const filterCount = document.getElementById('filterCount');
    const refreshBtn = document.getElementById('refreshBtn');

    const overlay = document.getElementById('commandeOverlay');
    const closeOverlay = document.getElementById('closeOverlay');
    const closeOverlayBtn = document.getElementById('closeOverlayBtn');
    const overlayTitle = document.getElementById('overlayTitle');

    const sidebarTabs = document.querySelectorAll('.sidebar-tab');
    const tabContents = document.querySelectorAll('.tab-content');

    // Références des onglets
    const dId = document.getElementById('dId');
    const dRef = document.getElementById('dRef');
    const dClient = document.getElementById('dClient');
    const dPhone = document.getElementById('dPhone');
    const dTotal = document.getElementById('dTotal');
    const dStatus = document.getElementById('dStatus');
    const dProduits = document.getElementById('dProduits');
    const dDate = document.getElementById('dDate');

    const sCurrent = document.getElementById('sCurrent');
    const statutMessage = document.getElementById('statutMessage');
    const statutActions = document.getElementById('statutActions');
    const statutMessageResult = document.getElementById('statutMessageResult');

    const paylinkUrl = document.getElementById('paylinkUrl');

    const pCommune = document.getElementById('pCommune');
    const pQuartier = document.getElementById('pQuartier');
    const pRue = document.getElementById('pRue');
    const pOption = document.getElementById('pOption');
    const pGps = document.getElementById('pGps');
    const openMapsBtn = document.getElementById('openMapsBtn');

    const msgTitle = document.getElementById('msgTitle');
    const msgContent = document.getElementById('msgContent');
    const sendMsgBtn = document.getElementById('sendMsgBtn');
    const msgResult = document.getElementById('msgResult');

    const adminCode = document.getElementById('adminCode');
    const verifyAdminBtn = document.getElementById('verifyAdminBtn');
    const urgenceStatus = document.getElementById('urgenceStatus');
    const urgenceActions = document.getElementById('urgenceActions');
    const urgenceResult = document.getElementById('urgenceResult');

    const copyAllBtn = document.getElementById('copyAllBtn');
    const copyPayLinkBtn = document.getElementById('copyPayLinkBtn');

    let allCommandes = [];
    let currentFilter = 'all';
    let searchTerm = '';
    let currentCommandeId = null;
    let currentCommandeData = null;
    let isAdminVerified = false;

    // ==========================================
    // VÉRIFICATION CONNEXION ADMIN
    // ==========================================

    function checkAdminAuth() {
        const adminToken = localStorage.getItem('adminToken');
        if (!adminToken) {
            window.location.href = '/admin/login';
            return false;
        }
        return true;
    }

    // ==========================================
    // CHARGER LES COMMANDES
    // ==========================================

    async function loadCommandes() {
        try {
            const res = await fetch('/api/admin/commandes');
            const data = await res.json();

            if (res.ok) {
                allCommandes = data;
                document.getElementById('commandesTotal').textContent = data.length;
                renderCommandes();
            } else {
                commandesList.innerHTML = `<tr><td colspan="7" class="empty-msg">Erreur de chargement</td></tr>`;
            }
        } catch (error) {
            console.error('Erreur:', error);
            commandesList.innerHTML = `<tr><td colspan="7" class="empty-msg">Erreur de connexion</td></tr>`;
        }
    }

    // ==========================================
    // RENDRE LES COMMANDES
    // ==========================================

    function renderCommandes() {
        const labels = {
            'en_attente': '⏳ En attente',
            'accepter': '💳 Paiement requis',
            'paiement_effectue': '✅ Payée',
            'livraison_en_cours': '🚚 En cours',
            'disponible': '📍 Disponible',
            'recuperee': '✅ Récupérée',
            'refuse': '❌ Refusée',
            'annulee': '❌ Annulée'
        };

        let filtered = allCommandes;

        if (currentFilter !== 'all') {
            filtered = filtered.filter(c => c.status === currentFilter);
        }

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(c =>
                c.id.toString().includes(term) ||
                (c.reference && c.reference.toLowerCase().includes(term)) ||
                c.nom.toLowerCase().includes(term) ||
                (c.telephone && c.telephone.includes(term))
            );
        }

        filterCount.textContent = filtered.length + ' commandes';

        if (filtered.length === 0) {
            commandesList.innerHTML = `<tr><td colspan="7" class="empty-msg">Aucune commande trouvée.</td></tr>`;
            return;
        }

        const dateOptions = { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' };

        commandesList.innerHTML = filtered.map(c => `
            <tr data-id="${c.id}">
                <td>#${c.id}</td>
                <td style="font-size:12px;color:var(--ink-400);font-family:var(--font-mono);">${c.reference || '-'}</td>
                <td>${c.nom}</td>
                <td>${(c.total || 0).toLocaleString()} FCFA</td>
                <td><span class="status-badge ${c.status}">${labels[c.status] || c.status}</span></td>
                <td>${new Date(c.created_at).toLocaleDateString('fr-FR', dateOptions)}</td>
                <td>
                    <button class="btn-action" onclick="openCommande(${c.id})">
                        <i class="fas fa-eye"></i> Voir
                    </button>
                </td>
            </tr>
        `).join('');
    }

    // ==========================================
    // FILTRES & RECHERCHE
    // ==========================================

    filterButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            filterButtons.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentFilter = this.dataset.filter;
            renderCommandes();
        });
    });

    searchInput.addEventListener('input', function() {
        searchTerm = this.value.trim();
        renderCommandes();
    });

    refreshBtn.addEventListener('click', function() {
        loadCommandes();
    });

    // ==========================================
    // OVERLAY : OUVRIR UNE COMMANDE
    // ==========================================

    window.openCommande = function(commandeId) {
        const commande = allCommandes.find(c => c.id === commandeId);
        if (!commande) {
            alert('❌ Commande non trouvée');
            return;
        }

        currentCommandeId = commandeId;
        currentCommandeData = commande;
        isAdminVerified = false;

        // Titre
        overlayTitle.textContent = `📦 Commande #${commandeId} - ${commande.nom}`;

        // Remplir les détails
        dId.textContent = `#${commande.id}`;
        dId.style.color = '#2563EB';
        dId.style.fontWeight = '600';

        dRef.textContent = commande.reference || '-';
        dRef.style.color = '#17A464';
        dRef.style.fontWeight = '600';

        dClient.textContent = commande.nom || '-';
        dClient.style.color = '#10141F';

        dPhone.textContent = commande.telephone || '-';
        dPhone.style.color = '#10141F';

        dTotal.textContent = (commande.total || 0).toLocaleString() + ' FCFA';
        dTotal.style.color = '#0E7A49';
        dTotal.style.fontWeight = '700';
        dTotal.style.fontSize = '16px';

        dStatus.textContent = commande.status || '-';
        dStatus.className = 'value status-badge ' + commande.status;

        dDate.textContent = new Date(commande.created_at).toLocaleString('fr-FR');
        dDate.style.color = '#9CA3AF';

        // Produits
        let produits = [];
        try {
            produits = JSON.parse(commande.panier || '[]');
        } catch (e) {
            produits = [];
        }
        if (produits.length > 0) {
            dProduits.textContent = produits.map(p => `${p.name} × ${p.quantity}`).join(', ');
        } else {
            dProduits.textContent = 'Aucun produit';
        }

        // Mettre à jour les boutons copier
        document.querySelectorAll('.detail-item .copy-btn-mini').forEach(btn => {
            const parent = btn.closest('.detail-item');
            const valueEl = parent.querySelector('.value');
            if (valueEl) {
                btn.dataset.copy = valueEl.textContent.trim();
            }
        });

        // Statut
        updateStatutTab(commande);

        // Pay Link
        const geniusRef = commande.genius_reference || commande.reference || '';
        if (geniusRef) {
            paylinkUrl.textContent = `https://geniuspay.ci/checkout/${geniusRef}`;
        } else {
            paylinkUrl.textContent = 'Aucun lien de paiement disponible';
        }

        // Position
        pCommune.textContent = commande.commune || '-';
        pQuartier.textContent = commande.quartier || '-';
        pRue.textContent = commande.precision || '-';
        pOption.textContent = commande.option === 'chezmoi' ? '📍 Chez moi' : '✏️ Adresse';

        if (commande.latitude && commande.longitude) {
            pGps.textContent = `${commande.latitude}, ${commande.longitude}`;
            openMapsBtn.style.display = 'inline-flex';
            openMapsBtn.dataset.mode = 'coords';
            openMapsBtn.dataset.lat = commande.latitude;
            openMapsBtn.dataset.lon = commande.longitude;
        } else {
            const adresse = `${commande.commune || ''} ${commande.quartier || ''} ${commande.precision || ''}`.trim();
            if (adresse) {
                pGps.textContent = 'Recherche par adresse disponible';
                openMapsBtn.style.display = 'inline-flex';
                openMapsBtn.dataset.mode = 'search';
                openMapsBtn.dataset.adresse = encodeURIComponent(adresse + ' Abidjan');
            } else {
                pGps.textContent = 'Non renseigné';
                openMapsBtn.style.display = 'none';
            }
        }

        // Reset message
        msgTitle.value = '';
        msgContent.value = '';
        msgResult.className = 'msg-result';
        msgResult.textContent = '';
        msgResult.style.display = 'none';

        // Reset urgence
        adminCode.value = '';
        adminCode.disabled = false;
        verifyAdminBtn.style.display = 'inline-flex';
        urgenceStatus.className = 'urgence-status';
        urgenceStatus.textContent = '';
        urgenceStatus.style.display = 'none';
        urgenceActions.style.display = 'none';
        urgenceResult.className = 'urgence-result';
        urgenceResult.textContent = '';
        urgenceResult.style.display = 'none';
        isAdminVerified = false;

        // Reset tabs
        sidebarTabs.forEach(tab => tab.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));
        document.querySelector('.sidebar-tab[data-tab="detail"]').classList.add('active');
        document.getElementById('tab-detail').classList.add('active');

        // Afficher l'overlay
        overlay.classList.add('active');
    };

    // ==========================================
    // OVERLAY : FERMER
    // ==========================================

    function closeOverlayFn() {
        overlay.classList.remove('active');
    }

    closeOverlay.addEventListener('click', closeOverlayFn);
    closeOverlayBtn.addEventListener('click', closeOverlayFn);
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) closeOverlayFn();
    });

    // ==========================================
    // OVERLAY : TABS
    // ==========================================

    sidebarTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            sidebarTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');

            const tabId = this.dataset.tab;
            tabContents.forEach(content => content.classList.remove('active'));
            document.getElementById('tab-' + tabId).classList.add('active');
        });
    });

    // ==========================================
    // TAB : STATUT (avec grisage des précédents)
    // ==========================================

    function updateStatutTab(commande) {
        const labels = {
            'en_attente': '⏳ En attente',
            'accepter': '💳 Paiement requis',
            'paiement_effectue': '✅ Payée',
            'livraison_en_cours': '🚚 En cours',
            'disponible': '📍 Disponible',
            'recuperee': '✅ Récupérée',
            'refuse': '❌ Refusée',
            'annulee': '❌ Annulée'
        };

        sCurrent.textContent = labels[commande.status] || commande.status;
        sCurrent.className = 'status-badge ' + commande.status;

        // Message si en attente
        if (commande.status === 'en_attente') {
            statutMessage.style.display = 'flex';
        } else {
            statutMessage.style.display = 'none';
        }

        // ✅ ORDRE DES STATUTS
        const statusOrder = ['en_attente', 'accepter', 'paiement_effectue', 'livraison_en_cours', 'disponible', 'recuperee', 'refuse', 'annulee'];
        const currentIndex = statusOrder.indexOf(commande.status);

        const statusBtns = statutActions.querySelectorAll('.btn-status-change');
        statusBtns.forEach(btn => {
            const btnStatus = btn.dataset.status;
            const btnIndex = statusOrder.indexOf(btnStatus);

            // ✅ Statut avant le statut actuel → grisé et désactivé (sauf refuse et annulee)
            if (btnIndex < currentIndex && btnStatus !== 'refuse' && btnStatus !== 'annulee') {
                btn.disabled = true;
                btn.style.opacity = '0.4';
                btn.style.cursor = 'not-allowed';
                btn.classList.remove('active');
            } else {
                btn.disabled = false;
                btn.style.opacity = '1';
                btn.style.cursor = 'pointer';
                btn.classList.toggle('active', btnStatus === commande.status);
            }
        });

        // Reset résultat
        statutMessageResult.className = 'statut-message-result';
        statutMessageResult.textContent = '';
        statutMessageResult.style.display = 'none';
    }

    // ==========================================
    // CHANGEMENT DE STATUT
    // ==========================================

    document.querySelectorAll('.statut-actions .btn-status-change').forEach(btn => {
        btn.addEventListener('click', async function() {
            const newStatus = this.dataset.status;
            const commandeId = currentCommandeId;

            if (!commandeId) return;

            if (!confirm(`Changer le statut de la commande #${commandeId} vers "${this.textContent.trim()}" ?`)) return;

            try {
                const res = await fetch('/api/admin/commande/status', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        commandeId: commandeId,
                        status: newStatus,
                        causeRefus: newStatus === 'refuse' ? 'Refusé par l\'admin' : null
                    })
                });

                const data = await res.json();

                if (res.ok) {
                    statutMessageResult.className = 'statut-message-result success';
                    statutMessageResult.textContent = '✅ Statut mis à jour avec succès !';
                    statutMessageResult.style.display = 'block';

                    const cmd = allCommandes.find(c => c.id === commandeId);
                    if (cmd) cmd.status = newStatus;

                    updateStatutTab({ ...currentCommandeData, status: newStatus });
                    renderCommandes();

                    if (window.updateBadges) window.updateBadges();

                } else {
                    statutMessageResult.className = 'statut-message-result error';
                    statutMessageResult.textContent = '❌ ' + (data.error || 'Erreur');
                    statutMessageResult.style.display = 'block';
                }
            } catch (error) {
                statutMessageResult.className = 'statut-message-result error';
                statutMessageResult.textContent = '❌ Erreur de connexion';
                statutMessageResult.style.display = 'block';
            }
        });
    });

    // ==========================================
    // TAB : COPY ALL
    // ==========================================

    copyAllBtn.addEventListener('click', function() {
        const data = currentCommandeData;
        if (!data) return;

        let produits = [];
        try {
            produits = JSON.parse(data.panier || '[]');
        } catch (e) {
            produits = [];
        }
        const produitsText = produits.map(p => `${p.name} × ${p.quantity} = ${(p.price * p.quantity).toLocaleString()} FCFA`).join('\n');

        const text = `
📋 COMMANDE #${data.id}
📌 Référence: ${data.reference || '-'}
👤 Client: ${data.nom || '-'}
📱 Téléphone: ${data.telephone || '-'}
💰 Total: ${(data.total || 0).toLocaleString()} FCFA
📊 Statut: ${data.status || '-'}
📅 Date: ${new Date(data.created_at).toLocaleString('fr-FR')}

📦 Produits:
${produitsText || 'Aucun produit'}

📍 Livraison:
- Option: ${data.option === 'chezmoi' ? 'Chez moi' : 'Adresse'}
- Commune: ${data.commune || '-'}
- Quartier: ${data.quartier || '-'}
- Précision: ${data.precision || '-'}
- GPS: ${data.latitude && data.longitude ? `${data.latitude}, ${data.longitude}` : 'Non renseigné'}
        `.trim();

        navigator.clipboard.writeText(text).then(() => {
            this.innerHTML = '<i class="fas fa-check"></i> Copié !';
            setTimeout(() => {
                this.innerHTML = '<i class="fas fa-copy"></i> Copier toutes les infos';
            }, 2000);
        }).catch(() => {
            alert('❌ Erreur de copie');
        });
    });

    // ==========================================
    // TAB : COPY PAY LINK
    // ==========================================

    copyPayLinkBtn.addEventListener('click', function() {
        const url = paylinkUrl.textContent;
        if (!url || url === 'Aucun lien de paiement disponible') {
            alert('⚠️ Aucun lien à copier');
            return;
        }

        navigator.clipboard.writeText(url).then(() => {
            this.innerHTML = '<i class="fas fa-check"></i> Copié !';
            setTimeout(() => {
                this.innerHTML = '<i class="fas fa-copy"></i> Copier le lien';
            }, 2000);
        }).catch(() => {
            alert('❌ Erreur de copie');
        });
    });

    // ==========================================
    // TAB : OPEN MAPS
    // ==========================================

    openMapsBtn.addEventListener('click', function() {
        const mode = this.dataset.mode;

        if (mode === 'coords') {
            const lat = this.dataset.lat;
            const lon = this.dataset.lon;
            if (lat && lon) {
                window.open(`https://www.google.com/maps?q=${lat},${lon}`, '_blank');
            }
        } else if (mode === 'search') {
            const adresse = this.dataset.adresse;
            if (adresse) {
                window.open(`https://www.google.com/maps/search/${adresse}`, '_blank');
            }
        }
    });

    // ==========================================
    // TAB : MESSAGE
    // ==========================================

    sendMsgBtn.addEventListener('click', async function() {
        const title = msgTitle.value.trim();
        const content = msgContent.value.trim();

        if (!title || !content) {
            msgResult.className = 'msg-result error';
            msgResult.textContent = '⚠️ Titre et contenu requis';
            msgResult.style.display = 'block';
            return;
        }

        const userId = currentCommandeData?.user_id;
        if (!userId) {
            msgResult.className = 'msg-result error';
            msgResult.textContent = '❌ Utilisateur non trouvé';
            msgResult.style.display = 'block';
            return;
        }

        this.disabled = true;
        this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Envoi...';

        try {
            const res = await fetch('/api/admin/notification/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: userId,
                    title: title,
                    content: content
                })
            });

            const data = await res.json();

            if (res.ok) {
                msgResult.className = 'msg-result success';
                msgResult.textContent = '✅ Message envoyé avec succès !';
                msgResult.style.display = 'block';
                msgTitle.value = '';
                msgContent.value = '';
            } else {
                msgResult.className = 'msg-result error';
                msgResult.textContent = '❌ ' + (data.error || 'Erreur');
                msgResult.style.display = 'block';
            }
        } catch (error) {
            msgResult.className = 'msg-result error';
            msgResult.textContent = '❌ Erreur de connexion';
            msgResult.style.display = 'block';
        }

        this.disabled = false;
        this.innerHTML = '<i class="fas fa-paper-plane"></i> Envoyer';
    });

    // ==========================================
    // TAB : URGENCE (avec vérification via /api/admin/login)
    // ==========================================

    verifyAdminBtn.addEventListener('click', async function() {
        const code = adminCode.value.trim();

        if (!code) {
            urgenceStatus.className = 'urgence-status error';
            urgenceStatus.textContent = '⚠️ Veuillez entrer votre mot de passe admin';
            urgenceStatus.style.display = 'block';
            return;
        }

        this.disabled = true;
        this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Vérification...';

        try {
            // ✅ Récupérer l'email admin stocké dans localStorage
            const adminEmail = localStorage.getItem('adminEmail');

            if (!adminEmail) {
                urgenceStatus.className = 'urgence-status error';
                urgenceStatus.textContent = '❌ Email admin non trouvé. Veuillez vous reconnecter.';
                urgenceStatus.style.display = 'block';
                this.disabled = false;
                this.innerHTML = '<i class="fas fa-unlock"></i> Vérifier';
                return;
            }

            // ✅ Utiliser la route /api/admin/login
            const res = await fetch('/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: adminEmail, password: code })
            });

            const data = await res.json();

            if (data.success) {
                isAdminVerified = true;
                urgenceStatus.className = 'urgence-status success';
                urgenceStatus.textContent = '✅ Mot de passe admin vérifié ! Vous pouvez changer le statut.';
                urgenceStatus.style.display = 'block';
                urgenceActions.style.display = 'block';
                adminCode.disabled = true;
                this.style.display = 'none';
            } else {
                urgenceStatus.className = 'urgence-status error';
                urgenceStatus.textContent = '❌ Mot de passe incorrect';
                urgenceStatus.style.display = 'block';
            }
        } catch (error) {
            console.error('Erreur vérification admin:', error);
            urgenceStatus.className = 'urgence-status error';
            urgenceStatus.textContent = '❌ Erreur de connexion';
            urgenceStatus.style.display = 'block';
        }

        this.disabled = false;
        this.innerHTML = '<i class="fas fa-unlock"></i> Vérifier';
    });

    // Changement de statut en urgence
    document.querySelectorAll('#urgenceActions .btn-status-change').forEach(btn => {
        btn.addEventListener('click', async function() {
            if (!isAdminVerified) {
                urgenceResult.className = 'urgence-result error';
                urgenceResult.textContent = '⚠️ Veuillez d\'abord vérifier votre mot de passe admin';
                urgenceResult.style.display = 'block';
                return;
            }

            const newStatus = this.dataset.status;
            const commandeId = currentCommandeId;

            if (!commandeId) return;

            if (!confirm(`⚠️ URGENCE : Changer le statut de la commande #${commandeId} vers "${this.textContent.trim()}" ?`)) return;

            try {
                const res = await fetch('/api/admin/commande/status', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        commandeId: commandeId,
                        status: newStatus,
                        causeRefus: newStatus === 'refuse' ? 'Refusé par l\'admin (urgence)' : null
                    })
                });

                const data = await res.json();

                if (res.ok) {
                    urgenceResult.className = 'urgence-result success';
                    urgenceResult.textContent = '✅ Statut mis à jour avec succès !';
                    urgenceResult.style.display = 'block';

                    const cmd = allCommandes.find(c => c.id === commandeId);
                    if (cmd) cmd.status = newStatus;

                    updateStatutTab({ ...currentCommandeData, status: newStatus });
                    renderCommandes();

                    if (window.updateBadges) window.updateBadges();

                } else {
                    urgenceResult.className = 'urgence-result error';
                    urgenceResult.textContent = '❌ ' + (data.error || 'Erreur');
                    urgenceResult.style.display = 'block';
                }
            } catch (error) {
                urgenceResult.className = 'urgence-result error';
                urgenceResult.textContent = '❌ Erreur de connexion';
                urgenceResult.style.display = 'block';
            }
        });
    });

    // ==========================================
    // COPY BTN MINI (détail)
    // ==========================================

    document.querySelectorAll('.detail-item .copy-btn-mini').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const text = this.dataset.copy || '';
            if (text && text !== '-') {
                navigator.clipboard.writeText(text).then(() => {
                    this.classList.add('copied');
                    this.innerHTML = '<i class="fas fa-check"></i>';
                    setTimeout(() => {
                        this.classList.remove('copied');
                        this.innerHTML = '<i class="fas fa-copy"></i>';
                    }, 1500);
                }).catch(() => {
                    const input = document.createElement('input');
                    input.value = text;
                    document.body.appendChild(input);
                    input.select();
                    document.execCommand('copy');
                    document.body.removeChild(input);
                    this.classList.add('copied');
                    this.innerHTML = '<i class="fas fa-check"></i>';
                    setTimeout(() => {
                        this.classList.remove('copied');
                        this.innerHTML = '<i class="fas fa-copy"></i>';
                    }, 1500);
                });
            }
        });
    });

    // ==========================================
    // INITIALISATION
    // ==========================================

    // Vérifier l'authentification admin
    if (!checkAdminAuth()) return;

    // Exposer openCommande globalement
    window.openCommande = window.openCommande;

    // Charger les commandes
    loadCommandes();

    // Mise à jour périodique
    setInterval(() => {
        if (!document.querySelector('.commande-overlay.active')) {
            loadCommandes();
        }
    }, 30000);

    console.log('✅ comm.js initialisé');

});