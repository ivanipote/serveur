// ==========================================
// ONGLET : COMMANDES
// ==========================================

let allCommandes = [];
let currentFilter = 'all';
let searchTerm = '';
let currentCommandeId = null;

async function loadCommandes() {
    console.log('📋 Chargement des commandes...');

    try {
        const res = await fetch('/api/admin/commandes');
        const data = await res.json();

        if (res.ok) {
            allCommandes = data;
            document.getElementById('commandesCount').textContent = data.length + ' commandes';
            renderCommandesTable();
            console.log(`✅ ${data.length} commandes chargées`);
        } else {
            document.getElementById('commandesList').innerHTML = `<tr><td colspan="7" class="empty-msg">Erreur de chargement</td></tr>`;
        }
    } catch (error) {
        console.error('❌ Erreur commandes:', error);
        document.getElementById('commandesList').innerHTML = `<tr><td colspan="7" class="empty-msg">Erreur de connexion</td></tr>`;
    }
}

// ==========================================
// RENDU DU TABLEAU
// ==========================================

function renderCommandesTable() {
    const tbody = document.getElementById('commandesList');
    const countEl = document.getElementById('filterCount');

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

    if (countEl) {
        countEl.textContent = filtered.length + ' commandes';
    }

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="empty-msg">Aucune commande trouvée.</td></tr>`;
        return;
    }

    const statusLabels = {
        'en_attente': '⏳ En attente',
        'accepter': '💳 Paiement requis',
        'refuse': '❌ Refusée',
        'annulee': '❌ Annulée',
        'paiement_effectue': '💳 Payée',
        'livraison_en_cours': '🚚 En cours',
        'disponible': '📍 Disponible',
        'recuperee': '✅ Récupérée'
    };

    tbody.innerHTML = filtered.map(c => {
        // ✅ Déterminer les actions disponibles selon le statut
        const status = c.status || 'en_attente';
        
        // ✅ Statuts "finaux" : plus d'actions
        const isFinal = ['recuperee', 'refuse', 'annulee'].includes(status);
        
        // ✅ Statuts "bloqués" : on ne peut plus revenir en arrière
        const isBlocked = ['paiement_effectue', 'livraison_en_cours', 'disponible', 'recuperee'].includes(status);
        
        // ✅ Actions disponibles
        const showMaps = true;
        const showSync = !isFinal && status !== 'paiement_effectue';
        const showStatus = !isFinal;
        const showDetail = true;

        return `
            <tr>
                <td>#${c.id}</td>
                <td style="font-size:12px;color:#888;">${c.reference || '-'}</td>
                <td>${c.nom}</td>
                <td>${(c.total || 0).toLocaleString()} FCFA</td>
                <td><span class="status-badge ${status}">${statusLabels[status] || status}</span></td>
                <td>${new Date(c.created_at).toLocaleDateString('fr-FR')}</td>
                <td>
                    ${showMaps ? `<button class="btn-action maps" onclick="openMaps(${c.latitude || 'null'}, ${c.longitude || 'null'}, ${c.id})" title="Voir sur Maps">
                        <i class="fas fa-map-marker-alt"></i>
                    </button>` : ''}
                    
                    ${showSync ? `<button class="btn-action sync" onclick="syncCommande(${c.id})" title="Synchroniser">
                        <i class="fas fa-sync-alt"></i>
                    </button>` : ''}
                    
                    ${showStatus ? `<button class="btn-action status" onclick="openStatusOverlay(${c.id})" title="Modifier statut">
                        <i class="fas fa-edit"></i>
                    </button>` : `<button class="btn-action status" style="opacity:0.4;cursor:not-allowed;" disabled title="Statut final">
                        <i class="fas fa-lock"></i>
                    </button>`}
                    
                    ${showDetail ? `<button class="btn-action detail" onclick="openDetailOverlay(${c.id})" title="Voir détails">
                        <i class="fas fa-eye"></i>
                    </button>` : ''}
                </td>
            </tr>
        `;
    }).join('');
}

// ==========================================
// FILTRES & RECHERCHE
// ==========================================

document.querySelectorAll('#filterButtons .filter-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('#filterButtons .filter-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        currentFilter = this.dataset.filter;
        renderCommandesTable();
    });
});

document.getElementById('searchCommande').addEventListener('input', function() {
    searchTerm = this.value.trim();
    renderCommandesTable();
});

document.getElementById('refreshCommandesBtn').addEventListener('click', function() {
    loadCommandes();
});

// ==========================================
// BOUTON MAPS
// ==========================================

function openMaps(lat, lon, id) {
    if (lat && lon) {
        window.open(`https://www.google.com/maps?q=${lat},${lon}`, '_blank');
    } else {
        alert(`📍 Aucune position GPS pour la commande #${id}`);
    }
}

