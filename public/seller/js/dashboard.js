document.addEventListener('DOMContentLoaded', function() {

    console.log('✅ Dashboard vendeur - Version complète');

    // ==========================================
    // RÉFÉRENCES
    // ==========================================

    const shopCarousel = document.getElementById('shopCarousel');
    const statsBody = document.getElementById('statsBody');
    const messageBadge = document.getElementById('messageBadge');
    const shopCounter = document.getElementById('shopCounter');
    const shopIndicator = document.getElementById('shopIndicator');
    const prevBtn = document.getElementById('prevShop');
    const nextBtn = document.getElementById('nextShop');
    const shopCardBg = document.getElementById('shopCardBg');
    const searchInput = document.getElementById('searchInput');
    const statsMarchand = document.getElementById('statsMarchand');
    const sellerNameBadge = document.getElementById('sellerNameBadge');

    // ==========================================
    // ÉTAT
    // ==========================================

    let currentIndex = 0;
    let shops = [];
    let isDataLoaded = false;
    let autoScrollInterval = null;
    let isAutoScrollActive = true;

    // ==========================================
    // NOM DU VENDEUR
    // ==========================================

    const sellerName = localStorage.getItem('sellerName') || 'Vendeur';
    if (sellerNameBadge) sellerNameBadge.textContent = '👤 ' + sellerName;

    // ==========================================
    // RECHERCHE - REDIRECTION
    // ==========================================

    if (searchInput) {
        searchInput.addEventListener('click', function() {
            window.location.href = '/search';
        });
    }

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
                const shopsList = shopData.shops;

                shops = shopsList.map(shop => ({
                    id: shop.id,
                    name: shop.name,
                    location: shop.location,
                    description: shop.description || '',
                    logo: shop.logo || '',
                    status: shop.status || 'active',
                    articles: shop.product_count || 0,
                    messages: 0,
                    likes: 0,
                    views: 0
                }));

                try {
                    const statsRes = await fetch('/api/seller/stats', {
                        headers: {
                            'Authorization': 'Bearer ' + token
                        }
                    });
                    const statsData = await statsRes.json();

                    if (statsData.success && statsData.stats && statsData.stats.shop_details) {
                        shops.forEach(shop => {
                            const shopStats = statsData.stats.shop_details.find(s => s.id === shop.id);
                            if (shopStats) {
                                shop.messages = shopStats.total_messages || 0;
                                shop.likes = shopStats.total_likes || 0;
                                shop.views = shopStats.total_views || 0;
                                shop.articles = shopStats.total_products || shop.articles;
                            }
                        });
                    }
                } catch (statsError) {
                    console.warn('⚠️ Erreur stats (non bloquante):', statsError);
                }

                isDataLoaded = true;

                // ✅ Mettre à jour le nom du marchand
                const marchandNom = shopsList[0]?.seller_name || sellerName;
                if (statsMarchand) statsMarchand.textContent = '👤 Marchand : ' + marchandNom;

                renderCarousel(shops);
                renderStats(shops);
                updateMessageBadge();
                updateBackground(0);
                startAutoScroll();

                console.log('✅ Données chargées:', shops);

            } else {
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
    // AUTO-SCROLL (7 secondes)
    // ==========================================

    function startAutoScroll() {
        if (autoScrollInterval) {
            clearInterval(autoScrollInterval);
            autoScrollInterval = null;
        }

        if (!isAutoScrollActive) return;
        if (!shops || shops.length <= 1) return;

        console.log('🔄 Auto-scroll démarré (7s)');

        autoScrollInterval = setInterval(() => {
            if (!shops || shops.length === 0) return;
            
            const total = shops.length;
            const nextIndex = (currentIndex + 1) % total;
            currentIndex = nextIndex;
            updateCarousel();
        }, 7000);
    }

    function stopAutoScroll() {
        if (autoScrollInterval) {
            clearInterval(autoScrollInterval);
            autoScrollInterval = null;
            console.log('⏹️ Auto-scroll arrêté');
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
        shopIndicator.textContent = '📦 0 articles';
        prevBtn.disabled = true;
        nextBtn.disabled = true;
        shopCardBg.style.backgroundImage = 'none';
        shopCardBg.style.background = 'linear-gradient(135deg, #17A464, #0E7A49)';
        stopAutoScroll();
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
            shopCardBg.style.background = `url(${imageUrl}) center center / cover no-repeat`;
            shopCardBg.style.filter = 'none';
            shopCardBg.style.transform = 'none';
            shopCardBg.style.opacity = '1';
            console.log('🖼️ Image appliquée:', imageUrl);
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
                    <div class="shop-stats">
                        <span>📦 ${shop.articles || 0}</span>
                        <span>❤️ ${shop.likes || 0}</span>
                        <span>👁️ ${shop.views || 0}</span>
                    </div>
                </div>
            </div>
        `).join('');

        currentIndex = 0;
        updateCarousel();
        startAutoScroll();

        document.querySelectorAll('.shop-slide').forEach(slide => {
            slide.addEventListener('click', function() {
                const id = this.dataset.id;
                if (id) {
                    stopAutoScroll();
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
            shopIndicator.textContent = '📦 0 articles';
            prevBtn.disabled = true;
            nextBtn.disabled = true;
            stopAutoScroll();
            return;
        }

        slides.forEach((slide, index) => {
            slide.style.display = index === currentIndex ? 'flex' : 'none';
        });

        updateBackground(currentIndex);

        const currentShop = shops[currentIndex] || {};
        const totalArticles = shops.reduce((sum, s) => sum + (s.articles || 0), 0);

        shopCounter.textContent = `${currentIndex + 1} / ${total}`;
        shopIndicator.textContent = `📦 ${totalArticles} articles`;

        prevBtn.disabled = currentIndex === 0;
        nextBtn.disabled = currentIndex === total - 1;

        // Redémarrer l'auto-scroll après une interaction manuelle
        if (isAutoScrollActive) {
            startAutoScroll();
        }
    }

    prevBtn.addEventListener('click', function() {
        if (currentIndex > 0) {
            currentIndex--;
            updateCarousel();
            // Réinitialiser le timer après interaction manuelle
            if (isAutoScrollActive) {
                startAutoScroll();
            }
        }
    });

    nextBtn.addEventListener('click', function() {
        const total = shopCarousel.querySelectorAll('.shop-slide').length;
        if (currentIndex < total - 1) {
            currentIndex++;
            updateCarousel();
            if (isAutoScrollActive) {
                startAutoScroll();
            }
        }
    });

    // ==========================================
    // STATS
    // ==========================================

    function renderStats(shopsData) {
        if (!shopsData || shopsData.length === 0) {
            statsBody.innerHTML = `
                <tr>
                    <td colspan="5" class="stats-empty">Aucune donnée disponible</td>
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
                <td class="stat-number views">${shop.views || 0}</td>
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
    // RAFRAÎCHIR LES DONNÉES (avec auto-reload si perte)
    // ==========================================

    let refreshAttempts = 0;
    const MAX_REFRESH_ATTEMPTS = 5;

    async function refreshData() {
        console.log('🔄 Rafraîchissement des données...');
        try {
            await loadSellerData();
            refreshAttempts = 0;
        } catch (error) {
            console.error('❌ Erreur rafraîchissement:', error);
            refreshAttempts++;
            if (refreshAttempts >= MAX_REFRESH_ATTEMPTS) {
                console.warn('⚠️ Trop de tentatives, rechargement de la page...');
                window.location.reload();
            }
        }
    }

    // ==========================================
    // SOCKET.IO (avec reconnexion automatique)
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
                reconnectionAttempts: 10,
                reconnectionDelay: 500,
                reconnectionDelayMax: 3000
            });

            socket.on('connect', function() {
                console.log('✅ Socket.IO vendeur connecté');
                isSocketConnected = true;
                refreshAttempts = 0;
            });

            socket.on('disconnect', function(reason) {
                console.log('❌ Socket.IO vendeur déconnecté:', reason);
                isSocketConnected = false;
                // Tentative de reconnexion après 5s
                setTimeout(() => {
                    if (!isSocketConnected) {
                        console.log('🔄 Tentative de reconnexion Socket.IO...');
                        connectSocketIO();
                    }
                }, 5000);
            });

            socket.on('connect_error', function(error) {
                console.error('❌ Erreur connexion Socket.IO:', error);
                isSocketConnected = false;
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
    // RECHARGEMENT AU RETOUR SUR LA PAGE
    // ==========================================

    document.addEventListener('visibilitychange', function() {
        if (!document.hidden) {
            console.log('🔄 Page visible, rechargement des données');
            refreshData();
            // Réactiver l'auto-scroll
            if (isAutoScrollActive) {
                startAutoScroll();
            }
        }
    });

    // ==========================================
    // INITIALISATION
    // ==========================================

    if (!checkAuth()) return;

    (async function init() {
        await loadSellerData();
        connectSocketIO();

        setInterval(() => {
            refreshData();
        }, 30000);

        window.sellerDashboard = {
            refreshData,
            shops,
            getShops: () => shops,
            startAutoScroll,
            stopAutoScroll
        };

        console.log('✅ Dashboard vendeur - Prêt');
    })();

    // Nettoyer à la fermeture
    window.addEventListener('beforeunload', function() {
        stopAutoScroll();
        if (socket) socket.disconnect();
    });

});