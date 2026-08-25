document.addEventListener('DOMContentLoaded', function() {

    console.log('✅ Shop - Détail boutique');

    // ==========================================
    // RÉFÉRENCES
    // ==========================================

    const shopTitle = document.getElementById('shopTitle');
    const shopBanner = document.getElementById('shopBanner');
    const shopName = document.getElementById('shopName');
    const shopLocation = document.getElementById('shopLocation');
    const shopDescription = document.getElementById('shopDescription');
    const productsGrid = document.getElementById('productsGrid');
    const productsCount = document.getElementById('productsCount');

    const addProductBtn = document.getElementById('addProductBtn');
    const productOverlay = document.getElementById('productOverlay');
    const closeOverlay = document.getElementById('closeOverlay');
    const overlayTitle = document.getElementById('overlayTitle');
    const editProductId = document.getElementById('editProductId');
    const productForm = document.getElementById('productForm');
    const submitBtn = document.getElementById('submitProductBtn');

    const confirmOverlay = document.getElementById('confirmOverlay');
    const confirmCancel = document.getElementById('confirmCancel');
    const confirmOk = document.getElementById('confirmOk');
    const confirmMessage = document.getElementById('confirmMessage');

    const loaderOverlay = document.getElementById('loaderOverlay');

    // ==========================================
    // ÉTAT
    // ==========================================

    let shopId = null;
    let currentShop = null;
    let products = [];
    let deleteTargetId = null;

    // ==========================================
    // AUTH
    // ==========================================

    function getToken() {
        return localStorage.getItem('sellerToken');
    }

    function checkAuth() {
        const token = getToken();
        if (!token) {
            window.location.href = '/login';
            return false;
        }
        return true;
    }

    // ==========================================
    // CHARGEMENT
    // ==========================================

    async function loadShop() {
        const urlParams = new URLSearchParams(window.location.search);
        shopId = urlParams.get('id');

        if (!shopId) {
            productsGrid.innerHTML = `
                <div class="products-empty">
                    <i class="fas fa-exclamation-circle"></i>
                    <h3>Boutique non trouvée</h3>
                    <p>ID de boutique manquant.</p>
                </div>
            `;
            return;
        }

        const token = getToken();
        if (!token) return;

        try {
            console.log('📥 Chargement de la boutique #' + shopId);

            const shopRes = await fetch('/api/seller/shop/' + shopId);
            const shopData = await shopRes.json();

            if (!shopRes.ok) {
                throw new Error(shopData.error || 'Erreur chargement boutique');
            }

            if (shopData.success) {
                currentShop = shopData.shop;
                products = shopData.products || [];

                renderShop(currentShop);
                renderProducts(products);
            } else {
                throw new Error('Boutique non trouvée');
            }

        } catch (error) {
            console.error('❌ Erreur:', error);
            productsGrid.innerHTML = `
                <div class="products-empty">
                    <i class="fas fa-exclamation-circle"></i>
                    <h3>Erreur de chargement</h3>
                    <p>${error.message}</p>
                </div>
            `;
        }
    }

    // ==========================================
    // RENDU
    // ==========================================

    function renderShop(shop) {
        shopTitle.textContent = shop.name;
        shopName.textContent = shop.name;
        shopLocation.textContent = '📍 ' + (shop.location || 'Non renseignée');
        shopDescription.textContent = shop.description || 'Aucune description';

        if (shop.logo && shop.logo !== 'null') {
            shopBanner.innerHTML = `<img src="${shop.logo}" alt="${shop.name}" />`;
        } else {
            shopBanner.innerHTML = `
                <div class="banner-placeholder">
                    <i class="fas fa-store"></i>
                    <span>${shop.name}</span>
                </div>
            `;
        }
    }

    function renderProducts(productsList) {
        if (!productsList || productsList.length === 0) {
            productsGrid.innerHTML = `
                <div class="products-empty">
                    <i class="fas fa-box-open"></i>
                    <h3>Aucun produit</h3>
                    <p>Ajoutez votre premier produit en cliquant sur "Ajouter"</p>
                </div>
            `;
            productsCount.textContent = '0 produit';
            return;
        }

        productsCount.textContent = productsList.length + ' produit' + (productsList.length > 1 ? 's' : '');

        productsGrid.innerHTML = productsList.map(p => {
            const stock = p.stock || 0;
            let stockClass = '';
            let stockLabel = '📦 ' + stock + ' en stock';
            if (stock === 0) {
                stockClass = 'out';
                stockLabel = '🚫 Rupture';
            } else if (stock <= 5) {
                stockClass = 'low';
                stockLabel = '⚠️ ' + stock + ' restant(s)';
            }

            const imgSrc = p.image || 'https://via.placeholder.com/200x140?text=Produit';

            return `
                <div class="product-card" data-id="${p.id}">
                    <img src="${imgSrc}" alt="${p.name}" class="product-img" loading="lazy" />
                    <div class="product-body">
                        <div class="product-name">${p.name}</div>
                        <div class="product-price">${p.price.toLocaleString()} FCFA</div>
                        <div class="product-stock ${stockClass}">${stockLabel}</div>
                        <div class="product-actions">
                            <button class="btn-action edit" data-id="${p.id}" title="Modifier">
                                <i class="fas fa-pen"></i>
                            </button>
                            <button class="btn-action delete" data-id="${p.id}" title="Supprimer">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Événements
        document.querySelectorAll('.product-card .btn-action.edit').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const id = parseInt(this.dataset.id);
                openEditProduct(id);
            });
        });

        document.querySelectorAll('.product-card .btn-action.delete').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const id = parseInt(this.dataset.id);
                openConfirmDelete(id);
            });
        });
    }

    // ==========================================
    // AJOUTER / MODIFIER PRODUIT
    // ==========================================

    function openAddProduct() {
        overlayTitle.textContent = 'Ajouter un produit';
        editProductId.value = '';
        productForm.reset();
        submitBtn.innerHTML = '<i class="fas fa-save"></i> Ajouter';
        productOverlay.classList.add('active');
    }

    function openEditProduct(id) {
        const product = products.find(p => p.id === id);
        if (!product) return;

        overlayTitle.textContent = 'Modifier le produit';
        editProductId.value = id;
        document.getElementById('productName').value = product.name;
        document.getElementById('productPrice').value = product.price;
        document.getElementById('productStock').value = product.stock || 0;
        document.getElementById('productImage').value = product.image || '';
        document.getElementById('productDescription').value = product.description || '';
        document.getElementById('productCategory').value = product.category || '';
        submitBtn.innerHTML = '<i class="fas fa-save"></i> Modifier';
        productOverlay.classList.add('active');
    }

    function closeProductOverlay() {
        productOverlay.classList.remove('active');
        productForm.reset();
        editProductId.value = '';
    }

    addProductBtn.addEventListener('click', openAddProduct);
    closeOverlay.addEventListener('click', closeProductOverlay);
    productOverlay.addEventListener('click', function(e) {
        if (e.target === productOverlay) closeProductOverlay();
    });

    // ==========================================
    // SOUMISSION PRODUIT
    // ==========================================

    productForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const id = editProductId.value;
        const name = document.getElementById('productName').value.trim();
        const price = parseInt(document.getElementById('productPrice').value);
        const stock = parseInt(document.getElementById('productStock').value) || 0;
        const image = document.getElementById('productImage').value.trim();
        const description = document.getElementById('productDescription').value.trim();
        const category = document.getElementById('productCategory').value.trim();

        if (!name) {
            alert('⚠️ Veuillez entrer un nom de produit.');
            return;
        }

        if (!price || price <= 0) {
            alert('⚠️ Veuillez entrer un prix valide.');
            return;
        }

        const token = getToken();
        if (!token) return;

        // ✅ Récupérer le shop_id depuis l'URL
        const shop_id = parseInt(shopId);

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enregistrement...';
        loaderOverlay.classList.add('active');

        try {
            const url = id ? '/api/seller/product/' + id : '/api/seller/product';
            const method = id ? 'PUT' : 'POST';

            const body = {
                name,
                price,
                stock,
                image: image || null,
                description: description || null,
                category: category || null,
                shop_id: shop_id
            };

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                },
                body: JSON.stringify(body)
            });

            const data = await response.json();

            if (response.ok && data.success) {
                closeProductOverlay();
                loaderOverlay.classList.remove('active');
                await loadShop();
                alert(id ? '✅ Produit modifié avec succès !' : '✅ Produit ajouté avec succès !');
            } else {
                throw new Error(data.error || 'Erreur');
            }

        } catch (error) {
            console.error('❌ Erreur:', error);
            loaderOverlay.classList.remove('active');
            alert('❌ ' + error.message);
        }

        submitBtn.disabled = false;
        submitBtn.innerHTML = id ? '<i class="fas fa-save"></i> Modifier' : '<i class="fas fa-save"></i> Ajouter';
    });

    // ==========================================
    // SUPPRESSION
    // ==========================================

    function openConfirmDelete(id) {
        const product = products.find(p => p.id === id);
        if (!product) return;
        deleteTargetId = id;
        confirmMessage.textContent = 'Êtes-vous sûr de vouloir supprimer "' + product.name + '" ?';
        confirmOverlay.classList.add('active');
    }

    confirmCancel.addEventListener('click', function() {
        confirmOverlay.classList.remove('active');
        deleteTargetId = null;
    });

    confirmOk.addEventListener('click', async function() {
        if (!deleteTargetId) return;

        const token = getToken();
        if (!token) return;

        const shop_id = parseInt(shopId);

        loaderOverlay.classList.add('active');

        try {
            const response = await fetch('/api/seller/product/' + deleteTargetId + '?shop_id=' + shop_id, {
                method: 'DELETE',
                headers: {
                    'Authorization': 'Bearer ' + token
                }
            });

            const data = await response.json();

            if (response.ok && data.success) {
                confirmOverlay.classList.remove('active');
                loaderOverlay.classList.remove('active');
                deleteTargetId = null;
                await loadShop();
                alert('🗑️ Produit supprimé avec succès !');
            } else {
                throw new Error(data.error || 'Erreur suppression');
            }

        } catch (error) {
            console.error('❌ Erreur:', error);
            loaderOverlay.classList.remove('active');
            alert('❌ ' + error.message);
        }
    });

    confirmOverlay.addEventListener('click', function(e) {
        if (e.target === confirmOverlay) {
            confirmOverlay.classList.remove('active');
            deleteTargetId = null;
        }
    });

    // ==========================================
    // INITIALISATION
    // ==========================================

    if (!checkAuth()) return;

    (async function init() {
        await loadShop();
        console.log('✅ Shop - Prêt');
    })();

});