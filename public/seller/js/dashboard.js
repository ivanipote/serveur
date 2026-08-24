document.addEventListener('DOMContentLoaded', function() {

    console.log('✅ Dashboard vendeur - Production');

    // ==========================================
    // RÉFÉRENCES
    // ==========================================

    const shopCarousel = document.getElementById('shopCarousel');
    const statsBody = document.getElementById('statsBody');
    const searchInput = document.getElementById('searchInput');
    const messageBadge = document.getElementById('messageBadge');
    const shopCounter = document.getElementById('shopCounter');
    const prevBtn = document.getElementById('prevShop');
    const nextBtn = document.getElementById('nextShop');
    const shopCardBg = document.getElementById('shopCardBg');

    let currentIndex = 0;
    let shops = [];

    // ==========================================
    // VÉRIFICATION CONNEXION
    // ==========================================

    function checkAuth() {
        const token = localStorage.getItem('sellerToken');
        if (!token) {
            window.location.href = '/login';
            return false;
        }
        return true;
    }

    // ==========================================
    // RÉCUPÉRER LES DONNÉES DEPUIS L'API
    // ==========================================

    async function loadSellerData() {
        try {
            const token = localStorage.getItem('sellerToken');

            // Récupérer la boutique du vendeur
            const shopRes = await fetch('/api/seller/shop', {
                headers: {
                    'Authorization': 'Bearer ' + token
                }
            });
            const shopData = await shopRes.json();

            if (shopData.success && shopData.hasShop) {
                const shop = shopData.shop;
                const products = shopData.products || [];

                const shopFormatted = {
                    id: shop.id,
                    name: shop.name,
                    location: shop.location,
                    description: shop.description || '',
                    logo: shop.logo || '',
                    articles: products.length,
                    messages: 0,
                    likes: 0,
                    products: products
                };

                shops = [shopFormatted];

                // Récupérer les stats
                try {
                    const statsRes = await fetch('/api/seller/stats', {
                        headers: {
                            'Authorization': 'Bearer ' + token
                        }
                    });
                    const statsData = await statsRes.json();
                    if (statsData.success && statsData.stats && statsData.stats.shop_details) {
                        const shopStats = statsData.stats.shop_details.find(s => s.id === shop.id);
                        if (shopStats) {
                            shops[0].messages = shopStats.total_messages || 0;
                            shops[0].likes = shopStats.total_likes || 0;
                        }
                    }
                } catch (statsError) {
                    console.warn('⚠️ Erreur stats:', statsError);
                }

                renderCarousel(shops);
                renderStats(shops);
                updateMessageBadge();

            } else {
                shops = [];
                renderCarousel(shops);
                renderStats(shops);
                updateMessageBadge();
            }

        } catch (error) {
            console.error('❌ Erreur chargement:', error);
            shops = [];
            renderCarousel(shops);
            renderStats(shops);
            updateMessageBadge();
        }
    }

    // ==========================================
    // METTRE À JOUR L'IMAGE DE FOND
    // ==========================================

    function updateBackground(index) {
        if (!shops || shops.length === 0 || !shops[index]) {
            shopCardBg.style.backgroundImage = 'none';
            shopCardBg.style.background = 'linear-gradient(135deg, #c62828, #b71c1c)';
            shopCardBg.style.filter = 'none';
            shopCardBg.style.transform = 'none';
            return;
        }

        const shop = shops[index];
        const imageUrl = shop.logo || '';

        if (imageUrl && imageUrl !== '' && imageUrl !== 'null' && imageUrl !== 'undefined') {
            shopCardBg.style.backgroundImage = `url(${imageUrl})`;
            shopCardBg.style.background = 'none';
            shopCardBg.style.filter = 'blur(6px) brightness(0.5)';
            shopCardBg.style.backgroundSize = 'cover';
            shopCardBg.style.backgroundPosition = 'center';
            shopCardBg.style.transform = 'scale(1.05)';
        } else {
            shopCardBg.style.backgroundImage = 'none';
            shopCardBg.style.background = 'linear-gradient(135deg, #c62828, #b71c1c)';
            shopCardBg.style.filter = 'none';
            shopCardBg.style.transform = 'none';
        }
    }

    // ==========================================
    // AFFICHAGE CAROUSEL
    // ==========================================

    function renderCarousel(shopsData) {
        shops = shopsData;

        if (!shops || shops.length === 0) {
            shopCarousel.innerHTML = `
                <div class="shop-slide">
                    <div class="shop-empty">
                        <i class="fas fa-store"></i>
                        <p>Vous n'avez pas encore de boutique</p>
                        <p style="font-size:13px;color:rgba(255,255,255,0.6);margin-top:4px;">Créez votre première boutique pour commencer</p>
                    </div>
                </div>
            `;
            shopCounter.textContent = '0 / 0';
            prevBtn.disabled = true;
            nextBtn.disabled = true;
            updateBackground(0);
            return;
        }

        shopCarousel.innerHTML = shops.map((shop, index) => `
            <div class="shop-slide" data-id="${shop.id}" data-index="${index}">
                <div class="shop-item">
                    <span class="shop-icon">🏪</span>
                    <div class="shop-name">${shop.name}</div>
                    <span class="shop-location">📍 ${shop.location}</span>
                    <div class="shop-desc">${shop.description || ''}</div>
                </div>
            </div>
        `).join('');

        currentIndex = 0;
        updateCarousel();

        document.querySelectorAll('.shop-slide').forEach(slide => {
            slide.addEventListener('click', function() {
                const id = this.dataset.id;
                if (id) {
                    window.location.href = '/shop?id=' + id;
                }
            });
        });
    }

    // ==========================================
    // CAROUSEL NAVIGATION
    // ==========================================

    function updateCarousel() {
        const slides = shopCarousel.querySelectorAll('.shop-slide');
        const total = slides.length;

        if (total === 0) {
            shopCounter.textContent = '0 / 0';
            prevBtn.disabled = true;
            nextBtn.disabled = true;
            return;
        }

        slides.forEach((slide, index) => {
            slide.style.display = index === currentIndex ? 'flex' : 'none';
        });

        updateBackground(currentIndex);

        shopCounter.textContent = `${currentIndex + 1} / ${total}`;

        prevBtn.disabled = currentIndex === 0;
        nextBtn.disabled = currentIndex === total - 1;
    }

    prevBtn.addEventListener('click', function() {
        if (currentIndex > 0) {
            currentIndex--;
            updateCarousel();
        }
    });

    nextBtn.addEventListener('click', function() {
        const total = shopCarousel.querySelectorAll('.shop-slide').length;
        if (currentIndex < total - 1) {
            currentIndex++;
            updateCarousel();
        }
    });

    // ==========================================
    // AFFICHAGE STATS
    // ==========================================

    function renderStats(shopsData) {
        if (!shopsData || shopsData.length === 0) {
            statsBody.innerHTML = `
                <tr>
                    <td colspan="4" class="stats-empty">Aucune donnée disponible</td>
                </tr>
            `;
            return;
        }

        statsBody.innerHTML = shopsData.map(shop => `
            <tr>
                <td class="shop-name">${shop.name}</td>
                <td class="stat-number articles">${shop.articles || 0}</td>
                <td class="stat-number messages">${shop.messages || 0}</td>
                <td class="stat-number likes">${shop.likes || 0}</td>
            </tr>
        `).join('');
    }

    // ==========================================
    // RECHERCHE
    // ==========================================

    searchInput.addEventListener('input', function() {
        const query = this.value.toLowerCase().trim();

        if (query === '') {
            renderCarousel(shops);
            renderStats(shops);
            return;
        }

        const filtered = shops.filter(shop =>
            shop.name.toLowerCase().includes(query) ||
            shop.location.toLowerCase().includes(query) ||
            (shop.description && shop.description.toLowerCase().includes(query))
        );

        renderCarousel(filtered);
        renderStats(filtered);
    });

    // ==========================================
    // MESSAGE BADGE
    // ==========================================

    function updateMessageBadge() {
        const totalMessages = shops.reduce((sum, shop) => sum + (shop.messages || 0), 0);
        messageBadge.textContent = totalMessages > 0 ? totalMessages : '0';
    }

    // ==========================================
    // RAFRAÎCHIR LES DONNÉES
    // ==========================================

    async function refreshData() {
        console.log('🔄 Rafraîchissement des données...');
        await loadSellerData();
    }

    // ==========================================
    // SOCKET.IO - MISE À JOUR EN TEMPS RÉEL
    // ==========================================

    let socket = null;
    let isSocketConnected = false;

    function connectSocketIO() {
        if (socket) {
            socket.disconnect();
            socket = null;
        }

        try {
            const sellerId = localStorage.getItem('sellerId') || '1';

            socket = io({
                auth: {
                    sellerId: parseInt(sellerId)
                },
                transports: ['websocket', 'polling'],
                timeout: 5000,
                reconnection: true,
                reconnectionAttempts: 20,
                reconnectionDelay: 500
            });

            socket.on('connect', function() {
                console.log('✅ Socket.IO vendeur connecté');
                isSocketConnected = true;
            });

            socket.on('disconnect', function() {
                console.log('❌ Socket.IO vendeur déconnecté');
                isSocketConnected = false;
                setTimeout(() => {
                    if (!isSocketConnected) {
                        connectSocketIO();
                    }
                }, 3000);
            });

            socket.on('seller-update', function(data) {
                console.log('🔔 Mise à jour vendeur reçue:', data);
                refreshData();
            });

        } catch (error) {
            console.error('❌ Erreur Socket.IO:', error);
            setTimeout(() => connectSocketIO(), 5000);
        }
    }

    // ==========================================
    // INITIALISATION
    // ==========================================

    if (!checkAuth()) return;

    await loadSellerData();
    connectSocketIO();

    // Rafraîchir toutes les 30 secondes
    setInterval(() => {
        refreshData();
    }, 30000);

    console.log('✅ Dashboard vendeur - Production prêt');

});