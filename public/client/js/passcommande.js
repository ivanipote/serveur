document.addEventListener('DOMContentLoaded', function() {

    console.log('✅ passcommande.js chargé');

    // ==========================================
    // RÉFÉRENCES
    // ==========================================

    const recapItems = document.getElementById('recapItems');
    const subtotalEl = document.getElementById('subtotal');
    const footerSubtotal = document.getElementById('footerSubtotal');
    const footerLivraison = document.getElementById('footerLivraison');
    const footerTotal = document.getElementById('footerTotal');
    const confirmerBtn = document.getElementById('confirmerBtn');

    const gpsStatus = document.getElementById('gpsStatus');
    const gpsAdresse = document.getElementById('gpsAdresse');
    const gpsCommune = document.getElementById('gpsCommune');
    const gpsQuartier = document.getElementById('gpsQuartier');
    const gpsRue = document.getElementById('gpsRue');
    const gpsAdresseAdresse = document.getElementById('gpsAdresseAdresse');
    const distanceEstimee = document.getElementById('distanceEstimee');

    // Overlays
    const positionOverlay = document.getElementById('positionOverlay');
    const positionMessage = document.getElementById('positionMessage');
    const retryPositionBtn = document.getElementById('retryPositionBtn');

    const recapOverlay = document.getElementById('recapOverlay');
    const recapDetail = document.getElementById('recapDetail');
    const recapCancelBtn = document.getElementById('recapCancelBtn');
    const recapConfirmBtn = document.getElementById('recapConfirmBtn');

    const messageOverlay = document.getElementById('messageOverlay');
    const messageIcon = document.getElementById('messageIcon');
    const messageTitle = document.getElementById('messageTitle');
    const messageText = document.getElementById('messageText');
    const messageBtn = document.getElementById('messageBtn');

    const confirmOverlay = document.getElementById('confirmOverlay');

    const communeOverlay = document.getElementById('communeOverlay');
    const communeList = document.getElementById('communeList');
    const communeBtn = document.getElementById('communeBtn');
    const communeSelected = document.getElementById('communeSelected');

    let panier = [];
    let sousTotal = 0;
    let fraisActuels = 0;
    let optionActive = 'chezmoi';
    let communeSelectionnee = null;
    let userCoords = null;
    let currentUser = null;
    let isGpsResolved = false;

    // Coordonnées de l'entreprise (point de départ)
    const ENTREPRISE_COORDS = {
        lat: 5.3720557,
        lon: -3.9561231
    };

    // ==========================================
    // VÉRIFICATION CONNEXION (via session)
    // ==========================================

    async function checkAuth() {
        try {
            const res = await fetch('/api/client/me');
            const data = await res.json();
            if (data.success) {
                currentUser = data.user;
                console.log('👤 Utilisateur connecté:', currentUser);
                return true;
            } else {
                const userId = localStorage.getItem('userId');
                if (userId) {
                    const userRes = await fetch(`/api/client/user/${userId}`);
                    const userData = await userRes.json();
                    if (userData.success) {
                        currentUser = userData.user;
                        return true;
                    }
                }
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
    // MESSAGE OVERLAY
    // ==========================================

    function showMessage(icon, title, text) {
        messageIcon.textContent = icon;
        messageTitle.textContent = title;
        messageText.textContent = text;
        messageOverlay.classList.add('active');
    }

    function hideMessage() {
        messageOverlay.classList.remove('active');
    }

    messageBtn.addEventListener('click', hideMessage);
    messageOverlay.addEventListener('click', function(e) {
        if (e.target === messageOverlay) hideMessage();
    });

    // ==========================================
    // TOGGLE CODE (Afficher/Masquer)
    // ==========================================

    document.querySelectorAll('.toggle-code-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const targetId = this.dataset.target;
            const container = document.getElementById(targetId);
            const boxes = container.querySelectorAll('.code-box');
            const icon = this.querySelector('i');

            if (boxes.length === 0) return;

            const isPassword = boxes[0].type === 'password';

            boxes.forEach(box => {
                box.type = isPassword ? 'text' : 'password';
            });

            icon.className = isPassword ? 'fas fa-eye-slash' : 'fas fa-eye';
        });
    });

    // ==========================================
    // CODE BOXES (4 cases)
    // ==========================================

    function initCodeBoxes(containerId) {
        const container = document.getElementById(containerId);
        const boxes = container.querySelectorAll('.code-box');

        boxes.forEach((box, index) => {
            box.style.color = '#1a1a2e';
            box.style.webkitTextFillColor = '#1a1a2e';

            box.addEventListener('input', function() {
                this.value = this.value.replace(/\D/g, '');
                if (this.value && /^\d$/.test(this.value)) {
                    this.classList.add('filled');
                    this.classList.remove('error');
                    if (index < boxes.length - 1) {
                        boxes[index + 1].focus();
                    }
                } else if (this.value === '') {
                    this.classList.remove('filled');
                }
            });

            box.addEventListener('keydown', function(e) {
                if (e.key === 'Backspace' && this.value === '' && index > 0) {
                    boxes[index - 1].focus();
                    boxes[index - 1].value = '';
                    boxes[index - 1].classList.remove('filled');
                }
                if (e.key === 'Backspace' && this.value !== '') {
                    this.value = '';
                    this.classList.remove('filled');
                }
                if (!/^[0-9]$/.test(e.key) && e.key !== 'Backspace' && e.key !== 'Tab' && e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Delete') {
                    e.preventDefault();
                }
            });

            box.addEventListener('focus', function() {
                this.select();
            });
        });
    }

    function getCodeFromBoxes(containerId) {
        const container = document.getElementById(containerId);
        const boxes = container.querySelectorAll('.code-box');
        let code = '';
        boxes.forEach(box => {
            code += box.value || '';
        });
        return code;
    }

    function setCodeBoxesError(containerId) {
        const container = document.getElementById(containerId);
        const boxes = container.querySelectorAll('.code-box');
        boxes.forEach(box => {
            box.classList.add('error');
        });
        setTimeout(() => {
            boxes.forEach(box => {
                box.classList.remove('error');
            });
        }, 800);
    }

    initCodeBoxes('codeBoxesChezMoi');
    initCodeBoxes('codeBoxesAdresse');

    // ==========================================
    // CHARGER LE PANIER
    // ==========================================

    async function loadPanier() {
        try {
            const res = await fetch('/api/panier');
            const data = await res.json();

            if (data.success && data.panier.length > 0) {
                panier = data.panier;
                renderRecap();
            } else {
                recapItems.innerHTML = `<div class="recap-item"><span class="label">Votre panier est vide</span></div>`;
                confirmerBtn.disabled = true;
            }
        } catch (error) {
            console.error('Erreur:', error);
            recapItems.innerHTML = `<div class="recap-item"><span class="label">Erreur de chargement</span></div>`;
            confirmerBtn.disabled = true;
        }
    }

    function renderRecap() {
        sousTotal = panier.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        let html = '';
        panier.forEach(item => {
            html += `
                <div class="recap-item">
                    <span class="label">${item.name} × ${item.quantity}</span>
                    <span class="value">${(item.price * item.quantity).toLocaleString()} FCFA</span>
                </div>
            `;
        });
        recapItems.innerHTML = html;
        subtotalEl.textContent = sousTotal.toLocaleString() + ' FCFA';
        footerSubtotal.textContent = sousTotal.toLocaleString() + ' FCFA';
        updateFooter();
        confirmerBtn.disabled = false;
    }

    // ==========================================
    // PRÉ-REMPLISSAGE DES CHAMPS
    // ==========================================

    function prefillUserData() {
        if (!currentUser) return;

        const nom = currentUser.name || '';
        const telephone = currentUser.phone || '';

        document.getElementById('nomComplet').value = nom;
        document.getElementById('telephone').value = telephone;
        document.getElementById('nomCompletAdresse').value = nom;
        document.getElementById('telephoneAdresse').value = telephone;

        console.log('✅ Champs pré-remplis avec:', { nom, telephone });
    }

    // ==========================================
    // CALCUL DE LA DISTANCE (Haversine)
    // ==========================================

    function calculerDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Rayon de la Terre en km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    // ==========================================
    // GÉOLOCALISATION OBLIGATOIRE
    // ==========================================

    function showPositionOverlay(message) {
        positionMessage.textContent = message || 'Veuillez autoriser la géolocalisation...';
        retryPositionBtn.style.display = 'none';
        positionOverlay.classList.add('active');
    }

    function hidePositionOverlay() {
        positionOverlay.classList.remove('active');
    }

    function getLocation() {
        isGpsResolved = false;
        showPositionOverlay('📍 Demande de votre position...');

        if (!navigator.geolocation) {
            positionMessage.textContent = '⚠️ GPS non supporté par votre navigateur. Veuillez entrer votre adresse manuellement.';
            retryPositionBtn.style.display = 'block';
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async function(position) {
                userCoords = {
                    lat: position.coords.latitude,
                    lon: position.coords.longitude
                };
                isGpsResolved = true;

                positionMessage.textContent = '✅ Position détectée avec succès !';
                setTimeout(() => {
                    hidePositionOverlay();
                }, 500);

                await getAddressFromCoords(userCoords.lat, userCoords.lon);
                gpsStatus.textContent = '📍 Position détectée';
                gpsStatus.className = 'gps-status success';
            },
            function(error) {
                console.error('Erreur GPS:', error.message);
                positionMessage.textContent = '❌ ' + error.message + '. Veuillez réessayer ou entrer votre adresse manuellement.';
                retryPositionBtn.style.display = 'block';
                gpsStatus.textContent = '❌ Position non disponible';
                gpsStatus.className = 'gps-status error';
            }, {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 0
            }
        );
    }

    retryPositionBtn.addEventListener('click', function() {
        getLocation();
    });

    async function getAddressFromCoords(lat, lon) {
        try {
            const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;
            const response = await fetch(url);
            const data = await response.json();

            if (data && data.address) {
                const addr = data.address;
                const displayName = data.display_name || 'Adresse non trouvée';
                const commune = addr.city || addr.town || addr.village || addr.municipality || addr.county || '';
                const quartier = addr.neighbourhood || addr.suburb || addr.quarter || '';
                const rue = addr.road || addr.pedestrian || '';

                // Remplir les champs "Chez moi"
                gpsAdresse.value = displayName;
                gpsCommune.value = commune;
                gpsQuartier.value = quartier;
                gpsRue.value = rue;

                // Remplir les champs "Adresse"
                gpsAdresseAdresse.value = displayName;

                // Calculer la distance
                const distance = calculerDistance(
                    ENTREPRISE_COORDS.lat, ENTREPRISE_COORDS.lon,
                    lat, lon
                );
                distanceEstimee.value = distance.toFixed(2) + ' km';

                await getFraisByCommune(commune);
            }
        } catch (error) {
            console.error('Erreur géocodage:', error);
            gpsStatus.textContent = '❌ Erreur de géocodage';
            gpsStatus.className = 'gps-status error';
        }
    }

    // ==========================================
    // RÉCUPÉRER LES FRAIS PAR COMMUNE
    // ==========================================

    async function getFraisByCommune(communeName) {
        try {
            const res = await fetch('/api/livraison/communes');
            const data = await res.json();
            if (res.ok) {
                const found = data.find(c => c.commune.toLowerCase() === communeName.toLowerCase());
                if (found) {
                    communeSelectionnee = found;
                    communeSelected.textContent = found.commune + ' (' + found.tarif.toLocaleString() + ' FCFA)';
                    fraisActuels = found.tarif;
                } else {
                    fraisActuels = 500;
                }
                updateFooter();
            }
        } catch (error) {
            console.error('Erreur frais:', error);
        }
    }

    // ==========================================
    // OPTIONS
    // ==========================================

    document.querySelectorAll('#optionsLivraison button').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('#optionsLivraison button').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            optionActive = this.dataset.option;

            document.getElementById('formChezMoi').classList.toggle('active', optionActive === 'chezmoi');
            document.getElementById('formAdresse').classList.toggle('active', optionActive === 'adresse');

            if (optionActive === 'chezmoi' && !userCoords) {
                getLocation();
            }
            updateFooter();
        });
    });

    // ==========================================
    // OVERLAY COMMUNES
    // ==========================================

    async function loadCommunes() {
        try {
            const res = await fetch('/api/livraison/communes');
            const data = await res.json();
            if (res.ok && data.length > 0) {
                renderCommunes(data);
            } else {
                communeList.innerHTML = `<p style="text-align:center;color:#888;padding:20px;">Aucune commune configurée.</p>`;
            }
        } catch (error) {
            console.error('Erreur chargement communes:', error);
            communeList.innerHTML = `<p style="text-align:center;color:#e74c3c;padding:20px;">Erreur de chargement.</p>`;
        }
    }

    function renderCommunes(communes) {
        communeList.innerHTML = communes.map(c => `
            <div class="commune-item ${communeSelectionnee && communeSelectionnee.id === c.id ? 'selected' : ''}" 
                 data-id="${c.id}" data-name="${c.commune}" data-tarif="${c.tarif}">
                <span class="commune-name">${c.commune}</span>
                <span class="commune-price">${c.tarif.toLocaleString()} FCFA</span>
            </div>
        `).join('');

        communeList.querySelectorAll('.commune-item').forEach(item => {
            item.addEventListener('click', function() {
                const id = parseInt(this.dataset.id);
                const name = this.dataset.name;
                const tarif = parseInt(this.dataset.tarif);
                communeSelectionnee = { id, commune: name, tarif };
                communeSelected.textContent = name + ' (' + tarif.toLocaleString() + ' FCFA)';
                fraisActuels = tarif;
                updateFooter();
                communeOverlay.classList.remove('active');
            });
        });
    }

    communeBtn.addEventListener('click', function() {
        loadCommunes();
        communeOverlay.classList.add('active');
    });

    document.getElementById('closeCommuneOverlay').addEventListener('click', function() {
        communeOverlay.classList.remove('active');
    });

    communeOverlay.addEventListener('click', function(e) {
        if (e.target === communeOverlay) communeOverlay.classList.remove('active');
    });

    // ==========================================
    // FOOTER
    // ==========================================

    function updateFooter() {
        const total = sousTotal + fraisActuels;
        footerLivraison.textContent = fraisActuels.toLocaleString() + ' FCFA';
        footerTotal.textContent = total.toLocaleString() + ' FCFA';
    }

    // ==========================================
    // OVERLAY RÉCAPITULATIF
    // ==========================================

    function showRecapOverlay() {
        const total = sousTotal + fraisActuels;
        const totalItems = panier.reduce((sum, item) => sum + item.quantity, 0);

        const adresseComplete = optionActive === 'chezmoi' ?
            gpsAdresse.value :
            gpsAdresseAdresse.value;

        const commune = optionActive === 'chezmoi' ?
            gpsCommune.value :
            (communeSelectionnee ? communeSelectionnee.commune : 'Non précisée');

        const quartier = optionActive === 'chezmoi' ?
            gpsQuartier.value :
            (document.getElementById('lieuLivraison').value || 'Non précisé');

        const rue = optionActive === 'chezmoi' ?
            gpsRue.value :
            'Adresse saisie';

        let productsHtml = panier.map(item =>
            `<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #f0f2f5;font-size:14px;">
                <span>${item.name} × ${item.quantity}</span>
                <span style="font-weight:600;">${(item.price * item.quantity).toLocaleString()} FCFA</span>
            </div>`
        ).join('');

        recapDetail.innerHTML = `
            <div style="margin-bottom:12px;">
                <strong style="color:#1a1a2e;">📦 ${totalItems} article(s)</strong>
            </div>
            ${productsHtml}
            <div style="margin-top:12px;padding-top:10px;border-top:2px solid #e8ecf4;">
                <div style="display:flex;justify-content:space-between;font-size:15px;">
                    <span style="color:#888;">Sous-total</span>
                    <span style="font-weight:600;">${sousTotal.toLocaleString()} FCFA</span>
                </div>
                <div style="display:flex;justify-content:space-between;font-size:15px;margin-top:2px;">
                    <span style="color:#888;">Livraison</span>
                    <span style="font-weight:600;">${fraisActuels.toLocaleString()} FCFA</span>
                </div>
                <div style="display:flex;justify-content:space-between;font-size:20px;font-weight:700;margin-top:6px;padding-top:6px;border-top:2px solid #2d7d46;">
                    <span style="color:#1a1a2e;">TOTAL</span>
                    <span style="color:#2d7d46;">${total.toLocaleString()} FCFA</span>
                </div>
            </div>
            <div style="margin-top:12px;padding-top:10px;border-top:2px solid #e8ecf4;">
                <div style="font-size:14px;color:#555;">
                    <strong>📍 Adresse de livraison</strong>
                </div>
                <div style="font-size:13px;color:#888;margin-top:4px;line-height:1.6;">
                    ${adresseComplete || 'Non renseignée'}<br>
                    <strong>Commune :</strong> ${commune}<br>
                    <strong>Quartier / Lieu :</strong> ${quartier}<br>
                    <strong>Rue :</strong> ${rue}<br>
                    <strong>📏 Distance :</strong> ${distanceEstimee.value || 'Non calculée'}
                </div>
            </div>
            <div style="margin-top:8px;font-size:13px;color:#888;text-align:center;">
                📍 ${optionActive === 'chezmoi' ? 'Livraison à domicile' : 'Livraison à l\'adresse indiquée'}
            </div>
        `;

        recapOverlay.classList.add('active');
    }

    function hideRecapOverlay() {
        recapOverlay.classList.remove('active');
    }

    recapCancelBtn.addEventListener('click', hideRecapOverlay);

    recapOverlay.addEventListener('click', function(e) {
        if (e.target === recapOverlay) hideRecapOverlay();
    });

    // ==========================================
    // VÉRIFICATION CODE
    // ==========================================

    async function verifyCode(code) {
        try {
            const res = await fetch('/api/client/verify-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code })
            });
            return await res.json();
        } catch (error) {
            return { success: false, error: 'Erreur de connexion' };
        }
    }

    // ==========================================
    // CONFIRMER (Affiche le récapitulatif)
    // ==========================================

    confirmerBtn.addEventListener('click', function() {
        // Vérifier que le GPS est résolu pour l'option "Chez moi"
        if (optionActive === 'chezmoi' && !isGpsResolved) {
            showMessage('⚠️', 'Position requise', 'Veuillez autoriser la géolocalisation pour la livraison à domicile.');
            getLocation();
            return;
        }

        // Vérifier les champs pour l'option "Adresse"
        if (optionActive === 'adresse') {
            const lieu = document.getElementById('lieuLivraison').value.trim();
            if (!lieu) {
                showMessage('⚠️', 'Champ manquant', 'Veuillez préciser le lieu de livraison.');
                document.getElementById('lieuLivraison').focus();
                return;
            }
            if (!communeSelectionnee) {
                showMessage('⚠️', 'Commune manquante', 'Veuillez sélectionner une commune.');
                return;
            }
        }

        // Vérifier le code secret
        const codeContainer = optionActive === 'chezmoi' ? 'codeBoxesChezMoi' : 'codeBoxesAdresse';
        const codeLogin = getCodeFromBoxes(codeContainer);

        if (!codeLogin || codeLogin.length !== 4 || !/^\d{4}$/.test(codeLogin)) {
            setCodeBoxesError(codeContainer);
            showMessage('⚠️', 'Code invalide', 'Entrez 4 chiffres.');
            return;
        }

        // Vérifier le nom et téléphone
        const nom = optionActive === 'chezmoi' ? document.getElementById('nomComplet').value.trim() : document.getElementById('nomCompletAdresse').value.trim();
        const telephone = optionActive === 'chezmoi' ? document.getElementById('telephone').value.trim() : document.getElementById('telephoneAdresse').value.trim();

        if (!nom) {
            showMessage('⚠️', 'Champ manquant', 'Entrez votre nom.');
            return;
        }

        if (!telephone || telephone.length < 8 || telephone.length > 12 || !/^\d+$/.test(telephone)) {
            showMessage('⚠️', 'Numéro invalide', 'Entrez un numéro valide (8-12 chiffres).');
            return;
        }

        // Vérifier le code
        verifyCode(codeLogin).then(result => {
            if (!result.success) {
                setCodeBoxesError(codeContainer);
                showMessage('❌', 'Code incorrect', 'Le code secret est incorrect.');
                return;
            }

            // Tout est bon → afficher le récapitulatif
            showRecapOverlay();
        });
    });

    // ==========================================
    // CONFIRMER LA COMMANDE (depuis le récapitulatif)
    // ==========================================

    recapConfirmBtn.addEventListener('click', async function() {
        hideRecapOverlay();

        const nom = optionActive === 'chezmoi' ? document.getElementById('nomComplet').value.trim() : document.getElementById('nomCompletAdresse').value.trim();
        const telephone = optionActive === 'chezmoi' ? document.getElementById('telephone').value.trim() : document.getElementById('telephoneAdresse').value.trim();
        const codeContainer = optionActive === 'chezmoi' ? 'codeBoxesChezMoi' : 'codeBoxesAdresse';
        const codeLogin = getCodeFromBoxes(codeContainer);

        let commune = '';
        let quartier = null;
        let precision = null;

        if (optionActive === 'chezmoi') {
            commune = communeSelectionnee ? communeSelectionnee.commune : gpsCommune.value;
            quartier = gpsQuartier.value || null;
            precision = 'Rue: ' + gpsRue.value + ' | Quartier: ' + gpsQuartier.value + ' | ' + gpsAdresse.value;
        } else {
            commune = communeSelectionnee ? communeSelectionnee.commune : '';
            quartier = document.getElementById('lieuLivraison').value.trim() || null;
            precision = 'Lieu précis: ' + quartier + ' | Adresse: ' + gpsAdresseAdresse.value;
        }

        const commandeData = {
            panier: JSON.stringify(panier),
            total: sousTotal + fraisActuels,
            nom,
            telephone,
            codeLogin,
            option: optionActive,
            commune: commune || '',
            fraisLivraison: fraisActuels,
            quartier: quartier || null,
            precision: precision || null,
            latitude: userCoords ? userCoords.lat : null,
            longitude: userCoords ? userCoords.lon : null
        };

        console.log('📦 Données de la commande:', commandeData);

        confirmOverlay.classList.add('active');
        confirmerBtn.disabled = true;

        try {
            const res = await fetch('/api/commande/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(commandeData)
            });

            const data = await res.json();
            if (data.success) {
                await fetch('/api/panier/clear', {
                    method: 'DELETE'
                });
                setTimeout(() => {
                    confirmOverlay.classList.remove('active');
                    window.location.href = '/mescommandes';
                }, 500);
            } else {
                showMessage('❌', 'Erreur', data.error || 'Erreur lors de la création de la commande.');
                confirmOverlay.classList.remove('active');
                confirmerBtn.disabled = false;
            }
        } catch (error) {
            showMessage('❌', 'Erreur', 'Connexion au serveur impossible.');
            confirmOverlay.classList.remove('active');
            confirmerBtn.disabled = false;
        }
    });

    // ==========================================
    // INITIALISATION
    // ==========================================

    (async function init() {
        try {
            console.log('🚀 Initialisation de passcommande...');
            const isAuth = await checkAuth();
            if (!isAuth) return;

            prefillUserData();
            await loadPanier();

            // Démarrer la géolocalisation automatiquement
            setTimeout(() => {
                getLocation();
            }, 1000);

            console.log('✅ Initialisation terminée');
        } catch (error) {
            console.error('❌ Erreur lors de l\'initialisation:', error);
        }
    })();

});