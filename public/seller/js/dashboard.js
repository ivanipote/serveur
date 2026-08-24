document.addEventListener('DOMContentLoaded', function() {

    console.log('✅ Dashboard vendeur - Version complète');

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

    // ==========================================
    // ÉTAT
    // ==========================================

    let currentIndex = 0;
    let shops = [];
    let sellerData = null;
    let isDataLoaded = false;

    // ==========================================
    // VÉRIFICATION CONNEXION
    // ==========================================

    function checkAuth() {
        const token = localStorage.getItem('sellerToken');
        if (!token) {
            console.warn('⚠️ Non authentifié, redirection vers login');
            window.location.href = '/login';
            return false;
        }
        return true;
    }

    function getToken() {
        return localStorage.getItem('sellerToken');
    }

    // ==========================================
    // CHARGEMENT DES DONNÉES
    // ==========================================

    async function loadSellerData() {
        const token = getToken();
        if (!token) return;

        try {
            console.log('📥 Chargement des données vendeur...');

            // 1. Récupérer la boutique
            const shopRes = await fetch('/api/seller/shop', {
                headers: {
                    'Authorization': 'Bearer ' + token
                }
            });
            const shopData = await shopRes.json();

            if (!shopRes.ok) {
                throw new Error(shopData.error || 'Erreur chargement boutique');
            }

            if (shopData.success && shopData.hasShop) {
                const shop = shopData.shop;
                const products = shopData.products || [];

                // Construire l'objet boutique
                sellerData = {
                    id: shop.id,
                    name: shop.name,
                    location: shop.location,
                    description: shop.description || '',
                    logo: shop.logo || '',
                    status: shop.status || 'active',
                    articles: products.length,
                    messages: 0,
                    likes: 0,
                    views: 0,
                    products: products
                };

                // 2. Récupérer les stats
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
                            sellerData.messages = shopStats.total_messages || 0;
                            sellerData.likes = shopStats.total_likes || 0;
                            sellerData.views = shopStats.total_views || 0;
                            sellerData.articles = shopStats.total_products || products.length;
                        }
                    }
                } catch (statsError) {
                    console.warn('⚠️ Erreur stats (non bloquante):', statsError);
                }

                shops = [sellerData];
                isDataLoaded = true;

                renderCarousel(shops);
                renderStats(shops);
                updateMessageBadge();
                updateBackground(0);

                console.log('✅ Données chargées:', sellerData);

            } else {
                // Pas de boutique
                shops = [];
                isDataLoaded = true;
                renderCarousel(shops);
                renderStats(shops);
                updateMessageBadge();
                showEmptyState('Vous n\'avez pas encore de boutique', 'Créez votre première boutique pour commencer');
            }

        } catch (error) {
            console.error('❌ Erreur chargement:', error);
            shops = [];
            isDataLoaded = true;
            renderCarousel(shops);
            renderStats(shops);
            updateMessageBadge();
            showEmptyState('Erreur de chargement', 'Veuillez rafraîchir la page');
        }
    }

    // ==========================================
    // AFFICHAGE ÉTAT VIDE
    // ==========================================

    function showEmptyState(title, subtitle) {
        shopCarousel.innerHTML = `
            <div class="shop-slide">
                <div class="shop-empty">
                    <i class="fas fa-store"></i>
                    <p>${title}</p>
                    <p style="font-size:13px;color:rgba(255,255,255,0.6);margin-top:4px;">${subtitle}</p>
                    <a href="/create-shop" style="display:inline-block;margin-top:12px;padding:8px 24px;background:rgba(255,255,255,0.2);border-radius:30px;color:white;text-decoration:none;font-weight:600;border:1px solid rgba(255,255,255,0.2);">
                        <i class="fas fa-plus-circle"></i> Créer ma boutique
                    </a>
                </div>
            </div>
        `;
        shopCounter.textContent = '0 / 0';
        prevBtn.disabled = true;
        nextBtn.disabled = true;
        shopCardBg.style.background = 'linear-gradient(135deg, #17A464, #0E7A49)';
        shopCardBg.style.filter = 'none';
        shopCardBg.style.transform = 'none';
    }

    // ==========================================
    // IMAGE DE FOND
    // ==========================================

    function updateBackground(index) {
        if (!shops || shops.length === 0 || !shops[index]) {
            shopCardBg.style.backgroundImage = 'none';
            shopCardBg.style.background = 'linear-gradient(135deg, #17A464, #0E7A49)';
            shopCardBg.style.filter = 'none';
            shopCardBg.style.transform = 'none';
            return;
        }

        const shop = shops[index];
        const imageUrl = shop.logo || '';

        if (imageUrl && imageUrl !== '' && imageUrl !== 'null' && imageUrl !== 'undefined') {
            shopCardBg.style.backgroundImage = `url(${imageUrl})`;
            shopCardBg.style.background = 'none';
            shopCardBg.style.backgroundSize = 'cover';
            shopCardBg.style.backgroundPosition = 'center';
            shopCardBg.style.filter = 'blur(6px) brightness(0.5)';
            shopCardBg.style.transform = 'scale(1.05)';
        } else {
            shopCardBg.style.backgroundImage = 'none';
            shopCardBg.style.background = 'linear-gradient(135deg, #17A464, #0E7A49)';
            shopCardBg.style.filter = 'none';
            shopCardBg.style.transform = 'none';
        }
    }

    // ==========================================
    // CAROUSEL
    // ==========================================

    function renderCarousel(shopsData) {
        shops = shopsData;

        if (!shops || shops.length === 0) {
            showEmptyState('Aucune boutique', 'Créez votre première boutique');
            return;
        }

        shopCarousel.innerHTML = shops.map((shop, index) => `
            <div class="shop-slide" data-id="${shop.id}" data-index="${index}">
                <div class="shop-item">
                    <span class="shop-icon">🏪</span>
                    <div class="shop-name">${shop.name}</div>
                    <span class="shop-location">📍 ${shop.location}</span>
                    <div class="shop-desc">${shop.description || ''}</div>
                    <div style="margin-top:8px;display:flex;gap:16px;justify-content:center;font-size:13px;color:rgba(255,255,255,0.8);">
                        <span>📦 ${shop.articles || 0} articles</span>
                        <span>❤️ ${shop.likes || 0}</span>
                        <span>👁️ ${shop.views || 0}</span>
                    </div>
                </div>
            </div>
        `).join('');

        currentIndex = 0;
        updateCarousel();

        // Clic sur une boutique → /shop?id=...
        document.querySelectorAll('.shop-slide').forEach(slide => {
            slide.addEventListener('click', function() {
                const id = this.dataset.id;
                if (id) {
                    window.location.href = '/shop?id=' + id;
                }
            });
        });
    }

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

    // Navigation carousel
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
    // STATS
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
    // MESSAGE BADGE
    // ==========================================

    function updateMessageBadge() {
        const totalMessages = shops.reduce((sum, shop) => sum + (shop.messages || 0), 0);
        if (messageBadge) {
            messageBadge.textContent = totalMessages > 0 ? totalMessages : '0';
        }
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

            socket.on('new-message', function(data) {
                console.log('💬 Nouveau message reçu:', data);
                refreshData();
                showNotification('💬 Nouveau message d\'un client');
            });

        } catch (error) {
            console.error('❌ Erreur Socket.IO:', error);
            setTimeout(() => connectSocketIO(), 5000);
        }
    }

    // ==========================================
    // NOTIFICATION TOAST
    // ==========================================

    function showNotification(message) {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            bottom: 100px;
            left: 50%;
            transform: translateX(-50%);
            background: #17A464;
            color: white;
            padding: 12px 24px;
            border-radius: 12px;
            font-weight: 600;
            font-size: 15px;
            box-shadow: 0 8px 30px rgba(23, 164, 100, 0.3);
            z-index: 999;
            text-align: center;
            max-width: 90%;
            animation: slideUp 0.3s ease;
        `;
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-20px)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }

    // ==========================================
    // INITIALISATION
    // ==========================================

    if (!checkAuth()) return;

    // Charger les données
    await loadSellerData();

    // Connecter Socket.IO
    connectSocketIO();

    // Rafraîchir toutes les 30 secondes
    setInterval(() => {
        refreshData();
    }, 30000);

    // Exposer pour debugging
    window.sellerDashboard = {
        refreshData,
        shops,
        sellerData
    };

    console.log('✅ Dashboard vendeur - Prêt');

});