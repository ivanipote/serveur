document.addEventListener('DOMContentLoaded', function() {

    console.log('✅ Shop User - Version complète');

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
    const slideDescription = document.getElementById('slideDescription');
    const likeBtn = document.getElementById('likeBtn');
    const likeCount = document.getElementById('likeCount');
    const detailBtn = document.getElementById('detailBtn');
    const slideBody = document.getElementById('slideBody');
    const commentsContainer = document.getElementById('commentsContainer');
    const commentSkeleton = document.getElementById('commentSkeleton');
    const commentInput = document.getElementById('commentInput');
    const sendCommentBtn = document.getElementById('sendCommentBtn');

    const replyingIndicator = document.getElementById('replyingIndicator');
    const replyToText = document.getElementById('replyToText');
    const cancelReplyBtn = document.getElementById('cancelReplyBtn');

    const usernameOverlay = document.getElementById('usernameOverlay');
    const usernameInput = document.getElementById('usernameInput');
    const usernameConfirmBtn = document.getElementById('usernameConfirmBtn');
    const usernameSkipBtn = document.getElementById('usernameSkipBtn');
    const whatsappBtn = document.getElementById('whatsappBtn');

    let currentProductId = null;
    let isLiked = false;
    let likeCounter = 0;
    let productComments = [];
    let currentUsername = null;
    let syncInterval = null;
    let isSlideOpen = false;
    let replyTarget = null;
    let commentIdCounter = 0;
    let currentShop = null;
    let isLoadingComments = false;
    let isLikingComment = false;

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
    // URL
    // ==========================================

    const SELLER_API_URL = 'https://nature-plus-seller.onrender.com';
    const CLIENT_API_URL = 'https://nature-plus-client.onrender.com';

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
    // CHARGER LA BOUTIQUE
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

            currentShop = data.shop;
            const products = data.products || [];

            skeletonLoader.style.display = 'none';

            shopName.textContent = currentShop.name || 'Boutique';
            productCount.textContent = products.length + ' produits';

            // WhatsApp
            if (currentShop.seller_phone) {
                const cleanPhone = currentShop.seller_phone.replace(/\D/g, '');
                whatsappBtn.href = 'https://wa.me/225' + cleanPhone;
            }

            if (products.length === 0) {
                emptyState.style.display = 'block';
                return;
            }

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
                // Incrémenter la vue du produit
                incrementProductViews(id);
                // Rediriger vers detail-produit.html
                window.location.href = '/detail-produit.html?id=' + id;
            });
        });
    }

    // ==========================================
    // INCRÉMENTER LES VUES
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
    // OUVERTURE DU SLIDE (commentaires)
    // ==========================================

    function openSlide(productId, productName, productImage, productDescription) {
        currentProductId = productId;
        slideProductName.textContent = productName;
        slideDescription.textContent = productDescription || 'Aucune description';

        // Image
        if (productImage) {
            slideProductImage.src = productImage;
            slideProductImage.style.display = 'block';
            slideImagePlaceholder.style.display = 'none';
        } else {
            slideProductImage.style.display = 'none';
            slideImagePlaceholder.style.display = 'flex';
        }

        // Réinitialiser la réponse
        replyTarget = null;
        replyingIndicator.style.display = 'none';

        showCommentSkeleton();
        loadProductData(productId);

        slideOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
        isSlideOpen = true;

        const username = getUsername();
        if (!username) {
            setTimeout(() => showUsernameOverlay(), 500);
        }
    }

    // ==========================================
    // CHARGER LES COMMENTAIRES D'UN PRODUIT
    // ==========================================

    async function loadProductData(productId) {
        isLoadingComments = true;
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

                hideCommentSkeleton();
                renderComments(productComments);
            }
        } catch (err) {
            console.warn('Erreur chargement données produit:', err);
            hideCommentSkeleton();
            renderComments([]);
        } finally {
            isLoadingComments = false;
        }
    }

    // ==========================================
    // AFFICHER LES COMMENTAIRES (en bleu)
    // ==========================================

    function renderComments(comments) {
        if (!comments || comments.length === 0) {
            commentsContainer.innerHTML = `
                <div class="no-comments">
                    <i class="fas fa-comment-slash"></i>
                    <p>Aucun commentaire pour ce produit.<br>Soyez le premier à donner votre avis !</p>
                </div>
            `;
            return;
        }

        const username = getUsername();

        commentsContainer.innerHTML = comments.map(c => {
            const isCurrentUser = username && c.user === username;

            const repliesHtml = c.replies && c.replies.length > 0 ?
                c.replies.map(r => `
                    <div class="reply-item">
                        <span class="reply-user">${r.user}</span>
                        <span class="reply-text">${r.comment}</span>
                        <span class="reply-date">${r.date || 'Aujourd\'hui'}</span>
                    </div>
                `).join('') : '';

            const likedByUser = c.liked_by && c.liked_by.includes(username);
            const likesDisplay = c.likes || 0;

            return `
                <div class="comment-item" data-id="${c.id}">
                    <div class="comment-top">
                        <div class="comment-avatar">${c.avatar || '👤'}</div>
                        <span class="comment-user">${c.user} ${isCurrentUser ? '✧ (vous)' : ''}</span>
                    </div>
                    <div class="comment-text">${c.comment}</div>
                    <div class="comment-bottom">
                        <span class="comment-date">${c.date || 'Aujourd\'hui'}</span>
                        <button class="comment-like-btn ${likedByUser ? 'liked' : ''}" onclick="likeComment(${c.id})" ${isLikingComment ? 'disabled' : ''}>
                            <i class="fas fa-heart"></i> ${likesDisplay}
                        </button>
                        <button class="comment-reply-btn" onclick="startReply(${c.id}, '${c.user}')">
                            Répondre
                        </button>
                    </div>
                    ${repliesHtml ? `<div class="replies">${repliesHtml}</div>` : ''}
                </div>
            `;
        }).join('');

        // Mettre à jour les likes des commentaires
        document.querySelectorAll('.comment-like-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
            });
        });
    }

    // ==========================================
    // SKELETON COMMENTAIRES
    // ==========================================

    function showCommentSkeleton() {
        commentSkeleton.style.display = 'block';
        commentsContainer.style.display = 'none';
        commentsContainer.innerHTML = '';
    }

    function hideCommentSkeleton() {
        commentSkeleton.style.display = 'none';
        commentsContainer.style.display = 'block';
    }

    // ==========================================
    // SYNC COMMENTAIRES (5s)
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
        if (isLoadingComments) return;
        try {
            const res = await fetch(SELLER_API_URL + '/api/seller/product/' + productId);
            const data = await res.json();

            if (data.success && data.product) {
                const newComments = data.product.comments || [];
                const newLikes = parseInt(data.product.likes) || 0;

                if (JSON.stringify(newComments) !== JSON.stringify(productComments)) {
                    productComments = newComments;
                    renderComments(productComments);
                }

                if (newLikes !== likeCounter) {
                    likeCounter = newLikes;
                    likeCount.textContent = likeCounter;
                }
            }
        } catch (err) {
            console.warn('Erreur refresh commentaires:', err);
        }
    }

    // ==========================================
    // FERMER LE SLIDE
    // ==========================================

    function closeSlide() {
        slideOverlay.classList.remove('active');
        document.body.style.overflow = '';
        commentInput.value = '';
        isSlideOpen = false;
        replyTarget = null;
        replyingIndicator.style.display = 'none';
        stopCommentSync();
    }

    closeSlideBtn.addEventListener('click', closeSlide);
    slideOverlay.addEventListener('click', function(e) {
        if (e.target === slideOverlay) closeSlide();
    });

    // ==========================================
    // LIKE DU PRODUIT
    // ==========================================

    likeBtn.addEventListener('click', function() {
        const username = getUsername();
        if (!username) {
            showUsernameOverlay();
            return;
        }

        if (isLiked) {
            isLiked = false;
            likeCounter--;
            this.classList.remove('liked');
            this.disabled = false;
        } else {
            isLiked = true;
            likeCounter++;
            this.classList.add('liked');
            this.disabled = true;
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
    // DÉTAIL (depuis le slide)
    // ==========================================

    detailBtn.addEventListener('click', function() {
        if (currentProductId) {
            incrementProductViews(currentProductId);
            window.location.href = '/detail-produit.html?id=' + currentProductId;
        }
    });

    // ==========================================
    // LIKER UN COMMENTAIRE (avec notification)
    // ==========================================

    window.likeComment = async function(commentId) {
        if (isLikingComment) return;

        const username = getUsername();
        if (!username) {
            showUsernameOverlay();
            return;
        }

        const comment = productComments.find(c => c.id === commentId);
        if (!comment) return;

        // Vérifier si déjà liké
        if (comment.liked_by && comment.liked_by.includes(username)) return;

        isLikingComment = true;

        // Mettre à jour localement
        comment.likes = (comment.likes || 0) + 1;
        if (!comment.liked_by) comment.liked_by = [];
        comment.liked_by.push(username);

        renderComments(productComments);

        // ✅ Envoyer une notification à l'auteur du commentaire
        if (comment.user !== username) {
            try {
                await fetch(SELLER_API_URL + '/api/notification/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: comment.user_id || 0,
                        type: 'comment_like',
                        title: '❤️ Nouveau like sur votre commentaire',
                        content: `${username} a aimé votre commentaire : "${comment.comment.substring(0, 30)}${comment.comment.length > 30 ? '...' : ''}"`
                    })
                });
                console.log('✅ Notification de like envoyée à', comment.user);
            } catch (err) {
                console.warn('Erreur envoi notification like:', err);
            }
        }

        // Sauvegarder les commentaires mis à jour
        await saveComments(currentProductId, productComments);

        isLikingComment = false;
    };

    // ==========================================
    // RÉPONDRE À UN COMMENTAIRE (avec notification)
    // ==========================================

    window.startReply = function(commentId, userName) {
        const username = getUsername();
        if (!username) {
            showUsernameOverlay();
            return;
        }

        replyTarget = commentId;
        replyingIndicator.style.display = 'flex';
        replyToText.innerHTML = `Répondre à <strong>@${userName}</strong>`;
        commentInput.focus();
        commentInput.placeholder = `Répondre à ${userName}...`;
    };

    cancelReplyBtn.addEventListener('click', function() {
        replyTarget = null;
        replyingIndicator.style.display = 'none';
        commentInput.placeholder = 'Écrire un commentaire...';
    });

    // ==========================================
    // ENVOYER UN COMMENTAIRE (ou réponse)
    // ==========================================

    function sendComment() {
        const username = getUsername();
        if (!username) {
            showUsernameOverlay();
            return;
        }

        const text = commentInput.value.trim();
        if (!text || !currentProductId) return;

        let parentComment = null;

        if (replyTarget !== null) {
            // Réponse à un commentaire
            parentComment = productComments.find(c => c.id === replyTarget);
            if (!parentComment) return;

            if (!parentComment.replies) parentComment.replies = [];
            parentComment.replies.push({
                user: username,
                comment: text,
                date: new Date().toLocaleDateString('fr-FR')
            });

            // ✅ Envoyer une notification à l'auteur du commentaire parent
            if (parentComment.user !== username) {
                fetch(SELLER_API_URL + '/api/notification/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: parentComment.user_id || 0,
                        type: 'comment_reply',
                        title: '💬 Nouvelle réponse à votre commentaire',
                        content: `${username} a répondu à votre commentaire : "${text.substring(0, 30)}${text.length > 30 ? '...' : ''}"`
                    })
                }).catch(err => console.warn('Erreur envoi notification réponse:', err));
            }

            replyTarget = null;
            replyingIndicator.style.display = 'none';
            commentInput.placeholder = 'Écrire un commentaire...';
        } else {
            // Nouveau commentaire
            const newComment = {
                id: ++commentIdCounter,
                user: username,
                user_id: 0,
                avatar: '👤',
                comment: text,
                date: new Date().toLocaleDateString('fr-FR'),
                likes: 0,
                liked_by: [],
                replies: []
            };
            productComments.push(newComment);
        }

        renderComments(productComments);
        commentInput.value = '';

        // Sauvegarder les commentaires
        saveComments(currentProductId, productComments);

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
    // EXPOSER openSlide GLOBALEMENT
    // ==========================================

    window.openSlide = openSlide;

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