document.addEventListener('DOMContentLoaded', function() {

    console.log('✅ Create Shop - Production');

    // ==========================================
    // RÉFÉRENCES
    // ==========================================

    const shopName = document.getElementById('shopName');
    const shopDescription = document.getElementById('shopDescription');
    const shopImage = document.getElementById('shopImage');
    const shopLocation = document.getElementById('shopLocation');
    const gpsInput = document.getElementById('gpsInput');
    const gpsStatus = document.getElementById('gpsStatus');
    const gpsBtn = document.getElementById('gpsBtn');
    const manualBtn = document.getElementById('manualBtn');
    const createBtn = document.getElementById('createBtn');
    const overlay = document.getElementById('overlay');
    const filePlaceholder = document.getElementById('filePlaceholder');
    const fileName = document.getElementById('fileName');

    let gpsMode = 'auto';
    let isGpsLoading = false;

    // ==========================================
    // IMAGE - Affichage nom fichier
    // ==========================================

    shopImage.addEventListener('change', function() {
        if (this.files && this.files[0]) {
            filePlaceholder.style.display = 'none';
            fileName.style.display = 'block';
            fileName.textContent = this.files[0].name;
        } else {
            filePlaceholder.style.display = 'block';
            fileName.style.display = 'none';
        }
    });

    // ==========================================
    // GPS - Obtenir la position
    // ==========================================

    gpsBtn.addEventListener('click', function() {
        if (isGpsLoading) return;

        if (!navigator.geolocation) {
            gpsStatus.textContent = '⚠️';
            gpsStatus.className = 'gps-status';
            gpsStatus.title = 'GPS non supporté';
            gpsInput.value = 'GPS non supporté par votre navigateur';
            return;
        }

        isGpsLoading = true;
        gpsStatus.textContent = '⏳';
        gpsStatus.className = 'gps-status loading';
        gpsInput.placeholder = 'Recherche de la position...';
        gpsInput.value = '';
        gpsBtn.disabled = true;
        manualBtn.disabled = true;

        navigator.geolocation.getCurrentPosition(
            function(position) {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                gpsInput.value = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
                gpsStatus.textContent = '✅';
                gpsStatus.className = 'gps-status success';
                gpsStatus.title = 'Position trouvée';
                gpsBtn.disabled = false;
                manualBtn.disabled = false;
                isGpsLoading = false;
                gpsMode = 'auto';
                gpsBtn.classList.add('active');
                manualBtn.classList.remove('active');

                // Récupérer l'adresse via Nominatim
                fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18`)
                    .then(res => res.json())
                    .then(data => {
                        if (data && data.display_name) {
                            const addr = data.display_name;
                            if (shopLocation.value === '') {
                                shopLocation.value = addr;
                            }
                        }
                    })
                    .catch(() => {});
            },
            function(error) {
                gpsStatus.textContent = '❌';
                gpsStatus.className = 'gps-status';
                gpsStatus.title = 'Erreur: ' + error.message;
                gpsInput.placeholder = 'Erreur de localisation';
                gpsInput.value = '';
                gpsBtn.disabled = false;
                manualBtn.disabled = false;
                isGpsLoading = false;
            },
            {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 0
            }
        );
    });

    // ==========================================
    // MANUEL
    // ==========================================

    manualBtn.addEventListener('click', function() {
        gpsInput.placeholder = 'Entrez votre position manuellement...';
        gpsInput.value = '';
        gpsInput.focus();
        gpsStatus.textContent = '✏️';
        gpsStatus.className = 'gps-status';
        gpsMode = 'manual';
        manualBtn.classList.add('active');
        gpsBtn.classList.remove('active');
    });

    // ==========================================
    // CRÉER LA BOUTIQUE
    // ==========================================

    createBtn.addEventListener('click', function() {
        const name = shopName.value.trim();
        const description = shopDescription.value.trim();
        const location = shopLocation.value.trim();
        const gps = gpsInput.value.trim();
        const image = shopImage.files && shopImage.files[0] ? shopImage.files[0].name : '';

        if (!name) {
            shopName.focus();
            shopName.style.borderColor = '#e74c3c';
            setTimeout(() => shopName.style.borderColor = '', 1500);
            return;
        }

        if (!location) {
            shopLocation.focus();
            shopLocation.style.borderColor = '#e74c3c';
            setTimeout(() => shopLocation.style.borderColor = '', 1500);
            return;
        }

        overlay.classList.add('active');

        const shops = JSON.parse(localStorage.getItem('sellerShops') || '[]');

        const newShop = {
            id: Date.now(),
            name: name,
            description: description || '',
            location: location,
            image: image || '',
            gps: gps || '',
            articles: 0,
            messages: 0,
            likes: 0,
            created_at: new Date().toISOString()
        };

        shops.push(newShop);
        localStorage.setItem('sellerShops', JSON.stringify(shops));

        setTimeout(function() {
            window.location.href = '/seller/shop.html?id=' + newShop.id;
        }, 1200);
    });

    // ==========================================
    // ENTRÉE - Soumettre
    // ==========================================

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            const active = document.activeElement;
            if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
                createBtn.click();
            }
        }
    });

    console.log('✅ Create Shop - Production prêt');

});