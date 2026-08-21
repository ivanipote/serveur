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

        const total = commande.total || 0;

        let productsHtml = '';
        if (panier.length > 0) {
            panier.forEach(p => {
                productsHtml += `
                    <div class="recap-item">
                        <span class="label">${p.name || 'Produit'} × ${p.quantity || 1}</span>
                        <span class="value">${((p.price || 0) * (p.quantity || 1)).toLocaleString()} FCFA</span>
                    </div>
                `;
            });
        } else {
            productsHtml = `
                <div class="recap-item">
                    <span class="label">Aucun produit</span>
                    <span class="value">-</span>
                </div>
            `;
        }

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
        `;

        recapContent.innerHTML = `
            ${clientInfo}
            <div style="margin-top:8px;padding-top:8px;border-top:1px solid #f0f2f5;">
                ${productsHtml}
            </div>
        `;

        totalAmount.textContent = total.toLocaleString() + ' FCFA';
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
        const phone = currentUser?.phone || localStorage.getItem('userPhone');

        if (!phone) {
            showError('📱 Numéro de téléphone manquant. Veuillez le renseigner dans votre profil.');
            return;
        }

        const amount = commandeData?.total || 0;

        if (amount <= 0) {
            showError('⚠️ Montant invalide.');
            return;
        }

        showLoading();

        try {
            // Vérifier si un paiement existe déjà
            const checkRes = await fetch(`${PAYMENT_API_URL}/api/payment/check/${commandeId}`);
            const checkData = await checkRes.json();

            if (checkData.success && checkData.data) {
                const existingCheckoutUrl = checkData.data.checkout_url;
                if (existingCheckoutUrl && existingCheckoutUrl !== 'null' && existingCheckoutUrl !== '') {
                    hideLoading();
                    window.open(existingCheckoutUrl, '_blank');
                    return;
                }
            }

            // Créer un nouveau paiement
            const res = await fetch(`${PAYMENT_API_URL}/api/payment/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    commandeId: parseInt(commandeId),
                    reference: commandeData?.reference || `NAT-${commandeId}`,
                    amount: amount,
                    phone: phone,
                    description: `Commande Nature+ #${commandeId}`
                })
            });

            const data = await res.json();

            if (res.ok && data.success && data.checkout_url) {
                hideLoading();
                window.open(data.checkout_url, '_blank');
            } else {
                hideLoading();
                showError('❌ ' + (data.error || 'Impossible de créer le paiement.'));
            }
        } catch (error) {
            console.error('Erreur paiement:', error);
            hideLoading();
            showError('❌ Erreur de connexion au serveur de paiement.');
        }
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