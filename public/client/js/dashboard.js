document.addEventListener('DOMContentLoaded', function() {

    console.log('✅ dashboard.js chargé');

    // ==========================================
    // RÉFÉRENCES
    // ==========================================

    const searchInput = document.getElementById('searchInput');
    const cartBtn = document.getElementById('cartBtn');
    const mesCommandesBtn = document.getElementById('mesCommandesBtn');
    const notifBtn = document.getElementById('notifBtn');
    const profilBtn = document.getElementById('profilBtn');
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

    let products = [];
    let currentIndex = 0;
    let autoScrollInterval;
    let currentUser = null;
    let isAuthenticated = false;

    // ✅ SYNC EN ARRIÈRE-PLAN (toutes les 10s)
    let syncInterval = null;
    let isSyncing = false;

    // ==========================================
    // SYNC EN PERMANENCE (toutes les 10s)
    // ==========================================

    function startSync() {
        if (syncInterval) {
            clearInterval(syncInterval);
        }

        console.log('🔄 Sync dashboard démarré (toutes les 10s)');

        syncInterval = setInterval(() => {
            if (!isSyncing) {
                loadBadges();
            }
        }, 10000);
    }

    function stopSync() {
        if (syncInterval) {
            clearInterval(syncInterval);
            syncInterval = null;
            console.log('⏹️ Sync dashboard arrêté');
        }
    }

    // ==========================================
    // VÉRIFICATION CONNEXION
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
                console.log('👤 Utilisateur connecté:', currentUser);
                updateUIForAuth(true);
                return true;
            }
        } catch (error) {
            console.error('❌ Erreur session:', error);
        }

        const userId = localStorage.getItem('userId');
        const userName = localStorage.getItem('userName');

        if (userId && userName) {
            currentUser = {
                id: parseInt(userId),
                name: userName,
                email: localStorage.getItem('userEmail'),
                phone: localStorage.getItem('userPhone')
            };
            isAuthenticated = true;
            updateUIForAuth(true);
            return true;
        }

        isAuthenticated = false;
        updateUIForAuth(false);
        return false;
    }

    // ==========================================
    // INTERFACE SELON AUTH
    // ==========================================

    function updateUIForAuth(authenticated) {
        if (authenticated) {
            if (guestMessage) guestMessage.style.display = 'none';
            if (mesCommandesBtn) {
                mesCommandesBtn.disabled = false;
                mesCommandesBtn.style.opacity = '1';
            }
            if (notifBtn) {
                notifBtn.disabled = false;
                notifBtn.style.opacity = '1';
            }
        } else {
            if (guestMessage) guestMessage.style.display = 'flex';
            if (mesCommandesBtn) {
                mesCommandesBtn.disabled = true;
                mesCommandesBtn.style.opacity = '0.4';
                mesCommandesBtn.title = 'Connectez-vous';
            }
            if (notifBtn) {
                notifBtn.disabled = true;
                notifBtn.style.opacity = '0.4';
                notifBtn.title = 'Connectez-vous';
            }
        }
    }

    // ==========================================
    // NAVIGATION
    // ==========================================

    if (searchInput) {
        searchInput.addEventListener('click', function() {
            window.location.href = '/searchproduct';
        });
    }

    if (cartBtn) {
        cartBtn.addEventListener('click', function() {
            window.location.href = '/panier';
        });
    }

    if (mesCommandesBtn) {
        mesCommandesBtn.addEventListener('click', function() {
            if (!isAuthenticated) {
                window.location.href = '/login';
                return;
            }
            window.location.href = '/mescommandes';
        });
    }

    if (notifBtn) {
        notifBtn.addEventListener('click', function() {
            if (!isAuthenticated) {
                window.location.href = '/login';
                return;
            }
            window.location.href = '/notification';
        });
    }

    if (profilBtn) {
        profilBtn.addEventListener('click', function() {
            if (!isAuthenticated) {
                window.location.href = '/login';
                return;
            }
            window.location.href = '/profil';
        });
    }

    // ==========================================
    // BADGES (avec cache)
    // ==========================================

    let lastBadgeData = {
        commandes: null,
        notifs: null,
        cart: null
    };

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
                    lastBadgeData.cart = count;
                }
            } catch (e) { /* ignore */ }
            return;
        }

        isSyncing = true;

        try {
            // ✅ Commandes
            const res1 = await fetch('/api/commandes');
            const data1 = await res1.json();
            if (res1.ok && commandeBadge) {
                const count = data1.length || 0;
                if (lastBadgeData.commandes !== count) {
                    commandeBadge.textContent = count;
                    commandeBadge.style.display = count > 0 ? 'flex' : 'none';
                    lastBadgeData.commandes = count;
                }
            }

            // ✅ Notifications
            const res2 = await fetch('/api/notifications/count');
            const data2 = await res2.json();
            if (res2.ok && notifBadge) {
                const count = data2.count || 0;
                if (lastBadgeData.notifs !== count) {
                    notifBadge.textContent = count;
                    notifBadge.style.display = count > 0 ? 'flex' : 'none';
                    lastBadgeData.notifs = count;
                }
            }

            // ✅ Panier
            const res3 = await fetch('/api/panier/count');
            const data3 = await res3.json();
            if (res3.ok && cartBadge) {
                const count = data3.count || 0;
                if (lastBadgeData.cart !== count) {
                    cartBadge.textContent = count;
                    cartBadge.style.display = count > 0 ? 'flex' : 'none';
                    lastBadgeData.cart = count;
                }
            }
        } catch (error) {
            console.error('❌ Erreur badges:', error);
        } finally {
            isSyncing = false;
        }
    }

    // ==========================================
    // SOCKET.IO
    // ==========================================

    let socket = null;
    let isSocketConnected = false;

    function connectSocketIO() {
        if (socket) {
            socket.disconnect();
            socket = null;
        }

        console.log('🔌 Connexion Socket.IO client (dashboard)...');

        try {
            const userIdLocal = localStorage.getItem('userId') || '1';

            socket = io({
                auth: {
                    userId: parseInt(userIdLocal),
                    isAdmin: false
                }
            });

            socket.on('connect', function() {
                console.log('✅ Socket.IO client dashboard connecté');
                isSocketConnected = true;
            });

            socket.on('disconnect', function() {
                console.log('❌ Socket.IO client dashboard déconnecté');
                isSocketConnected = false;
                setTimeout(() => {
                    if (!isSocketConnected) {
                        connectSocketIO();
                    }
                }, 3000);
            });

            socket.on('nouvelle-commande', function(data) {
                console.log('🆕 Nouvelle commande (dashboard):', data);
                loadBadges();
            });

            socket.on('commande-update', function(data) {
                console.log('📦 Mise à jour commande (dashboard):', data);
                loadBadges();
            });

            socket.on('notification', function(data) {
                console.log('🔔 Notification (dashboard):', data);
                loadBadges();
            });

        } catch (error) {
            console.error('❌ Erreur connexion Socket.IO:', error);
            setTimeout(() => connectSocketIO(), 5000);
        }
    }

    // ==========================================
    // PRODUITS
    // ==========================================

    async function loadProducts() {
        if (skeleton) skeleton.style.display = 'flex';
        if (track) track.style.display = 'none';

        try {
            const res = await fetch('/api/products');
            const data = await res.json();

            if (res.ok && data.length > 0) {
                products = data;
                if (skeleton) {
                    skeleton.style.display = 'none';
                    skeleton.style.visibility = 'hidden';
                }
                if (track) {
                    track.style.display = 'flex';
                    track.style.visibility = 'visible';
                }
                renderCarousel();
                updateDetail(0);
                goToSlide(0);
                if (navTotal) navTotal.textContent = products.length;
                startAutoScroll();
            } else {
                if (skeleton) {
                    skeleton.style.display = 'none';
                    skeleton.style.visibility = 'hidden';
                }
                if (track) {
                    track.style.display = 'flex';
                    track.style.visibility = 'visible';
                    track.innerHTML = '<p style="color:#888;text-align:center;padding:30px;">Aucun produit disponible.</p>';
                }
            }
        } catch (error) {
            console.error('Erreur produits:', error);
            if (skeleton) {
                skeleton.style.display = 'none';
                skeleton.style.visibility = 'hidden';
            }
            if (track) {
                track.style.display = 'flex';
                track.style.visibility = 'visible';
                track.innerHTML = '<p style="color:#e74c3c;text-align:center;padding:30px;">Erreur de chargement.</p>';
            }
        }
    }

    // ==========================================
    // CARROUSEL (redesign)
    // ==========================================

    function renderCarousel() {
        if (!track) return;
        track.innerHTML = '';

        products.forEach((p) => {
            const item = document.createElement('div');
            item.className = 'carousel-item';
            const imgSrc = p.image1 || 'https://via.placeholder.com/600x400';

            item.innerHTML = `
                <img src="${imgSrc}" alt="${p.name}" class="carousel-image" loading="lazy" data-product-id="${p.id}">
                <div class="carousel-info">
                    <div class="info-top">
                        <div class="product-name">${p.name}</div>
                        <div class="product-desc">${p.description || 'Aucune description'}</div>
                        <div class="product-price">${p.price.toLocaleString()} FCFA</div>
                    </div>
                    <div class="info-bottom">
                        <button class="btn-add" data-id="${p.id}">
                            <i class="fas fa-plus-circle"></i> Ajouter
                        </button>
                        <button class="btn-view" data-id="${p.id}">
                            <i class="fas fa-eye"></i> Voir
                        </button>
                    </div>
                </div>
            `;

            track.appendChild(item);
        });

        // ✅ Événements sur le carrousel
        document.querySelectorAll('.carousel-image').forEach(img => {
            img.addEventListener('click', function(e) {
                e.stopPropagation();
                const productId = parseInt(this.dataset.productId);
                const product = products.find(p => p.id === productId);
                if (product) {
                    const images = [product.image1, product.image2].filter(Boolean);
                    if (images.length > 1) {
                        const currentSrc = this.src;
                        const currentImg = images.find(img => img === currentSrc);
                        const index = images.indexOf(currentImg);
                        const nextIndex = (index + 1) % images.length;
                        this.src = images[nextIndex];
                        detailBg.style.backgroundImage = `url(${images[nextIndex]})`;
                    }
                }
            });
        });

        // ✅ Bouton Ajouter
        document.querySelectorAll('.btn-add').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const productId = this.dataset.id;
                addToCart(productId, this);
            });
        });

        // ✅ Bouton Voir
        document.querySelectorAll('.btn-view').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const productId = this.dataset.id;
                if (productId) {
                    window.location.href = `/infoproduit?id=${productId}`;
                }
            });
        });

        updateNavButtons();
    }

    // ==========================================
    // AJOUTER AU PANIER (depuis carrousel)
    // ==========================================

    async function addToCart(productId, button) {
        if (!isAuthenticated) {
            window.location.href = '/login';
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
                button.classList.add('added');
                button.innerHTML = '<i class="fas fa-check"></i> Ajouté !';
                await loadBadges();
                setTimeout(() => {
                    button.classList.remove('added');
                    button.innerHTML = '<i class="fas fa-plus-circle"></i> Ajouter';
                }, 1500);
            } else if (data.error === 'Non authentifié') {
                window.location.href = '/login';
            } else {
                // Silencieux pour éviter des alertes intempestives
                console.warn('Erreur ajout:', data.error);
            }
        } catch (error) {
            console.error('Erreur ajout panier:', error);
        }
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
            prevBtn.style.display = 'none';
            nextBtn.style.display = 'none';
        } else {
            prevBtn.style.display = 'flex';
            nextBtn.style.display = 'flex';
        }
    }

    function startAutoScroll() {
        if (autoScrollInterval) clearInterval(autoScrollInterval);
        autoScrollInterval = setInterval(() => {
            const total = products.length;
            if (total === 0) return;
            goToSlide((currentIndex + 1) % total);
        }, 4000);
    }

    function resetAutoScroll() {
        startAutoScroll();
    }

    // ==========================================
    // NAVIGATION CARROUSEL
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

    // ==========================================
    // DÉTAIL PRODUIT (footer)
    // ==========================================

    function updateDetail(index) {
        const product = products[index];
        if (!product || !detailBg) return;

        const imgSrc = product.image1 || 'https://via.placeholder.com/800x600';
        detailBg.style.backgroundImage = `url(${imgSrc})`;

        const nameEl = document.querySelector('.detail-name');
        const priceEl = document.querySelector('.detail-price');
        const descEl = document.querySelector('.detail-desc');

        if (nameEl) nameEl.textContent = product.name;
        if (priceEl) priceEl.textContent = product.price.toLocaleString() + ' FCFA';
        if (descEl) descEl.textContent = product.description || 'Aucune description.';

        if (detailAddBtn) {
            detailAddBtn.disabled = false;
            detailAddBtn.style.opacity = '1';
            detailAddBtn.dataset.productId = product.id;
            detailAddBtn.innerHTML = '<i class="fas fa-plus-circle"></i> Ajouter au panier';
        }
    }

    // ==========================================
    // AJOUTER AU PANIER (détail)
    // ==========================================

    if (detailAddBtn) {
        detailAddBtn.addEventListener('click', async function() {
            if (!isAuthenticated) {
                window.location.href = '/login';
                return;
            }

            const productId = this.dataset.productId;
            if (!productId) return;

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
                    // Silencieux
                    console.warn('Erreur ajout:', data.error);
                }
            } catch (error) {
                console.error('Erreur:', error);
            }
        });
    }

    // ==========================================
    // INIT
    // ==========================================

    (async function init() {
        try {
            console.log('🚀 Initialisation dashboard...');
            await checkAuth();
            await loadProducts();
            await loadBadges();

            // ✅ Démarrer la sync en arrière-plan
            startSync();

            // ✅ Connecter Socket.IO
            connectSocketIO();

            console.log('✅ Initialisation terminée');
        } catch (error) {
            console.error('❌ Erreur init:', error);
        }
    })();

});