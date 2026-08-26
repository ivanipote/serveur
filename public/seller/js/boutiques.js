document.addEventListener('DOMContentLoaded', function() {

    console.log('✅ Boutiques - Modèle Liste Simple');

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
    // AFFICHER LES BOUTIQUES (Modèle 1)
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
                <div class="avatar" style="background: ${shop.color || '#17A464'}22;">
                    ${shop.icon || '🛒'}
                </div>
                <div class="info">
                    <div class="name">${shop.name}</div>
                    <div class="sub">${shop.seller_name || 'Vendeur'} · ${shop.location || 'Localisation non renseignée'}</div>
                </div>
                <div class="stats">
                    <div class="stat">
                        <span class="num">${shop.total_products || 0}</span>
                        <span class="lbl">Produits</span>
                    </div>
                    <div class="stat">
                        <span class="num">${shop.total_views || 0}</span>
                        <span class="lbl">Vues</span>
                    </div>
                    <div class="stat">
                        <span class="num">${shop.total_likes || 0}</span>
                        <span class="lbl">Likes</span>
                    </div>
                </div>
                <i class="fas fa-chevron-right chevron"></i>
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
    // OUVERTURE BOUTIQUE → +1 vue (ENREGISTRÉ)
    // ==========================================

    window.openShop = function(shopId) {
        // ✅ Enregistrer la vue
        fetch('/api/seller/shop/' + shopId + '/view', {
            method: 'POST'
        })
        .then(response => response.json())
        .then(data => {
            console.log('✅ Vue enregistrée pour la boutique #' + shopId);
        })
        .catch(err => console.warn('⚠️ Erreur incrément vue:', err));

        // ✅ Redirection vers le serveur seller
        window.location.href = 'https://nature-plus-seller.onrender.com/shop-user?id=' + shopId;
    };

    // ==========================================
    // INIT
    // ==========================================

    loadShops();
    console.log('✅ Boutiques - Prêt');

});