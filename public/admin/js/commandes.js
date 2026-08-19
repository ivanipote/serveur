// ==========================================
// ONGLET : COMMANDES (avec Socket.IO)
// ==========================================

let allCommandes = [];
let currentFilter = 'all';
let searchTerm = '';
let currentCommandeId = null;
let socket = null;
let isSocketConnected = false;

// ==========================================
// SOCKET.IO - Connexion
// ==========================================

function connectSocketIO() {
    if (socket) {
        socket.disconnect();
        socket = null;
    }

    console.log('🔌 Connexion Socket.IO admin...');

    try {
        const adminId = localStorage.getItem('adminId') || '1';
        
        socket = io({
            auth: {
                userId: parseInt(adminId),
                isAdmin: true
            }
        });

        socket.on('connect', function() {
            console.log('✅ Socket.IO admin connecté');
            isSocketConnected = true;
        });

        socket.on('disconnect', function() {
            console.log('❌ Socket.IO admin déconnecté');
            isSocketConnected = false;
            setTimeout(() => {
                if (!isSocketConnected) {
                    connectSocketIO();
                }
            }, 3000);
        });

        socket.on('nouvelle-commande', function(data) {
            console.log('🆕 Nouvelle commande reçue:', data);
            handleNouvelleCommande(data);
        });

        socket.on('commande-update', function(data) {
            console.log('📦 Mise à jour commande reçue:', data);
            handleCommandeUpdate(data);
        });

    } catch (error) {
        console.error('❌ Erreur connexion Socket.IO:', error);
        setTimeout(() => connectSocketIO(), 5000);
    }
}

// ==========================================
// GESTION DES ÉVÉNEMENTS
// ==========================================

function handleNouvelleCommande(data) {
    console.log('🆕 Nouvelle commande:', data);
    
    // Recharger toutes les commandes pour avoir les données complètes
    loadCommandes();
    
    // Afficher un toast
    showToast(`🆕 Nouvelle commande #${data.commandeId} de ${data.nom}`, 'success');
}

function handleCommandeUpdate(data) {
    console.log('📦 Mise à jour commande:', data);

    const { commandeId, status, userId, message } = data;

    // 1. Mettre à jour la commande dans le tableau local
    const existingIndex = allCommandes.findIndex(c => c.id === commandeId);

    if (existingIndex !== -1) {
        allCommandes[existingIndex].status = status;
        console.log(`✅ Commande #${commandeId} mise à jour: ${status}`);
    } else {
        console.log(`🆕 Nouvelle commande #${commandeId}, rechargement...`);
        loadCommandes();
        return;
    }

    // 2. Re-rendre le tableau
    renderCommandesTable();
    updateFilterCounts();

    // 3. Afficher un toast
    showToast(`📦 Commande #${commandeId}: ${status}`, status);
}

// ==========================================
// TOAST (notification visuelle)
// ==========================================

