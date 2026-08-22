document.addEventListener('DOMContentLoaded', function() {

    console.log('✅ register.js chargé');

    // ==========================================
    // RÉFÉRENCES
    // ==========================================

    const form = document.getElementById('registerForm');
    const merchantNameInput = document.getElementById('merchantName');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const contactInput = document.getElementById('contact');
    const logoInput = document.getElementById('logo');
    const togglePassword = document.getElementById('togglePassword');
    const registerBtn = document.getElementById('registerBtn');
    const messageDiv = document.getElementById('message');
    const nameStatus = document.getElementById('nameStatus');
    const emailStatus = document.getElementById('emailStatus');

    // ==========================================
    // VALIDATION NOM EN TEMPS RÉEL
    // ==========================================

    merchantNameInput.addEventListener('input', function() {
        const name = this.value.trim();

        if (name === '') {
            nameStatus.className = 'input-status';
            nameStatus.textContent = '';
            return;
        }

        if (name.length >= 2) {
            nameStatus.className = 'input-status visible valid';
            nameStatus.textContent = '✓ Nom valide';
            this.style.borderColor = '#17A464';
        } else {
            nameStatus.className = 'input-status visible invalid';
            nameStatus.textContent = '✗ Minimum 2 caractères';
            this.style.borderColor = '#C0342A';
        }
    });

    // ==========================================
    // VALIDATION EMAIL EN TEMPS RÉEL
    // ==========================================

    emailInput.addEventListener('input', function() {
        const email = this.value.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (email === '') {
            emailStatus.className = 'input-status';
            emailStatus.textContent = '';
            return;
        }

        if (emailRegex.test(email)) {
            emailStatus.className = 'input-status visible valid';
            emailStatus.textContent = '✓ Email valide';
            this.style.borderColor = '#17A464';
        } else {
            emailStatus.className = 'input-status visible invalid';
            emailStatus.textContent = '✗ Email invalide';
            this.style.borderColor = '#C0342A';
        }
    });

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

        const merchantName = merchantNameInput.value.trim();
        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();
        const contact = contactInput.value.trim();
        const logo = logoInput.value.trim();

        // ✅ Validation nom
        if (!merchantName || merchantName.length < 2) {
            showMessage('⚠️ Nom du marchand requis (minimum 2 caractères).', 'error');
            merchantNameInput.focus();
            return;
        }

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
            showMessage('⚠️ Veuillez entrer un mot de passe.', 'error');
            passwordInput.focus();
            return;
        }

        if (password.length < 6) {
            showMessage('⚠️ Le mot de passe doit faire au moins 6 caractères.', 'error');
            passwordInput.focus();
            return;
        }

        // ✅ Désactiver le bouton pendant la requête
        registerBtn.disabled = true;
        registerBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Inscription...';
        showMessage('⏳ Création du compte en cours...', 'info');

        try {
            const response = await fetch('/api/admin/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    merchantName,
                    email,
                    password,
                    contact: contact || null,
                    logo: logo || null
                })
            });

            const data = await response.json();

            if (response.ok) {
                showMessage('✅ Compte créé avec succès ! Redirection...', 'success');

                // ✅ Rediriger vers login avec email pré-rempli
                setTimeout(() => {
                    window.location.href = '/admin/login?email=' + encodeURIComponent(email);
                }, 1200);
            } else {
                showMessage('❌ ' + (data.error || 'Erreur lors de l\'inscription'), 'error');
                registerBtn.disabled = false;
                registerBtn.innerHTML = '<i class="fas fa-user-plus"></i> Créer mon compte';
            }
        } catch (error) {
            console.error('Erreur:', error);
            showMessage('❌ Erreur de connexion au serveur.', 'error');
            registerBtn.disabled = false;
            registerBtn.innerHTML = '<i class="fas fa-user-plus"></i> Créer mon compte';
        }
    });

    // ==========================================
    // ENTRÉE SUR LE CHAMP
    // ==========================================

    passwordInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            form.dispatchEvent(new Event('submit'));
        }
    });

    console.log('✅ register.js initialisé');

});