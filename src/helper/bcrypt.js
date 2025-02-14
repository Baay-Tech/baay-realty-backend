const bcrypt = require('bcrypt');

// Function to hash a password
const hashPassword = async (password) => {
    const saltRounds = 10; // Number of salt rounds, the higher the number, the more secure but slower
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    return hashedPassword;
};

// Function to compare a plain text password with a hashed password
const comparePassword = async (password, hashedPassword) => {
    const match = await bcrypt.compare(password, hashedPassword);
    return match;
};

module.exports = {
    hashPassword,
    comparePassword
};