function showToast(message, status) {
    const colors = {
        'en_attente': '#f9a825',
        'accepter': '#1e88e5',
        'refuse': '#e53935',
        'annulee': '#e53935',
        'paiement_effectue': '#43a047',
        'livraison_en_cours': '#00acc1',
        'disponible': '#2e7d32',
        'recuperee': '#1b5e20',
        'success': '#43a047',
        'error': '#e53935'
    };

    const bgColor = colors[status] || '#1a2a6c';

    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        bottom: 80px;
        right: 20px;
        background: ${bgColor};
        color: white;
        padding: 12px 20px;
        border-radius: 12px;
        font-weight: 600;
        font-size: 14px;
        box-shadow: 0 8px 30px rgba(0,0,0,0.2);
        z-index: 999;
        max-width: 350px;
        animation: slideInRight 0.3s ease;
        pointer-events: none;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(20px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ==========================================
// COMPTEUR DES FILTRES
// ==========================================

function updateFilterCounts() {
    const filterButtons = document.querySelectorAll('#filterButtons .filter-btn');
    filterButtons.forEach(btn => {
        const filter = btn.dataset.filter;
        const count = filter === 'all' 
            ? allCommandes.length 
            : allCommandes.filter(c => c.status === filter).length;
        
        const label = btn.textContent.split('(')[0].trim();
        btn.textContent = `${label} (${count})`;
    });
}

// ==========================================
// CHARGER LES COMMANDES
// ==========================================

async function loadCommandes() {
    console.log('📋 Chargement des commandes...');

    try {
        const res = await fetch('/api/admin/commandes');
        const data = await res.json();

        if (res.ok) {
            allCommandes = data;
            document.getElementById('commandesCount').textContent = data.length + ' commandes';
            renderCommandesTable();
            updateFilterCounts();
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
        const status = c.status || 'en_attente';
        const isFinal = ['recuperee', 'refuse', 'annulee'].includes(status);

        return `
            <tr>
                <td>#${c.id}</td>
                <td style="font-size:12px;color:#888;">${c.reference || '-'}</td>
                <td>${c.nom}</td>
                <td>${(c.total || 0).toLocaleString()} FCFA</td>
                <td><span class="status-badge ${status}">${statusLabels[status] || status}</span></td>
                <td>${new Date(c.created_at).toLocaleDateString('fr-FR')}</td>
                <td>
                    <button class="btn-action maps" onclick="openMaps(${c.latitude || 'null'}, ${c.longitude || 'null'}, ${c.id})" title="Voir sur Maps">
                        <i class="fas fa-map-marker-alt"></i>
                    </button>
                    
                    ${!isFinal ? `<button class="btn-action sync" onclick="syncCommande(${c.id})" title="Synchroniser">
                        <i class="fas fa-sync-alt"></i>
                    </button>` : ''}
                    
                    ${!isFinal ? `<button class="btn-action status" onclick="openStatusOverlay(${c.id})" title="Modifier statut">
                        <i class="fas fa-edit"></i>
                    </button>` : `<button class="btn-action status" style="opacity:0.4;cursor:not-allowed;" disabled title="Statut final">
                        <i class="fas fa-lock"></i>
                    </button>`}
                    
                    <button class="btn-action detail" onclick="openDetailOverlay(${c.id})" title="Voir détails">
                        <i class="fas fa-eye"></i>
                    </button>
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
// BOUTON SYNC
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
// OVERLAY STATUT
// ==========================================

function openStatusOverlay(commandeId) {
    const commande = allCommandes.find(c => c.id === commandeId);
    if (!commande) {
        alert('❌ Commande non trouvée');
        return;
    }

    const currentStatus = commande.status || 'en_attente';
    
    let availableStatuses = [];
    const statusLabels = {
        'en_attente': '⏳ En attente',
        'accepter': '💳 Paiement requis',
        'refuse': '❌ Refusée',
        'paiement_effectue': '💳 Payée',
        'livraison_en_cours': '🚚 En cours',
        'disponible': '📍 Disponible',
        'recuperee': '✅ Récupérée'
    };
    
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
        alert('⚠️ Cette commande est dans un statut final. Aucune modification possible.');
        return;
    }

    currentCommandeId = commandeId;
    document.getElementById('statusCommandeId').textContent = commandeId;
    document.getElementById('statusClientInfo').textContent = 'Client: ' + commande.nom;
    
    const select = document.getElementById('statusSelect');
    select.innerHTML = '';
    
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
// INITIALISATION
// ==========================================

// Charger les commandes
loadCommandes();

// Connecter Socket.IO
connectSocketIO();

// Exposer les fonctions
window.loadCommandes = loadCommandes;
window.openMaps = openMaps;
window.syncCommande = syncCommande;
window.openStatusOverlay = openStatusOverlay;
window.openDetailOverlay = openDetailOverlay;

console.log('✅ commandes.js chargé avec Socket.IO');