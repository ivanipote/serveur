document.addEventListener('DOMContentLoaded', function() {

    console.log('✅ Products - Tous les produits');

    // ==========================================
    // RÉFÉRENCES
    // ==========================================

    const productsGrid = document.getElementById('productsGrid');
    const totalCount = document.getElementById('totalCount');

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
    // CHARGER TOUS LES PRODUITS
    // ==========================================

    async function loadAllProducts() {
        const token = getToken();
        if (!token) return;

        try {
            console.log('📥 Chargement de tous les produits...');

            // Récupérer toutes les boutiques du vendeur
            const shopRes = await fetch('/api/seller/shops', {
                headers: {
                    'Authorization': 'Bearer ' + token
                }
            });
            const shopData = await shopRes.json();

            if (!shopRes.ok) {
                throw new Error(shopData.error || 'Erreur chargement boutiques');
            }

            if (shopData.success && shopData.shops && shopData.shops.length > 0) {
                // Pour chaque boutique, récupérer les produits
                const allProductsPromises = shopData.shops.map(async (shop) => {
                    const productsRes = await fetch('/api/seller/products/' + shop.id, {
                        headers: {
                            'Authorization': 'Bearer ' + token
                        }
                    });
                    const productsData = await productsRes.json();
                    if (productsRes.ok && productsData.products) {
                        return productsData.products.map(p => ({
                            ...p,
                            shop_name: shop.name,
                            shop_id: shop.id
                        }));
                    }
                    return [];
                });

                const productsArrays = await Promise.all(allProductsPromises);
                const allProducts = productsArrays.flat();

                console.log('📦 Produits chargés:', allProducts.length);

                if (allProducts.length === 0) {
                    renderEmpty();
                } else {
                    renderProducts(allProducts);
                }

                totalCount.textContent = allProducts.length;

            } else {
                renderEmpty();
                totalCount.textContent = '0';
            }

        } catch (error) {
            console.error('❌ Erreur chargement produits:', error);
            productsGrid.innerHTML = `
                <div class="products-empty">
                    <i class="fas fa-exclamation-circle"></i>
                    <h3>Erreur de chargement</h3>
                    <p>${error.message}</p>
                </div>
            `;
            totalCount.textContent = '0';
        }
    }

    // ==========================================
    // AFFICHER LES PRODUITS
    // ==========================================

    function renderProducts(products) {
        productsGrid.innerHTML = products.map(p => {
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
                        <div class="product-shop">
                            <i class="fas fa-store"></i> ${p.shop_name || 'Boutique'}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // ✅ Clic sur une carte → detailproduct
        document.querySelectorAll('.product-card').forEach(card => {
            card.addEventListener('click', function() {
                const id = this.dataset.id;
                window.location.href = '/detailproduct?id=' + id;
            });
        });
    }

    // ==========================================
    // ÉTAT VIDE
    // ==========================================

    function renderEmpty() {
        productsGrid.innerHTML = `
            <div class="products-empty">
                <i class="fas fa-box-open"></i>
                <h3>Aucun produit</h3>
                <p>Ajoutez votre premier produit en cliquant sur "Ajouter" dans votre boutique</p>
            </div>
        `;
    }

    // ==========================================
    // INITIALISATION
    // ==========================================

    if (!checkAuth()) return;

    (async function init() {
        await loadAllProducts();
        console.log('✅ Products - Prêt');
    })();

});