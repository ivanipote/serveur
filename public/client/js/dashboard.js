document.addEventListener('DOMContentLoaded', function() {

    console.log('✅ Dashboard ComPlus chargé');

    // ==========================================
    // DONNÉES PRODUITS
    // ==========================================

    let products = [];
    let currentIndex = 0;
    let autoScrollInterval = null;
    let isAuthenticated = false;

    // ==========================================
    // RÉFÉRENCES DOM
    // ==========================================

    const productName = document.getElementById('productName');
    const productPrice = document.getElementById('productPrice');
    const productStock = document.getElementById('productStock');
    const productImage = document.getElementById('productImage');
    const productImagePlaceholder = document.getElementById('productImagePlaceholder');
    const prevBtn = document.getElementById('prevProduct');
    const nextBtn = document.getElementById('nextProduct');
    const addToCartBtn = document.getElementById('addToCartBtn');
    const viewDetailBtn = document.getElementById('viewDetailBtn');
    const currentIndexEl = document.getElementById('currentIndex');
    const totalProductsEl = document.getElementById('totalProducts');
    const carouselHeader = document.getElementById('carouselHeader');
    const carouselFooter = document.getElementById('carouselFooter');
    const dashboardHeader = document.getElementById('dashboardHeader');
    const dynamicCard = document.getElementById('dynamicCard');
    const searchInput = document.getElementById('searchInput');

    const commandeBadge = document.getElementById('commandeBadge');
    const notifBadge = document.getElementById('notifBadge');
    const cartBadge = document.getElementById('cartBadge');

    // ==========================================
    // CHARGER LES PRODUITS DEPUIS L'API
    // ==========================================

    async function loadProducts() {
        try {
            const res = await fetch('/api/products');
            const data = await res.json();
            if (res.ok && data.length > 0) {
                products = data.map(p => ({
                    id: p.id,
                    name: p.name,
                    description: p.description || 'Aucune description',
                    price: p.price || 0,
                    stock: p.quantity || 0,
                    image: p.image1 || ''
                }));
                console.log(`✅ ${products.length} produits chargés`);
                return true;
            }
            return false;
        } catch (error) {
            console.error('❌ Erreur chargement produits:', error);
            return false;
        }
    }

    // ==========================================
    // AUTHENTIFICATION
    // ==========================================

    async function checkAuth() {
        try {
            const res = await fetch('/api/client/me');
            const data = await res.json();
            if (data.success) {
                isAuthenticated = true;
                localStorage.setItem('userId', data.user.id);
                console.log('👤 Utilisateur connecté');
                return true;
            }
        } catch (error) {
            console.log('ℹ️ Utilisateur non connecté');
        }

        const userId = localStorage.getItem('userId');
        if (userId) {
            isAuthenticated = true;
            console.log('👤 Utilisateur connecté (localStorage)');
            return true;
        }

        isAuthenticated = false;
        console.log('👤 Utilisateur non connecté');
        return false;
    }

    // ==========================================
    // BADGES
    // ==========================================

    async function loadBadges() {
        if (!isAuthenticated) {
            if (commandeBadge) commandeBadge.style.display = 'none';
            if (notifBadge) notifBadge.style.display = 'none';
            try {
                const res = await fetch('/api/panier/count');
                const data = await res.json();
                if (res.ok && data.success) {
                    cartBadge.textContent = data.count || 0;
                    cartBadge.style.display = data.count > 0 ? 'flex' : 'none';
                }
            } catch (e) { /* ignore */ }
            return;
        }

        try {
            const res1 = await fetch('/api/commandes');
            if (res1.ok) {
                const data = await res1.json();
                const count = data.length || 0;
                commandeBadge.textContent = count;
                commandeBadge.style.display = count > 0 ? 'flex' : 'none';
            }

            const res2 = await fetch('/api/notifications/count');
            if (res2.ok) {
                const data = await res2.json();
                const count = data.count || 0;
                notifBadge.textContent = count;
                notifBadge.style.display = count > 0 ? 'flex' : 'none';
            }

            const res3 = await fetch('/api/panier/count');
            if (res3.ok) {
                const data = await res3.json();
                const count = data.count || 0;
                cartBadge.textContent = count;
                cartBadge.style.display = count > 0 ? 'flex' : 'none';
            }
        } catch (error) {
            console.error('❌ Erreur badges:', error);
        }
    }

    // ==========================================
    // CARTE DYNAMIQUE
    // ==========================================

    function renderDynamicCard() {
        if (isAuthenticated) {
            dynamicCard.innerHTML = `
                <div class="complus-card">
                    <div class="complus-content">
                        <div class="complus-icon">🛒</div>
                        <h2>ComPlus</h2>
                        <p>Local et rapide, 100% fait en Côte d'Ivoire</p>
                        <p class="complus-sub">Commencer à rechercher et commander vos préférences.</p>
                        <a href="/searchproduct" class="complus-btn">
                            <i class="fas fa-search"></i> Rechercher
                        </a>
                    </div>
                </div>
            `;
        } else {
            dynamicCard.innerHTML = `
                <div class="connect-card">
                    <div class="connect-content">
                        <div class="connect-icon">🔐</div>
                        <h2>Connectez-vous</h2>
                        <p>Connectez-vous pour passer commande et profiter de toutes nos fonctionnalités.</p>
                        <a href="/login" class="connect-btn">
                            <i class="fas fa-sign-in-alt"></i> Se connecter
                        </a>
                    </div>
                </div>
            `;
        }
    }

    // ==========================================
    // AUTO-SCROLL PERMANENT (8s)
    // ==========================================

    function startAutoScroll() {
        if (autoScrollInterval) clearInterval(autoScrollInterval);
        if (products.length <= 1) return;
        autoScrollInterval = setInterval(() => {
            currentIndex = (currentIndex + 1) % products.length;
            updateCarousel(currentIndex);
        }, 8000);
    }

    // ==========================================
    // CARROUSEL
    // ==========================================

    function updateCarousel(index) {
        const product = products[index];
        if (!product) {
            productName.textContent = 'Aucun produit';
            productPrice.textContent = '0 FCFA';
            productStock.textContent = '🚫 Indisponible';
            productImage.style.display = 'none';
            productImagePlaceholder.style.display = 'flex';
            productImagePlaceholder.innerHTML = `
                <i class="fas fa-exclamation-circle" style="font-size:36px;color:#ccc;"></i>
                <span>Aucun produit</span>
            `;
            return;
        }

        // ✅ Mise à jour des infos
        productName.textContent = product.name;
        productPrice.textContent = product.price.toLocaleString() + ' FCFA';
        productStock.textContent = product.stock > 0 ? `📦 ${product.stock} en stock` : '🚫 Rupture de stock';
        productStock.style.color = product.stock > 0 ? '#4ade80' : '#f87171';

        // ✅ Gestion image / placeholder
        if (product.image) {
            productImage.src = product.image;
            productImage.style.display = 'block';
            productImagePlaceholder.style.display = 'none';
        } else {
            productImage.style.display = 'none';
            productImagePlaceholder.style.display = 'flex';
            productImagePlaceholder.innerHTML = `
                <i class="fas fa-image" style="font-size:36px;color:#ccc;"></i>
                <span>Pas d'image</span>
            `;
        }

        // ✅ Image de fond
        const bgImage = product.image ? `url(${product.image})` : 'none';
        dashboardHeader.style.backgroundImage = bgImage;
        carouselHeader.style.backgroundImage = bgImage;
        carouselFooter.style.backgroundImage = bgImage;

        // ✅ Indicateur
        currentIndexEl.textContent = index + 1;
        totalProductsEl.textContent = products.length;

        // ✅ Navigation
        prevBtn.disabled = index === 0;
        nextBtn.disabled = index === products.length - 1;
        prevBtn.style.opacity = index === 0 ? '0.3' : '1';
        nextBtn.style.opacity = index === products.length - 1 ? '0.3' : '1';

        // ✅ Reset zoom
        productImage.classList.remove('zoomed');
    }

    function nextProduct() {
        if (currentIndex < products.length - 1) {
            currentIndex++;
            updateCarousel(currentIndex);
        }
    }

    function prevProduct() {
        if (currentIndex > 0) {
            currentIndex--;
            updateCarousel(currentIndex);
        }
    }

    function toggleZoom() {
        productImage.classList.toggle('zoomed');
    }

    async function addToCart() {
        const product = products[currentIndex];
        if (!product) return;

        if (!isAuthenticated) {
            window.location.href = '/login';
            return;
        }

        try {
            const res = await fetch('/api/panier/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ productId: product.id, quantity: 1 })
            });
            const data = await res.json();
            if (data.success) {
                addToCartBtn.innerHTML = '<i class="fas fa-check"></i> Ajouté !';
                loadBadges();
                setTimeout(() => {
                    addToCartBtn.innerHTML = '<i class="fas fa-plus-circle"></i> Ajouter';
                }, 1500);
            } else if (data.error === 'Non authentifié') {
                window.location.href = '/login';
            }
        } catch (error) {
            console.error('Erreur ajout panier:', error);
        }
    }

    function viewDetail() {
        const product = products[currentIndex];
        if (!product) return;
        window.location.href = `/infoproduit?id=${product.id}`;
    }

    // ==========================================
    // RECHERCHE
    // ==========================================

    if (searchInput) {
        searchInput.addEventListener('click', function() {
            window.location.href = '/searchproduct';
        });
        searchInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                const query = this.value.trim();
                if (query) {
                    window.location.href = `/results?q=${encodeURIComponent(query)}`;
                }
            }
        });
    }

    // ==========================================
    // SOCKET.IO
    // ==========================================

    let socket = null;

    function connectSocketIO() {
        if (socket) {
            socket.disconnect();
            socket = null;
        }

        try {
            const userId = localStorage.getItem('userId') || '1';
            socket = io({
                auth: { userId: parseInt(userId), isAdmin: false }
            });

            socket.on('connect', () => console.log('✅ Socket.IO connecté'));
            socket.on('commande-update', () => loadBadges());
            socket.on('notification', () => loadBadges());
            socket.on('disconnect', () => console.log('❌ Socket.IO déconnecté'));
        } catch (error) {
            console.error('❌ Erreur Socket.IO:', error);
            setTimeout(connectSocketIO, 5000);
        }
    }

    // ==========================================
    // ÉVÉNEMENTS
    // ==========================================

    prevBtn.addEventListener('click', prevProduct);
    nextBtn.addEventListener('click', nextProduct);
    productImage.addEventListener('click', toggleZoom);
    addToCartBtn.addEventListener('click', addToCart);
    viewDetailBtn.addEventListener('click', viewDetail);

    document.addEventListener('keydown', function(e) {
        if (e.key === 'ArrowLeft') prevProduct();
        if (e.key === 'ArrowRight') nextProduct();
    });

    // ==========================================
    // INITIALISATION
    // ==========================================

    (async function init() {
        await checkAuth();

        const loaded = await loadProducts();
        if (!loaded || products.length === 0) {
            productName.textContent = 'Aucun produit disponible';
            productPrice.textContent = '0 FCFA';
            productStock.textContent = '🚫 Aucun produit';
            productImage.style.display = 'none';
            productImagePlaceholder.style.display = 'flex';
            productImagePlaceholder.innerHTML = `
                <i class="fas fa-exclamation-circle" style="font-size:36px;color:#ccc;"></i>
                <span>Aucun produit disponible</span>
            `;
            currentIndexEl.textContent = '0';
            totalProductsEl.textContent = '0';
            prevBtn.disabled = true;
            nextBtn.disabled = true;
            dashboardHeader.style.backgroundImage = 'none';
            carouselHeader.style.backgroundImage = 'none';
            carouselFooter.style.backgroundImage = 'none';
            console.log('⚠️ Aucun produit disponible');
        }

        renderDynamicCard();
        if (products.length > 0) {
            updateCarousel(0);
            startAutoScroll();
        }
        loadBadges();
        connectSocketIO();

        setInterval(loadBadges, 30000);

        console.log('✅ Dashboard ComPlus prêt - Production');
    })();

});