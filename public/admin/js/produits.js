document.addEventListener('DOMContentLoaded', function() {

    console.log('✅ produits.js chargé');

    // ==========================================
    // RÉFÉRENCES
    // ==========================================

    const productsTableBody = document.getElementById('productsTableBody');
    const searchInput = document.getElementById('searchInput');
    const filterBtns = document.querySelectorAll('#stockFilterSwitch .filter-btn');
    const statusFilterBtns = document.querySelectorAll('#statusFilterSwitch .filter-btn');
    const productCount = document.getElementById('productCount');

    const statTotal = document.getElementById('statTotal');
    const statInStock = document.getElementById('statInStock');
    const statLowStock = document.getElementById('statLowStock');
    const statOutOfStock = document.getElementById('statOutOfStock');

    const catTotal = document.getElementById('catTotal');
    const categoryStats = document.getElementById('categoryStats');

    const deleteOverlay = document.getElementById('deleteOverlay');
    const deleteCancel = document.getElementById('deleteCancel');
    const deleteConfirm = document.getElementById('deleteConfirm');
    const deleteMessage = document.getElementById('deleteMessage');

    const detailOverlay = document.getElementById('detailOverlay');
    const detailClose = document.getElementById('detailClose');
    const detailCloseBtn = document.getElementById('detailCloseBtn');
    const detailBody = document.getElementById('detailBody');
    const detailTitle = document.getElementById('detailTitle');
    const detailEditBtn = document.getElementById('detailEditBtn');
    const detailDeleteBtn = document.getElementById('detailDeleteBtn');

    let allProducts = [];
    let currentFilter = 'all';
    let currentStatusFilter = 'all';
    let searchTerm = '';
    let deleteTargetId = null;
    let detailTargetId = null;

    // ==========================================
    // NOM ADMIN
    // ==========================================

    const adminName = localStorage.getItem('adminName') || 'Admin';
    document.getElementById('adminName').textContent = adminName;

    // ==========================================
    // CHARGER LES PRODUITS
    // ==========================================

    async function loadProducts() {
        try {
            const res = await fetch('/api/admin/products');
            const data = await res.json();

            if (res.ok && data.length > 0) {
                allProducts = data;
                renderProducts();
                updateStats();
                updateCategories();
            } else {
                allProducts = [];
                renderEmpty();
            }
        } catch (error) {
            console.error('❌ Erreur chargement produits:', error);
            renderEmpty();
        }
    }

    // ==========================================
    // RENDRE LES PRODUITS
    // ==========================================

    function renderProducts() {
        let filtered = allProducts;

        // Filtre par stock
        if (currentFilter !== 'all') {
            filtered = filtered.filter(p => {
                const stock = parseInt(p.quantity) || 0;
                if (currentFilter === 'instock') return stock > 10;
                if (currentFilter === 'lowstock') return stock >= 1 && stock <= 10;
                if (currentFilter === 'outofstock') return stock === 0;
                return true;
            });
        }

        // Filtre par statut (nouveau / promo)
        if (currentStatusFilter !== 'all') {
            filtered = filtered.filter(p => {
                if (currentStatusFilter === 'new') return p.is_new === true;
                if (currentStatusFilter === 'promo') return p.promo_price && p.promo_price > 0;
                return true;
            });
        }

        // Recherche
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(p =>
                p.name.toLowerCase().includes(term) ||
                (p.description && p.description.toLowerCase().includes(term)) ||
                (p.categorie && p.categorie.toLowerCase().includes(term))
            );
        }

        // Trier par date (plus récent en premier)
        filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        productCount.textContent = filtered.length + ' produits';
        renderTable(filtered);
    }

    // ==========================================
    // TABLEAU
    // ==========================================

    function renderTable(products) {
        if (products.length === 0) {
            productsTableBody.innerHTML = `
                <tr><td colspan="8" class="empty-table">
                    <i class="fas fa-box"></i>
                    <p>Aucun produit trouvé</p>
                </td></tr>
            `;
            return;
        }

        const dateOptions = { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' };

        let html = '';
        products.forEach(p => {
            const stock = parseInt(p.quantity) || 0;
            let stockClass = 'instock';
            let stockLabel = '✅ En stock';
            if (stock === 0) {
                stockClass = 'outofstock';
                stockLabel = '🚫 Rupture';
            } else if (stock <= 10) {
                stockClass = 'lowstock';
                stockLabel = '⚠️ Stock bas';
            }

            // Badges statut
            let statusBadges = '';
            if (p.is_new) {
                statusBadges += '<span class="status-badge-small new">⭐ Nouveau</span>';
            }
            if (p.promo_price && p.promo_price > 0) {
                statusBadges += '<span class="status-badge-small promo">🔥 Promo</span>';
            }

            const date = new Date(p.created_at);
            const imageSrc = p.image1 || 'https://via.placeholder.com/50';

            html += `
                <tr class="product-row" data-id="${p.id}">
                    <td>#${p.id}</td>
                    <td>
                        <img src="${imageSrc}" alt="${p.name}" class="product-thumb" loading="lazy">
                    </td>
                    <td>
                        ${p.name}
                        <div class="product-status-badges">${statusBadges}</div>
                    </td>
                    <td style="font-weight:600;color:var(--brand-dark);font-family:var(--font-mono);">
                        ${p.price.toLocaleString()} FCFA
                        ${p.promo_price ? `<br><span style="font-size:11px;color:var(--red);text-decoration:line-through;">${p.price.toLocaleString()} FCFA</span>` : ''}
                    </td>
                    <td>
                        <span class="stock-badge ${stockClass}">${stockLabel}</span>
                        <span style="font-size:12px;color:var(--ink-400);display:block;margin-top:2px;">${stock} unités</span>
                    </td>
                    <td style="font-size:13px;color:var(--ink-500);">${p.categorie || '-'}</td>
                    <td style="font-size:12px;color:var(--ink-400);">${date.toLocaleDateString('fr-FR', dateOptions)}</td>
                    <td>
                        <button class="btn-action edit" onclick="editProduct(${p.id})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-action delete" onclick="confirmDelete(${p.id}, '${p.name}')">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </td>
                </tr>
            `;
        });

        productsTableBody.innerHTML = html;

        // Clic sur la ligne → overlay détail
        document.querySelectorAll('.product-row').forEach(row => {
            row.addEventListener('click', function(e) {
                if (e.target.closest('.btn-action') || e.target.closest('button')) {
                    return;
                }
                const id = parseInt(this.dataset.id);
                openDetail(id);
            });
        });
    }

    // ==========================================
    // STATS
    // ==========================================

    function updateStats() {
        const total = allProducts.length;
        const inStock = allProducts.filter(p => (parseInt(p.quantity) || 0) > 10).length;
        const lowStock = allProducts.filter(p => {
            const stock = parseInt(p.quantity) || 0;
            return stock >= 1 && stock <= 10;
        }).length;
        const outOfStock = allProducts.filter(p => (parseInt(p.quantity) || 0) === 0).length;

        statTotal.textContent = total;
        statInStock.textContent = inStock;
        statLowStock.textContent = lowStock;
        statOutOfStock.textContent = outOfStock;

        if (lowStock > 0 || outOfStock > 0) {
            statLowStock.className = 'stat-value negative';
            statOutOfStock.className = 'stat-value negative';
        }
    }

    // ==========================================
    // CATÉGORIES
    // ==========================================

    function updateCategories() {
        const categories = {};
        allProducts.forEach(p => {
            const cat = p.categorie || 'Sans catégorie';
            categories[cat] = (categories[cat] || 0) + 1;
        });

        catTotal.textContent = allProducts.length;

        let html = '';
        const sorted = Object.entries(categories).sort((a, b) => b[1] - a[1]);
        sorted.forEach(([cat, count]) => {
            html += `
                <div class="mini-item">
                    <span class="mini-label">${cat}</span>
                    <span class="mini-count">${count}</span>
                </div>
            `;
        });

        while (categoryStats.children.length > 1) {
            categoryStats.removeChild(categoryStats.lastChild);
        }
        categoryStats.insertAdjacentHTML('beforeend', html);
    }

    // ==========================================
    // EMPTY
    // ==========================================

    function renderEmpty() {
        productsTableBody.innerHTML = `
            <tr><td colspan="8" class="empty-table">
                <i class="fas fa-box"></i>
                <p>Aucun produit trouvé</p>
            </td></tr>
        `;
        productCount.textContent = '0 produits';

        statTotal.textContent = '0';
        statInStock.textContent = '0';
        statLowStock.textContent = '0';
        statOutOfStock.textContent = '0';
        catTotal.textContent = '0';
    }

    // ==========================================
    // FILTRES
    // ==========================================

    filterBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            filterBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentFilter = this.dataset.filter;
            renderProducts();
        });
    });

    statusFilterBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            statusFilterBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentStatusFilter = this.dataset.status;
            renderProducts();
        });
    });

    // ==========================================
    // RECHERCHE
    // ==========================================

    searchInput.addEventListener('input', function() {
        searchTerm = this.value.trim();
        renderProducts();
    });

    // ==========================================
    // ACTIONS PRODUITS
    // ==========================================

    window.editProduct = function(id) {
        window.location.href = '/admin/add-produit?id=' + id;
    };

    window.confirmDelete = function(id, name) {
        deleteTargetId = id;
        deleteMessage.textContent = `Êtes-vous sûr de vouloir supprimer le produit "${name}" ?`;
        deleteOverlay.classList.add('active');
    };

    deleteCancel.addEventListener('click', function() {
        deleteOverlay.classList.remove('active');
        deleteTargetId = null;
    });

    deleteConfirm.addEventListener('click', async function() {
        if (!deleteTargetId) return;

        try {
            const res = await fetch(`/api/admin/products/${deleteTargetId}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                allProducts = allProducts.filter(p => p.id !== deleteTargetId);
                renderProducts();
                updateStats();
                updateCategories();
                if (window.updateBadges) window.updateBadges();
                deleteOverlay.classList.remove('active');
                deleteTargetId = null;
                if (detailOverlay.classList.contains('active')) {
                    detailOverlay.classList.remove('active');
                }
            } else {
                const data = await res.json();
                alert('❌ ' + (data.error || 'Erreur lors de la suppression'));
            }
        } catch (error) {
            console.error('Erreur suppression:', error);
            alert('❌ Erreur de connexion');
        }
    });

    deleteOverlay.addEventListener('click', function(e) {
        if (e.target === deleteOverlay) {
            deleteOverlay.classList.remove('active');
            deleteTargetId = null;
        }
    });

    // ==========================================
    // OVERLAY DÉTAIL PRODUIT
    // ==========================================

    function openDetail(id) {
        const product = allProducts.find(p => p.id === id);
        if (!product) return;

        detailTargetId = id;
        detailTitle.textContent = `📦 ${product.name}`;

        const stock = parseInt(product.quantity) || 0;
        let stockClass = 'instock';
        let stockLabel = '✅ En stock';
        if (stock === 0) {
            stockClass = 'outofstock';
            stockLabel = '🚫 Rupture';
        } else if (stock <= 10) {
            stockClass = 'lowstock';
            stockLabel = '⚠️ Stock bas';
        }

        let statusBadges = '';
        if (product.is_new) {
            statusBadges += `<span class="badge-status new">⭐ Nouveau</span> `;
        }
        if (product.promo_price && product.promo_price > 0) {
            statusBadges += `<span class="badge-status promo">🔥 Promo</span> `;
        }
        if (!statusBadges) {
            statusBadges = '<span class="badge-status instock">📦 Standard</span>';
        }

        const imageHtml = product.image1 ?
            `<img src="${product.image1}" alt="${product.name}" class="detail-image" />` :
            `<div class="detail-image-placeholder"><i class="fas fa-image"></i> Aucune image</div>`;

        const flexFields = [
            { label: '📏 Taille', value: product.flex1 },
            { label: '📅 Date d\'arrivage', value: product.flex2 },
            { label: '🌍 Origine', value: product.flex3 },
            { label: '📋 Composition', value: product.flex4 },
            { label: '💡 Conseils', value: product.flex5 },
            { label: '❄️ Conservation', value: product.flex6 },
            { label: '📝 Notes', value: product.flex7 },
            { label: '🔒 Réservé', value: product.flex8 }
        ];

        const flexHtml = flexFields.filter(f => f.value).map(f => `
            <div class="detail-row">
                <span class="label">${f.label}</span>
                <span class="value">${f.value}</span>
            </div>
        `).join('');

        detailBody.innerHTML = `
            ${imageHtml}

            <div class="detail-section">
                <div class="section-title"><i class="fas fa-tag"></i> Informations générales</div>
                <div class="detail-row">
                    <span class="label">ID</span>
                    <span class="value">#${product.id}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Nom</span>
                    <span class="value">${product.name}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Prix</span>
                    <span class="value">${product.price.toLocaleString()} FCFA</span>
                </div>
                ${product.promo_price ? `
                    <div class="detail-row">
                        <span class="label">Prix promo</span>
                        <span class="value" style="color:var(--red);">${product.promo_price.toLocaleString()} FCFA ${product.promo_end_date ? `(jusqu'au ${new Date(product.promo_end_date).toLocaleDateString('fr-FR')})` : ''}</span>
                    </div>
                ` : ''}
                <div class="detail-row">
                    <span class="label">Stock</span>
                    <span class="value"><span class="badge-status ${stockClass}">${stockLabel}</span> (${stock} unités)</span>
                </div>
                <div class="detail-row">
                    <span class="label">Catégorie</span>
                    <span class="value">${product.categorie || '-'}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Statut</span>
                    <span class="value">${statusBadges}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Date création</span>
                    <span class="value">${new Date(product.created_at).toLocaleDateString('fr-FR')}</span>
                </div>
            </div>

            ${product.description ? `
                <div class="detail-section">
                    <div class="section-title"><i class="fas fa-align-left"></i> Description</div>
                    <div style="font-size:14px;color:var(--ink-700);line-height:1.6;padding:4px 0;">${product.description}</div>
                </div>
            ` : ''}

            ${flexHtml ? `
                <div class="detail-section">
                    <div class="section-title"><i class="fas fa-users"></i> Informations client</div>
                    ${flexHtml}
                </div>
            ` : ''}

            ${(product.fournisseur || product.date_peremption) ? `
                <div class="detail-section">
                    <div class="section-title"><i class="fas fa-truck"></i> Fournisseur & Péremption</div>
                    ${product.fournisseur ? `
                        <div class="detail-row">
                            <span class="label">Fournisseur</span>
                            <span class="value">${product.fournisseur}</span>
                        </div>
                    ` : ''}
                    ${product.date_peremption ? `
                        <div class="detail-row">
                            <span class="label">Date de péremption</span>
                            <span class="value">${new Date(product.date_peremption).toLocaleDateString('fr-FR')}</span>
                        </div>
                    ` : ''}
                </div>
            ` : ''}
        `;

        detailOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeDetail() {
        detailOverlay.classList.remove('active');
        document.body.style.overflow = '';
        detailTargetId = null;
    }

    detailClose.addEventListener('click', closeDetail);
    detailCloseBtn.addEventListener('click', closeDetail);
    detailOverlay.addEventListener('click', function(e) {
        if (e.target === detailOverlay) closeDetail();
    });

    detailEditBtn.addEventListener('click', function() {
        if (detailTargetId) {
            window.location.href = '/admin/add-produit?id=' + detailTargetId;
        }
    });

    detailDeleteBtn.addEventListener('click', function() {
        if (detailTargetId) {
            const product = allProducts.find(p => p.id === detailTargetId);
            if (product) {
                closeDetail();
                setTimeout(() => {
                    confirmDelete(detailTargetId, product.name);
                }, 300);
            }
        }
    });

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
                console.log('✅ Socket.IO admin (produits) connecté');
                isSocketConnected = true;
            });

            socket.on('disconnect', function() {
                console.log('❌ Socket.IO admin (produits) déconnecté');
                isSocketConnected = false;
                setTimeout(() => {
                    if (!isSocketConnected) connectSocketIO();
                }, 3000);
            });

        } catch (error) {
            console.error('❌ Erreur connexion Socket.IO:', error);
            setTimeout(() => connectSocketIO(), 5000);
        }
    }

    // ==========================================
    // SYNC AUTO
    // ==========================================

    let syncInterval = null;

    function startSync() {
        if (syncInterval) {
            clearInterval(syncInterval);
        }
        syncInterval = setInterval(() => {
            loadProducts();
        }, 30000);
    }

    // ==========================================
    // INITIALISATION
    // ==========================================

    loadProducts();
    connectSocketIO();
    startSync();

    console.log('✅ produits.js initialisé');

});