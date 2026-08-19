document.addEventListener('DOMContentLoaded', function() {

    // ==========================================
    // VÉRIFICATION CONNEXION
    // ==========================================

    const adminToken = localStorage.getItem('adminToken');
    if (!adminToken) {
        window.location.href = '/admin/html/login.html';
        return;
    }

    const adminName = localStorage.getItem('adminName') || 'Admin';
    document.getElementById('adminName').textContent = '👤 ' + adminName;

    // ==========================================
    // ÉLÉMENTS
    // ==========================================

    const navLinks = document.querySelectorAll('.sidebar-nav a');
    const pages = document.querySelectorAll('.page-section');
    const pageTitle = document.getElementById('pageTitle');

    // Overlay statut
    const statusOverlay = document.getElementById('statusOverlay');
    const statusCommandeId = document.getElementById('statusCommandeId');
    const statusClientInfo = document.getElementById('statusClientInfo');
    const statusSelect = document.getElementById('statusSelect');
    const causeRefusGroup = document.getElementById('causeRefusGroup');
    const causeRefus = document.getElementById('causeRefus');
    const saveStatusBtn = document.getElementById('saveStatusBtn');
    const cancelStatusBtn = document.getElementById('cancelStatusBtn');
    const closeStatusOverlay = document.getElementById('closeStatusOverlay');

    // Overlay détail commande
    const detailOverlay = document.getElementById('detailOverlay');
    const detailContent = document.getElementById('detailContent');
    const detailActions = document.getElementById('detailActions');
    const closeDetailOverlay = document.getElementById('closeDetailOverlay');

    // Overlay produit détail
    const productDetailOverlay = document.getElementById('productDetailOverlay');
    const productDetailContent = document.getElementById('productDetailContent');
    const closeProductDetail = document.getElementById('closeProductDetail');

    // Overlay produit modification
    const productEditOverlay = document.getElementById('productEditOverlay');
    const productEditContent = document.getElementById('productEditContent');
    const closeProductEdit = document.getElementById('closeProductEdit');

    // Variables
    let currentCommandeId = null;
    let currentDetailCommande = null;
    let allCommandes = [];
    let currentFilter = 'all';
    let searchTerm = '';
    let editProductId = null;

    // ==========================================
    // NAVIGATION
    // ==========================================

    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();

            navLinks.forEach(l => l.classList.remove('active'));
            this.classList.add('active');

            const pageId = this.dataset.page;
            pages.forEach(p => p.classList.remove('active'));

            const target = document.getElementById('page-' + pageId);
            if (target) target.classList.add('active');

            const titles = {
                overview: '📊 Vue d\'ensemble',
                products: '📦 Produits',
                'add-product': '➕ Ajouter un produit',
                commandes: '📋 Commandes',
                livraison: '📍 Frais de livraison',
                payments: '💳 Paiements',
                clients: '👤 Clients',
                'send-message': '📨 Envoyer un message',
                updates: '🔄 Mises à jour'
            };
            pageTitle.textContent = titles[pageId] || 'Dashboard';

            if (pageId === 'commandes') {
                loadCommandes();
            }
            if (pageId === 'send-message') {
                loadUsersForMessage();
            }
        });
    });

    // ==========================================
    // DÉCONNEXION
    // ==========================================

    document.getElementById('logoutBtn').addEventListener('click', function() {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminName');
        localStorage.removeItem('adminId');
        window.location.href = '/admin/html/login.html';
    });

    // ==========================================
    // STATISTIQUES
    // ==========================================

    async function loadStats() {
        try {
            const res = await fetch('/api/admin/stats');
            const data = await res.json();
            document.getElementById('statProducts').textContent = data.products || 0;
            document.getElementById('statSales').textContent = (data.sales || 0) + ' FCFA';
            document.getElementById('statCommandes').textContent = data.commandes || 0;
            document.getElementById('statClients').textContent = data.clients || 0;
        } catch (error) {
            console.error('Erreur stats:', error);
        }
    }

    // ==========================================
    // PRODUITS
    // ==========================================

    async function loadProducts() {
        try {
            const res = await fetch('/api/admin/products');
            const data = await res.json();
            const container = document.getElementById('productList');

            if (res.ok && data.length > 0) {
                container.innerHTML = data.map(p => `
                    <div class="product-card" data-id="${p.id}" data-name="${p.name}" onclick="openProductDetail(${p.id})" style="cursor:pointer;">
                        <img src="${p.image1 || ''}" alt="${p.name}" onerror="this.src='https://via.placeholder.com/200'">
                        <h4>${p.name}</h4>
                        <div class="price">${p.price.toLocaleString()} FCFA</div>
                        <p style="font-size:12px;color:#888;">Stock: ${p.quantity || 0}</p>
                        <div class="actions">
                            <button class="btn-sm edit" onclick="event.stopPropagation();openProductEdit(${p.id})">✏️</button>
                            <button class="btn-sm danger" onclick="event.stopPropagation();deleteProduct(${p.id})">🗑️</button>
                        </div>
                    </div>
                `).join('');
            } else {
                container.innerHTML = '<p class="empty-msg">Aucun produit disponible.</p>';
            }
        } catch (error) {
            console.error('Erreur produits:', error);
        }
    }

    window.deleteProduct = async function(id) {
        if (!confirm('Supprimer ce produit ?')) return;
        try {
            const res = await fetch(`/api/admin/products/${id}`, { method: 'DELETE' });
            if (res.ok) {
                loadProducts();
                loadStats();
            }
        } catch (error) {
            console.error('Erreur:', error);
        }
    };

    // ==========================================
    // APERÇU IMAGES (formulaire ajout)
    // ==========================================

    document.getElementById('productImage1')?.addEventListener('change', function(e) {
        previewImage(e, 'preview1');
    });
    document.getElementById('productImage2')?.addEventListener('change', function(e) {
        previewImage(e, 'preview2');
    });

    function previewImage(event, previewId) {
        const container = document.getElementById(previewId);
        container.innerHTML = '';
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const img = document.createElement('img');
                img.src = e.target.result;
                container.appendChild(img);
            };
            reader.readAsDataURL(file);
        } else {
            const placeholder = document.createElement('div');
            placeholder.className = 'preview-placeholder';
            placeholder.textContent = 'Aucune image';
            container.appendChild(placeholder);
        }
    }

    // ==========================================
    // OVERLAY DÉTAIL PRODUIT
    // ==========================================

    window.openProductDetail = async function(productId) {
        try {
            const res = await fetch('/api/admin/products');
            const products = await res.json();
            const product = products.find(p => p.id === productId);
            if (!product) return;

            const stockStatus = product.quantity <= 0 ? '❌ Rupture' :
                               product.quantity <= 3 ? '⚠️ Stock limité' : '✅ En stock';

            productDetailContent.innerHTML = `
                <div class="detail-item"><span class="label">ID</span><span class="value">#${product.id}</span></div>
                <div class="detail-item"><span class="label">Nom</span><span class="value">${product.name}</span></div>
                <div class="detail-item"><span class="label">Prix</span><span class="value">${product.price.toLocaleString()} FCFA</span></div>
                <div class="detail-item"><span class="label">Quantité</span><span class="value">${product.quantity || 0}</span></div>
                <div class="detail-item"><span class="label">Stock</span><span class="value">${stockStatus}</span></div>
                <div class="detail-item"><span class="label">Description</span><span class="value" style="max-width:50%;">${product.description || '-'}</span></div>
                <div class="detail-item"><span class="label">Images</span><span class="value" style="max-width:50%;">
                    ${product.image1 ? `<img src="${product.image1}" alt="img1" style="width:60px;height:60px;object-fit:cover;border-radius:8px;">` : '-'}
                    ${product.image2 ? `<img src="${product.image2}" alt="img2" style="width:60px;height:60px;object-fit:cover;border-radius:8px;">` : ''}
                </span></div>
                <div class="detail-item"><span class="label">Créé le</span><span class="value">${new Date(product.created_at).toLocaleString()}</span></div>
                <div class="detail-actions">
                    <button class="btn-edit" onclick="openProductEdit(${product.id})">✏️ Modifier</button>
                    <button class="btn-delete" onclick="deleteProduct(${product.id})">🗑️ Supprimer</button>
                </div>
            `;

            productDetailOverlay.classList.add('active');
        } catch (error) {
            console.error('Erreur:', error);
        }
    };

    if (closeProductDetail) {
        closeProductDetail.addEventListener('click', function() {
            productDetailOverlay.classList.remove('active');
        });
    }

    // ==========================================
    // OVERLAY MODIFICATION PRODUIT
    // ==========================================

    window.openProductEdit = async function(productId) {
        try {
            const res = await fetch('/api/admin/products');
            const products = await res.json();
            const product = products.find(p => p.id === productId);
            if (!product) return;

            editProductId = productId;

            productEditContent.innerHTML = `
                <form id="editProductForm">
                    <div class="form-group">
                        <label>Nom</label>
                        <input type="text" id="editName" value="${product.name}" required>
                    </div>
                    <div class="form-group">
                        <label>Prix (FCFA)</label>
                        <input type="number" id="editPrice" value="${product.price}" required>
                    </div>
                    <div class="form-group">
                        <label>Quantité</label>
                        <input type="number" id="editQty" value="${product.quantity || 0}">
                    </div>
                    <div class="form-group">
                        <label>Description</label>
                        <textarea id="editDesc" rows="3">${product.description || ''}</textarea>
                    </div>
                    <div class="form-group">
                        <label>Images actuelles</label>
                        <div class="edit-image-preview">
                            ${product.image1 ? `<img src="${product.image1}" alt="img1">` : ''}
                            ${product.image2 ? `<img src="${product.image2}" alt="img2">` : ''}
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Remplacer Image 1</label>
                        <input type="file" id="editImage1" accept="image/*">
                    </div>
                    <div class="form-group">
                        <label>Remplacer Image 2</label>
                        <input type="file" id="editImage2" accept="image/*">
                    </div>
                    <div class="edit-actions">
                        <button type="submit" class="btn-save-edit">💾 Enregistrer</button>
                        <button type="button" class="btn-cancel-edit" onclick="document.getElementById('productEditOverlay').classList.remove('active')">Annuler</button>
                    </div>
                    <div id="editMessage" class="message"></div>
                </form>
            `;

            productEditOverlay.classList.add('active');

            document.getElementById('editProductForm').addEventListener('submit', async function(e) {
                e.preventDefault();
                await saveProductEdit();
            });

        } catch (error) {
            console.error('Erreur:', error);
        }
    };

    if (closeProductEdit) {
        closeProductEdit.addEventListener('click', function() {
            productEditOverlay.classList.remove('active');
        });
    }

    async function saveProductEdit() {
        const formData = new FormData();
        formData.append('name', document.getElementById('editName').value.trim());
        formData.append('price', document.getElementById('editPrice').value);
        formData.append('quantity', document.getElementById('editQty').value || 0);
        formData.append('description', document.getElementById('editDesc').value.trim());

        const file1 = document.getElementById('editImage1').files[0];
        const file2 = document.getElementById('editImage2').files[0];
        if (file1) formData.append('image1', file1);
        if (file2) formData.append('image2', file2);

        const msg = document.getElementById('editMessage');

        try {
            const res = await fetch(`/api/admin/products/${editProductId}`, {
                method: 'PUT',
                body: formData
            });

            const data = await res.json();

            if (res.ok) {
                msg.textContent = '✅ Produit mis à jour avec succès !';
                msg.className = 'message success';
                setTimeout(() => {
                    productEditOverlay.classList.remove('active');
                    loadProducts();
                    loadStats();
                }, 1000);
            } else {
                msg.textContent = '❌ ' + (data.error || 'Erreur');
                msg.className = 'message error';
            }
        } catch (error) {
            console.error('Erreur:', error);
            msg.textContent = '❌ Erreur de connexion';
            msg.className = 'message error';
        }
    }

    // ==========================================
    // AJOUTER PRODUIT
    // ==========================================

    const addForm = document.getElementById('addProductForm');
    const productMsg = document.getElementById('productMessage');

    if (addForm) {
        addForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const formData = new FormData(this);
            const fileInput = document.getElementById('productImage1');

            if (!fileInput.files || fileInput.files.length === 0) {
                productMsg.textContent = '⚠️ Veuillez sélectionner une image.';
                productMsg.className = 'message error';
                return;
            }

            const btn = this.querySelector('.btn-submit');
            btn.disabled = true;
            btn.textContent = '⏳ Envoi...';
            productMsg.textContent = '⏳ Upload en cours...';
            productMsg.className = 'message info';

            try {
                const res = await fetch('/api/admin/products', {
                    method: 'POST',
                    body: formData
                });

                const data = await res.json();

                if (res.ok) {
                    productMsg.textContent = '✅ Produit ajouté avec succès !';
                    productMsg.className = 'message success';
                    this.reset();
                    document.getElementById('preview1').innerHTML = '';
                    document.getElementById('preview2').innerHTML = '';
                    loadProducts();
                    loadStats();
                    setTimeout(() => showPage('products'), 1000);
                } else {
                    productMsg.textContent = '❌ ' + (data.error || 'Erreur');
                    productMsg.className = 'message error';
                }
            } catch (error) {
                console.error('Erreur:', error);
                productMsg.textContent = '❌ Erreur de connexion au serveur.';
                productMsg.className = 'message error';
            } finally {
                btn.disabled = false;
                btn.textContent = '💾 Enregistrer';
            }
        });
    }

    // ==========================================
    // COMMANDES
    // ==========================================

    function setupFilters() {
        const buttons = document.querySelectorAll('.filter-btn');
        const searchInput = document.getElementById('searchCommande');

        buttons.forEach(btn => {
            btn.addEventListener('click', function() {
                buttons.forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                currentFilter = this.dataset.filter;
                renderCommandesTable();
            });
        });

        if (searchInput) {
            searchInput.addEventListener('input', function() {
                searchTerm = this.value.trim();
                renderCommandesTable();
            });
        }
    }

    function renderCommandesTable() {
        const container = document.getElementById('commandesList');
        const countEl = document.getElementById('filterCount');

        if (!container) return;

        let filtered = allCommandes;

        if (currentFilter !== 'all') {
            filtered = filtered.filter(c => c.status === currentFilter);
        }

        if (searchTerm !== '') {
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
            container.innerHTML = `<p class="empty-msg">Aucune commande trouvée.</p>`;
            return;
        }

        const statusLabels = {
            'en_attente': '⏳ En attente',
            'acceptee': '✅ Acceptée',
            'refusee': '❌ Refusée',
            'pret_livraison': '📦 Prêt',
            'livraison_en_cours': '🚚 En cours',
            'votre_colis_est_la': '📍 Arrivé',
            'payee': '💳 Payée',
            'annulee': '❌ Annulée'
        };

        let html = `
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Référence</th>
                        <th>Client</th>
                        <th>Total</th>
                        <th>Commune</th>
                        <th>Statut</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
        `;

        filtered.forEach(c => {
            const statusClass = c.status || 'en_attente';
            const refDisplay = c.reference || '-';
            html += `
                <tr>
                    <td>#${c.id}</td>
                    <td style="font-size:12px;color:#888;">${refDisplay}</td>
                    <td>${c.nom}</td>
                    <td>${(c.total || 0).toLocaleString()} FCFA</td>
                    <td>${c.commune || '-'}</td>
                    <td><span class="status-badge ${statusClass}">${statusLabels[statusClass] || statusClass}</span></td>
                    <td>
                        <button class="detail-btn" onclick="openDetailOverlay(${JSON.stringify(c).replace(/"/g, '&quot;')})">
                            <i class="fas fa-eye"></i> Détail
                        </button>
                        <button class="status-btn" onclick="openStatusOverlay(${c.id}, '${c.nom}')">
                            <i class="fas fa-edit"></i>
                        </button>
                    </td>
                </tr>
            `;
        });

        html += '</tbody></table>';
        container.innerHTML = html;
    }

    // ==========================================
    // OVERLAY DÉTAIL COMMANDE
    // ==========================================

    window.openDetailOverlay = function(commande) {
        currentDetailCommande = commande;
        const content = document.getElementById('detailContent');
        const actions = document.getElementById('detailActions');

        if (!content || !actions) return;

        let panier = [];
        try {
            panier = JSON.parse(commande.panier || '[]');
        } catch (e) {
            panier = [];
        }

        const productsHtml = panier.map(p =>
            `${p.name} × ${p.quantity} = ${(p.price * p.quantity).toLocaleString()} FCFA`
        ).join('<br>') || 'Aucun produit';

        const statusLabels = {
            'en_attente': '⏳ En attente',
            'acceptee': '✅ Acceptée',
            'refusee': '❌ Refusée',
            'pret_livraison': '📦 Prêt pour livraison',
            'livraison_en_cours': '🚚 Livraison en cours',
            'votre_colis_est_la': '📍 Votre colis est là',
            'payee': '💳 Payée',
            'annulee': '❌ Annulée'
        };

        const statusClass = commande.status || 'en_attente';
        const causeHtml = commande.cause_refus ?
            `<div class="detail-item"><span class="label">Cause refus</span><span class="value" style="color:#e74c3c;">${commande.cause_refus}</span></div>` :
            '';

        content.innerHTML = `
            <div class="detail-item"><span class="label"># Commande</span><span class="value">${commande.id}</span></div>
            <div class="detail-item"><span class="label">Référence</span><span class="value" style="font-size:13px;color:#888;">${commande.reference || '-'}</span></div>
            <div class="detail-item"><span class="label">Client</span><span class="value">${commande.nom}</span></div>
            <div class="detail-item"><span class="label">Téléphone</span><span class="value">${commande.telephone || '-'}</span></div>
            <div class="detail-item"><span class="label">Total</span><span class="value">${(commande.total || 0).toLocaleString()} FCFA</span></div>
            <div class="detail-item"><span class="label">Frais livraison</span><span class="value">${(commande.frais_livraison || 0).toLocaleString()} FCFA</span></div>
            <div class="detail-item"><span class="label">Commune</span><span class="value">${commande.commune || '-'}</span></div>
            <div class="detail-item"><span class="label">Quartier</span><span class="value">${commande.quartier || '-'}</span></div>
            <div class="detail-item"><span class="label">Précision</span><span class="value">${commande.precision || '-'}</span></div>
            <div class="detail-item"><span class="label">Option</span><span class="value">${commande.option === 'chezmoi' ? '📍 Chez moi' : '✏️ Adresse'}</span></div>
            ${commande.latitude ? `<div class="detail-item"><span class="label">GPS</span><span class="value" style="font-size:12px;">${commande.latitude}, ${commande.longitude}</span></div>` : ''}
            <div class="detail-item"><span class="label">Produits</span><span class="value products">${productsHtml}</span></div>
            <div class="detail-item"><span class="label">Statut</span><span class="value"><span class="badge-status ${statusClass}">${statusLabels[statusClass] || statusClass}</span></span></div>
            ${causeHtml}
            <div class="detail-item"><span class="label">Date</span><span class="value">${new Date(commande.created_at).toLocaleString()}</span></div>
            <div class="detail-item" style="border-bottom:none;padding-top:4px;">
                <span class="label" style="font-size:11px;color:#bbb;">Code secret</span>
                <span class="value" style="font-size:11px;color:#bbb;letter-spacing:2px;">${commande.code_login || '••••'}</span>
            </div>
        `;

        const statusList = [
            { value: 'en_attente', label: '⏳ En attente', color: 'en_attente' },
            { value: 'acceptee', label: '✅ Accepter', color: 'acceptee' },
            { value: 'pret_livraison', label: '📦 Prêt', color: 'pret_livraison' },
            { value: 'livraison_en_cours', label: '🚚 En cours', color: 'livraison_en_cours' },
            { value: 'votre_colis_est_la', label: '📍 Arrivé', color: 'votre_colis_est_la' },
            { value: 'payee', label: '💳 Payée', color: 'payee' },
            { value: 'refusee', label: '❌ Refuser', color: 'refusee' },
        ];

        const currentStatus = commande.status || 'en_attente';
        let actionsHtml = '';

        statusList.forEach(s => {
            if (s.value !== currentStatus) {
                actionsHtml += `
                    <button class="btn-status ${s.color}" onclick="changeStatusFromDetail('${s.value}')">
                        ${s.label}
                    </button>
                `;
            }
        });

        actions.innerHTML = actionsHtml || '<span style="color:#888;font-size:13px;">Aucune action disponible.</span>';

        detailOverlay.classList.add('active');
    };

    if (closeDetailOverlay) {
        closeDetailOverlay.addEventListener('click', function() {
            detailOverlay.classList.remove('active');
        });
    }

    window.changeStatusFromDetail = function(newStatus) {
        if (!currentDetailCommande) return;

        if (newStatus === 'refusee') {
            const cause = prompt('✏️ Motif du refus :');
            if (cause === null) return;
            if (cause.trim() === '') {
                alert('⚠️ Veuillez indiquer une cause.');
                return;
            }
            updateStatus(currentDetailCommande.id, newStatus, cause.trim());
        } else {
            updateStatus(currentDetailCommande.id, newStatus, null);
        }
    };

    async function updateStatus(commandeId, status, causeRefus = null) {
        try {
            const body = { commandeId, status };
            if (causeRefus) body.causeRefus = causeRefus;

            const res = await fetch('/api/admin/commande/status', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const data = await res.json();

            if (res.ok) {
                detailOverlay.classList.remove('active');
                statusOverlay.classList.remove('active');
                loadCommandes();
                loadStats();
            } else {
                alert('❌ ' + (data.error || 'Erreur'));
            }
        } catch (error) {
            console.error('Erreur:', error);
            alert('❌ Erreur de connexion au serveur.');
        }
    }

    // ==========================================
    // OVERLAY STATUT
    // ==========================================

    window.openStatusOverlay = function(commandeId, clientName) {
        currentCommandeId = commandeId;
        statusCommandeId.textContent = commandeId;
        statusClientInfo.textContent = 'Client: ' + clientName;
        statusSelect.value = 'en_attente';
        causeRefus.value = '';
        causeRefusGroup.style.display = 'none';
        statusOverlay.classList.add('active');
    };

    function closeStatusOverlayFn() {
        statusOverlay.classList.remove('active');
        currentCommandeId = null;
    }

    if (closeStatusOverlay) {
        closeStatusOverlay.addEventListener('click', closeStatusOverlayFn);
    }
    if (cancelStatusBtn) {
        cancelStatusBtn.addEventListener('click', closeStatusOverlayFn);
    }
    if (statusOverlay) {
        statusOverlay.addEventListener('click', function(e) {
            if (e.target === statusOverlay) closeStatusOverlayFn();
        });
    }

    if (statusSelect) {
        statusSelect.addEventListener('change', function() {
            if (this.value === 'refusee') {
                causeRefusGroup.style.display = 'block';
            } else {
                causeRefusGroup.style.display = 'none';
            }
        });
    }

    if (saveStatusBtn) {
        saveStatusBtn.addEventListener('click', async function() {
            const status = statusSelect.value;
            const cause = causeRefus.value.trim();

            if (status === 'refusee' && !cause) {
                alert('⚠️ Veuillez indiquer la cause du refus.');
                return;
            }

            if (currentCommandeId) {
                await updateStatus(currentCommandeId, status, cause || null);
            }
        });
    }

    async function loadCommandes() {
        try {
            const res = await fetch('/api/admin/commandes');
            const data = await res.json();

            if (res.ok) {
                allCommandes = data;
                const countEl = document.getElementById('commandesCount');
                if (countEl) countEl.textContent = data.length + ' commandes';
                renderCommandesTable();
            } else {
                const container = document.getElementById('commandesList');
                if (container) container.innerHTML = '<p class="empty-msg">Erreur de chargement.</p>';
            }
        } catch (error) {
            console.error('Erreur commandes:', error);
            const container = document.getElementById('commandesList');
            if (container) container.innerHTML = '<p class="empty-msg">Erreur de connexion.</p>';
        }
    }

    // ==========================================
    // FRAIS DE LIVRAISON
    // ==========================================

    async function loadCommunes() {
        try {
            const res = await fetch('/api/admin/livraison');
            const data = await res.json();
            const container = document.getElementById('communesList');

            if (res.ok && data.length > 0) {
                let html = `
                    <table>
                        <thead>
                            <tr>
                                <th>Commune</th>
                                <th>Tarif (FCFA)</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                `;
                data.forEach(c => {
                    html += `
                        <tr>
                            <td>${c.commune}</td>
                            <td>${c.tarif.toLocaleString()} FCFA</td>
                            <td>
                                <button class="btn-sm edit" onclick="editCommune(${c.id}, '${c.commune}', ${c.tarif})">✏️</button>
                                <button class="btn-sm danger" onclick="deleteCommune(${c.id})">🗑️</button>
                            </td>
                        </tr>
                    `;
                });
                html += '</tbody></table>';
                container.innerHTML = html;
            } else {
                container.innerHTML = '<p class="empty-msg">Aucune commune configurée. Ajoutez-en une !</p>';
            }
        } catch (error) {
            console.error('Erreur communes:', error);
            document.getElementById('communesList').innerHTML = '<p class="empty-msg">Erreur de chargement.</p>';
        }
    }

    const addCommuneBtn = document.getElementById('addCommuneBtn');
    if (addCommuneBtn) {
        addCommuneBtn.addEventListener('click', function() {
            document.getElementById('communeForm').style.display = 'block';
            document.getElementById('communeName').value = '';
            document.getElementById('communeTarif').value = '';
            document.getElementById('editCommuneId').value = '';
            document.getElementById('saveCommuneBtn').textContent = '💾 Enregistrer';
            this.style.display = 'none';
        });
    }

    const cancelCommuneBtn = document.getElementById('cancelCommuneBtn');
    if (cancelCommuneBtn) {
        cancelCommuneBtn.addEventListener('click', function() {
            document.getElementById('communeForm').style.display = 'none';
            document.getElementById('addCommuneBtn').style.display = 'inline-flex';
        });
    }

    window.editCommune = function(id, commune, tarif) {
        document.getElementById('communeForm').style.display = 'block';
        document.getElementById('communeName').value = commune;
        document.getElementById('communeTarif').value = tarif;
        document.getElementById('editCommuneId').value = id;
        document.getElementById('saveCommuneBtn').textContent = '💾 Mettre à jour';
        document.getElementById('addCommuneBtn').style.display = 'none';
    };

    window.deleteCommune = async function(id) {
        if (!confirm('Supprimer cette commune ?')) return;
        try {
            const res = await fetch(`/api/admin/livraison/${id}`, { method: 'DELETE' });
            if (res.ok) {
                loadCommunes();
            }
        } catch (error) {
            console.error('Erreur:', error);
        }
    };

    const saveCommuneBtn = document.getElementById('saveCommuneBtn');
    if (saveCommuneBtn) {
        saveCommuneBtn.addEventListener('click', async function() {
            const name = document.getElementById('communeName').value.trim();
            const tarif = parseInt(document.getElementById('communeTarif').value);
            const editId = document.getElementById('editCommuneId').value;

            if (!name || !tarif) {
                alert('⚠️ Veuillez remplir tous les champs.');
                return;
            }

            const method = editId ? 'PUT' : 'POST';
            const url = editId ? `/api/admin/livraison/${editId}` : '/api/admin/livraison';
            const body = editId ? { tarif } : { commune: name, tarif };

            try {
                const res = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });

                if (res.ok) {
                    document.getElementById('communeForm').style.display = 'none';
                    document.getElementById('addCommuneBtn').style.display = 'inline-flex';
                    loadCommunes();
                } else {
                    alert('❌ Erreur lors de l\'enregistrement.');
                }
            } catch (error) {
                console.error('Erreur:', error);
                alert('❌ Erreur de connexion.');
            }
        });
    }

    // ==========================================
    // PAIEMENTS & CLIENTS
    // ==========================================

    async function loadPayments() {
        try {
            const res = await fetch('/api/admin/payments');
            const data = await res.json();
            const container = document.getElementById('paymentList');
            if (res.ok && data.length > 0) {
                let html = `
                    <table>
                        <thead>
                            <tr>
                                <th>Réf.</th>
                                <th>Montant</th>
                                <th>Statut</th>
                                <th>Date</th>
                            </tr>
                        </thead>
                        <tbody>
                `;
                data.forEach(p => {
                    html += `
                        <tr>
                            <td>${p.reference || 'N/A'}</td>
                            <td>${p.amount.toLocaleString()} FCFA</td>
                            <td><span class="status-badge ${p.status}">${p.status || 'pending'}</span></td>
                            <td>${new Date(p.created_at).toLocaleDateString()}</td>
                        </tr>
                    `;
                });
                html += '</tbody></table>';
                container.innerHTML = html;
            } else {
                container.innerHTML = '<p class="empty-msg">Aucun paiement enregistré.</p>';
            }
        } catch (error) {
            console.error('Erreur paiements:', error);
        }
    }

    async function loadClients() {
        try {
            const res = await fetch('/api/admin/clients');
            const data = await res.json();
            const container = document.getElementById('clientList');
            if (res.ok && data.length > 0) {
                let html = `
                    <table>
                        <thead>
                            <tr>
                                <th>Nom</th>
                                <th>Email</th>
                                <th>Téléphone</th>
                                <th>Date</th>
                            </tr>
                        </thead>
                        <tbody>
                `;
                data.forEach(c => {
                    html += `
                        <tr>
                            <td>${c.name}</td>
                            <td>${c.email}</td>
                            <td>${c.phone || '-'}</td>
                            <td>${new Date(c.created_at).toLocaleDateString()}</td>
                        </tr>
                    `;
                });
                html += '</tbody></table>';
                container.innerHTML = html;
            } else {
                container.innerHTML = '<p class="empty-msg">Aucun client inscrit.</p>';
            }
        } catch (error) {
            console.error('Erreur clients:', error);
        }
    }

    // ==========================================
    // ENVOYER UN MESSAGE
    // ==========================================

    async function loadUsersForMessage() {
        try {
            const res = await fetch('/api/admin/clients');
            const data = await res.json();
            const select = document.getElementById('messageUserSelect');
            if (select) {
                select.innerHTML = '<option value="">-- Sélectionner un client --</option>';
                if (data.length > 0) {
                    data.forEach(user => {
                        const option = document.createElement('option');
                        option.value = user.id;
                        option.textContent = `${user.name} (${user.email})`;
                        select.appendChild(option);
                    });
                } else {
                    const opt = document.createElement('option');
                    opt.value = '';
                    opt.textContent = 'Aucun client disponible';
                    select.appendChild(opt);
                }
            }
        } catch (error) {
            console.error('Erreur chargement users:', error);
        }
    }

    const sendMessageBtn = document.getElementById('sendMessageBtn');
    if (sendMessageBtn) {
        sendMessageBtn.addEventListener('click', async function() {
            const userId = document.getElementById('messageUserSelect').value;
            const title = document.getElementById('messageTitle').value.trim();
            const content = document.getElementById('messageContent').value.trim();
            const result = document.getElementById('messageResult');

            if (!userId || !title || !content) {
                result.textContent = '⚠️ Veuillez remplir tous les champs.';
                result.className = 'message error';
                return;
            }

            result.textContent = '⏳ Envoi en cours...';
            result.className = 'message info';

            try {
                const res = await fetch('/api/admin/notification/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId, title, content })
                });

                const data = await res.json();

                if (res.ok) {
                    result.textContent = '✅ Message envoyé avec succès !';
                    result.className = 'message success';
                    document.getElementById('messageTitle').value = '';
                    document.getElementById('messageContent').value = '';
                    setTimeout(() => { result.className = 'message'; }, 3000);
                } else {
                    result.textContent = '❌ ' + (data.error || 'Erreur');
                    result.className = 'message error';
                }
            } catch (error) {
                console.error('Erreur:', error);
                result.textContent = '❌ Erreur de connexion';
                result.className = 'message error';
            }
        });
    }

    const sendToAllBtn = document.getElementById('sendToAllBtn');
    if (sendToAllBtn) {
        sendToAllBtn.addEventListener('click', function() {
            const select = document.getElementById('messageUserSelect');
            if (select) {
                const allOption = Array.from(select.options).find(opt => opt.value === '');
                if (allOption) select.value = '';
            }
            document.getElementById('messageUserSelect').style.borderColor = '#6C63FF';
            // Focus sur le titre
            document.getElementById('messageTitle').focus();
        });
    }

    // ==========================================
    // MISES À JOUR
    // ==========================================

    const checkUpdatesBtn = document.getElementById('checkUpdatesBtn');
    if (checkUpdatesBtn) {
        checkUpdatesBtn.addEventListener('click', async function() {
            const container = document.getElementById('updatesList');
            const btn = this;
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Vérification...';

            try {
                const res = await fetch('/api/admin/check-updates');
                const data = await res.json();

                if (data.success) {
                    if (data.isNew) {
                        container.innerHTML = `
                            <div class="update-item" style="border-left:4px solid #2d7d46;">
                                <div class="update-info">
                                    <div class="commit-message">🆕 ${data.commit.message}</div>
                                    <div class="commit-sha">${data.commit.sha.substring(0, 7)}</div>
                                    <div class="commit-date">${new Date(data.commit.date).toLocaleString()}</div>
                                    <div style="font-size:13px;color:#2d7d46;margin-top:4px;">
                                        ✅ ${data.sentCount} notification(s) envoyée(s) aux utilisateurs
                                    </div>
                                </div>
                                <div class="update-actions">
                                    <button class="btn-notify done" disabled>✅ Envoyé</button>
                                </div>
                            </div>
                        `;
                    } else {
                        container.innerHTML = `
                            <div class="update-item">
                                <div class="update-info">
                                    <div class="commit-message">📌 Dernier commit déjà notifié</div>
                                    <div class="commit-sha">${data.commit.sha.substring(0, 7)}</div>
                                    <div class="commit-date">${new Date(data.commit.date).toLocaleString()}</div>
                                </div>
                                <div class="update-actions">
                                    <button class="btn-notify done" disabled>✅ Déjà envoyé</button>
                                </div>
                            </div>
                        `;
                    }
                } else {
                    container.innerHTML = `<p class="empty-msg" style="color:#e74c3c;">❌ Erreur: ${data.error || 'Impossible de vérifier'}</p>`;
                }
            } catch (error) {
                console.error('Erreur:', error);
                container.innerHTML = `<p class="empty-msg" style="color:#e74c3c;">❌ Erreur de connexion</p>`;
            }

            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-sync-alt"></i> Vérifier';
        });
    }

    // ==========================================
    // RECHERCHE PRODUITS (live)
    // ==========================================

    const searchProductInput = document.getElementById('searchProduct');
    if (searchProductInput) {
        searchProductInput.addEventListener('input', function() {
            const term = this.value.toLowerCase();
            const cards = document.querySelectorAll('.product-card');
            cards.forEach(card => {
                const name = card.dataset.name?.toLowerCase() || '';
                card.style.display = name.includes(term) ? '' : 'none';
            });
        });
    }

    // ==========================================
    // AFFICHER LA PAGE
    // ==========================================

    window.showPage = function(pageId) {
        const link = document.querySelector(`.sidebar-nav a[data-page="${pageId}"]`);
        if (link) link.click();
    };

    // ==========================================
    // INITIALISATION
    // ==========================================

    setupFilters();

    loadStats();
    loadProducts();
    loadCommandes();
    loadCommunes();
    loadPayments();
    loadClients();

});