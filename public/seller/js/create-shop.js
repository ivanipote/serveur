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
    // VÉRIFICATION CONNEXION
    // ==========================================

    function checkAuth() {
        const token = localStorage.getItem('sellerToken');
        if (!token) {
            window.location.href = '/login';
            return false;
        }
        return true;
    }

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
    // CRÉER LA BOUTIQUE - VERSION PRODUCTION
    // ==========================================

    createBtn.addEventListener('click', async function() {
        const name = shopName.value.trim();
        const description = shopDescription.value.trim();
        const location = shopLocation.value.trim();
        const imageFile = shopImage.files[0];

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

        createBtn.disabled = true;
        createBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Création...';
        overlay.classList.add('active');

        try {
            const token = localStorage.getItem('sellerToken');

            const formData = new FormData();
            formData.append('name', name);
            formData.append('description', description || '');
            formData.append('location', location);
            if (imageFile) {
                formData.append('image', imageFile);
            }

            const response = await fetch('/api/seller/shop', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + token
                },
                body: formData
            });

            const data = await response.json();

            if (data.success) {
                setTimeout(function() {
                    window.location.href = '/shop?id=' + data.shopId;
                }, 1200);
            } else {
                overlay.classList.remove('active');
                createBtn.disabled = false;
                createBtn.innerHTML = '<i class="fas fa-rocket"></i> Créer la boutique';
                alert('❌ ' + (data.error || 'Erreur lors de la création.'));
            }

        } catch (error) {
            console.error('❌ Erreur création:', error);
            overlay.classList.remove('active');
            createBtn.disabled = false;
            createBtn.innerHTML = '<i class="fas fa-rocket"></i> Créer la boutique';
            alert('❌ Erreur de connexion au serveur.');
        }
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

    // ==========================================
    // INITIALISATION
    // ==========================================

    if (!checkAuth()) return;

    console.log('✅ Create Shop - Production prêt');

});