document.addEventListener('DOMContentLoaded', function() {

    console.log('✅ paywithwave.js chargé');

    // ==========================================
    // RÉFÉRENCES
    // ==========================================

    const recapContent = document.getElementById('recapContent');
    const totalAmount = document.getElementById('totalAmount');
    const payBtn = document.getElementById('payWaveBtn');
    const errorMessage = document.getElementById('errorMessage');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const loaderOverlay = document.getElementById('loaderOverlay');

    // Onglets
    const ongletPayer = document.getElementById('ongletPayer');
    const ongletVerifier = document.getElementById('ongletVerifier');
    const ongletBtns = document.querySelectorAll('.onglet');

    // Éléments onglet Vérifier
    const codeBoxesVerif = document.querySelectorAll('.code-box-verif');
    const waveIdInput = document.getElementById('waveIdInput');
    const verifyBtn = document.getElementById('verifyWaveBtn');
    const verifyStatus = document.getElementById('verificationStatus');
    const statusMessage = document.getElementById('statusMessage');
    const statusSpinner = document.getElementById('statusSpinner');
    const verifyErrorMsg = document.getElementById('verifyErrorMessage');

    // ✅ URL CORRECTE DU SERVEUR WAVE
    const WAVE_API_URL = 'https://server-wave-js.onrender.com';

    let commandeId = null;
    let commandeData = null;
    let currentUser = null;
    let isVerifying = false;

    // ==========================================
    // LOADER OVERLAY
    // ==========================================

    function showLoader() {
        if (loaderOverlay) loaderOverlay.classList.add('active');
    }

    function hideLoader() {
        if (loaderOverlay) loaderOverlay.classList.remove('active');
    }

    // ==========================================
    // CODE BOXES - PAYER
    // ==========================================

    const payerCodeBoxes = document.querySelectorAll('#ongletPayer .code-box');

    payerCodeBoxes.forEach((box, index) => {
        box.addEventListener('input', function() {
            this.value = this.value.replace(/\D/g, '');
            if (this.value && /^\d$/.test(this.value)) {
                this.classList.add('filled');
                this.classList.remove('error');
                if (index < payerCodeBoxes.length - 1) {
                    payerCodeBoxes[index + 1].focus();
                }
            } else if (this.value === '') {
                this.classList.remove('filled');
            }
        });

        box.addEventListener('keydown', function(e) {
            if (e.key === 'Backspace' && this.value === '' && index > 0) {
                payerCodeBoxes[index - 1].focus();
                payerCodeBoxes[index - 1].value = '';
                payerCodeBoxes[index - 1].classList.remove('filled');
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
    // CODE BOXES - VÉRIFIER
    // ==========================================

    codeBoxesVerif.forEach((box, index) => {
        box.addEventListener('input', function() {
            this.value = this.value.replace(/\D/g, '');
            if (this.value && /^\d$/.test(this.value)) {
                this.classList.add('filled');
                this.classList.remove('error');
                if (index < codeBoxesVerif.length - 1) {
                    codeBoxesVerif[index + 1].focus();
                }
            } else if (this.value === '') {
                this.classList.remove('filled');
            }
            checkVerifyFields();
        });

        box.addEventListener('keydown', function(e) {
            if (e.key === 'Backspace' && this.value === '' && index > 0) {
                codeBoxesVerif[index - 1].focus();
                codeBoxesVerif[index - 1].value = '';
                codeBoxesVerif[index - 1].classList.remove('filled');
            }
            if (e.key === 'Backspace' && this.value !== '') {
                this.value = '';
                this.classList.remove('filled');
            }
            if (!/^[0-9]$/.test(e.key) && e.key !== 'Backspace' && e.key !== 'Tab' && e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Delete') {
                e.preventDefault();
            }
            checkVerifyFields();
        });

        box.addEventListener('focus', function() {
            this.select();
        });
    });

    // ==========================================
    // WAVE ID INPUT - VÉRIFIER
    // ==========================================

    waveIdInput.addEventListener('input', function() {
        this.value = this.value.trim();
        this.classList.remove('error');
        checkVerifyFields();
    });

    // ==========================================
    // VÉRIFIER LES CHAMPS
    // ==========================================

    function getCodeVerif() {
        let code = '';
        codeBoxesVerif.forEach(box => {
            code += box.value || '';
        });
        return code;
    }

    function checkVerifyFields() {
        const code = getCodeVerif();
        const waveId = waveIdInput.value.trim();

        if (code.length === 4 && /^\d{4}$/.test(code) && waveId.length >= 5) {
            verifyBtn.disabled = false;
            verifyBtn.title = '';
        } else {
            verifyBtn.disabled = true;
            verifyBtn.title = 'Remplissez tous les champs';
        }
    }

    // ==========================================
    // RÉCUPÉRER LE CODE LOGIN (PAYER)
    // ==========================================

    function getCodePayer() {
        let code = '';
        payerCodeBoxes.forEach(box => {
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

                const status = commande.status || 'en_attente';
                const statusMessages = {
                    'en_attente': {
                        html: `
                            <div style="text-align:center;padding:20px;color:#e67e22;">
                                <i class="fas fa-clock" style="font-size:28px;display:block;margin-bottom:8px;"></i>
                                Commande en attente de validation par l'admin.
                                <br><span style="font-size:13px;color:#888;">Veuillez patienter.</span>
                            </div>
                        `,
                        payDisabled: true
                    },
                    'accepter': { html: null, payDisabled: false },
                    'paiement_en_cours': {
                        html: `
                            <div style="text-align:center;padding:20px;color:#e67e22;">
                                <i class="fas fa-spinner fa-spin" style="font-size:28px;display:block;margin-bottom:8px;"></i>
                                Paiement déjà en cours...
                                <br><span style="font-size:13px;color:#888;">Vous avez déjà initié un paiement pour cette commande.</span>
                            </div>
                        `,
                        payDisabled: true
                    },
                    'verification_en_cours': {
                        html: `
                            <div style="text-align:center;padding:20px;color:#e67e22;">
                                <i class="fas fa-search" style="font-size:28px;display:block;margin-bottom:8px;"></i>
                                Vérification en cours...
                                <br><span style="font-size:13px;color:#888;">L'admin vérifie votre paiement Wave.</span>
                            </div>
                        `,
                        payDisabled: true
                    },
                    'paiement_effectue': {
                        html: `
                            <div style="text-align:center;padding:20px;color:#2d7d46;">
                                <i class="fas fa-check-circle" style="font-size:28px;display:block;margin-bottom:8px;"></i>
                                ✅ Commande déjà payée !
                                <br><span style="font-size:13px;color:#888;">Votre commande est en cours de préparation.</span>
                            </div>
                        `,
                        payDisabled: true
                    },
                    'livraison_en_cours': {
                        html: `
                            <div style="text-align:center;padding:20px;color:#0c5460;">
                                <i class="fas fa-truck" style="font-size:28px;display:block;margin-bottom:8px;"></i>
                                Commande en cours de livraison
                                <br><span style="font-size:13px;color:#888;">Votre commande est en route !</span>
                            </div>
                        `,
                        payDisabled: true
                    },
                    'disponible': {
                        html: `
                            <div style="text-align:center;padding:20px;color:#155724;">
                                <i class="fas fa-map-pin" style="font-size:28px;display:block;margin-bottom:8px;"></i>
                                Commande disponible
                                <br><span style="font-size:13px;color:#888;">Votre commande vous attend !</span>
                            </div>
                        `,
                        payDisabled: true
                    },
                    'recuperee': {
                        html: `
                            <div style="text-align:center;padding:20px;color:#1b5e20;">
                                <i class="fas fa-check-double" style="font-size:28px;display:block;margin-bottom:8px;"></i>
                                ✅ Commande récupérée
                                <br><span style="font-size:13px;color:#888;">Merci pour votre commande !</span>
                            </div>
                        `,
                        payDisabled: true
                    },
                    'refuse': {
                        html: `
                            <div style="text-align:center;padding:20px;color:#721c24;">
                                <i class="fas fa-times-circle" style="font-size:28px;display:block;margin-bottom:8px;"></i>
                                ❌ Commande refusée
                                <br><span style="font-size:13px;color:#888;">Motif : ${commande.cause_refus || 'Non précisé'}</span>
                            </div>
                        `,
                        payDisabled: true
                    },
                    'annulee': {
                        html: `
                            <div style="text-align:center;padding:20px;color:#721c24;">
                                <i class="fas fa-ban" style="font-size:28px;display:block;margin-bottom:8px;"></i>
                                ❌ Commande annulée
                                <br><span style="font-size:13px;color:#888;">${commande.cause_refus || 'Annulée par le client ou admin'}</span>
                            </div>
                        `,
                        payDisabled: true
                    }
                };

                const statusInfo = statusMessages[status] || statusMessages['en_attente'];

                if (statusInfo.html) {
                    recapContent.innerHTML = statusInfo.html;
                    payBtn.disabled = true;
                    ongletBtns.forEach(btn => {
                        if (btn.dataset.onglet === 'payer') {
                            btn.style.opacity = '0.5';
                            btn.style.cursor = 'not-allowed';
                            btn.disabled = true;
                        }
                    });
                    return;
                }

                commandeData = commande;
                renderRecap(commande);
                payBtn.disabled = false;

                await checkExistingVerification(commandeId);

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
    // VÉRIFIER SI UNE DEMANDE EXISTE DÉJÀ
    // ==========================================

    async function checkExistingVerification(commandeId) {
        try {
            const res = await fetch(`${WAVE_API_URL}/api/wave/status/${commandeId}`);
            const data = await res.json();

            if (data.success && data.has_request) {
                const v = data.verification;

                if (v.status === 'pending') {
                    showVerificationStatus('pending', '🔍 Vérification en cours... Attendez la confirmation de l\'admin.');
                    verifyBtn.disabled = true;
                    ongletBtns.forEach(btn => {
                        if (btn.dataset.onglet === 'verifier') {
                            btn.style.opacity = '1';
                            btn.style.cursor = 'pointer';
                            btn.disabled = false;
                        }
                    });
                } else if (v.status === 'success') {
                    showVerificationStatus('success', '✅ Paiement déjà vérifié avec succès !');
                    verifyBtn.disabled = true;
                } else if (v.status === 'refused') {
                    showVerificationStatus('error', `❌ Paiement refusé : ${v.cause || 'Motif non précisé'}`);
                    verifyBtn.disabled = true;
                }
            }
        } catch (error) {
            console.error('Erreur vérification existante:', error);
        }
    }

    // ==========================================
    // AFFICHER LE STATUT DE VÉRIFICATION
    // ==========================================

    function showVerificationStatus(type, message) {
        verifyStatus.style.display = 'block';
        verifyStatus.className = 'verification-status active';

        const content = verifyStatus.querySelector('.status-content');
        content.className = 'status-content ' + type;

        const icon = content.querySelector('i');
        const msg = content.querySelector('#statusMessage');

        if (type === 'pending') {
            icon.className = 'fas fa-spinner fa-spin';
            msg.textContent = message;
        } else if (type === 'success') {
            icon.className = 'fas fa-check-circle';
            msg.textContent = message;
        } else if (type === 'error') {
            icon.className = 'fas fa-times-circle';
            msg.textContent = message;
        }
    }

    function hideVerificationStatus() {
        verifyStatus.style.display = 'none';
        verifyStatus.className = 'verification-status';
    }

    // ==========================================
    // AFFICHER LE RÉCAPITULATIF (avec promo)
    // ==========================================

    function renderRecap(commande) {
        let panier = [];
        try {
            panier = JSON.parse(commande.panier || '[]');
        } catch (e) {
            panier = [];
        }

        let totalProduits = 0;
        let produitsHtml = '';

        if (panier.length > 0) {
            panier.forEach(p => {
                // ✅ CORRECTION : Utiliser effective_price comme dans passcommande
                const effectivePrice = p.effective_price || p.price || 0;
                const qte = p.quantity || 1;
                const totalLigne = effectivePrice * qte;
                totalProduits += totalLigne;

                const hasPromo = p.promo_price && p.promo_price > 0 && p.promo_price < p.price;

                let priceDisplay = `${totalLigne.toLocaleString()} FCFA`;
                if (hasPromo) {
                    const oldTotal = p.price * qte;
                    priceDisplay = `
                        <span style="color:#1a2a6c;font-weight:700;">${totalLigne.toLocaleString()} FCFA</span>
                        <span style="text-decoration:line-through;color:#aaa;font-size:13px;margin-left:6px;">${oldTotal.toLocaleString()} FCFA</span>
                    `;
                }

                produitsHtml += `
                    <div class="recap-item">
                        <span class="label">${p.name || 'Produit'} × ${qte}</span>
                        <span class="value">${priceDisplay}</span>
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

        const fraisLivraison = commande.frais_livraison || 0;
        const prixBrut = totalProduits + fraisLivraison;
        const fraisWave = prixBrut * 0.015;
        const fraisGeniusPay = 100 + (prixBrut * 0.01);
        const totalFrais = fraisWave + fraisGeniusPay;
        const montantWave = Math.ceil(prixBrut - totalFrais);

        commandeData.montantWave = montantWave;
        commandeData.prixBrut = prixBrut;

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

    function showError(message, target = 'payer') {
        const el = target === 'payer' ? errorMessage : verifyErrorMsg;
        el.textContent = message;
        el.className = 'error-message visible';
    }

    function hideError(target = 'payer') {
        const el = target === 'payer' ? errorMessage : verifyErrorMsg;
        el.className = 'error-message';
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

        const code = getCodePayer();

        if (code.length !== 4 || !/^\d{4}$/.test(code)) {
            payerCodeBoxes.forEach(box => box.classList.add('error'));
            showError('⚠️ Veuillez entrer un code à 4 chiffres.');
            setTimeout(() => {
                payerCodeBoxes.forEach(box => box.classList.remove('error'));
            }, 800);
            return;
        }

        const verifyResult = await verifyCode(code);

        if (!verifyResult.success) {
            payerCodeBoxes.forEach(box => box.classList.add('error'));
            showError('❌ Code incorrect. Veuillez réessayer.');
            setTimeout(() => {
                payerCodeBoxes.forEach(box => box.classList.remove('error'));
            }, 800);
            return;
        }

        const montantWave = commandeData?.montantWave || 0;

        if (montantWave <= 0) {
            showError('⚠️ Montant invalide.');
            return;
        }

        const waveLink = `https://pay.wave.com/m/M_ci_NaB9_UibLaUt/c/ci/?amount=${montantWave}`;

        showLoading();

        setTimeout(() => {
            hideLoading();
            window.open(waveLink, '_blank');
        }, 1500);
    });

    // ==========================================
    // VÉRIFIER LE PAIEMENT (AVEC REDIRECTION + LOADER)
    // ==========================================

    verifyBtn.addEventListener('click', async function() {
        if (isVerifying) return;
        hideError('verifier');

        const code = getCodeVerif();
        const waveId = waveIdInput.value.trim();

        if (code.length !== 4 || !/^\d{4}$/.test(code)) {
            codeBoxesVerif.forEach(box => box.classList.add('error'));
            showError('⚠️ Veuillez entrer un code à 4 chiffres.', 'verifier');
            setTimeout(() => {
                codeBoxesVerif.forEach(box => box.classList.remove('error'));
            }, 800);
            return;
        }

        if (waveId.length < 5) {
            waveIdInput.classList.add('error');
            showError('⚠️ Veuillez entrer un ID Wave valide.', 'verifier');
            setTimeout(() => {
                waveIdInput.classList.remove('error');
            }, 800);
            return;
        }

        const verifyResult = await verifyCode(code);

        if (!verifyResult.success) {
            codeBoxesVerif.forEach(box => box.classList.add('error'));
            showError('❌ Code incorrect. Veuillez réessayer.', 'verifier');
            setTimeout(() => {
                codeBoxesVerif.forEach(box => box.classList.remove('error'));
            }, 800);
            return;
        }

        isVerifying = true;
        verifyBtn.disabled = true;
        verifyBtn.classList.add('loading');
        verifyBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Envoi...';

        showLoader();

        try {
            const res = await fetch(`${WAVE_API_URL}/api/wave/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    commande_id: parseInt(commandeId),
                    code_login: code,
                    wave_id: waveId
                })
            });

            const data = await res.json();

            if (data.success) {
                window.location.href = `/detailcom?id=${commandeId}`;
            } else {
                hideLoader();
                showError('❌ ' + (data.error || 'Erreur lors de l\'envoi.'), 'verifier');
                verifyBtn.disabled = false;
                verifyBtn.classList.remove('loading');
                verifyBtn.innerHTML = '<i class="fas fa-search"></i> Vérifier mon paiement';
                isVerifying = false;
            }

        } catch (error) {
            console.error('Erreur envoi vérification:', error);
            hideLoader();
            showError('❌ Erreur de connexion au serveur.', 'verifier');
            verifyBtn.disabled = false;
            verifyBtn.classList.remove('loading');
            verifyBtn.innerHTML = '<i class="fas fa-search"></i> Vérifier mon paiement';
            isVerifying = false;
        }
    });

    // ==========================================
    // ONGLETS
    // ==========================================

    ongletBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            ongletBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');

            const target = this.dataset.onglet;

            if (target === 'payer') {
                ongletPayer.classList.add('active');
                ongletVerifier.classList.remove('active');
            } else {
                ongletPayer.classList.remove('active');
                ongletVerifier.classList.add('active');
            }
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