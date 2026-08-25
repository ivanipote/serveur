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
    const deleteShopBtn = document.getElementById('deleteShopBtn');
    const gpsBtn = document.getElementById('gpsBtn');

    // Slide (modification)
    const slideOverlay = document.getElementById('slideOverlay');
    const slideClose = document.getElementById('slideClose');
    const slideTitle = document.getElementById('slideTitle');
    const editProductId = document.getElementById('editProductId');
    const productForm = document.getElementById('productForm');
    const submitBtn = document.getElementById('submitProductBtn');

    // Confirm
    const confirmOverlay = document.getElementById('confirmOverlay');
    const confirmCancel = document.getElementById('confirmCancel');
    const confirmOk = document.getElementById('confirmOk');
    const confirmMessage = document.getElementById('confirmMessage');

    // Delete Shop Confirm
    const deleteShopOverlay = document.getElementById('deleteShopOverlay');
    const deleteShopCancel = document.getElementById('deleteShopCancel');
    const deleteShopConfirm = document.getElementById('deleteShopConfirm');

    // Loader
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

        // ✅ Afficher le bouton GPS si des coordonnées existent
        const lat = shop.latitude || shop.flex1 || null;
        const lon = shop.longitude || shop.flex2 || null;

        if (lat && lon) {
            gpsBtn.style.display = 'inline-flex';
            gpsBtn.dataset.lat = lat;
            gpsBtn.dataset.lon = lon;
        } else {
            gpsBtn.style.display = 'none';
        }
    }

    function renderProducts(productsList) {
        if (!productsList || productsList.length === 0) {
            productsGrid.innerHTML = `
                <div class="products-empty">
                    <i class="fas fa-box-open"></i>
                    <h3>Aucun produit</h3>
                    <p>Ajoutez votre premier produit</p>
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

            const imgSrc = p.image1 || p.image || null;

            return `
                <div class="product-card" data-id="${p.id}">
                    ${imgSrc 
                        ? `<img src="${imgSrc}" alt="${p.name}" class="product-img" loading="lazy" />`
                        : `<div class="product-img no-image"><i class="fas fa-box"></i></div>`
                    }
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

        // ✅ Clic sur la carte → détail produit
        document.querySelectorAll('.product-card').forEach(card => {
            card.addEventListener('click', function(e) {
                if (e.target.closest('.product-actions')) return;
                const id = this.dataset.id;
                window.location.href = '/detailproduct?id=' + id;
            });
        });

        // ✅ Modifier → slide overlay
        document.querySelectorAll('.product-card .btn-action.edit').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const id = parseInt(this.dataset.id);
                openEditSlide(id);
            });
        });

        // ✅ Supprimer → confirmation
        document.querySelectorAll('.product-card .btn-action.delete').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const id = parseInt(this.dataset.id);
                openConfirmDelete(id);
            });
        });
    }

    // ==========================================
    // BOUTON GPS
    // ==========================================

    gpsBtn.addEventListener('click', function() {
        const lat = this.dataset.lat;
        const lon = this.dataset.lon;
        if (lat && lon) {
            const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
            window.open(url, '_blank');
        }
    });

    // ==========================================
    // BOUTON AJOUTER → REDIRECTION
    // ==========================================

    addProductBtn.addEventListener('click', function() {
        window.location.href = '/create-product?id=' + shopId;
    });

    // ==========================================
    // BOUTON SUPPRIMER BOUTIQUE
    // ==========================================

    deleteShopBtn.addEventListener('click', function() {
        deleteShopOverlay.classList.add('active');
    });

    deleteShopCancel.addEventListener('click', function() {
        deleteShopOverlay.classList.remove('active');
    });

    deleteShopConfirm.addEventListener('click', async function() {
        const token = getToken();
        if (!token) return;

        deleteShopOverlay.classList.remove('active');
        loaderOverlay.classList.add('active');

        try {
            const response = await fetch('/api/seller/shop?shop_id=' + shopId, {
                method: 'DELETE',
                headers: {
                    'Authorization': 'Bearer ' + token
                }
            });

            const data = await response.json();

            if (response.ok && data.success) {
                loaderOverlay.classList.remove('active');
                alert('🗑️ Boutique supprimée avec succès !');
                window.location.href = '/dashboard';
            } else {
                throw new Error(data.error || 'Erreur suppression');
            }

        } catch (error) {
            console.error('❌ Erreur:', error);
            loaderOverlay.classList.remove('active');
            alert('❌ ' + error.message);
        }
    });

    deleteShopOverlay.addEventListener('click', function(e) {
        if (e.target === deleteShopOverlay) {
            deleteShopOverlay.classList.remove('active');
        }
    });

    // ==========================================
    // SLIDE : MODIFIER PRODUIT
    // ==========================================

    function openEditSlide(id) {
        const product = products.find(p => p.id === id);
        if (!product) return;

        slideTitle.textContent = 'Modifier le produit';
        editProductId.value = id;
        document.getElementById('productName').value = product.name;
        document.getElementById('productPrice').value = product.price;
        document.getElementById('productStock').value = product.stock || 0;
        document.getElementById('productImage').value = product.image1 || product.image || '';
        document.getElementById('productDescription').value = product.description || '';
        document.getElementById('productCategory').value = product.category || '';
        submitBtn.innerHTML = '<i class="fas fa-save"></i> Modifier';

        slideOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeSlide() {
        slideOverlay.classList.remove('active');
        document.body.style.overflow = '';
        productForm.reset();
        editProductId.value = '';
    }

    slideClose.addEventListener('click', closeSlide);
    slideOverlay.addEventListener('click', function(e) {
        if (e.target === slideOverlay) closeSlide();
    });

    // ==========================================
    // SOUMISSION (MODIFICATION)
    // ==========================================

    productForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const id = editProductId.value;
        if (!id) return;

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

        const shop_id = parseInt(shopId);

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enregistrement...';
        loaderOverlay.classList.add('active');

        try {
            const response = await fetch('/api/seller/product/' + id, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                },
                body: JSON.stringify({
                    name,
                    price,
                    stock,
                    image: image || null,
                    description: description || null,
                    category: category || null,
                    shop_id: shop_id
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                closeSlide();
                loaderOverlay.classList.remove('active');
                await loadShop();
                alert('✅ Produit modifié avec succès !');
            } else {
                throw new Error(data.error || 'Erreur');
            }

        } catch (error) {
            console.error('❌ Erreur:', error);
            loaderOverlay.classList.remove('active');
            alert('❌ ' + error.message);
        }

        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-save"></i> Modifier';
    });

    // ==========================================
    // SUPPRESSION PRODUIT
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