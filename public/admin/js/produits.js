document.addEventListener('DOMContentLoaded', function() {

    console.log('✅ produits.js chargé');

    // ==========================================
    // RÉFÉRENCES
    // ==========================================

    const productsTableBody = document.getElementById('productsTableBody');
    const searchInput = document.getElementById('searchInput');
    const filterBtns = document.querySelectorAll('#stockFilterSwitch .filter-btn');
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

    let allProducts = [];
    let currentFilter = 'all';
    let searchTerm = '';
    let deleteTargetId = null;

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

        // Mettre à jour le compte
        productCount.textContent = filtered.length + ' produits';

        // Rendre le tableau
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

            const promoBadge = p.promotion ? '<span class="promo-badge">Promo</span>' : '';
            const date = new Date(p.created_at);
            const imageSrc = p.image1 || 'https://via.placeholder.com/50';

            html += `
                <tr>
                    <td>#${p.id}</td>
                    <td>
                        <img src="${imageSrc}" alt="${p.name}" class="product-thumb" loading="lazy">
                    </td>
                    <td>
                        ${p.name}
                        ${promoBadge}
                    </td>
                    <td style="font-weight:600;color:var(--brand-dark);font-family:var(--font-mono);">
                        ${p.price.toLocaleString()} FCFA
                        ${p.prix_promotion ? `<br><span style="font-size:11px;color:var(--red);text-decoration:line-through;">${p.prix_promotion.toLocaleString()} FCFA</span>` : ''}
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
        // Trier par nombre de produits (décroissant)
        const sorted = Object.entries(categories).sort((a, b) => b[1] - a[1]);
        sorted.forEach(([cat, count]) => {
            html += `
                <div class="mini-item">
                    <span class="mini-label">${cat}</span>
                    <span class="mini-count">${count}</span>
                </div>
            `;
        });

        // Supprimer l'élément "Toutes" et le remplacer par la liste des catégories
        const existingItems = categoryStats.querySelectorAll('.mini-item');
        if (existingItems.length > 1) {
            // Garder seulement le premier (Toutes) et remplacer le reste
            while (categoryStats.children.length > 1) {
                categoryStats.removeChild(categoryStats.lastChild);
            }
        }
        // Ajouter les catégories
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
        window.location.href = `/admin/add-produit.html?id=${id}`;
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