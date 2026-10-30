import bcrypt from 'bcryptjs'

// Read the password from the environment, never from argv, so it does not end
// up in shell history or process listings.
const password = process.env.ADMIN_PASSWORD

if (!password) {
  console.error(
    'Set ADMIN_PASSWORD (for example: $env:ADMIN_PASSWORD="..." on PowerShell) and run again.'
  )
  process.exit(1)
}

if (password.length < 12) {
  console.error('Use a password with at least 12 characters.')
  process.exit(1)
}

console.log(bcrypt.hashSync(password, 12))
