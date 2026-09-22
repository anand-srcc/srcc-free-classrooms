// Simulate hashPasscode
async function hashPasscode(str) {
    if (crypto && crypto.subtle) {
        const encoder = new TextEncoder();
        const data = encoder.encode(str);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
    return str;
}

const AUTH_HASHES = [
    '06f1339f683c69374e5805994b4956bc856e0204827364a6062894a88d792fae', // srcc2026
];

async function run() {
    let users = [
      {
        username: 'admin',
        fullName: 'Master Administrator (Anand)',
        role: 'Super Admin',
        passwordHash: '06f1339f683c69374e5805994b4956bc856e0204827364a6062894a88d792fae',
        createdAt: 'Default Master Account',
        isSuper: true
      }
    ];

    // Create new user
    const uname = "testuser";
    const pwd = "password123";
    const pwdHash = await hashPasscode(pwd);
    users.push({
        username: uname,
        fullName: "Test User",
        role: "Leave Coordinator",
        passwordHash: pwdHash,
        isSuper: false
    });

    console.log("Users:", users);

    // Try login as new user
    const uInput = "testuser";
    const val = "password123";
    const hashed = await hashPasscode(val);

    let matchedUser = null;
    if (uInput) {
        matchedUser = users.find(u => u.username.toLowerCase() === uInput.toLowerCase());
        if (matchedUser) {
            const isMatch = (matchedUser.passwordHash === hashed) || 
                            (matchedUser.isSuper && (AUTH_HASHES.includes(hashed)));
            if (!isMatch) matchedUser = null;
        }
    }
    console.log("Login result:", matchedUser);
}

run();
