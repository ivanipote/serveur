document.addEventListener('DOMContentLoaded', function() {

    console.log('✅ Détail produit - Version finale');

    // ==========================================
    // RÉFÉRENCES
    // ==========================================

    const imageSlide = document.getElementById('imageSlide');
    const prevBtn = document.getElementById('prevImage');
    const nextBtn = document.getElementById('nextImage');
    const infoSlide = document.getElementById('infoSlide');
    const imagesSection = document.getElementById('imagesSection');

    const productName = document.getElementById('productName');
    const productPrice = document.getElementById('productPrice');
    const productStock = document.getElementById('productStock');
    const productCategory = document.getElementById('productCategory');
    const productDescription = document.getElementById('productDescription');
    const shopName = document.getElementById('shopName');
    const shopLink = document.getElementById('shopLink');

    const editBtn = document.getElementById('editBtn');
    const editSlide = document.getElementById('editSlide');
    const editCancel = document.getElementById('editCancel');
    const editConfirm = document.getElementById('editConfirm');
    const editName = document.getElementById('editName');
    const editPrice = document.getElementById('editPrice');
    const editStock = document.getElementById('editStock');

    // ==========================================
    // ÉTAT
    // ==========================================

    let currentImageIndex = 0;
    let images = [];
    let currentData = {};
    let productId = null;
    let shopId = null;

    // ==========================================
    // AUTH
    // ==========================================

    function getToken() {
        return localStorage.getItem('sellerToken');
    }

    function checkAuth() {
        const token = getToken();
        if (!token) {
            window.location.href = '/login';
            return false;
        }
        return true;
    }

    // ==========================================
    // CHARGER LES DONNÉES DU PRODUIT
    // ==========================================

    async function loadProduct() {
        const urlParams = new URLSearchParams(window.location.search);
        productId = urlParams.get('id');

        console.log('🔍 ID produit recherché:', productId);

        if (!productId) {
            showError('ID de produit manquant');
            return;
        }

        const token = getToken();
        if (!token) return;

        try {
            console.log('📥 Chargement du produit #' + productId);

            // Récupérer toutes les boutiques du vendeur
            const shopRes = await fetch('/api/seller/shops', {
                headers: {
                    'Authorization': 'Bearer ' + token
                }
            });
            const shopData = await shopRes.json();

            console.log('📦 Boutiques reçues:', shopData);

            if (!shopRes.ok) {
                throw new Error(shopData.error || 'Erreur chargement boutique');
            }

            if (shopData.success && shopData.shops && shopData.shops.length > 0) {
                // Prendre la première boutique
                const shop = shopData.shops[0];
                shopId = shop.id;

                console.log('🏪 Boutique sélectionnée:', shop);

                // Récupérer les produits de cette boutique
                const productsRes = await fetch('/api/seller/products/' + shopId, {
                    headers: {
                        'Authorization': 'Bearer ' + token
                    }
                });
                const productsData = await productsRes.json();

                console.log('📦 Produits reçus:', productsData);

                if (!productsRes.ok) {
                    throw new Error(productsData.error || 'Erreur chargement produits');
                }

                const products = productsData.products || [];

                console.log('🔍 Recherche du produit #' + productId + ' parmi ' + products.length + ' produits');

                // Trouver le produit (comparer en string car l'ID peut être number ou string)
                const product = products.find(p => String(p.id) === String(productId));

                if (!product) {
                    console.error('❌ Produit non trouvé. IDs disponibles:', products.map(p => p.id));
                    showError('Produit non trouvé');
                    return;
                }

                console.log('✅ Produit trouvé:', product);

                renderProduct(product, shop);
            } else {
                showError('Aucune boutique trouvée');
            }

        } catch (error) {
            console.error('❌ Erreur:', error);
            showError(error.message || 'Erreur de chargement');
        }
    }

    // ==========================================
    // AFFICHER LE PRODUIT
    // ==========================================

    function renderProduct(product, shop) {
        console.log('🎨 Rendu du produit:', product);

        currentData = { ...product };

        // Infos produit
        productName.textContent = product.name;
        productPrice.textContent = product.price.toLocaleString() + ' FCFA';
        productCategory.textContent = '🏷️ ' + (product.category || 'Non catégorisé');
        productDescription.textContent = product.description || 'Aucune description';

        // Stock
        const stock = product.stock || 0;
        let stockLabel = '📦 ' + stock + ' en stock';
        let stockClass = '';
        if (stock === 0) {
            stockClass = 'out';
            stockLabel = '🚫 Rupture de stock';
        } else if (stock <= 5) {
            stockClass = 'low';
            stockLabel = '⚠️ ' + stock + ' restant(s)';
        }
        productStock.textContent = stockLabel;
        productStock.className = 'stock ' + stockClass;

        // Boutique
        if (shop) {
            shopName.textContent = shop.name;
            shopLink.href = '/shop?id=' + shop.id;
        } else {
            shopName.textContent = 'Boutique non trouvée';
            shopLink.style.display = 'none';
        }

        // ✅ Images - vérifier toutes les colonnes possibles
        images = [];
        if (product.image1) images.push(product.image1);
        if (product.image2) images.push(product.image2);
        if (product.image3) images.push(product.image3);

        // Fallback : image unique (ancienne méthode)
        if (images.length === 0 && product.image) {
            images.push(product.image);
        }

        console.log('🖼️ Images trouvées:', images);

        renderImages();

        // Pré-remplir le slide de modification
        editName.value = product.name;
        editPrice.value = product.price;
        editStock.value = product.stock || 0;
    }

    // ==========================================
    // AFFICHAGE DES IMAGES
    // ==========================================

    function renderImages() {
        if (!images || images.length === 0) {
            imageSlide.innerHTML = `
                <div class="no-image">
                    <i class="fas fa-image"></i>
                </div>
            `;
            prevBtn.classList.add('hidden');
            nextBtn.classList.add('hidden');
            infoSlide.style.setProperty('--slide-bg-image', 'none');
            return;
        }

        const total = images.length;

        imageSlide.innerHTML = images.map(img => `
            <img src="${img}" alt="Image produit" loading="lazy" />
        `).join('');

        currentImageIndex = 0;
        updateCarousel();
    }

    function updateCarousel() {
        const total = images.length;

        if (total === 0) {
            prevBtn.classList.add('hidden');
            nextBtn.classList.add('hidden');
            infoSlide.style.setProperty('--slide-bg-image', 'none');
            return;
        }

        const offset = -currentImageIndex * 100;
        imageSlide.style.transform = `translateX(${offset}%)`;

        prevBtn.classList.toggle('hidden', currentImageIndex === 0);
        nextBtn.classList.toggle('hidden', currentImageIndex === total - 1);

        const currentImage = images[currentImageIndex];
        if (currentImage) {
            infoSlide.style.setProperty('--slide-bg-image', `url(${currentImage})`);
        }
    }

    function nextImage() {
        const total = images.length;
        if (currentImageIndex < total - 1) {
            currentImageIndex++;
            updateCarousel();
        }
    }

    function prevImage() {
        if (currentImageIndex > 0) {
            currentImageIndex--;
            updateCarousel();
        }
    }

    prevBtn.addEventListener('click', prevImage);
    nextBtn.addEventListener('click', nextImage);

    // ==========================================
    // ERREUR
    // ==========================================

    function showError(message) {
        console.error('❌ Erreur affichée:', message);
        productName.textContent = 'Erreur';
        productPrice.textContent = '0 FCFA';
        productStock.textContent = '⚠️ ' + message;
        productDescription.textContent = 'Impossible de charger le produit.';
        shopName.textContent = '-';
        shopLink.style.display = 'none';
        imageSlide.innerHTML = `
            <div class="no-image">
                <i class="fas fa-exclamation-circle"></i>
            </div>
        `;
    }

    // ==========================================
    // SLIDE MODIFICATION
    // ==========================================

    function openEditSlide() {
        editName.value = currentData.name || '';
        editPrice.value = currentData.price || '';
        editStock.value = currentData.stock || 0;

        editSlide.classList.add('active');
        imagesSection.classList.add('dimmed');
        infoSlide.classList.add('dimmed');
        document.body.style.overflow = 'hidden';
    }

    function closeEditSlide() {
        editSlide.classList.remove('active');
        imagesSection.classList.remove('dimmed');
        infoSlide.classList.remove('dimmed');
        document.body.style.overflow = '';
    }

    editBtn.addEventListener('click', openEditSlide);
    editCancel.addEventListener('click', closeEditSlide);

    editSlide.addEventListener('click', function(e) {
        if (e.target === editSlide) {
            closeEditSlide();
        }
    });

    // ==========================================
    // CONFIRMER MODIFICATION
    // ==========================================

    editConfirm.addEventListener('click', async function() {
        const name = editName.value.trim();
        const price = parseInt(editPrice.value);
        const stock = parseInt(editStock.value) || 0;

        if (!name) {
            alert('⚠️ Veuillez entrer un nom de produit.');
            editName.focus();
            return;
        }

        if (!price || price <= 0) {
            alert('⚠️ Veuillez entrer un prix valide.');
            editPrice.focus();
            return;
        }

        const token = getToken();
        if (!token) return;

        editConfirm.disabled = true;
        editConfirm.textContent = '⏳ Enregistrement...';

        try {
            const response = await fetch('/api/seller/product/' + productId, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                },
                body: JSON.stringify({
                    name: name,
                    price: price,
                    stock: stock,
                    description: currentData.description || null,
                    category: currentData.category || null,
                    image: currentData.image1 || currentData.image || null,
                    shop_id: shopId
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                currentData.name = name;
                currentData.price = price;
                currentData.stock = stock;

                productName.textContent = name;
                productPrice.textContent = price.toLocaleString() + ' FCFA';

                let stockLabel = '📦 ' + stock + ' en stock';
                let stockClass = '';
                if (stock === 0) {
                    stockClass = 'out';
                    stockLabel = '🚫 Rupture de stock';
                } else if (stock <= 5) {
                    stockClass = 'low';
                    stockLabel = '⚠️ ' + stock + ' restant(s)';
                }
                productStock.textContent = stockLabel;
                productStock.className = 'stock ' + stockClass;

                closeEditSlide();
                alert('✅ Produit modifié avec succès !');
            } else {
                throw new Error(data.error || 'Erreur');
            }

        } catch (error) {
            console.error('❌ Erreur:', error);
            alert('❌ ' + error.message);
        }

        editConfirm.disabled = false;
        editConfirm.textContent = '✅ Confirmer';
    });

    // ==========================================
    // INITIALISATION
    // ==========================================

    if (!checkAuth()) return;

    (async function init() {
        await loadProduct();
        console.log('✅ Détail produit - Prêt');
    })();

});