document.addEventListener('DOMContentLoaded', function() {

    console.log('✅ Register vendeur chargé');

    // ==========================================
    // RÉFÉRENCES
    // ==========================================

    const phoneBoxes = document.getElementById('phoneBoxes');
    const phoneHidden = document.getElementById('phoneHidden');
    const phoneStatus = document.getElementById('phoneStatus');
    const phoneContainer = document.querySelector('.phone-container');

    const nameInput = document.getElementById('nameInput');
    const nameStatus = document.getElementById('nameStatus');
    const nameWrapper = nameInput.closest('.input-wrapper');

    const emailInput = document.getElementById('emailInput');
    const emailStatus = document.getElementById('emailStatus');
    const emailWrapper = emailInput.closest('.input-wrapper');

    const passwordBoxes = document.getElementById('passwordBoxes');
    const passwordHidden = document.getElementById('passwordHidden');
    const confirmBoxes = document.getElementById('confirmBoxes');
    const confirmHidden = document.getElementById('confirmHidden');
    const clearPwdBtn = document.getElementById('clearPwdBtn');
    const clearConfirmBtn = document.getElementById('clearConfirmBtn');

    const registerBtn = document.getElementById('registerBtn');
    const message = document.getElementById('message');

    const numBtns = document.querySelectorAll('.num-btn-pwd');

    const PHONE_LENGTH = 10;
    const CODE_LENGTH = 4;

    let phoneDigits = '';
    let passwordValue = '';
    let confirmValue = '';
    let isPasswordFocused = true;

    // ==========================================
    // TÉLÉPHONE
    // ==========================================

    // Créer les cases
    for (let i = 0; i < PHONE_LENGTH; i++) {
        const box = document.createElement('div');
        box.className = 'phone-box';
        box.dataset.index = i;
        phoneBoxes.appendChild(box);
    }
    const phoneBoxesElements = phoneBoxes.querySelectorAll('.phone-box');

    function updatePhone(value) {
        const digits = value.replace(/\D/g, '').slice(0, PHONE_LENGTH);
        phoneHidden.value = digits;
        phoneDigits = digits;

        phoneBoxesElements.forEach((box, index) => {
            const char = digits[index] || '';
            box.textContent = char;
            box.classList.toggle('filled', char !== '');
            box.classList.remove('active');
        });

        if (digits.length < PHONE_LENGTH) {
            phoneBoxesElements[digits.length].classList.add('active');
        }

        if (digits.length === PHONE_LENGTH) {
            phoneStatus.textContent = '✓';
            phoneStatus.className = 'input-status visible valid';
            phoneContainer.classList.remove('invalid');
            phoneContainer.classList.add('valid');
        } else if (digits.length > 0) {
            phoneStatus.textContent = '✗';
            phoneStatus.className = 'input-status visible invalid';
            phoneContainer.classList.remove('valid');
            phoneContainer.classList.add('invalid');
        } else {
            phoneStatus.className = 'input-status';
            phoneContainer.classList.remove('valid', 'invalid');
        }

        checkAllValid();
    }

    phoneHidden.addEventListener('input', function() {
        updatePhone(this.value);
    });

    phoneContainer.addEventListener('click', function() {
        phoneHidden.focus();
        phoneHidden.click();
    });

    phoneBoxes.addEventListener('click', function() {
        phoneHidden.focus();
        phoneHidden.click();
    });

    // ==========================================
    // NOM
    // ==========================================

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

    // ==========================================
    // EMAIL (optionnel)
    // ==========================================

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

    // ==========================================
    // CODE (4 chiffres)
    // ==========================================

    function createCodeBoxes(container, hidden, isPassword) {
        container.innerHTML = '';
        for (let i = 0; i < CODE_LENGTH; i++) {
            const box = document.createElement('div');
            box.className = 'password-box';
            box.dataset.index = i;
            container.appendChild(box);
        }
        const boxes = container.querySelectorAll('.password-box');

        function updateBoxes(value) {
            const digits = value.slice(0, CODE_LENGTH);
            hidden.value = digits;
            boxes.forEach((box, index) => {
                const char = digits[index] || '';
                box.textContent = char;
                box.classList.toggle('filled', char !== '');
                box.classList.remove('active');
            });
            if (digits.length < CODE_LENGTH) {
                boxes[digits.length].classList.add('active');
            }
            if (isPassword) {
                clearPwdBtn.style.display = digits.length > 0 ? 'block' : 'none';
            } else {
                clearConfirmBtn.style.display = digits.length > 0 ? 'block' : 'none';
            }
            checkPasswordMatch();
        }

        if (isPassword) {
            window.updatePasswordBoxes = updateBoxes;
            window.pwdBoxes = boxes;
            window.pwdHidden = hidden;
        } else {
            window.updateConfirmBoxes = updateBoxes;
            window.confirmBoxes = boxes;
            window.confirmHidden = hidden;
        }
    }

    createCodeBoxes(passwordBoxes, passwordHidden, true);
    createCodeBoxes(confirmBoxes, confirmHidden, false);

    function handleNumClick(value) {
        const target = isPasswordFocused ? 'password' : 'confirm';
        if (target === 'password') {
            if (passwordValue.length < CODE_LENGTH) {
                passwordValue += value;
                window.updatePasswordBoxes(passwordValue);
            }
            if (passwordValue.length === CODE_LENGTH) {
                isPasswordFocused = false;
                const firstConfirm = document.querySelector('#confirmBoxes .password-box:first-child');
                if (firstConfirm) firstConfirm.classList.add('active');
            }
        } else {
            if (confirmValue.length < CODE_LENGTH) {
                confirmValue += value;
                window.updateConfirmBoxes(confirmValue);
            }
            if (confirmValue.length === CODE_LENGTH) {
                checkPasswordMatch();
            }
        }
        checkAllValid();
    }

    function checkPasswordMatch() {
        if (passwordValue.length === CODE_LENGTH && confirmValue.length === CODE_LENGTH) {
            if (passwordValue === confirmValue) {
                // Match
                document.querySelectorAll('#confirmBoxes .password-box').forEach(box => {
                    box.classList.remove('error');
                    box.classList.add('match');
                });
                document.querySelectorAll('#passwordBoxes .password-box').forEach(box => {
                    box.classList.remove('error');
                    box.classList.add('match');
                });
                return true;
            } else {
                // Pas match
                document.querySelectorAll('#confirmBoxes .password-box').forEach(box => {
                    box.classList.remove('match');
                    box.classList.add('error');
                });
                document.querySelectorAll('#passwordBoxes .password-box').forEach(box => {
                    box.classList.remove('match');
                    box.classList.add('error');
                });
                setTimeout(() => {
                    passwordValue = '';
                    confirmValue = '';
                    window.updatePasswordBoxes('');
                    window.updateConfirmBoxes('');
                    isPasswordFocused = true;
                    clearPwdBtn.style.display = 'none';
                    clearConfirmBtn.style.display = 'none';
                    document.querySelector('#passwordBoxes .password-box:first-child').classList.add('active');
                }, 800);
                return false;
            }
        }
        return false;
    }

    // ==========================================
    // CLEAR BUTTONS
    // ==========================================

    clearPwdBtn.addEventListener('click', function() {
        passwordValue = '';
        window.updatePasswordBoxes('');
        this.style.display = 'none';
        isPasswordFocused = true;
        document.querySelector('#passwordBoxes .password-box:first-child').classList.add('active');
        checkAllValid();
    });

    clearConfirmBtn.addEventListener('click', function() {
        confirmValue = '';
        window.updateConfirmBoxes('');
        this.style.display = 'none';
        checkAllValid();
    });

    // ==========================================
    // PAVÉ NUMÉRIQUE
    // ==========================================

    numBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            handleNumClick(this.dataset.value);
        });
        // Support tactile
        btn.addEventListener('touchstart', function(e) {
            e.preventDefault();
            handleNumClick(this.dataset.value);
        }, { passive: false });
    });

    // ==========================================
    // VALIDATION GLOBALE
    // ==========================================

    function checkAllValid() {
        const isPhoneValid = phoneDigits.length === PHONE_LENGTH;
        const isNameValid = nameInput.value.trim().length >= 2;
        const isEmailValid = emailInput.value.trim() === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.value.trim());
        const isPasswordValid = passwordValue.length === CODE_LENGTH && confirmValue.length === CODE_LENGTH && passwordValue === confirmValue;

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
        const phone = phoneDigits;
        const password = passwordValue;

        // Vérification finale
        if (!phone || phone.length !== 10) {
            showMessage('⚠️ Numéro de téléphone invalide.', 'error');
            return;
        }

        if (!name || name.length < 2) {
            showMessage('⚠️ Veuillez entrer votre nom.', 'error');
            return;
        }

        if (password !== confirmValue || password.length !== 4) {
            showMessage('⚠️ Les codes ne correspondent pas.', 'error');
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

    updatePhone('');
    window.updatePasswordBoxes('');
    window.updateConfirmBoxes('');
    document.querySelector('#passwordBoxes .password-box:first-child').classList.add('active');

    console.log('✅ Register vendeur prêt');
});