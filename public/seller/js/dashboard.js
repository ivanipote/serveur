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
    // RÉCUPÉRER LES DONNÉES (localStorage)
    // ==========================================

    function getShops() {
        try {
            return JSON.parse(localStorage.getItem('sellerShops')) || [];
        } catch {
            return [];
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
            return;
        }

        const shop = shops[index];

        // ✅ Vérifier si une image existe
        if (shop.image && shop.image !== '' && shop.image !== 'null' && shop.image !== 'undefined') {
            // Si l'image est une URL complète (http:// ou https://)
            if (shop.image.startsWith('http://') || shop.image.startsWith('https://')) {
                shopCardBg.style.backgroundImage = `url(${shop.image})`;
            } else {
                // Sinon, considérer comme un chemin local
                shopCardBg.style.backgroundImage = `url(/uploads/seller/${shop.image})`;
            }
            shopCardBg.style.background = 'none';
            shopCardBg.style.filter = 'blur(6px) brightness(0.5)';
            shopCardBg.style.backgroundSize = 'cover';
            shopCardBg.style.backgroundPosition = 'center';
            shopCardBg.style.transform = 'scale(1.05)';
        } else {
            // ✅ Pas d'image → dégradé rouge
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
        const allShops = getShops();

        if (query === '') {
            renderCarousel(allShops);
            renderStats(allShops);
            return;
        }

        const filtered = allShops.filter(shop =>
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
        const allShops = getShops();
        const totalMessages = allShops.reduce((sum, shop) => sum + (shop.messages || 0), 0);
        messageBadge.textContent = totalMessages > 0 ? totalMessages : '0';
    }

    // ==========================================
    // INITIALISATION
    // ==========================================

    const allShops = getShops();
    renderCarousel(allShops);
    renderStats(allShops);
    updateMessageBadge();

    console.log('✅ Dashboard vendeur - Production prêt');
    console.log(`📊 ${allShops.length} boutique(s) chargée(s)`);

});