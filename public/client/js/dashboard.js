document.addEventListener('DOMContentLoaded', function() {

    console.log('✅ Dashboard ComPlus chargé');

    // ==========================================
    // DONNÉES PRODUITS
    // ==========================================

    const products = [
        {
            id: 1,
            name: 'Jus de gingembre bio',
            description: 'Pur jus de gingembre frais, sans sucre ajouté. Idéal pour la digestion.',
            price: 1500,
            stock: 25,
            image: 'https://picsum.photos/seed/gingembre/600/400'
        },
        {
            id: 2,
            name: 'Miel de forêt 500g',
            description: 'Miel pur récolté en forêt, riche en nutriments et antioxydants.',
            price: 3500,
            stock: 12,
            image: 'https://picsum.photos/seed/miel/600/400'
        },
        {
            id: 3,
            name: 'Tisane detox 20 sachets',
            description: 'Mélange de plantes bio pour une detox naturelle et équilibrée.',
            price: 2200,
            stock: 8,
            image: 'https://picsum.photos/seed/tisane/600/400'
        },
        {
            id: 4,
            name: 'Huile de coco vierge 1L',
            description: 'Huile de coco bio pressée à froid, idéale pour la cuisine et les soins.',
            price: 4500,
            stock: 3,
            image: 'https://picsum.photos/seed/coco/600/400'
        }
    ];

    let currentIndex = 0;
    let autoScrollInterval = null;
    let isAuthenticated = false;

    // ==========================================
    // RÉFÉRENCES
    // ==========================================

    const productName = document.getElementById('productName');
    const productPrice = document.getElementById('productPrice');
    const productStock = document.getElementById('productStock');
    const productImage = document.getElementById('productImage');
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

    // ==========================================
    // AUTH
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
            console.log('ℹ️ Mode démo - utilisateur non connecté');
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
    // AFFICHAGE CARTE DYNAMIQUE
    // ==========================================

    function renderDynamicCard() {
        if (isAuthenticated) {
            // ✅ Carte ComPlus
            dynamicCard.innerHTML = `
                <div class="complus-card">
                    <div class="complus-content">
                        <div class="complus-icon">🛒</div>
                        <h2>ComPlus</h2>
                        <p>Local et rapide, 100% fait en Côte d'Ivoire</p>
                        <p class="complus-sub">Commencer à rechercher et commander vos préférences.</p>
                        <button class="complus-btn" id="complusSearchBtn">
                            <i class="fas fa-search"></i> Rechercher
                        </button>
                    </div>
                </div>
            `;

            // ✅ Événement bouton ComPlus
            const complusBtn = document.getElementById('complusSearchBtn');
            if (complusBtn) {
                complusBtn.addEventListener('click', function() {
                    window.location.href = '/searchproduct';
                });
            }

        } else {
            // ✅ Carte Connexion
            dynamicCard.innerHTML = `
                <div class="connect-card">
                    <div class="connect-content">
                        <div class="connect-icon">🔐</div>
                        <h2>Connectez-vous</h2>
                        <p>Connectez-vous pour passer commande et profiter de toutes nos fonctionnalités.</p>
                        <button class="connect-btn" id="connectBtn">
                            <i class="fas fa-sign-in-alt"></i> Se connecter
                        </button>
                    </div>
                </div>
            `;

            // ✅ Événement bouton Connexion
            const connectBtn = document.getElementById('connectBtn');
            if (connectBtn) {
                connectBtn.addEventListener('click', function() {
                    window.location.href = '/login';
                });
            }
        }
    }

    // ==========================================
    // AUTO-SCROLL PERMANENT (8s)
    // ==========================================

    function startAutoScroll() {
        if (autoScrollInterval) clearInterval(autoScrollInterval);
        autoScrollInterval = setInterval(() => {
            if (currentIndex < products.length - 1) {
                currentIndex++;
            } else {
                currentIndex = 0;
            }
            updateCarousel(currentIndex);
        }, 8000);
    }

    // ==========================================
    // FONCTIONS CARROUSEL
    // ==========================================

    function updateCarousel(index) {
        const product = products[index];
        if (!product) return;

        productName.textContent = product.name;
        productPrice.textContent = product.price.toLocaleString() + ' FCFA';
        productStock.textContent = product.stock > 0 ? `📦 ${product.stock} en stock` : '🚫 Rupture de stock';
        productStock.style.color = product.stock > 0 ? '#4ade80' : '#f87171';
        productImage.src = product.image;

        const bgImage = `url(${product.image})`;
        dashboardHeader.style.backgroundImage = bgImage;
        carouselHeader.style.backgroundImage = bgImage;
        carouselFooter.style.backgroundImage = bgImage;

        currentIndexEl.textContent = index + 1;
        totalProductsEl.textContent = products.length;

        prevBtn.disabled = index === 0;
        nextBtn.disabled = index === products.length - 1;
        prevBtn.style.opacity = index === 0 ? '0.3' : '1';
        nextBtn.style.opacity = index === products.length - 1 ? '0.3' : '1';

        productImage.classList.remove('zoomed');

        console.log(`🔄 Produit affiché : ${product.name}`);
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

    function addToCart() {
        const product = products[currentIndex];
        if (!product) return;
        alert(`🛒 Ajouté au panier : ${product.name} - ${product.price.toLocaleString()} FCFA`);
        addToCartBtn.innerHTML = '<i class="fas fa-check"></i> Ajouté !';
        setTimeout(() => {
            addToCartBtn.innerHTML = '<i class="fas fa-plus-circle"></i> Ajouter';
        }, 1500);
    }

    function viewDetail() {
        const product = products[currentIndex];
        if (!product) return;
        alert(`👁️ Détail du produit : ${product.name}\n💰 ${product.price.toLocaleString()} FCFA`);
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
    // HEADER
    // ==========================================

    const searchInput = document.getElementById('searchInput');
    const cartBtn = document.getElementById('cartBtn');
    const mesCommandesBtn = document.getElementById('mesCommandesBtn');
    const notifBtn = document.getElementById('notifBtn');
    const profilBtn = document.getElementById('profilBtn');

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
    // INIT
    // ==========================================

    (async function init() {
        await checkAuth();
        renderDynamicCard();
        updateCarousel(0);
        startAutoScroll();
        console.log('✅ Dashboard ComPlus prêt - Mode production');
    })();

});