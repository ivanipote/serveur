document.addEventListener('DOMContentLoaded', function() {

    console.log('✅ Login vendeur chargé');

    // ==========================================
    // RÉFÉRENCES
    // ==========================================

    const codeInput = document.getElementById('codeInput');
    const emailInput = document.getElementById('emailInput');
    const emailStatus = document.getElementById('emailStatus');
    const editEmailBtn = document.getElementById('editEmailBtn');
    const blurArea = document.getElementById('blurArea');
    const toggleBtn = document.getElementById('togglePassword');
    const clearBtn = document.getElementById('clearBtn');
    const numBtns = document.querySelectorAll('.num-btn');

    let isEmailLocked = false;
    let isLoggingIn = false;

    // ========================================
    // BOUTON RETOUR VERS REGISTER
    // ========================================

    const backBtn = document.querySelector('header button');
    if (backBtn) {
        backBtn.addEventListener('click', function() {
            window.location.href = '/register';
        });
    }

    // ========================================
    // PRÉ-REMPLIR L'EMAIL DEPUIS L'URL
    // ========================================

    const urlParams = new URLSearchParams(window.location.search);
    const emailFromUrl = urlParams.get('email');

    function lockEmail(email) {
        emailInput.value = email;
        emailInput.disabled = true;
        emailInput.classList.add('locked');
        emailStatus.textContent = '✓';
        emailStatus.className = 'email-status visible valid';
        blurArea.classList.remove('blurred');
        isEmailLocked = true;
        editEmailBtn.style.display = 'block';
        codeInput.focus();
    }

    function unlockEmail() {
        emailInput.disabled = false;
        emailInput.classList.remove('locked');
        isEmailLocked = false;
        editEmailBtn.style.display = 'none';
        emailInput.focus();
        emailInput.select();
        emailStatus.className = 'email-status';
        emailInput.classList.remove('valid', 'invalid');
        blurArea.classList.add('blurred');
    }

    if (emailFromUrl) {
        lockEmail(emailFromUrl);
    } else {
        const savedEmail = localStorage.getItem('sellerEmail');
        if (savedEmail) {
            lockEmail(savedEmail);
        } else {
            emailInput.disabled = false;
            blurArea.classList.add('blurred');
            emailInput.focus();
            editEmailBtn.style.display = 'none';
        }
    }

    editEmailBtn.addEventListener('click', function() {
        unlockEmail();
    });

    emailInput.addEventListener('input', function() {
        if (this.disabled) return;
        const email = this.value.trim();

        if (email === '') {
            emailStatus.className = 'email-status';
            this.classList.remove('valid', 'invalid');
            blurArea.classList.add('blurred');
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (emailRegex.test(email)) {
            emailStatus.textContent = '✓';
            emailStatus.className = 'email-status visible valid';
            this.classList.remove('invalid');
            this.classList.add('valid');
            blurArea.classList.remove('blurred');
        } else {
            emailStatus.textContent = '✗';
            emailStatus.className = 'email-status visible invalid';
            this.classList.remove('valid');
            this.classList.add('invalid');
            blurArea.classList.add('blurred');
        }
    });

    codeInput.addEventListener('focus', function() {
        this.blur();
    });

    codeInput.addEventListener('input', function() {
        if (this.value.length > 0) {
            clearBtn.classList.add('visible');
        } else {
            clearBtn.classList.remove('visible');
        }
    });

    clearBtn.addEventListener('click', function() {
        codeInput.value = '';
        codeInput.classList.remove('error', 'success');
        clearBtn.classList.remove('visible');
        codeInput.focus();
    });

    numBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            if (codeInput.value.length < 4) {
                codeInput.value += this.dataset.value;
                clearBtn.classList.add('visible');
            }
            if (codeInput.value.length === 4) {
                verifierCode();
            }
        });
    });

    // ========================================
    // CONNEXION
    // ========================================

    async function verifierCode() {
        if (isLoggingIn) return;

        const code = codeInput.value;
        const email = emailInput.value.trim();

        if (code.length !== 4) return;

        if (!email) {
            emailInput.classList.add('invalid');
            emailStatus.textContent = '✗';
            emailStatus.className = 'email-status visible invalid';
            blurArea.classList.add('blurred');
            if (navigator.vibrate) navigator.vibrate(200);
            setTimeout(() => {
                emailInput.classList.remove('invalid');
                emailInput.focus();
            }, 700);
            return;
        }

        isLoggingIn = true;

        try {
            const response = await fetch('/api/seller/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password: code })
            });

            const data = await response.json();

            if (response.ok) {
                // ✅ STOCKER DANS localStorage
                localStorage.setItem('sellerToken', data.token);
                localStorage.setItem('sellerId', data.seller.id);
                localStorage.setItem('sellerName', data.seller.name);
                localStorage.setItem('sellerEmail', data.seller.email);
                localStorage.setItem('sellerPhone', data.seller.phone);
                localStorage.setItem('sellerStatus', data.seller.status);

                console.log('✅ Connexion vendeur réussie - sellerId:', data.seller.id);

                codeInput.classList.add('success');
                codeInput.classList.remove('error');

                setTimeout(() => {
                    window.location.href = '/dashboard';
                }, 600);
            } else {
                codeInput.classList.add('error');
                codeInput.classList.remove('success');
                if (navigator.vibrate) navigator.vibrate(200);

                setTimeout(() => {
                    codeInput.value = '';
                    codeInput.classList.remove('error');
                    clearBtn.classList.remove('visible');
                    codeInput.focus();
                    isLoggingIn = false;
                }, 700);
            }
        } catch (error) {
            console.error('Erreur:', error);
            codeInput.classList.add('error');
            setTimeout(() => {
                codeInput.value = '';
                codeInput.classList.remove('error');
                clearBtn.classList.remove('visible');
                codeInput.focus();
                isLoggingIn = false;
            }, 700);
        }
    }

    toggleBtn.addEventListener('click', function() {
        const icon = this.querySelector('i');
        if (codeInput.type === 'password') {
            codeInput.type = 'text';
            icon.className = 'fas fa-eye-slash';
        } else {
            codeInput.type = 'password';
            icon.className = 'fas fa-eye';
        }
    });

});