// ==========================================
// BOUTON SYNC (CORRIGÉ)
// ==========================================

async function syncCommande(commandeId) {
    try {
        const res = await fetch(`https://nature-plus-pay.onrender.com/api/payment/check/${commandeId}`);
        
        if (!res.ok) {
            alert('⚠️ Service de paiement indisponible');
            return;
        }

        const data = await res.json();

        if (data.success && data.status === 'success') {
            const updateRes = await fetch('https://nature-plus-pay.onrender.com/api/payment/update-status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ commandeId, status: 'paiement_effectue' })
            });
            if (updateRes.ok) {
                alert('✅ Paiement synchronisé !');
                loadCommandes();
            } else {
                alert('⚠️ Erreur lors de la mise à jour');
            }
        } else if (data.status === 'pending') {
            alert('⏳ Paiement en attente...');
        } else if (data.status === 'not_found') {
            alert('ℹ️ Aucun paiement trouvé pour cette commande');
        } else {
            alert('ℹ️ Statut: ' + (data.status || 'inconnu'));
        }
    } catch (error) {
        console.error('Erreur sync:', error);
        alert('❌ Erreur de synchronisation');
    }
}

// ==========================================
// OVERLAY STATUT (avec sécurisation)
// ==========================================

function openStatusOverlay(commandeId) {
    const commande = allCommandes.find(c => c.id === commandeId);
    if (!commande) {
        alert('❌ Commande non trouvée');
        return;
    }

    const currentStatus = commande.status || 'en_attente';
    
    // ✅ Déterminer les statuts disponibles selon le statut actuel
    let availableStatuses = [];
    
    if (currentStatus === 'en_attente') {
        availableStatuses = ['accepter', 'refuse'];
    } else if (currentStatus === 'accepter') {
        availableStatuses = ['paiement_effectue', 'refuse'];
    } else if (currentStatus === 'paiement_effectue') {
        availableStatuses = ['livraison_en_cours'];
    } else if (currentStatus === 'livraison_en_cours') {
        availableStatuses = ['disponible'];
    } else if (currentStatus === 'disponible') {
        availableStatuses = ['recuperee'];
    } else {
        // Statuts finaux : plus d'actions
        alert('⚠️ Cette commande est dans un statut final. Aucune modification possible.');
        return;
    }

    currentCommandeId = commandeId;
    document.getElementById('statusCommandeId').textContent = commandeId;
    document.getElementById('statusClientInfo').textContent = 'Client: ' + commande.nom;
    
    // ✅ Remplir le select avec les statuts disponibles
    const select = document.getElementById('statusSelect');
    select.innerHTML = '';
    
    const statusLabels = {
        'accepter': '💳 Paiement requis',
        'refuse': '❌ Refusée',
        'paiement_effectue': '💳 Payée',
        'livraison_en_cours': '🚚 En cours',
        'disponible': '📍 Disponible',
        'recuperee': '✅ Récupérée'
    };
    
    availableStatuses.forEach(s => {
        const option = document.createElement('option');
        option.value = s;
        option.textContent = statusLabels[s] || s;
        select.appendChild(option);
    });
    
    document.getElementById('causeRefusGroup').style.display = 'none';
    document.getElementById('statusOverlay').classList.add('active');
}

document.getElementById('closeStatusOverlay').addEventListener('click', function() {
    document.getElementById('statusOverlay').classList.remove('active');
});

document.getElementById('statusSelect').addEventListener('change', function() {
    document.getElementById('causeRefusGroup').style.display = this.value === 'refuse' ? 'block' : 'none';
});

document.getElementById('saveStatusBtn').addEventListener('click', async function() {
    const status = document.getElementById('statusSelect').value;
    const cause = document.getElementById('causeRefus').value.trim();

    if (status === 'refuse' && !cause) {
        alert('⚠️ Veuillez indiquer une cause pour le refus.');
        return;
    }

    try {
        const res = await fetch('/api/admin/commande/status', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ commandeId: currentCommandeId, status, causeRefus: cause || null })
        });

        if (res.ok) {
            alert('✅ Statut mis à jour !');
            document.getElementById('statusOverlay').classList.remove('active');
            loadCommandes();
        } else {
            const data = await res.json();
            alert('❌ ' + (data.error || 'Erreur'));
        }
    } catch (error) {
        console.error('Erreur:', error);
        alert('❌ Erreur de connexion');
    }
});

document.getElementById('cancelStatusBtn').addEventListener('click', function() {
    document.getElementById('statusOverlay').classList.remove('active');
});

