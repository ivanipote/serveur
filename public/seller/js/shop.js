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
                    </div>
                </div>
            `;
        }).join('');

        // ✅ Clic sur la carte → detailproduct
        document.querySelectorAll('.product-card').forEach(card => {
            card.addEventListener('click', function() {
                const id = this.dataset.id;
                window.location.href = '/detailproduct?id=' + id;
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
    // SLIDE : MODIFIER PRODUIT (via double-clic ou autre)
    // ==========================================

    // Optionnel : on garde le slide pour une autre interaction
    // Mais les boutons sont retirés des cartes

    // ==========================================
    // INITIALISATION
    // ==========================================

    if (!checkAuth()) return;

    (async function init() {
        await loadShop();
        console.log('✅ Shop - Prêt');
    })();

});