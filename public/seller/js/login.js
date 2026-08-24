document.addEventListener('DOMContentLoaded', function() {

    console.log('✅ Login vendeur chargé');

    // ==========================================
    // RÉFÉRENCES
    // ==========================================

    const phoneInput = document.getElementById('phoneInput');
    const phoneStatus = document.getElementById('phoneStatus');
    const phoneWrapper = phoneInput.closest('.input-wrapper');

    const passwordInput = document.getElementById('passwordInput');
    const passwordStatus = document.getElementById('passwordStatus');
    const passwordWrapper = passwordInput.closest('.input-wrapper');

    const togglePassword = document.getElementById('togglePassword');
    const message = document.getElementById('message');

    let isLoggingIn = false;

    // ==========================================
    // FOCUS AUTO SUR LE TÉLÉPHONE
    // ==========================================

    setTimeout(() => {
        phoneInput.focus();
    }, 300);

    // ==========================================
    // TÉLÉPHONE
    // ==========================================

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

        checkAndLogin();
    });

    // ==========================================
    // PASSWORD (4 chiffres)
    // ==========================================

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

        checkAndLogin();
    });

    // ==========================================
    // TOGGLE PASSWORD
    // ==========================================

    togglePassword.addEventListener('click', function() {
        const icon = this.querySelector('i');
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            icon.className = 'fas fa-eye-slash';
        } else {
            passwordInput.type = 'password';
            icon.className = 'fas fa-eye';
        }
    });

    // ==========================================
    // VÉRIFICATION AUTOMATIQUE
    // ==========================================

    function checkAndLogin() {
        const phone = phoneInput.value.replace(/\D/g, '');
        const password = passwordInput.value;

        // Masquer le message précédent
        message.className = 'message';
        message.textContent = '';

        // Vérifier que les deux champs sont remplis et valides
        if (phone.length === 10 && password.length === 4 && !isLoggingIn) {
            login(phone, password);
        }
    }

    // ==========================================
    // CONNEXION
    // ==========================================

    async function login(phone, password) {
        if (isLoggingIn) return;
        isLoggingIn = true;

        console.log('🔐 Tentative de connexion vendeur:', phone);

        try {
            const res = await fetch('/api/seller/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: phone,
                    password: password
                })
            });

            const data = await res.json();

            if (data.success) {
                // ✅ Connexion réussie
                localStorage.setItem('sellerToken', data.token);
                localStorage.setItem('sellerId', data.seller.id);
                localStorage.setItem('sellerName', data.seller.name);
                localStorage.setItem('sellerPhone', data.seller.phone);
                localStorage.setItem('sellerStatus', data.seller.status);

                message.className = 'message success';
                message.textContent = '✅ Connexion réussie ! Redirection...';

                setTimeout(() => {
                    window.location.href = '/dashboard';
                }, 800);

            } else {
                // ❌ Erreur
                message.className = 'message error';
                message.textContent = '❌ ' + (data.error || 'Numéro ou code incorrect');

                // Réinitialiser le mot de passe
                passwordInput.value = '';
                passwordInput.dispatchEvent(new Event('input'));

                // Focus sur le téléphone
                setTimeout(() => {
                    phoneInput.focus();
                }, 300);

                isLoggingIn = false;
            }

        } catch (error) {
            console.error('Erreur connexion:', error);
            message.className = 'message error';
            message.textContent = '❌ Erreur de connexion au serveur.';

            passwordInput.value = '';
            passwordInput.dispatchEvent(new Event('input'));

            isLoggingIn = false;
        }
    }

    // ==========================================
    // KEYBOARD - ENTRÉE
    // ==========================================

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            const phone = phoneInput.value.replace(/\D/g, '');
            const password = passwordInput.value;

            if (phone.length === 10 && password.length === 4 && !isLoggingIn) {
                login(phone, password);
            }
        }
    });

    // ==========================================
    // INIT
    // ==========================================

    console.log('✅ Login vendeur prêt');

});