// ==========================================
// OVERLAY DÉTAIL COMMANDE
// ==========================================

async function openDetailOverlay(commandeId) {
    try {
        const commande = allCommandes.find(c => c.id === commandeId);

        if (!commande) {
            alert('❌ Commande non trouvée');
            return;
        }

        let panier = [];
        try {
            panier = JSON.parse(commande.panier || '[]');
        } catch (e) {
            panier = [];
        }

        const statusLabels = {
            'en_attente': '⏳ En attente',
            'accepter': '💳 Paiement requis',
            'refuse': '❌ Refusée',
            'annulee': '❌ Annulée',
            'paiement_effectue': '💳 Payée',
            'livraison_en_cours': '🚚 En cours',
            'disponible': '📍 Disponible',
            'recuperee': '✅ Récupérée'
        };

        const productsHtml = panier.map(p => `
            <div class="product-item">
                <span class="name">${p.name || 'Produit'}</span>
                <span class="qty">× ${p.quantity || 1}</span>
                <span class="price">${((p.price || 0) * (p.quantity || 1)).toLocaleString()} FCFA</span>
            </div>
        `).join('') || '<p style="color:#888;font-size:13px;">Aucun produit</p>';

        const gpsHtml = (commande.latitude && commande.longitude) ?
            `<a href="https://www.google.com/maps?q=${commande.latitude},${commande.longitude}" target="_blank" class="detail-gps-link">
                <i class="fas fa-map-marker-alt"></i> Voir sur Google Maps
            </a>` :
            '<span style="color:#888;">Non renseigné</span>';

        document.getElementById('detailContent').innerHTML = `
            <div class="detail-section">
                <div class="section-title">📋 Informations générales</div>
                <div class="detail-row"><span class="label">ID</span><span class="value">#${commande.id}</span></div>
                <div class="detail-row"><span class="label">Référence</span><span class="value" style="font-size:13px;color:#888;">${commande.reference || '-'}</span></div>
                <div class="detail-row"><span class="label">Date</span><span class="value">${new Date(commande.created_at).toLocaleString()}</span></div>
                <div class="detail-row"><span class="label">Statut</span><span class="value"><span class="status-badge ${commande.status}">${statusLabels[commande.status] || commande.status}</span></span></div>
                ${commande.cause_refus ? `<div class="detail-row"><span class="label">Cause refus</span><span class="value" style="color:#e74c3c;">${commande.cause_refus}</span></div>` : ''}
            </div>

            <div class="detail-section">
                <div class="section-title">👤 Client</div>
                <div class="detail-row"><span class="label">Nom</span><span class="value">${commande.nom}</span></div>
                <div class="detail-row"><span class="label">Téléphone</span><span class="value">${commande.telephone || '-'}</span></div>
                <div class="detail-row"><span class="label">Code secret</span><span class="value" style="letter-spacing:2px;color:#888;">${commande.code_login || '••••'}</span></div>
            </div>

            <div class="detail-section">
                <div class="section-title">📍 Livraison</div>
                <div class="detail-row"><span class="label">Option</span><span class="value">${commande.option === 'chezmoi' ? '📍 Chez moi' : '✏️ Adresse'}</span></div>
                <div class="detail-row"><span class="label">Commune</span><span class="value">${commande.commune || '-'}</span></div>
                <div class="detail-row"><span class="label">Quartier</span><span class="value">${commande.quartier || '-'}</span></div>
                <div class="detail-row"><span class="label">Précision</span><span class="value">${commande.precision || '-'}</span></div>
                <div class="detail-row"><span class="label">GPS</span><span class="value">${gpsHtml}</span></div>
            </div>

            <div class="detail-section">
                <div class="section-title">📦 Produits</div>
                <div class="detail-products">${productsHtml}</div>
            </div>

            <div class="detail-section">
                <div class="detail-total">
                    <span>Total</span>
                    <span class="total-value">${(commande.total || 0).toLocaleString()} FCFA</span>
                </div>
                ${commande.frais_livraison ? `<div style="display:flex;justify-content:space-between;font-size:13px;color:#888;padding:4px 0;"><span>Frais de livraison</span><span>${commande.frais_livraison.toLocaleString()} FCFA</span></div>` : ''}
            </div>
        `;

        document.getElementById('detailOverlay').classList.add('active');

    } catch (error) {
        console.error('Erreur détail:', error);
        alert('❌ Erreur de chargement du détail');
    }
}

document.getElementById('closeDetailOverlay').addEventListener('click', function() {
    document.getElementById('detailOverlay').classList.remove('active');
});

// ==========================================
// EXPOSER LA FONCTION
// ==========================================

window.loadCommandes = loadCommandes;

console.log('✅ commandes.js chargé');