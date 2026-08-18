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
    const skeleton = document.getElementById('carouselSkeleton');
    const detailBg = document.getElementById('detailBg');
    const navCurrent = document.getElementById('navCurrent');
    const navTotal = document.getElementById('navTotal');
    const detailAddBtn = document.getElementById('detailAddBtn');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const guestMessage = document.getElementById('guestMessage');
    const accountBtn = document.getElementById('accountBtn');
    const logoutBtn = document.getElementById('logoutBtn');

    let products = [];
    let currentIndex = 0;
    let autoScrollInterval;
    let currentUser = null;
    let isAuthenticated = false;

    // ==========================================
    // URL DE L'API PAIEMENT (Render)
    // ==========================================

    const PAYMENT_API_URL = 'https://nature-plus-pay.onrender.com';

    // ==========================================
    // VÉRIFICATION CONNEXION (session + fallback localStorage)
    // ==========================================

    async function checkAuth() {
        try {
            const res = await fetch('/api/client/me');
            const data = await res.json();
            if (data.success) {
                currentUser = data.user;
                localStorage.setItem('userId', data.user.id);
                localStorage.setItem('userName', data.user.name);
                localStorage.setItem('userEmail', data.user.email);
                localStorage.setItem('userPhone', data.user.phone);
                isAuthenticated = true;
                console.log('👤 Utilisateur connecté (session):', currentUser);
                updateUIForAuth(true);
                return true;
            }
        } catch (error) {
            console.error('❌ Erreur session:', error);
        }

        const userId = localStorage.getItem('userId');
        const userName = localStorage.getItem('userName');
        const userEmail = localStorage.getItem('userEmail');
        const userPhone = localStorage.getItem('userPhone');

        if (userId && userName) {
            console.log('👤 Fallback: Utilisateur depuis localStorage');
            currentUser = {
                id: parseInt(userId),
                name: userName,
                email: userEmail,
                phone: userPhone
            };
            isAuthenticated = true;
            updateUIForAuth(true);
            return true;
        }

        console.warn('❌ Non authentifié - Mode invité');
        isAuthenticated = false;
        updateUIForAuth(false);
        return false;
    }

    // ==========================================
    // MISE À JOUR DE L'INTERFACE SELON AUTH
    // ==========================================

    function updateUIForAuth(authenticated) {
        if (authenticated) {
            if (guestMessage) guestMessage.style.display = 'none';
            if (accountBtn) {
                accountBtn.innerHTML = '<i class="fas fa-user-circle"></i> Mon compte';
                accountBtn.onclick = function() { window.location.href = '/profil'; };
            }
            if (logoutBtn) logoutBtn.style.display = 'flex';
            if (mesCommandesBtn) {
                mesCommandesBtn.disabled = false;
                mesCommandesBtn.style.opacity = '1';
                mesCommandesBtn.title = 'Mes commandes';
            }
            if (notifBtn) {
                notifBtn.disabled = false;
                notifBtn.style.opacity = '1';
                notifBtn.title = 'Notifications';
            }
        } else {
            if (guestMessage) guestMessage.style.display = 'flex';
            if (accountBtn) {
                accountBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Me connecter';
                accountBtn.onclick = function() { window.location.href = '/login'; };
            }
            if (logoutBtn) logoutBtn.style.display = 'none';
            if (mesCommandesBtn) {
                mesCommandesBtn.disabled = true;
                mesCommandesBtn.style.opacity = '0.5';
                mesCommandesBtn.title = 'Connectez-vous pour voir vos commandes';
            }
            if (notifBtn) {
                notifBtn.disabled = true;
                notifBtn.style.opacity = '0.5';
                notifBtn.title = 'Connectez-vous pour voir vos notifications';
            }
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
            if (!isAuthenticated) {
                window.location.href = '/login';
                return;
            }
            window.location.href = '/mescommandes';
        });
    }

    // ==========================================
    // NOTIFICATIONS → /notification
    // ==========================================

    if (notifBtn) {
        notifBtn.addEventListener('click', function() {
            if (!isAuthenticated) {
                window.location.href = '/login';
                return;
            }
            window.location.href = '/notification';
        });
    }

    // ==========================================
    // CHARGER LES BADGES
    // ==========================================

    async function loadBadges() {
        if (!isAuthenticated) {
            if (commandeBadge) commandeBadge.style.display = 'none';
            if (notifBadge) notifBadge.style.display = 'none';
            try {
                const res = await fetch('/api/panier/count');
                const data = await res.json();
                if (res.ok && data.success) {
                    const count = data.count || 0;
                    cartBadge.textContent = count;
                    cartBadge.style.display = count > 0 ? 'flex' : 'none';
                }
            } catch (e) {
                console.warn('Erreur badge panier:', e);
            }
            return;
        }

        try {
            const res1 = await fetch('/api/commandes');
            const data1 = await res1.json();
            if (res1.ok && commandeBadge) {
                const count = data1.length || 0;
                commandeBadge.textContent = count;
                commandeBadge.style.display = count > 0 ? 'flex' : 'none';
                console.log('📋 Commandes:', count);
            }

            const res2 = await fetch('/api/notifications/count');
            const data2 = await res2.json();
            if (res2.ok && notifBadge) {
                const count = data2.count || 0;
                notifBadge.textContent = count;
                notifBadge.style.display = count > 0 ? 'flex' : 'none';
                console.log('🔔 Notifications:', count);
            }

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
    // CHARGER LES PRODUITS AVEC SKELETON
    // ==========================================

    async function loadProducts() {
        // Afficher le skeleton
        if (skeleton) skeleton.style.display = 'flex';
        if (track) track.style.display = 'none';

        try {
            const res = await fetch('/api/products');
            const data = await res.json();

            if (res.ok && data.length > 0 && track) {
                products = data;
                // Cacher le skeleton
                if (skeleton) skeleton.style.display = 'none';
                if (track) track.style.display = 'flex';
                renderCarousel();
                updateDetail(0);
                goToSlide(0);
                if (navTotal) navTotal.textContent = products.length;
                startAutoScroll();
            } else if (track) {
                if (skeleton) skeleton.style.display = 'none';
                track.style.display = 'flex';
                track.innerHTML = '<p style="color:#888;text-align:center;padding:40px;">Aucun produit disponible.</p>';
            }
        } catch (error) {
            console.error('Erreur chargement produits:', error);
            if (skeleton) skeleton.style.display = 'none';
            if (track) {
                track.style.display = 'flex';
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
        updateNavButtons();
    }

    function goToSlide(index) {
        if (!track || products.length === 0) return;
        const total = products.length;
        if (index < 0) index = total - 1;
        if (index >= total) index = 0;
        currentIndex = index;
        track.style.transform = `translateX(-${currentIndex * 100}%)`;
        if (navCurrent) navCurrent.textContent = currentIndex + 1;
        updateNavButtons();
        updateDetail(currentIndex);
    }

    function updateNavButtons() {
        const total = products.length;
        if (total <= 1) {
            prevBtn.classList.add('hidden');
            nextBtn.classList.add('hidden');
        } else {
            prevBtn.classList.remove('hidden');
            nextBtn.classList.remove('hidden');
        }
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
            resetAutoScroll();
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            if (products.length === 0) return;
            goToSlide(currentIndex + 1);
            resetAutoScroll();
        });
    }

    function resetAutoScroll() {
        startAutoScroll();
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
                } else if (data.error === 'Non authentifié') {
                    window.location.href = '/login';
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
            await checkAuth();
            await loadProducts();
            await loadBadges();

            setInterval(() => {
                loadBadges();
            }, 30000);

            console.log('✅ Initialisation terminée');
        } catch (error) {
            console.error('❌ Erreur lors de l\'initialisation:', error);
        }
    })();

});