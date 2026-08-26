document.addEventListener('DOMContentLoaded', function() {

    console.log('✅ Boutiques - Version améliorée');

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
    let searchTimeout = null;
    let isLoading = false;

    // ==========================================
    // URL DU SERVEUR
    // ==========================================

    const SELLER_API_URL = 'https://nature-plus-seller.onrender.com';
    const CLIENT_API_URL = 'https://nature-plus-client.onrender.com';

    // ==========================================
    // CHARGER LES BOUTIQUES
    // ==========================================

    async function loadShops() {
        if (isLoading) return;
        isLoading = true;

        // Afficher le skeleton
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

            skeletonLoader.style.display = 'none';

            if (data.success && data.shops && data.shops.length > 0) {
                allShops = data.shops;
                await loadShopsDetails(allShops);
                renderShops(allShops);
            } else {
                emptyState.style.display = 'block';
            }

        } catch (error) {
            console.error('❌ Erreur:', error);
            skeletonLoader.style.display = 'none';
            emptyState.style.display = 'block';
            emptyState.querySelector('p').textContent = 'Erreur de chargement. Veuillez réessayer.';
        } finally {
            isLoading = false;
        }
    }

    // ==========================================
    // CHARGER LES DÉTAILS DES BOUTIQUES (commentaires, likes)
    // ==========================================

    async function loadShopsDetails(shops) {
        for (const shop of shops) {
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
            } catch (err) {
                shop.total_comments = 0;
                shop.total_likes = 0;
            }
        }
    }

    // ==========================================
    // AFFICHER LES BOUTIQUES
    // ==========================================

    function renderShops(shops) {
        if (shops.length === 0) {
            shopsList.style.display = 'none';
            noResults.style.display = 'block';
            noResultsMessage.textContent = 'Aucune boutique ne correspond à votre recherche.';
            return;
        }

        shopsList.style.display = 'block';
        noResults.style.display = 'none';
        emptyState.style.display = 'none';

        shopsList.innerHTML = shops.map((shop, index) => `
            <div class="list-row" onclick="openShop(${shop.id})" style="animation-delay: ${(index * 0.04)}s;">
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
        `).join('');
    }

    // ==========================================
    // RECHERCHE INSTANTANÉE (filtrage uniquement)
    // ==========================================

    function performSearch(query) {
        const trimmed = query.trim();

        if (trimmed === '') {
            renderShops(allShops);
            return;
        }

        // ✅ Filtrer sans recharger
        const filtered = allShops.filter(shop =>
            shop.name.toLowerCase().includes(trimmed.toLowerCase()) ||
            (shop.description && shop.description.toLowerCase().includes(trimmed.toLowerCase())) ||
            (shop.seller_name && shop.seller_name.toLowerCase().includes(trimmed.toLowerCase()))
        );

        renderShops(filtered);
    }

    searchInput.addEventListener('input', function() {
        const query = this.value;

        clearBtn.style.display = query.length > 0 ? 'block' : 'none';

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
    // OUVERTURE BOUTIQUE → +1 vue + redirection
    // ==========================================

    window.openShop = function(shopId) {
        fetch(SELLER_API_URL + '/api/seller/shop/' + shopId + '/view', {
            method: 'POST'
        }).catch(err => console.warn('Erreur incrément vue:', err));

        window.location.href = SELLER_API_URL + '/shop-user?id=' + shopId;
    };

    // ==========================================
    // INIT
    // ==========================================

    loadShops();
    console.log('✅ Boutiques - Prêt');

});