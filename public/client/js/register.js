document.addEventListener('DOMContentLoaded', function() {

    // ==========================================
    // ÉLÉMENTS
    // ==========================================

    const nameInput = document.getElementById('nameInput');
    const nameStatus = document.getElementById('nameStatus');
    const nameWrapper = nameInput.closest('.input-wrapper-register');

    const emailInput = document.getElementById('emailInput');
    const emailStatus = document.getElementById('emailStatus');
    const emailWrapper = emailInput.closest('.input-wrapper-register');

    const phoneContainer = document.querySelector('.phone-container');
    const phoneBoxes = document.getElementById('phoneBoxes');
    const phoneHidden = document.getElementById('phoneHiddenInput');
    const phoneStatus = document.getElementById('phoneStatus');

    const nextBtn = document.getElementById('nextBtn');
    const prevBtn3 = document.getElementById('prevBtn3');
    const createBtn = document.getElementById('createBtn');

    const step1 = document.getElementById('step1');
    const step2 = document.getElementById('step2');
    const step3 = document.getElementById('step3');
    const titleText = document.getElementById('titleText');
    const welcomeText = document.getElementById('welcomeText');

    const clearPwdBtn = document.getElementById('clearPwdBtn');
    const clearConfirmBtn = document.getElementById('clearConfirmBtn');

    const PHONE_LENGTH = 10;
    let isNameValid = false;
    let isEmailValid = false;
    let isPhoneValid = false;
    let currentStep = 1;

    // ==========================================
    // NAVIGATION
    // ==========================================

    function goToStep1() {
        currentStep = 1;
        step1.style.display = 'block';
        step2.style.display = 'none';
        step3.style.display = 'none';
        titleText.textContent = 'Entrez vos informations client';
        welcomeText.textContent = 'Bienvenue sur Nature+ ! Merci de renseigner vos informations pour créer votre compte client.';
        nameInput.value = sessionStorage.getItem('reg_name') || '';
        emailInput.value = sessionStorage.getItem('reg_email') || '';
        phoneHidden.value = sessionStorage.getItem('reg_phone') || '';
        updatePhoneBoxes(phoneHidden.value);
        nameInput.dispatchEvent(new Event('input'));
        emailInput.dispatchEvent(new Event('input'));
    }

    function goToStep2() {
        currentStep = 2;
        step1.style.display = 'none';
        step2.style.display = 'block';
        step3.style.display = 'none';
        titleText.textContent = 'Créez votre mot de passe secret';
        welcomeText.textContent = 'Entrez un mot de passe à 4 chiffres, puis confirmez-le.';
        passwordValue = '';
        confirmValue = '';
        isPasswordFocused = true;
        if (window.updatePasswordBoxes) window.updatePasswordBoxes('');
        if (window.updateConfirmBoxes) window.updateConfirmBoxes('');
        clearPwdBtn.style.display = 'none';
        clearConfirmBtn.style.display = 'none';
        const firstBox = document.querySelector('#passwordBoxes .password-box:first-child');
        if (firstBox) firstBox.classList.add('active');
    }

    function goToStep3() {
        currentStep = 3;
        step2.style.display = 'none';
        step3.style.display = 'block';
        titleText.textContent = 'Vérifiez vos informations';
        welcomeText.textContent = 'Confirmez que toutes vos informations sont correctes.';

        document.getElementById('recapName').textContent = sessionStorage.getItem('reg_name') || '';
        document.getElementById('recapEmail').textContent = sessionStorage.getItem('reg_email') || '';
        document.getElementById('recapPhone').textContent = '+225 ' + (sessionStorage.getItem('reg_phone') || '');
        document.getElementById('recapPassword').textContent = sessionStorage.getItem('reg_password') || '••••';
    }

    // ==========================================
    // BOUTON RETOUR HEADER
    // ==========================================

    const backBtn = document.querySelector('header button');
    backBtn.addEventListener('click', function(e) {
        e.preventDefault();
        if (currentStep === 1) {
            window.location.href = '/client/html/login.html';
        } else if (currentStep === 2) {
            goToStep1();
        } else if (currentStep === 3) {
            goToStep1();
        }
    });

    // ==========================================
    // ÉTAPE 1 : VALIDATION
    // ==========================================

    nameInput.addEventListener('input', function() {
        const val = this.value.trim();
        if (val.length >= 2) {
            nameStatus.textContent = '✓';
            nameStatus.className = 'input-status visible valid';
            nameWrapper.classList.remove('invalid');
            nameWrapper.classList.add('valid');
            isNameValid = true;
        } else if (val.length > 0 && val.length < 2) {
            nameStatus.textContent = '✗';
            nameStatus.className = 'input-status visible invalid';
            nameWrapper.classList.remove('valid');
            nameWrapper.classList.add('invalid');
            isNameValid = false;
        } else {
            nameStatus.className = 'input-status';
            nameWrapper.classList.remove('valid', 'invalid');
            isNameValid = false;
        }
        checkAllValid();
    });

    emailInput.addEventListener('input', function() {
        const val = this.value.trim();
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (regex.test(val)) {
            emailStatus.textContent = '✓';
            emailStatus.className = 'input-status visible valid';
            emailWrapper.classList.remove('invalid');
            emailWrapper.classList.add('valid');
            isEmailValid = true;
        } else if (val.length > 0) {
            emailStatus.textContent = '✗';
            emailStatus.className = 'input-status visible invalid';
            emailWrapper.classList.remove('valid');
            emailWrapper.classList.add('invalid');
            isEmailValid = false;
        } else {
            emailStatus.className = 'input-status';
            emailWrapper.classList.remove('valid', 'invalid');
            isEmailValid = false;
        }
        checkAllValid();
    });

    // ===== TÉLÉPHONE =====
    for (let i = 0; i < PHONE_LENGTH; i++) {
        const box = document.createElement('div');
        box.className = 'phone-box';
        box.dataset.index = i;
        phoneBoxes.appendChild(box);
    }
    const boxes = phoneBoxes.querySelectorAll('.phone-box');

    function updatePhoneBoxes(value) {
        const digits = value.replace(/\D/g, '').slice(0, PHONE_LENGTH);
        phoneHidden.value = digits;
        boxes.forEach((box, index) => {
            const char = digits[index] || '';
            box.textContent = char;
            box.classList.toggle('filled', char !== '');
            box.classList.remove('active');
        });
        if (digits.length < PHONE_LENGTH) {
            boxes[digits.length].classList.add('active');
        }
        if (digits.length === PHONE_LENGTH) {
            phoneStatus.textContent = '✓';
            phoneStatus.className = 'input-status visible valid';
            phoneContainer.classList.remove('invalid');
            phoneContainer.classList.add('valid');
            isPhoneValid = true;
        } else if (digits.length > 0) {
            phoneStatus.textContent = '✗';
            phoneStatus.className = 'input-status visible invalid';
            phoneContainer.classList.remove('valid');
            phoneContainer.classList.add('invalid');
            isPhoneValid = false;
        } else {
            phoneStatus.className = 'input-status';
            phoneContainer.classList.remove('valid', 'invalid');
            isPhoneValid = false;
        }
        checkAllValid();
    }

    phoneHidden.addEventListener('input', function() {
        updatePhoneBoxes(this.value);
    });
    phoneContainer.addEventListener('click', function() {
        phoneHidden.focus();
        phoneHidden.click();
    });
    phoneBoxes.addEventListener('click', function() {
        phoneHidden.focus();
        phoneHidden.click();
    });
    updatePhoneBoxes('');

    function checkAllValid() {
        if (isNameValid && isEmailValid && isPhoneValid) {
            nextBtn.classList.add('active');
            nextBtn.disabled = false;
        } else {
            nextBtn.classList.remove('active');
            nextBtn.disabled = true;
        }
    }

    nextBtn.addEventListener('click', function() {
        if (this.disabled) return;
        sessionStorage.setItem('reg_name', nameInput.value.trim());
        sessionStorage.setItem('reg_email', emailInput.value.trim());
        sessionStorage.setItem('reg_phone', phoneHidden.value);
        goToStep2();
        initPasswordStep();
    });

    // ==========================================
    // ÉTAPE 2 : MOT DE PASSE (auto)
    // ==========================================

    let passwordValue = '';
    let confirmValue = '';
    let isPasswordFocused = true;

    function initPasswordStep() {
        createPasswordBoxes('passwordBoxes', 'passwordHidden', true);
        createPasswordBoxes('confirmBoxes', 'confirmHidden', false);
        document.querySelectorAll('.num-btn-pwd').forEach(btn => {
            btn.removeEventListener('click', handlePaveClick);
            btn.addEventListener('click', handlePaveClick);
        });
        passwordValue = '';
        confirmValue = '';
        isPasswordFocused = true;
        if (window.updatePasswordBoxes) window.updatePasswordBoxes('');
        if (window.updateConfirmBoxes) window.updateConfirmBoxes('');
        clearPwdBtn.style.display = 'none';
        clearConfirmBtn.style.display = 'none';
        const firstBox = document.querySelector('#passwordBoxes .password-box:first-child');
        if (firstBox) firstBox.classList.add('active');
    }

    function createPasswordBoxes(containerId, hiddenId, isPassword) {
        const container = document.getElementById(containerId);
        const hidden = document.getElementById(hiddenId);
        container.innerHTML = '';
        for (let i = 0; i < 4; i++) {
            const box = document.createElement('div');
            box.className = 'password-box';
            box.dataset.index = i;
            container.appendChild(box);
        }
        const boxes = container.querySelectorAll('.password-box');

        function updateBoxes(value) {
            const digits = value.slice(0, 4);
            hidden.value = digits;
            boxes.forEach((box, index) => {
                const char = digits[index] || '';
                box.textContent = char;
                box.classList.toggle('filled', char !== '');
                box.classList.remove('active');
            });
            if (digits.length < 4) {
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

    function handlePaveClick(e) {
        const value = this.dataset.value;
        const target = isPasswordFocused ? 'password' : 'confirm';
        if (target === 'password') {
            if (passwordValue.length < 4) {
                passwordValue += value;
                window.updatePasswordBoxes(passwordValue);
            }
            if (passwordValue.length === 4) {
                isPasswordFocused = false;
                const firstConfirm = document.querySelector('#confirmBoxes .password-box:first-child');
                if (firstConfirm) firstConfirm.classList.add('active');
            }
        } else {
            if (confirmValue.length < 4) {
                confirmValue += value;
                window.updateConfirmBoxes(confirmValue);
            }
            if (confirmValue.length === 4) {
                checkPasswordMatch();
            }
        }
    }

    function checkPasswordMatch() {
        if (passwordValue.length === 4 && confirmValue.length === 4) {
            if (passwordValue === confirmValue) {
                sessionStorage.setItem('reg_password', passwordValue);
                setTimeout(function() {
                    goToStep3();
                }, 300);
            } else {
                setTimeout(function() {
                    passwordValue = '';
                    confirmValue = '';
                    window.updatePasswordBoxes('');
                    window.updateConfirmBoxes('');
                    isPasswordFocused = true;
                    clearPwdBtn.style.display = 'none';
                    clearConfirmBtn.style.display = 'none';
                    const firstPwd = document.querySelector('#passwordBoxes .password-box:first-child');
                    if (firstPwd) firstPwd.classList.add('active');
                }, 500);
            }
        }
    }

    // ===== CROIX POUR EFFACER =====
    clearPwdBtn.addEventListener('click', function() {
        passwordValue = '';
        window.updatePasswordBoxes('');
        this.style.display = 'none';
        isPasswordFocused = true;
        const firstPwd = document.querySelector('#passwordBoxes .password-box:first-child');
        if (firstPwd) firstPwd.classList.add('active');
    });

    clearConfirmBtn.addEventListener('click', function() {
        confirmValue = '';
        window.updateConfirmBoxes('');
        this.style.display = 'none';
    });

    // ==========================================
    // ÉTAPE 3 : BOUTONS
    // ==========================================

    prevBtn3.addEventListener('click', function() {
        goToStep1();
    });

    createBtn.addEventListener('click', async function() {
        const userData = {
            name: sessionStorage.getItem('reg_name'),
            email: sessionStorage.getItem('reg_email'),
            phone: sessionStorage.getItem('reg_phone'),
            password: sessionStorage.getItem('reg_password')
        };

        try {
            const response = await fetch('/api/client/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userData)
            });

            const data = await response.json();

            if (response.ok) {
                // ✅ Stocker l'email pour le pré-remplir sur la page login
                localStorage.setItem('userEmail', userData.email);

                // ✅ Rediriger vers login avec l'email pré-rempli
                window.location.href = '/client/html/login.html?email=' + encodeURIComponent(userData.email);
            } else {
                alert('❌ ' + (data.error || 'Erreur lors de l\'inscription'));
            }
        } catch (error) {
            console.error('Erreur:', error);
            alert('❌ Erreur de connexion au serveur.');
        }
    });

});