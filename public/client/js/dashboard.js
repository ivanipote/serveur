document.addEventListener('DOMContentLoaded', function() {

    console.log('✅ dashboard.js chargé');

    // ==========================================
    // RÉFÉRENCES
    // ==========================================

    const searchInput = document.getElementById('searchInput');
    const optionsBtn = document.getElementById('optionsBtn');
    const optionsMenu = document.getElementById('optionsMenu');
    const cartBtn = document.getElementById('cartBtn');
    const mesCommandesBtn = document.getElementById('mesCommandesBtn');
    const notifBtn = document.getElementById('notifBtn');
    const commandeBadge = document.getElementById('commandeBadge');
    const notifBadge = document.getElementById('notifBadge');
    const cartBadge = document.getElementById('cartBadge');
    const track = document.getElementById('carouselTrack');
    const detailBg = document.getElementById('detailBg');
    const navCurrent = document.getElementById('navCurrent');
    const navTotal = document.getElementById('navTotal');
    const detailAddBtn = document.getElementById('detailAddBtn');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');

    let products = [];
    let currentIndex = 0;
    let autoScrollInterval;
    let currentUser = null;

    // ==========================================
    // URL DE L'API PAIEMENT (Render)
    // ==========================================

    const PAYMENT_API_URL = 'https://nature-plus-pay.onrender.com';

    // ==========================================
    // VÉRIFICATION CONNEXION (via session)
    // ==========================================

    async function checkAuth() {
        try {
            const res = await fetch('/api/client/me');
            const data = await res.json();
            if (data.success) {
                currentUser = data.user;
                console.log('👤 Utilisateur connecté:', currentUser);
                return true;
            } else {
                window.location.href = '/login';
                return false;
            }
        } catch (error) {
            console.error('❌ Erreur vérification auth:', error);
            window.location.href = '/login';
            return false;
        }
    }

    // ==========================================
    // MENU OPTIONS
    // ==========================================

    if (optionsBtn) {
        optionsBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            optionsMenu.classList.toggle('open');
        });
    }

    document.addEventListener('click', function() {
        if (optionsMenu) optionsMenu.classList.remove('open');
    });

    if (optionsMenu) {
        optionsMenu.addEventListener('click', function(e) {
            e.stopPropagation();
        });
    }

    // ==========================================
    // MON COMPTE → /profil
    // ==========================================

    const accountBtn = document.getElementById('accountBtn');
    if (accountBtn) {
        accountBtn.addEventListener('click', function() {
            window.location.href = '/profil';
        });
    }

    // ==========================================
    // DÉCONNEXION → /login
    // ==========================================

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async function() {
            await fetch('/api/client/logout', { method: 'POST' });
            localStorage.clear();
            window.location.href = '/login';
        });
    }

    // ==========================================
    // RECHERCHE → /searchproduct
    // ==========================================

    if (searchInput) {
        searchInput.addEventListener('click', function() {
            window.location.href = '/searchproduct';
        });
    }

    // ==========================================
    // PANIER → /panier
    // ==========================================

    if (cartBtn) {
        cartBtn.addEventListener('click', function(e) {
            e.preventDefault();
            window.location.href = '/panier';
        });
    }

    // ==========================================
    // MES COMMANDES → /mescommandes
    // ==========================================

    if (mesCommandesBtn) {
        mesCommandesBtn.addEventListener('click', function() {
            window.location.href = '/mescommandes';
        });
    }

    // ==========================================
    // NOTIFICATIONS → /notification
    // ==========================================

    if (notifBtn) {
        notifBtn.addEventListener('click', function() {
            window.location.href = '/notification';
        });
    }

    // ==========================================
    // CHARGER LES BADGES (via session)
    // ==========================================

    async function loadBadges() {
        if (!currentUser) return;

        console.log('📊 Chargement des badges...');

        try {
            // 1. Nombre total de commandes
            const res1 = await fetch('/api/commandes');
            const data1 = await res1.json();
            if (res1.ok && commandeBadge) {
                const count = data1.length || 0;
                commandeBadge.textContent = count;
                commandeBadge.style.display = count > 0 ? 'flex' : 'none';
                console.log('📋 Commandes:', count);
            }

            // 2. Nombre de notifications (messages non lus)
            const res2 = await fetch('/api/notifications/count');
            const data2 = await res2.json();
            if (res2.ok && notifBadge) {
                const count = data2.count || 0;
                notifBadge.textContent = count;
                notifBadge.style.display = count > 0 ? 'flex' : 'none';
                console.log('🔔 Notifications:', count);
            }

            // 3. Nombre d'articles dans le panier
            const res3 = await fetch('/api/panier/count');
            const data3 = await res3.json();
            if (res3.ok && cartBadge) {
                const count = data3.count || 0;
                cartBadge.textContent = count;
                cartBadge.style.display = count > 0 ? 'flex' : 'none';
                console.log('🛒 Panier:', count);
            }
        } catch (error) {
            console.error('❌ Erreur chargement badges:', error);
        }
    }

    // ==========================================
    // CHARGER LES PRODUITS
    // ==========================================

    async function loadProducts() {
        try {
            const res = await fetch('/api/products');
            const data = await res.json();

            if (res.ok && data.length > 0 && track) {
                products = data;
                renderCarousel();
                updateDetail(0);
                goToSlide(0);
                if (navTotal) navTotal.textContent = products.length;
                startAutoScroll();
            } else if (track) {
                track.innerHTML = '<p style="color:#888;text-align:center;padding:40px;">Aucun produit disponible.</p>';
            }
        } catch (error) {
            console.error('Erreur chargement produits:', error);
            if (track) {
                track.innerHTML = '<p style="color:#888;text-align:center;padding:40px;">Erreur de chargement.</p>';
            }
        }
    }

    // ==========================================
    // CARROUSEL
    // ==========================================

    function renderCarousel() {
        if (!track) return;
        track.innerHTML = '';
        products.forEach((p) => {
            const item = document.createElement('div');
            item.className = 'carousel-item';
            const imgSrc = p.image1 || 'https://via.placeholder.com/800x600';
            item.innerHTML = `
                <img src="${imgSrc}" alt="${p.name}" loading="lazy">
                <div class="product-footer">
                    <span class="product-name">${p.name}</span>
                </div>
            `;
            track.appendChild(item);
        });
    }

    function goToSlide(index) {
        if (!track || products.length === 0) return;
        const total = products.length;
        if (index < 0) index = total - 1;
        if (index >= total) index = 0;
        currentIndex = index;
        track.style.transform = `translateX(-${currentIndex * 100}%)`;
        if (navCurrent) navCurrent.textContent = currentIndex + 1;
        updateDetail(currentIndex);
    }

    function startAutoScroll() {
        if (autoScrollInterval) clearInterval(autoScrollInterval);
        autoScrollInterval = setInterval(() => {
            const total = products.length;
            if (total === 0) return;
            const next = (currentIndex + 1) % total;
            goToSlide(next);
        }, 4000);
    }

    // ==========================================
    // BOUTONS DE NAVIGATION
    // ==========================================

    if (prevBtn) {
        prevBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            if (products.length === 0) return;
            goToSlide(currentIndex - 1);
            startAutoScroll();
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            if (products.length === 0) return;
            goToSlide(currentIndex + 1);
            startAutoScroll();
        });
    }

    // ==========================================
    // DÉTAIL PRODUIT
    // ==========================================

    function updateDetail(index) {
        const product = products[index];
        if (!product || !detailBg) return;

        const imgSrc = product.image1 || 'https://via.placeholder.com/800x600';
        detailBg.style.backgroundImage = `url(${imgSrc})`;

        const nameEl = document.querySelector('.detail-name');
        const priceEl = document.querySelector('.detail-price');
        const descEl = document.querySelector('.detail-desc');
        const stockEl = document.querySelector('.detail-stock');

        if (nameEl) nameEl.textContent = product.name;
        if (priceEl) priceEl.textContent = product.price.toLocaleString() + ' FCFA';
        if (descEl) descEl.textContent = product.description || 'Aucune description.';
        if (stockEl) stockEl.textContent = '📦 Quantité : ' + (product.quantity || 0);

        if (detailAddBtn) {
            detailAddBtn.dataset.productId = product.id;
            detailAddBtn.dataset.productName = product.name;
            detailAddBtn.dataset.productPrice = product.price;
            detailAddBtn.classList.remove('added');
            detailAddBtn.innerHTML = '<i class="fas fa-plus-circle"></i> Ajouter au panier';
        }
    }

    // ==========================================
    // AJOUTER AU PANIER
    // ==========================================

    if (detailAddBtn) {
        detailAddBtn.addEventListener('click', async function() {
            const productId = this.dataset.productId;

            if (!productId) {
                alert('❌ Erreur: produit non identifié');
                return;
            }

            try {
                const res = await fetch('/api/panier/add', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ productId, quantity: 1 })
                });

                const data = await res.json();

                if (data.success) {
                    this.classList.add('added');
                    this.innerHTML = '<i class="fas fa-check"></i> Ajouté !';
                    await loadBadges();
                    setTimeout(() => {
                        this.classList.remove('added');
                        this.innerHTML = '<i class="fas fa-plus-circle"></i> Ajouter au panier';
                    }, 1500);
                } else {
                    alert('❌ ' + (data.error || 'Erreur lors de l\'ajout'));
                }
            } catch (error) {
                console.error('Erreur ajout panier:', error);
                alert('❌ Erreur de connexion au serveur.');
            }
        });
    }

    // ==========================================
    // INITIALISATION
    // ==========================================

    (async function init() {
        try {
            console.log('🚀 Initialisation du dashboard...');
            const isAuth = await checkAuth();
            if (!isAuth) return;

            await loadProducts();
            await loadBadges();

            // Rafraîchir les badges toutes les 30 secondes
            setInterval(() => {
                loadBadges();
            }, 30000);

            console.log('✅ Initialisation terminée');
        } catch (error) {
            console.error('❌ Erreur lors de l\'initialisation:', error);
        }
    })();

});