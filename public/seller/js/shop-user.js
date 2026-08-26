document.addEventListener('DOMContentLoaded', function() {

    console.log('✅ Shop User - Version complète avec username overlay');

    // ==========================================
    // RÉFÉRENCES
    // ==========================================

    const skeletonLoader = document.getElementById('skeletonLoader');
    const productsGrid = document.getElementById('productsGrid');
    const emptyState = document.getElementById('emptyState');
    const shopName = document.getElementById('shopName');
    const productCount = document.getElementById('productCount');

    const slideOverlay = document.getElementById('slideOverlay');
    const closeSlideBtn = document.getElementById('closeSlideBtn');
    const slideProductName = document.getElementById('slideProductName');
    const slideProductImage = document.getElementById('slideProductImage');
    const slideImagePlaceholder = document.getElementById('slideImagePlaceholder');
    const likeBtn = document.getElementById('likeBtn');
    const likeCount = document.getElementById('likeCount');
    const detailBtn = document.getElementById('detailBtn');
    const slideBody = document.getElementById('slideBody');
    const commentInput = document.getElementById('commentInput');
    const sendCommentBtn = document.getElementById('sendCommentBtn');

    const usernameOverlay = document.getElementById('usernameOverlay');
    const usernameInput = document.getElementById('usernameInput');
    const usernameConfirmBtn = document.getElementById('usernameConfirmBtn');
    const usernameSkipBtn = document.getElementById('usernameSkipBtn');

    let currentProductId = null;
    let isLiked = false;
    let likeCounter = 0;
    let productComments = [];
    let currentUsername = null;
    let syncInterval = null;
    let isSlideOpen = false;

    // ==========================================
    // GESTION DU USERNAME
    // ==========================================

    const USERNAME_KEY = 'complus_username';

    function getUsername() {
        if (currentUsername) return currentUsername;
        const stored = localStorage.getItem(USERNAME_KEY);
        if (stored) {
            currentUsername = stored;
            return currentUsername;
        }
        return null;
    }

    function setUsername(name) {
        currentUsername = name.trim();
        localStorage.setItem(USERNAME_KEY, currentUsername);
    }

    function showUsernameOverlay() {
        usernameInput.value = getUsername() || '';
        usernameOverlay.classList.add('active');
        setTimeout(() => usernameInput.focus(), 300);
    }

    function hideUsernameOverlay() {
        usernameOverlay.classList.remove('active');
    }

    usernameConfirmBtn.addEventListener('click', function() {
        const name = usernameInput.value.trim();
        if (name.length > 0) {
            setUsername(name);
            hideUsernameOverlay();
            // Recharger les données du produit pour mettre à jour le like
            if (currentProductId) {
                loadProductData(currentProductId);
            }
        } else {
            usernameInput.style.borderColor = '#E24C4C';
            setTimeout(() => usernameInput.style.borderColor = '', 1000);
        }
    });

    usernameInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            usernameConfirmBtn.click();
        }
    });

    usernameSkipBtn.addEventListener('click', function() {
        hideUsernameOverlay();
    });

    // ==========================================
    // URL DU SERVEUR SELLER
    // ==========================================

    const SELLER_API_URL = 'https://nature-plus-seller.onrender.com';

    // ==========================================
    // RÉCUPÉRER L'ID DE LA BOUTIQUE
    // ==========================================

    const urlParams = new URLSearchParams(window.location.search);
    const shopId = urlParams.get('id');

    if (!shopId) {
        shopName.textContent = 'Boutique non trouvée';
        skeletonLoader.style.display = 'none';
        emptyState.style.display = 'block';
        emptyState.querySelector('p').textContent = 'ID de boutique manquant.';
        return;
    }

    // ==========================================
    // CHARGER LA BOUTIQUE ET SES PRODUITS
    // ==========================================

    async function loadShop() {
        try {
            await fetch(SELLER_API_URL + '/api/seller/shop/' + shopId + '/view', {
                method: 'POST'
            }).catch(err => console.warn('Erreur incrément vue boutique:', err));

            const res = await fetch(SELLER_API_URL + '/api/seller/shop/' + shopId);
            const data = await res.json();

            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Erreur chargement');
            }

            const shop = data.shop;
            const products = data.products || [];

            skeletonLoader.style.display = 'none';

            shopName.textContent = shop.name || 'Boutique';
            productCount.textContent = products.length + ' produits';

            if (products.length === 0) {
                emptyState.style.display = 'block';
                return;
            }

            products.forEach(p => {
                incrementProductViews(p.id);
            });

            renderProducts(products);

            console.log('✅ ' + products.length + ' produits chargés');

        } catch (error) {
            console.error('❌ Erreur:', error);
            skeletonLoader.style.display = 'none';
            emptyState.style.display = 'block';
            emptyState.querySelector('p').textContent = error.message || 'Erreur de chargement.';
        }
    }

    // ==========================================
    // INCRÉMENTER LES VUES D'UN PRODUIT
    // ==========================================

    async function incrementProductViews(productId) {
        try {
            await fetch(SELLER_API_URL + '/api/seller/product/' + productId + '/view', {
                method: 'POST'
            });
        } catch (err) {
            console.warn('Erreur incrément vue produit:', err);
        }
    }

    // ==========================================
    // AFFICHER LES PRODUITS
    // ==========================================

    function renderProducts(products) {
        productsGrid.style.display = 'grid';

        productsGrid.innerHTML = products.map(p => {
            const stock = p.stock || 0;
            let stockLabel = 'En stock';
            let stockClass = 'in-stock';
            if (stock === 0) {
                stockLabel = 'Rupture';
                stockClass = 'out-of-stock';
            } else if (stock <= 5) {
                stockLabel = 'Stock faible';
                stockClass = 'low-stock';
            }

            const imgSrc = p.image1 || null;
            const imgHtml = imgSrc ?
                `<img src="${imgSrc}" alt="${p.name}" loading="lazy" />` :
                `<div class="fallback">📦</div>`;

            return `
                <div class="product-card" data-id="${p.id}">
                    <div class="product-image">
                        ${imgHtml}
                        <span class="stock-badge ${stockClass}">${stockLabel}</span>
                    </div>
                    <div class="product-info">
                        <div class="product-name">${p.name}</div>
                        <div class="product-footer">
                            <span class="product-price">${p.price.toLocaleString()} FCFA</span>
                            <span class="product-stock-qty"><i class="fas fa-box"></i> ${stock}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        document.querySelectorAll('.product-card').forEach(card => {
            card.addEventListener('click', function() {
                const id = parseInt(this.dataset.id);
                incrementProductViews(id);
                openSlide(id);
            });
        });
    }

    // ==========================================
    // OUVERTURE DU SLIDE
    // ==========================================

    function openSlide(productId) {
        const productCard = document.querySelector(`.product-card[data-id="${productId}"]`);
        if (!productCard) return;

        const productName = productCard.querySelector('.product-name').textContent;

        currentProductId = productId;
        slideProductName.textContent = productName;

        // Image
        const img = productCard.querySelector('.product-image img');
        if (img && img.src) {
            slideProductImage.src = img.src;
            slideProductImage.style.display = 'block';
            slideImagePlaceholder.style.display = 'none';
        } else {
            slideProductImage.style.display = 'none';
            slideImagePlaceholder.style.display = 'flex';
        }

        loadProductData(productId);

        slideOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
        isSlideOpen = true;

        // Démarrer la sync des commentaires
        startCommentSync(productId);

        // Vérifier si l'utilisateur a un nom
        const username = getUsername();
        if (!username) {
            setTimeout(() => showUsernameOverlay(), 500);
        }
    }

    // ==========================================
    // SYNC DES COMMENTAIRES (toutes les 5s)
    // ==========================================

    function startCommentSync(productId) {
        stopCommentSync();
        syncInterval = setInterval(() => {
            if (isSlideOpen && currentProductId === productId) {
                refreshComments(productId);
            }
        }, 5000);
    }

    function stopCommentSync() {
        if (syncInterval) {
            clearInterval(syncInterval);
            syncInterval = null;
        }
    }

    async function refreshComments(productId) {
        try {
            const res = await fetch(SELLER_API_URL + '/api/seller/product/' + productId);
            const data = await res.json();

            if (data.success && data.product) {
                const newComments = data.product.comments || [];
                const newLikes = parseInt(data.product.likes) || 0;

                // Vérifier si les commentaires ont changé
                if (JSON.stringify(newComments) !== JSON.stringify(productComments)) {
                    productComments = newComments;
                    renderComments(productComments);
                }

                // Mettre à jour le compteur de likes
                if (newLikes !== likeCounter) {
                    likeCounter = newLikes;
                    likeCount.textContent = likeCounter;
                }

                // Vérifier l'état du like
                const username = getUsername();
                if (username) {
                    const userLikes = data.product.flex4 ? JSON.parse(data.product.flex4) : [];
                    const newIsLiked = userLikes.includes(username);
                    if (newIsLiked !== isLiked) {
                        isLiked = newIsLiked;
                        if (isLiked) {
                            likeBtn.classList.add('liked');
                            likeBtn.disabled = true;
                        } else {
                            likeBtn.classList.remove('liked');
                            likeBtn.disabled = false;
                        }
                    }
                }
            }
        } catch (err) {
            console.warn('Erreur refresh commentaires:', err);
        }
    }

    // ==========================================
    // CHARGER LES DONNÉES D'UN PRODUIT
    // ==========================================

    async function loadProductData(productId) {
        try {
            const res = await fetch(SELLER_API_URL + '/api/seller/product/' + productId);
            const data = await res.json();

            if (data.success && data.product) {
                const product = data.product;
                productComments = product.comments || [];
                likeCounter = parseInt(product.likes) || 0;

                likeCount.textContent = likeCounter;

                const username = getUsername();
                if (username) {
                    const userLikes = product.flex4 ? JSON.parse(product.flex4) : [];
                    isLiked = userLikes.includes(username);
                    if (isLiked) {
                        likeBtn.classList.add('liked');
                        likeBtn.disabled = true;
                    } else {
                        likeBtn.classList.remove('liked');
                        likeBtn.disabled = false;
                    }
                } else {
                    likeBtn.classList.remove('liked');
                    likeBtn.disabled = false;
                    isLiked = false;
                }

                renderComments(productComments);
            }
        } catch (err) {
            console.warn('Erreur chargement données produit:', err);
            renderComments([]);
        }
    }

    // ==========================================
    // AFFICHER LES COMMENTAIRES (en bleu)
    // ==========================================

    function renderComments(comments) {
        if (!comments || comments.length === 0) {
            slideBody.innerHTML = `
                <div class="no-comments">
                    <i class="fas fa-comment-slash"></i>
                    <p>Aucun commentaire pour ce produit.<br>Soyez le premier à donner votre avis !</p>
                </div>
            `;
            return;
        }

        const username = getUsername();

        slideBody.innerHTML = comments.map(c => {
            const isCurrentUser = username && c.user === username;
            return `
                <div class="comment-item ${isCurrentUser ? 'current-user' : ''}">
                    <div class="comment-avatar">${c.avatar || '👤'}</div>
                    <div class="comment-content">
                        <div class="comment-user">${c.user} ${isCurrentUser ? '✧ (vous)' : ''}</div>
                        <div class="comment-text">${c.comment}</div>
                        <div class="comment-date">${c.date || 'Aujourd\'hui'}</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // ==========================================
    // FERMER LE SLIDE
    // ==========================================

    function closeSlide() {
        slideOverlay.classList.remove('active');
        document.body.style.overflow = '';
        commentInput.value = '';
        isSlideOpen = false;
        stopCommentSync();
    }

    closeSlideBtn.addEventListener('click', closeSlide);
    slideOverlay.addEventListener('click', function(e) {
        if (e.target === slideOverlay) closeSlide();
    });

    // ==========================================
    // LIKE / DISLIKE (une seule fois)
    // ==========================================

    likeBtn.addEventListener('click', function() {
        const username = getUsername();
        if (!username) {
            showUsernameOverlay();
            return;
        }

        if (isLiked) {
            // Dislike
            isLiked = false;
            likeCounter--;
            this.classList.remove('liked');
            this.disabled = false;
        } else {
            // Like
            isLiked = true;
            likeCounter++;
            this.classList.add('liked');
            this.disabled = true; // 🔒 Désactiver après like
        }

        likeCount.textContent = likeCounter;
        updateProductLikes(currentProductId, likeCounter, isLiked, username);
    });

    async function updateProductLikes(productId, likes, liked, username) {
        try {
            await fetch(SELLER_API_URL + '/api/seller/product/' + productId + '/like', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ likes: likes })
            });

            const res = await fetch(SELLER_API_URL + '/api/seller/product/' + productId);
            const data = await res.json();
            let userLikes = [];
            if (data.success && data.product) {
                userLikes = data.product.flex4 ? JSON.parse(data.product.flex4) : [];
            }

            if (liked) {
                if (!userLikes.includes(username)) {
                    userLikes.push(username);
                }
            } else {
                userLikes = userLikes.filter(name => name !== username);
            }

            await fetch(SELLER_API_URL + '/api/seller/product/' + productId + '/likes-users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ users: userLikes })
            });
        } catch (err) {
            console.warn('Erreur mise à jour likes:', err);
        }
    }

    // ==========================================
    // DÉTAIL → +1 vue + redirection
    // ==========================================

    detailBtn.addEventListener('click', function() {
        if (currentProductId) {
            incrementProductViews(currentProductId);
            window.location.href = '/detail-produit.html?id=' + currentProductId;
        }
    });

    // ==========================================
    // ENVOYER UN COMMENTAIRE
    // ==========================================

    function sendComment() {
        const username = getUsername();
        if (!username) {
            showUsernameOverlay();
            return;
        }

        const text = commentInput.value.trim();
        if (!text || !currentProductId) return;

        const newComment = {
            user: username,
            avatar: '👤',
            comment: text,
            date: new Date().toLocaleDateString('fr-FR')
        };

        productComments.push(newComment);
        saveComments(currentProductId, productComments);
        renderComments(productComments);
        commentInput.value = '';

        setTimeout(() => {
            slideBody.scrollTop = slideBody.scrollHeight;
        }, 100);
    }

    async function saveComments(productId, comments) {
        try {
            await fetch(SELLER_API_URL + '/api/seller/product/' + productId + '/comments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ comments: comments })
            });
        } catch (err) {
            console.warn('Erreur sauvegarde commentaires:', err);
        }
    }

    sendCommentBtn.addEventListener('click', sendComment);

    commentInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            sendComment();
        }
    });

    // ==========================================
    // CHANGER DE NOM (double-clic sur le nom du produit)
    // ==========================================

    slideProductName.addEventListener('dblclick', function() {
        showUsernameOverlay();
    });

    // ==========================================
    // INITIALISATION
    // ==========================================

    (async function init() {
        const username = getUsername();
        if (username) {
            console.log('👤 Nom d\'utilisateur :', username);
        } else {
            console.log('ℹ️ Aucun nom d\'utilisateur');
        }

        await loadShop();
        console.log('✅ Shop User - Prêt');
    })();

});