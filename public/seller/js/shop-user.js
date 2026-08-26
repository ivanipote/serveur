document.addEventListener('DOMContentLoaded', function() {

    console.log('✅ Shop User - Version username');

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
    const likeBtn = document.getElementById('likeBtn');
    const likeCount = document.getElementById('likeCount');
    const detailBtn = document.getElementById('detailBtn');
    const slideBody = document.getElementById('slideBody');
    const commentInput = document.getElementById('commentInput');
    const sendCommentBtn = document.getElementById('sendCommentBtn');

    let currentProductId = null;
    let isLiked = false;
    let likeCounter = 0;
    let productComments = [];
    let currentUsername = null;

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

    function promptUsername() {
        const name = prompt('👤 Entrez votre nom d\'utilisateur pour commenter et liker :');
        if (name && name.trim().length > 0) {
            setUsername(name.trim());
            return true;
        }
        return false;
    }

    function ensureUsername() {
        let name = getUsername();
        if (!name) {
            const ok = promptUsername();
            if (!ok) return null;
            name = getUsername();
        }
        return name;
    }

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
            // Incrémenter les vues de la boutique
            await fetch(SELLER_API_URL + '/api/seller/shop/' + shopId + '/view', {
                method: 'POST'
            }).catch(err => console.warn('Erreur incrément vue boutique:', err));

            // Récupérer les infos de la boutique
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

            // Incrémenter les vues pour tous les produits (page ouverte)
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

        // Clic sur une carte → ouvrir slide + incrémenter vue
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

        // Charger les commentaires et likes
        loadProductData(productId);

        slideOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';

        // ❌ PAS DE FOCUS AUTO sur le champ commentaire
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

                // Vérifier si l'utilisateur a déjà liké (flex4)
                const username = getUsername();
                if (username) {
                    const userLikes = product.flex4 ? JSON.parse(product.flex4) : [];
                    isLiked = userLikes.includes(username);
                    if (isLiked) {
                        likeBtn.classList.add('liked');
                    } else {
                        likeBtn.classList.remove('liked');
                    }
                } else {
                    likeBtn.classList.remove('liked');
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
    // AFFICHER LES COMMENTAIRES
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

        // Mettre en avant le nom de l'utilisateur connecté
        const username = getUsername();

        slideBody.innerHTML = comments.map(c => {
            const isCurrentUser = username && c.user === username;
            const avatar = c.avatar || '👤';
            return `
                <div class="comment-item ${isCurrentUser ? 'current-user' : ''}" style="${isCurrentUser ? 'background: #f0fbf5; border-radius: 8px; padding: 8px 12px; margin: 0 -4px;' : ''}">
                    <div class="comment-avatar">${avatar}</div>
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
    }

    closeSlideBtn.addEventListener('click', closeSlide);
    slideOverlay.addEventListener('click', function(e) {
        if (e.target === slideOverlay) closeSlide();
    });

    // ==========================================
    // LIKE / DISLIKE (avec username)
    // ==========================================

    likeBtn.addEventListener('click', function() {
        const username = ensureUsername();
        if (!username) return;

        if (isLiked) {
            // Dislike
            isLiked = false;
            likeCounter--;
            this.classList.remove('liked');
        } else {
            // Like
            isLiked = true;
            likeCounter++;
            this.classList.add('liked');
        }

        likeCount.textContent = likeCounter;
        updateProductLikes(currentProductId, likeCounter, isLiked, username);
    });

    async function updateProductLikes(productId, likes, liked, username) {
        try {
            // Mettre à jour les likes (flex2)
            await fetch(SELLER_API_URL + '/api/seller/product/' + productId + '/like', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ likes: likes })
            });

            // Mettre à jour la liste des utilisateurs qui ont liké (flex4)
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
    // ENVOYER UN COMMENTAIRE (avec username)
    // ==========================================

    function sendComment() {
        const username = ensureUsername();
        if (!username) return;

        const text = commentInput.value.trim();
        if (!text || !currentProductId) return;

        const newComment = {
            user: username,
            avatar: '👤',
            comment: text,
            date: new Date().toLocaleDateString('fr-FR')
        };

        productComments.push(newComment);

        // Sauvegarder les commentaires dans flex1
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
    // CHANGER DE NOM D'UTILISATEUR
    // ==========================================

    // Double-clic sur le nom du produit dans le slide pour changer de nom
    slideProductName.addEventListener('dblclick', function() {
        const newName = prompt('👤 Changer votre nom d\'utilisateur :', getUsername() || '');
        if (newName && newName.trim().length > 0) {
            setUsername(newName.trim());
            // Recharger les données du produit pour mettre à jour le like
            if (currentProductId) {
                loadProductData(currentProductId);
            }
            alert('✅ Nom d\'utilisateur mis à jour : ' + getUsername());
        }
    });

    // ==========================================
    // INITIALISATION
    // ==========================================

    (async function init() {
        // Récupérer le username s'il existe
        const username = getUsername();
        if (username) {
            console.log('👤 Nom d\'utilisateur :', username);
        } else {
            console.log('ℹ️ Aucun nom d\'utilisateur - connectez-vous pour liker et commenter');
        }

        // Charger la boutique et les produits
        await loadShop();
        console.log('✅ Shop User - Prêt');
    })();

});