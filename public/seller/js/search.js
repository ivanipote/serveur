document.addEventListener('DOMContentLoaded', function() {

    console.log('✅ Search - Vendeur');

    // ==========================================
    // RÉFÉRENCES
    // ==========================================

    const searchInput = document.getElementById('searchInput');
    const clearBtn = document.getElementById('clearBtn');
    const resultsGrid = document.getElementById('resultsGrid');
    const initialState = document.getElementById('initialState');
    const noResults = document.getElementById('noResults');
    const noResultsMessage = document.getElementById('noResultsMessage');
    const loadingState = document.getElementById('loadingState');

    // ==========================================
    // ÉTAT
    // ==========================================

    let allProducts = [];
    let searchTimeout = null;
    let isSearching = false;

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
                allProducts = productsArrays.flat();

                console.log('📦 Produits chargés:', allProducts.length);
            } else {
                allProducts = [];
            }

        } catch (error) {
            console.error('❌ Erreur chargement produits:', error);
            allProducts = [];
        }
    }

    // ==========================================
    // RECHERCHE
    // ==========================================

    function performSearch(query) {
        const trimmedQuery = query.trim();

        // Cacher tous les états
        initialState.style.display = 'none';
        noResults.style.display = 'none';
        loadingState.style.display = 'none';

        if (trimmedQuery === '') {
            resultsGrid.style.display = 'none';
            initialState.style.display = 'block';
            return;
        }

        if (allProducts.length === 0) {
            resultsGrid.style.display = 'none';
            noResults.style.display = 'block';
            noResultsMessage.textContent = 'Aucun produit disponible';
            return;
        }

        // Filtrer les produits
        const lowerQuery = trimmedQuery.toLowerCase();
        const results = allProducts.filter(p =>
            p.name.toLowerCase().includes(lowerQuery) ||
            (p.description && p.description.toLowerCase().includes(lowerQuery)) ||
            (p.category && p.category.toLowerCase().includes(lowerQuery))
        );

        if (results.length === 0) {
            resultsGrid.style.display = 'none';
            noResults.style.display = 'block';
            noResultsMessage.textContent = 'Aucun produit ne correspond à "' + trimmedQuery + '"';
            return;
        }

        // Afficher les résultats
        resultsGrid.style.display = 'grid';
        renderResults(results);
    }

    function renderResults(products) {
        resultsGrid.innerHTML = products.map(p => {
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
    // GESTION DE LA SAISIE
    // ==========================================

    searchInput.addEventListener('input', function() {
        const query = this.value;

        // Afficher le bouton clear
        clearBtn.style.display = query.length > 0 ? 'block' : 'none';

        // Annuler le timeout précédent
        if (searchTimeout) {
            clearTimeout(searchTimeout);
        }

        // Afficher le loading
        if (query.trim().length > 0) {
            loadingState.style.display = 'block';
            resultsGrid.style.display = 'none';
            initialState.style.display = 'none';
            noResults.style.display = 'none';
        }

        // Lancer la recherche après 300ms
        searchTimeout = setTimeout(() => {
            performSearch(query);
        }, 300);
    });

    // ==========================================
    // BOUTON CLEAR
    // ==========================================

    clearBtn.addEventListener('click', function() {
        searchInput.value = '';
        this.style.display = 'none';
        searchInput.focus();
        performSearch('');
    });

    // ==========================================
    // INITIALISATION
    // ==========================================

    if (!checkAuth()) return;

    (async function init() {
        await loadAllProducts();
        console.log('✅ Search - Prêt');
        searchInput.focus();
    })();

});