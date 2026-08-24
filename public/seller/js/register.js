document.addEventListener('DOMContentLoaded', function() {

    console.log('✅ Register vendeur chargé');

    // ==========================================
    // RÉFÉRENCES
    // ==========================================

    const phoneInput = document.getElementById('phoneInput');
    const phoneStatus = document.getElementById('phoneStatus');
    const phoneWrapper = phoneInput.closest('.input-wrapper');

    const nameInput = document.getElementById('nameInput');
    const nameStatus = document.getElementById('nameStatus');
    const nameWrapper = nameInput.closest('.input-wrapper');

    const emailInput = document.getElementById('emailInput');
    const emailStatus = document.getElementById('emailStatus');
    const emailWrapper = emailInput.closest('.input-wrapper');

    const passwordInput = document.getElementById('passwordInput');
    const passwordStatus = document.getElementById('passwordStatus');
    const passwordWrapper = passwordInput.closest('.input-wrapper');

    const confirmInput = document.getElementById('confirmInput');
    const confirmStatus = document.getElementById('confirmStatus');
    const confirmWrapper = confirmInput.closest('.input-wrapper');

    const registerBtn = document.getElementById('registerBtn');
    const message = document.getElementById('message');

    // ==========================================
    // VALIDATION EN TEMPS RÉEL
    // ==========================================

    // ----- TÉLÉPHONE -----
    phoneInput.addEventListener('input', function() {
        const val = this.value.replace(/\D/g, '');
        this.value = val;

        if (val.length === 10) {
            phoneStatus.textContent = '✓';
            phoneStatus.className = 'input-status visible valid';
            phoneWrapper.classList.remove('invalid');
            phoneWrapper.classList.add('valid');
        } else if (val.length > 0 && val.length < 10) {
            phoneStatus.textContent = '✗';
            phoneStatus.className = 'input-status visible invalid';
            phoneWrapper.classList.remove('valid');
            phoneWrapper.classList.add('invalid');
        } else {
            phoneStatus.className = 'input-status';
            phoneWrapper.classList.remove('valid', 'invalid');
        }
        checkAllValid();
    });

    // ----- NOM -----
    nameInput.addEventListener('input', function() {
        const val = this.value.trim();
        if (val.length >= 2) {
            nameStatus.textContent = '✓';
            nameStatus.className = 'input-status visible valid';
            nameWrapper.classList.remove('invalid');
            nameWrapper.classList.add('valid');
        } else if (val.length > 0 && val.length < 2) {
            nameStatus.textContent = '✗';
            nameStatus.className = 'input-status visible invalid';
            nameWrapper.classList.remove('valid');
            nameWrapper.classList.add('invalid');
        } else {
            nameStatus.className = 'input-status';
            nameWrapper.classList.remove('valid', 'invalid');
        }
        checkAllValid();
    });

    // ----- EMAIL (optionnel) -----
    emailInput.addEventListener('input', function() {
        const val = this.value.trim();
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (val === '') {
            emailStatus.className = 'input-status';
            emailWrapper.classList.remove('valid', 'invalid');
            checkAllValid();
            return;
        }

        if (regex.test(val)) {
            emailStatus.textContent = '✓';
            emailStatus.className = 'input-status visible valid';
            emailWrapper.classList.remove('invalid');
            emailWrapper.classList.add('valid');
        } else {
            emailStatus.textContent = '✗';
            emailStatus.className = 'input-status visible invalid';
            emailWrapper.classList.remove('valid');
            emailWrapper.classList.add('invalid');
        }
        checkAllValid();
    });

    // ----- MOT DE PASSE -----
    passwordInput.addEventListener('input', function() {
        const val = this.value.replace(/\D/g, '');
        this.value = val;

        if (val.length === 4) {
            passwordStatus.textContent = '✓';
            passwordStatus.className = 'input-status visible valid';
            passwordWrapper.classList.remove('invalid');
            passwordWrapper.classList.add('valid');
        } else if (val.length > 0 && val.length < 4) {
            passwordStatus.textContent = '✗';
            passwordStatus.className = 'input-status visible invalid';
            passwordWrapper.classList.remove('valid');
            passwordWrapper.classList.add('invalid');
        } else {
            passwordStatus.className = 'input-status';
            passwordWrapper.classList.remove('valid', 'invalid');
        }
        checkPasswordMatch();
        checkAllValid();
    });

    // ----- CONFIRMATION -----
    confirmInput.addEventListener('input', function() {
        const val = this.value.replace(/\D/g, '');
        this.value = val;

        if (val.length === 4) {
            confirmStatus.textContent = '✓';
            confirmStatus.className = 'input-status visible valid';
            confirmWrapper.classList.remove('invalid');
            confirmWrapper.classList.add('valid');
        } else if (val.length > 0 && val.length < 4) {
            confirmStatus.textContent = '✗';
            confirmStatus.className = 'input-status visible invalid';
            confirmWrapper.classList.remove('valid');
            confirmWrapper.classList.add('invalid');
        } else {
            confirmStatus.className = 'input-status';
            confirmWrapper.classList.remove('valid', 'invalid');
        }
        checkPasswordMatch();
        checkAllValid();
    });

    // ==========================================
    // VÉRIFICATION MOT DE PASSE
    // ==========================================

    function checkPasswordMatch() {
        const pwd = passwordInput.value;
        const confirm = confirmInput.value;

        if (pwd.length === 4 && confirm.length === 4) {
            if (pwd === confirm) {
                // Match ✅
                passwordWrapper.classList.add('valid');
                confirmWrapper.classList.add('valid');
                passwordStatus.textContent = '✓';
                passwordStatus.className = 'input-status visible valid';
                confirmStatus.textContent = '✓';
                confirmStatus.className = 'input-status visible valid';
            } else {
                // Pas match ❌
                passwordWrapper.classList.remove('valid');
                passwordWrapper.classList.add('invalid');
                confirmWrapper.classList.remove('valid');
                confirmWrapper.classList.add('invalid');
                passwordStatus.textContent = '✗';
                passwordStatus.className = 'input-status visible invalid';
                confirmStatus.textContent = '✗';
                confirmStatus.className = 'input-status visible invalid';
            }
        }
    }

    // ==========================================
    // VALIDATION GLOBALE
    // ==========================================

    function checkAllValid() {
        const phone = phoneInput.value;
        const name = nameInput.value.trim();
        const email = emailInput.value.trim();
        const pwd = passwordInput.value;
        const confirm = confirmInput.value;

        const isPhoneValid = phone.length === 10;
        const isNameValid = name.length >= 2;
        const isEmailValid = email === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        const isPasswordValid = pwd.length === 4 && confirm.length === 4 && pwd === confirm;

        const allValid = isPhoneValid && isNameValid && isEmailValid && isPasswordValid;

        if (allValid) {
            registerBtn.classList.add('active');
            registerBtn.disabled = false;
        } else {
            registerBtn.classList.remove('active');
            registerBtn.disabled = true;
        }
    }

    // ==========================================
    // SOUMISSION
    // ==========================================

    registerBtn.addEventListener('click', async function() {
        if (this.disabled) return;

        const name = nameInput.value.trim();
        const email = emailInput.value.trim() || null;
        const phone = phoneInput.value;
        const password = passwordInput.value;

        // Vérification finale
        if (!phone || phone.length !== 10) {
            showMessage('⚠️ Numéro de téléphone invalide (10 chiffres).', 'error');
            return;
        }

        if (!name || name.length < 2) {
            showMessage('⚠️ Veuillez entrer votre nom.', 'error');
            return;
        }

        if (password.length !== 4) {
            showMessage('⚠️ Le code doit être 4 chiffres.', 'error');
            return;
        }

        this.disabled = true;
        this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Création...';

        try {
            const res = await fetch('/api/seller/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: name,
                    email: email,
                    phone: phone,
                    password: password
                })
            });

            const data = await res.json();

            if (data.success) {
                showMessage('✅ Compte créé avec succès ! Redirection...', 'success');
                setTimeout(() => {
                    window.location.href = '/login';
                }, 1500);
            } else {
                showMessage('❌ ' + (data.error || 'Erreur lors de l\'inscription.'), 'error');
                this.disabled = false;
                this.innerHTML = '<i class="fas fa-user-plus"></i> Créer mon compte';
            }
        } catch (error) {
            console.error('Erreur:', error);
            showMessage('❌ Erreur de connexion au serveur.', 'error');
            this.disabled = false;
            this.innerHTML = '<i class="fas fa-user-plus"></i> Créer mon compte';
        }
    });

    function showMessage(text, type) {
        message.textContent = text;
        message.className = 'message ' + type;
    }

    // ==========================================
    // INIT
    // ==========================================

    console.log('✅ Register vendeur prêt');
});