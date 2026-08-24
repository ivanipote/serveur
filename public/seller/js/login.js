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

    const numBtns = document.querySelectorAll('.num-btn');
    const clearBtn = document.getElementById('clearBtn');

    let phoneValue = '';
    let passwordValue = '';

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
        phoneValue = val;

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
        passwordValue = val;

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
    // PAVÉ NUMÉRIQUE
    // ==========================================

    numBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const value = this.dataset.value;

            if (this.classList.contains('btn-clear')) return;

            // Ajouter au champ actif (téléphone ou password)
            const activeElement = document.activeElement;

            if (activeElement === phoneInput) {
                if (phoneValue.length < 10) {
                    phoneValue += value;
                    phoneInput.value = phoneValue;
                    phoneInput.dispatchEvent(new Event('input'));
                }
            } else if (activeElement === passwordInput) {
                if (passwordValue.length < 4) {
                    passwordValue += value;
                    passwordInput.value = passwordValue;
                    passwordInput.dispatchEvent(new Event('input'));
                }
            } else {
                // Par défaut: si rien n'est focus, on met sur le téléphone
                if (phoneValue.length < 10) {
                    phoneValue += value;
                    phoneInput.value = phoneValue;
                    phoneInput.dispatchEvent(new Event('input'));
                }
            }
        });
    });

    // ==========================================
    // BOUTON EFFACER
    // ==========================================

    clearBtn.addEventListener('click', function() {
        const activeElement = document.activeElement;

        if (activeElement === phoneInput || activeElement === passwordInput) {
            if (activeElement === phoneInput && phoneValue.length > 0) {
                phoneValue = phoneValue.slice(0, -1);
                phoneInput.value = phoneValue;
                phoneInput.dispatchEvent(new Event('input'));
            } else if (activeElement === passwordInput && passwordValue.length > 0) {
                passwordValue = passwordValue.slice(0, -1);
                passwordInput.value = passwordValue;
                passwordInput.dispatchEvent(new Event('input'));
            }
        } else {
            // Par défaut: effacer le téléphone
            if (phoneValue.length > 0) {
                phoneValue = phoneValue.slice(0, -1);
                phoneInput.value = phoneValue;
                phoneInput.dispatchEvent(new Event('input'));
            }
        }
    });

    // ==========================================
    // CLIC SUR LE CHAMP → FOCUS
    // ==========================================

    phoneInput.addEventListener('focus', function() {
        this.select();
    });

    passwordInput.addEventListener('focus', function() {
        this.select();
    });

    // ==========================================
    // VÉRIFICATION AUTOMATIQUE
    // ==========================================

    function checkAndLogin() {
        const phone = phoneValue;
        const password = passwordValue;

        // Masquer le message précédent
        message.className = 'message';
        message.textContent = '';

        // Vérifier que les deux champs sont remplis
        if (phone.length === 10 && password.length === 4) {
            // Validation automatique → connexion
            login(phone, password);
        }
    }

    // ==========================================
    // CONNEXION
    // ==========================================

    async function login(phone, password) {
        console.log('🔐 Tentative de connexion vendeur:', phone);

        try {
            const res = await fetch('/api/seller/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: phone, // L'API utilise 'email' mais on envoie le téléphone
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
                passwordValue = '';
                passwordInput.value = '';
                passwordInput.dispatchEvent(new Event('input'));

                // Focus sur le téléphone
                setTimeout(() => {
                    phoneInput.focus();
                }, 300);
            }

        } catch (error) {
            console.error('Erreur connexion:', error);
            message.className = 'message error';
            message.textContent = '❌ Erreur de connexion au serveur.';

            passwordValue = '';
            passwordInput.value = '';
            passwordInput.dispatchEvent(new Event('input'));
        }
    }

    // ==========================================
    // KEYBOARD - ENTRÉE
    // ==========================================

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            const phone = phoneValue;
            const password = passwordValue;

            if (phone.length === 10 && password.length === 4) {
                login(phone, password);
            }
        }

        // Effacer avec Backspace
        if (e.key === 'Backspace') {
            const activeElement = document.activeElement;
            if (activeElement === phoneInput || activeElement === passwordInput) {
                // Laisse l'input gérer
                return;
            }
            // Sinon, effacer le champ actif
            clearBtn.click();
        }
    });

    // ==========================================
    // INIT
    // ==========================================

    console.log('✅ Login vendeur prêt');

});