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
    const detailBgA = document.getElementById('detailBgA');
    const detailBgB = document.getElementById('detailBgB');
    const navCurrent = document.getElementById('navCurrent');
    const navTotal = document.getElementById('navTotal');
    const detailAddBtn = document.getElementById('detailAddBtn');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const guestMessage = document.getElementById('guestMessage');
    const guestDismiss = document.getElementById('guestDismiss');
    const pageTransition = document.getElementById('pageTransition');
    const carouselContainer = document.querySelector('.carousel-container');

    let products = [];
    let currentIndex = 0;
    let autoScrollInterval;
    let currentUser = null;
    let isAuthenticated = false;
    let activeDetailLayer = 'a'; // pour le crossfade des fonds

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ==========================================
    // NAVIGATION FLUIDE ENTRE LES PAGES
    // ==========================================

    function navigateTo(url) {
        if (!url) return;
        if (prefersReducedMotion || !pageTransition) {
            window.location.href = url;
            return;
        }
        pageTransition.classList.add('active');
        window.setTimeout(() => {
            window.location.href = url;
        }, 260);
    }

    // Tout élément marqué data-nav navigue via la transition douce
    document.querySelectorAll('[data-nav]').forEach((el) => {
        el.addEventListener('click', function(e) {
            const url = this.dataset.navUrl || this.getAttribute('href');
            if (!url) return;
            e.preventDefault();
            navigateTo(url);
        });
    });

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
            if (guestMessage && !guestMessage.dataset.dismissed) {
                guestMessage.style.display = 'flex';
            }
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

    if (guestDismiss) {
        guestDismiss.addEventListener('click', function() {
            guestMessage.style.display = 'none';
            guestMessage.dataset.dismissed = 'true';
        });
    }

    // ==========================================
    // NAVIGATION (header)
    // ==========================================
    // Le bouton de recherche est géré via [data-nav] plus haut.

    if (cartBtn) {
        cartBtn.addEventListener('click', function() {
            navigateTo('/panier');
        });
    }

    if (mesCommandesBtn) {
        mesCommandesBtn.addEventListener('click', function() {
            if (!isAuthenticated) {
                navigateTo('/login');
                return;
            }
            navigateTo('/mescommandes');
        });
    }

    if (notifBtn) {
        notifBtn.addEventListener('click', function() {
            if (!isAuthenticated) {
                navigateTo('/login');
                return;
            }
            navigateTo('/notification');
        });
    }

    if (profilBtn) {
        profilBtn.addEventListener('click', function() {
            if (!isAuthenticated) {
                navigateTo('/login');
                return;
            }
            navigateTo('/profil');
        });
    }

    // ==========================================
    // BADGES
    // ==========================================

    function setBadge(el, count) {
        if (!el) return;
        el.textContent = count;
        el.style.display = count > 0 ? 'flex' : 'none';
    }

    async function loadBadges() {
        if (!isAuthenticated) {
            setBadge(commandeBadge, 0);
            setBadge(notifBadge, 0);
            try {
                const res = await fetch('/api/panier/count');
                const data = await res.json();
                if (res.ok && data.success) {
                    setBadge(cartBadge, data.count || 0);
                }
            } catch (e) { /* ignore */ }
            return;
        }

        try {
            const res1 = await fetch('/api/commandes');
            const data1 = await res1.json();
            if (res1.ok) setBadge(commandeBadge, data1.length || 0);

            const res2 = await fetch('/api/notifications/count');
            const data2 = await res2.json();
            if (res2.ok) setBadge(notifBadge, data2.count || 0);

            const res3 = await fetch('/api/panier/count');
            const data3 = await res3.json();
            if (res3.ok) setBadge(cartBadge, data3.count || 0);
        } catch (error) {
            console.error('❌ Erreur badges:', error);
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
                updateDetail(0, true);
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
                    track.innerHTML = '<p style="color:#5b6b5f;text-align:center;padding:30px;width:100%;">Aucun produit disponible.</p>';
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
                track.innerHTML = '<p style="color:#e2574f;text-align:center;padding:30px;width:100%;">Erreur de chargement.</p>';
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
                <img src="${imgSrc}" alt="${p.name}" loading="lazy" data-product-id="${p.id}">
                <div class="product-footer">
                    <span class="product-name">${p.name}</span>
                </div>
            `;
            track.appendChild(item);
        });

        // Clic sur l'image → change l'image (si plusieurs)
        document.querySelectorAll('.carousel-item img').forEach(img => {
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
                        setDetailBackground(images[nextIndex]);
                    }
                }
            });
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
            prevBtn.style.display = 'none';
            nextBtn.style.display = 'none';
        } else {
            prevBtn.style.display = 'flex';
            nextBtn.style.display = 'flex';
        }
    }

    function startAutoScroll() {
        if (autoScrollInterval) clearInterval(autoScrollInterval);
        if (prefersReducedMotion) return; // pas de défilement auto si l'utilisateur préfère moins de mouvement
        autoScrollInterval = setInterval(() => {
            const total = products.length;
            if (total === 0) return;
            goToSlide((currentIndex + 1) % total);
        }, 4000);
    }

    function resetAutoScroll() {
        startAutoScroll();
    }

    // Pause du défilement auto quand l'utilisateur interagit avec le carrousel
    if (carouselContainer) {
        carouselContainer.addEventListener('mouseenter', () => clearInterval(autoScrollInterval));
        carouselContainer.addEventListener('mouseleave', () => startAutoScroll());
        carouselContainer.addEventListener('focusin', () => clearInterval(autoScrollInterval));
        carouselContainer.addEventListener('focusout', () => startAutoScroll());
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
    // DÉTAIL PRODUIT
    // ==========================================

    // Fondu enchaîné entre deux calques : background-image n'étant pas animable,
    // on prépare le calque caché puis on bascule l'opacité (qui, elle, l'est).
    function setDetailBackground(imgSrc) {
        const showingA = activeDetailLayer === 'a';
        const incoming = showingA ? detailBgB : detailBgA;
        const outgoing = showingA ? detailBgA : detailBgB;
        if (!incoming || !outgoing) return;

        incoming.style.backgroundImage = `url(${imgSrc})`;
        incoming.classList.add('is-visible');
        incoming.classList.remove('is-hidden');
        outgoing.classList.add('is-hidden');
        outgoing.classList.remove('is-visible');

        activeDetailLayer = showingA ? 'b' : 'a';
    }

    function updateDetail(index, immediate) {
        const product = products[index];
        if (!product) return;

        const imgSrc = product.image1 || 'https://via.placeholder.com/800x600';

        if (immediate && detailBgA) {
            detailBgA.style.backgroundImage = `url(${imgSrc})`;
            detailBgA.classList.add('is-visible');
        } else {
            setDetailBackground(imgSrc);
        }

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
    // AJOUTER AU PANIER
    // ==========================================

    if (detailAddBtn) {
        detailAddBtn.addEventListener('click', async function() {
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
                    navigateTo('/login');
                } else {
                    alert('❌ ' + (data.error || 'Erreur'));
                }
            } catch (error) {
                console.error('Erreur:', error);
                alert('❌ Erreur de connexion');
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

            setInterval(() => loadBadges(), 30000);

            console.log('✅ Initialisation terminée');
        } catch (error) {
            console.error('❌ Erreur init:', error);
        }
    })();

});