document.addEventListener('DOMContentLoaded', function() {

    console.log('✅ Boutiques - Connecté à l\'API');

    // ==========================================
    // RÉFÉRENCES
    // ==========================================

    const searchInput = document.getElementById('searchInput');
    const clearBtn = document.getElementById('clearBtn');
    const skeletonLoader = document.getElementById('skeletonLoader');
    const shopsContainer = document.getElementById('shopsContainer');
    const emptyState = document.getElementById('emptyState');
    const noResults = document.getElementById('noResults');
    const noResultsMessage = document.getElementById('noResultsMessage');

    let allShops = [];
    let searchTimeout = null;

    // ==========================================
    // CHARGER LES BOUTIQUES
    // ==========================================

    async function loadShops() {
        try {
            const res = await fetch('/api/shops');

            if (!res.ok) {
                throw new Error('Erreur chargement boutiques');
            }

            const data = await res.json();

            skeletonLoader.style.display = 'none';

            if (data.success && data.shops && data.shops.length > 0) {
                allShops = data.shops;
                renderShops(allShops);
            } else {
                emptyState.style.display = 'block';
            }

        } catch (error) {
            console.error('❌ Erreur:', error);
            skeletonLoader.style.display = 'none';
            emptyState.style.display = 'block';
            emptyState.querySelector('p').textContent = 'Erreur de chargement. Veuillez réessayer.';
        }
    }

    // ==========================================
    // AFFICHER LES CARTES
    // ==========================================

    function renderShops(shops) {
        if (shops.length === 0) {
            shopsContainer.style.display = 'none';
            noResults.style.display = 'block';
            noResultsMessage.textContent = 'Aucune boutique ne correspond à votre recherche.';
            return;
        }

        shopsContainer.style.display = 'block';
        noResults.style.display = 'none';
        emptyState.style.display = 'none';

        shopsContainer.innerHTML = shops.map((shop, index) => `
            <div class="shop-card" onclick="openShop(${shop.id})" style="animation-delay: ${(index * 0.05)}s;">
                <div class="shop-card-bg" style="background-image: url('${shop.logo || 'https://picsum.photos/seed/' + shop.id + '/800/400'}');">
                    <div class="overlay"></div>
                </div>
                <div class="shop-card-content">
                    <div class="shop-card-header">
                        <span class="owner-name"><i class="fas fa-user-circle"></i> ${shop.seller_name || 'Vendeur'}</span>
                    </div>
                    <div class="shop-card-center">
                        <div class="shop-info">
                            <span class="shop-icon">🛒</span>
                            <span class="shop-name">${shop.name}</span>
                            <span class="shop-location">📍 ${shop.location || 'Localisation non renseignée'}</span>
                        </div>
                    </div>
                    <div class="shop-card-footer">
                        <span class="stat-item"><i class="fas fa-box"></i> <span class="stat-value">${shop.total_products || 0}</span> produits</span>
                        <span class="stat-item"><i class="fas fa-eye"></i> <span class="stat-value">${shop.total_views || 0}</span> vues</span>
                        <span class="stat-item"><i class="fas fa-heart"></i> <span class="stat-value">${shop.total_likes || 0}</span> likes</span>
                    </div>
                </div>
            </div>
        `).join('');
    }

    // ==========================================
    // RECHERCHE INSTANTANÉE
    // ==========================================

    function performSearch(query) {
        const trimmed = query.trim();

        if (trimmed === '') {
            renderShops(allShops);
            return;
        }

        const filtered = allShops.filter(shop =>
            shop.name.toLowerCase().includes(trimmed.toLowerCase()) ||
            (shop.location && shop.location.toLowerCase().includes(trimmed.toLowerCase())) ||
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
        // Incrémenter la vue
        fetch('/api/seller/shop/' + shopId + '/view', {
            method: 'POST'
        }).catch(err => console.warn('Erreur incrément vue:', err));

        // ✅ Redirection vers le serveur seller
        window.location.href = 'https://nature-plus-seller.onrender.com/shop-user?id=' + shopId;
    };

    // ==========================================
    // INIT
    // ==========================================

    loadShops();
    console.log('✅ Boutiques - Prêt');

});