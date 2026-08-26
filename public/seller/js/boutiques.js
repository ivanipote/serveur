document.addEventListener('DOMContentLoaded', function() {

    console.log('✅ Boutiques - Version finale');

    // ==========================================
    // RÉFÉRENCES
    // ==========================================

    const searchInput = document.getElementById('searchInput');
    const clearBtn = document.getElementById('clearBtn');
    const skeletonLoader = document.getElementById('skeletonLoader');
    const shopsList = document.getElementById('shopsList');
    const emptyState = document.getElementById('emptyState');
    const noResults = document.getElementById('noResults');
    const noResultsMessage = document.getElementById('noResultsMessage');

    let allShops = [];
    let filteredShops = [];
    let searchTimeout = null;
    let isLoading = false;
    let isSearching = false;

    // ==========================================
    // URL
    // ==========================================

    const SELLER_API_URL = 'https://nature-plus-seller.onrender.com';
    const CLIENT_API_URL = 'https://nature-plus-client.onrender.com';

    // ==========================================
    // CHARGER LES BOUTIQUES
    // ==========================================

    async function loadShops() {
        if (isLoading) return;
        isLoading = true;

        // Afficher skeleton
        skeletonLoader.style.display = 'flex';
        shopsList.style.display = 'none';
        emptyState.style.display = 'none';
        noResults.style.display = 'none';

        try {
            const res = await fetch(CLIENT_API_URL + '/api/shops');

            if (!res.ok) {
                throw new Error('Erreur chargement boutiques');
            }

            const data = await res.json();

            // Cacher skeleton
            skeletonLoader.style.display = 'none';

            if (data.success && data.shops && data.shops.length > 0) {
                allShops = data.shops;

                // Charger les détails en parallèle
                await loadShopsDetailsParallel(allShops);

                // Afficher
                filteredShops = [...allShops];
                renderShops(filteredShops);
            } else {
                emptyState.style.display = 'block';
            }

        } catch (error) {
            console.error('❌ Erreur:', error);
            skeletonLoader.style.display = 'none';
            emptyState.style.display = 'block';
            const msg = emptyState.querySelector('p');
            if (msg) msg.textContent = 'Erreur de chargement. Veuillez réessayer.';
        } finally {
            isLoading = false;
        }
    }

    // ==========================================
    // CHARGER LES DÉTAILS EN PARALLÈLE
    // ==========================================

    async function loadShopsDetailsParallel(shops) {
        const promises = shops.map(async (shop) => {
            try {
                const res = await fetch(SELLER_API_URL + '/api/seller/shop/' + shop.id);
                const data = await res.json();

                if (data.success && data.products) {
                    let totalComments = 0;
                    let totalLikes = 0;

                    data.products.forEach(p => {
                        if (p.flex1) {
                            try {
                                const comments = JSON.parse(p.flex1);
                                totalComments += comments.length || 0;
                            } catch (e) {}
                        }
                        totalLikes += parseInt(p.flex2) || 0;
                    });

                    shop.total_comments = totalComments;
                    shop.total_likes = totalLikes;
                }
                return shop;
            } catch (err) {
                shop.total_comments = 0;
                shop.total_likes = 0;
                return shop;
            }
        });

        await Promise.all(promises);
    }

    // ==========================================
    // AFFICHER LES BOUTIQUES
    // ==========================================

    function renderShops(shops) {
        if (!shops || shops.length === 0) {
            shopsList.style.display = 'none';
            if (searchInput.value.trim().length > 0) {
                noResults.style.display = 'block';
                noResultsMessage.textContent = 'Aucune boutique ne correspond à votre recherche.';
            } else {
                emptyState.style.display = 'block';
            }
            return;
        }

        shopsList.style.display = 'block';
        noResults.style.display = 'none';
        emptyState.style.display = 'none';

        shopsList.innerHTML = shops.map((shop, index) => {
            const delay = Math.min(index * 0.04, 0.4);
            return `
                <div class="list-row" onclick="openShop(${shop.id})" style="animation-delay: ${delay}s;">
                    <div class="avatar">
                        ${shop.logo ? `<img src="${shop.logo}" alt="${shop.name}" loading="lazy" />` : `<div class="fallback">🏪</div>`}
                    </div>
                    <div class="info">
                        <div class="name">${shop.name}</div>
                        <div class="desc"><i class="fas fa-store"></i> ${shop.description || 'Aucune description'}</div>
                    </div>
                    <div class="stats">
                        <div class="stat">
                            <span class="num">${shop.total_products || 0}</span>
                            <span class="lbl">Produits</span>
                        </div>
                        <div class="stat">
                            <span class="num">${shop.total_likes || 0}</span>
                            <span class="lbl">Likes</span>
                        </div>
                        <div class="stat">
                            <span class="num">${shop.total_comments || 0}</span>
                            <span class="lbl">Commentaires</span>
                        </div>
                        <div class="stat">
                            <span class="num">${shop.total_views || 0}</span>
                            <span class="lbl">Vues</span>
                        </div>
                    </div>
                    <i class="fas fa-chevron-right chevron"></i>
                </div>
            `;
        }).join('');
    }

    // ==========================================
    // RECHERCHE INSTANTANÉE (filtrage)
    // ==========================================

    function performSearch(query) {
        const trimmed = query.trim();

        if (trimmed === '') {
            filteredShops = [...allShops];
            renderShops(filteredShops);
            return;
        }

        const lowerQuery = trimmed.toLowerCase();
        filteredShops = allShops.filter(shop =>
            shop.name.toLowerCase().includes(lowerQuery) ||
            (shop.description && shop.description.toLowerCase().includes(lowerQuery)) ||
            (shop.seller_name && shop.seller_name.toLowerCase().includes(lowerQuery))
        );

        renderShops(filteredShops);
    }

    // ==========================================
    // ÉVÉNEMENTS RECHERCHE
    // ==========================================

    searchInput.addEventListener('input', function() {
        const query = this.value;

        // Afficher/cacher bouton clear
        clearBtn.style.display = query.length > 0 ? 'block' : 'none';

        // Debounce
        if (searchTimeout) {
            clearTimeout(searchTimeout);
        }

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
    // OUVERTURE BOUTIQUE
    // ==========================================

    window.openShop = function(shopId) {
        // Incrémenter la vue
        fetch(SELLER_API_URL + '/api/seller/shop/' + shopId + '/view', {
            method: 'POST'
        }).catch(() => {});

        // Redirection
        window.location.href = SELLER_API_URL + '/shop-user?id=' + shopId;
    };

    // ==========================================
    // INIT
    // ==========================================

    loadShops();
    console.log('✅ Boutiques - Prêt');

});