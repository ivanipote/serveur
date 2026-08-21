document.addEventListener('DOMContentLoaded', function() {

    console.log('✅ paywithwave.js chargé');

    // ==========================================
    // RÉFÉRENCES
    // ==========================================

    const recapContent = document.getElementById('recapContent');
    const totalAmount = document.getElementById('totalAmount');
    const codeBoxes = document.querySelectorAll('.code-box');
    const payBtn = document.getElementById('payWaveBtn');
    const errorMessage = document.getElementById('errorMessage');
    const loadingOverlay = document.getElementById('loadingOverlay');

    const PAYMENT_API_URL = 'https://nature-plus-pay.onrender.com';

    let commandeId = null;
    let commandeData = null;
    let currentUser = null;

    // ==========================================
    // CODE BOXES - GESTION
    // ==========================================

    codeBoxes.forEach((box, index) => {
        box.addEventListener('input', function() {
            this.value = this.value.replace(/\D/g, '');
            if (this.value && /^\d$/.test(this.value)) {
                this.classList.add('filled');
                this.classList.remove('error');
                if (index < codeBoxes.length - 1) {
                    codeBoxes[index + 1].focus();
                }
            } else if (this.value === '') {
                this.classList.remove('filled');
            }
        });

        box.addEventListener('keydown', function(e) {
            if (e.key === 'Backspace' && this.value === '' && index > 0) {
                codeBoxes[index - 1].focus();
                codeBoxes[index - 1].value = '';
                codeBoxes[index - 1].classList.remove('filled');
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

    // ==========================================
    // RÉCUPÉRER LE CODE LOGIN
    // ==========================================

    function getCodeLogin() {
        let code = '';
        codeBoxes.forEach(box => {
            code += box.value || '';
        });
        return code;
    }

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
                return true;
            }
            window.location.href = '/login';
            return false;
        } catch (error) {
            window.location.href = '/login';
            return false;
        }
    }

    // ==========================================
    // RÉCUPÉRER LA COMMANDE
    // ==========================================

    async function loadCommande() {
        const urlParams = new URLSearchParams(window.location.search);
        commandeId = urlParams.get('id');

        if (!commandeId) {
            recapContent.innerHTML = `
                <div style="text-align:center;padding:20px;color:#e74c3c;">
                    <i class="fas fa-exclamation-circle" style="font-size:28px;display:block;margin-bottom:8px;"></i>
                    Commande non trouvée
                </div>
            `;
            payBtn.disabled = true;
            return;
        }

        try {
            const res = await fetch('/api/commandes');
            const data = await res.json();

            if (res.ok && data.length > 0) {
                const commande = data.find(c => c.id == commandeId);

                if (!commande) {
                    recapContent.innerHTML = `
                        <div style="text-align:center;padding:20px;color:#e74c3c;">
                            <i class="fas fa-exclamation-circle" style="font-size:28px;display:block;margin-bottom:8px;"></i>
                            Commande introuvable
                        </div>
                    `;
                    payBtn.disabled = true;
                    return;
                }

                // Vérifier que la commande appartient à l'utilisateur
                if (currentUser && commande.user_id !== currentUser.id) {
                    recapContent.innerHTML = `
                        <div style="text-align:center;padding:20px;color:#e74c3c;">
                            <i class="fas fa-exclamation-circle" style="font-size:28px;display:block;margin-bottom:8px;"></i>
                            Accès non autorisé
                        </div>
                    `;
                    payBtn.disabled = true;
                    return;
                }

                // Vérifier que la commande est en "paiement requis"
                if (commande.status !== 'accepter') {
                    recapContent.innerHTML = `
                        <div style="text-align:center;padding:20px;color:#e67e22;">
                            <i class="fas fa-info-circle" style="font-size:28px;display:block;margin-bottom:8px;"></i>
                            Cette commande n'est pas en attente de paiement.
                            <br><span style="font-size:13px;color:#888;">Statut actuel : ${commande.status}</span>
                        </div>
                    `;
                    payBtn.disabled = true;
                    return;
                }

                commandeData = commande;
                renderRecap(commande);
                payBtn.disabled = false;

            } else {
                recapContent.innerHTML = `
                    <div style="text-align:center;padding:20px;color:#e74c3c;">
                        <i class="fas fa-exclamation-circle" style="font-size:28px;display:block;margin-bottom:8px;"></i>
                        Erreur de chargement
                    </div>
                `;
                payBtn.disabled = true;
            }
        } catch (error) {
            console.error('Erreur chargement commande:', error);
            recapContent.innerHTML = `
                <div style="text-align:center;padding:20px;color:#e74c3c;">
                    <i class="fas fa-exclamation-circle" style="font-size:28px;display:block;margin-bottom:8px;"></i>
                    Erreur de connexion
                </div>
            `;
            payBtn.disabled = true;
        }
    }

    // ==========================================
    // AFFICHER LE RÉCAPITULATIF
    // ==========================================

    function renderRecap(commande) {
        let panier = [];
        try {
            panier = JSON.parse(commande.panier || '[]');
        } catch (e) {
            panier = [];
        }

        // Calculer le total des produits
        let totalProduits = 0;
        let produitsHtml = '';
        if (panier.length > 0) {
            panier.forEach(p => {
                const prix = p.price || 0;
                const qte = p.quantity || 1;
                const totalLigne = prix * qte;
                totalProduits += totalLigne;
                produitsHtml += `
                    <div class="recap-item">
                        <span class="label">${p.name || 'Produit'} × ${qte}</span>
                        <span class="value">${totalLigne.toLocaleString()} FCFA</span>
                    </div>
                `;
            });
        } else {
            produitsHtml = `
                <div class="recap-item">
                    <span class="label">Aucun produit</span>
                    <span class="value">-</span>
                </div>
            `;
        }

        // Récupérer les frais de livraison
        const fraisLivraison = commande.frais_livraison || 0;

        // Prix brut = total produits + frais livraison
        const prixBrut = totalProduits + fraisLivraison;

        // ✅ CALCUL DES FRAIS GENIUS PAY
        const fraisWave = prixBrut * 0.015;           // 1.5%
        const fraisGeniusPay = 100 + (prixBrut * 0.01); // 100 + 1%
        const totalFrais = fraisWave + fraisGeniusPay;

        // ✅ MONTANT QUE LE CLIENT PAIE SUR WAVE
        const montantWave = Math.ceil(prixBrut - totalFrais);

        // Stocker le montant Wave pour le lien
        commandeData.montantWave = montantWave;
        commandeData.prixBrut = prixBrut;

        // Affichage
        const clientInfo = `
            <div class="recap-item">
                <span class="label">👤 Client</span>
                <span class="value">${commande.nom || '-'}</span>
            </div>
            <div class="recap-item">
                <span class="label">📱 Téléphone</span>
                <span class="value">${commande.telephone || '-'}</span>
            </div>
            <div class="recap-item">
                <span class="label">📋 Référence</span>
                <span class="value" style="font-size:13px;color:#888;">${commande.reference || '-'}</span>
            </div>
            <div class="recap-item" style="border-bottom: 2px solid #1a2a6c; padding-bottom: 8px; margin-bottom: 4px;">
                <span class="label" style="font-weight:700;">📦 Total produits</span>
                <span class="value" style="font-weight:700;">${totalProduits.toLocaleString()} FCFA</span>
            </div>
            ${fraisLivraison > 0 ? `
                <div class="recap-item">
                    <span class="label">🚚 Frais de livraison</span>
                    <span class="value">${fraisLivraison.toLocaleString()} FCFA</span>
                </div>
            ` : ''}
            <div class="recap-item" style="border-bottom: 2px solid #f0f2f5; padding-bottom: 8px;">
                <span class="label" style="font-weight:700;">💰 Prix brut</span>
                <span class="value" style="font-weight:700;">${prixBrut.toLocaleString()} FCFA</span>
            </div>
            <div class="recap-item" style="color:#888; font-size:13px;">
                <span class="label">📉 Frais Wave (1.5%)</span>
                <span class="value" style="color:#888;">- ${fraisWave.toFixed(0)} FCFA</span>
            </div>
            <div class="recap-item" style="color:#888; font-size:13px;">
                <span class="label">📉 Frais GeniusPay (100+1%)</span>
                <span class="value" style="color:#888;">- ${fraisGeniusPay.toFixed(0)} FCFA</span>
            </div>
            <div class="recap-item" style="border-top: 2px solid #1a2a6c; padding-top: 8px; margin-top: 4px;">
                <span class="label" style="font-weight:700; color:#1a2a6c;">💳 Montant Wave</span>
                <span class="value" style="font-weight:700; color:#1a2a6c; font-size:20px;">${montantWave.toLocaleString()} FCFA</span>
            </div>
        `;

        recapContent.innerHTML = clientInfo;
        totalAmount.textContent = montantWave.toLocaleString() + ' FCFA';
    }

    // ==========================================
    // VÉRIFICATION DU CODE LOGIN
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
    // AFFICHER UNE ERREUR
    // ==========================================

    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.className = 'error-message visible';
    }

    function hideError() {
        errorMessage.className = 'error-message';
    }

    // ==========================================
    // AFFICHER LE LOADING
    // ==========================================

    function showLoading() {
        loadingOverlay.classList.add('active');
    }

    function hideLoading() {
        loadingOverlay.classList.remove('active');
    }

    // ==========================================
    // PAYER AVEC WAVE
    // ==========================================

    payBtn.addEventListener('click', async function() {
        hideError();

        const code = getCodeLogin();

        if (code.length !== 4 || !/^\d{4}$/.test(code)) {
            codeBoxes.forEach(box => box.classList.add('error'));
            showError('⚠️ Veuillez entrer un code à 4 chiffres.');
            setTimeout(() => {
                codeBoxes.forEach(box => box.classList.remove('error'));
            }, 800);
            return;
        }

        // Vérifier le code
        const verifyResult = await verifyCode(code);

        if (!verifyResult.success) {
            codeBoxes.forEach(box => box.classList.add('error'));
            showError('❌ Code incorrect. Veuillez réessayer.');
            setTimeout(() => {
                codeBoxes.forEach(box => box.classList.remove('error'));
            }, 800);
            return;
        }

        // Code valide → lancer le paiement
        const montantWave = commandeData?.montantWave || 0;

        if (montantWave <= 0) {
            showError('⚠️ Montant invalide.');
            return;
        }

        // ✅ CONSTRUIRE LE LIEN WAVE AVEC LE MONTANT CALCULÉ
        const waveLink = `https://pay.wave.com/m/M_ci_NaB9_UibLaUt/c/ci/?amount=${montantWave}`;

        showLoading();

        // Rediriger vers Wave après un court délai
        setTimeout(() => {
            hideLoading();
            window.open(waveLink, '_blank');
        }, 1500);
    });

    // ==========================================
    // ONGLETS (pour l'instant seul Payer est actif)
    // ==========================================

    document.querySelectorAll('.onglet').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.onglet').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
        });
    });

    // ==========================================
    // INITIALISATION
    // ==========================================

    (async function init() {
        console.log('🚀 Initialisation de paywithwave...');
        const isAuth = await checkAuth();
        if (!isAuth) return;

        await loadCommande();

        console.log('✅ paywithwave initialisé');
    })();

});