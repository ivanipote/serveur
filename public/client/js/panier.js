document.addEventListener('DOMContentLoaded', function() {

    console.log('✅ panier.js chargé');

    // ==========================================
    // URL DE L'API PAIEMENT
    // ==========================================

    const PAYMENT_API_URL = 'https://nature-plus-pay.onrender.com';

    // ==========================================
    // RÉFÉRENCES
    // ==========================================

    const container = document.getElementById('cartContainer');
    const cartCount = document.getElementById('cartCount');
    const totalPrice = document.getElementById('totalPrice');
    const suggestionsSection = document.getElementById('suggestionsSection');
    const suggestionsGrid = document.getElementById('suggestionsGrid');
    const messageCard = document.getElementById('messageCard');

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
    let currentUser = null;
    let allProducts = [];

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
                console.log('👤 Utilisateur connecté (session):', currentUser);
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
            return true;
        }

        console.warn('❌ Non authentifié, redirection vers login');
        window.location.href = '/login';
        return false;
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

    if (confirmCancel) {
        confirmCancel.addEventListener('click', closeConfirm);
    }

    if (confirmOk) {
        confirmOk.addEventListener('click', function() {
            if (pendingAction === 'remove' && pendingIndex !== null) {
                executeRemove(pendingIndex);
            } else if (pendingAction === 'clear') {
                executeClear();
            }
            closeConfirm();
        });
    }

    if (overlay) {
        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) closeConfirm();
        });
    }

    function openCommande() {
        const totalItems = panier.reduce((sum, item) => sum + item.quantity, 0);
        commandeMessage.textContent = `Voulez-vous confirmer cette commande de ${totalItems} article(s) pour un total de ${total.toLocaleString()} FCFA ?`;
        commandeOverlay.classList.add('active');
    }

    function closeCommande() {
        commandeOverlay.classList.remove('active');
    }

    if (commandeCancel) {
        commandeCancel.addEventListener('click', closeCommande);
    }

    if (commandeOk) {
        commandeOk.addEventListener('click', function() {
            closeCommande();
            window.location.href = '/passcommande';
        });
    }

    if (commandeOverlay) {
        commandeOverlay.addEventListener('click', function(e) {
            if (e.target === commandeOverlay) closeCommande();
        });
    }

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
                loadSuggestions();
                messageCard.style.display = 'block';
            } else {
                renderEmpty();
                suggestionsSection.style.display = 'none';
                messageCard.style.display = 'none';
            }
        } catch (error) {
            console.error('Erreur chargement panier:', error);
            renderEmpty();
        }
    }

    // ==========================================
    // CHARGER LES PRODUITS POUR SUGGESTIONS
    // ==========================================

    async function loadSuggestions() {
        try {
            const res = await fetch('/api/products');
            const data = await res.json();
            if (res.ok && data.length > 0) {
                allProducts = data;
                renderSuggestions();
            }
        } catch (error) {
            console.error('Erreur suggestions:', error);
        }
    }

    // ==========================================
    // PANIER VIDE STYLÉ
    // ==========================================

    function renderEmpty() {
        if (!container) return;
        container.innerHTML = `
            <div class="cart-empty">
                <span class="empty-icon">🛒</span>
                <h3>Votre panier est vide</h3>
                <p>Découvrez nos produits et commencez vos achats !</p>
                <a href="/dashboard" class="btn-shop">🛍️ Voir les produits</a>
            </div>
        `;
        if (cartCount) cartCount.textContent = '(0)';
        if (totalPrice) {
            totalPrice.textContent = '0 FCFA';
            totalPrice.classList.remove('pop');
        }
        if (checkoutBtn) {
            checkoutBtn.disabled = true;
            checkoutBtn.style.opacity = '0.5';
        }
        if (clearBtn) {
            clearBtn.disabled = true;
            clearBtn.style.opacity = '0.5';
        }
        suggestionsSection.style.display = 'none';
        messageCard.style.display = 'none';
    }

    // ==========================================
    // RENDER SUGGESTIONS
    // ==========================================

    function renderSuggestions() {
        if (!panier.length) return;

        const panierIds = panier.map(p => p.product_id || p.id);
        const suggestions = allProducts
            .filter(p => !panierIds.includes(p.id))
            .slice(0, 4);

        if (suggestions.length === 0) {
            suggestionsSection.style.display = 'none';
            return;
        }

        suggestionsSection.style.display = 'block';
        suggestionsGrid.innerHTML = suggestions.map(p => `
            <div class="suggestion-item" data-id="${p.id}">
                <img src="${p.image1 || 'https://via.placeholder.com/150'}" alt="${p.name}" loading="lazy">
                <div class="s-name">${p.name}</div>
                <div class="s-price">${p.price.toLocaleString()} FCFA</div>
                <button class="s-add" data-id="${p.id}">➕ Ajouter</button>
            </div>
        `).join('');

        document.querySelectorAll('.s-add').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const id = this.dataset.id;
                addToCart(id);
            });
        });

        document.querySelectorAll('.suggestion-item').forEach(item => {
            item.addEventListener('click', function() {
                const id = this.dataset.id;
                window.location.href = `/infoproduit?id=${id}`;
            });
        });
    }

    // ==========================================
    // AJOUTER AU PANIER (depuis suggestion)
    // ==========================================

    async function addToCart(productId) {
        try {
            const res = await fetch('/api/panier/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ productId, quantity: 1 })
            });

            const data = await res.json();

            if (data.success) {
                loadPanier();
                updateBadge();
            } else if (data.error === 'Non authentifié') {
                window.location.href = '/login';
            }
        } catch (error) {
            console.error('Erreur ajout suggestion:', error);
        }
    }

    function goToProduct(productId) {
        window.location.href = '/infoproduit?id=' + productId;
    }

    // ==========================================
    // ANIMATION DU PRIX TOTAL (0 → total)
    // ==========================================

    function animatePrice(targetValue) {
        if (!totalPrice) return;

        const startValue = 0;
        const duration = 400;
        const startTime = performance.now();

        function update(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function (easeOut)
            const eased = 1 - Math.pow(1 - progress, 3);
            const currentValue = Math.round(startValue + (targetValue - startValue) * eased);
            
            totalPrice.textContent = currentValue.toLocaleString() + ' FCFA';
            
            if (progress < 1) {
                requestAnimationFrame(update);
            } else {
                totalPrice.textContent = targetValue.toLocaleString() + ' FCFA';
                // Animation pop à la fin
                totalPrice.classList.remove('pop');
                void totalPrice.offsetWidth;
                totalPrice.classList.add('pop');
            }
        }

        requestAnimationFrame(update);
    }

    // ==========================================
    // AFFICHER LE PANIER
    // ==========================================

    function renderPanier() {
        if (!container) return;

        if (panier.length === 0) {
            renderEmpty();
            return;
        }

        total = panier.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const totalItems = panier.reduce((sum, item) => sum + item.quantity, 0);

        let html = '';

        panier.forEach((item, index) => {
            const imgSrc = item.image1 || 'https://via.placeholder.com/50';
            const totalLigne = item.price * item.quantity;
            const stockDispo = item.stock || 999;
            let stockClass = '';
            let stockLabel = '📦 En stock';
            if (stockDispo <= 0) {
                stockClass = 'out';
                stockLabel = '🚫 Rupture';
            } else if (stockDispo <= 5) {
                stockClass = 'low';
                stockLabel = '⚠️ Stock limité';
            }

            const promoBadge = item.promotion ? '<span class="promo-badge">Promo</span>' : '';
            const oldPriceHtml = item.prix_promotion ? `<span class="old-price">${item.prix_promotion.toLocaleString()} FCFA</span>` : '';

            html += `
                <div class="cart-item" data-index="${index}" data-id="${item.product_id || item.id}">
                    <div class="item-header">
                        <img src="${imgSrc}" alt="${item.name}" class="item-img" loading="lazy">
                        <span class="item-name">${item.name} ${promoBadge}</span>
                    </div>
                    <div class="item-main">
                        <div class="item-price">
                            ${totalLigne.toLocaleString()} FCFA
                            ${oldPriceHtml}
                            <span style="font-size:13px;color:#aaa;font-weight:400;display:block;">
                                (${item.price.toLocaleString()} × ${item.quantity})
                            </span>
                        </div>
                        <div class="item-desc">${item.description || ''}</div>
                        <div class="item-stock ${stockClass}">${stockLabel}</div>
                    </div>
                    <div class="item-footer">
                        <div class="item-qty">
                            <button class="qty-minus" data-index="${index}">−</button>
                            <span id="qty-${index}">${item.quantity}</span>
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
        if (cartCount) cartCount.textContent = `(${totalItems})`;
        
        // ✅ Animation du prix total (0 → total)
        animatePrice(total);

        if (checkoutBtn) {
            checkoutBtn.disabled = false;
            checkoutBtn.style.opacity = '1';
        }
        if (clearBtn) {
            clearBtn.disabled = false;
            clearBtn.style.opacity = '1';
        }

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

        if (checkoutBtn) {
            checkoutBtn.onclick = function() {
                if (panier.length === 0) return;
                openCommande();
            };
        }

        if (clearBtn) {
            clearBtn.onclick = function() {
                if (panier.length === 0) return;
                openConfirm(
                    '🗑️ Vider le panier',
                    'Êtes-vous sûr de vouloir vider tout votre panier ? Cette action est définitive.',
                    'clear'
                );
            };
        }
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
                // Recalculer le total et animer
                const newTotal = panier.reduce((sum, i) => sum + (i.price * i.quantity), 0);
                animatePrice(newTotal);
                
                // Mettre à jour l'affichage de la quantité
                const qtyEl = document.getElementById(`qty-${index}`);
                if (qtyEl) {
                    qtyEl.textContent = newQty;
                }
                
                // Mettre à jour le prix de la ligne
                const items = document.querySelectorAll('.cart-item');
                if (items[index]) {
                    const priceEl = items[index].querySelector('.item-price');
                    if (priceEl) {
                        const totalLigne = item.price * newQty;
                        priceEl.innerHTML = `
                            ${totalLigne.toLocaleString()} FCFA
                            ${item.prix_promotion ? `<span class="old-price">${item.prix_promotion.toLocaleString()} FCFA</span>` : ''}
                            <span style="font-size:13px;color:#aaa;font-weight:400;display:block;">
                                (${item.price.toLocaleString()} × ${newQty})
                            </span>
                        `;
                    }
                }
                
                updateBadge();
            }
        } catch (error) {
            console.error('Erreur mise à jour:', error);
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
                const items = document.querySelectorAll('.cart-item');
                if (items[index]) {
                    items[index].classList.add('removing');
                    setTimeout(() => {
                        panier.splice(index, 1);
                        if (panier.length === 0) {
                            renderEmpty();
                            suggestionsSection.style.display = 'none';
                            messageCard.style.display = 'none';
                        } else {
                            renderPanier();
                            loadSuggestions();
                        }
                        updateBadge();
                    }, 300);
                } else {
                    panier.splice(index, 1);
                    if (panier.length === 0) {
                        renderEmpty();
                        suggestionsSection.style.display = 'none';
                        messageCard.style.display = 'none';
                    } else {
                        renderPanier();
                        loadSuggestions();
                    }
                    updateBadge();
                }
            }
        } catch (error) {
            console.error('Erreur suppression:', error);
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
                suggestionsSection.style.display = 'none';
                messageCard.style.display = 'none';
            }
        } catch (error) {
            console.error('Erreur vidage:', error);
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

            setInterval(() => {
                updateBadge();
            }, 30000);

            console.log('✅ Initialisation terminée');
        } catch (error) {
            console.error('❌ Erreur lors de l\'initialisation:', error);
        }
    })();

});