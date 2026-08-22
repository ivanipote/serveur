document.addEventListener('DOMContentLoaded', function() {

    console.log('✅ login.js chargé');

    // ==========================================
    // RÉFÉRENCES
    // ==========================================

    const form = document.getElementById('loginForm');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const togglePassword = document.getElementById('togglePassword');
    const loginBtn = document.getElementById('loginBtn');
    const messageDiv = document.getElementById('message');
    const emailStatus = document.getElementById('emailStatus');

    // ==========================================
    // PRÉ-REMPLIR L'EMAIL (retour de register)
    // ==========================================

    const urlParams = new URLSearchParams(window.location.search);
    const emailFromUrl = urlParams.get('email');

    if (emailFromUrl) {
        emailInput.value = emailFromUrl;
        validateEmail(emailFromUrl);
    }

    // ==========================================
    // VALIDATION EMAIL EN TEMPS RÉEL
    // ==========================================

    emailInput.addEventListener('input', function() {
        const email = this.value.trim();
        validateEmail(email);
    });

    function validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (email === '') {
            emailStatus.className = 'input-status';
            emailStatus.textContent = '';
            return;
        }

        if (emailRegex.test(email)) {
            emailStatus.className = 'input-status visible valid';
            emailStatus.textContent = '✓ Email valide';
            emailInput.style.borderColor = '#17A464';
        } else {
            emailStatus.className = 'input-status visible invalid';
            emailStatus.textContent = '✗ Email invalide';
            emailInput.style.borderColor = '#C0342A';
        }
    }

    // ==========================================
    // TOGGLE MOT DE PASSE
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
    // AFFICHER LES MESSAGES
    // ==========================================

    function showMessage(text, type) {
        messageDiv.textContent = text;
        messageDiv.className = 'message ' + type;
    }

    function hideMessage() {
        messageDiv.className = 'message';
        messageDiv.textContent = '';
    }

    // ==========================================
    // SOUMISSION DU FORMULAIRE
    // ==========================================

    form.addEventListener('submit', async function(e) {
        e.preventDefault();

        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();

        // ✅ Validation email
        if (!email) {
            showMessage('⚠️ Veuillez entrer votre email.', 'error');
            emailInput.focus();
            return;
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            showMessage('⚠️ Email invalide.', 'error');
            emailInput.focus();
            return;
        }

        // ✅ Validation mot de passe
        if (!password) {
            showMessage('⚠️ Veuillez entrer votre mot de passe.', 'error');
            passwordInput.focus();
            return;
        }

        if (password.length < 6) {
            showMessage('⚠️ Le mot de passe doit faire au moins 6 caractères.', 'error');
            passwordInput.focus();
            return;
        }

        // ✅ Désactiver le bouton pendant la requête
        loginBtn.disabled = true;
        loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connexion...';
        showMessage('⏳ Connexion en cours...', 'info');

        try {
            const response = await fetch('/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok) {
                // ✅ STOCKER TOUTES LES INFOS ADMIN
                localStorage.setItem('adminToken', 'logged_in');
                localStorage.setItem('adminName', data.admin.merchant_name);
                localStorage.setItem('adminEmail', data.admin.email);
                localStorage.setItem('adminId', data.admin.id);

                showMessage('✅ Connexion réussie ! Redirection...', 'success');

                setTimeout(() => {
                    window.location.href = '/admin/dashboard';
                }, 800);
            } else {
                showMessage('❌ ' + (data.error || 'Email ou mot de passe incorrect'), 'error');
                loginBtn.disabled = false;
                loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Se connecter';
            }
        } catch (error) {
            console.error('Erreur:', error);
            showMessage('❌ Erreur de connexion au serveur.', 'error');
            loginBtn.disabled = false;
            loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Se connecter';
        }
    });

    // ==========================================
    // ENTRÉE SUR LE CHAMP MOT DE PASSE
    // ==========================================

    passwordInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            form.dispatchEvent(new Event('submit'));
        }
    });

    console.log('✅ login.js initialisé');

});