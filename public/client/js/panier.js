document.addEventListener('DOMContentLoaded', function() {

    console.log('✅ panier.js chargé');

    // ==========================================
    // RÉFÉRENCES
    // ==========================================

    const container = document.getElementById('cartContainer');
    const cartCount = document.getElementById('cartCount');
    const totalPrice = document.getElementById('totalPrice');

    // Overlays
    const overlay = document.getElementById('confirmOverlay');
    const confirmTitle = document.getElementById('confirmTitle');
    const confirmMessage = document.getElementById('confirmMessage');
    const confirmOk = document.getElementById('confirmOk');
    const confirmCancel = document.getElementById('confirmCancel');

    const commandeOverlay = document.getElementById('commandeOverlay');
    const commandeMessage = document.getElementById('commandeMessage');
    const commandeOk = document.getElementById('commandeOk');
    const commandeCancel = document.getElementById('commandeCancel');

    const clearBtn = document.getElementById('clearCartBtn');
    const checkoutBtn = document.getElementById('checkoutBtn');

    let panier = [];
    let total = 0;
    let pendingAction = null;
    let pendingIndex = null;

    // ==========================================
    // VÉRIFICATION CONNEXION (via session)
    // ==========================================

    async function checkAuth() {
        try {
            const res = await fetch('/api/client/me');
            const data = await res.json();
            if (data.success) {
                console.log('👤 Utilisateur connecté:', data.user);
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
    // OVERLAYS
    // ==========================================

    function openConfirm(title, message, action, index = null) {
        confirmTitle.textContent = title;
        confirmMessage.textContent = message;
        pendingAction = action;
        pendingIndex = index;
        overlay.classList.add('active');
    }

    function closeConfirm() {
        overlay.classList.remove('active');
        pendingAction = null;
        pendingIndex = null;
    }

    confirmCancel.addEventListener('click', closeConfirm);

    confirmOk.addEventListener('click', function() {
        if (pendingAction === 'remove' && pendingIndex !== null) {
            executeRemove(pendingIndex);
        } else if (pendingAction === 'clear') {
            executeClear();
        }
        closeConfirm();
    });

    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) closeConfirm();
    });

    function openCommande() {
        const totalItems = panier.reduce((sum, item) => sum + item.quantity, 0);
        commandeMessage.textContent = `Voulez-vous confirmer cette commande de ${totalItems} article(s) pour un total de ${total.toLocaleString()} FCFA ?`;
        commandeOverlay.classList.add('active');
    }

    function closeCommande() {
        commandeOverlay.classList.remove('active');
    }

    commandeCancel.addEventListener('click', closeCommande);

    commandeOk.addEventListener('click', function() {
        closeCommande();
        window.location.href = '/passcommande';
    });

    commandeOverlay.addEventListener('click', function(e) {
        if (e.target === commandeOverlay) closeCommande();
    });

    // ==========================================
    // CHARGER LE PANIER
    // ==========================================

    async function loadPanier() {
        try {
            const res = await fetch('/api/panier');
            const data = await res.json();

            if (data.success && data.panier.length > 0) {
                panier = data.panier;
                renderPanier();
            } else {
                renderEmpty();
            }
        } catch (error) {
            console.error('Erreur chargement panier:', error);
            renderEmpty();
        }
    }

    function renderEmpty() {
        container.innerHTML = `
            <div class="cart-empty">
                <i class="fas fa-shopping-cart"></i>
                <h3>Votre panier est vide</h3>
                <p>Découvrez nos produits et commencez vos achats !</p>
                <a href="/dashboard" class="btn-shop">🛍️ Voir les produits</a>
            </div>
        `;
        cartCount.textContent = '(0)';
        totalPrice.textContent = '0 FCFA';
        checkoutBtn.disabled = true;
        clearBtn.disabled = true;
        clearBtn.style.opacity = '0.5';
    }

    function goToProduct(productId) {
        window.location.href = '/infoproduit?id=' + productId;
    }

    function renderPanier() {
        if (panier.length === 0) {
            renderEmpty();
            return;
        }

        total = panier.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const totalItems = panier.reduce((sum, item) => sum + item.quantity, 0);

        let html = '';

        panier.forEach((item, index) => {
            const imgSrc = item.image1 || 'https://via.placeholder.com/50';
            html += `
                <div class="cart-item" data-index="${index}" data-id="${item.product_id || item.id}">
                    <div class="item-header">
                        <img src="${imgSrc}" alt="${item.name}" class="item-img" loading="lazy">
                        <span class="item-name">${item.name}</span>
                    </div>
                    <div class="item-main">
                        <div class="item-price">${item.price.toLocaleString()} FCFA</div>
                        <div class="item-desc">${item.description || ''}</div>
                    </div>
                    <div class="item-footer">
                        <div class="item-qty">
                            <button class="qty-minus" data-index="${index}">−</button>
                            <span>${item.quantity}</span>
                            <button class="qty-plus" data-index="${index}">+</button>
                        </div>
                        <button class="item-remove" data-index="${index}">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
        cartCount.textContent = `(${totalItems})`;
        totalPrice.textContent = total.toLocaleString() + ' FCFA';
        checkoutBtn.disabled = false;
        clearBtn.disabled = false;
        clearBtn.style.opacity = '1';

        // Clic sur l'article → infoproduit
        document.querySelectorAll('.cart-item').forEach(item => {
            item.addEventListener('click', function(e) {
                if (e.target.closest('.item-qty') || e.target.closest('.item-remove')) {
                    return;
                }
                const id = this.dataset.id;
                if (id) goToProduct(id);
            });
        });

        // Quantité
        document.querySelectorAll('.qty-plus').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const index = parseInt(this.dataset.index);
                updateQuantity(index, 1);
            });
        });

        document.querySelectorAll('.qty-minus').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const index = parseInt(this.dataset.index);
                updateQuantity(index, -1);
            });
        });

        document.querySelectorAll('.item-remove').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const index = parseInt(this.dataset.index);
                const item = panier[index];
                openConfirm(
                    '⚠️ Retirer du panier',
                    `Voulez-vous retirer "${item.name}" du panier ?`,
                    'remove',
                    index
                );
            });
        });

        checkoutBtn.onclick = function() {
            if (panier.length === 0) return;
            openCommande();
        };

        clearBtn.onclick = function() {
            if (panier.length === 0) return;
            openConfirm(
                '🗑️ Vider le panier',
                'Êtes-vous sûr de vouloir vider tout votre panier ? Cette action est définitive.',
                'clear'
            );
        };
    }

    // ==========================================
    // ACTIONS
    // ==========================================

    async function updateQuantity(index, delta) {
        const item = panier[index];
        const newQty = item.quantity + delta;

        if (newQty <= 0) {
            openConfirm(
                '⚠️ Retirer du panier',
                `Voulez-vous retirer "${item.name}" du panier ?`,
                'remove',
                index
            );
            return;
        }

        try {
            const res = await fetch('/api/panier/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    productId: item.product_id || item.id,
                    quantity: newQty
                })
            });

            const data = await res.json();
            if (data.success) {
                item.quantity = newQty;
                renderPanier();
                updateBadge();
            } else {
                alert('❌ ' + (data.error || 'Erreur mise à jour'));
            }
        } catch (error) {
            console.error('Erreur mise à jour:', error);
            alert('❌ Erreur de connexion');
        }
    }

    async function executeRemove(index) {
        const item = panier[index];
        try {
            const res = await fetch('/api/panier/remove', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    productId: item.product_id || item.id
                })
            });

            const data = await res.json();
            if (data.success) {
                panier.splice(index, 1);
                if (panier.length === 0) renderEmpty();
                else renderPanier();
                updateBadge();
            } else {
                alert('❌ ' + (data.error || 'Erreur'));
            }
        } catch (error) {
            console.error('Erreur suppression:', error);
            alert('❌ Erreur de connexion');
        }
    }

    async function executeClear() {
        try {
            const res = await fetch('/api/panier/clear', {
                method: 'DELETE'
            });

            const data = await res.json();
            if (data.success) {
                panier = [];
                renderEmpty();
                updateBadge();
            } else {
                alert('❌ ' + (data.error || 'Erreur'));
            }
        } catch (error) {
            console.error('Erreur vidage:', error);
            alert('❌ Erreur de connexion');
        }
    }

    async function updateBadge() {
        try {
            const res = await fetch('/api/panier/count');
            const data = await res.json();
            if (data.success) {
                const badge = document.querySelector('.cart-badge');
                if (badge) badge.textContent = data.count || 0;
            }
        } catch (error) {
            console.error('Erreur badge:', error);
        }
    }

    // ==========================================
    // INITIALISATION
    // ==========================================

    (async function init() {
        try {
            console.log('🚀 Initialisation du panier...');
            const isAuth = await checkAuth();
            if (!isAuth) return;

            await loadPanier();
            await updateBadge();
            console.log('✅ Initialisation terminée');
        } catch (error) {
            console.error('❌ Erreur lors de l\'initialisation:', error);
        }
    })();

});