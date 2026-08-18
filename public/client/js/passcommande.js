document.addEventListener('DOMContentLoaded', function() {

    console.log('✅ passcommande.js chargé');

    // ==========================================
    // RÉFÉRENCES
    // ==========================================

    const userId = localStorage.getItem('userId');
    const recapItems = document.getElementById('recapItems');
    const subtotalEl = document.getElementById('subtotal');
    const footerSubtotal = document.getElementById('footerSubtotal');
    const footerLivraison = document.getElementById('footerLivraison');
    const footerTotal = document.getElementById('footerTotal');
    const confirmerBtn = document.getElementById('confirmerBtn');

    const gpsStatus = document.getElementById('gpsStatus');
    const gpsAdresse = document.getElementById('gpsAdresse');
    const gpsCommune = document.getElementById('gpsCommune');
    const distanceEstimee = document.getElementById('distanceEstimee');

    // Overlay message
    const messageOverlay = document.getElementById('messageOverlay');
    const messageIcon = document.getElementById('messageIcon');
    const messageTitle = document.getElementById('messageTitle');
    const messageText = document.getElementById('messageText');
    const messageBtn = document.getElementById('messageBtn');

    // Overlay confirmation
    const confirmOverlay = document.getElementById('confirmOverlay');

    // Overlay communes
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
                // Fallback localStorage
                const userId = localStorage.getItem('userId');
                if (userId) {
                    console.log('⚠️ Session perdue, fallback localStorage');
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
    // GÉOLOCALISATION
    // ==========================================

    function getLocation() {
        gpsStatus.textContent = '⏳ Détection GPS...';
        gpsStatus.className = 'gps-status';

        if (!navigator.geolocation) {
            gpsStatus.textContent = '⚠️ GPS non supporté';
            gpsStatus.className = 'gps-status error';
            document.getElementById('adresseBtn').click();
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async function(position) {
                userCoords = {
                    lat: position.coords.latitude,
                    lon: position.coords.longitude
                };
                gpsStatus.textContent = '📍 Position détectée';
                gpsStatus.className = 'gps-status success';
                await getAddressFromCoords(userCoords.lat, userCoords.lon);
            },
            function(error) {
                console.error('Erreur GPS:', error.message);
                gpsStatus.textContent = '❌ ' + error.message;
                gpsStatus.className = 'gps-status error';
                document.getElementById('adresseBtn').click();
            }
        );
    }

    async function getAddressFromCoords(lat, lon) {
        try {
            const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;
            const response = await fetch(url);
            const data = await response.json();

            if (data && data.address) {
                const addr = data.address;
                const commune = addr.city || addr.town || addr.village || addr.municipality || addr.county || '';
                gpsAdresse.value = data.display_name;
                gpsCommune.value = commune;
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
                const distance = (Math.random() * 5 + 0.5).toFixed(1);
                distanceEstimee.value = distance + ' km';
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
    // CONFIRMER
    // ==========================================

    confirmerBtn.addEventListener('click', async function() {
        let codeLogin, nom, telephone;

        if (optionActive === 'chezmoi') {
            codeLogin = getCodeFromBoxes('codeBoxesChezMoi');
            telephone = document.getElementById('telephone').value.trim();
            nom = document.getElementById('nomComplet').value.trim();
        } else {
            codeLogin = getCodeFromBoxes('codeBoxesAdresse');
            telephone = document.getElementById('telephoneAdresse').value.trim();
            nom = document.getElementById('nomCompletAdresse').value.trim();
        }

        if (!nom) nom = currentUser?.name || localStorage.getItem('userName') || '';

        // Vérification téléphone
        if (!telephone || telephone.length < 8 || telephone.length > 12 || !/^\d+$/.test(telephone)) {
            document.getElementById(optionActive === 'chezmoi' ? 'telephone' : 'telephoneAdresse').classList.add('error');
            showMessage('⚠️', 'Numéro invalide', 'Entrez un numéro valide (8-12 chiffres).');
            setTimeout(() => {
                document.getElementById(optionActive === 'chezmoi' ? 'telephone' : 'telephoneAdresse').classList.remove('error');
            }, 800);
            return;
        }

        if (!codeLogin || codeLogin.length !== 4 || !/^\d{4}$/.test(codeLogin)) {
            setCodeBoxesError(optionActive === 'chezmoi' ? 'codeBoxesChezMoi' : 'codeBoxesAdresse');
            showMessage('⚠️', 'Code invalide', 'Entrez 4 chiffres.');
            return;
        }

        if (!nom) {
            showMessage('⚠️', 'Champ manquant', 'Entrez votre nom.');
            return;
        }

        if (optionActive === 'adresse') {
            const quartier = document.getElementById('quartier').value.trim();
            const precision = document.getElementById('precision').value.trim();
            if (!quartier || !precision) {
                showMessage('⚠️', 'Champs manquants', 'Remplissez quartier et précision.');
                return;
            }
            if (!communeSelectionnee) {
                showMessage('⚠️', 'Commune manquante', 'Sélectionnez une commune.');
                return;
            }
        }

        const verifyResult = await verifyCode(codeLogin);
        if (!verifyResult.success) {
            setCodeBoxesError(optionActive === 'chezmoi' ? 'codeBoxesChezMoi' : 'codeBoxesAdresse');
            showMessage('❌', 'Code incorrect', 'Le code est incorrect.');
            return;
        }

        const commandeData = {
            panier: JSON.stringify(panier),
            total: sousTotal + fraisActuels,
            nom,
            telephone,
            codeLogin,
            option: optionActive,
            commune: optionActive === 'chezmoi' ? (communeSelectionnee ? communeSelectionnee.commune : gpsCommune.value) : (communeSelectionnee ? communeSelectionnee.commune : ''),
            fraisLivraison: fraisActuels,
            quartier: optionActive === 'adresse' ? document.getElementById('quartier').value.trim() : null,
            precision: optionActive === 'adresse' ? document.getElementById('precision').value.trim() : null,
            latitude: userCoords ? userCoords.lat : null,
            longitude: userCoords ? userCoords.lon : null
        };

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
                showMessage('❌', 'Erreur', data.error || 'Erreur');
                confirmOverlay.classList.remove('active');
                confirmerBtn.disabled = false;
            }
        } catch (error) {
            showMessage('❌', 'Erreur', 'Connexion au serveur.');
            confirmOverlay.classList.remove('active');
            confirmerBtn.disabled = false;
        }
    });

    // ==========================================
    // INIT
    // ==========================================

    (async function init() {
        try {
            console.log('🚀 Initialisation de passcommande...');
            const isAuth = await checkAuth();
            if (!isAuth) return;

            await loadPanier();
            setTimeout(getLocation, 1000);
            console.log('✅ Initialisation terminée');
        } catch (error) {
            console.error('❌ Erreur lors de l\'initialisation:', error);
        }
    })();

});